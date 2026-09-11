#!/usr/bin/env node
/**
 * Janus-Präsenz-Hook.
 *
 * Meldet den Zustand einer Claude-Code-Session an das Janus-Agenten-Board,
 * indem er eine kleine JSON-Datei je Session schreibt. Janus liest sie nur
 * (siehe src/lib/server/agenten.js) – es gibt keinen Dienst und keinen Port.
 *
 * Einrichtung: Pfad in ~/.claude/settings.json eintragen, z. B.
 *
 *   { "hooks": {
 *       "SessionStart":  [{ "hooks": [{ "type": "command",
 *          "command": "node ~/.janus/hooks/praesenz.mjs", "async": true }] }],
 *       "Notification":  [{ "matcher": "agent_needs_input|idle_prompt|permission_prompt|agent_completed",
 *          "hooks": [{ "type": "command",
 *          "command": "node ~/.janus/hooks/praesenz.mjs", "async": true }] }],
 *       "Stop":          [ ... ], "StopFailure": [ ... ], "SessionEnd": [ ... ] } }
 *
 * `async: true` ist Absicht: eine Präsenzmeldung darf die Session nie bremsen.
 *
 * Der Hook meldet nur, was er wissen kann – Host, Arbeitsordner, Zustand. Die
 * `SendMessage`-Adresse steht *nicht* im Payload; die trägt die Session selbst
 * nach (siehe `--name` unten), sonst rät Janus sie aus dem Ordnernamen.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = process.env.JANUS_PRAESENZ_DIR || path.join(os.homedir(), '.janus', 'agenten');

/** Janus-Adresse, falls gesetzt – dann wird über HTTP gemeldet statt in die Datei. */
function janusUrl() {
	if (process.env.JANUS_URL) return process.env.JANUS_URL.replace(/\/+$/, '');
	try {
		const c = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.janus', 'config.json'), 'utf8'));
		if (c?.url) return String(c.url).replace(/\/+$/, '');
	} catch {
		/* keine Adresse konfiguriert -> Dateiweg */
	}
	return null;
}

function token() {
	if (process.env.JANUS_TOKEN) return process.env.JANUS_TOKEN.trim();
	try {
		return fs.readFileSync(path.join(os.homedir(), '.janus', 'token'), 'utf8').trim() || null;
	} catch {
		return null;
	}
}

/** Ein Hook darf niemals die Session stören: alles Unerwartete endet still. */
function raus(code = 0) {
	process.exit(code);
}

function statusAus(event, notificationType) {
	switch (event) {
		case 'SessionStart':
		case 'UserPromptSubmit':
			// Ohne dieses Ereignis bliebe eine Session nach dem ersten `Stop`
			// für immer "idle" – auch mitten in der Arbeit.
			return 'arbeitet';
		case 'Stop':
			return 'idle';
		case 'StopFailure':
			return 'fehler';
		case 'SessionEnd':
			return 'beendet';
		case 'Notification':
			switch (notificationType) {
				// Nur das ist echtes Warten: die Session kommt ohne Antwort des
				// Menschen nicht weiter.
				case 'agent_needs_input':
				case 'permission_prompt':
					return 'wartet';
				// `idle_prompt` heißt "hier hat länger niemand getippt" – das ist
				// Ruhe, nicht Bedarf. Als Warten gedeutet ruft das Board nach
				// Aufmerksamkeit, obwohl nichts anliegt; und wer einmal grundlos
				// gerufen wurde, glaubt dem nächsten Ruf weniger.
				case 'idle_prompt':
				case 'agent_completed':
					return 'idle';
				default:
					return 'arbeitet';
			}
		default:
			return 'arbeitet';
	}
}

async function stdinLesen() {
	const stuecke = [];
	for await (const s of process.stdin) stuecke.push(s);
	return Buffer.concat(stuecke).toString('utf8');
}

// Optionales `--name <ListAgents-Name>`: erlaubt der Session, ihre Adresse
// nachzutragen, ohne dass ein zweiter Mechanismus nötig wäre.
function nameAusArgv() {
	const i = process.argv.indexOf('--name');
	return i >= 0 && process.argv[i + 1] ? String(process.argv[i + 1]) : null;
}

/** `--status <wert>`: erlaubt dem Minion, "arbeitet" zu melden, wenn er
 *  eine Nachricht zustellt – die Session wacht ja gerade dadurch auf. */
function statusAusArgv() {
	const i = process.argv.indexOf('--status');
	return i >= 0 && process.argv[i + 1] ? String(process.argv[i + 1]) : null;
}

/** Bestehenden Eintrag lesen, ohne zu werfen. */
function bisheriger(ziel) {
	try {
		return JSON.parse(fs.readFileSync(ziel, 'utf8'));
	} catch {
		return {};
	}
}

try {
	const roh = await stdinLesen();
	let p;
	let leseFehler = null;
	try {
		p = roh.trim() ? JSON.parse(roh) : {};
	} catch (e) {
		// Nicht still aussteigen: sonst bleibt der alte Eintrag stehen und sieht
		// auf dem Board frisch aus. Auf Windows ist das kein Randfall – ein
		// Backslash-Pfad überlebt keine Shell-Schicht, und `\700` wird sogar als
		// Oktal-Escape gelesen. Ein unlesbarer Payload muss sichtbar werden.
		p = {};
		leseFehler = String(e?.message || e).slice(0, 200);
	}

	// Als Hook kommt die Session-ID im Payload. Ruft eine Session das Skript
	// dagegen von Hand auf (Selbstregistrierung des Namens), gibt es keinen
	// Payload – dann liefert die Umgebung die ID, sonst entstünde ein zweiter,
	// verwaister Eintrag statt eines Updates.
	const sidRoh = p.session_id || process.env.CLAUDE_CODE_SESSION_ID;
	if (!sidRoh) raus(); // ohne Identität lieber nichts schreiben
	const sid = String(sidRoh).replace(/[^\w.-]/g, '_');
	const ziel = path.join(DIR, sid + '.json');

	// Vorherigen Stand lesen: ein späterer Hook ohne --name darf den
	// registrierten Namen nicht verlieren, und eine Namensmeldung darf
	// umgekehrt nicht Status und Frage plattmachen.
	let bisher = {};
	try {
		bisher = JSON.parse(fs.readFileSync(ziel, 'utf8'));
	} catch {
		bisher = {};
	}

	// Ohne Event-Namen ist das kein Hook, sondern ein Aufruf von Hand
	// (Selbstregistrierung) – dann bleibt der Zustand, wie er war.
	const istHook = Boolean(p.hook_event_name);
	const erzwungen = statusAusArgv();
	const status = erzwungen ?? (istHook ? statusAus(p.hook_event_name, p.notification_type) : (bisher.status ?? 'arbeitet'));

	if (status === 'beendet') {
		fs.rmSync(ziel, { force: true });
		raus();
	}

	fs.mkdirSync(DIR, { recursive: true });

	const eintrag = {
		session_id: sid,
		status,
		cwd: p.cwd || bisher.cwd || process.cwd() || null,
		host: os.hostname(),
		// Windows und WSL melden auf derselben Maschine denselben Hostnamen.
		// Ohne dieses Feld sind die beiden Welten nicht zu unterscheiden –
		// sie haben aber verschiedene Heimatverzeichnisse, Pfadformen und
		// Präsenzverzeichnisse.
		plattform: process.platform,
		name: nameAusArgv() || bisher.name || null,
		transcript: p.transcript_path || bisher.transcript || null,
		frage: istHook ? p.notification_text || null : (bisher.frage ?? null),
		// Sichtbar machen, dass sich jemand meldet, aber unlesbar spricht.
		fehler: leseFehler,
		// Bei reiner Namensmeldung die Wartezeit nicht zurücksetzen.
		seit: istHook || !bisher.seit ? new Date().toISOString() : bisher.seit
	};

	// Liegt Janus auf einem anderen Wirt (typisch: Windows neben WSL), führt der
	// Dateiweg über eine Netzfreigabe – langsam, und still fehlschlagend, sobald
	// die andere Welt aus ist. Dann lieber HTTP; die Datei bleibt der Weg für
	// Sessions auf demselben Wirt wie Janus.
	const url = janusUrl();
	if (url) {
		try {
			const kopf = { 'content-type': 'application/json' };
			const t = token();
			if (t) kopf['x-janus-token'] = t;
			const res = await fetch(url + '/api/agent/praesenz', {
				method: 'POST',
				headers: kopf,
				body: JSON.stringify(eintrag),
				signal: AbortSignal.timeout(5000)
			});
			if (res.ok) raus();
			// sonst: unten in die Datei, besser als gar nichts
		} catch {
			/* Janus nicht erreichbar – Dateiweg versuchen */
		}
	}

	// Atomar schreiben: Janus soll nie eine halb geschriebene Datei sehen.
	const tmp = ziel + '.tmp';
	fs.writeFileSync(tmp, JSON.stringify(eintrag, null, '\t') + '\n', 'utf8');
	fs.renameSync(tmp, ziel);
} catch {
	// still scheitern – lieber keine Präsenz als eine gestörte Session
}
raus();

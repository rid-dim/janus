#!/usr/bin/env node
/**
 * Janus-Minion: hält den Postfach-Kanal einer Session offen.
 *
 * Vorbild ist SaltStack: der Minion verbindet sich zum Master, nicht umgekehrt.
 * Dadurch funktioniert es durch NAT und Firewalls hindurch, und Janus muss
 * nicht auf derselben Maschine stehen.
 *
 * Einrichtung als `Stop`-Hook (feuert, wenn die Session einen Turn beendet):
 *
 *   "Stop": [{ "hooks": [{ "type": "command",
 *     "command": "node /home/<du>/.janus/hooks/minion.mjs",
 *     "asyncRewake": true, "timeout": 86400 }] }]
 *
 * **Der `timeout` deckelt die Lebensdauer, nicht `JANUS_MINION_MINUTEN`.**
 * Ein Hook mit `async: true` ist von der Timeout-Durchsetzung ausgenommen, einer
 * mit `asyncRewake: true` nicht – und nur letzterer weckt bei `exit 2`. Der
 * Minion unterliegt dem Timeout also zwangslaeufig. Er
 * muss groesser sein als das Budget in Sekunden, sonst wird der Poller von
 * aussen beendet und der Kanal steht nur bis dahin. Ein Beispiel mit
 * "timeout": 120 neben einem Budget von 240 Minuten stand hier frueher und war
 * um den Faktor 120 falsch – gefunden erst, als eine Nachricht 35 Sekunden nach
 * Ablauf des Timeouts eintraf und niemanden weckte.
 *
 * Ablauf: der Hook startet im Hintergrund eine Poll-**Schleife**. Kommt nichts,
 * endet sie nach dem Zeitbudget mit 0 und niemand merkt etwas. Kommt Post,
 * schreibt der Minion sie nach stderr und endet mit **2** – das weckt die
 * Session, und der Text erscheint dort als System-Reminder. Am Ende des
 * nächsten Turns feuert `Stop` erneut, und der Kanal steht wieder.
 *
 * Die Schleife ist der Kern, nicht Beiwerk: ein einzelner Long-Poll hält den
 * Kanal nur für seine Dauer offen. Danach wäre die Session taub, bis sie von
 * sich aus wieder einen Turn beendet – ausgerechnet im Hauptfall, dass jemand
 * schreibt, während gerade niemand hinschaut. Deshalb pollt der Minion bis zum
 * Zeitbudget (Vorgabe 1440 min, also ein Tag) weiter.
 *
 * Ein Schloss verhindert, dass sich Poller stapeln: feuert `Stop` erneut,
 * während schon einer läuft, beendet sich der neue sofort.
 *
 * Gemessen am 11.09.2026: eine 40 s untätige Session wurde so zuverlässig
 * geweckt, der Text kam vollständig an, Eingaben des Menschen gingen währenddes-
 * sen nicht verloren.
 *
 * Wichtig: Weil `exit 2` als *Fehler* etikettiert ankommt ("Stop hook blocking
 * error"), gibt sich der Text ausdrücklich als Post zu erkennen – sonst sucht
 * die geweckte Session einen Bug, den es nicht gibt.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();

/** Janus-Adresse: Umgebung, sonst ~/.janus/config.json, sonst lokal. */
function janusUrl() {
	if (process.env.JANUS_URL) return process.env.JANUS_URL.replace(/\/+$/, '');
	try {
		const c = JSON.parse(fs.readFileSync(path.join(HOME, '.janus', 'config.json'), 'utf8'));
		if (c?.url) return String(c.url).replace(/\/+$/, '');
	} catch {
		/* Vorgabe unten */
	}
	return 'http://127.0.0.1:5173';
}

function token() {
	if (process.env.JANUS_TOKEN) return process.env.JANUS_TOKEN.trim();
	try {
		return fs.readFileSync(path.join(HOME, '.janus', 'token'), 'utf8').trim() || null;
	} catch {
		return null;
	}
}

async function stdinLesen() {
	const teile = [];
	for await (const s of process.stdin) teile.push(s);
	return Buffer.concat(teile).toString('utf8');
}

/** Eine Nachricht so darstellen, dass sofort klar ist: das ist Post, kein Fehler. */
function darstellen(n, anleitungVomServer) {
	const von = n.von?.name ? `${n.von.name}${n.von.art ? ' (' + n.von.art + ')' : ''}` : 'unbekannt';
	const zeilen = [
		'JANUS-POSTFACH — kein Fehler, sondern eine zugestellte Nachricht.',
		'',
		`Von:   ${von}`,
		n.thema ? `Thema: ${n.thema}` : null,
		n.vermittlung ? `Vermittlung: ${n.vermittlung}` : null,
		'',
		n.text,
		'',
		anleitungVomServer ?? '— Antworten: POST /api/agent/nachricht mit {"session","text"}.'
	];
	return zeilen.filter((z) => z !== null).join('\n');
}

/** Schloss je Session: ein Poller reicht, gestapelte wären Verschwendung. */
function schlossPfad(session) {
	return path.join(HOME, '.janus', 'kanal', 'minion', session.replace(/[^\w.-]/g, '_') + '.pid');
}

function laeuftSchon(session) {
	try {
		const pid = Number(fs.readFileSync(schlossPfad(session), 'utf8').trim());
		if (!pid || pid === process.pid) return false;
		process.kill(pid, 0); // wirft, wenn der Prozess weg ist
		return true;
	} catch {
		return false; // kein Schloss, oder der Halter lebt nicht mehr
	}
}

function schlossNehmen(session) {
	const p = schlossPfad(session);
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, String(process.pid), 'utf8');
	const weg = () => {
		try {
			if (Number(fs.readFileSync(p, 'utf8').trim()) === process.pid) fs.rmSync(p, { force: true });
		} catch {
			/* egal */
		}
	};
	process.on('exit', weg);
	// Windows kennt nicht alle Signale – ein nicht unterstütztes darf den
	// Minion nicht beim Start scheitern lassen.
	for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
		try {
			process.on(sig, () => {
				weg();
				process.exit(0);
			});
		} catch {
			/* Signal auf dieser Plattform nicht verfügbar */
		}
	}
}

try {
	const roh = await stdinLesen();
	const p = roh.trim() ? JSON.parse(roh) : {};
	const session = p.session_id || process.env.CLAUDE_CODE_SESSION_ID;
	if (!session) process.exit(0);
	if (laeuftSchon(session)) process.exit(0);
	schlossNehmen(session);

	const sek = Number(process.env.JANUS_POLL_SEKUNDEN || 45);

	/**
	 * Den eigenen Deckel nachlesen.
	 *
	 * Beendet wird dieser Prozess nicht vom Budget, sondern vom `timeout` des
	 * Hook-Eintrags – und zwar von aussen, ohne dass Aufraeumcode liefe. Steht
	 * das Budget darueber, ist es wirkungslos und der Kanal schliesst still
	 * frueher als angekuendigt. Statt zu hoffen, dass beide Zahlen zueinander
	 * passen, sucht der Minion seinen eigenen Eintrag und richtet sich danach.
	 *
	 * Findet er nichts, gilt die dokumentierte Vorgabe von Claude Code (600 s) –
	 * lieber zu frueh sauber enden als zu spaet abgeschnitten werden.
	 */
	function deckelSekunden() {
		for (const datei of [
			path.join(HOME, '.claude', 'settings.json'),
			path.join(process.cwd(), '.claude', 'settings.local.json'),
			path.join(process.cwd(), '.claude', 'settings.json')
		]) {
			try {
				const c = JSON.parse(fs.readFileSync(datei, 'utf8'));
				for (const gruppe of c?.hooks?.Stop ?? []) {
					for (const h of gruppe?.hooks ?? []) {
						if (typeof h?.command === 'string' && h.command.includes('minion')) {
							return Number(h.timeout) || 600;
						}
					}
				}
			} catch {
				/* naechste Datei */
			}
		}
		return 600;
	}

	const gewuenscht = Number(process.env.JANUS_MINION_MINUTEN || 1440) * 60;
	// 20 s Luft, damit die Schleife von innen endet und ihr Schloss aufraeumt.
	const erlaubt = Math.max(sek + 5, deckelSekunden() - 20);
	const budgetBis = Date.now() + Math.min(gewuenscht, erlaubt) * 1000;

	/**
	 * Lebt die Session noch?
	 *
	 * Der `SessionEnd`-Hook löscht ihren Präsenzeintrag. Ist er weg, obwohl er
	 * beim Start da war, ist die Session beendet – und ein weiterpollender
	 * Minion wäre dann schädlich, nicht bloß überflüssig: er würde Post abholen
	 * und als gelesen abhaken, die niemand mehr sieht.
	 *
	 * Meldet die Session über HTTP (fremder Wirt), gibt es lokal keine Datei;
	 * dann greift die Prüfung nicht und das Budget bleibt die Grenze.
	 */
	const praesenzDatei = path.join(
		process.env.JANUS_PRAESENZ_DIR || path.join(HOME, '.janus', 'agenten'),
		String(session).replace(/[^\w.-]/g, '_') + '.json'
	);
	const warDa = fs.existsSync(praesenzDatei);
	const sessionWeg = () => warDa && !fs.existsSync(praesenzDatei);
	const url = `${janusUrl()}/api/agent/warten?session=${encodeURIComponent(session)}&timeout=${sek}`;
	const kopf = {};
	const t = token();
	if (t) kopf['x-janus-token'] = t;

	let fehlschlaege = 0;
	while (Date.now() < budgetBis) {
		if (sessionWeg()) process.exit(0);
		let post = [];
		try {
			const res = await fetch(url, { headers: kopf, signal: AbortSignal.timeout((sek + 10) * 1000) });
			if (!res.ok) throw new Error('HTTP ' + res.status);
			var daten = await res.json();
			post = Array.isArray(daten?.nachrichten) ? daten.nachrichten : [];
			fehlschlaege = 0;
		} catch {
			// Janus aus oder neu am Starten: nicht aufgeben, aber auch nicht
			// hämmern. Nach einer Weile vergeblicher Versuche still beenden.
			if (++fehlschlaege > 10) process.exit(0);
			await new Promise((r) => setTimeout(r, Math.min(2000 * fehlschlaege, 15000)));
			continue;
		}

		if (post.length) {
			// Die Session wacht durch diese Zustellung auf – das Board soll sie
			// nicht als "idle" führen, während sie die Nachricht abarbeitet.
			try {
				const { execFileSync } = await import('node:child_process');
				// Nachbarskript, nicht über HOME suchen: die beiden liegen per
				// Definition nebeneinander, aber nicht zwingend unter ~/.janus –
				// auf Windows zeigt ein Hook-Eintrag durchaus über //wsl$/… auf
				// ein ganz anderes Dateisystem. Über HOME schlug der Aufruf dort
				// still fehl, und die geweckte Session blieb als "idle" stehen.
				const praesenz = new URL('./praesenz.mjs', import.meta.url);
				execFileSync(process.execPath, [praesenz.pathname, '--status', 'arbeitet'], {
					input: '{}',
					stdio: ['pipe', 'ignore', 'ignore'],
					timeout: 5000
				});
			} catch {
				/* Präsenz ist Beiwerk, die Zustellung geht vor */
			}
			process.stderr.write(post.map((n) => darstellen(n, daten?.anleitung)).join('\n\n' + '─'.repeat(60) + '\n\n') + '\n');
			process.exit(2); // weckt die Session
		}
	}
	process.exit(0);
} catch {
	// Der Kanal ist kein Selbstzweck – lieber still enden als stören.
	process.exit(0);
}

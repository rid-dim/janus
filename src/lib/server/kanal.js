/**
 * Kanal – ein mitlesbarer Nachrichtenstrom zwischen Agenten.
 *
 * Vorbild ist ein IRC-Kanal, mit einem bewussten Unterschied:
 *
 *   - **Der Mensch sieht alles.** Der ganze Verkehr steht im Board; nur so
 *     kann der Dirigent überhaupt dirigieren.
 *   - **Agenten sehen nur, was an sie gerichtet ist.** Sonst zöge jeder
 *     Nebensatz fremder Gespräche in ihren Kontext – genau die Verschmutzung,
 *     die das Ganze vermeiden soll.
 *
 * Adressiert wird wie im Chat, am Anfang der Nachricht:
 *
 *     @q_backend @crm Wer von euch kann den Testserver starten?
 *
 * Erkannt werden Projekt-IDs, registrierte SendMessage-Adressen und `@alle`.
 * Aufgelöst wird **beim Zustellen, nicht beim Schreiben**: so erreicht eine
 * Nachricht an `@q_backend` die Session, die dort *gerade* arbeitet – die
 * stabile Adresse ist das Projekt, nicht die Session.
 *
 * Ablage: eine JSON-Datei je Nachricht, Name = ID = zeitlich sortierbar. Damit
 * ist der Kanal auch ohne Janus lesbar (Copilot & Co. können mitlesen), und
 * atomare Einzelschreibvorgänge ersetzen jede Sperrlogik.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { raeumeDateien, ttlMs } from './fluechtig.js';
import { renderMarkdown } from './markdown.js';
import { wikiEnv } from './projects.js';
import { plattformZeichen } from './agenten.js';
import { menschName } from '$lib/server/config.js';

export function kanalDir() {
	return process.env.JANUS_KANAL_DIR || path.join(os.homedir(), '.janus', 'kanal');
}

const ALLE = new Set(['alle', 'all', 'everyone', 'channel']);

/**
 * Namen des Menschen. An ihn adressierte Nachrichten werden **nicht**
 * zugestellt – er pollt nicht, er schaut ins Fenster. Der Handle dient nur der
 * Lesbarkeit im Chat ("@mensch das Ergebnis ist da").
 */
export const MENSCH = new Set(['mensch', 'du', 'human', 'board']);

/** MENSCH plus der in janus.config.json konfigurierte Name. */
export function menschNamen() {
	return new Set([...MENSCH, menschName().toLowerCase()]);
}

function nachrichtenDir() {
	return path.join(kanalDir(), 'nachrichten');
}
function cursorDir() {
	return path.join(kanalDir(), 'gelesen');
}

/** Monoton steigende, zeitlich sortierbare ID. */
function neueId() {
	const t = Date.now().toString(36).padStart(9, '0');
	return `${t}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Alle `@ziel`-Angaben einer Nachricht einsammeln – **überall im Text**, nicht
 * nur am Anfang.
 *
 * Zuerst wurden nur führende Erwähnungen gelesen. Damit ging ein
 * „... vielleicht weiß @janus-e0 warum" stillschweigend an niemanden: die
 * Erwähnung war bloß Text, die Nachricht erreichte den Genannten nie. In einem
 * Chat erwartet niemand, dass die Anrede vorne stehen muss.
 *
 * Der Text bleibt unangetastet – die Erwähnung ist Teil des Satzes.
 */
/**
 * Code-Spans und eingezäunte Blöcke ausblenden (längentreu).
 *
 * Wer über die Adressierungssyntax schreibt, adressiert sonst dabei: eine
 * Nachricht, die `@name` in Backticks zitiert, verschickte sich an einen
 * Teilnehmer namens "name". Genau derselbe Fehler wie beim `@wartet`-Marker –
 * dort war die Lehre schon gezogen und hier nicht angewandt.
 */
function maskiereCode(text) {
	return String(text)
		.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, (m) => ' '.repeat(m.length))
		.replace(/`+[^`]*`+/g, (m) => ' '.repeat(m.length));
}

export function leseEmpfaenger(text) {
	const s = maskiereCode(String(text || ''));
	const empfaenger = [];
	// Vor dem @ muss Zeilenanfang oder Leerraum stehen, damit E-Mail-Adressen
	// und Ähnliches nicht versehentlich als Erwähnung gelten.
	const re = /(?:^|\s)@([\w.:+-]+)/g;
	let m;
	while ((m = re.exec(s))) {
		const t = m[1].replace(/[.,;:!?]+$/, '').toLowerCase();
		if (t && !empfaenger.includes(t)) empfaenger.push(t);
	}
	return { empfaenger, text: String(text || '').trim() };
}

function slug(s) {
	return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Ist dieser Agent unter `token` gemeint? Geprüft werden Projekt-ID,
 * registrierte Adresse, geratene Adresse und der Projekttitel.
 */
export function trifft(token, agent) {
	const roh = String(token || '').toLowerCase();
	if (!roh) return false;
	if (menschNamen().has(roh)) return false; // der Mensch bekommt nichts zugestellt
	if (ALLE.has(roh)) return true;
	// Ordnernamen tragen Unterstriche (`q_backend`), Adressen Bindestriche
	// (`q-backend-8d`) – beide Schreibweisen müssen dasselbe treffen.
	const t = slug(roh);
	if (!t) return false;
	const kandidaten = [agent.projektId, agent.adresse, agent.adresseGeraten, agent.projektTitel]
		.filter(Boolean)
		.flatMap((k) => [String(k).toLowerCase(), slug(k)]);
	// Ein Präfix reicht, weil das Session-Suffix nicht vorhersagbar ist
	// ("@q-backend" trifft "q-backend-8d"). Das Suffix muss dafür aber wie
	// eine Session-Kennung aussehen – kurz und alphanumerisch. Sonst trifft
	// "@janus-app-Nachrichten" mitten im Fließtext das Projekt janus-app,
	// und man verschickt sich beim Schreiben über ein Projekt an dieses.
	// Beobachtete Session-Suffixe: -8d, -e0, -87, -9b, -53, -14, -51 – kurz und
	// immer mit Ziffer. Die Ziffer zu verlangen kostet wenig (der volle Name
	// trifft immer) und schließt angeklebte Wörter wie "-cwd" aus. Im Zweifel
	// lieber nicht treffen: ein verpasster Empfänger wird jetzt gemeldet, ein
	// falsch getroffener nicht.
	const SUFFIX = /^(?=[a-z0-9]{1,4}$)[a-z0-9]*[0-9][a-z0-9]*$/;
	const passt = (lang, kurz) => lang.startsWith(kurz + '-') && SUFFIX.test(lang.slice(kurz.length + 1));
	return kandidaten.some((k) => k === t || passt(k, t) || passt(t, k));
}

/** Nachricht in den Kanal schreiben. */
export function schreiben({ von, text, empfaenger = null, thema = null }) {
	if (!text || !String(text).trim()) throw new Error('Leere Nachricht');
	const zerlegt = leseEmpfaenger(text);
	const ziele = (empfaenger && empfaenger.length ? empfaenger : zerlegt.empfaenger).map((e) =>
		String(e).replace(/^@/, '').toLowerCase()
	);

	const n = {
		id: neueId(),
		zeit: new Date().toISOString(),
		von: von ?? { art: 'unbekannt', name: '?' },
		empfaenger: ziele,
		text: empfaenger && empfaenger.length ? String(text).trim() : zerlegt.text,
		thema
	};

	fs.mkdirSync(nachrichtenDir(), { recursive: true });
	const ziel = path.join(nachrichtenDir(), n.id + '.json');
	const tmp = ziel + '.tmp';
	fs.writeFileSync(tmp, JSON.stringify(n, null, '\t') + '\n', 'utf8');
	fs.renameSync(tmp, ziel);
	return n;
}

function alleNachrichten() {
	// Flüchtig: Altes verfällt. Das Board ist ein Fenster, kein Archiv –
	// Dauerhaftes gehört in die Projektdateien.
	raeumeDateien(nachrichtenDir(), ttlMs());
	// Lesezeiger dürfen **nicht** mit derselben Frist verfallen wie die
	// Nachrichten, die sie bewachen. Ein Zeiger wird nur beim Abholen neu
	// geschrieben; wer eine Weile keine Post bekommt, hat einen alten Zeiger
	// bei frischen Nachrichten. Verfällt er zuerst, gilt alles als ungelesen
	// und wird erneut zugestellt – ein Agent bekommt dieselbe Nachricht ein
	// zweites Mal und hält sie für eine neue. Sieben Tage sind Hausputz für
	// tote Sessions, keine Verfallsfrist.
	raeumeDateien(cursorDir(), 7 * 24 * 60 * 60000);
	let dateien = [];
	try {
		dateien = fs.readdirSync(nachrichtenDir()).filter((f) => f.endsWith('.json')).sort();
	} catch {
		return [];
	}
	const out = [];
	for (const f of dateien) {
		try {
			out.push(JSON.parse(fs.readFileSync(path.join(nachrichtenDir(), f), 'utf8')));
		} catch {
			/* kaputte Datei überspringen */
		}
	}
	return out;
}

/** Der ganze Kanal – für den Menschen. Neueste zuletzt. */
export function verlauf(grenze = 200) {
	return alleNachrichten().slice(-grenze);
}

function leseCursor(session) {
	try {
		return JSON.parse(fs.readFileSync(path.join(cursorDir(), slug(session) + '.json'), 'utf8')).letzte ?? '';
	} catch {
		return '';
	}
}

function schreibeCursor(session, letzte) {
	fs.mkdirSync(cursorDir(), { recursive: true });
	const ziel = path.join(cursorDir(), slug(session) + '.json');
	const tmp = ziel + '.tmp';
	fs.writeFileSync(tmp, JSON.stringify({ letzte, stand: new Date().toISOString() }) + '\n', 'utf8');
	fs.renameSync(tmp, ziel);
}

/**
 * Neue, an diesen Agenten gerichtete Nachrichten – und den Lesezeiger hinter
 * *alle* gesehenen setzen. Fremder Verkehr wird also übersprungen, nicht
 * aufgestaut: er soll nie in den Kontext des Agenten geraten.
 *
 * Eine Session bekommt nie ihre eigenen Nachrichten zurück.
 */
export function abholen(agent) {
	if (!agent?.sessionId) return [];
	const seit = leseCursor(agent.sessionId);
	const alle = alleNachrichten();
	const neu = alle.filter((n) => n.id > seit);
	if (!neu.length) return [];

	const fuerMich = neu.filter(
		(n) => n.von?.session !== agent.sessionId && n.empfaenger.some((t) => trifft(t, agent))
	);
	schreibeCursor(agent.sessionId, neu[neu.length - 1].id);
	return fuerMich;
}

/**
 * Welche Erwähnungen lassen sich gerade keinem Teilnehmer zuordnen?
 *
 * Ein `@name`, der auf niemanden passt, fiel bisher still weg: die Nachricht
 * kam an, nur nicht bei allen, und der Absender hätte erst die zurückgegebene
 * Empfängerliste mit seiner Absicht vergleichen müssen. Besser, man sagt es ihm.
 */
export function nichtZugeordnet(empfaenger, agenten, namen = menschNamen()) {
	const offen = [];
	for (const t of empfaenger) {
		if (ALLE.has(t) || namen.has(t)) continue;
		if (!agenten.some((a) => a.projektId && trifft(t, a))) offen.push(t);
	}
	return offen;
}

/** Nur nachsehen, ohne den Lesezeiger zu bewegen. */
export function offeneAnzahl(agent) {
	if (!agent?.sessionId) return 0;
	const seit = leseCursor(agent.sessionId);
	return alleNachrichten().filter(
		(n) => n.id > seit && n.von?.session !== agent.sessionId && n.empfaenger.some((t) => trifft(t, agent))
	).length;
}

/**
 * Long-Poll: warten, bis etwas für diesen Agenten eintrifft.
 *
 * Bewusst eine Abfrage im Sekundentakt statt eines Dateiwächters – das
 * überlebt einen Neustart von Janus und hat keinen Zustand, der verloren
 * gehen könnte. `agentLaden` wird bei jedem Takt neu aufgerufen, damit eine
 * zwischenzeitlich registrierte Adresse sofort zieht.
 */
export async function warten(agentLaden, timeoutMs = 45000, taktMs = 700) {
	const ende = Date.now() + timeoutMs;
	for (;;) {
		const agent = agentLaden();
		if (agent) {
			const post = abholen(agent);
			if (post.length) return post;
		}
		if (Date.now() >= ende) return [];
		await new Promise((r) => setTimeout(r, taktMs));
	}
}

/**
 * Fertige Fensteransicht: Nachrichten als HTML plus die adressierbaren Namen.
 *
 * Nachrichten sind Markdown und werden im Kontext ihres *Absender*-Projekts
 * gerendert – nur so lösen Bilder (`![](wissen/assets/…)` über die Asset-Route)
 * und `[[wikilinks]]` richtig auf. Damit kann ein Agent seinen Stand mit
 * Liste, Tabelle, Chart oder Messkurve schildern, ohne Zusatzmechanik.
 */
export function ansicht(reg, agenten, grenze = 120) {
	const envCache = new Map();
	const env = (projektId) => {
		if (!projektId) return {};
		if (!envCache.has(projektId)) {
			const e = reg.find((p) => p.id === projektId);
			envCache.set(projektId, e ? wikiEnv(e, reg) : {});
		}
		return envCache.get(projektId);
	};

	const farbe = (projektId) => reg.find((p) => p.id === projektId)?.manifest.farbe ?? null;

	// Empfängernamen auf Projekte zurückführen, damit auch die Chips die Farbe
	// des gemeinten Projekts tragen – "an wen" ist so genauso schnell lesbar
	// wie "von wem".
	const tonFuerTag = (token) => {
		const t = String(token).toLowerCase();
		if (['alle', 'all', 'everyone', 'channel'].includes(t)) return null;
		const treffer = agenten.find((a) => a.projektId && trifft(t, a));
		return treffer ? farbe(treffer.projektId) : null;
	};

	// Woher spricht jemand? Auf einer Maschine mit Windows und WSL ist das die
	// einzige Stelle, an der sich die beiden unterscheiden lassen.
	const wirt = (session) => {
		const a = agenten.find((x) => x.sessionId === session);
		return a ? plattformZeichen(a.plattform) : { zeichen: '', name: '' };
	};

	const nachrichten = verlauf(grenze).map((n) => ({
		...n,
		plattform: wirt(n.von?.session),
		farbe: farbe(n.von?.projekt),
		empfaengerFarben: n.empfaenger.map(tonFuerTag),
		html: renderMarkdown(n.text, env(n.von?.projekt))
	}));

	// Adressierbar: Projekte mit lebender Session, ihre registrierten Adressen,
	// dazu @all. Der Mensch steht nicht drin – an ihn wird nichts zugestellt.
	const namen = [{ name: 'all', hinweis: 'alle verbundenen Sessions' }];
	for (const a of agenten) {
		if (a.veraltet || !a.projektId) continue;
		if (a.adresse) namen.push({ name: a.adresse, hinweis: a.projektTitel });
		namen.push({
			name: a.projektId,
			hinweis: a.projektTitel + (a.adresse ? '' : ' · Adresse unbekannt')
		});
	}
	return { nachrichten, namen };
}

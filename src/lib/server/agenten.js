/**
 * Präsenz der Agenten-Sessions dieser Maschine.
 *
 * Die Zustandsdateien schreibt ein Claude-Code-Hook (`hooks/praesenz.sh`),
 * Janus liest sie nur. Sie sind *Laufzeitzustand*, kein Projektinhalt, und
 * liegen deshalb bewusst außerhalb jedes Repos – unter `~/.janus/agenten/`.
 *
 * Gegenstück ist warten.js: dort das *sachliche* Warten (Tage bis Wochen, muss
 * deklariert werden), hier das *Prozess*-Warten (Minuten bis Stunden, kommt vom
 * Hook). Beides gehört ins Board, darf aber nie vermischt werden.
 *
 * Der eigentliche Nutzen ist nicht die Anzeige, sondern das **Verzeichnis**:
 * `ListAgents` liefert Konversationstitel und sagt nicht, welche Session zu
 * welchem Projekt gehört. Janus weiß das, weil es die Abbildung Projekt ↔
 * Verzeichnis ohnehin führt.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pfadAbbildung } from './config.js';

/** Ab wann ein liegengebliebener Eintrag als veraltet gilt (harter Abbruch). */
const VERALTET_STUNDEN = 24;

/** Zustände, die der Hook schreibt. */
const STATUS = new Set(['arbeitet', 'wartet', 'idle', 'fehler']);

/**
 * Kurzmarke für die Plattform – weil Windows und WSL auf derselben Maschine
 * denselben Hostnamen melden und sonst nichts die beiden Welten trennt.
 *
 * Bewusst **Buchstaben statt Emoji**: auf diesem Wirt ist keine einzige
 * Emoji-Schrift installiert (`fc-list | grep -i emoji` liefert nichts), ein
 * Pinguin wäre dort ein leeres Kästchen. Eine Anzeige, die von einer
 * nachinstallierten Schrift abhängt, ist keine Anzeige. Wer die Symbole will,
 * installiert `fonts-noto-color-emoji` – dann kann man hier tauschen.
 */
export function plattformZeichen(plattform) {
	switch (plattform) {
		case 'win32':
			return { zeichen: 'win', name: 'Windows' };
		case 'darwin':
			return { zeichen: 'mac', name: 'macOS' };
		case 'linux':
			return { zeichen: 'tux', name: 'Linux/WSL' };
		default:
			return { zeichen: '', name: plattform || 'unbekannt' };
	}
}

export function praesenzDir() {
	return process.env.JANUS_PRAESENZ_DIR || path.join(os.homedir(), '.janus', 'agenten');
}

/**
 * Vermutete `SendMessage`-Adresse aus dem Verzeichnisnamen.
 *
 * Über zwei Maschinen hinweg beobachtet: `q_backend` → `q-backend-14`,
 * `crm` → `crm-53`, `janus` → `janus-e0`, `webrtc_autonomi_project` →
 * `webrtc-autonomi-project-51`. Also slugifizierter Ordnername plus kurzes,
 * nicht vorhersagbares Suffix. Taugt als *Vorschlag*, nie als Zusicherung –
 * Remote-Control-Sessions tragen stattdessen Konversationstitel. Die
 * verlässliche Quelle bleibt die Selbstregistrierung (`name` im Eintrag).
 */
export function vermuteteAdresse(cwd) {
	const base = path.basename(cwd || '');
	if (!base) return null;
	const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	return slug || null;
}

/**
 * Pfad in eine vergleichbare Form bringen – plattformübergreifend.
 *
 * Nötig, weil dieselbe Arbeitskopie unter zwei Schreibweisen gemeldet wird:
 * eine WSL-Session sagt `/c/projects/x`, eine native Windows-Session
 * `C:\projects\x`. Ohne Übersetzung ist das nicht bloß „kein Treffer" – es
 * ist ein **falscher** Treffer: `path.resolve` hält `C:\…` unter Linux für
 * relativ und hängt es ans Arbeitsverzeichnis, wodurch die fremde Session
 * plötzlich im Janus-Projekt zu liegen scheint. Eine falsch zugeordnete
 * Session bekommt fremde Nachrichten zugestellt; das ist schlimmer, als gar
 * nicht erkannt zu werden.
 *
 * Rückgabe: normierter Pfad in Kleinschreibung, oder null, wenn die Angabe
 * weder POSIX- noch Windows-absolut ist. Relativ auflösen wäre Raten.
 */
export function normPfad(roh, abbildung = pfadAbbildung()) {
	let p = String(roh ?? '').trim();
	if (!p) return null;

	// Erklärte Abbildungen zuerst – sie schlagen jede eingebaute Regel, weil
	// nur der Wirt weiß, wo er fremde Laufwerke einhängt.
	for (const [von, nach] of Object.entries(abbildung)) {
		const v = String(von).replace(/\\/g, '/').toLowerCase();
		if (p.replace(/\\/g, '/').toLowerCase().startsWith(v)) {
			p = String(nach).replace(/\\/g, '/') + '/' + p.slice(von.length).replace(/\\/g, '/');
			break;
		}
	}
	p = p.replace(/\\/g, '/');
	// Laufwerksbuchstabe -> WSL-Schreibweise: C:/x und /mnt/c/x und /c/x
	// bezeichnen dieselbe Stelle.
	const laufwerk = /^([A-Za-z]):\/(.*)$/.exec(p);
	if (laufwerk) p = '/' + laufwerk[1].toLowerCase() + '/' + laufwerk[2];
	p = p.replace(/^\/mnt\/([a-z])\//i, '/$1/');
	if (!p.startsWith('/')) return null; // weder noch – nicht raten
	p = p.replace(/\/+/g, '/').replace(/\/$/, '');
	// Windows und macOS vergleichen Pfade ohne Rücksicht auf Groß-/Kleinschreibung;
	// die Projektpfade hier stammen aus beiden Welten.
	return p.toLowerCase();
}

/** Längster Präfix-Treffer: in welchem Projekt liegt dieser Arbeitsordner? */
function projektFuerCwd(cwd, reg) {
	const ziel = normPfad(cwd);
	if (!ziel) return null;
	let treffer = null;
	for (const e of reg) {
		// Bei verlinkten Repos arbeitet die Session im Repo, nicht in .janus/.
		const basis = normPfad(e.source === 'linked' && e.repoPath ? e.repoPath : e.dir);
		if (!basis) continue;
		if (ziel !== basis && !ziel.startsWith(basis + '/')) continue;
		if (!treffer || basis.length > treffer.basis.length) treffer = { e, basis };
	}
	return treffer?.e ?? null;
}

function leseEintrag(file) {
	try {
		const d = JSON.parse(fs.readFileSync(file, 'utf8'));
		if (!d || typeof d !== 'object') return null;
		return d;
	} catch {
		return null; // halb geschriebene oder kaputte Datei: einfach ignorieren
	}
}

/**
 * Alle bekannten Sessions, dringlichstes zuerst (Wartende oben, längste
 * Wartezeit zuerst). Fehlt das Verzeichnis, kommt eine leere Liste – ein
 * Rechner ohne eingerichteten Hook ist kein Fehlerfall.
 */
export function ladeAgenten(reg, hidden = new Set(), jetzt = Date.now()) {
	const dir = praesenzDir();
	let dateien = [];
	try {
		dateien = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json'));
	} catch {
		return [];
	}

	const out = [];
	for (const f of dateien) {
		const d = leseEintrag(path.join(dir, f));
		if (!d) continue;

		const seit = Date.parse(d.seit ?? '');
		const alterMin = Number.isNaN(seit) ? null : Math.max(0, Math.round((jetzt - seit) / 60000));
		const veraltet = alterMin !== null && alterMin > VERALTET_STUNDEN * 60;

		const projekt = projektFuerCwd(d.cwd, reg);
		if (projekt && hidden.has(projekt.id)) continue;

		const status = STATUS.has(d.status) ? d.status : 'arbeitet';
		out.push({
			sessionId: String(d.session_id ?? f.replace(/\.json$/i, '')),
			// Board-Schlüssel: stabil, lesbar, nach Maschine sortierbar.
			schluessel: `${d.host ?? '?'}:${projekt?.id ?? path.basename(d.cwd ?? '?')}#${String(d.session_id ?? '').slice(-4)}`,
			// Die **Janus**-Adresse ist die Projekt-ID – die stimmt immer, weil
			// Janus die Abbildung Projekt ↔ Verzeichnis selbst führt.
			// `adresse` ist der ListAgents-Name und gilt nur für SendMessage;
			// er lässt sich von einem Hook nicht ermitteln (er stammt aus einem
			// Werkzeugaufruf des Modells), also ist er oft nicht da. Eine
			// *geratene* SendMessage-Adresse wäre schlimmer als keine: das
			// Suffix ist nicht vorhersagbar, wer sie benutzt, schreibt ins Leere.
			adresse: d.name || null,
			adresseGeraten: d.name ? null : vermuteteAdresse(d.cwd),
			host: d.host ?? null,
			plattform: d.plattform ?? null,
			plattformZeichen: plattformZeichen(d.plattform).zeichen,
			plattformName: plattformZeichen(d.plattform).name,
			meldefehler: d.fehler ?? null,
			ueber: d.ueber ?? 'datei',
			cwd: d.cwd ?? null,
			projektId: projekt?.id ?? null,
			projektTitel: projekt?.manifest.titel ?? null,
			// Veraltetes zählt nie als "wartet" – sonst blinkt eine tote Session ewig.
			status: veraltet ? 'veraltet' : status,
			wartet: !veraltet && status === 'wartet',
			frage: d.frage || null,
			alterMin,
			veraltet
		});
	}

	out.sort(
		(a, b) =>
			Number(b.wartet) - Number(a.wartet) ||
			Number(a.veraltet) - Number(b.veraltet) ||
			(b.alterMin ?? 0) - (a.alterMin ?? 0)
	);
	return out;
}

/**
 * Eine Session anhand dessen finden, womit sie sich ausweist.
 *
 * Ein Agent kennt sich eher unter seinem Namen (`b-particle-size-9b`) als
 * unter seiner rohen Session-ID – und schickt dann eben den. Ihn deshalb als
 * „unbekannte Session" zu führen, wäre Pedanterie: die Kennung ist eindeutig,
 * nur nicht die erwartete. Also akzeptiert werden Session-ID, registrierter
 * Name und jede Schreibweise, die `trifft()` erkennt – solange sie **genau
 * eine** lebende Session meint. Mehrdeutiges wird abgelehnt, denn im Zweifel
 * die falsche Quelle anzuschreiben wäre schlimmer als nachzufragen.
 *
 * Rückgabe: { agent } · { mehrdeutig: [...] } · {} wenn nichts passt.
 */
export function findeAgent(kennung, agenten, trifftFn) {
	const k = String(kennung ?? '').trim();
	if (!k) return {};

	const genau = agenten.find((a) => a.sessionId === k);
	if (genau) return { agent: genau };

	const nameGleich = agenten.filter((a) => a.adresse && a.adresse.toLowerCase() === k.toLowerCase());
	if (nameGleich.length === 1) return { agent: nameGleich[0] };

	if (typeof trifftFn === 'function') {
		const passend = agenten.filter((a) => a.projektId && trifftFn(k, a));
		if (passend.length === 1) return { agent: passend[0] };
		if (passend.length > 1) return { mehrdeutig: passend.map((a) => a.projektId) };
	}
	return {};
}

/**
 * Verzeichnis-Auskunft: wer ist gerade für dieses Projekt zuständig?
 * Die stabile Adresse ist das Projekt, nicht die Session – Sessions kommen und
 * gehen, `q_backend` bleibt.
 */
export function zustaendigFuer(projektId, agenten) {
	return agenten.filter((a) => a.projektId === projektId && !a.veraltet);
}

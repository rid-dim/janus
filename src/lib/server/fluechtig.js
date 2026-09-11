/**
 * Flüchtigkeit – das Agenten-Board ist ein Fenster, kein Archiv.
 *
 * Es soll zeigen, was *gerade* läuft: wer arbeitet, wer wartet, was
 * besprochen wird. Es ist ausdrücklich **kein** Werkzeug, um den Menschen zu
 * erreichen, und **kein** Protokoll über die Arbeit der Agenten. Wer es
 * öffnet, sieht den Moment; was älter ist, ist weg.
 *
 * Deshalb verfällt hier alles nach kurzer Zeit. Was dauerhaft gelten soll,
 * gehört in die Projektdateien – `stand/`, `geplant/`, die Chronik. Dort ist
 * es bewusst geschrieben, versioniert und nachlesbar; hier wäre es nur
 * angefallen.
 *
 * Aufgeräumt wird bei jedem Zugriff statt per Zeitgeber: kein Hintergrunddienst,
 * kein Zustand, und ein Janus, das tagelang aus war, räumt beim nächsten Start
 * von selbst auf.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Vorgabe: zwei Stunden. Über `JANUS_TTL_MINUTEN` anpassbar. */
export function ttlMs() {
	const m = Number(process.env.JANUS_TTL_MINUTEN);
	return (Number.isFinite(m) && m > 0 ? m : 120) * 60000;
}

function alter(p) {
	try {
		return Date.now() - fs.statSync(p).mtimeMs;
	} catch {
		return 0;
	}
}

/** Zu alte Dateien in einem Ordner löschen. Fehlt der Ordner: nichts zu tun. */
export function raeumeDateien(dir, grenzeMs = ttlMs(), endung = '.json') {
	let weg = 0;
	let eintraege = [];
	try {
		eintraege = fs.readdirSync(dir);
	} catch {
		return 0;
	}
	for (const name of eintraege) {
		if (endung && !name.endsWith(endung)) continue;
		const p = path.join(dir, name);
		if (alter(p) > grenzeMs) {
			try {
				fs.rmSync(p, { force: true });
				weg++;
			} catch {
				/* egal */
			}
		}
	}
	return weg;
}

/** Zu alte Unterordner samt Inhalt löschen (z. B. eine ganze Rundfrage). */
export function raeumeOrdner(dir, grenzeMs = ttlMs()) {
	let weg = 0;
	let eintraege = [];
	try {
		eintraege = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return 0;
	}
	for (const e of eintraege) {
		if (!e.isDirectory()) continue;
		const p = path.join(dir, e.name);
		// Ein Ordner ist so jung wie seine jüngste Datei – eine Rundfrage, die
		// gerade noch beantwortet wird, darf nicht unter der Hand verschwinden.
		let juengste = alter(p);
		try {
			for (const f of fs.readdirSync(p, { recursive: true })) {
				const a = alter(path.join(p, String(f)));
				if (a < juengste) juengste = a;
			}
		} catch {
			/* egal */
		}
		if (juengste > grenzeMs) {
			try {
				fs.rmSync(p, { recursive: true, force: true });
				weg++;
			} catch {
				/* egal */
			}
		}
	}
	return weg;
}

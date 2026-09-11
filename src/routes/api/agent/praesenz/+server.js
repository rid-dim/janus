import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { praesenzDir } from '$lib/server/agenten.js';
import { pruefeZugang } from '$lib/server/zugang.js';

/**
 * Präsenz über HTTP melden – für Sessions auf einem *anderen* Wirt als Janus.
 *
 * Die Datei-Variante setzt voraus, dass beide Seiten dasselbe Dateisystem
 * sehen. Auf einer Windows-Maschine neben WSL hieße das, über `\\wsl$\…` zu
 * schreiben: die Sichtbarkeit hinge dann daran, dass die andere Welt läuft,
 * ein Fehlschlag wäre stumm, und ein Verzeichnislisting über 9P kann in ein
 * Zeitlimit laufen (gemessen: 120 s). Der HTTP-Weg hat davon nichts – und die
 * Zugangsgrenze steht ohnehin schon.
 *
 * Derselbe Rumpf, den der Hook sonst in die Datei schreibt.
 */
export async function POST(event) {
	const zugang = pruefeZugang(event);
	if (!zugang.ok) return json({ ok: false, error: zugang.error }, { status: zugang.status });

	let b;
	try {
		b = await event.request.json();
	} catch (e) {
		return json({ ok: false, error: 'Ungültiges JSON: ' + String(e?.message || e) }, { status: 400 });
	}

	const sid = String(b?.session_id ?? '').replace(/[^\w.-]/g, '_');
	if (!sid) return json({ ok: false, error: 'session_id fehlt' }, { status: 400 });

	const dir = praesenzDir();
	const ziel = path.join(dir, sid + '.json');

	if (b.status === 'beendet') {
		fs.rmSync(ziel, { force: true });
		return json({ ok: true, entfernt: true });
	}

	let bisher = {};
	try {
		bisher = JSON.parse(fs.readFileSync(ziel, 'utf8'));
	} catch {
		bisher = {};
	}

	const eintrag = {
		session_id: sid,
		status: b.status || bisher.status || 'arbeitet',
		cwd: b.cwd || bisher.cwd || null,
		host: b.host || bisher.host || null,
		plattform: b.plattform || bisher.plattform || null,
		name: b.name || bisher.name || null,
		transcript: b.transcript || bisher.transcript || null,
		frage: b.frage ?? null,
		fehler: b.fehler ?? null,
		// Über HTTP gemeldet: hier steht Janus' Uhr, nicht die des fremden Wirts.
		seit: new Date().toISOString(),
		ueber: 'http'
	};

	try {
		fs.mkdirSync(dir, { recursive: true });
		const tmp = ziel + '.tmp';
		fs.writeFileSync(tmp, JSON.stringify(eintrag, null, '\t') + '\n', 'utf8');
		fs.renameSync(tmp, ziel);
	} catch (e) {
		return json({ ok: false, error: String(e?.message || e) }, { status: 500 });
	}
	return json({ ok: true, session_id: sid, status: eintrag.status });
}

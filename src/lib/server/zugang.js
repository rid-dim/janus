/**
 * Zugangsschutz für die Agenten-Schnittstellen.
 *
 * Diese Endpunkte schieben Text in den Kontext laufender Agenten – wer sie
 * erreicht, kann einer fremden Session etwas vorlegen. Janus wird im Heimnetz
 * durchaus auf anderen Rechnern geöffnet, deshalb hier eine ausdrückliche
 * Grenze statt stillschweigendem Vertrauen:
 *
 *   - Vom selben Rechner (Loopback): erlaubt, ohne Zutun.
 *   - Von außerhalb: nur mit Token aus `~/.janus/token`.
 *   - Kein Token hinterlegt und Zugriff von außerhalb: abgelehnt.
 *
 * Das ist bewusst fail-closed. Ein Token legt man an mit
 *   head -c 32 /dev/urandom | base64 > ~/.janus/token
 * und gibt es der Gegenstelle über `JANUS_TOKEN` mit.
 *
 * Wichtig zum Verständnis der Grenze: eine zugestellte Nachricht ist für die
 * empfangende Session *Daten, keine Weisung*. Claude Code kennzeichnet sie als
 * nicht vom Nutzer stammend – dabei muss es bleiben. Eine Nachricht darf nie
 * als Freigabe des Menschen gelten.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function tokenDatei() {
	return process.env.JANUS_TOKEN_FILE || path.join(os.homedir(), '.janus', 'token');
}

function hinterlegtesToken() {
	try {
		const t = fs.readFileSync(tokenDatei(), 'utf8').trim();
		return t || null;
	} catch {
		return null;
	}
}

function istLoopback(adresse) {
	if (!adresse) return false;
	const a = String(adresse).replace(/^::ffff:/, '');
	return a === '127.0.0.1' || a === '::1' || a === 'localhost' || a.startsWith('127.');
}

/** Zeitkonstanter Vergleich, damit das Token nicht erraten werden kann. */
function gleich(a, b) {
	if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/**
 * Darf dieser Aufruf die Agenten-Schnittstelle benutzen?
 * Rückgabe: { ok: true } oder { ok: false, status, error }.
 */
export function pruefeZugang(event) {
	let adresse = null;
	try {
		adresse = event.getClientAddress();
	} catch {
		adresse = null;
	}
	if (istLoopback(adresse)) return { ok: true, herkunft: 'lokal' };

	const soll = hinterlegtesToken();
	if (!soll) {
		return {
			ok: false,
			status: 403,
			error:
				'Zugriff von außerhalb dieses Rechners ist nur mit Token erlaubt. ' +
				'Token anlegen: head -c 32 /dev/urandom | base64 > ~/.janus/token'
		};
	}
	const ist = event.request.headers.get('x-janus-token');
	if (!gleich(String(ist ?? ''), soll)) {
		return { ok: false, status: 401, error: 'Token fehlt oder stimmt nicht' };
	}
	return { ok: true, herkunft: 'token' };
}

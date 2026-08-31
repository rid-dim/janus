/**
 * Kleine Datums-Helfer für die Zeitleisten-Ansicht.
 *
 * Alle Daten sind ISO-Strings "YYYY-MM-DD" und werden intern als UTC-Mitternacht
 * gerechnet – so gibt es keine Sommerzeit-Ausrutscher beim Tage-Zählen.
 */

const DAY = 86400000;

export const MONAT_LANG = [
	'Januar',
	'Februar',
	'März',
	'April',
	'Mai',
	'Juni',
	'Juli',
	'August',
	'September',
	'Oktober',
	'November',
	'Dezember'
];
export const MONAT_KURZ = [
	'Jan',
	'Feb',
	'Mär',
	'Apr',
	'Mai',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Okt',
	'Nov',
	'Dez'
];

const pad = (n) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" -> [jahr, monat, tag] (Monat 1-basiert). */
export function ymd(iso) {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
	return m ? [+m[1], +m[2], +m[3]] : [1970, 1, 1];
}

export function isoOf(y, m, d) {
	return `${y}-${pad(m)}-${pad(d)}`;
}

/** ISO-String -> Zeitstempel (UTC-Mitternacht). */
export function ts(iso) {
	const [y, m, d] = ymd(iso);
	return Date.UTC(y, m - 1, d);
}

/** Ganze Tage von a nach b (b - a); negativ, wenn b vor a liegt. */
export function tageZwischen(a, b) {
	return Math.round((ts(b) - ts(a)) / DAY);
}

export function plusTage(iso, n) {
	const d = new Date(ts(iso) + n * DAY);
	return isoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** "2026-08-25" -> "25.08.2026" */
export function deDatum(iso) {
	const [y, m, d] = ymd(iso);
	return `${pad(d)}.${pad(m)}.${y}`;
}

export function minIso(...list) {
	return list.filter(Boolean).sort()[0] ?? null;
}
export function maxIso(...list) {
	const s = list.filter(Boolean).sort();
	return s[s.length - 1] ?? null;
}

/**
 * Monatsbänder zwischen zwei Daten (inklusive Randmonate).
 * Liefert je Monat { i, breite, label, lang } – i = Tagesindex ab `von`.
 */
export function monatsBaender(von, bis) {
	const out = [];
	const gesamt = tageZwischen(von, bis) + 1;
	if (gesamt <= 0) return out;
	let [y, m] = ymd(von);
	// Sicherheitsnetz gegen kaputte Eingaben: max. 100 Jahre
	for (let guard = 0; guard < 1200; guard++) {
		const start = isoOf(y, m, 1);
		const i = tageZwischen(von, start);
		if (i >= gesamt) break;
		const ny = m === 12 ? y + 1 : y;
		const nm = m === 12 ? 1 : m + 1;
		const ende = tageZwischen(von, isoOf(ny, nm, 1));
		const links = Math.max(i, 0);
		const rechts = Math.min(ende, gesamt);
		if (rechts > links) {
			out.push({
				i: links,
				breite: rechts - links,
				jahr: y,
				monat: m,
				label: `${MONAT_KURZ[m - 1]} ${String(y).slice(2)}`,
				lang: `${MONAT_LANG[m - 1]} ${y}`
			});
		}
		y = ny;
		m = nm;
	}
	return out;
}

/** Kategorie-Metadaten der Chronik-Einträge (Legende + Farben). */
export const KATEGORIEN = [
	{ key: 'entscheidung', emoji: '⚖️', label: 'Entscheidung' },
	{ key: 'vorfall', emoji: '⚡', label: 'Vorfall' },
	{ key: 'korrespondenz', emoji: '✉️', label: 'Korrespondenz' },
	{ key: 'sonstig', emoji: '•', label: 'sonstiges' }
];

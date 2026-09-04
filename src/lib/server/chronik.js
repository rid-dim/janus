/**
 * Parser für `stand/chronik.md` – das Entscheidungs-/Ereignislog eines Projekts.
 *
 * Erwartetes Format (neueste zuerst):
 *
 *   ## August 2026
 *   - **25.08.** ✉️ Text …
 *   - **20./21.08.** ⚡ Text …
 *   - **~17.08.** ⚖️ Text …
 *
 *   ## Übergang & Onboarding (Dez 2025 – Apr 2026)
 *   - **01.04.** ⚡ …
 *
 * Das Jahr steht nur in der Abschnittsüberschrift. Nennt die Überschrift zwei
 * Jahre (Bereich), wird der Eintrag dem Jahr zugeordnet, in dem sein Monat in
 * den Bereich fällt. Ein Jahr direkt am Eintrag (`23.12.25`) gewinnt immer.
 */

const MONATS_RE =
	/\b(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember|jan|feb|mär|maer|mrz|apr|jun|jul|aug|sept|sep|okt|nov|dez)\b/g;

export const MONAT_NR = {
	januar: 1,
	jan: 1,
	februar: 2,
	feb: 2,
	'märz': 3,
	'mär': 3,
	maerz: 3,
	maer: 3,
	mrz: 3,
	april: 4,
	apr: 4,
	mai: 5,
	juni: 6,
	jun: 6,
	juli: 7,
	jul: 7,
	august: 8,
	aug: 8,
	september: 9,
	sept: 9,
	sep: 9,
	oktober: 10,
	okt: 10,
	november: 11,
	nov: 11,
	dezember: 12,
	dez: 12
};

// ⚖️ U+2696, ⚡ U+26A1, ✉️ U+2709 – Variantenselektor (FE0F) ist optional.
const KATEGORIE_ZEICHEN = [
	{ key: 'entscheidung', zeichen: '⚖', emoji: '⚖️' },
	{ key: 'vorfall', zeichen: '⚡', emoji: '⚡' },
	{ key: 'korrespondenz', zeichen: '✉', emoji: '✉️' }
];

const pad = (n) => String(n).padStart(2, '0');

/** Jahres-/Monatskontext aus einer `##`-Überschrift ableiten. */
export function analysiereUeberschrift(text) {
	const s = String(text || '').toLowerCase();

	const jahre = [...s.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => ({
		jahr: +m[0],
		at: m.index ?? 0
	}));
	if (jahre.length === 0) return null;

	MONATS_RE.lastIndex = 0;
	const monate = [...s.matchAll(MONATS_RE)].map((m) => ({
		monat: MONAT_NR[m[1]] ?? null,
		at: m.index ?? 0
	}));

	// Monat, der am nächsten VOR einer Jahreszahl steht ("Dez 2025").
	const monatVor = (at) => {
		let best = null;
		for (const m of monate) {
			if (m.at < at && (!best || m.at > best.at)) best = m;
		}
		return best?.monat ?? null;
	};

	if (jahre.length === 1) {
		return { typ: 'jahr', jahr: jahre[0].jahr };
	}

	const a = jahre[0];
	const b = jahre[jahre.length - 1];
	return {
		typ: 'bereich',
		vonJahr: a.jahr,
		vonMonat: monatVor(a.at) ?? 1,
		bisJahr: b.jahr,
		bisMonat: monatVor(b.at) ?? 12
	};
}

/** Jahr eines Eintrags anhand seines Monats + des Abschnittskontexts. */
function jahrFuer(kontext, monat, fallback) {
	if (!kontext) return fallback;
	if (kontext.typ === 'jahr') return kontext.jahr;
	const von = kontext.vonJahr * 12 + kontext.vonMonat;
	const bis = kontext.bisJahr * 12 + kontext.bisMonat;
	for (let y = kontext.vonJahr; y <= kontext.bisJahr; y++) {
		const p = y * 12 + monat;
		if (p >= von && p <= bis) return y;
	}
	return kontext.bisJahr;
}

/**
 * Datumsangabe am Zeilenanfang tolerant lesen.
 * Erkennt `21.08.`, `20./21.08.` (→ erster Tag), `~17.08.` (circa),
 * `22./23.06.`, `23.12.25`, `1.4.2026`.
 */
export function leseDatum(roh) {
	const m =
		/^\s*(~|ca\.?\s*)?\s*(?:(\d{1,2})\.\s*\/\s*)?(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})?/.exec(
			String(roh || '')
		);
	if (!m) return null;
	const tag = +(m[2] ?? m[3]);
	const monat = +m[4];
	if (!(tag >= 1 && tag <= 31) || !(monat >= 1 && monat <= 12)) return null;
	let jahr = null;
	if (m[5]) {
		const j = +m[5];
		jahr = m[5].length === 2 ? (j <= 69 ? 2000 + j : 1900 + j) : j;
	}
	return { tag, monat, jahr, circa: Boolean(m[1]) };
}

function kategorieVon(text) {
	let treffer = null;
	for (const k of KATEGORIE_ZEICHEN) {
		const i = text.indexOf(k.zeichen);
		if (i >= 0 && (!treffer || i < treffer.at)) treffer = { ...k, at: i };
	}
	return treffer ?? { key: 'sonstig', emoji: '•', at: -1 };
}

function klartext(s) {
	return String(s)
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Links -> Linktext
		.replace(/[*_`]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Chronik-Markdown -> { eintraege, von, bis, zaehler }.
 * `heute` (ISO) bestimmt das rechte Ende des Zeitraums.
 */
export function parseChronik(markdown, heute) {
	const zeilen = String(markdown || '').split('\n');
	const eintraege = [];
	let kontext = null;
	const fallbackJahr = +String(heute || '').slice(0, 4) || new Date().getFullYear();

	for (const zeile of zeilen) {
		const h = /^\s{0,3}#{2,3}\s+(.*)$/.exec(zeile);
		if (h) {
			const k = analysiereUeberschrift(h[1]);
			if (k) kontext = k;
			continue;
		}

		// Listeneintrag mit fett gesetztem Datum am Anfang: "- **25.08.** …"
		const li = /^\s*[-*+]\s+\*\*([^*]+)\*\*\s*(.*)$/.exec(zeile);
		if (!li) continue;
		const d = leseDatum(li[1]);
		if (!d) continue;

		const rest = li[2] ?? '';
		const jahr = d.jahr ?? jahrFuer(kontext, d.monat, fallbackJahr);
		const kat = kategorieVon(rest);
		const text = klartext(rest.slice(kat.at >= 0 ? kat.at : 0).replace(/^[⚖⚡✉]️?\s*/, ''));

		eintraege.push({
			datum: `${jahr}-${pad(d.monat)}-${pad(d.tag)}`,
			label: klartext(li[1]),
			circa: d.circa,
			kategorie: kat.key,
			emoji: kat.emoji,
			text
		});
	}

	eintraege.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));

	const zaehler = {};
	for (const e of eintraege) zaehler[e.kategorie] = (zaehler[e.kategorie] ?? 0) + 1;

	return {
		eintraege,
		von: eintraege[0]?.datum ?? null,
		bis: eintraege[eintraege.length - 1]?.datum ?? null,
		zaehler
	};
}

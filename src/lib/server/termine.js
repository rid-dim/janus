/**
 * Parser für `stand/termine.md` (Frontmatter `typ: termine`) – die
 * Wiedervorlage-Liste eines Projekts, das Spiegelbild der Chronik nach vorn.
 *
 * Die Datei bleibt die Quelle der Wahrheit und darf beliebig unsortiert sein;
 * die App liest jeden Listeneintrag, erkennt seine Datumsangabe (exakt oder
 * unscharf) und sortiert nach Aktualität. Überschriften dienen nur als
 * Jahres-Kontext (`## September 2026`) bzw. als Dringlichkeits-Signal
 * (`## Überfällig / sofort`) – für die Sortierung sind sie egal.
 *
 * Erkannte Datumsformen (am Anfang eines Eintrags, meist fett gesetzt):
 *   04.09.2026 · 06.09.2026 (So) · 21.08. · ~08.09.2026 · ca. 1.4.2026
 *   ~Mitte September · Ende Oktober 2026 · Anfang 2027 · Oktober 2026
 *   Oktober/November 2026 · Oktober–Dezember 2026 · Q1 2027 · KW 37
 *   Frühjahr 2027 · Sommer · Herbst · Winter 2026/27 · 2027
 *   ab 01.01.2027 · bis ~Ende Oktober 2026 · spätestens 30.09.2026
 * Durchgestrichene Einträge (`~~…~~`) oder solche, die mit ✓/erledigt
 * beginnen, gelten als erledigt. Einträge ohne Datum bleiben unter ihrer
 * Überschrift stehen (Reihenfolge wie in der Datei).
 */

import { analysiereUeberschrift, leseDatum, MONAT_NR } from './chronik.js';

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const tageImMonat = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Differenz zweier YYYY-MM-DD-Strings in ganzen Tagen (b - a). */
export function tageZwischen(a, b) {
	const [ay, am, ad] = a.split('-').map(Number);
	const [by, bm, bd] = b.split('-').map(Number);
	return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** Lokales Heute als YYYY-MM-DD. */
export function heuteStr() {
	const d = new Date();
	return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

const MONAT_ALT = Object.keys(MONAT_NR)
	.sort((a, b) => b.length - a.length)
	.join('|');
// "Okt." / "Sept." → Punkt ist optional
const MONAT_RE = `(${MONAT_ALT})\\.?`;
const JAHR_RE = '((?:19|20)\\d{2})';

const SAISON = {
	'frühjahr': [3, 5],
	'fruehjahr': [3, 5],
	'frühling': [3, 5],
	'fruehling': [3, 5],
	sommer: [6, 8],
	herbst: [9, 11],
	winter: [12, 2]
};

/**
 * Jahr für eine Angabe ohne Jahreszahl: Abschnittskontext (`## September
 * 2026`, `## Okt–Dez 2026`) gewinnt; sonst das laufende Jahr – liegt der Monat
 * damit deutlich in der Vergangenheit (> 2 Monate), ist das nächste gemeint.
 */
function jahrFuer(kontext, monat, heute) {
	if (kontext?.typ === 'jahr') return kontext.jahr;
	if (kontext?.typ === 'bereich') {
		const von = kontext.vonJahr * 12 + kontext.vonMonat;
		const bis = kontext.bisJahr * 12 + kontext.bisMonat;
		for (let y = kontext.vonJahr; y <= kontext.bisJahr; y++) {
			const p = y * 12 + monat;
			if (p >= von && p <= bis) return y;
		}
		return kontext.bisJahr;
	}
	const [hy, hm] = heute.split('-').map(Number);
	return monat < hm - 2 ? hy + 1 : hy;
}

/**
 * Datumsangabe eines Eintrags lesen → { datum, bis, genauigkeit, circa, praefix }
 * oder null. `datum` ist der Sortierschlüssel (bei Zeiträumen der Anfang, bei
 * "Mitte/Ende X" ein Stellvertretertag), `bis` das Ende eines Zeitraums.
 * genauigkeit: tag | woche | monat | quartal | saison | jahr
 */
export function leseTermin(roh, kontext = null, heute = heuteStr()) {
	let s = String(roh || '')
		.trim()
		.replace(/\s*\((mo|di|mi|do|fr|sa|so)\.?\)\s*/gi, ' ') // Wochentag "(So)"
		.replace(/[:–—-]+\s*$/, '')
		.trim();
	if (!s) return null;

	let praefix = null;
	let m = /^(ab|seit)\b\s*/i.exec(s);
	if (m) {
		praefix = 'ab';
		s = s.slice(m[0].length);
	} else if ((m = /^(bis\s+spätestens|bis\s+spaetestens|spätestens|spaetestens|bis)\b\s*/i.exec(s))) {
		praefix = 'bis';
		s = s.slice(m[0].length);
	}

	let circa = false;
	m = /^(~|≈|ca\.?|etwa|ungefähr|ungefaehr|voraussichtlich|vsl\.?)\s*/i.exec(s);
	if (m) {
		circa = true;
		s = s.slice(m[0].length);
	}
	// "Mitte ~September" → Tilde auch mitten drin akzeptieren
	if (/~/.test(s)) {
		circa = true;
		s = s.replace(/~/g, '');
	}
	s = s.trim();
	const low = s.toLowerCase();

	// --- Tagesdatum: 04.09.2026 · 21.08. · 23.12.25 · 20./21.08. ---
	const d = leseDatum(s);
	if (d) {
		const jahr = d.jahr ?? jahrFuer(kontext, d.monat, heute);
		if (d.tag > tageImMonat(jahr, d.monat)) return null;
		return { datum: iso(jahr, d.monat, d.tag), bis: null, genauigkeit: 'tag', circa: circa || d.circa, praefix };
	}

	// --- Quartal: Q1 2027 · Q3/2026 ---
	m = new RegExp(`^q([1-4])\\s*[/ ]?\\s*${JAHR_RE}?`, 'i').exec(low);
	if (m) {
		const q = +m[1];
		const jahr = m[2] ? +m[2] : jahrFuer(kontext, (q - 1) * 3 + 1, heute);
		const von = (q - 1) * 3 + 1;
		return { datum: iso(jahr, von, 1), bis: iso(jahr, von + 2, tageImMonat(jahr, von + 2)), genauigkeit: 'quartal', circa, praefix };
	}

	// --- Kalenderwoche: KW 37 · KW 37/2026 ---
	m = new RegExp(`^kw\\s*(\\d{1,2})(?:\\s*[/ ]\\s*${JAHR_RE})?`, 'i').exec(low);
	if (m) {
		const kw = +m[1];
		const jahr = m[2] ? +m[2] : +heute.slice(0, 4);
		// ISO-Woche 1 enthält den 4. Januar; Montag dieser Woche + (kw-1) Wochen
		const jan4 = new Date(Date.UTC(jahr, 0, 4));
		const montag = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000 + (kw - 1) * 7 * 86400000);
		const sonntag = new Date(montag.getTime() + 6 * 86400000);
		const f = (x) => iso(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
		return { datum: f(montag), bis: f(sonntag), genauigkeit: 'woche', circa, praefix };
	}

	// --- Jahreszeit: Frühjahr 2027 · Winter 2026/27 ---
	m = new RegExp(`^(${Object.keys(SAISON).join('|')})\\s*${JAHR_RE}?`, 'i').exec(low);
	if (m) {
		const [von, bis] = SAISON[m[1]];
		const jahr = m[2] ? +m[2] : jahrFuer(kontext, von, heute);
		const bisJahr = bis < von ? jahr + 1 : jahr;
		return { datum: iso(jahr, von, 1), bis: iso(bisJahr, bis, tageImMonat(bisJahr, bis)), genauigkeit: 'saison', circa, praefix };
	}

	// --- Monat(e): [Anfang|Mitte|Ende] Oktober[/November|–Dezember] [2026] ---
	m = new RegExp(`^(anfang|mitte|ende)?\\s*${MONAT_RE}(?:\\s*[/–—-]\\s*${MONAT_RE})?\\s*${JAHR_RE}?`, 'i').exec(low);
	if (m) {
		const lage = m[1] || null;
		const monat = MONAT_NR[m[2]];
		const monat2 = m[3] ? MONAT_NR[m[3]] : null;
		const jahr = m[4] ? +m[4] : jahrFuer(kontext, monat, heute);
		if (lage) {
			const tag = lage === 'anfang' ? 5 : lage === 'mitte' ? 15 : 25;
			return { datum: iso(jahr, monat, tag), bis: null, genauigkeit: 'tag', circa: true, praefix };
		}
		const endMonat = monat2 ?? monat;
		const endJahr = monat2 && monat2 < monat ? jahr + 1 : jahr;
		return { datum: iso(jahr, monat, 1), bis: iso(endJahr, endMonat, tageImMonat(endJahr, endMonat)), genauigkeit: 'monat', circa, praefix };
	}

	// --- Anfang/Mitte/Ende 2027 · nur Jahr ---
	m = new RegExp(`^(anfang|mitte|ende)?\\s*${JAHR_RE}$`, 'i').exec(low);
	if (m) {
		const jahr = +m[2];
		if (m[1]) {
			const monat = m[1] === 'anfang' ? 1 : m[1] === 'mitte' ? 6 : 11;
			return { datum: iso(jahr, monat, 15), bis: null, genauigkeit: 'monat', circa: true, praefix };
		}
		return { datum: iso(jahr, 1, 1), bis: iso(jahr, 12, 31), genauigkeit: 'jahr', circa, praefix };
	}

	return null;
}

/**
 * Sieht der Anfang eines Eintrags nach einem Datumsversuch aus, den der Parser
 * nicht versteht ("nächste Woche", "nach der ETV", "in 3 Wochen", "12.9")?
 * Heuristik für den Warnhinweis „Datum nicht erkannt" in der Ansicht.
 */
const VERDAECHTIG_RE = new RegExp(
	`^\\**\\s*(~|≈|\\d|ab\\b|bis\\b|seit\\b|spätestens|kw\\b|q[1-4]\\b|anfang|mitte|ende|nächste|naechste|kommende|übernächste|demnächst|demnaechst|bald|in\\s+\\d|nach\\s+de[rm]\\b|${MONAT_ALT})`,
	'i'
);
function siehtNachDatumAus(text) {
	return VERDAECHTIG_RE.test(String(text || '').trim());
}

/** Datumsangabe vom Anfang eines Eintrags abtrennen: fett gesetzt oder bis zum Gedankenstrich/Doppelpunkt. */
function datumsKandidat(text) {
	const fett = /^\*\*([^*]+)\*\*/.exec(text);
	if (fett) return fett[1];
	const bis = /^([^—–:]{1,40})(?:\s[—–]|:)/.exec(text);
	return bis ? bis[1] : text.slice(0, 40);
}

function klartext(s) {
	return String(s)
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
		.replace(/\[\[([^\]]+)\]\]/g, '$1')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[*_`~]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * termine.md → { intro, eintraege, ohneDatum, zaehler }.
 *   eintraege: datierte Einträge, sortiert nach Datum (dann Dateireihenfolge);
 *              je { datum, bis, genauigkeit, circa, praefix, label, text,
 *                   klartext, erledigt, sofort, laufend, inTagen, bucket }
 *   ohneDatum: [{ titel, eintraege: [{ text, klartext, erledigt, verdaechtig }] }] –
 *              gruppiert nach Überschrift, Dateireihenfolge; `verdaechtig` = sieht
 *              nach einer Datumsangabe aus, die der Parser nicht versteht.
 *   bucket: ueberfaellig | woche | monat | spaeter | erledigt
 */
export function parseTermine(markdown, heute = heuteStr()) {
	const zeilen = String(markdown || '').split('\n');
	const introZeilen = [];
	const datiert = [];
	const ohneDatum = [];
	let kontext = null;
	let sofort = false;
	let sektion = null; // aktueller Überschriften-Text
	let sektionOhne = null; // Gruppe undatierter Einträge der aktuellen Sektion
	let aktuell = null; // zuletzt begonnener Eintrag (für Fortsetzungszeilen)
	let vorErsterListe = true;
	let lauf = 0;

	const abschliessen = () => {
		aktuell = null;
	};

	for (const zeile of zeilen) {
		const h = /^\s{0,3}#{1,6}\s+(.*)$/.exec(zeile);
		if (h) {
			abschliessen();
			vorErsterListe = false;
			sektion = h[1].trim();
			sektionOhne = null;
			const k = analysiereUeberschrift(sektion);
			if (k) kontext = k;
			sofort = /überfällig|ueberfaellig|sofort|dringend|jetzt/i.test(sektion);
			continue;
		}
		const li = /^\s{0,3}[-*+]\s+(.*)$/.exec(zeile);
		if (li) {
			vorErsterListe = false;
			const text = li[1].trim();
			const erledigt = /^~~/.test(text) || /^(✓|✔|☑|erledigt\b)/i.test(text);
			// Für die Datumssuche Durchstreichung und Häkchen vorn abräumen
			const kern = text.replace(/^~~\s*/, '').replace(/^(✓|✔|☑)\s*/, '');
			const eintrag = { text, klartext: klartext(text), erledigt, sofort: false, lauf: lauf++ };
			if (erledigt) {
				// Erledigtes sortiert sich nach seinem Erledigt-Datum ("erledigt 03.09."),
				// sonst nach dem ursprünglichen Termin, sonst nach heute.
				const m = /erledigt\s+([^:*]+)/i.exec(kern);
				const t = (m && leseTermin(m[1], kontext, heute)) || leseTermin(datumsKandidat(kern), kontext, heute);
				Object.assign(eintrag, t ?? { datum: heute, bis: null, genauigkeit: 'tag', circa: false, praefix: null }, {
					label: t ? klartext(m ? m[1] : datumsKandidat(kern)) : 'erledigt'
				});
				datiert.push(eintrag);
				aktuell = eintrag;
				continue;
			}
			const t = leseTermin(datumsKandidat(kern), kontext, heute);
			if (t) {
				Object.assign(eintrag, t, { label: klartext(datumsKandidat(kern)) });
				datiert.push(eintrag);
			} else if (sofort) {
				Object.assign(eintrag, { datum: heute, bis: null, genauigkeit: 'sofort', circa: false, praefix: null, label: 'sofort', sofort: true });
				datiert.push(eintrag);
			} else {
				eintrag.verdaechtig = siehtNachDatumAus(kern);
				if (!sektionOhne) {
					sektionOhne = { titel: sektion, eintraege: [] };
					ohneDatum.push(sektionOhne);
				}
				sektionOhne.eintraege.push(eintrag);
			}
			aktuell = eintrag;
			continue;
		}
		// Fortsetzungszeile eines Listeneintrags (eingerückt) → anhängen
		if (aktuell && /^\s+\S/.test(zeile)) {
			aktuell.text += ' ' + zeile.trim();
			aktuell.klartext = klartext(aktuell.text);
			continue;
		}
		if (zeile.trim() === '') {
			abschliessen();
			continue;
		}
		abschliessen();
		if (vorErsterListe && !sektion) introZeilen.push(zeile);
	}

	// Aktualität berechnen
	for (const e of datiert) {
		let inTagen = tageZwischen(heute, e.datum);
		let laufend = false;
		if (e.bis && e.datum <= heute && heute <= e.bis) {
			laufend = true;
			inTagen = 0;
		} else if (e.praefix === 'ab' && e.datum <= heute) {
			laufend = true;
			inTagen = 0;
		}
		e.inTagen = inTagen;
		e.laufend = laufend;
		e.bucket = e.erledigt
			? 'erledigt'
			: e.sofort || inTagen < 0
				? 'ueberfaellig'
				: inTagen <= 7
					? 'woche'
					: inTagen <= 30
						? 'monat'
						: 'spaeter';
	}
	datiert.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.lauf - b.lauf));

	const zaehler = {};
	for (const e of datiert) zaehler[e.bucket] = (zaehler[e.bucket] ?? 0) + 1;

	return { intro: introZeilen.join('\n').trim(), eintraege: datiert, ohneDatum, zaehler, heute };
}

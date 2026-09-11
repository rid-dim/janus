/**
 * Sachliches Warten – der `@wartet(...)`-Marker an einer Checkpoint-Zeile.
 *
 * Abzugrenzen vom *Prozess*-Warten (Agent steht am Prompt, siehe agenten.js):
 * hier geht es um Blockaden, die Tage bis Wochen dauern und die kein Hook je
 * sehen kann – eine Entscheidung beim Menschen, eine Bitte an eine fremde
 * Stelle, ein Zeitfenster an einer Anlage.
 *
 *   - [ ] Veroeffentlichung bei der ui-basics-Pflege anfragen
 *         @wartet(fremdstelle seit:2026-09-04 nach:7d)
 *
 * Drei Regeln, die den Marker erst nützlich machen:
 *
 *  1. **Auf der Zeile, nicht am Knoten.** In der Praxis wartet nie ein ganzer
 *     Knoten, sondern einzelne Checkpoints; knotenweit ausgezeichnet würde die
 *     Anzeige mehr Arbeit als blockiert ausweisen, als es ist.
 *  2. **`seit:` ist das Datum des Fragens, nicht des Bemerkens.** Wer den
 *     Marker setzt, behauptet damit: die Bitte ist raus. Ein Checkpoint wie
 *     „bei X anfragen“ ohne Marker ist kein Warten, sondern eine offene
 *     Aufgabe – sonst sammelt das Board Ausreden statt Arbeit zu zeigen.
 *  3. **Nur Warten, das den Graphen verlässt.** Warten auf einen anderen
 *     Knoten desselben Projekts ist `depends_on`, nicht `@wartet`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { tageZwischen, heuteStr } from './termine.js';

/**
 * Geschlossene Kategorienliste – geschlossen, damit über Projekte hinweg
 * aggregierbar („drei Entscheidungen liegen beim Menschen"). `nachVorgabe` ist die
 * Wiedervorlage in Tagen; `null` heißt bewusst keine Uhr.
 */
export const KATEGORIEN = {
	entscheidung: { label: 'Entscheidung', nachVorgabe: 7 },
	fremdstelle: { label: 'Fremde Stelle', nachVorgabe: 7 },
	kollege: { label: 'Kollege', nachVorgabe: 7 },
	// Zeitfenster an einer Anlage, Hardware, physischer Zutritt: hier ist
	// niemand säumig und Nachfragen hilft nicht – eine Uhr wäre reines Rauschen.
	zugang: { label: 'Zugang', nachVorgabe: null }
};

const MARKER_RE = /@wartet\(([^)]*)\)/;
const LISTITEM_RE = /^(\s*)([-*+])\s+(?:\[([ xX])\]\s+)?/;
const UEBERSCHRIFT_RE = /^\s{0,3}#{1,6}\s/;

/** Ordner, die nach Wartemarkern durchsucht werden. */
const ORDNER = ['geplant', 'stand', 'abgeschlossen', 'wissen'];

/**
 * Markdown in *logische* Listeneinträge zerlegen: ein Eintrag beginnt mit
 * `- `/`* `/`+ ` und schluckt alle folgenden, stärker eingerückten Zeilen.
 *
 * Das ist der Grund, warum hier nicht zeilenweise gearbeitet wird: Checkpoints
 * umbrechen, und ein `@wartet(...)` landet dann auf der *zweiten* physischen
 * Zeile. Ein Parser nach dem Muster „Zeilen, die mit `- [ ]` beginnen" übersieht
 * den Marker; grep findet ihn, ordnet ihn aber dem falschen Eintrag zu.
 */
export function logischeEintraege(src) {
	const zeilen = String(src || '').split(/\r?\n/);
	const out = [];
	let aktuell = null;
	let imCodeblock = false;

	const schliessen = () => {
		if (aktuell) out.push(aktuell);
		aktuell = null;
	};

	for (let i = 0; i < zeilen.length; i++) {
		const zeile = zeilen[i];

		// Eingezäunte Blöcke überspringen: Beispiele in der Doku sind
		// Erklärungen, keine Einträge.
		if (/^\s*(```|~~~)/.test(zeile)) {
			imCodeblock = !imCodeblock;
			schliessen();
			continue;
		}
		if (imCodeblock) continue;

		const m = LISTITEM_RE.exec(zeile);
		if (m) {
			schliessen();
			aktuell = {
				zeile: i + 1,
				einrueckung: m[1].length,
				checkbox: m[3] === undefined ? null : m[3].toLowerCase() === 'x',
				text: zeile.slice(m[0].length)
			};
			continue;
		}
		if (!aktuell) continue;
		// Leerzeile oder Überschrift beenden den Eintrag; eine stärker
		// eingerückte Folgezeile gehört dazu.
		if (!zeile.trim() || UEBERSCHRIFT_RE.test(zeile)) {
			schliessen();
			continue;
		}
		const einzug = zeile.length - zeile.trimStart().length;
		if (einzug > aktuell.einrueckung) {
			aktuell.text += ' ' + zeile.trim();
		} else {
			schliessen();
		}
	}
	schliessen();
	return out;
}

/** `fremdstelle seit:2026-09-04 nach:7d` → { kategorie, seit, nach } oder null. */
export function parseMarker(inner) {
	const teile = String(inner || '').trim().split(/\s+/).filter(Boolean);
	if (!teile.length) return null;

	const kategorie = teile[0].toLowerCase();
	if (!Object.hasOwn(KATEGORIEN, kategorie)) {
		return { fehler: 'Unbekannte Kategorie: ' + teile[0], kategorie: null };
	}

	let seit = null;
	let nach = KATEGORIEN[kategorie].nachVorgabe;
	for (const t of teile.slice(1)) {
		const [k, ...rest] = t.split(':');
		const v = rest.join(':');
		if (k === 'seit') {
			seit = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
			if (!seit) return { fehler: 'seit: muss JJJJ-MM-TT sein', kategorie };
		} else if (k === 'nach') {
			if (v === 'nie') nach = null;
			else {
				const d = /^(\d+)d?$/.exec(v);
				if (!d) return { fehler: 'nach: erwartet <n>d oder nie', kategorie };
				nach = Number(d[1]);
			}
		}
	}
	if (!seit) return { fehler: 'seit: fehlt – wer wartet, hat gefragt', kategorie };
	return { kategorie, seit, nach };
}

/**
 * Inline-Code durch Leerzeichen ersetzen, Länge erhalten.
 *
 * Ein `@wartet(...)` in Backticks ist eine *Erwähnung* der Syntax, keine
 * Verwendung – so steht sie in Doku, Chronik und Anleitungen. Weil die Maske
 * positionstreu ist, passen die Fundstellen weiterhin auf den Originaltext.
 */
function maskiereCode(text) {
	return text.replace(/`+[^`]*`+/g, (m) => ' '.repeat(m.length));
}

/** Den Markertext aus der Anzeige entfernen – er steht schon in den Feldern. */
function ohneMarker(text, start, laenge) {
	const roh = start === undefined ? text.replace(MARKER_RE, '') : text.slice(0, start) + text.slice(start + laenge);
	return roh.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Wartemarker einer einzelnen Markdown-Datei.
 * Abgehakte Checkpoints (`- [x]`) zählen nicht – die Sache ist erledigt.
 */
export function warteEintraege(src, heute = heuteStr()) {
	const out = [];
	for (const e of logischeEintraege(src)) {
		// Auf der maskierten Fassung suchen, damit eine Erwähnung in Backticks
		// nicht als Marker durchgeht; die Positionen gelten für beide.
		const m = MARKER_RE.exec(maskiereCode(e.text));
		if (!m) continue;
		if (e.checkbox === true) continue;

		const parsed = parseMarker(m[1]);
		const text = ohneMarker(e.text, m.index, m[0].length);
		if (!parsed || parsed.fehler) {
			out.push({ zeile: e.zeile, text, kategorie: parsed?.kategorie ?? null, fehler: parsed?.fehler ?? 'Marker unlesbar' });
			continue;
		}
		const tage = tageZwischen(parsed.seit, heute);
		out.push({
			zeile: e.zeile,
			text,
			kategorie: parsed.kategorie,
			seit: parsed.seit,
			tage,
			nach: parsed.nach,
			// Wiedervorlage nur, wo eine Uhr gesetzt ist (zugang hat keine).
			nachfassen: parsed.nach !== null && tage >= parsed.nach,
			fehler: null
		});
	}
	return out;
}

function listMarkdown(dir) {
	try {
		return fs
			.readdirSync(dir, { withFileTypes: true })
			.flatMap((e) => {
				const p = path.join(dir, e.name);
				if (e.isDirectory()) return listMarkdown(p);
				return e.name.toLowerCase().endsWith('.md') ? [p] : [];
			});
	} catch {
		return [];
	}
}

/**
 * Alle Wartemarker eines Projekts – bewusst über *alle* Projektordner, nicht
 * nur `geplant/`: in der Praxis stehen Wartezustände auch in Dateien wie
 * `stand/offene-fragen.md`, die nie ein Checkpoint geworden sind.
 */
export function sammleWartenProjekt(dir, heute = heuteStr()) {
	const out = [];
	for (const sub of ORDNER) {
		for (const file of listMarkdown(path.join(dir, sub))) {
			let src;
			try {
				src = fs.readFileSync(file, 'utf8');
			} catch {
				continue;
			}
			const rel = path.relative(dir, file).split(path.sep).join('/');
			for (const e of warteEintraege(src, heute)) out.push({ ...e, rel });
		}
	}
	return out;
}

/**
 * Wartemarker über alle (nicht ausgeblendeten) Projekte, dringlichstes zuerst:
 * überfällige Wiedervorlagen oben, dann nach Wartedauer.
 */
export function sammleWarten(reg, hidden = new Set(), heute = heuteStr()) {
	const out = [];
	for (const p of reg) {
		if (hidden.has(p.id)) continue;
		for (const e of sammleWartenProjekt(p.dir, heute)) {
			out.push({
				...e,
				projektId: p.id,
				projektTitel: p.manifest.titel,
				href: `/projekt/${encodeURIComponent(p.id)}#stand-${encodeURIComponent(e.rel.replace(/^[^/]+\//, '').replace(/\.md$/i, ''))}`
			});
		}
	}
	out.sort(
		(a, b) =>
			Number(Boolean(b.nachfassen)) - Number(Boolean(a.nachfassen)) ||
			(b.tage ?? -1) - (a.tage ?? -1) ||
			a.text.localeCompare(b.text, 'de')
	);
	return out;
}

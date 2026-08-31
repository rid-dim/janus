import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { collectWikilinks } from './markdown.js';

/**
 * Wissensbasis eines Projekts: der Ordner `wissen/` neben `stand/`.
 * Referenz-Seiten, beliebig verschachtelbar, verlinkt über [[wikilinks]].
 * Dieses Modul liest den Baum ein und baut die Linkkarte (Backlinks,
 * Rotlinks, Waisen, Aktualität) – rein lesend, alles bleibt Datei.
 */

export const WISSEN_DIR = 'wissen';

/** Standard-Schwelle, ab der eine Seite als „abgestanden" gilt (Tage). */
export const ABGESTANDEN_TAGE = 180;

function titleFromFilename(f) {
	return f
		.replace(/\.md$/i, '')
		.replace(/^\d+[-_]?/, '')
		.replace(/[-_]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^\w/, (c) => c.toUpperCase());
}

function toDateStr(v) {
	if (v === null || v === undefined || v === '') return null;
	if (v instanceof Date) {
		if (Number.isNaN(v.getTime())) return null;
		return [
			v.getUTCFullYear(),
			String(v.getUTCMonth() + 1).padStart(2, '0'),
			String(v.getUTCDate()).padStart(2, '0')
		].join('-');
	}
	const s = String(v).trim();
	let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
	if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
	m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
	if (m) return `${m[3]}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
	return null;
}

/** Alle .md-Dateien unter wissen/ (rekursiv), als Projekt-relative Pfade. */
function walk(base, rel = '') {
	let entries;
	try {
		entries = fs.readdirSync(path.join(base, rel), { withFileTypes: true });
	} catch {
		return [];
	}
	const out = [];
	for (const e of entries.sort((a, b) => a.name.localeCompare(b.name, 'de'))) {
		if (e.name.startsWith('.')) continue;
		const r = rel ? rel + '/' + e.name : e.name;
		if (e.isDirectory()) out.push(...walk(base, r));
		else if (e.name.toLowerCase().endsWith('.md')) out.push(r);
	}
	return out;
}

/** Nur die Slug-Menge (für die Wikilink-Auflösung beim Rendern anderswo). */
export function wikiSlugs(projectDir) {
	return new Set(
		walk(path.join(projectDir, WISSEN_DIR)).map((r) => r.replace(/\.md$/i, ''))
	);
}

/**
 * Wissensbasis vollständig einlesen.
 * Seiten: { slug, rel, title, geprueft, body, data }.
 * Slug = Pfad unter wissen/ ohne .md ('/'-getrennt) – der Dateiname ist die Identität.
 */
export function loadWissen(projectDir) {
	const base = path.join(projectDir, WISSEN_DIR);
	const pages = [];
	for (const r of walk(base)) {
		let parsed;
		try {
			parsed = matter(fs.readFileSync(path.join(base, r), 'utf8'));
		} catch {
			continue;
		}
		pages.push({
			slug: r.replace(/\.md$/i, ''),
			rel: WISSEN_DIR + '/' + r,
			title: parsed.data.title || parsed.data.titel || titleFromFilename(path.basename(r)),
			geprueft: toDateStr(parsed.data.geprueft),
			body: parsed.content,
			links: collectWikilinks(parsed.content)
		});
	}
	return pages;
}

/**
 * Linkkarte über das ganze Projekt: Wikilinks aus wissen/ UND aus
 * stand/, geplant/, abgeschlossen/ zeigen auf Wissens-Seiten.
 * quellen: [{ von: slug|rel, titel, wo: 'wissen'|'stand'|'geplant'|'abgeschlossen' }]
 */
export function linkkarte(projectDir, pages) {
	const eingehend = new Map(); // slug -> [quelle]
	const addLink = (ziel, quelle) => {
		if (!eingehend.has(ziel)) eingehend.set(ziel, []);
		eingehend.get(ziel).push(quelle);
	};
	for (const p of pages) {
		for (const ziel of p.links) {
			addLink(ziel, { von: p.slug, titel: p.title, wo: 'wissen' });
		}
	}
	for (const sub of ['stand', 'geplant', 'abgeschlossen']) {
		let files;
		try {
			files = fs.readdirSync(path.join(projectDir, sub)).filter((f) => f.endsWith('.md'));
		} catch {
			continue;
		}
		for (const f of files) {
			let parsed;
			try {
				parsed = matter(fs.readFileSync(path.join(projectDir, sub, f), 'utf8'));
			} catch {
				continue;
			}
			const titel =
				parsed.data.title || parsed.data.titel || titleFromFilename(f);
			for (const ziel of collectWikilinks(parsed.content)) {
				addLink(ziel, { von: sub + '/' + f, titel, wo: sub });
			}
		}
	}
	return eingehend;
}

/**
 * Pflege-Sicht: Rotlinks (gewünschte, fehlende Seiten), Waisen (Seiten ohne
 * eingehende Links) und abgestandene Seiten (geprueft älter als die Schwelle
 * bzw. nie geprüft).
 */
export function pflege(pages, eingehend, heuteIso, schwelleTage = ABGESTANDEN_TAGE) {
	const slugs = new Set(pages.map((p) => p.slug));

	const rot = [];
	for (const [ziel, quellen] of eingehend) {
		if (!slugs.has(ziel)) rot.push({ slug: ziel, quellen: quellen.length });
	}
	rot.sort((a, b) => b.quellen - a.quellen || a.slug.localeCompare(b.slug, 'de'));

	const waisen = pages
		.filter((p) => !(eingehend.get(p.slug)?.length))
		.map((p) => ({ slug: p.slug, title: p.title }));

	const grenze = new Date(heuteIso);
	grenze.setDate(grenze.getDate() - schwelleTage);
	const grenzeIso = grenze.toISOString().slice(0, 10);
	const abgestanden = pages
		.filter((p) => p.geprueft && p.geprueft < grenzeIso)
		.map((p) => ({ slug: p.slug, title: p.title, geprueft: p.geprueft }));
	const ungeprueft = pages.filter((p) => !p.geprueft).length;

	return { rot, waisen, abgestanden, ungeprueft };
}

/** Seitenbaum für die Sidebar: verschachtelte Ordner-/Seitenstruktur. */
export function seitenbaum(pages) {
	const root = { ordner: new Map(), seiten: [] };
	for (const p of pages) {
		const teile = p.slug.split('/');
		let node = root;
		for (const t of teile.slice(0, -1)) {
			if (!node.ordner.has(t)) node.ordner.set(t, { ordner: new Map(), seiten: [] });
			node = node.ordner.get(t);
		}
		node.seiten.push({ slug: p.slug, title: p.title });
	}
	const auf = (node) => ({
		ordner: [...node.ordner.entries()]
			.sort((a, b) => a[0].localeCompare(b[0], 'de'))
			.map(([name, kind]) => ({ name, ...auf(kind) })),
		seiten: node.seiten.sort((a, b) => a.title.localeCompare(b.title, 'de'))
	});
	return auf(root);
}

/** Naive Volltextsuche über Titel + Body (reicht laut Konzept bis ~1000 Seiten). */
export function sucheWissen(pages, q) {
	const needle = String(q || '').trim().toLowerCase();
	if (!needle) return [];
	const treffer = [];
	for (const p of pages) {
		const inTitle = p.title.toLowerCase().includes(needle);
		const idx = p.body.toLowerCase().indexOf(needle);
		if (!inTitle && idx < 0) continue;
		let snippet = '';
		if (idx >= 0) {
			const start = Math.max(0, idx - 60);
			snippet = (start > 0 ? '…' : '') +
				p.body.slice(start, idx + needle.length + 90).replace(/\s+/g, ' ').trim() + '…';
		}
		treffer.push({ slug: p.slug, title: p.title, snippet, inTitle });
	}
	treffer.sort((a, b) => (b.inTitle ? 1 : 0) - (a.inTitle ? 1 : 0));
	return treffer;
}

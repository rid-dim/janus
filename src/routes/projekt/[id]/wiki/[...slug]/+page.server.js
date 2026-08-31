import { error } from '@sveltejs/kit';
import { projectEntry, registry, wikiKontext, resolveWikilink } from '$lib/server/projects.js';
import { renderMarkdown } from '$lib/server/markdown.js';
import {
	loadWissen,
	linkkarte,
	pflege,
	seitenbaum,
	sucheWissen,
	ABGESTANDEN_TAGE
} from '$lib/server/wissen.js';

function heuteIso() {
	const d = new Date();
	const p = (n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Backlinks aus anderen Projekten, die dieses Projekt als Wissens-Hub
 * deklarieren: jeder [[wikilink]] dort, der (nach dessen Auflösungsregeln)
 * auf die Seite `slug` HIER zeigt, wird zur externen Referenz.
 */
function externeBacklinks(reg, hubId, slug) {
	const out = [];
	for (const e of reg) {
		if (e.id === hubId) continue;
		if (!(e.manifest.wissen_hubs || []).includes(hubId)) continue;
		const kontext = wikiKontext(e, reg);
		const pages = loadWissen(e.dir);
		const karte = linkkarte(e.dir, pages);
		for (const [ziel, quellen] of karte) {
			const r = resolveWikilink(kontext, ziel);
			if (r.hub !== hubId) continue;
			const zielSlug = ziel.startsWith(hubId + '/') ? ziel.slice(hubId.length + 1) : ziel;
			if (zielSlug !== slug) continue;
			for (const q of quellen) {
				out.push({ ...q, wo: 'projekt', projektId: e.id, projektTitel: e.manifest.titel });
			}
		}
	}
	return out;
}

export function load({ params, url }) {
	const reg = registry();
	const entry = reg.find((p) => p.id === params.id) || projectEntry(params.id);
	if (!entry) throw error(404, 'Projekt nicht gefunden: ' + params.id);

	const pages = loadWissen(entry.dir);
	const eingehend = linkkarte(entry.dir, pages);
	const kontext = wikiKontext(entry, reg);
	const env = { wiki: { resolve: (t) => resolveWikilink(kontext, t) } };
	const heute = heuteIso();

	const slug = (params.slug || '').replace(/\/+$/, '');

	// Die angeforderte Seite – oder die Startseite (bevorzugt "00…"/start/index).
	let page = null;
	let fehlt = null; // Rotlink-Ziel: Slug existiert nicht -> Anlegen anbieten
	if (slug) {
		page = pages.find((p) => p.slug === slug) || null;
		if (!page) fehlt = slug;
	} else if (pages.length) {
		page = pages.find((p) => /(^|\/)(00[-_]|start$|index$)/.test(p.slug)) || pages[0];
	}

	const rendered = page
		? {
				slug: page.slug,
				rel: page.rel,
				title: page.title,
				geprueft: page.geprueft,
				body: page.body,
				html: renderMarkdown(page.body, env),
				backlinks: [
					...(eingehend.get(page.slug) || []).filter(
						(q) => !(q.wo === 'wissen' && q.von === page.slug)
					),
					...externeBacklinks(reg, entry.id, page.slug)
				]
			}
		: null;

	// Fehlt die Seite lokal, löst sie vielleicht ein Hub auf -> dorthin zeigen.
	const fehltAufloesung = fehlt ? resolveWikilink(kontext, fehlt) : null;

	// Hub-Bäume (read-only eingeblendet) + Slug-Kollisionen für die Pflege.
	const hubs = kontext.hubs.map((h) => {
		const hubPages = loadWissen(h.dir);
		return { id: h.id, titel: h.titel, baum: seitenbaum(hubPages), anzahl: hubPages.length };
	});
	const kollisionen = [];
	for (const p of pages) {
		const hub = kontext.hubs.find((h) => h.slugs.has(p.slug));
		if (hub) kollisionen.push({ slug: p.slug, hub: hub.id });
	}

	// Pflege: Rotlinks nur für Ziele, die auch über die Hubs nicht auflösbar sind.
	const basisPflege = pflege(pages, eingehend, heute, ABGESTANDEN_TAGE);
	basisPflege.rot = basisPflege.rot.filter((r) => !resolveWikilink(kontext, r.slug).known);

	const projects = reg
		.map((e) => ({ id: e.id, titel: e.manifest.titel, status: e.manifest.status }))
		.sort((a, b) => a.titel.localeCompare(b.titel, 'de'));

	const q = url.searchParams.get('q') || '';

	return {
		id: entry.id,
		titel: entry.manifest.titel,
		status: entry.manifest.status,
		projects,
		baum: seitenbaum(pages),
		anzahl: pages.length,
		hubs,
		kollisionen,
		page: rendered,
		fehlt,
		fehltHub: fehltAufloesung?.known ? fehltAufloesung : null,
		pflege: basisPflege,
		heute,
		q,
		treffer: q ? sucheWissen(pages, q) : []
	};
}

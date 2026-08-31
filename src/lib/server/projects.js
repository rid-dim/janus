import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import dagre from '@dagrejs/dagre';
import { dataRoot, projectSubdir, linkedProjectPaths, prettyPath } from './config.js';
import { renderMarkdown, countTasks } from './markdown.js';
import { wikiSlugs } from './wissen.js';

function readIfExists(p) {
	try {
		return fs.readFileSync(p, 'utf8');
	} catch {
		return null;
	}
}

function listMarkdown(dir) {
	try {
		return fs
			.readdirSync(dir)
			.filter((f) => f.toLowerCase().endsWith('.md'))
			.sort();
	} catch {
		return [];
	}
}

function isProjectDir(dir) {
	return fs.existsSync(path.join(dir, 'projekt.yaml'));
}

function readManifest(projectDir, fallbackId) {
	const raw = readIfExists(path.join(projectDir, 'projekt.yaml')) ?? '';
	let data = {};
	try {
		data = yaml.load(raw) || {};
	} catch {
		data = {};
	}
	return {
		id: data.id || fallbackId,
		titel: data.titel || fallbackId,
		status: data.status || 'aktiv',
		tags: Array.isArray(data.tags) ? data.tags : [],
		beschreibung: data.beschreibung || '',
		schemaVersion: data.schemaVersion ?? 1,
		stand_reihenfolge: Array.isArray(data.stand_reihenfolge) ? data.stand_reihenfolge : null,
		// Wissens-Hubs: Projekt-IDs, deren wissen/ hier read-only eingeblendet
		// wird und gegen die [[wikilinks]] aufgelöst werden (nach lokal).
		wissen_hubs: Array.isArray(data.wissen_hubs) ? data.wissen_hubs.map(String) : []
	};
}

function shortHash(s) {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
	return (h >>> 0).toString(36).slice(0, 6);
}

function sanitizeId(id) {
	return (
		String(id || '')
			.trim()
			.replace(/[^\w.-]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'projekt'
	);
}

/**
 * Build the registry of all known projects, from two sources:
 *  - the central store (dataRoot: one subfolder per project)
 *  - linked repos (config.projects: each holds its data in projectSubdir())
 * Each entry: { id, dir, source: 'store'|'linked', repoPath, manifest }.
 */
export function registry() {
	const items = [];
	const usedIds = new Set();

	const add = (dir, source, preferredId, repoPath) => {
		if (!isProjectDir(dir)) return;
		const manifest = readManifest(dir, preferredId);
		let id = sanitizeId(manifest.id || preferredId);
		if (usedIds.has(id)) id = id + '-' + shortHash(dir);
		usedIds.add(id);
		items.push({ id, dir, source, repoPath: repoPath || null, manifest: { ...manifest, id } });
	};

	// central store
	try {
		for (const e of fs.readdirSync(dataRoot(), { withFileTypes: true })) {
			if (e.isDirectory()) add(path.join(dataRoot(), e.name), 'store', e.name);
		}
	} catch {
		// no central store present -> fine, linked projects may still exist
	}

	// linked repos
	const sub = projectSubdir();
	for (const repoPath of linkedProjectPaths()) {
		add(path.join(repoPath, sub), 'linked', path.basename(repoPath), repoPath);
	}

	return items;
}

function findProject(id) {
	return registry().find((p) => p.id === id) || null;
}

/** Registry-Eintrag eines Projekts ({ id, dir, source, repoPath, manifest }) oder null. */
export function projectEntry(id) {
	return findProject(id);
}

const encSlug = (s) => s.split('/').map(encodeURIComponent).join('/');

/**
 * Wiki-Kontext eines Projekts: lokale Slugs + die Slug-Mengen seiner
 * Wissens-Hubs (projekt.yaml `wissen_hubs`, in deklarierter Reihenfolge).
 * Hubs sind reine Lese-Referenzen auf andere Projekte; Hub-von-Hub wird
 * bewusst NICHT transitiv aufgelöst.
 */
export function wikiKontext(entry, reg = registry()) {
	const hubs = [];
	for (const hubId of entry.manifest.wissen_hubs || []) {
		if (hubId === entry.id) continue;
		const hub = reg.find((p) => p.id === hubId);
		if (!hub) continue;
		hubs.push({ id: hub.id, titel: hub.manifest.titel, dir: hub.dir, slugs: wikiSlugs(hub.dir) });
	}
	return { id: entry.id, localSlugs: wikiSlugs(entry.dir), hubs };
}

/**
 * Ein [[wikilink]]-Ziel auflösen: erst lokal, dann explizit `hub-id/slug`,
 * dann implizit in den Hubs (Deklarations-Reihenfolge). Nicht auflösbar =
 * Rotlink, der IM PROJEKT angelegt würde.
 * Rückgabe: { href, known, hub? }.
 */
export function resolveWikilink(kontext, target) {
	if (kontext.localSlugs.has(target)) {
		return { href: `/projekt/${kontext.id}/wiki/${encSlug(target)}`, known: true };
	}
	const slash = target.indexOf('/');
	if (slash > 0) {
		const hub = kontext.hubs.find((h) => h.id === target.slice(0, slash));
		const rest = target.slice(slash + 1);
		if (hub && hub.slugs.has(rest)) {
			return { href: `/projekt/${hub.id}/wiki/${encSlug(rest)}`, known: true, hub: hub.id };
		}
	}
	for (const hub of kontext.hubs) {
		if (hub.slugs.has(target)) {
			return { href: `/projekt/${hub.id}/wiki/${encSlug(target)}`, known: true, hub: hub.id };
		}
	}
	return { href: `/projekt/${kontext.id}/wiki/${encSlug(target)}`, known: false };
}

/** Wikilink-Render-Env für ein Projekt (löst [[...]] lokal + über Hubs auf). */
export function wikiEnv(entry, reg) {
	const kontext = wikiKontext(entry, reg);
	return { wiki: { resolve: (target) => resolveWikilink(kontext, target) }, kontext };
}

/** Absolute base directory (folder containing projekt.yaml) for a project id. */
export function projectDir(id) {
	const p = findProject(id);
	if (!p) throw new Error('Projekt nicht gefunden: ' + id);
	return p.dir;
}

function aggregateTasks(dir) {
	let done = 0;
	let total = 0;
	let nodes = 0;
	for (const f of listMarkdown(path.join(dir, 'geplant'))) {
		const parsed = matter(readIfExists(path.join(dir, 'geplant', f)) ?? '');
		const c = countTasks(parsed.content);
		done += c.done;
		total += c.total;
		nodes++;
	}
	return { progress: { done, total }, nodeCount: nodes };
}

/** Lokales Heute als YYYY-MM-DD (Datumsvergleiche laufen rein über Strings). */
function heuteStr() {
	const d = new Date();
	return [
		d.getFullYear(),
		String(d.getMonth() + 1).padStart(2, '0'),
		String(d.getDate()).padStart(2, '0')
	].join('-');
}

/** Differenz zweier YYYY-MM-DD-Strings in ganzen Tagen (b - a). */
function tageZwischen(a, b) {
	const [ay, am, ad] = a.split('-').map(Number);
	const [by, bm, bd] = b.split('-').map(Number);
	return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/**
 * Fällige Knoten über alle Projekte: `ende:` auf einem nicht fertigen
 * geplant/-Knoten gilt als Fälligkeitsdatum. Liefert Überfälliges plus alles,
 * was in den nächsten `tage` Tagen ansteht — dringlichstes zuerst.
 */
export function collectDeadlines(tage = 7) {
	const heute = heuteStr();
	const out = [];
	for (const p of registry()) {
		const dir = path.join(p.dir, 'geplant');
		for (const f of listMarkdown(dir)) {
			const parsed = matter(readIfExists(path.join(dir, f)) ?? '');
			const status = (parsed.data.status || 'offen').toLowerCase();
			if (status === 'fertig') continue;
			const ende = toDateStr(parsed.data.ende ?? parsed.data.end);
			if (!ende) continue;
			const inTagen = tageZwischen(heute, ende);
			if (inTagen > tage) continue;
			out.push({
				projektId: p.id,
				projektTitel: p.manifest.titel,
				knotenId: parsed.data.id || f.replace(/\.md$/i, ''),
				titel: parsed.data.title || parsed.data.titel || titleFromFilename(f),
				ende,
				inTagen
			});
		}
	}
	out.sort((a, b) => a.inTagen - b.inTagen || a.titel.localeCompare(b.titel, 'de'));
	return out;
}

/** Lightweight summaries for the dashboard. */
export function listProjects() {
	const projects = registry().map((p) => ({
		...p.manifest,
		source: p.source,
		repoPath: p.repoPath,
		location: p.source === 'linked' ? prettyPath(p.repoPath) : 'Zentraler Store',
		...aggregateTasks(p.dir)
	}));
	projects.sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
	return projects;
}

function orderStand(files, order) {
	if (!order) return files;
	const base = (f) => f.replace(/\.md$/i, '');
	const inOrder = order
		.map((name) => files.find((f) => base(f) === name || f === name))
		.filter(Boolean);
	const rest = files.filter((f) => !inOrder.includes(f));
	return [...inOrder, ...rest];
}

function layoutDag(nodes, edges) {
	const W = 230;
	const H = 96;
	const g = new dagre.graphlib.Graph();
	g.setGraph({ rankdir: 'LR', nodesep: 34, ranksep: 90, marginx: 24, marginy: 24 });
	g.setDefaultEdgeLabel(() => ({}));
	for (const n of nodes) g.setNode(n.id, { width: W, height: H });
	for (const e of edges) {
		if (g.hasNode(e.from) && g.hasNode(e.to)) g.setEdge(e.from, e.to);
	}
	dagre.layout(g);
	for (const n of nodes) {
		const p = g.node(n.id);
		n.x = p.x - W / 2;
		n.y = p.y - H / 2;
		n.w = W;
		n.h = H;
	}
	const graph = g.graph();
	return { width: Math.max(graph.width || 0, 200), height: Math.max(graph.height || 0, 160) };
}

/** A short plain-text excerpt of a markdown body (for cards without checkpoints). */
function plainPreview(src, max = 180) {
	return String(src || '')
		.replace(/```[\s\S]*?```/g, ' ') // code / plotly blocks
		.replace(/^#{1,6}\s+/gm, '') // heading markers
		.replace(/^\s*[-*+]\s+\[[ xX]\]\s?/gm, '') // task markers (safety)
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> link text
		.replace(/[*_`>#]/g, '') // leftover md punctuation
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, max);
}

/**
 * Optionales Datums-Frontmatter (`start:` / `ende:`) auf "YYYY-MM-DD" normieren.
 * YAML macht aus `2026-08-01` bereits ein Date-Objekt; Strings werden zusätzlich
 * in der deutschen Schreibweise (`01.08.2026`) akzeptiert. Unlesbares -> null.
 */
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

function titleFromFilename(f) {
	return f
		.replace(/\.md$/i, '')
		.replace(/^\d+[-_]?/, '')
		.replace(/[-_]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^\w/, (c) => c.toUpperCase());
}

/** Ordnername des Themen-Archivs (beendete Knoten werden dorthin verschoben). */
export const ARCHIVE_DIR = 'abgeschlossen';

/**
 * Alle Markdown-Knoten eines Unterordners (`geplant/` oder `abgeschlossen/`)
 * einlesen. Fehlt der Ordner, kommt eine leere Liste zurück.
 */
function readNodes(dir, sub, env = {}) {
	const out = [];
	for (const f of listMarkdown(path.join(dir, sub))) {
		const rel = path.join(sub, f);
		const parsed = matter(readIfExists(path.join(dir, rel)) ?? '');
		const dep = parsed.data.depends_on ?? parsed.data.dependsOn ?? [];
		out.push({
			id: parsed.data.id || f.replace(/\.md$/i, ''),
			rel,
			title: parsed.data.title || parsed.data.titel || titleFromFilename(f),
			status: (parsed.data.status || (sub === ARCHIVE_DIR ? 'fertig' : 'offen')).toLowerCase(),
			depends_on: Array.isArray(dep) ? dep : dep ? [dep] : [],
			// optionaler Zeitraum für die Zeitleisten-Ansicht (beide Felder freiwillig)
			start: toDateStr(parsed.data.start),
			ende: toDateStr(parsed.data.ende ?? parsed.data.end),
			tasks: countTasks(parsed.content),
			preview: plainPreview(parsed.content),
			body: parsed.content,
			html: renderMarkdown(parsed.content, env),
			archiviert: sub === ARCHIVE_DIR
		});
	}
	return out;
}

/** Load a full project by id: manifest + rendered stand sections + planned DAG. */
export function getProject(id) {
	const entry = findProject(id);
	if (!entry) return null;
	const dir = entry.dir;
	const manifest = entry.manifest;
	// [[wikilinks]] in stand/geplant zeigen auf die wissen/-Seiten des Projekts (+ Hubs)
	const env = wikiEnv(entry);

	// --- Aktueller Stand ---
	const standFiles = orderStand(listMarkdown(path.join(dir, 'stand')), manifest.stand_reihenfolge);
	const stand = standFiles.map((f) => {
		const rel = path.join('stand', f);
		const parsed = matter(readIfExists(path.join(dir, rel)) ?? '');
		return {
			id: f.replace(/\.md$/i, ''),
			rel,
			title: parsed.data.title || parsed.data.titel || titleFromFilename(f),
			pin: (parsed.data.pin || '').toString().trim().toLowerCase() || null,
			body: parsed.content,
			html: renderMarkdown(parsed.content, env)
		};
	});

	// --- Geplant (DAG) + Archiv ---
	const nodes = readNodes(dir, 'geplant', env);
	// `abgeschlossen/` ist optional – ältere Projekte haben den Ordner nicht.
	const abgeschlossen = readNodes(dir, ARCHIVE_DIR, env).map((n) => ({ ...n, archiviert: true }));

	// Edges only between ACTIVE nodes; a node touched by no edge is "loose" and
	// gets laid out in a wrapping grid instead of the DAG canvas. Dependencies on
	// archived nodes are treated as fulfilled: they leave the graph but are kept
	// on the node (`deps_archiviert`) so nothing is lost on save.
	const idset = new Set(nodes.map((n) => n.id));
	const archivIds = new Set(abgeschlossen.map((n) => n.id));
	const edges = [];
	for (const n of nodes) {
		n.deps_archiviert = n.depends_on.filter((d) => !idset.has(d) && archivIds.has(d));
		for (const d of n.depends_on) if (idset.has(d)) edges.push({ from: d, to: n.id });
	}
	const connectedIds = new Set();
	for (const e of edges) {
		connectedIds.add(e.from);
		connectedIds.add(e.to);
	}
	for (const n of nodes) n.loose = !connectedIds.has(n.id);
	const size = layoutDag(nodes.filter((n) => !n.loose), edges);

	return {
		...manifest,
		source: entry.source,
		repoPath: entry.repoPath,
		location: entry.source === 'linked' ? prettyPath(entry.repoPath) : 'Zentraler Store',
		stand,
		geplant: { nodes, edges, ...size },
		abgeschlossen,
		wissenAnzahl: env.kontext.localSlugs.size
	};
}

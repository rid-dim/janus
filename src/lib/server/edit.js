import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { resolveInDir } from './config.js';
import { projectDir, ARCHIVE_DIR } from './projects.js';
import { slugify } from './scaffold.js';

/**
 * Write layer for the human-facing editor. Every function writes plain files
 * back to disk (the app is only the view on top of them) and tries to keep
 * diffs small and git-friendly:
 *   - saveBody preserves the frontmatter block byte-for-byte.
 *   - metadata changes go through gray-matter / js-yaml round-trips.
 */

const FM_RE = /^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/;

function eolOf(text) {
	return text.includes('\r\n') ? '\r\n' : '\n';
}

function toEol(text, eol) {
	return eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
}

/**
 * Load the node files as { id, rel, deps } – used for cycle checks and to
 * validate depends_on. Covers `geplant/` and the optional archive
 * `abgeschlossen/`, so a dependency on an archived node stays valid.
 */
function loadNodes(dir, subs = ['geplant', ARCHIVE_DIR]) {
	const out = [];
	for (const sub of subs) {
		let files = [];
		try {
			files = fs.readdirSync(path.join(dir, sub)).filter((f) => f.toLowerCase().endsWith('.md'));
		} catch {
			continue; // Ordner fehlt (z. B. Projekt ohne Archiv)
		}
		for (const f of files) {
			let parsed;
			try {
				parsed = matter(fs.readFileSync(path.join(dir, sub, f), 'utf8'));
			} catch {
				continue;
			}
			const id = parsed.data.id || f.replace(/\.md$/i, '');
			const dep = parsed.data.depends_on ?? parsed.data.dependsOn ?? [];
			out.push({ id, rel: path.join(sub, f), deps: Array.isArray(dep) ? dep : dep ? [dep] : [] });
		}
	}
	return out;
}

/** Would setting `changedId.depends_on = newDeps` introduce a cycle? */
function createsCycle(nodes, changedId, newDeps) {
	const map = new Map(nodes.map((n) => [n.id, n.id === changedId ? newDeps : n.deps]));
	if (!map.has(changedId)) map.set(changedId, newDeps);
	const visiting = new Set();
	const done = new Set();
	function dfs(id) {
		if (done.has(id)) return false;
		if (visiting.has(id)) return true;
		visiting.add(id);
		for (const d of map.get(id) || []) {
			if (dfs(d)) return true;
		}
		visiting.delete(id);
		done.add(id);
		return false;
	}
	for (const id of map.keys()) if (dfs(id)) return true;
	return false;
}

/**
 * Overwrite the body of a stand/ or geplant/ markdown file while keeping any
 * frontmatter block exactly as it was on disk (minimal git diffs).
 */
export function saveBody(projectId, rel, body) {
	const file = resolveInDir(projectDir(projectId), rel);
	if (!fs.existsSync(file)) return { ok: false, error: 'Datei nicht gefunden' };
	const raw = fs.readFileSync(file, 'utf8');
	const eol = eolOf(raw);
	const m = FM_RE.exec(raw);
	const fmBlock = m ? m[0].replace(/\r?\n+$/, '') : '';
	let normBody = String(body ?? '').replace(/\r\n/g, '\n');
	let out;
	if (fmBlock) {
		normBody = normBody.replace(/^\n+/, '');
		out = fmBlock + '\n\n' + normBody;
	} else {
		out = normBody;
	}
	out = out.replace(/\n+$/, '') + '\n';
	fs.writeFileSync(file, toEol(out, eol), 'utf8');
	return { ok: true };
}

/** Update a geplant node's frontmatter (title / status / depends_on). */
export function updateNodeMeta(projectId, rel, patch = {}) {
	const dir = projectDir(projectId);
	const file = resolveInDir(dir, rel);
	if (!fs.existsSync(file)) return { ok: false, error: 'Datei nicht gefunden' };
	const parsed = matter(fs.readFileSync(file, 'utf8'));
	const data = { ...parsed.data };
	const nodeId = data.id || path.basename(rel).replace(/\.md$/i, '');

	if ('depends_on' in patch) {
		let deps = Array.isArray(patch.depends_on)
			? patch.depends_on.filter((d) => typeof d === 'string' && d.trim())
			: [];
		deps = [...new Set(deps)].filter((d) => d !== nodeId);
		const nodes = loadNodes(dir);
		const known = new Set(nodes.map((n) => n.id));
		const unknown = deps.find((d) => !known.has(d));
		if (unknown) return { ok: false, error: 'Unbekannter Knoten: ' + unknown };
		if (createsCycle(nodes, nodeId, deps)) {
			return { ok: false, error: 'Das würde einen Zyklus erzeugen – der Graph muss zyklenfrei bleiben.' };
		}
		data.depends_on = deps;
	}
	if ('title' in patch && typeof patch.title === 'string' && patch.title.trim()) {
		data.title = patch.title.trim();
	}
	if ('status' in patch && typeof patch.status === 'string' && patch.status.trim()) {
		data.status = patch.status.trim();
	}
	if ('geprueft' in patch) {
		// Aktualitäts-Stempel für wissen/-Seiten: "zuletzt inhaltlich bestätigt am".
		const g = String(patch.geprueft || '').trim();
		if (!/^\d{4}-\d{2}-\d{2}$/.test(g)) return { ok: false, error: 'geprueft muss JJJJ-MM-TT sein' };
		data.geprueft = g;
	}
	fs.writeFileSync(file, matter.stringify(parsed.content, data), 'utf8');
	return { ok: true };
}

/**
 * Create a new stand section, geplant node or wissen page from a title.
 * Für `wissen` darf ein expliziter Slug mitkommen (auch mit Unterordnern,
 * z. B. aus einem Rotlink "werkstoffe/alu-6061"); sonst wird er aus dem
 * Titel abgeleitet.
 */
export function createDoc(projectId, kind, title, slug) {
	if (kind !== 'stand' && kind !== 'geplant' && kind !== 'wissen') {
		return { ok: false, error: 'Ungültiger Typ' };
	}
	if (typeof title !== 'string' || !title.trim()) return { ok: false, error: 'Titel fehlt' };
	const dir = projectDir(projectId);
	let name;
	if (kind === 'wissen' && typeof slug === 'string' && slug.trim()) {
		name = slug
			.trim()
			.replace(/\.md$/i, '')
			.split('/')
			.map(slugify)
			.filter(Boolean)
			.join('/');
		if (!name) return { ok: false, error: 'Ungültiger Slug' };
	} else {
		name = slugify(title);
	}
	const rel = path.join(kind, name + '.md');
	const file = resolveInDir(dir, rel);
	if (fs.existsSync(file)) return { ok: false, error: 'Datei existiert bereits: ' + name + '.md' };
	fs.mkdirSync(path.dirname(file), { recursive: true });

	let content;
	if (kind === 'geplant') {
		content = matter.stringify('\n## Checkpoints\n\n- [ ] Erster Schritt\n', {
			id: slugify(title),
			title: title.trim(),
			status: 'offen',
			depends_on: []
		});
	} else if (kind === 'wissen') {
		content = matter.stringify('\nNeue Wissens-Seite.\n', { title: title.trim() });
	} else {
		content = `## ${title.trim()}\n\nNeuer Abschnitt.\n`;
	}
	fs.writeFileSync(file, content, 'utf8');
	return { ok: true, rel, id: name };
}

/** Delete a stand/, geplant/, abgeschlossen/ or wissen/ file (guarded to those folders). */
export function deleteDoc(projectId, rel) {
	const norm = String(rel || '').replace(/\\/g, '/');
	const erlaubt = ['stand/', 'geplant/', ARCHIVE_DIR + '/', 'wissen/'];
	if (!erlaubt.some((p) => norm.startsWith(p))) {
		return { ok: false, error: 'Nur Dateien in stand/, geplant/, abgeschlossen/ oder wissen/ löschbar' };
	}
	const file = resolveInDir(projectDir(projectId), rel);
	if (!fs.existsSync(file)) return { ok: false, error: 'Datei nicht gefunden' };
	fs.unlinkSync(file);
	return { ok: true };
}

/** Update project metadata in projekt.yaml (titel / status / beschreibung / tags / order). */
export function updateProjectMeta(projectId, patch = {}) {
	const file = path.join(projectDir(projectId), 'projekt.yaml');
	let data = {};
	try {
		data = yaml.load(fs.readFileSync(file, 'utf8')) || {};
	} catch {
		data = {};
	}
	if (typeof patch.titel === 'string' && patch.titel.trim()) data.titel = patch.titel.trim();
	if (typeof patch.status === 'string') data.status = patch.status.trim();
	if (typeof patch.beschreibung === 'string') data.beschreibung = patch.beschreibung;
	if (Array.isArray(patch.tags)) {
		data.tags = patch.tags.map((t) => String(t).trim()).filter(Boolean);
	}
	if (Array.isArray(patch.stand_reihenfolge)) {
		data.stand_reihenfolge = patch.stand_reihenfolge.map(String);
	}
	fs.writeFileSync(file, yaml.dump(data, { lineWidth: -1, forceQuotes: false }), 'utf8');
	return { ok: true };
}

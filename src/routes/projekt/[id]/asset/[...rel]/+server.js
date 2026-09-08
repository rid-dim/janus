import fs from 'node:fs';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { resolveInDir } from '$lib/server/config.js';
import { projectDir } from '$lib/server/projects.js';

/**
 * Bilder/Medien aus dem Projektordner ausliefern – z. B. `wissen/assets/…`,
 * eingebunden per Markdown-Bildsyntax (siehe imagePlugin in markdown.js).
 * Bewusst nur Medientypen: Markdown/YAML/Konfig bleiben außen vor.
 */
const TYPEN = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon'
};

export function GET({ params }) {
	const rel = params.rel || '';
	const ext = path.extname(rel).toLowerCase();
	const typ = TYPEN[ext];
	if (!typ) throw error(415, 'Kein unterstützter Medientyp: ' + rel);

	let file;
	try {
		file = resolveInDir(projectDir(params.id), decodeURIComponent(rel));
	} catch (e) {
		throw error(400, String(e?.message || e));
	}
	let stat;
	try {
		stat = fs.statSync(file);
	} catch {
		throw error(404, 'Datei nicht gefunden: ' + rel);
	}
	if (!stat.isFile()) throw error(404, 'Keine Datei: ' + rel);

	return new Response(fs.readFileSync(file), {
		headers: {
			'content-type': typ,
			'content-length': String(stat.size),
			// Lokale App: nicht cachen, damit ausgetauschte Bilder sofort sichtbar sind.
			'cache-control': 'no-cache'
		}
	});
}

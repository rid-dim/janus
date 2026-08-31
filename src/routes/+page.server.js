import { listProjects, registry } from '$lib/server/projects.js';
import { dataRoot, projectSubdir } from '$lib/server/config.js';
import { loadWissen, sucheWissen } from '$lib/server/wissen.js';

export function load({ url }) {
	// Globale Wiki-Suche: aggregiert über die wissen/-Ordner ALLER Projekte
	// (reine Aggregation, keine eigene globale Ablage).
	const q = url.searchParams.get('q') || '';
	const treffer = [];
	if (q.trim()) {
		for (const e of registry()) {
			for (const t of sucheWissen(loadWissen(e.dir), q)) {
				treffer.push({ ...t, projektId: e.id, projektTitel: e.manifest.titel });
			}
		}
		treffer.sort((a, b) => (b.inTitle ? 1 : 0) - (a.inTitle ? 1 : 0));
	}

	return {
		projects: listProjects(),
		dataRoot: dataRoot(),
		projectSubdir: projectSubdir(),
		q,
		treffer
	};
}

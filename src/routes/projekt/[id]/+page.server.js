import { error } from '@sveltejs/kit';
import { getProject, registry } from '$lib/server/projects.js';

export function load({ params, url }) {
	const project = getProject(params.id);
	if (!project) throw error(404, 'Projekt nicht gefunden: ' + params.id);

	// Lightweight list for the sidebar (no per-file aggregation needed here).
	const projects = registry()
		.map((e) => ({ id: e.id, titel: e.manifest.titel, status: e.manifest.status }))
		.sort((a, b) => a.titel.localeCompare(b.titel, 'de'));

	// Deep-Link aus der Zeitleiste: /projekt/<id>?knoten=<knoten-id>
	return { project, projects, knoten: url.searchParams.get('knoten') };
}

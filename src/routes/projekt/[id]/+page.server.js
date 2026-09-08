import { error } from '@sveltejs/kit';
import { getProject, sidebarProjects } from '$lib/server/projects.js';

export function load({ params, url }) {
	const project = getProject(params.id);
	if (!project) throw error(404, 'Projekt nicht gefunden: ' + params.id);

	// Lightweight list for the sidebar (no per-file aggregation needed here).
	const projects = sidebarProjects(project.id);

	// Deep-Link aus der Zeitleiste: /projekt/<id>?knoten=<knoten-id>
	return { project, projects, knoten: url.searchParams.get('knoten') };
}

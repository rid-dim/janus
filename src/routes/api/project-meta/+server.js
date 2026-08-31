import { json } from '@sveltejs/kit';
import { updateProjectMeta } from '$lib/server/edit.js';

// Update projekt.yaml: titel, status, beschreibung, tags, stand_reihenfolge.
export async function POST({ request }) {
	try {
		const { projectId, patch } = await request.json();
		if (typeof projectId !== 'string' || typeof patch !== 'object' || !patch) {
			return json({ ok: false, error: 'Ungültige Anfrage' }, { status: 400 });
		}
		const result = updateProjectMeta(projectId, patch);
		return json(result, { status: result.ok ? 200 : 409 });
	} catch (e) {
		return json({ ok: false, error: String(e?.message || e) }, { status: 400 });
	}
}

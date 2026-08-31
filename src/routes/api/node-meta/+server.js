import { json } from '@sveltejs/kit';
import { updateNodeMeta } from '$lib/server/edit.js';

// Update a geplant node's frontmatter: title, status and/or depends_on (edges).
export async function POST({ request }) {
	try {
		const { projectId, rel, patch } = await request.json();
		if (typeof projectId !== 'string' || typeof rel !== 'string' || typeof patch !== 'object' || !patch) {
			return json({ ok: false, error: 'Ungültige Anfrage' }, { status: 400 });
		}
		const result = updateNodeMeta(projectId, rel, patch);
		return json(result, { status: result.ok ? 200 : 409 });
	} catch (e) {
		return json({ ok: false, error: String(e?.message || e) }, { status: 400 });
	}
}

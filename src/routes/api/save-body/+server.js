import { json } from '@sveltejs/kit';
import { saveBody } from '$lib/server/edit.js';

// Overwrite the markdown body of a stand/ or geplant/ file (frontmatter kept).
export async function POST({ request }) {
	try {
		const { projectId, rel, body } = await request.json();
		if (typeof projectId !== 'string' || typeof rel !== 'string' || typeof body !== 'string') {
			return json({ ok: false, error: 'Ungültige Anfrage' }, { status: 400 });
		}
		const result = saveBody(projectId, rel, body);
		return json(result, { status: result.ok ? 200 : 409 });
	} catch (e) {
		return json({ ok: false, error: String(e?.message || e) }, { status: 400 });
	}
}

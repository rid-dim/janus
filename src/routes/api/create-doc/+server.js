import { json } from '@sveltejs/kit';
import { createDoc } from '$lib/server/edit.js';

// Create a new stand section or geplant node from a title.
export async function POST({ request }) {
	try {
		const { projectId, kind, title, slug } = await request.json();
		if (typeof projectId !== 'string') {
			return json({ ok: false, error: 'Ungültige Anfrage' }, { status: 400 });
		}
		const result = createDoc(projectId, kind, title, slug);
		return json(result, { status: result.ok ? 200 : 409 });
	} catch (e) {
		return json({ ok: false, error: String(e?.message || e) }, { status: 400 });
	}
}

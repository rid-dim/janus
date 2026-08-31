import { json } from '@sveltejs/kit';
import { deleteDoc } from '$lib/server/edit.js';

// Delete a stand/ or geplant/ file.
export async function POST({ request }) {
	try {
		const { projectId, rel } = await request.json();
		if (typeof projectId !== 'string' || typeof rel !== 'string') {
			return json({ ok: false, error: 'Ungültige Anfrage' }, { status: 400 });
		}
		const result = deleteDoc(projectId, rel);
		return json(result, { status: result.ok ? 200 : 409 });
	} catch (e) {
		return json({ ok: false, error: String(e?.message || e) }, { status: 400 });
	}
}

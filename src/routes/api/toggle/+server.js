import { json } from '@sveltejs/kit';
import { toggleTask } from '$lib/server/files.js';

export async function POST({ request }) {
	try {
		const { projectId, rel, taskIndex, checked } = await request.json();
		if (typeof projectId !== 'string' || typeof rel !== 'string' || typeof taskIndex !== 'number') {
			return json({ ok: false, error: 'Ungültige Anfrage' }, { status: 400 });
		}
		const result = toggleTask(projectId, rel, taskIndex, !!checked);
		return json(result, { status: result.ok ? 200 : 409 });
	} catch (e) {
		return json({ ok: false, error: String(e?.message || e) }, { status: 400 });
	}
}

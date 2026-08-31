import { json } from '@sveltejs/kit';
import { openTarget } from '$lib/server/files.js';

export async function POST({ request }) {
	try {
		const { projectId, target, kind } = await request.json();
		if (typeof target !== 'string') {
			return json({ ok: false, error: 'Kein Ziel angegeben' }, { status: 400 });
		}
		const result = openTarget({ projectId, target, kind });
		return json(result, { status: result.ok ? 200 : 404 });
	} catch (e) {
		return json({ ok: false, error: String(e?.message || e) }, { status: 400 });
	}
}

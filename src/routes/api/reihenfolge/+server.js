import { json } from '@sveltejs/kit';
import { setProjectOrder } from '$lib/server/config.js';

// Eigene Reihenfolge der Projektkacheln speichern (janus.config.json).
// Rein lokal – die Config ist gitignoriert, die Projektdaten bleiben unberührt.
//   POST { ids: ["projekt-a", "projekt-b", ...] }
export async function POST({ request }) {
	try {
		const { ids } = await request.json();
		if (!Array.isArray(ids)) {
			return json({ ok: false, error: 'ids muss eine Liste sein' }, { status: 400 });
		}
		return json({ ok: true, reihenfolge: setProjectOrder(ids) });
	} catch (e) {
		return json({ ok: false, error: String(e?.message || e) }, { status: 400 });
	}
}

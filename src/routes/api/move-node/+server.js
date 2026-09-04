import { json } from '@sveltejs/kit';
import { moveNode } from '$lib/server/edit.js';

// Einen Knoten ins Archiv (`abgeschlossen/`) verschieben oder von dort zurück
// nach `geplant/` holen. Body: { projectId, rel, ziel: 'abgeschlossen'|'geplant' }.
export async function POST({ request }) {
	try {
		const { projectId, rel, ziel } = await request.json();
		if (typeof projectId !== 'string' || typeof rel !== 'string' || typeof ziel !== 'string') {
			return json({ ok: false, error: 'Ungültige Anfrage' }, { status: 400 });
		}
		const result = moveNode(projectId, rel, ziel);
		return json(result, { status: result.ok ? 200 : 409 });
	} catch (e) {
		return json({ ok: false, error: String(e?.message || e) }, { status: 400 });
	}
}

import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { dataRoot } from '$lib/server/config.js';
import { scaffoldProject, slugify } from '$lib/server/scaffold.js';
import { registry } from '$lib/server/projects.js';

// Create a new project in the central store (dataRoot/<slug>).
export async function POST({ request }) {
	try {
		const { titel } = await request.json();
		if (typeof titel !== 'string' || !titel.trim()) {
			return json({ ok: false, error: 'Titel fehlt' }, { status: 400 });
		}
		const slug = slugify(titel);
		const dir = path.join(dataRoot(), slug);
		if (fs.existsSync(path.join(dir, 'projekt.yaml'))) {
			return json({ ok: false, error: 'Ein Projekt mit diesem Namen existiert bereits' }, { status: 409 });
		}
		fs.mkdirSync(dir, { recursive: true });
		scaffoldProject(dir, titel.trim());
		const entry = registry().find((p) => p.dir === dir);
		return json({ ok: true, id: entry?.id ?? slug });
	} catch (e) {
		return json({ ok: false, error: String(e?.message || e) }, { status: 400 });
	}
}

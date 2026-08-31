import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { expandPath, projectSubdir, addLinkedProject } from '$lib/server/config.js';
import { scaffoldProject } from '$lib/server/scaffold.js';
import { registry } from '$lib/server/projects.js';

// Link an existing repo/folder. Its Janus data lives in <path>/<projectSubdir>.
// Scaffolds that subfolder if it doesn't exist yet, then registers the path.
export async function POST({ request }) {
	try {
		let { path: inputPath, titel } = await request.json();
		if (typeof inputPath !== 'string' || !inputPath.trim()) {
			return json({ ok: false, error: 'Pfad fehlt' }, { status: 400 });
		}
		const repoPath = expandPath(inputPath.trim());
		if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
			return json({ ok: false, error: 'Ordner nicht gefunden: ' + repoPath }, { status: 404 });
		}
		const baseDir = path.join(repoPath, projectSubdir());
		const alreadyProject = fs.existsSync(path.join(baseDir, 'projekt.yaml'));
		if (!alreadyProject) {
			fs.mkdirSync(baseDir, { recursive: true });
			scaffoldProject(baseDir, (titel && titel.trim()) || path.basename(repoPath));
		}
		addLinkedProject(inputPath.trim());
		const entry = registry().find((p) => p.dir === baseDir);
		return json({ ok: true, id: entry?.id, created: !alreadyProject });
	} catch (e) {
		return json({ ok: false, error: String(e?.message || e) }, { status: 400 });
	}
}

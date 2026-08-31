import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { resolveInDir } from './config.js';
import { projectDir } from './projects.js';

const TASK_RE = /^(\s*[-*+]\s+\[)([ xX])(\]\s)/;

/**
 * Toggle the n-th task-list checkbox in a project markdown file, writing the
 * change back to disk line-precisely. Returns { ok, checked }.
 */
export function toggleTask(projectId, relPath, taskIndex, checked) {
	const dir = projectDir(projectId);
	const file = resolveInDir(dir, relPath);
	const text = fs.readFileSync(file, 'utf8');
	const eol = text.includes('\r\n') ? '\r\n' : '\n';
	const lines = text.split(/\r?\n/);

	let seen = -1;
	for (let i = 0; i < lines.length; i++) {
		if (!TASK_RE.test(lines[i])) continue;
		seen++;
		if (seen === taskIndex) {
			lines[i] = lines[i].replace(TASK_RE, `$1${checked ? 'x' : ' '}$3`);
			fs.writeFileSync(file, lines.join(eol), 'utf8');
			return { ok: true, checked };
		}
	}
	return { ok: false, error: 'Task-Index nicht gefunden' };
}

function expandHome(p) {
	if (p.startsWith('file://')) p = p.slice('file://'.length);
	if (p === '~' || p.startsWith('~/')) p = path.join(os.homedir(), p.slice(1));
	return p;
}

/** Launch a file in the OS default application. */
export function openTarget({ projectId, target, kind }) {
	let abs;
	if (kind === 'doc') {
		abs = resolveInDir(projectDir(projectId), target);
	} else {
		abs = expandHome(target);
	}
	if (!fs.existsSync(abs)) {
		return { ok: false, error: 'Datei nicht gefunden: ' + abs };
	}
	const platform = process.platform;
	const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
	const args = platform === 'win32' ? ['/c', 'start', '', abs] : [abs];
	try {
		const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
		child.unref();
		return { ok: true, path: abs };
	} catch (e) {
		return { ok: false, error: String(e) };
	}
}

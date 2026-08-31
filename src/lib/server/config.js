import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The app is meant to be run from its own project directory (npm run dev / start),
// so the working directory is the stable anchor for the config file and relative
// data paths. (Deriving this from import.meta.url breaks after bundling.)
export const APP_ROOT = process.cwd();
const CONFIG_PATH = path.join(APP_ROOT, 'janus.config.json');

export function readConfig() {
	try {
		return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
	} catch {
		return {};
	}
}

export function writeConfig(cfg) {
	fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, '\t') + '\n', 'utf8');
}

/** Expand "~" and resolve relative paths against the app root. */
export function expandPath(p) {
	if (!p) return p;
	if (p === '~' || p.startsWith('~/')) p = path.join(os.homedir(), p.slice(1));
	return path.isAbsolute(p) ? p : path.resolve(APP_ROOT, p);
}

/** Central store: a folder holding one subfolder per project. Optional. */
export function dataRoot() {
	const configured = process.env.JANUS_DATA_ROOT || readConfig().dataRoot || './projekte';
	return expandPath(configured);
}

/** Subfolder name used for in-repo tracking (default ".janus"). */
export function projectSubdir() {
	return readConfig().projectDir || '.janus';
}

/** Inverse of expandPath for display: home directory prefix back to "~". */
export function prettyPath(p) {
	if (!p) return p;
	const home = os.homedir();
	return p === home || p.startsWith(home + path.sep) ? '~' + p.slice(home.length) : p;
}

/** Absolute paths of linked repos (each holds its Janus data in projectSubdir()). */
export function linkedProjectPaths() {
	const list = readConfig().projects;
	if (!Array.isArray(list)) return [];
	return list.map(expandPath);
}

/** Register a linked repo path in janus.config.json (idempotent). */
export function addLinkedProject(inputPath) {
	const cfg = readConfig();
	if (!Array.isArray(cfg.projects)) cfg.projects = [];
	const norm = expandPath(inputPath);
	const already = cfg.projects.some((p) => expandPath(p) === norm);
	if (!already) {
		cfg.projects.push(inputPath);
		writeConfig(cfg);
	}
	return norm;
}

/**
 * Safely resolve a relative path inside a base directory.
 * Throws if the result would escape it (path-traversal guard).
 */
export function resolveInDir(baseDir, relPath = '.') {
	const target = path.resolve(baseDir, relPath);
	const rel = path.relative(baseDir, target);
	if (rel.startsWith('..') || path.isAbsolute(rel)) {
		throw new Error('Pfad liegt außerhalb des Projektordners: ' + relPath);
	}
	return target;
}

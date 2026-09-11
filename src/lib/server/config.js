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

/** Anzeigename des Menschen im Kanal (janus.config.json "mensch": "…").
 *  Rein kosmetisch – an ihn adressierte Nachrichten werden nie zugestellt.
 *  Vorgabe „mensch", damit kein Klarname im Code steht. */
export function menschName() {
	const n = readConfig().mensch;
	return typeof n === 'string' && n.trim() ? n.trim() : 'mensch';
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

/** Lokal ausgeblendete Projekt-IDs (janus.config.json "hidden": ["id", ...]).
 *  Die Config ist gitignoriert — Ausblenden ist rein lokal; Daten/Masterstand
 *  bleiben unberührt, Direkt-URLs und Wissens-Hub-Referenzen funktionieren weiter. */
export function hiddenProjectIds() {
	const list = readConfig().hidden;
	return Array.isArray(list) ? list.map(String) : [];
}

/** Agenten-Board an/aus (janus.config.json "agentenBoard": false).
 *
 *  Ohne Claude-Code-Hooks gibt es nichts zu melden – wer mit einem anderen
 *  Werkzeug arbeitet, soll kein totes Bedienfeld sehen. Vorgabe ist „an", das
 *  Board blendet sich bei leerem Zustand ohnehin selbst aus; dieser Schalter
 *  ist für den Fall, dass es dauerhaft weg sein soll. */
export function agentenBoardAn() {
	return readConfig().agentenBoard !== false;
}

/** Abbildung fremder Pfadwurzeln auf lokale (janus.config.json
 *  "pfadabbildung": { "C:\\": "/c/", "\\\\server\\share": "/mnt/share" }).
 *
 *  Wie ein Wirt fremde Laufwerke einhängt, weiß nur er – das ist Konfiguration,
 *  keine Regel. Die eingebaute Normierung deckt den Normalfall (Laufwerks-
 *  buchstabe, /mnt/) ab; hier steht, was darüber hinausgeht. */
export function pfadAbbildung() {
	const m = readConfig().pfadabbildung;
	return m && typeof m === 'object' ? m : {};
}

/** Einmal vergebene Projektfarben (janus.config.json "farben": {id: ton}).
 *  Automatisch gefüllt, nicht von Hand zu pflegen – festgehalten wird nur,
 *  damit eine Farbe sich nicht ändert, wenn ein Projekt dazukommt. */
export function projectColors() {
	const f = readConfig().farben;
	return f && typeof f === 'object' ? f : {};
}

/** Neu vergebene Farben ergänzen (bestehende bleiben unangetastet). */
export function mergeProjectColors(neu) {
	const cfg = readConfig();
	const vorher = cfg.farben && typeof cfg.farben === 'object' ? cfg.farben : {};
	let geaendert = false;
	for (const [id, ton] of Object.entries(neu)) {
		if (vorher[id] !== ton) {
			vorher[id] = ton;
			geaendert = true;
		}
	}
	if (geaendert) {
		cfg.farben = vorher;
		writeConfig(cfg);
	}
	return vorher;
}

/** Eigene Reihenfolge der Projekte (janus.config.json "reihenfolge": ["id", ...]).
 *  Wie `hidden` rein lokal: die Config ist gitignoriert. Wichtiges nach oben,
 *  Unwichtiges nach unten – nicht genannte Projekte hängen hinten an. */
export function projectOrder() {
	const list = readConfig().reihenfolge;
	return Array.isArray(list) ? list.map(String) : [];
}

/** Reihenfolge speichern (nur bekannte IDs, ohne Dubletten). */
export function setProjectOrder(ids) {
	const cfg = readConfig();
	cfg.reihenfolge = [...new Set((Array.isArray(ids) ? ids : []).map(String))];
	writeConfig(cfg);
	return cfg.reihenfolge;
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

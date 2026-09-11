import { listProjects, registry, collectDeadlines } from '$lib/server/projects.js';
import { dataRoot, projectSubdir, hiddenProjectIds, agentenBoardAn } from '$lib/server/config.js';
import { loadWissen, sucheWissen } from '$lib/server/wissen.js';
import { ladeAgenten } from '$lib/server/agenten.js';
import { sammleWarten } from '$lib/server/warten.js';
import { ansicht } from '$lib/server/kanal.js';
import { ttlMs } from '$lib/server/fluechtig.js';

export function load({ url }) {
	const reg = registry();
	const hidden = new Set(hiddenProjectIds());
	// Ohne Claude-Code-Hooks meldet sich niemand. Dann soll das Board auch
	// nicht als leeres Bedienfeld dastehen: es erscheint, sobald es etwas zu
	// zeigen hat, und verschwindet sonst. Janus bleibt ein Projekt-Tracker.
	const boardAn = agentenBoardAn();
	const agenten = boardAn ? ladeAgenten(reg, hidden) : [];
	const deadlines = collectDeadlines();
	const kanal = boardAn ? ansicht(reg, agenten) : { nachrichten: [], namen: [] };

	// Globale Wiki-Suche: aggregiert über die wissen/-Ordner ALLER Projekte
	// (reine Aggregation, keine eigene globale Ablage).
	const q = url.searchParams.get('q') || '';
	const treffer = [];
	if (q.trim()) {
		for (const e of reg) {
			for (const t of sucheWissen(loadWissen(e.dir), q)) {
				treffer.push({ ...t, projektId: e.id, projektTitel: e.manifest.titel });
			}
		}
		treffer.sort((a, b) => (b.inTitle ? 1 : 0) - (a.inTitle ? 1 : 0));
	}

	return {
		projects: listProjects(),
		deadlines,
		wiedervorlagen: deadlines.wiedervorlagen ?? [],
		// Agenten-Board: Prozess-Warten aus den Hook-Meldungen, sachliches
		// Warten aus den @wartet-Markern. Zwei Quellen, bewusst getrennt.
		// Farbe je Agent, damit die Zeile zur Kachel und zur Nachricht passt
		agenten: agenten.map((a) => ({
			...a,
			farbe: reg.find((p) => p.id === a.projektId)?.manifest.farbe ?? null
		})),
		warten: sammleWarten(reg, hidden),
		// Das Kanal-Fenster gehört aufs Dashboard: es ist der Blick darauf,
		// was gerade läuft – genau die Frage, mit der man hier landet.
		kanal,
		boardAktiv: boardAn && (agenten.length > 0 || kanal.nachrichten.length > 0),
		ttlMinuten: Math.round(ttlMs() / 60000),
		dataRoot: dataRoot(),
		projectSubdir: projectSubdir(),
		q,
		treffer
	};
}

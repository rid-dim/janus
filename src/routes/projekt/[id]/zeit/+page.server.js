import { error } from '@sveltejs/kit';
import { getProject, registry } from '$lib/server/projects.js';
import { parseChronik } from '$lib/server/chronik.js';
import { tageZwischen, minIso, maxIso } from '$lib/zeit.js';

/** Heutiges Datum als ISO-String (lokale Zeit des Servers). */
function heuteIso() {
	const d = new Date();
	const p = (n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Die Chronik-Datei eines Projekts finden (Dateiname, sonst erste `pin: right`). */
function findeChronik(stand = []) {
	return (
		stand.find((s) => /chronik/i.test(s.id)) ??
		stand.find((s) => /chronik|log|verlauf/i.test(s.title)) ??
		stand.find((s) => s.pin === 'right') ??
		null
	);
}

const LANGLAEUFER_TAGE = 90;

/**
 * Knoten (geplant + archiviert) in Gantt-Zeilen übersetzen.
 * Balken von `start` bis `ende`; fehlt `ende`, läuft der Balken bis heute –
 * bei fertigen Themen als "Ende unbekannt" markiert, aber fertig eingefärbt.
 */
function bauGantt(knoten, heute) {
	const mit = [];
	const ohne = [];
	for (const n of knoten) {
		const basis = {
			id: n.id,
			rel: n.rel,
			title: n.title,
			status: n.status,
			tasks: n.tasks,
			archiviert: Boolean(n.archiviert)
		};
		if (!n.start) {
			ohne.push(basis);
			continue;
		}
		const fertig = n.status === 'fertig' || n.archiviert;
		const bisDatum = n.ende ?? heute;
		const tage = Math.max(tageZwischen(n.start, heute), 0);
		mit.push({
			...basis,
			start: n.start,
			ende: n.ende,
			bisDatum,
			endeUnbekannt: !n.ende,
			dauer: n.ende ? Math.max(tageZwischen(n.start, n.ende), 0) : null,
			tage,
			langlaeufer: !fertig && tage > LANGLAEUFER_TAGE
		});
	}
	mit.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.title.localeCompare(b.title, 'de')));
	ohne.sort((a, b) => a.title.localeCompare(b.title, 'de'));
	return { mit, ohne };
}

export function load({ params }) {
	const project = getProject(params.id);
	if (!project) throw error(404, 'Projekt nicht gefunden: ' + params.id);

	const heute = heuteIso();
	const chronikDoc = findeChronik(project.stand);
	const chronik = chronikDoc
		? { titel: chronikDoc.title, rel: chronikDoc.rel, ...parseChronik(chronikDoc.body, heute) }
		: { titel: null, rel: null, eintraege: [], von: null, bis: null, zaehler: {} };

	const alleKnoten = [...project.geplant.nodes, ...(project.abgeschlossen ?? [])];
	const { mit, ohne } = bauGantt(alleKnoten, heute);

	// Gemeinsame Zeitachse für Streifen und Gantt – so liegen beide übereinander.
	const von = minIso(chronik.von, ...mit.map((t) => t.start)) ?? heute;
	const bis = maxIso(heute, chronik.bis, ...mit.map((t) => t.bisDatum)) ?? heute;

	return {
		projekt: {
			id: project.id,
			titel: project.titel,
			status: project.status,
			tags: project.tags,
			location: project.location,
			source: project.source
		},
		projects: registry()
			.map((e) => ({ id: e.id, titel: e.manifest.titel, status: e.manifest.status }))
			.sort((a, b) => a.titel.localeCompare(b.titel, 'de')),
		heute,
		von,
		bis,
		chronik,
		themen: mit,
		ohneZeitraum: ohne
	};
}

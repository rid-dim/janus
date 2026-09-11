/**
 * Projektfarben – damit auf einen Blick erkennbar ist, wer spricht.
 *
 * Die Farbe wird aus der Projekt-ID abgeleitet: ohne Konfiguration, für jedes
 * Projekt sofort da, und über Neustarts wie über Maschinen hinweg gleich. Wer
 * eine bestimmte Farbe will, setzt `farbe:` in `projekt.yaml`.
 *
 * Weitergereicht wird nur der **Farbton** (0–359), nicht eine fertige Farbe:
 * Sättigung und Helligkeit setzt das Stylesheet je nach hellem oder dunklem
 * Thema. Eine fest verdrahtete Farbe wäre in einem der beiden Themen
 * unlesbar.
 */

/**
 * 14 gut unterscheidbare Farbtöne. Der gelbgrüne Bereich um 70–90° ist
 * ausgespart – dort liegen Töne, die sich auf hellem Grund kaum abheben.
 */
const TOENE = [210, 28, 152, 330, 258, 46, 190, 300, 14, 172, 276, 96, 236, 350];

function hash(s) {
	let h = 5381;
	for (let i = 0; i < String(s).length; i++) h = ((h << 5) + h + String(s).charCodeAt(i)) | 0;
	return Math.abs(h);
}

/**
 * Farbton eines Projekts. `override` ist der Wert aus `projekt.yaml`:
 * entweder eine Zahl (0–359) oder ein Name aus der Liste unten.
 */
const NAMEN = {
	blau: 210,
	orange: 28,
	gruen: 152,
	grün: 152,
	pink: 330,
	lila: 276,
	violett: 258,
	gelb: 46,
	tuerkis: 190,
	türkis: 190,
	magenta: 300,
	rot: 14,
	mint: 172,
	oliv: 96,
	indigo: 236
};

export function farbtonFuer(id, override) {
	if (override !== undefined && override !== null && override !== '') {
		const n = Number(override);
		if (Number.isFinite(n)) return ((n % 360) + 360) % 360;
		const treffer = NAMEN[String(override).trim().toLowerCase()];
		if (treffer !== undefined) return treffer;
	}
	return TOENE[hash(id) % TOENE.length];
}

/** Alle benennbaren Farben – für Doku und spätere Auswahl. */
export const FARBNAMEN = Object.keys(NAMEN);

/**
 * Farbtöne über eine Menge von Projekten verteilen – **kollisionsfrei**.
 *
 * Ein reiner Hash reicht nicht: bei 14 Tönen und acht Projekten kollidieren
 * zwei mit gut 90 % Wahrscheinlichkeit (Geburtstagsproblem), und zwei gleich
 * eingefärbte Projekte sind schlimmer als eine unerwartete Farbe.
 *
 * Vorgehen: ausdrücklich gesetzte Farben gewinnen, danach bekommt jedes
 * Projekt seinen Wunschton, und wo der belegt ist, den nächsten freien.
 * Deterministisch für eine gegebene Projektmenge; kommt ein Projekt hinzu,
 * kann sich höchstens eine abgeleitete Farbe verschieben.
 */
export function verteileFarben(projekte, gemerkt = {}) {
	const zu = new Map();
	const belegt = new Set();

	// 0. Schon einmal vergebene Farben gelten weiter. Das ist der Unterschied
	//    zwischen "automatisch" und "automatisch und stabil": ohne dieses
	//    Gedächtnis könnte ein neu hinzugekommenes Projekt einem bestehenden
	//    die Farbe wegnehmen, und Wiedererkennen ist der ganze Zweck.
	for (const p of projekte) {
		if (p.farbe !== undefined && p.farbe !== null && p.farbe !== '') continue;
		const alt = gemerkt[p.id];
		if (typeof alt === 'number') {
			zu.set(p.id, alt);
			belegt.add(alt);
		}
	}

	// 1. Ausdrücklich gewünschte Farben – sie sind gesetzt, nicht geraten.
	for (const p of projekte) {
		if (p.farbe === undefined || p.farbe === null || p.farbe === '') continue;
		const t = farbtonFuer(p.id, p.farbe);
		zu.set(p.id, t);
		belegt.add(t);
	}

	// 2. Der Rest in stabiler Reihenfolge, damit das Ergebnis reproduzierbar ist.
	// 2. Nur noch die wirklich neuen Projekte.
	const rest = projekte.filter((p) => !zu.has(p.id)).sort((a, b) => String(a.id).localeCompare(String(b.id)));
	for (const p of rest) {
		const wunsch = farbtonFuer(p.id);
		let t = wunsch;
		if (belegt.has(t)) {
			const start = TOENE.indexOf(wunsch);
			for (let i = 1; i <= TOENE.length; i++) {
				const kandidat = TOENE[(start + i) % TOENE.length];
				if (!belegt.has(kandidat)) {
					t = kandidat;
					break;
				}
			}
			// Mehr Projekte als Töne: dann teilen sich zwei eben eine Farbe.
		}
		zu.set(p.id, t);
		belegt.add(t);
	}
	return zu;
}

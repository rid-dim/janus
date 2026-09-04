import fs from 'node:fs';
import path from 'node:path';

export function slugify(s) {
	return (
		String(s || '')
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/ä/g, 'ae')
			.replace(/ö/g, 'oe')
			.replace(/ü/g, 'ue')
			.replace(/ß/g, 'ss')
			.replace(/[^\w]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'projekt'
	);
}

function writeIfMissing(file, content) {
	if (fs.existsSync(file)) return;
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content, 'utf8');
}

const AGENTS = `# Hinweise für Coding-Agents (Claude Code / Codex)

Dieses Verzeichnis ist ein **Janus-Projekt**. Bearbeite den Projektstand direkt
als Dateien – die Janus-App zeigt Änderungen beim nächsten Laden an.

- \`projekt.yaml\` – Metadaten (schemaVersion nicht ohne Migration ändern).
- \`stand/*.md\` – aktueller Stand, ein Markdown pro Thema. \`pin: right\` im
  Frontmatter heftet die Datei als rechte Seitenleiste an die Projektseite;
  mehrere gepinnte Dateien erscheinen dort als Tabs.
- \`geplant/*.md\` – ein DAG-Knoten pro Datei. Frontmatter: \`id\`, \`title\`,
  \`status\` (offen | in-arbeit | fertig), \`depends_on: [id, ...]\`, optional
  \`start:\` / \`ende:\` (JJJJ-MM-TT – speist den Themen-Gantt der Zeitleiste).
  Body: \`## Checkpoints\` mit \`- [ ]\` / \`- [x]\`.
- \`wissen/*.md\` – Wissensbasis/Wiki (Referenz, veraltet nicht mit dem
  Projekt). Slug = Pfad ohne .md, Unterordner erlaubt. Verlinken mit
  \`[[slug]]\` / \`[[slug|Text]]\` – geht in allen Markdown-Dateien des
  Projekts; Links auf fehlende Seiten sind erwünschte Rotlinks. Optionales
  Frontmatter \`geprueft: JJJJ-MM-TT\` = zuletzt inhaltlich bestätigt;
  beim Re-Verifizieren einer Seite den Stempel aktualisieren.
- \`abgeschlossen/*.md\` – Archiv: beendete Knoten mit \`status: fertig\` +
  \`ende:\` hierher **verschieben** (gleiches Format; in der UI macht das der
  Button „✓ Abschließen" am Knoten). Sie verschwinden aus dem
  aktiven Graph und erscheinen gedimmt in der Sektion „Abgeschlossen" sowie im
  Gantt der Zeitleiste.
- \`stand/termine.md\` mit \`typ: termine\` – Wiedervorlagen. Abschnitte \`## Sofort\`
  (optional), \`## Termine\`, \`## Ohne Datum\`, \`## Referenz-Fristen\`. Regeln:
  Datum absolut und fett am Zeilenanfang (\`- **04.09.2026** — …\`, auch
  \`**~Mitte September**\`, \`**Oktober/November 2026**\`, \`**Q1 2027**\`, nie
  „nächste Woche“). Reihenfolge egal, Neues oben anhängen – Janus sortiert.
  Erledigtes durchstreichen und „erledigt TT.MM.“ anfügen, nicht löschen
  (älter als 30 Tage darf raus). **Sessionstart:** heutiges Datum nennen,
  dann Überfälliges und alles bis heute + 7 Tage aus dieser Datei aufzählen.
- \`anhaenge/\` – lokaler Document Store.

Fortschritt = Checkpoints abhaken, nicht Prosa umschreiben. Kleine, zeilengenaue
Diffs bevorzugen. Charts: \`plotly\`-Block mit Plotly-JSON. Doc-Links:
\`doc:anhaenge/datei.pdf\` oder absoluter Pfad; bei Leerzeichen im Pfad das
Ziel in spitze Klammern setzen: \`[Doku](<doc:anhaenge/Mein Dokument.pdf>)\`.
Eine Datei \`stand/chronik.md\`
(Einträge \`- **TT.MM.** ⚖️/⚡/✉️ Text\` unter \`## Monat Jahr\`) speist den
Aktivitätsstreifen der Zeitleisten-Ansicht (\`/projekt/<id>/zeit\`).
`;

/**
 * Create a Janus project skeleton in `dir` (idempotent – never overwrites).
 * Returns true if the directory now contains a valid project.
 */
export function scaffoldProject(dir, titel) {
	const name = titel || path.basename(dir);
	writeIfMissing(
		path.join(dir, 'projekt.yaml'),
		`schemaVersion: 1\n` +
			`titel: ${name}\n` +
			`status: in-arbeit\n` +
			`beschreibung: ""\n` +
			`tags: []\n` +
			`stand_reihenfolge:\n  - 00-ueberblick\n`
	);
	writeIfMissing(
		path.join(dir, 'stand', '00-ueberblick.md'),
		`## Überblick\n\nKurzbeschreibung von **${name}** – wofür ist das Projekt da, wo steht es?\n`
	);
	writeIfMissing(
		path.join(dir, 'geplant', 'erste-schritte.md'),
		`---\nid: erste-schritte\ntitle: Erste Schritte\nstatus: in-arbeit\ndepends_on: []\n---\n\n## Checkpoints\n\n- [ ] Ziel festhalten\n- [ ] Nächsten konkreten Schritt definieren\n`
	);
	writeIfMissing(path.join(dir, 'anhaenge', '.gitkeep'), '');
	writeIfMissing(path.join(dir, 'AGENTS.md'), AGENTS);
	return fs.existsSync(path.join(dir, 'projekt.yaml'));
}

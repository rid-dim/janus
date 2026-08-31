# Hinweise für Coding-Agents (Claude Code / Codex)

Dieses Verzeichnis ist ein **Janus-Projekt**. Bearbeite den Projektstand direkt
als Dateien – die Janus-App zeigt Änderungen beim nächsten Laden an.

- `projekt.yaml` – Metadaten (schemaVersion nicht ohne Migration ändern).
- `stand/*.md` – aktueller Stand, ein Markdown pro Thema. `pin: right` im
  Frontmatter heftet die Datei als rechte Seitenleiste an die Projektseite;
  mehrere gepinnte Dateien erscheinen dort als Tabs.
- `geplant/*.md` – ein DAG-Knoten pro Datei. Frontmatter: `id`, `title`,
  `status` (offen | in-arbeit | fertig), `depends_on: [id, ...]`, optional
  `start:` / `ende:` (JJJJ-MM-TT – speist den Themen-Gantt der Zeitleiste).
  Body: `## Checkpoints` mit `- [ ]` / `- [x]`.
- `abgeschlossen/*.md` – Archiv: beendete Knoten mit `status: fertig` +
  `ende:` hierher **verschieben** (gleiches Format). Sie verschwinden aus dem
  aktiven Graph und erscheinen gedimmt in der Sektion „Abgeschlossen" sowie im
  Gantt der Zeitleiste.
- `anhaenge/` – lokaler Document Store.

Fortschritt = Checkpoints abhaken, nicht Prosa umschreiben. Kleine, zeilengenaue
Diffs bevorzugen. Charts: `plotly`-Block mit Plotly-JSON. Doc-Links:
`doc:anhaenge/datei.pdf` oder absoluter Pfad. Eine Datei `stand/chronik.md`
(Einträge `- **TT.MM.** ⚖️/⚡/✉️ Text` unter `## Monat Jahr`) speist den
Aktivitätsstreifen der Zeitleisten-Ansicht (`/projekt/<id>/zeit`).

# Projektformat

Ein Projekt ist ein Ordner mit einer `projekt.yaml`. Janus findet Projekte aus
zwei Quellen (`janus.config.json`):

```json
{
  "dataRoot": "~/projekte",                    // zentraler Store: 1 Unterordner pro Projekt
  "projects": ["~/dev/repo-a", "~/dev/repo-b"], // verlinkte Repos (In-Repo-Tracking)
  "projectDir": ".janus"                        // Unterordnername im Repo (Standard: .janus)
}
```

- **Zentraler Store:** jeder Unterordner von `dataRoot` mit `projekt.yaml`.
- **Verlinkte Repos:** für jeden Pfad in `projects` der Unterordner
  `<pfad>/<projectDir>/` (z. B. `~/dev/repo-a/.janus/`). So wird der Stand mit
  dem Repo versioniert und synchronisiert.

Die Projekt-`id` (in der URL `/projekt/<id>`) ist das Frontmatter-`id` bzw. der
Ordnername; bei Namensgleichheit hängt Janus einen kurzen Hash an.

## Ordneraufbau eines Projekts

```
<dataRoot>/
  <projekt-id>/
    projekt.yaml
    stand/          *.md   – aktueller Stand (ein Thema pro Datei)
    wissen/         *.md   – Wissensbasis/Wiki (Referenz-Seiten, Unterordner erlaubt)
    geplant/        *.md   – geplante Schritte (ein DAG-Knoten pro Datei)
    abgeschlossen/  *.md   – Archiv beendeter Knoten (optional, gleiches Format)
    anhaenge/              – lokaler Document Store (beliebige Dateien)
    AGENTS.md              – optionale Hinweise für Coding-Agents
```

Die Ordnername ist die `projekt-id` (in der URL: `/projekt/<projekt-id>`).

## projekt.yaml

```yaml
schemaVersion: 2            # für spätere Migrationen (2 = mit wissen/-Wiki)
titel: Mein Projekt
status: in-arbeit           # aktiv | in-arbeit | fertig | ...
beschreibung: Einzeiler fürs Dashboard.
tags: [tooling, kunde-x]
stand_reihenfolge:          # optional: Reihenfolge der stand/-Sektionen
  - 00-ueberblick
  - architektur
wissen_hubs: [cnc-wissen]   # optional: Projekt-IDs als Wissens-Hubs (s. u.)
```

## stand/\*.md

Freies Markdown, ein Thema pro Datei. Optionales Frontmatter `title:` (sonst
wird der Titel aus dem Dateinamen abgeleitet). Erlaubt sind Task-Lists,
`plotly`-Blöcke und Dokument-Links (siehe unten).

`pin: right` heftet eine Datei als rechte Seitenleiste an die Projektseite.
Sind **mehrere** Dateien gepinnt, erscheinen sie dort als Tabs (Beschriftung =
`title`); die zuletzt gewählte Datei merkt sich der Browser pro Projekt.

## wissen/\*.md – die Wissensbasis (Wiki)

Referenz-Seiten, die nicht mit dem Projektfortschritt veralten, sondern
wachsen — gerendert in der **Wiki-Linse** (`/projekt/<id>/wiki`) mit
Seitenbaum, Backlinks und Suche. Unterordner sind erlaubt und werden im Baum
zu Gruppen (`wissen/werkstoffe/alu-6061.md`).

- **Identität = Dateiname**: der Slug ist der Pfad unter `wissen/` ohne `.md`
  (z. B. `werkstoffe/alu-6061`). Frontmatter `title:` liefert den Anzeigenamen.
- **Wikilinks**: `[[slug]]`, `[[unterordner/slug]]` oder `[[slug|Linktext]]` –
  funktionieren in *allen* Markdown-Dateien des Projekts (auch `stand/` und
  `geplant/`) und zeigen immer auf `wissen/`-Seiten. Ein Link auf eine noch
  fehlende Seite wird als **Rotlink** gerendert; Klick legt die Seite an.
  Rotlinks sind Feature, nicht Fehler: sie markieren Schreib-Bedarf.
- **Aktualität**: optionales Frontmatter `geprueft: JJJJ-MM-TT` („zuletzt
  inhaltlich bestätigt am"). Seiten mit altem oder fehlendem Stempel listet
  die Pflege-Sektion der Wiki-Sidebar — zusammen mit Rotlinks und Seiten
  ohne eingehende Links.
- Projekte mit `wissen/` verwenden `schemaVersion: 2` (die Migration von 1
  ist trivial: Ordner anlegen, Referenz-Seiten bei Bedarf aus `stand/`
  verschieben).

### Wissens-Hubs (geteiltes Wissen)

Eine Wissensbasis, die mehreren Projekten dient, **ist selbst ein
Janus-Projekt** (ggf. fast nur `wissen/`). Andere Projekte binden sie als
reine **Lese-Referenz** ein — nichts wird kopiert:

```yaml
wissen_hubs: [cnc-wissen, firmen-wissen]   # Projekt-IDs, Reihenfolge zählt
```

- Die Wiki-Linse blendet Hub-Seitenbäume read-only unter „aus <Hub>" ein;
  bearbeitet wird immer im Hub-Projekt selbst.
- `[[slug]]` löst **erst lokal, dann in den Hubs** auf (Deklarations-
  Reihenfolge); `[[hub-id/slug]]` adressiert einen Hub explizit. Erst wenn
  nichts trifft, ist es ein Rotlink (angelegt würde lokal).
- Backlinks sind projektübergreifend: eine Hub-Seite zeigt auch, welche
  anderen Projekte auf sie verweisen.
- Trägt eine lokale Seite denselben Slug wie eine Hub-Seite, gewinnt lokal;
  die Pflege-Sektion warnt vor der Kollision.
- Hub-von-Hub wird bewusst **nicht** transitiv aufgelöst.

## geplant/\*.md – die DAG-Knoten

Ein Knoten pro Datei. Die Kanten des Graphen entstehen aus `depends_on`.

```markdown
---
id: release-v1
title: Release v1
status: offen                       # offen | in-arbeit | fertig
depends_on: [markdown-plotly, dag-ansicht, checkbox-writeback]
start: 2026-05-01                   # optional – nur für die Zeitleiste
ende: 2026-06-30                    # optional – fehlt = läuft bis heute
---

## Checkpoints
- [ ] Punkt A
- [x] Punkt B
```

- `depends_on` darf sich **verzweigen** (mehrere Knoten hängen an einem) und
  wieder **zusammenlaufen** (ein Knoten hängt an mehreren) – daher DAG, nicht Baum.
- Fehlt `id`, wird der Dateiname (ohne `.md`) verwendet.
- Der Fortschritt eines Knotens = abgehakte / gesamte Checkpoints im Body.
- `start:` / `ende:` sind optional (`JJJJ-MM-TT`, auch `TT.MM.JJJJ`) und speisen
  den Themen-Gantt der Zeitleisten-Ansicht.

## abgeschlossen/\*.md – das Archiv

Gleiches Format wie `geplant/`. Beendete Themen werden **von Hand** dorthin
verschoben (die App verschiebt nichts, sie liest nur). Der Ordner darf fehlen.

- Archivierte Knoten erscheinen **nicht** im aktiven DAG, sondern in einer
  eingeklappten Sektion „Abgeschlossen (n)" darunter.
- Zeigt ein `geplant`-Knoten per `depends_on` auf einen archivierten Knoten,
  gilt die Abhängigkeit als erfüllt: keine Kante, kein Fehler; der Eintrag
  bleibt beim Speichern erhalten.
- Ohne `status:` gilt ein archivierter Knoten als `fertig`.

## Zeitleisten-Ansicht (`/projekt/<id>/zeit`)

Zwei Bänder auf gemeinsamer Zeitachse:

1. **Aktivitätsstreifen** aus `stand/chronik.md` – Listeneinträge der Form
   `- **21.08.** ⚡ Text`, Jahr aus der Abschnittsüberschrift (`## August 2026`,
   `## Bis Juli 2026`, `## … (Dez 2025 – Apr 2026)`). Erkannt werden `21.08.`,
   `20./21.08.` (erster Tag), `~17.08.` (circa), `23.12.25`. Kategorie = erstes
   Emoji: ⚖️ Entscheidung · ⚡ Vorfall · ✉️ Korrespondenz.
2. **Themen-Gantt** aus `geplant/` + `abgeschlossen/` (nur Knoten mit `start:`).

## Sonderelemente im Markdown

**Charts** – eingezäunter Block, Sprache `plotly` (oder `chart`), Inhalt = eine
Plotly-Figur (`{ "data": [...], "layout": {...} }`):

    ```plotly
    { "data": [{ "type": "bar", "x": ["A","B"], "y": [3,7] }], "layout": {} }
    ```

**Dokument-Links** – öffnen auf der Platte im Standardprogramm:

- `[Anhang](doc:anhaenge/bericht.pdf)` – projekt-relativ (Traversal wird geblockt)
- `[Extern](/Users/ich/Dokumente/x.pdf)` – absoluter Pfad (auch `~/...`)

**Checkpoints** – GitHub-Task-Lists `- [ ]` / `- [x]`. Abhaken in der UI
schreibt genau diese eine Zeile zurück.

## Migration

`schemaVersion` in `projekt.yaml` markiert die Struktur-Version. Bei einer
Format-Änderung erhöht ein kleines Migrations-Skript die Ordner von `N` auf
`N+1`. Da alles reine Dateien sind, sind solche Migrationen einfach und testbar.

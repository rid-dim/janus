---
title: Wiki-Konzept
---

# Konzept: Wiki-Linse & Wissens-Hubs

Stand 30.08.2026, Entwurf. Ziel: Janus-Projekte können eine **Wissensbasis**
aufbauen, die (a) als echtes Wiki navigierbar ist und (b) von mehreren
Projekten geteilt werden kann — ohne die Janus-Grundidee zu verletzen:
*alles ist Markdown auf der Platte, die App ist nur die Ansicht darauf.*

## Motivation

Ein CNC-Projekt sammelt Wissen (Maschine, CAM-Workflow, Eloxieren,
Schnittdaten …), das drei Eigenschaften hat, die `stand/` nicht abbildet:

1. Es ist **Referenz**, kein Projektzustand — es veraltet nicht mit dem
   Projektfortschritt, sondern wächst.
2. Es will **vernetzt** sein (Querverweise, Backlinks), nicht sequenziell
   gelesen werden.
3. Es ist **projektübergreifend** nützlich (ein künftiges Fräs-Projekt oder
   eine zweite Maschine braucht dieselben Seiten).

## Entscheidung 1: eigener Ordner `wissen/`

Neuer Ordner pro Projekt, gleichberechtigt neben `stand/`:

```
<projekt>/
  projekt.yaml
  stand/     – veränderlicher Projektzustand (wie bisher)
  wissen/    – wachsende Referenz, beliebig verschachtelbar
  geplant/ | abgeschlossen/ | anhaenge/
```

- **Warum nicht in `stand/`?** Semantik trennen: `stand` beantwortet „wo
  stehen wir?", `wissen` beantwortet „was wissen wir?". Die Projektseite
  bleibt schlank, das Wiki darf groß werden.
- Unterordner sind erlaubt und werden im Wiki-Baum zu Gruppen
  (`wissen/werkstoffe/alu-6061.md`).
- `schemaVersion: 2`; Migration 1→2 ist trivial (Ordner anlegen; optional
  bestehende Referenz-Seiten aus `stand/` verschieben — manuell, kein
  Automatismus).

## Entscheidung 2: Wikilinks `[[...]]`

Neues Inline-Element im Markdown-Renderer (`lib/server/markdown.js`):

- `[[eloxieren]]` → Link auf die Wissens-Seite mit Slug `eloxieren`
- `[[eloxieren|beim Anodisieren]]` → eigener Linktext
- `[[cnc-wissen/eloxieren]]` → projektübergreifend (siehe Hubs)
- Auflösung: Slug = Dateiname ohne `.md` (kebab-case), Anzeigename =
  Frontmatter-`title`. **Der Dateiname ist die Identität** — bewusst simpel,
  wie bei Obsidian/Gollum. Eindeutigkeit pro Projekt genügt.
- **Rotlinks:** zeigt ein `[[slug]]` ins Leere, wird er rot gerendert;
  Klick legt `wissen/<slug>.md` an (API `create-doc` existiert schon) und
  öffnet den Editor. Rotlinks sind Feature, nicht Fehler: sie markieren
  Schreib-Bedarf.
- Wikilinks funktionieren überall (auch in `stand/` und `geplant/`-Knoten),
  zeigen aber immer auf `wissen/`-Seiten.

## Entscheidung 3: Wiki-Linse als eigene Route

`/projekt/<id>/wiki[/<slug>]` — dritte Ansicht neben Stand und Zeit:

- **Sidebar:** Seitenbaum aus der Ordnerstruktur von `wissen/`, alphabetisch,
  Ordner auf-/zuklappbar; darüber ein Suchfeld (Volltext, serverseitig
  simpel: Titel + Body greppen, kein Index-Overhead).
- **Hauptbereich:** gerenderte Seite (bestehende Markdown-Pipeline inkl.
  Plotly/Checkpoints/doc:-Links), Titel aus Frontmatter.
- **Backlinks:** unter jeder Seite „Verwiesen von …" — beim Laden des
  Projekts wird einmal die Linkkarte aller `[[...]]` aufgebaut (bei
  dateibasiertem Lesen sowieso alles im Speicher).
- **Verwaiste Seiten & offene Rotlinks** als kleine Pflege-Sektion in der
  Sidebar — das ersetzt eine „Wanted Pages"-Wiki-Funktion.
- Editieren wie gehabt über den bestehenden MarkdownEditor + `save-body`.

## Entscheidung 4: geteiltes Wissen über **Hubs** (Modell „Wissensbasis = Projekt")

Kein globaler Namespace, kein Kopieren. Eine Wissensbasis, die mehreren
Projekten dient, **ist selbst ein Janus-Projekt** (eigener Ordner/Repo,
eigenes Git, ggf. fast nur `wissen/`).

Anbindung in `projekt.yaml` des nutzenden Projekts:

```yaml
wissen_hubs: [cnc-wissen]        # Projekt-IDs
```

Wirkung in der Wiki-Linse des Projekts:

- Hub-Seitenbäume erscheinen **read-only eingeblendet** unter einer eigenen
  Gruppe („aus cnc-wissen"), klar abgesetzt; Bearbeiten-Klick springt in die
  Wiki-Linse des Hub-Projekts.
- `[[eloxieren]]` löst zuerst lokal auf, dann in den Hubs (Reihenfolge wie
  deklariert). Explizit geht immer `[[cnc-wissen/eloxieren]]`.
- Backlinks werden projektübergreifend berechnet (der Hub zeigt, welche
  Projekte auf seine Seiten verweisen — wertvoll!).
- Zyklen/Mehrfach-Hubs sind erlaubt; Hub-von-Hub wird **nicht** transitiv
  aufgelöst (bewusste Grenze gegen Unübersichtlichkeit).

Beispiel-Migration im echten Bestand: das CNC-Projekt bleibt zunächst Projekt
**und** Hub in einem (das ist erlaubt — jedes Projekt mit `wissen/` kann Hub sein).
Wächst die Zahl der Fräs-Projekte, kann `wissen/` später in ein eigenes
`cnc-wissen`-Repo umziehen; für die Links ändert sich nur das Präfix.

## Globale Sicht

Dashboard bekommt einen Reiter/Bereich **„Wiki"**: Suche über die
`wissen/`-Ordner *aller* Projekte, Trefferliste mit Projekt-Badge. Keine
eigene globale Ablage — nur Aggregation.

## Explizite Nicht-Ziele (v1)

- Kein automatisches Backlink-Rewriting bei Umbenennung (v1: Umbenennen =
  Rotlinks entstehen und werden von Hand/Agent gefixt; die
  Pflege-Sektion zeigt sie ja). Kandidat für v2.
- Keine Transclusion/Einbettung fremder Seiteninhalte.
- Keine Versionierung in der App — das macht Git.
- Kein WYSIWYG.

## Aktualität („wird der Baum gepflegt?")

Wissen veraltet anders als Projektstand — nicht durch Fortschritt, sondern
durch die Welt draußen (neue Firmware, neue Postprozessor-Releases …).
Vorschlag:

- Optionales Frontmatter `geprueft: 2026-08-30` pro Wissens-Seite —
  „zuletzt inhaltlich bestätigt am".
- Die Pflege-Sektion der Sidebar listet neben Rotlinks/Waisen auch
  **abgestandene Seiten** (`geprueft` älter als n Monate oder fehlend).
- Damit haben auch Agents einen klaren Auftrag: abgestandene Seiten
  re-verifizieren und `geprueft` stempeln, statt blind zu vertrauen.

## Offene Fragen

- [ ] Slug-Kollisionen zwischen lokalem Wissen und Hub: reicht
      „lokal gewinnt + Warnhinweis in der Pflege-Sektion"?
- [ ] Schwelle/Default für „abgestanden" (6 Monate? pro Projekt konfigurierbar?)
- [ ] Suche: reicht naives Greppen bis ~1.000 Seiten? (vermutlich ja;
      messen, bevor ein Index gebaut wird)
- [ ] Soll die Projektseite (Stand-Linse) eine „zuletzt geänderte
      Wiki-Seiten"-Kachel bekommen?
- [ ] Agent-Konvention: Claude-Memory nutzt dieselbe `[[...]]`-Syntax —
      dokumentieren, dass Agents Wiki-Seiten genauso verlinken sollen
      (AGENTS.md-Baustein mitliefern?)

## Umsetzungsskizze (Code-Anker)

- `lib/server/files.js` / `projects.js`: `wissen/` einlesen (rekursiv),
  Linkkarte bauen
- `lib/server/markdown.js`: Inline-Rule für `[[...]]` (vor Link-Rendering)
- neue Route `routes/projekt/[id]/wiki/[...slug]/+page.svelte|server.js`
- Sidebar-Komponente `WikiBaum.svelte`, Backlinks in `Markdown.svelte`-Nähe
- Dashboard: Suche über alle Projekte (server load erweitern)
- `janus.config.json` unverändert; `projekt.yaml` um `wissen_hubs` erweitert

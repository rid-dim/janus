---
id: wiki-linse
title: 'Phase 1: Wiki-Linse im Einzelprojekt'
status: fertig
start: 2026-08-30T00:00:00.000Z
---

Wiki-Ansicht für ein einzelnes Projekt gemäß [Konzept](../stand/wiki-konzept.md):
`wissen/`-Ordner, Wikilinks, Backlinks, Rotlinks, Suche.

## Checkpoints
- [x] `wissen/` rekursiv einlesen (neues Modul `lib/server/wissen.js`), Linkkarte bauen
- [x] `[[...]]`-Inline-Rule im Markdown-Renderer (inkl. `|`-Alias, Rotlink-Klasse)
- [x] Route `/projekt/<id>/wiki/[...slug]` + Seitenbaum-Sidebar (rekursives Snippet, einklappbare Ordner)
- [x] Backlinks-Sektion unter jeder Seite (projektweit: auch aus stand/geplant)
- [x] Rotlink-Klick → „Seite jetzt anlegen" (create-doc um kind `wissen` + Slug/Unterordner erweitert)
- [x] Pflege-Sektion: Waisen, offene Rotlinks, abgestandene Seiten (`geprueft:`, Schwelle 180 Tage) + „Heute geprüft"-Stempel-Button
- [x] Volltextsuche im Projekt (`?q=`, naiv über Titel+Body)
- [x] FORMAT.md, README und AGENTS-Scaffold erweitert (wissen/, Wikilinks, geprueft, schemaVersion 2)
- [x] Bestehendes CNC-Projekt migriert: vier Referenz-Seiten → wissen/ (schemaVersion 2)
- [x] Von Hand in der UI gegentesten (Editieren, Rotlink-Anlegen, Suche, Pflege)

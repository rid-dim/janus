---
id: wissens-hubs
title: 'Phase 2: Wissens-Hubs (projektübergreifend)'
status: fertig
depends_on:
  - wiki-linse
start: 2026-08-30T00:00:00.000Z
---

Geteilte Wissensbasen als eigene Janus-Projekte, eingebunden per
`wissen_hubs:` in projekt.yaml — siehe [Konzept](../stand/wiki-konzept.md).

## Checkpoints
- [x] `wissen_hubs` in projekt.yaml parsen (`wikiKontext`/`resolveWikilink` in projects.js), Hub-Bäume read-only unter „aus <Hub>" eingeblendet
- [x] Link-Auflösung lokal → Hubs (Deklarations-Reihenfolge); explizite `[[hub-id/seite]]`-Syntax; Hub-Links mit ⤴-Markierung
- [x] Projektübergreifende Backlinks (Hub-Seite zeigt verweisende Projekte unter „Verwiesen von")
- [x] Slug-Kollisions-Warnung in der Pflege-Sektion (lokal gewinnt) + Hinweis „im Hub öffnen" bei fehlenden lokalen Seiten
- [x] Globale Wiki-Suche im Dashboard (`/?q=`, Aggregation über alle Projekte, Projekt-Badges)
- [x] Doku (FORMAT.md, README) + Beispieldaten in `projekte/`
- [x] Von Hand in der UI gegentesten (Hub-Baum, Hub-Links, externe Backlinks, Kollision)

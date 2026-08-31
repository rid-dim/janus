---
id: zeitleiste-und-archiv
title: Zeitleiste, Rail-Tabs & Archiv
status: fertig
start: 2026-08-25
ende: 2026-08-25
depends_on: [mvp]
---

Drei Features in einem Wurf (angestoßen aus der Praxis in einem privaten
Projekt):

- **Zeitleisten-Ansicht** `/projekt/<id>/zeit`: Aktivitätsstreifen aus
  `stand/chronik.md` (Kategorien ⚖️/⚡/✉️ als Farben, Monatsachse, Heute-Marker,
  Tooltip) + Themen-Gantt aus den Knoten (`start:`/`ende:`-Frontmatter,
  Langläufer > 90 Tage hervorgehoben, Deep-Link auf Knoten, Zoom).
- **Rail-Tabs**: mehrere `pin: right`-Dateien als Tabs statt Stapel, Auswahl je
  Projekt in localStorage.
- **Archiv** `abgeschlossen/`: beendete Knoten werden hierher verschoben —
  raus aus dem aktiven Graph, rein in die eingeklappte „Abgeschlossen"-Sektion
  und ins Gantt. (Diese Datei ist der erste Dogfood-Fall.)

## Checkpoints

- [x] Chronik-Parser (Datumsformen `21.08.`, `20./21.08.`, `~17.08.`, Jahresbereiche in Überschriften)
- [x] Aktivitätsstreifen + Themen-Gantt als Svelte-Komponenten (kein Chart-Framework)
- [x] `start:`/`ende:`-Frontmatter im Knoten-Parser
- [x] Rail-Tabs mit localStorage-Gedächtnis
- [x] `abgeschlossen/` in Parser, Projektseite, DAG (tolerante depends_on) und Gantt
- [x] Fixes nach Browser-Kontrolle: loose-DAG-Overflow, Achsenkontrast, Tooltip fixed unter dem Marker
- [x] Selbst-Doku nachgezogen (FORMAT.md, README, AGENTS-Template in scaffold.js, dieses Projekt)

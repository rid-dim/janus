---
title: Chronik
pin: right
---

Kurzlog der Janus-Entwicklung (neueste zuerst). ⚖️ Entscheidung · ⚡ Meilenstein · ✉️ Feedback

## August 2026

- **31.08.** ⚡ **Fällig-Liste** auf dem Dashboard: `ende:` eines nicht
  fertigen Knotens gilt als Fälligkeit; angezeigt werden Überfälliges und die
  nächsten 7 Tage, dringlichstes zuerst.

- **25.08.** ⚡ **Zeitleisten-Ansicht, Rail-Tabs und Archiv** gebaut und released: Aktivitätsstreifen aus der Chronik + Themen-Gantt mit Langläufer-Warnung; `abgeschlossen/` als Archiv-Ordner; Selbst-Doku (FORMAT, README, AGENTS-Template) nachgezogen.
- **25.08.** ⚖️ Konvention eingeführt: beendete Knoten wandern nach `abgeschlossen/` statt im aktiven Graph zu bleiben; optionale `start:`/`ende:`-Frontmatter für die Zeitleiste.
- **21.08.** ⚡ Feature `pin: right` — jede `stand/`-Datei kann als rechte Seitenleiste gepinnt werden (entstanden für die Chronik in einem privaten Projekt).
- **21.08.** ⚡ Erstes externes Projekt verlinkt (`projects`-Liste in janus.config.json) — Janus im Alltagseinsatz.
- **17.08.** ⚡ Initial Commit der App (SvelteKit, dateibasiertes Datenmodell).

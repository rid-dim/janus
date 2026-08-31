---
title: Überblick
---

## Worum geht's

**Janus** ist ein bewusst kleines Werkzeug, um den Überblick über ein paar
eigene Projekte zu behalten – und um mit Coding-Agents (Claude Code / Codex) am
Projektstand zusammenzuarbeiten. Dieses `.janus/`-Verzeichnis ist das
Self-Tracking der App in ihrem eigenen Repo (Dogfooding).

Jedes Projekt hat zwei Gesichter, daher der Name:

- **Blick zurück** – der *aktuelle Stand*, nach Themen sortiert aufbereitet
  (dieses Panel), gerne mit Charts und Verweisen auf Dokumente.
- **Blick nach vorn** – die *geplanten Wege* als Graph, der sich verzweigen und
  wieder zusammenlaufen kann, mit abhakbaren Checkpoints.

Dazu die **Zeitleisten-Ansicht** (`/projekt/<id>/zeit`) mit Aktivitätsstreifen
aus der Chronik und einem Themen-Gantt, sowie als dritte Linse das **Wiki**
(`/projekt/<id>/wiki`) über den `wissen/`-Ordner — Konzept siehe
[wiki-konzept](wiki-konzept.md), Umsetzung in `geplant/` (Wiki-Linse,
Wissens-Hubs). Anlass war ein CNC-Projekt, das eine wachsende Wissensbasis
aufbaut (Maschine, CAM, Eloxieren, Schnittdaten), die über ein einzelnes
Projekt hinaus nützlich ist.

Der ganze Inhalt lebt als schlichte Markdown-Dateien auf der Platte. Die App ist
nur die Ansicht darauf – dadurch ist alles exportierbar, git-fähig und direkt
von Agenten pflegbar.

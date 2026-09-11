---
title: Chronik
pin: right
---

Kurzlog der Janus-Entwicklung (neueste zuerst). ⚖️ Entscheidung · ⚡ Meilenstein · ✉️ Feedback

## September 2026

- **11.09.** ⚡ **Agenten-Kanal (Stufe 2)**: Agenten adressieren sich mit
  `@name` (mehrere, `@all`); zugestellt wird nur an Genannte, der Mensch sieht
  den ganzen Verkehr und kann einwerfen. Zustellung nach dem **Minion-Muster** –
  die Session wählt hinaus und hält einen Long-Poll offen, Janus öffnet nie eine
  Verbindung (wie ein Salt-Minion, und aus demselben Grund: NAT und Firewalls).
  Gemessen: eine 18 s nach Turn-Ende eintreffende Nachricht war nach 0,2 s
  zugestellt und hat die untätige Session geweckt. Dazu Rundfrage (Antworten als
  Markdown mit Bildern und Charts) und Vermittlung. ⚖️ Kein eigener Broker: der
  Kanal ist eine Datei je Nachricht, damit können auch Agenten ohne Long-Poll
  mitlesen. ⚖️ Zugang von außerhalb nur mit Token – diese Endpunkte schieben
  Text in fremden Agentenkontext.

- **11.09.** ⚡ **Agenten-Board, Stufe 1**: Claude-Code-Hooks melden je Session
  Host, Projekt und Zustand nach `~/.janus/agenten/`; das Dashboard zeigt
  wartende Agenten, bevor man ihr Fenster öffnet. Dazu `@wartet(...)` für
  *sachliches* Warten (Tage bis Wochen, deklariert) getrennt vom Prozess-Warten
  (Minuten, aus dem Hook). ⚖️ Janus wird **Verzeichnisdienst, nicht Briefträger**:
  den Transport macht `SendMessage`, die Frage „wer gehört zu welchem Projekt"
  beantwortet Janus. ✉️ Zwei Korrekturen kamen vom Agenten aus
  `700-messung-alpha` – Marker gehört an die Zeile statt an den Knoten, und
  `seit:` ist das Datum des Fragens, sonst sammelt das Board Ausreden.

- **04.09.** ⚡ **Termine-Parser**: `stand/termine.md` mit `typ: termine` wird
  nach Datum sortiert gerendert (exakte und unscharfe Angaben wie „~Mitte
  September“, „Q1 2027“) und speist die Fällig-Liste des Dashboards. ⚖️ Die
  Datei bleibt Quelle der Wahrheit, die App sortiert nur.

- **03.09.** ⚡ **Abschließen-Button**: Knoten wandern per Klick nach
  `abgeschlossen/` (Status `fertig`, `ende:` = heute), „Reaktivieren" holt sie
  zurück – bisher war das ein manueller Datei-Umzug. ✉️ Feedback aus der Praxis.

## August 2026

- **31.08.** ⚡ **Fällig-Liste** auf dem Dashboard: `ende:` eines nicht
  fertigen Knotens gilt als Fälligkeit; angezeigt werden Überfälliges und die
  nächsten 7 Tage, dringlichstes zuerst.

- **25.08.** ⚡ **Zeitleisten-Ansicht, Rail-Tabs und Archiv** gebaut und released: Aktivitätsstreifen aus der Chronik + Themen-Gantt mit Langläufer-Warnung; `abgeschlossen/` als Archiv-Ordner; Selbst-Doku (FORMAT, README, AGENTS-Template) nachgezogen.
- **25.08.** ⚖️ Konvention eingeführt: beendete Knoten wandern nach `abgeschlossen/` statt im aktiven Graph zu bleiben; optionale `start:`/`ende:`-Frontmatter für die Zeitleiste.
- **21.08.** ⚡ Feature `pin: right` — jede `stand/`-Datei kann als rechte Seitenleiste gepinnt werden (entstanden für die Chronik in einem privaten Projekt).
- **21.08.** ⚡ Erstes externes Projekt verlinkt (`projects`-Liste in janus.config.json) — Janus im Alltagseinsatz.
- **17.08.** ⚡ Initial Commit der App (SvelteKit, dateibasiertes Datenmodell).

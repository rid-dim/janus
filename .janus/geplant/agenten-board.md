---
id: agenten-board
title: Agenten-Board
status: in-arbeit
depends_on: []
start: 2026-09-11
---

Sichtbarkeit und Koordination über mehrere Agenten-Sessions hinweg. Janus wird
dabei **Verzeichnisdienst, nicht Briefträger**: den Transport macht Claude Code
(`SendMessage`), die Frage „wer gehört zu welchem Projekt und wartet worauf"
beantwortet Janus. Ausführlich in [Plan](../../docs/plan-agenten-board.md).

## Checkpoints

### Stufe 1 – Präsenz und Verzeichnis
- [x] `hooks/praesenz.mjs` – Hook meldet Host, Arbeitsordner und Zustand je Session
- [x] `lib/server/agenten.js` – Präsenz einlesen, `cwd` → Projekt auflösen, Adresse raten
- [x] `lib/server/warten.js` – `@wartet(...)`-Marker inklusive Fortsetzungszeilen
- [x] `AgentenZeile.svelte` + Anbindung ans Dashboard, Auto-Refresh alle 15 s
- [x] Hooks in `~/.claude/settings.json` eintragen
- [ ] Mit mehreren echten Sessions gegentesten (diese Session: bestätigt)
- [x] `FORMAT.md` und das `AGENTS.md`-Scaffold um `@wartet` erweitern

### Stufe 2 – Kanal, Rundfrage, Vermittlung
- [x] Kanal mit `@name`-Adressierung (mehrere, `@all`), Zustellung nur an Genannte
- [x] Mensch sieht den ganzen Verkehr und kann einwerfen (Autocomplete für Namen)
- [x] Long-Poll-Endpunkt + `hooks/minion.mjs`, `exit 2` weckt (0,2 s gemessen)
- [x] Rundfrage ist kein Mechanismus, sondern `@all` – Modul wieder entfernt
- [x] Kanalnachrichten sind Markdown (Listen, Charts, Bilder aus dem Projekt)
- [x] Kanal aufs Dashboard, Container breiter, Zahnrad auf aktiven Projektkarten
- [x] Vermittlung ist kein Mechanismus, sondern `@a @b klärt das` – Modul entfernt
- [x] Dashboard: ziehbare Trennung (Breite + Kanalhöhe), sortierbare Kacheln
- [x] Umsortieren zeigt die künftige Anordnung live, statt sie anzudeuten
- [x] Zugangsschutz: lokal frei, von außerhalb nur mit Token
- [x] Minion pollt durchgehend (Schleife + Schloss) statt nur 45 s nach Turn-Ende
- [x] Chat-Fenster statt Liste; alle Board-Daten flüchtig (TTL, Vorgabe 2 h)
- [x] `UserPromptSubmit`-Hook: Session steht nicht mehr fälschlich auf „idle"
- [x] Reconnect, wenn Janus während eines Polls neu startet
- [x] Dashboard als Fenster: feste Höhe, nur die Projektspalte scrollt
- [x] Eingabe: Enter sendet, Shift+Enter bricht um, Feld wächst mit
- [x] Auto-Scroll nur, wenn der Blick ohnehin unten ist
- [x] Projektfarben: Kacheln flächig, Nachrichten und Chips in derselben Farbe
- [x] Erwähnungen überall im Text, Code-Spans ausgenommen, Fehlerbilder gemeldet
- [x] Kopier-Knopf an jeder Nachricht
- [ ] Aufräumen der Polls bei hartem Session-Abbruch
- [ ] Mit zwei Maschinen gegentesten (MacBook ↔ Notebook, solange im selben Netz)

### Stufe 3 – Kanäle mit Verlauf
- [ ] Offene Vermittlungen mit Thema, Teilnehmern, letzter Aktivität
- [ ] Verlauf je Vermittlung aus den Postfach-Dateien

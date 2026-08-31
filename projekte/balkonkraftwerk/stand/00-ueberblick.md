## Überblick

Ein (fiktives) Balkonkraftwerk: zwei Module ans Südgeländer, Wechselrichter
dran, anmelden, einstecken. Dieses Projekt ist Beispieldatensatz für Janus —
es zeigt alle Bausteine im Zusammenspiel:

- **Stand** (dieses Panel): ein Markdown pro Thema, Reihenfolge über
  `stand_reihenfolge` in `projekt.yaml`; [technik](technik.md) enthält einen
  Plotly-Chart.
- **Chronik** rechts: eine `stand/`-Datei mit `pin: right` im Frontmatter —
  sie speist auch den Aktivitätsstreifen der Zeitleiste (`/zeit`).
- **Geplant**: DAG-Knoten in `geplant/` — Montage und Anmeldung laufen
  parallel und treffen sich in der Inbetriebnahme.
- **Archiv**: die abgeschlossene Recherche liegt in `abgeschlossen/`.
- **Wiki** (`/wiki`): Referenzwissen in `wissen/` mit `[[wikilinks]]`.
- **Anhänge**: [Einkaufsliste](doc:anhaenge/einkaufsliste.txt) öffnet lokal
  im Standardprogramm.

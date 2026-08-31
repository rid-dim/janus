## Datenmodell

Ein Projekt = ein Ordner:

```
janus/
  projekt.yaml      # Metadaten + schemaVersion (für Migration)
  stand/            # "Aktueller Stand", ein Markdown pro Thema
                    #   pin: right → rechte Seitenleiste (mehrere = Tabs)
                    #   chronik.md speist den Aktivitätsstreifen der Zeitleiste
  geplant/          # ein Markdown pro DAG-Knoten (depends_on im Frontmatter,
                    #   optional start:/ende: für den Themen-Gantt)
  abgeschlossen/    # Archiv: beendete Knoten (status: fertig) werden
                    #   hierher verschoben
  anhaenge/         # lokaler Document Store
  AGENTS.md         # Format-Hinweise für Claude Code / Codex
```

Die Graph-Struktur ergibt sich aus dem `depends_on`-Frontmatter der Knoten –
kein separater Editor nötig, alles per Text/Agent pflegbar. Das Layout rechnet
`dagre` automatisch.

## Verlinkungen

Dokument-Links zeigen auf die Platte und öffnen im Standardprogramm:

- Anhang im Projekt: [Kurz-Notiz](doc:anhaenge/notiz.txt)
- Beliebige Datei per absolutem Pfad: `[Bericht](/Users/ich/Dokumente/bericht.pdf)`

## Was bewusst weggelassen ist

Wissensmanagement ist ein eigenes, späteres Thema. Der Document-Store hier ist
nur eine leichte Brücke dorthin.

Geplant sind zwei 435-W-Module am Südbalkon mit einem 800-W-Wechselrichter
(siehe [[wechselrichter]] im Wiki). Erwarteter Ertrag nach der
Standort-Recherche (Beispieldaten — ein `plotly`-Block im Markdown wird beim
Anzeigen zu einem echten Chart):

```plotly
{
  "data": [
    {
      "type": "bar",
      "x": ["Mai", "Jun", "Jul", "Aug", "Sep", "Okt"],
      "y": [78, 84, 86, 79, 58, 36],
      "marker": { "color": "#2f6fd0" },
      "name": "kWh (Prognose)"
    }
  ],
  "layout": {
    "margin": { "t": 10, "r": 10, "b": 30, "l": 30 },
    "height": 240,
    "paper_bgcolor": "rgba(0,0,0,0)",
    "plot_bgcolor": "rgba(0,0,0,0)",
    "font": { "color": "#8a94a0" },
    "yaxis": { "gridcolor": "rgba(140,140,140,0.15)" }
  }
}
```

Offene Frage: reicht die Tragkraft des Geländers für die Glas-Glas-Module,
oder braucht es die leichteren Flex-Module? → Checkpoint im Knoten
`montage`.

## Fortschritt

Erledigte Checkpoints pro Kalenderwoche (Beispieldaten – ein `plotly`-Block im
Markdown wird beim Anzeigen zu einem echten Chart):

```plotly
{
  "data": [
    {
      "type": "bar",
      "x": ["KW 30", "KW 31", "KW 32", "KW 33"],
      "y": [2, 5, 4, 7],
      "marker": { "color": "#2f6fd0" },
      "name": "erledigt"
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

So bekommst du Plotly ins Markdown: Ein eingezäunter Block mit der Sprache
`plotly` (oder `chart`) und einer Plotly-Figur als JSON. Agents können solche
Blöcke aus einer Analyse direkt erzeugen.

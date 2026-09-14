# Changelog

Neueste Einträge zuerst. Ergänzt wird hier, was sich für bestehende
Installationen ändert – Entscheidungen und Hintergründe stehen in der
Projekt-Chronik (`.janus/stand/chronik.md`).

## 2026-09-14 – Minion: mehr Luft für den Präsenz-Aufruf

- Nach einer Zustellung meldet der Minion die Session als „arbeitet", indem er
  `praesenz.mjs` in einem zweiten Node-Prozess startet. Der Timeout dafür
  steigt von 5 s auf 15 s: auf manchen Windows-Hosts dauert allein der
  Node-Start über 3 s (gemessen 3,3 s), und parallel laufen womöglich weitere
  Hooks. Ein gerissener Timeout blieb still und hätte die geweckte Session als
  „idle" stehen lassen.

**Beim Aktualisieren:** `hooks/minion.mjs` erneut nach `~/.janus/hooks/`
kopieren. Wer die Hooks direkt aus dem Repo bezieht, hat es mit dem Pull.

## 2026-09-11 – Agenten-Board und Kanal

**Neu**

- **Agenten-Board** auf dem Dashboard: zeigt, welche Coding-Agent-Sessions
  laufen, wer auf Eingabe wartet und woran es sachlich hängt. Präsenz kommt
  aus Claude-Code-Hooks (`hooks/praesenz.mjs`), sachliches Warten aus
  `@wartet(...)`-Markern an Checkpoint-Zeilen.
- **Kanal**: Agenten und Mensch schreiben sich mit `@name` (mehrere, `@all`).
  Zugestellt wird über einen Long-Poll, den die Session selbst offen hält
  (`hooks/minion.mjs`); eine Zustellung weckt eine untätige Session. Alles im
  Kanal verfällt nach zwei Stunden.
- **Layout**: Kanal links, Projekte rechts, ziehbare Trennung; Kacheln per
  Griff sortierbar; Projektfarben ziehen sich durch Kachel, Nachricht und Chip.
- **Format**: `pruefen: JJJJ-MM-TT` im Knoten-Frontmatter als Wiedervorlage
  ohne Vorlauf; Projektstatus heißt jetzt `aktiv | inaktiv | fertig`.
- **Zugangsschutz** für die Agenten-Endpunkte: Loopback frei, von außerhalb
  nur mit Token aus `~/.janus/token`.

**Beim Aktualisieren**

- Kein `npm install` nötig, keine Datei muss angefasst werden. Alte
  Statuswerte wie `in-arbeit` werden beim Lesen übersetzt.
- Das Board ist opt-in: ohne eingetragene Hooks blendet es sich aus. Einrichtung
  in [EINRICHTUNG.md](EINRICHTUNG.md). Dauerhaft abschalten mit
  `"agentenBoard": false` in `janus.config.json`.
- **Janus schreibt jetzt selbst in `janus.config.json`**: neu vergebene
  Projektfarben (`farben`) und die Kachel-Reihenfolge (`reihenfolge`) werden
  dort abgelegt. Die Datei ist gitignoriert; wer sie unter Versionskontrolle
  hält, sieht ab jetzt automatische Änderungen.
- Neue optionale Felder in `janus.config.json`: `agentenBoard`, `mensch`
  (Anzeigename des Menschen im Kanal, Vorgabe „mensch"), `pfadabbildung`
  (fremde Pfadwurzeln auf lokale abbilden, für gemischte Windows/WSL-Wirte).
- **Wer die Hooks nach einer frühen Fassung der Anleitung eingerichtet hat**,
  zieht zwei Dinge nach:
  1. Minion-Timeout im `Stop`-Hook von `580` auf `86400` – gemessen: Claude
     Code kappt asyncRewake-Hooks nicht bei 600 s, der Kanal bleibt damit
     einen Tag statt neun Minuten offen.
  2. Neuer `PreToolUse`-Hook auf `praesenz.mjs` – sonst zeigt das Board
     Sessions als „idle", deren Turn ohne Eingabe begann (Rückmeldung eines
     Subagenten, Kanal-Zustellung, Cross-Session-Nachricht).

  Beide Einträge stehen im Beispiel in EINRICHTUNG.md; die Hook-Skripte aus
  `hooks/` erneut nach `~/.janus/hooks/` kopieren.

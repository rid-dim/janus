# Einrichtung: Janus-Server und Agenten-Board

Zwei Dinge sind einzurichten, und sie sind unabhängig voneinander:

1. **Der Janus-Server** – zeigt Projekte, Stand, Wiki, Zeitleiste. Ohne alles
   Weitere voll benutzbar.
2. **Das Agenten-Board** – zeigt zusätzlich, welche Agenten-Sessions laufen,
   wer wartet, und erlaubt den Kanal. Braucht Hooks in Claude Code.

Wer nur Punkt 1 will, hört nach dem ersten Abschnitt auf.

---

## 1. Server starten

Voraussetzung: **Node.js ≥ 20**.

```bash
npm install
npm run dev            # http://localhost:5173, mit Beispieldaten
```

Für den Dauerbetrieb:

```bash
npm run build
npm run start          # Port über PORT=… setzbar
```

**Von anderen Rechnern erreichbar machen.** `npm run dev` lauscht nur auf
`127.0.0.1`. Sollen andere Maschinen zugreifen (etwa ein Windows-Wirt neben
WSL, oder ein zweiter Rechner im Heimnetz):

```bash
npm run dev -- --host 0.0.0.0          # Entwicklung
HOST=0.0.0.0 npm run start             # Dauerbetrieb
```

> Sobald der Server über `127.0.0.1` hinaus erreichbar ist, gilt der
> Zugangsschutz aus Abschnitt 4 – die Agenten-Schnittstellen schieben Text in
> den Kontext laufender Agenten.

Eigene Projekte anbinden: siehe [FORMAT.md](FORMAT.md). Kurz: `dataRoot` in
`janus.config.json` auf den Projektordner zeigen, oder Repos unter `projects`
verlinken.

---

## 2. Agenten-Board: Hooks einrichten

Das Board lebt von zwei kleinen Node-Skripten aus `hooks/`. Kopiere sie an
einen festen Ort und trage sie in die Claude-Code-Einstellungen ein.

```bash
mkdir -p ~/.janus/hooks
cp hooks/praesenz.mjs hooks/minion.mjs ~/.janus/hooks/
chmod +x ~/.janus/hooks/*.mjs
```

| Skript | Aufgabe |
|---|---|
| `praesenz.mjs` | meldet je Session Projekt, Zustand und Wirt |
| `minion.mjs` | hält den Kanal offen und weckt die Session bei neuer Post |

### Linux / macOS / WSL

In `~/.claude/settings.json` (Nutzer-Ebene, gilt für alle Sessions der
Maschine). Vorhandene Einstellungen **nicht** ersetzen, nur `hooks` ergänzen:

```json
{
  "hooks": {
    "SessionStart":     [{ "hooks": [{ "type": "command", "command": "node /home/DU/.janus/hooks/praesenz.mjs", "async": true, "timeout": 10 }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node /home/DU/.janus/hooks/praesenz.mjs", "async": true, "timeout": 10 }] }],
    "Stop": [{ "hooks": [
      { "type": "command", "command": "node /home/DU/.janus/hooks/praesenz.mjs", "async": true, "timeout": 10 },
      { "type": "command", "command": "node /home/DU/.janus/hooks/minion.mjs", "asyncRewake": true, "timeout": 580 }
    ] }],
    "StopFailure":      [{ "hooks": [{ "type": "command", "command": "node /home/DU/.janus/hooks/praesenz.mjs", "async": true, "timeout": 10 }] }],
    "SessionEnd":       [{ "hooks": [{ "type": "command", "command": "node /home/DU/.janus/hooks/praesenz.mjs", "async": true, "timeout": 10 }] }],
    "Notification": [{
      "matcher": "agent_needs_input|idle_prompt|permission_prompt|agent_completed",
      "hooks": [{ "type": "command", "command": "node /home/DU/.janus/hooks/praesenz.mjs", "async": true, "timeout": 10 }]
    }]
  }
}
```

Drei Dinge, die dabei zählen:

- **Pfade absolut**, `~` wird nicht aufgelöst.
- `async: true` bei `praesenz.mjs` – eine Präsenzmeldung darf die Session nie
  bremsen.
- `timeout` beim Minion **größer als sein Zeitbudget**. Diese beiden Zahlen
  hängen zusammen, und die falsche gewinnt: beendet wird der Poller vom
  `timeout` des Hooks, nicht vom Budget. Steht das Budget darüber, ist es
  wirkungslos und der Kanal schließt still früher als angekündigt.

      timeout  >  JANUS_MINION_MINUTEN × 60  (mit etwas Luft)

  Für die Vorgabe von 240 Minuten also mindestens 14700 s; für ein Budget von
  5 Minuten reichen 330 s. Der Minion liest den Wert inzwischen selbst aus
  `settings.json` und deckelt sich entsprechend – wer die Zahlen falsch setzt,
  bekommt einen kürzeren Kanal, aber keinen von außen abgeschnittenen Prozess.
  Ohne gefundenen Eintrag gilt die Vorgabe von Claude Code (600 s).

  Die 600 sind ein **Vorgabewert, keine Obergrenze** – laut Doku ist ein höherer
  `timeout` zulässig, eine Decke ist nur für `SessionEnd` beschrieben (60 s).
  **Erprobt ist das nicht.** Ob Claude Code einen Wert von mehreren Stunden
  tatsächlich durchlässt, hat hier niemand gemessen; ein stillschweigend
  gedeckelter Timeout würde den Poller abschießen, statt ihn sauber enden zu
  lassen – genau das, was der Selbst-Deckel verhindern soll.

  Empfohlen ist deshalb **`timeout: 580`**, sicher unter der dokumentierten
  Vorgabe. Das ergibt rund neun Minuten Kanal – für einen Menschen am
  Schreibtisch eine andere Größenordnung als anderthalb. Wer mehr will, misst
  vorher nach, wie lange ein Hook-Prozess tatsächlich überlebt.
  Wichtig ist die Unterscheidung zwischen den beiden Hintergrund-Schaltern:
  einen Hook mit `async: true` beendet Claude Code beim Timeout **nicht**, einen
  mit `asyncRewake: true` **schon**. Der Minion braucht `asyncRewake` (nur das
  weckt bei `exit 2`) und unterliegt dem Timeout deshalb.

Der Weckmechanismus ist auf beiden Plattformen gemessen: unter Linux/WSL wurde
eine 40 s untätige Session zuverlässig geweckt und eine in den laufenden Poll
eintreffende Nachricht in 0,2 s zugestellt; unter nativem Windows ebenfalls
(40,007 s, ein Aufruf, Selbstentschärfung griff, die Session lief aus dem
Hintergrund wieder an).

Der zugestellte Text kommt dabei als „Stop hook blocking error" an – deshalb
gibt er sich in der ersten Zeile selbst als Post zu erkennen. Ohne diese
Selbstkennzeichnung fängt die geweckte Session an, einen Fehler zu suchen, den
es nicht gibt. Das ist in der Praxis bestätigt, nicht vermutet.

Der `UserPromptSubmit`-Hook ist nicht optional: ohne ihn bleibt eine Session
nach ihrem ersten `Stop` für immer als „idle" stehen, auch mitten in der Arbeit.

### Windows

Gleiche Struktur, aber:

- Pfade in Windows-Schreibweise: `node C:\\Users\\DU\\.janus\\hooks\\praesenz.mjs`
  (im JSON verdoppelte Backslashes).
- **Liegt Node in einem Pfad mit Leerzeichen** (`C:\Program Files\nodejs`),
  gehören Node- und Skriptpfad in Anführungszeichen. *Dieser Fall ist
  ungeprüft* – wer ihn testet, möge das Ergebnis nachtragen.
- **Läuft Janus in WSL und die Session unter Windows**, muss die Präsenz über
  HTTP gemeldet werden statt über eine Datei. Siehe nächster Abschnitt.

---

### Die Einrichtung macht der Mensch, nicht der Agent

Ein Agent kann sich **nicht selbst** in den Kanal einbuchen. Der Versuch, sich
einen Stop-Hook einzutragen, wird von der Berechtigungsprüfung abgelehnt –
Begründung „Self-Modification", und zwar unabhängig vom Weg: über die Shell
genauso wie über das Datei-Werkzeug. Die Grenze gilt der Handlung.

Das ist richtig so: ein Agent, der sich selbst einen Hook einrichtet, ändert
seine eigenen Ausführungsbedingungen. Für die Einrichtung heißt es aber, dass
ein Ausrollplan nach dem Muster „jede Session verkabelt sich beim ersten Start
selbst" **nicht funktioniert** – je nach Berechtigungsmodus still oder mit
Abbruch. Wer das nicht weiß, sucht den Fehler bei sich.

Dasselbe gilt für die Selbstregistrierung des `ListAgents`-Namens: sie setzt
voraus, dass das Modell mitspielen *darf*, nicht nur will.

## 3. Fremde Wirte: Präsenz über HTTP

Der Normalfall ist die Datei unter `~/.janus/agenten/`. Sie setzt voraus, dass
Session und Janus **dasselbe** Dateisystem sehen.

Eine Windows-Session neben WSL sieht es nicht: ihr `~` ist
`C:\Users\DU\.janus`, das von Janus gelesene liegt unter
`/home/DU/.janus`. Ein Hook schreibt dort tadellos an eine Stelle, an der nie
jemand nachsieht.

Ein gemeinsames Verzeichnis über `\\wsl$\…` wäre die schlechtere Lösung: die
Sichtbarkeit hinge daran, dass die andere Welt läuft, ein Fehlschlag wäre
stumm, und ein Verzeichnislisting über 9P kann ins Zeitlimit laufen (gemessen:
120 s). Deshalb:

```bash
# auf dem fremden Wirt, vor dem Start der Session
set JANUS_URL=http://127.0.0.1:5173
```

Sobald `JANUS_URL` gesetzt ist (oder `url` in `~/.janus/config.json` steht),
meldet `praesenz.mjs` über `POST /api/agent/praesenz` statt in die Datei – und
fällt auf die Datei zurück, wenn Janus nicht antwortet. Über die
WSL-Portweiterleitung erreicht `127.0.0.1:5173` von Windows aus den Server in
WSL.

**Pfadschreibweisen** führt Janus selbst zusammen: `/c/projects/x`,
`C:\projects\x` und `/mnt/c/projects/x` gelten als derselbe Ort. Reicht das
nicht, trägt man die Abbildung in `janus.config.json` ein:

```json
"pfadabbildung": { "C:\\": "/c/", "\\\\server\\share": "/mnt/share" }
```

---

## 4. Zugang, wenn der Server nicht nur lokal lauscht

Die Agenten-Schnittstellen können Text in den Kontext laufender Agenten
schieben. Deshalb:

- **Vom selben Rechner** (Loopback): erlaubt, ohne Zutun.
- **Von außerhalb**: nur mit Token, sonst abgewiesen.

```bash
head -c 32 /dev/urandom | base64 > ~/.janus/token
```

Die Gegenstelle gibt es als `JANUS_TOKEN` mit oder im Header `x-janus-token`.
Ohne hinterlegtes Token wird jeder Zugriff von außerhalb abgelehnt – das ist
Absicht.

---

## 5. Umgebungsvariablen

| Variable | Vorgabe | Wofür |
|---|---|---|
| `JANUS_DATA_ROOT` | `./projekte` | zentraler Projektspeicher |
| `JANUS_URL` | – | Janus-Adresse; gesetzt ⇒ Präsenz und Kanal über HTTP |
| `JANUS_TOKEN` | – | Zugangstoken für fremde Wirte |
| `JANUS_TOKEN_FILE` | `~/.janus/token` | Ort des Tokens auf der Serverseite |
| `JANUS_PRAESENZ_DIR` | `~/.janus/agenten` | Ablage der Präsenzdateien |
| `JANUS_KANAL_DIR` | `~/.janus/kanal` | Ablage des Kanals |
| `JANUS_TTL_MINUTEN` | `120` | wann Kanalinhalte verfallen |
| `JANUS_MINION_MINUTEN` | `240` | gewünschte Offenhaltezeit – wirksam nur bis zum Hook-`timeout` |
| `JANUS_POLL_SEKUNDEN` | `45` | Dauer eines einzelnen Long-Polls |

**Wie lange bleibt der Kanal offen?** Der Minion startet am Turn-Ende und pollt
bis zum Ablauf seines Budgets. Danach ist die Session taub, bis sie das nächste
Mal einen Turn beendet – und das passiert nur, wenn jemand etwas schreibt. Wer
also länger als das Budget nicht hinschaut, bekommt eine Nachricht erst beim
nächsten eigenen Anstoß.

Das Budget ist ein *Wunsch*; wirksam wird es nur bis zum Hook-`timeout`. Mit der
empfohlenen Einstellung `timeout: 580` bleibt der Kanal rund neun Minuten offen,
unabhängig davon, was im Budget steht.

Ein *kleines* Budget klingt nach Rücksicht auf einen Arbeitsrechner, hebt den
Zweck aber auf: bei fünf Minuten ist die Session nach fünf Minuten taub, und
neu gestartet wird der Poller vom `Stop`-Hook – also erst, wenn jemand im
Terminal schreibt. Damit wäre die Bedingung für Erreichbarkeit ausgerechnet die
Handlung, die der Kanal überflüssig machen soll.

Der ursprüngliche Grund für ein kurzes Budget war der unbeaufsichtigte
Dauerprozess. Den nimmt die Lebendprüfung: ein verwaister Poller beendet sich
selbst. Ein langes Budget ist deshalb auch auf einem Arbeitsrechner die
richtige Wahl.

Der Minion beendet sich von selbst, sobald der Präsenzeintrag seiner Session
verschwindet (das tut der `SessionEnd`-Hook). Ohne diese Prüfung würde ein
verwaister Poll die Post einer beendeten Session abholen und als gelesen
abhaken – sie wäre dann für niemanden mehr da.

---

## 6. Prüfen, ob es läuft

```bash
# 1. Meldet sich eine Session?
ls ~/.janus/agenten/

# 2. Sieht Janus sie im richtigen Projekt?
#    -> Dashboard öffnen; die Kachel zeigt kreisende Perlen (arbeitet),
#       stehende Perlen (idle) oder ein Ausrufezeichen (wartet auf Eingabe).

# 3. Kommt eine Nachricht an?
curl -s -X POST http://localhost:5173/api/agent/nachricht \
  -H 'content-type: application/json' \
  -d '{"session":"<deine Kennung>","text":"@all Probe"}'
```

Die Antwort nennt `empfaenger` und – falls ein `@name` auf niemanden passte –
`nichtZugeordnet`. Letzteres ist eine **Momentaufnahme, keine Zustellquittung**:
zugeordnet wird erst beim Abholen.

### Wenn nichts erscheint

| Beobachtung | Ursache |
|---|---|
| keine Datei in `~/.janus/agenten/` | Hook nicht eingetragen, oder Pfad nicht absolut |
| Session da, aber „kein Projekt" | `cwd` liegt außerhalb aller Projekte, oder Pfadschreibweise passt nicht – siehe `pfadabbildung` |
| Eintrag „Payload unlesbar" | ein Payload wurde durch eine Shell gereicht; Backslashes überleben das nicht |
| Session bleibt „idle" beim Arbeiten | `UserPromptSubmit`-Hook fehlt |
| Kanal stellt nichts zu | Minion nicht eingetragen, oder sein `timeout` ist kleiner als sein Budget |

---

## 7. Was ungeprüft ist

Ehrlichkeitshalber, damit niemand darauf baut:

- **Pfade mit Leerzeichen** in der Hook-Kommandozeile unter Windows.
- **Aufräumen der Poll-Prozesse bei hartem Session-Abbruch.** Ein Schloss
  erkennt einen toten Halter; ein verwaister Prozess könnte bis zum Ablauf
  seines Budgets weiterlaufen.

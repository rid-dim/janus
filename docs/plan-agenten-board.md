# Plan: Agenten-Board für Janus

**Stand:** 2026-09-11 · **Status:** umgesetzt
**Ausgangs-Commit:** `99e157d`

> **Dies ist das Planungsprotokoll, nicht die Beschreibung des Ergebnisses.**
> Es hält fest, wie entschieden wurde und was unterwegs verworfen wurde —
> einschließlich Entwürfen, die es nicht in die Umsetzung geschafft haben
> (eine eigene Rundfrage, eine eigene Vermittlung, ein Postfach je Session).
> Alle drei stellten sich als umständliche Schreibweisen für etwas heraus, das
> der Kanal ohnehin kann: `@all` plus Frage, `@a @b klärt das untereinander`,
> und eine Adressierung mit `@name`.
>
> Was tatsächlich gebaut wurde, steht in **[FORMAT.md](../FORMAT.md)**; wie man
> es einrichtet, in **[EINRICHTUNG.md](../EINRICHTUNG.md)**. Im Zweifel gilt
> immer die dortige Beschreibung.

## Problem

Beim Arbeiten mit mehreren Agenten parallel:

1. **Blindheit** — dass ein Agent auf Feedback wartet, sieht man nur, wenn
   dessen VSCode-Fenster offen ist. Ein wartender Agent wartet sonst stundenlang.
2. **Kein Übergang** — ein Gespräch in VSCode/Copilot lässt sich nicht an eine
   Claude-Code-Session übergeben.
3. **Kontext-Verschmutzung** — Agent A braucht den Datenserver von Projekt B.
   A ist kein Spezialist für B, müsste sich einlesen und verdirbt sich dabei den
   eigenen Kontext. Besser: A bittet den Agenten von B, den Server zu starten.
4. **Auffindbarkeit** — es gibt keinen Weg zu fragen „wer ist der Agent für
   Projekt X?". `ListAgents` liefert *Konversationstitel* (`Janus Doku Review`,
   `Gateway-Modul Integration Checkpoint`), keine Zuordnung zu Repos.

Punkt 4 ist der eigentliche Kern, und er wurde beim Schreiben dieses Plans
praktisch bewiesen: die Suche nach „dem Agenten, der das Janus-Repo pflegt"
landete bei einer Session, deren Titel plausibel klang und die es nicht war
(sie saß in `700-messung-alpha` auf der Windows-Maschine). Ihre Rückmeldung:

> „Diese Nachricht hat zwischen zwei Maschinen kein Zusatzprotokoll gebraucht.
> Was sie nicht beweist, ist Auffindbarkeit — du hast mich gefunden, weil ich
> zufällig lief und zufällig der richtige Kandidat schien. Ich war es nicht.
> Das Finden ist das eigentliche Problem, nicht das Reden."

**Reden können die Agenten bereits. Finden können sie sich nicht.**

Janus ist der natürliche Ort für die Lösung, weil es die fehlende Abbildung
*schon besitzt*: es ist das eine Verzeichnis über genau die Repos, in denen die
Agenten sitzen (`projects` in `janus.config.json`). Dazu ist es datei-basiert,
und die Fällig-Liste ist bereits das passende Anzeige-Muster — ein wartender
Agent ist eine Fälligkeit mit `inTagen = 0`.

## Entscheidungen (und was bewusst NICHT gebaut wird)

### Die Sichtbarkeitsgrenze von `ListAgents` (gemessen 2026-09-11)

Der Befund, der die Aufgabenteilung endgültig festlegt:

> `ListAgents` sieht **lokale Sessions derselben Maschine** plus
> **Remote-Control-Sessions des Accounts**. Zwei lokale Sessions auf zwei
> verschiedenen Rechnern sind **beidseitig unsichtbar** füreinander.

Beidseitig gegengeprüft: `janus-e0` (WSL) und `janus-c2` (MacBook) stehen beide
in einem Checkout desselben Repos, auf demselben Commit — und keiner von beiden
kann den anderen adressieren (`No agent named 'janus-c2' is reachable`). Die
Listen überschneiden sich in keinem einzigen Eintrag.

**Erreichbarkeit ist eine Eigenschaft des Moments, nicht des Maschinenpaars.**
Am selben Tag gemessen: das Firmen-Notebook `<firmen-notebook>` erreichte die
Janus-Instanz des MacBooks unter `http://<mac-im-heimnetz>:5173/` in 33 ms — weil es
gerade im Heimnetz stand. Im Büro ist dieselbe Strecke tot. Ein Entwurf, der
die Verbindung als gegeben annimmt, bricht beim ersten Ortswechsel. Deshalb
gilt durchgehend: **fällt die Gegenstelle aus, kostet das Sichtbarkeit, nie
Funktion** — und für Dauerhaftes bleibt git der Kanal, der jede Netzlage
überlebt.

(Nebenbei die Lehre aus dem Irrtum: der Rechnername sagt nichts über die
Netzlage. `<firmen-notebook>` klingt nach Firmennetz und war es in dem Moment nicht.
Reichweite gehört gemessen, nicht aus Namen erschlossen.)

Das ist Problem 4 in Reinform, und es hat zwei Konsequenzen:

1. **Remote Control schließt die Lücke sofort**, ohne dass etwas gebaut wird —
   eine Remote-Control-verbundene Session ist von überall sichtbar. Das ist der
   Sofort-Weg und sollte in der Doku stehen.
2. **Für alles andere braucht es einen Punkt, den beide von sich aus
   erreichen.** Nicht weil der Transport fehlt, sondern weil die *Sichtbarkeit*
   endet. Genau das ist Janus mit HTTP-Registrierung — und die Zustellung dahin
   ist mit dem Minion-Muster (2.3) gemessen.

### Ein Postfach, kein Message-Bus

> **Korrektur zur ersten Fassung.** Dort stand pauschal, der Transport sei
> gelöst und ein eigener Bus wäre Doppelarbeit. Das gilt nur, solange beide
> Seiten einander sehen. Die gemessene Sichtbarkeitsgrenze zeigt Fälle, in
> denen das nicht zutrifft.

Die Regel wird dadurch präziser, nicht umgekehrt:

> **`SendMessage`, wo es hinreicht** — gleiche Maschine oder Remote Control.
> **Janus-Postfach, wo es das nicht tut.**

Das Postfach ist ein Endpunkt mit einer Warteschlange je Session, zugestellt
über den bereits gemessenen Long-Poll — kein neuer Dienst, sondern eine
Ergänzung an einem HTTP-Server, der ohnehin läuft. Ausdrücklich **kein**
RabbitMQ, NATS oder MQTT: es gibt keine Durchsatz-, Persistenz- oder
Fan-out-Anforderung, die das rechtfertigen würde.

### Weiterhin kein IRC und kein x0x

Weder lokaler IRC-Server noch [x0x](https://x0x.md/). Beide lösen *Transport und
Discovery* — und den **Transport** hat Claude Code innerhalb seiner
Sichtbarkeitsgrenze bereits gelöst: `SendMessage` adressiert jede sichtbare
Session direkt beim Namen, mit Status (`idle` / `busy` / `waiting` /
`offline`), über lokale Sessions und Remote-Control-Sessions hinweg.
Verifiziert am 2026-09-11 bis auf eine Windows-Maschine im Firmennetz.

Was Claude Code **nicht** löst, ist die *Discovery* jenseits dieser Grenze —
siehe oben. Dafür gibt es das Janus-Postfach, und das ist billiger als jedes
der beiden Systeme: es nutzt den vorhandenen HTTP-Server und den gemessenen
Weckkanal, statt ein zweites Netz aufzuspannen.

Ein zweiter vollwertiger Transportweg daneben würde dagegen:
- dieselbe Strecke doppelt bauen,
- die Permission-Grenzen umgehen, die Claude Code pro Session sauber zieht,
- den Agenten zu einer Polling-Schleife zwingen — genau die Kontext-Verschmutzung,
  die vermieden werden soll.

**x0x konkret:** technisch reizvoll (Post-Quantum, P2P, herstellerübergreifend),
aber es zahlt sich erst bei *mehreren Maschinen ohne gemeinsame Instanz und über
Vendor-Grenzen hinweg*. Ein Daemon mit NAT-Traversal auf einem Firmenrechner mit
Zugang zu internem GitLab und sensiblen Daten ist erhebliche neue Angriffsfläche
für einen Nutzen, den Remote Control über die bestehende ausgehende Verbindung
bereits liefert. **Nicht für v1.** Wiedervorlage, falls einmal Agenten
verschiedener Hersteller über Maschinen hinweg koordiniert werden müssen.

### Janus ist der Verzeichnisdienst, nicht der Briefträger

Die Aufgabenteilung, die sich daraus ergibt, ist scharf:

| | zuständig |
|---|---|
| Transport, Zustellung, Berechtigungen | Claude Code (`SendMessage`) |
| **Wer ist wer, wer gehört zu welchem Projekt, wer wartet worauf** | **Janus** |

Janus baut also keinen Kanal, sondern beantwortet die Frage *„wen adressiere
ich für Projekt X?"* — und liefert die Antwort in einer Form, die man direkt in
`SendMessage` einsetzen kann. Alles, was Janus darüber hinaus tut (Anzeige,
Vermittlung, Verlauf), hängt an dieser einen Auskunft.

### Vermittlung statt Vermittlungsstelle

Es gibt in `SendMessage` kein Gruppen-/Kanal-Konzept, und es braucht auch keins.
Janus **stellt vor** statt zu **relayen**: beide Agenten bekommen je eine
Eröffnungsnachricht („du sprichst ab jetzt mit `q-backend-14` über Thema X,
adressiere ihn direkt"), danach reden sie **direkt** miteinander. Janus
beobachtet den Verkehr über Hooks.

Ein Relay, durch das jede Nachricht läuft, wäre ein Single Point of Failure,
würde die Nachrichtenzahl verdoppeln und eine Komponente zwingen, fremden
Kontext zu verstehen. Die Vermittlung kostet zwei Nachrichten — einmal.

### Datei ist die Lingua Franca, SendMessage ist der Beschleuniger

Jeder Austausch wird **zusätzlich** als Datei abgelegt, nie nur als Nachricht.
Damit kann jeder Agent teilnehmen, der Dateien lesen und schreiben kann —
Copilot, Codex, Cursor, Gemini CLI, notfalls ein Mensch. Claude Code bekommt
`SendMessage` als schnellen Push obendrauf. Siehe *Fremde Agenten* unten.

### Präsenzdaten sind Laufzeitzustand, kein Projektinhalt

Sie gehören **nicht** ins Repo und werden **nie** committet. Ablage zentral pro
Maschine unter `~/.janus/agenten/`.

---

## Stufe 1 — Präsenz und Verzeichnis (beobachtend)

Löst Probleme 1 und 4. Kein neues Protokoll, kein Server-Zwang.

### 1.0 Zwei Arten von „wartet" — nicht vermischen

Die wichtigste Unterscheidung der ganzen Stufe, aus der Praxisrückmeldung des
`700-messung-alpha`-Agenten:

> „‚Agent wartet‘ ist selten dasselbe wie ‚Prozess idle‘."

| | **Prozess-Warten** | **Sachliches Warten** |
|---|---|---|
| Beispiel | Agent hat eine Rückfrage gestellt und steht am Prompt | Entscheidung liegt beim Menschen; Bitte an eine fremde Paketpflege ist raus; Kollegen-Branch steht auf verworfener Basis |
| Dauer | Minuten bis Stunden | Tage bis Wochen |
| Erkennbar durch | Hook (`Notification` / `Stop`) | **gar nicht** automatisch |
| Wird behoben durch | eine Antwort im Terminal | einen Vorgang außerhalb der Maschine |

Hooks sehen ausschließlich die linke Spalte. Die rechte Spalte ist aber die,
die real Projekte aufhält — im genannten Projekt ist ein guter Teil der offenen
Checkpoints nicht durch Arbeit blockiert, sondern durch unsichtbare
Wartezustände dieser Art.

Sachliches Warten muss deshalb **deklariert** werden. Die folgende Konvention
ist nicht am Reißbrett entstanden, sondern gegen elf reale Wartezustände in
fünf Knoten von `700-messung-alpha` geprüft.

#### Auf der Zeile, nicht am Knoten

**In keinem einzigen der zehn geprüften Knoten warten alle offenen Checkpoints
auf dasselbe.** `betriebsstabilitaet`: acht offen, vier brauchen ein
Anlagenfenster, vier sind Schreibtischarbeit. `ui-basics-designsystem`: neun
offen, zwei warten extern — und die Arbeit, die ohne das fremde Paket möglich
wäre, liegt seit Tagen greifbar da.

Knotenweites `wartet_auf:` würde also ausnahmslos mehr Arbeit als blockiert
ausweisen, als es ist. Das ist kein Schönheitsfehler:

> „Die Anzeige ‚wartet auf den Menschen‘ an einem Knoten, in dem zwei Drittel der
> Checkpoints sofort machbar sind, ist bequemer Selbstbetrug — man sieht eine
> Entschuldigung statt einer Aufgabe."

Knoten-Frontmatter wird deshalb **nicht** eingeführt, auch nicht als Zugeständnis
an die Pflegedisziplin. Es käme erst infrage, wenn jeder verbleibende offene
Checkpoint eines Knotens auf dasselbe wartet — was derzeit auf null von zehn
Knoten zutrifft. Erst einführen, wenn ein Projekt den Fall vorzeigt.

#### Die Konvention

```markdown
- [ ] Veroeffentlichung des Svelte-5-Standes bei der ui-basics-Pflege anfragen
      @wartet(fremdstelle seit:2026-09-04 nach:7d)
```

`@wartet(<kategorie> seit:<JJJJ-MM-TT> [nach:<n>d|nie])`. Der Klartext steht
bereits im Checkpoint selbst und wird nicht wiederholt.

**Kategorien** — geschlossen, damit über Projekte aggregierbar („drei
Entscheidungen liegen beim Menschen"), Klartext daneben, weil *welche* nur dort steht:

| Kategorie | Bedeutung | Vorgabe `nach:` |
|---|---|---|
| `entscheidung` | liegt bei einem Menschen im Haus | `7d` |
| `fremdstelle` | fremdes Team, fremde Firma, fremde Paketpflege | `7d` |
| `kollege` | benannte Person, oft ereignis- statt zeitgetrieben | `7d` |
| `zugang` | Zeitfenster an einer Anlage, Hardware, physischer Zutritt | `nie` |

Die vierte Kategorie fehlte im ersten Entwurf und ist im Messtechnikprojekt mit
4 von 11 Fällen die **größte**: „Durchsatz im Anlagennetz messen",
„Speicherbudget auf Zielhardware pruefen", „UDP 9444 und Firewall abnehmen".
Das wartet auf niemanden — niemand ist säumig, Nachfragen hilft nicht, eine
Wiedervorlage wäre reines Rauschen. Jedes Projekt mit echter Hardware dürfte so
aussehen.

#### `seit:` ist das Datum des **Fragens**, nicht des Bemerkens

Der wichtigste Punkt des ganzen Abschnitts. Real formulierte Checkpoints:

```
- [ ] Veroeffentlichung des Svelte-5-Standes bei der ui-basics-Pflege anfragen
- [ ] Bauwerkzeuge in @dieff/context-help nach devDependencies verschieben lassen
- [ ] Mit HEITEC klaeren, ob reale Detektoren dieselbe Zeitbasis verwenden
```

Keiner davon ist ein Warten. Es sind **unversandte Bitten** — niemand hat
gefragt. Mit `@wartet` ausgezeichnet, zeigte das Board geduldiges Warten auf
eine fremde Stelle, während die Wahrheit ist, dass bei uns niemand die Mail
geschrieben hat. Das ist derselbe Fehler wie „Prozess idle heißt Agent wartet",
eine Etage höher — ein Zustand, der Untätigkeit wie Blockade aussehen lässt,
und zwar zu unseren Gunsten.

**Regel: Wer `@wartet` setzt, behauptet damit, die Bitte ist raus.** Solange
nicht gefragt wurde, ist es ein gewöhnlicher offener Checkpoint — eine Aufgabe
für uns, keine Schuld der anderen. Damit ist auch die Wiedervorlage sauber
definiert, weil sie ab einem echten Ereignis zählt.

Dieser Punkt entscheidet, ob das Board Ausreden sammelt oder Arbeit sichtbar
macht. Er gehört so in `FORMAT.md`, nicht nur in diesen Plan.

#### `@wartet` verlässt den Graphen — sonst `depends_on`

Warten auf einen anderen Knoten desselben Projekts ist **kein** `@wartet`,
sondern `depends_on` plus Wikilink. `@wartet` ist ausschließlich für Warten,
das den Graphen verlässt: Mensch, fremdes Team, fremde Firma, physischer
Zugang. Zwei Mechanismen für denselben Sachverhalt driften garantiert
auseinander.

#### Wiedervorlage: pro Eintrag, nicht global

Ein festes Standardintervall wäre in beide Richtungen falsch. `zugang`-Fälle
dürfen sechs Wochen ruhen — vier Nervzeilen pro Monat, und das Board wird
abgeschaltet. Umgekehrt ist der Kollegen-Fall gar nicht zeitgetrieben, sondern
ereignisgetrieben („bevor er das nächste Mal auf dem verworfenen Stand
weiterarbeitet"); er war vor zehn Tagen fällig, und eine 14-Tage-Uhr hätte
ausgerechnet dort geschwiegen. Also: Vorgabe je Kategorie, pro Eintrag
übersteuerbar, und für Ereignisfälle lieber **keine** Uhr als eine falsche.

#### Implementierungshinweise

1. **Fortsetzungszeilen zuerst zusammenziehen.** Checkpoints umbrechen:

   ```
   - [ ] Plot-Komponente erst im Rahmen von [[ui-basics-designsystem]] integrieren, ohne den
         Root-Export, ohne zweite Svelte-Hauptversion und ohne ungenutzte Assets
   ```

   Ein `@wartet(…)` landet dann auf der **zweiten physischen Zeile**. Jeder
   Parser nach dem Muster „Zeilen, die mit `- [ ]` beginnen" übersieht es;
   `grep` findet den Marker und ordnet ihn dem falschen Checkpoint zu. Der
   logische Checkpoint muss vor dem Parsen aus Markerzeile plus eingerückten
   Folgezeilen zusammengesetzt werden. Gehört in die Formatdoku, nicht in die
   Fehlersuche des ersten Anwenders. Betrifft nur den neuen Parser —
   `countTasks()` und `toggleTask()` arbeiten weiter zeilenweise und bleiben
   unverändert korrekt.
2. **Nicht nur `geplant/` lesen.** In `700-messung-alpha` hält
   `stand/offene-fragen.md` weitere Wartezustände, die nie ein Checkpoint
   geworden sind. Da `@wartet` eine Zeilen-Konvention ist, kostet es nichts,
   alle Projekt-Markdown-Dateien zu scannen statt nur den DAG — und ohne das
   sieht das Board einen Teil der Wahrheit nicht.
3. **Freitext unangetastet durchreichen.** Manche Projektdokus sind auf
   ASCII-Transliteration festgelegt (`ae`, `oe`, `ue`, `ss`). Keine
   Normalisierung, keine Umlautprüfung, kein „Korrigieren" von Feldwerten.

**Der Härtetest für Stufe 1 ist die rechte Spalte, nicht die linke.** Eine
Präsenzanzeige, die nur Prozesszustände kann, zeigt hektisch an, was sich von
selbst in fünf Minuten erledigt, und schweigt über das, was seit drei Wochen
liegt. Die Fällig-Logik in `collectDeadlines()` ist das passende Vorbild und
sollte erweitert, nicht dupliziert werden.

### 1.0b Offene Frage: vom `cwd` zum adressierbaren Namen

Der Hook-Payload enthält `session_id`, `cwd`, `transcript_path` — aber **nicht**
den Namen, unter dem `SendMessage` die Session adressiert. Janus kann also nach
Stufe 1 sagen „in `q_backend` arbeitet eine Session", aber nicht „schreib
`q-backend-14`". Damit wäre der Verzeichnisdienst auf halbem Weg stehen
geblieben.

Zu prüfen, in dieser Reihenfolge:

1. **Selbstregistrierung (bevorzugt).** Eine Session kennt ihren eigenen Namen
   (`ListAgents` beantwortet das für die aufrufende Session). Eine Zeile in der
   `AGENTS.md` — „trage zu Beginn deinen `ListAgents`-Namen in
   `~/.janus/agenten/<session_id>.json` unter `name` nach" — schließt die Lücke
   und funktioniert für **jeden** Agenten, auch für Copilot.
2. **Ableitung (bestätigtes Muster).** Über zwei Maschinen hinweg beobachtet:
   `q_backend` → `q-backend-14`, `crm` → `crm-53`, `janus` → `janus-e0` /
   `janus-c2`, `z1` → `z1-3a`, `bretten` → `bretten-79`,
   `webrtc_autonomi_project` → `webrtc-autonomi-project-51`. Also
   **slugifizierter Verzeichnisname + kurzes Suffix** — Janus kann die Adresse
   damit als Standardwert *ableiten*, ohne zu fragen. Zwei Einschränkungen:
   Remote-Control-Sessions tragen stattdessen Konversationstitel, und das
   Suffix ist nicht vorhersagbar. Taugt als Vorschlag („vermutlich
   `q-backend-…`"), nicht als Zusicherung.
3. **Ohne Namen anzeigen.** Notfalls zeigt Janus nur Projekt und Zustand; das
   Adressieren bleibt manuell über `ListAgents`. Funktioniert, löst Problem 4
   aber nicht.

Weg 1 zuerst umsetzen; er ist billig und trägt am weitesten.

### 1.1 Hook-Skript

Neu: `~/.janus/hooks/praesenz.sh` (maschinen-lokal, nicht im Repo). Liest den
Hook-Payload als JSON von stdin und schreibt eine Zustandsdatei pro Session.

```bash
#!/usr/bin/env bash
# Janus-Präsenz: schreibt den Zustand dieser Session nach ~/.janus/agenten/.
set -euo pipefail
dir="${JANUS_PRAESENZ_DIR:-$HOME/.janus/agenten}"
mkdir -p "$dir"

payload="$(cat)"
sid="$(jq -r '.session_id // "unbekannt"' <<<"$payload")"
event="$(jq -r '.hook_event_name // ""' <<<"$payload")"
ntyp="$(jq -r '.notification_type // ""' <<<"$payload")"
cwd="$(jq -r '.cwd // ""' <<<"$payload")"
transcript="$(jq -r '.transcript_path // ""' <<<"$payload")"
frage="$(jq -r '.notification_text // ""' <<<"$payload")"

case "$event" in
  SessionStart)             status="arbeitet" ;;
  Stop)                     status="idle" ;;
  StopFailure)              status="fehler" ;;
  SessionEnd)               status="beendet" ;;
  Notification)
    case "$ntyp" in
      agent_needs_input|idle_prompt|permission_prompt) status="wartet" ;;
      agent_completed)                                 status="idle" ;;
      *)                                               status="arbeitet" ;;
    esac ;;
  *)                        status="arbeitet" ;;
esac

if [ "$status" = "beendet" ]; then
  rm -f "$dir/$sid.json"
  exit 0
fi

jq -n --arg sid "$sid" --arg status "$status" --arg cwd "$cwd" \
      --arg host "$(hostname)" --arg transcript "$transcript" \
      --arg frage "$frage" --arg seit "$(date -Iseconds)" \
      '{session_id:$sid, status:$status, cwd:$cwd, host:$host,
        transcript:$transcript, frage:$frage, seit:$seit}' \
  > "$dir/$sid.json.tmp"
mv "$dir/$sid.json.tmp" "$dir/$sid.json"   # atomar, kein halber Zustand
```

`chmod +x`. Abhängigkeit: `jq`.

> **Hinweis für die Umsetzung:** Die Feldnamen stammen aus der Hook-Referenz
> (code.claude.com/docs/en/hooks, abgerufen 2026-09-11). Vor dem Feinschliff
> einmal `cat > /tmp/hook-payload.json` als Hook-Kommando eintragen und die
> echten Payloads gegenprüfen — insbesondere ob `notification_text` die Frage
> enthält und wie `SessionEnd` bei Crash/Kill aussieht.

### 1.2 Hook-Registrierung

In `~/.claude/settings.json` (Nutzer-Ebene, gilt für alle Sessions dieser
Maschine). Die Datei hat aktuell **keinen** `hooks`-Block — nur ergänzen, den
vorhandenen `autoMode`-Block nicht anfassen.

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "$HOME/.janus/hooks/praesenz.sh", "async": true }] }
    ],
    "Notification": [
      { "matcher": "agent_needs_input|idle_prompt|permission_prompt|agent_completed",
        "hooks": [{ "type": "command", "command": "$HOME/.janus/hooks/praesenz.sh", "async": true }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "$HOME/.janus/hooks/praesenz.sh", "async": true }] }
    ],
    "StopFailure": [
      { "hooks": [{ "type": "command", "command": "$HOME/.janus/hooks/praesenz.sh", "async": true }] }
    ],
    "SessionEnd": [
      { "hooks": [{ "type": "command", "command": "$HOME/.janus/hooks/praesenz.sh", "async": true }] }
    ]
  }
}
```

`async: true` ist wichtig — die Präsenzmeldung darf die Session nie blockieren.

### 1.3 Janus liest die Präsenz

Neu: `src/lib/server/agenten.js`

```js
/**
 * Präsenz der Agenten-Sessions dieser Maschine. Die Dateien schreibt ein
 * Claude-Code-Hook (~/.janus/hooks/praesenz.sh); Janus liest sie nur.
 * Laufzeitzustand, bewusst außerhalb jedes Repos.
 */
export function praesenzDir()            // ~/.janus/agenten, per JANUS_PRAESENZ_DIR übersteuerbar
export function ladeAgenten(reg)         // -> [{ session_id, status, seit, wartetSeitMin,
                                         //       projektId, projektTitel, host, frage, veraltet }]
```

Kernpunkte der Umsetzung:

- **cwd → Projekt auflösen** über die bestehende `registry()` aus
  `projects.js`: längster Präfix-Treffer von `entry.repoPath` (verlinkte Repos)
  bzw. `entry.dir` (zentraler Store) auf den `cwd` der Session. Kein Treffer =
  `projektId: null` („außerhalb von Janus").
- **Verwaiste Einträge:** stirbt eine Session hart, bleibt die Datei liegen.
  Einträge älter als 24 h als `veraltet` markieren und nicht mehr als „wartet"
  zählen. Aufräumen beim Lesen ist erlaubt (Datei löschen), aber nicht nötig.
- **`hidden` respektieren** wie in `listProjects()` / `sidebarProjects()` —
  ausgeblendete Projekte tauchen auch hier nicht auf.
- Keine Exception nach außen: fehlt das Verzeichnis, ist die Liste leer.

### 1.4 Dashboard-Anzeige

- `src/routes/+page.server.js`: `agenten: ladeAgenten(registry())` ins `load()`.
- `src/routes/+page.svelte`: neue Zeile **über** der Fällig-Liste, gleiche
  Gestaltung. Wartende zuerst, längste Wartezeit oben:

  > **2 Agenten warten** · q_backend — 28 min · crm — 3 min

  Je Eintrag: Projekttitel (verlinkt auf `/projekt/<id>`), Status-Punkt
  (`wartet` = auffällig, `arbeitet` = ruhig, `idle` = grau), Wartedauer,
  und die Frage als `title`-Tooltip, falls vorhanden. Läuft nichts, wird die
  Zeile ganz weggelassen — kein leerer Kasten.
- Neue Komponente `src/lib/components/AgentenZeile.svelte`, orientiert an
  `Termine.svelte` / `ProjectCard.svelte`.
- Auto-Refresh: `data.agenten` alle ~15 s über `invalidate()` neu laden. Nur
  auf der Dashboard-Route, nur wenn der Tab sichtbar ist
  (`document.visibilityState`).

### 1.5 Abnahme Stufe 1

- [ ] Zweite Claude-Code-Session in einem verlinkten Repo öffnen → erscheint
      binnen 15 s als „arbeitet".
- [ ] Diese Session etwas fragen lassen → wechselt auf „wartet", Dauer zählt hoch.
- [ ] Antworten → zurück auf „arbeitet", dann „idle".
- [ ] Session beenden → verschwindet.
- [ ] Session hart killen → nach 24 h `veraltet`, vorher kein Fehler.
- [ ] Janus ohne `~/.janus/agenten/` starten → Dashboard unverändert, kein Fehler.
- [ ] Ausgeblendetes Projekt (`hidden`) taucht nicht auf.
- [ ] Präsenzdateien liegen in **keinem** `git status`.
- [ ] `@wartet(...)` an einem Checkpoint → erscheint als sachliches Warten mit
      Kategorie und Tageszählung, auch wenn dort **keine** Session läuft.
- [ ] Beide Wartearten sind in der Anzeige auseinanderzuhalten.
- [ ] Ein Checkpoint mit `@wartet` auf einer **umbrochenen** Zeile wird korrekt
      erkannt und dem richtigen Checkpoint zugeordnet.
- [ ] `@wartet` in `stand/offene-fragen.md` (also außerhalb von `geplant/`)
      wird gefunden.
- [ ] Ein Knoten mit acht offenen Checkpoints, von denen zwei warten, zeigt
      **zwei** Wartende — nicht den ganzen Knoten als blockiert.
- [ ] `zugang`-Einträge erzeugen ohne `nach:` **keine** Wiedervorlage.
- [ ] Freitext mit ASCII-Transliteration (`pruefen`, `klaeren`) kommt
      unverändert durch.
- [ ] Härtetest an `700-messung-alpha`: die elf realen Wartezustände in fünf
      Knoten werden sichtbar, korrekt kategorisiert — und die *unversandten
      Bitten* erscheinen **nicht** als Warten, sondern als offene Aufgabe.
- [ ] Janus nennt zu einem Projekt einen adressierbaren Namen, oder sagt
      ehrlich, dass er unbekannt ist.

---

## Stufe 2 — Vermittlung

Löst Probleme 2 und 3. Baut auf Stufe 1 auf.

### 2.1 Was gesichert funktioniert

`SendMessage` zwischen Sessions ist verifiziert. Eine Vermittlung ist damit:
zwei Nachrichten mit einem gemeinsamen Thema und einer Vermittlungs-ID.

### 2.2 Datenmodell

`~/.janus/vermittlungen/<id>.json` — und zusätzlich, als Lingua-Franca-Kopie,
`<projekt>/.janus/postfach/<vermittlungs-id>.md` in **jedem** beteiligten
Projekt, damit auch Nicht-Claude-Agenten mitlesen können.

```json
{
  "id": "v-2026-09-11-a3f",
  "thema": "Datenserver q_backend für crm-Integrationstest starten",
  "teilnehmer": [
    { "session": "crm-53",       "projekt": "crm",       "rolle": "bittet" },
    { "session": "q-backend-14", "projekt": "q_backend", "rolle": "liefert" }
  ],
  "eroeffnet": "2026-09-11T14:20:00+02:00",
  "status": "offen",
  "log": [{ "von": "crm-53", "zeit": "…", "text": "…" }]
}
```

### 2.3 Der Anstoß: das Minion-Muster

> **Korrektur zur ersten Fassung dieses Plans.** Dort stand, Janus könne eine
> laufende Session nicht anstoßen. Das war zu pessimistisch — richtig ist nur,
> dass Janus nicht *anklopfen* kann. Die Session kann aber **hinauswählen** und
> den Kanal offen halten.

Das Vorbild ist SaltStack: der Minion verbindet sich zum Master, nicht
umgekehrt; der Master initiiert nie eine Verbindung. Dadurch funktioniert es
durch NAT und Firewalls hindurch. Dieselbe Umkehrung löst hier dasselbe Problem.

**Der Mechanismus** (Hook-Referenz, abgerufen 2026-09-11):

> `asyncRewake` — „If `true`, runs in the background and **wakes Claude on exit
> code 2**. The hook's stderr, or stdout if stderr is empty, is shown to Claude
> as a system reminder so it can react to a long-running background failure."

Daraus die Schleife:

| Auslöser | Wirkung |
|---|---|
| `Stop`-Hook (Turn zu Ende) | startet im Hintergrund einen Long-Poll gegen Janus, `asyncRewake: true` |
| Janus hat nichts | Poll läuft in den Timeout, `exit 0` — nichts passiert |
| Janus hat eine Nachricht | Skript schreibt sie nach stderr, `exit 2` → Session wacht auf, sieht sie als System-Reminder |
| Session hat sie bearbeitet | `Stop` feuert erneut → neuer Long-Poll |

Damit hängt jede offene Session dauerhaft an Janus, ohne dass Janus je eine
Verbindung öffnet. **Nebeneffekt, der die Architektur trägt: Janus muss nicht
auf derselben Maschine stehen.** Der Minion wählt hinaus — Firewall und NAT
sind egal. Das ist der Unterschied zu `FileChanged`, das nur lokal wirkt.

**Zwei Transportwege, dieselbe Semantik:**

1. **Minion-Long-Poll (bevorzugt).** Cross-Machine, braucht laufenden Janus.
2. **`FileChanged` (Rückfall).** Lokal, kein Server nötig. Matcher sind laut
   Doku *literale Dateinamen* (nur Buchstaben, Ziffern, `_`, `|`) — ein fester
   Name wie `janus_postfach` ist also Pflicht, Pfadmuster funktionieren nicht.

#### 2.3.1 Gemessen am 2026-09-11 — der Kanal trägt

Experiment durchgeführt, Claude Code 2.1.268, WSL2. Ein `Stop`-Hook mit
`asyncRewake: true`, einschüssig (Selbstentschärfung vor dem Feuern), der nach
einer Wartezeit `exit 2` mit Text auf stderr liefert.

**Durchlauf 2 (sauber, ohne Nutzereingabe):**

```
14:34:29  Turn beendet -> Hook startet im Hintergrund, entschaerft sich
          -- 40 s leerer Prompt, nachweislich keine Eingabe --
14:35:09  exit 2 -> Session wird geweckt, Text kommt an
```

| Frage | Ergebnis |
|---|---|
| Weckt `exit 2` eine **wirklich untätige** Session? | **Ja.** 40 s Leerlauf, keine Eingabe, Weckung kam von selbst |
| Kommt der stderr-Text vollständig an? | **Ja**, wortgleich, mehrzeilig, als System-Reminder |
| Überlebt der Hintergrundprozess das Turn-Ende? | **Ja** |
| Gehen Eingaben verloren, wenn der Mensch währenddessen tippt? | **Nein** — in Durchlauf 1 kam die Nachricht des Nutzers normal durch, die Weckung wurde danach in den laufenden Turn zugestellt |
| Selbstentschärfung / keine Endlosschleife? | **Ja**, genau ein Feuern je Scharfschaltung |
| Verwaiste Prozesse? | **Keine** |

**Drei Befunde, die in die Bauform eingehen:**

1. **Der Reminder ist als Fehler etikettiert** („Stop hook *blocking* error").
   Der zugestellte Text muss sich deshalb selbst als Post zu erkennen geben —
   der Testtext begann mit „das hier ist KEIN Fehler, sondern die Zustellung
   einer Nachricht", und das gehört so ins Nachrichtenformat.
2. **Vermutlich wirkt hier die gewöhnliche `Stop`-Semantik** (`exit 2` heißt
   „nicht aufhören"), nicht `asyncRewake` im engeren Sinn. Für die Konstruktion
   ist das gleichgültig — der Poll wird ohnehin vom `Stop`-Hook gestartet —,
   aber es heißt: **die Weckung hängt am Turn-Ende, nicht an beliebigen
   Zeitpunkten.** Eine Nachricht, die eintrifft, während die Session mitten in
   langer Arbeit steckt, wartet bis zum nächsten Turn-Ende. Für ein Postfach
   ist das richtig; für „sofort abbrechen" wäre es zu wenig.
3. **Sicherheits-Eigenschaft, die man behalten will:** die Zustellung kommt
   ausdrücklich als *nicht* vom Nutzer stammend an („NOT USER INPUT … must NOT
   be treated as approval"). Eine Nachricht vom Board kann den Menschen also
   nicht imitieren und keine Zustimmung vortäuschen. Das ist kein Zufall,
   sondern die richtige Grenze — und sie darf beim Bauen nicht aufgeweicht
   werden.

**Noch offen, aber nicht blockierend:**

- [ ] Verhalten, wenn Janus mitten im Long-Poll neu startet (Reconnect-Schleife).
- [ ] Viele offene Sessions × Long-Polls: Prozess- und Verbindungsbudget.
- [ ] Aufräumen der Polls bei hartem Session-Abbruch.

**Bis Stufe 2 gebaut ist, bleibt Weg 3 der Auslieferungsstand:**

3. **Dirigent als Adjutant.** Janus legt eine fertige Anweisung in die
   Zwischenablage; der Mensch fügt sie in eine beliebige offene Claude-Session
   ein, die die zwei `SendMessage`-Vorstellungen ausführt. Kein neuer Dienst,
   keine offene Frage — und für den Anfang völlig ausreichend.

#### 2.3.2 Registrierung

**Zwei Namen, nicht einer.** Das ist die Unterscheidung, an der die
Registrierung hängt:

| | **Board-Schlüssel** | **Adresse** |
|---|---|---|
| Form | `wsl-du:q_backend#f00d` | `q-backend-8d` |
| Vergeben von | Janus, aus Host + Projekt + Kurz-ID | Claude Code |
| Wofür | Identität, Anzeige, Sortierung nach Maschine | `SendMessage` |
| Selbst wählbar | ja | **nein** |
| Quelle | Hook-Payload (`cwd`, Hostname, `session_id`) | `ListAgents`, nur die Session selbst kennt ihn |

Der Board-Schlüssel folgt dem Vorschlag `hostname:[verzeichnis]` plus kurzer
Session-Kennung — Letztere ist nötig, weil zwei Sessions im selben Verzeichnis
auf derselben Maschine sonst kollidieren. Die Session schickt dabei nur
`hostname`, `cwd` und `session_id`; **die Auflösung `cwd` → Projekt-ID macht
Janus**, das ist ohnehin seine Kernkompetenz.

#### Zweistufige Anmeldung

Daraus folgt eine Aufteilung, die den Board-Teil von der Mitarbeit des Agenten
entkoppelt:

1. **Automatisch, durch den Hook.** `SessionStart` meldet Host, `cwd` und
   `session_id`. Danach weiß das Board: hier läuft eine Session, in diesem
   Projekt, auf dieser Maschine. **Ohne jedes Zutun des Agenten** — das trägt
   Stufe 1 vollständig.
2. **Einmalig, durch den Agenten.** Er trägt seinen `ListAgents`-Namen nach und
   ist damit adressierbar. Nur das braucht Kooperation.

Fällt Schritt 2 aus, zeigt das Board die Session trotzdem an und sagt ehrlich
„Adresse unbekannt". Kein stiller Ausfall.

**Die stabile Adresse ist ohnehin das Projekt, nicht die Session.** Sessions
kommen und gehen, ihre Kurz-IDs wechseln; `q_backend` bleibt. Der
Verzeichnisdienst beantwortet deshalb nicht „wo ist Session X", sondern *„wer
ist gerade für `q_backend` zuständig?"* — und nennt die aktuelle Session.

#### Anweisung im Projekt

Wie vorgeschlagen steht sie im Projekt, nicht in einer Zentrale.
`.janus/AGENTS.md` wird ohnehin schon in jedes Projekt gescaffoldet
(`scaffold.js`) — dort kommt ein Abschnitt hinein:

```markdown
## Anmeldung am Janus-Board

Janus läuft auf <janus_url> (Vorgabe http://localhost:5173).
Melde dich zu Beginn einmal an:

  POST <janus_url>/api/agent/register
  { "session_id": "...", "name": "<dein ListAgents-Name>", "cwd": "..." }

Der Name ist wichtig: er ist die Adresse, unter der dich andere Agenten
erreichen. Ohne ihn kennt das Board dein Projekt, aber niemand kann dich
ansprechen.
```

Die `janus_url` gehört in `janus.config.json`, damit ein Projekt weiß, wohin es
sich meldet — der „Link zum Janus-Server", der die Konstruktion zusammenhält.

Das schließt zugleich die offene Frage aus 1.0b: die Adresse kommt aus der
Selbstregistrierung, nicht aus dem Hook-Payload. Und es funktioniert für
**jeden** Agenten, der HTTP sprechen kann — Copilot eingeschlossen; dort
entfällt nur Stufe 1 der Anmeldung, weil es keine Hooks gibt, also meldet sich
der Agent selbst mit beidem. Der Unterschied bleibt allein beim Empfangen:
Claude Code bekommt den Minion-Push, alle anderen pollen oder werden gefragt.

### 2.4 Abnahme Stufe 2

- [ ] Zwei Sessions zusammenschalten, beide bestätigen den Erhalt.
- [ ] Der gebetene Agent erledigt die Aufgabe im eigenen Repo, ohne dass der
      bittende Agent sich dort einlesen musste.
- [ ] Vermittlung erscheint in Janus als offener Kanal, lässt sich schließen.
- [ ] Postfach-Datei liegt in beiden Projekten und ist ohne Janus lesbar.

---

## Stufe 3 — Kanäle mit Verlauf

Erst nach 1 und 2, und erst wenn 2 sich im Alltag bewährt.

- Offene Vermittlungen als Liste: Thema, Teilnehmer, letzte Aktivität.
- Verlauf je Vermittlung aus den Postfach-Dateien.
- Damit entsteht das IRC-Gefühl — Präsenz und Verlauf — ohne IRC-Daemon.

---

## Fremde Agenten (GitHub Copilot, Codex, Cursor …)

Der entscheidende Punkt: **Push für Claude Code, Pull für alle anderen.** Weil
jeder Austausch zusätzlich als Datei existiert, ist Teilnahme nie an einen
Hersteller gebunden.

| | Claude Code | Copilot & Co. |
|---|---|---|
| **Präsenz melden** | Hook, automatisch | Selbstauskunft per Anweisung, oder manuell in Janus |
| **Nachricht empfangen** | `SendMessage`, Push | Postfach-Datei, Pull |
| **Nachricht senden** | `SendMessage` | Datei ins Postfach schreiben |
| **Wird gesehen in Janus** | ja | ja |

### Präsenz

Copilot hat kein Hook-System. Zwei Möglichkeiten:

1. **Selbstauskunft.** Copilot liest `AGENTS.md` — laut GitHub-Doku „die
   nächstgelegene AGENTS.md im Verzeichnisbaum hat Vorrang", unterstützt in
   Copilot Chat, Cloud-Agent und Code Review. Janus **scaffoldet bereits eine
   AGENTS.md in jedes Projekt** (`src/lib/server/scaffold.js`) — der Kanal
   existiert also schon, er muss nur benutzt werden. Ergänzen um:

   > **Präsenz:** Schreibe zu Beginn deiner Arbeit und wenn du auf eine
   > Rückmeldung wartest eine Datei `~/.janus/agenten/copilot-<repo>.json` mit
   > `{"session_id","status","cwd","host","seit"}`; `status` ist `arbeitet`
   > oder `wartet`. Lösche sie, wenn du fertig bist.
   >
   > **Postfach:** Prüfe `.janus/postfach/` auf offene Nachrichten an dich,
   > bevor du eine größere Aufgabe beginnst.

   Weniger zuverlässig als ein Hook — es hängt an der Befolgung durch das
   Modell. Dafür null Infrastruktur.
2. **Manueller Schalter** in Janus: „hier arbeite ich gerade mit Copilot".
   Ehrlich und immer korrekt, kostet einen Klick.

Beides umsetzen; die Selbstauskunft ist der Normalfall, der Schalter der
Rückfallweg.

### Nachrichten

Ein Copilot-Kontext kann nicht angestoßen werden — nur gelesen werden, wenn der
Mensch ihn bittet. Praktisch: „schau in dein Postfach". Das ist eine echte
Einschränkung und soll in der UI sichtbar sein: Janus markiert Teilnehmer ohne
Push-Weg als **Pull-Teilnehmer**, damit klar ist, dass dort nichts von selbst
ankommt.

### Später: Janus als MCP-Server

Der herstellerneutrale Ausbau. Copilot, Claude Code und Cursor unterstützen alle
MCP. Ein kleiner Janus-MCP-Server mit `janus_praesenz`, `janus_postfach_lesen`
und `janus_melden` gäbe allen dieselbe Schnittstelle — und ersetzt die
Dateikonventionen durch echte Werkzeuge. Erst sinnvoll, wenn Stufe 1–3 im
Alltag tragen.

---

## Reihenfolge

1. Stufe 1 komplett, inklusive Abnahme. Allein das löst das Hauptproblem.
   Dabei zuerst `@wartet(...)` und die Selbstregistrierung des Namens — beide
   sind billig und tragen weiter als die Hook-Mechanik. Die `@wartet`-Regeln
   gehören dabei in `FORMAT.md` **und** in das `AGENTS.md`-Scaffold, besonders
   die Regel „`seit:` ist das Datum des Fragens" — ohne sie sammelt das Board
   Ausreden statt Arbeit sichtbar zu machen.
2. Copilot-Selbstauskunft in `scaffold.js` und in die bestehenden `AGENTS.md`.
3. Stufe 2 auf Weg 1 (Dirigent als Adjutant).
4. Weg 2 in einer Spielwiese prüfen. Trägt er, Stufe 3. Trägt er nicht, bleibt
   es beim Dirigenten — was völlig in Ordnung ist.

## Nicht vergessen

- `.gitignore`: sicherstellen, dass nichts aus `~/.janus/` je im Repo landet
  (liegt außerhalb, aber ein Symlink oder ein umkonfiguriertes
  `JANUS_PRAESENZ_DIR` könnte das ändern).
- `FORMAT.md` und `README.md` um den Abschnitt „Agenten-Board" ergänzen, sobald
  Stufe 1 steht — Janus dokumentiert sich selbst konsequent.
- `.janus/geplant/agenten-board.md` als DAG-Knoten anlegen (Dogfooding), mit
  Checkpoints aus den Abnahmelisten oben, `depends_on: []`.
- Eintrag in `.janus/stand/chronik.md` beim Release.

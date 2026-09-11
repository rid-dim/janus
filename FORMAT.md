# Projektformat

Ein Projekt ist ein Ordner mit einer `projekt.yaml`. Janus findet Projekte aus
zwei Quellen (`janus.config.json`):

```json
{
  "dataRoot": "~/projekte",                    // zentraler Store: 1 Unterordner pro Projekt
  "projects": ["~/dev/repo-a", "~/dev/repo-b"], // verlinkte Repos (In-Repo-Tracking)
  "projectDir": ".janus",                       // Unterordnername im Repo (Standard: .janus)
  "hidden": ["projekt-id"],                     // lokal ausblenden
  "reihenfolge": ["wichtig", "weniger"]         // lokale Sortierung der Kacheln
}
```

- **Zentraler Store:** jeder Unterordner von `dataRoot` mit `projekt.yaml`.
- **Verlinkte Repos:** für jeden Pfad in `projects` der Unterordner
  `<pfad>/<projectDir>/` (z. B. `~/dev/repo-a/.janus/`). So wird der Stand mit
  dem Repo versioniert und synchronisiert.

Die Projekt-`id` (in der URL `/projekt/<id>`) ist das Frontmatter-`id` bzw. der
Ordnername; bei Namensgleichheit hängt Janus einen kurzen Hash an.

## Ordneraufbau eines Projekts

```
<dataRoot>/
  <projekt-id>/
    projekt.yaml
    stand/          *.md   – aktueller Stand (ein Thema pro Datei)
    wissen/         *.md   – Wissensbasis/Wiki (Referenz-Seiten, Unterordner erlaubt)
    geplant/        *.md   – geplante Schritte (ein DAG-Knoten pro Datei)
    abgeschlossen/  *.md   – Archiv beendeter Knoten (optional, gleiches Format)
    anhaenge/              – lokaler Document Store (beliebige Dateien)
    AGENTS.md              – optionale Hinweise für Coding-Agents
```

Die Ordnername ist die `projekt-id` (in der URL: `/projekt/<projekt-id>`).

## projekt.yaml

```yaml
schemaVersion: 2            # für spätere Migrationen (2 = mit wissen/-Wiki)
titel: Mein Projekt
status: aktiv               # aktiv | inaktiv | fertig
beschreibung: Einzeiler fürs Dashboard.
tags: [tooling, kunde-x]
stand_reihenfolge:          # optional: Reihenfolge der stand/-Sektionen
  - 00-ueberblick
  - architektur
wissen_hubs: [cnc-wissen]   # optional: Projekt-IDs als Wissens-Hubs (s. u.)
```

### Projektstatus

`aktiv` (Vorgabe), `inaktiv` oder `fertig`. „in-arbeit" war als *Projekt*status
schief: es beschreibt einen Knoten, der gerade bearbeitet wird, nicht ein
Projekt. Ein Projekt ist aktiv oder es ruht – ob gerade jemand daran arbeitet,
sagt das Zahnrad auf der Kachel.

Ältere Schreibweisen werden beim Lesen übersetzt (`in-arbeit`, `laufend`, `wip`
→ `aktiv`; `ruht`, `pausiert`, `on-hold` → `inaktiv`; `erledigt`,
`abgeschlossen`, `done` → `fertig`). Bestehende Dateien müssen also nicht
angefasst werden.

## stand/\*.md

Freies Markdown, ein Thema pro Datei. Optionales Frontmatter `title:` (sonst
wird der Titel aus dem Dateinamen abgeleitet). Erlaubt sind Task-Lists,
`plotly`-Blöcke und Dokument-Links (siehe unten).

`pin: right` heftet eine Datei als rechte Seitenleiste an die Projektseite.
Sind **mehrere** Dateien gepinnt, erscheinen sie dort als Tabs (Beschriftung =
`title`); die zuletzt gewählte Datei merkt sich der Browser pro Projekt.

### Termine & Wiedervorlagen (`typ: termine`)

Eine `stand/`-Datei mit `typ: termine` im Frontmatter (typisch
`stand/termine.md`, meist zusätzlich `pin: right`) ist die Wiedervorlage-Liste
des Projekts – das Spiegelbild der Chronik nach vorn. Die Datei bleibt die
Quelle der Wahrheit und darf **unsortiert** sein: Janus liest jeden
Listeneintrag, erkennt die Datumsangabe am Zeilenanfang und sortiert selbst
nach Aktualität (Überfällig / sofort · nächste 7 Tage · nächste 30 Tage ·
weiter draußen). Empfohlene feste Struktur – bewusst **ohne** relative
Überschriften wie „Nächste 30 Tage“, die still veralten:

```markdown
## Sofort                      # optional: undatierte Einträge hier gelten als *sofort*
- **Lüfter Trockenraum**: Angebot liegt vor, Freigabe des Beirats abwarten.

## Termine                     # alles Datierte, Reihenfolge egal, Neues oben
- **04.09.2026** — Einzug Prüfrechnungen vom Mietkonto.
- **06.09.2026 (So)** — Schlüsselübergabe (`geplant/schluessel`).
- **~08.09.2026** — Entwürfe da? Sonst nachhaken.
- **Oktober/November 2026** — Umlaufbeschluss durchführen.
- **bis ~Ende Oktober 2026** — Bad beauftragen.
- ~~**28.08.2026** — Formular abschicken~~ erledigt 27.08.

## Ohne Datum (bei Gelegenheit)
- Objekt-Stammdatenblatt anlegen.

## Referenz-Fristen (Verträge)
- **Verwaltervertrag:** kündbar mit 1 Monat zum Monatsende.
```

Überschriften zählen nur als Jahres-Kontext (`## September 2026`) bzw. als
Dringlichkeits-Signal (enthält die Überschrift „sofort“ oder „überfällig“,
gelten undatierte Einträge darunter als *sofort*).

**Pflege-Regeln** (gehören so in die `AGENTS.md` des Projekts): Datum absolut
und fett am Zeilenanfang; Erledigtes durchstreichen und mit „erledigt TT.MM.“
versehen statt löschen (älter als 30 Tage darf raus – die Chronik hat es);
zum Sessionstart das heutige Datum nennen und Überfälliges plus alles bis
heute + 7 Tage aufzählen. Sortieren muss niemand.

Erkannt werden: `04.09.2026`, `21.08.`, `06.09.2026 (So)`, `~08.09.2026` /
`ca.` (circa), `Anfang|Mitte|Ende September`, `Oktober 2026`,
`Oktober/November 2026`, `Okt–Dez 2026`, `KW 37`, `Q1 2027`,
`Frühjahr|Sommer|Herbst|Winter 2027`, `2027` sowie die Präfixe `ab`, `bis`,
`spätestens`. Fehlt das Jahr, gilt die Abschnittsüberschrift, sonst das
laufende Jahr (liegt der Monat > 2 Monate zurück: das nächste). Durchgestrichene
(`~~…~~`) oder mit ✓/„erledigt“ beginnende Einträge landen eingeklappt unter
„Erledigt“; Einträge ohne erkennbares Datum bleiben unter ihrer Überschrift in
Dateireihenfolge stehen. Beginnt so ein Eintrag trotzdem wie eine Datumsangabe
(„nächste Woche“, „nach der ETV“, „in 3 Wochen“), zeigt die Ansicht den
Hinweis **„Datum nicht erkannt“** – das Signal, die Angabe absolut zu schreiben.

Datierte, nicht erledigte Einträge speisen zusätzlich die **Fällig-Liste** des
Dashboards (zusammen mit `ende:` der Knoten).

## wissen/\*.md – die Wissensbasis (Wiki)

Referenz-Seiten, die nicht mit dem Projektfortschritt veralten, sondern
wachsen — gerendert in der **Wiki-Linse** (`/projekt/<id>/wiki`) mit
Seitenbaum, Backlinks und Suche. Unterordner sind erlaubt und werden im Baum
zu Gruppen (`wissen/werkstoffe/alu-6061.md`).

- **Identität = Dateiname**: der Slug ist der Pfad unter `wissen/` ohne `.md`
  (z. B. `werkstoffe/alu-6061`). Frontmatter `title:` liefert den Anzeigenamen.
- **Wikilinks**: `[[slug]]`, `[[unterordner/slug]]` oder `[[slug|Linktext]]` –
  funktionieren in *allen* Markdown-Dateien des Projekts (auch `stand/` und
  `geplant/`) und zeigen immer auf `wissen/`-Seiten. Ein Link auf eine noch
  fehlende Seite wird als **Rotlink** gerendert; Klick legt die Seite an.
  Rotlinks sind Feature, nicht Fehler: sie markieren Schreib-Bedarf.
- **Aktualität**: optionales Frontmatter `geprueft: JJJJ-MM-TT` („zuletzt
  inhaltlich bestätigt am"). Seiten mit altem oder fehlendem Stempel listet
  die Pflege-Sektion der Wiki-Sidebar — zusammen mit Rotlinks und Seiten
  ohne eingehende Links.
- Projekte mit `wissen/` verwenden `schemaVersion: 2` (die Migration von 1
  ist trivial: Ordner anlegen, Referenz-Seiten bei Bedarf aus `stand/`
  verschieben).

### Wissens-Hubs (geteiltes Wissen)

Eine Wissensbasis, die mehreren Projekten dient, **ist selbst ein
Janus-Projekt** (ggf. fast nur `wissen/`). Andere Projekte binden sie als
reine **Lese-Referenz** ein — nichts wird kopiert:

```yaml
wissen_hubs: [cnc-wissen, firmen-wissen]   # Projekt-IDs, Reihenfolge zählt
```

- Die Wiki-Linse blendet Hub-Seitenbäume read-only unter „aus <Hub>" ein;
  bearbeitet wird immer im Hub-Projekt selbst.
- `[[slug]]` löst **erst lokal, dann in den Hubs** auf (Deklarations-
  Reihenfolge); `[[hub-id/slug]]` adressiert einen Hub explizit. Erst wenn
  nichts trifft, ist es ein Rotlink (angelegt würde lokal).
- Backlinks sind projektübergreifend: eine Hub-Seite zeigt auch, welche
  anderen Projekte auf sie verweisen.
- Trägt eine lokale Seite denselben Slug wie eine Hub-Seite, gewinnt lokal;
  die Pflege-Sektion warnt vor der Kollision.
- Hub-von-Hub wird bewusst **nicht** transitiv aufgelöst.

## geplant/\*.md – die DAG-Knoten

Ein Knoten pro Datei. Die Kanten des Graphen entstehen aus `depends_on`.

```markdown
---
id: release-v1
title: Release v1
status: offen                       # offen | in-arbeit | fertig
depends_on: [markdown-plotly, dag-ansicht, checkbox-writeback]
start: 2026-05-01                   # optional – nur für die Zeitleiste
ende: 2026-06-30                    # optional – fehlt = läuft bis heute
---

## Checkpoints
- [ ] Punkt A
- [x] Punkt B
```

- `depends_on` darf sich **verzweigen** (mehrere Knoten hängen an einem) und
  wieder **zusammenlaufen** (ein Knoten hängt an mehreren) – daher DAG, nicht Baum.
- Fehlt `id`, wird der Dateiname (ohne `.md`) verwendet.
- Der Fortschritt eines Knotens = abgehakte / gesamte Checkpoints im Body.
- `start:` / `ende:` sind optional (`JJJJ-MM-TT`, auch `TT.MM.JJJJ`) und speisen
  den Themen-Gantt der Zeitleisten-Ansicht.
- `ende:` auf einem **nicht fertigen** Knoten gilt zugleich als Fälligkeit:
  das Dashboard zeigt Überfälliges und alles, was in den nächsten 7 Tagen
  ansteht, als „Fällig"-Liste (dringlichstes zuerst).
- `pruefen: JJJJ-MM-TT` (optional) **ersetzt `ende:` als Fälligkeit**.

`ende:` heißt „hier endet die Arbeit" – das ist nicht dasselbe wie „hier ist
etwas fällig". Ein Knoten kann über sein Arbeitsende hinaus offen bleiben, ohne
dass heute etwas zu tun wäre: ein Feldtest läuft, beobachtet wird mit, geprüft
wird nächste Woche. Ohne eigenes Feld müsste man zwischen zwei schlechten
Möglichkeiten wählen – den Knoten vorzeitig schließen, obwohl das Ergebnis noch
aussteht, oder ihn täglich als fällig angezeigt bekommen, obwohl nichts anliegt.
Beides erzieht dazu, die Liste nicht mehr ernst zu nehmen.

```yaml
ende: 2026-09-11       # Testeinsatz vorbei, Container läuft weiter
pruefen: 2026-09-16    # dann wird der Speichertrend ausgewertet
```

Der Knoten verschwindet damit **ganz** aus der Fällig-Liste und taucht erst am
Prüftag wieder auf – nicht schon im 7-Tage-Vorlauf wie eine Frist. Das ist der
Unterschied zwischen beiden: eine **Frist** zeigt man früh, damit noch gehandelt
werden kann; eine **Wiedervorlage** hat keinen Vorlauf, denn bis zu ihrem Tag
gibt es nichts zu tun. Sie vorher anzuzeigen hieße, täglich an etwas zu
erinnern, das niemand angehen kann – und das ist genau die Sorte Eintrag, die
einem die Liste verleidet.

Im Gantt bleibt der Knoten über seinen `start:`/`ende:`-Zeitraum stehen; `ende:`
speist die Zeitleiste unverändert. Am Prüftag erscheint er als **prüfen**
gekennzeichnet, mit dem Arbeitsende im Tooltip, und bleibt danach als
überfällig stehen, bis er bearbeitet ist.

## abgeschlossen/\*.md – das Archiv

Gleiches Format wie `geplant/`. Beendete Themen wandern dorthin – entweder
per Button **„✓ Abschließen"** in der Knoten-Ansicht (verschiebt die Datei,
setzt `status: fertig` und `ende:` = heute, falls noch leer) oder von Hand
(Datei verschieben, der Ordner darf fehlen). **„↩ Reaktivieren"** holt einen
archivierten Knoten zurück nach `geplant/` (Status `in-arbeit`; `ende:`
bleibt stehen und gilt damit wieder als Fälligkeit).

- Archivierte Knoten erscheinen **nicht** im aktiven DAG, sondern in einer
  eingeklappten Sektion „Abgeschlossen (n)" darunter.
- Zeigt ein `geplant`-Knoten per `depends_on` auf einen archivierten Knoten,
  gilt die Abhängigkeit als erfüllt: keine Kante, kein Fehler; der Eintrag
  bleibt beim Speichern erhalten.
- Ohne `status:` gilt ein archivierter Knoten als `fertig`.

## Sachliches Warten: `@wartet(...)`

Ein Marker an *einer Checkpoint-Zeile*, der festhält, dass dieser Punkt nicht
durch Arbeit blockiert ist, sondern durch etwas außerhalb:

```markdown
- [ ] Veroeffentlichung des Svelte-5-Standes bei der ui-basics-Pflege anfragen
      @wartet(fremdstelle seit:2026-09-04 nach:7d)
```

`@wartet(<kategorie> seit:<JJJJ-MM-TT> [nach:<n>d|nie])`. Der Klartext steht
schon im Checkpoint und wird nicht wiederholt. Abgehakte Checkpoints (`- [x]`)
zählen nicht mehr als wartend.

| Kategorie | Bedeutung | Vorgabe `nach:` |
|---|---|---|
| `entscheidung` | liegt bei einem Menschen im Haus | 7 Tage |
| `fremdstelle` | fremdes Team, fremde Firma, fremde Paketpflege | 7 Tage |
| `kollege` | benannte Person, oft ereignis- statt zeitgetrieben | 7 Tage |
| `zugang` | Zeitfenster an einer Anlage, Hardware, physischer Zutritt | keine Uhr |

Drei Regeln, ohne die der Marker schadet statt zu helfen:

**1. `seit:` ist das Datum des *Fragens*, nicht des Bemerkens.** Wer den Marker
setzt, behauptet damit: die Bitte ist raus. Ein Checkpoint wie „bei X anfragen“
ohne Marker ist **kein** Warten, sondern eine offene Aufgabe – eine Aufgabe für
uns, keine Schuld der anderen. Ohne diese Regel sammelt die Anzeige Ausreden,
statt Arbeit sichtbar zu machen.

**2. Auf der Zeile, nicht am Knoten.** In der Praxis warten nie alle offenen
Checkpoints eines Knotens auf dasselbe. Knotenweit ausgezeichnet würde die
Anzeige mehr Arbeit als blockiert ausweisen, als es ist – man sähe eine
Entschuldigung statt einer Aufgabe. Ein knotenweites Feld gibt es deshalb nicht.

**3. Nur Warten, das den Graphen verlässt.** Warten auf einen anderen Knoten
desselben Projekts ist `depends_on` plus Wikilink, nicht `@wartet`. Zwei
Mechanismen für denselben Sachverhalt driften auseinander.

Eine *Erwähnung* der Syntax löst nichts aus: Marker in Backticks (`` `@wartet(...)` ``)
und innerhalb eingezäunter Blöcke werden übergangen – Doku und Chronik dürfen
das Format also zeigen, ohne Einträge zu erzeugen.

Umbrochene Checkpoints sind erlaubt – der Marker darf auf einer eingerückten
Folgezeile stehen, Janus zieht logische Einträge vor dem Auswerten zusammen.
Gesucht wird in `geplant/`, `stand/`, `abgeschlossen/` und `wissen/`: manche
Wartezustände stehen in Dateien wie `stand/offene-fragen.md` und sind nie ein
Checkpoint geworden.

## Agenten-Board (Dashboard)

Das Dashboard zeigt über allen Projekten, welche Agenten-Sessions gerade
arbeiten und welche warten – damit man einen wartenden Agenten nicht erst
bemerkt, wenn man zufällig dessen Fenster öffnet. Zwei Quellen, bewusst
getrennt gehalten:

- **Prozess-Warten** – eine Session kommt ohne Antwort nicht weiter. Kommt von
  den Claude-Code-Hooks (`hooks/praesenz.mjs`), Minuten-Uhr. Als Warten zählen
  nur `agent_needs_input` und `permission_prompt`; `idle_prompt` heißt „hier hat
  länger niemand getippt" und ist Ruhe, nicht Bedarf. Die Unterscheidung
  entscheidet, ob das Board glaubwürdig bleibt: wer einmal grundlos gerufen
  wurde, glaubt dem nächsten Ruf weniger.
- **Sachliches Warten** – die `@wartet`-Marker oben. Tage-Uhr, mit Grund,
  überlebt das Ende der Session.

Die Präsenzdateien sind Laufzeitzustand und liegen **außerhalb** jedes Repos
unter `~/.janus/agenten/` (übersteuerbar mit `JANUS_PRAESENZ_DIR`). Sie werden
nie committet.

### Zwei Adressen, nur eine davon verlässlich

Im **Kanal** ist die Adresse die **Projekt-ID**. Die stimmt immer, weil Janus
die Abbildung Projekt ↔ Verzeichnis selbst führt.

Der `ListAgents`-Name (`q-backend-8d`) gilt nur für `SendMessage` und ist
**optional**: er stammt aus einem Werkzeugaufruf des Modells und steht in
keinem Hook-Payload – ein Skript kann ihn nicht ermitteln und nicht nachtragen.
Ohne Selbstregistrierung bleibt er leer. Deshalb zeigt das Board ihn nur, wenn
er wirklich registriert wurde: eine *geratene* SendMessage-Adresse wäre
schlimmer als keine, denn das Suffix ist nicht vorhersagbar (`700-messung-alpha`
geraten gegen `700-messung-alpha-87` tatsächlich), und wer sie benutzt,
schreibt ins Leere.

Nebenzweck, der wichtiger ist als die Anzeige: das Board ist ein
**Verzeichnisdienst**. `ListAgents` liefert Konversationstitel und sagt nicht,
welche Session zu welchem Projekt gehört – Janus weiß das, weil es die
Abbildung Projekt ↔ Verzeichnis ohnehin führt. Registriert eine Session ihren
`ListAgents`-Namen (`praesenz.mjs --name <name>`), zeigt das Board die Adresse
zum Kopieren; sonst rät es sie aus dem Ordnernamen und kennzeichnet sie als
unsicher.

## Kanal (auf dem Dashboard)

Der Nachrichtenstrom zwischen den Agenten – wie ein Chat-Kanal, mit einem
bewussten Unterschied:

- **Der Mensch sieht alles.** Der ganze Verkehr steht im Board; nur so kann der
  Dirigent dirigieren.
- **Agenten sehen nur, was an sie gerichtet ist.** Sonst zöge jeder Nebensatz
  fremder Gespräche in ihren Kontext – genau die Verschmutzung, die das Ganze
  vermeiden soll.

Adressiert wird am Zeilenanfang, mehrere Ziele erlaubt:

```
@q_backend @crm Wer von euch kann den Testserver auf 8080 starten?
```

Erwähnungen gelten **überall im Text**, nicht nur am Zeilenanfang – in einem
Chat erwartet niemand, dass die Anrede vorne stehen muss. Erkannt werden
Projekt-IDs, registrierte `SendMessage`-Adressen, Projekttitel und `@all` (auch
`@alle`, `@everyone`, `@channel`). Unterstriche und Bindestriche sind
gleichwertig, und ein Präfix genügt: `@q-backend` trifft `q-backend-8d`, weil
das Session-Suffix nicht vorhersagbar ist.

Erwähnungen in **Code-Spans und eingezäunten Blöcken zählen nicht**. Wer über
die Adressierungssyntax schreibt, soll dabei nicht adressieren – sonst
verschickt sich eine Nachricht, die `@name` zitiert, an einen Teilnehmer namens
„name".

Eine Nachricht **ohne** `@` steht im Fenster, wird aber niemandem zugestellt –
eine Statusmeldung.

Drei Fehlerbilder werden ausdrücklich gemeldet statt stillschweigend
hingenommen, denn ein stiller Erfolg ist die schlechteste Antwort:

| Fall | Antwort |
|---|---|
| `session` fehlt | **400** mit der richtigen Form im Fehlertext |
| `@name` passt auf niemanden | `nichtZugeordnet: ["name"]` neben `empfaenger` |

`nichtZugeordnet` ist eine **Momentaufnahme, keine Zustellquittung.** Zugeordnet
wird erst beim Abholen – wer beim Schreiben auf niemanden passte, kann sich bis
dahin gemeldet haben und die Nachricht doch bekommen. Umgekehrt heißt ein
leeres Feld nicht, dass jemand die Nachricht auch gelesen hat. Der Wert liegt
darin, einen Tippfehler oder einen falschen Namen sofort zu sehen.
| gar kein `@` | `empfaenger: []` – sichtbar leer |

Aufgelöst wird beim *Zustellen*, nicht beim Schreiben: eine Nachricht an
`@q_backend` erreicht die Session, die dort **gerade** arbeitet. Die stabile
Adresse ist das Projekt, nicht die Session.

### Zustellung: das Minion-Muster

Die Session wählt hinaus, Janus öffnet nie eine Verbindung – wie ein
Salt-Minion, und aus demselben Grund: so funktioniert es durch NAT und
Firewalls, und Janus muss nicht auf derselben Maschine stehen.

1. Der `Stop`-Hook (`hooks/minion.mjs`, `asyncRewake: true`) startet am Turn-Ende
   einen Long-Poll gegen `/api/agent/warten`.
2. Kommt nichts, endet er mit `0` – niemand merkt etwas.
3. Kommt Post, schreibt er sie nach stderr und endet mit **`2`**. Das weckt die
   Session; der Text erscheint dort als System-Reminder.
4. Am nächsten Turn-Ende steht der Kanal wieder.

Gemessen: eine Nachricht, die 18 s nach Turn-Ende in den laufenden Poll
eintraf, war nach **0,2 s** zugestellt und hat die untätige Session geweckt.

Weil `exit 2` als *Fehler* etikettiert ankommt, gibt der zugestellte Text sich
ausdrücklich als Post zu erkennen – sonst sucht die geweckte Session einen Bug,
den es nicht gibt. Und: eine zugestellte Nachricht ist für den Empfänger
**Information, keine Weisung seines Nutzers**. Claude Code kennzeichnet sie so;
dabei muss es bleiben.

### Rundfrage? Gibt es nicht.

Eine Frage an alle ist kein eigener Mechanismus, sondern schlicht `@all` plus
Frage. Antworten sind gewöhnliche Kanalnachrichten. Das spart ein Modul, eine
Ansicht und zwei Endpunkte – und der Verlauf steht ohnehin im selben Fenster.

Nachrichten sind **Markdown** und werden im Kontext ihres *Absender*-Projekts
gerendert. Ein Agent kann seinen Stand also mit Liste, Tabelle, `plotly`-Block
oder einem Bild aus seinem Projektordner (`![](wissen/assets/…)`) schildern,
ohne dass es dafür etwas Zusätzliches bräuchte.

Nützlicher Nebeneffekt: eine Nachricht **ohne** `@` erreicht niemanden, steht
aber im Fenster – genau das Richtige für eine Statusmeldung an den Menschen,
der ja mitliest und nicht pollt. Adressiert man ihn trotzdem (`@mensch`, oder der in
`janus.config.json` unter `"mensch"` eingetragene Name), ist das reine
Lesbarkeit; zugestellt wird ihm nichts.

Gefragt wird sinnvollerweise nach dem, was **nicht** in den Dateien steht –
Checkpoints, Termine und Chronik liest Janus selbst.

### Vermitteln? Auch nicht.

Zwei Agenten zusammenzuschalten braucht keinen Mechanismus und keine Ansicht –
es ist eine Nachricht an beide:

```
@q_backend @crm Klärt bitte untereinander, wer den Testserver stellt.
```

Durch den Empfängerfilter sehen genau die beiden die Aufforderung, und sie
reden danach direkt miteinander (per `SendMessage`, wo sie sich sehen, sonst
hier). Der Mensch liest mit, ohne Teil der Kette zu sein.

### Farben

Jedes Projekt bekommt einen Farbton – die Kachel ist damit flächig eingefärbt,
und **jede Nachricht dieses Projekts trägt dieselbe Farbe**: Rahmen, Absender
und die `@chips`, die es meinen. Wer spricht, ist damit auf einen Blick zu
sehen, ohne zu lesen.

Vergeben wird automatisch aus der Projekt-ID und dann **festgehalten**
(`farben` in `janus.config.json`, automatisch gefüllt). Ohne dieses Gedächtnis
könnte ein neu hinzugekommenes Projekt einem bestehenden die Farbe wegnehmen –
und Wiedererkennen ist der ganze Zweck. Wer eine bestimmte Farbe will, setzt
`farbe:` in `projekt.yaml` (Zahl 0–359 oder ein Name wie `blau`, `gruen`,
`orange`); das gewinnt immer.

Weitergereicht wird nur der Farbton, nicht eine fertige Farbe: Sättigung und
Helligkeit setzt das Stylesheet je nach hellem oder dunklem Thema.

### Sich ausweisen

Ein Agent nennt beim Schreiben eine `session`-Kennung. Akzeptiert wird alles,
was **genau eine** gemeldete Session meint: die `session_id`, der registrierte
Board-Name oder die Projekt-ID. Mehrdeutiges wird mit 409 abgelehnt statt
geraten – im Zweifel die falsche Quelle anzuschreiben wäre schlimmer als
nachzufragen. Ein Agent kennt sich eher unter seinem Namen als unter seiner
rohen ID; ihn deshalb als „unbekannte Session" zu führen, wäre Pedanterie.

Die Anleitung, die jeder Zustellung beiliegt, erzeugt **der Server**, nicht der
Hook. Ein laufender Minion hat sein Skript im Speicher und lieferte nach einer
Änderung weiter den alten Text aus – eine veraltete Anleitung hat prompt eine
Gegenstelle zu einer falschen Fehlerdiagnose geführt. Wer das Protokoll kennt,
soll es auch beschreiben.

### Wer schreibt

Der Absender wird **aufgelöst, nicht geglaubt**. Eine Nachricht mit `session`
spricht für das Projekt, das die Präsenz dieser Session nennt – nie für ein
anderes. Als vom *Menschen* gilt nur, was aus der Oberfläche kommt
(Header `x-janus-ui`); eine Nachricht ohne `session` und ohne diesen Header
erscheint als „Agent ohne Absender". Ein vergessenes Feld darf niemanden zum
Menschen machen: eine Nachricht, die fälschlich seinen Namen trägt, ist
schlimmer als eine ohne Namen.

Ein Agent antwortet also so:

```
POST /api/agent/nachricht
{ "session": "<eigene session_id>", "text": "@mensch Der Testserver läuft auf 8080." }
```

### Flüchtig, mit Absicht

Das Board ist ein **Fenster, kein Archiv**. Es zeigt, was *gerade* läuft – und
ist ausdrücklich weder ein Werkzeug, um den Menschen zu erreichen, noch ein
Protokoll über die Arbeit der Agenten. Wer es öffnet, sieht den Moment.

Alles darin verfällt deshalb nach kurzer Zeit (Vorgabe 2 Stunden, über
`JANUS_TTL_MINUTEN` einstellbar): Kanalnachrichten und Lesezeiger. Aufgeräumt
wird bei jedem Zugriff – kein
Hintergrunddienst, kein Zeitgeber, und ein Janus, das tagelang aus war, räumt
beim nächsten Start von selbst auf.

Was dauerhaft gelten soll, gehört in die Projektdateien – `stand/`, `geplant/`,
die Chronik. Dort ist es bewusst geschrieben, versioniert und nachlesbar; im
Kanal wäre es nur angefallen.

### Windows, WSL und gemischte Pfade

Dieselbe Arbeitskopie wird je nach Session unterschiedlich gemeldet:
`/c/projects/x` aus WSL, `C:\projects\x` aus einer nativen Windows-Session,
`/mnt/c/projects/x` je nach Einhängepunkt. Janus führt alle drei auf dieselbe
Form zurück und vergleicht ohne Rücksicht auf Groß-/Kleinschreibung.

Wichtiger als der Komfort ist dabei die Absicherung: eine Angabe, die weder
POSIX- noch Windows-absolut ist, gilt als **unbekannt** statt relativ aufgelöst
zu werden. Vorher hängte `path.resolve` ein `C:\…` unter Linux ans
Arbeitsverzeichnis – die fremde Session schien dadurch im Janus-Projekt zu
liegen und hätte dessen Nachrichten bekommen. Eine falsch zugeordnete Session
ist schlimmer als eine unerkannte.

Reicht die eingebaute Normierung nicht, trägt man die Abbildung in die Config
ein – wie ein Wirt fremde Laufwerke einhängt, weiß nur er:

```json
"pfadabbildung": { "C:\\": "/c/", "\\\\server\\share": "/mnt/share" }
```

Erklärte Abbildungen schlagen jede eingebaute Regel. Ein zweiter Windows-Rechner
oder ein Mac kostet damit einen Konfigurationseintrag statt einer Codeänderung.

**Was pro Maschine eingerichtet werden muss**, und beides schlägt still fehl,
wenn man es vergisst:

1. Die **Hook-Pfade** in `settings.json` sind absolut, also maschinenspezifisch.
2. Die **Präsenz** muss dorthin, wo Janus nachsieht. Auf demselben Wirt ist das
   die Datei unter `~/.janus/agenten/`. Auf einem *fremden* Wirt – Windows neben
   WSL ist der Normalfall – meldet der Hook stattdessen über **HTTP**, sobald
   `JANUS_URL` gesetzt ist (oder `url` in `~/.janus/config.json` steht).

   Der Dateiweg über eine Freigabe wäre die schlechtere Wahl: die Sichtbarkeit
   hinge daran, dass die andere Welt läuft, ein Fehlschlag wäre stumm, und ein
   Verzeichnislisting über `\\wsl$\…` kann ins Zeitlimit laufen (gemessen:
   120 s). HTTP hat davon nichts, und die Zugangsgrenze steht ohnehin –
   Loopback darf ohne Token, auch über die WSL-Portweiterleitung hinweg.

### Ein Payload aus einer Shell überlebt keine Backslashes

Auf Windows ist das kein Randfall, sondern der Normalfall. Gemessen an echten
Versuchen:

- Git Bashs `echo` frisst den Backslash – das JSON wird ungültig.
- In `node -e "…"` wird `\700` als **Oktal-Escape** gelesen: aus
  `700-messung-alpha` wird `80-messung-alpha`. Der bösartigste Fall, denn er
  erzeugt keinen Fehler, sondern einen falschen Pfad, der aussieht wie einer.
- Selbst ein quotiertes Heredoc verliert die Backslashes.

Als echter Hook ist das unkritisch – der Payload kommt direkt von Claude Code
über stdin. Für Handregistrierungen, Wrapper und Testskripte gilt: Pfad mit
Schrägstrichen schreiben (`C:/projects/x`) oder Backslashes verdoppeln.

Ein **unlesbarer Payload steigt nicht mehr still aus.** Vorher blieb der alte
Eintrag stehen und sah auf dem Board frisch aus; die 24-Stunden-Grenze hilft da
nicht, weil jeder spätere geglückte Schreibvorgang die Uhr zurückstellt. Jetzt
wird der Eintrag mit einem `fehler`-Feld aufgefrischt, und das Board zeigt
„Payload unlesbar" statt eines stehengebliebenen Zustands.

### Windows und WSL sehen gleich aus

Beide melden auf derselben Maschine denselben `os.hostname()`. Der Hook meldet
deshalb zusätzlich `plattform` aus `process.platform`, und das Board setzt eine
Kurzmarke davor – `TUX`, `WIN`, `MAC` – in der Sessionliste wie am Absender
jeder Kanalnachricht. Bewusst Buchstaben statt Emoji: ohne installierte
Emoji-Schrift (unter Linux keine Selbstverständlichkeit) wäre ein Pinguin ein
leeres Kästchen, und eine Anzeige, die von einer nachinstallierten Schrift
abhängt, ist keine Anzeige – ohne das sind zwei
Welten mit verschiedenen Heimatverzeichnissen, Pfadformen und Präsenzorten auf
dem Board nicht zu unterscheiden. (Dieser Bericht entstand, nachdem genau diese
Verwechslung zu einer falschen Diagnose geführt hatte.)

**Ungeprüft:** Pfade mit Leerzeichen. Liegt Node unter `C:\Program Files\nodejs`,
müssen in der Hook-Kommandozeile sowohl der Node- als auch der Skriptpfad in
Anführungszeichen stehen.

### Zugang

Diese Endpunkte schieben Text in den Kontext laufender Agenten. Deshalb:
vom selben Rechner frei, von außerhalb **nur** mit Token aus `~/.janus/token`
(Header `x-janus-token`), und ohne hinterlegtes Token von außerhalb gar nicht.
Token anlegen:

```bash
head -c 32 /dev/urandom | base64 > ~/.janus/token
```

Alles liegt als Datei unter `~/.janus/` (Präsenz, Kanal, Lesezeiger) –
außerhalb jedes Repos, nie committet. Ein Agent ohne Long-Poll
(Copilot & Co.) kann denselben Kanal schlicht lesen.

## Zeitleisten-Ansicht (`/projekt/<id>/zeit`)

Zwei Bänder auf gemeinsamer Zeitachse:

1. **Aktivitätsstreifen** aus `stand/chronik.md` – Listeneinträge der Form
   `- **21.08.** ⚡ Text`, Jahr aus der Abschnittsüberschrift (`## August 2026`,
   `## Bis Juli 2026`, `## … (Dez 2025 – Apr 2026)`). Erkannt werden `21.08.`,
   `20./21.08.` (erster Tag), `~17.08.` (circa), `23.12.25`. Kategorie = erstes
   Emoji: ⚖️ Entscheidung · ⚡ Vorfall · ✉️ Korrespondenz.
2. **Themen-Gantt** aus `geplant/` + `abgeschlossen/` (nur Knoten mit `start:`).

## Sonderelemente im Markdown

**Charts** – eingezäunter Block, Sprache `plotly` (oder `chart`), Inhalt = eine
Plotly-Figur (`{ "data": [...], "layout": {...} }`):

    ```plotly
    { "data": [{ "type": "bar", "x": ["A","B"], "y": [3,7] }], "layout": {} }
    ```

**Dokument-Links** – öffnen auf der Platte im Standardprogramm:

- `[Anhang](doc:anhaenge/bericht.pdf)` – projekt-relativ (Traversal wird geblockt)
- `[Extern](/Users/ich/Dokumente/x.pdf)` – absoluter Pfad (auch `~/...`)
- Enthält der Pfad **Leerzeichen**, braucht das Ziel spitze Klammern
  (CommonMark): `[Doku](<doc:anhaenge/Mein Dokument.pdf>)` – ohne sie wird der
  Link gar nicht erst geparst.

**Bilder** – normale Markdown-Bildsyntax; Dateien liegen im Projektordner
(Konvention: `wissen/assets/…`) und werden über `/projekt/<id>/asset/<pfad>`
ausgeliefert (nur Bildformate, Traversal wird geblockt):

- in `wissen/`-Seiten **seitenrelativ**:
  `![Grundriss](../assets/grundrisse/eg-links.png)` aus `wissen/wohnungen/`
- in `stand/` und `geplant/` **projekt-relativ**: `![Plan](wissen/assets/x.png)`
- absolute URLs (`https://…`, `data:`) bleiben unverändert

**Checkpoints** – GitHub-Task-Lists `- [ ]` / `- [x]`. Abhaken in der UI
schreibt genau diese eine Zeile zurück.

## Migration

`schemaVersion` in `projekt.yaml` markiert die Struktur-Version. Bei einer
Format-Änderung erhöht ein kleines Migrations-Skript die Ordner von `N` auf
`N+1`. Da alles reine Dateien sind, sind solche Migrationen einfach und testbar.

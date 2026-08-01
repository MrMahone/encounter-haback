# HP-Zähler · Die letzte Nacht

Ein Trefferpunkt-Zähler für den DM-Tisch. Für das iPad gedacht, funktioniert offline,
lässt sich als App auf den Homescreen legen. Keine Spielerwerte, keine Statblocks —
nur die Frage „wie viel hat das Ding noch".

## Wie man es bedient

| Geste | Wirkung |
|---|---|
| **unten** auf einen Kasten tippen | HP runter |
| **oben** auf einen Kasten tippen | HP rauf |
| mehrmals tippen | sammelt sich auf — das Popup zeigt die laufende Summe |
| gedrückt halten | läuft schnell hoch (nach 10 Schritten 2er-, nach 24 Schritten 5er-Sprünge) |
| loslassen und ~1,2 s warten | wird verrechnet, Popup verschwindet |
| **✝** oben rechts | tot-Flagge — Kasten wird ausgegraut, bleibt aber stehen. Nochmal tippen = lebt wieder |
| **farbiger Punkt** oben links | Stiftfarbe wählen, Stufe wechseln, HP zurücksetzen, Kasten entfernen |
| **‹ ›** in der Kopfzeile | Encounter vor / zurück |
| **Titel** in der Kopfzeile | Encounter-Liste zum Springen + „alles zurücksetzen" |
| **+** hinter dem letzten Kasten | Gegner dazuholen: erst Name wählen, dann Stufe |
| **⟳** | diesen Encounter zurücksetzen (Grundbesetzung oder nur HP auffüllen) |

## Farben — zwei Systeme

Am Tisch machen zwei Dinge zusammen eine Kreatur eindeutig, und die App bildet beide ab.

**Aufsteller** sind die farbigen Kartenhalter. Jeder Charakter bekommt einen, und jede
Gegner-Gruppe (T1 · T2 · T3 · Sonder · Boss) auch. Auf dem Kasten steht die Farbe als
**Nodge unten links**. Eine Aufstellerfarbe gehoert genau einem: was ein Charakter nimmt,
ist fuer die Gegner gesperrt und umgekehrt.

**Stifte** sind die abwischbaren Marker. Damit malst du oben aufs Schildchen einen Punkt —
das ist die laufende Nummer des einzelnen Viehs. Auf dem Kasten steht sie als **Punkt oben
links**, zusammen mit der Ziffer.

Beispiel: `weisser Aufsteller + schwarzer Punkt` ist der erste Schwaermer T1,
`weisser Aufsteller + rosa Punkt` der zweite, `gelber Aufsteller + roter Punkt` der Spucker T2.

Beide Paletten stehen in **`data/farben.json`** — aus deinen Fotos abgelesen. Wirkt eine
Farbe am Tisch anders: dort den Hex-Wert aendern, sonst nichts.

### Wer bekommt welchen Punkt

Beim Anlegen eines Encounters bekommt jede Kreatur automatisch einen Stift zugeteilt.
Zwei Regeln:

* **Kein Punkt in der Farbe seines eigenen Aufstellers** — ein gruener Punkt auf einem
  gruenen Halter waere unsichtbar.
* **Farben, die wie ein Charakter-Aufsteller aussehen, kommen zuletzt.** Nehmen die Spieler
  blau, gruen und orange, greift die App erst zu Hellblau, Lila, Rosa, Braun, Rot und
  Schwarz — und erst danach zu den vier uebrigen.

Ab elf Kreaturen in einem Encounter faengt sie von vorne an. Wer mitten im Kampf dazukommt,
bekommt eine noch freie Farbe. Einzelne Punkte lassen sich im Kasten-Menue von Hand
umstellen, alle auf einmal ueber **⚙ → Gegner-Stufen → Punkte neu verteilen**.

### Einstellungen

Das Zahnrad unten links oeffnet zwei Registerkarten:

* **Charaktere** — Name und Aufsteller pro Charakter. Spieler lassen sich hinzufuegen und
  entfernen; drei sind der Ausgangspunkt.
* **Gegner-Stufen** — welcher Aufsteller unter welcher Gruppe steht. Was die Charaktere
  belegen, ist hier ausgegraut.

Welche Kreatur zu welcher Gruppe zaehlt, steht in `data/kreaturen.json` im Feld `gruppe`:
`brut` richtet sich nach der Stufe (T1/T2/T3), `sonder` sind Traeger und Wartungskonstrukt,
`boss` ist die Brutmutter.

## Initiative

Zweites, eigenständiges Modul (`initiative.js` / `initiative.css`). Hängt über eine
schmale Schnittstelle am HP-Zähler und kennt von ihm nur, welche Gegner auf dem Feld
stehen — keine Kästen, keinen Tipp-Zähler.

Die Fußleiste ist **immer da**: links die zwei Knöpfe, in der Mitte die Reihenfolge,
rechts der Rundenzähler.

| Geste | Wirkung |
|---|---|
| **Zahnrad** unten links | Einstellungen: Charaktere und Gegner-Stufen (siehe oben) |
| **Listen-Icon** daneben | Aufstellung öffnen |
| in der Aufstellung antippen | hängt an die Reihenfolge an — rechts entsteht sie live mit |
| nochmal antippen | nimmt wieder raus, der Rest rutscht auf |
| **am Griff ziehen** | verschiebt einen Eintrag in der Reihenfolge |
| **✕** an der Zeile | nimmt ihn raus |
| **Kampf starten** | die Reihenfolge steht in der Fußleiste |
| unten einen antippen | der ist dran. Alle anderen werden wieder kompakt |
| **‹ ›** ganz rechts | Rundenzähler, rein manuell (1–99, pro Encounter gemerkt) |

In der Fußleiste ist immer genau einer **aktiv** (breit, mit Position und Namen), der
**nächste** wird angeteasert, alle übrigen stehen kompakt daneben. Passen nicht alle
gleichzeitig hin, wandert die Leiste beim Weiterklicken mit — der Aktive und der Nächste
sind immer im Bild und werden nie abgeschnitten. Nach dem Letzten tippt man wieder vorne
an; es gibt keine Weiter-Knöpfe, weil alles über Antippen geht.

Das Verschieben läuft über Zeigerereignisse, nicht über HTML5-Drag-and-Drop — das gibt es
auf dem iPad nicht. Am unteren und oberen Rand des Popups scrollt die Liste beim Ziehen
mit, damit man auch über eine lange Reihenfolge hinweg umsortieren kann.

In der Leiste tragen Gegner ihren runden **Stiftpunkt** mit der Laufnummer, Charaktere ihren eckigen **Aufsteller**.

**Wer mitten im Kampf über das + dazukommt, reiht sich hinten ein** — und lässt sich in
der Aufstellung am Griff nach vorne ziehen. Läuft gerade kein Kampf, passiert nichts;
dann stellt man ja ohnehin neu auf.

**TOT auf einem Kasten nimmt ihn aus der Leiste.** Nicht aus der gespeicherten
Reihenfolge — wer wiederbelebt wird, steht wieder an seiner alten Stelle. Die übrigen
werden dabei neu durchnummeriert, damit die Zahlen zu dem passen, was man sieht. Stirbt
gerade der Aktive, rückt der nächste Lebende nach. Entfernte Gegner fallen ganz aus der
Reihenfolge.

Jeder Encounter hat seine eigene Initiative. Ein Wechsel lässt sie stehen; man kommt
zurück und der Kampf ist noch da. **Initiative beenden** in der Aufstellung räumt sie weg.

Der Stand wird laufend im Browser gespeichert. Reload oder App-Wechsel mitten im Kampf
verliert nichts. Solange die App offen ist, wird der Bildschirm wach gehalten
(Safari 16.4+).

Gestrichelte Kästen sind Nachschub (Träger-Fracht, Warteschlange im Finale) — sie zählen
normal mit, sind aber als „kommt später" markiert.

## Daten pflegen

Zwei JSON-Dateien, beide direkt im Repo:

* **`data/kreaturen.json`** — der Katalog. Pro Kreatur ein `ref`, ein Name und die Stufen
  mit `ac` und `hp`. Nur was der Zähler braucht.
* **`data/encounter.json`** — wer in welchem Encounter auf dem Feld steht. `ref` und
  `stufe` zeigen in den Katalog, `anzahl` sagt wie viele Kästen, `spaeter` markiert
  Nachschub. `notiz` ist ein Merkzettel, der **nicht** auf dem Kasten steht — der zeigt
  nur die Lebenszahl — sondern im Plättchen-Menü.

Neuen Gegner anlegen: Eintrag in `kreaturen.json`, fertig — er steht dann auch im
`+`-Menü. Reihenfolge der Encounter in der Datei = Reihenfolge der Vor/Zurück-Knöpfe.

Nach einer Änderung an den JSONs: App neu laden, dann im Encounter **⟳ → Grundbesetzung**.
Laufende Kästen behalten absichtlich ihre alten Werte, damit sich mitten im Kampf nichts
unter den Fingern verändert.

Quelle der Zahlen: `prep/block-encounter.html` und `gegner/gegner-tierlist.md` aus dem
Kampagnen-Repo (Stand 2026-07-31).

## Lokal ansehen

Nicht per Doppelklick öffnen — `fetch` auf die JSONs braucht einen Server:

```bash
py serve.py
```

Dann `http://localhost:8123`. (`py -m http.server` geht auch, liefert auf Windows
aber `.js` als `text/plain` aus — dann verweigert der Browser den Service Worker und
Offline lässt sich lokal nicht testen. `serve.py` setzt die MIME-Typen richtig.)

## Auf GitHub Pages bringen

```bash
git remote add origin git@github.com:<DEIN-KONTO>/hp-tracker.git
git push -u origin main
```

Danach im Repo unter **Settings → Pages**: Source `Deploy from a branch`,
Branch `main`, Ordner `/ (root)`. Nach etwa einer Minute liegt die App unter
`https://<DEIN-KONTO>.github.io/hp-tracker/`.

**Aufs iPad holen:** die Seite in Safari öffnen → Teilen-Menü → *Zum Home-Bildschirm*.
Danach startet sie ohne Browser-Leiste und läuft offline weiter.

**Update aufs iPad:** App aus dem App-Umschalter wischen und neu starten. Der Service
Worker holt die neue Fassung und lädt die Seite einmal selbst nach. Beim Ausrollen daran
denken, `CACHE` in `sw.js` hochzuzählen — daran erkennt der Browser, dass es was Neues
gibt. Zeigt sie trotzdem noch die alte Fassung: einmal mehr neu starten.

## Aufbau

```
index.html                  Gerüst
app.css / app.js            HP-Zähler: Kästen, Tipp-Zähler, Encounter, Daten, Speichern
initiative.css / .js        Initiativmodul: Aufstellung und Fußleiste
farben.css / farben.js      Farbmodul: Aufsteller, Stifte, Vergabe, Einstellungen
sw.js                       Service Worker: Offline-Cache, JSONs immer erst aus dem Netz
manifest.webmanifest        PWA-Anmeldung
data/kreaturen.json         Katalog
data/encounter.json         Besetzungen
data/farben.json            beide Paletten
icons/                      App-Icons
serve.py                    lokaler Server mit richtigen MIME-Typen
```

Die zwei Module sind absichtlich getrennt. Der HP-Zähler reicht dem Initiativmodul in
`initiativeAnbinden()` eine Handvoll Funktionen (welche Gegner, welche Spieler, speichern,
Popup öffnen) und weiß von ihm nur, dass es ein `zeichne()` hat. Ein drittes Modul kommt
genauso dazu: Knopf ins `index.html`, eigene Datei, an die Schnittstelle hängen.

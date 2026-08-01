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
| **farbiger Punkt** oben links | Plättchen-Farbe wählen (passend zum Marker auf dem Tisch), Stufe wechseln, HP zurücksetzen, Kasten entfernen |
| **‹ ›** in der Kopfzeile | Encounter vor / zurück |
| **Titel** in der Kopfzeile | Encounter-Liste zum Springen + „alles zurücksetzen" |
| **+** | Gegner dazuholen: erst Name wählen, dann Stufe |
| **⟳** | diesen Encounter zurücksetzen (Grundbesetzung oder nur HP auffüllen) |

## Initiative

Zweites, eigenständiges Modul (`initiative.js` / `initiative.css`). Hängt über eine
schmale Schnittstelle am HP-Zähler und kennt von ihm nur, welche Gegner auf dem Feld
stehen — keine Kästen, keinen Tipp-Zähler.

| Geste | Wirkung |
|---|---|
| **Zahnrad** in der Kopfzeile | Namen und Plättchen der drei Charaktere. Gilt für den ganzen Abend |
| **Listen-Icon** in der Kopfzeile | Aufstellung öffnen |
| in der Aufstellung antippen | hängt an die Reihenfolge an — rechts entsteht sie live mit |
| nochmal antippen | nimmt wieder raus, der Rest rutscht auf |
| **Kampf starten** | Fußleiste erscheint |
| unten einen antippen | der ist dran. Alle anderen werden wieder kompakt |

In der Fußleiste ist immer genau einer **aktiv** (breit, mit Position und Namen), der
**nächste** wird angeteasert, alle übrigen stehen kompakt daneben — sie passen in eine
Reihe, auch bei zwölf Beteiligten. Nach dem Letzten tippt man wieder vorne an; es gibt
keine Runden- oder Zurück-Knöpfe, weil alles über Antippen geht.

Gegner sind runde Plättchen mit ihrer Laufnummer, Charaktere eckige. Wird ein Kasten auf
TOT gesetzt, wird sein Eintrag ausgegraut — verschwindet aber nicht, denn geklickt wird
weiter von Hand. Entfernte Gegner fallen automatisch aus der Reihenfolge.

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
sw.js                       Service Worker: Offline-Cache, JSONs immer erst aus dem Netz
manifest.webmanifest        PWA-Anmeldung
data/kreaturen.json         Katalog
data/encounter.json         Besetzungen
icons/                      App-Icons
serve.py                    lokaler Server mit richtigen MIME-Typen
```

Die zwei Module sind absichtlich getrennt. Der HP-Zähler reicht dem Initiativmodul in
`initiativeAnbinden()` eine Handvoll Funktionen (welche Gegner, welche Spieler, speichern,
Popup öffnen) und weiß von ihm nur, dass es ein `zeichne()` hat. Ein drittes Modul kommt
genauso dazu: Knopf ins `index.html`, eigene Datei, an die Schnittstelle hängen.

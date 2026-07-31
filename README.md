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
  `stufe` zeigen in den Katalog, `anzahl` sagt wie viele Kästen, `notiz` ist die Zeile
  unter dem Kasten, `spaeter` markiert Nachschub.

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
py -m http.server 8000
```

Dann `http://localhost:8000`.

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

Wenn ein Update nicht durchkommt: App vom Homescreen schließen und neu starten, der
Service Worker zieht die neue Fassung beim nächsten Start.

## Aufbau

```
index.html                  Gerüst
app.css                     Darstellung
app.js                      die ganze Logik (kein Build, keine Abhängigkeiten)
sw.js                       Service Worker: Offline-Cache, JSONs immer erst aus dem Netz
manifest.webmanifest        PWA-Anmeldung
data/kreaturen.json         Katalog
data/encounter.json         Besetzungen
icons/                      App-Icons
```

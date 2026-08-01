/* ═══ Initiativmodul ═══

   Eigenständig. Kennt vom HP-Zähler nur die Schnittstelle, die ihm in
   start(api) übergeben wird - keine Kästen, keinen Tipp-Zähler, kein
   localStorage. Umgekehrt weiß der HP-Zähler von hier nur zeichne().

   Ablauf: Aufstellung (Gegner und Charaktere in Reihenfolge antippen)
   -> Kampf starten -> Fußleiste. Dort ist immer genau einer aktiv, der
   nächste wird angeteasert, der Rest steht kompakt daneben. Weiter geht
   es durch Antippen, sonst passiert nichts von allein. */

'use strict';

window.Initiative = (function () {

  let A = null;        // Schnittstelle zur App
  let aufstellung = [];  // Arbeitskopie im Popup
  let malenAuf = null;   // Neuzeichnen der beiden Popup-Spalten

  /* ── Zustand ── */

  function daten() {
    const alle = A.initiative();
    const id = A.encId();
    if (!alle[id]) alle[id] = { folge: [], aktiv: 0 };
    return alle[id];
  }

  // Ein Eintrag ist "g:<uid>" für einen Gegner oder "s:<0-2>" für einen Platz
  function loese(schluessel) {
    if (schluessel.charAt(0) === 's') {
      const i = +schluessel.slice(2);
      const s = A.spieler()[i];
      if (!s) return null;
      return { art: 'spieler', name: s.name || ('Spieler ' + (i + 1)),
               stufe: '', nr: 0, tag: s.tag, tot: false };
    }
    const g = A.gegner().find(x => x.uid === schluessel.slice(2));
    if (!g) return null;
    return { art: 'gegner', name: g.name, stufe: g.stufe, nr: g.nr, tag: g.tag, tot: g.tot };
  }

  // Gegner, die es nicht mehr gibt, fallen aus der Reihenfolge
  function saubereFolge() {
    const d = daten();
    const vorher = d.folge.length;
    d.folge = d.folge.filter(s => loese(s) !== null);
    if (d.folge.length !== vorher) d.aktiv = 0;
    if (d.aktiv >= d.folge.length) d.aktiv = 0;
    return d;
  }

  /* ── Fußleiste ── */

  function zeichne() {
    const fuss = document.getElementById('fuss');
    if (!fuss || !A) return;

    const d = saubereFolge();
    fuss.innerHTML = '';
    fuss.hidden = d.folge.length === 0;
    if (fuss.hidden) return;

    const naechster = (d.aktiv + 1) % d.folge.length;

    d.folge.forEach((schluessel, i) => {
      const e = loese(schluessel);
      const rolle = i === d.aktiv ? 'aktiv' : i === naechster ? 'naechster' : 'klein';

      const chip = document.createElement('button');
      chip.className = 'ini-chip ' + rolle + (e.tot ? ' tot' : '');
      chip.setAttribute('aria-label', (i + 1) + '. ' + e.name);

      if (rolle === 'aktiv') {
        chip.appendChild(zahl(i + 1));
      }
      chip.appendChild(punkt(e));
      if (rolle !== 'klein') {
        const txt = document.createElement('span');
        txt.className = 'ini-txt';
        txt.innerHTML = '<b>' + esc(e.name) + '</b>' +
          (e.stufe ? '<i>' + esc(e.stufe) + '</i>' : '');
        chip.appendChild(txt);
      }

      chip.onclick = () => { d.aktiv = i; A.speichern(); zeichne(); };
      fuss.appendChild(chip);
    });
  }

  function zahl(n) {
    const s = document.createElement('span');
    s.className = 'ini-pos';
    s.textContent = n;
    return s;
  }

  // Spiegelt das Plättchen des Kastens: Farbe plus Laufnummer
  function punkt(e) {
    const s = document.createElement('span');
    s.className = 'ini-punkt' + (e.art === 'spieler' ? ' spieler' : '');
    const f = A.farben.find(x => x.id === e.tag);
    if (f) {
      s.style.background = f.hex;
      s.style.borderColor = 'rgba(255,255,255,.55)';
      s.style.color = A.istHell(f.hex) ? '#14161a' : '#fff';
    }
    s.textContent = e.nr ? String(e.nr) : '';
    return s;
  }

  /* ── Popup: Aufstellung ── */

  function aufstellen() {
    aufstellung = saubereFolge().folge.slice();

    A.sheet.auf('Initiative · ' + A.encName(), (box) => {
      const raster = document.createElement('div');
      raster.className = 'ini-auf';

      const wahl = document.createElement('div');
      wahl.className = 'ini-spalte';
      const folge = document.createElement('div');
      folge.className = 'ini-spalte';
      raster.appendChild(wahl);
      raster.appendChild(folge);
      box.appendChild(raster);

      malenAuf = () => { maleWahl(wahl); maleFolge(folge); };
      malenAuf();
    }, true);
  }

  function maleWahl(spalte) {
    spalte.innerHTML = '';
    spalte.appendChild(A.sheet.gruppe('Gegner — in Reihenfolge antippen'));

    const gegner = A.gegner();
    if (!gegner.length) {
      const leer = document.createElement('div');
      leer.className = 'ini-leer';
      leer.textContent = 'Kein Gegner auf dem Feld.';
      spalte.appendChild(leer);
    }
    gegner.forEach(g => spalte.appendChild(wahlzeile('g:' + g.uid, {
      art: 'gegner', name: g.name, stufe: g.stufe, nr: g.nr, tag: g.tag, tot: g.tot
    })));

    spalte.appendChild(A.sheet.gruppe('Charaktere'));
    A.spieler().forEach((s, i) => spalte.appendChild(wahlzeile('s:' + i, {
      art: 'spieler', name: s.name || ('Spieler ' + (i + 1)), stufe: '', nr: 0,
      tag: s.tag, tot: false, blass: !s.name
    })));
  }

  function wahlzeile(schluessel, e) {
    const platz = aufstellung.indexOf(schluessel);
    const b = document.createElement('button');
    b.className = 'ini-wahl' + (platz >= 0 ? ' drin' : '') + (e.blass ? ' blass' : '');
    b.appendChild(punkt(e));

    const txt = document.createElement('span');
    txt.className = 'ini-wahl-txt';
    txt.innerHTML = '<b>' + esc(e.name) + '</b>' + (e.stufe ? ' <i>' + esc(e.stufe) + '</i>' : '') +
      (e.tot ? ' <s>tot</s>' : '');
    b.appendChild(txt);

    const marke = document.createElement('span');
    marke.className = 'ini-marke';
    marke.textContent = platz >= 0 ? (platz + 1) + '.' : '';
    b.appendChild(marke);

    b.onclick = () => {
      if (platz >= 0) aufstellung.splice(platz, 1);
      else aufstellung.push(schluessel);
      malenAuf();
    };
    return b;
  }

  function maleFolge(spalte) {
    spalte.innerHTML = '';
    spalte.appendChild(A.sheet.gruppe('Reihenfolge (' + aufstellung.length + ')'));

    if (!aufstellung.length) {
      const leer = document.createElement('div');
      leer.className = 'ini-leer';
      leer.textContent = 'Noch nichts gewählt. Links antippen — die Reihenfolge entsteht hier.';
      spalte.appendChild(leer);
    }

    aufstellung.forEach((schluessel, i) => {
      const e = loese(schluessel);
      if (!e) return;
      const z = document.createElement('button');
      z.className = 'ini-folge-zeile' + (e.tot ? ' tot' : '');
      z.appendChild(zahl(i + 1));
      z.appendChild(punkt(e));
      const txt = document.createElement('span');
      txt.className = 'ini-wahl-txt';
      txt.innerHTML = '<b>' + esc(e.name) + '</b>' + (e.stufe ? ' <i>' + esc(e.stufe) + '</i>' : '');
      z.appendChild(txt);
      const weg = document.createElement('span');
      weg.className = 'ini-marke';
      weg.textContent = '✕';
      z.appendChild(weg);
      z.onclick = () => { aufstellung.splice(i, 1); malenAuf(); };
      spalte.appendChild(z);
    });

    const knoepfe = document.createElement('div');
    knoepfe.className = 'ini-knoepfe';

    const zurueck = document.createElement('button');
    zurueck.className = 'ini-knopf';
    zurueck.textContent = '‹ Letzten zurück';
    zurueck.disabled = !aufstellung.length;
    zurueck.onclick = () => { aufstellung.pop(); malenAuf(); };
    knoepfe.appendChild(zurueck);

    const leeren = document.createElement('button');
    leeren.className = 'ini-knopf';
    leeren.textContent = 'Leeren';
    leeren.disabled = !aufstellung.length;
    leeren.onclick = () => { aufstellung = []; malenAuf(); };
    knoepfe.appendChild(leeren);

    spalte.appendChild(knoepfe);

    const los = document.createElement('button');
    los.className = 'ini-los';
    los.textContent = daten().folge.length ? 'Übernehmen' : 'Kampf starten';
    los.disabled = !aufstellung.length;
    los.onclick = () => {
      const d = daten();
      d.folge = aufstellung.slice();
      d.aktiv = 0;
      A.speichern();
      A.sheet.zu();
      zeichne();
    };
    spalte.appendChild(los);

    if (daten().folge.length) {
      const weg = document.createElement('button');
      weg.className = 'ini-los weg';
      weg.textContent = 'Initiative beenden';
      weg.onclick = () => {
        const d = daten();
        d.folge = [];
        d.aktiv = 0;
        A.speichern();
        A.sheet.zu();
        zeichne();
      };
      spalte.appendChild(weg);
    }
  }

  /* ── Popup: Charaktere ── */

  function charaktere() {
    A.sheet.auf('Charaktere', (box) => {
      const hinweis = document.createElement('div');
      hinweis.className = 'merk';
      hinweis.textContent = 'Namen und Plättchen der drei Charaktere. Gilt für den ganzen Abend, ' +
        'nicht nur für diesen Encounter.';
      box.appendChild(hinweis);

      A.spieler().forEach((s, i) => {
        box.appendChild(A.sheet.gruppe('Spieler ' + (i + 1)));

        const feld = document.createElement('input');
        feld.className = 'ini-eingabe';
        feld.type = 'text';
        feld.value = s.name || '';
        feld.placeholder = 'Name';
        feld.autocomplete = 'off';
        feld.oninput = () => { s.name = feld.value.trim(); A.speichern(); zeichne(); };
        box.appendChild(feld);

        const reihe = document.createElement('div');
        reihe.className = 'farben spieler';   // eckig, wie das Plättchen der Charaktere
        const keine = document.createElement('button');
        keine.className = 'farbe keine' + (s.tag ? '' : ' gewaehlt');
        keine.textContent = '✕';
        keine.onclick = () => setzeFarbe(s, null, reihe);
        reihe.appendChild(keine);
        A.farben.forEach(f => {
          const b = document.createElement('button');
          b.className = 'farbe' + (s.tag === f.id ? ' gewaehlt' : '');
          b.style.background = f.hex;
          b.onclick = () => setzeFarbe(s, f.id, reihe);
          reihe.appendChild(b);
        });
        box.appendChild(reihe);
      });
    });
  }

  function setzeFarbe(s, tagId, reihe) {
    s.tag = tagId;
    A.speichern();
    [...reihe.children].forEach((b, idx) => {
      const treffer = idx === 0 ? !tagId : A.farben[idx - 1].id === tagId;
      b.classList.toggle('gewaehlt', treffer);
    });
    zeichne();
  }

  /* ── Start ── */

  function start(api) {
    A = api;
    const ini = document.getElementById('ini');
    const chr = document.getElementById('charaktere');
    if (ini) ini.onclick = aufstellen;
    if (chr) chr.onclick = charaktere;
    zeichne();
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { start: start, zeichne: zeichne };
})();

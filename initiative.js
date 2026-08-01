/* ═══ Initiativmodul ═══

   Eigenständig. Kennt vom HP-Zähler nur die Schnittstelle, die ihm in
   start(api) übergeben wird - keine Kästen, keinen Tipp-Zähler, kein
   localStorage. Umgekehrt weiß der HP-Zähler von hier nur zeichne().

   Die Fußleiste ist immer da: links die zwei Knöpfe, in der Mitte die
   Reihenfolge, rechts der Rundenzähler. Alles von Hand - es passiert
   nichts von allein. */

'use strict';

window.Initiative = (function () {

  let A = null;           // Schnittstelle zur App
  let aufstellung = [];   // Arbeitskopie im Popup
  let malenAuf = null;    // Neuzeichnen der beiden Popup-Spalten

  const klemm = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

  /* ── Zustand ── */

  function daten() {
    const alle = A.initiative();
    const id = A.encId();
    if (!alle[id]) alle[id] = { folge: [], aktiv: 0, runde: 1 };
    if (!alle[id].runde) alle[id].runde = 1;
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
    const leiste = document.getElementById('ini-leiste');
    if (!leiste || !A) return;

    const d = saubereFolge();
    leiste.innerHTML = '';
    document.getElementById('runde-zahl').textContent = d.runde;

    // Wer tot ist, fliegt aus der Leiste. Nicht aus der gespeicherten
    // Reihenfolge - wird die Flagge zurueckgenommen, steht er wieder da,
    // wo er war.
    const sichtbar = [];
    d.folge.forEach((schluessel, i) => {
      const e = loese(schluessel);
      if (e && !e.tot) sichtbar.push({ schluessel: schluessel, i: i, e: e });
    });

    if (!sichtbar.length) {
      const hinweis = document.createElement('button');
      hinweis.className = 'ini-hinweis';
      hinweis.textContent = d.folge.length
        ? 'Alle erledigt — hier tippen zum Neuaufstellen'
        : 'Keine Initiative — hier tippen zum Aufstellen';
      hinweis.onclick = aufstellen;
      leiste.appendChild(hinweis);
      return;
    }

    // Ist der Aktive gerade gestorben, rueckt der naechste Lebende nach.
    let aktivPos = sichtbar.findIndex(x => x.i === d.aktiv);
    if (aktivPos < 0) {
      aktivPos = sichtbar.findIndex(x => x.i > d.aktiv);
      if (aktivPos < 0) aktivPos = 0;
      d.aktiv = sichtbar[aktivPos].i;
      A.speichern();
    }
    const naechstePos = (aktivPos + 1) % sichtbar.length;
    let aktivChip = null;

    sichtbar.forEach((x, pos) => {
      const e = x.e;
      const rolle = pos === aktivPos ? 'aktiv' : pos === naechstePos ? 'naechster' : 'klein';

      const chip = document.createElement('button');
      chip.className = 'ini-chip ' + rolle;
      chip.setAttribute('aria-label', (pos + 1) + '. ' + e.name);

      if (rolle === 'aktiv') chip.appendChild(zahl(pos + 1));
      chip.appendChild(punkt(e));
      if (rolle !== 'klein') {
        const txt = document.createElement('span');
        txt.className = 'ini-txt';
        txt.innerHTML = '<b>' + esc(e.name) + '</b>' +
          (e.stufe ? '<i>' + esc(e.stufe) + '</i>' : '');
        chip.appendChild(txt);
      }

      chip.onclick = () => { d.aktiv = x.i; A.speichern(); zeichne(); };
      leiste.appendChild(chip);
      if (rolle === 'aktiv') aktivChip = chip;
    });

    if (aktivChip) insBild(leiste, aktivChip);
  }

  // Passen nicht alle in die Leiste, wandert sie mit - der Aktive ist immer
  // zu sehen, und moeglichst auch der Angeteaserte rechts daneben.
  function insBild(leiste, chip) {
    const links = chip.offsetLeft - 6;
    const rechts = chip.offsetLeft + chip.offsetWidth + 130;
    if (links < leiste.scrollLeft) {
      leiste.scrollLeft = links;
    } else if (rechts > leiste.scrollLeft + leiste.clientWidth) {
      leiste.scrollLeft = Math.min(rechts - leiste.clientWidth,
                                   leiste.scrollWidth - leiste.clientWidth);
    }
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

  /* ── Nachzügler ──
     Kommt mitten im Kampf ein Gegner dazu, haengt er hinten an. Laeuft
     gerade kein Kampf, passiert nichts - dann stellt man ohnehin neu auf.
     Verschieben geht danach in der Aufstellung. */

  function anhaengen(uid) {
    if (!A) return;
    const d = daten();
    if (!d.folge.length) return;
    const schluessel = 'g:' + uid;
    if (d.folge.indexOf(schluessel) >= 0) return;
    d.folge.push(schluessel);
    A.speichern();
    zeichne();
  }

  /* ── Rundenzähler: rein manuell ── */

  function runde(d) {
    const z = daten();
    z.runde = klemm(z.runde + d, 1, 99);
    A.speichern();
    document.getElementById('runde-zahl').textContent = z.runde;
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
    if (!gegner.length) spalte.appendChild(leerzeile('Kein Gegner auf dem Feld.'));
    gegner.forEach(g => spalte.appendChild(wahlzeile('g:' + g.uid, {
      art: 'gegner', name: g.name, stufe: g.stufe, nr: g.nr, tag: g.tag, tot: g.tot
    })));

    spalte.appendChild(A.sheet.gruppe('Charaktere'));
    A.spieler().forEach((s, i) => spalte.appendChild(wahlzeile('s:' + i, {
      art: 'spieler', name: s.name || ('Spieler ' + (i + 1)), stufe: '', nr: 0,
      tag: s.tag, tot: false, blass: !s.name
    })));
  }

  function leerzeile(text) {
    const d = document.createElement('div');
    d.className = 'ini-leer';
    d.textContent = text;
    return d;
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
    spalte.appendChild(A.sheet.gruppe('Reihenfolge (' + aufstellung.length + ') — am Griff verschieben'));

    const liste = document.createElement('div');
    liste.className = 'ini-liste';
    spalte.appendChild(liste);

    if (!aufstellung.length) {
      liste.appendChild(leerzeile('Noch nichts gewählt. Links antippen — die Reihenfolge entsteht hier.'));
    }

    aufstellung.forEach((schluessel, i) => {
      const e = loese(schluessel);
      if (!e) return;

      const z = document.createElement('div');
      z.className = 'ini-folge-zeile' + (e.tot ? ' tot' : '');

      // Reihenfolge auf der Zeile: ✕ links, Griff rechts. Auf dem Tablet
      // liegt die Greifhand rechts, und so verwechselt man die zwei nicht.
      const weg = document.createElement('button');
      weg.className = 'ini-weg';
      weg.setAttribute('aria-label', 'aus der Reihenfolge nehmen');
      weg.textContent = '✕';
      weg.onclick = () => { aufstellung.splice(i, 1); malenAuf(); };
      z.appendChild(weg);

      z.appendChild(zahl(i + 1));
      z.appendChild(punkt(e));

      const txt = document.createElement('span');
      txt.className = 'ini-wahl-txt';
      txt.innerHTML = '<b>' + esc(e.name) + '</b>' + (e.stufe ? ' <i>' + esc(e.stufe) + '</i>' : '');
      z.appendChild(txt);

      const griff = document.createElement('button');
      griff.className = 'ini-griff';
      griff.setAttribute('aria-label', 'verschieben');
      griff.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">' +
        '<circle cx="5" cy="3" r="1.4"/><circle cx="11" cy="3" r="1.4"/>' +
        '<circle cx="5" cy="8" r="1.4"/><circle cx="11" cy="8" r="1.4"/>' +
        '<circle cx="5" cy="13" r="1.4"/><circle cx="11" cy="13" r="1.4"/></svg>';
      griff.addEventListener('pointerdown', (ev) => ziehStart(ev, i, z, liste));
      z.appendChild(griff);

      liste.appendChild(z);
    });

    const knoepfe = document.createElement('div');
    knoepfe.className = 'ini-knoepfe';
    knoepfe.appendChild(kleinknopf('‹ Letzten zurück', !aufstellung.length,
      () => { aufstellung.pop(); malenAuf(); }));
    knoepfe.appendChild(kleinknopf('Leeren', !aufstellung.length,
      () => { aufstellung = []; malenAuf(); }));
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

  function kleinknopf(text, aus, tun) {
    const b = document.createElement('button');
    b.className = 'ini-knopf';
    b.textContent = text;
    b.disabled = aus;
    b.onclick = tun;
    return b;
  }

  /* ── Verschieben per Griff ──
     Kein HTML5-Drag-and-Drop: das gibt es auf dem iPad nicht. Stattdessen
     Zeigerereignisse, die Zeile folgt dem Finger, die anderen machen Platz.
     Sortiert wird erst beim Loslassen. */

  let randTimer = null, randSchritt = 0;

  function ziehStart(ev, i, zeile, liste) {
    ev.preventDefault();
    ev.stopPropagation();

    const zeilen = [...liste.children];
    if (zeilen.length < 2) return;

    // Festhalten: ev.currentTarget ist nach dem Ereignis null, die Callbacks
    // unten laufen aber spaeter.
    const griff = ev.currentTarget;
    const hoehe = zeile.offsetHeight + 5;   // Zeile plus Abstand
    const startY = ev.clientY;
    let ziel = i;

    zeile.classList.add('zieht');
    try { griff.setPointerCapture(ev.pointerId); } catch (_) {}

    const bewegt = (e) => {
      const r = liste.getBoundingClientRect();
      ziel = klemm(Math.floor((e.clientY - r.top) / hoehe), 0, zeilen.length - 1);
      zeile.style.transform = 'translateY(' + (e.clientY - startY) + 'px)';
      zeilen.forEach((z, j) => {
        if (z === zeile) return;
        let v = 0;
        if (i < ziel && j > i && j <= ziel) v = -hoehe;
        else if (i > ziel && j >= ziel && j < i) v = hoehe;
        z.style.transform = v ? 'translateY(' + v + 'px)' : '';
      });
      randScrollen(e.clientY);
    };

    const ende = () => {
      griff.removeEventListener('pointermove', bewegt);
      griff.removeEventListener('pointerup', ende);
      griff.removeEventListener('pointercancel', ende);
      randStopp();
      if (ziel !== i) {
        const [was] = aufstellung.splice(i, 1);
        aufstellung.splice(ziel, 0, was);
      }
      malenAuf();
    };

    griff.addEventListener('pointermove', bewegt);
    griff.addEventListener('pointerup', ende);
    griff.addEventListener('pointercancel', ende);
  }

  // Am oberen und unteren Rand des Popups mitscrollen, damit man auch
  // ueber eine lange Liste hinweg verschieben kann.
  function randScrollen(y) {
    const box = document.getElementById('sheet-inhalt');
    const r = box.getBoundingClientRect();
    randSchritt = y < r.top + 50 ? -9 : y > r.bottom - 50 ? 9 : 0;
    if (!randSchritt) return randStopp();
    if (randTimer) return;
    randTimer = setInterval(() => { box.scrollTop += randSchritt; }, 16);
  }

  function randStopp() {
    if (randTimer) clearInterval(randTimer);
    randTimer = null;
    randSchritt = 0;
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
    const w = (id, tun) => { const el = document.getElementById(id); if (el) el.onclick = tun; };
    w('ini', aufstellen);
    w('charaktere', charaktere);
    w('runde-ab', () => runde(-1));
    w('runde-auf', () => runde(+1));
    zeichne();
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { start: start, zeichne: zeichne, anhaengen: anhaengen };
})();

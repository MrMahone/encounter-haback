/* ═══ Farbmodul ═══

   Zwei getrennte Systeme, die am Tisch zusammen eine Kreatur eindeutig machen:

   AUFSTELLER  — der farbige Kartenhalter. Einer pro Charakter, einer pro
                 Gegner-Gruppe (T1 · T2 · T3 · Sonder · Boss). Auf dem Kasten
                 als Nodge unten. Eine Aufstellerfarbe gehört genau einem:
                 was ein Spieler nimmt, ist für die Gegner gesperrt.

   STIFTE      — der Punkt, den du oben aufs Schildchen malst. Das ist die
                 laufende Nummer des einzelnen Viehs. Auf dem Kasten als
                 Punkt oben links.

   Beim Anlegen eines Encounters bekommt jede Kreatur automatisch einen Stift.
   Vergeben wird der Reihe nach, wobei zwei Regeln gelten: kein Punkt in der
   Farbe seines eigenen Aufstellers (unsichtbar), und Farben, die wie ein
   Spieler-Aufsteller aussehen, kommen ganz zuletzt. Reicht es nicht, wird
   von vorne wiederverwendet. */

'use strict';

window.Farben = (function () {

  let A = null;
  let AUFSTELLER = [], STIFTE = [], GRUPPEN = [];
  let seite = 'charaktere';   // welche Registerkarte im Popup offen ist

  /* ── Nachschlagen ── */

  const aufsteller = (id) => AUFSTELLER.find(f => f.id === id) || null;
  const stift      = (id) => STIFTE.find(f => f.id === id) || null;

  function aufstellerHex(id) { const f = aufsteller(id); return f ? f.hex : null; }
  function stiftHex(id)      { const f = stift(id);      return f ? f.hex : null; }

  // Welche Gruppe gehoert zu einer Kreatur? Brut richtet sich nach der Stufe,
  // Sonder und Boss stehen fest in kreaturen.json.
  function gruppeVon(kreatur, stufeId) {
    if (!kreatur) return null;
    if (kreatur.gruppe && kreatur.gruppe !== 'brut') return kreatur.gruppe;
    if (stufeId === 't1' || stufeId === 't2' || stufeId === 't3') return stufeId;
    return null;
  }

  // Aufsteller-Id fuer eine Kreatur, also die Farbe des Nodge
  function standVon(kreatur, stufeId) {
    const g = gruppeVon(kreatur, stufeId);
    return g ? (A.stufen()[g] || null) : null;
  }

  function istHell(hex) {
    if (!hex) return false;
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150;
  }

  /* ── Stifte vergeben ── */

  function zuteilen(liste, standFuer, alleNeu) {
    if (!STIFTE.length) return;
    const spielerStaende = new Set(A.spieler().map(s => s.stand).filter(Boolean));

    // Erst alles, was nicht nach einem Spieler aussieht - dann der Rest
    const reihe = STIFTE.filter(s => !s.wie || !spielerStaende.has(s.wie))
      .concat(STIFTE.filter(s => s.wie && spielerStaende.has(s.wie)));

    if (alleNeu) liste.forEach(i => { i.stift = null; });

    const benutzt = new Set(liste.map(i => i.stift).filter(Boolean));
    let lauf = benutzt.size;

    liste.forEach(inst => {
      if (inst.stift && stift(inst.stift)) return;
      const stand = standFuer(inst);
      let wahl = reihe.find(s => !benutzt.has(s.id) && s.wie !== stand)
              || reihe.find(s => !benutzt.has(s.id));
      if (!wahl) {                                   // alle zehn durch: von vorne
        const frei = reihe.filter(s => s.wie !== stand);
        const topf = frei.length ? frei : reihe;
        wahl = topf[lauf % topf.length];
      }
      inst.stift = wahl.id;
      benutzt.add(wahl.id);
      lauf++;
    });
  }

  /* ── Popup: Einstellungen mit zwei Registerkarten ── */

  function oeffnen(welche) {
    if (welche) seite = welche;
    A.sheet.auf('Einstellungen', (box) => {
      box.appendChild(reiter());
      if (seite === 'charaktere') maleCharaktere(box);
      else maleStufen(box);
    });
  }

  function reiter() {
    const leiste = document.createElement('div');
    leiste.className = 'fb-reiter';
    [['charaktere', 'Charaktere'], ['stufen', 'Gegner-Stufen']].forEach(([id, text]) => {
      const b = document.createElement('button');
      b.className = 'fb-reiter-knopf' + (seite === id ? ' an' : '');
      b.textContent = text;
      b.onclick = () => { seite = id; oeffnen(); };
      leiste.appendChild(b);
    });
    return leiste;
  }

  // Wer belegt einen Aufsteller? Gibt den Grund zurueck oder null.
  function belegtVon(standId, ausserSpieler, ausserGruppe) {
    const sp = A.spieler();
    for (let i = 0; i < sp.length; i++) {
      if (i !== ausserSpieler && sp[i].stand === standId) {
        return sp[i].name || ('Spieler ' + (i + 1));
      }
    }
    const st = A.stufen();
    for (const g of GRUPPEN) {
      if (g.id !== ausserGruppe && st[g.id] === standId) return g.name;
    }
    return null;
  }

  /* ─ Registerkarte 1: Charaktere ─ */

  function maleCharaktere(box) {
    const merk = document.createElement('div');
    merk.className = 'merk';
    merk.textContent = 'Name und Aufsteller pro Charakter. Was hier vergeben ist, ' +
      'steht den Gegner-Stufen nicht mehr zur Verfügung.';
    box.appendChild(merk);

    A.spieler().forEach((s, i) => {
      const kopf = document.createElement('div');
      kopf.className = 'fb-kopf';
      const titel = document.createElement('span');
      titel.className = 'gruppe-titel';
      titel.textContent = 'Spieler ' + (i + 1);
      kopf.appendChild(titel);
      if (A.spieler().length > 1) {
        const weg = document.createElement('button');
        weg.className = 'fb-weg';
        weg.textContent = 'entfernen';
        weg.onclick = () => { A.spielerWeg(i); oeffnen(); };
        kopf.appendChild(weg);
      }
      box.appendChild(kopf);

      const feld = document.createElement('input');
      feld.className = 'ini-eingabe';
      feld.type = 'text';
      feld.value = s.name || '';
      feld.placeholder = 'Name';
      feld.autocomplete = 'off';
      feld.oninput = () => { s.name = feld.value.trim(); A.speichern(); A.neuzeichnen(); };
      box.appendChild(feld);

      box.appendChild(staenderWahl(s.stand, i, null, (id) => {
        s.stand = id; A.speichern(); oeffnen(); A.neuzeichnen();
      }));
    });

    const dazu = document.createElement('button');
    dazu.className = 'fb-dazu';
    dazu.textContent = '+ Spieler';
    dazu.disabled = A.spieler().length >= AUFSTELLER.length;
    dazu.onclick = () => { A.spielerDazu(); oeffnen(); };
    box.appendChild(dazu);
  }

  /* ─ Registerkarte 2: Gegner-Stufen ─ */

  function maleStufen(box) {
    const merk = document.createElement('div');
    merk.className = 'merk';
    merk.textContent = 'Welcher Aufsteller steht unter welcher Gegner-Gruppe. ' +
      'Die Farbe erscheint als Nodge unten am Kasten.';
    box.appendChild(merk);

    GRUPPEN.forEach(g => {
      const titel = document.createElement('div');
      titel.className = 'gruppe-titel';
      titel.textContent = g.name;
      box.appendChild(titel);
      box.appendChild(staenderWahl(A.stufen()[g.id], null, g.id, (id) => {
        A.stufen()[g.id] = id; A.speichern(); oeffnen(); A.neuzeichnen();
      }));
    });

    const neu = document.createElement('button');
    neu.className = 'fb-dazu';
    neu.textContent = 'Punkte in allen Encountern neu verteilen';
    neu.onclick = () => { A.stifteNeu(); A.sheet.zu(); };
    box.appendChild(neu);
  }

  /* ─ Auswahlreihe der Aufsteller, belegte sind gesperrt ─ */

  function staenderWahl(gewaehlt, ausserSpieler, ausserGruppe, setzen) {
    const reihe = document.createElement('div');
    reihe.className = 'fb-staender';

    const keine = document.createElement('button');
    keine.className = 'fb-stand keiner' + (gewaehlt ? '' : ' gewaehlt');
    keine.textContent = '✕';
    keine.onclick = () => setzen(null);
    reihe.appendChild(keine);

    AUFSTELLER.forEach(f => {
      const b = document.createElement('button');
      const belegt = belegtVon(f.id, ausserSpieler, ausserGruppe);
      b.className = 'fb-stand' + (gewaehlt === f.id ? ' gewaehlt' : '') + (belegt ? ' belegt' : '');
      b.style.background = f.hex;
      b.title = belegt ? f.name + ' — belegt von ' + belegt : f.name;
      b.setAttribute('aria-label', b.title);
      if (belegt) b.disabled = true;
      else b.onclick = () => setzen(f.id);
      reihe.appendChild(b);
    });
    return reihe;
  }

  /* ── Start ── */

  function start(api, daten) {
    A = api;
    AUFSTELLER = daten.aufsteller || [];
    STIFTE = daten.stifte || [];
    GRUPPEN = daten.gruppen || [];
    const knopf = document.getElementById('charaktere');
    if (knopf) knopf.onclick = () => oeffnen('charaktere');
  }

  return {
    start: start, oeffnen: oeffnen, zuteilen: zuteilen,
    aufstellerHex: aufstellerHex, stiftHex: stiftHex,
    gruppeVon: gruppeVon, standVon: standVon, istHell: istHell,
    stifte: () => STIFTE, aufstellerListe: () => AUFSTELLER, gruppen: () => GRUPPEN
  };
})();

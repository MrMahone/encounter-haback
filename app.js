/* ═══ HP-Zähler · Die letzte Nacht ═══
   Oben tippen = HP dazu · unten tippen = HP weg.
   Tippen sammelt (Popup zeigt die Summe), Halten läuft schnell hoch.
   Nach ~1,2 s ohne Berührung wird verrechnet. */

'use strict';

const LS_KEY = 'ln-hp-v2';
const COMMIT_MS = 1200;   // Wartezeit nach dem letzten Tipp bis verrechnet wird
const HOLD_MS   = 400;    // ab wann Halten in den Schnelllauf geht
const TICK_MS   = 90;     // Takt des Schnelllaufs
const SCROLL_PX = 22;     // ab dieser Fingerbewegung gilt es als Scrollen, nicht als Tipp

let KREATUREN = [];       // Katalog
let KMAP = {};            // ref -> Kreatur
let ENCOUNTER = [];       // Liste
let PALETTE = null;       // data/farben.json
let state = null;         // { v, encIdx, seq, boards }
let p = null;             // laufende Eingabe
const karten = new Map(); // uid -> DOM-Referenzen

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

/* ───────────── Start ───────────── */

(async function start() {
  try {
    const [k, e, f] = await Promise.all([
      fetch('data/kreaturen.json').then(r => r.json()),
      fetch('data/encounter.json').then(r => r.json()),
      fetch('data/farben.json').then(r => r.json())
    ]);
    KREATUREN = k.kreaturen;
    KREATUREN.forEach(kr => KMAP[kr.ref] = kr);
    ENCOUNTER = e.encounters;
    PALETTE = f;
  } catch (err) {
    $('feld').innerHTML = '<div class="leer">Daten konnten nicht geladen werden.<br>' +
      'Die App muss über einen Server laufen (GitHub Pages oder <code>python -m http.server</code>),<br>' +
      'nicht per Doppelklick auf die Datei.</div>';
    return;
  }

  ladeState();
  verdrahten();
  farbenAnbinden();       // zuerst: das Initiativmodul fragt Farben ab
  initiativeAnbinden();
  zeigeEncounter();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // Uebernimmt eine neue Fassung, laedt die Seite einmal neu. Sonst zeigt der
    // erste Start nach einem Update noch die alte Fassung aus dem Cache und man
    // muesste die App zweimal schliessen.
    let schonNeu = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (schonNeu) return;
      schonNeu = true;
      location.reload();
    });
  }
})();

/* ───────────── Zustand ───────────── */

function ladeState() {
  try {
    const roh = JSON.parse(localStorage.getItem(LS_KEY));
    if (roh && roh.v === 2 && roh.boards) state = roh;
  } catch (_) {}
  if (!state) state = { v: 2, encIdx: 0, seq: 1, boards: {} };
  state.encIdx = clamp(state.encIdx | 0, 0, ENCOUNTER.length - 1);
  // Nachtragen, was in aelteren Staenden noch fehlt
  if (!Array.isArray(state.spieler) || !state.spieler.length) {
    state.spieler = [1, 2, 3].map(() => ({ name: '', stand: null }));
  }
  // Fruehere Faelle hatten eine freie Farbe (tag) statt eines Aufstellers
  state.spieler.forEach(s => {
    if (!('stand' in s)) s.stand = null;
    delete s.tag;
  });
  if (!state.initiative) state.initiative = {};
  if (!state.stufen) {
    state.stufen = {};
    (PALETTE.gruppen || []).forEach(g => { state.stufen[g.id] = g.standard || null; });
  }
}

function speichern() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (_) {}
}

function enc()   { return ENCOUNTER[state.encIdx]; }
function board() {
  const id = enc().id;
  if (!state.boards[id]) state.boards[id] = baueBoard(enc());
  return state.boards[id];
}
function finde(uid) { return board().find(i => i.uid === uid); }

function baueBoard(e) {
  const arr = [];
  (e.gegner || []).forEach(g => {
    for (let i = 0; i < (g.anzahl || 1); i++) {
      arr.push(neueInstanz(g.ref, g.stufe, { spaeter: g.spaeter, notiz: g.notiz }));
    }
  });
  stifteVerteilen(arr, true);
  return arr;
}

// Jede Kreatur bekommt ihren Punkt. true = alles neu, false = nur Luecken.
function stifteVerteilen(liste, alleNeu) {
  if (window.Farben) Farben.zuteilen(liste, standVonInstanz, alleNeu);
}

function standVonInstanz(inst) {
  return window.Farben ? Farben.standVon(KMAP[inst.ref], inst.stufe) : null;
}

function neueInstanz(ref, stufeId, opt) {
  opt = opt || {};
  const kr = KMAP[ref];
  if (!kr) return null;
  const st = kr.stufen.find(s => s.id === stufeId) || kr.stufen[0];
  return {
    uid:    'i' + (state.seq++),
    ref:    ref,
    stufe:  st.id,
    hp:     st.hp,
    max:    st.hp,
    ac:     st.ac,
    stift:  null,      // Punktfarbe oben auf dem Schildchen
    tot:    false,
    spaeter: opt.spaeter || null,
    notiz:  opt.notiz || '',
    extra:  !!opt.extra
  };
}

function stufeVon(inst) {
  const kr = KMAP[inst.ref];
  return (kr && kr.stufen.find(s => s.id === inst.stufe)) || null;
}

/* ───────────── Kopfzeile ───────────── */

function verdrahten() {
  $('prev').onclick  = () => blaettern(-1);
  $('next').onclick  = () => blaettern(1);
  $('titel').onclick = encounterListe;
  $('reset').onclick = encounterZuruecksetzen;
  $('sheet-zu').onclick = sheetZu;
  $('sheet').onclick = (ev) => { if (ev.target === $('sheet')) sheetZu(); };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') wakeLock();
    else uebernehmen();
  });
  window.addEventListener('pagehide', uebernehmen);
}

function blaettern(d) {
  uebernehmen();
  state.encIdx = clamp(state.encIdx + d, 0, ENCOUNTER.length - 1);
  speichern();
  zeigeEncounter();
}

function zeigeEncounter() {
  const e = enc();
  $('t-nr').textContent    = e.nr || e.id;
  $('t-name').textContent  = e.name || '';
  $('t-szene').textContent = [e.szene, e.funktion].filter(Boolean).join(' · ');
  $('prev').disabled = state.encIdx === 0;
  $('next').disabled = state.encIdx === ENCOUNTER.length - 1;
  zeichne();
}

/* ───────────── Feld zeichnen ───────────── */

// Laufnummer nur, wenn dieselbe Kreatur/Stufe mehrfach auf dem Feld steht.
// Wird vom Feld und vom Initiativmodul gebraucht, deshalb hier zentral.
function boardMitNummern() {
  const b = board();
  const zaehler = {}, laufend = {};
  b.forEach(i => { const k = i.ref + '|' + i.stufe; zaehler[k] = (zaehler[k] || 0) + 1; });
  return b.map(inst => {
    const k = inst.ref + '|' + inst.stufe;
    laufend[k] = (laufend[k] || 0) + 1;
    return { inst: inst, nr: zaehler[k] > 1 ? laufend[k] : 0 };
  });
}

function zeichne() {
  const feld = $('feld');
  feld.innerHTML = '';
  karten.clear();
  const b = board();

  if (!b.length) {
    const leer = document.createElement('div');
    leer.className = 'leer';
    leer.innerHTML = 'Kein Gegner auf dem Feld.<br>Über das <b>+</b> welche dazuholen.';
    feld.appendChild(leer);
  }

  boardMitNummern().forEach(e => feld.appendChild(baueKarte(e.inst, e.nr)));
  feld.appendChild(plusKachel());

  summe();
  if (window.Initiative) Initiative.zeichne();
}

// Steht immer dort, wo der naechste Kasten waere.
function plusKachel() {
  const b = document.createElement('button');
  b.className = 'plus-kachel';
  b.setAttribute('aria-label', 'Gegner hinzufügen');
  b.textContent = '+';
  b.onclick = gegnerHinzufuegen;
  return b;
}

function baueKarte(inst, nr) {
  const kr = KMAP[inst.ref] || { name: inst.ref, kurz: inst.ref, stufen: [] };
  const st = stufeVon(inst);

  const karte = document.createElement('div');
  karte.className = 'karte' + (inst.spaeter ? ' spaeter' : '');

  karte.innerHTML =
    '<div class="kopf">' +
      '<button class="tag" aria-label="Plättchen &amp; Optionen"></button>' +
      '<span class="beschriftung">' +
        '<span class="name"></span>' +
        '<span class="unter"></span>' +
      '</span>' +
      '<button class="totknopf" aria-label="tot / lebt">TOT</button>' +
    '</div>' +
    '<div class="zonen">' +
      '<div class="trenner"></div>' +
      '<div class="zone plus"></div>' +
      '<div class="zone minus"></div>' +
      '<div class="hp"><span class="zahl">0</span><span class="von"></span></div>' +
      '<div class="delta"></div>' +
    '</div>' +
    '<div class="fuss-zeile">' +
      '<span class="nodge"></span>' +
      '<div class="balken"><i></i></div>' +
    '</div>';

  const q = (s) => karte.querySelector(s);
  const ref = {
    karte: karte,
    zahl:  q('.zahl'),
    von:   q('.von'),
    delta: q('.delta'),
    bar:   q('.balken i'),
    tag:   q('.tag'),
    nodge: q('.nodge')
  };
  karten.set(inst.uid, ref);

  // Beschriftung. Die Laufnummer steht im Plättchen, nicht im Namen - im Namen
  // wuerde sie als Erstes abgeschnitten, und sie ist das Wichtigste am Kasten.
  ref.nr = nr;
  q('.name').textContent = kr.kurz || kr.name;
  const kurzStufe = st && st.kurz ? st.kurz : '';
  q('.unter').innerHTML = (kurzStufe ? '<span class="stufe">' + esc(kurzStufe) + '</span> · ' : '') +
    'AC ' + inst.ac;

  // Auf dem Kasten steht bewusst nur die Lebenszahl. Notiz und "kommt später"
  // stehen im Plättchen-Menü; auf dem Feld reicht der gestrichelte Rand.

  // Tippflächen
  q('.zone.plus').addEventListener('pointerdown',  (ev) => runter(ev, inst, +1));
  q('.zone.minus').addEventListener('pointerdown', (ev) => runter(ev, inst, -1));
  [q('.zone.plus'), q('.zone.minus')].forEach(z => {
    z.addEventListener('pointermove',   bewegt);
    z.addEventListener('pointerup',     hoch);
    z.addEventListener('pointercancel', abbruch);
  });

  // Knöpfe
  ref.tag.onclick = () => kartenMenue(inst);
  q('.totknopf').onclick = () => {
    uebernehmen();
    inst.tot = !inst.tot;
    speichern();
    malen(inst.uid);
    summe();
    if (window.Initiative) Initiative.zeichne();
  };

  faerbePunkt(ref.tag, inst.stift, nr);
  faerbeNodge(ref.nodge, standVonInstanz(inst));
  malen(inst.uid);
  return karte;
}

// Der Punkt oben: die Stiftfarbe, die du aufs Schildchen malst.
function faerbePunkt(el, stiftId, nr) {
  const hex = window.Farben ? Farben.stiftHex(stiftId) : null;
  el.style.background = hex || 'transparent';
  el.style.color = hex ? (Farben.istHell(hex) ? '#14161a' : '#fff') : '';
  el.classList.toggle('hat', !!hex);
  el.textContent = nr ? String(nr) : '';
}

// Der Nodge unten: die Farbe des Aufstellers, auf dem das Vieh steht.
function faerbeNodge(el, standId) {
  if (!el) return;
  const hex = window.Farben ? Farben.aufstellerHex(standId) : null;
  el.style.background = hex || 'transparent';
  el.classList.toggle('leer', !hex);
}

/* ───────────── Eingabe ───────────── */

function runter(ev, inst, sign) {
  wakeLock();

  if (p && p.uid !== inst.uid) uebernehmen();
  if (!p) p = { uid: inst.uid, delta: 0 };

  clearTimeout(p.commitTimer);
  p.commitTimer = null;
  p.vorGeste = p.delta;
  p.startY = ev.clientY;
  p.zeiger = ev.pointerType;
  p.bewegt = false;
  p.abgebrochen = false;
  p.sign = sign;
  p.inst = inst;

  schritt(inst, sign, 1);

  clearTimeout(p.holdTimer);
  p.holdTimer = setTimeout(() => schnellauf(inst, sign), HOLD_MS);

  try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (_) {}
}

function schnellauf(inst, sign) {
  if (!p) return;
  p.ticks = 0;
  p.repTimer = setInterval(() => {
    p.ticks++;
    const n = p.ticks < 10 ? 1 : p.ticks < 24 ? 2 : 5;
    schritt(inst, sign, n);
  }, TICK_MS);
}

function stoppLauf() {
  if (!p) return;
  clearTimeout(p.holdTimer);
  clearInterval(p.repTimer);
  p.holdTimer = p.repTimer = null;
}

// Nur merken, dass der Finger gewandert ist - noch nichts verwerfen. Ob es
// wirklich Scrollen war, sagt uns erst der Browser (siehe abbruch).
// Mit Maus oder Stift wird gar nicht gescrollt: eine unruhige Hand waehrend
// des Klicks ist dort kein Wischen und darf den Klick nicht schlucken.
function bewegt(ev) {
  if (!p || p.zeiger !== 'touch' || p.bewegt || p.abgebrochen) return;
  if (Math.abs(ev.clientY - p.startY) > SCROLL_PX) p.bewegt = true;
}

// pointercancel: der Browser hat die Geste an sich gezogen. Zusammen mit einer
// echten Fingerbewegung heisst das Scrollen - sonst war es ein normaler Tipp.
function abbruch() {
  if (!p) return;
  if (p.bewegt) { gesteVerwerfen(); return; }
  hoch();
}

// Es wurde gescrollt: dieser Tipp zaehlt nicht.
function gesteVerwerfen() {
  stoppLauf();
  p.abgebrochen = true;
  p.delta = p.vorGeste;
  const uid = p.uid;
  if (p.delta === 0) { p = null; malen(uid); }
  else { malen(uid); planeUebernahme(); }
}

function hoch() {
  if (!p || p.abgebrochen) return;
  stoppLauf();
  planeUebernahme();
}

function planeUebernahme() {
  if (!p) return;
  clearTimeout(p.commitTimer);
  p.commitTimer = setTimeout(uebernehmen, COMMIT_MS);
}

function schritt(inst, sign, n) {
  const neu = clamp(inst.hp + p.delta + sign * n, 0, inst.max);
  p.delta = neu - inst.hp;
  malen(inst.uid);
}

function uebernehmen() {
  if (!p) return;
  stoppLauf();
  clearTimeout(p.commitTimer);
  const uid = p.uid, d = p.delta;
  const inst = finde(uid);
  p = null;
  if (inst && d !== 0) inst.hp = clamp(inst.hp + d, 0, inst.max);
  speichern();
  malen(uid);
  summe();
}

/* ───────────── Anzeige ───────────── */

function malen(uid) {
  const inst = finde(uid), ref = karten.get(uid);
  if (!inst || !ref) return;

  const pend = (p && p.uid === uid) ? p.delta : 0;
  const zeig = clamp(inst.hp + pend, 0, inst.max);

  ref.zahl.textContent = zeig;
  ref.von.textContent  = '/ ' + inst.max;
  ref.karte.classList.toggle('vorschau', pend !== 0);
  ref.karte.classList.toggle('aktiv', pend !== 0);
  ref.karte.classList.toggle('tot', !!inst.tot);

  ref.delta.className = 'delta' + (pend !== 0 ? ' an' : '') + (pend < 0 ? ' ab' : ' zu');
  ref.delta.textContent = (pend > 0 ? '+' : '−') + Math.abs(pend);

  const anteil = inst.max ? zeig / inst.max : 0;
  ref.bar.style.width = (anteil * 100) + '%';
  ref.bar.className = anteil > 0.5 ? '' : anteil > 0.25 ? 'mittel' : 'tief';
}

function summe() {
  const b = board();
  const rest = b.reduce((s, i) => s + (i.tot ? 0 : i.hp), 0);
  const ganz = b.reduce((s, i) => s + i.max, 0);
  const lebend = b.filter(i => !i.tot && i.hp > 0).length;
  $('summe').innerHTML = ganz
    ? '<b>' + rest + '</b>&nbsp;/&nbsp;' + ganz + ' HP&nbsp;&nbsp;·&nbsp;&nbsp;' + lebend + ' auf dem Feld'
    : '';
}

/* ───────────── Sheet ───────────── */

function sheetAuf(titel, bauen, breit) {
  uebernehmen();
  $('sheet-titel').textContent = titel;
  $('sheet-box').classList.toggle('breit', !!breit);
  const inhalt = $('sheet-inhalt');
  inhalt.innerHTML = '';
  bauen(inhalt);
  $('sheet').hidden = false;
}
function sheetZu() { $('sheet').hidden = true; }

function zeile(text, unter, onclick, klasse) {
  const b = document.createElement('button');
  b.className = 'zeile' + (klasse ? ' ' + klasse : '');
  b.innerHTML = esc(text) + (unter ? '<small>' + esc(unter) + '</small>' : '');
  b.onclick = onclick;
  return b;
}
function gruppe(text) {
  const d = document.createElement('div');
  d.className = 'gruppe-titel';
  d.textContent = text;
  return d;
}

/* ─── Menü einer Karte ─── */

function kartenMenue(inst) {
  const kr = KMAP[inst.ref];
  const st = stufeVon(inst);
  sheetAuf(kr.name + (st && st.kurz ? ' ' + st.kurz : ''), (box) => {

    if (inst.notiz || inst.spaeter) {
      const n = document.createElement('div');
      n.className = 'merk';
      n.innerHTML = (inst.spaeter ? '<b>' + esc(inst.spaeter) + '</b> · ' : '') + esc(inst.notiz || '');
      box.appendChild(n);
    }

    // Aufsteller: ergibt sich aus der Gruppe, wird hier nur angezeigt
    const stand = standVonInstanz(inst);
    const zeig = document.createElement('div');
    zeig.className = 'fb-hinweis';
    const nod = document.createElement('span');
    nod.className = 'nodge';
    faerbeNodge(nod, stand);
    zeig.appendChild(nod);
    const wo = document.createElement('span');
    const gr = window.Farben ? Farben.gruppen().find(g => g.id === Farben.gruppeVon(kr, inst.stufe)) : null;
    wo.innerHTML = stand
      ? 'Aufsteller <b>' + esc((Farben.aufstellerListe().find(a => a.id === stand) || {}).name || '') +
        '</b> · aus ' + esc(gr ? gr.name : '—')
      : 'Kein Aufsteller für diese Gruppe — unter ⚙ zuweisen';
    zeig.appendChild(wo);
    box.appendChild(zeig);

    box.appendChild(gruppe('Punkt oben (Stift)'));
    const reihe = document.createElement('div');
    reihe.className = 'farben';
    const keine = document.createElement('button');
    keine.className = 'farbe keine' + (inst.stift ? '' : ' gewaehlt');
    keine.textContent = '✕';
    keine.onclick = () => setzeStift(inst, null);
    reihe.appendChild(keine);
    (window.Farben ? Farben.stifte() : []).forEach(f => {
      const b = document.createElement('button');
      b.className = 'farbe' + (inst.stift === f.id ? ' gewaehlt' : '');
      b.style.background = f.hex;
      b.title = f.name;
      b.onclick = () => setzeStift(inst, f.id);
      reihe.appendChild(b);
    });
    box.appendChild(reihe);

    if (kr.stufen.length > 1) {
      box.appendChild(gruppe('Stufe wechseln (setzt HP neu)'));
      kr.stufen.forEach(s => {
        box.appendChild(zeile(s.label, s.hp + ' HP · AC ' + s.ac, () => {
          inst.stufe = s.id; inst.max = s.hp; inst.hp = s.hp; inst.ac = s.ac; inst.tot = false;
          speichern(); sheetZu(); zeichne();
        }, inst.stufe === s.id ? 'gewaehlt' : ''));
      });
    }

    box.appendChild(gruppe('Kasten'));
    box.appendChild(zeile('HP auf ' + inst.max + ' zurücksetzen', null, () => {
      inst.hp = inst.max; inst.tot = false;
      speichern(); sheetZu(); malen(inst.uid); summe();
    }));
    box.appendChild(zeile('Kasten entfernen', null, () => {
      const b = board();
      b.splice(b.indexOf(inst), 1);
      speichern(); sheetZu(); zeichne();
    }, 'warn'));
  });
}

function setzeStift(inst, stiftId) {
  inst.stift = stiftId;
  speichern();
  const ref = karten.get(inst.uid);
  if (ref) faerbePunkt(ref.tag, stiftId, ref.nr);
  if (window.Initiative) Initiative.zeichne();
  sheetZu();
}

/* ─── Encounter-Liste ─── */

function encounterListe() {
  sheetAuf('Encounter', (box) => {
    ENCOUNTER.forEach((e, idx) => {
      const b = state.boards[e.id];
      let stand = e.funktion || '';
      if (b) {
        const rest = b.reduce((s, i) => s + (i.tot ? 0 : i.hp), 0);
        const ganz = b.reduce((s, i) => s + i.max, 0);
        stand = rest + ' / ' + ganz + ' HP übrig' + (e.funktion ? ' · ' + e.funktion : '');
      }
      box.appendChild(zeile((e.nr || e.id) + ' · ' + e.name, stand, () => {
        state.encIdx = idx; speichern(); sheetZu(); zeigeEncounter();
      }, idx === state.encIdx ? 'gewaehlt' : ''));
    });
    box.appendChild(gruppe('Alles'));
    box.appendChild(zeile('Alle Encounter zurücksetzen', 'Setzt jeden Kasten auf die Grundbesetzung.', () => {
      state.boards = {}; state.seq = 1;
      speichern(); sheetZu(); zeigeEncounter();
    }, 'warn'));
  });
}

/* ─── Gegner hinzufügen ─── */

function gegnerHinzufuegen() {
  sheetAuf('Wer kommt dazu?', (box) => {
    KREATUREN.forEach(kr => {
      box.appendChild(zeile(kr.name, kr.stufen.length > 1
        ? kr.stufen.length + ' Stufen'
        : kr.stufen[0].hp + ' HP · AC ' + kr.stufen[0].ac,
        () => kr.stufen.length > 1 ? stufenWahl(kr) : lege(kr, kr.stufen[0])));
    });
  });
}

function stufenWahl(kr) {
  sheetAuf(kr.name, (box) => {
    kr.stufen.forEach(s => {
      box.appendChild(zeile(s.label, s.hp + ' HP · AC ' + s.ac, () => lege(kr, s)));
    });
    box.appendChild(gruppe(''));
    box.appendChild(zeile('‹ zurück', null, gegnerHinzufuegen));
  });
}

function lege(kr, st) {
  const inst = neueInstanz(kr.ref, st.id, { extra: true, notiz: 'nachträglich dazugeholt' });
  board().push(inst);
  stifteVerteilen(board(), false);   // nur der Neue bekommt einen Punkt
  speichern();
  // Laeuft gerade ein Kampf, reiht er sich hinten ein
  if (window.Initiative) Initiative.anhaengen(inst.uid);
  sheetZu();
  zeichne();
  const ref = karten.get(inst.uid);
  if (ref) ref.karte.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ─── Encounter zurücksetzen ─── */

function encounterZuruecksetzen() {
  const e = enc();
  sheetAuf((e.nr || e.id) + ' zurücksetzen?', (box) => {
    box.appendChild(zeile('Ja, Grundbesetzung wiederherstellen',
      'Alle HP voll, alle Flaggen und Plättchen weg, dazugeholte Gegner verschwinden.', () => {
        state.boards[e.id] = baueBoard(e);
        speichern(); sheetZu(); zeichne();
      }, 'warn'));
    box.appendChild(zeile('Nur alle HP auffüllen', 'Besetzung und Plättchen bleiben, wie sie sind.', () => {
      board().forEach(i => { i.hp = i.max; i.tot = false; });
      speichern(); sheetZu(); zeichne();
    }));
    box.appendChild(zeile('Abbrechen', null, sheetZu));
  });
}

/* ───────────── Schnittstelle fuers Initiativmodul ─────────────
   Absichtlich schmal: das Modul kennt weder die Kaesten noch den
   Tipp-Zaehler, nur diese Handvoll Funktionen. Umgekehrt weiss der
   HP-Zaehler vom Modul nur, dass es ein zeichne() hat. */

// Das Farbmodul bekommt Zugriff auf Spieler und Stufen-Zuordnung.
function farbenAnbinden() {
  if (!window.Farben) return;
  Farben.start({
    spieler:     () => state.spieler,
    spielerDazu: () => { state.spieler.push({ name: '', stand: null }); speichern(); },
    spielerWeg:  (i) => { state.spieler.splice(i, 1); speichern(); aufraeumenNachSpieler(); },
    stufen:      () => state.stufen,
    speichern:   speichern,
    neuzeichnen: () => { zeichne(); },
    // Alle Punkte in allen Encountern neu vergeben
    stifteNeu:   () => {
      Object.keys(state.boards).forEach(id => stifteVerteilen(state.boards[id], true));
      speichern(); zeichne();
    },
    sheet:       { auf: sheetAuf, zu: sheetZu }
  }, PALETTE);

  // Boards aus aelteren Staenden haben noch keine Punkte - Luecken fuellen
  Object.keys(state.boards).forEach(id => stifteVerteilen(state.boards[id], false));
  speichern();
}

// Faellt ein Spieler weg, verschwindet er auch aus jeder Initiative.
function aufraeumenNachSpieler() {
  const n = state.spieler.length;
  Object.keys(state.initiative).forEach(id => {
    const d = state.initiative[id];
    d.folge = d.folge.filter(s => s.charAt(0) !== 's' || +s.slice(2) < n);
    if (d.aktiv >= d.folge.length) d.aktiv = 0;
  });
  speichern();
  if (window.Initiative) Initiative.zeichne();
}

function initiativeAnbinden() {
  if (!window.Initiative) return;
  Initiative.start({
    encId:      () => enc().id,
    encName:    () => (enc().nr || enc().id) + ' · ' + (enc().name || ''),
    // Gegner des laufenden Encounters, flach und ohne Innenleben
    gegner:     () => boardMitNummern().map(e => {
                  const kr = KMAP[e.inst.ref] || {};
                  const st = stufeVon(e.inst);
                  return {
                    uid:   e.inst.uid,
                    name:  kr.kurz || kr.name || e.inst.ref,
                    stufe: st && st.kurz ? st.kurz : '',
                    nr:    e.nr,
                    hex:   window.Farben ? Farben.stiftHex(e.inst.stift) : null,
                    tot:   !!e.inst.tot || e.inst.hp <= 0
                  };
                }),
    // Charaktere stehen auf Aufstellern, Gegner tragen Stiftpunkte
    spieler:    () => state.spieler.map((s, i) => ({
                  name: s.name || ('Spieler ' + (i + 1)),
                  benannt: !!s.name,
                  hex: window.Farben ? Farben.aufstellerHex(s.stand) : null
                })),
    initiative: () => state.initiative,
    speichern:  speichern,
    istHell:    (hex) => window.Farben ? Farben.istHell(hex) : false,
    sheet:      { auf: sheetAuf, zu: sheetZu, zeile: zeile, gruppe: gruppe }
  });
}

/* ─── Kleinkram ─── */

let sperre = null;
async function wakeLock() {
  if (sperre || !('wakeLock' in navigator)) return;
  try {
    sperre = await navigator.wakeLock.request('screen');
    sperre.addEventListener('release', () => { sperre = null; });
  } catch (_) { sperre = null; }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

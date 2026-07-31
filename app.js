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

const FARBEN = [
  { id: 'rot',     hex: '#d4423a' },
  { id: 'orange',  hex: '#e07b2c' },
  { id: 'gelb',    hex: '#dcc22e' },
  { id: 'gruen',   hex: '#3fae63' },
  { id: 'tuerkis', hex: '#2fb0a8' },
  { id: 'blau',    hex: '#3d7fd6' },
  { id: 'violett', hex: '#8a5fd0' },
  { id: 'pink',    hex: '#d9539b' },
  { id: 'weiss',   hex: '#e8e8e8' },
  { id: 'grau',    hex: '#565b66' }
];

let KREATUREN = [];       // Katalog
let KMAP = {};            // ref -> Kreatur
let ENCOUNTER = [];       // Liste
let state = null;         // { v, encIdx, seq, boards }
let p = null;             // laufende Eingabe
const karten = new Map(); // uid -> DOM-Referenzen

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

/* ───────────── Start ───────────── */

(async function start() {
  try {
    const [k, e] = await Promise.all([
      fetch('data/kreaturen.json').then(r => r.json()),
      fetch('data/encounter.json').then(r => r.json())
    ]);
    KREATUREN = k.kreaturen;
    KREATUREN.forEach(kr => KMAP[kr.ref] = kr);
    ENCOUNTER = e.encounters;
  } catch (err) {
    $('feld').innerHTML = '<div class="leer">Daten konnten nicht geladen werden.<br>' +
      'Die App muss über einen Server laufen (GitHub Pages oder <code>python -m http.server</code>),<br>' +
      'nicht per Doppelklick auf die Datei.</div>';
    return;
  }

  ladeState();
  verdrahten();
  zeigeEncounter();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
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
  return arr;
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
    tag:    null,
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
  $('add').onclick   = gegnerHinzufuegen;
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

function zeichne() {
  const feld = $('feld');
  feld.innerHTML = '';
  karten.clear();
  const b = board();

  if (!b.length) {
    feld.innerHTML = '<div class="leer">Kein Gegner auf dem Feld.<br>Mit <b>+</b> oben rechts welche dazuholen.</div>';
    summe();
    return;
  }

  // Durchnummerieren, wenn dieselbe Kreatur/Stufe mehrfach vorkommt
  const zaehler = {};
  b.forEach(i => { const k = i.ref + '|' + i.stufe; zaehler[k] = (zaehler[k] || 0) + 1; });
  const laufend = {};

  b.forEach(inst => {
    const k = inst.ref + '|' + inst.stufe;
    laufend[k] = (laufend[k] || 0) + 1;
    feld.appendChild(baueKarte(inst, zaehler[k] > 1 ? laufend[k] : 0));
  });

  summe();
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
      '<button class="totknopf" aria-label="tot / lebt">✝</button>' +
    '</div>' +
    '<div class="zonen">' +
      '<div class="trenner"></div>' +
      '<div class="zone plus"></div>' +
      '<div class="zone minus"></div>' +
      '<div class="hp"><span class="zahl">0</span><span class="von"></span></div>' +
      '<div class="delta"></div>' +
    '</div>' +
    '<div class="balken"><i></i></div>' +
    '<div class="notiz"></div>';

  const q = (s) => karte.querySelector(s);
  const ref = {
    karte: karte,
    zahl:  q('.zahl'),
    von:   q('.von'),
    delta: q('.delta'),
    bar:   q('.balken i'),
    tag:   q('.tag')
  };
  karten.set(inst.uid, ref);

  // Beschriftung
  q('.name').textContent = (kr.kurz || kr.name) + (nr ? ' ' + nr : '');
  const kurzStufe = st && st.kurz ? st.kurz : '';
  q('.unter').innerHTML = (kurzStufe ? '<span class="stufe">' + esc(kurzStufe) + '</span> · ' : '') +
    'AC ' + inst.ac;

  // Notiz
  const notiz = q('.notiz');
  notiz.innerHTML = (inst.spaeter ? '<span class="spaeter-tag">' + esc(inst.spaeter) + '</span> · ' : '') +
    esc(inst.notiz || '');

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
  };

  faerbeTag(ref.tag, inst.tag);
  malen(inst.uid);
  return karte;
}

function faerbeTag(el, tagId) {
  const f = FARBEN.find(x => x.id === tagId);
  el.style.background = f ? f.hex : 'transparent';
  el.classList.toggle('hat', !!f);
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

function bewegt(ev) {
  if (!p || p.bewegt || p.abgebrochen) return;
  if (Math.abs(ev.clientY - p.startY) > SCROLL_PX) {
    p.bewegt = true;
    gesteVerwerfen();
  }
}

function abbruch() {
  if (!p) return;
  if (p.bewegt) { gesteVerwerfen(); return; }
  hoch();
}

// Der Finger ist gewandert: dieser Tipp war Scrollen, nicht Zählen.
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

function sheetAuf(titel, bauen) {
  uebernehmen();
  $('sheet-titel').textContent = titel;
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

    box.appendChild(gruppe('Plättchen'));
    const reihe = document.createElement('div');
    reihe.className = 'farben';
    const keine = document.createElement('button');
    keine.className = 'farbe keine' + (inst.tag ? '' : ' gewaehlt');
    keine.textContent = '✕';
    keine.onclick = () => setzeTag(inst, null);
    reihe.appendChild(keine);
    FARBEN.forEach(f => {
      const b = document.createElement('button');
      b.className = 'farbe' + (inst.tag === f.id ? ' gewaehlt' : '');
      b.style.background = f.hex;
      b.onclick = () => setzeTag(inst, f.id);
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

function setzeTag(inst, tagId) {
  inst.tag = tagId;
  speichern();
  const ref = karten.get(inst.uid);
  if (ref) faerbeTag(ref.tag, tagId);
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
  speichern();
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

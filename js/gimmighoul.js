// Hidden Gimmighoul: each day one hides somewhere on one page of the site (same spot for the whole table).
// Clicking it gives the player's character 1d100 Poké, once per character per day; then it's gone for them.
import * as store from './store.js?v=6ae64af6';
import { esc, toast, num, die } from './util.js?v=6ae64af6';
import { markWinner } from './sparkle.js?v=6ae64af6';
import { logRoll } from './play.js?v=6ae64af6';
import { gameSay } from './chatter.js?v=6ae64af6';

const PAGES = [['join', 'Home'], ['play', 'Play'], ['guild', 'Guild'], ['vault', 'Vault'], ['games', 'Games'], ['rules', 'Rulebook']];
const meId = () => { try { return localStorage.getItem('dc.me.' + store.tableCode()) || ''; } catch { return ''; } };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// a small seeded random so every device at the table agrees on today's hiding spot
function seeded(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }

export function todaysSpot() {
  const r = seeded(store.tableCode() + '|' + today());
  const [page, name] = PAGES[Math.floor(r() * PAGES.length)];
  return { page, name, x: 3 + r() * 90, y: 0.12 + r() * 0.76 };
}

const claimPath = (id) => `gimmighoul/${today()}/${id}`;
// her rule: once a player has seen him, he runs off 30 seconds later and stays gone for that player for the day
const STAY = 30e3;
const seenPath = (id) => `gimmighoul_seen/${today()}/${id}`;
let runTimer = 0;
function runOff() {
  const g = document.getElementById('gimmi'); if (!g || g.classList.contains('gone')) return;
  coin(false); g.classList.add('gone', 'ran'); setTimeout(() => g.remove(), 900);
}

// a short coin jingle, made in the browser (no sound file): rising when he appears, falling when he leaves.
// Browsers only allow sound after the player has clicked/tapped the page once, so a silent first load is normal.
let actx = null;
function coin(up = true) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const notes = up ? [988, 1319, 1976] : [1976, 1319, 988];   // B5 E6 B6, like a coin pickup
    notes.forEach((f, i) => {
      const t = actx.currentTime + i * 0.07; const o = actx.createOscillator(); const v = actx.createGain();
      o.type = 'square'; o.frequency.value = f;
      v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(0.06, t + 0.01); v.gain.exponentialRampToValueAtTime(0.0001, t + (i === notes.length - 1 ? 0.35 : 0.09));
      o.connect(v).connect(actx.destination); o.start(t); o.stop(t + 0.4);
    });
  } catch { /* no sound on this device */ }
}

let spotNow = null;
function place() {
  const g = document.getElementById('gimmi'); const main = document.getElementById('main'); if (!g || !main || !spotNow) return;
  const r = main.getBoundingClientRect();
  g.style.left = `${r.left + scrollX + r.width * spotNow.x / 100}px`; g.style.top = `${r.top + scrollY + r.height * spotNow.y}px`;
}
addEventListener('resize', place);

// called after every page render; keeps the same element (and its animation) while it should stay
export function placeGimmighoul(page, sub = '') {
  const spot = todaysSpot(); const id = meId(); const c = (store.get('party') || {})[id];
  let g = document.getElementById('gimmi');
  const seen = num(store.get(seenPath(id)));
  if (page !== spot.page || sub || !c || store.get(claimPath(id)) != null || (seen && Date.now() - seen >= STAY)) { if (g && !g.classList.contains('gone')) { g.remove(); clearTimeout(runTimer); } return; }
  spotNow = spot;
  if (g && g.dataset.who === id) { place(); return; }
  // first sighting starts this player's 30 seconds (kept on the table, so a reload doesn't reset it)
  const start = seen || Date.now(); if (!seen) store.set(seenPath(id), start);
  clearTimeout(runTimer); runTimer = setTimeout(runOff, Math.max(0, start + STAY - Date.now()));
  g?.remove();
  g = document.createElement('button');
  g.id = 'gimmi'; g.className = 'gimmi'; g.dataset.who = id; g.title = 'Gimmighoul'; g.setAttribute('aria-label', 'A hiding Gimmighoul');
  g.innerHTML = '<img src="assets/ui/gimmighoul_idle.webp" alt="">';
  document.body.appendChild(g); place(); coin(true);
  g.onclick = () => {
    clearTimeout(runTimer);
    if (store.get(claimPath(id)) != null) { g.remove(); return; }
    const amt = die(100);
    store.set(claimPath(id), amt);
    store.update('party/' + id, (x) => ({ ...x, poke: num(x?.poke) + amt }));
    store.pushLimited('log', { t: Date.now(), text: `${c.nickname} found a hiding Gimmighoul and got ${amt} Poké!` });
    gameSay('Gimmighoul', 'do', `was found hiding by ${c.nickname} and dropped ${amt} Poké! ✨`, 'gimmighoul', c.nickname);
    logRoll(c.nickname, 'found a hidden Gimmighoul', null, `it dropped ${amt} Poké`, 'note');
    markWinner(id);
    coin(false); g.classList.add('gone'); setTimeout(() => g.remove(), 900);
    toast(`✨ You found Gimmighoul! It dropped ${amt} Poké.`);
  };
}

// GM hint line: where today's Gimmighoul hides and who found it
export function gmGimmighoulHTML() {
  const s = todaysSpot(); const found = store.get('gimmighoul/' + today()) || {}; const party = store.get('party') || {};
  const who = Object.entries(found).map(([id, a]) => `${esc(party[id]?.nickname || '?')} (${num(a)})`).join(', ');
  const seen = store.get('gimmighoul_seen/' + today()) || {};
  const missed = Object.entries(seen).filter(([id, t]) => found[id] == null && Date.now() - num(t) >= STAY).map(([id]) => esc(party[id]?.nickname || '?')).join(', ');
  return `<p class="small muted">✨ Today's hidden Gimmighoul is on the <b>${esc(s.name)}</b> page. Each player gets 30 seconds once they spot him.${who ? ` Found by: ${who}.` : ' Nobody has found it yet.'}${missed ? ` Ran off from: ${missed}.` : ''}</p>`;
}

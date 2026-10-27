// Hidden Gimmighoul: each day one hides somewhere on one page of the site (same spot for the whole table).
// Clicking it gives the player's character 1d100 Poké, once per character per day; then it's gone for them.
import * as store from './store.js?v=6ae00fd2';
import { esc, toast, num, die } from './util.js?v=6ae00fd2';
import { markWinner } from './sparkle.js?v=6ae00fd2';
import { logRoll } from './play.js?v=6ae00fd2';

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
  if (page !== spot.page || sub || !c || store.get(claimPath(id)) != null) { if (g && !g.classList.contains('gone')) g.remove(); return; }
  spotNow = spot;
  if (g && g.dataset.who === id) { place(); return; }
  g?.remove();
  g = document.createElement('button');
  g.id = 'gimmi'; g.className = 'gimmi'; g.dataset.who = id; g.title = 'Gimmighoul'; g.setAttribute('aria-label', 'A hiding Gimmighoul');
  g.innerHTML = '<img src="assets/ui/gimmighoul_idle.webp" alt="">';
  document.body.appendChild(g); place();
  g.onclick = () => {
    if (store.get(claimPath(id)) != null) { g.remove(); return; }
    const amt = die(100);
    store.set(claimPath(id), amt);
    store.update('party/' + id, (x) => ({ ...x, poke: num(x?.poke) + amt }));
    store.pushLimited('log', { t: Date.now(), text: `${c.nickname} found a hiding Gimmighoul and got ${amt} Poké (1d100)!` });
    store.pushLimited('chatter', { who: 'Gimmighoul', kind: 'do', text: `was found hiding by ${c.nickname} and dropped ${amt} Poké! ✨`, tag: 'gimmighoul', t: Date.now() }, 80);
    logRoll(c.nickname, 'found a hidden Gimmighoul (1d100)', null, `rolled ${amt} · won ${amt} Poké`, 'note');
    markWinner(id);
    g.classList.add('gone'); setTimeout(() => g.remove(), 900);
    toast(`✨ You found Gimmighoul! It dropped ${amt} Poké (1d100: ${amt}).`);
  };
}

// GM hint line: where today's Gimmighoul hides and who found it
export function gmGimmighoulHTML() {
  const s = todaysSpot(); const found = store.get('gimmighoul/' + today()) || {}; const party = store.get('party') || {};
  const who = Object.entries(found).map(([id, a]) => `${esc(party[id]?.nickname || '?')} (${num(a)})`).join(', ');
  return `<p class="small muted">✨ Today's hidden Gimmighoul is on the <b>${esc(s.name)}</b> page.${who ? ` Found by: ${who}.` : ' Nobody has found it yet.'}</p>`;
}

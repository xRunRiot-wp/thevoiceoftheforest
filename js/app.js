import { CONFIG } from './config.js?v=6ade7aea';
import * as store from './store.js?v=6ade7aea';
import * as sheet from './sheetdata.js?v=6ade7aea';
import { $, $$, esc, uid } from './util.js?v=6ade7aea';
import { closeModal, maxHp } from './ui.js?v=6ade7aea';
import { renderJoin, renderPlay } from './play.js?v=6ade7aea';
import { renderGM } from './gm.js?v=6ade7aea';
import { renderGuild } from './guild.js?v=6ade7aea';
import { renderRules } from './rulebook.js?v=6ade7aea';
import { renderVault } from './vault.js?v=6ade7aea';
import { renderGames } from './games.js?v=6ade7aea';

const main = $('#main');
let current = '';
let rerender = null;

export function myId() { try { return localStorage.getItem('dc.me.' + store.tableCode()) || ''; } catch { return ''; } }
export function setMe(id) { try { if (id) localStorage.setItem('dc.me.' + store.tableCode(), id); else localStorage.removeItem('dc.me.' + store.tableCode()); } catch { /* ignore */ } }
export function joined() { try { return !!localStorage.getItem('dc.joined.' + store.tableCode()); } catch { return false; } }
export function setJoined(v) { try { if (v) localStorage.setItem('dc.joined.' + store.tableCode(), '1'); else localStorage.removeItem('dc.joined.' + store.tableCode()); } catch { /* ignore */ } }

export async function openTable(code) {
  code = String(code || CONFIG.defaultTable).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24) || CONFIG.defaultTable;
  try { localStorage.setItem('dc.code', code); } catch { /* ignore */ }
  await store.open(code);
  await seedIfEmpty();
  await store.gmTryRemembered();
}

// A brand-new table starts from the campaign spreadsheet: the party in the Guild tab and the guild coffers.
async function seedIfEmpty() {
  if (store.get('seeded')) return;
  const wait = store.status.mode === 'shared' ? new Promise((r) => setTimeout(r, 1500)) : null;
  if (wait) { await wait; if (store.get('seeded')) return; }
  let g = { coffers: null, chars: [] };
  try { g = await sheet.guild(); } catch { /* offline */ }
  const party = {};
  for (const c of g.chars) {
    const id = uid();
    party[id] = { ...c, id, hp: maxHp(c), willCur: c.will, status: [], held: '', garments: '', tp: 0, notes: '', fromSheet: true };
  }
  store.set('party', party);
  store.set('guild', { name: 'Gravity Falls Guild', team: 'Woodland Base team', coffers: g.coffers ?? 0, gp: 30, rankIdx: 1, chapter: 1 });
  const m1 = uid();
  store.set('missions', { [m1]: { rank: 'E', title: 'Rebuild Woodland Base', client: 'Gravity Falls Guild', details: 'Clear the damage. Recover supplies. Repair essential services. Help displaced Pokémon return home.', status: 'taken', story: true, ts: Date.now() } });
  store.set('session', { n: 1, active: false, mission: m1, dungeon: '', floor: 0, floors: 0 });
  store.set('seeded', Date.now());
}

const ROUTES = [
  ['play', 'Play'], ['guild', 'Guild'], ['vault', 'Vault'], ['games', 'Games'], ['rules', 'Rulebook'], ['gm', 'GM'],
];

function navHTML(active) {
  return ROUTES.map(([k, l]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}">${l}</a>`).join('');
}

function statusChip() {
  const s = store.status;
  const el = $('#tablechip');
  if (!el) return;
  const code = store.tableCode();
  // "live" = the GM has the game running (GM screen toggle), not just the connection
  const live = !!store.get('session/live');
  if (s.mode === 'shared') { el.textContent = `Table ${code} · ${!s.connected ? 'connecting…' : live ? 'live' : 'not live'}`; el.classList.toggle('live', s.connected && live); }
  else { el.textContent = `Table ${code} · this device`; el.classList.remove('live'); }
}

async function route() {
  closeModal();
  const [path, ...rest] = (location.hash.replace(/^#\/?/, '') || '').split('/');
  let page = path || 'join'; // the bare link always opens the home page; Play remembers your character
  if (page === 'play' && !joined()) page = 'join';
  current = page;
  $('#tabs').innerHTML = navHTML(page === 'join' ? 'play' : page);
  window.scrollTo(0, 0);
  const render = { join: renderJoin, play: renderPlay, gm: renderGM, guild: renderGuild, vault: renderVault, games: renderGames, rules: renderRules }[page] || renderJoin;
  rerender = () => render(main, rest);
  await rerender();
  statusChip();
}

// Re-render the live pages when the table changes, without losing typing focus.
let pending = false;
store.subscribe(() => {
  statusChip();
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    const a = document.activeElement;
    const typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && main.contains(a);
    if (document.querySelector('.sheet-bg')) return;   // a modal is open; it refreshes itself
    if (!typing && ['join', 'play', 'gm', 'guild', 'vault'].includes(current)) rerender?.();
  });
});

window.addEventListener('hashchange', route);

(async () => {
  let code = CONFIG.defaultTable;
  const q = new URLSearchParams(location.search).get('t');
  try { code = q || localStorage.getItem('dc.code') || code; } catch { /* ignore */ }
  await openTable(code);
  // ?as=<name> opens the table straight as that character (handy links the GM can send each player).
  const as = new URLSearchParams(location.search).get('as');
  if (as) {
    const c = Object.values(store.get('party') || {}).find((x) => x.nickname.toLowerCase() === as.toLowerCase());
    if (c) { setMe(c.id); setJoined(true); if (!location.hash || location.hash === '#/') location.hash = '#/play'; }
  }
  await route();
})();

export const refresh = () => rerender?.();
export { $$, esc };

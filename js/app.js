import { CONFIG } from './config.js?v=6ae36e97';
import * as store from './store.js?v=6ae36e97';
import * as sheet from './sheetdata.js?v=6ae36e97';
import { $, $$, esc, uid, toast } from './util.js?v=6ae36e97';
import { unlockChar, charOpen, pinOf, askForPin } from './charlock.js?v=6ae36e97';
import { closeModal, maxHp } from './ui.js?v=6ae36e97';
import { renderJoin, renderPlay } from './play.js?v=6ae36e97';
import { renderGM } from './gm.js?v=6ae36e97';
import { renderGuild, renderMerchant, renderShop } from './guild.js?v=6ae36e97';
import { renderRules } from './rulebook.js?v=6ae36e97';
import { renderVault } from './vault.js?v=6ae36e97';
import { renderGames } from './games.js?v=6ae36e97';
import { updateHotbar } from './hotbar.js?v=6ae36e97';
import { applyTheme, openSettings } from './theme.js?v=6ae36e97';
import { weatherTick, updateWeatherChip } from './weather.js?v=6ae36e97';
import { resolveFortunes } from './fortune.js?v=6ae36e97';
import { updateSparkle } from './sparkle.js?v=6ae36e97';
import { startDigCursor } from './digcursor.js?v=6ae36e97';
import { renderFriendZone } from './friendzone.js?v=6ae36e97';
import { renderGym } from './gym.js?v=6ae36e97';
import { placeGimmighoul } from './gimmighoul.js?v=6ae36e97';
import { startFriends } from './friends.js?v=6ae36e97';
import { startInstall } from './install.js?v=6ae36e97';

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
  // Only seed a table we KNOW is empty. A slow connection must never look like a new table
  // (that once overwrote a live table's missions and party).
  const state = await Promise.race([store.whenLoaded(), new Promise((r) => setTimeout(() => r('timeout'), 20000))]);
  if (state === 'timeout' || store.get('seeded')) return;
  if (state === 'data' && Object.keys(store.get('party') || {}).length + Object.keys(store.get('missions') || {}).length) return;
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
  applyTheme();
  const sc = $('#setchip'); if (sc && !sc.onclick) sc.onclick = openSettings;
  const cog = $('#setcog'); if (cog && !cog.onclick) cog.onclick = openSettings;   // phones: just the cog beside the Table box
  // header "join a table" box: type a code, press Join (or Enter); opens that table and asks who you're playing
  const tj = $('#tjoin');
  if (tj && !tj.onsubmit) {
    const inp = $('#tjcode');
    inp.value = store.tableCode();
    tj.onsubmit = async (e) => {
      e.preventDefault(); inp.blur();
      const code = inp.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (!code) { inp.value = store.tableCode(); return; }
      if (code === store.tableCode()) { location.hash = joined() ? '#/play' : '#/'; return; }
      await openTable(code);
      const u = new URL(location.href); u.searchParams.set('t', store.tableCode()); u.hash = '#/'; history.replaceState(null, '', u);
      inp.value = store.tableCode(); route();
    };
  }
  else if ($('#tjcode') && document.activeElement !== $('#tjcode')) $('#tjcode').value = store.tableCode();
  updateWeatherChip();
  updateSparkle(myId()); startDigCursor();
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
  $('#tabs').innerHTML = navHTML(page === 'join' ? 'play' : ['friends', 'merchant', 'shop', 'gym'].includes(page) ? 'guild' : page);   // Friend Zone lives under Guild
  window.scrollTo(0, 0);
  const render = { join: renderJoin, play: renderPlay, gm: renderGM, guild: renderGuild, merchant: renderMerchant, shop: renderShop, gym: renderGym, vault: renderVault, games: renderGames, friends: renderFriendZone, rules: renderRules }[page] || renderJoin;
  rerender = async () => { await render(main, rest); placeGimmighoul(page, rest.filter(Boolean).join('/')); };
  await rerender();
  statusChip(); updateHotbar();
}

// Re-render the live pages when the table changes, without losing typing focus.
let pending = false, stale = false;
const LIVE = ['join', 'play', 'gm', 'guild', 'merchant', 'shop', 'gym', 'vault', 'friends'];
store.subscribe(() => {
  statusChip(); updateHotbar();
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    const a = document.activeElement;
    const typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && main.contains(a);
    if (document.querySelector('.sheet-bg')) { stale = true; return; }   // a modal is open; catch up when it closes
    if (!typing && LIVE.includes(current)) rerender?.();
  });
});
// changes made inside a popup (e.g. picking a status) show on the page as soon as it closes
window.addEventListener('modalclosed', () => { if (stale && !document.querySelector('.sheet-bg')) { stale = false; if (LIVE.includes(current)) rerender?.(); } });
// a popup can ask for the page behind it to update right away (e.g. ticking a status on or off)
window.addEventListener('refreshpage', () => { stale = false; if (LIVE.includes(current)) rerender?.(); });

window.addEventListener('hashchange', route);

(async () => {
  let code = CONFIG.defaultTable;
  const q = new URLSearchParams(location.search).get('t');
  try { code = q || localStorage.getItem('dc.code') || code; } catch { /* ignore */ }
  await openTable(code);
  // ?as=<name> opens the table straight as that character (handy links the GM can send each player).
  const as = new URLSearchParams(location.search).get('as');
  const asChar = as && Object.values(store.get('party') || {}).find((x) => String(x.nickname).toLowerCase() === as.toLowerCase());
  const playAs = (c) => { setMe(c.id); setJoined(true); if (!location.hash || location.hash === '#/') location.hash = '#/play'; else rerender?.(); };
  if (asChar && charOpen(asChar.id)) playAs(asChar);
  // this device is set to a character whose password it never typed (set on another device): pick again
  if (myId() && !charOpen(myId()) && pinOf(myId())) { setMe(''); setJoined(false); toast('Your character has a password now. Pick it again to play.'); }
  await route();
  startFriends();
  startInstall();
  // popups wait for the first page draw (it closes any open popup)
  if (asChar && !charOpen(asChar.id)) unlockChar(asChar.id, () => playAs(asChar));
  else askForPin(myId());
})();

export const refresh = () => rerender?.();
export { $$, esc };

// Weather: post each 6-hour change to "Around the Guild" and keep the hotbar chip current.
// Only on a table that has really loaded with its game in it (never on a blank or half-loaded one).
async function weatherLoop() {
  const state = await store.whenLoaded();
  if (state === 'data' && Object.keys(store.get('party') || {}).length) { weatherTick(); resolveFortunes(); }
  updateHotbar();
}
setInterval(weatherLoop, 5 * 60e3);
setTimeout(weatherLoop, 8000);

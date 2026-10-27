// Site themes. Everyone has the Woodland Base theme; each character also gets the theme of their own type(s),
// and the GM can hand out more as rewards (party/<id>/themes). The choice is saved on this device.
import * as store from './store.js?v=6adfefdf';
import { $, $$, esc, toast } from './util.js?v=6adfefdf';
import { modal } from './ui.js?v=6adfefdf';
import { skinPicker } from './dice3d.js?v=6adfefdf';

export const TYPE_COLORS = { Normal: '#9a9a6b', Fire: '#e0692f', Water: '#4f7fe0', Electric: '#d9b30f', Grass: '#5ba83a', Ice: '#6fc4c4', Fighting: '#b3352b',
  Poison: '#924094', Ground: '#c9a24f', Flying: '#8f7fe0', Psychic: '#e8507f', Bug: '#98a420', Rock: '#a8902f', Ghost: '#6a5590', Dragon: '#6a38e8',
  Dark: '#6a5444', Steel: '#9a9ab8', Fairy: '#d685ad' };
export const TYPE_ICONS = { Normal: '⚪', Fire: '🔥', Water: '💧', Electric: '⚡', Grass: '🌿', Ice: '❄️', Fighting: '🥊', Poison: '☠️', Ground: '⛰️', Flying: '🪶',
  Psychic: '🔮', Bug: '🐛', Rock: '🪨', Ghost: '👻', Dragon: '🐉', Dark: '🌙', Steel: '⚙️', Fairy: '✨' };

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const lum = (h) => { const [r, g, b] = hex(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

// A whole palette from one type colour, keeping the site's look (dark header, warm paper, bright buttons).
export function palette(base) {
  const btn = lum(base) > 0.55 ? mix(base, '#000000', 0.25) : base;
  return {
    '--brown': mix(base, '#000000', 0.62), '--brown2': mix(base, '#000000', 0.42), '--brown3': mix(base, '#000000', 0.22), '--ink': mix(base, '#000000', 0.78),
    '--muted': mix(base, '#000000', 0.5), '--cream': mix(base, '#ffffff', 0.86), '--cream2': mix(base, '#ffffff', 0.74), '--cream3': mix(base, '#ffffff', 0.6),
    '--paper': mix(base, '#ffffff', 0.95), '--line': mix(base, '#ffffff', 0.4), '--hotbar': mix(base, '#000000', 0.7), '--gold': mix(base, '#ffffff', 0.55), '--orange': btn, '--orange-d': mix(btn, '#000000', 0.3), '--orange-l': mix(btn, '#ffffff', 0.35),
  };
}

export const THEMES = {
  woodland: { name: 'Woodland Base', icon: '🌳', swatch: ['#4a2f17', '#f7eed6', '#e07b1f'], vars: null },
  ...Object.fromEntries(Object.entries(TYPE_COLORS).map(([t, c]) => [`type-${t.toLowerCase()}`, { name: `${t} Type`, icon: TYPE_ICONS[t], swatch: [mix(c, '#000000', 0.62), mix(c, '#ffffff', 0.86), c], vars: palette(c) }])),
};

const KEY = () => 'dc.theme.' + store.tableCode();
const meId = () => { try { return localStorage.getItem('dc.me.' + store.tableCode()) || ''; } catch { return ''; } };
const me = () => (store.get('party') || {})[meId()];

// Themes this player may use: Woodland Base, their own type(s), and any the GM gave them.
export function unlocked(c = me()) {
  const own = c ? [c.type1, c.type2].filter(Boolean).map((t) => `type-${String(t).toLowerCase()}`) : [];
  const gifts = c && Array.isArray(c.themes) ? c.themes : [];
  return ['woodland', ...new Set([...own, ...gifts])].filter((k) => THEMES[k]);
}

// Dice sets: everyone starts with Classic and Poké Ball, plus the set matching their type; the GM gives out the rest
// (and "custom" = making your own colours) as rewards (party/<id>/dice).
const TYPE_DICE = { Grass: 'leaf', Bug: 'leaf', Fire: 'ember', Water: 'water', Ice: 'water', Dark: 'night', Ghost: 'night', Steel: 'gold', Ground: 'oak', Rock: 'oak' };
export const DICE_REWARDS = { greatball: 'Great Ball dice', ultraball: 'Ultra Ball dice', leaf: 'Leaf dice', ember: 'Ember dice', water: 'Water dice', night: 'Night dice', gold: 'Gold dice', oak: 'Oak dice', custom: 'Make-your-own dice colours' };
export function diceUnlocked(c = me()) {
  const own = c ? [c.type1, c.type2].map((t) => TYPE_DICE[t]).filter(Boolean) : [];
  return new Set(['classic', 'pokeball', ...own, ...(c && Array.isArray(c.dice) ? c.dice : [])]);
}

// "Character sheet only" view (per device): body[data-sheetonly] hides rolling and extras.
export const sheetOnly = () => { try { return localStorage.getItem('dc.sheetonly') === '1'; } catch { return false; } };
export function setSheetOnly(on) {
  try { localStorage.setItem('dc.sheetonly', on ? '1' : ''); } catch { /* ignore */ }
  document.body.toggleAttribute('data-sheetonly', on);
}
export function applyTheme() {
  document.body.toggleAttribute('data-sheetonly', sheetOnly());
  window.diceAllowed = store.gmUnlocked() ? null : diceUnlocked();
  let k = 'woodland'; try { k = localStorage.getItem(KEY()) || 'woodland'; } catch { /* default */ }
  if (!unlocked().includes(k)) k = 'woodland';
  const root = document.documentElement; const vars = THEMES[k].vars || {};
  for (const v of Object.keys(THEMES['type-fire'].vars)) root.style.removeProperty(v);
  for (const [v, val] of Object.entries(vars)) root.style.setProperty(v, val);
  root.dataset.theme = k;
}
const setTheme = (k) => { try { localStorage.setItem(KEY(), k); } catch { /* ignore */ } applyTheme(); };

const swatch = (t) => `<span class="th-sw">${t.swatch.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;

export function openSettings() {
  const c = me(); const cur = document.documentElement.dataset.theme || 'woodland';
  const gm = store.gmUnlocked(); const party = Object.entries(store.get('party') || {}).filter(([, x]) => !x.guest);
  const el = modal(`<h2>⚙️ Settings</h2>
    <h3>🎲 Dice skin</h3><p class="small muted">How your 3D dice look when you roll. You start with Classic, Poké Ball and your type’s set; the GM hands out more as rewards.</p><button class="btn alt" id="setdice">Change dice skin</button>
    <h3 style="margin-top:14px">📄 Character sheet only</h3>
    <label class="check"><input type="checkbox" id="setsheetonly" ${sheetOnly() ? 'checked' : ''}> Just show my stats, moves and items. Hides the roll buttons, actions and extras, for players who roll at the table or on Roll20. (This device only.)</label>
    <h3 style="margin-top:14px">🎨 Theme</h3>
    <p class="small muted">${c ? `Everyone has Woodland Base. ${esc(c.nickname)} also has their type’s theme. The GM can give out more as rewards.` : 'Pick a character to unlock your type’s theme.'}</p>
    <div class="themes">${unlocked(c).map((k) => `<button class="th ${k === cur ? 'sel' : ''}" data-th="${k}">${swatch(THEMES[k])}<span>${THEMES[k].icon} ${esc(THEMES[k].name)}</span></button>`).join('')}</div>
    ${gm ? `<details class="small" style="margin-top:14px"><summary><b>GM: give a theme or dice as a reward</b></summary>
      <div class="grid g2" style="margin-top:6px"><select id="gtwho">${party.map(([id, x]) => `<option value="${id}">${esc(x.nickname)}</option>`).join('')}</select>
      <select id="gtwhat">${Object.entries(THEMES).filter(([k]) => k !== 'woodland').map(([k, t]) => `<option value="${k}">${t.icon} ${esc(t.name)}</option>`).join('')}</select></div>
      <button class="btn alt sm" id="gtgo" style="margin-top:6px">🎁 Give theme</button>
      <div class="grid g2" style="margin-top:10px"><select id="gdwho">${party.map(([id, x]) => `<option value="${id}">${esc(x.nickname)}</option>`).join('')}</select>
      <select id="gdwhat">${Object.entries(DICE_REWARDS).map(([k, n]) => `<option value="${k}">🎲 ${esc(n)}</option>`).join('')}</select></div>
      <button class="btn alt sm" id="gdgo" style="margin-top:6px">🎁 Give dice</button></details>` : ''}`);
  $('#setdice', el).onclick = () => skinPicker();
  $('#setsheetonly', el).onchange = (e) => { setSheetOnly(e.target.checked); window.dispatchEvent(new Event('refreshpage')); };
  $$('[data-th]', el).forEach((b) => b.onclick = () => { setTheme(b.dataset.th); $$('[data-th]', el).forEach((x) => x.classList.toggle('sel', x === b)); });
  const gd = $('#gdgo', el);
  if (gd) gd.onclick = () => {
    const id = $('#gdwho', el).value; const k = $('#gdwhat', el).value; const x = (store.get('party') || {})[id];
    if (!x) return;
    store.set(`party/${id}/dice`, [...new Set([...(x.dice || []), k])]);
    store.pushLimited('log', { t: Date.now(), text: `${x.nickname} earned ${DICE_REWARDS[k]}!` });
    toast(`${x.nickname} can now use ${DICE_REWARDS[k]}`);
  };
  const g = $('#gtgo', el);
  if (g) g.onclick = () => {
    const id = $('#gtwho', el).value; const k = $('#gtwhat', el).value; const x = (store.get('party') || {})[id];
    if (!x) return;
    store.set(`party/${id}/themes`, [...new Set([...(x.themes || []), k])]);
    store.pushLimited('log', { t: Date.now(), text: `${x.nickname} earned the ${THEMES[k].name} theme!` });
    toast(`${x.nickname} can now use ${THEMES[k].name}`);
  };
}

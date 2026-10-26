// Character hotbar in the top banner: money, guild points & rank, training points, held item,
// garment, a quick World Map, and the three bag items the player pinned.
import * as store from './store.js?v=6adfdb2e';
import { $, esc, num } from './util.js?v=6adfdb2e';
import { modal } from './ui.js?v=6adfdb2e';
import { rankFor, guildPath, guildName } from './guild.js?v=6adfdb2e';

export const MAP_IMG = 'assets/maps/world_map.jpg';
const meId = () => { try { return localStorage.getItem('dc.me.' + store.tableCode()) || ''; } catch { return ''; } };
export const pinsOf = (c) => (Array.isArray(c?.pins) ? c.pins : []).slice(0, 3);

export function showMap() {
  modal(`<h2>🗺️ World Map</h2><img class="worldmap" src="${MAP_IMG}" alt="World Map: Ancient Ruins, Mooncliff Mountains, Crystal Lake, Woodland Base, Echo Cavern, Blossom Meadow, Whispering Falls, Sunshell Beach">
    <p class="small muted">Pinch or zoom to look closer.</p>`);
}

// Aura Bows (held gear: only one scarf, band, ribbon or bow at a time)
export function showGarment(c) {
  const g = c.garments || '';
  const bow = /bow$/i.test(g.trim());
  modal(`<h2>🎀 ${esc(g || 'No garment')}</h2>${bow && !/friend/i.test(g) ? `<p><b>Aura Bow</b> (Rare · 1,000 Poké). If the bow matches the Pokémon’s Aura colour, choose one benefit at the start of each Scene:</p>
    <ul><li>+1 Defense</li><li>+1 Special Defense</li><li>+1 die to Physical Move damage</li><li>+1 die to Special Move damage</li></ul>
    <p class="small">The choice lasts for that Scene. A mismatched bow is just decoration. ${esc(c.nickname)}’s nature is ${esc(c.nature || '—')}.</p>`
    : /friend bow/i.test(g) ? '<p><b>Friend Bow</b> (Very Rare · 2,500 Poké): +2 dice to befriend, recruit or peacefully persuade a Pokémon the wearer helped during the adventure.</p>' : ''}
    <p class="small muted">Held gear: a Pokémon benefits from only one scarf, band, ribbon or bow at a time.</p>`);
}

function hotbarHTML(c) {
  const gp = num((store.get(guildPath(c.guild)) || {}).gp);
  const rank = rankFor(gp)?.name || '';
  const bag = Object.values(store.get('bag') || {}).filter((b) => b.owner === c.id || b.owner === 'team');
  const pins = pinsOf(c).map((n) => { const qty = bag.filter((b) => b.name === n).reduce((s, b) => s + num(b.qty), 0); return `<a href="#" class="hb hb-pin ${qty ? '' : 'gone'}" data-ixname="${esc(n)}">📌 ${esc(n)}${qty > 1 ? ' ×' + qty : ''}</a>`; }).join('');
  return `<a class="hb hb-me" href="#/play"><b>${esc(c.nickname)}</b></a>
    <span class="hb" title="Poké">💰 ${num(c.poke).toLocaleString()}</span>
    <span class="hb" title="${esc(guildName(c.guild))}">🏅 ${gp} GP · ${esc(rank)}</span>
    <span class="hb" title="Training Points">🎓 ${num(c.tp)} TP</span>
    ${pins || '<a class="hb hb-pin muted" href="#/play">📌 Pin items in your Bag</a>'}
    <span class="hb hb-right" title="Held item">✋ ${esc(c.held || '—')}</span>
    <button class="hb hb-btn" id="hbgarb" title="Garment">🎀 ${esc(c.garments || '—')}</button>
    <button class="hb hb-btn" id="hbmap">🗺️ Map</button>`;
}

// called on every render and table change
export function updateHotbar() {
  const el = $('#hotbar'); if (!el) return;
  const c = (store.get('party') || {})[meId()];
  if (!c) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = hotbarHTML(c);
  $('#hbmap', el).onclick = showMap;
  $('#hbgarb', el).onclick = () => showGarment(c);
}

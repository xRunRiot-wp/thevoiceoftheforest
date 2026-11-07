// her ask 11-07: TV display mode for in-person sessions. A home screen of big flat tiles (Echo Show / Windows 8 feel)
// around the Friend Zone, and an overview panel that stays at the side on every page. Turned on in Settings, per device.
// This screen faces the whole table, so nothing here may show hidden missions or other GM-only data.
import * as store from './store.js?v=6aef99b5';
import { $, esc, num } from './util.js?v=6aef99b5';
import { tvMode, openSettings } from './theme.js?v=6aef99b5';
import { renderFriendZone, locations } from './friendzone.js?v=6aef99b5';
import { missionBy, GUILD_ICON, rankFor } from './guild.js?v=6aef99b5';
import { renderMessHall } from './play.js?v=6aef99b5';
import { renderNurseryParty } from './nursery.js?v=6aef99b5';
import { chatterLatestHTML } from './chatter.js?v=6aef99b5';
import { currentWeather, WEATHERS, wxFxHTML, wxIconHTML, showWeather } from './weather.js?v=6aef99b5';
import { sitePages } from './sitepages.js?v=6aef99b5';

// her ask 11-07: the Guild tile carries a mini menu with both guilds' GP and rank (moved off the side panel)
const guildMini = () => ['woodland', 'vanguard'].map((k) => { const g = store.get(k === 'vanguard' ? 'vanguard' : 'guild') || {}; const r = rankFor(num(g.gp));
  return `<a class="tv-mini" href="#/guild"><span>${GUILD_ICON[k]} ${k === 'vanguard' ? 'Vanguard' : 'Woodland'}</span><b>${num(g.gp)} GP</b><small>${esc(r?.name || '')}</small></a>`; }).join('');
const tile = ([href, icon, label, color, wide]) => href === '#/guild'
  ? `<div class="tv-tile tv-guild" style="background:${color}"><a class="tv-gmain" href="#/guild"><span class="tv-ic">${icon}</span><span class="tv-lb">${esc(label)}</span></a><div class="tv-minis">${guildMini()}</div></div>`
  : `<a class="tv-tile${wide ? ' wide' : ''}" style="background:${color}" href="${href}"><span class="tv-ic">${icon}</span><span class="tv-lb">${esc(label)}</span></a>`;
// her ask 11-07: tile colours come from the character's site theme (--tv1..--tv6 in site.css are built from the theme's colours)
const LEFT = [['#/tv/hall', '🎭', 'Characters', 'var(--tv1)', 1], ['#/guild', '🏰', 'Guild', 'var(--tv2)'], ['#/vault', '💰', 'Vault', 'var(--tv5)'], ['#/shop', '🛒', 'Shop', 'var(--tv3)'], ['#/merchant', '🎒', 'Merchant', 'var(--tv4)']];
const RIGHT = [['#/games', '🎮', 'Games', 'var(--tv1)', 1], ['#/tv/nursery', '🍼', 'Nursery', 'var(--tv4)'], ['#/gym', '💪', 'Gym', 'var(--tv3)'], ['#/rules', '📖', 'Rulebook', 'var(--tv5)'], ['#/gm', '🎲', 'GM', 'var(--tv2)']];

// the Friend Zone for the story so far. Woodland Base is the only one built; its chapter trails open as the chapter goes up.
const currentZone = () => locations()[0];
let shownChapter = null;
// her ask 11-07: the chapter bar opens that chapter's story page (the Story overview if the chapter has no page yet)
const chapterLink = (n) => { const p = sitePages().find((x) => x.key.includes(`_chapter-${n}-`)); return `#/rules/site/${p ? p.key : 'story-guild-rank-progression'}`; };

// TV-only pages (her ask 11-07): everyone at once instead of one player's view
export const tvHome = () => /^#?\/?(tv\/?)?$/.test(location.hash);
export function renderTV(main, rest = []) {
  if (rest[0] === 'hall') { document.body.toggleAttribute('data-tvhome', false); renderMessHall(main); return; }
  if (rest[0] === 'nursery') { document.body.toggleAttribute('data-tvhome', false); renderNurseryParty(main); return; }
  shownChapter = store.get('guild')?.chapter ?? null;
  const zone = currentZone();
  // the TV layout must be in place before the Friend Zone measures its box (her report 11-07: it came out too big and scrolled)
  document.body.toggleAttribute('data-tv', true); document.body.toggleAttribute('data-tvhome', true);
  main.innerHTML = `<div class="tv-home">
    <div class="tv-col">${LEFT.map(tile).join('')}</div>
    <div class="tv-mid">
      <a class="tv-tile tvbar" style="background:var(--tv6)" href="${chapterLink(shownChapter)}"><span class="tv-ic">🏕️</span><span class="tv-lb">${esc(zone?.name || 'Friend Zone')} · Chapter ${esc(shownChapter ?? '—')}</span></a>
      <div class="tv-fz" id="tvfz"></div>
      <button type="button" class="tv-tile tvbar" style="background:var(--tv6)" id="tvset"><span class="tv-ic">⚙️</span><span class="tv-lb">Settings</span></button>
    </div>
    <div class="tv-col">${RIGHT.map(tile).join('')}</div>
  </div>`;
  $('#tvset', main).onclick = openSettings;
  if (zone) requestAnimationFrame(() => { const box = $('#tvfz', main); if (box) renderFriendZone(box, [zone.id]); });
}
// the window changed size (TV resolution, browser zoom, full screen): redraw so the Friend Zone fits again
let resizeTimer = 0;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { const main = $('#main'); if (document.body.hasAttribute('data-tvhome') && main && !document.querySelector('.sheet-bg')) renderTV(main); }, 400); });

// her ask 11-07: the side panel uses the site's own widgets (the weather fortune card, the guild windows, the missions tracker)
function sideHTML() {
  const g = store.get('guild') || {};
  const missions = Object.values(store.get('missions') || {}).filter((m) => m && !m.hidden);
  const open = missions.filter((m) => (m.status || 'open') === 'open');
  const taken = missions.filter((m) => m.status === 'taken');
  const done = missions.filter((m) => m.status === 'done');
  const cw = currentWeather(); const w = WEATHERS[cw.key] || {};
  const live = !!store.get('session/live');
  const row = (m, tag) => `<a class="trk tv-trk" href="#/guild">${m.art ? `<img src="${esc(m.art)}" alt="" loading="lazy">` : '<span class="trk-noart"></span>'}<span class="grow"><b>${esc(m.title || '')}</b><span class="small">${esc(m.rank || '')} Rank · ${tag}</span></span></a>`;
  return `<div class="tv-card now"><div class="tv-clock" id="tvclock">${clock()}</div><div class="tv-sub" id="tvdate">${day()}</div><div class="tv-sub">Session ${esc(store.get('session/n') ?? '—')} · ${live ? '🟢 live' : '⚪ not live'}</div></div>
    <a class="tv-tile tvbar home" style="background:var(--tv1)" href="#/tv"><span class="tv-ic">🏠</span><span class="tv-lb">Home</span></a>
    <button type="button" class="wxcard fortune tv-wx" id="tvwx">${wxFxHTML(cw.key)}<div class="ft-top">✦ What’s the Weather? ✦</div>
      <div class="ft-orb" aria-hidden="true">${wxIconHTML(cw.key)}</div><div class="ft-name">${esc(w.name || '')}</div>
      <div class="ft-say">Today’s sky roll: ${esc(cw.daily?.roll ?? '—')}</div></button>
    <div class="card coffers tv-coffers"><span class="pix">Guild coffers</span><br><b class="pix">${num(g.coffers).toLocaleString()} Poké</b></div>
    <div class="tv-chatter">${chatterLatestHTML(3) || '<div class="card gboard"><h3>🏕️ Around the Guild</h3><p class="small muted">All quiet for now.</p></div>'}</div>
    <div class="tracker tv-tracker"><h2>Missions</h2>
      <div class="trk-tally"><span class="trk-by tv-chip">📋 Available: <b>${open.length}</b></span><span class="trk-by tv-chip">🏃 In progress: <b>${taken.length}</b></span>${['woodland', 'vanguard'].map((k) => `<span class="trk-by by-${k}">${GUILD_ICON[k]} ${k === 'vanguard' ? 'Vanguard' : 'Woodland'} done: <b>${done.filter((m) => missionBy(m) === k).length}</b></span>`).join('')}</div>
      ${[...taken.map((m) => row(m, '🏃 in progress')), ...open.map((m) => row(m, '📋 available'))].slice(0, 6).join('') || '<p class="small muted">No missions on the board.</p>'}
      ${open.length + taken.length > 6 ? `<p class="small muted">and ${open.length + taken.length - 6} more on the Guild page</p>` : ''}</div>`;
}
const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const day = () => new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

// called whenever the table changes or the page changes
export function updateTvSide(page) {
  document.body.toggleAttribute('data-tvhome', tvMode() && page === 'tv' && tvHome());
  let side = document.getElementById('tvside');
  if (!tvMode()) { side?.remove(); return; }
  if (!side) { side = document.createElement('aside'); side.id = 'tvside'; document.body.append(side); }
  side.innerHTML = sideHTML();
  const wx = document.getElementById('tvwx'); if (wx) wx.onclick = showWeather;
  // the chapter went up while this screen was showing: redraw so the newly opened trail shows
  const main = $('#main');
  if (page === 'tv' && tvHome() && (store.get('guild')?.chapter ?? null) !== shownChapter && !document.querySelector('.sheet-bg')) renderTV(main);
}
setInterval(() => { const c = document.getElementById('tvclock'); if (c) { c.textContent = clock(); document.getElementById('tvdate').textContent = day(); } }, 15000);

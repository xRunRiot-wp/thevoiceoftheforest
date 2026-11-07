// her ask 11-07: TV display mode for in-person sessions. A home screen of big flat tiles (Echo Show / Windows 8 feel)
// around the Friend Zone, and an overview panel that stays at the side on every page. Turned on in Settings, per device.
// This screen faces the whole table, so nothing here may show hidden missions or other GM-only data.
import * as store from './store.js?v=6aef954c';
import { $, esc, num } from './util.js?v=6aef954c';
import { tvMode, openSettings } from './theme.js?v=6aef954c';
import { renderFriendZone, locations } from './friendzone.js?v=6aef954c';
import { rankFor, missionBy } from './guild.js?v=6aef954c';
import { currentWeather, WEATHERS } from './weather.js?v=6aef954c';
import { sitePages } from './sitepages.js?v=6aef954c';

const tile = ([href, icon, label, color, wide]) => `<a class="tv-tile${wide ? ' wide' : ''}" style="background:${color}" href="${href}"><span class="tv-ic">${icon}</span><span class="tv-lb">${esc(label)}</span></a>`;
// her ask 11-07: tile colours come from the character's site theme (--tv1..--tv6 in site.css are built from the theme's colours)
const LEFT = [['#/play', '🎭', 'Characters', 'var(--tv1)', 1], ['#/guild', '🏰', 'Guild', 'var(--tv2)'], ['#/vault', '💰', 'Vault', 'var(--tv5)'], ['#/shop', '🛒', 'Shop', 'var(--tv3)'], ['#/merchant', '🎒', 'Merchant', 'var(--tv4)']];
const RIGHT = [['#/games', '🎮', 'Games', 'var(--tv1)', 1], ['#/games/fernshade-nursery', '🍼', 'Nursery', 'var(--tv4)'], ['#/gym', '💪', 'Gym', 'var(--tv3)'], ['#/rules', '📖', 'Rulebook', 'var(--tv5)'], ['#/gm', '🎲', 'GM', 'var(--tv2)']];

// the Friend Zone for the story so far. Woodland Base is the only one built; its chapter trails open as the chapter goes up.
const currentZone = () => locations()[0];
let shownChapter = null;
// her ask 11-07: the chapter bar opens that chapter's story page (the Story overview if the chapter has no page yet)
const chapterLink = (n) => { const p = sitePages().find((x) => x.key.includes(`_chapter-${n}-`)); return `#/rules/site/${p ? p.key : 'story-guild-rank-progression'}`; };

export function renderTV(main) {
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

const guildCard = (name, g) => { const r = rankFor(num(g.gp)); return `<div class="tv-card"><h4>${esc(name)}</h4><div class="tv-big">${num(g.gp).toLocaleString()} <small>GP</small></div><div class="tv-sub">${esc(r?.name || '')}${g.chapter != null ? ` · Chapter ${esc(g.chapter)}` : ''}</div></div>`; };

function sideHTML() {
  const g = store.get('guild') || {}; const v = store.get('vanguard') || {};
  const missions = Object.values(store.get('missions') || {}).filter((m) => m && !m.hidden);
  const open = missions.filter((m) => (m.status || 'open') === 'open');
  const taken = missions.filter((m) => m.status === 'taken');
  const done = missions.filter((m) => m.status === 'done');
  const by = (k) => done.filter((m) => missionBy(m) === k).length;
  const cw = currentWeather(); const w = WEATHERS[cw.key] || {};
  const live = !!store.get('session/live');
  return `<div class="tv-card now"><div class="tv-clock" id="tvclock">${clock()}</div><div class="tv-sub" id="tvdate">${day()}</div><div class="tv-sub">${esc(w.icon || '')} ${esc(w.name || '')}</div></div>
    <a class="tv-tile tvbar home" style="background:var(--tv1)" href="#/tv"><span class="tv-ic">🏠</span><span class="tv-lb">Home</span></a>
    <div class="tv-card"><h4>Session ${esc(store.get('session/n') ?? '—')}</h4><div class="tv-sub">${live ? '🟢 Game is live' : '⚪ Not live'}</div></div>
    ${guildCard('Woodland Base', g)}${guildCard('Vanguard Guild', v)}
    <div class="tv-card"><h4>Guild coffers</h4><div class="tv-big">${num(g.coffers).toLocaleString()} <small>Poké</small></div></div>
    <div class="tv-card"><h4>Missions</h4><div class="tv-nums"><span><b>${open.length}</b>available</span><span><b>${taken.length}</b>in progress</span><span><b>${done.length}</b>completed</span></div>
      <div class="tv-sub">Completed: Woodland ${by('woodland')} · Vanguard ${by('vanguard')}</div>
      ${open.length ? `<ul class="tv-list">${open.slice(0, 6).map((m) => `<li><b>${esc(m.rank || '')}</b> ${esc(m.title || '')}</li>`).join('')}</ul>${open.length > 6 ? `<div class="tv-sub">and ${open.length - 6} more</div>` : ''}` : ''}</div>`;
}
const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const day = () => new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

// called whenever the table changes or the page changes
export function updateTvSide(page) {
  document.body.toggleAttribute('data-tvhome', tvMode() && page === 'tv');
  let side = document.getElementById('tvside');
  if (!tvMode()) { side?.remove(); return; }
  if (!side) { side = document.createElement('aside'); side.id = 'tvside'; document.body.append(side); }
  side.innerHTML = sideHTML();
  // the chapter went up while this screen was showing: redraw so the newly opened trail shows
  const main = $('#main');
  if (page === 'tv' && (store.get('guild')?.chapter ?? null) !== shownChapter && !document.querySelector('.sheet-bg')) renderTV(main);
}
setInterval(() => { const c = document.getElementById('tvclock'); if (c) { c.textContent = clock(); document.getElementById('tvdate').textContent = day(); } }, 15000);

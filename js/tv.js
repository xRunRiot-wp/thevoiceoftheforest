// her ask 11-07: TV display mode for in-person sessions. A home screen of big flat tiles (Echo Show / Windows 8 feel)
// around the Friend Zone, and an overview panel that stays at the side on every page. Turned on in Settings, per device.
// This screen faces the whole table, so nothing here may show hidden missions or other GM-only data.
import * as store from './store.js?v=6af65085';
import { $, esc, num } from './util.js?v=6af65085';
import { tvMode, openSettings } from './theme.js?v=6af65085';
import { renderFriendZone, locations } from './friendzone.js?v=6af65085';
import { missionBy, GUILD_ICON, rankFor } from './guild.js?v=6af65085';
import { renderMessHall, renderRoster, rosterAllowed, liveTeamFx, fxLeftHTML } from './play.js?v=6af65085';
import { renderNurseryParty } from './nursery.js?v=6af65085';
import { chatterLatestHTML } from './chatter.js?v=6af65085';
import { currentWeather, WEATHERS, wxFxHTML, wxIconHTML, showWeather } from './weather.js?v=6af65085';
import { sitePages } from './sitepages.js?v=6af65085';
import { openBase, hasBase } from './mybase.js?v=6af65085';
import { topPatron } from './vault.js?v=6af65085';
import { portrait, modal } from './ui.js?v=6af65085';
import { sideActionsHTML, bindSideActions } from './hotbar.js?v=6af65085';

// her ask 11-07: the Bases tile (in place of GM): every character's base as a door to knock on, like igloos on a map
function renderBases(main) {
  const p = Object.values(store.get('party') || {}).filter((c) => c && !c.guest).sort((a, b) => String(a.nickname).localeCompare(String(b.nickname)));
  main.innerHTML = `<div class="tv-page"><h1>🏡 Whose base shall we visit?</h1>
    <div class="tv-bases">${p.map((c) => `<button class="tv-base ${hasBase(c) ? '' : 'none'}" data-base="${esc(c.id)}">${portrait(c, 'sm')}<b>${esc(c.nickname)}</b><small>${hasBase(c) ? 'Visit their base' : 'No base yet'}</small></button>`).join('') || '<p class="muted">No characters yet.</p>'}</div></div>`;
  main.querySelectorAll('[data-base]').forEach((b) => b.onclick = () => openBase(b.dataset.base, { from: b }));
}
// her ask 11-07: the WHOLE TEAM effects show as buffs under the clock; hovering or tapping one shows its description and
// the once-each check boxes (tick who has used it), the same ones as on the Play page
const teamFx = () => liveTeamFx();
const buffsHTML = () => { const fx = teamFx();
  return fx.length ? `<div class="tv-buffs">${fx.map(([id, x]) => `<button type="button" class="tv-buff" data-buff="${esc(id)}" aria-label="${esc(x.name)}">🌟 ${esc(x.name)}${fxLeftHTML(x)}</button>`).join('')}</div>` : ''; };
const buffBody = (id) => { const f = store.get('teamfx/' + id); if (!f) return '';
  const used = f.used || {}; const p = Object.values(store.get('party') || {}).filter((c) => c && !c.guest);
  return `<div class="tv-buff-name">🌟 ${esc(f.name)}${f.exhaust ? ' <span class="pill">once each</span>' : ''}${fxLeftHTML(f)}</div>${f.text ? `<p class="small">${esc(f.text)}</p>` : '<p class="small muted">No description.</p>'}
    ${f.exhaust ? `<div class="tfx-used">${p.map((c) => `<label><input type="checkbox" data-tvfx="${esc(id)}" data-who="${esc(c.id)}" ${used[c.id] ? 'checked' : ''}> ${esc(c.nickname)}</label>`).join('')}</div>` : ''}`; };
const bindBuffBoxes = (el) => el.querySelectorAll('[data-tvfx]').forEach((b) => b.onchange = () => store.set(`teamfx/${b.dataset.tvfx}/used/${b.dataset.who}`, b.checked || null));
let buffPop = null; let buffHide = 0;
const hideBuff = () => { clearTimeout(buffHide); buffHide = setTimeout(() => { buffPop?.remove(); buffPop = null; }, 250); };
function showBuff(btn) {
  clearTimeout(buffHide); buffPop?.remove();
  buffPop = document.createElement('div'); buffPop.className = 'tv-buff-pop'; buffPop.dataset.buff = btn.dataset.buff; buffPop.innerHTML = buffBody(btn.dataset.buff);
  document.body.append(buffPop); bindBuffBoxes(buffPop);
  buffPop.onmouseenter = () => clearTimeout(buffHide); buffPop.onmouseleave = hideBuff;
  const r = btn.getBoundingClientRect(); const w = buffPop.offsetWidth; const h = buffPop.offsetHeight;
  buffPop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
  buffPop.style.top = (r.bottom + 6 + h < innerHeight ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + 'px';
}
function bindBuffs(side) {
  side.querySelectorAll('[data-buff]').forEach((b) => {
    b.onmouseenter = () => showBuff(b); b.onmouseleave = hideBuff;
    b.onclick = () => { buffPop?.remove(); buffPop = null; modal(`<h2>WHOLE TEAM effect</h2><div class="tv-buff-sheet">${buffBody(b.dataset.buff)}</div>`, (el) => bindBuffBoxes(el)); };
  });
  // the table changed while a buff's box was open: refresh its ticks
  if (buffPop) { const id = buffPop.dataset.buff; if (store.get('teamfx/' + id)) { buffPop.innerHTML = buffBody(id); bindBuffBoxes(buffPop); } else { buffPop.remove(); buffPop = null; } }
}

// her ask 11-07: the Guild tile carries a mini menu with both guilds' GP and rank (moved off the side panel)
const guildMini = () => ['woodland', 'vanguard'].map((k) => { const g = store.get(k === 'vanguard' ? 'vanguard' : 'guild') || {}; const r = rankFor(num(g.gp));
  return `<a class="tv-mini" href="#/guild"><span>${GUILD_ICON[k]} ${k === 'vanguard' ? 'Vanguard' : 'Woodland'}</span><b>${num(g.gp)} GP</b><small>${esc(r?.name || '')}</small></a>`; }).join('');
// her ask 11-07: the Vault tile has the same kind of mini menu, one per guild bank (opens the Vault on that guild)
const vaultMini = () => ['woodland', 'vanguard'].map((k) => { const g = store.get(k === 'vanguard' ? 'vanguard' : 'guild') || {};
  return `<a class="tv-mini" href="#/vault/${k}"><span>${GUILD_ICON[k]} ${k === 'vanguard' ? 'Vanguard' : 'Woodland'}</span><b>${num(g.money).toLocaleString()} Poké</b><small>Bank</small></a>`; }).join('');
const patronHTML = () => { const p = topPatron(); return `<div class="tv-patron">${p ? `${p.icon} Best patron: <b>${esc(p.name)}</b> · ${p.best.toLocaleString()} Poké` : '💛 No patron yet. Give to the coffers!'}</div>`; };
const MINIS = { '#/guild': guildMini, '#/vault': vaultMini };
const tile = ([href, icon, label, color, wide]) => MINIS[href]
  ? `<div class="tv-tile tv-guild" style="background:${color}">${href === '#/vault' ? patronHTML() : ''}<a class="tv-gmain" href="${href}"><span class="tv-ic">${icon}</span><span class="tv-lb">${esc(label)}</span></a><div class="tv-minis">${MINIS[href]()}</div></div>`
  : `<a class="tv-tile${wide ? ' wide' : ''}" style="background:${color}" href="${href}"><span class="tv-ic">${icon}</span><span class="tv-lb">${esc(label)}</span></a>`;
// her ask 11-07: tile colours come from the character's site theme (--tv1..--tv6 in site.css are built from the theme's colours)
const LEFT = [['#/tv/hall', '🎭', 'Characters', 'var(--tv1)', 1], ['#/guild', '🏰', 'Guild', 'var(--tv2)'], ['#/vault', '💰', 'Vault', 'var(--tv5)'], ['#/shop', '🛒', 'Shop', 'var(--tv3)'], ['#/merchant', '🎒', 'Merchant', 'var(--tv4)']];
const RIGHT = [['#/games', '🎮', 'Games', 'var(--tv1)', 1], ['#/tv/nursery', '🍼', 'Nursery', 'var(--tv4)'], ['#/gym', '💪', 'Gym', 'var(--tv3)'], ['#/rules', '📖', 'Rulebook', 'var(--tv5)'], ['#/tv/bases', '🏡', 'Bases', 'var(--tv2)']];

// the Friend Zone for the story so far. Woodland Base is the only one built; its chapter trails open as the chapter goes up.
const currentZone = () => locations()[0];
let shownChapter = null;
// her ask 11-07: the chapter bar opens that chapter's story page (the Story overview if the chapter has no page yet)
const chapterLink = (n) => { const p = sitePages().find((x) => x.key.includes(`_chapter-${n}-`)); return `#/rules/site/${p ? p.key : 'story-guild-rank-progression'}`; };

// TV-only pages (her ask 11-07): everyone at once instead of one player's view
export const tvHome = () => /^#?\/?(tv\/?)?$/.test(location.hash);
export function renderTV(main, rest = []) {
  // her ask 11-08: Nimbi or the GM get every PC + NPC sheet here; everyone else the Mess Hall
  if (rest[0] === 'hall') { document.body.toggleAttribute('data-tvhome', false); if (rosterAllowed() && rest[1] !== 'seats') renderRoster(main); else renderMessHall(main); return; }
  if (rest[0] === 'nursery') { document.body.toggleAttribute('data-tvhome', false); renderNurseryParty(main); return; }
  if (rest[0] === 'bases') { document.body.toggleAttribute('data-tvhome', false); renderBases(main); return; }
  shownChapter = store.get('guild')?.chapter ?? null;
  const zone = currentZone();
  // the TV layout must be in place before the Friend Zone measures its box (her report 11-07: it came out too big and scrolled)
  document.body.toggleAttribute('data-tv', true); document.body.toggleAttribute('data-tvhome', true);
  main.innerHTML = `<div class="tv-home">
    <div class="tv-col">${LEFT.map(tile).join('')}</div>
    <div class="tv-mid">
      <a class="tv-tile tvbar" style="background:var(--tv6)" href="${chapterLink(shownChapter)}"><span class="tv-ic">🏕️</span><span class="tv-lb">${esc(zone?.name || 'Friend Zone')} · Chapter ${esc(shownChapter ?? '—')}</span></a>
      <div class="tv-fz" id="tvfz"></div>
      <div class="tv-pair"><a class="tv-tile tvbar" style="background:var(--tv2)" href="#/gm"><span class="tv-ic">🎲</span><span class="tv-lb">GM</span></a><button type="button" class="tv-tile tvbar" style="background:var(--tv6)" id="tvset"><span class="tv-ic">⚙️</span><span class="tv-lb">Settings</span></button></div>
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
  return `<div class="tv-card now"><div class="tv-clock" id="tvclock">${clock()}</div><div class="tv-sub" id="tvdate">${day()}</div><div class="tv-sub">Session ${esc(store.get('session/n') ?? '—')} · ${live ? '🟢 live' : '⚪ not live'}</div>${buffsHTML()}</div>
    <a class="tv-tile tvbar home" style="background:var(--tv1)" href="#/tv"><span class="tv-ic">🏠</span><span class="tv-lb">Home</span></a>
    ${sideActionsHTML()}
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
  if (!tvMode()) { side?.remove(); document.getElementById('tvsidetab')?.remove(); document.getElementById('tvsidescrim')?.remove(); document.body.removeAttribute('data-sideopen'); return; }
  if (!side) { side = document.createElement('aside'); side.id = 'tvside'; document.body.append(side); }
  side.innerHTML = sideHTML(); bindBuffs(side);
  // her ask 11-09 "when we hit the home button automatically close the panel" (also after picking a chore to go do)
  const closeSide = () => { document.body.removeAttribute('data-sideopen'); const t = document.getElementById('tvsidetab'); if (t) t.textContent = '◀'; };
  bindSideActions(side, closeSide);
  const home = side.querySelector('.home'); if (home) home.addEventListener('click', closeSide);
  // her ask 11-08 "make the side bar on mobile collapsible left to right instead of the bottom": on phones the sidebar is a
  // drawer that slides in from the left; a pull tab on the left edge opens/closes it, tapping outside closes it.
  let tab = document.getElementById('tvsidetab');
  if (!tab) {
    tab = document.createElement('button'); tab.id = 'tvsidetab'; tab.type = 'button'; tab.setAttribute('aria-label', 'Open or close the sidebar');
    const scrim = document.createElement('div'); scrim.id = 'tvsidescrim';
    const setOpen = (o) => { document.body.toggleAttribute('data-sideopen', o); tab.textContent = o ? '▶' : '◀'; };   // drawer is on the right now (her ask 11-08)
    tab.onclick = () => setOpen(!document.body.hasAttribute('data-sideopen'));
    scrim.onclick = () => setOpen(false);
    document.body.append(scrim, tab); setOpen(false);
  }
  const wx = document.getElementById('tvwx'); if (wx) wx.onclick = showWeather;
  // the chapter went up while this screen was showing: redraw so the newly opened trail shows
  const main = $('#main');
  if (page === 'tv' && tvHome() && (store.get('guild')?.chapter ?? null) !== shownChapter && !document.querySelector('.sheet-bg')) renderTV(main);
}
setInterval(() => { const c = document.getElementById('tvclock'); if (c) { c.textContent = clock(); document.getElementById('tvdate').textContent = day(); } }, 15000);

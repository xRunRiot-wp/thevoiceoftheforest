// Character hotbar in the top banner: money, training points, held item,
// garment, a quick World Map, and the three bag items the player pinned.
import * as store from './store.js?v=6ae3cba4';
import { $, esc, num, toast } from './util.js?v=6ae3cba4';
import { modal } from './ui.js?v=6ae3cba4';
import { mailWaiting, openMyMailbox } from './mailbox.js?v=6ae3cba4';
import { sentryDue } from './sentry.js?v=6ae3cba4';
import { kitchenDue } from './kitchen.js?v=6ae3cba4';
import { nurseryDue } from './nursery.js?v=6ae3cba4';
import { itemInfo, useBagItem, itemPopHTML } from './itemuse.js?v=6ae3cba4';
import { openFriends, friendsOf, isOnline } from './friends.js?v=6ae3cba4';

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
  const bag = Object.values(store.get('bag') || {}).filter((b) => b.owner === c.id || b.owner === 'team');
  const pins = pinsOf(c).map((n) => { const qty = bag.filter((b) => b.name === n).reduce((s, b) => s + num(b.qty), 0); return `<button class="hb hb-pin hb-btn ${qty ? '' : 'gone'}" data-pinitem="${esc(n)}" title="Use or look up ${esc(n)}">📌 ${esc(n)}${qty > 1 ? ' ×' + qty : ''}</button>`; }).join('');
  const due = choresFor(c).filter((x) => x.due).length;
  return `<a class="hb hb-me" href="#/play" title="Open your character sheet"><b>${esc(c.nickname)}</b></a>
    <button class="hb hb-btn hb-friends" id="hbfriends" title="Friends: who's online, invite them to play">👥 Friends${(() => { const n = friendsOf(c).filter(isOnline).length; return n ? ` <b class="hb-count on">${n}</b>` : ''; })()}</button>
    <button class="hb hb-btn hb-chores ${due ? 'due' : 'done'}" id="hbchores" title="Today’s chores">📋 Chores ${due ? `<b class="hb-count">${due}</b>` : '✓'} ▾</button>
    <span class="hb" title="Poké">💰 ${num(c.poke).toLocaleString()}</span>
    <a class="hb hb-link" href="#/gym" title="Training Points: open the Training Gym">${num(c.tp)} Training Points (TP) 🏋️</a>
    <span class="hb-pins">${pins || '<button class="hb hb-pin hb-btn muted" id="hbpinadd" title="Quick-pin items from your Bag">📌 Pin items in your Bag ▾</button>'}${pins && pinsOf(c).length < 3 ? '<button class="hb hb-pin hb-btn" id="hbpinadd" title="Quick-pin items from your Bag">📌＋</button>' : ''}</span>
    <span class="hb hb-right" title="Held item">✋ ${esc(c.held || '—')}</span>
    <button class="hb hb-btn" id="hbgarb" title="Garment">🎀 ${esc(c.garments || '—')}</button>
    <button class="hb hb-btn" id="hbmap">🗺️ Map</button>`;
}

let lastHTML = '';
// called on every render and table change
export function updateHotbar() {
  const el = $('#hotbar'); if (!el) return;
  const c = (store.get('party') || {})[meId()];
  updateMail(c);
  if (!c) { el.hidden = true; el.innerHTML = ''; lastHTML = ''; return; }
  el.hidden = false;
  // only redraw when something in the bar changed: redrawing on every table update swapped the buttons out
  // between a press and its release, so clicks (like the first "Pin items in your Bag") got lost
  const html = hotbarHTML(c);
  if (lastHTML === html && el.firstChild) return;
  lastHTML = html;
  el.innerHTML = html;
  $('#hbmap', el).onclick = showMap;
  $('#hbfriends', el).onclick = openFriends;
  $('#hbgarb', el).onclick = () => showGarment((store.get('party') || {})[meId()] || c);
  $('.hb-me', el).onclick = (e) => { e.preventDefault(); openSheet(); };
  const add = $('#hbpinadd', el); if (add) add.onclick = (e) => { e.stopPropagation(); togglePinMenu(add, c.id); };
  const ch = $('#hbchores', el); if (ch) ch.onclick = (e) => { e.stopPropagation(); toggleChores(ch, c.id); };
  el.querySelectorAll('[data-pinitem]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); openItemPop(b, c.id, b.dataset.pinitem); });
}

// Daily-mission mailbox: on the Table line of the banner, above the name chip (her ask 10-27)
let lastMail = '';
function updateMail(c) {
  const slot = $('#mailslot'); if (!slot) return;
  const mail = c ? mailWaiting(c) : null;
  const key = c ? String(mail) : '';
  if (key === lastMail && (slot.firstChild || !c)) return;
  lastMail = key;
  slot.innerHTML = c ? `<button class="hb-mail ${mail ? 'new' : ''}" id="hbmail" title="${mail ? 'New mail! A mission is waiting' : 'Mailbox: today’s mission is done'}" aria-label="Mailbox">${mail ? '📬' : '📪'}</button>` : '';
  if (c) $('#hbmail', slot).onclick = openMyMailbox;
}

// Name chip: go to Play and scroll to the player's own sheet (below the banner and story cards)
function openSheet() {
  if (location.hash !== '#/play') location.hash = '#/play';
  let tries = 0;
  const go = () => {
    const card = document.querySelector('.char-head')?.closest('.card');
    if (!card) { if (++tries < 40) setTimeout(go, 100); return; }
    const top = document.querySelector('.top')?.getBoundingClientRect().bottom || 0;
    window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - top - 10, behavior: 'smooth' });
  };
  setTimeout(go, 50);
}

// Pinned item popup (her ask 10-27): what it does, Use one (applies the benefit, takes it out of the bag), Unpin.
async function openItemPop(anchor, id, name) {
  if (document.getElementById('pinmenu')?.dataset.item === name) { closePinMenu(); return; }
  closePinMenu();
  const m = document.createElement('div'); m.id = 'pinmenu'; m.className = 'pinmenu itempop'; m.dataset.item = name; document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  m.style.top = Math.round(r.bottom + 6) + 'px';
  m.style.left = Math.round(Math.max(8, Math.min(r.left + r.width / 2 - 140, window.innerWidth - 288))) + 'px';
  const text = await itemInfo(name);
  const draw = () => {
    const c = (store.get('party') || {})[id]; if (!c || !m.isConnected) { closePinMenu(); return; }
    const qty = Object.values(store.get('bag') || {}).filter((b) => b.name === name && (b.owner === c.id || b.owner === 'team')).reduce((s, b) => s + num(b.qty), 0);
    m.innerHTML = itemPopHTML(c, name, qty, text);
    m.querySelector('[data-ipix]').dataset.ixname = name;
    m.querySelector('[data-ipuse]').onclick = async () => { await useBagItem(c, name); setTimeout(draw, 50); };
    m.querySelector('[data-ipunpin]').onclick = () => { store.set('party/' + c.id + '/pins', pinsOf(c).filter((x) => x !== name)); closePinMenu(); };
  };
  draw();
  document.addEventListener('pointerdown', outsidePinMenu, true); document.addEventListener('keydown', escPinMenu);
}

// Today's chores (her ask 10-27): a quick list of the daily jobs, what still needs doing, one tap to go there.
const gymDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
function choresFor(c) {
  return [
    ['👣', 'Sentry Duty with Diglett', sentryDue(), '#/games/sentry-duty'],
    ['🍲', 'Help in Spinda’s Kitchen', kitchenDue(), '#/games/spinda-kitchen'],
    ['🥚', 'Care for your nursery buddy', nurseryDue(), '#/games/fernshade-nursery'],
    ['🏋️', 'Today’s drill at the Training Gym', c.gym?.day !== gymDay(), '#/gym'],
  ].map(([icon, label, due, href]) => ({ icon, label, due: !!due, href }));
}
function toggleChores(anchor, id) {
  if (document.getElementById('pinmenu')?.dataset.chores) { closePinMenu(); return; }
  closePinMenu();
  const c = (store.get('party') || {})[id]; if (!c) return;
  const m = document.createElement('div'); m.id = 'pinmenu'; m.className = 'pinmenu chores-menu'; m.dataset.chores = '1'; document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  m.style.top = Math.round(r.bottom + 6) + 'px'; m.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - 268))) + 'px';
  const list = choresFor(c); const left = list.filter((x) => x.due).length;
  m.innerHTML = `<div class="pm-head">📋 Today’s chores <span class="muted">${left ? `${left} to do` : 'all done!'}</span></div>`
    + list.map((x, i) => `<button class="pm-item ch-item ${x.due ? 'due' : 'ok'}" data-ci="${i}"><span class="pm-tick">${x.due ? '○' : '✓'}</span><span>${x.icon}</span><span class="grow">${esc(x.label)}</span>${x.due ? '<span class="muted">Go ›</span>' : ''}</button>`).join('');
  m.querySelectorAll('[data-ci]').forEach((b) => b.onclick = () => { const x = list[+b.dataset.ci]; closePinMenu(); if (!x.href) openMyMailbox(); else location.hash = x.href; });
  document.addEventListener('pointerdown', outsidePinMenu, true); document.addEventListener('keydown', escPinMenu);
}

// Quick-pin dropdown: the player's current bag items, tap to pin/unpin (max 3). Lives on <body> so the
// sideways-scrolling hotbar can't clip it.
const isBadge = (name) => / (Rank|Guild) Badge$/.test(name || '');
function closePinMenu() { document.getElementById('pinmenu')?.remove(); document.removeEventListener('pointerdown', outsidePinMenu, true); document.removeEventListener('keydown', escPinMenu); }
function outsidePinMenu(e) { const m = document.getElementById('pinmenu'); if (m && !m.contains(e.target) && e.target.id !== 'hbpinadd' && !e.target.closest?.('[data-pinitem], #hbchores')) closePinMenu(); }
function escPinMenu(e) { if (e.key === 'Escape') closePinMenu(); }
function togglePinMenu(anchor, id) {
  if (document.getElementById('pinmenu')) { closePinMenu(); return; }
  const m = document.createElement('div'); m.id = 'pinmenu'; m.className = 'pinmenu'; document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  m.style.top = Math.round(r.bottom + 6) + 'px';
  m.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - 268))) + 'px';
  const draw = () => {
    const c = (store.get('party') || {})[id]; if (!c) { closePinMenu(); return; }
    const pins = pinsOf(c); const qty = {};
    Object.values(store.get('bag') || {}).filter((b) => (b.owner === c.id || b.owner === 'team') && b.name !== 'World Map' && !isBadge(b.name))
      .forEach((b) => { qty[b.name] = (qty[b.name] || 0) + num(b.qty); });
    const names = Object.keys(qty).sort((a, b) => a.localeCompare(b));
    m.innerHTML = `<div class="pm-head">📌 Quick pin <span class="muted">${pins.length}/3</span></div>`
      + (names.length ? names.map((n) => `<button class="pm-item ${pins.includes(n) ? 'on' : ''}" data-n="${esc(n)}"><span class="pm-tick">${pins.includes(n) ? '✓' : ''}</span><span class="grow">${esc(n)}</span>${qty[n] > 1 ? `<span class="muted">×${qty[n]}</span>` : ''}</button>`).join('')
        : '<div class="pm-empty muted">Nothing to pin yet. Items you or the team find land in your Bag and show up here.</div>');
    m.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => {
      const n = b.dataset.n; const cur = pinsOf(c);
      if (cur.includes(n)) store.set('party/' + c.id + '/pins', cur.filter((x) => x !== n));
      else if (cur.length >= 3) { toast('You can pin 3 items. Unpin one first.'); return; }
      else store.set('party/' + c.id + '/pins', [...cur, n]);
      setTimeout(draw, 0);
    });
  };
  draw();
  document.addEventListener('pointerdown', outsidePinMenu, true); document.addEventListener('keydown', escPinMenu);
}

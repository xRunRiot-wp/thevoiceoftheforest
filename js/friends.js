// Friends list (her ask 10-27): a 👥 Friends button in the hotbar on every page. Add the other characters at the table as
// friends, see who's on the site right now (and where), and invite them to a game like Noctowl's 21.
// online/<id> = { t, at } (each open device refreshes it every 2 minutes); party/<id>/friends = [ids];
// invites/<id>/<inviteId> = { from, fromId, game, name, t } (shown once as a pop-up on the friend's device, then removed).
import * as store from './store.js?v=6ae166c0';
import { $, $$, esc, toast, uid, timeAgo } from './util.js?v=6ae166c0';
import { playingNow, openWatch } from './watch.js?v=6ae166c0';
import { modal, closeModal, portrait } from './ui.js?v=6ae166c0';

const ONLINE_FOR = 5 * 60e3; const BEAT = 2 * 60e3;
const meId = () => { try { return localStorage.getItem('dc.me.' + store.tableCode()) || ''; } catch { return ''; } };
const party = () => store.get('party') || {};
const PLACES = { play: 'their character sheet', guild: 'the guild', vault: 'the Vault', games: 'the Games', gym: 'the Training Gym', rules: 'the Rulebook', friends: 'the Friend Zone', merchant: 'the merchant', shop: 'the shop' };
const GAME_NAMES = { 'noctowl-21': 'Noctowl’s 21' };
const placeOf = (at = '') => { const [p, g] = at.replace(/^#\/?/, '').split('/'); return g && GAME_NAMES[g] ? GAME_NAMES[g] : g && p === 'games' ? 'a game' : PLACES[p] || 'the site'; };
export const isOnline = (id) => Date.now() - Number(store.get('online/' + id)?.t || 0) < ONLINE_FOR;
export const friendsOf = (c) => (Array.isArray(c?.friends) ? c.friends : []).filter((id) => party()[id]);

// presence: only while the page is visible, and not more than every 2 minutes (each write updates everyone's table)
let lastBeat = 0; let lastAt = '';
function beat(force) {
  const id = meId(); if (!id || !party()[id] || document.hidden) return;
  const at = location.hash || '#/';
  if (!force && Date.now() - lastBeat < BEAT && at.split('/').slice(0, 3).join('/') === lastAt) return;
  lastBeat = Date.now(); lastAt = at.split('/').slice(0, 3).join('/');
  store.set('online/' + id, { t: Date.now(), at: lastAt });
}

// invites for me: a little pop-up with Join / Not now
let shown = new Set();
function checkInvites() {
  const id = meId(); if (!id) return;
  const mine = Object.entries(store.get('invites/' + id) || {}).filter(([k, v]) => v && !shown.has(k));
  for (const [k, v] of mine) {
    shown.add(k);
    store.set(`invites/${id}/${k}`, null);
    if (Date.now() - Number(v.t) > 30 * 60e3) continue; // too old to matter
    const el = document.createElement('div'); el.className = 'invite-pop';
    el.innerHTML = `<b>👥 ${esc(v.from)}</b> invited you to <b>${esc(v.name || 'a game')}</b>!<div class="row"><a class="btn sm" href="#/games/${esc(v.game)}">Join</a><button class="btn alt sm">Not now</button></div>`;
    document.body.appendChild(el);
    const close = () => el.remove();
    $('a', el).onclick = close; $('button', el).onclick = close; setTimeout(close, 60e3);
  }
}

export function startFriends() {
  beat(true);
  setInterval(() => beat(false), 30e3);
  addEventListener('hashchange', () => setTimeout(() => beat(false), 500));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) beat(true); });
  store.subscribe(checkInvites); checkInvites();
}

const rowHTML = (x, isFriend, me) => {
  const on = isOnline(x.id); const o = store.get('online/' + x.id);
  const pl = playingNow(x.id);
  const status = pl ? `<span class="fr-dot on"></span>🎮 Playing ${esc(pl.name)}` : on ? `<span class="fr-dot on"></span>Online now · at ${esc(placeOf(o?.at))}` : `<span class="fr-dot"></span>${o?.t ? 'Last here ' + esc(timeAgo(o.t)) : 'Not seen yet'}`;
  const back = friendsOf(x).includes(me.id);
  return `<li>${portrait(x, 'sm')}<span class="grow"><b>${esc(x.nickname)}</b>${isFriend && back ? ' <span class="pill">Friends</span>' : ''}<br><span class="small muted">${status}</span></span>
    ${isFriend && pl ? `<button class="btn alt sm" data-watchp="${esc(x.id)}">👀 Watch</button>` : ''}${isFriend && !pl && on && /noctowl-21/.test(o?.at || '') ? '<a class="btn alt sm" href="#/games/noctowl-21" data-watch>👀 Watch</a>' : ''}${isFriend ? `<button class="btn sm" data-inv="${esc(x.id)}">🃏 Invite to 21</button><button class="btn alt sm" data-unfr="${esc(x.id)}" title="Remove friend">✕</button>`
      : `<button class="btn alt sm" data-addfr="${esc(x.id)}">+ Add</button>`}</li>`;
};

export function openFriends() {
  const c = party()[meId()]; if (!c) return toast('Pick your character first.');
  const draw = (box) => {
    const me = party()[meId()] || c; const mine = friendsOf(me);
    const others = Object.values(party()).filter((x) => x.id !== me.id && !mine.includes(x.id) && (!x.guest || x.guest.controller === 'player'));
    const friends = mine.map((id) => party()[id]).sort((a, b) => isOnline(b.id) - isOnline(a.id));
    box.innerHTML = `<h2>👥 Friends</h2><p class="small muted">See who’s on the site right now and invite them to play.</p>
      <h3>Your friends</h3><ul class="sentry-roster fr-list">${friends.map((x) => rowHTML(x, true, me)).join('') || '<li class="muted">No friends added yet. Add someone below!</li>'}</ul>
      ${others.length ? `<h3 style="margin-top:14px">Add friends</h3><ul class="sentry-roster fr-list">${others.map((x) => rowHTML(x, false, me)).join('')}</ul>` : ''}`;
    $$('[data-addfr]', box).forEach((b) => b.onclick = () => { store.set(`party/${me.id}/friends`, [...new Set([...mine, b.dataset.addfr])]); toast(`${party()[b.dataset.addfr]?.nickname} added!`); draw(box); });
    $$('[data-unfr]', box).forEach((b) => b.onclick = () => { store.set(`party/${me.id}/friends`, mine.filter((id) => id !== b.dataset.unfr)); draw(box); });
    $$('[data-watch]', box).forEach((a) => a.onclick = () => closeModal());
    $$('[data-watchp]', box).forEach((b) => b.onclick = () => { closeModal(); setTimeout(() => openWatch(b.dataset.watchp), 50); });
    $$('[data-inv]', box).forEach((b) => b.onclick = () => {
      const to = party()[b.dataset.inv];
      store.set(`invites/${b.dataset.inv}/${uid()}`, { from: me.nickname, fromId: me.id, game: 'noctowl-21', name: GAME_NAMES['noctowl-21'], t: Date.now() });
      toast(isOnline(to.id) ? `Invite sent to ${to.nickname}!` : `Invite sent. ${to.nickname} will see it next time they’re on (within 30 minutes).`);
      closeModal(); location.hash = '#/games/noctowl-21';
    });
  };
  const box = modal('<div id="frbox"></div>');
  draw($('#frbox', box));
}

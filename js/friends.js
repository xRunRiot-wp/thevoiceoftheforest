// Friends list (her ask 10-27): a 👥 Friends button in the hotbar on every page. Add the other characters at the table as
// friends, see who's on the site right now (and where), and invite them to a game like Noctowl's 21.
// online/<id> = { t, at } (each open device refreshes it every 2 minutes); party/<id>/friends = [ids];
// invites/<id>/<inviteId> = { from, fromId, game, name, t } (shown once as a pop-up on the friend's device, then removed).
import * as store from './store.js?v=6ae3bb02';
import { $, $$, esc, toast, uid, timeAgo, num } from './util.js?v=6ae3bb02';
import { sendFx, startLetterWatch } from './letterfx.js?v=6ae3bb02';
import { giftNote, writeMail } from './mailbox.js?v=6ae3bb02';
import { playingNow, openWatch } from './watch.js?v=6ae3bb02';
import { modal, closeModal, portrait } from './ui.js?v=6ae3bb02';
import { keepsake } from './shopkit.js?v=6ae3bb02';

const ONLINE_FOR = 5 * 60e3; const BEAT = 2 * 60e3;
const meId = () => { try { return localStorage.getItem('dc.me.' + store.tableCode()) || ''; } catch { return ''; } };
const party = () => store.get('party') || {};
const PLACES = { play: 'their character sheet', guild: 'the guild', vault: 'the Vault', games: 'the Games', gym: 'the Training Gym', rules: 'the Rulebook', friends: 'the Friend Zone', merchant: 'the merchant', shop: 'the shop' };
const GAME_NAMES = { 'noctowl-21': 'Noctowl’s 21', 'friendly-battle': 'a Friendly Battle' };
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
  startLetterWatch();
}

const rowHTML = (x, isFriend, me) => {
  const on = isOnline(x.id); const o = store.get('online/' + x.id);
  const pl = playingNow(x.id);
  const status = pl ? `<span class="fr-dot on"></span>🎮 Playing ${esc(pl.name)}` : on ? `<span class="fr-dot on"></span>Online now · at ${esc(placeOf(o?.at))}` : `<span class="fr-dot"></span>${o?.t ? 'Last here ' + esc(timeAgo(o.t)) : 'Not seen yet'}`;
  const back = friendsOf(x).includes(me.id);
  return `<li><button class="fr-peek" data-peek="${esc(x.id)}" title="See ${esc(x.nickname)}’s character" aria-label="See ${esc(x.nickname)}’s character">${portrait(x, 'sm')}</button><span class="grow"><b>${esc(x.nickname)}</b>${isFriend && back ? ' <span class="pill">Friends</span>' : ''}<br><span class="small muted">${status}</span></span>
    <span class="fr-acts">${isFriend && pl ? `<button class="btn alt sm" data-watchp="${esc(x.id)}">👀 Watch</button>` : ''}${isFriend && !pl && on && /noctowl-21/.test(o?.at || '') ? '<a class="btn alt sm" href="#/games/noctowl-21" data-watch>👀 Watch</a>' : ''}${isFriend ? `<button class="btn alt sm fr-ico" data-mail="${esc(x.id)}" title="Send mail" aria-label="Send mail">📮</button><button class="btn alt sm fr-ico" data-send="${esc(x.id)}" title="Send a gift" aria-label="Send a gift">🎁</button><button class="btn alt sm" data-bt="${esc(x.id)}">⚔️ Battle</button><button class="btn sm" data-inv="${esc(x.id)}">🃏 Invite to 21</button>`
      : `<button class="btn alt sm" data-addfr="${esc(x.id)}">+ Add</button>`}</span></li>`;
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
    // her ask 10-29: tap a portrait for a mini look at their character
    $$('[data-peek]', box).forEach((b) => b.onclick = () => { closeModal(); setTimeout(() => import('./play.js?v=6ae3bb02').then((m) => m.viewCharacter(b.dataset.peek, { mini: true })), 50); });
    // her ask 10-29: a mail button to send just a letter
    $$('[data-mail]', box).forEach((b) => b.onclick = () => { closeModal(); setTimeout(() => writeMail(me, b.dataset.mail), 50); });
    $$('[data-send]', box).forEach((b) => b.onclick = () => { closeModal(); setTimeout(() => openSend(b.dataset.send), 50); });
    // her ask 10-29: battle a friend like the main Pokémon games
    $$('[data-bt]', box).forEach((b) => b.onclick = () => { closeModal(); import('./battle.js?v=6ae3bb02').then((m) => m.challenge(b.dataset.bt)); });
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

// Send a friend Poké or items from your own bag (her ask 10-27). They get a note in their mailbox.
// her ask 10-29: rank badges, the World Map and key items can't be sent
const myItems = (id) => Object.entries(store.get('bag') || {}).filter(([, b]) => b && b.owner === id && num(b.qty) > 0 && !keepsake(b));
function giveItem(from, to, key, qty) {
  const b = store.get('bag/' + key); if (!b || b.owner !== from || num(b.qty) < qty || keepsake(b)) return false;
  if (num(b.qty) === qty) store.set('bag/' + key, null); else store.set(`bag/${key}/qty`, num(b.qty) - qty);
  const same = Object.entries(store.get('bag') || {}).find(([, x]) => x && x.owner === to && x.name.toLowerCase() === b.name.toLowerCase());
  if (same) store.set(`bag/${same[0]}/qty`, num(same[1].qty) + qty); else store.set('bag/' + uid(), { name: b.name, qty, owner: to });
  return b.name;
}
export function openSend(toId) {
  const me = party()[meId()]; const to = party()[toId]; if (!me || !to) return;
  const items = myItems(me.id);
  const box = modal(`<h2>🎁 Send to ${esc(to.nickname)}</h2><p class="small muted">It goes straight to them, with a note in their mailbox.</p>
    <h3>💰 Poké</h3><p class="small">You have <b>${num(me.poke).toLocaleString()}</b> Poké.</p>
    <div class="row" style="gap:8px;align-items:center"><input type="number" id="sdpoke" min="1" max="${num(me.poke)}" placeholder="How much?" style="max-width:140px"><button class="btn" id="sdpokego">Send Poké</button></div>
    <h3 style="margin-top:14px">🎒 An item from your bag</h3>
    ${items.length ? `<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><select id="sditem">${items.map(([k, b]) => `<option value="${esc(k)}">${esc(b.name)} (you have ${num(b.qty)})</option>`).join('')}</select>
      <input type="number" id="sdqty" min="1" value="1" style="max-width:80px"><button class="btn" id="sditemgo">Send item</button></div>` : '<p class="muted">Your bag is empty.</p>'}
    <label class="f" style="margin-top:14px">Note (optional)<input id="sdnote" maxlength="120" placeholder="Good luck out there!"></label>`);
  const note = () => ($('#sdnote', box).value || '').trim();
  const done = (what) => {
    giftNote(to.id, '🎁', `A gift from ${me.nickname}`, `${me.nickname} sent you ${what}!${note() ? ` “${note()}”` : ''}`);
    store.pushLimited('log', { t: Date.now(), text: `${me.nickname} sent ${to.nickname} ${what}.` });
    closeModal(); sendFx(to.nickname, what, note());
  };
  $('#sdpokego', box).onclick = () => {
    const amt = num($('#sdpoke', box).value); const have = num(party()[me.id]?.poke);
    if (amt <= 0) return toast('Type how much Poké to send.');
    if (amt > have) return toast(`You only have ${have.toLocaleString()} Poké.`);
    store.update('party/' + me.id, (x) => ({ ...x, poke: num(x?.poke) - amt }));
    store.update('party/' + to.id, (x) => ({ ...x, poke: num(x?.poke) + amt }));
    done(`${amt.toLocaleString()} Poké`);
  };
  const ig = $('#sditemgo', box);
  if (ig) ig.onclick = () => {
    const key = $('#sditem', box).value; const qty = Math.max(1, num($('#sdqty', box).value, 1)); const b = store.get('bag/' + key);
    if (!b || num(b.qty) < qty) return toast(`You only have ${num(b?.qty)} of those.`);
    const name = giveItem(me.id, to.id, key, qty); if (!name) return toast('That item is gone from your bag.');
    done(qty > 1 ? `${qty}× ${name}` : name);
  };
}

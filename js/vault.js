// Storage & Poké for each guild (Woodland Base, Vanguard Guild). Fills itself from what players do on the site:
// Poké given to / taken from the shared coffers, shop buys, end-of-session rewards, items stored or taken out.
import * as store from './store.js?v=6af153e6';
import { $, $$, esc, num, uid, toast, timeAgo } from './util.js?v=6af153e6';
import { GUILDS2, guildName, shopShortcuts } from './guild.js?v=6af153e6';
import { addItem, me, pokeMove } from './play.js?v=6af153e6';
import { ixLink } from './effects.js?v=6af153e6';
import { gmTodo, guildSay } from './chatter.js?v=6af153e6';
import { DECOR } from './basedecor.js?v=6af153e6';
import { palette } from './theme.js?v=6af153e6';
import { modal, closeModal } from './ui.js?v=6af153e6';

// Each guild's own colours on this page, so players can tell at a glance whose storage they're looking at.
const GUILD_TINT = { woodland: '#4f8a2e', vanguard: '#2f5fb8' };
const tintStyle = (k) => Object.entries(palette(GUILD_TINT[k] || GUILD_TINT.woodland)).map(([v, c]) => `${v}:${c}`).join(';');

// One line in the guild's ledger. amt = Poké in (+) or out (-); item lines have no amt.
export function ledger(guild, text, amt = null) {
  store.pushLimited('ledger', { t: Date.now(), guild: guild === 'vanguard' ? 'vanguard' : 'woodland', text, amt }, 400);
}

// ---- per-session withdrawal caps (Poké taken out of the shared coffers: Take from guild + shop buys)
export const LOW_COFFERS = 5000;
const DEFAULT_CAP = { woodland: 1000, vanguard: 5000 };
const gkey = (g) => (g === 'vanguard' ? 'vanguard' : 'woodland');
const sessN = () => num((store.get('session') || {}).n) || 1;
export function capInfo(guild) {
  const k = gkey(guild);
  const cap = num((store.get(k === 'vanguard' ? 'vanguard' : 'guild') || {}).cap) || DEFAULT_CAP[k];
  const used = num(store.get(`withdrawn/${k}/s${sessN()}`));
  return { cap, used, left: Math.max(0, cap - used), name: guildName(k) };
}
// false (and a message) when this would go over the guild's cap for the session
export function canWithdraw(guild, amt) {
  const c = capInfo(guild);
  if (amt <= c.left) return true;
  toast(`${c.name} can only take ${c.left.toLocaleString()} more Poké this session (cap ${c.cap.toLocaleString()})`);
  return false;
}
export function recordWithdrawal(guild, amt) {
  const k = gkey(guild);
  store.update(`withdrawn/${k}/s${sessN()}`, (v) => num(v) + amt);
  checkCoffers();
}
// Coffers under 5,000: post the emergency mission once (until it is finished or removed)
export function checkCoffers() {
  const coffers = num((store.get('guild') || {}).coffers);
  if (coffers >= LOW_COFFERS) return;
  const open = Object.values(store.get('missions') || {}).some((m) => m.coffersEmergency && !['done', 'failed'].includes(m.status));
  if (open) return;
  store.set('missions/' + uid(), {
    rank: 'D', title: 'Emergency Mission: Restore the Coffers', client: 'Guildmaster Beautifly', place: 'Gravity Falls Guild',
    details: `The shared guild coffers have fallen below ${LOW_COFFERS.toLocaleString()} Poké. Supplies, repairs and rescues all depend on them. Take on paid work, sell spare finds, or recover lost treasure to refill the vault before the guild runs dry.`,
    reward: 'Poké raised goes straight into the coffers', status: 'open', coffersEmergency: true, art: 'assets/banners/items_treasure.jpg', ts: Date.now(),
  });
  gmTodo('The coffers are under 5,000 Poké: the Emergency Mission is on the board.');
  store.pushLimited('log', { t: Date.now(), text: `⚠ The guild coffers are below ${LOW_COFFERS.toLocaleString()} Poké. Emergency mission posted.` });
}
export const lowAlertHTML = () => {
  const coffers = num((store.get('guild') || {}).coffers);
  return coffers < LOW_COFFERS ? `<div class="lowalert"><b>⚠ The guild coffers are low: ${coffers.toLocaleString()} Poké.</b> Below ${LOW_COFFERS.toLocaleString()}, the emergency mission <a href="#/guild">Restore the Coffers</a> is on the board.</div>` : '';
};

const guildOfItem = (b) => (b.guild === 'vanguard' ? 'vanguard' : 'woodland');
let tab = null;   // which guild is showing (stays while the page refreshes live)
let tabFrom = ''; // the player + guild the default came from
// a #/vault/<guild> link picks the tab once per visit, so tapping the other tab (or a live refresh) doesn't snap back
let linkUsed = false;
window.addEventListener('hashchange', () => { linkUsed = false; });

export function renderVault(main, rest = []) {
  // opens on the guild the player is working for right now (her ask 10-27), and follows them if they switch guilds or characters
  const c = me(); const works = c?.guild === 'vanguard' ? 'vanguard' : 'woodland'; const from = `${c?.id || ''}|${works}`;
  if (!tab || from !== tabFrom) { tab = works; tabFrom = from; }
  // her ask 11-07: the TV's Vault tile opens straight on one guild's bank (#/vault/woodland or #/vault/vanguard)
  if (['woodland', 'vanguard'].includes(rest[0]) && !linkUsed) { tab = rest[0]; linkUsed = true; }
  const g = store.get('guild') || {};
  const lines = Object.values(store.get('ledger') || {}).filter((l) => (l.guild || 'woodland') === tab).sort((a, b) => b.t - a.t);
  const pin = lines.filter((l) => l.amt > 0).reduce((s, l) => s + l.amt, 0);
  const pout = lines.filter((l) => l.amt < 0).reduce((s, l) => s - l.amt, 0);
  const items = Object.entries(store.get('storage') || {}).filter(([, b]) => guildOfItem(b) === tab);
  const used = items.reduce((s, [, b]) => s + (/orb$/i.test(b.name) ? num(b.qty) : 1), 0);   // like her storage sheet: a stack takes one slot, each Orb its own
  const gstore = store.get(tab === 'vanguard' ? 'vanguard' : 'guild') || {};
  const slots = num(gstore.slots);

  main.innerHTML = `<div class="vault-tint vault-${tab}" style="${tintStyle(tab)}">
  <div class="hero banner"><img class="hdr" src="assets/banners/items_treasure.jpg" alt=""></div>
  ${shopShortcuts({ gym: false, small: true })}
  <h1>Storage & Poké</h1>
  ${lowAlertHTML()}
  <div class="vtabs">${GUILDS2.map(([k, n]) => `<button class="vtab ${k === tab ? 'on' : ''}" data-vtab="${k}" style="${tintStyle(k)}">${k === 'vanguard' ? '🛡️' : '🌳'} ${esc(n)}</button>`).join('')}</div>

  <div class="vault-grid">
    <div>
      <div class="section-title"><h2>Poké</h2></div>
      <div class="card pokebank"><div class="small muted">Shared guild coffers (both guilds)</div><div class="pix pokeamt">${num(g.coffers).toLocaleString()} <span>Poké</span></div>
        <div class="grid g2 small"><div><b class="pix">+${pin.toLocaleString()}</b><br>${esc(guildName(tab))} put in</div><div><b class="pix">−${pout.toLocaleString()}</b><br>${esc(guildName(tab))} took out</div></div>
        ${(() => { const c = capInfo(tab); return `<div class="capbar"><div class="small">Withdrawn this session: <b>${c.used.toLocaleString()} / ${c.cap.toLocaleString()}</b> Poké</div>${'<div class="bar"><i style="width:' + Math.min(100, (c.used / c.cap) * 100) + '%"></i></div>'}</div>`; })()}
        <div class="row" style="justify-content:center;margin-top:10px;gap:8px"><button class="btn" id="vdep">💰 Deposit</button><button class="btn alt" id="vwd">🏧 Withdraw</button></div>
        <p class="small muted" style="margin:4px 0 0;text-align:center">${me() ? `${esc(me().nickname)} has ${num(me().poke).toLocaleString()} Poké` : 'Pick your character (Play tab) to deposit or withdraw.'}</p></div>
      <div class="section-title"><h3>${esc(guildName(tab))} activity</h3></div>
      <div class="card" style="padding:6px 12px">${lines.length ? `<ul class="log" style="max-height:420px">${lines.slice(0, 120).map((l) => `<li class="row nowrap"><span class="grow small">${esc(l.text)} <span class="muted">· ${timeAgo(l.t)}</span></span>${l.amt != null ? `<b class="pix ${l.amt < 0 ? 'neg' : 'pos'}">${l.amt > 0 ? '+' : ''}${l.amt}</b>` : ''}</li>`).join('')}</ul>` : '<p class="muted small">Nothing yet. Giving or taking Poké, shop buys, session rewards and storing items show up here by themselves.</p>'}</div>
    </div>
    <div>
      <div class="card row" style="justify-content:space-between;padding:8px 12px"><span>🪙 <b>Money in ${esc(guildName(tab))} storage</b></span><b class="pix">${num(gstore.money).toLocaleString()} Poké</b>${store.gmUnlocked() ? '<button class="btn alt sm" id="stmoney">Edit</button>' : ''}</div>
      <div class="section-title"><h2>Storage</h2><span class="small">${used}${slots ? ` / ${slots} slots` : ' items'}</span><button class="btn alt sm" id="addstore">+ Item</button></div>
      <div class="card" style="padding:6px 12px">${items.length ? `<ul class="log" style="max-height:none">${items.map(([id, b]) => `<li class="row nowrap"><span class="grow">${ixLink(b.name)} ×${b.qty}${b.kind ? ` <span class="small muted">${esc(b.kind)}</span>` : ''}</span><button class="btn alt sm" data-take-item="${id}">To my bag</button></li>`).join('')}</ul>` : `<p class="muted small">The ${esc(guildName(tab))} storage is empty. Use <b>Store</b> on an item in a character's bag, or <b>+ Item</b>.</p>`}</div>
    </div>
  </div></div>`;

  // her ask 11-08: Deposit and Withdraw right on the Poké card (the same as Give to guild / Take from guild on the character card)
  const money = (kind) => { const who = me(); if (!who) return toast('Pick your character first (Play tab)'); pokeMove(who, kind); setTimeout(() => renderVault(main, rest), 150); };
  $('#vdep', main).onclick = () => money('give'); $('#vwd', main).onclick = () => money('take');
  $$('[data-vtab]', main).forEach((b) => b.onclick = () => { tab = b.dataset.vtab; renderVault(main); });
  $('#addstore', main).onclick = () => addItem('team', 'storage', tab);
  const sm = $('#stmoney', main);
  if (sm) sm.onclick = () => { const v = prompt(`Money in ${guildName(tab)} storage (Poké):`, num(gstore.money)); if (v != null && v.trim() !== '') store.set((tab === 'vanguard' ? 'vanguard' : 'guild') + '/money', Math.max(0, num(v))); };
  $$('[data-take-item]', main).forEach((b) => b.onclick = () => takeOut(b.dataset.takeItem));
}

// "How many?" before anything moves between a bag and storage; resolves to the amount, or 0 when cancelled.
function askQty(verb, name, max, where, have) {
  return new Promise((done) => {
    let n = max; let settled = false;
    const finish = (v) => { if (!settled) { settled = true; done(v); } };
    const sh = modal(`<h2>${esc(verb)} ${esc(name)}</h2>
      <p>How many go ${esc(where)}? <span class="muted">(${esc(have)})</span></p>
      <div class="qty-pick"><button class="btn alt" data-q="-1" aria-label="One less">−</button>
        <input id="qtyn" type="number" inputmode="numeric" min="1" max="${max}" value="${max}">
        <button class="btn alt" data-q="1" aria-label="One more">+</button><button class="btn alt sm" data-q="all">All</button></div>
      <div class="row" style="margin-top:14px"><button class="btn" id="qtyok">${esc(verb)} ${max}</button><button class="btn alt" data-close>Cancel</button></div>`);
    const inp = $('#qtyn', sh); const ok = $('#qtyok', sh);
    const set = (v) => { n = Math.max(1, Math.min(max, Math.round(num(v)) || 1)); inp.value = n; ok.textContent = `${verb} ${n}`; };
    $$('[data-q]', sh).forEach((b) => b.onclick = () => set(b.dataset.q === 'all' ? max : n + num(b.dataset.q)));
    inp.oninput = () => { const v = Math.round(num(inp.value)); if (v >= 1) { n = Math.min(max, v); ok.textContent = `${verb} ${n}`; } };
    inp.onchange = () => set(inp.value);
    ok.onclick = () => { set(inp.value); finish(n); closeModal(); };
    // closing the sheet any other way (Cancel, Close, tapping outside) = nothing moves
    new MutationObserver((_, o) => { if (!document.body.contains(sh)) { o.disconnect(); finish(0); } }).observe(document.body, { childList: true });
  });
}

// storage -> the player's own bag (or the team bag when just watching)
async function takeOut(id) {
  const it = (store.get('storage') || {})[id]; if (!it) return;
  const max = Math.max(1, num(it.qty));
  const n = await askQty('Take', it.name, max, 'to your bag', `${max} in storage`);
  const now = (store.get('storage') || {})[id]; if (!n || !now) return;
  const take = Math.min(n, num(now.qty) || 1);
  const c = me(); const owner = c?.id || 'team';
  if (take >= num(now.qty)) store.set('storage/' + id, null); else store.set(`storage/${id}/qty`, num(now.qty) - take);
  const bag = store.get('bag') || {};
  const same = Object.entries(bag).find(([, b]) => b.name === it.name && b.owner === owner);
  if (same) store.set(`bag/${same[0]}/qty`, num(same[1].qty) + take); else store.set('bag/' + uid(), { name: it.name, qty: take, owner });
  ledger(guildOfItem(it), `${c?.nickname || 'Someone'} took ${it.name} ×${take} from storage`);
  toast(`${it.name} ×${take} moved to the bag`);
}

// bag -> the character's guild storage (the Store button in the bag)
export async function stash(bagId, c) {
  const b = (store.get('bag') || {})[bagId]; if (!b) return;
  const guild = c.guild === 'vanguard' ? 'vanguard' : 'woodland';
  const max = Math.max(1, num(b.qty));
  const n = await askQty('Store', b.name, max, `into the ${guildName(guild)} storage`, `you have ${max}`);
  const now = (store.get('bag') || {})[bagId]; if (!n || !now) return;
  const put = Math.min(n, num(now.qty) || 1);
  if (put >= num(now.qty)) store.set('bag/' + bagId, null); else store.set(`bag/${bagId}/qty`, num(now.qty) - put);
  const st = store.get('storage') || {};
  const same = Object.entries(st).find(([, x]) => x.name === b.name && guildOfItem(x) === guild);
  if (same) store.set(`storage/${same[0]}/qty`, num(same[1].qty) + put); else store.set('storage/' + uid(), { name: b.name, qty: put, owner: 'team', guild });
  ledger(guild, `${c.nickname} stored ${b.name} ×${put}`);
  toast(`${b.name} ×${put} stored in the ${guildName(guild)} storage`);
}

// ---- her ask 11-01: putting Poké into the guild coffers is rewarded
// donors/<id> = { net (given minus taken), best (highest net ever), given (all-time), name }. Rewards count only on a NEW best,
// so giving Poké, taking it back out and giving it again earns nothing extra.
export const DONOR_RANKS = [[1000, '🥉', 'Supporter'], [5000, '🥈', 'Patron'], [15000, '🥇', 'Benefactor'], [50000, '👑', 'Guild Hero']];
export const GIFT_EVERY = 500;   // a thank-you Secret Base piece for every 500 Poké
export const donorRank = (best) => [...DONOR_RANKS].reverse().find(([n]) => num(best) >= n) || null;
function thankYouPiece(id) {
  const own = store.get(`base/${id}/owned`) || {};
  const all = Object.entries(DECOR).filter(([, it]) => it[5] === 'shop'); const fresh = all.filter(([k]) => !own[k]);
  const list = fresh.length ? fresh : all; const [k, it] = list[Math.floor(Math.random() * list.length)] || [];
  if (!k) return null; store.set(`base/${id}/owned/${k}`, num(own[k]) + 1); return it[0];
}
export function donated(c, amt) {
  const d = store.get('donors/' + c.id) || {}; const net = num(d.net) + amt; const best = Math.max(num(d.best), net);
  const gifts = Math.min(10, Math.floor(best / GIFT_EVERY) - Math.floor(num(d.best) / GIFT_EVERY));
  const was = donorRank(d.best); const now = donorRank(best);
  store.set('donors/' + c.id, { net, best, given: num(d.given) + amt, name: c.nickname });
  const got = []; for (let i = 0; i < gifts; i++) { const n = thankYouPiece(c.id); if (n) got.push(n); }
  const lines = [`💛 Thank you, ${c.nickname}! The guild is grateful.`];
  if (got.length) { lines.push(`🎁 Thank-you gift for your base: ${got.join(', ')}. Put it out with 🔨 Build.`); store.pushLimited('log', { t: Date.now(), text: `🎁 ${c.nickname} got a thank-you gift for helping the guild coffers: ${got.join(', ')}.` }); }
  else { const left = GIFT_EVERY - (best % GIFT_EVERY); if (net >= best) lines.push(`${left.toLocaleString()} more Poké to your next thank-you gift.`); }
  if (now && now !== was) {
    lines.push(`${now[1]} You’re now a guild ${now[2]}!`);
    guildSay('Diglett', 'say', `Everyone, give it up for ${c.nickname}, our newest ${now[1]} ${now[2]}! Dig dig! The coffers thank you!`, 'donor', c.nickname);
  }
  setTimeout(() => toast(lines.join(' ')), 300);
}
export function withdrew(c, amt) { store.update('donors/' + c.id, (d) => ({ ...(d || {}), net: num(d?.net) - amt, name: c.nickname })); }
// the Guild page's "Coffers supporters" board: the top givers with their badge
export function donorBoardHTML() {
  const rows = Object.values(store.get('donors') || {}).filter((d) => num(d.best) > 0).sort((a, b) => num(b.best) - num(a.best)).slice(0, 5);
  const next = DONOR_RANKS.map(([n, ic, nm]) => `${ic} ${nm} ${n.toLocaleString()}`).join(' · ');
  return `<div class="donors"><span class="pix">Coffers supporters</span>${rows.length ? `<ol>${rows.map((d) => { const r = donorRank(d.best); return `<li>${r ? r[1] + ' ' : ''}<b>${esc(d.name || '?')}</b> <span class="small muted">${num(d.best).toLocaleString()} Poké${r ? ' · ' + r[2] : ''}</span></li>`; }).join('')}</ol>` : '<p class="small muted" style="margin:4px 0">Nobody yet. Be the first!</p>'}
    <p class="small muted" style="margin:4px 0 0">Give Poké to the coffers: a Secret Base thank-you gift every ${GIFT_EVERY} Poké, and a badge at ${next}.</p></div>`;
}
// her ask 11-07: the TV's Vault tile names the current best patron (whoever has given the coffers the most)
export function topPatron() {
  const d = Object.values(store.get('donors') || {}).filter((x) => num(x.best) > 0).sort((a, b) => num(b.best) - num(a.best))[0];
  if (!d) return null; const r = donorRank(d.best);
  return { name: d.name || '?', best: num(d.best), icon: r ? r[1] : '💛', title: r ? r[2] : 'Supporter' };
}

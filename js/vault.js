// Storage & Poké for each guild (Woodland Base, Vanguard Guild). Fills itself from what players do on the site:
// Poké given to / taken from the shared coffers, shop buys, end-of-session rewards, items stored or taken out.
import * as store from './store.js?v=6ade84c9';
import { $, $$, esc, num, uid, toast, timeAgo } from './util.js?v=6ade84c9';
import { GUILDS2, guildName } from './guild.js?v=6ade84c9';
import { addItem, me } from './play.js?v=6ade84c9';
import { ixLink } from './effects.js?v=6ade84c9';

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
  store.pushLimited('log', { t: Date.now(), text: `⚠ The guild coffers are below ${LOW_COFFERS.toLocaleString()} Poké. Emergency mission posted.` });
}
export const lowAlertHTML = () => {
  const coffers = num((store.get('guild') || {}).coffers);
  return coffers < LOW_COFFERS ? `<div class="lowalert"><b>⚠ The guild coffers are low: ${coffers.toLocaleString()} Poké.</b> Below ${LOW_COFFERS.toLocaleString()}, the emergency mission <a href="#/guild">Restore the Coffers</a> is on the board.</div>` : '';
};

const guildOfItem = (b) => (b.guild === 'vanguard' ? 'vanguard' : 'woodland');
let tab = null;   // which guild is showing (stays while the page refreshes live)

export function renderVault(main) {
  tab ||= me()?.guild === 'vanguard' ? 'vanguard' : 'woodland';
  const g = store.get('guild') || {};
  const lines = Object.values(store.get('ledger') || {}).filter((l) => (l.guild || 'woodland') === tab).sort((a, b) => b.t - a.t);
  const pin = lines.filter((l) => l.amt > 0).reduce((s, l) => s + l.amt, 0);
  const pout = lines.filter((l) => l.amt < 0).reduce((s, l) => s - l.amt, 0);
  const items = Object.entries(store.get('storage') || {}).filter(([, b]) => guildOfItem(b) === tab);
  const used = items.reduce((s, [, b]) => s + num(b.qty), 0);   // one slot per item, like her storage sheet
  const slots = num((store.get(tab === 'vanguard' ? 'vanguard' : 'guild') || {}).slots);

  main.innerHTML = `
  <div class="hero banner"><img class="hdr" src="assets/banners/items_treasure.jpg" alt=""></div>
  <h1>Storage & Poké</h1>
  ${lowAlertHTML()}
  <div class="vtabs">${GUILDS2.map(([k, n]) => `<button class="vtab ${k === tab ? 'on' : ''}" data-vtab="${k}">${esc(n)}</button>`).join('')}</div>

  <div class="vault-grid">
    <div>
      <div class="section-title"><h2>Poké</h2></div>
      <div class="card pokebank"><div class="small muted">Shared guild coffers (both guilds)</div><div class="pix pokeamt">${num(g.coffers).toLocaleString()} <span>Poké</span></div>
        <div class="grid g2 small"><div><b class="pix">+${pin.toLocaleString()}</b><br>${esc(guildName(tab))} put in</div><div><b class="pix">−${pout.toLocaleString()}</b><br>${esc(guildName(tab))} took out</div></div>
        ${(() => { const c = capInfo(tab); return `<div class="capbar"><div class="small">Withdrawn this session: <b>${c.used.toLocaleString()} / ${c.cap.toLocaleString()}</b> Poké</div>${'<div class="bar"><i style="width:' + Math.min(100, (c.used / c.cap) * 100) + '%"></i></div>'}</div>`; })()}</div>
      <div class="section-title"><h3>${esc(guildName(tab))} activity</h3></div>
      <div class="card" style="padding:6px 12px">${lines.length ? `<ul class="log" style="max-height:420px">${lines.slice(0, 120).map((l) => `<li class="row nowrap"><span class="grow small">${esc(l.text)} <span class="muted">· ${timeAgo(l.t)}</span></span>${l.amt != null ? `<b class="pix ${l.amt < 0 ? 'neg' : 'pos'}">${l.amt > 0 ? '+' : ''}${l.amt}</b>` : ''}</li>`).join('')}</ul>` : '<p class="muted small">Nothing yet. Giving or taking Poké, shop buys, session rewards and storing items show up here by themselves.</p>'}</div>
    </div>
    <div>
      <div class="section-title"><h2>Storage</h2><span class="small">${used}${slots ? ` / ${slots} slots` : ' items'}</span><button class="btn alt sm" id="addstore">+ Item</button></div>
      <div class="card" style="padding:6px 12px">${items.length ? `<ul class="log" style="max-height:none">${items.map(([id, b]) => `<li class="row nowrap"><span class="grow">${ixLink(b.name)} ×${b.qty}${b.kind ? ` <span class="small muted">${esc(b.kind)}</span>` : ''}</span><button class="btn alt sm" data-take-item="${id}">To my bag</button></li>`).join('')}</ul>` : `<p class="muted small">The ${esc(guildName(tab))} storage is empty. Use <b>Store</b> on an item in a character's bag, or <b>+ Item</b>.</p>`}</div>
    </div>
  </div>`;

  $$('[data-vtab]', main).forEach((b) => b.onclick = () => { tab = b.dataset.vtab; renderVault(main); });
  $('#addstore', main).onclick = () => addItem('team', 'storage', tab);
  $$('[data-take-item]', main).forEach((b) => b.onclick = () => takeOut(b.dataset.takeItem));
}

// storage -> the player's own bag (or the team bag when just watching)
function takeOut(id) {
  const it = (store.get('storage') || {})[id]; if (!it) return;
  const c = me(); const owner = c?.id || 'team';
  store.set('storage/' + id, null);
  const bag = store.get('bag') || {};
  const same = Object.entries(bag).find(([, b]) => b.name === it.name && b.owner === owner);
  if (same) store.set(`bag/${same[0]}/qty`, same[1].qty + it.qty); else store.set('bag/' + uid(), { name: it.name, qty: it.qty, owner });
  ledger(guildOfItem(it), `${c?.nickname || 'Someone'} took ${it.name} ×${it.qty} from storage`);
  toast(`${it.name} moved to the bag`);
}

// bag -> the character's guild storage (the Store button in the bag)
export function stash(bagId, c) {
  const b = (store.get('bag') || {})[bagId]; if (!b) return;
  const guild = c.guild === 'vanguard' ? 'vanguard' : 'woodland';
  store.set('bag/' + bagId, null);
  const st = store.get('storage') || {};
  const same = Object.entries(st).find(([, x]) => x.name === b.name && guildOfItem(x) === guild);
  if (same) store.set(`storage/${same[0]}/qty`, same[1].qty + b.qty); else store.set('storage/' + uid(), { name: b.name, qty: b.qty, owner: 'team', guild });
  ledger(guild, `${c.nickname} stored ${b.name} ×${b.qty}`);
  toast(`${b.name} stored in the ${guildName(guild)} storage`);
}

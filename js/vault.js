// Storage & Poké for each guild (Woodland Base, Vanguard Guild). Fills itself from what players do on the site:
// Poké given to / taken from the shared coffers, shop buys, end-of-session rewards, items stored or taken out.
import * as store from './store.js?v=6ade79da';
import { $, $$, esc, num, uid, toast, timeAgo } from './util.js?v=6ade79da';
import { GUILDS2, guildName } from './guild.js?v=6ade79da';
import { addItem, me } from './play.js?v=6ade79da';
import { ixLink } from './effects.js?v=6ade79da';

// One line in the guild's ledger. amt = Poké in (+) or out (-); item lines have no amt.
export function ledger(guild, text, amt = null) {
  store.pushLimited('ledger', { t: Date.now(), guild: guild === 'vanguard' ? 'vanguard' : 'woodland', text, amt }, 400);
}

const guildOfItem = (b) => (b.guild === 'vanguard' ? 'vanguard' : 'woodland');
let tab = null;   // which guild is showing (stays while the page refreshes live)

export function renderVault(main) {
  tab ||= me()?.guild === 'vanguard' ? 'vanguard' : 'woodland';
  const g = store.get('guild') || {};
  const lines = Object.values(store.get('ledger') || {}).filter((l) => (l.guild || 'woodland') === tab).sort((a, b) => b.t - a.t);
  const pin = lines.filter((l) => l.amt > 0).reduce((s, l) => s + l.amt, 0);
  const pout = lines.filter((l) => l.amt < 0).reduce((s, l) => s - l.amt, 0);
  const items = Object.entries(store.get('storage') || {}).filter(([, b]) => guildOfItem(b) === tab);

  main.innerHTML = `
  <div class="hero banner"><img class="hdr" src="assets/banners/items_treasure.jpg" alt=""></div>
  <h1>Storage & Poké</h1>
  <div class="vtabs">${GUILDS2.map(([k, n]) => `<button class="vtab ${k === tab ? 'on' : ''}" data-vtab="${k}">${esc(n)}</button>`).join('')}</div>

  <div class="vault-grid">
    <div>
      <div class="section-title"><h2>Poké</h2></div>
      <div class="card pokebank"><div class="small muted">Shared guild coffers (both guilds)</div><div class="pix pokeamt">${num(g.coffers).toLocaleString()} <span>Poké</span></div>
        <div class="grid g2 small"><div><b class="pix">+${pin.toLocaleString()}</b><br>${esc(guildName(tab))} put in</div><div><b class="pix">−${pout.toLocaleString()}</b><br>${esc(guildName(tab))} took out</div></div></div>
      <div class="section-title"><h3>${esc(guildName(tab))} activity</h3></div>
      <div class="card" style="padding:6px 12px">${lines.length ? `<ul class="log" style="max-height:420px">${lines.slice(0, 120).map((l) => `<li class="row nowrap"><span class="grow small">${esc(l.text)} <span class="muted">· ${timeAgo(l.t)}</span></span>${l.amt != null ? `<b class="pix ${l.amt < 0 ? 'neg' : 'pos'}">${l.amt > 0 ? '+' : ''}${l.amt}</b>` : ''}</li>`).join('')}</ul>` : '<p class="muted small">Nothing yet. Giving or taking Poké, shop buys, session rewards and storing items show up here by themselves.</p>'}</div>
    </div>
    <div>
      <div class="section-title"><h2>Storage</h2><button class="btn alt sm" id="addstore">+ Item</button></div>
      <div class="card" style="padding:6px 12px">${items.length ? `<ul class="log" style="max-height:none">${items.map(([id, b]) => `<li class="row nowrap"><span class="grow">${ixLink(b.name)} ×${b.qty}</span><button class="btn alt sm" data-take-item="${id}">To my bag</button></li>`).join('')}</ul>` : `<p class="muted small">The ${esc(guildName(tab))} storage is empty. Use <b>Store</b> on an item in a character's bag, or <b>+ Item</b>.</p>`}</div>
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

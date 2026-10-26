// Shared bits for the Guild Shop and Travelling Merchant pages: the Poké bar at the top, the
// "who bought what" chat, and the buy dialog (who's buying + how many, then a confirm step).
import * as store from './store.js?v=6adfdd41';
import { $, $$, esc, num, timeAgo } from './util.js?v=6adfdd41';
import { portrait, modal, closeModal } from './ui.js?v=6adfdd41';

const meId = () => { try { return localStorage.getItem('dc.me.' + store.tableCode()) || ''; } catch { return ''; } };
const buyers = () => Object.values(store.get('party') || {}).filter((c) => !c.guest);

// Guild coffers + your own Poké, as a quick reference at the top of a shop page
export function pokeBarHTML() {
  const g = store.get('guild') || {}; const c = (store.get('party') || {})[meId()];
  return `<div class="pokebar"><div><span>🏦 Guild coffers</span><b class="pix">${num(g.coffers).toLocaleString()} Poké</b></div>
    <div>${c ? `<span>🪙 ${esc(c.nickname)}’s Poké</span><b class="pix">${num(c.poke).toLocaleString()} Poké</b>` : '<span>🪙 Your Poké</span><a href="#/play">Pick your character</a>'}</div></div>`;
}

// One line in a shop's chat. shop = 'guild' | 'merchant'
export function logSale(shop, buyer, text, reply) {
  store.pushLimited('shoplog', { t: Date.now(), shop, who: buyer?.id || '', text, reply: reply || '' }, 200);
}

export function shopChatHTML(shop, keeper) {
  const P = store.get('party') || {};
  const lines = Object.values(store.get('shoplog') || {}).filter((l) => l.shop === shop).sort((a, b) => b.t - a.t).slice(0, 25);
  return `<div class="section-title"><h2>💬 Shop chat</h2><span class="small muted">every purchase, newest first</span></div>
  <div class="card shopchat">${lines.length ? lines.map((l) => `<div class="sc-line">${portrait(P[l.who] || { nickname: '?' }, 'sm')}<div class="sc-bubble"><p>${esc(l.text)}</p>
      ${l.reply ? `<p class="sc-reply"><b>${esc(keeper)}:</b> “${esc(l.reply)}”</p>` : ''}<span class="small muted">${timeAgo(l.t)}</span></div></div>`).join('')
    : `<p class="muted small">No purchases yet. When someone buys something, it shows up here for everyone.</p>`}</div>`;
}

// Buy dialog. opts: { item, unit (what one buy gives, e.g. "10 Sticks"), price (per buy), max (how many buys allowed),
// seller, onBuy(buyer, qty) }. Step 1: who + how many. Step 2: "Are you sure?" with the total and Poké left.
export function buyDialog({ item, unit = item, price, max = 99, seller, onBuy }) {
  const party = buyers();
  if (!party.length) { modal('<h2>No characters yet</h2><p>Make a character first, then come back to shop.</p>'); return; }
  let qty = 1; let ow = party.some((c) => c.id === meId()) ? meId() : party[0].id;
  const who = () => (store.get('party') || {})[ow];
  const step1 = () => {
    const el = modal(`<h2>Buy ${esc(unit)}</h2><p class="small muted">${price.toLocaleString()} Poké${max > 1 ? ' each' : ''}, from ${esc(seller)}. Paid by the character buying it.</p>
      <label class="f">Who's buying<select id="bw">${party.map((c) => `<option value="${c.id}" ${c.id === ow ? 'selected' : ''}>${esc(c.nickname)} (${num(c.poke).toLocaleString()} Poké)</option>`).join('')}</select></label>
      ${max > 1 ? `<label class="f">How many</label><div class="qty-pick"><button class="btn alt" data-q="-1" aria-label="One less">−</button><input id="bq" type="number" inputmode="numeric" min="1" max="${max}" value="${qty}"><button class="btn alt" data-q="1" aria-label="One more">+</button></div>
        <p class="small muted" style="margin:4px 0 0">${max < 99 ? `${max} left in stock.` : ''}</p>` : ''}
      <p class="buy-total" id="bt"></p>
      <div class="row" style="margin-top:10px"><button class="btn" id="bnext">Next</button><button class="btn alt" data-close>Cancel</button></div>`);
    const total = () => { const c = who(); const t = price * qty; const left = num(c?.poke) - t;
      $('#bt', el).innerHTML = `Total: <b>${t.toLocaleString()} Poké</b>${c ? left < 0 ? ` · <span class="bad-t">${esc(c.nickname)} is ${(-left).toLocaleString()} Poké short</span>` : ` · ${esc(c.nickname)} will have ${left.toLocaleString()} left` : ''}`;
      $('#bnext', el).disabled = !c || left < 0; };
    const setQ = (v) => { qty = Math.max(1, Math.min(max, Math.round(num(v)) || 1)); const i = $('#bq', el); if (i) i.value = qty; total(); };
    $('#bw', el).onchange = () => { ow = $('#bw', el).value; total(); };
    $$('[data-q]', el).forEach((b) => b.onclick = () => setQ(qty + num(b.dataset.q)));
    const i = $('#bq', el); if (i) { i.oninput = () => { if (num(i.value) >= 1) { qty = Math.min(max, Math.round(num(i.value))); total(); } }; i.onchange = () => setQ(i.value); }
    $('#bnext', el).onclick = step2;
    total();
  };
  const step2 = () => {
    const c = who(); const t = price * qty;
    const el = modal(`<h2>Are you sure?</h2>
      <div class="buy-confirm">${portrait(c, 'sm')}<p><b>${esc(c.nickname)}</b> buys <b>${qty > 1 ? `${qty} × ` : ''}${esc(unit)}</b> from ${esc(seller)} for <b>${t.toLocaleString()} Poké</b>.</p></div>
      <p class="small">${esc(c.nickname)}: ${num(c.poke).toLocaleString()} → <b>${(num(c.poke) - t).toLocaleString()} Poké</b></p>
      <div class="row" style="margin-top:10px"><button class="btn" id="bok">Yes, buy it</button><button class="btn alt" id="bback">Back</button></div>`);
    $('#bback', el).onclick = step1;
    $('#bok', el).onclick = () => {
      const now = who(); if (!now || num(now.poke) < t) { step1(); return; }
      closeModal(); onBuy(now, qty, t);
    };
  };
  step1();
}

// The Travelling Merchants: the Block Brothers, Aegislash quadruplets from one clutch (Slash, Slice, Sharp, Shank).
// One brother at a time sets up a little table wherever the guild is. Six slots, bought with the character's own Poké.
// Haggling: Slash never tolerates it (try 1 "fair", try 2 "absolutely not", try 3 = he and his troupe of 3 stand armed).
// Beat him in that fight: his caravan never returns and the team gets everything on his table.
// Lose: his prices go up 150% for good (no more sales) and he attacks at the very next haggle.
import * as store from './store.js?v=6ae3a08a';
import { $, $$, esc, num, uid, toast } from './util.js?v=6ae3a08a';
import { modal, closeModal } from './ui.js?v=6ae3a08a';
import { ixLink } from './effects.js?v=6ae3a08a';
import { guildSay, gmTodo } from './chatter.js?v=6ae3a08a';
import { buyDialog, logSale } from './shopkit.js?v=6ae3a08a';

export const BROTHERS = {
  Slash: { tell: 'Does not tolerate haggling.', lines: ['No. The price I listed is fair.', 'Absolutely not.', '*stands armed and guarded with his troupe of 3*'] },
  Slice: { tell: '', lines: [] },
  Sharp: { tell: '', lines: [] },
  Shank: { tell: '', lines: [] },
};
const ORDER = Object.keys(BROTHERS);
// Slash's first table, as she listed it (10-25); qty = how many come in that slot for the one price. GM can change them.
const START = [['Oran Berry', 30, 'tag'], ['Escape Orb', 150], ['Gravelerock', 40, '', 10], ['Cheri Berry', 50], ['Stick', 30, '', 10], ['Pecha Berry', 70]]
  .map(([name, price, sale, qty]) => ({ name, price, qty: qty || 1, sale: sale === 'tag' ? '' : sale || '', saleTag: sale === 'tag', sold: false }));
const qtyOf = (s) => Math.max(1, num(s.qty) || 1);
const label = (s) => (qtyOf(s) > 1 ? `${qtyOf(s)} ${/s$/.test(s.name) ? s.name : s.name + 's'}` : s.name);

const M = () => store.get('merchant') || {};
const who = () => M().brother || 'Slash';
const bro = (n = who()) => ({ ...BROTHERS[n], ...((M().bros || {})[n] || {}) });
const slots = () => { const s = M().slots; return Array.isArray(s) && s.length ? s : START; };
const meId = () => { try { return localStorage.getItem('dc.me.' + store.tableCode()) || ''; } catch { return ''; } };
const priceOf = (s) => { const b = bro(); return b.angry ? Math.ceil(num(s.price) * 1.5) : s.sale ? num(s.sale) : num(s.price); };

export function merchantHTML() {
  const m = M(); const b = bro(); const name = who(); const gm = store.gmUnlocked();
  const here = m.away ? null : name;
  const place = m.place || 'Woodland Base';
  return `<div class="section-title"><h2>🛒 Travelling Merchant</h2><span class="small muted">the Block Brothers</span></div>
  <div class="card merchant">
    <img class="art-wide" src="assets/merchant/caravan.jpg" alt="The Block Brothers’ caravan" loading="lazy">
    ${here ? `<div class="mc-head"><div><b class="pix">⚔️ ${esc(name)}</b> <span class="small">has set up a table at <b>${esc(place)}</b></span></div>
      ${b.angry ? '<span class="pill bad">Prices +150% · no sales</span>' : ''}</div>
      ${b.tell ? `<p class="small mc-tell">🛡️ ${esc(b.tell)}</p>` : ''}
      <div class="mc-table">${slots().map((s, i) => `<div class="mc-slot ${s.sold ? 'sold' : ''}">
        ${(s.sale || s.saleTag) && !b.angry && !s.sold ? '<span class="mc-sale">SALE</span>' : ''}
        <div class="mc-item">${qtyOf(s) > 1 ? `<span class="pix mc-qty">${qtyOf(s)}×</span> ` : ''}${ixLink(s.name)}</div>
        <div class="mc-tag">${s.sold ? 'SOLD' : `${s.sale && !b.angry ? `<s>${num(s.price)}</s> ` : ''}${priceOf(s)} Poké`}</div>
        ${s.sold ? '' : `<div class="row nowrap mc-btns"><button class="btn sm" data-mbuy="${i}">Buy</button><button class="btn alt sm" data-mhag="${i}">Haggle</button></div>`}</div>`).join('')}</div>`
      : `<p class="muted">No merchant has set up a table today.</p>`}
    ${gm ? `<details class="small gm-merch" style="margin-top:10px"><summary><b>GM: merchant controls</b></summary>
      <div class="row" style="margin-top:6px">${ORDER.map((n) => `<button class="btn ${n === name && here ? '' : 'alt'} sm" data-mbro="${n}" ${bro(n).gone ? 'disabled title="His caravan never returns"' : ''}>${bro(n).gone ? '🪦 ' : ''}${n}</button>`).join('')}<button class="btn alt sm" id="mnext">Rotate ➜</button><button class="btn alt sm" id="maway">${here ? 'Pack up the table' : 'Set up the table'}</button></div>
      <div class="row" style="margin-top:6px"><button class="btn alt sm" id="mplace">📍 Where: ${esc(place)}</button><button class="btn alt sm" id="medit">Edit table items</button><button class="btn alt sm" id="mtell">Edit ${esc(name)}</button></div>
      ${here ? `<p style="margin:8px 0 4px"><b>Haggle fight with ${esc(name)}:</b></p><div class="row"><button class="btn sm" id="mwin">🏆 Players won</button><button class="btn bad sm" id="mlose">💀 Players lost</button></div>` : ''}
      <p class="muted" style="margin:6px 0 0">Won: his caravan never returns and the team gets everything on his table. Lost: his prices go up 150% for good (no sales) and he attacks at the next haggle.</p></details>` : ''}
  </div>`;
}

export function bindMerchant(main) {
  $$('[data-mbuy]', main).forEach((b) => b.onclick = () => buy(+b.dataset.mbuy));
  $$('[data-mhag]', main).forEach((b) => b.onclick = () => haggle(+b.dataset.mhag));
  $$('[data-mbro]', main).forEach((b) => b.onclick = () => setBrother(b.dataset.mbro));
  const q = (id) => $(id, main);
  if (q('#mnext')) q('#mnext').onclick = () => { const live = ORDER.filter((n) => !bro(n).gone); const i = live.indexOf(who()); if (live.length) setBrother(live[(i + 1) % live.length]); };
  if (q('#maway')) q('#maway').onclick = () => store.set('merchant/away', !M().away);
  if (q('#mplace')) q('#mplace').onclick = () => { const p = prompt('Where is the table set up?', M().place || 'Woodland Base'); if (p && p.trim()) store.set('merchant/place', p.trim()); };
  if (q('#medit')) q('#medit').onclick = editTable;
  if (q('#mtell')) q('#mtell').onclick = editBrother;
  if (q('#mwin')) q('#mwin').onclick = won;
  if (q('#mlose')) q('#mlose').onclick = lost;
}

function setBrother(n) {
  if (bro(n).gone) return;
  store.update('merchant', (m) => ({ ...(m || {}), brother: n, away: false, haggles: null }));
  guildSay(n, 'do', `rolls the caravan into ${M().place || 'Woodland Base'} and sets up a little table, shield polished, prices posted.`);
}

const MERCH_THANKS = ['A fair trade. The shield remembers good customers.', '*taps his shield twice: a deal is a deal*', 'Spend wisely, traveller.', 'Hmph. You have a good eye.'];
function buy(i) {
  const s = slots()[i]; if (!s || s.sold) return;
  buyDialog({ item: s.name, unit: label(s), price: priceOf(s), max: 1, seller: who(), onBuy: (buyer, qty, price) => {
    store.update('party/' + buyer.id, (x) => ({ ...x, poke: num(x?.poke) - price }));
    toBag(s.name, buyer.id, qtyOf(s));
    store.set('merchant/slots', slots().map((x, j) => (j === i ? { ...x, sold: true } : x)));
    const text = `${buyer.nickname} bought ${label(s)} from ${who()} for ${price} Poké.`;
    store.pushLimited('log', { t: Date.now(), text });
    logSale('merchant', buyer, text, MERCH_THANKS[Math.floor(Math.random() * MERCH_THANKS.length)]);
    toast('Bought ' + label(s));
  } });
}
function toBag(name, owner, qty = 1) {
  const same = Object.entries(store.get('bag') || {}).find(([, b]) => b.name === name && b.owner === owner);
  if (same) store.set(`bag/${same[0]}/qty`, num(same[1].qty) + qty); else store.set('bag/' + uid(), { name, qty, owner });
}

// Each character's haggle tries count up with this brother until he rotates out.
function haggle(i) {
  const s = slots()[i]; const name = who(); const b = bro();
  const me = (store.get('party') || {})[meId()];
  if (!me) { toast('Pick your character first'); return; }
  const n = num((M().haggles || {})[me.id]) + 1;
  store.set(`merchant/haggles/${me.id}`, n);
  if (b.angry) return fight(name, me, `${name} remembers the last fight. He draws his blade the moment ${me.nickname} mentions a lower price!`);
  const lines = b.lines && b.lines.length ? b.lines : null;
  if (!lines) {
    modal(`<h2>Haggling with ${esc(name)}</h2><p>${esc(me.nickname)} asks for a better price on ${esc(s.name)}.</p><p class="small muted">${esc(name)} hasn’t had his haggling written yet. Your GM decides how he answers.</p>`);
    gmTodo(`${me.nickname} is haggling with ${name} over ${s.name} (try ${n})`);
    return;
  }
  if (n >= lines.length) return fight(name, me, lines[lines.length - 1].replace(/^\*|\*$/g, ''));
  const line = lines[n - 1];
  guildSay(name, 'say', line);
  modal(`<h2>Haggling with ${esc(name)}</h2><p>${esc(me.nickname)} asks for a better price on ${esc(s.name)}.</p><div class="win"><span class="who">${esc(name)}:</span> “${esc(line)}”</div><p class="small muted">Try ${n} of ${lines.length - 1}. Pushing again is a bad idea.</p>`);
}
function fight(name, me, text) {
  guildSay(name, 'do', text.replace(new RegExp('^' + name + '\\s*'), ''));
  gmTodo(`⚔️ BATTLE: ${name} and his troupe of 3 vs ${me.nickname} (haggling went too far)`);
  store.pushLimited('log', { t: Date.now(), text: `${name} and his troupe of 3 stand armed against ${me.nickname}!` });
  modal(`<h2>⚔️ ${esc(name)} stands armed!</h2><p>${esc(/^[a-z]/.test(text) ? `${name} ${text}` : text)}.</p><p>He and his troupe of 3 are ready to fight. Your GM has been told.</p>`);
}

function won() {
  const name = who();
  if (!confirm(`Players defeated ${name}? His caravan never returns, and the team gets everything on his table.`)) return;
  slots().filter((s) => !s.sold).forEach((s) => toBag(s.name, 'team', qtyOf(s)));
  store.update('merchant', (m) => ({ ...(m || {}), away: true, slots: null, haggles: null, bros: { ...((m || {}).bros || {}), [name]: { ...(((m || {}).bros || {})[name] || {}), gone: true } } }));
  store.pushLimited('log', { t: Date.now(), text: `The team defeated ${name}! His caravan will never return. Everything on his table went to the team bag.` });
  guildSay('Guildmaster Beautifly', 'say', `${name}’s caravan won’t be coming back. I hope that table was worth it.`);
}
function lost() {
  const name = who();
  if (!confirm(`Players lost to ${name}? His prices go up 150% for good (no more sales) and he attacks at the next haggle.`)) return;
  store.update('merchant', (m) => ({ ...(m || {}), haggles: null, bros: { ...((m || {}).bros || {}), [name]: { ...(((m || {}).bros || {})[name] || {}), angry: true } } }));
  store.pushLimited('log', { t: Date.now(), text: `${name} won the fight. His prices are up 150% for good, and he won’t tolerate another haggle.` });
}

function editTable() {
  const s = slots();
  const el = modal(`<h2>${esc(who())}’s table</h2><p class="small muted">Six slots. Qty = how many come for the one price. Sale price is optional (shown with a SALE tag). Tick “sold” to mark an empty slot.</p>
    ${s.map((x, i) => `<div class="grid g2 mc-edit"><input data-k="name" data-i="${i}" value="${esc(x.name)}" placeholder="Item"><div class="row nowrap"><input data-k="qty" data-i="${i}" type="number" min="1" value="${qtyOf(x)}" placeholder="Qty" title="How many" style="max-width:64px"><input data-k="price" data-i="${i}" type="number" value="${esc(x.price)}" placeholder="Price"><input data-k="sale" data-i="${i}" type="number" value="${esc(x.sale)}" placeholder="Sale"><label class="check"><input type="checkbox" data-k="sold" data-i="${i}" ${x.sold ? 'checked' : ''}> sold</label></div></div>`).join('')}
    <div class="row" style="margin-top:10px"><button class="btn" id="msave">Save table</button><button class="btn alt" id="mrestock">Restock (clear sold)</button></div>`);
  const read = () => s.map((x, i) => ({ name: $(`[data-k=name][data-i="${i}"]`, el).value.trim() || x.name, price: num($(`[data-k=price][data-i="${i}"]`, el).value), qty: Math.max(1, num($(`[data-k=qty][data-i="${i}"]`, el).value) || 1), sale: $(`[data-k=sale][data-i="${i}"]`, el).value === '' ? '' : num($(`[data-k=sale][data-i="${i}"]`, el).value), sold: $(`[data-k=sold][data-i="${i}"]`, el).checked, saleTag: !!x.saleTag && $(`[data-k=sale][data-i="${i}"]`, el).value === '' }));
  $('#msave', el).onclick = () => { store.set('merchant/slots', read()); closeModal(); toast('Table saved'); };
  $('#mrestock', el).onclick = () => { store.set('merchant/slots', read().map((x) => ({ ...x, sold: false }))); closeModal(); toast('Restocked'); };
}
function editBrother() {
  const name = who(); const b = bro();
  const el = modal(`<h2>${esc(name)}</h2>
    <label class="f">How to tell him apart<input id="btell" value="${esc(b.tell || '')}" placeholder="e.g. Does not tolerate haggling."></label>
    <label class="f">Haggle answers, one per line (the last line is when he and his troupe stand armed)<textarea id="blines" rows="4">${esc((b.lines || []).join('\n'))}</textarea></label>
    <label class="check"><input type="checkbox" id="bangry" ${b.angry ? 'checked' : ''}> Prices +150%, no sales (he won a fight)</label>
    <label class="check"><input type="checkbox" id="bgone" ${b.gone ? 'checked' : ''}> His caravan never returns (he lost a fight)</label>
    <button class="btn" id="bsave" style="margin-top:10px">Save</button>`);
  $('#bsave', el).onclick = () => {
    store.set(`merchant/bros/${name}`, { tell: $('#btell', el).value.trim(), lines: $('#blines', el).value.split('\n').map((x) => x.trim()).filter(Boolean), angry: $('#bangry', el).checked, gone: $('#bgone', el).checked });
    closeModal(); toast('Saved');
  };
}

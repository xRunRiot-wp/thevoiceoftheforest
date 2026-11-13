// her ask 11-07: a fast-food-counter style order screen in the GM's Loot section:
// type -> rarity -> item -> who gets it, plus a search bar that goes straight to any item.
import * as store from './store.js?v=6af66305';
import * as sheet from './sheetdata.js?v=6af66305';
import { $, $$, esc, num, uid, toast } from './util.js?v=6af66305';
import { portrait } from './ui.js?v=6af66305';
import { LOOT, ITEM_PAGES, GARMENTS } from './content.js?v=6af66305';

const RARITIES = ['Mundane', 'Common', 'Uncommon', 'Rare', 'Very Rare'];
const KINDS = [['Berry', '🫐'], ['Seed', '🌱'], ['Orb', '🔮'], ['Scarf', '🧣'], ['Ribbon', '🎀'], ['Band', '🥋'], ['Bow', '🎗️'], ['Food', '🍎'], ['Projectile', '🪨'], ['Held item', '💍'], ['Other', '📦']];
// lines in the source tables that are instructions for the GM, not an item you can hand over
const NOT_AN_ITEM = /GM rolls|GM.s choice|Roll again|\bpair\b|bundle|Masterwork|\(|\{|^One |^Two /i;
const kindOf = (name) => {
  if (/Berry$/.test(name)) return 'Berry';
  if (/Seed$/.test(name)) return 'Seed';
  if (/Orb$/.test(name)) return 'Orb';
  if (/Scarf/.test(name)) return 'Scarf';
  if (/Ribbon/.test(name)) return 'Ribbon';
  if (/Band$/.test(name)) return 'Band';
  if (/Bow$/.test(name)) return 'Bow';
  if (/Apple|Gummi/.test(name)) return 'Food';
  if (/Stick|Pebble|Thorn|Spike|Gravelerock|Fossil|Twig|Pouch/.test(name)) return 'Projectile';
  return '';
};

let catalog = null; let loading = null;
// the spreadsheet's shop list is the truth for rarity; the site's item pages and loot tables fill in what it doesn't list
function loadCatalog() {
  if (loading) return loading;
  loading = sheet.treasure().catch(() => []).then((rows) => {
    const seen = new Map();
    const add = (name, rarity, kind, price = '') => {
      const n = String(name || '').trim(); const r = RARITIES.slice().reverse().find((x) => String(rarity).toLowerCase().startsWith(x.toLowerCase()));
      if (!n || !r || NOT_AN_ITEM.test(n) || seen.has(n.toLowerCase())) return;
      seen.set(n.toLowerCase(), { name: n, rarity: r, kind: kindOf(n) || kind || 'Other', price });
    };
    rows.forEach((x) => add(x.name, x.rarity, x.kind, x.price));
    Object.entries(ITEM_PAGES).forEach(([r, list]) => list.forEach((n) => add(n, r)));
    for (const [table, kind] of [[LOOT.berry, 'Berry'], [LOOT.seed, 'Seed'], [LOOT.projectile, 'Projectile']]) {
      for (const [r, row] of Object.entries(table)) (row[1] || []).forEach(([, n]) => add(n, r, kind));
    }
    GARMENTS.forEach(([n, r]) => add(n, r, 'Held item'));
    catalog = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    return catalog;
  });
  return loading;
}

// the order in progress; kept here so it survives the GM page redrawing when someone else changes something
const O = { kind: '', rarity: '', item: null, qty: 1, q: '' };
const reset = () => Object.assign(O, { kind: '', rarity: '', item: null, qty: 1, q: '' });

const tile = (attrs, big, small = '') => `<button type="button" class="lq-tile" ${attrs}><b>${big}</b>${small ? `<small>${small}</small>` : ''}</button>`;
const rarityPill = (r) => `<span class="pill r-${esc(r.split(' ')[0])}">${esc(r)}</span>`;
const itemTile = (x) => tile(`data-lqitem="${esc(x.name)}"`, esc(x.name), `${rarityPill(x.rarity)}${x.price ? ` ${esc(x.price)}` : ''}`);
const people = () => Object.values(store.get('party') || {}).filter((c) => c && c.id && (!c.guest || c.guest.controller === 'player')).sort((a, b) => String(a.nickname).localeCompare(String(b.nickname)));

function ticket() {
  const parts = [O.kind, O.rarity, O.item?.name].filter(Boolean);
  if (!parts.length) return '';
  return `<div class="lq-ticket"><span class="grow">🧾 <b>Your order:</b> ${parts.map(esc).join(' · ')}</span><button type="button" class="btn alt sm" data-lqback>← Back</button><button type="button" class="btn alt sm" data-lqreset>Start over</button></div>`;
}

function step() {
  if (!catalog) return '<p class="small muted">Getting the menu ready…</p>';
  const q = O.q.trim().toLowerCase();
  if (q && !O.item) {
    const hits = catalog.filter((x) => x.name.toLowerCase().includes(q));
    return hits.length ? `<div class="lq-grid">${hits.slice(0, 40).map(itemTile).join('')}</div>${hits.length > 40 ? `<p class="small muted">Showing the first 40 of ${hits.length}. Type a little more to narrow it down.</p>` : ''}` : '<p class="small muted">Nothing on the menu by that name.</p>';
  }
  if (O.item) {
    return `<h4 class="lq-ask">Who's this for?</h4>
      <div class="row lq-qty"><span>How many?</span><button type="button" class="btn alt sm" data-lqqty="-1">−</button><b>${O.qty}</b><button type="button" class="btn alt sm" data-lqqty="1">+</button></div>
      <div class="lq-grid">${people().map((c) => `<button type="button" class="lq-tile who" data-lqgive="${esc(c.id)}">${portrait(c, 'sm')}<b>${esc(c.nickname)}</b><small>${esc(c.pokemon || '')}</small></button>`).join('')}${tile('data-lqgive="team"', '🎒 Team bag', 'Shared by everyone')}${tile('data-lqgive="vault:woodland"', '🌳 Woodland Base vault', 'Guild storage')}${tile('data-lqgive="vault:vanguard"', '🛡️ Vanguard vault', 'Guild storage')}</div>`;
  }
  if (!O.kind) {
    const have = new Set(catalog.map((x) => x.kind));
    return `<h4 class="lq-ask">What type of item?</h4><div class="lq-grid">${KINDS.filter(([k]) => have.has(k)).map(([k, ic]) => tile(`data-lqkind="${esc(k)}"`, `${ic} ${esc(k)}`, `${catalog.filter((x) => x.kind === k).length} on the menu`)).join('')}</div>`;
  }
  const ofKind = catalog.filter((x) => x.kind === O.kind);
  if (!O.rarity) {
    return `<h4 class="lq-ask">What rarity?</h4><div class="lq-grid">${RARITIES.filter((r) => ofKind.some((x) => x.rarity === r)).map((r) => tile(`data-lqrarity="${esc(r)}"`, rarityPill(r), `${ofKind.filter((x) => x.rarity === r).length} to pick from`)).join('')}</div>`;
  }
  return `<h4 class="lq-ask">Which one?</h4><div class="lq-grid">${ofKind.filter((x) => x.rarity === O.rarity).map(itemTile).join('')}</div>`;
}

export const lootMenuHTML = () => `<div class="lq" id="lootmenu"><h3>🍔 Quick Order</h3>
  <input id="lqsearch" type="search" placeholder="🔍 Search for any item…" autocomplete="off" aria-label="Search for any item" value="${esc(O.q)}">
  <div id="lqbody"></div></div>`;

function give(owner) {
  const { name } = O.item; const qty = O.qty;
  // her report 11-09: "sent an item from the loot page to the Woodland Base vault ... it didn't work": the menu only had players and
  // the Team bag (Team bag is not the vault). Now the guild vaults are destinations too, into the same storage the Vault page shows.
  if (owner.startsWith('vault:')) {
    const guild = owner.slice(6) === 'vanguard' ? 'vanguard' : 'woodland'; const gname = guild === 'vanguard' ? 'the Vanguard vault' : 'the Woodland Base vault';
    const st = store.get('storage') || {};
    const same = Object.entries(st).find(([, x]) => x && String(x.name).toLowerCase() === name.toLowerCase() && (x.guild === 'vanguard' ? 'vanguard' : 'woodland') === guild);
    if (same) store.set(`storage/${same[0]}/qty`, num(same[1].qty) + qty); else store.set('storage/' + uid(), { name, qty, owner: 'team', guild });
    const what = `${name}${qty > 1 ? ` ×${qty}` : ''}`;
    store.pushLimited('log', { t: Date.now(), text: `${what} went into ${gname}.` });
    toast(`${what} is in ${gname}!`); reset(); return;
  }
  const same = Object.entries(store.get('bag') || {}).find(([, b]) => b.owner === owner && String(b.name).toLowerCase() === name.toLowerCase());
  if (same) store.set(`bag/${same[0]}/qty`, num(same[1].qty) + qty); else store.set('bag/' + uid(), { name, qty, owner });
  const who = owner === 'team' ? 'the team' : (store.get('party') || {})[owner]?.nickname || 'someone';
  const what = `${name}${qty > 1 ? ` ×${qty}` : ''}`;
  store.pushLimited('log', { t: Date.now(), text: owner === 'team' ? `Found: ${what}` : `${who} received ${what}!` });
  toast(`${what} is on its way to ${who}!`);
  reset();
}

export function bindLootMenu(main) {
  const box = $('#lootmenu', main); if (!box) return;
  const body = $('#lqbody', box); const search = $('#lqsearch', box);
  const draw = () => {
    body.innerHTML = ticket() + step();
    $$('[data-lqkind]', body).forEach((b) => b.onclick = () => { O.kind = b.dataset.lqkind; draw(); });
    $$('[data-lqrarity]', body).forEach((b) => b.onclick = () => { O.rarity = b.dataset.lqrarity; draw(); });
    $$('[data-lqitem]', body).forEach((b) => b.onclick = () => { O.item = catalog.find((x) => x.name === b.dataset.lqitem) || null; O.qty = 1; draw(); });
    $$('[data-lqqty]', body).forEach((b) => b.onclick = () => { O.qty = Math.max(1, O.qty + num(b.dataset.lqqty)); draw(); });
    $$('[data-lqgive]', body).forEach((b) => b.onclick = () => { give(b.dataset.lqgive); search.value = ''; draw(); });
    const reb = $('[data-lqreset]', body); if (reb) reb.onclick = () => { reset(); search.value = ''; draw(); };
    const bk = $('[data-lqback]', body); if (bk) bk.onclick = () => { if (O.item) O.item = null; else if (O.rarity) O.rarity = ''; else O.kind = ''; draw(); };
  };
  search.oninput = () => { O.q = search.value; O.item = null; draw(); };
  draw();
  if (!catalog) loadCatalog().then(() => { if (box.isConnected) draw(); });
}

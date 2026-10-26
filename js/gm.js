// GM screen: run the session. Locked behind a GM passcode; GM-only data is encrypted with it.
import * as store from './store.js?v=6ade9caf';
import * as sheet from './sheetdata.js?v=6ade9caf';
import { ledger } from './vault.js?v=6ade9caf';
import { $, $$, esc, num, uid, clamp, die, roll, sum, pool, toast, download, timeAgo } from './util.js?v=6ade9caf';
import { portrait, bar, modal, closeModal, maxHp, diceFaces } from './ui.js?v=6ade9caf';
import { LOOT, DUNGEON_EVENTS, DUNGEON_TYPES, MISSION_GP, STATUSES } from './content.js?v=6ade9caf';
import { combatOrder, orderList, partyStrip, diceLog, logRoll, viewCharacter, addItem, statVal } from './play.js?v=6ade9caf';
import { missionCard, finishMission, MISSION_SCHEMA, shop, SHOP_SCHEMA } from './guild.js?v=6ade9caf';
import { merged, editContent } from './content-store.js?v=6ade9caf';
import { loadIndex, ixLink, INDEX_SCHEMA } from './effects.js?v=6ade9caf';
import { CONFIG } from './config.js?v=6ade9caf';

const PORTRAIT_LIST = ['beautifly', 'chatot', 'cleffa', 'ekans', 'gengar', 'groudon', 'kecleon', 'koffing', 'magnemite', 'medicham', 'mudkip', 'pikachu', 'riolu', 'skuntank', 'slakoth', 'sudowoodo', 'teddiursa', 'wigglytuff', 'wingull', 'zubat'];
const ENEMY_SCHEMA = ['name', 'species', 'rank', 'hp', 'def', 'sdef', 'Strength', 'Dexterity', 'Special', 'Insight', 'Alert', 'Brawl', 'Channel', 'Evasion', 'Clash', 'will'];
const direction = (s) => ([2, 3, 7].includes(s) ? 'North' : [4, 10, 11, 12].includes(s) ? 'South' : [5, 6].includes(s) ? 'East' : 'West');
const distance = () => { let d; do d = die(6); while (d >= 5); return d; };

export async function renderGM(main) {
  if (!store.gmUnlocked()) return lockScreen(main);
  const G = store.gmData() || {};
  const sess = store.get('session') || {};
  const combat = store.get('combat') || {};
  const order = combatOrder();
  const missions = store.get('missions') || {};
  const hidden = G.missions || {};
  const g = store.get('guild') || {};
  const V = store.get('vanguard') || {};

  main.innerHTML = `
  <div class="row" style="justify-content:space-between;margin-bottom:8px"><h1 style="margin:0">GM screen</h1><button class="btn alt sm" id="lock">Lock</button></div>
  <div class="filters">${['Battle', 'Party', 'Dungeon', 'Loot', 'Missions', 'Reveal', 'End session', 'Notes', 'Index', 'Edit content', 'Table'].map((s) => `<a class="chip" href="#gm-${s.replace(/\s/g, '')}" data-jump>${s}</a>`).join('')}</div>

  <div class="session">
    <div class="row" style="justify-content:space-between"><b>Session ${sess.n || 1}</b><span class="small">${missions[sess.mission] ? esc(missions[sess.mission].title) : 'no current mission'}</span></div>
    <div class="small">${sess.dungeon ? `${esc(sess.dungeon)} · floor ${sess.floor || 1}${sess.floors ? ' of ' + sess.floors : ''}` : 'Not in a dungeon'}</div>
    <div class="row" style="justify-content:space-between;margin-top:8px"><span class="small">${sess.live ? 'Game is <b>live</b>: players see the table as playing now.' : 'Game is <b>not live</b>: players see the table as closed.'}</span>
      <button class="btn ${sess.live ? 'alt' : ''} sm" id="golive">${sess.live ? 'End live game' : 'Go live'}</button></div>
  </div>

  <section id="gm-Battle" class="card">
    <div class="row" style="justify-content:space-between"><h2 style="margin:0">Battle</h2><span class="pill">${combat.active ? `Round ${combat.round || 1}` : 'not running'}</span></div>
    <div class="row" style="margin:10px 0">
      ${combat.active ? '<button class="btn" id="next">Next turn</button><button class="btn alt" id="eor">End-of-round effects</button><button class="btn bad sm" id="endb">End battle</button>' : '<button class="btn" id="startb">Start battle</button>'}
      <button class="btn alt sm" id="addparty">+ Party</button><button class="btn alt sm" id="addenemy">+ Enemy</button><button class="btn alt sm" id="rollinit">Roll initiative</button>
    </div>
    ${orderList(order, combat.turn || 0, true)}
    <details style="margin-top:10px"><summary class="pix" style="font-size:17px;cursor:pointer;min-height:40px">Enemy sheets (${Object.keys(G.enemies || {}).length}) — only you see these</summary>
      <div class="row" style="margin:8px 0"><button class="btn alt sm" id="newenemy">+ New enemy sheet</button></div>
      ${Object.entries(G.enemies || {}).map(([id, e]) => `<div class="row nowrap" style="padding:6px 0;border-bottom:1px dashed var(--cream3)">${portrait({ pokemon: e.species, nickname: e.name }, 'xs')}<div class="grow"><b class="pix">${esc(e.name)}</b> <span class="small muted">${esc(e.species || '')} · ${e.hp} HP · Def ${e.def ?? '–'}/${e.sdef ?? '–'}</span></div><button class="btn sm" data-fight="${id}">Fight</button><button class="btn alt sm" data-eedit="${id}">Edit</button></div>`).join('') || '<p class="muted small">No enemy sheets yet.</p>'}
    </details>
  </section>

  <section id="gm-Party" class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Party</h2><button class="btn alt sm" id="addguest">+ Guest</button></div>
    <div style="margin-top:8px">${partyStrip('')}</div>
    ${guests().length ? `<h4 style="margin-top:10px">${ixLink('Guest party member', 'Guests')}</h4>${guests().map((c) => `<div class="row nowrap" style="padding:6px 0;border-bottom:1px dashed var(--cream3)">${portrait(c, 'xs')}<div class="grow"><b class="pix">${esc(c.nickname)}</b> <span class="small muted">leaves ${esc({ mission: 'when the mission ends', floor: 'at the next floor', session: 'at session end', manual: 'when removed' }[c.guest.leaves] || '')} · ${c.guest.controller === 'player' ? 'player-controlled' : 'GM-controlled'}</span></div><button class="btn alt sm" data-gperm="${c.id}">Make permanent</button><button class="btn bad sm" data-gleave="${c.id}">Leaves</button></div>`).join('')}` : ''}
    <div class="row" style="margin-top:10px"><button class="btn alt" id="callrest">🌙 Call a rest</button></div>
    <p class="small muted">Tap a character to see the full sheet and edit it.</p></section>

  <section id="gm-Dungeon" class="card">
    <h2>Dungeon</h2>
    <div class="grid g2">
      <label class="f">Dungeon<input id="dname" list="dtypes" value="${esc(sess.dungeon || '')}" placeholder="e.g. Twilight Falls"></label><datalist id="dtypes">${DUNGEON_TYPES.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
      <label class="f">Floors<input id="dfloors" type="number" inputmode="numeric" value="${sess.floors || ''}"></label>
    </div>
    <div class="row" style="margin-top:8px"><span class="pix" style="font-size:20px">Floor ${sess.floor || 1}</span><button class="btn alt sm" id="fdown">−</button><button class="btn alt sm" id="fup">Next floor</button><button class="btn alt sm" id="dleave">Leave dungeon</button></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="event">Roll event (every 2 tiles)</button><button class="btn alt" id="trap">Random trap</button><button class="btn alt" id="wind">+1 turn on floor (${G.windTurns || 0})</button></div>
    <div id="evres" class="result">${G.lastEvent ? `${G.lastEvent.html}${G.lastEvent.say ? '<button class="btn alt sm" id="evrev">Tell the players</button>' : ''}` : ''}</div>
    <p class="small muted">Enemy-team threat counter: ${G.threat || 0}/6 · ${ixLink('Dungeon event roll', 'Event table')} · ${ixLink('Floor time limit (wind)', 'Wind rule')} · ${ixLink('Hunger')}: ${sess.hunger || 0} <button class="btn alt sm" id="hunger">+1</button></p>
    ${(G.dlog || []).length ? `<ul class="log small">${G.dlog.slice(-12).reverse().map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
  </section>

  <section id="gm-Loot" class="card">
    <h2>Loot</h2>
    <p class="small muted">The GM Loot Rolling Guide: sites → category → floor → rarity → exact item → guard.</p>
    <div class="grid g2">
      <label class="f">Dungeon length<select id="llen">${LOOT.lengths.map((l, i) => `<option value="${i}">${l.name} (${l.floors} floors)</option>`).join('')}</select></label>
      <label class="f">Floors<input id="lfloors" type="number" inputmode="numeric" value="${sess.floors || 10}"></label>
      <label class="check"><input type="checkbox" id="lvault" checked> Last floor is a boss / vault (+2)</label>
      <label class="check"><input type="checkbox" id="lkind"> Beginner-friendly (no Doom/Hunger/Vile)</label>
    </div>
    <div class="row" style="margin-top:8px"><button class="btn" id="genloot">Roll the dungeon's loot</button><button class="btn alt" id="onesite">Roll one treasure</button></div>
    <div id="lootres">${lootTable(G.loot || [])}</div>
  </section>

  <section id="gm-Missions" class="card">
    <div class="row" style="justify-content:space-between"><h2 style="margin:0">Missions</h2><button class="btn sm" id="newm">+ Mission</button></div>
    <p class="small muted">Hidden missions are only on your screen until you reveal them.</p>
    ${Object.entries(hidden).map(([id, m]) => missionCard(id, { ...m, hidden: true }, { gm: true })).join('')}
    ${Object.entries(missions).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0)).map(([id, m]) => missionCard(id, m, { gm: true })).join('') || ''}
  </section>

  <section id="gm-Reveal" class="card">
    <h2>Reveal to players</h2>
    <p class="small muted">Shows up on everyone's Play screen as a game text box.</p>
    <div class="grid g2"><label class="f">Who's speaking<input id="rvwho" placeholder="e.g. Guildmaster Beautifly"></label>
    <label class="f">Portrait<select id="rvpor"><option value="">none</option>${PORTRAIT_LIST.map((p) => `<option>${p}</option>`).join('')}</select></label></div>
    <label class="f" style="margin-top:8px">Text<textarea id="rvtext" rows="3"></textarea></label>
    <div class="row" style="margin-top:8px"><button class="btn" id="reveal">Reveal</button><button class="btn alt sm" id="clearrev">Clear</button></div>
  </section>

  <section id="gm-Endsession" class="card">
    <h2>End of session</h2>
    <div class="grid g2">
      <label class="f">Which guild played<select id="eguild"><option value="guild">Woodland Base</option><option value="vanguard">Vanguard Guild</option></select></label>
      <label class="f">Guild Points earned<input id="egp" type="number" inputmode="numeric" value="0"></label>
      <label class="f">Poké to guild coffers<input id="epoke" type="number" inputmode="numeric" value="0"></label>
    </div>
    <h4 style="margin-top:10px">${ixLink('Training', 'Training Points')} per character</h4>
    <div class="grid g2">${Object.values(store.get('party') || {}).map((c) => `<label class="f">${esc(c.nickname)}<input data-tp="${c.id}" type="number" inputmode="numeric" value="0"></label>`).join('')}</div>
    <h4 style="margin-top:10px">Poké per character</h4>
    <div class="grid g2">${Object.values(store.get('party') || {}).map((c) => `<label class="f">${esc(c.nickname)} (has ${num(c.poke)})<input data-epk="${c.id}" type="number" inputmode="numeric" value="0"></label>`).join('')}</div>
    <label class="check"><input type="checkbox" id="erest" checked> Everyone rests: full HP and Will, statuses cleared</label>
    <label class="f">What happened (players see this in Session history)<textarea id="esum" rows="3"></textarea></label>
    <button class="btn block" id="endsess" style="margin-top:8px">Finish session ${sess.n || 1}</button>
  </section>

  <section id="gm-Notes" class="card"><h2>GM notes</h2><p class="small muted">Only you can read these (scrambled with your passcode).</p><textarea id="notes" rows="8">${esc(G.notes || '')}</textarea><button class="btn sm" id="savenotes" style="margin-top:8px">Save notes</button></section>

  <section id="gm-Index" class="card">
    <h2>Index</h2>
    <p class="small muted">Find any entry — built-in PokéRole and PMD ones too — open it and press Edit. Your version replaces it for everyone; "Undo my changes" puts the original back.</p>
    <div class="row nowrap"><input id="gix" class="grow" placeholder="Search the Index…" autocomplete="off"><button class="btn alt sm" id="gixnew">+ New</button></div>
    <div id="gixres"></div>
  </section>

  <section id="gm-Editcontent" class="card">
    <h2>Edit content</h2>
    <p class="small">While you're unlocked, every Rulebook page, chapter, character, rank, rival team and Index entry has an <b>Edit</b> button. Built-in text can always be put back with "Undo my changes".</p>
    <div class="row"><a class="btn alt sm" href="#/rules/index">Index entries</a><a class="btn alt sm" href="#/rules">Rule pages</a><a class="btn alt sm" href="#/rules/story">Chapters</a><a class="btn alt sm" href="#/rules/cast">Characters</a><a class="btn alt sm" href="#/rules/ranks">Ranks</a><a class="btn alt sm" href="#/rules/rivals">Rival teams</a></div>
    <h3 style="margin-top:14px">Woodland Base <span class="small muted">(Poké here = the coffers both guilds share)</span></h3>
    <div class="grid g2"><label class="f">Guild name<input id="gname" value="${esc(g.name || '')}"></label><label class="f">Team name<input id="gteam" value="${esc(g.team || '')}"></label>
      <label class="f">Guild Points<input id="ggp" type="number" inputmode="numeric" value="${g.gp || 0}"></label><label class="f">Poké<input id="gpoke" type="number" inputmode="numeric" value="${g.coffers || 0}"></label>
      <label class="f">Current chapter<input id="gch" type="number" inputmode="numeric" value="${g.chapter ?? ''}"></label>
      <label class="f">Withdrawal cap per session<input id="gcap" type="number" inputmode="numeric" value="${g.cap ?? 1000}"></label></div>
    <h3 style="margin-top:14px">Vanguard Guild</h3>
    <div class="grid g2"><label class="f">Guild Points<input id="vgp" type="number" inputmode="numeric" value="${V.gp || 0}"></label>
      <label class="f">Current chapter<input id="vch" type="number" inputmode="numeric" value="${V.chapter ?? ''}"></label>
      <label class="f">Withdrawal cap per session<input id="vcap" type="number" inputmode="numeric" value="${V.cap ?? 5000}"></label></div>
    <button class="btn sm" id="saveguild" style="margin-top:8px">Save guilds</button>
    <h3 style="margin-top:14px">Shop stock</h3>
    <ul class="log" style="max-height:none">${shop().map((s) => `<li class="row nowrap"><span class="grow">${esc(s.name)} — ${num(s.price)} P${s.stock !== '' && s.stock != null ? ` · ${s.stock} left` : ''}</span><button class="btn alt sm" data-shop="${esc(s.id)}">Edit</button></li>`).join('')}</ul>
    <button class="btn alt sm" id="addshop">+ Shop item</button>
    <h3 style="margin-top:14px">Moves</h3>
    <p class="small muted">Moves come from the campaign spreadsheet. Add a new move or change one here.</p>
    <div class="row nowrap"><input id="mvq" placeholder="Move name" list="mvlist" class="grow"><datalist id="mvlist"></datalist><button class="btn alt sm" id="mvedit">Edit / add</button></div>
  </section>

  <section id="gm-Table" class="card">
    <h2>Table</h2>
    <p>Table code <b class="pix" style="font-size:20px">${esc(store.tableCode())}</b> — players open the site and enter this code.</p>
    <p class="small">${store.status.mode === 'shared' ? `Live sharing is on (${store.status.connected ? 'connected' : 'connecting…'}).` : 'Live sharing between devices isn\'t switched on yet, so this table lives on this device. Use Export to save it or move it to another device.'}</p>
    <p class="small">Player link: <b>${esc(location.origin + location.pathname)}?t=${esc(store.tableCode())}</b></p>
    <div class="row"><button class="btn alt" id="newcode">Move to a private code</button><button class="btn alt" id="export">Export table</button><label class="btn alt">Import table<input type="file" id="import" accept=".json,application/json" hidden></label><button class="btn alt" id="resync">Reload party from spreadsheet</button></div>
    <p class="small muted" style="margin-top:10px">The GM passcode scrambles GM-only data (notes, enemy sheets, hidden missions, loot). Anyone who knows the passcode can open the GM screen — don't reuse a real password.</p>
  </section>

  <section class="card"><h2>Dice log</h2>${diceLog(20)}</section>`;

  bindGM(main);
}

function lootTable(rows) {
  if (!rows.length) return '';
  return `<div class="scroll-x" style="margin-top:10px"><table class="t"><tr><th>#</th><th>Kind</th><th>Floor</th><th>Rarity</th><th>Item</th><th>Guard</th><th></th></tr>${rows.map((r, i) => `<tr>
    <td>${i + 1}</td><td>${esc(r.cat)}</td><td>${r.floor}</td><td><span class="pill r-${esc(r.rarity.split(' ')[0])}">${esc(r.rarity)}</span><div class="small muted">${r.roll}</div></td><td>${esc(r.item)}</td><td class="small">${esc(r.guard)}</td>
    <td>${r.given ? '<span class="small">given</span>' : `<button class="btn sm" data-give="${i}">Give</button>`}</td></tr>`).join('')}</table></div>`;
}

function fillDice(text) {
  return text.replace(/\{([^}]+)\}/g, (_, expr) => {
    // {1d6x10} {100+1d4x25} {1000+1d6x250} {1d4} {1d3}
    const m = expr.match(/^(?:(\d+)\+)?(\d+)d(\d+)(?:x(\d+))?$/);
    if (!m) return expr;
    const base = num(m[1]); const r = sum(roll(num(m[2]), num(m[3])));
    return String(base + r * (m[4] ? num(m[4]) : 1));
  });
}

function pickFrom(table, kind, rarity) {
  const [d, rows, qty] = table[rarity];
  let item;
  if (!d) item = rows[0][1];
  else { const r = die(d); item = rows.find(([max]) => r <= max)[1]; }
  item = fillDice(item);
  if (qty) { let q = sum(roll(qty[0], qty[1])) + qty[2]; if (['Rare', 'Very Rare'].includes(rarity)) q = Math.min(q, sum(roll(qty[0], qty[1])) + qty[2]); item += ` ×${q}`; }
  return item;
}

export function rollLootSite(floors, vault, kindFriendly) {
  const cat = LOOT.category(die(12));
  let floor; const sides = floors <= 4 ? 4 : floors <= 6 ? 6 : floors <= 8 ? 8 : floors <= 10 ? 10 : floors <= 12 ? 12 : floors <= 20 ? 20 : 40;
  do floor = die(sides); while (floor > floors);
  const third = Math.ceil(floors / 3);
  let mod = floor <= third ? -1 : floor > floors - third ? 1 : 0;
  if (vault && floor === floors) mod = 2;
  const r2 = die(6) + die(6);
  let total = clamp(r2 + mod, 2, 12);
  if (mod === -1) total = Math.max(2, total);
  const rarity = LOOT.rarity(total);
  const table = { Projectile: LOOT.projectile, Berry: LOOT.berry, Seed: LOOT.seed, Treasure: LOOT.treasure }[cat];
  let item = pickFrom(table, cat, rarity);
  if (kindFriendly && /Doom|Hunger|Vile/.test(item)) item = pickFrom(table, cat, rarity);
  const [gmax, gtext] = LOOT.guard[rarity];
  const g = gmax === 6 ? gtext : gmax ? (die(6) <= gmax ? 'Guard or trap!' : 'No guard') : 'Unguarded';
  return { cat, floor, roll: `2d6 ${r2}${mod ? (mod > 0 ? ' +' : ' ') + mod : ''}`, rarity: rarity === 'Motherlode' ? 'Motherlode' : rarity, item, guard: g };
}

function addLog(G, line) { store.gmSet('dlog', [...(G.dlog || []), line].slice(-60)); }

function bindGM(main) {
  const G = store.gmData() || {};
  $$('[data-jump]', main).forEach((a) => a.onclick = (e) => { e.preventDefault(); document.getElementById(a.getAttribute('href').slice(1))?.scrollIntoView({ behavior: 'smooth' }); });
  $('#lock', main).onclick = () => { store.gmLock(); location.hash = '#/play'; };

  // ---- battle
  const combat = () => store.get('combat') || {};
  const s = (id) => $(id, main);
  if (s('#startb')) s('#startb').onclick = () => { store.set('combat/active', true); store.set('combat/round', 1); store.set('combat/turn', 0); store.pushLimited('log', { t: Date.now(), text: 'A battle begins!' }); };
  if (s('#endb')) s('#endb').onclick = () => { if (confirm('End the battle and clear the turn order?')) { store.set('combat', { active: false, round: 0, turn: 0, list: {} }); store.pushLimited('log', { t: Date.now(), text: 'The battle is over.' }); } };
  if (s('#next')) s('#next').onclick = () => {
    const order = combatOrder(); const c = combat();
    let t = (c.turn || 0) + 1; let r = c.round || 1;
    if (t >= order.length) { t = 0; r += 1; toast(`Round ${r}`); }
    store.set('combat/turn', t); store.set('combat/round', r);
  };
  if (s('#eor')) s('#eor').onclick = () => endOfRound();
  s('#addparty').onclick = () => {
    const list = combat().list || {}; const have = new Set(Object.values(list).map((x) => x.ref));
    for (const c of Object.values(store.get('party') || {})) if (!have.has(c.id)) store.set('combat/list/' + uid(), { name: c.nickname, kind: 'pc', ref: c.id, init: null });
  };
  s('#addenemy').onclick = () => quickEnemy();
  s('#rollinit').onclick = () => {
    const list = combat().list || {}; const party = store.get('party') || {};
    for (const [id, x] of Object.entries(list)) {
      if (x.init != null) continue;
      const src = x.ref ? party[x.ref] : x;
      const total = die(6) + statVal(src, 'Dexterity') + statVal(src, 'Alert');
      store.set(`combat/list/${id}/init`, total);
    }
    toast('Initiative rolled');
  };
  $$('[data-chp]', main).forEach((b) => b.onclick = () => changeHp(b.dataset.chp, num(b.dataset.d)));
  $$('[data-cmore]', main).forEach((b) => b.onclick = () => combatantSheet(b.dataset.cmore));
  $$('[data-viewchar]', main).forEach((b) => b.onclick = () => viewCharacter(b.dataset.viewchar));
  s('#newenemy').onclick = () => enemyEditor(null);
  $$('[data-eedit]', main).forEach((b) => b.onclick = () => enemyEditor(b.dataset.eedit));
  $$('[data-fight]', main).forEach((b) => b.onclick = () => {
    const e = (store.gmData().enemies || {})[b.dataset.fight];
    store.set('combat/list/' + uid(), { name: e.name, kind: 'enemy', hp: num(e.hp, 1), maxHp: num(e.hp, 1), def: e.def, sdef: e.sdef, Dexterity: e.Dexterity, Alert: e.Alert, init: null, status: [], revealed: false, enemy: b.dataset.fight });
    toast(`${e.name} joins the battle (hidden until you reveal it)`);
  });

  s('#addguest').onclick = () => addGuest();
  $$('[data-gperm]', main).forEach((b) => b.onclick = () => { store.set(`party/${b.dataset.gperm}/guest`, null); toast('They joined the team for good!'); });
  $$('[data-gleave]', main).forEach((b) => b.onclick = () => guestLeaves(b.dataset.gleave));

  // ---- dungeon
  const sess = store.get('session') || {};
  s('#dname').onchange = (e) => store.set('session/dungeon', e.target.value.trim());
  s('#dfloors').onchange = (e) => store.set('session/floors', num(e.target.value));
  s('#fup').onclick = () => { dropGuests('floor'); store.set('session/floor', (sess.floor || 1) + 1); store.gmSet('windTurns', 0); store.pushLimited('log', { t: Date.now(), text: `The team reaches floor ${(sess.floor || 1) + 1}.` }); };
  s('#fdown').onclick = () => store.set('session/floor', Math.max(1, (sess.floor || 1) - 1));
  s('#dleave').onclick = () => { store.set('session/dungeon', ''); store.set('session/floor', 0); store.set('session/hunger', 0); store.gmSet('threat', 0); };
  s('#hunger').onclick = () => store.set('session/hunger', (sess.hunger || 0) + 1);
  // mid-session rest: players are asked where they sleep (Friend Zone); healing is optional
  s('#callrest').onclick = () => {
    const el = modal(`<h2>🌙 Call a rest</h2><p>Every player gets asked where their character sleeps tonight.</p>
      <label class="check"><input type="checkbox" id="rheal"> Everyone recovers: full HP and Will, statuses cleared</label>
      <button class="btn block" id="rgo" style="margin-top:10px">Rest now</button>`);
    $('#rgo', el).onclick = () => {
      const heal = $('#rheal', el).checked;
      if (heal) Object.keys(store.get('party') || {}).forEach((id) => store.update('party/' + id, (c) => (c ? { ...c, hp: maxHp(c), willCur: c.will, status: [] } : c)));
      store.set('session/sleepAsk', Date.now());
      store.pushLimited('log', { t: Date.now(), text: `The team rests${heal ? ' and recovers fully' : ''}. Pick where you sleep on your character sheet.` });
      closeModal(); toast('Rest called');
    };
  };
  s('#wind').onclick = () => {
    const t = (G.windTurns || 0) + 1; store.gmSet('windTurns', t);
    const msg = { 10: 'Something’s stirring…', 20: 'It’s getting closer…', 30: 'It’s right nearby!', 40: 'It’s gusting hard!' }[t];
    if (msg) { store.pushLimited('reveal', { t: Date.now(), title: 'The wind', text: msg }); toast(msg); }
    if (t > 40) toast('Blown out of the dungeon!');
  };
  s('#event').onclick = async () => {
    const d = die(6); const [name, text] = DUNGEON_EVENTS[d];
    let extra = '';
    if (d === 3 || d === 6) { const s2 = die(6) + die(6); const dist = distance(); extra = `${d === 3 ? 'Treasure' : 'Clue'} is ${dist} tile${dist > 1 ? 's' : ''} to the ${direction(s2)} (2d6 = ${s2}).`; }
    if (d === 2) { const th = (G.threat || 0) + 1; store.gmSet('threat', th); extra = `Threat counter ${th}/6${th >= 6 ? ' — the enemy team\'s plan comes to a head!' : ''}`; }
    if (d === 1) { const ix = await loadIndex(); const traps = ix.list.filter((e) => e.kind === 'Trap' && !/^(Detect|Disarm|Avoid|Resist)/.test(e.name)); const t = traps[die(traps.length) - 1]; extra = `Trap: <a href="#" data-ix="${esc(t.id)}">${esc(t.name)}</a>`; }
    store.gmSet('lastEvent', { html: `${diceFaces([d], { pool: false })}<div class="big">${d} — ${esc(name)}</div><p class="small">${esc(text)}</p>${extra ? `<p>${extra}</p>` : ''}`, say: { title: name, text: `${text} ${extra.replace(/<[^>]+>/g, '')}`.trim() } });
    addLog(store.gmData(), `Floor ${sess.floor || 1}: ${name}. ${extra.replace(/<[^>]+>/g, '')}`);
  };
  s('#trap').onclick = async () => {
    const ix = await loadIndex(); const traps = ix.list.filter((e) => e.kind === 'Trap' && !/^(Detect|Disarm|Avoid|Resist)/.test(e.name));
    const t = traps[die(traps.length) - 1];
    store.gmSet('lastEvent', { html: `<div class="big"><a href="#" data-ix="${esc(t.id)}">${esc(t.name)}</a></div><p class="small">${esc(t.outcome)}</p><p class="small muted">${esc(t.roll || '')}</p>`, say: { title: 'Trap!', text: `${t.name}: ${t.outcome}` } });
  };

  if (s('#evrev')) s('#evrev').onclick = () => { store.pushLimited('reveal', { t: Date.now(), ...store.gmData().lastEvent.say }); toast('Shown to players'); };

  // ---- loot
  s('#genloot').onclick = () => {
    const L = LOOT.lengths[num(s('#llen').value)]; const floors = Math.max(1, num(s('#lfloors').value, 10));
    const sites = sum(roll(L.roll[0], L.roll[1])) + L.roll[2];
    const rows = Array.from({ length: sites }, () => rollLootSite(floors, s('#lvault').checked, s('#lkind').checked)).sort((a, b) => a.floor - b.floor);
    store.gmSet('loot', rows); toast(`${sites} loot sites`);
  };
  s('#onesite').onclick = () => { const floors = Math.max(1, num(s('#lfloors').value, 10)); store.gmSet('loot', [...(G.loot || []), rollLootSite(floors, s('#lvault').checked, s('#lkind').checked)]); };
  $$('[data-give]', main).forEach((b) => b.onclick = () => {
    const rows = structuredClone(G.loot || []); const r = rows[+b.dataset.give]; r.given = true;
    const poke = r.item.match(/^(\d+) Poké$/);
    if (poke) store.update('guild', (x) => ({ ...x, coffers: (x.coffers || 0) + num(poke[1]) }));
    else store.set('bag/' + uid(), { name: r.item, qty: 1, owner: 'team' });
    store.pushLimited('log', { t: Date.now(), text: `Found: ${r.item}` });
    store.gmSet('loot', rows);
  });

  // ---- missions
  s('#newm').onclick = () => missionEditor(null, true);
  $$('[data-med]', main).forEach((b) => b.onclick = () => { const st = (store.get('missions') || {})[b.dataset.med]?.status; if ((st === 'done' || st === 'failed') && !confirm('This mission is already ' + (st === 'done' ? 'completed' : 'failed') + '. Edit it anyway?')) return; missionEditor(b.dataset.med); });
  $$('[data-mreveal]', main).forEach((b) => b.onclick = () => {
    const id = b.dataset.mreveal; const m = (store.gmData().missions || {})[id];
    store.set('missions/' + id, { ...m, status: m.status || 'open', ts: Date.now() });
    store.gmUpdate('missions', (all) => { delete all[id]; return all; });
    store.pushLimited('log', { t: Date.now(), text: `New mission posted: ${m.title}` });
  });
  // finished missions (done or failed) ask before anything changes them
  const finished = (id) => { const st = (store.get('missions') || {})[id]?.status; return st === 'done' || st === 'failed' ? st : ''; };
  const okToChange = (id, what) => { const st = finished(id); return !st || confirm(`“${(store.get('missions') || {})[id]?.title}” is already ${st === 'done' ? 'completed' : 'failed'}. ${what}?`); };
  $$('[data-mdone]', main).forEach((b) => b.onclick = () => {
    const id = b.dataset.mdone; if (finished(id) === 'done') { toast('Already completed: no points changed'); return; }
    if (!okToChange(id, 'Change it to completed (its points switch over)')) return;
    finishMission(id, true); dropGuests('mission');
  });
  $$('[data-mfail]', main).forEach((b) => b.onclick = () => {
    const id = b.dataset.mfail; if (finished(id) === 'failed') { toast('Already failed: no points changed'); return; }
    if (!okToChange(id, 'Change it to failed (its points switch over)')) return;
    finishMission(id, false); dropGuests('mission');
  });
  $$('[data-mcur]', main).forEach((b) => b.onclick = () => { if (!okToChange(b.dataset.mcur, 'Make it the current mission anyway')) return; store.set('session/mission', b.dataset.mcur); toast('Current mission set'); });

  // ---- reveal
  s('#reveal').onclick = () => {
    const text = s('#rvtext').value.trim(); if (!text) return;
    store.pushLimited('reveal', { t: Date.now(), title: s('#rvwho').value.trim() || 'GM', text, portrait: s('#rvpor').value }, 30);
    s('#rvtext').value = ''; toast('Shown to players');
  };
  s('#clearrev').onclick = () => store.set('reveal', null);

  // ---- end session
  s('#endsess').onclick = () => {
    const gp = num(s('#egp').value); const poke = num(s('#epoke').value); const rest = s('#erest').checked;
    const sess2 = store.get('session') || {};
    const party = store.get('party') || {};
    const tpLines = [];
    $$('[data-tp]', main).forEach((i) => { const v = num(i.value); const c = party[i.dataset.tp]; if (!c) return; if (v) tpLines.push(`${c.nickname} +${v} TP`); });
    $$('[data-epk]', main).forEach((i) => { const v = num(i.value); const c = party[i.dataset.epk]; if (!c || !v) return; tpLines.push(`${c.nickname} +${v} Poké`); store.update('party/' + c.id, (x) => (x ? { ...x, poke: num(x.poke) + v } : x)); });
    store.update(s('#eguild').value, (x) => ({ ...x, gp: (x?.gp || 0) + gp }));
    store.update('guild', (x) => ({ ...x, coffers: (x?.coffers || 0) + poke }));   // shared coffers
    if (poke) ledger(s('#eguild').value === 'vanguard' ? 'vanguard' : 'woodland', `Session ${sess2.n || 1} reward`, poke);
    $$('[data-tp]', main).forEach((i) => store.update('party/' + i.dataset.tp, (c) => {
      if (!c) return c; c.tp = (c.tp || 0) + num(i.value);
      if (rest) { c.hp = maxHp(c); c.willCur = c.will; c.status = []; }
      return c;
    }));
    const rewards = [gp ? `+${gp} GP` : '', poke ? `+${poke} Poké` : '', ...tpLines].filter(Boolean).join(', ');
    store.pushLimited('history', { n: sess2.n || 1, t: Date.now(), summary: s('#esum').value.trim(), rewards }, 200);
    dropGuests('session'); dropGuests('mission'); dropGuests('floor');
    store.set('session', { ...sess2, n: (sess2.n || 1) + 1, dungeon: '', floor: 0, hunger: 0, sleepAsk: Date.now() });   // players pick where they sleep
    store.set('combat', { active: false, round: 0, turn: 0, list: {} });
    store.pushLimited('log', { t: Date.now(), text: `Session ${sess2.n || 1} finished. ${rewards}` });
    toast('Session saved');
  };

  // ---- notes, guild, shop, moves
  s('#savenotes').onclick = () => { store.gmSet('notes', s('#notes').value); toast('Notes saved'); };
  s('#saveguild').onclick = () => { store.update('guild', (x) => ({ ...x, name: s('#gname').value.trim(), team: s('#gteam').value.trim(), gp: num(s('#ggp').value), coffers: num(s('#gpoke').value), chapter: s('#gch').value === '' ? null : num(s('#gch').value), cap: num(s('#gcap').value) }));
    store.update('vanguard', (x) => ({ ...x, gp: num(s('#vgp').value), cap: num(s('#vcap').value), chapter: s('#vch').value === '' ? null : num(s('#vch').value) })); toast('Guilds saved'); };
  $$('[data-shop]', main).forEach((b) => b.onclick = () => editContent('shop', SHOP_SCHEMA, shop().find((x) => x.id === b.dataset.shop)));
  s('#addshop').onclick = () => editContent('shop', SHOP_SCHEMA, null, { title: 'New shop item' });
  sheet.moves().then((list) => { s('#mvlist').innerHTML = list.map((m) => `<option value="${esc(m.name)}">`).join(''); });
  s('#mvedit').onclick = async () => {
    const name = s('#mvq').value.trim(); if (!name) return;
    const list = merged('moves', await sheet.moves(), (m) => m.name.toLowerCase());
    const m = list.find((x) => x.name.toLowerCase() === name.toLowerCase());
    editContent('moves', [['name', 'Name'], ['type', 'Type'], ['cat', 'Category', 'select:Physical|Special|Status'], ['acc', 'Accuracy (e.g. Dexterity, Brawl)', 'list'], ['power', 'Power', 'number'], ['effect', 'Added effect', 'area']],
      m ? { ...m, id: m.name.toLowerCase() } : { name, cat: 'Physical', acc: ['Dexterity', 'Brawl'] }, { title: m ? 'Edit ' + m.name : 'New move' });
  };

  // ---- index panel
  s('#gixnew').onclick = () => editContent('index', INDEX_SCHEMA, null, { title: 'New Index entry' });
  s('#gix').oninput = async (e) => {
    const q = e.target.value.trim().toLowerCase(); const out = s('#gixres');
    if (q.length < 2) { out.innerHTML = ''; return; }
    const ix = await loadIndex();
    const hits = ix.list.filter((x) => x.name.toLowerCase().includes(q) || (x.aka || []).some((a) => a.toLowerCase().includes(q))).slice(0, 25);
    out.innerHTML = hits.map((x) => `<a class="ixrow" href="#" data-ix="${esc(x.id)}"><span class="pill k">${esc(x.kind)}${x.edited ? ' · edited' : ''}</span><b>${esc(x.name)}</b><p>${esc(x.outcome || '')}</p></a>`).join('') || '<p class="muted small">Nothing found.</p>';
  };

  s('#golive').onclick = () => {
    const on = !store.get('session/live');
    store.update('session', (x) => ({ ...(x || {}), live: on, liveSince: on ? Date.now() : null }));
    toast(on ? 'The game is live' : 'The game is no longer live');
  };

  // ---- table
  s('#newcode').onclick = async () => {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const nc = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => abc[b % abc.length]).join('');
    if (!confirm(`Move this table to the new code ${nc}? Players will need the new code (or the new player link). The GM passcode stays the same.`)) return;
    const saved = store.exportJSON(); const pass = (() => { try { return localStorage.getItem('dc.gmpass.' + store.tableCode()); } catch { return null; } })();
    const { openTable } = await import('./app.js?v=6ade9caf');
    try { if (pass) localStorage.setItem('dc.gmpass.' + nc, pass); } catch { /* ignore */ }
    await openTable(nc); store.importJSON(saved);
    toast('Table moved to ' + nc + (pass ? '' : ' — unlock the GM screen again'));
    location.href = location.pathname + '?t=' + nc + '#/gm';
  };
  s('#export').onclick = () => download(`table-${store.tableCode()}-${new Date().toISOString().slice(0, 10)}.json`, store.exportJSON());
  s('#import').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { store.importJSON(await f.text()); toast('Table loaded'); } catch (err) { toast(err.message); } };
  s('#resync').onclick = async () => {
    const g = await sheet.guild(); const party = store.get('party') || {};
    for (const c of g.chars) {
      const cur = Object.values(party).find((p) => p.nickname === c.nickname);
      const id = cur?.id || uid();
      store.set('party/' + id, { ...(cur || { hp: null, willCur: c.will, status: [], tp: 0 }), ...c, id, moves: c.moves });
    }
    toast('Party updated from the spreadsheet');
  };
}

const guests = () => Object.values(store.get('party') || {}).filter((c) => c.guest);

function guestLeaves(id) {
  const c = (store.get('party') || {})[id]; if (!c) return;
  store.set('party/' + id, null);
  const list = (store.get('combat') || {}).list || {};
  for (const [cid, x] of Object.entries(list)) if (x.ref === id) store.set('combat/list/' + cid, null);
  store.pushLimited('log', { t: Date.now(), text: `${c.nickname} leaves the team.` });
}
function dropGuests(when) { guests().filter((c) => c.guest.leaves === when).forEach((c) => guestLeaves(c.id)); }

function addGuest() {
  const enemies = Object.entries(store.gmData().enemies || {});
  const el = modal(`<h2>Add a guest</h2><p class="small">A temporary party member — an escort, a client, or an NPC helping out. ${ixLink('Guest party member', 'Guest rules')}</p>
    <label class="f">Start from<select id="gsrc"><option value="">Blank sheet</option>${enemies.map(([id, e]) => `<option value="${id}">Enemy sheet: ${esc(e.name)}</option>`).join('')}</select></label>
    <div class="grid g2" style="margin-top:8px"><label class="f">Name<input id="gname2"></label><label class="f">Pokémon<input id="gspec"></label>
    <label class="f">Leaves<select id="gleave2"><option value="mission">when the mission ends</option><option value="floor">at the next floor</option><option value="session">at the end of the session</option><option value="manual">when I remove them</option></select></label>
    <label class="f">Controlled by<select id="gctl2"><option value="gm">GM</option><option value="player">A player can pick them</option></select></label></div>
    <label class="check"><input type="checkbox" id="gfight" checked> Add to the battle if one is running</label>
    <button class="btn block" id="ok" style="margin-top:10px">Add guest</button>`);
  $('#gsrc', el).onchange = (e) => { const en = (store.gmData().enemies || {})[e.target.value]; if (en) { $('#gname2', el).value = en.name; $('#gspec', el).value = en.species || ''; } };
  $('#ok', el).onclick = () => {
    const en = (store.gmData().enemies || {})[$('#gsrc', el).value] || {};
    const id = uid();
    const c = { id, nickname: $('#gname2', el).value.trim() || en.name || 'Guest', pokemon: $('#gspec', el).value.trim() || en.species || '', rank: en.rank || 'Starter',
      baseHp: Math.max(1, num(en.hp, 5) - num(en.Vitality)), will: num(en.will, 2), willCur: num(en.will, 2), Strength: num(en.Strength, 1), Dexterity: num(en.Dexterity, 1), Vitality: num(en.def, 1), Special: num(en.Special, 1), Insight: num(en.sdef ?? en.Insight, 1),
      Alert: num(en.Alert), Brawl: num(en.Brawl), Channel: num(en.Channel), Evasion: num(en.Evasion), Clash: num(en.Clash), moves: String(en.moves || '').split('\n').map((s) => s.split(/[—-]/)[0].trim()).filter(Boolean),
      status: [], notes: en.notes || '', guest: { leaves: $('#gleave2', el).value, controller: $('#gctl2', el).value, since: Date.now() } };
    c.hp = maxHp(c);
    store.set('party/' + id, c);
    if ($('#gfight', el).checked && (store.get('combat') || {}).active) store.set('combat/list/' + uid(), { name: c.nickname, kind: 'pc', ref: id, init: null });
    store.pushLimited('log', { t: Date.now(), text: `${c.nickname} joins the team as a guest.` });
    closeModal();
  };
}

function changeHp(cid, d) {
  const x = (store.get('combat') || {}).list?.[cid]; if (!x) return;
  if (x.ref) store.update('party/' + x.ref, (c) => { c.hp = clamp((c.hp ?? maxHp(c)) + d, 0, maxHp(c)); return c; });
  else store.set(`combat/list/${cid}/hp`, clamp((x.hp || 0) + d, 0, x.maxHp || 99));
}

function endOfRound() {
  const list = (store.get('combat') || {}).list || {}; const party = store.get('party') || {};
  const lines = [];
  for (const [id, x] of Object.entries(list)) {
    const st = x.ref ? party[x.ref]?.status || [] : x.status || [];
    let dmg = 0;
    if (st.includes('Burn')) dmg += 1;
    if (st.includes('Poison')) dmg += 1;
    if (st.includes('Badly Poisoned')) dmg += 1;
    if (dmg) { changeHp(id, -dmg); lines.push(`${x.name} −${dmg}`); }
  }
  toast(lines.length ? lines.join(', ') : 'No end-of-round damage');
  if (lines.length) store.pushLimited('log', { t: Date.now(), text: 'End of round: ' + lines.join(', ') });
}

function combatantSheet(cid) {
  const x = (store.get('combat') || {}).list?.[cid]; if (!x) return;
  const party = store.get('party') || {};
  const st = x.ref ? party[x.ref]?.status || [] : x.status || [];
  const e = x.enemy ? (store.gmData().enemies || {})[x.enemy] : null;
  const el = modal(`<h2>${esc(x.name)}</h2>
    <div class="grid g2"><label class="f">Initiative<input id="ci" type="number" inputmode="numeric" value="${x.init ?? ''}"></label>
    ${x.ref ? '' : `<label class="f">HP<input id="ch" type="number" inputmode="numeric" value="${x.hp}"></label><label class="f">Max HP<input id="cm" type="number" inputmode="numeric" value="${x.maxHp}"></label>`}</div>
    ${x.kind === 'enemy' ? `<label class="check"><input type="checkbox" id="crev" ${x.revealed ? 'checked' : ''}> Players can see this enemy</label>` : ''}
    <h4>Status</h4><div class="chips">${STATUSES.map((s) => `<button class="chip ${st.includes(s) ? 'on' : ''}" data-st="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    ${e ? `<h4 style="margin-top:10px">Sheet</h4><p class="small">Def ${e.def ?? '–'} · Sp.Def ${e.sdef ?? '–'} · Str ${e.Strength ?? '–'} · Dex ${e.Dexterity ?? '–'} · Spe ${e.Special ?? '–'} · Ins ${e.Insight ?? '–'}</p>${e.moves ? `<p class="small" style="white-space:pre-wrap">${esc(e.moves)}</p>` : ''}${e.notes ? `<p class="small muted" style="white-space:pre-wrap">${esc(e.notes)}</p>` : ''}` : ''}
    ${x.kind === 'enemy' ? `<h4 style="margin-top:10px">Roll for it</h4><div class="row nowrap"><input id="cpool" type="number" inputmode="numeric" value="4" style="width:90px" aria-label="Dice"><button class="btn" id="croll">Roll pool</button><label class="check"><input type="checkbox" id="cshow"> show players</label></div><div class="result" id="cres"></div>` : ''}
    <div class="row" style="margin-top:12px"><button class="btn" id="csave">Save</button><button class="btn bad" id="crem">Remove</button></div>`);
  $$('[data-st]', el).forEach((b) => b.onclick = () => b.classList.toggle('on'));
  const cr = $('#croll', el);
  if (cr) cr.onclick = () => {
    const r = pool(clamp(num($('#cpool', el).value, 1), 1, 30)); const t = `${r.succ} success${r.succ === 1 ? '' : 'es'}`;
    $('#cres', el).innerHTML = `${diceFaces(r.dice)}<div class="big">${t}</div>`;
    if ($('#cshow', el).checked) logRoll(x.name, `${r.dice.length}-dice pool`, r.dice, t);
  };
  $('#csave', el).onclick = () => {
    const status = $$('[data-st].on', el).map((b) => b.dataset.st);
    const init = $('#ci', el).value === '' ? null : num($('#ci', el).value);
    store.set(`combat/list/${cid}/init`, init);
    if (x.ref) store.set(`party/${x.ref}/status`, status);
    else { store.set(`combat/list/${cid}/status`, status); store.set(`combat/list/${cid}/hp`, num($('#ch', el).value)); store.set(`combat/list/${cid}/maxHp`, num($('#cm', el).value, 1)); }
    if ($('#crev', el)) store.set(`combat/list/${cid}/revealed`, $('#crev', el).checked);
    closeModal();
  };
  $('#crem', el).onclick = () => { store.set('combat/list/' + cid, null); closeModal(); };
}

function quickEnemy() {
  const el = modal(`<h2>Add an enemy</h2>
    <div class="grid g2"><label class="f">Name<input id="qn" placeholder="e.g. Wild Zubat"></label><label class="f">HP<input id="qh" type="number" inputmode="numeric" value="5"></label>
    <label class="f">Defense<input id="qd" type="number" inputmode="numeric" value="1"></label><label class="f">Sp. Defense<input id="qs" type="number" inputmode="numeric" value="1"></label>
    <label class="f">Dexterity<input id="qx" type="number" inputmode="numeric" value="2"></label><label class="f">Alert<input id="qa" type="number" inputmode="numeric" value="1"></label>
    <label class="f">How many<input id="qc" type="number" inputmode="numeric" value="1"></label></div>
    <label class="check"><input type="checkbox" id="qr"> Players can see it straight away</label>
    <button class="btn block" id="ok" style="margin-top:10px">Add</button>`);
  $('#ok', el).onclick = () => {
    const n = clamp(num($('#qc', el).value, 1), 1, 12); const nm = $('#qn', el).value.trim() || 'Enemy';
    for (let i = 0; i < n; i++) store.set('combat/list/' + uid(), { name: n > 1 ? `${nm} ${String.fromCharCode(65 + i)}` : nm, kind: 'enemy', hp: num($('#qh', el).value, 1), maxHp: num($('#qh', el).value, 1), def: num($('#qd', el).value), sdef: num($('#qs', el).value), Dexterity: num($('#qx', el).value), Alert: num($('#qa', el).value), init: null, status: [], revealed: $('#qr', el).checked });
    closeModal();
  };
}

function enemyEditor(id) {
  const e = id ? (store.gmData().enemies || {})[id] : { name: '', hp: 5, def: 1, sdef: 1 };
  const el = modal(`<h2>${id ? 'Edit ' + esc(e.name) : 'New enemy sheet'}</h2>
    <div class="grid" style="grid-template-columns:repeat(2,1fr)">${ENEMY_SCHEMA.map((k) => `<label class="f">${k === 'hp' ? 'HP' : k === 'def' ? 'Defense' : k === 'sdef' ? 'Sp. Defense' : k[0].toUpperCase() + k.slice(1)}<input data-k="${k}" ${['name', 'species', 'rank'].includes(k) ? '' : 'type="number" inputmode="numeric"'} value="${esc(e[k] ?? '')}"></label>`).join('')}</div>
    <label class="f" style="margin-top:8px">Moves (e.g. "Bite — Str + Brawl, Power 2, Flinch 1 chance die")<textarea data-k="moves">${esc(e.moves || '')}</textarea></label>
    <label class="f">Notes<textarea data-k="notes">${esc(e.notes || '')}</textarea></label>
    <div class="row" style="margin-top:10px"><button class="btn" id="ok">Save</button>${id ? '<button class="btn alt" id="dup">Duplicate</button><button class="btn bad" id="del">Delete</button>' : ''}</div>`);
  const read = () => { const o = {}; $$('[data-k]', el).forEach((f) => { o[f.dataset.k] = f.type === 'number' ? (f.value === '' ? null : num(f.value)) : f.value.trim(); }); return o; };
  $('#ok', el).onclick = () => { const o = read(); store.gmUpdate('enemies', (all) => ({ ...(all || {}), [id || uid()]: o })); closeModal(); };
  if (id) {
    $('#dup', el).onclick = () => { const o = read(); o.name += ' (copy)'; store.gmUpdate('enemies', (all) => ({ ...(all || {}), [uid()]: o })); closeModal(); };
    $('#del', el).onclick = () => { if (confirm('Delete this enemy sheet?')) { store.gmUpdate('enemies', (all) => { delete all[id]; return all; }); closeModal(); } };
  }
}

function missionEditor(id, hiddenNew = false) {
  const pub = (store.get('missions') || {})[id];
  const hid = (store.gmData().missions || {})[id];
  const m = pub || hid || { rank: 'E', status: 'open' };
  const el = modal(`<h2>${id ? 'Edit mission' : 'New mission'}</h2>
    <div class="stack">${MISSION_SCHEMA.map(([k, label, kind = 'text']) => kind.startsWith('select:') ? `<label class="f">${label}<select data-k="${k}">${kind.slice(7).split('|').map((o) => `<option ${o === m[k] ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`
      : kind === 'area' ? `<label class="f">${label}<textarea data-k="${k}">${esc(m[k] || '')}</textarea></label>` : `<label class="f">${label}<input data-k="${k}" ${kind === 'number' ? 'type="number" inputmode="numeric"' : ''} value="${esc(m[k] ?? '')}"></label>`).join('')}</div>
    ${!id ? '<label class="check"><input type="checkbox" id="hid" checked> Keep it hidden until I reveal it</label>' : ''}
    <div class="row" style="margin-top:10px"><button class="btn" id="ok">Save</button>${id ? '<button class="btn bad" id="del">Delete</button>' : ''}</div>
    <p class="small muted">Mission ideas by rank are on the <a href="#/rules/ranks">Guild ranks</a> page.</p>`);
  $('#ok', el).onclick = () => {
    const o = { ...m }; $$('[data-k]', el).forEach((f) => { o[f.dataset.k] = f.type === 'number' ? (f.value === '' ? null : num(f.value)) : f.value.trim(); });
    if (!o.title) { toast('Give it a title'); return; }
    const nid = id || uid(); o.ts = o.ts || Date.now();
    const hidden = id ? !!hid : $('#hid', el).checked;
    if (hidden) store.gmUpdate('missions', (all) => ({ ...(all || {}), [nid]: o })); else store.set('missions/' + nid, o);
    closeModal();
  };
  if (id) $('#del', el).onclick = () => { if (!confirm('Delete this mission?')) return; if (hid) store.gmUpdate('missions', (all) => { delete all[id]; return all; }); else store.set('missions/' + id, null); closeModal(); };
}

function lockScreen(main) {
  const exists = store.gmExists();
  main.innerHTML = `
  <div class="hero"><img class="hdr" src="assets/gs/ch1_scene.jpg" alt=""></div>
  <div class="card" style="max-width:520px">
    <h1>${exists ? 'GM screen' : 'Become the GM'}</h1>
    <p>${exists ? 'Enter the GM passcode for table ' + esc(store.tableCode()) + '.' : 'Pick a GM passcode for table ' + esc(store.tableCode()) + '. Your notes, enemy sheets, hidden missions and loot are scrambled with it, so players never see them.'}</p>
    <label class="f">GM passcode<input id="pass" type="password" autocomplete="off"></label>
    <label class="check"><input type="checkbox" id="rem" checked> Remember on this device</label>
    <button class="btn block" id="go" style="margin-top:8px">${exists ? 'Unlock' : 'Set passcode'}</button>
    <p class="small muted" style="margin-top:10px">Not a bank vault — just don't reuse a real password here.</p>
  </div>`;
  const go = async () => {
    const p = $('#pass', main).value; if (p.length < 3) { toast('At least 3 characters'); return; }
    try { await store.gmUnlock(p, $('#rem', main).checked); renderGM(main); } catch (e) { toast(e.message); }
  };
  $('#go', main).onclick = go;
  $('#pass', main).onkeydown = (e) => { if (e.key === 'Enter') go(); };
}

export { CONFIG };

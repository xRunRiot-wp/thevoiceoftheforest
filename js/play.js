// Join a table, then the player's Play screen.
import * as store from './store.js?v=6ae15448';
import * as sheet from './sheetdata.js?v=6ae15448';
import { $, $$, esc, uid, num, clamp, pool, painFor, roll, die, sum, timeAgo, toast } from './util.js?v=6ae15448';
import { portrait, typeChip, bar, diceFaces, modal, closeModal, maxHp } from './ui.js?v=6ae15448';
import { STATUS_IX, INTRO, QUICK_LINKS, ACTIONS, QUICK_TASKS, QUICK_SOCIAL, SPECIAL_ROLLS, STATUSES, ATTRS, SKILLS, SOCIAL, TYPES, NATURES, RANK_NAMES, RULES } from './content.js?v=6ae15448';
import { myId, setMe, joined, setJoined, openTable } from './app.js?v=6ae15448';
import { unlockChar } from './charlock.js?v=6ae15448';
import { CONFIG } from './config.js?v=6ae15448';
import { ixLink, wireRolls, linkify, loadIndex } from './effects.js?v=6ae15448';
import { merged, editContent } from './content-store.js?v=6ae15448';
import { ledger, stash, canWithdraw, recordWithdrawal, checkCoffers, capInfo, lowAlertHTML } from './vault.js?v=6ae15448';
import { guildName, missionParts, rankFor, guildPath } from './guild.js?v=6ae15448';
import { homeHTML } from './sitepages.js?v=6ae15448';
import { burstSet } from './burst.js?v=6ae15448';
import { pinsOf, showMap } from './hotbar.js?v=6ae15448';
import { chatterLatestHTML } from './chatter.js?v=6ae15448';
import { memoryHTML, memoryFeedHTML, bindMemory, zeroHpHTML, bindZeroHp, restDream, addMemory, makeMemory } from './memory.js?v=6ae15448';
import { locations, spots, spotFull, spotSleepers } from './friendzone.js?v=6ae15448';
import { currentWeather, weatherFor, showWeather, WEATHERS, wxFxHTML, wxIconHTML } from './weather.js?v=6ae15448';
import { TYPE_COLORS, TYPE_ICONS, palette, sheetOnly } from './theme.js?v=6ae15448';
import { find } from './effects.js?v=6ae15448';
import * as dice3d from './dice3d.js?v=6ae15448';

export async function allMoves() {
  const [s, ix] = await Promise.all([sheet.moves(), loadIndex()]);
  const have = new Set(s.map((m) => m.name.toLowerCase()));
  const extra = ix.list.filter((e) => e.kind === 'Move' && e.mv && !have.has(e.name.toLowerCase())).map((e) => ({ name: e.name, ...e.mv }));
  return merged('moves', [...s, ...extra], (m) => m.name.toLowerCase());
}

const party = () => store.get('party') || {};
export const me = () => party()[myId()] || null;

// ---------------------------------------------------------------- join
// Mess hall seating: each character's speech bubble is their own line or the last thing they did, whichever is newer.
// (Player characters never get words put in their mouths: no line and nothing done yet = just resting.)
function lastWord(c) {
  const name = String(c.nickname || '');
  const did = [];
  const roll = Object.values(store.get('rolls') || {}).filter((r) => r.by === name).sort((a, b) => b.t - a.t)[0];
  if (roll) {
    const label = String(roll.label || '').replace(/\s*\(.*\)\s*$/, '');
    did.push({ t: roll.t, text: roll.kind === 'note' ? (label.includes(' — ') ? 'played ' + label.split(' — ')[0] : label) : 'rolled ' + label });
  }
  const log = Object.values(store.get('log') || {}).filter((l) => String(l.text || '').startsWith(name + ' ')).sort((a, b) => b.t - a.t)[0];
  if (log) did.push({ t: log.t, text: log.text.slice(name.length + 1).replace(/\.$/, '') });
  const act = did.sort((a, b) => b.t - a.t)[0];
  if (c.line && (!act || num(c.lineT) >= act.t)) return `<span class="mh-say">“${esc(c.line)}”</span>`;
  if (act) return `<span class="mh-did">${esc(act.text)}</span><small>${esc(timeAgo(act.t))}</small>`;
  return '<span class="mh-did">resting after a long day</span>';
}

// seats on the benches of her "Mess Hall - Empty" picture: [left %, top % of the seat's base]
const MESS_SPOTS = [[14, 47], [38, 47], [62, 47], [86, 47], [14, 85], [38, 85], [62, 85], [86, 85]];   // two rows of benches, spaced so no bubble hides behind a neighbour
function messSeatsHTML(p) {
  const seat = (c, i) => { const at = MESS_SPOTS[i]; return `<button class="mh-seat${at ? '' : ' extra'}" data-pick="${c.id}" ${at ? `style="--x:${at[0]}%;--y:${at[1]}%"` : ''}><span class="mh-bubble">${lastWord(c)}</span>
      ${portrait(c, 'sm')}<span class="mh-plate"><b>${esc(c.nickname)}</b><small>${esc(c.pokemon)}${c.rank ? ' · ' + esc(c.rank) : ''}</small></span></button>`; };
  return `<div class="mh-pick">
    <div class="mh-pick-head"><h2>Who are you playing?</h2><p>Supper's on after a long day. Pick your seat.</p></div>
    <div class="mh-scene"><img src="assets/banners/messhall.jpg" alt="The guild mess hall"><div class="mh-spots">${p.slice(0, MESS_SPOTS.length).map(seat).join('') || '<p class="mh-empty">The hall is empty. Pull up a chair!</p>'}</div></div>
    ${p.length > MESS_SPOTS.length ? `<div class="mh-more">${p.slice(MESS_SPOTS.length).map((c, i) => seat(c, MESS_SPOTS.length + i)).join('')}</div>` : ''}
    <div class="mh-door"><button class="mh-chair" id="newchar"><span class="mh-ic mh-ic-chair">🪑</span> Pull up a chair<small>New character</small></button><button class="mh-chair" id="watch"><span class="mh-ic mh-ic-eyes">👀</span> Just watching<small>See the table without a character</small></button></div>
    <p class="mh-table-note">Table ${esc(store.tableCode())} · change it with the <b>Table</b> box at the top</p>
  </div>`;
}

export function renderJoin(main) {
  const p = Object.values(party()).filter((c) => !c.guest || c.guest.controller === 'player');
  main.innerHTML = `
  <div class="hero banner"><img class="hdr" src="assets/banners/home.jpg" alt="Voice of the Forest: A PokeRole Mystery Dungeon Campaign"></div>
  ${chatterLatestHTML(3, `<div class="win"><span class="who">Guildmaster Beautifly:</span> ${store.get('session/live') ? "Welcome, explorer! The game is live. Join your table to begin today's adventure." : 'Welcome, explorer! No game is running right now. Look around, and come back when your GM goes live.'}</div>`)}
  ${store.status.mode === 'local' ? `<p class="small muted" style="margin-top:8px">Live sharing between phones isn't switched on yet, so this table saves on this device. Your GM can move it with Export / Import.</p>` : ''}
  ${joined() && me() ? `<a class="btn block continue-btn" href="#/play" style="margin-top:12px">Continue as ${esc(me().nickname)}</a>` : ''}
  ${messSeatsHTML(p)}
  <div class="row" style="margin-top:14px"><a class="btn dark" href="#/gm">I'm the GM</a></div>
  <div class="section-title"><h2>${esc(INTRO.title)}</h2></div>
  <div class="card site-page">${homeHTML()}
    <div class="toc" style="margin-top:12px"><a href="#/rules/site/meet-the-characters">Meet the Characters!</a><a href="#/rules/site/how-to-play">How To Play</a><a href="#/rules/site/story-guild-rank-progression">Story & Guild Rank Progression</a><a href="#/rules/site/guilds">Guilds</a><a href="#/rules/site/items">Items</a><a href="#/rules/site/how-to-play_new-character">New Character</a></div></div>
  <details class="card" style="margin-top:14px"><summary><b>Watch the player trailer</b></summary><video src="assets/discord/player_trailer.mp4" controls playsinline preload="none" style="width:100%;border-radius:10px;margin-top:8px"></video></details>
  <div class="home-tiles"><div class="navtile home-chars"><a class="navtile-head" href="#/rules/site/meet-the-characters"><img src="assets/gs/home_team_hd.webp" alt="" loading="lazy"><span>Meet the Characters!</span></a></div>
    <div class="navtile home-story"><a class="navtile-head" href="#/rules/site/story-guild-rank-progression"><img src="assets/banners/chapter_0.jpg" alt="" loading="lazy"><span>Story &amp; Guild Rank Progression</span></a>
      <div class="navtile-kids"><a href="#/rules/site/story-guild-rank-progression_chapter-0-the-voice-of-the-forest">Chapter 0 - The Voice of the Forest</a><a href="#/rules/site/story-guild-rank-progression_chapter-1-earthquake-at-woodland-base">Chapter 1 - Earthquake at Woodland Base</a></div></div></div>

  <div class="section-title"><h2>Campaign links</h2></div>
  <div class="grid g2">${QUICK_LINKS.map((l) => `<a class="linkbtn" href="${l.href}" target="_blank" rel="noopener"><b>${esc(l.label)}</b><span>${esc(l.sub)}</span></a>`).join('')}</div>`;


  $$('[data-pick]', main).forEach((b) => b.onclick = () => unlockChar(b.dataset.pick, () => { setMe(b.dataset.pick); setJoined(true); location.hash = '#/play'; }));
  $('#watch', main).onclick = () => { setMe(''); setJoined(true); location.hash = '#/play'; };
  $('#newchar', main).onclick = () => editCharacter(null, (id) => unlockChar(id, () => { setMe(id); setJoined(true); location.hash = '#/play'; }));
}

// Main mission banner: progress bar, the parts checklist and "what to do next" reminders.
function missionBanner(sess, mission, combat, c, myTurn) {
  const parts = mission ? missionParts(mission) : null;
  const open = parts ? parts.parts.filter((x) => x.status !== 'done' && x.status !== 'failed') : [];
  const taken = parts ? open.filter((x) => x.status === 'taken') : [];
  const pct = (a, b) => Math.round((a / Math.max(1, b)) * 100);
  const floor = sess.floor || 1;
  const steps = [];
  if (sess.next) steps.push(['📣', esc(sess.next)]);
  if (myTurn) steps.push(['⚔️', 'It’s your turn: pick a move or action on your sheet.']);
  else if (combat.active) steps.push(['⚔️', 'Battle! Watch the <b>Turn order</b> below and plan your move.']);
  if (c && num(c.hp ?? maxHp(c)) <= maxHp(c) / 3) steps.push(['❤️', 'Your HP is low: eat an Oran Berry or ask a teammate for help.']);
  if (sess.dungeon) {
    if (num(sess.hunger) >= 3) steps.push(['🍎', 'The team is getting hungry: eat an Apple soon.']);
    if (!combat.active) steps.push(sess.floors && floor >= sess.floors ? ['🏁', 'Last floor! Find what you came for, then head home.'] : ['🪜', 'Explore the floor and find the stairs down.']);
  } else if (!mission) steps.push(['📋', 'Pick a mission on the <a href="#/guild">Guild</a> mission board.']);
  else {
    if (taken.length) steps.push(['🎯', `Current job: <b>${esc(taken[0].title)}</b>${taken[0].place ? ' at ' + esc(taken[0].place) : ''}.`]);
    else if (open.length) steps.push(['📋', `Choose the next job on the <a href="#/guild">Mission board</a>: ${open.slice(0, 3).map((x) => `<b>${esc(x.title)}</b>`).join(', ')}${open.length > 3 ? '…' : ''}`]);
    steps.push(['🎒', 'Before you leave: check your bag and Poké, and visit the shops.']);
  }
  const done = parts ? parts.done : 0;
  return `<div class="session mb">
    <div class="row nowrap" style="justify-content:space-between;align-items:flex-start">
      <div class="grow"><span class="mb-kicker">${mission ? 'Main mission' : 'No mission yet'}</span><b>${mission ? esc(mission.title) : 'Visit the Guild'}</b></div>
      ${mission ? `<span class="mb-rank">${esc(mission.rank)}</span>` : ''}</div>
    ${parts ? `<div class="mb-prog"><div class="row nowrap" style="justify-content:space-between"><span class="small">Mission progress</span><span class="small"><b>${done} / ${parts.total}</b> jobs</span></div>
      <div class="mb-bar${done >= parts.total ? ' full' : ''}"${done >= parts.total ? ` data-burst="${esc(JSON.stringify(burstSet(mission, parts.parts)))}" data-key="${esc(mission.title)}" title="Mission complete! Tap to celebrate again"` : ''}><i style="width:${pct(done, parts.total)}%"></i></div>
      <div class="mb-parts">${parts.parts.map((x) => `<span class="mb-part ${esc(x.status || 'open')}" title="${esc(x.title)}">${x.status === 'done' ? '✅' : x.status === 'failed' ? '❌' : x.status === 'taken' ? '🎯' : '⬜'} ${esc(x.title)}</span>`).join('')}</div></div>` : ''}
    ${sess.dungeon ? `<div class="mb-prog"><div class="row nowrap" style="justify-content:space-between"><span class="small">🏔️ ${esc(sess.dungeon)}</span><span class="small"><b>Floor ${floor}${sess.floors ? ' / ' + sess.floors : ''}</b>${combat.active ? ` · Battle, round ${combat.round || 1}` : ''}</span></div>
      ${sess.floors ? `<div class="mb-bar floor"><i style="width:${pct(floor, sess.floors)}%"></i></div>` : ''}</div>` : ''}
    ${steps.length ? `<div class="mb-next"><span class="mb-kicker">What to do next</span><ul>${steps.slice(0, 4).map(([i, t]) => `<li><span>${i}</span><span>${t}</span></li>`).join('')}</ul></div>` : ''}
  </div>`;
}

// ---------------------------------------------------------------- play screen
// First time a player opens their character each day (Eastern time) or each live session: who are you working for?
const easternDay = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t));
// what they're carrying, so they remember at the start of the day: Poké + bag (their own items, then the team's)
function packHTML(c) {
  const bag = Object.values(store.get('bag') || {}).filter((b) => b.owner === c.id || b.owner === 'team').sort((a, b) => (a.owner === 'team') - (b.owner === 'team'));
  return `<div class="pack"><h3>🎒 What you're carrying</h3>
    <div class="pack-poke">💰 <b>${num(c.poke).toLocaleString()}</b> Poké</div>
    ${bag.length ? `<ul class="pack-list">${bag.map((b) => `<li>${isBadge(b.name) ? badgeIcon(b.name) : ''}<span class="grow">${esc(b.name)}${b.owner === 'team' ? ' <span class="pill">team</span>' : ''}</span><b>×${num(b.qty) || 1}</b></li>`).join('')}</ul>` : '<p class="small muted">Your bag is empty.</p>'}
    ${c.held || c.garments ? `<p class="small" style="margin:6px 0 0">✋ Held: <b>${esc(c.held || '—')}</b> · 🎀 Garment: <b>${esc(c.garments || '—')}</b></p>` : ''}</div>`;
}

function askGuildToday(c) {
  if (!c || c.guest || document.querySelector('.sheet-bg')) return;
  const asked = num(c.guildAskT);
  const since = num(store.get('session/liveSince'));
  if (asked && easternDay(asked) === easternDay(Date.now()) && !(store.get('session/live') && since > asked)) return;
  store.set(`party/${c.id}/guildAskT`, Date.now());   // asked once; closing the box keeps the current guild
  const cur = c.guild === 'vanguard' ? 'vanguard' : 'woodland';
  const el = modal(`<h2>Welcome back, ${esc(c.nickname)}!</h2><p>Who are you working for today?</p>
    <div class="vtabs wf-tabs wf-ask">${[['woodland', '🌳 Woodland Base'], ['vanguard', '🛡️ Vanguard Guild']].map(([k, n]) => `<button class="vtab ${cur === k ? 'on' : ''}" data-askguild="${k}" style="${guildTint(k)}">${n}</button>`).join('')}</div>
    <p class="small muted" style="margin-top:10px">You can switch any time with <b>Working for</b> on your sheet.</p>
    ${packHTML(c)}`);
  // keep the bag/Poké list current while the box is open (the table may still be loading)
  const off = store.subscribe(() => { const pk = $('.pack', el); const now = party()[c.id]; if (!pk || !now) { off(); return; } pk.outerHTML = packHTML(now); });
  $$('[data-askguild]', el).forEach((b) => b.onclick = () => {
    const k = b.dataset.askguild;
    if (k !== cur) store.set(`party/${c.id}/guild`, k);
    store.pushLimited('log', { t: Date.now(), text: `${c.nickname} is working for the ${guildName(k)}.` });
    closeModal();
  });
}

export function renderPlay(main) {
  const c = me();
  const sess = store.get('session') || {};
  const combat = store.get('combat') || {};
  const missions = store.get('missions') || {};
  const mission = missions[sess.mission];
  const order = combatOrder();
  const cur = combat.active ? order[combat.turn || 0] : null;
  const myTurn = cur && c && cur.ref === c.id;
  const reveals = Object.entries(store.get('reveal') || {}).sort().reverse();
  const lastReveal = reveals[0]?.[1];

  main.innerHTML = `
  ${myTurn ? `<div class="yourturn">Your turn, ${esc(c.nickname)}!</div>` : ''}
  ${missionBanner(sess, mission, combat, c, myTurn)}
  ${lastReveal && Date.now() - lastReveal.t < 6 * 3600e3 ? `<div class="row nowrap" style="align-items:flex-start;margin-bottom:12px">${lastReveal.portrait ? `<div class="portrait sm"><img src="assets/portraits/${esc(lastReveal.portrait)}.png" alt=""></div>` : ''}<div class="win grow"><span class="who">${esc(lastReveal.title || 'GM')}:</span> ${esc(lastReveal.text)}</div></div>` : ''}

  ${teamFxHTML()}

  ${c ? charCard(c) : `<div class="card"><h3>Watching</h3><p class="small muted">You're not playing a character on this device.</p><a class="btn" href="#/join">Pick a character</a></div>`}

  ${combat.active ? `<div class="section-title"><h3>Turn order</h3><span class="pill">Round ${combat.round || 1}</span></div>${orderList(order, combat.turn || 0, false)}` : ''}

  <div class="section-title"><h3>Party</h3></div>
  ${partyStrip(c?.id)}

  <div class="so-hide"><div class="section-title"><h3>Dice log</h3><button class="btn alt sm" id="freeroll">Roll dice</button></div>
  <div class="card">${diceLog()}</div></div>
  <a class="btn dark fab" href="#/rules">Rulebook</a>`;

  if (c) bindCharCard(main, c);
  bindTeamFx(main);
  $('#freeroll', main).onclick = () => freeRoll(c);
  $$('[data-viewchar]', main).forEach((b) => b.onclick = () => viewCharacter(b.dataset.viewchar));
}

// ---- WHOLE TEAM effects banner: effects on everyone; exhaustable ones get a tick box per character
export function addTeamFx(name, text, exhaust = true) {
  store.set('teamfx/' + store.tid(), { name, text, exhaust, used: {}, t: Date.now() });
}
function teamFxHTML() {
  const fx = Object.entries(store.get('teamfx') || {}).sort((a, b) => (a[1].t || 0) - (b[1].t || 0));
  const gm = store.gmUnlocked();
  if (!fx.length && !gm) return '';
  const p = Object.values(party()).filter((x) => !x.guest);
  return `<div class="teamfx"><div class="row" style="justify-content:space-between"><b class="tfx-title">🌟 WHOLE TEAM effects</b>${gm ? '<button class="btn alt sm" id="tfxadd">+ Effect</button>' : ''}</div>
    ${fx.length ? fx.map(([id, f]) => { const used = f.used || {}; const all = f.exhaust && p.length && p.every((x) => used[x.id]);
      return `<div class="tfx ${all ? 'spent' : ''}"><div class="row nowrap" style="justify-content:space-between;align-items:flex-start"><div class="grow"><b>${esc(f.name)}</b>${f.exhaust ? ' <span class="pill">once each</span>' : ''}${f.text ? `<div class="small">${esc(f.text)}</div>` : ''}</div>${gm ? `<button class="btn alt sm" data-tfxdel="${id}">Remove</button>` : ''}</div>
      ${f.exhaust ? `<div class="tfx-used">${p.map((x) => `<label><input type="checkbox" data-tfx="${id}" data-who="${x.id}" ${used[x.id] ? 'checked' : ''}> ${esc(x.nickname)}</label>`).join('')}</div>${all ? '<div class="small muted">Everyone has used it.</div>' : ''}` : ''}</div>`; }).join('') : '<p class="small muted">No team effects right now. Add one with + Effect.</p>'}</div>`;
}
function bindTeamFx(main) {
  $$('[data-tfx]', main).forEach((b) => b.onchange = () => store.set(`teamfx/${b.dataset.tfx}/used/${b.dataset.who}`, b.checked || null));
  $$('[data-tfxdel]', main).forEach((b) => b.onclick = () => store.set('teamfx/' + b.dataset.tfxdel, null));
  const a = $('#tfxadd', main);
  if (a) a.onclick = () => {
    const el = modal(`<h2>New WHOLE TEAM effect</h2>
      <label class="f">Name<input id="tn" placeholder="e.g. Wish Granted"></label>
      <label class="f">What it does<textarea id="tt" rows="3" placeholder="e.g. +1 success on your next roll"></textarea></label>
      <label class="row nowrap" style="margin-top:8px"><input type="checkbox" id="tx" checked> Exhaustable (each character can use it once)</label>
      <button class="btn block" id="ok" style="margin-top:10px">Add</button>`);
    $('#ok', el).onclick = () => { const n = $('#tn', el).value.trim(); if (!n) return; addTeamFx(n, $('#tt', el).value.trim(), $('#tx', el).checked); closeModal(); };
  };
}

export function combatOrder() {
  const p = party();
  const list = Object.entries((store.get('combat') || {}).list || {}).map(([id, x]) => {
    const c = x.ref && p[x.ref];
    return c ? { id, ...x, name: c.nickname, hp: c.hp ?? maxHp(c), maxHp: maxHp(c), status: c.status || [] } : { id, ...x };
  });
  return list.sort((a, b) => (b.init ?? -99) - (a.init ?? -99) || String(a.name).localeCompare(b.name));
}

export function orderList(order, turn, gmView) {
  const visible = gmView ? order : order.filter((x) => x.kind !== 'enemy' || x.revealed);
  if (!visible.length) return '<p class="muted small">Nobody in the battle yet.</p>';
  return `<ul class="order">${visible.map((x) => {
    const i = order.indexOf(x);
    return `<li class="${i === turn ? 'cur' : ''} ${x.kind === 'enemy' ? 'enemy' : ''}" data-cid="${x.id}">
      <span class="ini">${x.init ?? '–'}</span>
      <div class="grow"><div class="nm">${esc(x.name)}${gmView && x.kind === 'enemy' && !x.revealed ? ' <span class="pill">hidden</span>' : ''}</div>
      ${x.kind === 'enemy' && !gmView ? bar(x.hp, x.maxHp) : `${bar(x.hp, x.maxHp)}<div class="small">${x.hp}/${x.maxHp} HP</div>`}
      ${(x.status || []).length ? `<div class="small" style="color:var(--bad)">${esc(x.status.join(', '))}</div>` : ''}</div>
      ${gmView ? `<div class="stepper"><button class="btn alt sm" data-chp="${x.id}" data-d="-1">−</button><button class="btn alt sm" data-chp="${x.id}" data-d="1">+</button><button class="btn alt sm" data-cmore="${x.id}">…</button></div>` : ''}
    </li>`;
  }).join('')}</ul>`;
}

export function partyStrip(meId) {
  const p = Object.values(party());
  if (!p.length) return '<p class="muted">No characters yet.</p>';
  // split by the guild each character last picked (daily "who are you working for?")
  const card = (x) => {
    const mx = maxHp(x);
    return `<button class="pm ${x.id === meId ? 'me' : ''}" data-viewchar="${x.id}" style="text-align:left;cursor:var(--cur-link, pointer)">
      <div class="row nowrap">${portrait(x, 'xs')}<div class="grow"><div class="nm">${esc(x.nickname)}</div><div class="small muted">${x.guest ? '<span class="pill" style="font-size:11px">Guest</span> ' : ''}${x.hp}/${mx} HP</div></div></div>
      ${bar(x.hp, mx)}<div class="st">${esc((x.status || []).join(', '))}</div></button>`;
  };
  return ['woodland', 'vanguard'].map((g) => {
    const list = p.filter((x) => (x.guild === 'vanguard' ? 'vanguard' : 'woodland') === g);
    return list.length ? `<div class="party-group pg-${g}"><h4 class="pg-h">${g === 'vanguard' ? '🛡️' : '🌳'} ${esc(guildName(g))} <small class="muted">${list.length}</small></h4><div class="party">${list.map(card).join('')}</div></div>` : '';
  }).join('');
}

export function diceLog(limit = 30) {
  const rolls = Object.entries(store.get('rolls') || {}).sort().reverse().slice(0, limit);
  if (!rolls.length) return '<p class="muted small">No rolls yet. Tap a move to roll.</p>';
  return `<ul class="log">${rolls.map(([, r]) => `<li><span class="t">${timeAgo(r.t)}</span><span class="who">${esc(r.by)}</span> ${esc(r.label)}<br>
    ${r.dice ? diceFaces(r.dice, { pool: r.kind !== 'sum' && r.kind !== 'chance' }) : ''} <b>${esc(r.text)}</b></li>`).join('')}</ul>`;
}

export function logRoll(by, label, dice, text, kind = 'pool', sides = 6) {
  store.pushLimited('rolls', { by, label, dice, text, kind, t: Date.now() }, 80);
  if (dice && dice.length) dice3d.show(dice, { kind, sides });
}

// ---------------------------------------------------------------- role-play actions
const ACTION_SCHEMA = [['name', 'Action'], ['attr', 'Attribute (e.g. Insight, Cute, Logic)'], ['skill', 'Skill (e.g. Alert, Allure)'], ['text', 'What it is for', 'area']];
export const actions = () => merged('actions', ACTIONS);
// Actions are shown in groups, by the attribute they use (an action can set its own group).
const ACTION_GROUPS = [['explore', '🔍 Explore & notice'], ['move', '🏃 Move & strength'], ['talk', '💬 Talk & social'], ['mind', '🧠 Mind & instinct']];
const actionGroup = (a) => a.group || ({ Strength: 'move', Dexterity: 'move', Tough: 'talk', Cool: 'talk', Beauty: 'talk', Clever: 'talk', Cute: 'talk', Logic: 'mind', Instinct: 'mind' }[a.attr] || 'explore');

function actionRoll(c, a, extra = 0) {
  const base = statVal(c, a.attr) + statVal(c, a.skill);
  const dice = Math.max(1, base + primalDice(c) + extra);
  const r = pool(dice, { pain: painOf(c) });
  const out = r.succ === 0 ? 'complication' : r.succ === 1 ? 'partial success' : r.succ === 2 ? 'success' : 'excellent!';
  const text = `${r.succ} success${r.succ === 1 ? '' : 'es'} — ${out}`;
  logRoll(c.nickname, `${a.name} (${a.attr} + ${a.skill})`, r.dice, text);
  const el = modal(`<h2>${esc(a.name)}</h2><p class="small muted">${esc(a.text || '')}</p>
    <p class="small">${esc(a.attr)} ${statVal(c, a.attr)} + ${esc(a.skill)} ${statVal(c, a.skill)}${extra ? ` + ${extra} extra` : ''}${primalDice(c) ? ` + ${primalDice(c)} Primal` : ''} = ${dice} dice${painOf(c) ? ` · pain −${painOf(c)}` : ''}</p>
    <div class="result">${diceFaces(r.dice)}<div class="big">${text}</div>${r.onesPen ? `<div class="small muted">two 1s cost ${r.onesPen} success</div>` : ''}</div>
    <p class="small muted">0 = complication · 1 = partial success at a cost · 2 = success · 3+ = excellent</p>
    <div class="row nowrap" style="margin-top:8px"><label class="f grow">Extra dice (helpers, items)<input id="xd" type="number" inputmode="numeric" value="${extra}"></label><button class="btn" id="again" style="align-self:flex-end">Roll again</button></div>`);
  $('#again', el).onclick = () => actionRoll(c, a, num($('#xd', el).value));
}

// Battle & Moves / Actions sides fold away so the other gets the room (remembered on this device).
const foldPref = () => { try { return localStorage.getItem('dc.fold') || ''; } catch { return ''; } };
const setFoldPref = (v) => { try { localStorage.setItem('dc.fold', v); } catch { /* ignore */ } };

// Reactions to a foe's attack (Defenses card): Evade, or Clash with Strength (Physical move) / Special (Special move).
const REACT = {
  evade: { name: 'Evade', attr: 'Dexterity', skill: 'Evasion', text: 'Dodge the attack completely. Costs an action; once per round.' },
  clashP: { name: 'Clash', attr: 'Strength', skill: 'Clash', text: 'Meet a Physical move head-on. Costs an action; once per round.' },
  clashS: { name: 'Clash', attr: 'Special', skill: 'Clash', text: 'Meet a Special move head-on. Costs an action; once per round.' },
};
function clashPick(c) {
  const dice = (a) => statVal(c, a.attr) + statVal(c, a.skill);
  const el = modal(`<h2>Clash</h2><p class="small muted">Which kind of move are you clashing with?</p>
    <div class="row"><button class="btn" data-cl="clashP">Physical · Strength + Clash (${dice(REACT.clashP)})</button><button class="btn alt" data-cl="clashS">Special · Special + Clash (${dice(REACT.clashS)})</button></div>`);
  $$('[data-cl]', el).forEach((b) => b.onclick = () => actionRoll(c, REACT[b.dataset.cl]));
}

// ---------------------------------------------------------------- Poké bank (each character's own money)
const POKE_ASK = { add: 'How much Poké does {n} get?', spend: 'How much Poké does {n} spend?', give: 'How much Poké does {n} give to the guild coffers?', take: 'How much Poké does {n} take from the guild coffers?' };
function pokeMove(c, kind) {
  const amt = Math.floor(num(prompt(POKE_ASK[kind].replace('{n}', c.nickname), '')));
  if (amt <= 0) return;
  const mine = num((party()[c.id] || {}).poke); const gp = 'guild'; const coffers = num((store.get(gp) || {}).coffers);
  if ((kind === 'spend' || kind === 'give') && amt > mine) return toast(`${c.nickname} only has ${mine} Poké`);
  if (kind === 'take' && amt > coffers) return toast(`The guild only has ${coffers} Poké`);
  if (kind === 'take' && !canWithdraw(c.guild, amt)) return;
  const sign = kind === 'add' || kind === 'take' ? 1 : -1;
  store.update('party/' + c.id, (x) => { x.poke = num(x.poke) + sign * amt; return x; });
  if (kind === 'give' || kind === 'take') store.update(gp, (g) => ({ ...g, coffers: num(g?.coffers) - sign * amt }));
  const verb = { add: 'got', spend: 'spent', give: 'gave the guild coffers', take: 'took from the guild coffers' }[kind];
  store.pushLimited('log', { t: Date.now(), text: `${c.nickname} ${verb} ${amt} Poké (now ${mine + sign * amt}).` });
  if (kind === 'take') recordWithdrawal(c.guild, amt);
  if (kind === 'give' || kind === 'take') ledger(c.guild, `${c.nickname} ${kind === 'give' ? 'put in' : 'took out'} Poké`, kind === 'give' ? amt : -amt);
}

// ---------------------------------------------------------------- character card
// Colour scales for Humanity (5 = fully yourself, blue -> 0 = fully Pokémon, purple) and Primal points (0 calm -> 5+ red)
const HUM_COLORS = ['#5b2a86', '#b8322a', '#e07b24', '#e0b324', '#4f9fd8', '#2f6fd8'];
const PRIMAL_COLORS = ['#6a9a5b', '#e0b324', '#e07b24', '#d0502a', '#b8322a', '#7a1a1a'];
const scaleStyle = (cols, v) => { const c = cols[Math.max(0, Math.min(5, num(v)))]; return `background:${c}22;border-color:${c};--sc:${c}`; };
const pips = (v, cols) => `<span class="pips">${[1, 2, 3, 4, 5].map((i) => `<i style="background:${i <= num(v) ? cols[Math.min(5, num(v))] : 'transparent'}"></i>`).join('')}</span>`;

// species, nature, rank, instinct and gear as small labelled boxes (label on top, value below); tap one to read its rule
const factBoxes = (c) => `<div class="facts">${[
  ['Species', c.pokemon, ''], ['Nature', c.nature, 'Nature (personality)'], ['Rank', c.rank, c.rank ? c.rank + ' Rank' : ''], ['Instinct', c.instinctRank, 'Instinct'],
  ['Held item', c.held || '—', 'Garments'], ['Garment', c.garments || '—', 'Garments'], ['Training Points', num(c.tp), 'Training'],
].filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v, ix]) => `<${ix ? `a href="#" data-ixname="${esc(ix)}"` : 'div'} class="fact"><span class="fact-k">${k}</span><span class="fact-v">${esc(v)}</span></${ix ? 'a' : 'div'}>`).join('')}</div>`;

function charCard(c) {
  const mx = maxHp(c);
  const st = c.status || [];
  return `<div class="card">
    <div class="char-head">${portrait(c)}<div class="grow">
      <div class="char-name-row"><div class="char-name">${esc(c.nickname)}</div><button class="btn alt sm" id="editme2">✏️ Edit sheet</button></div>
      <div class="workfor"><span class="small">Working for:</span><div class="vtabs wf-tabs">${[['woodland', 'Woodland', 'Base'], ['vanguard', 'Vanguard', 'Guild']].map(([k, n, tail]) => `<button class="vtab ${(c.guild || 'woodland') === k ? 'on' : ''}" data-setguild="${k}" style="${guildTint(k)}">${k === 'vanguard' ? '🛡️' : '🌳'} ${n}<span class="wf-long"> ${tail}</span></button>`).join('')}</div></div>
      ${factBoxes(c)}
      <div class="chips" style="margin-top:4px">${[c.type1, c.type2].filter(Boolean).map((t) => `<a href="#" class="chip type ty-${esc(t)}" data-ixname="Type effectiveness">${esc(t)}</a>`).join('')}${c.ability ? `<a href="#" class="pill" data-ixname="${esc(c.ability)}">${esc(c.ability)}</a>` : ''}${badgeChip(c)}</div>
    </div></div>
    ${zeroHpHTML(c)}
    <div class="tri pair" style="margin-top:10px">
      <div class="pcol"><a href="#" data-ixname="Humanity" class="ixbox scale" style="${scaleStyle(HUM_COLORS, c.humanity)}"><b>${c.humanity ?? 0}</b><span>Humanity</span>${pips(c.humanity, HUM_COLORS)}</a><div class="stepper"><button class="btn alt sm" data-hum="-1">−1</button><button class="btn alt sm" data-hum="1">+1</button></div></div>
      <div class="pcol"><a href="#" data-ixname="Primal points" class="ixbox scale" style="${scaleStyle(PRIMAL_COLORS, c.primal)}"><b>${c.primal ?? 0}</b><span>Primal</span>${pips(c.primal, PRIMAL_COLORS)}</a><div class="stepper"><button class="btn alt sm" data-primalpt="-1">−1</button><button class="btn alt sm" data-primalpt="1">+1</button></div></div>
    </div>
    <div class="mind">
      <a href="#" data-ixname="Instinct" class="mind-tile instinct"><span class="m-ic">🐾</span><span class="m-txt"><span class="m-lab">Instinct</span><small>${esc(c.instinctRank || 'Wild side')}</small></span><b class="m-num">${c.instinct ?? 0}</b></a>
      <a href="#" data-ixname="Logic" class="mind-tile logic"><span class="m-ic">🧠</span><span class="m-txt"><span class="m-lab">Logic</span><small>Human mind</small></span><b class="m-num">${c.logic ?? 0}</b></a>
    </div>
    ${c.id === myId() || store.gmUnlocked() ? memoryHTML(c) : ''}

    <div class="always"><div class="al-status">
    <div class="section-title" style="margin-top:0"><h3>Status</h3><button class="btn alt sm" id="stedit">Change</button></div>
    <div class="conds">${st.length ? st.map((s) => { const [ic, col] = COND_LOOK[s] || ['⚠️', '#8a5d33']; return `<div class="cond" style="--cc:${col}"><div class="cond-head"><span class="cond-ic">${ic}</span><a href="#" data-ixname="${esc(STATUS_IX[s] || s)}">${esc(s)}</a><span class="cond-dur" data-cdur="${esc(STATUS_IX[s] || s)}"></span></div><div class="cond-body" data-cond="${esc(STATUS_IX[s] || s)}"><p class="small muted">Loading what to do…</p></div></div>`; }).join('')
      : '<div class="cond healthy"><div class="cond-head"><span class="cond-ic">✨</span><b>Healthy</b></div><p class="small" style="margin:4px 0 0">No conditions. Ready for adventure!</p></div>'}</div>
    </div>
    <div class="vitals al-vitals">
      <div class="vital hp"><div class="v-head"><span class="v-ic">❤️</span><b>${ixLink('HP')}</b><span class="v-val">${c.hp}<small>/${mx}</small></span></div>
        <div class="vbar-wrap" style="--n:${Math.max(1, mx)}">${bar(c.hp, mx)}</div>
        <div class="v-btns"><button class="btn alt" data-hp="-1">−1</button><button class="btn alt" data-hp="1">+1</button><button class="btn alt" data-hp="full">Full</button></div></div>
      <div class="vital will"><div class="v-head"><span class="v-ic">✨</span><b>${ixLink('Will points', 'Will')}</b><span class="v-val">${c.willCur ?? 0}<small>/${c.will}</small></span></div>
        <div class="vbar-wrap" style="--n:${Math.max(1, num(c.will))}">${bar(c.willCur, c.will, 'will')}</div>
        <div class="v-btns"><button class="btn alt" data-will="-1">Spend</button><button class="btn alt" data-will="1">+1</button></div></div>
    </div>
    </div>
    ${sheetOnly() ? `<div class="section-title"><h3>Stats &amp; skills</h3></div>${statGrids(c)}` : ''}
    <div class="mv-act" data-fold="${sheetOnly() ? '' : foldPref()}" style="--guild-badge:url('${new URL(`assets/badges/${c.guild === 'vanguard' ? 'vanguard' : 'woodland'}.png`, location.href).href}')"><div class="mv-col pane">
    <button class="pane-tab" data-unfold>⚔️ Battle &amp; Moves</button><div class="pane-body">
    <div class="pane-head battle"><h3>⚔️ Battle</h3><button class="btn alt sm fold-btn" data-fold="moves" title="Hide this side">◀ Hide</button></div>
    <h4 class="actgroup">🛡️ Defenses <small class="muted">what foes roll against</small></h4>
    <div class="mind defs">
      <a href="#" data-ixname="Vitality" class="mind-tile def"><span class="m-ic">🛡️</span><span class="m-txt"><span class="m-lab">Defense</span><small>vs Physical · Vitality</small></span><b class="m-num">${statVal(c, 'Vitality')}</b></a>
      <a href="#" data-ixname="Insight" class="mind-tile spdef"><span class="m-ic">🔮</span><span class="m-txt"><span class="m-lab">Sp. Defense</span><small>vs Special · Insight</small></span><b class="m-num">${statVal(c, 'Insight')}</b></a>
    </div>
    <div class="row react-row"><button class="btn" id="evaderoll">🌀 Evade <small>${statVal(c, 'Dexterity') + statVal(c, 'Evasion')} ${statVal(c, 'Dexterity') + statVal(c, 'Evasion') === 1 ? 'die' : 'dice'}</small></button><button class="btn alt" id="clashroll">💥 Clash</button><button class="btn alt" id="boostbtn">± Boosts</button></div>
    ${boostStrip(c)}
    <h4 class="actgroup">✊ Moves <small class="muted">tap to roll</small></h4>
    <div class="moves">${(c.moves || []).map((m, i) => `<div class="move movecard"><a href="#" data-ixname="${esc(m)}" class="mvname"><b>${esc(m)}</b></a><span data-minfo="${esc(m)}">…</span><p class="mveff" data-meff="${esc(m)}"></p><button class="btn block" data-move="${i}">Roll ${esc(m)}</button></div>`).join('') || '<p class="muted small">No moves on this sheet yet.</p>'}
      <div class="move movecard"><a href="#" data-ixname="Physical Struggle" class="mvname"><b>Struggle</b></a><span>None · Physical · Accuracy Dexterity + Brawl · Damage Strength + Power 0</span><p class="mveff">Always available, even with no moves left.</p><button class="btn block" data-struggle="Physical Struggle">Roll Struggle</button></div></div>
    </div></div><div class="act-col pane">
    <button class="pane-tab" data-unfold>🎲 Actions</button><div class="pane-body">
    <div class="pane-head acts"><h3>🎲 Actions</h3><span class="ph-right">${store.gmUnlocked() ? '<a href="#" id="edact">edit</a>' : ''}<button class="btn alt sm fold-btn" data-fold="actions" title="Hide this side">Hide ▶</button></span></div>
    <h4 class="actgroup">🎲 Quick rolls</h4><div class="row"><button class="btn" id="qroll">Quick roll</button><button class="btn alt" id="initroll">Initiative</button></div>
    ${ACTION_GROUPS.map(([g, label]) => { const list = actions().filter((a) => actionGroup(a) === g); return list.length ? `<h4 class="actgroup">${label}</h4><div class="actions">${list.map((a) => `<button class="actbtn" data-act="${esc(a.id)}"><b>${esc(a.name)}</b><span>${esc(a.attr)} + ${esc(a.skill)}</span><span class="actdice">${statVal(c, a.attr) + statVal(c, a.skill)} ${statVal(c, a.attr) + statVal(c, a.skill) === 1 ? "die" : "dice"}</span></button>`).join('')}</div>` : ''; }).join('')}
    </div></div></div>


    <div class="card pouch">
      <div class="pouch-bank">
        <div class="section-title"><h3>Poké bank</h3></div>
        <p class="small muted" style="margin:0 0 6px">${esc(guildName(c.guild))} · shared coffers: ${num((store.get('guild') || {}).coffers).toLocaleString()}</p>
        ${lowAlertHTML()}<div class="pokebank"><div class="pix pokeamt">${num(c.poke).toLocaleString()} <span>Poké</span></div>
          <div class="row"><button class="btn sm" data-poke="add">+ Add</button><button class="btn alt sm" data-poke="spend">− Spend</button><button class="btn alt sm" data-poke="give">Give to guild</button><button class="btn alt sm" data-poke="take">Take from guild</button></div></div>
        <p class="small muted" style="margin:8px 0 0">${(() => { const k = capInfo(c.guild); return `${esc(k.name)} can still take ${k.left.toLocaleString()} of ${k.cap.toLocaleString()} Poké this session.`; })()}</p>
      </div>
      <div class="pouch-bag">
        <div class="section-title"><h3>Bag</h3><button class="btn alt sm" id="additem">+ Item</button></div>
        ${bagList(c)}
      </div>
    </div>
    <div class="pair-row">${sleepHTML(c)}<div id="wxcard"></div></div>

    <details open class="so-hide" style="margin-top:12px"><summary class="pix" style="font-size:18px;cursor:var(--cur-link, pointer);min-height:40px">Stats &amp; skills</summary>
      ${statGrids(c)}
      ${c.notes ? `<h4>Notes</h4><p class="small" style="white-space:pre-wrap">${esc(c.notes)}</p>` : ''}
    </details>
    <div class="row" style="margin-top:12px"><button class="btn alt sm" id="editme">Edit character</button><a class="btn alt sm" href="#/join">Switch character</a></div>
  </div>`;
}

// Working-for toggle in each guild's colours, like the Vault tabs
const guildTint = (k) => Object.entries(palette(k === 'vanguard' ? '#2f5fb8' : '#4f8a2e')).map(([v, col]) => `${v}:${col}`).join(';');

// Look of each status condition on the sheet: [icon, colour]
const COND_LOOK = { Burn: ['🔥', '#d8561f'], Poison: ['☠️', '#8e3fa0'], 'Badly Poisoned': ['☠️', '#5f1f78'], Paralysis: ['⚡', '#c9a10c'], Frozen: ['❄️', '#3b9fc9'],
  Sleep: ['💤', '#3d4f9a'], Confused: ['💫', '#c2508f'], Flinch: ['😖', '#9a6a3a'], Infatuated: ['💗', '#d6467a'], Blocked: ['🛡️', '#6a6f80'],
  Disabled: ['🚫', '#8a3030'], 'Primal State': ['🔴', '#b3202a'], Fainted: ['😵', '#555a66'] };

// moving night sky behind the sleeping-spot card: drifting aurora, twinkling stars, floating z's, a shooting star now and then
const DREAM_FX = (() => {
  const r = (i) => ((Math.sin(i * 127.1) * 43758.5453) % 1 + 1) % 1;
  const stars = Array.from({ length: 16 }, (_, i) => `<i class="dstar" style="--x:${(r(i) * 100).toFixed(1)}%;--y:${(r(i + 50) * 100).toFixed(1)}%;--d:${(-r(i + 90) * 4).toFixed(2)}s"></i>`).join('');
  const zs = Array.from({ length: 6 }, (_, i) => `<i class="dz" style="--x:${(12 + r(i + 200) * 76).toFixed(1)}%;--d:${(-i * 1.1).toFixed(2)}s;--sz:${(13 + r(i + 300) * 12).toFixed(0)}px">z</i>`).join('');
  return `<div class="wxfx dreamfx" aria-hidden="true"><b class="aurora"></b><b class="aurora a2"></b>${stars}${zs}<b class="shoot"></b></div>`;
})();

// Sleeping spot: players pick where they sleep (Friend Zone spots). The GM's end of session asks everyone again.
function sleepHTML(c) {
  const ask = num(store.get('session/sleepAsk')) > num(c.sleepT);
  const opts = locations().map((l) => `<optgroup label="${esc(l.name)}">${spots(l).map((s) => { const full = spotFull(l.id, s, c.id);
    return `<option value="${esc(l.id + '|' + s.key)}" ${c.sleep === l.id + '|' + s.key ? 'selected' : ''} ${full ? 'disabled' : ''}>${s.room ? '↳ ' : ''}${esc(s.name.replace(/^[^\w]*\d*\.?\s*/, ''))}${s.limit === 1 ? ' 🔒' : ''}${full ? ` (taken by ${esc(spotSleepers(l.id, s.key, c.id).map((x) => x.nickname).join(', '))})` : ''}</option>`; }).join('')}</optgroup>`).join('');
  // the chosen spot, shown like a night-sky card to match the weather card beside it
  const [lid, skey] = (c.sleep || '').split('|');
  const loc = locations().find((l) => l.id === lid); const spot = loc && spots(loc).find((x) => x.key === skey);
  const icon = (spot?.name.match(/^\p{Extended_Pictographic}/u) || [])[0] || loc?.icon || '🌙';
  return `<div class="sleep fortune dream ${ask ? 'ask' : ''}">${DREAM_FX}<div class="ft-top">✦ ${ask ? 'Time to rest!' : 'Sleeping Spot'} ✦</div>
    <div class="ft-orb dream-orb" aria-hidden="true"><span class="dream-ic">${spot ? icon : '🌙'}</span></div>
    ${spot ? `<div class="ft-name">${esc(spot.name.replace(/^[^\w]*\d*\.?\s*/, ''))}</div><div class="ft-say">resting at ${esc(loc.name)}</div>
      ${spot.desc ? `<p class="dream-desc">${esc(spot.desc)}</p>` : ''}${spot.mons.length ? `<p class="dream-near">💤 Sleeping nearby: ${esc(spot.mons.join(', '))}</p>` : ''}`
      : `<div class="ft-say">${ask ? 'Where is your character sleeping tonight?' : 'No bed picked yet. Where will you rest?'}</div>`}
    <div class="row nowrap dream-pick"><select id="sleepsel" aria-label="Sleeping spot"><option value="">Choose a spot…</option>${opts}</select>${c.sleep ? '<a class="ft-more" href="#/friends/' + esc(lid) + '">Friend Zone ›</a>' : ''}</div></div>`;
}

// Guild Rank badge: every character carries the badge of their guild's current rank (bag item + chip by their name).
// Pictures go in assets/badges/rank_<key>.png; until a picture is added (RANK_PICS), the rank's emoji is shown.
const RANK_BADGE = { 'Basic Rank': ['🌱', 'basic'], 'Bronze Rank': ['🥉', 'bronze'], 'Silver Rank': ['🥈', 'silver'], 'Gold Rank': ['🥇', 'gold'], 'Diamond Rank': ['💎', 'diamond'], 'Lucario Rank': ['💫', 'lucario'] };
const RANK_PICS = new Set(['basic', 'bronze', 'silver', 'gold', 'diamond', 'lucario']);
const badgeOf = (c) => {
  const r = rankFor(num((store.get(guildPath(c.guild)) || {}).gp)) || { name: 'Basic Rank', alt: 'Beginner' };
  const [emo, key] = RANK_BADGE[r.name] || RANK_BADGE['Basic Rank'];
  return [`${r.name} Badge`, emo, RANK_PICS.has(key) ? `assets/badges/rank_${key}.png` : '', r.alt];
};
const badgeIcon = (name) => { const r = RANK_BADGE[name.replace(/ Badge$/, '')]; if (!r) return ''; return RANK_PICS.has(r[1]) ? `<img class="bag-badge" src="assets/badges/rank_${r[1]}.png" alt="">` : `<span class="badge-emo">${r[0]}</span>`; };
const badgeChip = (c) => { const [n, emo, img, alt] = badgeOf(c); return `<span class="pill badge-chip" title="${esc(n)}">${img ? `<img src="${img}" alt="">` : `<span class="badge-emo">${emo}</span>`}${esc(n.replace(' Badge', ''))}${alt ? ` (${esc(alt)})` : ''}</span>`; };
const isBadge = (name) => / (Rank|Guild) Badge$/.test(name || '');
// Aura Bow: every character wears the bow matching their nature (applied automatically)
const AURA_BOW = { Modest: 'Blue', Hardy: 'Brown', Lax: 'Brown', Lonely: 'Cobalt', Serious: 'Cobalt', Naughty: 'Fuchsia', Gentle: 'Green', Relaxed: 'Green',
  Impish: 'Lime', Naive: 'Lime', Docile: 'Minty', Mild: 'Minty', Adamant: 'Orange', Rash: 'Orange', Bashful: 'Pink', Quirky: 'Purple', Sassy: 'Purple',
  Brave: 'Red', Timid: 'Silver', Calm: 'Sky Blue', Quiet: 'Violet', Bold: 'Viridian', Careful: 'Viridian', Hasty: 'Yellow', Jolly: 'Yellow' };
export const auraBow = (c) => { const k = Object.keys(AURA_BOW).find((n) => n.toLowerCase() === String(c?.nature || '').trim().toLowerCase()); return k ? AURA_BOW[k] + ' Bow' : ''; };

export function ensureBadge(c) {
  if (!c.garments && auraBow(c)) store.set('party/' + c.id + '/garments', auraBow(c));
  const [want] = badgeOf(c);
  if (!Object.values(store.get('bag') || {}).some((b) => b.owner === c.id && b.name === 'World Map')) store.set('bag/' + uid(), { name: 'World Map', qty: 1, owner: c.id, key: true });
  const mine = Object.entries(store.get('bag') || {}).filter(([, b]) => b.owner === c.id && isBadge(b.name));
  if (mine.length === 1 && mine[0][1].name === want) return;
  mine.forEach(([id]) => store.set('bag/' + id, null));
  store.set('bag/' + uid(), { name: want, qty: 1, owner: c.id, badge: true });
}

function bagList(c) {
  const bag = Object.entries(store.get('bag') || {}).filter(([, b]) => b.owner === c.id || b.owner === 'team');
  if (!bag.length) return '<p class="muted small">Empty. Items the team finds land here.</p>';
  return `<ul class="log" style="max-height:none">${bag.map(([id, b]) => `<li class="row nowrap"><span class="grow">${isBadge(b.name) ? badgeIcon(b.name) : ''}${b.name === 'World Map' ? `<a href="#" data-showmap="1"><b>🗺️ World Map</b></a>` : `<a href="#" data-ixname="${esc(b.name)}"><b>${esc(b.name)}</b></a>`} ×${b.qty}${b.owner === 'team' ? ' <span class="pill">team</span>' : ''}</span>
    ${b.name === 'World Map' || isBadge(b.name) ? '' : `<button class="btn alt sm pinbtn ${pinsOf(c).includes(b.name) ? 'on' : ''}" data-pin="${esc(b.name)}" title="Pin to the top bar">📌</button>`}${isBadge(b.name) ? '<span class="small muted">rank badge</span>' : b.key ? '<span class="small muted">key item</span>' : `<button class="btn alt sm" data-stash="${id}">Store</button><button class="btn sm" data-use="${id}">Use</button>`}</li>`).join('')}</ul>`;
}

function bindCharCard(main, c) {
  const path = 'party/' + c.id;
  ensureBadge(c);
  bindMemory(main, c);
  $$('[data-showmap]', main).forEach((a) => a.onclick = (e) => { e.preventDefault(); showMap(); });
  $$('[data-pin]', main).forEach((b) => b.onclick = () => {
    const n = b.dataset.pin; const cur = pinsOf(c);
    if (cur.includes(n)) store.set(path + '/pins', cur.filter((x) => x !== n));
    else if (cur.length >= 3) toast('You can pin 3 items. Unpin one first.');
    else store.set(path + '/pins', [...cur, n]);
  });
  bindZeroHp(main, c, togglePrimal);
  if (num(c.hp) > 0 && c.zeroAnswered) store.set(path + '/zeroAnswered', null);   // back above 0: ask again next time
  $$('[data-hum]', main).forEach((b) => b.onclick = () => store.update(path, (x) => ({ ...x, humanity: Math.max(0, Math.min(5, num(x.humanity) + num(b.dataset.hum))) })));
  $$('[data-primalpt]', main).forEach((b) => b.onclick = () => store.update(path, (x) => ({ ...x, primal: Math.max(0, num(x.primal) + num(b.dataset.primalpt)) })));
  const ss = $('#sleepsel', main);
  if (ss) ss.onchange = () => {
    if (!ss.value) return;
    { const [lid, key] = ss.value.split('|'); const l = locations().find((x) => x.id === lid); const sp = l && spots(l).find((x) => x.key === key);
      if (sp && spotFull(lid, sp, c.id)) { toast(`${sp.name.replace(/^[^\w]*\d*\.?\s*/, '')} is already taken`); ss.value = c.sleep || ''; return; } }
    const asked = num(store.get('session/sleepAsk')) > num(c.sleepT);
    store.update(path, (x) => ({ ...x, sleep: ss.value, sleepT: Date.now() }));
    if (asked) restDream(c);   // resting brings a dream (or nightmare)
    const [lid, key] = ss.value.split('|'); const l = locations().find((x) => x.id === lid); const sp = l && spots(l).find((x) => x.key === key);
    store.pushLimited('log', { t: Date.now(), text: `${c.nickname} is sleeping at ${sp ? sp.name.replace(/^[^\w]*\d*\.?\s*/, '') : 'camp'}${l ? ' (' + l.name + ')' : ''}.` });
    toast('Sleeping spot saved');
  };
  $$('[data-hp]', main).forEach((b) => b.onclick = () => store.update(path, (x) => { const mx = maxHp(x); x.hp = b.dataset.hp === 'full' ? mx : clamp((x.hp ?? mx) + num(b.dataset.hp), 0, mx); return x; }));
  $$('[data-will]', main).forEach((b) => b.onclick = () => store.update(path, (x) => { x.willCur = clamp((x.willCur ?? x.will) + num(b.dataset.will), 0, x.will || 0); return x; }));
  $('#stedit', main).onclick = () => pickStatus(c);
  $('#editme', main).onclick = () => editCharacter(c.id);
  $('#editme2', main).onclick = () => editCharacter(c.id);
  $('#qroll', main).onclick = () => quickRoll(c);
  $$('[data-act]', main).forEach((b) => b.onclick = () => actionRoll(c, actions().find((a) => a.id === b.dataset.act)));
  const ea = $('#edact', main);
  if (ea) ea.onclick = (e) => {
    e.preventDefault();
    const el = modal(`<h2>Actions</h2><p class="small muted">Change, add or remove the action buttons every character sees.</p>
      <div>${actions().map((a) => `<div class="row nowrap" style="margin:6px 0"><span class="grow"><b>${esc(a.name)}</b> <span class="small muted">${esc(a.attr)} + ${esc(a.skill)}</span></span><button class="btn alt sm" data-e="${esc(a.id)}">Edit</button></div>`).join('')}</div>
      <button class="btn" id="newact" style="margin-top:8px">+ New action</button>`);
    $$('[data-e]', el).forEach((x) => x.onclick = () => editContent('actions', ACTION_SCHEMA, actions().find((a) => a.id === x.dataset.e), { onSave: () => location.reload() }));
    $('#newact', el).onclick = () => editContent('actions', ACTION_SCHEMA, null, { title: 'New action', onSave: () => location.reload() });
  };
  $('#initroll', main).onclick = () => rollInitiative(c);
  $('#evaderoll', main).onclick = () => actionRoll(c, REACT.evade);
  $('#clashroll', main).onclick = () => clashPick(c);
  const mva = $('.mv-act', main);
  // Battle and Actions fold on their own, so both can be folded at once (data-fold = '' | moves | actions | both)
  const setFold = (side, folded) => {
    const now = new Set(mva.dataset.fold === 'both' ? ['moves', 'actions'] : [mva.dataset.fold].filter(Boolean));
    if (folded) now.add(side); else now.delete(side);
    const v = now.size === 2 ? 'both' : [...now][0] || ''; mva.dataset.fold = v; setFoldPref(v);
  };
  $$('.fold-btn[data-fold]', mva).forEach((b) => b.onclick = () => setFold(b.dataset.fold, true));
  $$('[data-unfold]', mva).forEach((b) => b.onclick = () => setFold(b.closest('.mv-col') ? 'moves' : 'actions', false));
  $('#boostbtn', main).onclick = () => pickBoosts(c);
  if ($('#clearboosts', main)) $('#clearboosts', main).onclick = () => clearBoosts(c);
  $('#additem', main).onclick = () => addItem(c.id);
  $$('[data-poke]', main).forEach((b) => b.onclick = () => pokeMove(c, b.dataset.poke));
  $$('[data-use]', main).forEach((b) => b.onclick = () => useItem(b.dataset.use, c));
  $$('[data-stash]', main).forEach((b) => b.onclick = () => stash(b.dataset.stash, c));
  $$('[data-setguild]', main).forEach((b) => b.onclick = () => {
    store.set(`party/${c.id}/guild`, b.dataset.setguild);
    store.pushLimited('log', { t: Date.now(), text: `${c.nickname} is working for the ${guildName(b.dataset.setguild)}.` });
  });
  askGuildToday(c);
  Promise.all([allMoves(), loadIndex()]).then(([list, ix]) => {
    const base = sheet.moveIndex(list);
    // Follow Index aliases (e.g. a sheet's "Metranome" is Metronome).
    const idx = { get: (k) => base.get(k) || base.get(ix.byName.get(k)?.name?.toLowerCase() || '') };
    $$('[data-minfo]', main).forEach((s) => {
      const m = idx.get(s.dataset.minfo.toLowerCase());
      // bold card in the move's own type colour, with the type's icon
      const card = s.closest('.movecard'); const tc = m && TYPE_COLORS[m.type];
      if (card && tc) { card.style.setProperty('--mt', tc); card.classList.add('typed'); if (!card.querySelector('.mvtype')) card.insertAdjacentHTML('afterbegin', `<span class="mvtype">${TYPE_ICONS[m.type] || ''} ${esc(m.type)}</span>`); }
      s.textContent = m ? `${m.type} · ${m.cat} · Accuracy ${m.acc.join(' + ') || '—'}${m.power != null ? ' · Damage ' + (m.cat === 'Special' ? 'Special' : 'Strength') + ' + Power ' + m.power : ''}` : 'not in the moves list — you can still roll it';
    });
    $$('[data-meff]', main).forEach((p) => { const m = idx.get(p.dataset.meff.toLowerCase()); p.innerHTML = m?.effect ? linkify(m.effect, ix, m.name) : (m ? 'No added effect.' : ''); });
    $$('[data-move]', main).forEach((b) => b.onclick = () => moveRoll(c, idx.get(c.moves[+b.dataset.move].toLowerCase()) || { name: c.moves[+b.dataset.move], type: '', cat: 'Status', acc: [], power: null, effect: '' }));
    // each status condition: what it does, what to roll, and what cures it (from the Index)
    $$('[data-cond]', main).forEach((el) => {
      const e = find(ix, el.dataset.cond); if (!e) { el.innerHTML = '<p class="small">Ask your GM what this does.</p>'; return; }
      const row = (k, label, t) => (t ? `<div class="cond-row ${k}"><b>${label}</b><span>${linkify(t, ix)}</span></div>` : '');
      el.innerHTML = row('does', 'What happens', e.outcome) + row('todo', 'What to do', /can.t be resisted/i.test(e.roll || '') ? (e.removal ? 'You can’t roll your way out of this one. Use one of the cures below, or wait it out.' : 'You can’t roll your way out of this one. Wait it out.') : e.roll) + row('cure', 'Cures', e.removal);
      const d = $(`[data-cdur="${CSS.escape(el.dataset.cond)}"]`, main); if (d && e.duration) d.textContent = '⏳ ' + e.duration;
    });
    const wxEl = $('#wxcard', main);
    if (wxEl) {
      const w = WEATHERS[currentWeather().key]; const ab = c.ability && find(ix, c.ability);
      const hits = weatherFor(c, (c.moves || []).map((n) => idx.get(n.toLowerCase())), ab ? { name: ab.name, text: ab.outcome || ab.trigger || '' } : null);
      wxEl.innerHTML = `<div class="wxcard fortune ${hits.length ? 'on' : ''}">${wxFxHTML(currentWeather().key)}<div class="ft-top">✦ What’s the Weather? ✦</div>
        <div class="ft-orb" aria-hidden="true">${wxIconHTML(currentWeather().key)}</div><div class="ft-name">${esc(w.name)}</div>
        <div class="ft-say">${hits.length ? 'The skies foretell…' : 'The skies are quiet for you.'}</div>
        ${hits.length ? `<ul>${hits.map((h) => `<li class="${h.good ? 'up' : 'down'}"><span>${h.good ? '⬆️' : '⚠️'}</span><span><b>${esc(h.what)}</b>${h.ability ? ' (your ability)' : ''}: ${h.special || h.ability ? linkify(h.note, ix) : esc(h.note)}</span></li>`).join('')}</ul>`
          : `<p class="small ft-none">${w.ix ? 'This weather doesn’t change any of your moves or your ability.' : 'No weather effects right now.'}</p>`}
        <button class="ft-more" id="wxinfo">Read the full fortune ›</button></div>`;
      $('#wxinfo', wxEl).onclick = showWeather;
      const tagged = new Set(hits.map((h) => h.what));
      $$('.movecard .mvname', main).forEach((a) => { if (tagged.has(idx.get(a.dataset.ixname.toLowerCase())?.name) && !a.querySelector('.wxtag')) (a.querySelector('b') || a).insertAdjacentHTML('beforeend', ` <span class="wxtag">${w.icon}</span>`); });
    }
    $$('[data-struggle]', main).forEach((b) => b.onclick = () => moveRoll(c, idx.get('physical struggle') || { name: 'Physical Struggle', type: 'None', cat: 'Physical', acc: ['Dexterity', 'Brawl'], power: 0, effect: '' }));
  });
}

function togglePrimal(c, asked = false) {
  const on = (c.status || []).includes('Primal State');
  if (!on && !asked && !confirm('Enter Primal State? You regain all HP, cure status, ignore pain and add Instinct dice to every action. Your Primal Score goes up by 1 and you lose 1 Humanity.')) return;
  store.update('party/' + c.id, (x) => {
    if (on) { x.status = (x.status || []).filter((s) => s !== 'Primal State'); }
    else { x.hp = maxHp(x); x.status = ['Primal State']; x.humanity = Math.max(0, (x.humanity || 0) - 1); x.primal = num(x.primal) + 1; x.zeroAnswered = null; }
    return x;
  });
  if (!on) addMemory(c, makeMemory(c, 'primal'));
  store.pushLimited('log', { t: Date.now(), text: on ? `${c.nickname} calms down and leaves Primal State.` : `${c.nickname} enters Primal State! (Primal Score +1, −1 Humanity)` });
}

// ---------------------------------------------------------------- stats
export function statVal(c, name) {
  if (!c || !name) return 0;
  const n = String(name).trim();
  if (/^(smart|clever)/i.test(n)) return num(c.Clever);
  if (/^will$/i.test(n)) return num(c.will);
  const key = Object.keys(c).find((k) => k.toLowerCase() === n.toLowerCase());
  return (key ? num(c[key]) : 0) + boostOf(c, n);
}
// Temporary boosts (c.boosts = { Strength: 1, Evasion: -1 }): count in every roll, never change the real stats.
export const BOOSTABLE = [...ATTRS, ...SOCIAL, 'Brawl', 'Channel', 'Clash', 'Evasion', 'Alert', 'Athletic', 'Nature', 'Stealth', 'Allure', 'Etiquette', 'Intimidate', 'Perform'];
export function boostOf(c, name) {
  const b = c?.boosts || {}; const n = String(name || '').toLowerCase();
  const key = Object.keys(b).find((k) => k.toLowerCase() === n);
  return key ? num(b[key]) : 0;
}
const boostList = (c) => Object.entries(c.boosts || {}).filter(([, v]) => num(v));
const signed = (v) => (v > 0 ? '+' + v : '−' + Math.abs(v));
function boostStrip(c) {
  const l = boostList(c);
  return l.length ? `<div class="boost-strip"><span class="small"><b>Boosts:</b></span>${l.map(([k, v]) => `<span class="boost-chip ${v > 0 ? 'up' : 'down'}">${v > 0 ? '▲' : '▼'} ${esc(k)} ${signed(v)}</span>`).join('')}<button class="btn alt sm" id="clearboosts">Clear boosts</button></div>` : '';
}
function setBoost(c, stat, d) {
  const v = boostOf(party()[c.id] || c, stat) + d;
  store.set(`party/${c.id}/boosts/${stat}`, v || null);
  window.dispatchEvent(new Event('refreshpage'));
}
export function clearBoosts(c, quiet) {
  if (!boostList(c).length) return;
  store.set(`party/${c.id}/boosts`, null);
  if (!quiet) store.pushLimited('log', { t: Date.now(), text: `${c.nickname}'s temporary boosts wear off.` });
  window.dispatchEvent(new Event('refreshpage'));
}
function pickBoosts(c) {
  const cur = () => party()[c.id] || c;
  const row = (k) => { const v = boostOf(cur(), k); return `<div class="row nowrap boost-row"><span class="grow"><b>${esc(k)}</b> <span class="small muted">${num(cur()[k])}${v ? ` → <b class="${v > 0 ? 'up' : 'down'}">${num(cur()[k]) + v}</b>` : ''}</span></span><button class="btn alt sm" data-bst="${k}" data-d="-1">−1</button><span class="boost-val">${v ? signed(v) : '0'}</span><button class="btn alt sm" data-bst="${k}" data-d="1">+1</button></div>`; };
  const body = () => `<h2>Temporary boosts</h2><p class="small muted">For moves like Growl or Bulk Up. Every roll and the Defenses count these. Real stats never change.</p>
    <h4>Attributes</h4>${[...ATTRS].map(row).join('')}<h4>Social</h4>${SOCIAL.map(row).join('')}<h4>Skills</h4>${BOOSTABLE.slice(ATTRS.length + SOCIAL.length).map(row).join('')}
    <div class="row" style="margin-top:10px"><button class="btn alt" id="bclear">Clear all boosts</button><button class="btn" data-close>Done</button></div>`;
  const el = modal(body());
  const wire = () => {
    $$('[data-bst]', el).forEach((b) => b.onclick = () => { setBoost(c, b.dataset.bst, num(b.dataset.d)); paint(); });
    $('#bclear', el).onclick = () => { clearBoosts(cur()); paint(); };
  };
  const paint = () => { const sh = el.querySelector('.sheet') || el; const keep = sh.scrollTop; sh.innerHTML = `<button class="btn alt sm x" data-close>Close</button>${body()}`; sh.scrollTop = keep; wire(); };
  wire();
}
const primalDice = (c) => ((c.status || []).includes('Primal State') ? num(c.instinct) : 0);
const painOf = (c) => ((c.status || []).includes('Primal State') ? 0 : painFor(c.hp ?? maxHp(c), maxHp(c)));

// ---------------------------------------------------------------- move roll
function moveRoll(c, m) {
  const accPool = m.acc.reduce((s, a) => s + statVal(c, a), 0);
  const accMod = num((m.effect.match(/Accuracy\s*-\s*(\d)/i) || [])[1]);
  const chance = num((m.effect.match(/Roll\s+(\d+)\s+Chance Dice/i) || [])[1]);
  const stab = m.type && [c.type1, c.type2].includes(m.type);
  const dmgStat = m.cat === 'Special' ? 'Special' : 'Strength';
  const targets = combatOrder().filter((x) => x.ref !== c.id && (x.kind !== 'enemy' || x.revealed));
  let lastAcc = null;

  const sheetEl = modal(`
    <h2>${esc(m.name)}</h2>
    <div class="chips">${typeChip(m.type)}<span class="pill">${esc(m.cat)}</span>${m.power != null ? `<span class="pill">Power ${m.power}</span>` : ''}</div>
    ${m.effect ? `<p class="small" style="margin-top:8px" id="meff">${esc(m.effect)}</p>` : ''}
    ${/metronome/i.test(m.name) ? `<a class="gemini-wag" href="#/games/gemini-metronome">✨ Gemini's Metronome wheel: spin it to see what luck or chaos answers →</a>` : ''}
    <p class="small"><a href="#" data-ixname="Use a Move">How attacking works</a> · <a href="#" data-ixname="Damage">Damage</a> · <a href="#" data-ixname="Critical hit">Critical hits</a></p>
    <div class="card" style="margin-top:10px">
      <h3>1. Accuracy</h3>
      <p class="small muted">${esc(m.acc.join(' + ') || 'no accuracy listed')} = ${accPool} dice${primalDice(c) ? ` + ${primalDice(c)} Primal` : ''}${painOf(c) ? ` · pain −${painOf(c)} success${painOf(c) > 1 ? 'es' : ''}` : ''}${accMod ? ` · move accuracy −${accMod}` : ''}</p>
      <div class="grid g2">
        <label class="f">Which action this round?<select id="act">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th'} action (needs ${n})</option>`).join('')}</select></label>
        <label class="f">Extra dice<input id="xd" type="number" inputmode="numeric" value="0"></label>
      </div>
      <button class="btn block" id="racc" style="margin-top:10px">Roll accuracy</button>
      <div class="result" id="accres"></div>
    </div>
    ${m.power != null ? `<div class="card">
      <h3>2. Damage</h3>
      <div class="grid g2">
        <label class="f">Target${targets.length ? `<select id="tgt"><option value="">— pick —</option>${targets.map((t) => `<option value="${t.id}" data-def="${t.kind === 'enemy' ? '' : ''}">${esc(t.name)}</option>`).join('')}</select>` : '<input disabled value="No battle running">'}</label>
        <label class="f">Foe's ${m.cat === 'Special' ? 'Sp. Defense (Insight)' : 'Defense (Vitality)'}<input id="def" type="number" inputmode="numeric" value="1"></label>
        <label class="f">Type match-up<select id="eff"><option value="0">Normal</option><option value="1">Super effective (+1)</option><option value="2">Super effective, both types (+2)</option><option value="-1">Not very effective (−1)</option><option value="-2">Not very effective, both (−2)</option><option value="immune">Immune (0)</option></select></label>
        <label class="check"><input type="checkbox" id="stab" ${stab ? 'checked' : ''}> Same type as you (+1 die)</label>
        <label class="check"><input type="checkbox" id="crit"> Critical hit (+2 dice)</label>
      </div>
      <p class="small muted">${dmgStat} ${statVal(c, dmgStat)} + Power ${m.power} − foe's defense</p>
      <button class="btn block" id="rdmg">Roll damage</button>
      <div class="result" id="dmgres"></div>
    </div>` : ''}
    ${chance ? `<div class="card"><h3>Chance dice</h3><p class="small">${chance} chance dice — any 6 triggers the effect.</p><button class="btn block" id="rch">Roll ${chance} chance dice</button><div class="result" id="chres"></div></div>` : ''}
  `);

  if (m.effect) loadIndex().then((ix) => { const el = $('#meff', sheetEl); if (el) el.innerHTML = linkify(m.effect, ix, m.name); });
  $('#racc', sheetEl).onclick = () => {
    const need = num($('#act', sheetEl).value, 1);
    const dice = Math.max(1, accPool + primalDice(c) + num($('#xd', sheetEl).value));
    const r = pool(dice, { pain: painOf(c) + accMod });
    const hit = r.succ >= need;
    const crit = r.succ >= need + 3;
    lastAcc = { hit, crit };
    if ($('#crit', sheetEl)) $('#crit', sheetEl).checked = crit;
    const text = `${r.succ} success${r.succ === 1 ? '' : 'es'} — ${hit ? (crit ? 'CRITICAL HIT!' : 'Hit!') : 'Miss'}`;
    $('#accres', sheetEl).innerHTML = `${diceFaces(r.dice)}<div class="big">${text}</div>${r.onesPen ? `<div class="small muted">two 1s cost ${r.onesPen} success</div>` : ''}<div class="small muted">Foe may Evade (Dex + Evasion) or Clash — they need more successes than you.</div>`;
    logRoll(c.nickname, `${m.name} — accuracy (needs ${need})`, r.dice, text);
  };
  if ($('#rdmg', sheetEl)) $('#rdmg', sheetEl).onclick = () => {
    const def = num($('#def', sheetEl).value);
    const effV = $('#eff', sheetEl).value;
    let dice = statVal(c, dmgStat) + m.power - def + ($('#stab', sheetEl).checked ? 1 : 0) + ($('#crit', sheetEl).checked ? 2 : 0) + primalDice(c);
    dice = Math.max(1, dice);
    const r = pool(dice, { pain: painOf(c) });
    let dmg = effV === 'immune' ? 0 : Math.max(0, r.succ + num(effV));
    const text = `${dmg} damage`;
    const tgtId = $('#tgt', sheetEl)?.value;
    $('#dmgres', sheetEl).innerHTML = `${diceFaces(r.dice)}<div class="big">${text}</div>${tgtId ? `<button class="btn good" id="apply">Take ${dmg} HP from ${esc(targets.find((t) => t.id === tgtId)?.name || '')}</button>` : ''}`;
    logRoll(c.nickname, `${m.name} — damage (${dice} dice)`, r.dice, text);
    if (tgtId) $('#apply', sheetEl).onclick = () => { applyDamage(tgtId, dmg); toast('Done'); closeModal(); };
  };
  if ($('#rch', sheetEl)) $('#rch', sheetEl).onclick = () => {
    const r = roll(chance);
    const hit = r.includes(6);
    $('#chres', sheetEl).innerHTML = `${diceFaces(r, { pool: false })}<div class="big">${hit ? 'Effect triggers!' : 'No effect'}</div>`;
    logRoll(c.nickname, `${m.name} — chance dice`, r, hit ? 'effect triggers!' : 'no effect', 'chance');
  };
}

export function applyDamage(combatantId, dmg) {
  const x = (store.get('combat') || {}).list?.[combatantId];
  if (!x) return;
  const pc = x.ref && party()[x.ref];
  const hp = Math.max(0, (pc ? pc.hp ?? maxHp(pc) : x.hp ?? 0) - dmg);
  if (pc) store.set(`party/${x.ref}/hp`, hp); else store.set(`combat/list/${combatantId}/hp`, hp);
  if (hp === 0) store.pushLimited('log', { t: Date.now(), text: `${x.name} fainted!` });
}

// ---------------------------------------------------------------- quick rolls
function quickRoll(c) {
  const opts = [
    ['Exploring', QUICK_TASKS.map(([l, a, b]) => [l, [a, b]])],
    ['Social', QUICK_SOCIAL.map(([l, a, b]) => [l, [a, b]])],
    ['Special', SPECIAL_ROLLS.filter(([, v]) => v !== 'init')],
  ];
  const all = opts.flatMap(([, list]) => list);
  const sheetEl = modal(`<h2>Quick roll</h2>
    <label class="f">What are you doing?<select id="qr">${opts.map(([g, list]) => `<optgroup label="${g}">${list.map(([l, s]) => `<option value="${all.findIndex((x) => x[0] === l)}">${esc(l)} — ${esc(s.join(' + '))}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <div class="grid g2" style="margin-top:8px">
      <label class="f">Helpers (+1 die each, max 2)<select id="help"><option>0</option><option>1</option><option>2</option></select></label>
      <label class="f">Extra dice<input id="xd" type="number" inputmode="numeric" value="0"></label>
    </div>
    <button class="btn block" id="go" style="margin-top:10px">Roll</button>
    <div class="result" id="res"></div>
    <p class="small muted" style="margin-top:10px">0 = complication · 1 = partial success at a cost · 2 = success · 3+ = excellent, gain a clue or advantage</p>`);
  $('#go', sheetEl).onclick = () => {
    const [label, stats] = all[num($('#qr', sheetEl).value)];
    const dice = Math.max(1, stats.reduce((s, a) => s + statVal(c, a), 0) + num($('#help', sheetEl).value) + num($('#xd', sheetEl).value) + primalDice(c));
    const r = pool(dice, { pain: painOf(c) });
    const out = r.succ === 0 ? 'complication' : r.succ === 1 ? 'partial success' : r.succ === 2 ? 'success' : 'excellent!';
    const text = `${r.succ} success${r.succ === 1 ? '' : 'es'} — ${out}`;
    $('#res', sheetEl).innerHTML = `${diceFaces(r.dice)}<div class="big">${text}</div>`;
    logRoll(c.nickname, `${label} (${stats.join(' + ')})`, r.dice, text);
  };
}

function rollInitiative(c) {
  const d = die(6);
  const total = d + statVal(c, 'Dexterity') + statVal(c, 'Alert');
  logRoll(c.nickname, 'Initiative (1d6 + Dex + Alert)', [d], `${total}`, 'sum');
  const combat = store.get('combat') || {};
  const entry = Object.entries(combat.list || {}).find(([, x]) => x.ref === c.id);
  if (entry) store.set(`combat/list/${entry[0]}/init`, total);
  toast(`Initiative ${total}${entry ? ' — added to the turn order' : ''}`);
}

export function freeRoll(c) {
  const sheetEl = modal(`<h2>Roll dice</h2>
    <h3>Dice pool (successes on 4+)</h3>
    <div class="row nowrap"><input id="pn" type="number" inputmode="numeric" value="3" class="grow" aria-label="Number of dice"><button class="btn" id="rp">Roll pool</button></div>
    <h3 style="margin-top:14px">Plain dice</h3>
    <div class="row nowrap"><input id="xn" type="number" inputmode="numeric" value="2" style="width:70px" aria-label="Count"><span class="pix">d</span>
      <select id="xs" style="width:90px">${[4, 6, 8, 10, 12, 20].map((s) => `<option ${s === 6 ? 'selected' : ''}>${s}</option>`).join('')}</select><span class="pix">+</span><input id="xp" type="number" inputmode="numeric" value="0" style="width:70px" aria-label="Plus"><button class="btn" id="rx">Roll</button></div>
    <h3 style="margin-top:14px">Chance dice (6 triggers)</h3>
    <div class="row nowrap"><input id="cn" type="number" inputmode="numeric" value="1" class="grow" aria-label="Chance dice"><button class="btn" id="rc">Roll</button></div>
    <div class="result" id="res"></div>`);
  const who = c?.nickname || 'Watcher';
  $('#rp', sheetEl).onclick = () => { const r = pool(clamp(num($('#pn', sheetEl).value, 1), 1, 40)); const t = `${r.succ} success${r.succ === 1 ? '' : 'es'}`; $('#res', sheetEl).innerHTML = `${diceFaces(r.dice)}<div class="big">${t}</div>`; logRoll(who, `${r.dice.length}-dice pool`, r.dice, t); };
  $('#rx', sheetEl).onclick = () => { const n = clamp(num($('#xn', sheetEl).value, 1), 1, 40); const s = num($('#xs', sheetEl).value, 6); const p = num($('#xp', sheetEl).value); const r = roll(n, s); const t = `${sum(r) + p}`; $('#res', sheetEl).innerHTML = `${diceFaces(r, { pool: false })}<div class="big">= ${t}</div>`; logRoll(who, `${n}d${s}${p ? (p > 0 ? '+' : '') + p : ''}`, r, t, 'sum', s); };
  $('#rc', sheetEl).onclick = () => { const r = roll(clamp(num($('#cn', sheetEl).value, 1), 1, 20)); const hit = r.includes(6); $('#res', sheetEl).innerHTML = `${diceFaces(r, { pool: false })}<div class="big">${hit ? 'Triggers!' : 'No effect'}</div>`; logRoll(who, `${r.length} chance dice`, r, hit ? 'triggers!' : 'no effect', 'chance'); };
}

// ---------------------------------------------------------------- items
export function addItem(owner, path = 'bag', guild = null) {
  const p = party();
  const sheetEl = modal(`<h2>Add an item</h2>
    <label class="f">Item<input id="nm" list="itemlist" placeholder="e.g. Oran Berry"></label><datalist id="itemlist"></datalist>
    <div class="grid g2" style="margin-top:8px"><label class="f">How many<input id="q" type="number" inputmode="numeric" value="1"></label>
    <label class="f">Who carries it<select id="ow"><option value="team">Team bag</option>${Object.values(p).map((c) => `<option value="${c.id}" ${c.id === owner ? 'selected' : ''}>${esc(c.nickname)}</option>`).join('')}</select></label></div>
    <button class="btn block" id="ok" style="margin-top:10px">Add</button>`);
  sheet.treasure().then((t) => { $('#itemlist', sheetEl).innerHTML = [...new Set([...t.map((x) => x.name), 'Oran Berry', 'Apple', 'Big Apple', 'Reviver Seed', 'Blast Seed', 'Sleep Seed', 'Heal Seed', 'Pecha Berry', 'Cheri Berry', 'Rawst Berry', 'Leppa Berry', 'Sitrus Berry', 'Iron Thorn', 'Geo Pebble', 'Stick'])].map((n) => `<option value="${esc(n)}">`).join(''); });
  $('#ok', sheetEl).onclick = () => {
    const name = $('#nm', sheetEl).value.trim(); if (!name) return;
    const q = Math.max(1, num($('#q', sheetEl).value, 1)); const ow = $('#ow', sheetEl).value;
    const bag = store.get(path) || {};
    const sameG = (b) => path !== 'storage' || (b.guild || 'woodland') === (guild || 'woodland');
    const same = Object.entries(bag).find(([, b]) => b.name.toLowerCase() === name.toLowerCase() && b.owner === ow && sameG(b));
    if (same) store.set(`${path}/${same[0]}/qty`, same[1].qty + q); else store.set(`${path}/${uid()}`, { name, qty: q, owner: ow, ...(path === 'storage' ? { guild: guild || 'woodland' } : {}) });
    if (path === 'storage') ledger(guild, `${me()?.nickname || 'GM'} added ${name} ×${q} to storage`);
    closeModal();
  };
}

function useItem(id, c) {
  const b = (store.get('bag') || {})[id]; if (!b) return;
  if (b.qty <= 1) store.set('bag/' + id, null); else store.set(`bag/${id}/qty`, b.qty - 1);
  store.pushLimited('log', { t: Date.now(), text: `${c.nickname} used ${b.name}.` });
  logRoll(c.nickname, `used ${b.name}`, null, '', 'note');
  toast(`${b.name} used`);
}

// ---------------------------------------------------------------- view / edit characters
export function viewCharacter(id) {
  const c = party()[id]; if (!c) return;
  const mx = maxHp(c);
  modal(`<div class="char-head">${portrait(c)}<div class="grow"><div class="char-name">${esc(c.nickname)}</div><div class="char-sub">${esc(c.pokemon)} · ${esc(c.rank || '')} · ${esc(c.nature || '')}</div>
    <div class="chips" style="margin-top:4px">${typeChip(c.type1)}${typeChip(c.type2)}${c.ability ? `<span class="pill">${esc(c.ability)}</span>` : ''}</div></div></div>
    <div class="meter"><b>HP</b>${bar(c.hp, mx)}<span class="val">${c.hp}/${mx}</span></div>
    <div class="meter"><b>Will</b>${bar(c.willCur, c.will, 'will')}<span class="val">${c.willCur ?? 0}/${c.will}</span></div>
    <p class="small" style="color:var(--bad)">${esc((c.status || []).join(', '))}</p>
    <p class="small"><b>Moves:</b> ${esc((c.moves || []).join(', ') || '—')}</p>
    ${statGrids(c)}
    ${store.gmUnlocked() ? memoryFeedHTML(c) : ''}
    <div class="row" style="margin-top:12px"><button class="btn alt" id="ed">Edit</button></div>`, (el) => { $('#ed', el).onclick = () => editCharacter(id); });
}

const FIELD = (k, label, v, type = 'text', extra = '') => `<label class="f">${label}<input data-k="${k}" type="${type}" ${type === 'number' ? 'inputmode="numeric"' : ''} value="${esc(v ?? '')}" ${extra}></label>`;
const SELECT = (k, label, v, opts) => `<label class="f">${label}<select data-k="${k}"><option value=""></option>${opts.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;

export function editCharacter(id, onCreated) {
  const isNew = !id;
  const c = isNew ? { nickname: '', pokemon: '', rank: 'Starter', instinctRank: 'Cub', logic: 2, instinct: 1, humanity: 6, primal: 0, will: 3, baseHp: 3, moves: [], status: [], tp: 0 } : structuredClone(party()[id]);
  const sheetEl = modal(`<h2>${isNew ? 'New character' : 'Edit ' + esc(c.nickname)}</h2>
    ${isNew ? `<div class="win tight small" style="font-size:16px;margin-bottom:10px">1. Fill in the <a href="https://forms.gle/GYmxXLQ7a3rcVRoH6" target="_blank" rel="noopener">Background Form</a> first (who you were).<br>2. Build your Pokémon below using the Rulebook for stat points — starter rank, non-legendary, lives mostly on land.<br>3. Logic and Instinct start at 1; add +1 to one of them. Humanity 6 with Logic 2/Instinct 1, or 4 with Logic 1/Instinct 2.</div>` : ''}
    <div class="grid g2">
      ${FIELD('nickname', 'Name', c.nickname)}${FIELD('pokemon', 'Pokémon', c.pokemon)}
      ${SELECT('nature', 'Nature', c.nature, NATURES)}${SELECT('rank', 'Rank', c.rank, RANK_NAMES)}
      ${SELECT('type1', 'Type 1', c.type1, TYPES)}${SELECT('type2', 'Type 2', c.type2, TYPES)}
      ${FIELD('ability', 'Ability', c.ability)}${SELECT('instinctRank', 'Instinct rank', c.instinctRank, ['Prey', 'Cub', 'Beta', 'Hunter', 'Alpha', 'Predator'])}
    </div>
    <h4 style="margin-top:10px">Mystery Dungeon scores</h4>
    <div class="grid g4" style="grid-template-columns:repeat(2,1fr)">${FIELD('logic', 'Logic', c.logic, 'number')}${FIELD('instinct', 'Instinct', c.instinct, 'number')}${FIELD('humanity', 'Humanity', c.humanity, 'number')}${FIELD('primal', 'Primal points', c.primal, 'number')}
      ${FIELD('baseHp', 'Base HP', c.baseHp, 'number')}${FIELD('will', 'Will', c.will, 'number')}${FIELD('tp', 'Training Points', c.tp, 'number')}${FIELD('poke', 'Poké', c.poke ?? 0, 'number')}${SELECT('guild', 'Guild', c.guild || 'woodland', ['woodland', 'vanguard'])}${FIELD('hp', 'Current HP', c.hp ?? '', 'number')}</div>
    <h4 style="margin-top:10px">Attributes</h4><div class="grid" style="grid-template-columns:repeat(2,1fr)">${ATTRS.map((a) => FIELD(a, a, c[a] ?? 1, 'number')).join('')}</div>
    <h4 style="margin-top:10px">Skills</h4><div class="grid" style="grid-template-columns:repeat(2,1fr)">${SKILLS.map((a) => FIELD(a, a, c[a] ?? 0, 'number')).join('')}</div>
    <h4 style="margin-top:10px">Social</h4><div class="grid" style="grid-template-columns:repeat(2,1fr)">${SOCIAL.map((a) => FIELD(a, a === 'Clever' ? 'Smart/Clever' : a, c[a] ?? 1, 'number')).join('')}</div>
    <h4 style="margin-top:10px">Moves (one per line)</h4><textarea data-k="moves" rows="5">${esc((c.moves || []).join('\n'))}</textarea>
    <div class="grid g2" style="margin-top:8px">${FIELD('held', 'Held item', c.held)}${FIELD('garments', 'Garments', c.garments)}${FIELD('player', 'Player', c.player)}</div>
    ${FIELD('line', 'Mess hall line (your speech bubble on the Play screen)', c.line, 'text', 'maxlength="120" placeholder="e.g. Pass the Oran Berries!"')}
    <label class="f" style="margin-top:8px">Notes<textarea data-k="notes">${esc(c.notes || '')}</textarea></label>
    ${store.gmUnlocked() ? `<div class="card" style="margin-top:10px"><h4>${ixLink('Guest party member', 'Guest')} (temporary party member)</h4>
      <label class="check"><input type="checkbox" id="isguest" ${c.guest ? 'checked' : ''}> This is a guest / escort / NPC helper</label>
      <div class="grid g2"><label class="f">Leaves<select id="gleave">${['mission', 'floor', 'session', 'manual'].map((o) => `<option ${c.guest?.leaves === o ? 'selected' : ''} value="${o}">${{ mission: 'when the mission ends', floor: 'at the next floor', session: 'at the end of the session', manual: 'when I remove them' }[o]}</option>`).join('')}</select></label>
      <label class="f">Controlled by<select id="gctl"><option value="gm" ${c.guest?.controller !== 'player' ? 'selected' : ''}>GM</option><option value="player" ${c.guest?.controller === 'player' ? 'selected' : ''}>A player can pick them</option></select></label></div></div>` : ''}
    <div class="row" style="margin-top:12px"><button class="btn" id="save">Save</button>${isNew || !store.gmUnlocked() ? '' : '<button class="btn bad" id="del">Remove</button>'}</div>`);
  $('#save', sheetEl).onclick = () => {
    $$('[data-k]', sheetEl).forEach((el) => {
      const k = el.dataset.k;
      if (k === 'moves') c.moves = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
      else if (el.type === 'number') c[k] = el.value === '' ? null : num(el.value);
      else c[k] = el.value.trim();
    });
    if (!c.nickname) { toast('Give your character a name'); return; }
    if ((c.line || '') !== ((id && party()[id]?.line) || '')) c.lineT = Date.now();
    const nid = id || uid();
    c.id = nid;
    if (c.hp == null) c.hp = maxHp(c);
    c.hp = clamp(c.hp, 0, maxHp(c));
    if (c.willCur == null || c.willCur > c.will) c.willCur = c.will;
    const gEl = $('#isguest', sheetEl);
    if (gEl) c.guest = gEl.checked ? { leaves: $('#gleave', sheetEl).value, controller: $('#gctl', sheetEl).value, since: c.guest?.since || Date.now() } : null;
    if (isNew) store.set('party/' + nid, c);
    else {
      // Only the editor's own fields go onto the live sheet, so status/HP/boosts changed meanwhile aren't undone.
      const keys = [...$$('[data-k]', sheetEl).map((el) => el.dataset.k), 'lineT', ...(gEl ? ['guest'] : [])];
      store.update('party/' + nid, (x) => { x = x || {}; keys.forEach((k) => { if (k in c) x[k] = c[k]; }); x.hp = clamp(x.hp ?? maxHp(x), 0, maxHp(x)); if (x.willCur == null || x.willCur > x.will) x.willCur = x.will; return x; });
    }
    closeModal();
    if (isNew) onCreated?.(nid);
  };
  if ($('#del', sheetEl)) $('#del', sheetEl).onclick = () => { if (confirm(`Remove ${c.nickname} from this table?`)) { store.set('party/' + id, null); closeModal(); } };
}

export { RULES, CONFIG };


function statGrids(c) {
  // one panel per group (PokéRole's own groups), each in its own colour: body = amber, Fight = clay red, Survival = moss, Contest = lilac, Social = berry
  const panel = (title, list, cls) => `<div class="stat-panel ${cls}"><h4 class="stat-h">${title}</h4>${list.map((a) => { const v = boostOf(c, a); return `<a href="#" class="stat ${cls}${v ? (v > 0 ? ' boosted up' : ' boosted down') : ''}" data-ixname="${a}">${a}<b>${v ? `${v > 0 ? '▲' : '▼'}${num(c[a]) + v}` : c[a] ?? 0}</b></a>`; }).join('')}</div>`;
  return `<div class="stat-cols two">${panel('💪 Attributes', ATTRS, 'st-body')}${panel('💬 Social', SOCIAL, 'st-social')}</div>
    <h4 class="stat-h st-survive stat-skills">🍃 Skills</h4>
    <div class="stat-cols rows">${panel('⚔️ Fight', ['Brawl', 'Channel', 'Clash', 'Evasion'], 'st-fight')}${panel('🌲 Survival', ['Alert', 'Athletic', 'Nature', 'Stealth'], 'st-survive')}${panel('🎀 Contest', ['Allure', 'Etiquette', 'Intimidate', 'Perform'], 'st-contest')}</div>`;
}

function pickStatus(c) {
  const el = modal(`<h2>Status for ${esc(c.nickname)}</h2><p class="small muted">Tap a condition to add or remove it. Tap "What is it?" to read the rule.</p>
    <div class="stack">${STATUSES.map((s) => `<div class="row nowrap"><button class="chip grow ${(c.status || []).includes(s) ? 'on' : ''}" data-st="${esc(s)}" style="justify-content:flex-start;min-height:44px">${esc(s)}</button><a href="#" class="btn alt sm" data-ixname="${esc(STATUS_IX[s] || s)}">What is it?</a></div>`).join('')}</div>`);
  $$('[data-st]', el).forEach((b) => b.onclick = () => {
    store.update('party/' + c.id, (x) => { const s = new Set(x.status || []); s.has(b.dataset.st) ? s.delete(b.dataset.st) : s.add(b.dataset.st); x.status = [...s]; return x; });
    b.classList.toggle('on');
    window.dispatchEvent(new Event('refreshpage'));   // the sheet behind updates straight away
  });
}

wireRolls(me, statVal, logRoll);

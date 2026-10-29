// Friendly Battles (her ask 10-29): battle a friend's character live, laid out like the main Pokémon games: the foe on a
// platform at the top right, your own Pokémon from behind at the bottom left, HP boxes, a text box and a FIGHT menu.
// Practice only: both start at full HP and the real character sheets never change. Same dice as the table: accuracy
// needs 1 success (4+, two 1s cancel one, pain from low HP), damage = Strength/Special + Power − Vitality/Insight.
// battles/<id> = { a, b, phase: ask|fight|done|off, t, round, hp{}, max{}, picks{id: move}, mods{id: {stat: n}},
//   cond{id: {sleep, confused, yawn, encore}}, last{id: move}, ev[{text, hp{}, fx, who}], evRound, winner, lastAct }
// Both players pick a move; when both are in, player a's device works out the round (player b's after a short wait).
import * as store from './store.js?v=6ae38138';
import { $, $$, esc, toast, num, uid, pool, painFor, die, roll } from './util.js?v=6ae38138';
import { portrait, maxHp } from './ui.js?v=6ae38138';
import { allMoves, me, statVal } from './play.js?v=6ae38138';
import { ensureAudio, jingle, missSound } from './chiptune.js?v=6ae38138';

export const isBattle = (g) => g.kind === 'battle' || g.id === 'friendly-battle';
export const GAME_ID = 'friendly-battle';
const P = (id) => 'battles/' + id;
const party = () => store.get('party') || {};
const pc = (id) => party()[id] || {};
const foeOf = (B, id) => (id === B.a ? B.b : B.a);
const nm = (id) => pc(id).nickname || 'Someone';

// PMD Explorers-style idle sprites (SpriteCollab): front = facing down-left (the foe), back = facing up-right (you)
const SPRITES = { golett: [32, 48, 5, 1433], tinkatink: [32, 24, 4, 1400], jangmoo: [32, 40, 4, 1333], sudowoodo: [24, 40, 1, 133], swablu: [32, 40, 9, 900],
  magnemite: [24, 32, 4, 800], slakoth: [40, 32, 2, 1133], cleffa: [24, 32, 2, 900], cottonee: [24, 24, 4, 800] };
function spriteHTML(c, side) {
  const k = String(c.pokemon || '').toLowerCase().replace(/[^a-z]/g, '');
  const s = SPRITES[k];
  if (!s) return `<div class="bt-port">${portrait(c)}</div>`;
  const [w, h, n, ms] = s;
  return `<div class="bt-spr" style="--w:${w};--h:${h};--n:${n};--ms:${ms}ms;background-image:url(assets/battle/${k}_${side}.png)" role="img" aria-label="${esc(c.pokemon)}"></div>`;
}

// type chart (attacking type: [super effective against], [not very effective against], [no effect on])
const CHART = {
  Normal: [[], ['Rock', 'Steel'], ['Ghost']], Fire: [['Grass', 'Ice', 'Bug', 'Steel'], ['Fire', 'Water', 'Rock', 'Dragon'], []],
  Water: [['Fire', 'Ground', 'Rock'], ['Water', 'Grass', 'Dragon'], []], Electric: [['Water', 'Flying'], ['Electric', 'Grass', 'Dragon'], ['Ground']],
  Grass: [['Water', 'Ground', 'Rock'], ['Fire', 'Grass', 'Poison', 'Flying', 'Bug', 'Dragon', 'Steel'], []], Ice: [['Grass', 'Ground', 'Flying', 'Dragon'], ['Fire', 'Water', 'Ice', 'Steel'], []],
  Fighting: [['Normal', 'Ice', 'Rock', 'Dark', 'Steel'], ['Poison', 'Flying', 'Psychic', 'Bug', 'Fairy'], ['Ghost']], Poison: [['Grass', 'Fairy'], ['Poison', 'Ground', 'Rock', 'Ghost'], ['Steel']],
  Ground: [['Fire', 'Electric', 'Poison', 'Rock', 'Steel'], ['Grass', 'Bug'], ['Flying']], Flying: [['Grass', 'Fighting', 'Bug'], ['Electric', 'Rock', 'Steel'], []],
  Psychic: [['Fighting', 'Poison'], ['Psychic', 'Steel'], ['Dark']], Bug: [['Grass', 'Psychic', 'Dark'], ['Fire', 'Fighting', 'Poison', 'Flying', 'Ghost', 'Steel', 'Fairy'], []],
  Rock: [['Fire', 'Ice', 'Flying', 'Bug'], ['Fighting', 'Ground', 'Steel'], []], Ghost: [['Psychic', 'Ghost'], ['Dark'], ['Normal']],
  Dragon: [['Dragon'], ['Steel'], ['Fairy']], Dark: [['Psychic', 'Ghost'], ['Fighting', 'Dark', 'Fairy'], []],
  Steel: [['Ice', 'Rock', 'Fairy'], ['Fire', 'Water', 'Electric', 'Steel'], []], Fairy: [['Fighting', 'Dragon', 'Dark'], ['Fire', 'Poison', 'Steel'], []],
};
function typeEff(type, defTypes) {
  const row = CHART[type]; if (!row) return { n: 0, immune: false };
  let n = 0; let immune = false;
  for (const t of defTypes.filter(Boolean)) { if (row[2].includes(t)) immune = true; else if (row[0].includes(t)) n++; else if (row[1].includes(t)) n--; }
  return { n, immune };
}

// moves: the site's moves list (cached), Struggle always there
let movesP = null;
const moveIndex = () => (movesP ||= allMoves().then((l) => new Map(l.map((m) => [m.name.toLowerCase(), m]))));
const STRUGGLE = { name: 'Struggle', type: '', cat: 'Physical', acc: ['Dexterity', 'Brawl'], power: 0, effect: '' };
const alias = (n) => ({ metranome: 'metronome' }[String(n).toLowerCase()] || String(n).toLowerCase());
const moveOf = (ix, name) => (name === 'Struggle' ? STRUGGLE : ix.get(alias(name)) || { name, type: 'Normal', cat: 'Status', acc: [], power: null, effect: '' });
// a stat in battle: "Tough/cute" = the better one; battle-only drops (Growl, Leer...) count too
const STAT_ALIAS = { defense: 'Vitality', 'special defense': 'Insight', 'sp. defense': 'Insight', attack: 'Strength', 'special attack': 'Special' };
const bstat = (B, id, name) => Math.max(...String(name).split('/').map((n) => { const k = STAT_ALIAS[n.trim().toLowerCase()] || n.trim(); return statVal(pc(id), k) + num(B.mods?.[id]?.[k.toLowerCase()]); }));

// ---------------------------------------------------------------- one round
async function resolve(bid) {
  const B = structuredClone(store.get(P(bid)) || {});
  if (B.phase !== 'fight' || ![B.a, B.b].every((id) => B.picks?.[id])) return;
  const ix = await moveIndex();
  const hp = { ...B.hp }; const ev = []; const cond = B.cond || {}; B.mods ||= {}; B.last ||= {};
  const say = (text, fx = '', who = '') => ev.push({ text, fx, who, hp: { ...hp } });
  const init = Object.fromEntries([B.a, B.b].map((id) => [id, die(6) + bstat(B, id, 'Dexterity') + bstat(B, id, 'Alert') + Math.random() / 10]));
  const order = [B.a, B.b].sort((x, y) => init[y] - init[x]);
  const flinched = {};
  for (const id of order) {
    const foe = foeOf(B, id); const c = cond[id] ||= {};
    if (hp[id] <= 0 || hp[foe] <= 0) break;
    if (flinched[id]) { say(`${nm(id)} flinched and couldn’t move!`); continue; }
    if (c.sleep) { c.sleep--; say(c.sleep ? `${nm(id)} is fast asleep.` : `${nm(id)} woke up!`); if (c.sleep) continue; }
    if (c.confused) {
      c.confused--; say(`${nm(id)} is confused!`);
      if (die(3) === 1) { hp[id] = Math.max(0, hp[id] - 1); say('It hurt itself in its confusion!', 'hit', id); if (hp[id] <= 0) { say(`${nm(id)} fainted!`, 'faint', id); break; } continue; }
      if (!c.confused) say(`${nm(id)} snapped out of its confusion!`);
    }
    const m = moveOf(ix, B.picks[id]); B.last[id] = m.name;
    say(`${nm(id)} used ${m.name}!`, 'use', id);
    const pain = painFor(hp[id], B.max[id]);
    const accMod = num((m.effect.match(/(?:-|−)\s*(\d)\s*Accuracy|Accuracy\s*-\s*(\d)/i) || []).slice(1).find(Boolean));
    const acc = m.acc.length ? pool(Math.max(1, m.acc.reduce((s, a) => s + bstat(B, id, a), 0)), { pain: pain + accMod }) : { succ: 1 };
    if (acc.succ < 1) { say(`${nm(id)}’s attack missed!`, 'miss'); continue; }
    const f = pc(foe);
    if (m.power == null) { statusMove(B, m, id, foe, cond, say); continue; }
    // Metronome: a die decides its power
    const power = /metronome/i.test(m.name) ? die(6) : num(m.power);
    if (/metronome/i.test(m.name)) say(`Gemini’s luck says Power ${power}!`);
    const eff = typeEff(m.type, [f.type1, f.type2]);
    if (eff.immune) { say(`It doesn’t affect ${nm(foe)}…`); continue; }
    const crit = acc.succ >= 4;
    const stab = m.type && [pc(id).type1, pc(id).type2].includes(m.type);
    const flail = /missing HP/i.test(m.effect) ? Math.min(5, B.max[id] - hp[id]) : 0;
    const dice = Math.max(1, bstat(B, id, m.cat === 'Special' ? 'Special' : 'Strength') + power - bstat(B, foe, m.cat === 'Special' ? 'Insight' : 'Vitality') + (stab ? 1 : 0) + (crit ? 2 : 0) + flail);
    const dmg = Math.max(1, pool(dice, { pain }).succ + eff.n);  // a hit always does at least 1
    hp[foe] = Math.max(0, hp[foe] - dmg);
    say(`${nm(foe)} took ${dmg} damage!`, 'hit', foe);
    if (crit) say('A critical hit!');
    if (eff.n > 0) say('It’s super effective!'); else if (eff.n < 0) say('It’s not very effective…');
    if (/restores HP equal to half the damage/i.test(m.effect) && hp[id] < B.max[id] && Math.floor(dmg / 2)) { hp[id] = Math.min(B.max[id], hp[id] + Math.floor(dmg / 2)); say(`${nm(id)} drained some energy!`, 'heal', id); }
    const ch = num((m.effect.match(/Roll\s+(\d+)\s+Chance Dice to Flinch/i) || [])[1]);
    if (ch && hp[foe] > 0 && roll(ch).includes(6) && order.indexOf(id) === 0) flinched[foe] = true;
    if (hp[foe] <= 0) { say(`${nm(foe)} fainted!`, 'faint', foe); break; }
  }
  // Yawn: drowsy at the end of the round, asleep for the next one
  for (const id of [B.a, B.b]) { const c = cond[id] ||= {}; if (c.yawn && hp[id] > 0) { c.yawn = 0; c.sleep = 2; say(`${nm(id)} fell asleep!`); } else if (c.yawnSet) { c.yawnSet = 0; c.yawn = 1; } }
  const out = [B.a, B.b].filter((id) => hp[id] <= 0);
  const winner = out.length ? [B.a, B.b].find((id) => hp[id] > 0) || '' : null;
  if (winner !== null) {
    say(winner ? `${nm(winner)} won the battle!` : 'Both fainted! It’s a draw.', 'win', winner);
    store.pushLimited('log', { t: Date.now(), text: winner ? `⚔️ ${nm(winner)} beat ${nm(foeOf(B, winner))} in a friendly battle!` : `⚔️ ${nm(B.a)} and ${nm(B.b)} fought to a draw.` });
  }
  // only if nobody else worked out this round first
  if ((store.get(P(bid))?.round) !== B.round) return;
  store.set(P(bid), { ...B, hp, cond, picks: {}, ev, evRound: B.round, round: B.round + 1, phase: winner !== null ? 'done' : 'fight', winner: winner || '', lastAct: Date.now() });
}

function statusMove(B, m, id, foe, cond, say) {
  const e = m.effect || '';
  const lower = e.match(/Reduce (?:the )?foe'?’?s (Strength|Special|Dexterity|Defense|Special Defense|Vitality|Insight)(?: by (\d))?/i) || e.match(/Reduce the (Defense|Strength) of those affected/i);
  const raise = e.match(/Increase (?:the )?user'?’?s (Strength|Special|Dexterity|Defense|Special Defense|Vitality|Insight)(?: by (\d))?/i);
  if (lower || raise) {
    const [who, mm, sign] = lower ? [foe, lower, -1] : [id, raise, 1];
    const k = (STAT_ALIAS[mm[1].toLowerCase()] || mm[1]).toLowerCase(); const by = num(mm[2]) || 1;
    B.mods[who] ||= {}; B.mods[who][k] = num(B.mods[who][k]) + sign * by;
    const label = { strength: 'Strength', special: 'Special', dexterity: 'Dexterity', vitality: 'Defense', insight: 'Special Defense' }[k] || k;
    return say(`${nm(who)}’s ${label} ${sign < 0 ? 'fell' : 'rose'}${by > 1 ? ' sharply' : ''}!`, sign < 0 ? 'down' : 'up', who);
  }
  if (/confuse/i.test(e)) { cond[foe] = { ...(cond[foe] || {}), confused: 2 }; return say(`${nm(foe)} became confused!`); }
  if (/fall asleep/i.test(e)) { cond[foe] = { ...(cond[foe] || {}), yawnSet: 1 }; return say(`${nm(foe)} grew drowsy!`); }
  if (/repeat the exact same action/i.test(e)) {
    if (!B.last[foe]) return say('But it failed!');
    cond[foe] = { ...(cond[foe] || {}), encore: B.last[foe], encoreN: 2 }; return say(`${nm(foe)} must keep using ${B.last[foe]}!`);
  }
  say('But nothing happened in a practice battle!');
}

// ---------------------------------------------------------------- start / answer / leave
export function challenge(foeId) {
  const c = me(); if (!c) return toast('Pick your character first.');
  const f = pc(foeId); if (!f.id) return;
  const bid = uid();
  const mx = { [c.id]: Math.max(1, maxHp(c)), [foeId]: Math.max(1, maxHp(f)) };
  store.set(P(bid), { a: c.id, b: foeId, phase: 'ask', t: Date.now(), round: 1, hp: { ...mx }, max: mx, lastAct: Date.now() });
  store.set(`invites/${foeId}/${uid()}`, { from: c.nickname, fromId: c.id, game: `${GAME_ID}/${bid}`, name: 'a Friendly Battle', t: Date.now() });
  location.hash = `#/games/${GAME_ID}/${bid}`;
}
const myBattles = (id) => Object.entries(store.get('battles') || {}).filter(([, B]) => B && (B.a === id || B.b === id) && ['ask', 'fight'].includes(B.phase) && Date.now() - num(B.lastAct) < 24 * 3600e3);

// ---------------------------------------------------------------- pages
export function renderBattle(main, g, bid) {
  if (bid) return renderFight(main, bid);
  // old finished battles are tidied away by whoever opens the lobby
  for (const [k, B] of Object.entries(store.get('battles') || {})) if (B && Date.now() - num(B.lastAct) > (['done', 'off'].includes(B.phase) ? 3600e3 : 24 * 3600e3)) store.set(P(k), null);
  const draw = () => {
    const c = me();
    const friends = new Set(Array.isArray(c?.friends) ? c.friends : []);
    const others = Object.values(party()).filter((x) => c && x.id !== c.id && (!x.guest || x.guest.controller === 'player')).sort((x, y) => friends.has(y.id) - friends.has(x.id));
    const open = c ? myBattles(c.id) : [];
    main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a></div>
      <h1 style="margin:10px 0 4px">⚔️ ${esc(g.name)}</h1><p>${esc(g.intro || '')}</p>
      <p><span class="pill">❤️ Everyone starts at full HP</span> <span class="pill">📜 Your sheet never changes</span> <span class="pill">👥 Live with a friend</span></p>
      <details class="card small"><summary><b>How it works</b></summary><ol>
        <li>Pick someone below and press <b>Challenge</b>. They get a pop-up to accept.</li>
        <li>Each round you both pick a move from <b>FIGHT</b>. The faster Pokémon (1d6 + Dexterity + Alert) goes first.</li>
        <li>Moves roll the table’s dice: accuracy needs 1 success; damage is Strength or Special + Power − their Defense (Vitality) or Special Defense (Insight). Same type as you +1 die, a critical hit +2 dice, type match-ups count.</li>
        <li>Status moves work for the battle only: Growl, Charm and Leer lower stats, Supersonic confuses, Yawn puts the foe to sleep, Encore locks their move.</li>
        <li>First to 0 HP loses. <b>Run</b> gives up.</li></ol></details>
      ${!c ? '<p class="card">Pick your character first (Play tab), then come and battle.</p>' : `
      ${open.length ? `<h2 class="games-h">Your battles</h2><ul class="sentry-roster fr-list">${open.map(([k, B]) => `<li>${portrait(pc(foeOf(B, c.id)), 'sm')}<span class="grow"><b>vs ${esc(nm(foeOf(B, c.id)))}</b><br><span class="small muted">${B.phase === 'ask' ? (B.a === c.id ? 'Waiting for them to accept' : 'They challenged you!') : `Round ${num(B.round)}`}</span></span><span class="fr-acts"><a class="btn sm" href="#/games/${GAME_ID}/${esc(k)}">${B.phase === 'ask' && B.b === c.id ? 'Answer' : 'Open'}</a></span></li>`).join('')}</ul>` : ''}
      <h2 class="games-h">Challenge someone</h2>
      <ul class="sentry-roster fr-list">${others.map((x) => `<li>${portrait(x, 'sm')}<span class="grow"><b>${esc(x.nickname)}</b>${friends.has(x.id) ? ' <span class="pill">Friend</span>' : ''}<br><span class="small muted">${esc(x.pokemon || '')} · ${maxHp(x)} HP</span></span><span class="fr-acts"><button class="btn sm" data-ch="${esc(x.id)}">⚔️ Challenge</button></span></li>`).join('') || '<li class="muted">Nobody else at the table yet.</li>'}</ul>`}`;
    $$('[data-ch]', main).forEach((b) => b.onclick = () => challenge(b.dataset.ch));
  };
  draw();
  let last = '';
  const off = store.subscribe(() => { if (!main.isConnected || !/friendly-battle\/?$/.test(location.hash)) return off(); const now = JSON.stringify(store.get('battles') || {}) + (me()?.id || ''); if (now !== last) { last = now; draw(); } });
}

function renderFight(main, bid) {
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games/${GAME_ID}">← Battles</a></div><div class="bt-wrap" id="bt"></div>`;
  const box = $('#bt', main);
  const seen = (() => { try { const v = sessionStorage.getItem('dc.bt.' + bid); return v == null ? -1 : num(v); } catch { return -1; } })();
  let shownRound = seen; let playing = false; let view = null; let resolving = 0; let waitT = 0;
  const markSeen = (r) => { shownRound = r; try { sessionStorage.setItem('dc.bt.' + bid, String(r)); } catch { /* ignore */ } };

  const scene = (B, myId, hpView, text, fx = {}) => {
    const near = myId && [B.a, B.b].includes(myId) ? myId : B.a; const far = foeOf(B, near);
    const hb = (id, mine) => { const c = pc(id); const h = hpView[id]; const mx = B.max[id]; const pct = Math.max(0, Math.min(100, (h / mx) * 100));
      return `<div class="bt-hp ${mine ? 'near' : 'far'}"><div class="bt-nm"><b>${esc(c.nickname || '?')}</b><span>${esc(c.pokemon || '')}</span></div>
        <div class="bt-bar"><span>HP</span><i><b class="${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}" style="width:${pct}%"></b></i></div>${mine ? `<div class="bt-num">${h} / ${mx}</div>` : ''}</div>`; };
    return `<div class="bt-scene">
      <div class="bt-side far ${fx[far] || ''}">${spriteHTML(pc(far), 'front')}</div>${hb(far, false)}
      <div class="bt-side near ${fx[near] || ''}">${spriteHTML(pc(near), 'back')}</div>${hb(near, true)}
    </div><div class="bt-low"><div class="bt-text">${text}</div><div class="bt-menu" id="btmenu"></div></div>`;
  };

  const menuHTML = async (B, myId) => {
    const c = pc(myId); const cd = B.cond?.[myId] || {};
    if (B.picks?.[myId]) return `<p class="bt-wait">Waiting for ${esc(nm(foeOf(B, myId)))}…</p><button class="btn alt sm" data-run>🏃 Run</button>`;
    const ix = await moveIndex();
    const list = cd.encore && cd.encoreN ? [cd.encore] : [...(c.moves || []), 'Struggle'];
    return `<div class="bt-moves">${list.map((n) => { const m = moveOf(ix, n); return `<button class="bt-mv ty-${esc(m.type || 'Normal')}" data-mv="${esc(n)}"><b>${esc(m.name)}</b><small>${m.type ? esc(m.type) + ' · ' : ''}${m.power == null ? 'Status' : 'Power ' + (/metronome/i.test(m.name) ? '?' : m.power)}</small></button>`; }).join('')}</div><button class="btn alt sm" data-run>🏃 Run</button>`;
  };

  const wire = (B, myId) => {
    $$('[data-mv]', box).forEach((b) => b.onclick = () => {
      ensureAudio(); $$('[data-mv]', box).forEach((x) => { x.disabled = true; });
      const cd = B.cond?.[myId];
      if (cd?.encoreN) store.update(`${P(bid)}/cond/${myId}`, (x) => ({ ...x, encoreN: num(x?.encoreN) - 1 }));
      store.set(`${P(bid)}/picks/${myId}`, b.dataset.mv);
      store.set(`${P(bid)}/lastAct`, Date.now());
      maybeResolve();
    });
    const run = $('[data-run]', box);
    if (run) run.onclick = () => { if (!confirm('Give up this battle?')) return; const foe = foeOf(B, myId);
      store.set(P(bid), { ...B, phase: 'done', winner: foe, picks: {}, ev: [{ text: `${nm(myId)} ran away! ${nm(foe)} wins.`, fx: 'win', who: foe, hp: B.hp }], evRound: B.round, round: B.round + 1, lastAct: Date.now() }); };
  };

  const maybeResolve = () => {
    const B = store.get(P(bid)); if (!B || B.phase !== 'fight' || ![B.a, B.b].every((id) => B.picks?.[id]) || resolving === B.round) return;
    const myId = me()?.id;
    if (myId === B.a) { resolving = B.round; resolve(bid); return; }
    // player b (or anyone watching) steps in if player a's device doesn't
    clearTimeout(waitT); waitT = setTimeout(() => { const B2 = store.get(P(bid)); if (B2 && B2.round === B.round && B2.phase === 'fight') { resolving = B.round; resolve(bid); } }, myId === B.b ? 4000 : 9000);
  };

  // play the last round's messages one by one (HP bars move with them)
  const playEvents = async (B, myId) => {
    playing = true;
    let hpView = { ...(B.ev[0]?.hp || B.hp) };
    for (const e of B.ev) {
      if (!box.isConnected) return;
      const fx = {}; if (e.fx === 'hit' || e.fx === 'faint') fx[e.who] = e.fx; if (e.fx === 'use') fx[e.who] = 'lunge'; if (e.fx === 'heal' || e.fx === 'up') fx[e.who] = 'glow'; if (e.fx === 'down') fx[e.who] = 'shrink';
      if (e.fx === 'miss') missSound();
      hpView = { ...e.hp };
      box.innerHTML = scene(B, myId, hpView, esc(e.text), fx);
      await new Promise((r) => setTimeout(r, e.fx === 'use' ? 900 : 1400));
    }
    markSeen(B.evRound);
    if (B.phase === 'done' && myId && [B.a, B.b].includes(myId)) jingle(B.winner === myId);
    playing = false; draw();
  };

  const draw = async () => {
    const B = store.get(P(bid));
    if (!B) { box.innerHTML = '<div class="card"><p>This battle is over and tidied away.</p><a class="btn" href="#/games/friendly-battle">Back to Battles</a></div>'; return; }
    const myId = me()?.id; const mine = [B.a, B.b].includes(myId);
    if (playing) return;
    if (B.ev?.length && num(B.evRound) > shownRound) return playEvents(B, myId);
    if (B.phase === 'ask') {
      box.innerHTML = `<div class="card bt-ask"><div class="row">${portrait(pc(B.a), 'sm')}<b>⚔️ vs</b>${portrait(pc(B.b), 'sm')}</div>
        <h2>${esc(nm(B.a))} challenged ${esc(nm(B.b))}!</h2>
        ${myId === B.b ? '<button class="btn" id="btyes">⚔️ Accept</button> <button class="btn alt" id="btno">Not now</button>' : myId === B.a ? `<p>Waiting for ${esc(nm(B.b))} to accept…</p><button class="btn alt" id="btno">Cancel</button>` : '<p class="muted">Waiting for them to start.</p>'}</div>`;
      const y = $('#btyes', box); if (y) y.onclick = () => store.set(P(bid), { ...B, phase: 'fight', ev: [{ text: `${nm(B.a)} vs ${nm(B.b)}! Battle start!`, hp: B.hp }], evRound: 0, lastAct: Date.now() });
      const n = $('#btno', box); if (n) n.onclick = () => { store.set(P(bid), { ...B, phase: 'off', lastAct: Date.now() }); location.hash = `#/games/${GAME_ID}`; };
      return;
    }
    if (B.phase === 'off') { box.innerHTML = `<div class="card"><p>${esc(myId === B.a ? `${nm(B.b)} said not now.` : 'This challenge was called off.')}</p><a class="btn" href="#/games/${GAME_ID}">Back to Battles</a></div>`; return; }
    const text = B.phase === 'done' ? `<b>${B.winner ? esc(nm(B.winner)) + ' won the battle!' : 'It’s a draw!'}</b>`
      : !mine ? `👀 Watching ${esc(nm(B.a))} vs ${esc(nm(B.b))}` : B.picks?.[myId] ? `${esc(nm(myId))} is ready!` : `What will <b>${esc(nm(myId))}</b> do?`;
    box.innerHTML = scene(B, myId, B.hp, text, B.phase === 'done' ? Object.fromEntries([B.a, B.b].filter((id) => num(B.hp[id]) <= 0).map((id) => [id, 'gone'])) : {});
    const menu = $('#btmenu', box);
    if (B.phase === 'done') menu.innerHTML = `<a class="btn sm" href="#/games/${GAME_ID}">⚔️ Battles</a>${mine ? `<button class="btn alt sm" id="btagain">Rematch</button>` : ''}`;
    else if (mine) menu.innerHTML = await menuHTML(B, myId);
    else menu.innerHTML = '';
    const ag = $('#btagain', box); if (ag) ag.onclick = () => challenge(foeOf(B, myId));
    if (mine && B.phase === 'fight') wire(B, myId);
    maybeResolve();
  };
  draw();
  let last = '';
  const off = store.subscribe(() => { if (!box.isConnected) return off(); const now = JSON.stringify(store.get(P(bid)) || null) + (me()?.id || ''); if (now !== last) { last = now; draw(); } });
}
export const battleMini = () => `<div class="bt-mini"><div class="bt-spr" style="--w:32;--h:40;--n:4;--ms:1333ms;--s:2;background-image:url(assets/battle/jangmoo_front.png)"></div><div class="bt-spr" style="--w:24;--h:32;--n:2;--ms:900ms;--s:2;background-image:url(assets/battle/cleffa_back.png)"></div></div>`;

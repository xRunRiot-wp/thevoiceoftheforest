// Noctowl's 21 (her ask 10-27): a gambling card game. 10 Poké to sit in on a hand. Everyone (Noctowl too) gets 2 cards,
// there's a round of betting (check / call / raise / fold), then each player hits or stands to get close to 21, then a
// second round of betting and the showdown: the best total without going over 21 takes the pot (ties split it).
// One shared table per campaign table (c21/table), so friends can play together live. Each device only acts for its own
// character; Noctowl's moves and slow players' turns are played by the first seated player's device (or anyone's after a wait).
import * as store from './store.js?v=6ae3dbca';
import { portrait } from './ui.js?v=6ae3dbca';
import { $, $$, esc, toast, num } from './util.js?v=6ae3dbca';
import { logRoll, me } from './play.js?v=6ae3dbca';
import { gameSay } from './chatter.js?v=6ae3dbca';
import { markWinner } from './sparkle.js?v=6ae3dbca';
import { startMusic, stopMusic, ensureAudio, cardSound, jingle, muted, setMuted } from './chiptune.js?v=6ae3dbca';

export const isCards21 = (g) => g.kind === 'cards21' || g.id === 'noctowl-21';
// a hand is being played right now (her ask 10-27: people can watch a match that's going)
export const c21Live = () => ['bet1', 'draw', 'bet2'].includes((store.get(PATH) || {}).phase);
// who's on this page but not in the hand: online/<id>.at is this game's page
const watchers = (t) => Object.entries(store.get('online') || {}).filter(([id, o]) => o && party()[id] && !(t.order || []).includes(id)
  && Date.now() - num(o.t) < 5 * 60e3 && /noctowl-21/.test(o.at || '')).map(([id]) => party()[id].nickname);
export const cards21Mini = () => '<div class="c21-mini"><img src="assets/cards21/noctowl_Normal.png" alt=""><span class="c21-card r">A♥</span><span class="c21-card">K♠</span></div>';

const ANTE = 10; const RAISE = 10; const MAX_RAISES = 3; const TURN_WAIT = 60e3; const NOCT = 'noctowl';
const PATH = 'c21/table';
const SUITS = ['♠', '♥', '♦', '♣']; const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const deck = () => { const d = SUITS.flatMap((s) => RANKS.map((r) => r + s)); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; };
const rankOf = (c) => c.slice(0, -1); const red = (c) => /[♥♦]/.test(c);
export function total(hand = []) {
  let t = 0; let aces = 0;
  for (const c of hand) { const r = rankOf(c); if (r === 'A') { aces++; t += 11; } else t += ['J', 'Q', 'K'].includes(r) ? 10 : num(r); }
  while (t > 21 && aces) { t -= 10; aces--; }
  return t;
}
const LINES = {
  lobby: ['Hoo hoo… pull up a stump. The cards are patient, and so am I.', 'Ten Poké to sit in. Wisdom is free, but the pot is not.', 'The night is young. Who will test their luck against an old owl?'],
  deal: ['The cards fly by moonlight… hoo!', 'Two cards each. Read them carefully.', 'Let us see what the night has dealt.'],
  raise: ['Hoo! Bold. I like bold.', 'A raise! Someone feels lucky tonight.'],
  fold: ['Wisdom is knowing when to walk away… hoo.', 'A quiet retreat. Sensible.'],
  bust: ['Over twenty-one… the stars were not kind.', 'Hoo… too many cards.'],
  owlWin: ['Hoo hoo hoo! The house thanks you.', 'An owl sees in the dark. Better luck next hand.'],
  win: ['Well played! The pot is yours.', 'Hoo! A sharp eye wins the night.'],
};
const say = (k, seed = Date.now()) => LINES[k][Math.floor(seed / 1000) % LINES[k].length];

const T = () => store.get(PATH) || { phase: 'lobby' };
const save = (t) => store.set(PATH, { ...t, lastAct: Date.now() });
const party = () => store.get('party') || {};
const nameOf = (t, id) => (id === NOCT ? 'Noctowl' : t.seats?.[id]?.name || party()[id]?.nickname || 'Someone');
const pay = (id, amt) => { if (id !== NOCT && amt) store.update('party/' + id, (x) => ({ ...x, poke: num(x?.poke) - amt })); };
const pokeOf = (id) => (id === NOCT ? Infinity : num(party()[id]?.poke));
const active = (t) => t.order.filter((id) => !t.seats[id].folded);
const humans = (t) => (t.order || []).filter((id) => id !== NOCT);

function deal(t) {
  const ids = Object.keys(t.waiting || {}).filter((id) => party()[id]); if (!ids.length) return;
  const d = deck(); const order = [...ids, NOCT]; const seats = {};
  for (const id of order) seats[id] = { name: id === NOCT ? 'Noctowl' : t.waiting[id], hand: [d.pop(), d.pop()], bet: 0, paid: ANTE, folded: false, stood: false };
  save({ phase: 'bet1', hand: num(t.hand) + 1, order, seats, deck: d, pot: ANTE * order.length, toCall: 0, raises: 0, acted: {}, turn: 0, waiting: {}, line: say('deal'), result: null });
}

// whose turn comes next in this phase (or null when the phase is over)
function nextTurn(t) {
  const live = active(t);
  if (live.length <= 1) return null;
  if (t.phase === 'draw') { for (let k = 1; k <= t.order.length; k++) { const i = (t.turn + k) % t.order.length; const s = t.seats[t.order[i]]; if (!s.folded && !s.stood) return i; } return null; }
  const done = live.every((id) => t.acted?.[id] && t.seats[id].bet === t.toCall);
  if (done) return null;
  for (let k = 1; k <= t.order.length; k++) { const i = (t.turn + k) % t.order.length; const id = t.order[i]; if (!t.seats[id].folded && (!t.acted?.[id] || t.seats[id].bet !== t.toCall)) return i; }
  return null;
}
function advance(t) {
  const n = nextTurn(t);
  if (n !== null) { t.turn = n; return save(t); }
  if (active(t).length <= 1) return showdown(t);
  if (t.phase === 'bet1') { t.phase = 'draw'; t.turn = t.order.findIndex((id) => !t.seats[id].folded); return save(t); }
  if (t.phase === 'draw') {
    // anyone who went over 21 is out; then the second round of betting
    for (const id of t.order) { const s = t.seats[id]; s.bet = 0; if (!s.folded && total(s.hand) > 21) s.folded = true; }
    t.phase = 'bet2'; t.toCall = 0; t.raises = 0; t.acted = {};
    if (active(t).length <= 1) return showdown(t);
    t.turn = t.order.findIndex((id) => !t.seats[id].folded); return save(t);
  }
  return showdown(t);
}

function showdown(t) {
  const live = active(t).filter((id) => total(t.seats[id].hand) <= 21);
  const best = Math.max(0, ...live.map((id) => total(t.seats[id].hand)));
  const winners = live.length === 1 ? live : live.filter((id) => total(t.seats[id].hand) === best);
  const share = winners.length ? Math.floor(t.pot / winners.length) : 0;
  const owl = !winners.length || winners.includes(NOCT);
  for (const id of winners) if (id !== NOCT) { store.update('party/' + id, (x) => ({ ...x, poke: num(x?.poke) + share })); markWinner(id); }
  const names = winners.map((id) => nameOf(t, id));
  const text = !winners.length ? `Everyone went over 21. Noctowl keeps the ${t.pot} Poké pot.`
    : `${names.join(' & ')} ${winners.length > 1 ? 'split' : 'won'} the ${t.pot} Poké pot${best ? ` with ${best}` : ''}${winners.length > 1 ? ` (${share} each)` : ''}!`;
  for (const id of humans(t)) {
    const s = t.seats[id]; const won = winners.includes(id);
    logRoll(s.name, 'Noctowl’s 21', null, `${s.hand.join(' ')} = ${total(s.hand)}${s.folded ? ' · folded' : ''} · ${won ? `won ${share} Poké` : 'lost'}`, 'note');
  }
  if (winners.some((id) => id !== NOCT)) gameSay('Noctowl', 'say', text, 'cards21', names.filter((n) => n !== 'Noctowl').join(' & '));
  save({ ...t, phase: 'done', result: { text, winners, share }, line: owl && !winners.some((id) => id !== NOCT) ? say('owlWin') : say('win') });
}

// one move by the player whose turn it is
function act(id, move) {
  const t = T(); if (!t.order || t.order[t.turn] !== id || !['bet1', 'draw', 'bet2'].includes(t.phase)) return;
  const s = t.seats[id]; const owe = t.toCall - s.bet;
  if (move === 'fold') { s.folded = true; t.line = id === NOCT ? t.line : say('fold'); }
  else if (move === 'check' || move === 'call') { if (owe > 0) { if (pokeOf(id) < owe) return toast('Not enough Poké to call. You can fold.'); pay(id, owe); s.bet += owe; s.paid = num(s.paid) + owe; t.pot += owe; } }
  else if (move === 'raise') {
    const amt = owe + RAISE; if (t.raises >= MAX_RAISES) return; if (pokeOf(id) < amt) return toast(`Not enough Poké to raise (needs ${amt}).`);
    pay(id, amt); s.bet += amt; s.paid = num(s.paid) + amt; t.pot += amt; t.toCall += RAISE; t.raises++; t.acted = {}; t.line = id === NOCT ? 'Hoo… I raise.' : say('raise');
  } else if (move === 'hit') { s.hand.push(t.deck.pop()); if (total(s.hand) > 21) { s.stood = true; t.line = say('bust'); } else if (total(s.hand) === 21) s.stood = true; }
  else if (move === 'stand') s.stood = true;
  if (t.phase !== 'draw') t.acted = { ...(t.acted || {}), [id]: true };
  if (move === 'hit' && !s.stood) return save(t); // same player keeps drawing
  advance(t);
}

// Noctowl plays like a careful old dealer: hits under 17, raises on strong hands, never folds a live hand
function owlMove(t) {
  const s = t.seats[NOCT]; const v = total(s.hand);
  if (t.phase === 'draw') return v < 17 ? 'hit' : 'stand';
  const strong = t.phase === 'bet1' ? v >= 18 : v >= 19;
  if (strong && t.raises < MAX_RAISES && t.toCall - s.bet <= RAISE) return 'raise';
  return t.toCall > s.bet ? 'call' : 'check';
}
// the device that plays Noctowl and nudges slow players: the first seated player who's here, or anyone after a wait
let driverTimer = 0;
function drive() {
  clearTimeout(driverTimer);
  const t = T(); const c = me(); if (!c || !t.order || !['bet1', 'draw', 'bet2'].includes(t.phase)) return;
  const who = t.order[t.turn]; const idle = Date.now() - num(t.lastAct);
  const mine = humans(t)[0] === c.id;
  if (who === NOCT) {
    const wait = mine ? 1300 : 9000;
    driverTimer = setTimeout(() => { const now = T(); if (now.lastAct === t.lastAct && now.order?.[now.turn] === NOCT) act(NOCT, owlMove(now)); }, Math.max(0, wait - idle));
  } else if (who !== c.id) {
    const wait = mine ? TURN_WAIT : TURN_WAIT + 30e3;
    driverTimer = setTimeout(() => { const now = T(); if (now.lastAct !== t.lastAct || now.order?.[now.turn] !== who) return;
      const s = now.seats[who]; const m = now.phase === 'draw' ? 'stand' : now.toCall > s.bet ? 'fold' : 'check'; now.line = `${s.name} took too long… hoo.`; store.set(PATH, now); act(who, m); }, Math.max(0, wait - idle));
  }
}

const card = (c, hidden) => hidden ? '<span class="c21-card back"></span>' : `<span class="c21-card ${red(c) ? 'r' : ''}">${esc(c)}</span>`;
function seatHTML(t, id, mine) {
  const s = t.seats[id]; const show = mine || t.phase === 'done';
  const v = total(s.hand); const turn = t.order[t.turn] === id && t.phase !== 'done';
  const face = id === NOCT ? '<img class="sface" src="assets/cards21/noctowl_Normal.png" alt="">' : (party()[id] ? portrait(party()[id], 'sm') : `<span class="c21-av">${esc(s.name[0])}</span>`);
  return `<div class="c21-seat ${turn ? 'turn' : ''} ${s.folded ? 'out' : ''} ${mine ? 'me' : ''}">${face}<div class="grow"><b>${esc(s.name)}${mine ? ' (you)' : ''}</b>
    <div class="c21-hand">${s.hand.map((c, i) => card(c, !show && i > 0)).join('')}</div>
    <span class="small muted">${show ? `${v}${v > 21 ? ' · over!' : v === 21 ? ' · 21!' : ''}` : `showing ${esc(s.hand[0])}`}${s.folded ? ' · folded' : s.stood && t.phase === 'draw' ? ' · stands' : ''}${s.bet ? ` · bet ${s.bet}` : ''}</span></div>
    ${turn ? '<span class="pill">Their turn</span>' : ''}</div>`;
}
function controlsHTML(t, c) {
  if (!c || !t.order || t.order[t.turn] !== c.id || t.phase === 'done') return '';
  const s = t.seats[c.id]; const owe = t.toCall - s.bet;
  if (t.phase === 'draw') return `<div class="c21-acts"><p><b>Your turn:</b> you have <b>${total(s.hand)}</b>. Take another card or stay?</p><button class="btn" data-c21="hit">🃏 Hit</button><button class="btn alt" data-c21="stand">✋ Stand</button></div>`;
  return `<div class="c21-acts"><p><b>Your turn to bet.</b> ${owe ? `It’s <b>${owe} Poké</b> to call.` : 'Nobody has raised.'} Pot: <b>${t.pot}</b>.</p>
    ${owe ? `<button class="btn" data-c21="call">📞 Call ${owe}</button>` : '<button class="btn" data-c21="check">✔️ Check</button>'}
    ${t.raises < MAX_RAISES ? `<button class="btn alt" data-c21="raise">⬆️ Raise ${owe + RAISE}</button>` : ''}<button class="btn alt" data-c21="fold">🏳️ Fold</button></div>`;
}

export function renderCards21(main, g, gm, onEdit) {
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a>${gm ? '<button class="btn alt sm" id="ed">Edit</button>' : ''}</div>
    <h1 style="margin:10px 0 4px">${esc(g.name)}</h1><p>${esc(g.intro || '')}</p>
    <p><span class="pill">🪙 ${ANTE} Poké to sit in</span> <span class="pill">🃏 Closest to 21 wins the pot</span> <span class="pill">👥 Play with your friends live</span></p>
    <details class="card small"><summary><b>How to play</b></summary><ol>
      <li><b>Sit in</b> for ${ANTE} Poké. Anyone at the table can join before the cards are dealt. Then anyone seated presses <b>Deal</b>.</li>
      <li>Everyone gets 2 cards. You see yours; others only see your first card. Aces count 1 or 11, J/Q/K count 10.</li>
      <li><b>Betting:</b> <b>Check</b> (bet nothing more), <b>Raise</b> (+${RAISE} Poké, up to ${MAX_RAISES} times a round), <b>Call</b> (match a raise) or <b>Fold</b> (give up the hand).</li>
      <li><b>Drawing:</b> <b>Hit</b> for another card or <b>Stand</b>. Over 21 and you’re out.</li>
      <li>A second round of betting, then everyone shows their cards. The best total without going over 21 wins the pot; ties split it. Noctowl plays too and keeps whatever it wins.</li>
      <li>Slow players get ${TURN_WAIT / 1000} seconds, then they check (or fold if there’s a raise to call).</li></ol></details>
    <p class="small muted" style="text-align:right;margin:0 0 4px"><button class="btn alt sm" id="c21music">${muted() ? '🔇 Music off' : '🔊 Music on'}</button></p>
    <div class="card c21-table" id="c21"></div>`;
  const e = $('#ed', main); if (e) e.onclick = onEdit;
  const box = $('#c21', main);
  // casino music while the page is open (phones need a tap first, so it also starts on the first tap)
  let playing = false;
  const music = () => { if (playing || !main.isConnected) return; ensureAudio(); startMusic('casino'); playing = true; };
  const stop = () => { if (!playing) return; playing = false; stopMusic(); };
  $('#c21music', main).onclick = (ev) => { const m = !muted(); setMuted(m); ev.target.textContent = m ? '🔇 Music off' : '🔊 Music on'; music(); };
  main.addEventListener('pointerdown', music, { once: true });
  if (navigator.userActivation?.hasBeenActive) music();
  const leave = () => { if (!box.isConnected) { stop(); window.removeEventListener('hashchange', leave); } };
  window.addEventListener('hashchange', leave);
  // table sounds: a shuffle on each new deal, a snap for every card that lands, chips when the pot grows, a jingle at the showdown
  let heard = null;
  const sounds = (t, c) => {
    const now = { hand: num(t.hand), cards: (t.order || []).reduce((n, id) => n + (t.seats?.[id]?.hand?.length || 0), 0), pot: num(t.pot), phase: t.phase };
    const was = heard; heard = now; if (!was) return;
    if (now.hand !== was.hand && now.cards) { cardSound('shuffle'); for (let i = 0; i < now.cards; i++) cardSound('card', 0.55 + i * 0.12); return; }
    if (now.cards > was.cards) for (let i = 0; i < now.cards - was.cards; i++) cardSound('card', i * 0.12);
    if (now.pot > was.pot) cardSound('chips');
    if (now.phase === 'done' && was.phase !== 'done' && c && t.order?.includes(c.id)) jingle((t.result?.winners || []).includes(c.id));
  };
  const draw = () => {
    const t = T(); const c = me(); const waiting = t.waiting || {};
    const seated = c && t.order?.includes(c.id);
    sounds(t, c);
    let body = `<div class="c21-owl"><img class="sface big" src="assets/cards21/noctowl_Normal.png" alt="Noctowl"><div class="bubble"><b>Noctowl:</b> “${esc(t.line || say('lobby'))}”</div></div>`;
    if (t.order && t.phase !== 'lobby') {
      body += `<div class="c21-pot">Pot <b>${num(t.pot)}</b> Poké · ${{ bet1: 'First betting round', draw: 'Hit or stand', bet2: 'Last betting round', done: 'Showdown' }[t.phase]}</div>
        <div class="c21-seats">${t.order.map((id) => seatHTML(t, id, c && id === c.id)).join('')}</div>${controlsHTML(t, c)}`;
      if (t.phase === 'done') body += `<div class="c21-result"><b>${esc(t.result?.text || '')}</b></div>`;
      else if (!seated) body += `<div class="c21-watch">👀 <b>You’re watching this hand.</b> You’ll see everyone’s cards when they show them at the end. You can sit in for the next hand.</div>`;
      const w = watchers(t); if (w.length && t.phase !== 'done') body += `<p class="small muted">👀 Watching: ${w.map(esc).join(', ')}</p>`;
    }
    if (!t.order || t.phase === 'done' || t.phase === 'lobby') {
      const list = Object.entries(waiting);
      body += `<div class="c21-lobby"><h3>Next hand</h3>${list.length ? `<p>Sitting in: ${list.map(([, n]) => `<b>${esc(n)}</b>`).join(', ')}</p>` : '<p class="muted">Nobody has sat in yet.</p>'}
        ${!c ? '<p>Pick your character first (Play tab), then come and play.</p>' : waiting[c.id]
          ? `<button class="btn" id="c21deal">🃏 Deal${list.length > 1 ? '' : ' (just you and Noctowl)'}</button> <button class="btn alt" id="c21leave">Stand up (get your ${ANTE} back)</button><p class="small muted">Waiting for friends? Invite them with <b>👥 Friends</b> at the top.</p>`
          : `<button class="btn" id="c21sit" ${pokeOf(c.id) < ANTE ? 'disabled' : ''}>🪙 Sit in for ${ANTE} Poké</button>${pokeOf(c.id) < ANTE ? `<p class="small muted">You need ${ANTE} Poké to play.</p>` : ''}`}
        ${gm && t.order && t.phase !== 'done' ? '<p><button class="btn alt sm" id="c21reset">GM: end this hand (refund the pot)</button></p>' : ''}</div>`;
    } else if (gm) body += '<p><button class="btn alt sm" id="c21reset">GM: end this hand (refund the pot)</button></p>';
    box.innerHTML = body;
    $$('[data-c21]', box).forEach((b) => b.onclick = () => { $$('[data-c21]', box).forEach((x) => { x.disabled = true; }); act(c.id, b.dataset.c21); });
    const sit = $('#c21sit', box); if (sit) sit.onclick = () => { sit.disabled = true; if (pokeOf(c.id) < ANTE) return; ensureAudio(); cardSound('chips'); pay(c.id, ANTE); store.set(`${PATH}/waiting/${c.id}`, c.nickname); if (T().phase === 'done') store.set(`${PATH}/line`, `${c.nickname} sits down. Hoo!`); };
    const lv = $('#c21leave', box); if (lv) lv.onclick = () => { pay(c.id, -ANTE); store.set(`${PATH}/waiting/${c.id}`, null); };
    const dl = $('#c21deal', box); if (dl) dl.onclick = () => { dl.disabled = true; deal(T()); };
    const rs = $('#c21reset', box); if (rs) rs.onclick = () => { if (!confirm('End this hand and give everyone back what they put in?')) return; const t2 = T();
      for (const id of humans(t2)) pay(id, -num(t2.seats[id].paid));
      store.set(PATH, { phase: 'lobby', waiting: t2.waiting || {}, line: 'The GM has called this hand off. Hoo.' }); };
    drive();
  };
  draw();
  let last = '';
  const off = store.subscribe(() => { if (!box.isConnected) { off(); clearTimeout(driverTimer); stop(); return; } const now = JSON.stringify(store.get(PATH) || {}) + (me()?.id || '') + num(me()?.poke); if (now !== last) { last = now; draw(); } });
}

// Dance Practice with Ralts (her ask 10-27): Ralts dances a short routine of up / down / left / right steps and the
// player copies it with the arrow buttons (or arrow keys). Rounds grow from 3 to 8 steps. Ralts and the player's own
// face react to every hit or missed step. A daily chore like Sentry Duty: a great practice pays Poké and maybe a rare item.
import * as store from './store.js?v=6ae64af6';
import { $, $$, esc, toast, num, uid } from './util.js?v=6ae64af6';
import { me, logRoll } from './play.js?v=6ae64af6';
import { dailyRoll } from './weather.js?v=6ae64af6';
import { gameSay } from './chatter.js?v=6ae64af6';
import { markWinner } from './sparkle.js?v=6ae64af6';
import { faceHTML, faceSrc, spKey, rareItem } from './sentry.js?v=6ae64af6';
import { startMusic, stopMusic, stepSound, missSound, jingle, muted, setMuted } from './chiptune.js?v=6ae64af6';
import { startBroadcast } from './watch.js?v=6ae64af6';

export const isDance = (g) => g.kind === 'dance' || g.id === 'ralts-dance';

const LENGTHS = [3, 4, 5, 6, 7, 8]; const TOTAL = LENGTHS.reduce((a, b) => a + b, 0);
const STEP_MS = 750; const WAIT_S = 6;
const DIRS = { up: ['↑', 3], down: ['↓', 1], left: ['←', 4], right: ['→', 2] }; // [arrow, sprite row in ralts_dance.png]
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
// grades: [lowest steps, name, Poké, rare-item chance, what Ralts says, mood]
const GRADES = [
  [30, 'Dazzling!', 250, 0.5, 'You matched me almost perfectly! I could feel your joy from across the hall!', 'great'],
  [24, 'Nice moves', 100, 0, 'That was lovely. Your steps are getting so light!', 'good'],
  [15, 'Practice done', 0, 0, 'Thank you for dancing with me. Practice makes perfect!', 'duty'],
  [0, 'Two left feet', 0, 0, 'Um… that’s okay! Everyone stumbles. Let’s practice again tomorrow.', 'sloppy'],
];
const gradeOf = (n) => GRADES.find(([min]) => n >= min);
const moodOf = (grade) => (GRADES.find((x) => x[1] === grade) || [])[5] || 'wait';
const RALTS = { great: ['Joyous', 'Inspired'], good: ['Happy'], duty: ['Normal'], sloppy: ['Worried', 'Sad'], hit: ['Happy', 'Joyous'], miss: ['Surprised', 'Worried'], slow: ['Worried', 'Sigh'], wait: ['Normal'], show: ['Determined', 'Normal'], clear: ['Inspired', 'Joyous'] };
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const HIT = ['Yes! Just like that!', 'Lovely!', 'You feel the rhythm!', 'Perfect step!', 'So graceful!'];
const MISS = ['Oh! That step was {d}…', 'Whoops! It was {d}. Next round!', 'Ah, not quite. It was {d}!'];
const SLOW = ['Did you forget? It was {d}.', 'Are you still there? The step was {d}.'];
const today = () => dailyRoll().day;
const done = (id) => store.get('dance/' + id) || {};

const raltsFace = (mood, line) => `<div class="sentry-digg"><img class="sface dig" src="${faceSrc('ralts', mood, RALTS)}" alt="Ralts"><div class="bubble"><b>Ralts:</b> “${esc(line)}”</div></div>`;
const sprite = (cls = '') => `<span class="ralts-spr ${cls}" aria-hidden="true"></span>`;
export const danceDue = () => { const c = me(); return !!c && done(c.id).day !== today(); };
export const danceMini = () => `<div class="dance-mini">${sprite()}</div>`;

function finish(c, hits, box, onDone) {
  const [, name, poke, chance, line, mood] = gradeOf(hits);
  store.set('dance/' + c.id, { day: today(), score: hits, grade: name, t: Date.now(), times: num(done(c.id).times) + 1 });
  const pay = (item) => {
    if (poke) store.update('party/' + c.id, (x) => ({ ...x, poke: num(x?.poke) + poke }));
    if (item) store.set('bag/' + uid(), { name: item, qty: 1, owner: c.id });
    if (poke || item) markWinner(c.id);
    const reward = [poke ? `${poke} Poké` : '', item ? `a rare ${item}` : ''].filter(Boolean).join(' and ');
    logRoll(c.nickname, 'Dance Practice with Ralts', null, `${hits}/${TOTAL} steps · ${name}${reward ? ' · ' + reward : ''}`, 'note');
    if (mood === 'great') gameSay('Ralts', 'say', `${c.nickname} matched my whole dance today! I could feel their joy from across the hall.`, 'dance', c.nickname);
    box.innerHTML = `<div class="sentry-end">${faceHTML(c, mood, 'big')}<div class="big">${esc(name)}</div><p>${hits} of ${TOTAL} steps matched.</p>
      ${raltsFace(mood, line)}${reward ? `<p class="pill">🎁 ${esc(reward)}</p>` : ''}<p class="small muted">Next practice tomorrow.</p></div>`;
    onDone?.();
  };
  if (chance && Math.random() < chance) rareItem().then(pay); else pay('');
}

function play(c, box, onDone) {
  let round = 0; let hits = 0; let seq = []; let at = 0; let busy = true; let timer = 0; let streak = 0;
  box.innerHTML = `<div class="dance">
    <div class="sentry-top">${faceHTML(c, 'wait', 'me')}<span class="small muted dance-count"></span></div>
    <div class="dance-react">${raltsFace('show', 'Watch closely!')}</div>
    <div class="dance-stage">${sprite()}<div class="dance-steps"></div></div>
    <div class="dance-pad">${['up', 'left', 'down', 'right'].map((d) => `<button class="btn alt dpad-${d}" data-dir="${d}" aria-label="${d}">${DIRS[d][0]}</button>`).join('')}</div>
    <p class="small muted" style="text-align:center">Tap the arrows (or use your arrow keys) to copy Ralts. <button class="btn alt sm" id="dmusic">${muted() ? '🔇 Music off' : '🔊 Music on'}</button></p></div>`;
  $('#dmusic', box).onclick = (e) => { const m = !muted(); setMuted(m); e.target.textContent = m ? '🔇 Music off' : '🔊 Music on'; };
  startMusic();
  // the tune stops if they leave the page mid-dance
  const leave = () => { if (!box.isConnected) { stopMusic(); window.removeEventListener('hashchange', leave); } };
  window.addEventListener('hashchange', () => setTimeout(leave, 0));
  const stopWatch = startBroadcast('ralts-dance', 'Dance Practice with Ralts', { el: $('.dance', box), box }); // friends can watch live
  const spr = $('.ralts-spr', box); const steps = $('.dance-steps', box);
  const setSpr = (cls) => { spr.className = 'ralts-spr'; void spr.offsetWidth; spr.className = 'ralts-spr ' + cls; };
  const react = (mood, line) => { $('.dance-react', box).innerHTML = raltsFace(mood, line); };
  const myFace = (mood) => { const f = faceSrc(spKey(c), mood); const el = $('.sface.me', box); if (f && el?.tagName === 'IMG') el.src = f; };
  const count = () => { $('.dance-count', box).textContent = `${c.nickname} · round ${round + 1} of ${LENGTHS.length} · ${hits} steps matched`; };
  const dots = (n, cls = '') => { steps.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < at ? 'ok' : ''} ${cls}"></i>`).join(''); };
  const flash = (d, cls) => { const b = $(`[data-dir="${d}"]`, box); if (!b) return; b.classList.add(cls); setTimeout(() => b.classList.remove(cls), 320); };
  const glow = () => { const st = $('.dance-stage', box); st.classList.remove('glow1', 'glow2', 'glow3'); if (streak >= 3) st.classList.add(streak >= 10 ? 'glow3' : streak >= 6 ? 'glow2' : 'glow1'); };
  const wait = () => { clearTimeout(timer); timer = setTimeout(() => press(null), WAIT_S * 1000); };

  const show = () => {
    busy = true; at = 0; count();
    seq = Array.from({ length: LENGTHS[round] }, () => pickOne(Object.keys(DIRS)));
    react('show', round ? `Round ${round + 1}! ${seq.length} steps this time. Watch me!` : `Watch closely! ${seq.length} steps!`);
    myFace('wait'); dots(seq.length);
    seq.forEach((d, i) => setTimeout(() => {
      if (!box.isConnected) return;
      setSpr('hop-' + d); flash(d, 'lit'); stepSound(d); steps.children[i]?.classList.add('shown');
    }, 900 + i * STEP_MS));
    setTimeout(() => {
      if (!box.isConnected) return;
      setSpr(''); dots(seq.length); react('wait', 'Your turn!'); busy = false; wait();
    }, 900 + seq.length * STEP_MS + 300);
  };

  const next = () => {
    round++;
    if (round >= LENGTHS.length) { document.removeEventListener('keydown', onKey); stopMusic(); stopWatch(`${hits} steps matched`); jingle(hits >= 24); finish(c, hits, box, onDone); return; }
    setTimeout(show, 1400);
  };

  const press = (d) => {
    if (busy || !box.isConnected) return;
    clearTimeout(timer);
    const want = seq[at];
    if (d === want) {
      hits++; at++; streak++; glow(); stepSound(d); setSpr('hop-' + d); flash(d, 'right'); myFace('hit'); dots(seq.length); count();
      if (at === seq.length) { busy = true; react('clear', streak >= 6 ? `${streak} in a row! I’m glowing! ✨` : `The whole round! ${pickOne(HIT)}`); next(); }
      else { react('hit', pickOne(HIT)); wait(); }
      return;
    }
    busy = true; streak = 0; glow(); missSound(); setSpr('hurt'); if (d) flash(d, 'wrong');
    const kind = d ? 'miss' : 'slow';
    myFace(kind); react(kind, pickOne(d ? MISS : SLOW).replace('{d}', DIRS[want][0]));
    next();
  };

  const onKey = (e) => { if (!box.isConnected) { document.removeEventListener('keydown', onKey); return; } const d = KEYS[e.key]; if (d) { e.preventDefault(); press(d); } };
  document.addEventListener('keydown', onKey);
  $$('[data-dir]', box).forEach((b) => b.onclick = () => press(b.dataset.dir));
  show();
}

export function renderDance(main, g, gm, onEdit) {
  const c = me();
  const party = Object.values(store.get('party') || {}).filter((x) => !x.guest);
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a>${gm ? '<button class="btn alt sm" id="ed">Edit</button>' : ''}</div>
    <h1 style="margin:10px 0 4px">${esc(g.name)}</h1>
    <p>${esc(g.intro || '')}</p>
    <p><span class="pill">📋 Guild chore</span> <span class="pill">📅 Once a day</span> <span class="pill">🌟 Dazzling: ${GRADES[0][2]} Poké + a chance at a rare item</span></p>
    <div class="card sentry"><div id="dancebox"></div></div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Today’s dancers</h3><ul class="sentry-roster" id="droster"></ul></div>`;
  const roster = () => {
    $('#droster', main).innerHTML = party.map((x) => { const s = done(x.id); const on = s.day === today();
      return `<li>${faceHTML(x, on ? moodOf(s.grade) : 'wait')}<span class="grow">${esc(x.nickname)}<br><span class="small">${on ? `<b>${esc(s.grade)}</b> <span class="muted">${s.score}/${TOTAL}</span>` : '<span class="muted">not yet</span>'}<span class="muted"> · ${num(s.times)} practice${num(s.times) === 1 ? '' : 's'}</span></span></span>${gm && on ? ` <button class="btn alt sm" data-dreset="${esc(x.id)}">Redo</button>` : ''}</li>`; }).join('') || '<li class="muted">No characters yet.</li>';
    $$('[data-dreset]', main).forEach((b) => b.onclick = () => { store.set(`dance/${b.dataset.dreset}/day`, null); toast('They can practice again today'); renderDance(main, g, gm, onEdit); });
  };
  roster();
  const box = $('#dancebox', main);
  if (!c) box.innerHTML = '<p>Pick your character first (Play tab), then come and dance.</p>';
  else if (done(c.id).day === today()) { const s = done(c.id); box.innerHTML = `<div class="sentry-end">${faceHTML(c, moodOf(s.grade), 'big')}<div class="big">${esc(s.grade)}</div><p>${esc(c.nickname)} already practiced today: ${s.score} of ${TOTAL} steps.</p><p class="small muted">Next practice tomorrow.</p></div>`; }
  else {
    box.innerHTML = `<div class="sentry-start">${raltsFace('wait', `Oh, ${c.nickname}! Will you dance with me today? Just copy my steps: up, down, left and right. I’ll start slow!`)}
      <div class="dance-stage small-stage">${sprite()}</div>
      <p class="small muted">${LENGTHS.length} rounds, ${LENGTHS[0]} to ${LENGTHS[LENGTHS.length - 1]} steps · a wrong step ends that round.</p><button class="btn block" id="dgo">Start dancing</button></div>`;
    $('#dgo', box).onclick = () => play(c, box, roster);
  }
  const e = $('#ed', main); if (e) e.onclick = onEdit;
}

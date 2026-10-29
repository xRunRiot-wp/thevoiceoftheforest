// Boltund's Ball Lab (her ask 10-29: a game like Goober's Lab from Webkinz, with Poké Balls instead of coloured orbs).
// A heap of Poké Balls: tap a group of 2 or more matching balls that touch (up, down, left, right) and they pop.
// Balls above fall down, empty columns slide together, and bigger groups score far more: (size − 1)² × 10.
// The game ends when no two matching balls touch; clearing the whole heap is +1000.
// First finished game each day pays Poké by score. balllab/<id> = { best, runs, paidDay, last }.
import * as store from './store.js?v=6ae3b855';
import { $, esc, num } from './util.js?v=6ae3b855';
import { me, logRoll } from './play.js?v=6ae3b855';
import { dailyRoll } from './weather.js?v=6ae3b855';
import { gameSay } from './chatter.js?v=6ae3b855';
import { markWinner } from './sparkle.js?v=6ae3b855';
import { ensureAudio, jingle, pageMusic } from './chiptune.js?v=6ae3b855';

export const isBallLab = (g) => g.kind === 'balllab' || g.id === 'boltund-ball-lab';
const COLS = 9; const ROWS = 11; const CLEAR_BONUS = 1000;
const today = () => dailyRoll().day;
const payFor = (score, cleared) => Math.min(150, Math.floor(score / 100) * 5) + (cleared ? 50 : 0);

// the balls, drawn as little pictures (top colour, markings, white bottom, black band, button)
const BALLS = ['poke', 'great', 'ultra', 'premier', 'love'];
const BALL_NAME = { poke: 'Poké Ball', great: 'Great Ball', ultra: 'Ultra Ball', premier: 'Premier Ball', love: 'Love Ball' };
const TOP = { poke: '#e8392f', great: '#2f6fd8', ultra: '#2a2a30', premier: '#fbfbf6', love: '#f07ab0' };
const MARK = {
  great: '<path d="M7 13 L13 7 L16 10 L10 16 Z M33 13 L27 7 L24 10 L30 16 Z" fill="#e8392f"/>',
  ultra: '<path d="M10 6 h5 v12 h-5 Z M25 6 h5 v12 h-5 Z" fill="#f5c518"/>',
  love: '<path d="M20 13 c-3 -5 -9 -2 -6 3 l6 5 l6 -5 c3 -5 -3 -8 -6 -3 Z" fill="#fff" opacity=".9"/>',
};
export const ballSVG = (t) => `<svg viewBox="0 0 40 40" aria-hidden="true"><defs><clipPath id="bc"><circle cx="20" cy="20" r="18"/></clipPath><radialGradient id="bs" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <g clip-path="url(#bc)"><rect width="40" height="40" fill="#fbfbf6"/><rect width="40" height="20" fill="${TOP[t]}"/>${MARK[t] || ''}<rect y="18" width="40" height="4" fill="${t === 'premier' ? '#e8392f' : '#222'}"/></g>
  <circle cx="20" cy="20" r="18" fill="url(#bs)"/><circle cx="20" cy="20" r="18" fill="none" stroke="#222" stroke-width="2"/>
  <circle cx="20" cy="20" r="5.5" fill="#fbfbf6" stroke="${t === 'premier' ? '#e8392f' : '#222'}" stroke-width="2.5"/><circle cx="20" cy="20" r="2.2" fill="#fff" stroke="#bbb" stroke-width=".8"/></svg>`;
export const ballLabMini = () => `<div class="bl-mini">${['poke', 'great', 'ultra', 'love', 'premier', 'poke'].map((t) => `<span>${ballSVG(t)}</span>`).join('')}</div>`;

// little pop sounds (a rising blip, higher for bigger groups)
let actx = null;
function blip(n) {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (localStorage.getItem('dc.music') === 'off') return;
    const t = actx.currentTime;
    for (let i = 0; i < Math.min(5, Math.ceil(n / 2)); i++) {
      const o = actx.createOscillator(); const g = actx.createGain(); o.type = 'square'; o.frequency.value = 520 * Math.pow(2, (i * 4 + Math.min(n, 12)) / 12);
      g.gain.setValueAtTime(0.06, t + i * 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.12);
      o.connect(g); g.connect(actx.destination); o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.14);
    }
  } catch { /* no sound */ }
}

function newBoard() {
  let id = 0;
  return Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => ({ id: ++id, t: BALLS[Math.floor(Math.random() * BALLS.length)] })));
}
// board[col][row], row 0 = bottom; a column is a list from the bottom up (gravity is just "no gaps")
function groupAt(board, c, r) {
  const t = board[c]?.[r]?.t; if (!t) return [];
  const seen = new Set([c + ',' + r]); const out = [[c, r]];
  for (let i = 0; i < out.length; i++) {
    const [x, y] = out[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (x + dx) + ',' + (y + dy);
      if (!seen.has(k) && board[x + dx]?.[y + dy]?.t === t) { seen.add(k); out.push([x + dx, y + dy]); }
    }
  }
  return out;
}
const anyMoves = (board) => board.some((col, c) => col.some((b, r) => board[c + 1]?.[r]?.t === b.t || col[r + 1]?.t === b.t));
const ballsLeft = (board) => board.reduce((n, col) => n + col.length, 0);

function play(c, box, onDone) {
  let board = newBoard(); let score = 0; let pops = 0; let biggest = 0; let over = false;
  box.innerHTML = `<div class="bl-top"><span class="pill">⭐ <b id="blscore">0</b></span><span class="pill">🔴 <b id="blleft">${COLS * ROWS}</b> left</span><button class="btn alt sm" id="blquit">End game</button></div>
    <div class="bl-wrap"><div class="bl-board" id="blboard" style="--cols:${COLS};--rows:${ROWS}"></div></div><p class="small muted" style="text-align:center;margin:6px 0 0" id="blhint">Tap 2 or more matching balls that touch.</p>`;
  const el = $('#blboard', box); const nodes = new Map();
  const draw = () => {
    const live = new Set();
    board.forEach((col, x) => col.forEach((b, y) => {
      live.add(b.id);
      let n = nodes.get(b.id);
      if (!n) { n = document.createElement('button'); n.className = 'bl-ball'; n.innerHTML = ballSVG(b.t); n.setAttribute('aria-label', BALL_NAME[b.t]); el.appendChild(n); nodes.set(b.id, n); }
      n.style.setProperty('--x', x); n.style.setProperty('--y', ROWS - 1 - y); n.dataset.c = x; n.dataset.r = y;
    }));
    for (const [id, n] of nodes) if (!live.has(id)) { nodes.delete(id); n.classList.add('pop'); n.disabled = true; setTimeout(() => n.remove(), 320); }
    $('#blscore', box).textContent = score; $('#blleft', box).textContent = ballsLeft(board);
  };
  const floatText = (x, y, txt) => { const f = document.createElement('span'); f.className = 'bl-float'; f.textContent = txt; f.style.setProperty('--x', x); f.style.setProperty('--y', ROWS - 1 - y); el.appendChild(f); setTimeout(() => f.remove(), 900); };
  // hovering (computer) lights up the group you'd pop
  el.onpointerover = (e) => { const b = e.target.closest('.bl-ball'); el.querySelectorAll('.lit').forEach((n) => n.classList.remove('lit')); if (!b || over) return;
    const g = groupAt(board, +b.dataset.c, +b.dataset.r); if (g.length < 2) return; g.forEach(([x, y]) => nodes.get(board[x][y].id)?.classList.add('lit')); };
  el.onpointerleave = () => el.querySelectorAll('.lit').forEach((n) => n.classList.remove('lit'));
  el.onclick = (e) => {
    const b = e.target.closest('.bl-ball'); if (!b || over) return;
    const cx = +b.dataset.c; const cy = +b.dataset.r; const g = groupAt(board, cx, cy);
    if (g.length < 2) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
    ensureAudio(); blip(g.length);
    const pts = (g.length - 1) ** 2 * 10; score += pts; pops++; biggest = Math.max(biggest, g.length);
    const gone = new Set(g.map(([x, y]) => board[x][y].id));
    board = board.map((col) => col.filter((x) => !gone.has(x.id))).filter((col) => col.length);
    floatText(cx, cy, `+${pts}`);
    draw();
    if (!ballsLeft(board) || !anyMoves(board)) setTimeout(finish, 500);
  };
  $('#blquit', box).onclick = () => { if (confirm('End this game now? Your score still counts.')) finish(); };
  const finish = () => {
    if (over) return; over = true;
    const cleared = !ballsLeft(board); if (cleared) score += CLEAR_BONUS;
    const r = store.get('balllab/' + c.id) || {}; const first = r.paidDay !== today();
    const poke = first ? payFor(score, cleared) : 0;
    const best = Math.max(num(r.best), score);
    store.set('balllab/' + c.id, { ...r, best, runs: num(r.runs) + 1, last: { score, left: ballsLeft(board), t: Date.now() }, ...(first ? { paidDay: today() } : {}) });
    if (poke) { store.update('party/' + c.id, (x) => ({ ...x, poke: num(x?.poke) + poke })); markWinner(c.id); }
    logRoll(c.nickname, 'Boltund’s Ball Lab', null, `${score} points · ${cleared ? 'cleared the whole heap!' : `${ballsLeft(board)} balls left`}${poke ? ` · ${poke} Poké` : ''}`, 'note');
    if (cleared) gameSay('Boltund', 'say', `ARF! ${c.nickname} sorted every single Poké Ball in my lab! Science has never been so fast!`, 'balllab', c.nickname);
    else if (score > num(r.best) && num(r.best)) gameSay('Boltund', 'say', `New record in the Ball Lab! ${c.nickname} scored ${score}! *happy tail-wagging intensifies*`, 'balllab', c.nickname);
    jingle(cleared || score > num(r.best));
    box.insertAdjacentHTML('beforeend', `<div class="bl-end"><h3>${cleared ? '✨ Heap cleared! +' + CLEAR_BONUS : 'No more matches!'}</h3><p><b>${score}</b> points${score > num(r.best) ? ' · 🏆 new best!' : ''} · biggest group: ${biggest}</p>
      ${poke ? `<p class="pill">🎁 ${poke} Poké</p>` : !first ? '<p class="small muted">Today’s pay was already earned. Games still count for your best!</p>' : ''}<button class="btn block" id="blagain">Play again</button></div>`);
    $('#blagain', box).onclick = () => play(c, box, onDone);
    onDone();
  };
  draw();
}

export function renderBallLab(main, g, gm, onEdit) {
  const c = me();
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a>${gm ? '<button class="btn alt sm" id="ed">Edit</button>' : ''}</div>
    <h1 style="margin:10px 0 4px">${esc(g.name)}</h1>
    <p>${esc(g.intro || '')}</p>
    <p><span class="pill">👆 Tap 2+ matching balls</span> <span class="pill">⭐ Bigger groups score way more</span> <span class="pill">💰 First game each day pays up to ${payFor(3000, true)} Poké</span></p>
    <p class="small muted" style="text-align:right;margin:0 0 4px"><button class="btn alt sm" id="blmusic"></button></p>
    <details class="card small"><summary><b>How to play</b></summary><ol>
      <li>Tap a group of <b>2 or more</b> matching Poké Balls that touch (up, down, left or right). They pop!</li>
      <li>Balls above fall down, and empty columns slide together.</li>
      <li>A group of <i>n</i> balls scores (<i>n</i> − 1)² × 10: 2 balls = 10, 5 balls = 160, 10 balls = 810. Plan ahead and build big groups!</li>
      <li>The game ends when no two matching balls touch. Clear the <b>whole heap</b> for +${CLEAR_BONUS}.</li>
      <li>Your first game each day pays 5 Poké per 100 points (up to 150), +50 for clearing the heap.</li></ol></details>
    <div class="card sentry"><div id="blbox"></div></div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Best scores</h3><ul class="sentry-roster" id="blbest"></ul></div>`;
  const party = store.get('party') || {};
  const best = () => { $('#blbest', main).innerHTML = Object.entries(store.get('balllab') || {}).filter(([id, r]) => party[id] && r).sort((a, b) => num(b[1].best) - num(a[1].best))
    .map(([id, r]) => `<li><span class="grow">${esc(party[id].nickname)}</span><b>${num(r.best)}</b><span class="small muted"> · ${num(r.runs)} game${num(r.runs) === 1 ? '' : 's'}${r.paidDay === today() ? ' · played today' : ''}</span></li>`).join('') || '<li class="muted">No scores yet. Be the first!</li>'; };
  best();
  const box = $('#blbox', main);
  if (!c) box.innerHTML = '<p>Pick your character first (Play tab), then visit Boltund.</p>';
  else {
    box.innerHTML = `<div class="sentry-start"><div class="sentry-digg"><img class="sface dig" src="assets/portraits/emo/boltund/Joyous.png" alt="Boltund"><div class="bubble"><b>Dr. Boltund:</b> “${esc(c.nickname)}! Perfect timing! I ran an experiment at top speed and now the guild’s Poké Balls are piled up all over my lab. Pop the matching ones so I can sort them! Big groups give the best results. That’s science!”</div></div>
      <button class="btn block" id="blgo">Start sorting 🔴</button></div>`;
    $('#blgo', box).onclick = () => play(c, box, best);
  }
  const e = $('#ed', main); if (e) e.onclick = onEdit;
  pageMusic(main, 'lab', 'blmusic'); // her ask 10-29: sciencey lab music
}

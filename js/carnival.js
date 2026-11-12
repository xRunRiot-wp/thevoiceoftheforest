// Wishmaker Star Carnival (her ask 11-11): a trip for your nursery buddy, like Tamatown but a Pokémon carnival under
// the Millennium Comet (her inspirations: Jirachi Wishmaker, Thrillville, the Scooby-Doo carnival and especially the
// carnival in 102 Dalmatians; she wants its look, music and games: night lights with a little spooky edge).
// You and your buddy walk the midway together: ride the rides (counts as play time for the buddy), eat carnival snacks
// (counts as food), play booth games for tickets, and spend the tickets at the Prize Booth on base pieces, cursors,
// site themes and dice. Each booth game pays tickets for the first PAID_PLAYS games a day; after that it is just for fun.
// State: party/<id>/tickets, carnival/<id> = { day, plays: { game: n }, best: { game: score }, star: { closed: [sections], day }, freePrize, wishes, total }.
import * as store from './store.js?v=6af52581';
import { $, $$, esc, toast, num } from './util.js?v=6af52581';
import { me, logRoll } from './play.js?v=6af52581';
import { markWinner } from './sparkle.js?v=6af52581';
import { ensureAudio, jingle, stepSound, missSound, pageMusic } from './chiptune.js?v=6af52581';
import { buddyLook, carnivalCare } from './nursery.js?v=6af52581';
import { DECOR } from './basedecor.js?v=6af52581';
import { THEMES, DICE_REWARDS } from './theme.js?v=6af52581';
import { REWARD_CURSORS } from './digcursor.js?v=6af52581';

export const isCarnival = (g) => g.kind === 'carnival' || g.id === 'star-carnival';
const PAID_PLAYS = 3;
const P = (k) => `assets/portraits/${k}.png`;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const party = () => store.get('party') || {};
const rec = (id) => store.get('carnival/' + id) || {};
const playsToday = (id) => { const r = rec(id); return r.day === today() ? r.plays || {} : {}; };
const ticketsOf = (id) => num(party()[id]?.tickets);
const addTickets = (id, n) => store.update('party/' + id, (x) => ({ ...x, tickets: Math.max(0, num(x?.tickets) + n) }));
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const face = (k, cls = '') => `<img class="cv-face ${cls}" src="${P(k)}" alt="">`;
const mime = (line) => `<div class="cv-talk">${face('mrmime')}<div class="bubble"><b>Mr. Mime:</b> “${esc(line)}”</div></div>`;
const host = (k, who, line) => `<div class="cv-talk">${face(k)}<div class="bubble"><b>${esc(who)}:</b> “${esc(line)}”</div></div>`;

export const carnivalMini = () => `<div class="cv-mini"><span class="cv-mini-comet"></span><span>🎡</span><span>🎪</span><span>🎠</span></div>`;

// ---- you and your buddy, side by side (your character's walk sprite + the nursery sprite sheet)
const BROW = { idle: 0, hop: 1, sleep: 2, right: 3, left: 4, eat: 5, nod: 6 };
const BSCALE = [0, 1.5, 1.8, 2.1];
function pairHTML(c, cls = '') {
  const L = c ? buddyLook(c.id) : null;
  let bud = '';
  if (L && L.egg) bud = '<img class="cv-egg" src="assets/nursery/egg.png" alt="Egg">';
  else if (L) { const S = BSCALE[L.stage] || 1.8; const pw = Math.round(L.cw * S); const ph = Math.round(L.ch * S);
    bud = `<span class="baby-spr cv-bspr" data-pw="${pw}" data-ph="${ph}" style="width:${pw}px;height:${ph}px;margin-bottom:-${Math.round(ph * 0.42)}px;background-image:url(${L.url});background-size:${pw * 10}px ${ph * 7}px"></span>`; }
  return `<div class="cv-pair ${cls}"><span class="cv-char"></span><span class="cv-bud">${bud}</span></div>`;
}
function budRow(root, name, loop = true) {
  const L = buddyLook(me()?.id || ''); const spr = $('.cv-bspr', root); if (!spr || !L || L.egg) return;
  const r = BROW[name]; const n = L.fr[r] || 1; const pw = +spr.dataset.pw; const ph = +spr.dataset.ph;
  spr.style.backgroundPositionY = `-${r * ph}px`; spr.style.setProperty('--fw', pw + 'px'); spr.style.setProperty('--n', n);
  spr.style.animation = 'none'; void spr.offsetWidth; spr.style.animation = `baby-anim ${Math.max(0.4, n * 0.12)}s steps(${n}, jump-none) ${loop ? 'infinite' : '1 forwards'}`;
}
const fz = () => import('./fzscene.js?v=6af52581').catch(() => null);
async function fillPair(root, c, face = 'right', S = 2) {
  budRow(root, 'idle');
  const slot = $('.cv-char', root); if (!slot || !c?.pokemon) return;
  const m = await fz(); const w = await m?.walkSprite(c.pokemon, S, face, false, !!c.shiny).catch(() => null);
  if (w && slot.isConnected) slot.innerHTML = w.html;
}
async function spriteInto(el, name, S = 2, faceDir = 'down', stand = true) {
  const m = await fz(); const w = await m?.walkSprite(name, S, faceDir, stand).catch(() => null);
  if (w && el?.isConnected) el.innerHTML = w.html;
}
const buddyName = (c) => buddyLook(c?.id || '')?.name || '';

// ---- the booth games. play(el, c, done(score, note, tickets?)); tickets(score) = what a paid game gives
function hud(el, extra = '') { el.innerHTML = `<div class="cv-hud"><span>⏱️ <b class="cv-t">30</b></span><span>⭐ <b class="cv-s">0</b></span>${extra}</div><div class="cv-field"></div>`; return $('.cv-field', el); }
function timer(el, secs, onTick, onEnd) {
  let left = secs; const t = setInterval(() => { if (!el.isConnected) { clearInterval(t); return; } left--; const e = $('.cv-t', el); if (e) e.textContent = left; onTick?.(left); if (left <= 0) { clearInterval(t); onEnd(); } }, 1000);
  return () => left;
}
const GAMES = {
  whack: { name: 'Whack-a-Diglett', who: 'Diglett', face: 'diglett', icon: '🔨', blurb: 'Bonk every Diglett that pops up. Don’t bonk the Gengar!',
    how: '30 seconds. Tap a Diglett to bonk it (+1). Gengar sneaks in too: bonking him costs 3.',
    tickets: (s) => (s >= 28 ? 20 : s >= 20 ? 12 : s >= 12 ? 7 : s > 0 ? 3 : 0),
    play(el, c, done) {
      const f = hud(el); let score = 0; let on = true;
      f.innerHTML = `<div class="cv-holes">${Array.from({ length: 9 }, () => '<button class="cv-hole"><span class="cv-mole"></span></button>').join('')}</div>`;
      const holes = $$('.cv-hole', f); const left = timer(el, 30, null, () => { on = false; holes.forEach((h) => h.classList.remove('up', 'bad')); setTimeout(() => done(score, `${score} Diglett bonked`), 500); });
      const pop = () => {
        if (!el.isConnected || !on) return; const free = holes.filter((h) => !h.classList.contains('up'));
        if (free.length) { const h = pickOne(free); const bad = Math.random() < 0.18; h.classList.add('up'); h.classList.toggle('bad', bad);
          h.firstChild.style.backgroundImage = `url(${P(bad ? 'gengar' : 'diglett')})`; clearTimeout(h._t); h._t = setTimeout(() => h.classList.remove('up', 'bad'), Math.max(500, 1150 - (30 - left()) * 22)); }
        setTimeout(pop, Math.max(330, 820 - (30 - left()) * 16));
      };
      holes.forEach((h) => { h.onpointerdown = (e) => { e.preventDefault(); if (!on || !h.classList.contains('up')) return; clearTimeout(h._t);
        const bad = h.classList.contains('bad'); score = Math.max(0, score + (bad ? -3 : 1)); h.classList.remove('up', 'bad'); h.classList.add(bad ? 'boo' : 'bonk');
        setTimeout(() => h.classList.remove('bonk', 'boo'), 320); bad ? missSound() : stepSound('up'); $('.cv-s', el).textContent = score; }; });
      pop();
    } },
  ducks: { name: 'Psyduck Pond', who: 'Psyduck', face: 'psyduck', icon: '🦆', blurb: 'Pick 3 Psyduck from the stream. Each one has tickets written underneath.',
    how: 'Tap 3 Psyduck as they float by. Each one has 1, 2, 3 or 5 tickets on the bottom, and one lucky duck has 10.',
    tickets: (s) => s,
    play(el, c, done) {
      el.innerHTML = '<div class="cv-hud"><span>🦆 Picks left: <b class="cv-p">3</b></span><span>🎟️ <b class="cv-s">0</b></span></div><div class="cv-field cv-pond"><div class="cv-water"></div></div>';
      const f = $('.cv-pond', el); const vals = [1, 1, 2, 2, 3, 3, 5, 10].sort(() => Math.random() - 0.5); let picks = 3; let sum = 0;
      const ducks = vals.map((v, i) => { const d = document.createElement('button'); d.className = 'cv-duck'; d.innerHTML = `<img src="${P('psyduck')}" alt="Psyduck"><i></i><b>${v}</b>`;
        d._x = (i % 4) * 25 + Math.random() * 10; d._lane = i < 4 ? 0 : 1; d._v = v; f.appendChild(d); return d; });
      let last = performance.now();
      const step = (t) => { if (!el.isConnected) return; const dt = (t - last) / 1000; last = t;
        ducks.forEach((d) => { if (d.classList.contains('picked')) return; d._x = (d._x + (d._lane ? -1 : 1) * dt * 9 + 110) % 110; d.style.left = `${d._x - 8}%`; d.style.top = d._lane ? '58%' : '22%'; d.style.transform = `translateY(${Math.sin(t / 400 + d._x) * 3}px)`; });
        requestAnimationFrame(step); };
      requestAnimationFrame(step);
      ducks.forEach((d) => { d.onclick = () => { if (!picks || d.classList.contains('picked')) return; picks--; sum += d._v; d.classList.add('picked'); d._v >= 5 ? jingle(true) : stepSound('right');
        $('.cv-p', el).textContent = picks; $('.cv-s', el).textContent = sum;
        if (!picks) setTimeout(() => { ducks.forEach((x) => x.classList.add('picked')); setTimeout(() => done(sum, `picked ducks worth ${sum}`), 1400); }, 400); }; });
    } },
  balloons: { name: 'Pikachu Balloon Pop', who: 'Pikachu', face: 'pikachu', icon: '🎈', blurb: 'Run along the top as Pikachu and pop the balloons with Iron Tail and Thunderbolt!',
    how: '30 seconds. Tap where Pikachu should run (or use ← →). ⬆️ Up = 🌀 Iron Tail: swings wide but only reaches balloons near the top. ⬇️ Down = ⚡ Thunderbolt: zaps straight down and pops the first balloon under Pikachu. On a phone, swipe up or down, or use the buttons. Red 1 · Blue 2 · Green 3 · Purple 5 · Gold 10. Voltorb balloons blow up for −5!',
    tickets: (s) => (s >= 120 ? 20 : s >= 80 ? 12 : s >= 45 ? 7 : s > 0 ? 3 : 0),
    // her ask 11-11: Pikachu runs on top and pops rising balloons with Iron Tail or Thundershock; very round, colourful
    // balloons where each colour is worth something
    play(el, c, done) {
      const COLORS = [['red', 1, 0.33], ['blue', 2, 0.25], ['green', 3, 0.17], ['purple', 5, 0.12], ['gold', 10, 0.06], ['volt', -5, 0.07]];
      el.innerHTML = `<div class="cv-hud"><span>⏱️ <b class="cv-t">30</b></span><span>⭐ <b class="cv-s">0</b></span></div>
        <div class="cv-field cv-sky cv-bp"><div class="cv-bp-rail"></div><div class="cv-pika"><span class="cv-pika-r"></span><span class="cv-pika-l"></span></div><svg class="cv-bolt" viewBox="0 0 20 100" preserveAspectRatio="none"><polyline points="10,0 4,18 14,34 5,52 15,70 6,86 11,100" fill="none" stroke="#fff35a" stroke-width="3"/></svg><span class="cv-tail"></span></div>
        <div class="cv-bp-btns"><button class="btn alt" id="cvtail">⬆️ 🌀 Iron Tail</button><button class="btn" id="cvzap">⬇️ ⚡ Thunderbolt</button></div>
        <div class="cv-bp-key small muted">${COLORS.filter(([k]) => k !== 'volt').map(([k, v]) => `<span><i class="cv-dot ${k}"></i>${v}</span>`).join('')}<span><i class="cv-dot volt"></i>−5</span></div>`;
      const f = $('.cv-bp', el); const pika = $('.cv-pika', f); const bolt = $('.cv-bolt', f); const tail = $('.cv-tail', f);
      Promise.all([fz().then((m) => m?.walkSprite('Pikachu', 2, 'right')), fz().then((m) => m?.walkSprite('Pikachu', 2, 'left'))]).then(([r, l]) => {
        if (!f.isConnected) return; if (r) $('.cv-pika-r', pika).innerHTML = r.html; if (l) $('.cv-pika-l', pika).innerHTML = l.html; }).catch(() => {});
      let score = 0; let on = true; let px = 50; let target = 50; let face = 'r'; let zapAt = 0; let tailAt = 0; const bs = new Set();
      const pick = () => { let r = Math.random(); for (const x of COLORS) { r -= x[2]; if (r <= 0) return x; } return COLORS[0]; };
      const pop = (b) => { if (b._dead) return; b._dead = true; score = Math.max(0, score + b._v); b.classList.add('pop');
        b.insertAdjacentHTML('beforeend', `<em>${b._v > 0 ? '+' + b._v : b._v}</em>`);
        if (b._v < 0) { missSound(); f.classList.add('zap'); setTimeout(() => f.classList.remove('zap'), 300); } else stepSound(b._v >= 5 ? 'up' : 'left');
        $('.cv-s', el).textContent = score; setTimeout(() => { b.remove(); bs.delete(b); }, 380); };
      const zap = () => { const t = performance.now(); if (!on || t - zapAt < 550) return; zapAt = t;
        bolt.style.left = px + '%'; bolt.classList.remove('go'); void bolt.offsetWidth; bolt.classList.add('go');
        const hit = [...bs].filter((b) => !b._dead && Math.abs(b._x - px) < 7 && b._y < 96).sort((a, b) => b._y - a._y)[0];
        if (hit) { bolt.style.height = `${Math.max(8, 100 - hit._y - 14)}%`; pop(hit); } else bolt.style.height = '100%'; };
      const swing = () => { const t = performance.now(); if (!on || t - tailAt < 450) return; tailAt = t;
        tail.style.left = px + '%'; tail.classList.remove('go'); void tail.offsetWidth; tail.classList.add('go'); pika.classList.remove('spin'); void pika.offsetWidth; pika.classList.add('spin');
        [...bs].filter((b) => !b._dead && Math.abs(b._x - px) < 14 && b._y > 58 && b._y < 100).forEach(pop); };
      $('#cvzap', el).onclick = zap; $('#cvtail', el).onclick = swing;
      // her ask 11-11: up = Iron Tail, down = Thunderbolt (arrow keys or a swipe on the play area); a plain tap moves Pikachu
      let sy = null; let sx = 0;
      f.onpointerdown = (e) => { sy = e.clientY; sx = e.clientX; };
      f.onpointerup = (e) => { if (sy == null) return; const dy = e.clientY - sy; const r = f.getBoundingClientRect(); sy = null;
        if (dy < -30) swing(); else if (dy > 30) zap(); else target = Math.max(4, Math.min(96, (sx - r.left) / r.width * 100)); };
      f.style.touchAction = 'none';
      const keys = (e) => { if (!el.isConnected) { removeEventListener('keydown', keys); return; }
        if (e.key === 'ArrowLeft') target = Math.max(4, px - 12); else if (e.key === 'ArrowRight') target = Math.min(96, px + 12);
        else if (e.key === 'ArrowDown' || e.key === ' ') zap(); else if (e.key === 'ArrowUp') swing(); else return; e.preventDefault(); };
      addEventListener('keydown', keys);
      timer(el, 30, null, () => { on = false; removeEventListener('keydown', keys); setTimeout(() => done(score, `${score} balloon points`), 700); });
      const spawn = () => { if (!el.isConnected || !on) return;
        const [kind, v] = pick(); const b = document.createElement('div'); b.className = `cv-bal ${kind}`; b.innerHTML = kind === 'volt' ? '<i></i>' : `<b>${v}</b>`;
        b._x = 6 + Math.random() * 88; b._y = -22; b._v = v; b._sp = 13 + Math.random() * 10 + (kind === 'gold' ? 6 : 0); b._w = Math.random() * 6;
        b.style.left = b._x + '%'; f.appendChild(b); bs.add(b);
        setTimeout(spawn, 330 + Math.random() * 300); };
      let last = performance.now();
      const step = (t) => { if (!el.isConnected) return; const dt = Math.min(0.05, (t - last) / 1000); last = t;
        const d = target - px; if (Math.abs(d) > 0.5) { const nf = d > 0 ? 'r' : 'l'; if (nf !== face) { face = nf; pika.dataset.face = face; } px += Math.sign(d) * Math.min(Math.abs(d), 75 * dt); pika.classList.add('run'); } else pika.classList.remove('run');
        pika.style.left = px + '%';
        bs.forEach((b) => { if (b._dead) return; b._y += b._sp * dt; b.style.bottom = b._y + '%'; b.style.marginLeft = `${Math.sin(t / 600 + b._w) * 6}px`; if (b._y > 112) { b.remove(); bs.delete(b); } });
        requestAnimationFrame(step); };
      pika.dataset.face = 'r'; requestAnimationFrame(step); spawn();
    } },
  rings: { name: 'Slowpoke Ring Toss', who: 'Slowpoke', face: 'slowpoke', icon: '⭕', blurb: 'Toss rings onto the Slowpoke. They’re slow… but they do sway.',
    how: '6 rings. The arrow slides back and forth: tap Throw when it’s right over a Slowpoke. 3 tickets a ringer, +5 for all six.',
    tickets: (s) => s * 3 + (s >= 6 ? 5 : 0),
    play(el, c, done) {
      el.innerHTML = '<div class="cv-hud"><span>⭕ Rings: <b class="cv-p">6</b></span><span>✅ <b class="cv-s">0</b></span></div><div class="cv-field cv-ringlane"><div class="cv-aim"></div></div><button class="btn block" id="cvthrow">⭕ Throw!</button>';
      const f = $('.cv-ringlane', el); const aim = $('.cv-aim', f); let rings = 6; let hits = 0; let busy = false;
      const pokes = [20, 50, 80].map((x, i) => { const s = document.createElement('div'); s.className = 'cv-slowpoke'; s.innerHTML = `<img src="${P('slowpoke')}" alt="Slowpoke"><span class="cv-stack"></span>`; s._x0 = x; s._ph = i * 2; f.appendChild(s); return s; });
      let ax = 0; let dir = 1; let last = performance.now();
      const step = (t) => { if (!el.isConnected) return; const dt = (t - last) / 1000; last = t;
        const sp = 70 + (6 - rings) * 12; ax += dir * sp * dt; if (ax > 100) { ax = 100; dir = -1; } if (ax < 0) { ax = 0; dir = 1; }
        aim.style.left = ax + '%'; pokes.forEach((p) => { p._x = p._x0 + Math.sin(t / 1400 + p._ph) * 5; p.style.left = p._x + '%'; });
        requestAnimationFrame(step); };
      requestAnimationFrame(step);
      $('#cvthrow', el).onclick = async () => {
        if (busy || !rings) return; busy = true; rings--; $('.cv-p', el).textContent = rings; const x = ax;
        const ring = document.createElement('span'); ring.className = 'cv-ring'; ring.style.left = x + '%'; f.appendChild(ring); await wait(550); if (!el.isConnected) return;
        const hit = pokes.find((p) => Math.abs(p._x - x) < 6.5);
        if (hit) { hits++; ring.remove(); $('.cv-stack', hit).insertAdjacentHTML('beforeend', '<i></i>'); stepSound('up'); $('.cv-s', el).textContent = hits; } else { ring.classList.add('miss'); missSound(); setTimeout(() => ring.remove(), 500); }
        busy = false; if (!rings) setTimeout(() => done(hits, `${hits} of 6 ringers`), 700);
      };
    } },
  hammer: { name: 'Machamp’s Strength Test', who: 'Machamp', face: 'machamp', icon: '🔔', blurb: 'Swing the big hammer and ring the bell at the top!',
    how: '3 swings. The power bar goes up and down fast: tap Swing! at the very top. Ring the bell (95+) for 6 tickets, 80+ gets 3, 50+ gets 1.',
    tickets: (s) => s,
    play(el, c, done) {
      el.innerHTML = `<div class="cv-hud"><span>🔨 Swings: <b class="cv-p">3</b></span><span>💪 <b class="cv-s">–</b></span></div>
        <div class="cv-field cv-strength"><div class="cv-tower"><span class="cv-bell">🔔</span><span class="cv-puck"></span><b style="bottom:95%">RING!</b><b style="bottom:80%">Champ</b><b style="bottom:50%">Strong</b><b style="bottom:20%">Wimpy</b></div>
        <div class="cv-meter"><span class="cv-fill"></span></div><div class="cv-champ">${face('machamp')}</div></div><button class="btn block" id="cvswing">🔨 Swing!</button>`;
      const fill = $('.cv-fill', el); const puck = $('.cv-puck', el); let swings = 3; let tix = 0; let best = 0; let busy = false; let v = 0; let dir = 1; let last = performance.now(); const notes = [];
      const step = (t) => { if (!el.isConnected) return; const dt = (t - last) / 1000; last = t; if (!busy) { v += dir * (140 + (3 - swings) * 40) * dt; if (v > 100) { v = 100; dir = -1; } if (v < 0) { v = 0; dir = 1; } fill.style.height = v + '%'; } requestAnimationFrame(step); };
      requestAnimationFrame(step);
      $('#cvswing', el).onclick = async () => {
        if (busy || !swings) return; busy = true; swings--; const p = Math.round(v); $('.cv-p', el).textContent = swings;
        puck.style.transition = 'bottom .5s cubic-bezier(.2,.9,.3,1)'; puck.style.bottom = `${Math.min(92, p)}%`; await wait(550); if (!el.isConnected) return;
        const t = p >= 95 ? 6 : p >= 80 ? 3 : p >= 50 ? 1 : 0; tix += t; best = Math.max(best, p); notes.push(p);
        if (p >= 95) { $('.cv-bell', el).classList.add('ring'); jingle(true); } else (p >= 50 ? stepSound('right') : missSound());
        $('.cv-s', el).textContent = `${p}${t ? ` (+${t})` : ''}`; await wait(900); if (!el.isConnected) return;
        $('.cv-bell', el).classList.remove('ring'); puck.style.transition = 'bottom .3s'; puck.style.bottom = '0%'; busy = false;
        if (!swings) setTimeout(() => done(tix, `swings of ${notes.join(', ')}`, tix), 400);
      };
    } },
  hats: { name: 'Haunter’s Hat Trick', who: 'Haunter', face: 'haunter', icon: '🎩', blurb: 'Haunter hides under a top hat and shuffles. Can you keep your eye on him?',
    how: '3 rounds, each one faster. Watch the hat Haunter hides under, then tap it. 1 right = 4 tickets, 2 = 9, all 3 = 15.',
    tickets: (s) => [0, 4, 9, 15][s] || 0,
    play(el, c, done) {
      el.innerHTML = '<div class="cv-hud"><span>🎩 Round <b class="cv-p">1</b>/3</span><span>✅ <b class="cv-s">0</b></span></div><div class="cv-field cv-hats"><div class="cv-ghost"></div></div><p class="cv-hint small muted" style="text-align:center"></p>';
      const f = $('.cv-hats', el); const ghost = $('.cv-ghost', f); ghost.style.backgroundImage = `url(${P('haunter')})`; const hint = $('.cv-hint', el);
      const X = [18, 50, 82]; const hats = X.map((x, i) => { const h = document.createElement('button'); h.className = 'cv-hat'; h.innerHTML = '🎩'; h._slot = i; h.style.left = x + '%'; f.appendChild(h); return h; });
      let score = 0;
      const round = async (n) => {
        $('.cv-p', el).textContent = n; const g = Math.floor(Math.random() * 3); const swaps = [5, 8, 12][n - 1]; const ms = [460, 340, 240][n - 1];
        hats.forEach((h) => { h.style.transition = `left ${ms}ms ease-in-out, transform .3s`; h.classList.remove('lift'); });
        ghost.style.left = X[hats[g]._slot] + '%'; ghost.classList.add('show'); hats[g].classList.add('lift'); hint.textContent = 'Haunter hides under this one… hehehe!'; await wait(1300);
        hats[g].classList.remove('lift'); await wait(350); ghost.classList.remove('show'); hint.textContent = 'Shuffling…';
        for (let i = 0; i < swaps; i++) { const a = Math.floor(Math.random() * 3); let b = Math.floor(Math.random() * 2); if (b >= a) b++;
          const ha = hats.find((h) => h._slot === a); const hb = hats.find((h) => h._slot === b); ha._slot = b; hb._slot = a; ha.style.left = X[b] + '%'; hb.style.left = X[a] + '%'; await wait(ms + 40); if (!el.isConnected) return; }
        hint.textContent = 'Where is Haunter? Tap a hat!';
        const pick = await new Promise((ok) => hats.forEach((h, i) => { h.onclick = () => ok(i); }));
        hats.forEach((h) => { h.onclick = null; });
        ghost.style.left = X[hats[g]._slot] + '%'; hats[pick].classList.add('lift'); if (pick !== g) hats[g].classList.add('lift'); ghost.classList.add('show');
        const right = pick === g; if (right) { score++; stepSound('up'); hint.textContent = 'Found him! “Aww, no fair!”'; } else { missSound(); hint.textContent = '“Hehehe! Over here!”'; }
        $('.cv-s', el).textContent = score; await wait(1500);
      };
      (async () => { for (let n = 1; n <= 3; n++) { await round(n); if (!el.isConnected) return; } done(score, `found Haunter ${score} of 3 times`); })();
    } },
};

// ---- rides (cost tickets; count as play time and raise Bond) and snacks (count as food)
const RIDES = {
  carousel: { name: 'Rapidash Carousel', face: 'rapidash', cost: 4, blurb: 'Round and round on a Rapidash, with the band organ playing.',
    lines: ['The band organ starts up and the Rapidash rise and fall…', '{b} waves at everyone going by!', 'Round and round under the twinkling lights.', 'The music winds down. What a ride!'] },
  wheel: { name: 'Wishing Star Wheel', face: 'jirachi', cost: 5, blurb: 'Ride to the top of the Ferris wheel and see the Millennium Comet up close.',
    lines: ['Your car rocks gently as it starts to climb…', 'Up, up, up over the tents and the lights…', 'From the very top you can see the whole carnival, and the Millennium Comet!', '{b} makes a wish on the comet. Back down we go.'] },
  coaster: { name: 'Dragonite Coaster', face: 'dragonite', cost: 6, blurb: 'Dragonite pulls the coaster car up the big hill. Hold on tight!',
    lines: ['Click, click, click… Dragonite pulls you up the big hill…', 'WHOOOOSH! Down the drop!', '{b} is squealing with joy!', 'The car rolls into the station. Again! Again!'] },
  teacups: { name: 'Lapras Tea Cups', face: 'lapras', cost: 4, blurb: 'Spin in a Lapras teacup as fast as you dare.',
    lines: ['You climb into a Lapras teacup…', 'Spin it faster! Faster!', '{b} is getting dizzy… and loving it.', 'The cups slow down. Everything is still spinning a little!'] },
  funhouse: { name: 'Haunter’s Funhouse', face: 'haunter', cost: 5, blurb: 'Haunter’s magic mirror twists your buddy into its evolved, shiny, Mega, paradox or Gigantamax form!',
    lines: ['The door creaks shut behind you. It’s very dark in here…', 'The lights flicker. Was that a giggle?', 'BOO! Haunter pops out of a mirror! {b} jumps!', 'You made it out! Haunter waves goodbye. “Come back soon, hehehe!”'] },
};
const SNACKS = {
  cotton: { name: 'Cotton Candy', who: 'Swirlix', face: 'swirlix', cost: 3, icon: '<span class="cv-cotton"></span>', line: 'Fresh spun! Pink and fluffy, just like me!' },
  popcorn: { name: 'Popcorn', who: 'Snorlax', face: 'snorlax', cost: 3, icon: '🍿', line: '…zzz… *munch* …oh! Here you go… *munch*' },
  puff: { name: 'Poké Puff', who: 'Slurpuff', face: 'slurpuff', cost: 4, icon: '🧁', line: 'A Poké Puff with extra frosting, sweetie!' },
};

// ---- the Prize Booth: base pieces (the Secret Base prize pieces), cursors, site themes and dice
const DECOR_PRICES = { doll: 40, big: 120, mat: 60, plant: 60, desk: 80, chair: 60, tv: 90, ornament: 70, slide: 110 };
const SPECIAL = { sb_big_regirock: 200, sb_big_regice: 200, sb_big_registeel: 200, sb_goldshield: 250, sb_silvershield: 150 };
let prizeCache = null;
const PRIZES = () => (prizeCache ||= [
  ...Object.entries(DECOR).filter(([, it]) => it[5] === 'win').map(([k, it]) => ({ kind: 'decor', k, name: it[0], pic: it[1], price: SPECIAL[k] || DECOR_PRICES[it[6]] || 80 })),
  ...[['jirachi', 150], ['drifloon', 120]].map(([k, price]) => ({ kind: 'cursor', k, name: REWARD_CURSORS[k] || k, pic: `assets/ui/${k}_cursor.png`, price })),
  ...[['carnival', 200], ['cottoncandy', 200]].map(([k, price]) => ({ kind: 'theme', k, name: (THEMES[k]?.name || k) + ' theme', price })),
  ...[['comet', 150], ['cottoncandy', 150], ['carousel', 150]].map(([k, price]) => ({ kind: 'dice', k, name: DICE_REWARDS[k] || k, price })),
]);
const PRIZE_TABS = [['decor', '🏠 For your base'], ['cursor', '🖱️ Cursors'], ['theme', '🎨 Themes'], ['dice', '🎲 Dice']];
const owns = (c, p) => (p.kind === 'cursor' ? (c.cursors || []).includes(p.k) : p.kind === 'theme' ? (c.themes || []).includes(p.k) : p.kind === 'dice' ? (c.dice || []).includes(p.k) : false);
const ownedDecor = (id, k) => num(store.get(`base/${id}/owned/${k}`));
function prizeArt(p) {
  if (p.pic && p.kind === 'cursor') return `<span class="cv-pz-cur" style="background-image:url(${p.pic})"></span>`;
  if (p.pic) return `<img src="${p.pic}" alt="">`;
  if (p.kind === 'theme') { const s = THEMES[p.k]?.swatch || []; return `<span class="cv-pz-sw">${s.map((x) => `<i style="background:${x}"></i>`).join('')}</span>`; }
  return `<span class="cv-pz-die cv-die-${esc(p.k)}">⚄</span>`;
}
function grant(c, p) {
  if (p.kind === 'decor') store.update(`base/${c.id}/owned/${p.k}`, (n) => num(n) + 1);
  else { const f = p.kind === 'cursor' ? 'cursors' : p.kind === 'theme' ? 'themes' : 'dice'; store.update('party/' + c.id, (x) => ({ ...x, [f]: [...new Set([...(x?.[f] || []), p.k])] })); }
}
const where = (p) => (p.kind === 'decor' ? 'Open your base and tap 🔨 Build to put it out.' : p.kind === 'cursor' ? 'Open ⚙️ Settings → Cursor to use it (on a computer with a mouse).' : p.kind === 'theme' ? 'Open ⚙️ Settings → Theme to switch to it.' : 'Open ⚙️ Settings → Dice skin to roll with them.');

// Haunter's funhouse mirror (her ask 11-11): what each nursery baby can turn into (first = favourite evolution)
const EVOS = { pichu: ['Raichu', 'Pikachu'], cleffa: ['Clefable', 'Clefairy'], igglybuff: ['Jigglypuff'], togepi: ['Togekiss', 'Togetic'], tyrogue: ['Hitmontop', 'Hitmonlee', 'Hitmonchan'],
  smoochum: ['Jynx'], elekid: ['Electivire', 'Electabuzz'], magby: ['Magmortar', 'Magmar'], azurill: ['Azumarill', 'Marill'], wynaut: ['Wobbuffet'], budew: ['Roserade', 'Roselia'],
  chingling: ['Chimecho', 'Chingling'], bonsly: ['Sudowoodo'], mimejr: ['Mr. Mime'], happiny: ['Blissey', 'Chansey'], munchlax: ['Snorlax'], riolu: ['Lucario'], ditto: ['Ditto'] };
const BABY_NAME = { mimejr: 'Mime Jr.' };
const SHINY_HUE = { pichu: -50, cleffa: 160, igglybuff: 150, togepi: 200, tyrogue: 140, smoochum: 180, elekid: 150, magby: 70, azurill: 300, wynaut: 160, budew: 230, chingling: 140, bonsly: 60, mimejr: 160, happiny: 120, munchlax: 140, riolu: 160 };
const an = (w) => (/^[AEIOU]/i.test(w) ? 'an ' : 'a ') + w;
async function mirrorForm(sp) {
  const key = sp.startsWith('m_') ? 'ditto' : sp; const baby = BABY_NAME[key] || key.charAt(0).toUpperCase() + key.slice(1);
  const shiny = { fx: 'fx-shiny', style: `--hue:${SHINY_HUE[key] ?? 150}deg`, name: `a shiny ${baby}`, label: `a shiny ${baby}, sparkling all over` };
  // the evolution's walk sprite: usually the final form, sometimes the middle one; tries the next if one is missing
  const evoSprite = async () => { const m = await fz(); const list = [...(EVOS[key] || [baby])]; if (list.length > 1 && Math.random() < 0.3) list.push(list.shift());
    for (const n of list) { const w = await m?.walkSprite(n, 2, 'down', true).catch(() => null); if (w) return { n, html: w.html }; } return null; };
  const kinds = ['evolved', 'shiny', 'mega', 'paradox', 'gmax'].sort(() => Math.random() - 0.5);
  for (const k of kinds) {
    if (k === 'shiny') return shiny;
    const e = await evoSprite(); if (!e) continue;
    const short = e.n.replace(/^Mr\. /, '');
    if (k === 'evolved') return { fx: 'fx-evolved', html: e.html, name: an(e.n), label: `${an(e.n)}, all grown up` };
    if (k === 'mega') return { fx: 'fx-mega', html: e.html, name: `Mega ${e.n}`, label: `Mega ${e.n}, glowing with Mega Evolution energy` };
    if (k === 'gmax') return { fx: 'fx-gmax', html: e.html, name: `Gigantamax ${e.n}`, label: `a HUGE Gigantamax ${e.n} with red Dynamax clouds` };
    if (key === 'igglybuff') return { fx: 'fx-ancient', html: e.html, name: 'Scream Tail', label: 'Scream Tail, its ancient paradox form' };
    return Math.random() < 0.5 ? { fx: 'fx-ancient', html: e.html, name: `an ancient paradox ${e.n}`, label: `an ancient paradox ${e.n} from the distant past` }
      : { fx: 'fx-future', html: e.html, name: `Iron ${short}`, label: `Iron ${short}, a paradox from the far future` };
  }
  return shiny;
}

const STAR_DAYS = 7;
const WISHES = [['tickets', '🎟️', '100 tickets', 'A big pile of carnival tickets.'], ['prize', '🎁', 'A free prize', 'Your next Prize Booth trade costs nothing, any prize at all.'],
  ['bond', '❤️', 'A bond heart', 'Your nursery buddy gets a whole bond heart.']];

// the Wishmaker dreamcatcher (her ask 11-11, from her screenshot of the movie): 7 tan sections with a blue swirl band,
// a red bead and a gold tassel on each, and the flap with red stars on top that fills in as sections fold closed
const closedOf = (st) => (Array.isArray(st?.closed) ? st.closed : Array.from({ length: Math.min(STAR_DAYS, num(st?.n)) }, (_, i) => i));
const pol = (r, a) => { const t = a * Math.PI / 180; return `${(r * Math.sin(t)).toFixed(1)} ${(-r * Math.cos(t)).toFixed(1)}`; };
const wedge = (r0, r1, a0, a1) => (r0 ? `M${pol(r0, a0)} L${pol(r1, a0)} A${r1} ${r1} 0 0 1 ${pol(r1, a1)} L${pol(r0, a1)} A${r0} ${r0} 0 0 0 ${pol(r0, a0)}Z`
  : `M0 0 L${pol(r1, a0)} A${r1} ${r1} 0 0 1 ${pol(r1, a1)}Z`);
function dreamcatcherSVG(closed) {
  const th = 360 / STAR_DAYS; const h = th / 2; const shut = new Set(closed);
  const part = (i) => `<g class="dc-part ${shut.has(i) ? 'shut' : ''}" data-panel="${i}" transform="rotate(${shut.has(i) ? 0 : i * th})">
    <path d="${wedge(0, 92, -h, h)}" fill="#f1dcbc" stroke="#3a2a1a" stroke-width="1.4"/>
    <path d="${wedge(50, 76, -h, h)}" fill="#2a3f9a"/><path d="${wedge(60, 65, -h, h)}" fill="#dcf0ee" opacity=".9"/>
    <path d="${wedge(76, 82, -h, h)}" fill="#cfe9ea"/><path d="M0 0 L${pol(92, -h)}" stroke="#3a2a1a" stroke-width="1.4"/>
    <path d="M${pol(94, -h)} L${pol(110, -h - 4)} L${pol(112, -h + 3)} Z" fill="#f2b632" stroke="#9a6a10" stroke-width=".8"/><circle cx="${pol(93, -h).split(' ')[0]}" cy="${pol(93, -h).split(' ')[1]}" r="5" fill="#d0242a" stroke="#6a0a0a" stroke-width="1"/></g>`;
  const order = [...Array(STAR_DAYS).keys()].filter((i) => !shut.has(i)).concat(closed);   // folded sections stack on top
  const n = closed.length; const stars = Array.from({ length: n }, (_, k) => { const row = [0, 1, 1, 2, 2, 2, 3][k]; const col = [0, 0, 1, 0, 1, 2, 0][k]; const cnt = [1, 2, 2, 3, 3, 3, 1][k];
    const x = (col - (cnt - 1) / 2) * 13; const y = -84 + row * 14; return `<text x="${x}" y="${y}" font-size="13" text-anchor="middle" fill="#c0262c">★</text>`; }).join('');
  return `<svg class="cv-dream" viewBox="-120 -125 240 245" role="img" aria-label="Wishmaker dreamcatcher, ${n} of ${STAR_DAYS} closed"><circle r="14" fill="#f1dcbc" stroke="#3a2a1a" stroke-width="1.4"/>${order.map(part).join('')}
    ${n ? `<g class="dc-flap"><path d="M0 -6 L${pol(96, -h * 1.04)} A96 96 0 0 1 ${pol(96, h * 1.04)} Z" fill="#f1dcbc" stroke="#3a2a1a" stroke-width="1.6"/>${stars}</g>` : ''}<circle r="5" fill="#3a2a1a"/></svg>`;
}

const GREET = ['Welcome, welcome to the Wishmaker Star Carnival! The comet only comes once in a thousand years, so have fun!', 'Step right up! Games, rides and the fluffiest cotton candy under the comet!',
  'Ooh, a little one! Hold their paw tight, the midway gets busy after dark.', 'Win tickets at the booths and trade them at the Prize Booth. Everyone’s a winner… almost!'];

export function renderCarnival(main, g, gm, onEdit) {
  const c = me();
  let tab = 'games'; let prizeTab = 'decor'; let buying = null;
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a><span class="row" style="gap:6px"><button class="btn alt sm" id="cvmusic"></button>${gm ? '<button class="btn alt sm" id="ed">Edit</button>' : ''}</span></div>
    <h1 style="margin:10px 0 4px">${esc(g.name)}</h1><p>${esc(g.intro || '')}</p>
    <div class="cv-scene" id="cvscene">
      <div class="cv-stars"></div><div class="cv-comet"><i></i></div><div class="cv-jirachi" title="Jirachi"></div><span class="cv-shoot"></span>
      <svg class="cv-wheel" viewBox="-60 -60 120 120" aria-hidden="true"><g class="cv-wheel-spin"><circle r="52" fill="none" stroke="#f2c14e" stroke-width="2.5"/><circle r="10" fill="#f2c14e"/>
        ${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; const x = Math.cos(a) * 52; const y = Math.sin(a) * 52; return `<line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#f2c14e" stroke-width="1.2"/><circle class="cv-bulb" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" style="animation-delay:${(i % 3) * 0.35}s"/><rect x="${(x - 5).toFixed(1)}" y="${(y + 2).toFixed(1)}" width="10" height="8" rx="2" fill="${['#e24a4a', '#4a8fe2', '#f2c14e', '#a45ae2'][i % 4]}"/>`; }).join('')}</g>
        <path d="M0 0 L-30 64 M0 0 L30 64" stroke="#c99a3a" stroke-width="3"/></svg>
      <svg class="cv-tent" viewBox="0 0 160 110" aria-hidden="true"><defs><pattern id="cvst" width="20" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#d63a3a"/><rect x="10" width="10" height="10" fill="#f6eedf"/></pattern></defs>
        <path d="M80 4 L150 60 L150 106 L10 106 L10 60 Z" fill="url(#cvst)"/><path d="M80 4 L150 60 L10 60 Z" fill="url(#cvst)" stroke="#8a1f1f" stroke-width="2"/><path d="M80 4 L80 -8 L96 -3 L80 2" fill="#f2c14e"/>
        <path d="M60 106 Q80 66 100 106 Z" fill="#ffd77a" class="cv-door"/><path d="M10 60 Q30 72 45 60 Q62 72 80 60 Q98 72 115 60 Q130 72 150 60" fill="none" stroke="#f2c14e" stroke-width="3"/></svg>
      <svg class="cv-carousel" viewBox="0 0 120 100" aria-hidden="true"><path d="M60 6 L114 34 L6 34 Z" fill="#a45ae2" stroke="#f2c14e" stroke-width="2"/><path d="M6 34 Q20 42 33 34 Q47 42 60 34 Q73 42 87 34 Q100 42 114 34" fill="#f2c14e"/>
        <g class="cv-poles">${[22, 46, 74, 98].map((x, i) => `<line x1="${x}" y1="38" x2="${x}" y2="84" stroke="#f2c14e" stroke-width="2"/><ellipse class="cv-horse" style="animation-delay:${i * 0.4}s" cx="${x}" cy="66" rx="9" ry="6" fill="#fbe9d0"/>`).join('')}</g><rect x="4" y="84" width="112" height="10" rx="3" fill="#6b2a3a" stroke="#f2c14e" stroke-width="2"/></svg>
      <svg class="cv-lights" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 4 Q75 34 150 6 Q225 34 300 4" fill="none" stroke="#2b1d12" stroke-width="1"/>
        ${Array.from({ length: 22 }, (_, i) => { const t = (i + 0.5) / 22; const seg = t < 0.5 ? t * 2 : (t - 0.5) * 2; const x = t * 300; const y = 4 + Math.sin(seg * Math.PI) * 26 - (t < 0.5 ? 0 : 1); return `<circle class="cv-bulb ${i % 7 === 3 ? 'flick' : ''}" cx="${x.toFixed(1)}" cy="${(y + 3).toFixed(1)}" r="2.6" style="animation-delay:${(i % 4) * 0.3}s"/>`; }).join('')}</svg>
      <div class="cv-ground"></div><div class="cv-fog"></div><div class="cv-fog b"></div>
      <div class="cv-tix" id="cvtix"></div>
      <div class="cv-walk">${pairHTML(c)}</div>
    </div>
    <div id="cvtalk">${mime(pickOne(GREET))}</div>
    ${c ? '' : '<p class="small muted">Pick your character on the home page to play and win tickets.</p>'}
    ${c && !buddyLook(c.id) ? '<p class="small muted">🍼 No nursery buddy with you yet. Get an egg from Beatrice at the Fernshade Nursery and bring your little one along!</p>' : ''}
    <div class="row cv-tabs">${[['games', '🎯 Games'], ['rides', '🎠 Rides'], ['snacks', '🍭 Snacks'], ['wish', '🌠 Wishing Star'], ['prizes', '🎁 Prize Booth']].map(([k, l]) => `<button class="btn sm ${k === tab ? '' : 'alt'}" data-tab="${k}">${l}</button>`).join('')}</div>
    <div class="card cv-panel" id="cvpanel"></div>
    ${gm ? '<details class="card small" style="margin-top:12px"><summary><b>GM: tickets</b></summary><div id="cvgm"></div></details>' : ''}`;
  pageMusic(main, 'carnival', 'cvmusic');
  const ed = $('#ed', main); if (ed) ed.onclick = onEdit;
  const scene = $('#cvscene', main); const panel = $('#cvpanel', main); const talk = $('#cvtalk', main);
  fillPair(scene, c, 'right', 2);
  spriteInto($('.cv-jirachi', scene), 'Jirachi', 1.5, 'down', true);
  const hopTimer = setInterval(() => { if (!scene.isConnected) { clearInterval(hopTimer); return; } budRow(scene, 'hop', false); setTimeout(() => budRow(scene, 'idle'), 1300); }, 9000);
  const showTix = () => { const e = $('#cvtix', main); if (e) e.innerHTML = c ? `🎟️ <b>${ticketsOf(c.id)}</b> ticket${ticketsOf(c.id) === 1 ? '' : 's'}` : '🎟️'; };
  showTix();
  const say = (html) => { talk.innerHTML = html; };
  const tabs = () => $$('[data-tab]', main).forEach((b) => { b.className = `btn sm ${b.dataset.tab === tab ? '' : 'alt'}`; b.onclick = () => { tab = b.dataset.tab; buying = null; tabs(); draw(); }; });
  const card = (k, pic, title, line, btn, extra = '') => `<div class="cv-booth">${face(pic)}<div class="grow"><b>${esc(title)}</b><p class="small muted" style="margin:2px 0 6px">${esc(line)}</p>${extra}</div><button class="btn sm" data-go="${k}" ${!c ? 'disabled' : ''}>${btn}</button></div>`;

  function draw() {
    showTix();
    if (tab === 'games') {
      const pt = c ? playsToday(c.id) : {};
      panel.innerHTML = `<p class="small muted" style="margin-top:0">Each booth pays tickets for your first ${PAID_PLAYS} games a day. After that you can still play for fun.</p>
        ${Object.entries(GAMES).map(([k, G]) => card(k, G.face, `${G.icon} ${G.name}`, G.blurb, 'Play', `<span class="pill">${Math.max(0, PAID_PLAYS - num(pt[k]))}/${PAID_PLAYS} paid games left today</span>${c && num(rec(c.id).best?.[k]) ? ` <span class="pill">🏆 best ${num(rec(c.id).best[k])}</span>` : ''}`)).join('')}`;
      $$('[data-go]', panel).forEach((b) => { b.onclick = () => playGame(b.dataset.go); });
    } else if (tab === 'rides') {
      panel.innerHTML = `<p class="small muted" style="margin-top:0">Rides cost tickets. ${buddyName(c) ? `Riding together counts as play time for ${esc(buddyName(c))} and raises your bond.` : 'Bring your nursery buddy and it counts as their play time!'}</p>
        ${Object.entries(RIDES).map(([k, R]) => card(k, R.face, R.name, R.blurb, `🎟️ ${R.cost}`)).join('')}`;
      $$('[data-go]', panel).forEach((b) => { b.onclick = () => ride(b.dataset.go); });
    } else if (tab === 'snacks') {
      panel.innerHTML = `<p class="small muted" style="margin-top:0">${buddyName(c) ? `Sharing a snack counts as a meal for ${esc(buddyName(c))}.` : 'Carnival treats! Your nursery buddy would love one.'}</p>
        ${Object.entries(SNACKS).map(([k, S]) => card(k, S.face, S.name, `${S.who}’s stand`, `🎟️ ${S.cost}`)).join('')}`;
      $$('[data-go]', panel).forEach((b) => { b.onclick = () => snack(b.dataset.go); });
    } else if (tab === 'wish') {
      // her asks 11-11: like May's Wishing Star, come back once a day for 7 days, then make a wish; the star is the
      // dreamcatcher charm from Wishmaker: it starts fully open, and each day you click one open section and it folds
      // closed (a red star appears on the flap). All 7 closed = Jirachi wakes up. carnival/<id>.star = { closed: [i], day }
      const st = c ? rec(c.id).star || {} : {}; const closed = closedOf(st); const n = closed.length; const tapped = st.day === today(); const full = n >= STAR_DAYS;
      panel.innerHTML = `${host('jirachi', 'Jirachi', full ? 'Yawn… the dreamcatcher is closed… I’m awake! Make your wish!' : tapped ? 'Zzz… one section a day… come back tomorrow…' : 'Zzz… close one part of the dreamcatcher each day… seven days… and I’ll wake up…')}
        <div class="cv-wishstar ${full ? 'full' : ''} ${!c || tapped || full ? '' : 'can'}">${dreamcatcherSVG(closed)}
        <p class="small" style="margin:6px 0 0">${full ? '🌟 <b>All 7 closed!</b> Pick your wish below.' : `<b>${n}/${STAR_DAYS}</b> closed${tapped ? ' · come back tomorrow' : c ? ' · tap an open section to close it!' : ''}`}</p></div>
        ${full ? `<div class="cv-wishes">${WISHES.map(([k, ic, t, d]) => `<button class="cv-wishbtn" data-wish="${k}"><b>${ic} ${esc(t)}</b><small>${esc(d)}</small></button>`).join('')}</div>` : '<p class="small muted">Close one section a day, any 7 days. Each one gives 2 tickets. When all 7 are closed, Jirachi wakes up and grants a wish.</p>'}
        ${c && rec(c.id).freePrize ? '<p class="pill">🎁 You have a free Prize Booth wish waiting! Open the Prize Booth.</p>' : ''}`;
      if (c && !tapped && !full) $$('[data-panel]', panel).forEach((g) => { g.onclick = () => chargeStar(+g.dataset.panel, g); });
      $$('[data-wish]', panel).forEach((b) => { b.onclick = () => wish(b.dataset.wish); });
    } else if (tab === 'prizes') drawPrizes();
  }

  function drawPrizes() {
    const meC = c ? party()[c.id] || c : null; const free = c && !!rec(c.id).freePrize; const tix = c ? (free ? Infinity : ticketsOf(c.id)) : 0;
    const list = PRIZES().filter((p) => p.kind === prizeTab);
    panel.innerHTML = `${host('mrmime', 'Mr. Mime', 'The Prize Booth! Trade your tickets for something special. Mime-mime!')}
      <div class="row cv-tabs">${PRIZE_TABS.map(([k, l]) => `<button class="btn sm ${k === prizeTab ? '' : 'alt'}" data-pt="${k}">${l}</button>`).join('')}</div>
      ${free ? '<p class="pill">🌟 Jirachi’s wish: your next trade is FREE!</p>' : ''}${buying ? `<p class="base-hint">Trade <b>${free ? 'your free wish' : buying.price + ' tickets'}</b> for the <b>${esc(buying.name)}</b>? <button class="btn sm" id="cvbuy" ${tix < buying.price ? 'disabled' : ''}>Trade</button> <button class="btn alt sm" id="cvnobuy">Cancel</button>${tix < buying.price ? ` <span class="small bad-t">You need ${buying.price - tix} more tickets.</span>` : ''}</p>` : ''}
      <div class="cv-prizes">${list.map((p, i) => { const have = meC && owns(meC, p); const n = meC && p.kind === 'decor' ? ownedDecor(c.id, p.k) : 0;
        return `<button class="cv-prize ${buying === p ? 'on' : ''} ${have ? 'have' : ''}" data-pz="${i}" ${have || !c ? 'disabled' : ''}>${prizeArt(p)}<b>${esc(p.name)}</b><small>${have ? '✓ Yours' : `🎟️ ${p.price}`}${n ? ` · have ${n}` : ''}</small></button>`; }).join('')}</div>`;
    $$('[data-pt]', panel).forEach((b) => { b.onclick = () => { prizeTab = b.dataset.pt; buying = null; drawPrizes(); }; });
    $$('[data-pz]', panel).forEach((b) => { b.onclick = () => { buying = list[+b.dataset.pz]; drawPrizes(); }; });
    const no = $('#cvnobuy', panel); if (no) no.onclick = () => { buying = null; drawPrizes(); };
    const yes = $('#cvbuy', panel); if (yes) yes.onclick = () => {
      const p = buying; const fr = !!rec(c.id).freePrize; if (!p || (!fr && ticketsOf(c.id) < p.price)) { toast('Not enough tickets for that one yet.'); return; }
      if (fr) store.set('carnival/' + c.id, { ...rec(c.id), freePrize: false }); else addTickets(c.id, -p.price); grant(c, p);
      store.pushLimited('log', { t: Date.now(), text: fr ? `🌟 ${c.nickname} used Jirachi’s wish for the ${p.name}!` : `🎪 ${c.nickname} traded ${p.price} carnival tickets for the ${p.name}!` });
      toast(`🎉 The ${p.name} is yours! ${where(p)}`); markWinner(c.id); jingle(true); buying = null; drawPrizes(); showTix();
      say(mime(`Congratulations! Enjoy your ${p.name}!`));
    };
  }

  // a booth game in the panel, then the end screen with the tickets
  function playGame(k) {
    const G = GAMES[k]; ensureAudio();
    panel.innerHTML = `<div class="row" style="justify-content:space-between;align-items:center"><b>${G.icon} ${esc(G.name)}</b><button class="btn alt sm" id="cvback">← Midway</button></div>
      ${host(G.face, G.who, G.blurb)}<p class="small muted">${esc(G.how)}</p><div class="cv-game" id="cvg"></div>`;
    $('#cvback', panel).onclick = () => draw();
    setTimeout(() => $('#cvg', panel)?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
    G.play($('#cvg', panel), c, (score, note, tix) => endGame(k, score, note, tix));
  }
  function endGame(k, score, note, tix) {
    const G = GAMES[k]; const r = rec(c.id); const pt = playsToday(c.id); const paidN = num(pt[k]);
    const t = paidN < PAID_PLAYS ? (tix ?? G.tickets(score)) : 0; const prev = num(r.best?.[k]);
    store.set('carnival/' + c.id, { ...r, day: today(), plays: { ...pt, [k]: paidN + 1 }, best: { ...(r.best || {}), [k]: Math.max(prev, score) }, total: num(r.total) + t });
    if (t) { addTickets(c.id, t); markWinner(c.id); }
    logRoll(c.nickname, `Star Carnival · ${G.name}`, null, `${note}${t ? ` · 🎟️ ${t} tickets` : ''}`, 'note');
    jingle(t >= 10 || score > prev);
    const box = $('#cvg', panel); if (!box) return;
    box.innerHTML = `<div class="cv-end"><h3>${t ? `🎟️ +${t} tickets!` : paidN >= PAID_PLAYS ? 'Just for fun!' : 'No tickets this time!'}</h3><p>${esc(note)}${score > prev && prev ? ' · 🏆 new best!' : ''}</p>
      ${paidN >= PAID_PLAYS ? `<p class="small muted">This booth’s ticket roll is used up for you today. Come back tomorrow!</p>` : `<p class="small muted">${PAID_PLAYS - paidN - 1} paid game${PAID_PLAYS - paidN - 1 === 1 ? '' : 's'} left here today.</p>`}
      <div class="row" style="gap:8px;justify-content:center"><button class="btn" id="cvagain">Play again</button><button class="btn alt" id="cvmid">Back to the midway</button></div></div>`;
    $('#cvagain', box).onclick = () => playGame(k); $('#cvmid', box).onclick = () => draw();
    showTix();
  }

  async function ride(k) {
    const R = RIDES[k]; if (ticketsOf(c.id) < R.cost) { say(mime(`That ride is ${R.cost} tickets. Win a few more at the game booths!`)); return; }
    addTickets(c.id, -R.cost); showTix(); ensureAudio();
    const bn = buddyName(c) || c.nickname;
    panel.innerHTML = `<div class="row" style="justify-content:space-between;align-items:center"><b>${esc(R.name)}</b></div>
      <div class="cv-ride cv-r-${k}">${rideArt(k, c)}</div><p class="cv-rsay" id="cvrsay"></p>`;
    setTimeout(() => $('.cv-ride', panel)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    const rbox = $('.cv-ride', panel); fillPair(rbox, c, k === 'coaster' || k === 'carousel' ? 'right' : 'down', 1.6);
    if (k === 'carousel') { spriteInto($('.cv-mount', rbox), 'Rapidash', 1.6, 'right', false); }
    if (k === 'coaster') { spriteInto($('.cv-drag', rbox), 'Dragonite', 1.4, 'right', false); }
    const out = $('#cvrsay', panel); let extra = '';
    if (k === 'funhouse') { extra = await funhouse(rbox, out, c, bn); if (extra == null) return; } else
    for (let i = 0; i < R.lines.length; i++) {
      if (!out.isConnected) return; out.textContent = R.lines[i].replace('{b}', bn);
      if (i === 1 || i === 2) budRow(rbox, 'hop', false); if (k === 'funhouse' && i === 2) rbox.classList.add('boo');
      await wait(2200);
    }
    if (!out.isConnected) return;
    const care = carnivalCare(c, 'play', 4);
    store.pushLimited('log', { t: Date.now(), text: `🎠 ${c.nickname}${buddyName(c) ? ` and ${buddyName(c)}` : ''} rode the ${R.name} at the Star Carnival!${extra ? ` Haunter’s mirror turned ${buddyName(c) || c.nickname} into ${extra}!` : ''}` });
    panel.innerHTML = `<div class="cv-end"><h3>What a ride!</h3><p>${esc(R.name)}${buddyName(c) ? ` with ${esc(buddyName(c))}` : ''}</p>${extra ? `<p>🪞 Haunter’s mirror showed ${esc(bn)} as <b>${esc(extra)}</b>!</p>` : ''}
      ${care === 'ok' || care === 'grew' ? '<p class="small muted">🎈 Counts as play time · ❤️ bond went up</p>' : care ? `<p class="small muted">${esc(care)}</p>` : ''}
      <div class="row" style="gap:8px;justify-content:center"><button class="btn" id="cvagain">Ride again (🎟️ ${R.cost})</button><button class="btn alt" id="cvmid">Back to the midway</button></div></div>`;
    $('#cvagain', panel).onclick = () => ride(k); $('#cvmid', panel).onclick = () => draw();
  }
  function rideArt(k, c) {
    const pair = pairHTML(c, 'small');
    if (k === 'carousel') return `<div class="cv-canopy"></div><div class="cv-rlights"></div><div class="cv-pole"></div><div class="cv-seat cv-bob"><span class="cv-mount"></span>${pair}</div><div class="cv-deck"></div>`;
    if (k === 'wheel') return `<div class="cv-stars"></div><div class="cv-comet big"><i></i></div><div class="cv-bigwheel"><div class="cv-arm"><div class="cv-gondola">${pair}</div></div></div>`;
    if (k === 'coaster') return `<div class="cv-stars"></div><svg class="cv-track" viewBox="0 0 300 200"><path d="M-10 170 L60 170 Q90 170 110 40 Q120 10 140 40 Q170 175 200 150 Q230 120 250 150 Q270 175 310 170" fill="none" stroke="#f2c14e" stroke-width="4"/><path d="M-10 178 L60 178 Q92 178 112 48 Q120 20 138 48 Q170 183 200 158 Q230 128 250 158 Q270 183 310 178" fill="none" stroke="#a45ae2" stroke-width="2"/></svg>
      <div class="cv-car"><span class="cv-drag"></span><span class="cv-cart">${pair}</span></div>`;
    if (k === 'teacups') return `<div class="cv-turntable"><div class="cv-cup">${face('lapras', 'cv-cupface')}<div class="cv-cupin">${pair}</div></div></div>`;
    return `<div class="cv-dark"></div><div class="cv-seat cv-fh-seat">${pair}</div><div class="cv-mirror"><div class="cv-refl"></div></div><div class="cv-haunt"></div>`;
  }

  // her ask 11-11: Haunter is a moving sprite, and his funhouse mirror twists the nursery buddy into its evolved form, its
  // shiny form, a Mega Evolution, a paradox form or a Gigantamax form. SpriteCollab only has walk sprites for the plain
  // evolutions, so the shiny / Mega / paradox / Gigantamax looks are Haunter's illusions drawn over the real sprites
  // (colour shifts, a Mega rainbow aura, ancient or future paradox glows, Gigantamax size with red Dynamax clouds).
  async function funhouse(rbox, out, c, bn) {
    const say = (t) => { if (out.isConnected) out.textContent = t; };
    const L = buddyLook(c.id); const sp = L && !L.egg ? (L.url.match(/nursery\/([^/.]+)\.png/) || [])[1] || '' : '';
    spriteInto($('.cv-haunt', rbox), 'Haunter', 2, 'down', true);
    say('The door creaks shut behind you. It’s very dark in here…'); await wait(2200); if (!out.isConnected) return null;
    rbox.classList.add('boo'); budRow(rbox, 'hop', false); say('The lights flicker… and Haunter floats right out of the wall! “Hehehe! Look into my mirror!”'); await wait(2600); if (!out.isConnected) return null;
    const refl = $('.cv-refl', rbox); const mirror = $('.cv-mirror', rbox);
    const real = $('.cv-bspr', rbox);
    const copy = () => { refl.className = 'cv-refl'; refl.removeAttribute('style'); refl.innerHTML = ''; if (real) { const cl = real.cloneNode(true); cl.classList.remove('cv-bspr'); refl.appendChild(cl); } };
    if (!sp) {
      mirror.classList.add('wob'); say(`Haunter waves his hands, and ${bn}’s reflection stretches tall and thin, then short and wide!`); await wait(2600); mirror.classList.remove('wob');
      say('Haunter cackles. “Bring a little one next time, hehehe!” You made it out!'); await wait(2200); return out.isConnected ? '' : null;
    }
    copy(); await wait(600);
    mirror.classList.add('wob'); say(`Haunter waves his hands over the mirror… ${bn}’s reflection starts to wobble and stretch…`); await wait(2600); if (!out.isConnected) return null;
    const form = await mirrorForm(sp);
    mirror.classList.remove('wob');
    if (form.html) refl.innerHTML = form.html; else copy();
    refl.className = 'cv-refl ' + form.fx; if (form.style) refl.setAttribute('style', form.style);
    jingle(true); budRow(rbox, 'hop', false);
    say(`Whoa! In the mirror, ${bn} looks like ${form.label}!`); await wait(3400); if (!out.isConnected) return null;
    mirror.classList.add('wob'); say('Haunter cackles and the mirror wobbles back to normal. You made it out! “Come back soon, hehehe!”'); await wait(900); copy(); await wait(1500);
    mirror.classList.remove('wob');
    return out.isConnected ? form.name : null;
  }

  async function snack(k) {
    const S = SNACKS[k]; if (ticketsOf(c.id) < S.cost) { say(mime(`${S.name} is ${S.cost} tickets. Try a game booth first!`)); return; }
    addTickets(c.id, -S.cost); showTix();
    panel.innerHTML = `${host(S.face, S.who, S.line)}<div class="cv-snackscene"><span class="cv-treat">${S.icon}</span>${pairHTML(c)}</div><p class="cv-rsay" id="cvrsay">Nom nom nom…</p>`;
    const sc = $('.cv-snackscene', panel); fillPair(sc, c, 'down', 2); setTimeout(() => budRow(sc, 'eat'), 200);
    await wait(2800); if (!sc.isConnected) return;
    const care = carnivalCare(c, 'feed', 2);
    store.pushLimited('log', { t: Date.now(), text: `${c.nickname}${buddyName(c) ? ` and ${buddyName(c)}` : ''} shared some ${S.name} at the Star Carnival.` });
    budRow(sc, 'hop', false);
    $('#cvrsay', panel).innerHTML = `${buddyName(c) ? `${esc(buddyName(c))} loved it!` : 'Delicious!'} ${care === 'ok' || care === 'grew' ? '🍼 Counts as a meal · ❤️ bond went up.' : care ? `${esc(care)}` : ''} <button class="btn alt sm" id="cvmid">Back to the midway</button>`;
    $('#cvmid', panel).onclick = () => draw();
  }

  let folding = false;
  async function chargeStar(i, g) {
    const r = rec(c.id); const st = r.star || {}; const closed = closedOf(st); if (folding || st.day === today() || closed.length >= STAR_DAYS || closed.includes(i)) return;
    folding = true; ensureAudio(); stepSound('up');
    // fold the section shut: it swings round to the flap at the top
    const from = i * (360 / STAR_DAYS); const to = from > 180 ? 360 : 0; const t0 = performance.now();
    await new Promise((ok) => { const f = (t) => { const k = Math.min(1, (t - t0) / 800); const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      g.setAttribute('transform', `rotate(${from + (to - from) * e}) scale(${1 - 0.15 * e}, 1)`); if (k < 1 && g.isConnected) requestAnimationFrame(f); else ok(); }; requestAnimationFrame(f); });
    folding = false;
    const next = [...closed, i]; const n = next.length;
    store.set('carnival/' + c.id, { ...rec(c.id), star: { closed: next, n, day: today() } }); addTickets(c.id, 2);
    if (n >= STAR_DAYS) { jingle(true); store.pushLimited('log', { t: Date.now(), text: `🌠 ${c.nickname} closed the whole Wishmaker dreamcatcher! Jirachi is waking up…` }); }
    toast(n >= STAR_DAYS ? '🌟 The dreamcatcher is closed! Jirachi is awake!' : `🌠 One more section closed (${n}/${STAR_DAYS}) · +2 tickets`);
    draw();
  }
  async function wish(k) {
    const r = rec(c.id); if (closedOf(r.star).length < STAR_DAYS) return; const W = WISHES.find((x) => x[0] === k); if (!W) return;
    store.set('carnival/' + c.id, { ...r, star: { closed: [], n: 0, day: today() }, wishes: num(r.wishes) + 1, ...(k === 'prize' ? { freePrize: true } : {}) });
    panel.innerHTML = `<div class="cv-wishscene"><div class="cv-stars"></div><div class="cv-comet big"><i></i></div><div class="cv-jbig"></div><p class="cv-rsay" id="cvrsay">You hold the Wishing Star tight and wish for ${esc(W[2].toLowerCase())}…</p></div>`;
    spriteInto($('.cv-jbig', panel), 'Jirachi', 2.5, 'down', true); ensureAudio();
    await wait(2600); if (!panel.isConnected) return;
    let got = '';
    if (k === 'tickets') { addTickets(c.id, 100); got = '+100 tickets!'; }
    else if (k === 'prize') got = 'Your next Prize Booth trade is free!';
    else { const care = carnivalCare(c, 'play', 20); got = care === '' ? 'Jirachi saves the bond for when you have a buddy… (no nursery buddy right now)' : `${buddyName(c)} feels so loved! (+1 bond heart)`; }
    jingle(true); markWinner(c.id); showTix();
    store.pushLimited('log', { t: Date.now(), text: `🌟 Jirachi granted ${c.nickname}’s wish on the Wishing Star: ${W[2]}!` });
    $('#cvrsay', panel).innerHTML = `🌟 <b>Wish granted!</b> ${esc(got)} <button class="btn alt sm" id="cvmid">Back to the midway</button>`;
    $('#cvmid', panel).onclick = () => { tab = k === 'prize' ? 'prizes' : 'games'; tabs(); draw(); };
  }

  // GM: see everyone's tickets and hand some out
  const gmBox = $('#cvgm', main);
  const drawGm = () => { if (!gmBox) return; const ps = Object.values(party()).filter((x) => !x.guest);
    gmBox.innerHTML = `<ul class="sentry-roster">${ps.map((x) => `<li><span class="grow">${esc(x.nickname)}</span><b>🎟️ ${num(x.tickets)}</b></li>`).join('') || '<li class="muted">No characters yet.</li>'}</ul>
      <div class="row" style="gap:6px;flex-wrap:wrap"><select id="cvgwho">${ps.map((x) => `<option value="${esc(x.id)}">${esc(x.nickname)}</option>`).join('')}</select><input id="cvgn" type="number" value="10" style="width:80px"><button class="btn alt sm" id="cvggo">🎟️ Give (or take, with minus)</button></div>`;
    const go = $('#cvggo', gmBox); if (go) go.onclick = () => { const id = $('#cvgwho', gmBox).value; const n = parseInt($('#cvgn', gmBox).value, 10) || 0; if (!id || !n) return;
      addTickets(id, n); toast(`${n > 0 ? 'Gave' : 'Took'} ${Math.abs(n)} tickets ${n > 0 ? 'to' : 'from'} ${party()[id]?.nickname}.`); drawGm(); showTix(); }; };
  drawGm();
  tabs(); draw();
}

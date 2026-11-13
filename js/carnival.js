// Wishmaker Star Carnival (her ask 11-11): a trip for your nursery buddy, like Tamatown but a Pokémon carnival under
// the Millennium Comet (her inspirations: Jirachi Wishmaker, Thrillville, the Scooby-Doo carnival and especially the
// carnival in 102 Dalmatians; she wants its look, music and games: night lights with a little spooky edge).
// You and your buddy walk the midway together: ride the rides (counts as play time for the buddy), eat carnival snacks
// (counts as food), play booth games for tickets, and spend the tickets at the Prize Booth on base pieces, cursors,
// site themes and dice. Each booth game pays tickets for the first PAID_PLAYS games a day; after that it is just for fun.
// State: party/<id>/tickets, carnival/<id> = { day, plays: { game: n }, best: { game: score }, star: { closed: [sections], day }, freePrize, wishes, total }.
import * as store from './store.js?v=6af653d4';
import { $, $$, esc, toast, num } from './util.js?v=6af653d4';
import { me, logRoll } from './play.js?v=6af653d4';
import { markWinner } from './sparkle.js?v=6af653d4';
import { ensureAudio, jingle, stepSound, missSound, pageMusic } from './chiptune.js?v=6af653d4';
import { buddyLook, carnivalCare } from './nursery.js?v=6af653d4';
import { DECOR } from './basedecor.js?v=6af653d4';
import { THEMES, DICE_REWARDS } from './theme.js?v=6af653d4';
import { REWARD_CURSORS } from './digcursor.js?v=6af653d4';
import { midwayHTML, mountMidway } from './midway.js?v=6af653d4';

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

// her ask 11-12 "Fix the panel to match the style. It's run by Jirachi": round picture like the other cards, night
// midway under the comet with Jirachi (moving sprite) floating over the tents
export const carnivalMini = () => { [0, 400, 1500, 4000].forEach((ms) => setTimeout(() => document.querySelectorAll('.cv-mini-jira:empty:not([data-ld])').forEach((el) => { el.dataset.ld = 1; spriteInto(el, 'Jirachi', 2.4, 'down', true).finally(() => { if (!el.firstChild) delete el.dataset.ld; }); }), ms));
  return `<div class="cv-mini"><span class="cv-mini-stars"></span><span class="cv-mini-comet"></span><span class="cv-mini-tents"><i>🎪</i><i>🎡</i><i>🎪</i></span><span class="cv-mini-jira"></span></div>`; };

// ---- you and your buddy, side by side (your character's walk sprite + the nursery sprite sheet)
const BROW = { idle: 0, hop: 1, sleep: 2, right: 3, left: 4, eat: 5, nod: 6 };
const BSCALE = [0, 1.5, 1.8, 2.1];
function pairHTML(c, cls = '', held = false) {
  const L = c ? buddyLook(c.id) : null;
  let bud = '';
  if (L && L.egg) bud = '<img class="cv-egg" src="assets/nursery/egg.png" alt="Egg">';
  else if (L) { const S = BSCALE[L.stage] || 1.8; const pw = Math.round(L.cw * S); const ph = Math.round(L.ch * S);
    bud = `<span class="baby-spr cv-bspr" data-pw="${pw}" data-ph="${ph}" style="width:${pw}px;height:${ph}px;margin-bottom:-${Math.round(ph * 0.42)}px;background-image:url(${L.url});background-size:${pw * 10}px ${ph * 7}px"></span>`; }
  return `<div class="cv-pair ${cls}"><span class="cv-char"></span><span class="cv-bud">${bud}</span>${held ? `<button class="cv-held ${L && !L.egg ? 'bud' : 'char'}" aria-label="Take a bite"></button>` : ''}</div>`;
}
function budRow(root, name, loop = true) {
  const L = buddyLook(me()?.id || ''); const spr = $('.cv-bspr', root); if (!spr || !L || L.egg) return;
  const r = BROW[name]; const n = L.fr[r] || 1; const pw = +spr.dataset.pw; const ph = +spr.dataset.ph;
  spr.style.backgroundPositionY = `-${r * ph}px`; spr.style.setProperty('--fw', pw + 'px'); spr.style.setProperty('--n', n);
  spr.style.animation = 'none'; void spr.offsetWidth; spr.style.animation = `baby-anim ${Math.max(0.4, n * 0.12)}s steps(${n}, jump-none) ${loop ? 'infinite' : '1 forwards'}`;
}
const fz = () => import('./fzscene.js?v=6af653d4').catch(() => null);
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
  // her ask 11-11: Whack-a-Diglett became Dunk a Dwebble: Dwebble sits on a plank over a water tank; lock the aim
  // across, then up and down, and hit the bullseye to drop him in the water
  dunk: { name: 'Dunk a Dwebble', who: 'Dwebble', face: 'dwebble', icon: '💦', blurb: 'Dweb dweb! Hit the bullseye and drop Dwebble in the tank… if you can!',
    how: '8 balls. Tap Throw once to stop the aim going side to side, then again to stop it going up and down. The ball flies there. Hit the red bullseye to dunk Dwebble! 2 tickets a dunk, +5 for 6 or more.',
    tickets: (s) => s * 2 + (s >= 6 ? 5 : 0),
    play(el, c, done) {
      el.innerHTML = `<div class="cv-hud"><span>⚾ Balls: <b class="cv-p">8</b></span><span>💦 Dunks: <b class="cv-s">0</b></span></div>
        <div class="cv-field cv-dunk"><div class="cv-dsky"></div><div class="cv-dstars"></div><div class="cv-dstars b"></div><div class="cv-pole"></div><div class="cv-target"><span class="cv-trings"></span><b>DUNK</b>${[0, 90, 180, 270].map((a) => `<em style="transform:rotate(${a}deg) translateY(-47px)"></em>`).join('')}</div>
          <div class="cv-tank"><div class="cv-plank"></div><div class="cv-dweb"></div><div class="cv-water2"><span class="cv-caustic"></span><span class="cv-wave"></span><span class="cv-wave b"></span>${Array.from({ length: 7 }, (_, i) => `<i class="cv-bub" style="left:${8 + i * 13}%;animation-delay:${(i * 0.53) % 3}s;animation-duration:${2.4 + (i % 3) * 0.7}s"></i>`).join('')}</div><div class="cv-deck2"></div><div class="cv-splash"></div></div>
          <div class="cv-xh"></div><div class="cv-taunt"></div></div><button class="btn block" id="cvthrow2">⚾ Throw!</button>`;
      const f = $('.cv-dunk', el); const xh = $('.cv-xh', f); const tg = $('.cv-target', f); const dweb = $('.cv-dweb', f); const taunt = $('.cv-taunt', f); const btn = $('#cvthrow2', el);
      spriteInto(dweb, 'Dwebble', 3.2, 'left', true);
      const TAUNTS = ['Dweb dweb! Missed me!', 'Is that all you’ve got?', 'Nice try, slowpoke!', 'My shell is staying DRY today!', 'You throw like a Magikarp!'];
      const WET = ['BLUB BLUB! No fair!', 'SPLASH! Brrr, that’s cold!', 'Glub… you got me…', 'My rock is all wet!'];
      const tell = (t) => { taunt.textContent = t; taunt.classList.remove('show'); void taunt.offsetWidth; taunt.classList.add('show'); };
      tell('Dweb dweb! You’ll never dunk me!');
      let balls = 8; let dunks = 0; let phase = 0; let ax = 50; let ay = 50; let dx = 1; let dy = 1; let busy = false; let last = performance.now();
      // the aim box covers the target area (left part of the field); speeds pick up as balls run out
      const step = (t) => { if (!el.isConnected) return; const dt = Math.min(0.05, (t - last) / 1000); last = t;
        const sp = 85 + (8 - balls) * 10;
        if (phase === 0) { ax += dx * sp * dt; if (ax > 100) { ax = 100; dx = -1; } if (ax < 0) { ax = 0; dx = 1; } }
        if (phase === 1) { ay += dy * sp * dt; if (ay > 100) { ay = 100; dy = -1; } if (ay < 0) { ay = 0; dy = 1; } }
        xh.style.left = `${6 + ax * 0.38}%`; xh.style.top = `${10 + ay * 0.62}%`; xh.dataset.phase = phase;
        requestAnimationFrame(step); };
      requestAnimationFrame(step);
      btn.onclick = async () => {
        if (busy || !balls) return;
        if (phase === 0) { phase = 1; ay = 0; dy = 1; stepSound('left'); btn.textContent = '⚾ Throw! (up and down)'; return; }
        busy = true; phase = 2; balls--; $('.cv-p', el).textContent = balls;
        const fr = f.getBoundingClientRect(); const xr = xh.getBoundingClientRect(); const tr = tg.getBoundingClientRect();
        const bx = xr.left + xr.width / 2 - fr.left; const by = xr.top + xr.height / 2 - fr.top;
        const ball = document.createElement('span'); ball.className = 'cv-ball'; ball.style.left = '50%'; ball.style.top = '100%'; f.appendChild(ball);
        ball.animate([{ left: '50%', top: '100%', transform: 'scale(1.6)' }, { left: bx + 'px', top: by + 'px', transform: 'scale(.8)' }], { duration: 420, easing: 'ease-out', fill: 'forwards' });
        await wait(440); if (!el.isConnected) return;
        const d = Math.hypot(bx - (tr.left + tr.width / 2 - fr.left), by - (tr.top + tr.height / 2 - fr.top)); const r = tr.width / 2;
        if (d <= r * 0.36) {   // bullseye: DUNK
          dunks++; $('.cv-s', el).textContent = dunks; tg.classList.add('hit'); f.classList.add('dunked'); jingle(true); tell(pickOne(WET));
          await wait(1500); if (!el.isConnected) return; f.classList.remove('dunked'); tg.classList.remove('hit');
        } else if (d <= r) { stepSound('right'); tg.classList.add('wob'); tell('Ha! Close, but my seat didn’t budge!'); await wait(700); tg.classList.remove('wob'); }
        else { missSound(); tell(pickOne(TAUNTS)); await wait(500); }
        ball.remove(); busy = false; phase = 0; ax = Math.random() * 100; btn.textContent = '⚾ Throw!';
        if (!balls) { btn.disabled = true; setTimeout(() => done(dunks, `dunked Dwebble ${dunks} time${dunks === 1 ? '' : 's'}`), 500); }
      };
    } },
  // her ask 11-11: Psyduck Pond became the Surskit Lily Pad Search: Surskit skate around the pond, then dive under the
  // lily pads; flip pads to find them (a Masquerain is worth the most, a Lotad gives an extra flip)
  lily: { name: 'Surskit Lily Pad Search', who: 'Surskit', face: 'surskit', icon: '🍃', blurb: 'Watch the Surskit skate, then find where they hide under the lily pads!',
    how: '12 lily pads and 5 flips. Each Surskit you find = 3 tickets, the Masquerain = 8, and a Lotad gives you 1 extra flip. Empty pads are just water.',
    tickets: (s) => s,
    play(el, c, done) {
      el.innerHTML = '<div class="cv-hud"><span>🍃 Flips left: <b class="cv-p">5</b></span><span>🎟️ <b class="cv-s">0</b></span></div><div class="cv-field cv-lpond"><div class="cv-lwater"></div><div class="cv-pads"></div><div class="cv-skaters"></div></div><p class="cv-hint small muted" style="text-align:center">Watch the Surskit…</p>';
      const f = $('.cv-lpond', el); const padsEl = $('.cv-pads', f); const sk = $('.cv-skaters', f); const hint = $('.cv-hint', el);
      const hide = ['surskit', 'surskit', 'surskit', 'surskit', 'masquerain', 'lotad', 'lotad', '', '', '', '', ''].sort(() => Math.random() - 0.5);
      const VAL = { surskit: 3, masquerain: 8 };
      let flips = 5; let sum = 0; let ready = false;
      padsEl.innerHTML = hide.map((k, i) => `<button class="cv-pad" data-i="${i}" style="--r:${Math.round(Math.random() * 360)}deg;animation-delay:${(i % 5) * 0.4}s"><span class="cv-under"></span><span class="cv-leaf"></span></button>`).join('');
      const pads = $$('.cv-pad', padsEl);
      // the Surskit skate in zig-zags across the pond first, then dart under their pads
      const names = { surskit: 'Surskit', masquerain: 'Masquerain', lotad: 'Lotad' };
      const sprites = {};
      Promise.all(Object.entries(names).map(([k, n]) => fz().then((m) => m?.walkSprite(n, 2.6, 'down', true)).then((w) => { sprites[k] = w?.html || ''; }).catch(() => {}))).then(async () => {
        if (!el.isConnected) return;
        const show = [...Array(5)].map(() => { const d = document.createElement('span'); d.className = 'cv-skater'; d.innerHTML = sprites.surskit; d.style.left = `${10 + Math.random() * 80}%`; d.style.top = `${10 + Math.random() * 70}%`; sk.appendChild(d); return d; });
        for (let r = 0; r < 4; r++) { show.forEach((d) => { d.style.left = `${5 + Math.random() * 85}%`; d.style.top = `${5 + Math.random() * 75}%`; }); await wait(650); if (!el.isConnected) return; }
        const homes = pads.filter((p, i) => hide[i] === 'surskit' || hide[i] === 'masquerain');
        show.forEach((d, j) => { const p = homes[j % homes.length]; const pr = p.getBoundingClientRect(); const fr = f.getBoundingClientRect(); d.style.left = `${((pr.left + pr.width / 2 - fr.left) / fr.width) * 100}%`; d.style.top = `${((pr.top + pr.height / 2 - fr.top) / fr.height) * 100}%`; });
        await wait(700); show.forEach((d) => d.classList.add('dive')); await wait(400); sk.innerHTML = '';
        pads.forEach((p, i) => { $('.cv-under', p).innerHTML = hide[i] ? sprites[hide[i]] || '' : '<i class="cv-ripple"></i>'; });
        ready = true; hint.textContent = 'Where did they go? Tap a lily pad to flip it!';
      });
      pads.forEach((p) => { p.onclick = () => {
        if (!ready || !flips || p.classList.contains('open')) return; const k = hide[+p.dataset.i]; p.classList.add('open'); flips--;
        if (k === 'lotad') { flips++; stepSound('right'); hint.textContent = 'A Lotad! It gives you an extra flip!'; }
        else if (VAL[k]) { sum += VAL[k]; k === 'masquerain' ? jingle(true) : stepSound('up'); hint.textContent = k === 'masquerain' ? 'WOW, a Masquerain! +8' : 'Found a Surskit! +3'; }
        else { missSound(); hint.textContent = 'Just water… splash!'; }
        $('.cv-p', el).textContent = flips; $('.cv-s', el).textContent = sum;
        if (!flips) { ready = false; setTimeout(() => { pads.forEach((x) => x.classList.add('open')); setTimeout(() => done(sum, `found ${sum} tickets’ worth of Surskit`), 1500); }, 500); }
      }; });
    } },
  balloons: { name: 'Pikachu Balloon Pop', who: 'Pikachu', face: 'pikachu', icon: '🎈', blurb: 'Run along the top as Pikachu and pop the balloons with Iron Tail and Thunderbolt!',
    how: '30 seconds. Tap where Pikachu should run (or use ← →). ⬆️ Up = 🌀 Iron Tail: swings wide but only reaches balloons near the top. ⬇️ Down = ⚡ Thunderbolt: zaps straight down and pops the first balloon under Pikachu. On a phone, swipe up or down, or use the buttons. Red 1 · Blue 2 · Green 3 · Purple 5 · Gold 10. Voltorb balloons blow up for −5!',
    tickets: (s) => (s >= 120 ? 20 : s >= 80 ? 12 : s >= 45 ? 7 : s > 0 ? 3 : 0),
    // her ask 11-11: Pikachu runs on top and pops rising balloons with Iron Tail or Thundershock; very round, colourful
    // balloons where each colour is worth something
    play(el, c, done) {
      const COLORS = [['red', 1, 0.33], ['blue', 2, 0.25], ['green', 3, 0.17], ['purple', 5, 0.12], ['gold', 10, 0.06], ['volt', -5, 0.07]];
      el.innerHTML = `<div class="cv-hud"><span>⏱️ <b class="cv-t">30</b></span><span>⭐ <b class="cv-s">0</b></span></div>
        <div class="cv-field cv-sky cv-bp"><div class="cv-tpole l"><i></i></div><div class="cv-tpole r"><i></i></div><svg class="cv-rope" viewBox="0 0 1000 90" preserveAspectRatio="none" aria-hidden="true"><path class="cv-rope-shadow" d=""/><path class="cv-rope-base" d=""/><path class="cv-rope-twist" d=""/><path class="cv-rope-twist b" d=""/><path class="cv-rope-hi" d=""/></svg><div class="cv-pika"><span class="cv-pika-r"></span><span class="cv-pika-l"></span></div><svg class="cv-bolt" viewBox="0 0 20 100" preserveAspectRatio="none"><polyline points="10,0 4,18 14,34 5,52 15,70 6,86 11,100" fill="none" stroke="#fff35a" stroke-width="3"/></svg><span class="cv-tail"></span></div>
        <div class="cv-bp-pad"><button class="btn alt" id="cvleft" aria-label="Run left">◀</button><button class="btn alt" id="cvtail">⬆️ 🌀<small>Iron Tail</small></button><button class="btn" id="cvzap">⬇️ ⚡<small>Thunderbolt</small></button><button class="btn alt" id="cvright" aria-label="Run right">▶</button></div>
        <div class="cv-bp-key small muted">${COLORS.filter(([k]) => k !== 'volt').map(([k, v]) => `<span><i class="cv-dot ${k}"></i>${v}</span>`).join('')}<span><i class="cv-dot volt"></i>−5</span></div>`;
      const f = $('.cv-bp', el); const pika = $('.cv-pika', f); const ropePaths = $$('.cv-rope path', f); const bolt = $('.cv-bolt', f); const tail = $('.cv-tail', f);
      Promise.all([fz().then((m) => m?.walkSprite('Pikachu', 2, 'right')), fz().then((m) => m?.walkSprite('Pikachu', 2, 'left'))]).then(([r, l]) => {
        if (!f.isConnected) return; if (r) $('.cv-pika-r', pika).innerHTML = r.html; if (l) $('.cv-pika-l', pika).innerHTML = l.html; }).catch(() => {});
      let score = 0; let on = true; let px = 50; let target = 50; let face = 'r'; let zapAt = 0; let tailAt = 0; const bs = new Set();
      const pick = () => { let r = Math.random(); for (const x of COLORS) { r -= x[2]; if (r <= 0) return x; } return COLORS[0]; };
      const pop = (b) => { if (b._dead) return; b._dead = true; score = Math.max(0, score + b._v); b.classList.add('pop');
        b.insertAdjacentHTML('beforeend', `<em>${b._v > 0 ? '+' + b._v : b._v}</em>`);
        if (b._v < 0) { missSound(); f.classList.add('zap'); setTimeout(() => f.classList.remove('zap'), 300); } else stepSound(b._v >= 5 ? 'up' : 'left');
        $('.cv-s', el).textContent = score; setTimeout(() => { b.remove(); bs.delete(b); }, 380); };
      const zap = () => { const t = performance.now(); if (!on || t - zapAt < 550) return; zapAt = t;
        bolt.style.left = px + '%'; bolt.animate([{ opacity: 1 }, { opacity: 0.5 }, { opacity: 1 }, { opacity: 0 }], { duration: 260 });   // SVG has no offsetWidth: getBoundingClientRect restarts the flash every time (her report 11-11)
        const hit = [...bs].filter((b) => !b._dead && Math.abs(b._x - px) < 7 && b._y < 96).sort((a, b) => b._y - a._y)[0];
        if (hit) { bolt.style.height = `${Math.max(8, 100 - hit._y - 14)}%`; pop(hit); } else bolt.style.height = '100%'; };
      const swing = () => { const t = performance.now(); if (!on || t - tailAt < 450) return; tailAt = t;
        tail.style.left = px + '%'; tail.classList.remove('go'); void tail.offsetWidth; tail.classList.add('go'); pika.classList.remove('spin'); void pika.offsetWidth; pika.classList.add('spin');
        [...bs].filter((b) => !b._dead && Math.abs(b._x - px) < 14 && b._y > 58 && b._y < 100).forEach(pop); };
      // pointerdown (not click) so the buttons answer instantly on a phone, with no double-tap zoom
      const press = (id, fn) => { const b = $(id, el); b.onpointerdown = (e) => { e.preventDefault(); fn(); }; b.onclick = (e) => e.preventDefault(); };
      press('#cvzap', zap); press('#cvtail', swing);
      const hold = (id, dir) => { const b = $(id, el); let held = false;
        b.onpointerdown = (e) => { e.preventDefault(); held = true; b.setPointerCapture?.(e.pointerId); target = dir < 0 ? 4 : 96; };
        b.onpointerup = b.onpointercancel = b.onlostpointercapture = () => { if (held) { held = false; target = px; } }; };
      hold('#cvleft', -1); hold('#cvright', 1);
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
        { // the rope sags most right under Pikachu's feet (deeper while he runs)
          const x = Math.max(30, Math.min(970, px * 10)); const dip = 66 + (pika.classList.contains('run') ? 3 : 0) + Math.sin(t / 260) * 1.2;
          const d = `M0 50 Q${(x / 2).toFixed(1)} ${(50 + (dip - 50) * 0.9).toFixed(1)} ${x.toFixed(1)} ${dip.toFixed(1)} Q${((x + 1000) / 2).toFixed(1)} ${(50 + (dip - 50) * 0.9).toFixed(1)} 1000 50`;
          ropePaths.forEach((r) => r.setAttribute('d', d)); }
        bs.forEach((b) => { if (b._dead) return; b._y += b._sp * dt; b.style.bottom = b._y + '%'; b.style.marginLeft = `${Math.sin(t / 600 + b._w) * 6}px`; if (b._y > 112) { b.remove(); bs.delete(b); } });
        requestAnimationFrame(step); };
      pika.dataset.face = 'r'; requestAnimationFrame(step); spawn();
    } },
  // her ask 11-11: "I love the slowpoke game. Increase the quality. Instead of rings id like to throw klefkis":
  // a proper booth (awning, lights, counter), moving Slowpoke sprites on stools, and Klefki (key rings!) that spin
  // through the air in an arc and stack up on the Slowpoke they land on
  rings: { name: 'Slowpoke Klefki Toss', who: 'Slowpoke', face: 'slowpoke', icon: '🔑', blurb: 'Toss Klefki onto the Slowpoke. They’re slow… but they do sway.',
    how: '6 Klefki. The arrow slides back and forth along the counter: tap Throw when it’s right under a Slowpoke. 3 tickets a ringer, +5 if all six land.',
    tickets: (s) => s * 3 + (s >= 6 ? 5 : 0),
    play(el, c, done) {
      el.innerHTML = `<div class="cv-hud"><span>🔑 Klefki: <b class="cv-p">6</b></span><span>✅ <b class="cv-s">0</b></span></div>
        <div class="cv-field cv-kbooth"><div class="cv-kawn"></div><div class="cv-klights">${Array.from({ length: 11 }, (_, i) => `<i style="animation-delay:${(i % 3) * 0.3}s"></i>`).join('')}</div>
          <div class="cv-kwall"></div><div class="cv-kshelf"></div><div class="cv-kcounter"><div class="cv-aim2"></div></div><div class="cv-kleft"></div></div>
        <button class="btn block" id="cvthrow">🔑 Throw!</button>`;
      const f = $('.cv-kbooth', el); const aim = $('.cv-aim2', f); const left = $('.cv-kleft', f); let rings = 6; let hits = 0; let busy = false; let kHTML = '';
      const pokes = [20, 50, 80].map((x, i) => { const s2 = document.createElement('div'); s2.className = 'cv-kslow'; s2.innerHTML = '<span class="cv-kstack"></span><span class="cv-kspr"></span><span class="cv-kstool"></span>'; s2._x0 = x; s2._ph = i * 2; f.appendChild(s2); return s2; });
      pokes.forEach((p) => spriteInto($('.cv-kspr', p), 'Slowpoke', 2.6, 'down', true));
      fz().then((m) => m?.walkSprite('Klefki', 1.6, 'down', true)).then((w) => { kHTML = w?.html || '🔑'; if (el.isConnected) left.innerHTML = Array.from({ length: rings }, () => `<span>${kHTML}</span>`).join(''); }).catch(() => { kHTML = '🔑'; });
      let ax = 0; let dir = 1; let last = performance.now();
      const step = (t) => { if (!el.isConnected) return; const dt = Math.min(0.05, (t - last) / 1000); last = t;
        const sp = 70 + (6 - rings) * 12; ax += dir * sp * dt; if (ax > 100) { ax = 100; dir = -1; } if (ax < 0) { ax = 0; dir = 1; }
        aim.style.left = ax + '%'; pokes.forEach((p) => { p._x = p._x0 + Math.sin(t / 1400 + p._ph) * 5; p.style.left = p._x + '%'; });
        requestAnimationFrame(step); };
      requestAnimationFrame(step);
      $('#cvthrow', el).onclick = async () => {
        if (busy || !rings) return; busy = true; rings--; $('.cv-p', el).textContent = rings; const x = ax;
        left.lastElementChild?.remove();
        // the Klefki flies up in an arc from the counter, spinning, toward the Slowpoke heads
        const k = document.createElement('span'); k.className = 'cv-kfly'; k.innerHTML = kHTML || '🔑'; f.appendChild(k);
        const fr = f.getBoundingClientRect(); const hit = pokes.find((p) => Math.abs(p._x - x) < 6.5);
        const headY = hit ? $('.cv-kstack', hit).getBoundingClientRect().top - fr.top + 6 : fr.height * 0.36;
        await k.animate([{ left: x + '%', top: '88%', transform: 'translate(-50%,-50%) rotate(0) scale(1.3)' },
          { left: x + '%', top: `${(headY / fr.height) * 100 - 18}%`, transform: 'translate(-50%,-50%) rotate(360deg) scale(1)', offset: 0.6 },
          { left: (hit ? hit._x : x) + '%', top: `${(headY / fr.height) * 100}%`, transform: 'translate(-50%,-50%) rotate(540deg) scale(.95)' }], { duration: 620, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {});
        if (!el.isConnected) return;
        if (hit) { hits++; k.remove(); const st = $('.cv-kstack', hit); st.insertAdjacentHTML('beforeend', `<span class="cv-kon">${kHTML || '🔑'}</span>`); hit.classList.remove('yay'); void hit.offsetWidth; hit.classList.add('yay'); stepSound('up'); $('.cv-s', el).textContent = hits; }
        else { missSound(); await k.animate([{ top: k.style.top || '36%', opacity: 1 }, { top: '96%', opacity: 0, transform: 'translate(-50%,-50%) rotate(720deg) scale(.8)' }], { duration: 520, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {}); k.remove(); }
        busy = false; if (!rings) setTimeout(() => done(hits, `${hits} of 6 Klefki landed`), 700);
      };
    } },
  hammer: { name: 'Scrafty’s Strength Test', who: 'Scrafty', face: 'scrafty', icon: '🔔', blurb: 'Swing the big hammer and ring the bell at the top!',
    how: '3 swings. The power bar goes up and down fast: tap Swing! at the very top. Ring the bell (95+) for 6 tickets, 80+ gets 3, 50+ gets 1.',
    tickets: (s) => s,
    play(el, c, done) {
      el.innerHTML = `<div class="cv-hud"><span>🔨 Swings: <b class="cv-p">3</b></span><span>💪 <b class="cv-s">–</b></span></div>
        <div class="cv-field cv-strength"><div class="cv-tower"><span class="cv-bell">🔔</span><span class="cv-puck"></span><b style="bottom:95%">RING!</b><b style="bottom:80%">Champ</b><b style="bottom:50%">Strong</b><b style="bottom:20%">Wimpy</b></div>
        <div class="cv-meter"><span class="cv-fill"></span></div><div class="cv-champ"></div></div><button class="btn block" id="cvswing">🔨 Swing!</button>`;
      spriteInto($('.cv-champ', el), 'Scrafty', 2.4, 'left', true);   // her ask 11-11: Scrafty runs the strength test now
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
// her ask 11-11: the known shapeshifters can also turn up in the mirror, disguised as your buddy
const SHIFTERS = [['Ditto', (b) => `Ditto! It used Transform to copy ${b}… but kept its goofy little face`], ['Mew', (b) => `Mew! It used Transform to pretend to be ${b}, giggling the whole time`],
  ['Latias', (b) => `Latias! It bent the light around itself to look just like ${b}`], ['Latios', (b) => `Latios! It bent the light around itself to look just like ${b}`],
  ['Zorua', (b) => `Zorua! It cast an Illusion to look like ${b}`], ['Zoroark', (b) => `Zoroark! The master of Illusion was pretending to be ${b}`],
  ['Mimikyu', (b) => `Mimikyu! It was wearing a homemade ${b} costume`], ['Kecleon', (b) => `Kecleon! It changed its colors to blend in as ${b}`]];
async function mirrorForm(sp) {
  const key = sp.startsWith('m_') ? 'ditto' : sp; const baby = BABY_NAME[key] || key.charAt(0).toUpperCase() + key.slice(1);
  const shiny = { fx: 'fx-shiny', style: `--hue:${SHINY_HUE[key] ?? 150}deg`, name: `a shiny ${baby}`, label: `a shiny ${baby}, sparkling all over` };
  // the evolution's walk sprite: usually the final form, sometimes the middle one; tries the next if one is missing
  const evoSprite = async () => { const m = await fz(); const list = [...(EVOS[key] || [baby])]; if (list.length > 1 && Math.random() < 0.3) list.push(list.shift());
    for (const n of list) { const w = await m?.walkSprite(n, 2, 'down', true).catch(() => null); if (w) return { n, html: w.html }; } return null; };
  const kinds = ['evolved', 'shiny', 'mega', 'paradox', 'gmax', 'shifter'].sort(() => Math.random() - 0.5);
  for (const k of kinds) {
    if (k === 'shiny') {   // the real shiny sprite when SpriteCollab has one, else Haunter's colour trick on the nursery sprite
      const m = await fz(); const w = await m?.walkSprite(key === 'ditto' ? 'Ditto' : baby, 2, 'down', true, true).catch(() => null);
      if (w && w.html.includes('/0000/0001/')) return { fx: 'fx-shinyreal', html: w.html, name: `a shiny ${baby}`, label: `a shiny ${baby}, sparkling all over` };
      return shiny;
    }
    if (k === 'shifter') {
      const m = await fz(); for (const [n, say] of [...SHIFTERS].sort(() => Math.random() - 0.5)) { const w = await m?.walkSprite(n, 2, 'down', true).catch(() => null); if (w) return { fx: 'fx-shifter', html: w.html, name: n, label: say(baby) }; }
      continue;
    }
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
    <div class="cv-scene mw-scene" id="cvscene">
      <div class="cv-stars"></div><div class="cv-comet"><i></i></div><div class="cv-jirachi" title="Jirachi"></div><span class="cv-shoot"></span>
      <svg class="cv-lights" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 4 Q75 34 150 6 Q225 34 300 4" fill="none" stroke="#2b1d12" stroke-width="1"/>
        ${Array.from({ length: 22 }, (_, i) => { const t = (i + 0.5) / 22; const seg = t < 0.5 ? t * 2 : (t - 0.5) * 2; const x = t * 300; const y = 4 + Math.sin(seg * Math.PI) * 26 - (t < 0.5 ? 0 : 1); return `<circle class="cv-bulb ${i % 7 === 3 ? 'flick' : ''}" cx="${x.toFixed(1)}" cy="${(y + 3).toFixed(1)}" r="2.6" style="animation-delay:${(i % 4) * 0.3}s"/>`; }).join('')}</svg>
      ${midwayHTML(pairHTML(c, '', true), SNACKS)}
      <div class="cv-fog"></div><div class="cv-fog b"></div>
      <div class="cv-tix" id="cvtix"></div>
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
  // her ask 11-12: a busy midway you walk around; tapping a booth / ride / stand (or its pop-up) opens it
  const mw = mountMidway(scene, { GAMES, RIDES, SNACKS }, (kind, k) => { if (!c) { say(mime('Pick your character on the home page first, then come play!')); return; } if (kind === 'game') playGame(k); else if (kind === 'ride') ride(k); else snack(k); }, (d) => budRow(scene, d || 'idle'));
  fillPair(scene, c, 'right', 2).then(() => mw.refaceMe());
  spriteInto($('.cv-jirachi', scene), 'Jirachi', 1.5, 'down', true);
  const hopTimer = setInterval(() => { if (!scene.isConnected) { clearInterval(hopTimer); return; } budRow(scene, 'hop', false); setTimeout(() => budRow(scene, 'idle'), 1300); }, 9000);
  const showTix = () => { const e = $('#cvtix', main); if (e) e.innerHTML = c ? `🎟️ <b>${ticketsOf(c.id)}</b> ticket${ticketsOf(c.id) === 1 ? '' : 's'}` : '🎟️'; };
  showTix();
  const say = (html) => { talk.innerHTML = html; };
  const tabs = () => $$('[data-tab]', main).forEach((b) => { b.className = `btn sm ${b.dataset.tab === tab ? '' : 'alt'}`; b.onclick = () => { tab = b.dataset.tab; buying = null; tabs(); draw(); }; });
  // her ask 11-12 "make these look like ticket counters with the pokemon ready. trying to maximize the empty row space":
  // each game / ride / snack is a little ticket booth (striped awning, its Pokémon moving behind the counter), side by
  // side in a grid instead of one long row each
  const spOf = (k, pic) => GAMES[k]?.who || SNACKS[k]?.who || (pic ? pic[0].toUpperCase() + pic.slice(1) : '');
  const card = (k, pic, title, line, btn, extra = '') => `<div class="cv-booth tc"><span class="tc-awn"></span><div class="tc-win"><span class="tc-bulbs"></span><span class="tc-sp" data-sp="${esc(spOf(k, pic))}">${face(pic)}</span><span class="tc-counter"></span></div>
    <div class="tc-body"><b class="tc-name">${esc(title)}</b><p class="small muted tc-line">${esc(line)}</p>${extra ? `<div class="tc-pills">${extra}</div>` : ''}</div><button class="btn sm tc-go" data-go="${k}" ${!c ? 'disabled' : ''}>${btn}</button></div>`;
  const fillSprites = () => $$('.tc-sp[data-sp]', panel).forEach((el) => { const sp = el.dataset.sp; el.removeAttribute('data-sp'); if (sp) spriteInto(el, sp, 2, 'down', true); });

  function draw() {
    showTix();
    if (tab === 'games') {
      const pt = c ? playsToday(c.id) : {};
      panel.innerHTML = `<p class="small muted" style="margin-top:0">Each booth pays tickets for your first ${PAID_PLAYS} games a day. After that you can still play for fun.</p>
        <div class="cv-grid">${Object.entries(GAMES).map(([k, G]) => card(k, G.face, `${G.icon} ${G.name}`, G.blurb, 'Play', `<span class="pill">${Math.max(0, PAID_PLAYS - num(pt[k]))}/${PAID_PLAYS} paid left today</span>${c && num(rec(c.id).best?.[k]) ? ` <span class="pill">🏆 best ${num(rec(c.id).best[k])}</span>` : ''}`)).join('')}</div>`;
      $$('[data-go]', panel).forEach((b) => { b.onclick = () => playGame(b.dataset.go); }); fillSprites();
    } else if (tab === 'rides') {
      panel.innerHTML = `<p class="small muted" style="margin-top:0">Rides cost tickets. ${buddyName(c) ? `Riding together counts as play time for ${esc(buddyName(c))} and raises your bond.` : 'Bring your nursery buddy and it counts as their play time!'}</p>
        <div class="cv-grid">${Object.entries(RIDES).map(([k, R]) => card(k, R.face, R.name, R.blurb, `🎟️ ${R.cost}`)).join('')}</div>`;
      $$('[data-go]', panel).forEach((b) => { b.onclick = () => ride(b.dataset.go); }); fillSprites();
    } else if (tab === 'snacks') {
      panel.innerHTML = `<p class="small muted" style="margin-top:0">${buddyName(c) ? `Sharing a snack counts as a meal for ${esc(buddyName(c))}.` : 'Carnival treats! Your nursery buddy would love one.'}</p>
        <div class="cv-grid">${Object.entries(SNACKS).map(([k, S]) => card(k, S.face, S.name, `${S.who}’s stand`, `🎟️ ${S.cost}`)).join('')}</div>`;
      $$('[data-go]', panel).forEach((b) => { b.onclick = () => snack(b.dataset.go); }); fillSprites();
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

  // her ask 11-12 "there is a ticket confirmation message if it is a snack or ride": a Yes / No box before tickets are spent
  function confirmSpend(pic, title, cost, go) {
    $('.cv-confirm')?.remove();
    const box = document.createElement('div'); box.className = 'cv-confirm';
    box.innerHTML = `<div class="cv-cbox" role="dialog" aria-label="Spend tickets?">${face(pic)}<b class="cv-ctitle">${esc(title)}</b><p>Spend <b>🎟️ ${cost} tickets</b>?<br><span class="small muted">You have ${ticketsOf(c.id)} · ${ticketsOf(c.id) - cost} left after</span></p><div class="row" style="gap:8px;justify-content:center"><button class="btn sm" data-y>Yes, spend ${cost}</button><button class="btn alt sm" data-n>No thanks</button></div></div>`;
    document.body.appendChild(box);
    const close = () => box.remove();
    $('[data-y]', box).onclick = () => { close(); go(); }; $('[data-n]', box).onclick = close;
    box.onclick = (e) => { if (e.target === box) close(); };
    $('[data-y]', box).focus();
  }
  async function ride(k, ok) {
    const R = RIDES[k]; if (ticketsOf(c.id) < R.cost) { say(mime(`That ride is ${R.cost} tickets. Win a few more at the game booths!`)); return; }
    if (!ok) { confirmSpend(R.face, R.name, R.cost, () => ride(k, true)); return; }
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
    say(form.fx === 'fx-shifter' ? `Wait… that’s not ${bn} in the mirror! It’s ${form.label}!` : `Whoa! In the mirror, ${bn} looks like ${form.label}!`); await wait(3400); if (!out.isConnected) return null;
    mirror.classList.add('wob'); say('Haunter cackles and the mirror wobbles back to normal. You made it out! “Come back soon, hehehe!”'); await wait(900); copy(); await wait(1500);
    mirror.classList.remove('wob');
    return out.isConnected ? form.name : null;
  }

  // her ask 11-11: snacks are bought at the stands up on the midway (or from the Snacks list), and the baby holds the
  // treat in the scene; tap the treat to give a bite (it also nibbles by itself now and then). 3 bites and it's gone,
  // which counts as a meal.
  let holding = null; let biteTimer = 0;
  function snack(k, ok) {
    const S = SNACKS[k]; if (!c) return;
    if (holding) { say(host(SNACKS[holding].face, SNACKS[holding].who, `Finish your ${SNACKS[holding].name} first! Tap it to take a bite.`)); scene.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (ticketsOf(c.id) < S.cost) { say(mime(`${S.name} is ${S.cost} tickets. Try a game booth first!`)); return; }
    if (!ok) { confirmSpend(S.face, S.name, S.cost, () => snack(k, true)); return; }
    addTickets(c.id, -S.cost); showTix(); ensureAudio(); stepSound('right');
    const held = $('.cv-held', scene); if (!held) return;
    holding = k; held.innerHTML = S.icon; held.dataset.bites = '3'; held.className = held.className.replace(/\s*(show|b\d|nom)\b/g, '') + ' show b3';
    const who = buddyName(c) || c.nickname;
    say(host(S.face, S.who, `${S.line} Here you go! Tap the ${S.name} to give ${who} a bite.`));
    scene.scrollIntoView({ behavior: 'smooth', block: 'center' });
    held.onclick = () => bite(); clearInterval(biteTimer);
    biteTimer = setInterval(() => { if (!scene.isConnected || !holding) { clearInterval(biteTimer); return; } bite(); }, 7000);
  }
  function bite() {
    const held = $('.cv-held', scene); if (!held || !holding) return; const S = SNACKS[holding];
    const n = Math.max(0, num(held.dataset.bites) - 1); held.dataset.bites = String(n);
    held.classList.remove('b3', 'b2', 'b1', 'nom'); void held.offsetWidth; held.classList.add('b' + Math.max(1, n), 'nom');
    budRow(scene, 'eat'); setTimeout(() => budRow(scene, 'idle'), 1100); stepSound('up');
    if (n > 0) return;
    clearInterval(biteTimer); const k = holding; holding = null;
    setTimeout(() => {
      held.classList.remove('show'); held.innerHTML = '';
      const care = carnivalCare(c, 'feed', 2); budRow(scene, 'hop', false); setTimeout(() => budRow(scene, 'idle'), 1300); jingle(true);
      store.pushLimited('log', { t: Date.now(), text: `${c.nickname}${buddyName(c) ? ` and ${buddyName(c)}` : ''} shared some ${SNACKS[k].name} at the Star Carnival.` });
      say(host(S.face, S.who, `${buddyName(c) ? `${buddyName(c)} loved it!` : 'Delicious, right?'} ${care === 'ok' || care === 'grew' ? '🍼 That counts as a meal, and your bond went up!' : care ? care : ''}`));
    }, 500);
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

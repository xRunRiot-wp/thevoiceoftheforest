// Rayson's Mail Run (her ask 10-27): a one-button skill game. Rayson the Wingull carries the mail from Sunshell Beach
// back to Woodland Base: tap (or Space / ↑) to flap. Fly over the sea, the beach and the meadow, dodge sea rocks,
// storm clouds and rival bird flocks, and catch the letters the wind blew away. 3 hearts; a hit costs a heart and
// a letter. Reaching Woodland Base delivers the mail. The first delivery each day pays Poké (+ a perfect-run bonus).
// Art: Explorers of Sky skies/clouds and Sunshell beach strips (TSR rips), Wingull/Taillow/Starly sprites (SpriteCollab).
import * as store from './store.js?v=6ae14747';
import { $, esc, num, uid } from './util.js?v=6ae14747';
import { me, logRoll } from './play.js?v=6ae14747';
import { dailyRoll } from './weather.js?v=6ae14747';
import { gameSay } from './chatter.js?v=6ae14747';
import { markWinner } from './sparkle.js?v=6ae14747';
import { rareItem } from './sentry.js?v=6ae14747';
import { stepSound, missSound, jingle, ensureAudio } from './chiptune.js?v=6ae14747';

export const isMailRun = (g) => g.kind === 'mailrun' || g.id === 'rayson-mail-run';

const W = 480; const H = 270; const GROUND = 238;
const LENGTH = 7600; const SPEED = 125; // px of course, px per second (~60 s)
const GRAV = 820; const FLAP = -245; const MAXFALL = 330;
const LETTERS = 14;
const today = () => dailyRoll().day;
const runOf = (id) => store.get('mailrun/' + id) || {};
export const mailRunMini = () => `<div class="mailrun-mini"><span class="mr-bird"></span></div>`;

const A = {};
const loadImg = (k, src) => new Promise((ok) => { const im = new Image(); im.onload = () => { A[k] = im; ok(); }; im.onerror = ok; im.src = src; });
const assets = () => Promise.all(Object.entries({ sky: 'sky', c0: 'cloud0', c1: 'cloud1', c2: 'cloud2', sea: 'sea', sand: 'sand', rocks: 'rocks', bird: 'rayson', taillow: 'taillow', starly: 'starly', letter: 'letter', sign: 'sign' })
  .map(([k, f]) => loadImg(k, `assets/mailrun/${f}.png`)).concat(loadImg('grass', 'assets/nursery/grass.png')));

function phaseAt(x) { const p = x / LENGTH; return p < 0.4 ? 'sea' : p < 0.72 ? 'beach' : 'meadow'; }

// the course is laid out up front (same for everyone that day, so runs are fair to compare)
function course(seed) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const obs = []; const lets = [];
  for (let x = 700; x < LENGTH - 500; x += 230 + rnd() * 200) {
    const ph = phaseAt(x); const r = rnd();
    if (ph === 'sea' && r < 0.55) obs.push({ k: 'rocks', x, y: GROUND - 34 - rnd() * 40, w: 106, h: 48, sc: 0.5 });
    else if (r < 0.8) obs.push({ k: 'storm', x, y: 30 + rnd() * 130, c: 'c' + Math.floor(rnd() * 3), sc: 0.45 + rnd() * 0.15 });
    else obs.push({ k: ph === 'meadow' ? 'starly' : 'taillow', x, y: 40 + rnd() * 150, n: 2 + Math.floor(rnd() * 2), vy: (rnd() - 0.5) * 30 });
  }
  for (let i = 0; i < LETTERS; i++) lets.push({ x: 500 + (i + 0.5) * (LENGTH - 900) / LETTERS + (rnd() - 0.5) * 120, y: 40 + rnd() * 160, got: false });
  return { obs, lets };
}
const seedOf = () => [...(store.tableCode() + today())].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2147483646, 7) + 1;

function hitBoxes(o) {
  if (o.k === 'rocks') return [{ x: o.x + 6, y: o.y + 10, w: o.w - 12, h: GROUND - o.y }];
  if (o.k === 'storm') { const im = A[o.c]; const w = (im?.width || 110) * o.sc; const h = (im?.height || 40) * o.sc; return [{ x: o.x + w * 0.12, y: o.y + h * 0.2, w: w * 0.76, h: h * 0.6 }]; }
  return Array.from({ length: o.n }, (_, i) => ({ x: o.x + i * 42 + 9, y: o.y + (i % 2) * 24 + 12, w: 28, h: 20 }));
}

function play(c, box, onDone) {
  box.innerHTML = `<div class="mailrun"><div class="mr-hud"><span id="mrh">❤️❤️❤️</span><span id="mrl">✉️ 0/${LETTERS}</span><span id="mrd">Sunshell Beach</span></div>
    <canvas id="mrc" width="${W}" height="${H}"></canvas><p class="small muted" style="text-align:center">Tap the sky (or press Space / ↑) to flap.</p></div>`;
  const cv = $('#mrc', box); const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const { obs, lets } = course(seedOf());
  let x = 0; let y = 120; let vy = 0; let hearts = 3; let got = 0; let hurtT = 0; let t0 = 0; let last = 0; let started = false; let over = false; let raf = 0;
  const flap = (e) => { e?.preventDefault?.(); if (over) return; if (!started) { started = true; ensureAudio(); } vy = FLAP; };
  const key = (e) => { if (e.code === 'Space' || e.key === 'ArrowUp') flap(e); };
  cv.addEventListener('pointerdown', flap); document.addEventListener('keydown', key);
  const hud = () => { $('#mrh', box).textContent = '❤️'.repeat(hearts) + '🖤'.repeat(3 - hearts); $('#mrl', box).textContent = `✉️ ${got}/${LETTERS}`;
    $('#mrd', box).textContent = { sea: 'Over the sea', beach: 'Sunshell Beach coast', meadow: 'Almost home!' }[phaseAt(x)] + ` · ${Math.min(100, Math.round(x / LENGTH * 100))}%`; };
  const hit = () => {
    if (hurtT > 0) return; hearts--; hurtT = 1.3; missSound();
    if (got > 0) { got--; }
    hud(); if (hearts <= 0) end(false);
  };
  const end = (made) => {
    over = true; cancelAnimationFrame(raf); cv.removeEventListener('pointerdown', flap); document.removeEventListener('keydown', key);
    jingle(made); setTimeout(() => finish(c, box, made, got, hearts, onDone), 600);
  };
  const tile = (im, off, yy, hgt) => { if (!im) return; const w = im.width * (hgt / im.height); for (let px = -((off % w) + w) % w; px < W; px += w) g.drawImage(im, px, yy, w + 1, hgt); };
  const draw = (dt) => {
    // sky + slow clouds (parallax)
    if (A.sky) { const sw = W * 1.3; const sx = -((x * 0.04) % (sw - W)); g.drawImage(A.sky, sx, 0, sw, H); } else { g.fillStyle = '#7cc8f5'; g.fillRect(0, 0, W, H); }
    // the light changes as the day moves on: warmer near home
    const warm = Math.max(0, x / LENGTH - 0.55) * 0.5; if (warm > 0) { g.fillStyle = `rgba(255,150,60,${warm.toFixed(3)})`; g.fillRect(0, 0, W, H); }
    g.globalAlpha = 0.85; [[A.c0, 0.12, 14, 0.6], [A.c2, 0.3, 60, 0.9], [A.c1, 0.22, 104, 0.7], [A.c0, 0.45, 150, 1.1], [A.c2, 0.6, 30, 1.2]].forEach(([im, sp, yy, k], i) => { if (im) { const w = im.width * k; const px = ((-(x * sp) + i * 190) % (W + w) + (W + w)) % (W + w) - w; g.drawImage(im, px, yy + Math.sin(performance.now() / 1400 + i) * 3, w, im.height * k); } });
    g.globalAlpha = 1;
    // ground strip changes as Rayson gets closer to home
    const ph = phaseAt(x);
    if (ph === 'sea') { tile(A.sea, x * 1.2, GROUND - 8 + Math.sin(performance.now() / 500) * 2, H - GROUND + 10); g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 9; i++) { const sx = ((i * 61 - x * 1.2) % W + W) % W; if (Math.sin(performance.now() / 180 + i * 2) > 0.6) g.fillRect(sx, GROUND + 6 + (i * 7) % 20, 3, 2); } }
    else if (ph === 'beach') tile(A.sand, x, GROUND - 4, H - GROUND + 4);
    else { if (A.grass) { const pat = g.createPattern(A.grass, 'repeat'); g.save(); g.translate(-(x % 24), 0); g.fillStyle = pat; g.fillRect(0, GROUND, W + 24, H - GROUND); g.restore(); } }
    // finish sign
    const fx = LENGTH - x + 80;
    if (fx < W + 60 && A.sign) { g.drawImage(A.sign, fx, GROUND - 70, 72, 72); g.fillStyle = '#3a2c1a'; g.font = 'bold 11px sans-serif'; g.fillText('Woodland Base', fx - 10, GROUND - 76); }
    // obstacles
    const time = performance.now() / 1000;
    for (const o of obs) {
      const ox = o.x - x; if (ox < -200 || ox > W + 40) continue;
      if (o.k === 'rocks' && A.rocks) g.drawImage(A.rocks, 0, 0, 106, 48, ox, o.y, o.w, GROUND - o.y + 4);
      else if (o.k === 'storm') { const im = A[o.c]; if (im) { g.save(); g.filter = 'grayscale(1) brightness(0.55)'; g.drawImage(im, ox, o.y, im.width * o.sc, im.height * o.sc); g.restore(); if (Math.floor(time * 3 + o.x) % 7 === 0) { g.fillStyle = '#ffe14d'; g.fillRect(ox + 20, o.y + im.height * o.sc - 4, 3, 10); } } }
      else { const im = A[o.k]; if (im) { const fw = 32; const fh = im.height; const f = Math.floor(time * 10) % 5; for (let i = 0; i < o.n; i++) g.drawImage(im, f * fw, 0, fw, fh, ox + i * 42, o.y + (i % 2) * 24 + Math.sin(time * 4 + i) * 3, fw * 1.4, fh * 1.4); } }
    }
    for (const l of lets) { if (l.got) continue; const lx = l.x - x; if (lx < -20 || lx > W + 20) continue; if (A.letter) g.drawImage(A.letter, lx, l.y + Math.sin(time * 3 + l.x) * 3, 30, 30); }
    // Rayson: 48x72 cells, row 0 flap (4), row 1 hurt (2)
    if (A.bird) { const hurt = hurtT > 0.9; const f = hurt ? Math.floor(time * 8) % 2 : Math.floor(time * (vy < 0 ? 14 : 7)) % 4;
      if (!(hurtT > 0 && Math.floor(time * 12) % 2)) { g.save(); g.translate(90, y); g.rotate(Math.max(-0.4, Math.min(0.5, vy / 600))); g.drawImage(A.bird, f * 48, hurt ? 72 : 0, 48, 72, -36, -54, 72, 108); g.restore(); } }
    if (!started) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText('Tap to flap!', W / 2, H / 2 - 6); g.font = '12px sans-serif'; g.fillText('Fly the mail home to Woodland Base', W / 2, H / 2 + 14); g.textAlign = 'start'; }
  };
  const step = (now) => {
    if (!box.isConnected) { end(false); return; }
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0); last = now;
    if (started && !over) {
      x += SPEED * dt; vy = Math.min(MAXFALL, vy + GRAV * dt); y += vy * dt; hurtT = Math.max(0, hurtT - dt);
      for (const o of obs) if (o.vy) o.y = Math.max(20, Math.min(GROUND - 60, o.y + o.vy * dt));
      if (y < 16) { y = 16; vy = 0; }
      if (y > GROUND - 14) { y = GROUND - 22; vy = FLAP * 0.8; hit(); }
      const me = { x: 90 - 17, y: y - 14, w: 34, h: 28 };
      const over_ = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      for (const o of obs) { const ox = o.x - x; if (ox > 140 || ox < -160) continue; if (hitBoxes(o).some((b) => over_(me, { ...b, x: b.x - x }))) { hit(); break; } }
      for (const l of lets) if (!l.got && over_(me, { x: l.x - x, y: l.y, w: 30, h: 30 })) { l.got = true; got++; stepSound('up'); hud(); }
      if (x >= LENGTH) { end(true); return; }
      if (Math.floor(x) % 40 < 3) hud();
    }
    draw(dt); if (!over) raf = requestAnimationFrame(step);
  };
  assets().then(() => { hud(); raf = requestAnimationFrame(step); });
}

function finish(c, box, made, got, hearts, onDone) {
  const r = runOf(c.id); const first = made && r.paidDay !== today();
  const perfect = made && got === LETTERS;
  const poke = first ? got * 15 + (perfect ? 100 : 0) : 0;
  const best = Math.max(num(r.best), made ? got : 0);
  store.set('mailrun/' + c.id, { ...r, best, last: { made, got, hearts, t: Date.now() }, ...(first ? { paidDay: today() } : {}), runs: num(r.runs) + 1 });
  const pay = (item) => {
    if (poke) store.update('party/' + c.id, (x) => ({ ...x, poke: num(x?.poke) + poke }));
    if (item) store.set('bag/' + uid(), { name: item, qty: 1, owner: c.id });
    if (poke || item) markWinner(c.id);
    const reward = [poke ? `${poke} Poké` : '', item ? `a rare ${item}` : ''].filter(Boolean).join(' and ');
    logRoll(c.nickname, 'Rayson’s Mail Run', null, `${made ? 'delivered' : 'turned back'} · ${got}/${LETTERS} letters · ${hearts} ❤️${reward ? ' · ' + reward : ''}`, 'note');
    if (perfect) gameSay('Rayson the Wingull', 'say', `${c.nickname} helped me bring every single letter home! I wasn’t even scared. Okay, a little.`, 'mailrun', c.nickname);
    box.innerHTML = `<div class="sentry-end"><img class="sface big" src="assets/portraits/wingull.png" alt="Rayson">
      <div class="big">${made ? (perfect ? 'Perfect delivery!' : 'Mail delivered!') : 'Rayson turned back…'}</div>
      <p>${made ? `${got} of ${LETTERS} letters made it to Woodland Base with ${hearts} ❤️ left.` : `Too many bumps. Rayson flew back to Sunshell Beach to try again.`}</p>
      ${reward ? `<p class="pill">🎁 ${esc(reward)}</p>` : made && !first ? '<p class="small muted">Today’s pay was already earned. Runs still count for your best!</p>' : ''}
      <p class="small muted">Your best: ${best}/${LETTERS} letters</p><button class="btn block" id="mragain">Fly again</button></div>`;
    $('#mragain', box).onclick = () => play(c, box, onDone);
    onDone?.();
  };
  if (perfect && first && Math.random() < 0.5) rareItem().then(pay); else pay('');
}

export function renderMailRun(main, g, gm, onEdit) {
  const c = me();
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a>${gm ? '<button class="btn alt sm" id="ed">Edit</button>' : ''}</div>
    <h1 style="margin:10px 0 4px">${esc(g.name)}</h1>
    <p>${esc(g.intro || '')}</p>
    <p><span class="pill">🕹️ Tap to flap</span> <span class="pill">✉️ ${LETTERS} letters to catch</span> <span class="pill">💰 First delivery each day: 15 Poké a letter, +100 for all ${LETTERS}</span></p>
    <div class="card sentry"><div id="mrbox"></div></div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Best deliveries</h3><ul class="sentry-roster" id="mrbest"></ul></div>`;
  const party = store.get('party') || {};
  const best = () => { $('#mrbest', main).innerHTML = Object.entries(store.get('mailrun') || {}).filter(([id]) => party[id]).sort((a, b) => num(b[1].best) - num(a[1].best))
    .map(([id, r]) => `<li><span class="grow">${esc(party[id].nickname)}</span><b>${num(r.best)}/${LETTERS}</b><span class="small muted"> · ${num(r.runs)} run${num(r.runs) === 1 ? '' : 's'}${r.paidDay === today() ? ' · delivered today' : ''}</span></li>`).join('') || '<li class="muted">No deliveries yet.</li>'; };
  best();
  const box = $('#mrbox', main);
  if (!c) box.innerHTML = '<p>Pick your character first (Play tab), then help Rayson.</p>';
  else {
    box.innerHTML = `<div class="sentry-start"><div class="sentry-digg"><img class="sface dig" src="assets/portraits/wingull.png" alt="Rayson"><div class="bubble"><b>Rayson:</b> “${esc(c.nickname)}! The wind blew the guild’s mail all over Sunshell Beach. Will you help me fly it home? I… I can do this. Probably!”</div></div>
      <button class="btn block" id="mrgo">Start the mail run ✉️</button></div>`;
    $('#mrgo', box).onclick = () => play(c, box, best);
  }
  const e = $('#ed', main); if (e) e.onclick = onEdit;
}

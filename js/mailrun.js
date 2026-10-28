// Rayson's Mail Run (her ask 10-27): a one-button skill game. Rayson the Wingull carries the mail from Sunshell Beach
// back to Woodland Base: tap (or Space / ↑) to flap. Fly over the sea, the beach and the meadow, dodge sea rocks,
// storm clouds and rival bird flocks, and catch the letters the wind blew away. 3 hearts; a hit costs a heart and
// a letter. Reaching Woodland Base delivers the mail. The first delivery each day pays Poké (+ a perfect-run bonus).
// Art: Explorers of Sky skies/clouds and Sunshell beach strips (TSR rips), Wingull/Taillow/Starly sprites (SpriteCollab).
import * as store from './store.js?v=6ae15356';
import { $, esc, num, uid } from './util.js?v=6ae15356';
import { me, logRoll } from './play.js?v=6ae15356';
import { dailyRoll } from './weather.js?v=6ae15356';
import { gameSay } from './chatter.js?v=6ae15356';
import { markWinner } from './sparkle.js?v=6ae15356';
import { rareItem } from './sentry.js?v=6ae15356';
import { stepSound, missSound, jingle, ensureAudio } from './chiptune.js?v=6ae15356';

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
const assets = () => Promise.all(Object.entries({ sky: 'sky', c0: 'cloud0', c1: 'cloud1', c2: 'cloud2', sea: 'sea', sand: 'sand', rocks: 'rocks', bird: 'rayson', taillow: 'taillow', starly: 'starly', letter: 'letter', sign: 'sign', tent: 'tent', skyday: 'sky_day', skydusk: 'sky_dusk', sun: 'sun', d0: 'dcloud0', d2: 'dcloud2' })
  .map(([k, f]) => loadImg(k, `assets/mailrun/${f}.png`)).concat(loadImg('grass', 'assets/nursery/grass.png')));

function phaseAt(x) { const p = x / LENGTH; return p < 0.4 ? 'sea' : p < 0.72 ? 'beach' : 'meadow'; }

// the course is laid out up front (same for everyone that day, so runs are fair to compare)
function course(seed) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const obs = []; const lets = [];
  for (let x = 700; x < LENGTH - 500; x += 230 + rnd() * 200) {
    const ph = phaseAt(x); const r = rnd();
    if (ph === 'sea' && r < 0.55) obs.push({ k: 'rocks', x, y: GROUND - 34 - rnd() * 40, w: 106, h: 48, sc: 0.5 });
    else if (r < 0.8) obs.push({ k: 'storm', x, y: 20 + rnd() * 90, c: 'c' + Math.floor(rnd() * 3), sc: 0.45 + rnd() * 0.15, ph: rnd() * 3, every: 1.8 + rnd() * 1.4 });
    else obs.push({ k: ph === 'meadow' ? 'starly' : 'taillow', x, y: 40 + rnd() * 140, n: 2 + Math.floor(rnd() * 2), vy: (rnd() - 0.5) * 30, vx: -(30 + rnd() * 35) });
  }
  for (let i = 0; i < LETTERS; i++) lets.push({ x: 640 + (i + 0.5) * (LENGTH - 1000) / LETTERS + (rnd() - 0.5) * 120, y: -30, fall: 24 + rnd() * 18, on: false, got: false });
  return { obs, lets };
}
const seedOf = () => [...(store.tableCode() + today())].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2147483646, 7) + 1;

const BIRD = { taillow: [24, 48, 18], starly: [24, 48, 11] }; // frame w, h, frames (flight anims)
const top0 = (o) => o.y + (A[o.c]?.height || 40) * o.sc * 0.8;
const boltOn = (o, time) => ((time + o.ph) % o.every) < 0.28;
function boltPath(o, ox, time) {
  const im = A[o.c]; const cw = (im?.width || 110) * o.sc; const ch = (im?.height || 40) * o.sc;
  let s = Math.floor((time + o.ph) / o.every) * 97 + Math.floor(o.x); const rnd = () => ((s = (s * 16807 + 11) % 2147483647) / 2147483647);
  const bx = ox + cw * (0.3 + rnd() * 0.4); const top = o.y + ch * 0.8; const len = 100 + rnd() * 80;
  const pts = [[bx, top]]; let px = bx;
  for (let yy = top + 8; yy < top + len; yy += 8 + rnd() * 10) { px += (rnd() - 0.5) * 28; pts.push([px, yy]); }
  return { pts, bx, top, len };
}
function hitBoxes(o, time) {
  if (o.k === 'storm' && time != null && boltOn(o, time)) { const im = A[o.c]; const w = (im?.width || 110) * o.sc; const h = (im?.height || 40) * o.sc; const b = boltPath(o, o.x, time); return [{ x: o.x + w * 0.12, y: o.y + h * 0.2, w: w * 0.76, h: h * 0.6 }, { x: b.bx - 8, y: b.top, w: 16, h: b.len }]; }
  if (o.k === 'rocks') return [{ x: o.x + 6, y: o.y + 10, w: o.w - 12, h: GROUND - o.y }];
  if (o.k === 'storm') { const im = A[o.c]; const w = (im?.width || 110) * o.sc; const h = (im?.height || 40) * o.sc; return [{ x: o.x + w * 0.12, y: o.y + h * 0.2, w: w * 0.76, h: h * 0.6 }]; }
  return Array.from({ length: o.n }, (_, i) => ({ x: o.x + i * 42 + 8, y: o.y + (i % 2) * 24 + 26, w: 24, h: 20 }));
}

function play(c, box, onDone) {
  box.innerHTML = `<div class="mailrun"><div class="mr-hud"><span id="mrh">❤️❤️❤️</span><span id="mrl">✉️ 0/${LETTERS}</span><span id="mrd">Sunshell Beach</span></div>
    <div class="mr-prog" aria-label="Distance to Woodland Base"><span class="mrp-end">🏖️</span><div class="mrp-track"><i class="mrp-fill"></i><span class="mrp-mark" style="left:40%"></span><span class="mrp-mark" style="left:72%"></span><b class="mrp-bird"></b></div><span class="mrp-end">🏡</span></div>
    <div class="mrp-labels"><span>Sunshell Beach</span><span>Woodland Base</span></div>
    <canvas id="mrc" width="${W}" height="${H}"></canvas><p class="small muted" style="text-align:center">Tap the sky (or press Space / ↑) to flap.</p></div>`;
  const cv = $('#mrc', box); const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const { obs, lets } = course(seedOf());
  let x = 0; let y = 120; let vy = 0; let hearts = 3; let got = 0; let hurtT = 0; let t0 = 0; let last = 0; let started = false; let over = false; let raf = 0;
  const flap = (e) => { e?.preventDefault?.(); if (over) return; if (!started) { started = true; ensureAudio(); } vy = FLAP; };
  const key = (e) => { if (e.code === 'Space' || e.key === 'ArrowUp') flap(e); };
  cv.addEventListener('pointerdown', flap); document.addEventListener('keydown', key);
  const hud = () => { $('#mrh', box).textContent = '❤️'.repeat(hearts) + '🖤'.repeat(3 - hearts); $('#mrl', box).textContent = `✉️ ${got}/${LETTERS}`;
    $('#mrd', box).textContent = { sea: 'Over the sea', beach: 'Along the coast', meadow: 'Almost home!' }[phaseAt(x)]; };
  const fill = $('.mrp-fill', box); const pbird = $('.mrp-bird', box);
  const prog = () => { const p = Math.min(100, x / LENGTH * 100); fill.style.width = p + '%'; pbird.style.left = p + '%'; };
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
    // the day goes by on the way home: the sky fades into the Explorers sunset and the sun sinks into the sea
    const prog01 = Math.min(1, x / LENGTH); const dusk = Math.max(0, Math.min(1, (prog01 - 0.3) / 0.6));
    if (A.skyday) g.drawImage(A.skyday, 0, 0, W, H); else { g.fillStyle = '#4a8ff0'; g.fillRect(0, 0, W, H); }
    if (dusk > 0 && A.skydusk) { g.globalAlpha = dusk; g.drawImage(A.skydusk, 0, 0, W, H); g.globalAlpha = 1; }
    if (A.sun) {
      const sc = 1.1 + prog01 * 0.5; const sw = A.sun.width * sc; const sh = A.sun.height * sc;
      const sx = W * (0.74 - 0.14 * prog01); const sy = 46 + (GROUND + 14 - 46) * Math.pow(prog01, 1.5);
      g.save(); g.globalCompositeOperation = dusk < 0.35 ? 'lighter' : 'source-over'; g.globalAlpha = dusk < 0.35 ? 1 : 0.95; g.filter = `sepia(${dusk.toFixed(2)}) saturate(${(1 + dusk * 4).toFixed(2)}) hue-rotate(${(-28 * dusk).toFixed(0)}deg)`;
      g.drawImage(A.sun, sx - sw / 2, sy - sh / 2, sw, sh); g.restore();
    }
    // clouds: day clouds turn into the pink sunset clouds
    [[A.c0, A.d2, 0.12, 14, 0.6], [A.c2, A.d2, 0.3, 60, 0.9], [A.c1, A.d0, 0.22, 104, 0.7], [A.c0, A.d2, 0.45, 150, 1.1], [A.c2, A.d0, 0.6, 30, 1.2]].forEach(([im, dim, sp, yy, k], i) => {
      if (!im) return; const w = im.width * k; const px = ((-(x * sp) + i * 190) % (W + w) + (W + w)) % (W + w) - w; const py = yy + Math.sin(performance.now() / 1400 + i) * 3;
      if (dusk < 1) { g.globalAlpha = 0.85 * (1 - dusk); g.drawImage(im, px, py, w, im.height * k); }
      if (dusk > 0 && dim) { g.globalAlpha = 0.9 * dusk; const dh = im.height * k * 1.1; const dw = dim.width * (dh / dim.height); g.drawImage(dim, px + (w - dw) / 2, py, dw, dh); }
    });
    g.globalAlpha = 1;
    // sea rocks go in before the sea so the waves wash over their bases
    for (const o of obs) { if (o.k !== 'rocks' || !A.rocks) continue; const ox = o.x - x; if (ox < -200 || ox > W + 40) continue; g.drawImage(A.rocks, 0, 0, 106, 48, ox, o.y, o.w, GROUND - o.y + 22); }
    // ground strip changes as Rayson gets closer to home
    const ph = phaseAt(x);
    const seaY = GROUND - 8 + Math.sin(performance.now() / 500) * 2;
    if (ph === 'sea') { tile(A.sea, x * 1.2, seaY, H - GROUND + 10); g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 9; i++) { const sx = ((i * 61 - x * 1.2) % W + W) % W; if (Math.sin(performance.now() / 180 + i * 2) > 0.6) g.fillRect(sx, GROUND + 6 + (i * 7) % 20, 3, 2); } }
    else if (ph === 'beach') tile(A.sand, x, GROUND - 4, H - GROUND + 4);
    else { if (A.grass) { const pat = g.createPattern(A.grass, 'repeat'); g.save(); g.translate(-(x % 24), 0); g.fillStyle = pat; g.fillRect(0, GROUND, W + 24, H - GROUND); g.restore(); } }
    // the finish: the Woodland Base tent (the GM's own art, her ask 10-27) glides in and Rayson flies right into it
    const tw = 400; const th = tw * (A.tent ? A.tent.height / A.tent.width : 0.53); const tcx = LENGTH - x + 90;
    if (A.tent && tcx - tw / 2 < W) g.drawImage(A.tent, tcx - tw / 2, GROUND + 10 - th, tw, th);
    else if (!A.tent && tcx < W + 60 && A.sign) g.drawImage(A.sign, tcx, GROUND - 70, 72, 72);
    // obstacles
    const time = performance.now() / 1000;
    for (const o of obs) {
      const ox = o.x - x; if (ox < -200 || ox > W + 40) continue;
      if (o.k === 'rocks' && A.rocks) {
        // foam where the waves hit the rock
        const wl = seaY + 3;
        g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 7; i++) { const fxp = ox + 4 + i * (o.w - 8) / 6 + Math.sin(time * 3 + i) * 2; g.fillRect(fxp, wl - 1 + (i % 2), 6, 2); }
      }
      else if (o.k === 'storm') { const im = A[o.c]; if (im) {
        const on = boltOn(o, time); const warn = !on && ((time + o.ph) % o.every) > o.every - 0.45;
        g.save(); g.filter = on ? 'grayscale(1) brightness(0.7) contrast(1.3)' : warn ? 'grayscale(1) brightness(0.6)' : 'grayscale(1) brightness(0.48)'; g.drawImage(im, ox, o.y, im.width * o.sc, im.height * o.sc); g.restore();
        if (on) {
          const b = boltPath(o, ox, time);
          g.fillStyle = 'rgba(255,255,220,.16)'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,240,150,.35)'; g.beginPath(); g.ellipse(b.bx, top0(o), 40, 16, 0, 0, Math.PI * 2); g.fill();
          g.save(); g.lineJoin = 'miter'; g.shadowColor = '#fff6a0'; g.shadowBlur = 14;
          [[12, 'rgba(255,236,110,.35)'], [6, 'rgba(255,245,160,.8)'], [3, '#fffbe0'], [1.5, '#ffffff']].forEach(([lw, col]) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); b.pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); });
          const mid = b.pts[Math.floor(b.pts.length / 2)]; g.lineWidth = 1.5; g.beginPath(); g.moveTo(mid[0], mid[1]); g.lineTo(mid[0] + 14, mid[1] + 16); g.lineTo(mid[0] + 10, mid[1] + 26); g.stroke();
          g.restore();
        } else if (warn) { g.fillStyle = 'rgba(255,230,90,.85)'; g.fillRect(ox + im.width * o.sc * 0.5 - 1, o.y + im.height * o.sc * 0.75, 2, 4); }
      } }
      else { const im = A[o.k]; const [fw, fh, nf] = BIRD[o.k]; if (im) { for (let i = 0; i < o.n; i++) { const f = (Math.floor(time * 14) + i * 3) % nf; g.drawImage(im, f * fw, 0, fw, fh, ox + i * 42, o.y + (i % 2) * 24 + Math.sin(time * 5 + i) * 4, fw * 1.6, fh * 1.6); } } }
    }
    for (const l of lets) { if (l.got || !l.on) continue; const lx = l.x - x + Math.sin(time * 1.8 + l.x) * 10; if (lx < -30 || lx > W + 30 || l.y > H) continue; if (A.letter) { g.save(); g.translate(lx + 15, l.y + 15); g.rotate(Math.sin(time * 2.2 + l.x) * 0.35); g.drawImage(A.letter, -15, -15, 30, 30); g.restore(); } }
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
      for (const o of obs) { if (o.vy) o.y = Math.max(20, Math.min(GROUND - 70, o.y + o.vy * dt)); if (o.vx && o.x - x < W + 40) o.x += o.vx * dt; }
      for (const l of lets) { if (!l.on && l.x - x < W - 20) { l.on = true; l.y = -30; } if (l.on && !l.got) l.y += l.fall * dt; }
      if (y < 16) { y = 16; vy = 0; }
      if (y > GROUND - 14) { y = GROUND - 22; vy = FLAP * 0.8; hit(); }
      const me = { x: 90 - 17, y: y - 14, w: 34, h: 28 };
      const over_ = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      const tnow = performance.now() / 1000;
      for (const o of obs) { const ox = o.x - x; if (ox > 140 || ox < -160) continue; if (hitBoxes(o, tnow).some((b) => over_(me, { ...b, x: b.x - x }))) { hit(); break; } }
      for (const l of lets) if (l.on && !l.got && over_(me, { x: l.x - x + Math.sin(tnow * 1.8 + l.x) * 10, y: l.y, w: 30, h: 30 })) { l.got = true; got++; stepSound('up'); hud(); }
      if (x >= LENGTH) { end(true); return; }
      if (Math.floor(x) % 40 < 3) hud();
    }
    draw(dt); prog(); if (!over) raf = requestAnimationFrame(step);
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

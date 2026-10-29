// Rayson's Mail Run (her ask 10-27): a one-button skill game. Rayson the Wingull carries the mail from Sunshell Beach
// back to Woodland Base: tap (or Space / ↑) to flap. Fly over the sea, the beach and the meadow, dodge sea rocks,
// storm clouds and rival bird flocks, and catch the letters the wind blew away. 3 hearts; a hit costs a heart and
// a letter. Reaching Woodland Base delivers the mail. The first delivery each day pays Poké (+ a perfect-run bonus).
// Her ask 10-27: the table's weather roll changes the flight (MRWX below): sun = floatier, rain/typhoon = rain + more lightning
// (Rayson loves rain: letters pay extra), strong wind = faster tailwind with gusts, fog = short sight, sandstorm = slower + hazy,
// hail = heavy wings.
// Art: Explorers of Sky skies/clouds and Sunshell beach strips (TSR rips), Wingull/Taillow/Starly sprites (SpriteCollab).
import * as store from './store.js?v=6ae3a08a';
import { $, esc, num, uid } from './util.js?v=6ae3a08a';
import { me, logRoll } from './play.js?v=6ae3a08a';
import { dailyRoll, currentWeather, WEATHERS } from './weather.js?v=6ae3a08a';
import { gameSay } from './chatter.js?v=6ae3a08a';
import { markWinner } from './sparkle.js?v=6ae3a08a';
import { rareItem } from './sentry.js?v=6ae3a08a';
import { startBroadcast } from './watch.js?v=6ae3a08a';
import { stepSound, missSound, jingle, ensureAudio, startMusic, stopMusic, muted, setMuted } from './chiptune.js?v=6ae3a08a';

export const isMailRun = (g) => g.kind === 'mailrun' || g.id === 'rayson-mail-run';

const W = 480; const H = 270; const GROUND = 238;
const LENGTH = 7600; const SPEED = 125; // px of course, px per second (~60 s)
const GRAV = 820; const FLAP = -245; const MAXFALL = 330;
const LETTERS = 14;
const today = () => dailyRoll().day;
// weather: speed / gravity multipliers, gust strength, lightning (storm 'every' multiplier), particles, tint, Poké bonus per letter
const MRWX = {
  clear: { intro: 'Calm skies. A perfect day for mail!' }, cloudy: { tint: 'rgba(80,90,110,.22)', note: 'A grey sky today. Nice and calm.' },
  sunny: { grav: 0.9, tint: 'rgba(255,220,120,.12)', note: 'Warm air lifts Rayson: every flap floats a little longer.' },
  harsh: { grav: 0.8, tint: 'rgba(255,130,50,.2)', haze: true, note: 'Hot rising air makes Rayson really floaty, and the heat makes everything shimmer.' },
  rain: { rain: 70, bolt: 0.7, bonus: 5, note: 'Rayson loves the rain (+5 Poké a letter), but the storm clouds flash more often.' },
  typhoon: { rain: 150, bolt: 0.45, gust: 260, speed: 1.1, tint: 'rgba(20,30,70,.35)', flash: true, bonus: 10, note: 'Huge gusts toss Rayson around and lightning is everywhere. +10 Poké a letter if you make it!' },
  wind: { speed: 1.3, gust: 190, streaks: 26, note: 'Tailwind! Rayson flies faster, but gusts push him up and down.' },
  fog: { fog: true, note: 'You can only see a little way ahead.' },
  sandstorm: { sand: 90, speed: 0.88, tint: 'rgba(205,160,80,.3)', note: 'Sand slows Rayson down and makes it hard to see.' },
  hail: { hail: 45, grav: 1.12, note: 'Hail makes Rayson’s wings heavy, so he sinks faster.' },
};
const mrWx = () => { const k = currentWeather().key; return { key: k, name: WEATHERS[k]?.name || 'Clear skies', icon: WEATHERS[k]?.icon || '☀️', ...(MRWX[k] || {}) }; };
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
  const wx = mrWx(); const SPD = SPEED * (wx.speed || 1); const GRV = GRAV * (wx.grav || 1);
  box.innerHTML = `<div class="mailrun"><div class="mr-hud"><span id="mrh">❤️❤️❤️</span><span id="mrl">✉️ 0/${LETTERS}</span><span id="mrd">Sunshell Beach</span></div>
    <div class="mr-prog" aria-label="Distance to Woodland Base"><span class="mrp-end">🏖️</span><div class="mrp-track"><i class="mrp-fill"></i><span class="mrp-mark" style="left:40%"></span><span class="mrp-mark" style="left:72%"></span><b class="mrp-bird"></b></div><span class="mrp-end">🏡</span></div>
    <div class="mrp-labels"><span>Sunshell Beach</span><span>Woodland Base</span></div>
    ${wx.note ? `<p class="mr-wx">${wx.icon} <b>${esc(wx.name)}:</b> ${esc(wx.note)}</p>` : ''}
    <canvas id="mrc" width="${W}" height="${H}"></canvas><p class="small muted" style="text-align:center">Tap the sky (or press Space / ↑) to flap. <button class="btn alt sm" id="mrmusic">${muted() ? '🔇 Music off' : '🔊 Music on'}</button></p></div>`;
  $('#mrmusic', box).onclick = (e) => { const m = !muted(); setMuted(m); e.target.textContent = m ? '🔇 Music off' : '🔊 Music on'; };
  const cv = $('#mrc', box); const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const stopWatch = startBroadcast('rayson-mail-run', 'Rayson’s Mail Run', { canvas: cv, box }); // friends can watch live
  const { obs, lets } = course(seedOf());
  if (wx.bolt) obs.forEach((o) => { if (o.k === 'storm') o.every *= wx.bolt; });
  // weather particles (fixed spots, moved each frame)
  const nP = wx.rain || wx.sand || wx.hail || wx.streaks || 0;
  const parts = Array.from({ length: nP }, (_, i) => ({ x: (i * 97.3) % W, y: (i * 53.7) % H, s: 0.6 + ((i * 37) % 10) / 10 }));
  let x = 0; let y = 120; let vy = 0; let hearts = 3; let got = 0; let hurtT = 0; let t0 = 0; let last = 0; let started = false; let over = false; let raf = 0;
  // her ask 10-27: the day's weather pops up Super Monkey Ball style (icon slams in, letters zoom in one by one, READY? pulses, GO! on the first flap)
  const wxName = wx.name.toUpperCase(); const INTRO = 0.75 + wxName.length * 0.05 + 0.5; let introAt = 0; let goAt = 0; const secs = (at) => (performance.now() - at) / 1000;
  const flap = (e) => { e?.preventDefault?.(); if (over) return; if (!started) { ensureAudio(); if (!introAt || secs(introAt) < INTRO) { introAt = performance.now() - INTRO * 1000; return; } started = true; goAt = performance.now(); stepSound('up'); startMusic('beach'); } vy = FLAP; };
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
    over = true; stopMusic(); stopWatch(made ? `Delivered the mail with ${got} letters!` : 'Rayson had to turn back.'); cancelAnimationFrame(raf); cv.removeEventListener('pointerdown', flap); document.removeEventListener('keydown', key);
    jingle(made); setTimeout(() => finish(c, box, made, got, hearts, onDone), 600);
  };
  const tile = (im, off, yy, hgt) => { if (!im) return; const w = im.width * (hgt / im.height); for (let px = -((off % w) + w) % w; px < W; px += w) g.drawImage(im, px, yy, w + 1, hgt); };
  const back = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2); // overshoot then settle
  const chunky = (txt, cx, cy, size, sc, c1, c2, rot = 0, a = 1) => {
    if (sc <= 0 || a <= 0) return; g.save(); g.globalAlpha = a; g.translate(cx, cy); g.rotate(rot); g.scale(sc, sc);
    g.font = `900 ${size}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = size * 0.26; g.strokeStyle = '#1b1446'; g.strokeText(txt, 0, 0);
    const gr = g.createLinearGradient(0, -size / 2, 0, size / 2); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillText(txt, 0, 0);
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,.7)'; g.strokeText(txt, 0, -size * 0.06); g.restore();
  };
  const wrap = (txt, maxW) => { const out = []; let line = ''; for (const w of txt.split(' ')) { const tryL = line ? line + ' ' + w : w; if (g.measureText(tryL).width > maxW && line) { out.push(line); line = w; } else line = tryL; } if (line) out.push(line); return out; };
  const intro = () => {
    if (goAt) { // GO! zooms out big and fades
      const t = secs(goAt) / 0.9; if (t >= 1) { goAt = 0; return; }
      chunky('GO!', W / 2, H / 2, 64, 0.4 + back(Math.min(1, t * 3)) * 0.9 + t * 0.5, '#fff27a', '#ff8a1f', 0, t < 0.6 ? 1 : (1 - t) / 0.4); return;
    }
    if (!introAt) introAt = performance.now(); const t = secs(introAt);
    g.fillStyle = `rgba(10,8,40,${Math.min(0.5, t * 1.2)})`; g.fillRect(0, 0, W, H);
    // sun-burst rays spin behind the icon
    const iS = back(t / 0.45);
    if (iS > 0) {
      g.save(); g.translate(W / 2, 62); g.rotate(t * 0.8); g.globalAlpha = 0.35 * Math.min(1, t * 2); g.fillStyle = '#ffe680';
      for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(-10, -70 * iS); g.lineTo(10, -70 * iS); g.fill(); }
      g.restore();
      g.save(); g.translate(W / 2, 62); g.rotate((1 - iS) * -2.5); g.scale(iS * 1.15, iS * 1.15); g.font = '48px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(wx.icon, 0, 2); g.restore();
    }
    // weather name: each letter zooms down from huge, one after another
    g.font = '900 34px "Arial Black", Impact, sans-serif'; const widths = [...wxName].map((ch) => g.measureText(ch).width); const total = widths.reduce((a, b) => a + b, 0);
    const fit = Math.min(1, (W - 40) / total); let lx = W / 2 - (total * fit) / 2;
    [...wxName].forEach((ch, i) => {
      const p = Math.min(1, Math.max(0, (t - 0.35 - i * 0.05) / 0.3)); const cw = widths[i] * fit;
      if (p > 0 && ch !== ' ') chunky(ch, lx + cw / 2, 128, 34 * fit, 1 + (1 - back(p)) * 2.4 * (p < 1 ? 1 : 0), '#ffffff', '#7fd4ff', 0, Math.min(1, p * 2.5));
      lx += cw;
    });
    // what the weather does, then READY? pulsing
    const after = 0.75 + wxName.length * 0.05; const nA = Math.min(1, Math.max(0, (t - after) / 0.3));
    const note = wx.note || wx.intro;
    if (nA > 0 && note) { g.save(); g.globalAlpha = nA; g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; wrap(note, W - 70).slice(0, 3).forEach((ln, i) => g.fillText(ln, W / 2, 160 + i * 15)); g.restore(); }
    const rA = Math.min(1, Math.max(0, (t - INTRO) / 0.25));
    if (rA > 0) { chunky('READY?', W / 2, 222, 30, back(rA) * (1 + 0.06 * Math.sin(t * 6)), '#fff27a', '#ff8a1f'); g.save(); g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText('tap to fly!', W / 2, 252); g.restore(); }
  };
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
    // weather over the world (under Rayson): tint, particles, fog with a clear patch around him, typhoon flashes
    if (wx.tint) { g.fillStyle = wx.tint; g.fillRect(0, 0, W, H); }
    if (nP) {
      const wind = wx.gust ? 0.35 : wx.speed > 1 ? 0.5 : 0.12;
      for (const q of parts) {
        if (wx.rain) { q.y += 520 * q.s * dt; q.x -= (120 + SPD * wind) * dt; } else if (wx.hail) { q.y += 300 * q.s * dt; q.x -= 60 * dt; }
        else if (wx.sand) { q.x -= (260 + 160 * q.s) * dt; q.y += Math.sin(time * 3 + q.s * 9) * 30 * dt; } else { q.x -= (420 + 200 * q.s) * dt; }
        if (q.y > H) { q.y -= H + 10; } if (q.x < -20) { q.x += W + 40; }
        if (wx.rain) { g.strokeStyle = 'rgba(210,230,255,.75)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - 4 - wind * 6, q.y + 12 * q.s); g.stroke(); }
        else if (wx.hail) { g.fillStyle = 'rgba(240,248,255,.95)'; g.beginPath(); g.arc(q.x, q.y, 1.5 + q.s * 1.5, 0, Math.PI * 2); g.fill(); }
        else if (wx.sand) { g.fillStyle = 'rgba(230,190,110,.8)'; g.fillRect(q.x, q.y, 2 + q.s * 2, 1.5); }
        else { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x + 26 * q.s, q.y); g.stroke(); }
      }
    }
    if (wx.haze) { g.fillStyle = `rgba(255,200,120,${0.05 + 0.04 * Math.sin(time * 3)})`; g.fillRect(0, 0, W, H); }
    if (wx.fog) { const fg = g.createRadialGradient(90, y, 50, 90, y, 230); fg.addColorStop(0, 'rgba(228,232,238,0)'); fg.addColorStop(1, 'rgba(228,232,238,.95)'); g.fillStyle = fg; g.fillRect(0, 0, W, H); }
    if (wx.flash && (time % 5.3) < 0.08) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, 0, W, H); }
    // Rayson: 48x72 cells, row 0 flap (4), row 1 hurt (2)
    if (A.bird) { const hurt = hurtT > 0.9; const f = hurt ? Math.floor(time * 8) % 2 : Math.floor(time * (vy < 0 ? 14 : 7)) % 4;
      if (!(hurtT > 0 && Math.floor(time * 12) % 2)) { g.save(); g.translate(90, y); g.rotate(Math.max(-0.4, Math.min(0.5, vy / 600))); g.drawImage(A.bird, f * 48, hurt ? 72 : 0, 48, 72, -36, -54, 72, 108); g.restore(); } }
    if (!started || goAt) intro();
  };
  const step = (now) => {
    if (!box.isConnected) { end(false); return; }
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0); last = now;
    if (started && !over) {
      x += SPD * dt; vy = Math.min(MAXFALL, vy + GRV * dt); y += vy * dt; hurtT = Math.max(0, hurtT - dt);
      for (const o of obs) { if (o.vy) o.y = Math.max(20, Math.min(GROUND - 70, o.y + o.vy * dt)); if (o.vx && o.x - x < W + 40) o.x += o.vx * dt; }
      for (const l of lets) { if (!l.on && l.x - x < W - 20) { l.on = true; l.y = -30; } if (l.on && !l.got) l.y += l.fall * dt; }
      if (wx.gust) { const tg = performance.now() / 1000; vy += wx.gust * Math.sin(tg * 0.9) * Math.sin(tg * 2.3 + 1) * dt; }
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
  const wx = mrWx(); const poke = first ? got * (15 + (wx.bonus || 0)) + (perfect ? 100 : 0) : 0;
  const best = Math.max(num(r.best), made ? got : 0);
  store.set('mailrun/' + c.id, { ...r, best, last: { made, got, hearts, t: Date.now() }, ...(first ? { paidDay: today() } : {}), runs: num(r.runs) + 1 });
  const pay = (item) => {
    if (poke) store.update('party/' + c.id, (x) => ({ ...x, poke: num(x?.poke) + poke }));
    if (item) store.set('bag/' + uid(), { name: item, qty: 1, owner: c.id });
    if (poke || item) markWinner(c.id);
    const reward = [poke ? `${poke} Poké` : '', item ? `a rare ${item}` : ''].filter(Boolean).join(' and ');
    logRoll(c.nickname, 'Rayson’s Mail Run', null, `${made ? 'delivered' : 'turned back'} in ${wx.name.toLowerCase()} · ${got}/${LETTERS} letters · ${hearts} ❤️${reward ? ' · ' + reward : ''}`, 'note');
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

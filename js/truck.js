// Supply Wagon with Machamp (her ask 10-27): a catch-and-sort skill game. Machamp stands on the supply wagon and tosses
// the delivery to you with all four arms. Run left and right to catch things, carry up to 5 at once, and drop them off:
// food goes in the pantry basket, gear goes in the storage chest. A dropped item or a caught Voltorb is a strike;
// 3 strikes or the end of the 90-second shift ends it. The first shift each day pays Poké.
// Her ask 10-27: Machamp stands on a caravan (assets/truck/caravan.png, pixel-built from Treasure Town wood), the canvas draws at
// double resolution so the backdrop is sharp, and the basket and chest sit on the grass with shadows. Follow-ups: open sky (Mail
// Run's day sky) above a soft, faded Woodland Base picture; bins at their old size but smoother (basket_hd/chest_hd = Scale4x of
// the sprites, the chest recoloured to wood and gold).
// Art: the Woodland Base tent (GM's campaign art) backdrop, Machamp / Voltorb / runner sprites (SpriteCollab), items, basket, chest and logs (PMDCollab RawAsset).
import * as store from './store.js?v=6ae1690f';
import { $, esc, num, uid } from './util.js?v=6ae1690f';
import { me, logRoll } from './play.js?v=6ae1690f';
import { dailyRoll } from './weather.js?v=6ae1690f';
import { gameSay } from './chatter.js?v=6ae1690f';
import { markWinner } from './sparkle.js?v=6ae1690f';
import { rareItem } from './sentry.js?v=6ae1690f';
import { startBroadcast } from './watch.js?v=6ae1690f';
import { stepSound, missSound, jingle, ensureAudio } from './chiptune.js?v=6ae1690f';

export const isTruck = (g) => g.kind === 'truck' || g.id === 'machamp-wagon';

const W = 480; const H = 270; const GROUND = 236; const SHIFT = 90; const MAXCARRY = 5;
const RUNNERS = { swablu: [56, 72, [9, 6, 6, 2]], sudowoodo: [48, 64, [1, 4, 4, 2]], golett: [40, 56, [5, 4, 4, 2]], tinkatink: [40, 40, [4, 4, 4, 2]], jangmoo: [32, 48, [4, 4, 4, 2]],
  magnemite: [48, 56, [4, 6, 6, 2]], slakoth: [48, 48, [2, 4, 4, 2]], cleffa: [48, 56, [2, 8, 8, 2]], cottonee: [48, 56, [4, 6, 6, 2]], pichu: [40, 48, [4, 8, 8, 2]] };
const ITEMS = [['i_oran', 'food'], ['i_sitrus', 'food'], ['i_apple', 'food'], ['i_banana', 'food'], ['i_box', 'gear'], ['i_orb', 'gear'], ['i_paper', 'gear'], ['i_stick', 'gear']];
const BASKET = { x: 18, w: 54 }; const CHEST = { x: 84, w: 60 };
const today = () => dailyRoll().day;
const runOf = (id) => store.get('truck/' + id) || {};
export const truckMini = () => '<div class="truck-mini"><span class="tm-champ"></span></div>';

const A = {};
const loadImg = (k, src) => new Promise((ok) => { const im = new Image(); im.onload = () => { A[k] = im; ok(); }; im.onerror = ok; im.src = src; });
const runnerKey = (c) => { const k = String(c?.species || c?.pokemon || '').toLowerCase().replace(/[^a-z]/g, ''); return RUNNERS[k] ? k : 'pichu'; };
const assets = (rk) => Promise.all(['machamp', 'voltorb', 'basket_hd', 'chest_hd', 'caravan', ...ITEMS.map((x) => x[0])].map((k) => loadImg(k, `assets/truck/${k}.png`))
  .concat(loadImg('runner', `assets/truck/run_${rk}.png`), loadImg('bg', 'assets/banners/guilds.jpg'), loadImg('sky', 'assets/mailrun/sky_day.png'), ...[0, 1, 2].map((i) => loadImg('cloud' + i, `assets/mailrun/cloud${i}.png`)), loadImg('grass', 'assets/nursery/grass.png')));

function play(c, box, onDone) {
  box.innerHTML = `<div class="mailrun truck"><div class="mr-hud"><span id="tks">❌❌❌</span><span id="tkn">📦 0 stored</span><span id="tkt">⏱ ${SHIFT}s</span></div>
    <div class="tk-say" id="tksay">Machamp: “Ready? Catch!”</div>
    <canvas id="tkc" width="${W * 2}" height="${H * 2}"></canvas>
    <div class="tk-pad"><button class="btn alt" data-mv="-1">◀</button><span class="small muted">Drag, tap a side, or use ← →. Food in the 🧺 basket, gear in the chest.</span><button class="btn alt" data-mv="1">▶</button></div></div>`;
  const cv = $('#tkc', box); const g = cv.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0); g.imageSmoothingEnabled = false;
  const rk = runnerKey(c); const [rw, rh, rfr] = RUNNERS[rk];
  const stopWatch = startBroadcast('machamp-wagon', 'Supply Wagon with Machamp', { canvas: cv, box }); // friends can watch live
  let px = 220; let dir = 0; let face = -1; let carry = []; let stored = 0; let strikes = 0; let t = 0; let last = 0; let nextThrow = 1.2; let over = false; let raf = 0;
  let throwAnim = 0; let zapT = 0; let started = false; const flying = []; const pops = []; let target = null;
  const say = (line) => { const e = $('#tksay', box); if (e) e.textContent = 'Machamp: “' + line + '”'; };
  const hud = () => { $('#tks', box).textContent = '❌'.repeat(3 - strikes) + '⭕'.repeat(strikes); $('#tkn', box).textContent = `📦 ${stored} stored · 🎒 ${carry.length}/${MAXCARRY}`; $('#tkt', box).textContent = `⏱ ${Math.max(0, Math.ceil(SHIFT - t))}s`; };
  const strike = (why) => { strikes++; missSound(); say(why); hud(); if (strikes >= 3) end(); };
  const end = () => { if (over) return; over = true; stopWatch(`${stored} things stored`); cancelAnimationFrame(raf); cleanup(); jingle(stored >= 20); setTimeout(() => finish(c, box, stored, strikes, onDone), 700); };
  // controls: drag / tap sides / keys / buttons
  const toX = (e) => { const r = cv.getBoundingClientRect(); return (e.clientX - r.left) / r.width * W; };
  const down = (e) => { e.preventDefault(); if (!started) { started = true; ensureAudio(); } target = toX(e); cv.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (target != null) target = toX(e); };
  const up = () => { target = null; };
  const key = (e) => { if (e.key === 'ArrowLeft' || e.key === 'a') { dir = -1; started = true; e.preventDefault(); } else if (e.key === 'ArrowRight' || e.key === 'd') { dir = 1; started = true; e.preventDefault(); } };
  const keyUp = (e) => { if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) dir = 0; };
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  document.addEventListener('keydown', key); document.addEventListener('keyup', keyUp);
  box.querySelectorAll('[data-mv]').forEach((b) => { b.onpointerdown = (e) => { e.preventDefault(); started = true; dir = +b.dataset.mv; }; b.onpointerup = b.onpointerleave = () => { dir = 0; }; });
  const cleanup = () => { cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.removeEventListener('keydown', key); document.removeEventListener('keyup', keyUp); };

  const toss = () => {
    const volt = t > 12 && Math.random() < 0.13 + t / 900;
    const [k, kind] = volt ? ['voltorb', 'volt'] : ITEMS[Math.floor(Math.random() * ITEMS.length)];
    const landX = 30 + Math.random() * 330; const sx = 412; const sy = 118; const T = 1.3 + Math.random() * 0.5 - Math.min(0.4, t / 200);
    flying.push({ k, kind, x: sx, y: sy, vx: (landX - sx) / T, vy: (GROUND - 20 - sy - 0.5 * 360 * T * T) / T, rot: 0 });
    throwAnim = 0.5;
    if (volt && Math.random() < 0.6) say(pick(['Oops! That one’s a Voltorb!', 'Not that one! Duck!', 'Heh… don’t catch the round one.']));
    else if (Math.random() < 0.18) say(pick(['Catch!', 'Heads up!', 'Coming your way!', 'Four arms, no waiting!', 'Hup!']));
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const step = (now) => {
    if (!box.isConnected) { over = true; cleanup(); return; }
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0); last = now;
    if (started && !over) {
      t += dt; zapT = Math.max(0, zapT - dt); throwAnim = Math.max(0, throwAnim - dt);
      const speed = 230 - carry.length * 24; const want = target != null ? Math.sign(target - px) * (Math.abs(target - px) > 6 ? 1 : 0) : dir;
      if (zapT <= 0 && want) { px = Math.max(20, Math.min(370, px + want * speed * dt)); face = want; }
      nextThrow -= dt;
      if (nextThrow <= 0) { toss(); if (t > 40 && Math.random() < 0.3) setTimeout(toss, 250); nextThrow = Math.max(0.75, 1.7 - t / 70); }
      for (const f of flying) { f.vy += 360 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += dt * 6; }
      // catching: lands on top of your stack
      const headY = GROUND - 50 - carry.length * 14;
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i];
        if (f.vy > 0 && Math.abs(f.x - px) < 26 && f.y > headY - 14 && f.y < headY + 18) {
          flying.splice(i, 1);
          if (f.kind === 'volt') { zapT = 1; carry = []; strike('Yikes! You caught the Voltorb!'); pops.push({ x: px, y: headY, s: '⚡', t: 1 }); continue; }
          if (carry.length >= MAXCARRY) { strike('Too much to carry! Drop some off first!'); continue; }
          carry.push(f); stepSound(f.kind === 'food' ? 'up' : 'right'); hud();
        } else if (f.y > GROUND - 6) {
          flying.splice(i, 1);
          if (f.kind !== 'volt') { pops.push({ x: f.x, y: GROUND - 10, s: '💥', t: 1 }); strike(pick(['Aw, it hit the ground!', 'Whoops, I’ll count that one…', 'Gotta be quicker!'])); }
        }
      }
      // drop-off: standing at a bin unloads the matching things
      const at = (bin) => px > bin.x - 10 && px < bin.x + bin.w + 10;
      for (const [bin, kind] of [[BASKET, 'food'], [CHEST, 'gear']]) if (at(bin) && carry.some((x) => x.kind === kind)) {
        const n = carry.filter((x) => x.kind === kind).length; carry = carry.filter((x) => x.kind !== kind); stored += n;
        pops.push({ x: bin.x + bin.w / 2, y: GROUND - 50, s: `+${n}`, t: 1 }); jingleSmall(); hud();
      }
      for (const p of pops) p.t -= dt;
      while (pops.length && pops[0].t <= 0) pops.shift();
      if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) hud();
      if (t >= SHIFT) end();
    }
    draw();
    if (!over) raf = requestAnimationFrame(step);
  };
  const jingleSmall = () => stepSound('up');
  // the Woodland Base picture at 170px tall (x2 for the sharp canvas), softened and faded: its top 75% fades into the sky
  let base = null;
  const fadedBase = (im) => { const h = 340; const w = Math.round(im.width * h / im.height); const o = document.createElement('canvas'); o.width = w; o.height = h;
    const q = o.getContext('2d'); q.imageSmoothingQuality = 'high'; q.filter = 'blur(2px) saturate(0.75)'; q.drawImage(im, 0, 0, w, h); q.filter = 'none'; q.globalCompositeOperation = 'destination-in';
    const gr = q.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.75, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,.75)'); q.fillStyle = gr; q.fillRect(0, 0, w, h); return o; };
  const draw = () => {
    const time = performance.now() / 1000;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    if (A.sky) g.drawImage(A.sky, 0, 0, W, GROUND);
    // Mail Run's clouds drifting slowly across the sky
    [[0, 18, 7, 0.9], [1, 52, 4.5, 0.7], [2, 30, 5.5, 0.8], [0, 64, 3.5, 0.55]].forEach(([k, y, sp, sc], i) => { const im = A['cloud' + k]; if (!im) return;
      const w = im.width * sc; const span = W + w; g.drawImage(im, ((time * sp + i * 157) % span) - w, y, w, im.height * sc); });
    if (A.bg) { base = base || fadedBase(A.bg); g.drawImage(base, (W - base.width / 2) / 2, GROUND + 14 - base.height / 2, base.width / 2, base.height / 2); }
    g.imageSmoothingEnabled = false; g.fillStyle = 'rgba(255,240,210,.10)'; g.fillRect(0, 0, W, GROUND);
    if (A.grass) { const pat = g.createPattern(A.grass, 'repeat'); g.fillStyle = pat; g.fillRect(0, GROUND, W, H - GROUND); }
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, GROUND, W, 3);
    // bins with labels
    // bins drawn at exactly 2x, their bottoms resting on the grass (the chest sprite has 8px of empty space under it)
    const shadow = (x, w) => { g.fillStyle = 'rgba(30,20,5,.35)'; g.beginPath(); g.ellipse(x + w / 2, GROUND + 3, w / 2 + 2, 5, 0, 0, Math.PI * 2); g.fill(); };
    shadow(BASKET.x, BASKET.w); shadow(CHEST.x, CHEST.w);
    g.imageSmoothingEnabled = true;
    if (A.basket_hd) g.drawImage(A.basket_hd, BASKET.x, GROUND - 51, 54, 54);
    if (A.chest_hd) g.drawImage(A.chest_hd, CHEST.x - 6, GROUND - 45, 60, 60);
    g.imageSmoothingEnabled = false;
    g.font = 'bold 10px sans-serif'; g.fillStyle = '#fff'; g.strokeStyle = '#3a2c1a'; g.lineWidth = 3;
    [['FOOD', BASKET.x + 12, GROUND - 56], ['GEAR', CHEST.x + 12, GROUND - 50]].forEach(([s, x, y]) => { g.strokeText(s, x, y); g.fillText(s, x, y); });
    // the caravan with Machamp standing on its bed (bed top = Machamp's feet, GROUND - 84)
    g.fillStyle = 'rgba(30,20,5,.35)'; g.beginPath(); g.ellipse(408, GROUND + 3, 70, 6, 0, 0, Math.PI * 2); g.fill();
    if (A.caravan) g.drawImage(A.caravan, 336, GROUND - 142, 144, 144);
    if (A.machamp) { const r = throwAnim > 0 ? 1 : 0; const n = r ? 10 : 10; const f = r ? Math.min(9, Math.floor((0.5 - throwAnim) / 0.05)) : Math.floor(time * 6) % n;
      g.drawImage(A.machamp, f * 48, r * 64, 48, 64, 384, GROUND - 160, 96, 128); }
    // runner + carried stack
    if (A.runner) { const moving = zapT <= 0 && (dir || target != null); const row = zapT > 0 ? 3 : moving ? (face < 0 ? 1 : 2) : 0; const n = rfr[row];
      const f = Math.floor(time * (moving ? 10 : 5)) % n; const sc = 1.6; const dw = rw * sc; const dh = rh * sc;
      if (!(zapT > 0 && Math.floor(time * 14) % 2)) g.drawImage(A.runner, f * rw, row * rh, rw, rh, px - dw / 2, GROUND - 22 - dh / 2, dw, dh);
      carry.forEach((it, i) => { const im = A[it.k]; if (im) g.drawImage(im, px - 14, GROUND - 62 - i * 14, 28, 28); });
      if (zapT > 0) { g.strokeStyle = '#fff36b'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 6; i++) { const a = time * 20 + i; g.moveTo(px, GROUND - 40); g.lineTo(px + Math.cos(a) * 26, GROUND - 40 + Math.sin(a) * 26); } g.stroke(); }
    }
    for (const f of flying) {
      if (f.kind === 'volt') { if (A.voltorb) { const fr = Math.floor(time * 10) % 5; g.drawImage(A.voltorb, fr * 32, 0, 32, 40, f.x - 24, f.y - 30, 48, 60); } }
      else { const im = A[f.k]; if (im) { g.save(); g.translate(f.x, f.y); g.rotate(f.rot); g.drawImage(im, -14, -14, 28, 28); g.restore(); } }
    }
    g.font = 'bold 16px sans-serif'; g.textAlign = 'center';
    for (const p of pops) { g.globalAlpha = Math.max(0, p.t); g.fillStyle = '#fff'; g.strokeStyle = '#3a2c1a'; g.lineWidth = 3; g.strokeText(p.s, p.x, p.y - (1 - p.t) * 24); g.fillText(p.s, p.x, p.y - (1 - p.t) * 24); }
    g.globalAlpha = 1; g.textAlign = 'start';
    if (!started) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText('Tap or press ← → to start!', W / 2, H / 2 - 6); g.font = '12px sans-serif'; g.fillText('Catch what Machamp throws. Food in the basket, gear in the chest. Not the Voltorb!', W / 2, H / 2 + 14); g.textAlign = 'start'; }
  };
  assets(rk).then(() => { hud(); raf = requestAnimationFrame(step); });
}

function finish(c, box, stored, strikes, onDone) {
  const r = runOf(c.id); const first = r.paidDay !== today() && stored > 0; // an empty shift doesn't use up the day's pay
  const poke = first ? stored * 4 + (stored >= 40 ? 80 : 0) : 0;
  const best = Math.max(num(r.best), stored);
  store.set('truck/' + c.id, { ...r, best, runs: num(r.runs) + 1, ...(first ? { paidDay: today() } : {}) });
  const pay = (item) => {
    if (poke) store.update('party/' + c.id, (x) => ({ ...x, poke: num(x?.poke) + poke }));
    if (item) store.set('bag/' + uid(), { name: item, qty: 1, owner: c.id });
    if (poke || item) markWinner(c.id);
    const reward = [poke ? `${poke} Poké` : '', item ? `a rare ${item}` : ''].filter(Boolean).join(' and ');
    logRoll(c.nickname, 'Supply Wagon with Machamp', null, `${stored} stored · ${strikes} strike${strikes === 1 ? '' : 's'}${reward ? ' · ' + reward : ''}`, 'note');
    if (stored >= 40) gameSay('Machamp', 'say', `${c.nickname} caught everything I threw today! Strong arms, that one.`, 'truck', c.nickname);
    box.innerHTML = `<div class="sentry-end"><div class="big">${stored >= 40 ? 'Wagon cleared! 💪' : strikes >= 3 ? 'Shift over' : 'Time’s up!'}</div>
      <p>${stored} thing${stored === 1 ? '' : 's'} stored in the base${strikes ? `, ${strikes} strike${strikes === 1 ? '' : 's'}` : ''}.</p>
      ${reward ? `<p class="pill">🎁 ${esc(reward)}</p>` : !first ? '<p class="small muted">Today’s pay was already earned. Shifts still count for your best!</p>' : ''}
      <p class="small muted">Your best: ${best}</p><button class="btn block" id="tkagain">Another shift</button></div>`;
    $('#tkagain', box).onclick = () => play(c, box, onDone);
    onDone?.();
  };
  if (first && stored >= 40 && Math.random() < 0.3) rareItem().then(pay); else pay('');
}

export function renderTruck(main, g, gm, onEdit) {
  const c = me();
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a>${gm ? '<button class="btn alt sm" id="ed">Edit</button>' : ''}</div>
    <h1 style="margin:10px 0 4px">${esc(g.name)}</h1>
    <p>${esc(g.intro || '')}</p>
    <p><span class="pill">🤲 Catch & carry (up to ${MAXCARRY})</span> <span class="pill">🧺 Food → basket · 📦 Gear → chest</span> <span class="pill">⚡ Don’t catch the Voltorb</span> <span class="pill">💰 First shift each day: 4 Poké a thing, +80 for 40+</span></p>
    <div class="card sentry"><div id="tkbox"></div></div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Strongest helpers</h3><ul class="sentry-roster" id="tkbest"></ul></div>`;
  const party = store.get('party') || {};
  const best = () => { $('#tkbest', main).innerHTML = Object.entries(store.get('truck') || {}).filter(([id]) => party[id]).sort((a, b) => num(b[1].best) - num(a[1].best))
    .map(([id, r]) => `<li><span class="grow">${esc(party[id].nickname)}</span><b>${num(r.best)}</b><span class="small muted"> · ${num(r.runs)} shift${num(r.runs) === 1 ? '' : 's'}${r.paidDay === today() ? ' · paid today' : ''}</span></li>`).join('') || '<li class="muted">No shifts yet.</li>'; };
  best();
  const box = $('#tkbox', main);
  if (!c) box.innerHTML = '<p>Pick your character first (Play tab), then help Machamp.</p>';
  else {
    box.innerHTML = `<div class="sentry-start"><div class="sentry-digg"><img class="sface dig" src="assets/truck/machamp_face.png" alt="Machamp" onerror="this.remove()"><div class="bubble"><b>Machamp:</b> “${esc(c.nickname)}! The supply wagon’s here and I’ve got four arms full. I’ll toss, you catch! Food in the basket, gear in the chest. And if something round starts sparking… don’t catch it.”</div></div>
      <button class="btn block" id="tkgo">Start unloading 💪</button></div>`;
    $('#tkgo', box).onclick = () => play(c, box, best);
  }
  const e = $('#ed', main); if (e) e.onclick = onEdit;
}

// Friend Zone camp scene (her asks 10-29: see the camp's Pokémon roaming and interacting, make it work like the Cube
// World toy, and for Woodland Base a big guild square with the camp squares attached, each a piece of her camp map).
// Every spot is its own little room. Each Pokémon lives in its home room and potters about there; now and then one
// walks through to a room that touches its own to visit a neighbour: they meet, chat (bubbles), hop, and the visitor
// wanders home again. Tap one to see its name.
// Layouts: a camp with a map (MAPS below) is a grid of squares cut from that map (guild in the middle, 2x2); any other
// camp is a row of cube rooms you swipe through.
// Sprites are the PMD Explorers-style walk animations from SpriteCollab (by Pokédex number, looked up in the Index).
import { loadIndex } from './effects.js?v=6ae3b1bf';
import { esc } from './util.js?v=6ae3b1bf';

const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/';
const ROW = { down: 0, right: 2, up: 4, left: 6 };
// her Woodland Base map (10-29), cut into squares (re-cut 10-29 so each picture matches its spot's description): [spot key or '' for scenery, picture, row, col, size in cells]
const WB = 'assets/friendzone/woodland_';
export const MAPS = {
  'woodland-base': [['', WB + 'c_tl.jpg', 0, 0], ['acorn-grove', WB + 'acorn.jpg', 0, 1], ['watcher-s-grove', WB + 'watcher.jpg', 0, 2], ['', WB + 'c_tr.jpg', 0, 3],
    ['fernshade-camp', WB + 'fernshade.jpg', 1, 0], ['gravity-falls-guild', WB + 'guild.jpg', 1, 1, 2], ['staff', WB + 'staff.jpg', 1, 3],
    ['mossy-hollow', WB + 'mossy.jpg', 2, 0], ['', WB + 'trail.jpg', 2, 3],
    ['', WB + 'c_bl.jpg', 3, 0], ['hearthstone-circle', WB + 'hearth.jpg', 3, 1], ['mushroom-rest', WB + 'mushroom.jpg', 3, 2], ['', WB + 'c_br.jpg', 3, 3]],
};
const animCache = new Map();
// the Walk animation's frame size and timing for one species (from its AnimData.xml)
function walkData(dex) {
  if (!animCache.has(dex)) animCache.set(dex, fetch(`${RAW}${dex}/AnimData.xml`).then((r) => (r.ok ? r.text() : '')).then((x) => {
    const anims = [...x.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)].map((m) => m[1]);
    const walk = anims.find((a) => /<Name>Walk<\/Name>/.test(a)); if (!walk) return null;
    const num = (tag) => Number((walk.match(new RegExp(`<${tag}>(\\d+)</${tag}>`)) || [])[1]);
    const durs = [...walk.matchAll(/<Duration>(\d+)<\/Duration>/g)].map((m) => Number(m[1]));
    return { w: num('FrameWidth'), h: num('FrameHeight'), n: durs.length || 1, ms: Math.max(300, durs.reduce((s, d) => s + d, 0) * 1000 / 60) };
  }).catch(() => null));
  return animCache.get(dex);
}
// "Bramble the Scolipede" -> Scolipede; "Nidorino" -> Nidorino
function speciesIn(ix, name) {
  const direct = ix.byName.get(String(name).toLowerCase());
  if (direct?.kind === 'Species') return direct;
  const words = String(name).replace(/[^\w\s'-]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) { const e = ix.byName.get(words[i].toLowerCase()); if (e?.kind === 'Species') return e; }
  return null;
}
const SAYS = ['💕', '♪', '❗', '💬', '✨', '😊', '🍎', '💤'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// mount into `box`; cubes = [{ key, name, mons: [{ name, label }] }]; mapId = a MAPS entry to lay the rooms out on
export async function mountFzScene(box, cubes, mapId = '') {
  const ix = await loadIndex(); if (!box.isConnected) return;
  const withMons = async (c) => {
    const mons = [];
    for (const m of c.mons) {
      const e = speciesIn(ix, m.name); const dex = e && (String(e.aka || '').match(/#(\d+)/) || [])[1]; if (!dex) continue;
      const d4 = dex.padStart(4, '0'); const a = await walkData(d4); if (!box.isConnected) return mons; if (a) mons.push({ ...m, d4, a });
      if (mons.length >= (c.max || 5)) break;
    }
    return mons;
  };
  const map = MAPS[mapId]; let rooms; let W; let H; let S;
  if (map) { // a grid of map squares; the cell size fits the screen (min 96px)
    const cell = Math.max(96, Math.min(150, Math.floor((box.clientWidth || 380) / 4))); S = cell < 120 ? 1.5 : 2;
    rooms = [];
    for (const [key, img, r, c, span = 1] of map) {
      const cube = cubes.find((x) => x.key === key);
      rooms.push({ key, name: cube?.name || '', img, x: c * cell, y: r * cell, w: span * cell, h: span * cell, mons: cube ? await withMons(cube) : [] });
      if (!box.isConnected) return;
    }
    W = 4 * cell; H = 4 * cell;
  } else { // a row of cube rooms
    S = 2; rooms = []; let i = 0;
    for (const c of cubes) { const mons = await withMons(c); if (!box.isConnected) return; if (mons.length) rooms.push({ key: c.key, name: c.name, x: i++ * 190, y: 0, w: 186, h: 196, mons }); }
    if (!rooms.length) { box.remove(); return; }
    W = rooms.length * 190; H = 200;
  }
  box.innerHTML = `<div class="fzs-strip ${map ? 'fzs-map' : ''}" style="width:${W}px;height:${H}px">${rooms.map((r) => `<div class="fzs-cube ${r.img ? 'pic' : ''} ${r.name ? 'has-info' : ''}" data-key="${esc(r.key || '')}" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;${r.img ? `background-image:url(${r.img}?v=2)` : ''}">${r.name ? `<span class="fzs-cube-nm">${esc(r.name)}</span>` : ''}</div>`).join('')}</div>`;
  box.classList.add('ready', map ? 'map' : 'row'); box.style.setProperty('--fzh', H + 14 + 'px');
  const strip = box.firstChild;
  // tap a room (not a Pokémon) to open that spot's info (her ask 10-29: the spot boxes live inside their squares)
  strip.addEventListener('click', (e) => { if (e.target.closest('.fzs-mon')) return; const c = e.target.closest('.fzs-cube.has-info'); if (c) box.dispatchEvent(new CustomEvent('fzspot', { detail: c.dataset.key })); });
  const touching = (a, b) => a !== b && ((Math.abs(a.x + a.w - b.x) < 2 || Math.abs(b.x + b.w - a.x) < 2) && a.y < b.y + b.h && b.y < a.y + a.h
    || (Math.abs(a.y + a.h - b.y) < 2 || Math.abs(b.y + b.h - a.y) < 2) && a.x < b.x + b.w && b.x < a.x + a.w);
  const live = rooms.filter((r) => r.mons.length);
  const bots = [];
  rooms.forEach((rm) => rm.mons.forEach((m) => {
    const el = document.createElement('div'); el.className = 'fzs-mon';
    el.innerHTML = `<div class="fzs-spr" style="width:${m.a.w * S}px;height:${m.a.h * S}px;background-image:url(${RAW}${m.d4}/Walk-Anim.png);background-size:${m.a.w * m.a.n * S}px ${m.a.h * 8 * S}px;--fw:${m.a.w * S}px;--n:${m.a.n};--ms:${m.a.ms}ms"></div><span class="fzs-tag">${esc(m.label || m.name)}</span>`;
    strip.appendChild(el);
    const b = { el, spr: el.firstChild, m, home: rm, room: rm, busy: false, w: m.a.w * S, h: m.a.h * S };
    b.spot = (r) => [r.x + 4 + Math.random() * Math.max(2, r.w - b.w - 8), r.y + Math.max(14, r.h * 0.25) + Math.random() * Math.max(2, r.h * 0.75 - b.h - 10)];
    [b.x, b.y] = b.spot(rm);
    const place = (ms = 0) => { el.style.transition = ms ? `left ${ms}ms linear, top ${ms}ms linear` : 'none'; el.style.left = b.x + 'px'; el.style.top = b.y + 'px'; el.style.zIndex = 10 + Math.round(b.y); };
    b.face = (d) => { b.spr.style.backgroundPositionY = `-${ROW[d] * m.a.h * S}px`; };
    b.go = (tx, ty) => new Promise((ok) => { const dx = tx - b.x; const dy = ty - b.y; const ms = Math.max(300, Math.hypot(dx, dy) / 45 * 1000);
      b.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); b.spr.classList.add('walking');
      b.x = tx; b.y = ty; place(ms); setTimeout(() => { b.spr.classList.remove('walking'); b.face('down'); ok(); }, ms); });
    b.say = (t) => { const s = document.createElement('span'); s.className = 'fzs-say'; s.textContent = t; el.appendChild(s); setTimeout(() => s.remove(), 1600); };
    b.hop = () => { el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop'); };
    el.onclick = () => { b.say(SAYS[Math.floor(Math.random() * 3)]); b.hop(); el.classList.add('named'); setTimeout(() => el.classList.remove('named'), 2500); };
    b.face('down'); place(); setTimeout(() => (el.style.opacity = 1), 80 + bots.length * 120);
    bots.push(b);
  }));
  if (!bots.length) { if (!map) box.remove(); return; }
  const rand = (a, z) => a + Math.random() * (z - a);
  const meet = async (b, f) => {
    b.busy = f.busy = true; const side = f.x > b.x ? -1 : 1;
    await b.go(Math.max(b.room.x + 2, Math.min(b.room.x + b.room.w - b.w - 2, f.x + side * 40)), f.y); b.face(side < 0 ? 'right' : 'left'); f.face(side < 0 ? 'left' : 'right');
    const t = SAYS[Math.floor(Math.random() * SAYS.length)]; b.say(t); await wait(500); f.say(Math.random() < 0.5 ? t : '😊'); b.hop(); f.hop();
    await wait(1400); b.face('down'); f.face('down'); f.busy = false;
  };
  const life = async (b) => {
    while (box.isConnected) {
      if (b.busy) { await wait(400); continue; }
      const r = Math.random();
      if (r < 0.5) await b.go(...b.spot(b.room));
      else if (r < 0.68) { // visit a neighbour, Cube World style: walk through to a room touching this one, then back home
        const next = b.room === b.home ? live.filter((x) => touching(x, b.room))[Math.floor(Math.random() * 4)] : b.home;
        if (next) {
          b.busy = true; const cx = Math.max(Math.max(b.room.x, next.x), Math.min(b.room.x + b.room.w, next.x + next.w) - b.w); const cy = Math.max(Math.max(b.room.y, next.y), Math.min(b.room.y + b.room.h, next.y + next.h) - b.h);
          await b.go((cx + Math.min(b.room.x + b.room.w, next.x + next.w) - b.w) / 2, (cy + Math.min(b.room.y + b.room.h, next.y + next.h) - b.h) / 2);
          b.room = next; await b.go(...b.spot(next));
          const f = bots.filter((o) => o.room === next && o !== b && !o.busy)[0];
          if (f && next !== b.home) await meet(b, f); else { b.hop(); b.say('👋'); }
          b.busy = false;
        }
      } else if (r < 0.82) { const f = bots.filter((o) => o.room === b.room && o !== b && !o.busy)[0]; if (f) { b.busy = true; await meet(b, f); b.busy = false; } }
      else { b.hop(); if (Math.random() < 0.4) b.say(SAYS[Math.floor(Math.random() * SAYS.length)]); }
      await wait(rand(900, 2600));
    }
  };
  bots.forEach((b, i) => setTimeout(() => life(b), 600 + i * 300));
}

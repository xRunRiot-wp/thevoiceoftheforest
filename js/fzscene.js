// Friend Zone camp scene (her asks 10-29: see the camp's Pokémon roaming and interacting, make it work like the Cube
// World toy, and for Woodland Base a big guild square with the camp squares attached, each a piece of her camp map).
// Every spot is its own little room. Each Pokémon lives in its home room and potters about there; now and then one
// walks through to a room that touches its own to visit a neighbour: they meet, chat (bubbles), hop, and the visitor
// wanders home again. Tap one to see its name.
// Layouts: a camp with a map (MAPS below) is a grid of squares cut from that map (guild in the middle, 2x2); any other
// camp is a row of cube rooms you swipe through.
// Sprites are the PMD Explorers-style walk animations from SpriteCollab (by Pokédex number, looked up in the Index).
import { loadIndex } from './effects.js?v=6ae3d84a';
import { esc } from './util.js?v=6ae3d84a';

const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/';
const ROW = { down: 0, right: 2, up: 4, left: 6 };
// her Woodland Base map (10-29): [spot key ('' = scenery, 'camp' = the camp itself), picture, row, col, size in cells (or
// [width, height]), name shown on the square if not the spot's own]. The 6 camp spots have pictures made from their
// descriptions; the guild is her treehouse (tap it: ZOOM_PICS shows its cozy inside), a medium square in a band on
// top between two strips of forest; Woodland Base (the canopy) is the big 2x2 square in the middle (swapped at her ask 10-29); the rest is cut from her map at full size
const WB = 'assets/friendzone/woodland_';
export const MAPS = {
  'woodland-base': [['chapter-5-7-8', WB + 'band_l.jpg', 0, 0, [1.25, 1.5]], ['gravity-falls-guild', WB + 'guild.jpg', 0, 1.25, 1.5], ['', WB + 'band_r.jpg', 0, 2.75, [1.25, 1.5]],
    ['chapter-3-4-9', WB + 'c_tl.jpg', 1.5, 0], ['acorn-grove', WB + 'acorn.jpg', 1.5, 1], ['watcher-s-grove', WB + 'watcher.jpg', 1.5, 2], ['', WB + 'c_tr.jpg', 1.5, 3],
    ['fernshade-camp', WB + 'fernshade.jpg', 2.5, 0], ['camp', WB + 'camp.jpg', 2.5, 1, 2, 'Woodland Base'], ['staff', WB + 'staff.jpg', 2.5, 3],
    ['mossy-hollow', WB + 'mossy.jpg', 3.5, 0], ['miltankshake', WB + 'trail.jpg', 3.5, 3, 1, 'Miltankshake'],
    ['chapter-2', WB + 'c_bl.jpg', 4.5, 0], ['hearthstone-circle', WB + 'hearth.jpg', 4.5, 1], ['mushroom-rest', WB + 'mushroom.jpg', 4.5, 2], ['chapter-6', WB + 'c_br.jpg', 4.5, 3]],
};
// a square that zooms in to a different picture than the one on the map
export const ZOOM_PICS = { 'gravity-falls-guild': WB + 'guild_inside.jpg' };
const animCache = new Map();
// her ask 10-29 'can Diglett come out of the ground more often': Diglett and Dugtrio, whose walk is underground
const DIGGERS = new Set(['0050', '0051']);
// the Walk animation's frame size and timing for one species (from its AnimData.xml)
function walkData(dex) {
  if (!animCache.has(dex)) animCache.set(dex, fetch(`${RAW}${dex}/AnimData.xml`).then((r) => (r.ok ? r.text() : '')).then((x) => {
    const anims = [...x.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)].map((m) => m[1]);
    const read = (name) => { const an = anims.find((a) => a.includes(`<Name>${name}</Name>`)); if (!an) return null;
      const num = (tag) => Number((an.match(new RegExp(`<${tag}>(\\d+)</${tag}>`)) || [])[1]);
      const durs = [...an.matchAll(/<Duration>(\d+)<\/Duration>/g)].map((m) => Number(m[1]));
      return { w: num('FrameWidth'), h: num('FrameHeight'), n: durs.length || 1, ms: Math.max(300, durs.reduce((s, d) => s + d, 0) * 1000 / 60), foot: 0 }; };
    const a = read('Walk'); if (!a) return null;
    // a Pokémon that walks underground (Diglett's walk is just a dirt mound) shows its Idle picture, out of the ground, when it stops
    const idle = DIGGERS.has(dex) ? read('Idle') : null;
    return Promise.all([footRoom(dex, a), idle && footRoom(dex, idle, 'Idle')]).then(([f, fi]) => ({ ...a, foot: f, idle: idle && { ...idle, foot: fi } }));
  }).catch(() => null));
  return animCache.get(dex);
}
// empty pixel rows under the feet in the facing-down walk frames (her ask 10-29: name plates sit right under the Pokémon,
// not under its padded frame); 0 if the picture can't be read
function footRoom(dex, a, anim = 'Walk') {
  return new Promise((ok) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onerror = () => ok(0);
    img.onload = () => { try {
      const c = document.createElement('canvas'); c.width = a.w * a.n; c.height = a.h; const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, a.w * a.n, a.h, 0, 0, a.w * a.n, a.h); const d = g.getImageData(0, 0, c.width, c.height).data;
      for (let y = a.h - 1; y >= 0; y--) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) return ok(a.h - 1 - y);
      ok(0); } catch { ok(0); } };
    img.src = `${RAW}${dex}/${anim}-Anim.png`;
  });
}
// "Bramble the Scolipede" -> Scolipede; "Nidorino" -> Nidorino
function speciesIn(ix, name) {
  const direct = ix.byName.get(String(name).toLowerCase());
  if (direct?.kind === 'Species') return direct;
  const words = String(name).replace(/[^\w\s'-]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) { const e = ix.byName.get(words[i].toLowerCase()); if (e?.kind === 'Species') return e; }
  return null;
}
// one Pokémon's walk sprite by species name (her ask 10-29: the player's character joins the nursery walk);
// null if it isn't in the Index or SpriteCollab has no walk for it. face = which way it looks; stand = a digger shows
// its Idle picture (out of the ground) instead of its underground walk.
export async function walkSprite(name, S = 2, face = 'right', stand = false) {
  const ix = await loadIndex(); const e = speciesIn(ix, name); const dex = e && (String(e.aka || '').match(/#(\d+)/) || [])[1]; if (!dex) return null;
  const d4 = dex.padStart(4, '0'); const a = await walkData(d4); if (!a) return null;
  const p = stand && a.idle ? a.idle : a; const file = p === a ? 'Walk' : 'Idle';
  return { a: p, html: `<div class="fzs-spr" style="width:${p.w * S}px;height:${p.h * S}px;background-image:url(${RAW}${d4}/${file}-Anim.png);background-size:${p.w * p.n * S}px ${p.h * 8 * S}px;--fw:${p.w * S}px;--n:${p.n};--ms:${p.ms}ms;background-position-y:-${ROW[face] * p.h * S}px;margin-bottom:-${p.foot * S}px"></div>` };
}
const SAYS = ['💕', '♪', '❗', '💬', '✨', '😊', '🍎', '💤'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// mount into `box`; cubes = [{ key, name, mons: [{ name, label }] }]; mapId = a MAPS entry to lay the rooms out on;
// solo = a picture: one big room of that picture (the zoomed-in square) holding cubes[0]'s Pokémon
export async function mountFzScene(box, cubes, mapId = '', solo = '') {
  const ix = await loadIndex(); if (!box.isConnected) return;
  const withMons = async (c) => {
    const mons = [];
    for (const m of c.mons) {
      const e = speciesIn(ix, m.name); const dex = m.dex || (e && (String(e.aka || '').match(/#(\d+)/) || [])[1]); if (!dex) continue;   // m.dex: a Pokémon missing from the Index (Maushold)
      const d4 = dex.padStart(4, '0'); const a = await walkData(d4); if (!box.isConnected) return mons; if (a) mons.push({ ...m, d4, a });
      if (mons.length >= (c.max || 5)) break;
    }
    return mons;
  };
  const map = MAPS[mapId]; let rooms; let W; let H; let S;
  if (solo) { // one big square, the width of the box
    const size = box.clientWidth || 340; S = size >= 600 ? 2.5 : size >= 330 ? 2 : 1.5; W = size; H = size;   // her ask 10-29: smaller sprites in the zoomed-in window
    rooms = [{ key: cubes[0].key, name: '', img: solo, x: 0, y: 0, w: size, h: size, mons: await withMons(cubes[0]) }];
    if (!box.isConnected) return;
  } else if (map) { // a grid of map squares; the cell size fits the screen (min 96px, up to 270px so it fills a computer screen too)
    const cell = Math.max(96, Math.min(270, Math.floor(((box.clientWidth || 380) - 4) / 4))); S = cell < 120 ? 1.5 : 2;
    rooms = [];
    for (const [key, img, r, c, span = 1, label] of map) {
      const cube = cubes.find((x) => x.key === key); const [sw, sh] = Array.isArray(span) ? span : [span, span];
      rooms.push({ key, name: label || cube?.name || '', img, locked: !!cube?.locked, x: Math.round(c * cell), y: Math.round(r * cell), w: Math.round(sw * cell), h: Math.round(sh * cell), mons: cube ? await withMons(cube) : [] });
      if (!box.isConnected) return;
    }
    W = 4 * cell; H = Math.max(...rooms.map((x) => x.y + x.h));
  } else { // a row of cube rooms
    S = 2; rooms = []; let i = 0;
    for (const c of cubes) { const mons = await withMons(c); if (!box.isConnected) return; if (mons.length) rooms.push({ key: c.key, name: c.name, x: i++ * 190, y: 0, w: 186, h: 196, mons }); }
    if (!rooms.length) { box.remove(); return; }
    W = rooms.length * 190; H = 200;
  }
  box.innerHTML = `<div class="fzs-strip ${map ? 'fzs-map' : ''}" style="width:${W}px;height:${H}px">${rooms.map((r) => `<div class="fzs-cube ${r.img ? 'pic' : ''} ${r.name ? 'has-info' : ''} ${r.locked ? 'locked' : ''}" data-key="${esc(r.key || '')}" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;${r.img ? `background-image:url(${r.img}?v=4)` : ''}">${r.locked ? '<span class="fzs-lock">🔒</span>' : ''}${r.name ? `<span class="fzs-cube-nm${!/\s/.test(r.name) && r.name.length > 9 ? ' nm-long' : ''}">${r.locked ? '🔒 ' : ''}${esc(r.name)}</span>` : ''}</div>`).join('')}</div>`;
  box.classList.add('ready', solo ? 'solo' : map ? 'map' : 'row'); box.style.setProperty('--fzh', H + 14 + 'px');
  const strip = box.firstChild;
  // tap a room (not a Pokémon) to open that spot's info (her ask 10-29: the spot boxes live inside their squares)
  strip.addEventListener('click', (e) => { if (e.target.closest('.fzs-mon')) return; const c = e.target.closest('.fzs-cube.has-info'); if (c) box.dispatchEvent(new CustomEvent('fzspot', { detail: c.dataset.key })); });
  const touching = (a, b) => a !== b && ((Math.abs(a.x + a.w - b.x) < 2 || Math.abs(b.x + b.w - a.x) < 2) && a.y < b.y + b.h && b.y < a.y + a.h
    || (Math.abs(a.y + a.h - b.y) < 2 || Math.abs(b.y + b.h - a.y) < 2) && a.x < b.x + b.w && b.x < a.x + a.w);
  const live = rooms.filter((r) => r.mons.length);
  const bots = [];
  rooms.forEach((rm) => rm.mons.forEach((m) => {
    const el = document.createElement('div'); el.className = 'fzs-mon';
    el.innerHTML = `<div class="fzs-spr" style="width:${m.a.w * S}px;height:${m.a.h * S}px;background-image:url(${RAW}${m.d4}/Walk-Anim.png);background-size:${m.a.w * m.a.n * S}px ${m.a.h * 8 * S}px;--fw:${m.a.w * S}px;--n:${m.a.n};--ms:${m.a.ms}ms"></div><span class="fzs-tag" style="margin-top:${-Math.round(m.a.foot * S) - 2}px">${esc(m.label || m.name)}</span>`;
    strip.appendChild(el);
    const b = { el, spr: el.firstChild, m, home: rm, room: rm, busy: false, w: m.a.w * S, h: m.a.h * S };
    b.spot = (r) => [r.x + 4 + Math.random() * Math.max(2, r.w - b.w - 8), r.y + Math.max(14, r.h * 0.25) + Math.random() * Math.max(2, r.h * 0.75 - b.h - 24)];
    [b.x, b.y] = b.spot(rm);
    const place = (ms = 0) => { el.style.transition = ms ? `left ${ms}ms linear, top ${ms}ms linear` : 'none'; el.style.left = b.x + 'px'; el.style.top = b.y + 'px'; el.style.zIndex = 10 + Math.round(b.y); };
    // which picture sheet the sprite shows: its walk, or (a digger standing still) its idle, out of the ground. The idle box is
    // padded so its feet land where the walk's feet were and the whole box keeps the walk's height
    b.sheet = (out) => { const a = out && m.a.idle ? m.a.idle : m.a; const st = b.spr.style; b.cur = a;
      st.width = a.w * S + 'px'; st.height = a.h * S + 'px'; st.backgroundImage = `url(${RAW}${m.d4}/${a === m.a ? 'Walk' : 'Idle'}-Anim.png)`;
      st.backgroundSize = `${a.w * a.n * S}px ${a.h * 8 * S}px`; st.setProperty('--fw', a.w * S + 'px'); st.setProperty('--n', a.n); st.setProperty('--ms', a.ms + 'ms');
      st.marginTop = a === m.a ? '0' : ((m.a.h - m.a.foot) - (a.h - a.foot)) * S + 'px'; st.marginBottom = a === m.a ? '0' : (m.a.foot - a.foot) * S + 'px';
      b.spr.classList.toggle('idling', a !== m.a); };
    b.face = (d) => { b.spr.style.backgroundPositionY = `-${ROW[d] * (b.cur || m.a).h * S}px`; };
    b.go = (tx, ty) => new Promise((ok) => { const dx = tx - b.x; const dy = ty - b.y; const ms = Math.max(300, Math.hypot(dx, dy) / 45 * 1000);
      if (m.a.idle) b.sheet(false); b.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); b.spr.classList.add('walking');
      b.x = tx; b.y = ty; place(ms); setTimeout(() => { b.spr.classList.remove('walking'); if (m.a.idle) { b.sheet(true); b.hop(); } b.face('down'); ok(); }, ms); });
    b.say = (t) => { const s = document.createElement('span'); s.className = 'fzs-say'; s.textContent = t; el.appendChild(s); setTimeout(() => s.remove(), 1600); };
    b.vanish = () => new Promise((ok) => { el.animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.3 }], { duration: 280, easing: 'ease-in' }); setTimeout(() => { el.style.opacity = 0; ok(); }, 260); });
    b.pop = () => new Promise((ok) => { place(); el.style.opacity = 1; el.animate([{ opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1.2, offset: 0.7 }, { opacity: 1, scale: 1 }], { duration: 340, easing: 'ease-out' }); setTimeout(ok, 420); });
    b.hop = () => { el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop'); };
    el.onclick = () => { b.say(SAYS[Math.floor(Math.random() * 3)]); b.hop(); el.classList.add('named'); setTimeout(() => el.classList.remove('named'), 2500); };
    if (m.a.idle) b.sheet(true); b.face('down'); place(); setTimeout(() => (el.style.opacity = 1), 80 + bots.length * 120);
    bots.push(b);
  }));
  if (!bots.length) { if (!map && !solo) box.remove(); return; }
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
      // her ask 10-29: guild lockdown (the GM's button; the page sets data-alert on the scene): everyone pops back to their home
      // square, the one they sleep in, and stands ready to fight there instead of wandering
      if (box.dataset.alert === '1') {
        b.el.classList.add('ready');
        if (b.room !== b.home) { b.busy = true; await b.vanish(); b.room = b.home; [b.x, b.y] = b.spot(b.home); await b.pop(); b.busy = false; }
        else if (Math.random() < 0.3) { b.hop(); b.say(Math.random() < 0.5 ? '⚔️' : '❗'); }
        await wait(rand(1200, 2600)); continue;
      }
      b.el.classList.remove('ready');
      const r = Math.random();
      if (r < 0.5) await b.go(...b.spot(b.room));
      else if (r < 0.68 && !b.m.stay) { // visit a neighbour, Cube World style (a Pokémon marked stay never leaves its square): walk through to a room touching this one, then back home
        // her ask 10-29 'more foot traffic in the base where the canopy is': a neighbour next to the Woodland Base square goes there half the time
        const near = live.filter((x) => touching(x, b.room)); const base = near.find((x) => x.key === 'camp');
        const next = b.room === b.home ? (base && Math.random() < 0.5 ? base : near[Math.floor(Math.random() * 4)]) : b.home;
        if (next) {
          // her ask 10-29: no walking across the border; they vanish at the edge of their square and pop up just inside the next one
          b.busy = true; const cx = Math.max(Math.max(b.room.x, next.x), Math.min(b.room.x + b.room.w, next.x + next.w) - b.w); const cy = Math.max(Math.max(b.room.y, next.y), Math.min(b.room.y + b.room.h, next.y + next.h) - b.h);
          const mx = (cx + Math.min(b.room.x + b.room.w, next.x + next.w) - b.w) / 2; const my = (cy + Math.min(b.room.y + b.room.h, next.y + next.h) - b.h) / 2;
          const inside = (r, gap) => [Math.max(r.x + 4, Math.min(r.x + r.w - b.w - 4, mx + Math.sign(r.x + r.w / 2 - mx - b.w / 2) * gap * (Math.abs(next.x - b.room.x) > 2))),
            Math.max(r.y + 14, Math.min(r.y + r.h - b.h - 4, my + Math.sign(r.y + r.h / 2 - my - b.h / 2) * gap * (Math.abs(next.y - b.room.y) > 2)))];
          await b.go(...inside(b.room, b.w * 0.6)); await b.vanish();
          b.room = next; [b.x, b.y] = inside(next, b.w * 0.6); await b.pop(); await b.go(...b.spot(next));
          const f = bots.filter((o) => o.room === next && o !== b && !o.busy)[0];
          if (f && next !== b.home) await meet(b, f); else { b.hop(); b.say('👋'); }
          b.busy = false;
        }
      } else if (r < 0.82) { const f = bots.filter((o) => o.room === b.room && o !== b && !o.busy)[0]; if (f) { b.busy = true; await meet(b, f); b.busy = false; } }
      else { b.hop(); if (Math.random() < 0.4) b.say(SAYS[Math.floor(Math.random() * SAYS.length)]); }
      await wait(b.m.a.idle ? rand(2500, 5500) : rand(900, 2600)); // diggers stay out of the ground longer between moves
    }
  };
  bots.forEach((b, i) => setTimeout(() => life(b), 600 + i * 300));
}

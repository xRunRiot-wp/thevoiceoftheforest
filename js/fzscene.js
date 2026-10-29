// Friend Zone camp scene (her asks 10-29: see the camp's Pokémon roaming and interacting, and make it work like the
// Cube World toy). Every spot in the camp is its own little cube room, set side by side and joined by doorways. Each
// Pokémon lives in its home cube and potters about there; now and then one walks through the doorway next door to
// visit a neighbour: they meet, chat (bubbles), hop, and the visitor wanders home again. Tap one to see its name.
// Sprites are the PMD Explorers-style walk animations from SpriteCollab (by Pokédex number, looked up in the Index).
import { loadIndex } from './effects.js?v=6ae3ad70';
import { esc } from './util.js?v=6ae3ad70';

const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/';
const ROW = { down: 0, right: 2, up: 4, left: 6 };
const S = 2; // drawn at 2x
const CW = 190; // one cube's width
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

// mount into `box`; cubes = [{ name, mons: [{ name, label }] }]
export async function mountFzScene(box, cubes) {
  const ix = await loadIndex(); if (!box.isConnected) return;
  const rooms = [];
  for (const c of cubes) {
    const mons = [];
    for (const m of c.mons) {
      const e = speciesIn(ix, m.name); const dex = e && (String(e.aka || '').match(/#(\d+)/) || [])[1]; if (!dex) continue;
      const d4 = dex.padStart(4, '0'); const a = await walkData(d4); if (!box.isConnected) return; if (a) mons.push({ ...m, d4, a });
      if (mons.length >= 5) break;
    }
    if (mons.length) rooms.push({ name: c.name, mons });
  }
  if (!rooms.length) { box.remove(); return; }
  box.innerHTML = `<div class="fzs-strip" style="width:${rooms.length * CW}px">${rooms.map((r, i) => `<div class="fzs-cube" style="left:${i * CW}px"><span class="fzs-cube-nm">${esc(r.name)}</span>${i < rooms.length - 1 ? '<span class="fzs-door"></span>' : ''}</div>`).join('')}</div>`;
  box.classList.add('ready');
  const strip = box.firstChild; const H = 200;
  const bots = [];
  rooms.forEach((r, ri) => r.mons.forEach((m) => {
    const el = document.createElement('div'); el.className = 'fzs-mon';
    el.innerHTML = `<div class="fzs-spr" style="width:${m.a.w * S}px;height:${m.a.h * S}px;background-image:url(${RAW}${m.d4}/Walk-Anim.png);background-size:${m.a.w * m.a.n * S}px ${m.a.h * 8 * S}px;--fw:${m.a.w * S}px;--n:${m.a.n};--ms:${m.a.ms}ms"></div><span class="fzs-tag">${esc(m.label || m.name)}</span>`;
    strip.appendChild(el);
    const b = { el, spr: el.firstChild, m, home: ri, room: ri, busy: false, w: m.a.w * S };
    b.lo = (room) => room * CW + 6; b.hi = (room) => (room + 1) * CW - b.w - 6;
    b.x = b.lo(ri) + Math.random() * Math.max(4, b.hi(ri) - b.lo(ri)); b.y = 60 + Math.random() * (H - 140);
    const place = (ms = 0) => { el.style.transition = ms ? `left ${ms}ms linear, top ${ms}ms linear` : 'none'; el.style.left = b.x + 'px'; el.style.top = b.y + 'px'; el.style.zIndex = Math.round(b.y); };
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
  const rand = (a, z) => a + Math.random() * (z - a);
  const inRoom = (room) => bots.filter((o) => o.room === room);
  const ry = () => rand(56, H - 84);
  const meet = async (b, f) => {
    b.busy = f.busy = true; const side = f.x > b.x ? -1 : 1;
    await b.go(Math.max(b.lo(f.room), Math.min(b.hi(f.room), f.x + side * 40)), f.y); b.face(side < 0 ? 'right' : 'left'); f.face(side < 0 ? 'left' : 'right');
    const t = SAYS[Math.floor(Math.random() * SAYS.length)]; b.say(t); await wait(500); f.say(Math.random() < 0.5 ? t : '😊'); b.hop(); f.hop();
    await wait(1400); b.face('down'); f.face('down'); f.busy = false;
  };
  const life = async (b) => {
    while (box.isConnected) {
      if (b.busy) { await wait(400); continue; }
      const r = Math.random();
      if (r < 0.5) await b.go(rand(b.lo(b.room), b.hi(b.room)), ry());
      else if (r < 0.68) { // visit next door, Cube World style: through the doorway into a neighbour's cube
        const next = b.room === b.home ? b.home + (Math.random() < 0.5 ? -1 : 1) : b.home;
        if (next >= 0 && next < rooms.length) {
          b.busy = true; const doorX = next > b.room ? (b.room + 1) * CW - b.w / 2 : b.room * CW - b.w / 2;
          await b.go(doorX, H - 96); b.room = next; await b.go(rand(b.lo(next), b.hi(next)), ry());
          const f = inRoom(next).filter((o) => o !== b && !o.busy)[0];
          if (f && next !== b.home) await meet(b, f); else { b.hop(); b.say('👋'); }
          b.busy = false;
        }
      } else if (r < 0.82) { const f = inRoom(b.room).filter((o) => o !== b && !o.busy)[0]; if (f) { b.busy = true; await meet(b, f); b.busy = false; } }
      else { b.hop(); if (Math.random() < 0.4) b.say(SAYS[Math.floor(Math.random() * SAYS.length)]); }
      await wait(rand(900, 2600));
    }
  };
  bots.forEach((b, i) => setTimeout(() => life(b), 600 + i * 300));
}

// Friend Zone camp scene (her ask 10-29): the Pokémon who live at a camp roam a little meadow and play together.
// Sprites are the PMD Explorers-style walk animations from SpriteCollab (by Pokédex number, looked up in the Index),
// loaded straight from the repository. Each one wanders, faces where it walks, and now and then two of them meet up:
// hearts, a hop, a little chat bubble. Tap one to see its name.
import { loadIndex } from './effects.js?v=6ae3acfa';
import { esc } from './util.js?v=6ae3acfa';

const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/';
const ROW = { down: 0, right: 2, up: 4, left: 6 };
const S = 2; // drawn at 2x
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

// mount the scene into `box`; mons = [{ name, label }]
export async function mountFzScene(box, mons) {
  const ix = await loadIndex(); if (!box.isConnected) return;
  const list = [];
  for (const m of mons) {
    const e = speciesIn(ix, m.name); const dex = e && (String(e.aka || '').match(/#(\d+)/) || [])[1]; if (!dex) continue;
    const d4 = dex.padStart(4, '0'); const a = await walkData(d4); if (!a || !box.isConnected) continue;
    list.push({ ...m, d4, a });
    if (list.length >= 12) break;
  }
  if (!list.length) { box.remove(); return; }
  box.classList.add('ready');
  const W = () => box.clientWidth; const H = () => box.clientHeight;
  const bots = list.map((m, i) => {
    const el = document.createElement('div'); el.className = 'fzs-mon';
    el.innerHTML = `<div class="fzs-spr" style="width:${m.a.w * S}px;height:${m.a.h * S}px;background-image:url(${RAW}${m.d4}/Walk-Anim.png);background-size:${m.a.w * m.a.n * S}px ${m.a.h * 8 * S}px;--fw:${m.a.w * S}px;--n:${m.a.n};--ms:${m.a.ms}ms"></div><span class="fzs-tag">${esc(m.label || m.name)}</span>`;
    box.appendChild(el);
    const b = { el, spr: el.firstChild, m, x: 20 + Math.random() * Math.max(10, W() - 80), y: 30 + Math.random() * Math.max(10, H() - 90), busy: false };
    const place = (ms = 0) => { el.style.transition = ms ? `left ${ms}ms linear, top ${ms}ms linear` : 'none'; el.style.left = b.x + 'px'; el.style.top = b.y + 'px'; el.style.zIndex = Math.round(b.y); };
    b.face = (d) => { b.spr.style.backgroundPositionY = `-${ROW[d] * m.a.h * S}px`; };
    b.go = (tx, ty) => new Promise((ok) => { const dx = tx - b.x; const dy = ty - b.y; const dist = Math.hypot(dx, dy); const ms = Math.max(300, dist / 40 * 1000);
      b.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); b.spr.classList.add('walking');
      b.x = tx; b.y = ty; place(ms); setTimeout(() => { b.spr.classList.remove('walking'); b.face('down'); ok(); }, ms); });
    b.say = (t) => { const s = document.createElement('span'); s.className = 'fzs-say'; s.textContent = t; el.appendChild(s); setTimeout(() => s.remove(), 1600); };
    b.hop = () => { el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop'); };
    el.onclick = () => { b.say(SAYS[Math.floor(Math.random() * 3)]); b.hop(); el.classList.add('named'); setTimeout(() => el.classList.remove('named'), 2500); };
    b.face('down'); place(); setTimeout(() => (el.style.opacity = 1), 50 + i * 120);
    return b;
  });
  const rand = (a, z) => a + Math.random() * (z - a);
  const clampX = (x) => Math.max(4, Math.min(W() - 60, x)); const clampY = (y) => Math.max(20, Math.min(H() - 70, y));
  // each Pokémon's own little life: wander, pause, sometimes visit a friend
  const life = async (b) => {
    while (box.isConnected) {
      if (b.busy) { await new Promise((r) => setTimeout(r, 400)); continue; }
      const r = Math.random();
      if (r < 0.55) await b.go(clampX(b.x + rand(-140, 140)), clampY(b.y + rand(-50, 50)));
      else if (r < 0.75 && bots.length > 1) {
        const f = bots.filter((o) => o !== b && !o.busy)[Math.floor(Math.random() * (bots.length - 1))];
        if (f) { b.busy = f.busy = true; const side = f.x > b.x ? -1 : 1;
          await b.go(clampX(f.x + side * 44), clampY(f.y)); b.face(side < 0 ? 'right' : 'left'); f.face(side < 0 ? 'left' : 'right');
          const t = SAYS[Math.floor(Math.random() * SAYS.length)]; b.say(t); await new Promise((x) => setTimeout(x, 500)); f.say(Math.random() < 0.5 ? t : '😊'); b.hop(); f.hop();
          await new Promise((x) => setTimeout(x, 1400)); b.face('down'); f.face('down'); b.busy = f.busy = false; }
      } else if (r < 0.85) { b.hop(); if (Math.random() < 0.4) b.say(SAYS[Math.floor(Math.random() * SAYS.length)]); }
      await new Promise((x) => setTimeout(x, rand(900, 2600)));
    }
  };
  bots.forEach((b, i) => setTimeout(() => life(b), 600 + i * 300));
}

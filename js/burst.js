// Mission complete burst: when a mission's progress bar fills, a big explosion of something from that area
// (leaves for Woodland Base, shells for Sunshell Beach...). Plays once per device per mission; tap the full bar to replay.
// Imported by play.js and guild.js; app start needs nothing else.
import * as store from './store.js?v=6ae15ecb';

const AREAS = [
  [/woodland/i, ['🍃', '🍂', '🌿', '🍁', '🍃']],
  [/sunshell|beach/i, ['🐚', '🌊', '🫧', '⭐', '🐚']],
  [/mooncliff|mountain/i, ['🌙', '⭐', '✨', '🪨', '🌟']],
  [/echo cavern|cave/i, ['💎', '🦇', '🕯️', '✨', '💎']],
  [/crystal lake|lake/i, ['💧', '💎', '🫧', '💧', '✨']],
  [/blossom|meadow/i, ['🌸', '🌼', '🌷', '🌸', '🌺']],
  [/ancient ruins|ruins/i, ['🏺', '✨', '🪨', '📜', '🌟']],
  [/twilight falls/i, ['🌙', '💧', '✨', '🌌', '⭐']],
  [/whispering falls|falls/i, ['💧', '🌈', '🫧', '💧', '✨']],
];
const DEFAULT = ['🍃', '✨', '🌿', '🌟'];

// The area comes from the mission's "Where", else its title, else where its jobs happen (first match wins)
export function burstSet(m, parts = []) {
  const texts = [m?.place, m?.title, ...parts.map((p) => p.place), ...parts.map((p) => p.title)].filter(Boolean);
  for (const t of texts) { const hit = AREAS.find(([re]) => re.test(t)); if (hit) return hit[1]; }
  return DEFAULT;
}

export function burst(anchor, set) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // the page may have re-rendered since: use the bar that is on screen now
  if (!anchor.isConnected) anchor = document.querySelector(`.mb-bar[data-key="${CSS.escape(anchor.dataset.key || '')}"]`);
  if (!anchor) return;
  const r = anchor.getBoundingClientRect();
  const layer = document.createElement('div'); layer.className = 'mburst';
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('span');
    const x = r.left + Math.random() * r.width; const y = r.top + r.height / 2;
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7; const dist = 70 + Math.random() * 230;
    p.textContent = set[i % set.length];
    p.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist}px;--fall:${200 + Math.random() * 220}px;--rot:${(Math.random() - 0.5) * 900}deg;--s:${0.8 + Math.random() * 1.1};animation-delay:${Math.random() * 0.25}s;animation-duration:${1.9 + Math.random() * 1.1}s`;
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  anchor.classList.add('mb-flash'); setTimeout(() => anchor.classList.remove('mb-flash'), 1200);
  setTimeout(() => layer.remove(), 3600);
}

// Watches every page (Play banner, Guild + GM mission cards): fire once for a newly full bar, tap a full bar to replay
function checkBursts(root) {
  root.querySelectorAll('.mb-bar[data-burst]:not([data-bound])').forEach((bar) => {
    bar.dataset.bound = '1';
    const set = JSON.parse(bar.dataset.burst);
    bar.onclick = () => burst(bar, set);
    const key = 'dc.burst.' + store.tableCode() + '.' + bar.dataset.key;
    let seen = false; try { seen = !!localStorage.getItem(key); localStorage.setItem(key, '1'); } catch { /* ignore */ }
    if (!seen) setTimeout(() => burst(bar, set), 350);
  });
}
let queued = false;
new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; checkBursts(document); }); })
  .observe(document.body, { childList: true, subtree: true });

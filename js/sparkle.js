// Winner's sparkle: anyone who wins something in a Guild game gets a sparkly cursor for a day.
// Saved per character (sparkle/<id> = until); shown on whatever device is playing that character, mouse only.
import * as store from './store.js?v=6ae167f1';

const DAY = 24 * 3600e3;
const MARKS = ['✦', '✧', '⋆', '✨'];
const COLORS = ['#ffd75e', '#fff3b0', '#ff9ad5', '#9ee7ff'];
let on = false;
let last = 0;

export function markWinner(id) { if (id) store.set('sparkle/' + id, Date.now() + DAY); }
export const sparkleUntil = (id) => Number(store.get('sparkle/' + id) || 0);

function trail(e) {
  const now = performance.now(); if (now - last < 40) return; last = now;
  const s = document.createElement('i');
  s.className = 'spark'; s.textContent = MARKS[Math.floor(Math.random() * MARKS.length)];
  s.style.left = `${e.clientX + 6 + Math.random() * 20}px`; s.style.top = `${e.clientY + 6 + Math.random() * 20}px`;
  s.style.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  s.style.setProperty('--dx', `${Math.random() * 24 - 12}px`);
  document.body.appendChild(s); setTimeout(() => s.remove(), 900);
}

export function updateSparkle(id) {
  const want = sparkleUntil(id) > Date.now() && matchMedia('(pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.toggle('sparkly', want);
  if (want && !on) { on = true; addEventListener('pointermove', trail, { passive: true }); }
  if (!want && on) { on = false; removeEventListener('pointermove', trail); }
}

// The site's cursor (chosen in Settings, per device): 'diglett' (default), 'pokeball' or 'regular' (the computer's own).
// Diglett / Poké Ball = a pixel arrow (css) with a little buddy following just under it. Diglett idles with its two
// game frames and ducks into its hole every 12-25 s; the Poké Ball wobbles like a capture and flashes its button.
// Mouse only; phones and touch screens never see it.
// Reward cursors (her ask 10-27: Time Gear for Nimbi and Magnemite) only show for characters given them (party/<id>/cursors;
// theme.js sets window.cursorAllowed).
export const CURSORS = { diglett: '⛏️ Diglett', pokeball: '🔴 Poké Ball', regular: '🖱️ Regular', timegear: '⚙️ Time Gear' };
export const REWARD_CURSORS = { timegear: 'Time Gear cursor' };
const allowed = (k) => !REWARD_CURSORS[k] || !window.cursorAllowed || window.cursorAllowed.has(k);
export const cursorKind = () => { try { const k = localStorage.getItem('dc.cursor'); return CURSORS[k] && allowed(k) ? k : 'diglett'; } catch { return 'diglett'; } };
export const cursorChoices = () => Object.keys(CURSORS).filter(allowed);
let el = null;

function act() {
  if (el && !document.hidden && cursorKind() !== 'regular') { el.classList.remove('act'); void el.offsetWidth; el.classList.add('act'); }
  setTimeout(act, 12000 + Math.random() * 13000);
}
function apply() {
  const k = cursorKind();
  document.body.dataset.cursor = k;
  if (el) el.className = `digcur ${k}` + (el.classList.contains('show') ? ' show' : '');
}
export function setCursorKind(k) { try { localStorage.setItem('dc.cursor', k); } catch { /* ignore */ } apply(); }
export const refreshCursor = () => apply();

export function startDigCursor() {
  if (el) return;
  document.body.dataset.cursor = cursorKind();
  if (!matchMedia('(pointer: fine)').matches) return;
  el = document.createElement('div'); el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el); apply();
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    el.style.transform = `translate(${e.clientX + 2}px, ${e.clientY + 14}px)`; el.classList.add('show');
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => el.classList.remove('show'));
  el.addEventListener('animationend', (e) => { if (/^(dig-down|pb-wobble|tg-turn)$/.test(e.animationName)) el.classList.remove('act'); });
  setTimeout(act, 8000 + Math.random() * 8000);
}

// Dramatic letters (her ask 10-27). Sending a gift: a letter as big as the page slides into its envelope, the flap closes,
// a wax seal stamps it and it flies away. Receiving one: a sealed letter swoops in across the screen and dives into the
// mailbox, which bounces. Tap anywhere to skip. Arrivals are noticed from the gift notes in giftmail/<me>; each note
// plays once per device (dc.lfx.seen).
import * as store from './store.js?v=6ae3dd8a';
import { ensureAudio, mailChime } from './chiptune.js?v=6ae3dd8a';
import { esc, num } from './util.js?v=6ae3dd8a';

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// her ask 10-29: the wax seal carries the sender's guild crest (Woodland Base or Vanguard Guild), bigger
const guildOf = (name) => { const P = store.get('party') || {}; const c = name ? Object.values(P).find((x) => x && x.nickname === name) : P[meId()]; return c?.guild === 'vanguard' ? 'vanguard' : 'woodland'; };
const envHTML = (open, paper, guild = 'woodland') => `<div class="lfx-env ${open ? 'open' : ''}">
  <div class="lfx-back"></div>${paper ? `<div class="lfx-paper">${paper}</div>` : ''}<div class="lfx-pocket"></div><div class="lfx-flap"></div><div class="lfx-seal"><img src="assets/badges/${guild}.png" alt=""></div></div>`;
function overlay(html) {
  const el = document.createElement('div'); el.className = 'lfx'; el.innerHTML = html; document.body.appendChild(el);
  return el;
}

// the sender's side: letter -> envelope -> seal -> away
export function sendFx(toName, what, note) {
  if (reduce()) return;
  const el = overlay(`<div class="lfx-stage">${envHTML(true, `<div class="lfx-to">To <b>${esc(toName)}</b>,</div><div class="lfx-what">${esc(what)}</div>${note ? `<div class="lfx-note">“${esc(note)}”</div>` : ''}<div class="lfx-sign">Sent by Pelipper Post</div>`, guildOf())}</div><div class="lfx-cap">Sealing your letter…</div>`);
  const env = el.querySelector('.lfx-env');
  const done = () => el.remove();
  el.onclick = done;
  setTimeout(() => env.classList.add('in'), 700);          // the letter slides down into the envelope
  setTimeout(() => env.classList.remove('open'), 1500);    // the flap closes
  setTimeout(() => env.classList.add('sealed'), 2050);     // the wax seal stamps down
  setTimeout(() => { el.querySelector('.lfx-cap').textContent = `Off to ${toName}!`; env.classList.add('away'); }, 2700);
  setTimeout(done, 3600);
}

// the receiver's side: a sealed letter flies across the screen into the mailbox
let queue = []; let playing = false;
export function arriveFx(from) {
  queue.push(from); if (!playing) next();
}
function next() {
  const from = queue.shift(); if (from === undefined) { playing = false; return; }
  playing = true;
  const box = document.querySelector('#hbmail');
  if (reduce() || !box) { mailChime(); bounce(box); next(); return; }
  mailChime(); // her ask 10-29: a chime when new mail arrives
  const el = overlay(`<div class="lfx-fly">${envHTML(false, '', guildOf(from))}</div><div class="lfx-cap">📬 A letter from <b>${esc(from)}</b>!</div>`);
  el.classList.add('arrive'); el.querySelector('.lfx-env').classList.add('sealed');
  const fly = el.querySelector('.lfx-fly');
  const r = box.getBoundingClientRect(); const W = innerWidth; const H = innerHeight;
  const w = Math.min(W * 0.8, 640); fly.style.width = w + 'px'; fly.style.marginLeft = -w / 2 + 'px'; fly.style.marginTop = -w / 3 + 'px';
  const tx = r.left + r.width / 2 - W / 2; const ty = r.top + r.height / 2 - H / 2; const end = 24 / w;
  const a = fly.animate([
    { transform: `translate(${-W * 0.9}px, ${H * 0.35}px) rotate(-35deg) scale(.5)`, opacity: 0 },
    { transform: `translate(${-W * 0.25}px, ${-H * 0.05}px) rotate(-10deg) scale(1)`, opacity: 1, offset: 0.3 },
    { transform: 'translate(0, 0) rotate(4deg) scale(1.05)', offset: 0.5 },
    { transform: `translate(${tx * 0.6}px, ${ty * 0.4 - 60}px) rotate(320deg) scale(.45)`, offset: 0.8 },
    { transform: `translate(${tx}px, ${ty}px) rotate(720deg) scale(${end})`, opacity: 0.9 },
  ], { duration: 2400, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' });
  const finish = () => { el.remove(); bounce(document.querySelector('#hbmail')); setTimeout(next, 500); };
  a.onfinish = finish; el.onclick = () => { a.cancel(); finish(); };
}
function bounce(b) { if (!b) return; b.classList.remove('lfx-got'); void b.offsetWidth; b.classList.add('lfx-got'); setTimeout(() => b.classList.remove('lfx-got'), 1300); }

// watch for new gift notes for whoever is playing on this device
const meId = () => { try { return localStorage.getItem('dc.me.' + store.tableCode()) || ''; } catch { return ''; } };
const seenKey = () => 'dc.lfx.seen.' + store.tableCode();
const loadSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(seenKey()) || '[]')); } catch { return new Set(); } };
const saveSeen = (s) => { try { localStorage.setItem(seenKey(), JSON.stringify([...s].slice(-200))); } catch { /* ignore */ } };
export function startLetterWatch() {
  const seen = loadSeen();
  const check = () => {
    const id = meId(); if (!id) return;
    const notes = Object.entries(store.get('giftmail/' + id) || {}).filter(([k, n]) => n && n.title && !seen.has(k));
    if (!notes.length) return;
    // only fresh, unread notes (last 10 minutes) fly in; older ones are just marked so there's never a flood of letters
    for (const [k, n] of notes.sort((x, y) => num(x[1].t) - num(y[1].t))) {
      seen.add(k);
      if (!n.read && Date.now() - num(n.t) < 10 * 60e3) arriveFx((n.title.match(/from (.+)$/) || [])[1] || 'the GM');
    }
    saveSeen(seen);
  };
  store.subscribe(check); setTimeout(check, 1500);
}

// "What's new" tutorial (her ask 10-29): a short step-by-step tour of everything added since the 27th.
// Opens by itself once for players who haven't been on since then (no visit on or after Oct 28), always
// has a Skip button, and can be replayed any time from Settings. Seen = tourSeen/<id> on the shared table.
import * as store from './store.js?v=6ae3cc0c';
import { $ } from './util.js?v=6ae3cc0c';
import { modal, closeModal } from './ui.js?v=6ae3cc0c';

const SINCE = new Date(2026, 9, 28).getTime();   // first visit after the 27th counts as "has seen the new stuff"
const pic = (src) => `<img class="tour-pic" src="${src}" alt="">`;
const STEPS = [
  { icon: '🌲', title: 'Welcome back!', text: 'A lot is new since the 27th. This quick tour shows you around. Tap <b>Next</b>, or <b>Skip</b> any time. You can watch it again later in <b>⚙️ Settings</b>.' },
  { icon: '📱', title: 'Get the app', text: 'Put the site on your home screen: it opens full screen and works without signal. Turn on <b>🔔 notifications</b> to hear about gifts, game invites, your nursery buddy and when the GM goes live. Both are in <b>⚙️ Settings</b>.', pic: 'assets/ui/app_icon_192.png' },
  { icon: '👥', title: 'Friend Zone', text: 'Under <b>Guild</b>, the Friend Zone shows who’s online and where they are on the map. Tap a portrait for their card, send them <b>Poké or items</b>, write <b>letters</b> with Pelipper Post, invite them to games, or <b>watch</b> them play live.', go: '#/friends' },
  { icon: '⚔️', title: 'Battles', text: 'In <b>Games</b>, pick a <b>Friendly Battle</b> with someone at the table (they get a pop-up to accept), or try <b>Guild Training</b> against guild members any time.', go: '#/games/friendly-battle' },
  { icon: '🥚', title: 'Fernshade Nursery', text: 'Raise your own baby buddy: feed, pet and dress it up, take it on walks, and set up <b>playdates</b> with friends’ babies. Watch for surprise visits from Beatrice and Celebi!', pic: 'assets/nursery/egg.png', go: '#/games/fernshade-nursery' },
  { icon: '🎲', title: 'More games', text: '<b>Noctowl’s 21</b>, <b>Boltund’s Ball Lab</b>, <b>Spinda’s Kitchen</b> and <b>Sentry Duty</b>, each with its own music. Daily chores earn a reward when you do great.', go: '#/games' },
  { icon: '🏋️', title: 'Gym and shops', text: 'Train at the <b>Gym</b> with up to 3 guild Pokémon. In your <b>Bag</b>, tap <b>Edit</b> to arrange items, and you can now <b>sell</b> at both shops.', pic: 'assets/ui/backpack.png', go: '#/gym' },
  { icon: '📖', title: 'Index and Rulebook', text: 'The Rulebook has a <b>search bar</b> at the top, and species cards now show each Pokémon’s portrait and evolution line.', go: '#/rules' },
  { icon: '✨', title: 'You’re all set!', text: 'Have fun! To see this tour again, open <b>⚙️ Settings</b> and tap <b>🧭 Tutorial</b>.' },
];

const seenKey = (id) => `tourSeen/${id}`;
const markSeen = (id) => { if (id && !store.get(seenKey(id))) store.set(seenKey(id), Date.now()); };

export function openTour(id) {
  let i = 0;
  const done = () => { markSeen(id); closeModal(); };
  const draw = (el) => {
    const s = STEPS[i]; const last = i === STEPS.length - 1;
    el.innerHTML = `<div class="tour">
      <p class="tour-dots">${STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</p>
      <div class="tour-icon">${s.pic ? pic(s.pic) : s.icon}</div>
      <h2>${s.title}</h2><p>${s.text}</p>
      ${s.go ? `<p><a class="btn alt sm" href="${s.go}" data-go>👀 Show me</a></p>` : ''}
      <div class="row tour-nav">${i ? '<button class="btn alt" data-back>← Back</button>' : ''}<button class="btn" data-next>${last ? 'Let’s go!' : 'Next →'}</button></div>
      ${last ? '' : '<p><button class="btn alt sm tour-skip" data-skip>Skip tutorial</button></p>'}</div>`;
    const on = (sel, fn) => { const b = $(sel, el); if (b) b.onclick = fn; };
    on('[data-next]', () => { if (last) return done(); i++; draw(el); });
    on('[data-back]', () => { i--; draw(el); });
    on('[data-skip]', done);
    on('[data-go]', () => { markSeen(id); closeModal(); });
  };
  const sheet = modal('<div></div>');
  addEventListener('modalclosed', () => markSeen(id), { once: true });   // closing it any way counts as seen
  const body = document.createElement('div'); sheet.lastElementChild.replaceWith(body); draw(body);
}

// Called once at start-up, before this visit is recorded as "online now".
export function maybeTour(id) {
  if (!id || store.get(seenKey(id))) return;
  const last = Number(store.get(`online/${id}`)?.t) || 0;
  if (last >= SINCE) return;
  let tries = 0;   // wait for the first page draw and any password popup to finish
  const t = setInterval(() => { if (document.querySelector('.sheet-bg') && ++tries < 120) return; clearInterval(t); if (!store.get(seenKey(id))) openTour(id); }, 1500);
}

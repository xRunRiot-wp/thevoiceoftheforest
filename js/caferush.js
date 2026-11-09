// Shelter Patch-Up (her ask 11-08, first built as a cafe 'Mess Hall Rush'; she corrected: "it's to help with keeping the shelters
// upright (the low-quality ones). Vines, sturdy branches and leaves"). Wobbly shelters each call for one material: grab it from
// the supply pile and tap the shelter before it falls. 45 seconds, one shift per character per day.
import * as store from './store.js?v=6af1516b';
import { $, $$, esc, toast, num } from './util.js?v=6af1516b';
import { me, logRoll } from './play.js?v=6af1516b';
import { dailyRoll } from './weather.js?v=6af1516b';
import { gameSay } from './chatter.js?v=6af1516b';
import { markWinner } from './sparkle.js?v=6af1516b';
import { faceSrc } from './sentry.js?v=6af1516b';
import { pageMusic } from './chiptune.js?v=6af1516b';

export const isCafe = (g) => g.kind === 'cafe' || g.id === 'mess-hall-rush';
const FOODS = [['🌿', 'Vines'], ['🪵', 'Sturdy branches'], ['🍃', 'Leaves']];
const GUESTS = ['diglett', 'ralts', 'swablu', 'magnemite', 'golett', 'tinkatink', 'jangmoo', 'cleffa', 'sudowoodo'];
// Spinda runs the mess hall (her ask 11-08: "Spinda in charge but any NPC could help randomly"): a random guild NPC drops in
// once or twice a shift and serves the table that has waited longest.
const HELP_LINES = ['I’ll hold this one up!', 'Need a hand? Got it!', 'Coming through with vines!', 'Leave this shelter to me!'];
const cap = (n) => n[0].toUpperCase() + n.slice(1);
const SECONDS = 45; const SEATS = 4; const PATIENCE = 13000;
// served: [lowest, name, Poké, line]
const GRADES = [[12, 'Rock-solid shelters!', 300, 'Not a single wobble left! Everyone sleeps safe and dry tonight!'], [8, 'Good shift', 100, 'Nice and quick! Those shelters will hold.'],
  [5, 'Shift done', 0, 'Shift done. The camp thanks you.'], [0, 'Rough shift', 0, 'A few shelters came down… we’ll rebuild tomorrow.']];
const today = () => dailyRoll().day;
const rec = (id) => store.get('cafe/' + id) || {};
export const cafeDue = () => { const c = me(); return !!c && rec(c.id).day !== today(); };
export const cafeMini = () => '<div class="cafe-mini">🛖🌿🪵🍃</div>';
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function renderCafe(main, g, gm, onEdit) {
  const c = me(); const done = c && rec(c.id).day === today();
  const party = Object.values(store.get('party') || {}).filter((x) => !x.guest);
  main.innerHTML = `<a class="btn alt sm" href="#/games">← Games</a>${gm ? ' <button class="btn alt sm" id="gedit">✏️ Edit</button>' : ''}
    <div class="card cafe"><h2>🛖 ${esc(g.name)}</h2><p>${esc(g.intro)}</p>
      <div class="sentry-digg"><img class="sface dig" src="${faceSrc('spinda', 'wait', { wait: ['Normal'] })}" alt="Spinda"><div class="bubble"><b>Spinda:</b> “The shelters are wobbling again! Grab vines, branches or leaves and get them over there before anything falls!”</div></div>
      ${!c ? '<p class="muted">Pick your character on the Play tab first.</p>' : `${done ? `<p class="win tight">Today’s best: <b>${esc(rec(c.id).grade || '')}</b> (${num(rec(c.id).best ?? rec(c.id).served)} shelters fixed${num(rec(c.id).plays) > 1 ? `, ${num(rec(c.id).plays)} shifts` : ''}). You can work another shift any time!</p>` : ''}<button class="btn" id="cfgo">${done ? 'Work another shift' : 'Start the shift'}</button> <button class="btn alt" id="cfmusic">🎵 Music</button>`}
      <div id="cfplay"></div>
      ${gm ? `<details style="margin-top:10px"><summary class="small">GM: let someone work again</summary>${party.map((x) => `<button class="btn alt sm" data-creset="${esc(x.id)}">${esc(x.nickname)}</button>`).join(' ')}</details>` : ''}
    </div>`;
  const ed = $('#gedit', main); if (ed) ed.onclick = onEdit;
  $$('[data-creset]', main).forEach((b) => b.onclick = () => { store.set(`cafe/${b.dataset.creset}/day`, null); toast('They can work again today'); renderCafe(main, g, gm, onEdit); });
  pageMusic(main, 'march', 'cfmusic');
  const go = $('#cfgo', main); if (go) go.onclick = () => { go.style.display = 'none'; play(main, c); };
}

function play(main, c) {
  const box = $('#cfplay', main);
  let seats = Array(SEATS).fill(null); let held = null; let served = 0; let lost = 0; let left = SECONDS; let nextAt = 0; let over = false; let msg = 'Tap a material to pick it up.';
  let helper = null; const visits = [8 + Math.random() * 12, 24 + Math.random() * 12].slice(0, 1 + (Math.random() < 0.6 ? 1 : 0)); let helped = 0;
  const draw = () => {
    box.innerHTML = `<div class="cafe-bar"><b>⏱ ${Math.ceil(left)}s</b><span>✅ ${served} fixed</span><span>💥 ${lost} fell</span></div>
      <div class="cafe-seats">${seats.map((s, i) => s ? `<button class="cafe-seat shelter" data-seat="${i}" style="transform:rotate(${(s.pat / PATIENCE < 0.25 ? 9 : s.pat / PATIENCE < 0.5 ? 5 : 2) * (i % 2 ? 1 : -1)}deg)"><span class="cafe-hut">🛖</span><span class="cafe-want">${s.food[0]}</span><i class="cafe-pat"><b style="width:${Math.max(0, s.pat / PATIENCE * 100)}%;background:${s.pat / PATIENCE > 0.5 ? '#6cc36a' : s.pat / PATIENCE > 0.25 ? '#e5b83a' : '#d9534f'}"></b></i></button>` : '<div class="cafe-seat empty">✅</div>').join('')}</div>
      ${helper ? `<div class="sentry-digg"><img class="sface dig" src="${faceSrc(helper.sp, 'wait', { wait: ['Normal'] })}" alt=""><div class="bubble"><b>${esc(cap(helper.sp))}</b> is helping: “${esc(helper.line)}”</div></div>` : ''}
      <p class="cafe-msg">${esc(msg)}</p><p class="small">Carrying: <b>${held ? held[0] + ' ' + held[1] : 'nothing'}</b></p>
      <div class="cafe-counter">${FOODS.map((f, i) => `<button class="cafe-food ${held === f ? 'on' : ''}" data-food="${i}">${f[0]}<small>${f[1]}</small></button>`).join('')}</div>`;
  };
  // her report 11-08 "it isn't taking the first time": the board redraws every 250 ms, so a per-button click whose press and
  // release straddled a redraw was lost. One listener on the box acts on the press itself.
  const tap = (e) => {
    if (over) return; const b = e.target.closest('[data-food],[data-seat]'); if (!b || !box.contains(b)) return;
    e.preventDefault();
    if (b.dataset.food != null) { held = FOODS[+b.dataset.food]; msg = `Got the ${held[1].toLowerCase()}. Which shelter needs it?`; return draw(); }
    const s = seats[+b.dataset.seat]; if (!s) return;
    if (!held) { msg = 'Grab a material first!'; return draw(); }
    if (held[1] !== s.food[1]) { msg = `Wrong one! That shelter needs ${s.food[1].toLowerCase()}.`; held = null; return draw(); }
    served += 1; seats[+b.dataset.seat] = null; held = null; msg = pick(['Shored up!', 'Steady as a rock!', 'That one’s holding!', 'Next shelter!']); draw();
  };
  box.onpointerdown = tap;
  box.onclick = (e) => { if (e.detail === 0) tap(e); }; // keyboard Enter/Space only
  const tick = setInterval(() => {
    if (!box.isConnected) return clearInterval(tick);
    left -= 0.25; nextAt -= 0.25;
    seats.forEach((s, i) => { if (s) { s.pat -= 250; if (s.pat <= 0) { seats[i] = null; lost += 1; msg = 'A shelter fell down…'; } } });
    if (nextAt <= 0 && left > 4) { const free = seats.map((s, i) => (s ? -1 : i)).filter((i) => i >= 0); if (free.length) seats[pick(free)] = { sp: pick(GUESTS), food: pick(FOODS), pat: PATIENCE }; nextAt = 2.2 + Math.random() * 1.6; }
    const t = SECONDS - left;
    if (!helper && visits.length && t >= visits[0]) { visits.shift(); helper = { sp: pick(GUESTS), line: pick(HELP_LINES), at: 1.5, stay: 4 }; }
    if (helper) {
      helper.at -= 0.25; helper.stay -= 0.25;
      if (helper.at <= 0 && !helper.done) { let i = -1; seats.forEach((s, k) => { if (s && (i < 0 || s.pat < seats[i].pat)) i = k; }); if (i >= 0) { seats[i] = null; served += 1; helped += 1; helper.done = true; msg = `${cap(helper.sp)} fixed a shelter for you!`; } }
      if (helper.stay <= 0) helper = null;
    }
    if (left <= 0) { clearInterval(tick); over = true; return finish(main, c, served, lost, helped); }
    draw();
  }, 250);
  draw();
}

function finish(main, c, served, lost, helped = 0) {
  const [, name, poke, line] = GRADES.find(([min]) => served >= min);
  // her ask 11-08 "Allow people to play multiple times a day": keep today's best and count the shifts
  const old = rec(c.id); const same = old.day === today(); const prev = same ? num(old.best ?? old.served) : -1;
  const best = served > prev ? { n: served, grade: name } : { n: prev, grade: old.grade };
  store.set('cafe/' + c.id, { day: today(), served: best.n, best: best.n, grade: best.grade, plays: (same ? num(old.plays) || 1 : 0) + 1, t: Date.now() });
  if (poke) { store.update('party/' + c.id, (x) => ({ ...x, poke: num(x?.poke) + poke })); markWinner(c.id); }
  logRoll(c.nickname, 'Shelter Patch-Up', null, `${served} fixed · ${lost} fell · ${name}${poke ? ' · ' + poke + ' Poké' : ''}`, 'note');
  if (served >= 12) gameSay('Spinda', 'say', `${c.nickname} fixed ${served} shelters in one shift! The whole camp is standing tall.`, 'cafe', c.nickname);
  $('#cfplay', main).innerHTML = `<div class="win tight" style="font-size:18px">${esc(name)}</div><p><b>${served}</b> fixed${helped ? ` (${helped} by a helper)` : ''} · ${lost} fell${poke ? ` · <b>+${poke} Poké</b>` : ''}</p><p class="muted">Spinda: “${esc(line)}”</p>`;
  const again = $('#cfgo', main); if (again) { again.textContent = 'Work another shift'; again.style.display = ''; }
}

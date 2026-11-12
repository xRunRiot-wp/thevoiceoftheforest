// Shelter Patch-Up (her ask 11-08, first built as a cafe 'Mess Hall Rush'; she corrected: "it's to help with keeping the shelters
// upright (the low-quality ones). Vines, sturdy branches and leaves").
// v3 (her ask 11-09): "swap out Spinda for Machoke ... more detail like the sprite walking to the piles and walking to the tent to
// help it. The tent improving as they fix it": a camp scene. Machoke walks to a supply pile to pick up vines, sturdy branches or
// leaves, then walks to the tent that calls for it and works on it. Each wobbly tent needs two fixes: torn -> patched -> sturdy.
// A tent left too long collapses. Tap targets act on press (one listener on the scene; her 11-08 "it isn't taking the first time").
import * as store from './store.js?v=6af65085';
import { $, esc, toast, num } from './util.js?v=6af65085';
import { me, logRoll } from './play.js?v=6af65085';
import { dailyRoll } from './weather.js?v=6af65085';
import { gameSay } from './chatter.js?v=6af65085';
import { markWinner } from './sparkle.js?v=6af65085';
import { faceSrc } from './sentry.js?v=6af65085';
import { pageMusic } from './chiptune.js?v=6af65085';

export const isCafe = (g) => g.kind === 'cafe' || g.id === 'mess-hall-rush';
// her site check 11-09: 🛖 and 🪵 are newer emoji that show as empty boxes on Windows 10 and older phones, so ⛺ and 🌲 are used
const FOODS = [['🌿', 'Vines', 'vines'], ['🌲', 'Sturdy branches', 'branches'], ['🍃', 'Leaves', 'leaves']];
// her 11-09 "make the material piles match more to the art style": pixel-art piles (assets/shelter/pile_*.png), also used for what
// Machoke carries and what each tent asks for
const pileImg = (f, cls = '') => `<img class="${cls}" src="assets/shelter/pile_${f[2]}.png" alt="${esc(f[1])}" draggable="false">`;
const GUESTS = ['diglett', 'ralts', 'swablu', 'magnemite', 'golett', 'tinkatink', 'jangmoo', 'cleffa', 'sudowoodo'];
// a random guild NPC drops in once or twice a shift and finishes the tent closest to falling (her ask 11-08)
const HELP_LINES = ['I’ll hold this one up!', 'Need a hand? Got it!', 'Coming through with vines!', 'Leave this shelter to me!'];
const cap = (n) => n[0].toUpperCase() + n.slice(1);
const SECONDS = 60; const TENTS = 4; const PATIENCE = 16000;
// Machoke's PMD walk sheet (SpriteCollab 0067): 4 frames of 32x48, rows: down 0, right 2, up 4, left 6
const MACH = { url: 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/0067/Walk-Anim.png', w: 32, h: 48, n: 4, ms: 600, S: 2 };
const ROW = { down: 0, right: 2, up: 4, left: 6 };
const TENT_PIC = { 0: 'torn', 1: 'patched', 2: 'sturdy', '-1': 'collapsed' };   // assets/shelter/tent_*.png (80x68 pixel art)
const TENT_X = [14, 38, 62, 86]; const TENT_Y = 40; const PILE_X = [20, 50, 80]; const PILE_Y = 80;
// fixed: [lowest, name, Poké, line]
const GRADES = [[9, 'Rock-solid shelters!', 300, 'Not a single wobble left! Everyone sleeps safe and dry tonight!'], [6, 'Good shift', 100, 'Nice and quick! Those shelters will hold.'],
  [3, 'Shift done', 0, 'Shift done. The camp thanks you.'], [0, 'Rough shift', 0, 'A few shelters came down… we’ll rebuild tomorrow.']];
const today = () => dailyRoll().day;
const rec = (id) => store.get('cafe/' + id) || {};
export const cafeDue = () => { const c = me(); return !!c && rec(c.id).day !== today(); };
// her ask 11-09 "Match the Shelter to the other circular styles of the games section": the round scene card (tent camp) with
// Machoke standing in it (the walk sheet's first frame)
export const cafeMini = () => `<div class="kitchen-mini cafe-mini"><div class="sh-mini-mach" style="background-image:url(${MACH.url})"></div></div>`;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function renderCafe(main, g, gm, onEdit) {
  const c = me(); const done = c && rec(c.id).day === today();
  const party = Object.values(store.get('party') || {}).filter((x) => !x.guest);
  main.innerHTML = `<a class="btn alt sm" href="#/games">← Games</a>${gm ? ' <button class="btn alt sm" id="gedit">✏️ Edit</button>' : ''}
    <div class="card cafe"><h2>⛺ ${esc(g.name)}</h2><p>${esc(g.intro)}</p>
      <div class="sentry-digg"><img class="sface dig" src="${faceSrc('machoke', 'wait', { wait: ['Normal'] })}" alt="Machoke"><div class="bubble"><b>Machoke:</b> “The shelters are wobbling again! Tap a pile and I’ll grab vines, branches or leaves. Then tap the tent that needs it and I’ll fix it up!”</div></div>
      ${!c ? '<p class="muted">Pick your character on the Play tab first.</p>' : `${done ? `<p class="win tight">Today’s best: <b>${esc(rec(c.id).grade || '')}</b> (${num(rec(c.id).best ?? rec(c.id).served)} shelters fixed${num(rec(c.id).plays) > 1 ? `, ${num(rec(c.id).plays)} shifts` : ''}). You can work another shift any time!</p>` : ''}<button class="btn" id="cfgo">${done ? 'Work another shift' : 'Start the shift'}</button> <button class="btn alt" id="cfmusic">🎵 Music</button>`}
      <div id="cfplay"></div>
      ${gm ? `<details style="margin-top:10px"><summary class="small">GM: let someone work again</summary>${party.map((x) => `<button class="btn alt sm" data-creset="${esc(x.id)}">${esc(x.nickname)}</button>`).join(' ')}</details>` : ''}
    </div>`;
  const ed = $('#gedit', main); if (ed) ed.onclick = onEdit;
  main.querySelectorAll('[data-creset]').forEach((b) => b.onclick = () => { store.set(`cafe/${b.dataset.creset}/day`, null); toast('They can work again today'); renderCafe(main, g, gm, onEdit); });
  pageMusic(main, 'march', 'cfmusic');
  const go = $('#cfgo', main); if (go) go.onclick = () => { go.style.display = 'none'; play(main, c); };
}

function play(main, c) {
  const box = $('#cfplay', main);
  // stage: 0 torn, 1 patched, 2 sturdy (done), -1 collapsed. need = the material it calls for next.
  const fresh = () => ({ stage: 0, need: pick(FOODS), pat: PATIENCE, until: 0 });
  const tents = Array.from({ length: TENTS }, (_, i) => (i < 2 ? fresh() : { stage: 2, need: null, pat: 0, until: 2 + i * 2.5 }));
  let held = null; let fixed = 0; let lost = 0; let left = SECONDS; let over = false; let msg = 'Tap a pile to send Machoke for materials.';
  let helper = null; const visits = [12 + Math.random() * 14, 32 + Math.random() * 14].slice(0, 1 + (Math.random() < 0.6 ? 1 : 0)); let helped = 0;
  const pos = { x: 50, y: 66 }; let walking = false; let pending = null; let working = -1;

  box.innerHTML = `<div class="cafe-bar"><b id="shtime">⏱ ${SECONDS}s</b><span id="shfixed">✅ 0 fixed</span><span id="shlost">💥 0 fell</span></div>
    <div class="sh-scene" id="shscene">
      ${tents.map((_, i) => `<button type="button" class="sh-tent" data-tent="${i}" style="left:${TENT_X[i]}%;top:${TENT_Y}%" aria-label="Tent ${i + 1}"><span class="sh-need"></span><img class="sh-img" src="assets/shelter/tent_torn.png" alt="" draggable="false"><span class="sh-spark">✨</span><i class="sh-pat"><b></b></i></button>`).join('')}
      ${FOODS.map((f, i) => `<button type="button" class="sh-pile" data-pile="${i}" style="left:${PILE_X[i]}%;top:${PILE_Y}%" aria-label="${esc(f[1])} pile">${pileImg(f, 'sh-pimg')}<small>${esc(f[1])}</small></button>`).join('')}
      <div class="sh-mach" id="shmach" style="left:${pos.x}%;top:${pos.y}%"><span class="sh-held" id="shheld"></span><div class="sh-spr" style="width:${MACH.w * MACH.S}px;height:${MACH.h * MACH.S}px;background-image:url(${MACH.url});background-size:${MACH.w * MACH.n * MACH.S}px ${MACH.h * 8 * MACH.S}px;--fw:${MACH.w * MACH.S}px;--n:${MACH.n};--ms:${MACH.ms}ms"></div></div>
      <div class="sh-helper" id="shhelper" hidden></div>
    </div>
    <p class="cafe-msg" id="shmsg"></p>`;
  const scene = $('#shscene', box); const mach = $('#shmach', box); const spr = $('.sh-spr', mach);

  const face = (dir) => { spr.style.backgroundPositionY = `-${ROW[dir] * MACH.h * MACH.S}px`; };
  face('down');
  const paint = () => {
    $('#shtime', box).textContent = `⏱ ${Math.ceil(left)}s`; $('#shfixed', box).textContent = `✅ ${fixed} fixed`; $('#shlost', box).textContent = `💥 ${lost} fell`;
    $('#shmsg', box).textContent = msg; const hEl = $('#shheld', box); const hKey = held ? held[2] : ''; if (hEl.dataset.k !== hKey) { hEl.dataset.k = hKey; hEl.innerHTML = held ? pileImg(held) : ''; }
    tents.forEach((t, i) => {
      const el = scene.querySelector(`[data-tent="${i}"]`); const p = t.stage >= 0 && t.stage < 2 ? t.pat / PATIENCE : 1;
      if (el.dataset.stage !== String(t.stage)) el.querySelector('.sh-img').src = `assets/shelter/tent_${TENT_PIC[t.stage]}.png`;   // her 11-09: detailed pixel tents per stage
      el.dataset.stage = String(t.stage); el.classList.toggle('urgent', t.stage >= 0 && t.stage < 2 && p < 0.35); el.classList.toggle('working', working === i);
      const nEl = el.querySelector('.sh-need'); const nKey = t.stage >= 0 && t.stage < 2 && t.need ? t.need[2] : '';
      if (nEl.dataset.k !== nKey) { nEl.dataset.k = nKey; nEl.innerHTML = nKey ? pileImg(t.need) : ''; }
      const bar = el.querySelector('.sh-pat b'); bar.style.width = `${Math.max(0, p * 100)}%`; bar.style.background = p > 0.5 ? '#6cc36a' : p > 0.25 ? '#e5b83a' : '#d9534f';
    });
  };
  // walk Machoke to a spot (percent of the scene), facing the way he goes; then run the action
  const walkTo = (x, y, then) => {
    if (walking) { pending = { x, y, then }; return; }
    const dx = x - pos.x; const dy = y - pos.y; const dist = Math.hypot(dx, dy * 1.4);
    face(Math.abs(dx) > Math.abs(dy) * 1.4 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    const ms = Math.max(180, dist * 14); walking = true; mach.classList.add('walking');
    mach.style.transitionDuration = `${ms}ms`; mach.style.left = `${x}%`; mach.style.top = `${y}%`; pos.x = x; pos.y = y;
    setTimeout(() => { walking = false; mach.classList.remove('walking'); face('down'); if (!over) then(); if (pending && !over) { const p = pending; pending = null; walkTo(p.x, p.y, p.then); } paint(); }, ms);
  };
  const work = (i) => {
    const t = tents[i];
    if (t.stage < 0 || t.stage >= 2) { msg = t.stage < 0 ? 'That one already came down…' : 'That tent is already sturdy!'; return; }
    if (!held) { msg = 'Grab a material from a pile first!'; return; }
    if (held[1] !== t.need[1]) { msg = `Wrong one! That tent needs ${t.need[1].toLowerCase()}.`; held = null; return; }
    held = null; working = i; face('up'); paint();
    setTimeout(() => {
      working = -1; if (over || t.stage < 0) return;
      t.stage += 1; t.pat = Math.min(PATIENCE, t.pat + PATIENCE * 0.45);
      if (t.stage >= 2) { fixed += 1; t.need = null; t.until = 6 + Math.random() * 3; msg = pick(['Sturdy as a rock!', 'That one’s holding!', 'Good as new!', 'Shored up!']); }
      else { t.need = pick(FOODS); msg = `Patched! Now it needs ${t.need[1].toLowerCase()} to be sturdy.`; }
      paint();
    }, 450);
  };
  const tap = (e) => {
    if (over) return; const b = e.target.closest('[data-pile],[data-tent]'); if (!b || !scene.contains(b)) return;
    e.preventDefault();
    if (b.dataset.pile != null) { const i = +b.dataset.pile; walkTo(PILE_X[i], PILE_Y - 14, () => { held = FOODS[i]; msg = `Machoke grabbed the ${held[1].toLowerCase()}. Which tent needs it?`; }); return; }
    const i = +b.dataset.tent; walkTo(TENT_X[i], TENT_Y + 22, () => work(i));
  };
  scene.onpointerdown = tap;
  scene.onclick = (e) => { if (e.detail === 0) tap(e); }; // keyboard Enter/Space only

  const tick = setInterval(() => {
    if (!box.isConnected) return clearInterval(tick);
    left -= 0.25;
    tents.forEach((t, i) => {
      if (t.stage === 0 || t.stage === 1) { if (working !== i) t.pat -= 250; if (t.pat <= 0) { t.stage = -1; t.need = null; t.until = 2.5; lost += 1; msg = 'A tent collapsed…'; } }
      else if (left > 6) { t.until -= 0.25; if (t.until <= 0) Object.assign(t, fresh()); }   // sturdy for a while, then the weather wears it down again
    });
    const t = SECONDS - left;
    if (!helper && visits.length && t >= visits[0]) { visits.shift(); helper = { sp: pick(GUESTS), line: pick(HELP_LINES), at: 1.5, stay: 4 }; }
    const hp = $('#shhelper', box);
    if (helper) {
      helper.at -= 0.25; helper.stay -= 0.25;
      if (helper.at <= 0 && !helper.done) {
        let i = -1; tents.forEach((x, k) => { if ((x.stage === 0 || x.stage === 1) && working !== k && (i < 0 || x.pat < tents[i].pat)) i = k; });
        if (i >= 0) { Object.assign(tents[i], { stage: 2, need: null, until: 7 }); fixed += 1; helped += 1; msg = `${cap(helper.sp)} fixed a tent for you!`; }
        helper.done = true;
      }
      hp.hidden = false; hp.innerHTML = `<img class="sface" src="${faceSrc(helper.sp, 'wait', { wait: ['Normal'] })}" alt=""><span><b>${esc(cap(helper.sp))}</b>: “${esc(helper.line)}”</span>`;
      if (helper.stay <= 0) helper = null;
    } else hp.hidden = true;
    if (left <= 0) { clearInterval(tick); over = true; return finish(main, c, fixed, lost, helped); }
    paint();
  }, 250);
  paint();
}

function finish(main, c, served, lost, helped = 0) {
  const [, name, poke, line] = GRADES.find(([min]) => served >= min);
  // her ask 11-08 "Allow people to play multiple times a day": keep today's best and count the shifts
  const old = rec(c.id); const same = old.day === today(); const prev = same ? num(old.best ?? old.served) : -1;
  const best = served > prev ? { n: served, grade: name } : { n: prev, grade: old.grade };
  store.set('cafe/' + c.id, { day: today(), served: best.n, best: best.n, grade: best.grade, plays: (same ? num(old.plays) || 1 : 0) + 1, t: Date.now() });
  if (poke) { store.update('party/' + c.id, (x) => ({ ...x, poke: num(x?.poke) + poke })); markWinner(c.id); }
  logRoll(c.nickname, 'Shelter Patch-Up', null, `${served} fixed · ${lost} fell · ${name}${poke ? ' · ' + poke + ' Poké' : ''}`, 'note');
  if (served >= 9) gameSay('Machoke', 'say', `${c.nickname} fixed ${served} shelters in one shift! The whole camp is standing tall.`, 'cafe', c.nickname);
  $('#cfplay', main).innerHTML = `<div class="win tight" style="font-size:18px">${esc(name)}</div><p><b>${served}</b> fixed${helped ? ` (${helped} by a helper)` : ''} · ${lost} fell${poke ? ` · <b>+${poke} Poké</b>` : ''}</p><p class="muted">Machoke: “${esc(line)}”</p>`;
  const again = $('#cfgo', main); if (again) { again.textContent = 'Work another shift'; again.style.display = ''; }
}

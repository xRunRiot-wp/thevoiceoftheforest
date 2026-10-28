// Fernshade Nursery (her ask 10-27): a Tamagotchi-style buddy. Beatrice, the Beedrill den-mother of Fernshade Camp,
// gives each character an egg from the nursery. Keep it warm until it hatches, then feed it, play with it and keep it
// clean every day. Each day the buddy is fully cared for counts toward growing up: Egg → Baby → Kid → Teen.
// A teen can be asked to join the team (it goes on the GM checklist as a recruit).
// Stats drop in real time from when you last did each thing. State: nursery/<charId>.
import * as store from './store.js?v=6ae14507';
import { $, $$, esc, toast, num } from './util.js?v=6ae14507';
import { me, logRoll } from './play.js?v=6ae14507';
import { dailyRoll } from './weather.js?v=6ae14507';
import { gameSay, gmTodo } from './chatter.js?v=6ae14507';
import { markWinner } from './sparkle.js?v=6ae14507';

export const isNursery = (g) => g.kind === 'nursery' || g.id === 'fernshade-nursery';

// baby sprites: assets/nursery/<key>.png, rows Idle / Hop / Sleep (facing down), cells cw×ch; faces in assets/portraits/emo/<key>/
const BABIES = {pichu: { name: 'Pichu', cw: 32, ch: 88, idle: 4, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, cleffa: { name: 'Cleffa', cw: 24, ch: 80, idle: 2, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, igglybuff: { name: 'Igglybuff', cw: 24, ch: 72, idle: 2, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, togepi: { name: 'Togepi', cw: 24, ch: 72, idle: 4, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, tyrogue: { name: 'Tyrogue', cw: 24, ch: 88, idle: 7, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, smoochum: { name: 'Smoochum', cw: 24, ch: 80, idle: 5, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, elekid: { name: 'Elekid', cw: 32, ch: 96, idle: 4, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, magby: { name: 'Magby', cw: 24, ch: 88, idle: 6, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, azurill: { name: 'Azurill', cw: 48, ch: 88, idle: 4, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, wynaut: { name: 'Wynaut', cw: 24, ch: 80, idle: 6, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, budew: { name: 'Budew', cw: 24, ch: 80, idle: 8, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, chingling: { name: 'Chingling', cw: 32, ch: 80, idle: 2, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, bonsly: { name: 'Bonsly', cw: 24, ch: 88, idle: 5, emo: ['Normal', 'Sad'] }, mimejr: { name: 'Mime Jr.', cw: 24, ch: 88, idle: 8, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, happiny: { name: 'Happiny', cw: 32, ch: 80, idle: 5, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, munchlax: { name: 'Munchlax', cw: 32, ch: 88, idle: 4, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, riolu: { name: 'Riolu', cw: 32, ch: 88, idle: 4, emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }};
const STAGES = ['Egg', 'Baby', 'Kid', 'Teen'];
const DAYS_TO_GROW = [1, 2, 2]; // cared-for days to leave Egg, Baby, Kid
const NEEDS = { egg: { warm: 3 }, baby: { feed: 2, play: 2, clean: 1 } };
const RATE = { warm: 8, feed: 8, play: 6, clean: 4 }; // points lost per hour
const LABEL = { warm: ['🔥', 'Warmth', 'Keep warm'], feed: ['🍼', 'Food', 'Feed'], play: ['🎈', 'Fun', 'Play'], clean: ['🛁', 'Clean', 'Bath'] };

const today = () => dailyRoll().day;
const buddyOf = (id) => store.get('nursery/' + id) || null;
const stat = (b, k) => Math.max(0, Math.min(100, Math.round(100 - (Date.now() - num(b[k + 'At'])) / 3600e3 * RATE[k])));
const needsOf = (b) => (b.stage === 0 ? NEEDS.egg : NEEDS.baby);
const todayOf = (b) => (b.days || {})[today()] || {};
const caredToday = (b) => Object.entries(needsOf(b)).every(([k, n]) => num(todayOf(b)[k]) >= n);
export const nurseryDue = () => { const c = me(); if (!c) return false; const b = buddyOf(c.id); return !b || (!b.recruited && b.stage < 3 && !caredToday(b)); };

const BEA = { wait: ['Normal'], happy: ['Happy', 'Joyous'], worry: ['Worried', 'Sad'], proud: ['Inspired', 'Joyous'] };
const beaFace = (mood) => { const have = ['Normal', 'Happy', 'Joyous', 'Sad', 'Worried', 'Inspired', 'Surprised', 'Determined', 'Sigh']; return `assets/portraits/emo/beedrill/${(BEA[mood] || []).find((e) => have.includes(e)) || 'Normal'}.png`; };
const bea = (mood, line) => `<div class="sentry-digg"><img class="sface dig" src="${beaFace(mood)}" alt="Beatrice"><div class="bubble"><b>Beatrice:</b> “${esc(line)}”</div></div>`;
function buddyFace(b) {
  const B = BABIES[b.sp]; if (!B) return '';
  const avg = Object.keys(needsOf(b)).reduce((t, k) => t + stat(b, k), 0) / Object.keys(needsOf(b)).length;
  const want = avg >= 75 ? ['Joyous', 'Happy'] : avg >= 45 ? ['Normal'] : avg >= 20 ? ['Sad', 'Worried'] : ['Crying', 'Teary-Eyed', 'Sad'];
  return `assets/portraits/emo/${b.sp}/${want.find((e) => B.emo.includes(e)) || 'Normal'}.png`;
}
// the baby's own sprite: row 0 idle, 1 hop, 2 sleep; 3x size
function spriteHTML(b, row = 0) {
  const B = BABIES[b.sp]; const n = row === 1 ? 10 : row === 2 ? 2 : B.idle;
  const S = 3;
  return `<span class="baby-spr r${row}" style="bottom:${Math.round(66 - B.ch * S / 2)}px;--fw:${B.cw * S}px;--n:${n};width:${B.cw * S}px;height:${B.ch * S}px;background-image:url(assets/nursery/${b.sp}.png);background-size:${B.cw * 10 * S}px ${B.ch * 3 * S}px;background-position-y:-${row * B.ch * S}px"></span>`;
}
// the egg is the Ruby & Sapphire egg sprite (her ask 10-27), assets/nursery/egg.png
const eggHTML = (b, cls = '') => `<img class="egg ${cls}" src="assets/nursery/egg.png" alt="An egg">`;
// her ask 10-27: the egg (and later the baby) sits in a nest on Tiny Woods grass. Nest = two layers so the front rim covers the egg.
const nestHTML = (inner) => `<div class="nest"><img class="nest-b" src="assets/nursery/nest_back.png" alt="">${inner}<img class="nest-f" src="assets/nursery/nest_front.png" alt=""></div>`;
const nameOf = (b) => b.name || (b.stage === 0 ? 'your egg' : BABIES[b.sp]?.name || 'your buddy');

function adopt(c) {
  const keys = Object.keys(BABIES); const sp = keys[Math.floor(Math.random() * keys.length)];
  const now = Date.now();
  store.set('nursery/' + c.id, { sp, stage: 0, grown: 0, born: now, warmAt: now - 6 * 3600e3, feedAt: now, playAt: now, cleanAt: now, days: {} });
  logRoll(c.nickname, 'Fernshade Nursery', null, 'took home an egg from Beatrice', 'note');
}

function act(c, k) {
  const b = buddyOf(c.id); if (!b) return '';
  if (stat(b, k) >= 90) return k === 'feed' ? `${nameOf(b)} is full!` : k === 'play' ? `${nameOf(b)} is all played out. Let it rest a bit.` : k === 'clean' ? 'Already squeaky clean!' : 'It’s nice and toasty already.';
  const d = today(); const day = { ...todayOf(b) }; day[k] = num(day[k]) + 1;
  const next = { ...b, [k + 'At']: Date.now(), days: { ...(b.days || {}), [d]: day } };
  // a fully cared-for day counts once toward growing up
  if (!day.counted && Object.entries(needsOf(next)).every(([n, want]) => num(day[n]) >= want)) {
    day.counted = true; next.grown = num(b.grown) + 1;
    if (b.stage < 3 && next.grown >= DAYS_TO_GROW[b.stage]) { next.stage = b.stage + 1; next.grown = 0; next.grewAt = Date.now(); }
  }
  // keep only the last 2 weeks of day records
  next.days = Object.fromEntries(Object.entries(next.days).sort().slice(-14));
  store.set('nursery/' + c.id, next);
  if (next.stage !== b.stage) {
    const msg = next.stage === 1 ? `${c.nickname}’s egg hatched into a ${BABIES[b.sp].name}!` : `${c.nickname}’s ${BABIES[b.sp].name} grew into a ${STAGES[next.stage].toLowerCase()}!`;
    store.pushLimited('log', { t: Date.now(), text: msg });
    gameSay('Beatrice', 'say', next.stage === 1 ? `${c.nickname}’s egg just hatched! Welcome to Fernshade, little ${BABIES[b.sp].name}!` : `${c.nickname}’s ${BABIES[b.sp].name} is growing up so fast!`, 'nursery', c.nickname);
    markWinner(c.id);
    return 'grew';
  }
  return 'ok';
}

function room(c, box, anim) {
  const b = buddyOf(c.id);
  if (!b) {
    box.innerHTML = `<div class="sentry-start">${bea('happy', `Oh, ${c.nickname}, dear! The nursery has more eggs than I have arms. Would you look after one for me? Keep it warm, and once it hatches, feed it, play with it and give it baths. Raise it to a teen, and maybe it’ll want to join your team!`)}
      <div class="nursery-room">${nestHTML(eggHTML({ sp: '' }))}</div><button class="btn block" id="nadopt">Take an egg home 🥚</button></div>`;
    $('#nadopt', box).onclick = () => { adopt(c); room(c, box, 'new'); };
    return;
  }
  const B = BABIES[b.sp]; const egg = b.stage === 0; const needs = needsOf(b); const day = todayOf(b);
  const cared = caredToday(b); const left = b.stage < 3 ? DAYS_TO_GROW[b.stage] - num(b.grown) : 0;
  const low = Object.keys(needs).filter((k) => stat(b, k) < 30);
  const line = b.recruited ? `${B.name} is part of your team now. I’m so proud of you both!`
    : b.stage === 3 ? `Look how big ${nameOf(b)} has grown! I think ${B.name} would follow you anywhere. Why not ask?`
    : anim === 'grew' ? (b.stage === 1 ? `It hatched! Say hello to your ${B.name}, ${c.nickname}!` : `${nameOf(b)} is a ${STAGES[b.stage].toLowerCase()} now!`)
    : low.length ? `${nameOf(b)} needs you: ${low.map((k) => LABEL[k][1].toLowerCase()).join(' and ')} is low!`
    : cared ? `All done for today. ${nameOf(b)} is happy and growing!` : egg ? 'Keep it warm, three times a day. I can hear it wiggling!' : 'Feed, play and bath time. A little every day!';
  box.innerHTML = `<div class="nursery">
    ${bea(b.recruited || b.stage === 3 ? 'proud' : low.length ? 'worry' : 'happy', line)}
    <div class="nursery-room ${egg ? 'is-egg' : ''}">
      ${nestHTML(egg ? eggHTML(b, anim === 'warm' ? 'wiggle' : '') : spriteHTML(b, anim === 'play' ? 1 : 0))}
      ${anim === 'grew' ? '<span class="n-burst">✨</span>' : ''}${anim === 'feed' ? '<span class="n-fx">🍼</span>' : anim === 'clean' ? '<span class="n-fx">✨</span>' : anim === 'play' ? '<span class="n-fx">💕</span>' : ''}
    </div>
    <div class="n-head">${egg ? '' : `<img class="sface" src="${buddyFace(b)}" alt="">`}<div class="grow"><b>${esc(b.name || (egg ? 'Mystery egg' : B.name))}</b> <span class="pill">${STAGES[b.stage]}</span>
      <div class="small muted">${b.stage < 3 ? `${left} more cared-for day${left === 1 ? '' : 's'} to grow` : b.recruited ? 'On your team' : 'Ready to join a team!'}</div></div>
      ${egg ? '' : '<button class="btn alt sm" id="nname">Name</button>'}</div>
    <div class="n-stats">${Object.keys(needs).map((k) => { const v = stat(b, k); return `<div class="n-stat"><span>${LABEL[k][0]} ${LABEL[k][1]}</span><div class="n-bar ${v < 30 ? 'low' : ''}"><i style="width:${v}%"></i></div><span class="small muted">${Math.min(num(day[k]), needs[k])}/${needs[k]} today</span></div>`; }).join('')}</div>
    ${b.recruited ? '' : b.stage === 3 ? `<button class="btn block" id="nrecruit">Ask ${esc(nameOf(b))} to join the team 🤝</button>`
      : `<div class="n-acts">${Object.keys(needs).map((k) => `<button class="btn ${num(day[k]) >= needs[k] ? 'alt' : ''}" data-nact="${k}">${LABEL[k][0]} ${LABEL[k][2]}</button>`).join('')}</div>`}
    ${cared && b.stage < 3 ? '<p class="small" style="text-align:center;color:#2f6d2b">✅ Fully cared for today</p>' : ''}</div>`;
  $$('[data-nact]', box).forEach((btn) => btn.onclick = () => {
    const k = btn.dataset.nact; const r = act(c, k);
    if (r !== 'ok' && r !== 'grew') { toast(r); return; }
    room(c, box, r === 'grew' ? 'grew' : k === 'warm' ? 'warm' : k);
  });
  const nm = $('#nname', box); if (nm) nm.onclick = () => { const v = prompt(`Name your ${B.name}:`, b.name || ''); if (v != null) { store.set(`nursery/${c.id}/name`, v.trim().slice(0, 24) || null); room(c, box); } };
  const rc = $('#nrecruit', box); if (rc) rc.onclick = () => {
    store.set(`nursery/${c.id}/recruited`, Date.now());
    gmTodo(`${c.nickname}’s nursery ${B.name}${b.name ? ` “${b.name}”` : ''} grew up and wants to join the team: play out the recruit`, 'nursery');
    store.pushLimited('log', { t: Date.now(), text: `${c.nickname} asked their nursery ${B.name} to join the team!` });
    gameSay('Beatrice', 'say', `${c.nickname} raised that ${B.name} from an egg, and now it wants to join their team. I might cry!`, 'nursery', c.nickname);
    markWinner(c.id); room(c, box, 'grew');
  };
}

export function renderNursery(main, g, gm, onEdit) {
  const c = me();
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a>${gm ? '<button class="btn alt sm" id="ed">Edit</button>' : ''}</div>
    <h1 style="margin:10px 0 4px">${esc(g.name)}</h1>
    <p>${esc(g.intro || '')}</p>
    <p><span class="pill">🥚 Egg → Baby → Kid → Teen</span> <span class="pill">📅 A little care every day</span> <span class="pill">🤝 Teens can join your team</span></p>
    <div class="card sentry"><div id="nbox"></div></div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">The nursery</h3><ul class="sentry-roster" id="nlist"></ul></div>`;
  const party = store.get('party') || {};
  const list = () => {
    $('#nlist', main).innerHTML = Object.entries(store.get('nursery') || {}).map(([id, b]) => { const who = party[id]; if (!who || !b) return '';
      return `<li>${b.stage === 0 ? eggHTML(b, 'mini') : `<img class="sface" src="${buddyFace(b)}" alt="">`}<span class="grow">${esc(who.nickname)}’s ${esc(b.stage === 0 ? 'egg' : (b.name ? `${b.name} (${BABIES[b.sp]?.name})` : BABIES[b.sp]?.name || 'buddy'))}<br><span class="small muted">${STAGES[b.stage]}${b.recruited ? ' · on the team' : caredToday(b) ? ' · cared for today' : ''}</span></span>
        ${gm ? `<button class="btn alt sm" data-nup="${esc(id)}">Grow</button><button class="btn alt sm" data-nreset="${esc(id)}">Reset</button>` : ''}</li>`; }).join('') || '<li class="muted">No eggs taken home yet.</li>';
    $$('[data-nup]', main).forEach((x) => x.onclick = () => { const b = buddyOf(x.dataset.nup); if (b && b.stage < 3) store.set(`nursery/${x.dataset.nup}`, { ...b, stage: b.stage + 1, grown: 0 }); renderNursery(main, g, gm, onEdit); });
    $$('[data-nreset]', main).forEach((x) => x.onclick = () => { if (confirm('Give this buddy back to the nursery? They can take a new egg.')) { store.set('nursery/' + x.dataset.nreset, null); renderNursery(main, g, gm, onEdit); } });
  };
  list();
  const box = $('#nbox', main);
  if (!c) box.innerHTML = '<p>Pick your character first (Play tab), then visit Beatrice.</p>';
  else room(c, box);
  const e = $('#ed', main); if (e) e.onclick = onEdit;
}

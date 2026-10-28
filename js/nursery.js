// Fernshade Nursery (her ask 10-27): a Tamagotchi-style buddy. Beatrice, the Beedrill den-mother of Fernshade Camp,
// gives each character an egg from the nursery. Keep it warm until it hatches, then feed it, play with it and keep it
// clean every day. Each day the buddy is fully cared for counts toward growing up: Egg → Baby → Kid → Teen.
// A teen can be asked to join the team (it goes on the GM checklist as a recruit).
// Stats drop in real time from when you last did each thing. State: nursery/<charId>.
// Her asks 10-27 (round 2): needs come up more often; tap the buddy and it walks up to the screen and a Yellow-style
// window shows how it feels; harsh weather changes its mood and adds a need (umbrella in sun or rain, blanket in hail or
// wind, the tent in a sandstorm); the room and its day follow the player's own clock (dawn, day, dusk, night).
// Follow-up: a bigger close-up, and sky over the room (coloured for the time of day, clouds by day, stars at night).
import * as store from './store.js?v=6ae164f4';
import { $, $$, esc, toast, num } from './util.js?v=6ae164f4';
import { me, logRoll } from './play.js?v=6ae164f4';
import { currentWeather, WEATHERS, wxFxHTML } from './weather.js?v=6ae164f4';
import { gameSay, gmTodo } from './chatter.js?v=6ae164f4';
import { markWinner } from './sparkle.js?v=6ae164f4';

export const isNursery = (g) => g.kind === 'nursery' || g.id === 'fernshade-nursery';

// baby sprites: assets/nursery/<key>.png, 10 frames wide, rows Idle / Hop / Sleep / Walk right / Walk left / Eat / Nod (fr = frames per row),
// cells cw×ch; faces in assets/portraits/emo/<key>/
const BABIES = {pichu: { name: 'Pichu', cw: 32, ch: 88, fr: [4, 10, 2, 8, 8, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, cleffa: { name: 'Cleffa', cw: 32, ch: 80, fr: [2, 10, 2, 8, 8, 2, 10], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, igglybuff: { name: 'Igglybuff', cw: 24, ch: 72, fr: [2, 10, 2, 5, 5, 2, 10], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, togepi: { name: 'Togepi', cw: 24, ch: 72, fr: [4, 10, 2, 6, 6, 4, 10], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, tyrogue: { name: 'Tyrogue', cw: 24, ch: 88, fr: [7, 10, 2, 4, 4, 4, 10], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, smoochum: { name: 'Smoochum', cw: 32, ch: 80, fr: [5, 10, 2, 4, 4, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, elekid: { name: 'Elekid', cw: 32, ch: 96, fr: [4, 10, 2, 4, 4, 4, 10], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, magby: { name: 'Magby', cw: 24, ch: 88, fr: [6, 10, 2, 4, 4, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, azurill: { name: 'Azurill', cw: 48, ch: 88, fr: [4, 10, 2, 7, 7, 4, 10], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, wynaut: { name: 'Wynaut', cw: 24, ch: 80, fr: [6, 10, 2, 8, 8, 6, 10], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, budew: { name: 'Budew', cw: 24, ch: 80, fr: [8, 10, 2, 8, 8, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, chingling: { name: 'Chingling', cw: 40, ch: 80, fr: [2, 10, 2, 9, 9, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, bonsly: { name: 'Bonsly', cw: 24, ch: 88, fr: [5, 10, 2, 4, 4, 5, 10], emo: ['Normal', 'Sad'] }, mimejr: { name: 'Mime Jr.', cw: 24, ch: 88, fr: [8, 10, 2, 10, 10, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, happiny: { name: 'Happiny', cw: 32, ch: 80, fr: [5, 10, 2, 8, 8, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, munchlax: { name: 'Munchlax', cw: 32, ch: 88, fr: [4, 10, 2, 4, 4, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, riolu: { name: 'Riolu', cw: 32, ch: 88, fr: [4, 10, 2, 4, 4, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }};
const STAGES = ['Egg', 'Baby', 'Kid', 'Teen'];
const DAYS_TO_GROW = [1, 2, 2]; // cared-for days to leave Egg, Baby, Kid
const NEEDS = { egg: { warm: 4 }, baby: { feed: 3, play: 3, clean: 2 } };
const RATE = { warm: 14, feed: 14, play: 12, clean: 8 }; // points lost per hour
const LABEL = { warm: ['🔥', 'Warmth', 'Keep warm'], feed: ['🍼', 'Food', 'Feed'], play: ['🎈', 'Fun', 'Play'], clean: ['🛁', 'Clean', 'Bath'] };

// the player's own local date and hour (her ask: match the user's time)
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const asleep = (h = new Date().getHours()) => h >= 21 || h < 6;
const tod = (h = new Date().getHours()) => (asleep(h) ? 'night' : h < 8 ? 'dawn' : h < 17 ? 'day' : 'dusk');
// harsh weather: [icon, stat name, button, what Beatrice says, what the buddy wants]. Azurill loves rain, Magby loves the sun.
const COVER = {
  sunny: ['⛱️', 'Shade', 'Umbrella', 'It’s so hot out!', 'an umbrella for some shade'], harsh: ['⛱️', 'Shade', 'Umbrella', 'It’s scorching out there!', 'an umbrella for some shade'],
  rain: ['☂️', 'Dry', 'Umbrella', 'It’s pouring!', 'an umbrella'], typhoon: ['☂️', 'Dry', 'Umbrella', 'This storm is so scary!', 'an umbrella'],
  hail: ['🧣', 'Cozy', 'Blanket', 'Brr, it’s hailing!', 'a warm blanket'], wind: ['🧣', 'Cozy', 'Blanket', 'The wind is so cold!', 'a warm blanket'],
  sandstorm: ['⛺', 'Sheltered', 'Tent', 'Sand is getting everywhere!', 'to hide in the tent'],
};
const LOVES = { azurill: ['rain', 'typhoon'], magby: ['sunny', 'harsh'] };
const wx = () => currentWeather();
const coverNeed = (b) => { const k = wx().key; return b && b.stage > 0 && COVER[k] && !(LOVES[b.sp] || []).includes(k) ? k : null; };
const lab = (k) => (k === 'cover' ? COVER[wx().key] || ['☂️', 'Cover', 'Cover'] : LABEL[k]);
const buddyOf = (id) => store.get('nursery/' + id) || null;
const stat = (b, k) => k === 'cover' ? (b.coverBlock === wx().block ? 100 : 0) : Math.max(0, Math.min(100, Math.round(100 - (Date.now() - num(b[k + 'At'])) / 3600e3 * RATE[k])));
const needsOf = (b) => (b.stage === 0 ? NEEDS.egg : { ...NEEDS.baby, ...(coverNeed(b) ? { cover: 1 } : {}) });
const todayOf = (b) => (b.days || {})[today()] || {};
const caredToday = (b) => Object.entries(needsOf(b)).every(([k, n]) => num(todayOf(b)[k]) >= n);
// the daily chore is done once every need got some care today (or is still full, so it can't take more) and nothing is running low (her report 10-27: the full 3/3/2 count is for
// growing up, and a full buddy refuses more care, so it kept the chore open after she'd looked after it)
export const nurseryDue = () => { const c = me(); if (!c) return false; const b = buddyOf(c.id); return !b || (!b.recruited && b.stage < 3 && Object.keys(needsOf(b)).some((k) => stat(b, k) < 40 || (!num(todayOf(b)[k]) && stat(b, k) < 90))); };

const BEA = { wait: ['Normal'], happy: ['Happy', 'Joyous'], worry: ['Worried', 'Sad'], proud: ['Inspired', 'Joyous'] };
const beaFace = (mood) => { const have = ['Normal', 'Happy', 'Joyous', 'Sad', 'Worried', 'Inspired', 'Surprised', 'Determined', 'Sigh']; return `assets/portraits/emo/beedrill/${(BEA[mood] || []).find((e) => have.includes(e)) || 'Normal'}.png`; };
const bea = (mood, line) => `<div class="sentry-digg"><img class="sface dig" src="${beaFace(mood)}" alt="Beatrice"><div class="bubble"><b>Beatrice:</b> “${esc(line)}”</div></div>`;
// how the buddy feels right now: a face from its portrait set + a line for the feelings window
function feeling(b) {
  const n = nameOf(b); const k = wx().key; const cv = coverNeed(b);
  const low = Object.keys(needsOf(b)).filter((x) => x !== 'cover' && stat(b, x) < 40).sort((p, q) => stat(b, p) - stat(b, q));
  const avg = Object.keys(NEEDS.baby).reduce((s, x) => s + stat(b, x), 0) / Object.keys(NEEDS.baby).length;
  if (asleep()) return [['Normal'], `${n} is fast asleep. Shh…`];
  if (cv && stat(b, 'cover') < 50) return [['Worried', 'Teary-Eyed', 'Sad'], `${COVER[k][3]} ${n} wants ${COVER[k][4]}.`];
  if (low.length && stat(b, low[0]) < 15) return [['Crying', 'Teary-Eyed', 'Sad'], { feed: `${n} is SO hungry…`, play: `${n} is bored and lonely…`, clean: `${n} feels all grubby and itchy…` }[low[0]]];
  if (low[0] === 'feed') return [['Sad', 'Worried'], `${n}’s tummy is rumbling.`];
  if (low[0] === 'play') return [['Sad', 'Worried'], `${n} wants to play!`];
  if (low[0] === 'clean') return [['Worried', 'Sad'], `${n} could use a bath.`];
  if ((LOVES[b.sp] || []).includes(k)) return [['Joyous', 'Inspired', 'Happy'], `${n} LOVES the ${WEATHERS[k].name.toLowerCase()}!`];
  if (cv) return [['Happy'], `${n} is snug and safe from the ${WEATHERS[k].name.toLowerCase()}.`];
  if (avg >= 75) return [['Joyous', 'Happy'], `${n} is overjoyed to see you!`];
  if (avg >= 45) return [['Happy', 'Normal'], `${n} is happy.`];
  return [['Sad', 'Normal'], `${n} feels a little down.`];
}
const faceOf = (b, want) => { const B = BABIES[b.sp]; return B ? `assets/portraits/emo/${b.sp}/${want.find((e) => B.emo.includes(e)) || 'Normal'}.png` : ''; };
const buddyFace = (b) => faceOf(b, feeling(b)[0]);
// ---- the living pet (her ask 10-27: feel like a little virtual pet). The buddy wanders the room on its own, hops when
// happy, naps at night, shows a thought bubble when it needs something, and acts out each care action:
// feed = a berry drops in and it walks over to eat it; play = it chases a bouncing ball; bath = bubbles, then a shake-off.
const S = 3; const ROW = { idle: 0, hop: 1, sleep: 2, right: 3, left: 4, eat: 5, nod: 6 };
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const petHTML = () => '<div class="pet" id="npet"><span class="pet-cover"></span><span class="baby-spr"></span><span class="pet-think"></span></div><div class="props"></div>';
function startPet(root, b, scene) {
  const B = BABIES[b.sp]; const roomEl = $('.nursery-room', root); const pet = $('#npet', root); if (!B || !roomEl || !pet) return;
  const spr = $('.baby-spr', pet); const think = $('.pet-think', pet); const cov = $('.pet-cover', pet); const props = $('.props', root);
  const pw = B.cw * S;
  spr.style.cssText = `width:${pw}px;height:${B.ch * S}px;background-image:url(assets/nursery/${b.sp}.png);background-size:${B.cw * 10 * S}px ${B.ch * 7 * S}px`;
  pet.style.width = pw + 'px'; pet.style.bottom = Math.round(64 - B.ch * S / 2) + 'px';
  const alive = () => roomEl.isConnected;
  const row = (name, loop = true, secs = null) => {
    const r = ROW[name]; const n = B.fr[r] || 1;
    spr.style.backgroundPositionY = `-${r * B.ch * S}px`; spr.style.setProperty('--fw', pw + 'px'); spr.style.setProperty('--n', n);
    spr.style.animation = 'none'; void spr.offsetWidth;
    spr.style.animation = `baby-anim ${secs || Math.max(0.4, n * 0.12)}s steps(${n}, jump-none) ${loop ? 'infinite' : '1 forwards'}`;
  };
  let x = Math.max(10, roomEl.clientWidth * 0.5 - pw / 2);
  const maxX = () => Math.max(10, roomEl.clientWidth - pw - 10);
  pet.style.left = x + 'px';
  const fx = (ch, dx = 0) => { const e = document.createElement('span'); e.className = 'pet-fx'; e.textContent = ch; e.style.left = (x + pw / 2 - 12 + dx) + 'px'; roomEl.appendChild(e); setTimeout(() => e.remove(), 1400); };
  const walkTo = async (tx, sp = 75) => {
    tx = Math.max(10, Math.min(maxX(), tx)); const d = Math.abs(tx - x); if (d < 4) return;
    row(tx > x ? 'right' : 'left'); pet.style.transition = `left ${(d / sp).toFixed(2)}s linear`; pet.style.left = tx + 'px'; x = tx;
    await wait(d / sp * 1000); row('idle');
  };
  const mood = () => { const k = Object.keys(needsOf(b)); return k.reduce((t, n) => t + stat(b, n), 0) / k.length; };
  const need = () => { const low = Object.keys(needsOf(b)).filter((n) => stat(b, n) < 40).sort((p, q) => stat(b, p) - stat(b, q))[0]; return low ? lab(low)[0] : ''; };
  let busy = false;
  // tap: it walks up to the screen and the feelings window (like Pikachu's in Pokémon Yellow) shows how it feels
  pet.onclick = async () => {
    if (busy) return; busy = true; think.className = 'pet-think';
    const [want, text] = feeling(b); const sleeping = asleep();
    if (!sleeping) await walkTo(roomEl.clientWidth / 2 - pw / 2, 260); // hurries over when tapped
    if (!alive()) return;
    if (!sleeping) { row('idle'); pet.classList.add('close'); }
    // her ask: the window looks like Pikachu's frames in Pokémon Yellow (square double-line frame with corner knobs,
    // a mood mark over the head) and nearly fills the nursery room
    const sym = sleeping ? 'z Z' : /Joyous|Happy|Inspired/.test(want[0]) ? '♥' : /Crying|Teary/.test(want[0]) ? '…' : /Sad|Worried/.test(want[0]) ? '?' : '♪';
    roomEl.insertAdjacentHTML('beforeend', `<div class="emo-pane yf" role="status"><div class="yf-pic"><span class="yf-sym ${sym === '♥' ? 'heart' : ''}">${sym}</span><img src="${faceOf(b, want)}" alt=""></div><p>${esc(text)}</p></div>`);
    const pane = $('.emo-pane', roomEl);
    await Promise.race([wait(4200), new Promise((ok) => { pane.onclick = ok; })]);
    pane.classList.add('bye'); pet.classList.remove('close'); setTimeout(() => pane.remove(), 300);
    if (!sleeping) { await wait(450); fx('💕', -14); fx('💗', 14); row('nod', false); await wait(900); row('idle'); } else row('sleep', true, 1.6);
    busy = false;
  };
  const scenes = {
    async feed() {
      const berry = ['oran', 'sitrus', 'pecha', 'leppa'][Math.floor(Math.random() * 4)];
      const bx = Math.max(20, Math.min(maxX() + pw / 2 - 20, x + pw + 30 > maxX() ? x - 50 : x + pw + 30));
      props.innerHTML = `<img class="prop drop" src="assets/items/${berry}-berry.png" alt="" style="left:${bx}px">`;
      await wait(650); await walkTo(bx - pw / 2 + 16);
      row('eat', true); $('.prop', props)?.classList.add('eaten'); fx('😋'); await wait(900); fx('💕', 10); await wait(1300);
      props.innerHTML = ''; row('hop', false); await wait(700); row('idle');
    },
    async play() {
      props.innerHTML = '<span class="ball-wrap"><img class="prop ball" src="assets/nursery/ball.png" alt=""></span>';
      const ball = $('.ball-wrap', props);
      for (let i = 0; i < 3 && alive(); i++) {
        const tx = i % 2 ? 20 : maxX(); ball.style.left = (tx + pw / 2 - 18) + 'px';
        await wait(150); await walkTo(tx); row('hop', false); fx(i === 2 ? '💕' : '♪'); await wait(650);
      }
      props.innerHTML = ''; row('nod', false); await wait(800); row('idle');
    },
    async clean() {
      row('idle'); const bub = Array.from({ length: 16 }, (_, i) => `<i style="left:${x - 10 + Math.random() * (pw + 20)}px;animation-delay:${(i * 0.12).toFixed(2)}s;--s:${(0.6 + Math.random() * 0.9).toFixed(2)}"></i>`).join('');
      props.innerHTML = `<div class="suds">${bub}</div>`; await wait(2200);
      pet.classList.add('shake'); props.innerHTML = `<div class="drops">${Array.from({ length: 10 }, (_, i) => `<i style="left:${x + pw / 2}px;--a:${i * 36}deg"></i>`).join('')}</div>`;
      await wait(800); pet.classList.remove('shake'); props.innerHTML = ''; fx('✨', -16); fx('✨', 16); row('hop', false); await wait(700); row('idle');
    },
    async cover() { cov.textContent = lab('cover')[0]; cov.classList.add('show', 'pop'); row('hop', false); fx('💕'); await wait(800); cov.classList.remove('pop'); row('idle'); },
    async grew() { row('hop', false); fx('✨'); await wait(700); row('hop', false); fx('🎉'); await wait(700); row('idle'); },
  };
  // free time: wander, hop, nod, nap
  const life = async () => {
    while (alive()) {
      if (busy) { await wait(400); continue; }
      const h = new Date().getHours(); const m = mood(); const ic = need();
      think.className = 'pet-think' + (ic ? ' show' : ''); think.textContent = ic;
      const cv = coverNeed(b) && stat(b, 'cover') >= 50; cov.textContent = cv ? lab('cover')[0] : ''; cov.classList.toggle('show', !!cv);
      if (asleep(h)) { row('sleep', true, 1.6); think.className = 'pet-think show zz'; think.textContent = 'z Z'; await wait(5000); continue; }
      const r = Math.random();
      if (r < 0.4) await walkTo(10 + Math.random() * maxX());
      else if (r < 0.55 && m >= 60) { row('hop', false); if (Math.random() < 0.5) fx('♪'); await wait(800); row('idle'); }
      else if (r < 0.65) { row('nod', false); await wait(900); row('idle'); }
      else if (r < 0.72 && m >= 50) { row('sleep', true, 1.6); await wait(3500); row('idle'); }
      else { row('idle'); await wait(1500 + Math.random() * 2000); }
    }
  };
  row('idle');
  (async () => { if (scene && scenes[scene]) { busy = true; think.className = 'pet-think'; await wait(200); await scenes[scene](); busy = false; } })().then(life);
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
  if (stat(b, k) >= 90) return k === 'cover' ? `${nameOf(b)} is already safe from the weather.` : k === 'feed' ? `${nameOf(b)} is full!` : k === 'play' ? `${nameOf(b)} is all played out. Let it rest a bit.` : k === 'clean' ? 'Already squeaky clean!' : 'It’s nice and toasty already.';
  const d = today(); const day = { ...todayOf(b) }; day[k] = num(day[k]) + 1;
  const next = { ...b, [k + 'At']: Date.now(), ...(k === 'cover' ? { coverBlock: wx().block } : {}), days: { ...(b.days || {}), [d]: day } };
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
      <div class="nursery-room tod-${tod()}"><div class="n-sky" aria-hidden="true"><i></i><i></i><i></i></div>${wxFxHTML(wx().key)}${nestHTML(eggHTML({ sp: '' }))}</div><button class="btn block" id="nadopt">Take an egg home 🥚</button></div>`;
    $('#nadopt', box).onclick = () => { adopt(c); room(c, box, 'new'); };
    return;
  }
  const B = BABIES[b.sp]; const egg = b.stage === 0; const needs = needsOf(b); const day = todayOf(b);
  const cared = caredToday(b); const left = b.stage < 3 ? DAYS_TO_GROW[b.stage] - num(b.grown) : 0;
  const low = Object.keys(needs).filter((k) => k !== 'cover' && stat(b, k) < 30); const cv = coverNeed(b) && stat(b, 'cover') < 50 ? COVER[wx().key] : null;
  const line = b.recruited ? `${B.name} is part of your team now. I’m so proud of you both!`
    : b.stage === 3 ? `Look how big ${nameOf(b)} has grown! I think ${B.name} would follow you anywhere. Why not ask?`
    : anim === 'grew' ? (b.stage === 1 ? `It hatched! Say hello to your ${B.name}, ${c.nickname}!` : `${nameOf(b)} is a ${STAGES[b.stage].toLowerCase()} now!`)
    : cv ? `${cv[3]} Quick, ${nameOf(b)} wants ${cv[4]}!`
    : low.length ? `${nameOf(b)} needs you: ${low.map((k) => LABEL[k][1].toLowerCase()).join(' and ')} is low!`
    : cared ? `All done for today. ${nameOf(b)} is happy and growing!` : egg ? 'Keep it warm, three times a day. I can hear it wiggling!' : 'Feed, play and bath time. A little every day!';
  box.innerHTML = `<div class="nursery">
    ${bea(b.recruited || b.stage === 3 ? 'proud' : low.length || cv ? 'worry' : 'happy', line)}
    <div class="nursery-room tod-${tod()} ${egg ? 'is-egg' : ''}"><div class="n-sky" aria-hidden="true"><i></i><i></i><i></i></div>${wxFxHTML(wx().key)}
      ${egg ? nestHTML(eggHTML(b, anim === 'warm' ? 'wiggle' : '')) : `<div class="nest-spot">${nestHTML('')}</div>${petHTML()}`}
      ${anim === 'grew' ? '<span class="n-burst">✨</span>' : ''}${egg && anim === 'warm' ? '<span class="n-fx">🔥</span>' : ''}
    </div>
    <div class="n-head">${egg ? '' : `<img class="sface" src="${buddyFace(b)}" alt="">`}<div class="grow"><b>${esc(b.name || (egg ? 'Mystery egg' : B.name))}</b> <span class="pill">${STAGES[b.stage]}</span>
      <div class="small muted">${b.stage < 3 ? `${left} more cared-for day${left === 1 ? '' : 's'} to grow` : b.recruited ? 'On your team' : 'Ready to join a team!'}</div></div>
      ${egg ? '' : '<button class="btn alt sm" id="nname">Name</button>'}</div>
    <div class="n-stats">${Object.keys(needs).map((k) => { const v = stat(b, k); return `<div class="n-stat"><span>${lab(k)[0]} ${lab(k)[1]}</span><div class="n-bar ${v < 30 ? 'low' : ''}"><i style="width:${v}%"></i></div><span class="small muted">${k === 'cover' ? (v ? 'safe now' : 'needed now') : `${Math.min(num(day[k]), needs[k])}/${needs[k]} today`}</span></div>`; }).join('')}</div>
    ${b.recruited ? '<button class="btn alt block" id="nnew">Take a new egg home 🥚</button>' : b.stage === 3 ? `<p class="small" style="text-align:center;margin:4px 0">${esc(nameOf(b))} is all grown up. What will you do?</p><div class="n-choice"><button class="btn" id="nrecruit">🤝 Ask ${esc(nameOf(b))} to join the team</button><button class="btn alt" id="nwild">🌿 Let ${esc(nameOf(b))} go into the wild</button></div>`
      : `<div class="n-acts">${Object.keys(needs).map((k) => `<button class="btn ${(k === 'cover' ? stat(b, k) : num(day[k]) >= needs[k]) ? 'alt' : ''}" data-nact="${k}">${lab(k)[0]} ${lab(k)[2]}</button>`).join('')}</div>`}
    ${cared && b.stage < 3 ? '<p class="small" style="text-align:center;color:#2f6d2b">✅ Fully cared for today</p>' : ''}</div>`;
  if (!egg) startPet(box, b, anim);
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
  // her ask 10-27: a grown teen can also be set free; then the nursery has room for a new egg
  const wild = $('#nwild', box); if (wild) wild.onclick = () => {
    if (!confirm(`Let ${nameOf(b)} go into the wild? You can take a new egg home afterwards.`)) return;
    store.pushLimited('log', { t: Date.now(), text: `${c.nickname} let their nursery ${B.name}${b.name ? ` “${b.name}”` : ''} go into the wild.` });
    gameSay('Beatrice', 'say', `${c.nickname}’s ${B.name} flew the nest today, off to explore the wild. Safe travels, little one!`, 'nursery', c.nickname);
    logRoll(c.nickname, 'Fernshade Nursery', null, `let ${B.name} go into the wild`, 'note');
    store.set('nursery/' + c.id, null);
    box.innerHTML = `<div class="sentry-end">${bea('happy', `${nameOf(b)} looked back once, then ran off into the trees. You raised it well, ${c.nickname}. Whenever you’re ready, there’s another egg waiting.`)}<button class="btn block" id="nagain">Visit the nursery again</button></div>`;
    $('#nagain', box).onclick = () => room(c, box);
  };
  const nn = $('#nnew', box); if (nn) nn.onclick = () => { if (confirm(`${nameOf(b)} stays on your team. Take a new egg home to raise?`)) { adopt(c); room(c, box, 'new'); } };
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

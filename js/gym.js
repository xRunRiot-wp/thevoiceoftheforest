// Training Gym (#/gym): one drill per day per character. Drills roll Attribute + Skill; the character's nature
// loves one drill (+1 die, +1 progress) and hates one (−1 die, costs 1 Will). A full bar (5) pays 1 Training Point;
// the GM decides when Training Points become stat raises.
import * as store from './store.js?v=6ae14856';
import { $, $$, esc, num, pool } from './util.js?v=6ae14856';
import { modal, diceFaces } from './ui.js?v=6ae14856';
import { statVal, logRoll } from './play.js?v=6ae14856';
import { myId } from './app.js?v=6ae14856';
import { currentWeather, WEATHERS, showWeather, wxFxHTML, wxIconHTML } from './weather.js?v=6ae14856';
import { RESIDENTS } from './chatter.js?v=6ae14856';

const BAR = 5;
export const DRILLS = [
  { id: 'boulder', icon: '💪', name: 'Boulder Push', attr: 'Strength', skill: 'Brawl', text: 'Shove a boulder up the training ramp without letting it roll back.' },
  { id: 'agility', icon: '💨', name: 'Agility Course', attr: 'Dexterity', skill: 'Evasion', text: 'Weave through swinging logs and leap the stepping stones.' },
  { id: 'waterfall', icon: '🌊', name: 'Waterfall Endurance', attr: 'Vitality', skill: 'Athletic', text: 'Stand firm under the pounding waterfall as long as you can.' },
  { id: 'targets', icon: '🎯', name: 'Focus Targets', attr: 'Special', skill: 'Channel', text: 'Channel your power and hit the targets across the clearing.' },
  { id: 'meditation', icon: '🧘', name: 'Meditation Rock', attr: 'Insight', skill: 'Alert', text: 'Sit still on the rock, sense every sound and keep your mind calm.' },
  { id: 'contest', icon: '🎀', name: 'Contest Stage', attr: 'best social', skill: 'Perform', text: 'Show off your best side to a crowd of practice judges.' },
];
// nature → [loved stat, hated stat] (the games' +/− stats: Attack=Strength, Defense=Vitality, Sp. Atk=Special, Sp. Def=Insight, Speed=Dexterity)
const NATURE_STATS = {
  Lonely: ['Strength', 'Vitality'], Brave: ['Strength', 'Dexterity'], Adamant: ['Strength', 'Special'], Naughty: ['Strength', 'Insight'],
  Bold: ['Vitality', 'Strength'], Relaxed: ['Vitality', 'Dexterity'], Impish: ['Vitality', 'Special'], Lax: ['Vitality', 'Insight'],
  Timid: ['Dexterity', 'Strength'], Hasty: ['Dexterity', 'Vitality'], Jolly: ['Dexterity', 'Special'], Naive: ['Dexterity', 'Insight'],
  Modest: ['Special', 'Strength'], Mild: ['Special', 'Vitality'], Quiet: ['Special', 'Dexterity'], Rash: ['Special', 'Insight'],
  Calm: ['Insight', 'Strength'], Gentle: ['Insight', 'Vitality'], Sassy: ['Insight', 'Dexterity'], Careful: ['Insight', 'Special'],
};
const SOCIALS = ['Tough', 'Cool', 'Beauty', 'Cute', 'Clever'];
// a line from the coach for the character's first type
const TYPE_FLAVOR = {
  Fire: 'The coach lights the lava pits along the edge. Fire types train hotter!', Water: 'The coach opens the sluice so the river runs fast. Water types love this.',
  Grass: 'Vines hang over the course for Grass types to swing on.', Electric: 'The coach charges the metal posts. Electric types feel right at home.',
  Ghost: 'The lanterns dim and the course turns spooky. Ghost types fade in and out of the drills.', Rock: 'Extra boulders are stacked up for Rock types.',
  Ground: 'The sand pit is churned up deep for Ground types.', Steel: 'Heavy iron weights are set out for Steel types.', Fairy: 'Sparkles drift over the course. Fairy types train with a little extra charm.',
  Dragon: 'The coach clears space. Dragon types need room to roar.', Fighting: 'The punching bags are hung up. Fighting types get straight to work.',
  Psychic: 'Floating stones hover over the clearing for Psychic types.', Ice: 'A frosty corner is set up for Ice types.', Flying: 'Wind poles flap on the high ground for Flying types.',
  Bug: 'Tiny obstacle tunnels are laid out for Bug types.', Poison: 'Murky bog lanes are marked out for Poison types.', Dark: 'The night course is lit only by moonlight for Dark types.',
  Normal: 'The classic course is ready. Normal types can do it all.',
};
const STORY = [
  'Nothing clicks today. You stumble, catch your breath and learn what not to do.',
  'A rough session, but you push through a little further than yesterday.',
  'Solid work! You can feel yourself getting stronger.',
  'Amazing! The coach stops to watch. That was your best yet!',
];

// ---- weather: bad weather moves the outdoor drills inside; storms cost everyone a die (except types at home in it)
const BAD = { rain: 1, fog: 1, wind: 1, sandstorm: 2, hail: 2, harsh: 2, typhoon: 2 };   // 2 = severe
const AT_HOME = { sandstorm: ['Rock', 'Ground', 'Steel'], hail: ['Ice'], harsh: ['Fire'], typhoon: ['Water'] };
const PERK = { rain: 'Water', typhoon: 'Water', sandstorm: 'Rock', hail: 'Ice', harsh: 'Fire', wind: 'Flying', fog: 'Ghost' };
const INDOOR = {
  agility: { name: 'Tunnel Crawl', skill: 'Stealth', text: 'The course is a mess, so the coach sends everyone racing through the guild tunnels instead.' },
  waterfall: { name: 'Plunge Pool', text: 'Too wild outside. Hold steady in the cave pool while the coach counts.' },
  targets: { name: 'Candle Targets', text: 'Indoors: snuff the candle flames from across the room without knocking a single candle over.' },
  contest: { name: 'Rainy Day Rehearsal', text: 'Rehearse in the mess hall while the weather howls outside.' },
};
function gymWx() { const w = currentWeather(); return { key: w.key, w: WEATHERS[w.key] || {}, lvl: BAD[w.key] || 0, next: w.next }; }
const drillNow = (d, wx = gymWx()) => (wx.lvl && INDOOR[d.id] ? { ...d, ...INDOOR[d.id], indoor: true } : d);
const types = (c) => [c.type1, c.type2].filter(Boolean);
function wxDice(c, wx = gymWx()) {
  let n = 0;
  if (PERK[wx.key] && types(c).includes(PERK[wx.key])) n += 1;
  if (wx.lvl === 2 && !types(c).some((t) => (AT_HOME[wx.key] || []).includes(t))) n -= 1;
  return n;
}
function wxNoteHTML(c, wx) {
  if (!wx.lvl && !PERK[wx.key]) return '';
  const moved = Object.keys(INDOOR).map((id) => `${DRILLS.find((d) => d.id === id).name} → ${INDOOR[id].name}`).join(' · ');
  const bits = [];
  if (wx.lvl) bits.push(`Training has moved indoors: ${moved}.`);
  if (wx.lvl === 2) bits.push(`The storm shakes everyone: −1 die on every drill${AT_HOME[wx.key] ? ` (except ${AT_HOME[wx.key].join(', ')} types)` : ''}.`);
  if (PERK[wx.key]) bits.push(`${PERK[wx.key]} types feel right at home: +1 die.`);
  const mine = wxDice(c, wx);
  return `<div class="card gym-wx ${wx.lvl === 2 ? 'severe' : ''}"><b>${wx.w.icon || ''} ${esc(wx.w.name || '')} at the gym</b><p class="small" style="margin:4px 0 0">${esc(bits.join(' '))}${mine ? ` <b>${esc(c.nickname)}: ${mine > 0 ? '+' : ''}${mine} die today.</b>` : ''}</p></div>`;
}

// ---- gym chat: the guild's own members (never player characters) react to the coach and their drills; new lines every 3 hours
const COACH = () => store.get('gym/coach') || 'Coach Hariyama';
const MEMBERS = ['Diglett', 'Mimi', 'Kippy', 'Bramble the Scolipede', 'Abra', 'Ralts', 'Beedrill (camp caretaker)'];
const SHORT = { 'Bramble the Scolipede': 'Bramble', 'Beedrill (camp caretaker)': 'Beedrill' };
const COACH_GOOD = ['Warm up! Ten laps of the clearing, and I want to hear you counting!', 'Today we work on the {d}. Nobody leaves until they beat yesterday.', 'Form first, power second. Show me slow and perfect.', 'Great weather for sweat! Line up for the {d}!', 'Water break in five. Then the {d} again, twice as fast.'];
const COACH_BAD = ['{w} outside, so we train inside. No complaining, the tunnels build character!', 'Nobody goes near the cliffs in this {w}. Everyone to the {d}, indoors!', 'A real explorer trains in any weather. But not in THIS weather. Inside, now.', 'Listen to that {w}. That is the sound of you getting tougher in here.'];
const COACH_END = ['Good work today. Stretch, eat, sleep. Same time tomorrow.', 'Not bad! I saw real progress on the {d}.', 'Whoever left the boulder at the bottom of the ramp: I know it was you.', 'Hydrate! A tired explorer is a lost explorer.'];
const WHINE = ['My legs are jelly. Is the {d} supposed to feel like this?', 'I think the {d} hates me personally.', 'Coach, can we do the {d} tomorrow instead? Asking for a friend.', 'Five more minutes... the coach said five more minutes an hour ago.', 'If I fall asleep on the {d}, just roll me home.'];
const FOCUS = ['Okay. Breathe. One more round of the {d}.', 'Beat my best time on the {d}! Did anyone see that?', 'I am not stopping until the {d} is easy.', 'Quiet, please. I am concentrating on the {d}.', 'Again! I almost had it that time!'];
const WHINE_BAD = ['It is so damp in here. Even my snacks are soggy.', 'I miss the sky. The tunnels smell like old socks.', 'Every time the thunder booms I drop my weights.', 'Indoor training means no breeze. I am melting.'];
const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
function slotOf(t = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const h = Number(p.hour); const m = Number(p.minute);
  return { key: `${p.year}-${p.month}-${p.day}#${Math.floor(h / 3)}`, next: t + ((3 - (h % 3)) * 60 - m) * 60e3 };
}
function gymChat(wx) {
  const { key, next } = slotOf();
  const r = (i) => hash(`${store.tableCode()}|gym|${key}|${i}`);
  const pick = (arr, i) => arr[Math.floor(r(i) * arr.length)];
  const who = [...MEMBERS].sort((a, b) => r('m' + a) - r('m' + b)).slice(0, 4);
  // every member is on their own drill this slot, and their lines are about that drill
  const drills = [...DRILLS].sort((a, b) => r('d' + a.id) - r('d' + b.id)).map((d) => drillNow(d, wx));
  const wname = (wx.w.name || 'weather').toLowerCase();
  const fill = (txt, d) => txt.replace('{d}', d.name).replace('{w}', wname);
  const lines = [{ who: COACH(), text: fill(pick(wx.lvl ? COACH_BAD : COACH_GOOD, 1), drills[0]) }];
  const used = new Set();
  who.forEach((m, i) => {
    const list = wx.lvl && r(10 + i) < 0.4 ? WHINE_BAD : r(20 + i) < 0.5 ? WHINE : FOCUS;
    let k = Math.floor(r(30 + i) * list.length);
    for (let tries = 0; used.has(list[k]) && tries < list.length; tries++) k = (k + 1) % list.length;   // no two members say the same thing
    used.add(list[k]);
    lines.push({ who: m, drill: drills[i], text: fill(list[k], drills[i]) });
  });
  lines.push({ who: COACH(), text: fill(pick(COACH_END, 50), drills[Math.floor(r(51) * who.length)]) });
  return { lines, roster: who.map((m, i) => [m, drills[i]]), next };
}
function faceOf(name) {
  const r = name === COACH() ? { img: 'assets/portraits/hariyama.png' } : RESIDENTS[name] || {};
  return r.img ? `<span class="gc-face"><img src="${r.img}" alt=""></span>` : `<span class="gc-face">${r.icon || '💬'}</span>`;
}
const drillChip = (d) => `<span class="gc-drill${d.indoor ? ' indoor' : ''}">${d.icon} ${esc(d.name)}${d.indoor ? ' 🏠' : ''}</span>`;
function gymChatHTML(wx) {
  const { lines, roster, next } = gymChat(wx);
  const at = new Date(next).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `<div class="card gym-chat"><div class="row" style="justify-content:space-between"><h3 style="margin:0">💬 Gym chatter</h3><span class="small muted">new chatter at ${at}${store.gmUnlocked() ? ' · <a href="#" id="gcoach">rename coach</a>' : ''}</span></div>
    <div class="gc-board"><b class="small">📋 On the drills right now</b>${roster.map(([m, d]) => `<div class="gc-slot">${faceOf(m)}<span><b>${esc(SHORT[m] || m)}</b>${drillChip(d)}</span></div>`).join('')}</div>
    ${lines.map((l) => `<div class="gc-line ${l.who === COACH() ? 'coach' : ''}">${faceOf(l.who)}<div><b>${esc(SHORT[l.who] || l.who)}</b>${l.drill ? ' ' + drillChip(l.drill) : ''}<p>${esc(l.text)}</p></div></div>`).join('')}</div>`;
}
// the weather beside the chatter: what the sky is doing and what it means for training
function gymWxHTML(c, wx) {
  const cw = currentWeather();
  const at = new Date(cw.next).toLocaleString([], { ...(cw.next - Date.now() > 12 * 3600e3 ? { weekday: 'short' } : {}), hour: 'numeric', minute: '2-digit' });
  const says = wx.lvl === 2 ? 'A storm! Everyone trains indoors and loses a die.' : wx.lvl ? 'Bad weather. The outdoor drills have moved inside.' : 'Good training weather. Every drill runs outside.';
  const mine = wxDice(c, wx);
  return `<div class="fortune gym-wxw">${wxFxHTML(wx.key)}<div class="ft-top">✦ Gym Weather ✦</div>
    <div class="ft-orb" aria-hidden="true">${wxIconHTML(wx.key)}</div><div class="ft-name">${esc(wx.w.name || '')}</div>
    <div class="ft-say">${esc(says)}</div>
    ${PERK[wx.key] ? `<p class="small ft-none">${esc(PERK[wx.key])} types +1 die.</p>` : ''}
    ${mine ? `<p class="small ft-none"><b>${esc(c.nickname)}: ${mine > 0 ? '+' : ''}${mine} die today.</b></p>` : ''}
    <p class="small ft-none">Next reading ${esc(at)}${cw.gm ? ' (set by the GM)' : ''}</p>
    <button class="ft-more" id="gwxinfo">Read the full fortune ›</button></div>`;
}

const easternDay = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t));
const party = () => store.get('party') || {};
export function natureLikes(nature) {
  const [up, down] = NATURE_STATS[nature] || [];
  return { loved: DRILLS.find((d) => d.attr === up)?.id || '', hated: DRILLS.find((d) => d.attr === down)?.id || '' };
}
const drillAttr = (c, d) => (d.attr === 'best social' ? SOCIALS.reduce((b, s) => (statVal(c, s) > statVal(c, b) ? s : b), SOCIALS[0]) : d.attr);
function drillDice(c, d) {
  const { loved, hated } = natureLikes(c.nature);
  const base = statVal(c, drillAttr(c, d)) + statVal(c, d.skill);
  return Math.max(1, base + (d.id === loved ? 1 : 0) - (d.id === hated ? 1 : 0) + wxDice(c));
}
const trainedToday = (c) => c.gym?.day === easternDay(Date.now());

export function renderGym(main) {
  const gm = store.gmUnlocked();
  const c = party()[myId()];
  const head = `<div class="row" style="margin-top:12px"><a class="btn alt sm" href="#/guild">← Guild</a></div>
    <div class="hero banner"><img class="hdr" src="assets/headers/wigglytuff_guild.png" alt=""></div>
    <div class="section-title"><h2>🏋️ Training Gym</h2><span class="small muted">one drill a day · a full bar = 1 Training Point</span></div>`;
  if (!c) { main.innerHTML = head + '<div class="card"><p>Pick your character on the Play page first, then come back to train.</p><a class="btn" href="#/join">Choose a character</a></div>'; return; }
  const { loved, hated } = natureLikes(c.nature);
  const done = trainedToday(c);
  const wx = gymWx();
  const lname = (id) => drillNow(DRILLS.find((d) => d.id === id) || {}, wx).name;
  main.innerHTML = head + `
    <div class="card gym-who"><div class="grow"><b class="pix">${esc(c.nickname)}</b> <span class="small muted">${esc(c.pokemon || '')} · ${esc(c.nature || 'no nature')} · ${num(c.tp)} Training Points</span>
      <p class="small" style="margin:4px 0 0">${loved ? `💖 Loves <b>${esc(lname(loved))}</b> · 💢 Hates <b>${esc(lname(hated))}</b>` : `${esc(c.nature || 'This nature')} has no favourite. Every drill feels the same.`}</p>
      ${TYPE_FLAVOR[c.type1] ? `<p class="small muted" style="margin:4px 0 0">🗣️ ${esc(TYPE_FLAVOR[c.type1])}</p>` : ''}</div>
      <div class="gym-today ${done ? 'rested' : ''}">${done ? '😴 Trained today<br><small>back tomorrow</small>' : '💪 Ready to train'}</div></div>
    ${wxNoteHTML(c, wx)}
    <div class="gym-grid">${DRILLS.map((d0) => { const d = drillNow(d0, wx);
      const prog = num(c.gym?.bars?.[d.id]); const dice = drillDice(c, d); const tag = d.id === loved ? 'loved' : d.id === hated ? 'hated' : '';
      return `<div class="gym-card ${tag} ${d.indoor ? 'indoor' : ''}"><div class="gym-top"><span class="gym-ic">${d.icon}</span><div class="grow"><b>${esc(d.name)}${d.indoor ? ' <span class="gym-in">🏠 indoors</span>' : ''}</b><small>${esc(drillAttr(c, d))} + ${esc(d.skill)} · ${dice} ${dice === 1 ? 'die' : 'dice'}</small></div>
        ${tag ? `<span class="gym-tag">${tag === 'loved' ? '💖 Loves it' : '💢 Hates it'}</span>` : ''}</div>
        <p class="small">${esc(d.text)}${tag === 'loved' ? ' <b>+1 die, +1 progress.</b>' : tag === 'hated' ? ' <b>−1 die, costs 1 Will.</b>' : ''}</p>
        <div class="gym-bar" title="${prog}/${BAR}">${Array.from({ length: BAR }, (_, i) => `<i class="${i < prog ? 'on' : ''}"></i>`).join('')}<span>${prog}/${BAR}</span></div>
        <button class="btn block" data-train="${d.id}" ${done && !gm ? 'disabled' : ''}>${done ? (gm ? 'Train again (GM)' : 'Rested') : 'Train'}</button></div>`;
    }).join('')}</div>
    <p class="small muted">Training Points are spent with the GM's OK to raise stats.</p>
    <div class="gym-bottom">${gymChatHTML(wx)}${gymWxHTML(c, wx)}</div>`;
  $$('[data-train]', main).forEach((b) => b.onclick = () => train(c.id, b.dataset.train));
  $('#gwxinfo', main).onclick = showWeather;
  const gc = $('#gcoach', main);
  if (gc) gc.onclick = (e) => { e.preventDefault(); const n = prompt('Coach name', COACH()); if (n && n.trim()) store.set('gym/coach', n.trim()); };
}

function train(id, drillId) {
  const c = party()[id]; const d0 = DRILLS.find((x) => x.id === drillId); const d = d0 && drillNow(d0);
  if (!c || !d) return;
  if (trainedToday(c) && !store.gmUnlocked()) return;
  const { loved, hated } = natureLikes(c.nature);
  if (d.id === hated) {
    if (num(c.willCur) < 1) { modal(`<h2>Too tired</h2><p>${esc(c.nickname)} hates the ${esc(d.name)} and has no Will left to force it. Pick another drill today.</p>`); return; }
    store.set(`party/${id}/willCur`, num(c.willCur) - 1);
  }
  const dice = drillDice(c, d);
  const r = pool(dice, { pain: 0 });
  const gain = r.succ + (d.id === loved && r.succ > 0 ? 1 : 0);
  const total = num(c.gym?.bars?.[d.id]) + gain;
  const tp = Math.floor(total / BAR);
  store.set(`party/${id}/gym/day`, easternDay(Date.now()));
  store.set(`party/${id}/gym/bars/${d.id}`, total % BAR);
  if (tp) store.set(`party/${id}/tp`, num(c.tp) + tp);
  const story = STORY[Math.min(3, r.succ)];
  logRoll(c.nickname, `Training: ${d.name} (${drillAttr(c, d)} + ${d.skill})`, r.dice, `${r.succ} success${r.succ === 1 ? '' : 'es'}${r.onesPen ? ` (two 1s cancelled ${r.onesPen > 1 ? r.onesPen : 'one'})` : ''} · +${gain} progress${tp ? ` · +${tp} Training Point${tp > 1 ? 's' : ''}!` : ''}`);
  modal(`<h2>${d.icon} ${esc(d.name)}</h2>
    <div class="result">${diceFaces(r.dice)}<div class="big">${r.succ} success${r.succ === 1 ? '' : 'es'}</div></div>
    ${r.onesPen ? `<p class="small">🎲 ${r.raw} ${r.raw === 1 ? 'die' : 'dice'} hit, but every two 1s cancel a success (−${r.onesPen}).</p>` : ''}
    <p>${esc(story)}</p>
    ${d.id === loved ? `<p class="small">💖 ${esc(c.nickname)} loves this drill! ${r.succ ? '+1 bonus progress.' : ''}</p>` : d.id === hated ? `<p class="small">💢 ${esc(c.nickname)} hated every second of it (−1 Will).</p>` : ''}
    <p><b>+${gain} progress</b> · bar ${total % BAR}/${BAR}${tp && total % BAR ? ` (${total % BAR} carried over)` : ''}</p>
    ${tp ? `<div class="win tight" style="font-size:18px">🎉 Bar full! +${tp} Training Point${tp > 1 ? 's' : ''} (now ${num(c.tp) + tp})</div>` : ''}
    <div class="row" style="margin-top:10px"><button class="btn" data-close>Done</button></div>`);
}

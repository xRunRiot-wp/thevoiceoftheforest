// Training Gym (#/gym): one drill per day per character. Drills roll Attribute + Skill; the character's nature
// loves one drill (+1 die, +1 progress) and hates one (−1 die, costs 1 Will). A full bar (5) pays 1 Training Point;
// the GM decides when Training Points become stat raises.
import * as store from './store.js?v=6adfeadd';
import { $, $$, esc, num, pool } from './util.js?v=6adfeadd';
import { modal, diceFaces } from './ui.js?v=6adfeadd';
import { statVal, logRoll } from './play.js?v=6adfeadd';
import { myId } from './app.js?v=6adfeadd';

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
  return Math.max(1, base + (d.id === loved ? 1 : 0) - (d.id === hated ? 1 : 0));
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
  const lname = (id) => DRILLS.find((d) => d.id === id)?.name;
  main.innerHTML = head + `
    <div class="card gym-who"><div class="grow"><b class="pix">${esc(c.nickname)}</b> <span class="small muted">${esc(c.pokemon || '')} · ${esc(c.nature || 'no nature')} · ${num(c.tp)} Training Points</span>
      <p class="small" style="margin:4px 0 0">${loved ? `💖 Loves <b>${esc(lname(loved))}</b> · 💢 Hates <b>${esc(lname(hated))}</b>` : `${esc(c.nature || 'This nature')} has no favourite. Every drill feels the same.`}</p>
      ${TYPE_FLAVOR[c.type1] ? `<p class="small muted" style="margin:4px 0 0">🗣️ ${esc(TYPE_FLAVOR[c.type1])}</p>` : ''}</div>
      <div class="gym-today ${done ? 'rested' : ''}">${done ? '😴 Trained today<br><small>back tomorrow</small>' : '💪 Ready to train'}</div></div>
    <div class="gym-grid">${DRILLS.map((d) => {
      const prog = num(c.gym?.bars?.[d.id]); const dice = drillDice(c, d); const tag = d.id === loved ? 'loved' : d.id === hated ? 'hated' : '';
      return `<div class="gym-card ${tag}"><div class="gym-top"><span class="gym-ic">${d.icon}</span><div class="grow"><b>${esc(d.name)}</b><small>${esc(drillAttr(c, d))} + ${esc(d.skill)} · ${dice} ${dice === 1 ? 'die' : 'dice'}</small></div>
        ${tag ? `<span class="gym-tag">${tag === 'loved' ? '💖 Loves it' : '💢 Hates it'}</span>` : ''}</div>
        <p class="small">${esc(d.text)}${tag === 'loved' ? ' <b>+1 die, +1 progress.</b>' : tag === 'hated' ? ' <b>−1 die, costs 1 Will.</b>' : ''}</p>
        <div class="gym-bar" title="${prog}/${BAR}">${Array.from({ length: BAR }, (_, i) => `<i class="${i < prog ? 'on' : ''}"></i>`).join('')}<span>${prog}/${BAR}</span></div>
        <button class="btn block" data-train="${d.id}" ${done && !gm ? 'disabled' : ''}>${done ? (gm ? 'Train again (GM)' : 'Rested') : 'Train'}</button></div>`;
    }).join('')}</div>
    <p class="small muted">Training Points are spent with the GM's OK to raise stats.</p>`;
  $$('[data-train]', main).forEach((b) => b.onclick = () => train(c.id, b.dataset.train));
}

function train(id, drillId) {
  const c = party()[id]; const d = DRILLS.find((x) => x.id === drillId);
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
  logRoll(c.nickname, `Training: ${d.name} (${drillAttr(c, d)} + ${d.skill})`, r.dice, `${r.succ} success${r.succ === 1 ? '' : 'es'} · +${gain} progress${tp ? ` · +${tp} Training Point${tp > 1 ? 's' : ''}!` : ''}`);
  modal(`<h2>${d.icon} ${esc(d.name)}</h2>
    <div class="result">${diceFaces(r.dice)}<div class="big">${r.succ} success${r.succ === 1 ? '' : 'es'}</div></div>
    <p>${esc(story)}</p>
    ${d.id === loved ? `<p class="small">💖 ${esc(c.nickname)} loves this drill! ${r.succ ? '+1 bonus progress.' : ''}</p>` : d.id === hated ? `<p class="small">💢 ${esc(c.nickname)} hated every second of it (−1 Will).</p>` : ''}
    <p><b>+${gain} progress</b> · bar ${total % BAR}/${BAR}</p>
    ${tp ? `<div class="win tight" style="font-size:18px">🎉 Bar full! +${tp} Training Point${tp > 1 ? 's' : ''} (now ${num(c.tp) + tp})</div>` : ''}
    <div class="row" style="margin-top:10px"><button class="btn" data-close>Done</button></div>`);
}

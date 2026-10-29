// Region weather: changes every 6 hours (12 AM, 6 AM, 12 PM, 6 PM Eastern) and a 1d100 sky roll each day.
// A roll of 100 is a disaster for the whole day: a huge fissure or a tsunami. Players never see who causes them (GM screen only).
// Every device works out the same weather from the table code and the time, so nothing has to be saved;
// the GM can still force a weather. Rules are PokéRole 2.0's weather (p.55-57).
import * as store from './store.js?v=6ae39132';
import { esc } from './util.js?v=6ae39132';
import { modal } from './ui.js?v=6ae39132';

export const WEATHERS = {
  clear: { name: 'Clear skies', icon: '☀️', w: 30, text: 'No weather effects.' },
  cloudy: { name: 'Cloudy', icon: '☁️', w: 20, text: 'No weather effects.' },
  sunny: { name: 'Sunny', icon: '🌞', w: 15, ix: 'Sunny Weather', kw: /\bsun(ny)?\b|sunlight|sun-/i, boost: { Fire: '+1 damage die' }, cut: { Water: 'deals 1 less damage' },
    text: 'Fire moves +1 damage die. Water moves deal 1 less damage. No one can be Frozen.' },
  rain: { name: 'Rain', icon: '🌧️', w: 15, ix: 'Rain Weather', kw: /\brain/i, boost: { Water: '+1 damage die' }, cut: { Fire: 'deals 1 less damage' },
    text: 'Water moves +1 damage die. Fire moves deal 1 less damage. Healing a Burn needs 3 fewer successes.' },
  fog: { name: 'Fog', icon: '🌫️', w: 7, ix: 'Fog / Darkness', kw: /\bfog/i, all: '1 extra Reduced Accuracy',
    text: 'All Pokémon get 1 extra Reduced Accuracy on all their moves.' },
  wind: { name: 'Strong Winds', icon: '🌬️', w: 5, ix: 'Strong Winds Weather', kw: /strong winds|wind weather|wind-flying/i, boost: { Flying: '+1 damage die' },
    text: 'Flying moves +1 damage die. Electric, Ice and Rock moves deal neutral damage to Flying types.' },
  sandstorm: { name: 'Sandstorm', icon: '🏜️', w: 4, ix: 'Sandstorm Weather', kw: /sandstorm/i, hurt: ['Rock', 'Ground', 'Steel'], perk: { Rock: '+1 Special Defense' },
    text: '1 damage at the end of each Round to everyone not Rock, Ground or Steel. Rock types +1 Special Defense.' },
  hail: { name: 'Hail', icon: '🌨️', w: 4, ix: 'Hail Weather', kw: /\bhail|\bsnow/i, hurt: ['Ice'], perk: { Ice: '+1 Defense' },
    text: '1 damage at the end of each Round to everyone not Ice-type. Ice types +1 Defense.' },
  // disaster weather (only from a 100 on the daily roll, or the GM)
  harsh: { name: 'Harsh Sunlight', icon: '🌋', ix: 'Harsh Sunlight Weather', kw: /harsh sunlight|\bsun(ny)?\b|sunlight|sun-/i, boost: { Fire: '+1 damage die' }, cut: { Water: 'fail' },
    text: 'Fire moves +1 damage die. Water moves FAIL. +2 dice to Burn chance rolls. No one can be Frozen. Other weather can’t start.' },
  typhoon: { name: 'Typhoon', icon: '🌊', ix: 'Typhoon Weather', kw: /typhoon|\brain/i, boost: { Water: '+1 damage die' }, cut: { Fire: 'fail' },
    text: 'Water moves +1 damage die. Fire moves FAIL. No one can be Burned. Other weather can’t start.' },
};
export const EVENTS = {
  fissure: { name: 'A huge fissure!', icon: '🌋', weather: 'harsh',
    text: 'The ground splits open across the region and searing heat pours out of the earth. Something vast stirs deep below… Harsh Sunlight for the whole day.' },
  tsunami: { name: 'A tsunami!', icon: '🌊', weather: 'typhoon',
    text: 'A wall of water crashes in from the sea and the sky opens up. Something vast stirs out at sea… Typhoon weather for the whole day.' },
};

const BLOCK = 6;   // hours per weather
// mixed at the end so days next to each other don't roll nearly the same number (they did: the sky roll sat around 27-35 for weeks)
export const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// Eastern-time day + hour (the campaign's clock)
function clock(t) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), min: Number(p.minute) };
}

// The day's 1d100 sky roll (same on every device)
export function dailyRoll(t = Date.now()) {
  const { day } = clock(t);
  const roll = 1 + Math.floor(hash(`${store.tableCode()}|d100|${day}`) * 100);
  const event = roll === 100 ? (hash(`${store.tableCode()}|legend|${day}`) < 0.5 ? 'fissure' : 'tsunami') : null;
  return { day, roll, event };
}

export function currentWeather(t = Date.now()) {
  const { day, hour, min } = clock(t);
  const block = `${day}#${Math.floor(hour / BLOCK)}`;
  const next = t + ((BLOCK - (hour % BLOCK)) * 60 - min) * 60e3;
  const daily = dailyRoll(t);
  const o = store.get('weather/override');
  if (o && o.until > t && WEATHERS[o.key]) return { key: o.key, block: 'gm' + o.until, next: o.until, daily, event: o.event || null, gm: true };
  if (daily.event) return { key: EVENTS[daily.event].weather, block: 'ev' + day, next, daily, event: daily.event };
  const normal = Object.entries(WEATHERS).filter(([, w]) => w.w);
  let r = hash(`${store.tableCode()}|wx|${block}`) * normal.reduce((s, [, w]) => s + w.w, 0);
  const key = (normal.find(([, w]) => (r -= w.w) < 0) || normal[0])[0];
  return { key, block, next, daily, event: null };
}

const timeOf = (t) => new Date(t).toLocaleString([], { ...(t - Date.now() > 12 * 3600e3 ? { weekday: 'short' } : {}), hour: 'numeric', minute: '2-digit' });

// header chip next to the table's live / not live chip (shown to everyone, with or without a character)
export function updateWeatherChip() {
  const el = document.getElementById('wxchip'); if (!el) return;
  const cw = currentWeather(); const w = WEATHERS[cw.key];
  el.innerHTML = `<button class="chip-status chip-wx ${cw.event ? 'legend' : ''}" title="Weather until ${timeOf(cw.next)}">${w.icon} ${esc(w.name)}</button>`;
  el.firstChild.onclick = showWeather;
}

export function weatherChipHTML() {
  const cw = currentWeather(); const w = WEATHERS[cw.key];
  return `<button class="hb hb-btn hb-wx ${cw.event ? 'legend' : ''}" id="hbwx" title="Weather until ${timeOf(cw.next)}">${w.icon} ${esc(w.name)}</button>`;
}

export function showWeather() {
  const cw = currentWeather(); const w = WEATHERS[cw.key]; const ev = cw.event && EVENTS[cw.event];
  modal(`<div class="fortune ft-full">${wxFxHTML(cw.key)}<div class="ft-top">✦ What’s the Weather? ✦</div>
    <div class="ft-orb" aria-hidden="true">${wxIconHTML(cw.key)}</div><div class="ft-name">${esc(w.name)}</div>
    ${ev ? `<div class="wx-event"><b>${ev.icon} ${esc(ev.name)}</b><p>${esc(ev.text)}</p></div>` : ''}
    <div class="ft-say">The skies foretell…</div>
    <p class="ft-text">${esc(w.text)}</p>
    <div class="ft-rows">
      <div><span>Next reading</span><b>${timeOf(cw.next)}</b>${cw.gm ? '<i>set by the GM</i>' : '<i>every 6 hours</i>'}</div>
      <div><span>Today’s sky roll</span><b>${cw.daily.roll}</b><i>${cw.daily.roll === 100 ? 'a disaster strikes!' : 'on a 100, disaster'}<br>new roll at midnight</i></div>
    </div>
    <p class="small ft-foot">Your Play sheet shows which of your moves and abilities the weather changes.</p></div>`,
  (sh) => sh.classList.add('ft-sheet'));
}

// What the weather does to one character: [{what, note, good}] (moves need the move list: {name -> {type, effect}})
export function weatherFor(c, moves, ability) {
  const w = WEATHERS[currentWeather().key]; const out = [];
  if (!w.ix) return out;
  const types = [c.type1, c.type2].filter(Boolean);
  if (w.hurt && !types.some((t) => w.hurt.includes(t))) out.push({ what: 'You', note: 'take 1 damage at the end of each Round', good: false });
  for (const t of types) if (w.perk?.[t]) out.push({ what: `${t} type`, note: w.perk[t], good: true });
  if (ability && w.kw.test(ability.text || '')) out.push({ what: ability.name, note: ability.text, good: true, ability: true });
  for (const m of moves) {
    if (!m) continue;
    if (w.boost?.[m.type]) out.push({ what: m.name, note: `${m.type} move: ${w.boost[m.type]}`, good: true });
    if (w.cut?.[m.type]) out.push({ what: m.name, note: `${m.type} move: ${w.cut[m.type] === 'fail' ? 'this move FAILS' : w.cut[m.type]}`, good: false });
    if (w.all && m.cat !== 'Status') out.push({ what: m.name, note: w.all, good: false });
    if (m.effect && w.kw.test(m.effect)) out.push({ what: m.name, note: m.effect, good: true, special: true });
  }
  return out;
}

// Announce each new weather in "Around the Guild" (once per change, by whoever has the site open first)
const say = (text) => store.pushLimited('chatter', { who: 'Weather Watch', kind: 'do', text, tag: 'weather', t: Date.now() }, 80);
export function weatherTick() {
  const cw = currentWeather(); const w = WEATHERS[cw.key];
  if (store.get('weather/posted') === cw.block) return;
  store.set('weather/posted', cw.block);
  if (cw.event && !String(store.get('weather/eventPosted') || '').startsWith(cw.daily.day)) {
    store.set('weather/eventPosted', cw.daily.day);
    const ev = EVENTS[cw.event];
    say(`${cw.gm ? 'sounds the alarm!' : `rolled ${cw.daily.roll} on today’s sky roll!`} ${ev.icon} ${ev.name} ${ev.text}`);
  }
  say(`reports ${w.icon} ${w.name} until ${timeOf(cw.next)}. ${w.text}`);
}

// GM controls
export function setWeather(key, hours = BLOCK) { store.set('weather/override', { key, until: Date.now() + hours * 3600e3 }); store.set('weather/posted', null); }
export function startEvent(ev) { store.set('weather/override', { key: EVENTS[ev].weather, until: Date.now() + 24 * 3600e3, event: ev }); store.set('weather/posted', null); store.set('weather/eventPosted', null); }
export function clearWeather() { store.set('weather/override', null); store.set('weather/posted', null); }

// Moving weather drawn over a weather card (like a phone lock-screen weather overlay). Particles get fixed
// pseudo-random spots so every card looks the same; CSS (.wxfx-*) does the animation and stops for reduced motion.
const FX = {
  clear: ['glint', 7], cloudy: ['cloud', 4], sunny: ['glint', 6], rain: ['drop', 34], fog: ['mist', 4], wind: ['gust', 12],
  sandstorm: ['sand', 46], hail: ['hail', 26], harsh: ['ember', 20], typhoon: ['drop', 56],
};
export function wxFxHTML(key) {
  const [kind, n] = FX[key] || FX.clear;
  const r = (i, k) => hash(`fx|${key}|${i}|${k}`);
  const bits = Array.from({ length: n }, (_, i) => `<i class="${kind}" style="--x:${(r(i, 'x') * 100).toFixed(1)}%;--y:${(r(i, 'y') * 100).toFixed(1)}%;--d:${(-r(i, 'd') * 6).toFixed(2)}s;--s:${(0.7 + r(i, 's') * 0.6).toFixed(2)}"></i>`).join('');
  return `<div class="wxfx wxfx-${key}" aria-hidden="true">${bits}${key === 'typhoon' ? '<b class="flash"></b>' : ''}${key === 'harsh' || key === 'sunny' ? '<b class="heat"></b><b class="rays"></b>' : ''}</div>`;
}

// the weather emoji in a card's orb, moving gently to match its weather (sun spins, rain bobs down, ...)
export const wxIconHTML = (key) => `<span class="wxo wxo-${esc(key)}">${(WEATHERS[key] || WEATHERS.clear).icon}</span>`;

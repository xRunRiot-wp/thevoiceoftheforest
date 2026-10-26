// "Around the Guild": a live feed of what the guild's residents are doing and saying, in character,
// plus a pinned checklist of things that need the GM (Guildmaster). Shared through the table store.
import * as store from './store.js?v=6ade9afe';
import { $, $$, esc, toast } from './util.js?v=6ade9afe';

// Who can speak, with a face. Player characters at the table never get lines put in their mouths.
export const RESIDENTS = {
  'Guildmaster Beautifly': { icon: '🦋', img: 'assets/portraits/beautifly.png' },
  Chandelure: { icon: '🕯️' },
  Maushold: { icon: '🐭' },
  Diglett: { icon: '⛏️' },
  'Beedrill (camp caretaker)': { icon: '🐝' },
  'Bramble the Scolipede': { icon: '🛡️' },
  'Abra & Ralts': { icon: '📮' },
  Magnemite: { icon: '🔩', img: 'assets/portraits/magnemite.png' },
  Puff: { icon: '☁️' },
  Rox: { icon: '🪨' },
  Felicia: { icon: '🔨' },
  Rocky: { icon: '🗿', img: 'assets/portraits/sudowoodo.png' },
  'Mimi & Kippy': { icon: '⚡', img: 'assets/portraits/pikachu.png' },
  Gemini: { icon: '🌟', img: 'assets/portraits/cleffa.png' },
  Slakoth: { icon: '💤', img: 'assets/portraits/slakoth.png' },
  Ludicolo: { icon: '🌧️' },
};

// Everyday life around Woodland Base. [speaker, kind ('say' | 'do'), text]
const AMBIENT = [
  ['Guildmaster Beautifly', 'say', 'Every fissure in this forest is a question. I intend to have answers before the next storm.'],
  ['Guildmaster Beautifly', 'do', 'circles the mission board twice, straightens a crooked notice, and flutters off toward the Great Canopy.'],
  ['Guildmaster Beautifly', 'say', 'Rescuers, remember: a rescue that brings everyone home is worth more than any treasure.'],
  ['Chandelure', 'say', 'The Lucky Den is open. Please lose responsibly.'],
  ['Chandelure', 'do', 'polishes the Lucky Den wheel and, very quietly, turns the Golden Paw toward the wall.'],
  ['Chandelure', 'say', 'Cave safety is not optional. Lanterns lit, ropes checked, and nobody touches the glowing rocks.'],
  ['Maushold', 'do', 'counts the storage shelves for the third time today. One family member is always one Apple short.'],
  ['Maushold', 'say', 'Storage hours are posted. Snacks borrowed from storage are still considered stolen.'],
  ['Diglett', 'say', 'Tunnels are clear to the east trail! Mostly. Watch the soft spot by the big root.'],
  ['Diglett', 'do', 'pops up beside the mission board with a cheerful grin, drops off a fresh map, and vanishes back underground.'],
  ['Beedrill (camp caretaker)', 'say', 'Supper is at sundown. Anyone who skips it gets a lecture AND a second helping.'],
  ['Beedrill (camp caretaker)', 'do', 'buzzes from bed to bed in Fernshade Camp, tucking blankets around the newest recruits.'],
  ['Bramble the Scolipede', 'say', 'Perimeter is quiet. Too quiet. I’ll take another lap.'],
  ['Bramble the Scolipede', 'do', 'curls up across the camp entrance like a living wall, one eye open.'],
  ['Abra & Ralts', 'say', 'Rootpost Relay: two new letters for the board and one very soggy parcel from Sunshell Beach.'],
  ['Abra & Ralts', 'do', 'swap shifts beside the mission board. Abra falls asleep standing up almost immediately.'],
  ['Magnemite', 'say', 'Good news: my new invention almost works! Bad news: please stand further back.'],
  ['Magnemite', 'do', 'hums near the workbench as three bolts and a spring float into a shape that is definitely not a lantern.'],
  ['Puff', 'do', 'drifts past the guild sign and leaves a small, perfect cotton mustache on it.'],
  ['Puff', 'say', 'If anyone asks, I have been floating peacefully this whole time.'],
  ['Rox', 'say', 'A loose stone on the bridge could be the start of a very important mission. I’ll go check it.'],
  ['Rox', 'do', 'leaves a small stone marker by Acorn Grove: a thank-you for the berries someone shared.'],
  ['Felicia', 'do', 'turns a scrap of fissure metal over and over in the lantern light, completely ignoring dinner.'],
  ['Felicia', 'say', 'Bring me anything shiny you find out there. Anything. I mean it.'],
  ['Rocky', 'do', 'balances five stones into a tower at Hearthstone Circle. Nobody has ever seen it fall.'],
  ['Rocky', 'say', 'The forest feels calmer tonight. I want to keep it that way.'],
  ['Mimi & Kippy', 'say', 'Mimi: “Back in our rookie days we got lost on the way to the mess hall.” Kippy: “Twice.”'],
  ['Mimi & Kippy', 'do', 'trade stories with the new recruits about Temporal Tower until the lanterns burn low.'],
  ['Gemini', 'do', 'lies on the mess hall roof counting stars and making up new constellations, all of them lucky.'],
  ['Gemini', 'say', 'I have a really good feeling about the Lucky Den tonight. Like, a REALLY good feeling.'],
  ['Slakoth', 'do', 'is asleep on the Miltankshake Shack sign again, well after closing.'],
  ['Slakoth', 'say', 'Mm… dungeon tours… tomorrow. Probably.'],
  ['Ludicolo', 'say', 'THE RAIN PROVIDES! …Is the Lucky Den open?'],
  ['Ludicolo', 'do', 'wanders into storage. Maushold immediately hides the expensive merchandise.'],
];

// Reactions to a Lucky Den spin, by slice. {who} = the spinner, {prize} = what they got.
const LUCKY = {
  big: [['Chandelure', 'say', 'Another big winner. {who}. Wonderful. Truly. I am thrilled.'], ['Maushold', 'do', 'hears about {who}’s win and quietly moves the expensive merchandise to a higher shelf.'], ['Ludicolo', 'say', 'THE RAIN PROVIDES FOR {who}! Teach me your ways!']],
  item: [['Maushold', 'say', '{who} won {prize}? Fine. FINE. Sign here, and here, and here.'], ['Chandelure', 'say', 'Enjoy your prize, {who}. Do come back. Often.']],
  lunch: [['Guildmaster Beautifly', 'say', 'Lunch with {who}? Splendid. I have SO many questions about the fissures.'], ['Beedrill (camp caretaker)', 'say', 'Lunch with the Guildmaster, {who}! Wash your paws first.']],
  small: [['Chandelure', 'say', 'A modest win for {who}. How… sustainable.'], ['Diglett', 'say', 'Nice spin, {who}! Every bit counts!']],
  none: [['Chandelure', 'do', 'watches {who} walk away with nothing and allows herself the smallest, most satisfied flicker.'], ['Puff', 'say', 'Better luck next time, {who}! I believe in you. Mostly.']],
  double: [['Chandelure', 'say', 'Double Trouble. For {who}. Of course it is.'], ['Gemini', 'say', 'Spin it again! Spin it AGAIN!']],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const players = () => new Set(Object.values(store.get('party') || {}).map((c) => (c.nickname || '').toLowerCase()));
const fill = (t, vars) => t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export function guildSay(who, kind, text, tag = '') {
  store.pushLimited('chatter', { who, kind, text, tag, t: Date.now() }, 80);
}

// What the guild says when someone spins the Lucky Den. Never speaks for the spinner themselves.
export function luckyReaction(spinner, slice, prize) {
  const n = slice.toLowerCase(); const p = (prize || '').toLowerCase();
  const set = /double/.test(n) ? LUCKY.double : /jackpot|golden|big payday/.test(n) ? LUCKY.big : /no luck/.test(n) ? LUCKY.none
    : /lunch/.test(p) ? LUCKY.lunch : /item/.test(p) ? LUCKY.item : LUCKY.small;
  const pl = players();
  const options = set.filter(([w]) => w.toLowerCase() !== spinner.toLowerCase() && !(w === 'Gemini' && pl.has('gemini') && spinner.toLowerCase() !== 'gemini'));
  const [w, k, t] = pick(options.length ? options : set);
  guildSay(w, k, fill(t, { who: spinner, prize }), 'lucky');
}

// A new everyday moment about every 40 minutes while someone has the Guild page open.
export function ambientTick() {
  const last = Number(store.get('chatterLast') || 0);
  if (Date.now() - last < 40 * 60e3) return;
  const pl = players();
  const recent = new Set(Object.values(store.get('chatter') || {}).slice(-8).map((x) => x.text));
  const pool = AMBIENT.filter(([w, , t]) => !pl.has(w.toLowerCase()) && !recent.has(t));
  const [w, k, t] = pick(pool.length ? pool : AMBIENT);
  store.set('chatterLast', Date.now());
  guildSay(w, k, t);
}

// ---- GM checklist (things that need the Guildmaster)
export function gmTodo(text, tag = '') {
  const open = Object.values(store.get('gmtodo') || {}).some((x) => !x.done && x.text === text);
  if (!open) store.set('gmtodo/' + store.tid(), { text, tag, done: false, t: Date.now() });
}

const face = (who) => { const r = RESIDENTS[who] || {}; return r.img ? `<img src="${r.img}" alt="">` : `<span>${r.icon || '💬'}</span>`; };
const ago = (t) => { const m = Math.round((Date.now() - t) / 60e3); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };

export function chatterHTML() {
  const gm = store.gmUnlocked();
  const todo = Object.entries(store.get('gmtodo') || {}).filter(([, x]) => !x.done || Date.now() - (x.doneT || 0) < 36e5).sort((a, b) => a[1].t - b[1].t);
  const feed = Object.entries(store.get('chatter') || {}).sort().reverse().slice(0, 25);
  return `<div class="card chatter"><div class="row" style="justify-content:space-between"><h2 style="margin:0">🏕️ Around the Guild</h2></div>
    <div class="gmtodo"><div class="row" style="justify-content:space-between"><b>📌 Needs the Guildmaster</b>${gm ? '<button class="btn alt sm" id="todoadd">+ To-do</button>' : ''}</div>
      ${todo.length ? todo.map(([id, x]) => `<label class="todo ${x.done ? 'done' : ''}"><input type="checkbox" data-todo="${id}" ${x.done ? 'checked' : ''} ${gm ? '' : 'disabled'}> <span>${esc(x.text)}</span></label>`).join('') : '<p class="small muted" style="margin:4px 0">Nothing waiting on the Guildmaster.</p>'}
    </div>
    ${gm ? `<div class="say row nowrap"><select id="saywho">${Object.keys(RESIDENTS).map((w) => `<option>${esc(w)}</option>`).join('')}</select><input id="saytext" placeholder="Say or do something…"><button class="btn sm" id="saygo">Post</button></div>` : ''}
    <div class="feed">${feed.length ? feed.map(([, x]) => `<div class="line ${x.kind === 'do' ? 'do' : ''} ${x.tag === 'lucky' ? 'lucky' : ''}"><div class="face">${face(x.who)}</div><div class="grow">${x.kind === 'do'
      ? `<i><b>${esc(x.who)}</b> ${esc(x.text)}</i>` : `<b>${esc(x.who)}:</b> “${esc(x.text).replace(/^“|”$/g, '')}”`}<div class="small muted">${ago(x.t)}${x.tag === 'lucky' ? ' · Lucky Den' : ''}</div></div></div>`).join('') : '<p class="small muted">The guild is quiet… for now.</p>'}</div>
  </div>`;
}

export function bindChatter(main) {
  $$('[data-todo]', main).forEach((b) => b.onchange = () => store.update('gmtodo/' + b.dataset.todo, (x) => ({ ...x, done: b.checked, doneT: b.checked ? Date.now() : null })));
  const add = $('#todoadd', main);
  if (add) add.onclick = () => { const t = prompt('What needs the Guildmaster?'); if (t && t.trim()) gmTodo(t.trim()); };
  const go = $('#saygo', main);
  if (go) go.onclick = () => {
    const t = $('#saytext', main).value.trim(); if (!t) return;
    const who = $('#saywho', main).value;
    const isDo = /^\*.*\*$/.test(t) || /^(is |was |does |walks |runs |flies |floats |sits |looks )/i.test(t);
    guildSay(who, isDo ? 'do' : 'say', t.replace(/^\*|\*$/g, ''));
    toast('Posted');
  };
}

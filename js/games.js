// Gambling games (Lucky Den Gambling Corner and any game the GM adds). Each game is a prize wheel:
// slices are sized by weight and picked by weight, like the GM's Wheel of Names wheels.
import { markWinner } from './sparkle.js?v=6ae15ecb';
import * as store from './store.js?v=6ae15ecb';
import { unlockChar, charOpen, pinOf } from './charlock.js?v=6ae15ecb';
import { $, $$, esc, toast, num, uid } from './util.js?v=6ae15ecb';
import { modal, portrait } from './ui.js?v=6ae15ecb';
import * as sheet from './sheetdata.js?v=6ae15ecb';
import { shop } from './guild.js?v=6ae15ecb';
import { merged, editContent } from './content-store.js?v=6ae15ecb';
import { logRoll, me, addTeamFx } from './play.js?v=6ae15ecb';
import { luckyReaction, gmTodo } from './chatter.js?v=6ae15ecb';
import { ranks } from './rulebook.js?v=6ae15ecb';
import { isFortune, renderFortune, fortuneMini } from './fortune.js?v=6ae15ecb';
import { isSentry, renderSentry, sentryMini, sentryDue } from './sentry.js?v=6ae15ecb';
import { isDance, renderDance, danceMini, danceDue } from './dance.js?v=6ae15ecb';
import { isKitchen, renderKitchen, kitchenMini, kitchenDue } from './kitchen.js?v=6ae15ecb';
import { isNursery, renderNursery, nurseryDue } from './nursery.js?v=6ae15ecb';
import { isMailRun, renderMailRun, mailRunMini } from './mailrun.js?v=6ae15ecb';
import { isTruck, renderTruck, truckMini } from './truck.js?v=6ae15ecb';
import { isCards21, renderCards21, cards21Mini } from './cards21.js?v=6ae15ecb';

export const GAMES = [
  {
    id: 'noctowl-21', kind: 'cards21', group: 'Gambling Games', name: 'Noctowl’s 21', host: 'Noctowl',
    intro: 'When the lanterns go up, Noctowl deals cards under the old oak. Sit in for 10 Poké, bet against your friends and the owl himself, and get as close to 21 as you dare without going over.',
    cost: '10 Poké', slices: [],
  },
  {
    id: 'machamp-wagon', kind: 'truck', group: 'Skill Games', name: 'Supply Wagon with Machamp', host: 'Machamp',
    intro: 'The supply wagon just rolled into Woodland Base and Machamp is tossing everything off it with all four arms. Run back and forth to catch it all: food goes in the pantry basket, gear goes in the storage chest. Just don’t catch the Voltorb.',
    cost: '', slices: [],
  },
  {
    id: 'rayson-mail-run', kind: 'mailrun', group: 'Skill Games', name: 'Rayson’s Mail Run', host: 'Rayson the Wingull',
    intro: 'The wind scattered the guild’s mail all over Sunshell Beach. Help Rayson the Wingull fly it home to Woodland Base: tap to flap, dodge sea rocks, storm clouds and rival flocks, and catch every letter you can.',
    cost: '', slices: [],
  },
  {
    id: 'fernshade-nursery', kind: 'nursery', group: 'Chores', name: 'Fernshade Nursery', host: 'Beatrice',
    intro: 'Beatrice the Beedrill runs the Fernshade Camp nursery and has more eggs than arms. Take one home, keep it warm until it hatches, then feed it, play with it and give it baths every day. Raise it from an egg to a teen and it might want to join your team!',
    cost: '', slices: [],
  },
  {
    id: 'spinda-kitchen', kind: 'kitchen', group: 'Chores', name: 'Spinda’s Kitchen', host: 'Spinda',
    intro: 'Help Spinda make tonight’s stew. Follow the recipe Spinda left with berries from your bag or Guild Storage, give it a good stir, and Spinda comes to taste it. Good stew is served at dinner, bad stew gets spat out and dinner is late, and a REALLY REALLY good stew gives the whole team a special effect.',
    cost: '', slices: [],
  },
  {
    id: 'ralts-dance', kind: 'dance', group: 'Skill Games', name: 'Dance Practice with Ralts', host: 'Ralts',
    intro: 'Ralts practices a little dance every day and loves a partner. Watch Ralts’s steps, then copy them: up, down, left and right. A great practice earns Poké and maybe a rare item.',
    cost: '', slices: [],
  },
  {
    id: 'sentry-duty', kind: 'sentry', name: 'Sentry Duty', host: 'Diglett',
    intro: 'A guild chore everyone is expected to do each day. Stand watch at the Woodland Base gate while Diglett watches the footprints from below, and call out who is coming. An okay shift is just doing your duty. A great shift earns Poké and maybe a rare item.',
    cost: '', slices: [],
  },
  {
    id: 'lucky-den', name: 'The Lucky Den', host: 'Chandelure',
    intro: 'The Lucky Den Gambling Corner. Pay the house, spin the wheel, and hope luck is on your side. (Chandelure does not approve of big winners.)',
    cost: '100 Poké', source: 'https://wheelofnames.com/v6z-9aj',
    colors: ['#3EA1B6', '#0E6B8C', '#133855', '#6B669E', '#BB90C8', '#EFD8EC'],
    slices: [
      ['Little Luck', 1.75, '25 Poké'], ['Pocket Change', 0.75, '50 Poké'], ['Lucky Find', 1, '100 Poké'], ['Big Payday', 0.75, '250 Poké'], ['Jackpot', 0.5, '500 Poké'],
      ['Guild Stash', 1, '1 free E-Rank shop item'], ['Lucky Shopper', 1, '1 free shop item worth up to 150 Poké'], ["Guild Leader's Table", 1, 'Lunch with the Guild Leader'],
      ['Double Trouble', 0.1, 'Spin again twice and keep both results'], ['Golden Paw', 0.1, '500 Poké + 1 free shop item + Lunch with the Guild Leader'],
      ['No luck', 1.75, 'Nothing this time'],
    ],
    legendTitle: 'The Legend of Ludicolo: “The Ludicolo Incident”',
    legend: `Nobody is completely sure how it happened.

According to the official Guild ledger, Ludicolo entered the Lucky Den carrying exactly 12 Poké, half an Apple, and what witnesses described as “an unreasonable amount of confidence.”

“THE RAIN PROVIDES!”

By the time the Guild finally convinced him to stop spinning, Ludicolo had walked away with approximately: 1,750 Poké, two free items from Guild Supplies, an Apple he somehow convinced Maushold was part of the prize, three unused Lucky Den tokens, and lunch with the Guild Leader.

Ludicolo still visits the Guild occasionally. Whenever he enters the storage room, Maushold hides the expensive merchandise.

And Chandelure quietly turns the Lucky Den wheel so that the Golden Paw faces the wall.`,
    // Gemini's bond with the wheel: when Gemini spins, the slice also brings a twist (good, bad or chaos).
    special: 'Gemini', winCap: 1000,
    twists: [
      ['Little Luck', 'good', 'Star Glow: Gemini’s luck doubles. Take this prize twice.'],
      ['Pocket Change', 'bad', 'Butterfingers: Gemini drops half of it on the way out.'],
      ['Lucky Find', 'good', 'Sparkle Sense: Gemini also finds a random seed or berry.'],
      ['Big Payday', 'bad', 'Show-off: Chandelure notices. Gemini’s next spin this session costs 200 Poké.'],
      ['Jackpot', 'good', 'Wish Granted: the whole team gets +1 success on their next roll.'],
      ['Guild Stash', 'good', 'Moonlit Bonus: Gemini takes one extra item from the stash.'],
      ['Lucky Shopper', 'bad', 'Impulse Buy: it must be spent at the very next shop, no saving it.'],
      ["Guild Leader's Table", 'good', 'Cute Charm: the guild leader owes Gemini a favour.'],
      ['Double Trouble', 'chaos', 'Metronome Surge: spin Gemini’s Metronome wheel right now and apply that too.'],
      ['Golden Paw', 'good', 'Golden Wag: spin again for free and keep both prizes.'],
      ['No luck', 'chaos', 'Second Wag: spin again for free, but if it’s No luck again Gemini is Confused for the next fight.'],
    ],
  },
  {
    id: 'gemini-metronome', name: "Gemini's Metronome", host: 'Gemini (Cleffa)', only: 'Metronome users', needsMove: 'Metronome', theme: 'stars',
    intro: "Gemini has a special bond with the wheel. Whenever Gemini uses Metronome, spin this instead of a plain random move and see whether luck or chaos answers the wag of that tiny finger. (Starter prizes: the GM can change any of them.)",
    cost: '', colors: ['#f7b6d2', '#7a5cc2', '#ffd56b', '#3b2a6b', '#9fd8f2', '#e06fa0'],
    slices: [
      ['Lucky Star', 1.5, 'Metronome works normally and Gemini adds 1 success to its roll'],
      ['Double Wag', 1, 'Two random moves go off this turn'],
      ['Jackpot Move', 0.5, 'Gemini picks any move seen this session'],
      ['Wish Upon a Star', 1, 'One ally of Gemini’s choice heals 2 HP'],
      ['Coin Shower', 0.75, 'The team finds 50 Poké'],
      ['Wobbly Wag', 1.5, 'The random move hits a random Pokémon, maybe an ally'],
      ['Moonlit Charm', 1, 'Every foe rolls Will or becomes Infatuated'],
      ['Backfire', 1, 'Gemini becomes Confused'],
      ['Just a Wave', 1.25, 'Nothing happens'],
    ],
  },
];
const GAME_SCHEMA = [['name', 'Game name'], ['group', 'Section', 'select:Gambling Games|Chores|Skill Games'], ['host', 'Run by'], ['intro', 'About', 'area'], ['cost', 'Cost to play (e.g. 50 Poké)'],
  ['slicesText', 'Slices — one per line: Name | weight | prize (weight 1 = normal, 0.5 = half as likely)', 'area'], ['colorsText', 'Colours (comma separated, optional)'], ['legendTitle', 'Story title (optional)'], ['legend', 'Story (optional)', 'area'],
  ['special', 'Special character (gets twists when they spin, optional)'], ['winCap', 'Most Poké the special character can win per session (blank = no limit)', 'number'],
  ['twistsText', 'Twists — one per line: Slice | good, bad or chaos | what happens', 'area']];

const parse = (g) => {
  const slices = g.slicesText != null
    ? g.slicesText.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0]).map(([n, w, p]) => [n, Math.max(0.01, parseFloat(w) || 1), p || ''])
    : g.slices || [];
  const colors = g.colorsText ? g.colorsText.split(',').map((x) => x.trim()).filter(Boolean) : g.colors || ['#e07b24', '#4f9d4a', '#3a8fd8', '#9a6b3c', '#c9b8ff', '#d6a93a'];
  const twists = g.twistsText != null
    ? g.twistsText.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0] && x[2]).map(([n, k, t]) => [n, /bad|dis/i.test(k) ? 'bad' : /chaos/i.test(k) ? 'chaos' : 'good', t])
    : g.twists || [];
  return { ...g, slices, colors, twists };
};
// her asks 10-27: Chores, Skill Games (Ralts's dance) and Gambling Games; the GM can move any game in Edit
const sectionOf = (g) => g.group || (isDance(g) || isMailRun(g) || isTruck(g) ? 'Skill Games' : isSentry(g) || isKitchen(g) || isNursery(g) ? 'Chores' : 'Gambling Games');
export const games = () => merged('games', GAMES).map(parse);
const forEdit = (g) => ({ ...g, slicesText: g.slices.map(([n, w, p]) => `${n} | ${w}${p ? ' | ' + p : ''}`).join('\n'), colorsText: g.colors.join(', '),
  twistsText: g.twists.map(([n, k, t]) => `${n} | ${k} | ${t}`).join('\n') });
// Prizes that name a rank (e.g. "E-Rank shop item") use the spinner's own rank: Basic = E, Bronze = D, Silver = C ...
// (Rankless characters count as E.)
const rankLetter = (c) => {
  if (!c?.rank) return '';
  const r = ranks().find((x) => [x.name, x.alt].some((n) => n && n.toLowerCase() === c.rank.toLowerCase()));
  return r ? (/^[A-Z]$/.test(r.missions || '') ? r.missions : 'E') : '';
};
const rankPrize = (p, c) => { const L = rankLetter(c); return L ? (p || '').replace(/\b[EDCBASX]-Rank\b/g, `${L}-Rank`) : p || ''; };

// Free shop item choices. Which rarities a rank may take is a starter rule the GM can change:
// E = the guild shop + Mundane, D adds Common, C Uncommon, B Rare, A and up Very Rare.
const RARITIES = ['Mundane', 'Common', 'Uncommon', 'Rare', 'Very Rare'];
const TIER_BY_RANK = { E: 0, D: 1, C: 2, B: 3, A: 4, S: 4, X: 4 };
async function prizeChoices(prize, c) {
  const t = await sheet.treasure().catch(() => []);
  const seen = new Set(); const all = [];
  for (const x of [...shop().map((s) => ({ name: s.name, price: num(s.price), tier: 0, note: s.kind || '' })),
    ...t.map((x) => ({ name: x.name, price: num(x.price), tier: RARITIES.findIndex((r) => x.rarity.toLowerCase().startsWith(r.toLowerCase())), note: x.rarity }))]) {
    if (x.tier < 0 || seen.has(x.name.toLowerCase())) continue; seen.add(x.name.toLowerCase()); all.push(x);
  }
  const upTo = prize.match(/up to\s*([\d,]+)\s*Poké/i);
  const L = (prize.match(/\b([EDCBASX])-Rank\b/) || [])[1] || (upTo ? '' : rankLetter(c) || 'E');
  return all.filter((x) => (!L || x.tier <= TIER_BY_RANK[L]) && (!upTo || (x.price > 0 && x.price <= num(upTo[1])))).sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
}
const itemCount = (prize) => [...prize.matchAll(/(\d+)\s+free\b[^+]*?item/gi)].reduce((s, m) => s + num(m[1], 1), 0);
function giveItem(owner, name, qty = 1) {
  const bag = store.get('bag') || {};
  const same = Object.entries(bag).find(([, b]) => b.name.toLowerCase() === name.toLowerCase() && b.owner === owner);
  if (same) store.set(`bag/${same[0]}/qty`, same[1].qty + qty); else store.set('bag/' + uid(), { name, qty, owner });
}
const givePoke = (id, amt) => store.update('party/' + id, (x) => ({ ...x, poke: num(x?.poke) + amt }));
const LUNCH = { now: 'Now (this session)', soon: 'Soon (next session)', someday: 'Someday (any future session)' };
// The special character's Poké winnings per session (GM's session number), checked against the game's winCap.
const sessN = () => parseInt((store.get('session') || {}).n, 10) || 1;
const winPath = (g) => `gamewins/${g.id}/s${sessN()}`;
const pokeIn = (text, tw) => {
  let v = [...(text || '').matchAll(/([\d,]+)\s*Poké/g)].reduce((s, m) => s + (parseInt(m[1].replace(/,/g, ''), 10) || 0), 0);
  if (tw && /twice/i.test(tw[2])) v *= 2;
  if (tw && /half/i.test(tw[2])) v = Math.floor(v / 2);
  return v;
};
const capLine = (g) => { const won = parseInt(store.get(winPath(g)), 10) || 0; return `${esc(g.special)} has won <b>${won.toLocaleString()} / ${Number(g.winCap).toLocaleString()}</b> Poké this session.`; };
const TWIST = { good: ['✨', 'Advantage'], bad: ['💢', 'Drawback'], chaos: ['🌀', 'Chaos'] };
const twistFor = (g, n) => g.twists.find(([s]) => s.toLowerCase() === n.toLowerCase());

function textOn(hex) { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * .299 + ((n >> 8) & 255) * .587 + (n & 255) * .114) > 150 ? '#1b1b1b' : '#ffffff'; }

function drawWheel(cv, g, rot) {
  const x = cv.getContext('2d'); const S = cv.width; const R = S / 2 - 6;
  const total = g.slices.reduce((s, [, w]) => s + w, 0);
  x.clearRect(0, 0, S, S); x.save(); x.translate(S / 2, S / 2); x.rotate(rot);
  let a = 0;
  g.slices.forEach(([n, w], i) => {
    const da = (w / total) * Math.PI * 2; const col = g.colors[i % g.colors.length];
    x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, a, a + da); x.closePath(); x.fillStyle = col; x.fill();
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 2; x.stroke();
    if (da > 0.12) {
      x.save(); x.rotate(a + da / 2); x.fillStyle = textOn(col); x.textAlign = 'right'; x.textBaseline = 'middle';
      x.font = `bold ${Math.max(11, Math.min(20, S / 22))}px system-ui, sans-serif`; x.fillText(n.length > 20 ? n.slice(0, 19) + '…' : n, R - 12, 0); x.restore();
    }
    a += da;
  });
  // gold rim with pegs
  x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2); x.lineWidth = Math.max(4, S / 45); x.strokeStyle = '#d9a83a'; x.stroke();
  for (let k = 0; k < 24; k++) { const pa = (k / 24) * Math.PI * 2; x.beginPath(); x.arc(Math.cos(pa) * R, Math.sin(pa) * R, Math.max(2, S / 120), 0, Math.PI * 2); x.fillStyle = '#fff3c4'; x.fill(); }
  x.restore();
  const hub = x.createRadialGradient(S / 2 - S * .02, S / 2 - S * .02, 1, S / 2, S / 2, S * .08);
  hub.addColorStop(0, '#fff8dc'); hub.addColorStop(1, '#d9a83a');
  x.beginPath(); x.arc(S / 2, S / 2, S * .075, 0, Math.PI * 2); x.fillStyle = hub; x.fill(); x.strokeStyle = '#5a3a10'; x.lineWidth = Math.max(2, S / 120); x.stroke();
  // pointer at the right edge (3 o'clock)
  const ph = Math.max(10, S / 24);
  x.beginPath(); x.moveTo(S - 1, S / 2 - ph); x.lineTo(S - ph * 2.6, S / 2); x.lineTo(S - 1, S / 2 + ph); x.closePath(); x.fillStyle = '#ffcf4a'; x.fill(); x.strokeStyle = '#5a3a10'; x.lineWidth = 2; x.stroke();
}

function pick(g) {
  const total = g.slices.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < g.slices.length; i++) { r -= g.slices[i][1]; if (r <= 0) return i; }
  return g.slices.length - 1;
}

export function renderGames(main, [arg]) {
  const gm = store.gmUnlocked();
  const list = games();
  if (!arg) {
    // her ask 10-27: Chores (daily guild jobs) and Gambling Games in their own sections; the GM picks a game's section in Edit
    const card = (g) => `<a class="gamecard ${g.theme === 'stars' ? 'stars' : ''} ${(isSentry(g) && sentryDue()) || (isDance(g) && danceDue()) || (isKitchen(g) && kitchenDue()) || (isNursery(g) && nurseryDue()) ? 'due' : ''}" href="#/games/${esc(g.id)}">${isSentry(g) && sentryDue() ? '<span class="due-ribbon">⚠️ Today’s shift not done yet!</span>' : isDance(g) && danceDue() ? '<span class="due-ribbon dance">⚠️ Today’s practice not done yet!</span>' : isKitchen(g) && kitchenDue() ? '<span class="due-ribbon stew">⚠️ Today’s stew not made yet!</span>' : isNursery(g) && nurseryDue() ? '<span class="due-ribbon nursery">⚠️ Your buddy needs care today!</span>' : ''}
        ${isSentry(g) ? sentryMini() : isDance(g) ? danceMini() : isKitchen(g) ? kitchenMini() : isTruck(g) ? truckMini() : isCards21(g) ? cards21Mini() : isMailRun(g) ? mailRunMini() : isNursery(g) ? '<div class="nursery-mini"><img class="egg" src="assets/nursery/egg.png" alt=""></div>' : isFortune(g) ? fortuneMini() : `<canvas class="mini-wheel" data-g="${esc(g.id)}" width="320" height="320"></canvas>`}
        <div class="gc-text"><h3>${esc(g.name)}</h3>
          <p class="gc-host">${esc(g.host ? (g.only ? '' : 'Run by ') + g.host : '')}${g.cost ? ' · ' + esc(g.cost) : ''}${g.only ? ` · <b>${esc(g.only)} only</b>` : ''}${g.special && g.twists.length ? ` · <b>✨ ${esc(g.special)} twists</b>` : ''}</p>
          <p class="gc-intro">${esc((g.intro || '').split('. ')[0].replace(/\.$/, ''))}.</p>
          <span class="gc-play">${isSentry(g) ? 'Take your shift →' : isDance(g) ? 'Dance with Ralts →' : isKitchen(g) ? 'Start cooking →' : isNursery(g) ? 'Visit your buddy →' : isMailRun(g) ? 'Fly the mail →' : isTruck(g) ? 'Start unloading →' : isCards21(g) ? 'Take a seat →' : isFortune(g) ? 'Draw a card →' : 'Spin the wheel →'}</span></div></a>`;
    const chores = list.filter((g) => sectionOf(g) === 'Chores'); const skill = list.filter((g) => sectionOf(g) === 'Skill Games'); const gambling = list.filter((g) => sectionOf(g) === 'Gambling Games');
    main.innerHTML = `<div class="hero"><img class="hdr" src="assets/banners/items_orbs.jpg" alt=""></div>
      <div class="row" style="justify-content:space-between;margin-top:12px"><h1 style="margin:0">Games</h1>${gm ? '<button class="btn alt sm" id="add">+ Game</button>' : ''}</div>
      ${chores.length ? `<h2 class="games-h">📋 Chores</h2><p class="small muted">Daily guild jobs everyone is expected to do. A great job pays.</p><div class="gamecards">${chores.map(card).join('')}</div>` : ''}
      ${skill.length ? `<h2 class="games-h">🎯 Skill Games</h2><p class="small muted">Games of timing and memory. Do well and earn a reward.</p><div class="gamecards">${skill.map(card).join('')}</div>` : ''}
      <h2 class="games-h">🎲 Gambling Games</h2><p class="small muted">Games of chance around Gravity Falls. Spins show up in the table's roll log for everyone.</p>
      <div class="gamecards">${gambling.map(card).join('')}</div>`;
    $$('[data-g]', main).forEach((cv) => drawWheel(cv, list.find((g) => g.id === cv.dataset.g), -Math.PI / 2));
    const a = $('#add', main);
    if (a) a.onclick = () => editContent('games', GAME_SCHEMA, null, { title: 'New game', onSave: () => renderGames(main, []) });
    return;
  }
  const g = list.find((x) => x.id === arg);
  if (!g) { main.innerHTML = '<p>That game is gone. <a href="#/games">Back</a></p>'; return; }
  // Castform's weather fortune table: cards instead of a wheel
  if (isCards21(g)) { renderCards21(main, g, gm, () => editContent('games', GAME_SCHEMA, forEdit(g), { title: 'Edit ' + g.name, onSave: () => renderGames(main, [arg]) })); return; }
  if (isTruck(g)) { renderTruck(main, g, gm, () => editContent('games', GAME_SCHEMA, forEdit(g), { title: 'Edit ' + g.name, onSave: () => renderGames(main, [arg]) })); return; }
  if (isMailRun(g)) { renderMailRun(main, g, gm, () => editContent('games', GAME_SCHEMA, forEdit(g), { title: 'Edit ' + g.name, onSave: () => renderGames(main, [arg]) })); return; }
  if (isNursery(g)) { renderNursery(main, g, gm, () => editContent('games', GAME_SCHEMA, forEdit(g), { title: 'Edit ' + g.name, onSave: () => renderGames(main, [arg]) })); return; }
  if (isKitchen(g)) { renderKitchen(main, g, gm, () => editContent('games', GAME_SCHEMA, forEdit(g), { title: 'Edit ' + g.name, onSave: () => renderGames(main, [arg]) })); return; }
  if (isDance(g)) { renderDance(main, g, gm, () => editContent('games', GAME_SCHEMA, forEdit(g), { title: 'Edit ' + g.name, onSave: () => renderGames(main, [arg]) })); return; }
  if (isSentry(g)) { renderSentry(main, g, gm, () => editContent('games', GAME_SCHEMA, forEdit(g), { title: 'Edit ' + g.name, onSave: () => renderGames(main, [arg]) })); return; }
  if (isFortune(g)) { renderFortune(main, g, gm, () => editContent('games', GAME_SCHEMA, forEdit(g), { title: 'Edit ' + g.name, onSave: () => renderGames(main, [arg]) })); return; }
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a>${gm ? '<button class="btn alt sm" id="ed">Edit</button>' : ''}</div>
    <h1 style="margin:10px 0 4px">${esc(g.name)}</h1>
    <p>${esc(g.intro || '')}</p>
    ${g.cost || g.source ? `<p>${g.cost ? `<span class="pill">🪙 Cost: ${esc(g.cost)}</span> ` : ''}${g.source ? `<a class="small" href="${esc(g.source)}" target="_blank" rel="noopener">🍀 Original wheel</a>` : ''}</p>` : ''}
    ${g.legend ? `<details class="card legend"><summary><b>📜 ${esc(g.legendTitle || 'The story')}</b></summary>${g.legend.split(/\n\s*\n/).map((x) => `<p>${esc(x.trim())}</p>`).join('')}</details>` : ''}
    <div class="wheel-layout">
    <aside class="spinners"><div class="sp-title">Who's spinning?</div><div id="splist"></div></aside>
    <div class="wheel-panel ${g.theme === 'stars' ? 'stars' : ''}"><div class="wheel-wrap"><canvas id="wheel" width="680" height="680"></canvas></div>
    ${g.special && g.twists.length ? `<label class="twist-toggle"><input type="checkbox" id="asSpecial"> ✨ ${esc(g.special)} is spinning (special twists on)</label>${g.winCap ? `<p class="small twist-cap" id="capline">${capLine(g)}</p>` : ''}` : ''}
    <button class="btn block spinbtn" id="spin">Spin the wheel</button>
    <div class="result" id="res"></div><div id="claims"></div></div>
    </div>
    <div id="lunches"></div>
    <details class="card" style="margin-top:12px"><summary><b>Prizes and odds</b></summary><div id="odds"></div></details>`;
  // some wheels are only for characters who know a certain move (Gemini's Metronome wheel: Metronome)
  const needMove = g.needsMove || (g.id === 'gemini-metronome' ? 'Metronome' : '');
  const loose = (t) => String(t).toLowerCase().replace(/[^a-z]/g, '').replace(/[aeiou]/g, '');   // sheets misspell it ("Metranome")
  const canSpin = (c) => !needMove || (c.moves || []).some((m) => loose(m) === loose(needMove));
  const party = () => Object.values(store.get('party') || {}).filter((c) => !c.guest && canSpin(c));
  let spinner = me() && canSpin(me()) ? me().id : '';
  let free = 0;            // free spins owed to the spinner (Double Trouble, Golden Wag ...)
  const costAmt = /\d/.test(g.cost || '') ? num(g.cost) : 0;
  const who = () => (store.get('party') || {})[spinner] || null;
  const nextCostPath = () => `gamenext/${g.id}/${spinner}`;
  const spinCost = () => num(store.get(nextCostPath())) || costAmt;
  const isSpecial = () => !!$('#asSpecial', main)?.checked;
  const drawSpinners = () => {
    $('#splist', main).innerHTML = party().map((c) => `<button class="sp ${c.id === spinner ? 'on' : ''}" data-sp="${c.id}">${portrait(c, 'sm')}<span><b>${esc(c.nickname)}</b><small>${num(c.poke).toLocaleString()} Poké${rankLetter(c) ? ' · ' + rankLetter(c) + '-Rank' : ''}</small></span></button>`).join('') || `<p class="small muted">${needMove ? `Only characters who know ${esc(needMove)} can spin this wheel.` : 'No characters at this table yet.'}</p>`;
    $$('[data-sp]', main).forEach((b) => b.onclick = () => { const go = () => { spinner = b.dataset.sp; free = 0; $('#claims', main).innerHTML = ''; $('#res', main).innerHTML = ''; refreshSpinner(); };
      if (b.dataset.sp === me()?.id || !pinOf(b.dataset.sp) || charOpen(b.dataset.sp)) go(); else unlockChar(b.dataset.sp, go); });
  };
  const drawOdds = () => {
    const c = who(); const t = g.slices.reduce((s, [, w]) => s + w, 0);
    $('#odds', main).innerHTML = `<table class="t"><tr><th>Slice</th><th>Chance</th><th>Prize</th>${g.twists.length ? `<th>${esc(g.special || 'Special')}’s twist</th>` : ''}</tr>${g.slices.map(([n, w, p]) => { const tw = twistFor(g, n); return `<tr><td>${esc(n)}</td><td>${((w / t) * 100).toFixed(1)}%</td><td>${esc(rankPrize(p, c) || 'GM decides')}</td>${g.twists.length ? `<td>${tw ? `<span class="twist-tag ${tw[1]}">${TWIST[tw[1]][0]} ${TWIST[tw[1]][1]}</span> ${esc(tw[2])}` : ''}</td>` : ''}</tr>`; }).join('')}</table>
      ${g.slices.some(([, , p]) => /\b[EDCBASX]-Rank\b/.test(p || '')) ? `<p class="small muted">Shop ranks in the prizes match the rank of whoever is spinning${rankLetter(c) ? ` (${esc(c.nickname)}: ${rankLetter(c)}-Rank)` : ''}. Free item lists: E-Rank = guild shop + Mundane items, D adds Common, C Uncommon, B Rare, A Very Rare.</p>` : ''}`;
  };
  const drawLunches = () => {
    const L = Object.entries(store.get('lunches') || {}).filter(([, x]) => !x.done && x.game === g.id);
    const P = store.get('party') || {};
    $('#lunches', main).innerHTML = L.length ? `<div class="card lunches"><h3>🍽️ Lunch with the Guild Leader</h3>${L.map(([id, x]) => `<div class="row nowrap"><span class="grow"><b>${esc(P[x.who]?.nickname || 'Someone')}</b>: ${esc(LUNCH[x.when] || x.when)}<span class="small muted"> · won in session ${x.session}</span></span>${gm ? `<button class="btn alt sm" data-lunchdone="${id}">Done</button>` : ''}</div>`).join('')}</div>` : '';
    $$('[data-lunchdone]', main).forEach((b) => b.onclick = () => { store.set(`lunches/${b.dataset.lunchdone}/done`, true); drawLunches(); });
  };
  const drawSpinBtn = () => {
    const c = who();
    $('#spin', main).textContent = free ? `Free spin (${free} left)` : costAmt && c ? `Spin the wheel · ${spinCost().toLocaleString()} Poké` : 'Spin the wheel';
  };
  const refreshSpinner = () => {
    const c = who(); const sp = $('#asSpecial', main);
    if (sp) sp.checked = !!(c && new RegExp(g.special, 'i').test(c.nickname || ''));
    drawSpinners(); drawOdds(); drawSpinBtn();
  };
  refreshSpinner(); drawLunches();

  // after a spin: pay out Poké, offer item pickers and the lunch choice
  async function payout(n, p, tw, c) {
    const box = $('#claims', main); const parts = [];
    let poke = pokeIn(p, isSpecial() ? tw : null);
    let capNote = '';
    if (isSpecial() && g.winCap && poke) {
      const cap = Number(g.winCap); const won = parseInt(store.get(winPath(g)), 10) || 0;
      const got = Math.max(0, Math.min(poke, cap - won));
      store.set(winPath(g), won + got);
      if (got < poke) capNote = `<p class="twist-capped">🚫 Session limit: ${esc(g.special)} only gets <b>${got.toLocaleString()}</b> of the ${poke.toLocaleString()} Poké (max ${cap.toLocaleString()} a session).</p>`;
      poke = got;
      const cl = $('#capline', main); if (cl) cl.innerHTML = capLine(g);
    }
    if (poke) { givePoke(c.id, poke); parts.push(`<p class="claim ok">🪙 <b>+${poke.toLocaleString()} Poké</b> added to ${esc(c.nickname)}’s Poké.</p>`); }
    if (tw && isSpecial()) {
      if (/next spin this session costs ([\d,]+)/i.test(tw[2])) store.set(nextCostPath(), num(tw[2].match(/costs ([\d,]+)/i)[1]));
      if (/seed or berry/i.test(tw[2])) {
        const sb = shop().filter((s) => /seed|berry/i.test(s.kind || s.name)); const it = sb[Math.floor(Math.random() * sb.length)];
        if (it) { giveItem(c.id, it.name); parts.push(`<p class="claim ok">🎒 <b>${esc(it.name)}</b> added to ${esc(c.nickname)}’s bag.</p>`); }
      }
      if (/spin again for free/i.test(tw[2])) free += 1;
      if (/whole team/i.test(tw[2])) {
        const [name, text] = tw[2].split(/:\s*/, 2);
        addTeamFx(name, `${text || tw[2]} (from ${c.nickname}’s ${g.name} spin)`, true);
        parts.push('<p class="claim ok">🌟 Added to the <b>WHOLE TEAM effects</b> banner on the Play page.</p>');
      }
    }
    if (/spin again twice/i.test(p)) free += 2;
    let items = itemCount(p);
    if (items && tw && isSpecial()) { if (/extra item/i.test(tw[2])) items += 1; if (/twice/i.test(tw[2])) items *= 2; }
    let pickers = '';
    for (let k = 0; k < items; k++) pickers += `<div class="claim pick" data-pick="${k}"><label class="f">Choose free item ${items > 1 ? k + 1 : ''}<select><option value="">Loading…</option></select></label><button class="btn sm">Put in bag</button></div>`;
    const lunch = /lunch with the guild leader/i.test(p) ? `<div class="claim lunch"><b>🍽️ When is lunch with the Guild Leader?</b><div class="row">${Object.entries(LUNCH).map(([k, v]) => `<button class="btn alt sm" data-lunch="${k}">${esc(v)}</button>`).join('')}</div></div>` : '';
    if (poke || items || lunch || /spin again/i.test(p)) { markWinner(c.id); parts.push(`<p class="claim ok">✨ Winner! ${esc(c.nickname)}’s cursor sparkles for the next day.</p>`); }
    box.innerHTML = capNote + parts.join('') + pickers + lunch + (free ? `<p class="claim ok">🎟️ ${esc(c.nickname)} has <b>${free}</b> free spin${free > 1 ? 's' : ''} — tap the button above.</p>` : '');
    drawSpinBtn(); drawSpinners();
    if (items) {
      const opts = await prizeChoices(p, c);
      $$('[data-pick]', box).forEach((el) => {
        el.querySelector('select').innerHTML = `<option value="">Pick an item…</option>${opts.map((o) => `<option value="${esc(o.name)}">${esc(o.name)}${o.price ? ` (${o.price.toLocaleString()} Poké)` : ''}${o.note ? ' · ' + esc(o.note) : ''}</option>`).join('')}`;
        el.querySelector('button').onclick = () => {
          const v = el.querySelector('select').value; if (!v) { toast('Pick an item first'); return; }
          giveItem(c.id, v);
          logRoll(c.nickname, `${g.name} — prize`, null, `${v} put in ${c.nickname}’s bag`, 'note');
          el.outerHTML = `<p class="claim ok">🎒 <b>${esc(v)}</b> added to ${esc(c.nickname)}’s bag.</p>`;
        };
      });
    }
    $$('[data-lunch]', box).forEach((b) => b.onclick = () => {
      store.set('lunches/' + uid(), { who: c.id, when: b.dataset.lunch, session: sessN(), game: g.id, t: Date.now() });
      logRoll(c.nickname, `${g.name} — prize`, null, `Lunch with the Guild Leader: ${LUNCH[b.dataset.lunch]}`, 'note');
      gmTodo(`Lunch with the Guild Leader for ${c.nickname}: ${LUNCH[b.dataset.lunch]}`);
      b.closest('.claim').outerHTML = `<p class="claim ok">🍽️ Lunch with the Guild Leader booked: <b>${esc(LUNCH[b.dataset.lunch])}</b>.</p>`;
      drawLunches();
    });
    return capNote;
  }

  const cv = $('#wheel', main);
  let rot = -Math.PI / 2; drawWheel(cv, g, rot);
  let spinning = false;
  $('#spin', main).onclick = () => {
    if (spinning) return;
    const c = who();
    if (!c) { toast('Tap who’s spinning first'); return; }
    if (!canSpin(c)) { toast(`Only characters who know ${needMove} can spin this wheel`); return; }
    let paid = 0;
    if (free) free -= 1;
    else if (costAmt) {
      paid = spinCost();
      if (num(c.poke) < paid) { toast(`${c.nickname} needs ${paid.toLocaleString()} Poké to spin (has ${num(c.poke).toLocaleString()})`); return; }
      givePoke(c.id, -paid); store.set(nextCostPath(), null);
    }
    spinning = true; drawSpinBtn(); drawSpinners();
    const i = pick(g);
    const total = g.slices.reduce((s, [, w]) => s + w, 0);
    const before = g.slices.slice(0, i).reduce((s, [, w]) => s + w, 0);
    const mid = ((before + g.slices[i][1] * (0.15 + Math.random() * 0.7)) / total) * Math.PI * 2;
    // pointer is at angle 0, so the chosen point must end at angle 0: final rotation = -mid (+ whole turns)
    const start = rot; const turns = 6 + Math.floor(Math.random() * 3);
    let target = -mid; while (target < start) target += Math.PI * 2; target += turns * Math.PI * 2;
    const T = 5200; const t0 = performance.now();
    $('#res', main).innerHTML = ''; $('#claims', main).innerHTML = '';
    const step = async (now) => {
      const t = Math.min(1, (now - t0) / T); const e = 1 - Math.pow(1 - t, 4);
      rot = start + (target - start) * e; drawWheel(cv, g, rot);
      if (t < 1) { requestAnimationFrame(step); return; }
      spinning = false; rot %= Math.PI * 2;
      const [n, , p0] = g.slices[i]; const p = rankPrize(p0, c);
      const tw = isSpecial() ? twistFor(g, n) : null;
      $('#res', main).innerHTML = `<div class="big">${esc(n)}</div>${p ? `<p>${esc(p)}</p>` : '<p class="small muted">Your GM tells you what you won.</p>'}`
        + (tw ? `<div class="twist ${tw[1]}"><b>${TWIST[tw[1]][0]} ${esc(g.special)}’s ${TWIST[tw[1]][1]}</b><p>${esc(tw[2])}</p>${/Metronome wheel/i.test(tw[2]) ? '<a class="gemini-wag" href="#/games/gemini-metronome">Spin Gemini’s Metronome wheel →</a>' : ''}</div>` : '');
      const capNote = await payout(n, p, tw, (store.get('party') || {})[c.id] || c);
      logRoll(c.nickname, `${g.name} — spin`, null, (paid ? `paid ${paid} Poké · ` : '') + n + (p ? ` (${p})` : '') + (tw ? ` · ${g.special}’s ${TWIST[tw[1]][1].toLowerCase()}: ${tw[2]}` : '') + (capNote ? ` · capped by the ${Number(g.winCap).toLocaleString()} Poké session limit` : ''), 'note');
      if (g.id === 'lucky-den') luckyReaction(c.nickname, n, p);
      toast(`${g.name}: ${n}`);
    };
    requestAnimationFrame(step);
  };
  const e = $('#ed', main);
  if (e) e.onclick = () => editContent('games', GAME_SCHEMA, forEdit(g), { title: 'Edit ' + g.name, onSave: () => renderGames(main, [arg]) });
}

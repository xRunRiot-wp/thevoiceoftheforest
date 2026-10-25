// Gambling games (Lucky Den Gambling Corner and any game the GM adds). Each game is a prize wheel:
// slices are sized by weight and picked by weight, like the GM's Wheel of Names wheels.
import * as store from './store.js?v=6ade7f44';
import { $, $$, esc, toast } from './util.js?v=6ade7f44';
import { modal } from './ui.js?v=6ade7f44';
import { merged, editContent } from './content-store.js?v=6ade7f44';
import { logRoll, me } from './play.js?v=6ade7f44';
import { ranks } from './rulebook.js?v=6ade7f44';

export const GAMES = [
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
    special: 'Gemini',
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
    id: 'gemini-metronome', name: "Gemini's Metronome", host: 'Gemini (Cleffa)', only: 'Gemini', theme: 'stars',
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
const GAME_SCHEMA = [['name', 'Game name'], ['host', 'Run by'], ['intro', 'About', 'area'], ['cost', 'Cost to play (e.g. 50 Poké)'],
  ['slicesText', 'Slices — one per line: Name | weight | prize (weight 1 = normal, 0.5 = half as likely)', 'area'], ['colorsText', 'Colours (comma separated, optional)'], ['legendTitle', 'Story title (optional)'], ['legend', 'Story (optional)', 'area'],
  ['special', 'Special character (gets twists when they spin, optional)'],
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
export const games = () => merged('games', GAMES).map(parse);
const forEdit = (g) => ({ ...g, slicesText: g.slices.map(([n, w, p]) => `${n} | ${w}${p ? ' | ' + p : ''}`).join('\n'), colorsText: g.colors.join(', '),
  twistsText: g.twists.map(([n, k, t]) => `${n} | ${k} | ${t}`).join('\n') });
// Prizes that name a rank (e.g. "E-Rank shop item") use the spinner's own rank: Basic = E, Bronze = D, Silver = C ...
const myRankLetter = () => {
  const c = me(); if (!c?.rank) return '';
  const r = ranks().find((x) => [x.name, x.alt].some((n) => n && n.toLowerCase() === c.rank.toLowerCase()));
  return r && /^[A-Z]$/.test(r.missions || '') ? r.missions : '';
};
const rankPrize = (p) => { const L = myRankLetter(); return L ? p.replace(/\b[EDCBASX]-Rank\b/g, `${L}-Rank`) : p; };
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
    main.innerHTML = `<div class="hero"><img class="hdr" src="assets/banners/items_orbs.jpg" alt=""></div>
      <div class="row" style="justify-content:space-between;margin-top:12px"><h1 style="margin:0">Gambling Games</h1>${gm ? '<button class="btn alt sm" id="add">+ Game</button>' : ''}</div>
      <p class="small muted">Games of chance around Gravity Falls. Spins show up in the table's roll log for everyone.</p>
      <div class="gamecards">${list.map((g) => `<a class="gamecard ${g.theme === 'stars' ? 'stars' : ''}" href="#/games/${esc(g.id)}">
        <canvas class="mini-wheel" data-g="${esc(g.id)}" width="320" height="320"></canvas>
        <div class="gc-text"><h3>${esc(g.name)}</h3>
          <p class="gc-host">${esc(g.host ? (g.only ? '' : 'Run by ') + g.host : '')}${g.cost ? ' · ' + esc(g.cost) : ''}${g.only ? ` · <b>${esc(g.only)} only</b>` : ''}${g.special && g.twists.length ? ` · <b>✨ ${esc(g.special)} twists</b>` : ''}</p>
          <p class="gc-intro">${esc((g.intro || '').split('. ')[0].replace(/\.$/, ''))}.</p>
          <span class="gc-play">Spin the wheel →</span></div></a>`).join('')}</div>`;
    $$('[data-g]', main).forEach((cv) => drawWheel(cv, list.find((g) => g.id === cv.dataset.g), -Math.PI / 2));
    const a = $('#add', main);
    if (a) a.onclick = () => editContent('games', GAME_SCHEMA, null, { title: 'New game', onSave: () => renderGames(main, []) });
    return;
  }
  const g = list.find((x) => x.id === arg);
  if (!g) { main.innerHTML = '<p>That game is gone. <a href="#/games">Back</a></p>'; return; }
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a>${gm ? '<button class="btn alt sm" id="ed">Edit</button>' : ''}</div>
    <h1 style="margin:10px 0 4px">${esc(g.name)}</h1>
    <p>${esc(g.intro || '')}</p>
    ${g.cost || g.source ? `<p>${g.cost ? `<span class="pill">🪙 Cost: ${esc(g.cost)}</span> ` : ''}${g.source ? `<a class="small" href="${esc(g.source)}" target="_blank" rel="noopener">🍀 Original wheel</a>` : ''}</p>` : ''}
    ${g.legend ? `<details class="card legend"><summary><b>📜 ${esc(g.legendTitle || 'The story')}</b></summary>${g.legend.split(/\n\s*\n/).map((x) => `<p>${esc(x.trim())}</p>`).join('')}</details>` : ''}
    <div class="wheel-panel ${g.theme === 'stars' ? 'stars' : ''}"><div class="wheel-wrap"><canvas id="wheel" width="680" height="680"></canvas></div>
    ${g.special && g.twists.length ? `<label class="twist-toggle"><input type="checkbox" id="asSpecial" ${new RegExp(g.special, 'i').test(me()?.nickname || '') ? 'checked' : ''}> ✨ ${esc(g.special)} is spinning (special twists on)</label>` : ''}
    <button class="btn block spinbtn" id="spin">Spin the wheel</button>
    <div class="result" id="res"></div></div>
    <details class="card" style="margin-top:12px"><summary><b>Prizes and odds</b></summary>
      <table class="t"><tr><th>Slice</th><th>Chance</th><th>Prize</th>${g.twists.length ? `<th>${esc(g.special || 'Special')}’s twist</th>` : ''}</tr>${(() => { const t = g.slices.reduce((s, [, w]) => s + w, 0); return g.slices.map(([n, w, p]) => { const tw = twistFor(g, n); return `<tr><td>${esc(n)}</td><td>${((w / t) * 100).toFixed(1)}%</td><td>${esc(rankPrize(p) || 'GM decides')}</td>${g.twists.length ? `<td>${tw ? `<span class="twist-tag ${tw[1]}">${TWIST[tw[1]][0]} ${TWIST[tw[1]][1]}</span> ${esc(tw[2])}` : ''}</td>` : ''}</tr>`; }).join(''); })()}</table>
      ${g.slices.some(([, , p]) => /\b[EDCBASX]-Rank\b/.test(p || '')) ? `<p class="small muted">Shop ranks in the prizes match the rank of whoever is spinning${myRankLetter() ? ` (yours: ${myRankLetter()}-Rank)` : ''}.</p>` : ''}
    </details>`;
  const cv = $('#wheel', main);
  let rot = -Math.PI / 2; drawWheel(cv, g, rot);
  let spinning = false;
  $('#spin', main).onclick = () => {
    if (spinning) return; spinning = true;
    const i = pick(g);
    const total = g.slices.reduce((s, [, w]) => s + w, 0);
    const before = g.slices.slice(0, i).reduce((s, [, w]) => s + w, 0);
    const mid = ((before + g.slices[i][1] * (0.15 + Math.random() * 0.7)) / total) * Math.PI * 2;
    // pointer is at angle 0, so the chosen point must end at angle 0: final rotation = -mid (+ whole turns)
    const start = rot; const turns = 6 + Math.floor(Math.random() * 3);
    let target = -mid; while (target < start) target += Math.PI * 2; target += turns * Math.PI * 2;
    const T = 5200; const t0 = performance.now();
    $('#res', main).innerHTML = '';
    const step = (now) => {
      const t = Math.min(1, (now - t0) / T); const e = 1 - Math.pow(1 - t, 4);
      rot = start + (target - start) * e; drawWheel(cv, g, rot);
      if (t < 1) requestAnimationFrame(step);
      else {
        spinning = false; rot %= Math.PI * 2;
        const [n, , p0] = g.slices[i]; const p = rankPrize(p0 || '');
        const tw = $('#asSpecial', main)?.checked ? twistFor(g, n) : null;
        $('#res', main).innerHTML = `<div class="big">${esc(n)}</div>${p ? `<p>${esc(p)}</p>` : '<p class="small muted">Your GM tells you what you won.</p>'}`
          + (tw ? `<div class="twist ${tw[1]}"><b>${TWIST[tw[1]][0]} ${esc(g.special)}’s ${TWIST[tw[1]][1]}</b><p>${esc(tw[2])}</p>${/Metronome wheel/i.test(tw[2]) ? '<a class="gemini-wag" href="#/games/gemini-metronome">Spin Gemini’s Metronome wheel →</a>' : ''}</div>` : '');
        const who = me()?.nickname || 'Someone';
        logRoll(who, `${g.name} — spin`, null, n + (p ? ` (${p})` : '') + (tw ? ` · ${g.special}’s ${TWIST[tw[1]][1].toLowerCase()}: ${tw[2]}` : ''), 'note');
        toast(`${g.name}: ${n}`);
      }
    };
    requestAnimationFrame(step);
  };
  const e = $('#ed', main);
  if (e) e.onclick = () => editContent('games', GAME_SCHEMA, forEdit(g), { title: 'Edit ' + g.name, onSave: () => renderGames(main, [arg]) });
}

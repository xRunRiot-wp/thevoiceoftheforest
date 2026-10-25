// Gambling games (Lucky Den Gambling Corner and any game the GM adds). Each game is a prize wheel:
// slices are sized by weight and picked by weight, like the GM's Wheel of Names wheels.
import * as store from './store.js?v=6ade796e';
import { $, $$, esc, toast } from './util.js?v=6ade796e';
import { modal } from './ui.js?v=6ade796e';
import { merged, editContent } from './content-store.js?v=6ade796e';
import { logRoll, me } from './play.js?v=6ade796e';

export const GAMES = [
  {
    id: 'lucky-den', name: 'The Lucky Den', host: 'Chandelure',
    intro: 'The Lucky Den Gambling Corner. Pay the house, spin the wheel, and hope luck is on your side. (Chandelure does not approve of big winners.)',
    cost: '', source: 'https://wheelofnames.com/v6z-9aj',
    colors: ['#3EA1B6', '#0E6B8C', '#133855', '#6B669E', '#BB90C8', '#EFD8EC'],
    slices: [
      ['Little Luck', 1.75, ''], ['Pocket Change', 0.75, ''], ['Lucky Find', 1, ''], ['Big Payday', 0.75, ''], ['Jackpot', 0.5, ''],
      ['Guild Stash', 1, ''], ['Lucky Shopper', 1, ''], ["Guild Leader's Table", 1, ''], ['Double Trouble', 0.1, ''], ['Golden Paw', 0.1, ''],
      ['No luck', 1.75, ''],
    ],
  },
];
const GAME_SCHEMA = [['name', 'Game name'], ['host', 'Run by'], ['intro', 'About', 'area'], ['cost', 'Cost to play (e.g. 50 Poké)'],
  ['slicesText', 'Slices — one per line: Name | weight | prize (weight 1 = normal, 0.5 = half as likely)', 'area'], ['colorsText', 'Colours (comma separated, optional)']];

const parse = (g) => {
  const slices = g.slicesText != null
    ? g.slicesText.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0]).map(([n, w, p]) => [n, Math.max(0.01, parseFloat(w) || 1), p || ''])
    : g.slices || [];
  const colors = g.colorsText ? g.colorsText.split(',').map((x) => x.trim()).filter(Boolean) : g.colors || ['#e07b24', '#4f9d4a', '#3a8fd8', '#9a6b3c', '#c9b8ff', '#d6a93a'];
  return { ...g, slices, colors };
};
export const games = () => merged('games', GAMES).map(parse);
const forEdit = (g) => ({ ...g, slicesText: g.slices.map(([n, w, p]) => `${n} | ${w}${p ? ' | ' + p : ''}`).join('\n'), colorsText: g.colors.join(', ') });

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
  x.restore();
  x.beginPath(); x.arc(S / 2, S / 2, S * .07, 0, Math.PI * 2); x.fillStyle = '#fffaf0'; x.fill(); x.strokeStyle = '#4a2f14'; x.lineWidth = 4; x.stroke();
  // pointer at the right edge (3 o'clock)
  x.beginPath(); x.moveTo(S - 2, S / 2 - 14); x.lineTo(S - 34, S / 2); x.lineTo(S - 2, S / 2 + 14); x.closePath(); x.fillStyle = '#4a2f14'; x.fill();
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
      <div class="grid g2">${list.map((g) => `<a class="card" href="#/games/${esc(g.id)}" style="margin:0;text-decoration:none;color:inherit">
        <canvas class="mini-wheel" data-g="${esc(g.id)}" width="160" height="160"></canvas>
        <h3 style="margin:8px 0 2px">${esc(g.name)}</h3><p class="small muted" style="margin:0">${esc(g.host ? 'Run by ' + g.host : '')}${g.cost ? ' · ' + esc(g.cost) : ''}</p></a>`).join('')}</div>`;
    $$('[data-g]', main).forEach((cv) => drawWheel(cv, list.find((g) => g.id === cv.dataset.g), 0));
    const a = $('#add', main);
    if (a) a.onclick = () => editContent('games', GAME_SCHEMA, null, { title: 'New game', onSave: () => renderGames(main, []) });
    return;
  }
  const g = list.find((x) => x.id === arg);
  if (!g) { main.innerHTML = '<p>That game is gone. <a href="#/games">Back</a></p>'; return; }
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a>${gm ? '<button class="btn alt sm" id="ed">Edit</button>' : ''}</div>
    <h1 style="margin:10px 0 4px">${esc(g.name)}</h1>
    <p>${esc(g.intro || '')}</p>
    ${g.cost ? `<p><span class="pill">Cost: ${esc(g.cost)}</span></p>` : ''}
    <div class="wheel-wrap"><canvas id="wheel" width="680" height="680"></canvas></div>
    <button class="btn block" id="spin" style="margin-top:12px">Spin the wheel</button>
    <div class="result" id="res"></div>
    <details class="card" style="margin-top:12px"><summary><b>Prizes and odds</b></summary>
      <table class="t"><tr><th>Slice</th><th>Chance</th><th>Prize</th></tr>${(() => { const t = g.slices.reduce((s, [, w]) => s + w, 0); return g.slices.map(([n, w, p]) => `<tr><td>${esc(n)}</td><td>${((w / t) * 100).toFixed(1)}%</td><td>${esc(p || 'GM decides')}</td></tr>`).join(''); })()}</table>
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
        const [n, , p] = g.slices[i];
        $('#res', main).innerHTML = `<div class="big">${esc(n)}</div>${p ? `<p>${esc(p)}</p>` : '<p class="small muted">Your GM tells you what you won.</p>'}`;
        const who = me()?.nickname || 'Someone';
        logRoll(who, `${g.name} — spin`, null, n + (p ? ` (${p})` : ''), 'note');
        toast(`${g.name}: ${n}`);
      }
    };
    requestAnimationFrame(step);
  };
  const e = $('#ed', main);
  if (e) e.onclick = () => editContent('games', GAME_SCHEMA, forEdit(g), { title: 'Edit ' + g.name, onSave: () => renderGames(main, [arg]) });
}

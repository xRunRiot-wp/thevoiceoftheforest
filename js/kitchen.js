// Spinda's Kitchen (her ask 10-27): a daily kitchen chore, a simple take on Scarlet/Violet's sandwiches.
// Spinda leaves a recipe; a player puts berries in the pot (their own, the team bag's, or from Guild Storage),
// stirs it, and Spinda comes to taste. Good stew = dinner on time. Bad = Spinda spits it out and dinner is late.
// REALLY REALLY good = it's served at dinner and the whole team gets a WHOLE TEAM effect from the recipe.
// One stew a day for the guild. Recipes are GM-editable (content/recipes).
import * as store from './store.js?v=6ae13f87';
import { $, $$, esc, toast, num, uid, slug } from './util.js?v=6ae13f87';
import { me, logRoll, addTeamFx } from './play.js?v=6ae13f87';
import { dailyRoll, hash } from './weather.js?v=6ae13f87';
import { gameSay, gmTodo } from './chatter.js?v=6ae13f87';
import { markWinner } from './sparkle.js?v=6ae13f87';
import { merged, editContent, saveContent, deleteContent } from './content-store.js?v=6ae13f87';
import { modal, closeModal } from './ui.js?v=6ae13f87';
import { ledger } from './vault.js?v=6ae13f87';
import { faceHTML, faceSrc } from './sentry.js?v=6ae13f87';

export const isKitchen = (g) => g.kind === 'kitchen' || g.id === 'spinda-kitchen';

export const RECIPE_SCHEMA = [['name', 'Stew name'], ['berries', 'Berries (e.g. Oran Berry ×2, Pecha Berry ×1)'], ['note', 'Spinda’s note on the recipe card', 'area'],
  ['buff', 'WHOLE TEAM effect name (when it’s REALLY good)'], ['buffText', 'What the effect does', 'area']];
const RECIPES = [
  { id: 'hearty-oran', name: 'Hearty Oran Stew', berries: 'Oran Berry ×3, Leppa Berry ×1', note: 'Three Orans for body, one Leppa for zing! Stir gently or it goes gloopy.',
    buff: 'Hearty Stew', buffText: 'Once each: heal 1 HP at any time.' },
  { id: 'soothing-pecha', name: 'Soothing Pecha Soup', berries: 'Pecha Berry ×2, Rawst Berry ×1, Oran Berry ×1', note: 'Sweet and calming. Pecha first, then the rest!',
    buff: 'Soothing Stew', buffText: 'Once each: shrug off Poison or Burn the moment it hits.' },
  { id: 'wake-up-chili', name: 'Wake-Up Chili', berries: 'Cheri Berry ×2, Chesto Berry ×2', note: 'Spicy! Spicy!! Keeps your eyes open all night.',
    buff: 'Wide-Awake Stew', buffText: 'Once each: ignore Paralysis or Sleep for one round.' },
  { id: 'spirited-leppa', name: 'Spirited Leppa Broth', berries: 'Leppa Berry ×2, Oran Berry ×2', note: 'A broth for brave hearts. Don’t skimp on the Leppas!',
    buff: 'Spirited Stew', buffText: 'Once each: regain 1 Will.' },
  { id: 'clear-head', name: 'Clear-Head Hotpot', berries: 'Persim Berry ×2, Aspear Berry ×1, Oran Berry ×1', note: 'For foggy minds and frozen toes. Mix mix mix!',
    buff: 'Clear-Headed Stew', buffText: 'Once each: +1 die on a roll against Confusion or being Frozen.' },
  { id: 'feast-stew', name: 'Woodland Feast Stew', berries: 'Sitrus Berry ×1, Oran Berry ×2, Pecha Berry ×1', note: 'The special! Only for very good days.',
    buff: 'Feast Stew', buffText: 'Once each: +1 die on any one roll.' },
];
export const recipes = () => merged('recipes', RECIPES).filter((r) => r.name);
const parseBerries = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const m = x.match(/^(.*?)\s*[×x]\s*(\d+)$/); return m ? [m[1].trim(), num(m[2]) || 1] : [x, 1]; });
const today = () => dailyRoll().day;
const todaysStew = () => store.get('kitchen/' + today()) || null;
export const kitchenDue = () => !!me() && !todaysStew();
const recipeToday = () => { const all = recipes(); return all.length ? all[Math.floor(hash(`${store.tableCode()}|stew|${today()}`) * all.length)] : null; };
const isBerry = (n) => /berry$/i.test(n || '');

const SPINDA = { great: ['Joyous', 'Inspired'], good: ['Happy'], bad: ['Shouting', 'Dizzy'], wait: ['Normal'], taste: ['Determined', 'Normal'], hmm: ['Worried'] };
const spinda = (mood, line) => `<div class="sentry-digg"><img class="sface dig" src="${faceSrc('spinda', mood, SPINDA)}" alt="Spinda"><div class="bubble"><b>Spinda:</b> “${esc(line)}”</div></div>`;
const sprite = (cls = '') => `<span class="spinda-spr ${cls}" aria-hidden="true"></span>`;
export const kitchenMini = () => `<div class="kitchen-mini">${sprite()}</div>`;
const TIERS = [[90, 'REALLY REALLY good!', 'great'], [55, 'Good stew', 'good'], [0, 'Spat out', 'bad']];
const tierOf = (score) => TIERS.find(([min]) => score >= min);

// berries this character can use: own bag, team bag, and their guild's storage
function pantry(c) {
  const g = c.guild === 'vanguard' ? 'vanguard' : 'woodland';
  const out = {};
  const add = (src, id, b) => { if (!isBerry(b.name) || num(b.qty) < 1) return; (out[b.name] ||= []).push({ src, id, qty: num(b.qty) }); };
  Object.entries(store.get('bag') || {}).forEach(([id, b]) => { if (b.owner === c.id) add('mine', id, b); else if (b.owner === 'team') add('team', id, b); });
  Object.entries(store.get('storage') || {}).forEach(([id, b]) => { if ((b.guild === 'vanguard' ? 'vanguard' : 'woodland') === g) add('storage', id, b); });
  return out;
}
const SRC = { mine: 'your bag', team: 'team bag', storage: 'Guild Storage' };

// Berry pictures (her ask 10-27): assets/items/<name>-berry.png. Explorers-style berries from PMDCollab's RawAsset,
// the berries Explorers doesn't have (Pecha, Cheri, Chesto…) are the main-series bag icons (PokéAPI sprites).
const BERRIES = ['Aguav', 'Apicot', 'Aspear', 'Babiri', 'Belue', 'Bluk', 'Charti', 'Cheri', 'Chesto', 'Chilan', 'Chople', 'Coba', 'Colbur', 'Cornn', 'Custap', 'Durin', 'Enigma', 'Figy', 'Ganlon', 'Grepa', 'Haban', 'Hondew', 'Iapapa', 'Jaboca', 'Kasib', 'Kebia', 'Kee', 'Kelpsy', 'Leppa', 'Liechi', 'Lum', 'Mago', 'Magost', 'Maranga', 'Micle', 'Nanab', 'Nomel', 'Occa', 'Oran', 'Pamtre', 'Passho', 'Payapa', 'Pecha', 'Persim', 'Petaya', 'Pinap', 'Pomeg', 'Qualot', 'Rabuta', 'Rawst', 'Razz', 'Rindo', 'Roseli', 'Rowap', 'Salac', 'Shuca', 'Sitrus', 'Spelon', 'Starf', 'Tamato', 'Tanga', 'Wacan', 'Watmel', 'Wepear', 'Wiki', 'Yache'].map((b) => b + ' Berry');
const berrySrc = (n) => `assets/items/${slug(n)}.png`;
const berryImg = (n, cls = '') => `<img class="berry-img ${cls}" src="${berrySrc(n)}" alt="" onerror="this.style.visibility='hidden'">`;
// each berry's colour, read from its picture, tints the stew
const COLORS = {};
function berryColor(n) {
  if (COLORS[n]) return Promise.resolve(COLORS[n]);
  return new Promise((ok) => {
    const im = new Image(); im.onerror = () => ok(COLORS[n] = [200, 120, 160]);
    im.onload = () => {
      const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, im.width, im.height).data; let r = 0; let g = 0; let b = 0; let k = 0;
      for (let i = 0; i < d.length; i += 4) { const s = d[i] + d[i + 1] + d[i + 2]; if (d[i + 3] > 200 && s > 120 && s < 690) { r += d[i]; g += d[i + 1]; b += d[i + 2]; k++; } }
      ok(COLORS[n] = k ? [r / k, g / k, b / k].map(Math.round) : [200, 120, 160]);
    };
    im.src = berrySrc(n);
  });
}
const WATER = [143, 201, 232];
async function potLook(pot) {
  const cols = await Promise.all(pot.map((p) => berryColor(p.name)));
  const all = [WATER, ...cols]; const w = (i) => (i === 0 ? (cols.length ? 0.25 : 1) : 1.6);
  const tot = all.reduce((t, _, i) => t + w(i), 0);
  const c = [0, 1, 2].map((j) => Math.round(all.reduce((t, col, i) => t + col[j] * w(i), 0) / tot));
  return { color: `rgb(${c.join(',')})`, level: Math.min(88, 22 + pot.length * 9) };
}
const potHTML = (inner = '') => `<div class="pot-vis"><div class="liquid"><i class="bubbles"></i></div><div class="drop-layer"></div>${inner}<div class="pot-body"></div><div class="pot-rim"></div></div>`;
async function paintPot(root, pot) { const el = $('.liquid', root); if (!el) return; const l = await potLook(pot); el.style.background = l.color; el.style.height = l.level + '%'; }

function score(recipe, pot, stirs) {
  const need = parseBerries(recipe.berries);
  const want = Object.fromEntries(need);
  const got = {}; pot.forEach((p) => { got[p.name] = (got[p.name] || 0) + 1; });
  const match = need.reduce((s, [n, k]) => s + Math.min(got[n] || 0, k) / k, 0) / Math.max(1, need.length);
  const extra = Object.entries(got).reduce((s, [n, k]) => s + (want[n] ? Math.max(0, k - want[n]) * 5 : k * 10), 0);
  return Math.max(0, Math.min(100, Math.round(match * 60 - Math.min(30, extra) + stirs * 8)));
}

function cook(c, box, recipe, onDone) {
  const pot = []; // [{name, src, id}]
  const need = parseBerries(recipe.berries);
  const draw = (dropped) => {
    const pan = pantry(c);
    const used = (src, id) => pot.filter((p) => p.src === src && p.id === id).length;
    const names = Object.keys(pan).sort((a, b) => (need.some(([n]) => n === b) - need.some(([n]) => n === a)) || a.localeCompare(b));
    const inPot = {}; pot.forEach((p) => { inPot[p.name] = (inPot[p.name] || 0) + 1; });
    box.innerHTML = `<div class="kitchen">
      ${spinda('wait', recipe.note || 'Follow my recipe, okay? I’ll be back to taste it!')}
      <div class="cook-row">
        <div class="recipe-card"><div class="rc-title">📜 ${esc(recipe.name)}</div>${recipe.by ? `<div class="small muted">a recipe by ${esc(recipe.by)}</div>` : ''}<ul>${need.map(([n, k]) => `<li class="${(inPot[n] || 0) >= k ? 'ok' : ''}">${(inPot[n] || 0) >= k ? '✅' : '⬜'} ${berryImg(n)} ${esc(n)} ×${k} <span class="small muted">(${inPot[n] || 0} in)</span></li>`).join('')}</ul></div>
        <div class="potwrap">${potHTML()}<div class="pot-in">${pot.length ? pot.map((p, i) => `<button class="pot-b" data-out="${i}" title="Take ${esc(p.name)} back out">${berryImg(p.name)}<span>✕</span></button>`).join('') : '<span class="small muted">Tap a berry to drop it in.</span>'}</div></div>
      </div>
      <h3 style="margin:12px 0 4px">Your berries</h3>
      ${names.length ? `<div class="pantry">${names.map((n) => pan[n].map((s) => { const left = s.qty - used(s.src, s.id); return `<button class="berry-t ${need.some(([x]) => x === n) ? 'want' : ''}" data-add="${esc(n)}" data-src="${s.src}" data-id="${esc(s.id)}" ${left > 0 ? '' : 'disabled'}>${berryImg(n)}<b>${esc(n.replace(/ Berry$/, ''))}</b><small>${SRC[s.src]} ×${left}</small></button>`; }).join('')).join('')}</div>`
        : '<p class="small muted">No berries in your bag, the team bag or Guild Storage. You can still cook… but Spinda won’t be impressed.</p>'}
      <button class="btn block" id="tostir" style="margin-top:12px">Done adding, start stirring 🥄</button></div>`;
    paintPot(box, dropped ? pot.slice(0, -1) : pot).then(() => {
      if (!dropped) return;
      const layer = $('.drop-layer', box); if (!layer) return;
      layer.innerHTML = berryImg(dropped, 'falling');
      setTimeout(() => { paintPot(box, pot); $('.liquid', box)?.classList.add('splash'); }, 420);
    });
    $$('[data-add]', box).forEach((b) => b.onclick = () => { pot.push({ name: b.dataset.add, src: b.dataset.src, id: b.dataset.id }); draw(b.dataset.add); });
    $$('[data-out]', box).forEach((b) => b.onclick = () => { pot.splice(+b.dataset.out, 1); draw(); });
    $('#tostir', box).onclick = () => stir(c, box, recipe, pot, onDone);
  };
  draw();
}

// stirring (her ask: a real stirring part): the spoon sweeps across the pot; tap Stir when it's over the green swirl.
// 5 stirs, a little faster each time; a good stir swirls the stew.
function stir(c, box, recipe, pot, onDone) {
  let n = 0; let hits = 0; let pos = 0; let dir = 1; let raf = 0; let last = performance.now();
  box.innerHTML = `<div class="kitchen">${spinda('wait', 'Stir when the spoon is over the green swirl! Not too fast, not too slow!')}
    <div class="potwrap big">${potHTML('<div class="stir-zone"></div><b class="spoon">🥄</b>')}</div>
    <div class="stir-dots">${Array.from({ length: 5 }, () => '<i></i>').join('')}</div>
    <button class="btn block" id="stirb">Stir!</button></div>`;
  paintPot(box, pot);
  const spoon = $('.spoon', box); const liquid = $('.liquid', box); const dots = $$('.stir-dots i', box);
  const tick = (t) => {
    if (!box.isConnected) return;
    const dt = (t - last) / 1000; last = t;
    pos += dir * dt * (0.8 + n * 0.15); if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
    spoon.style.left = `calc(${10 + pos * 80}% - 14px)`; spoon.style.transform = `rotate(${(pos - 0.5) * 50}deg)`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  $('#stirb', box).onclick = () => {
    if (n >= 5) return;
    const good = Math.abs(pos - 0.5) <= 0.12;
    if (good) hits++;
    dots[n].className = good ? 'ok' : 'bad';
    liquid.classList.remove('swirl', 'slosh'); void liquid.offsetWidth; liquid.classList.add(good ? 'swirl' : 'slosh');
    n++;
    if (n >= 5) { cancelAnimationFrame(raf); $('#stirb', box).disabled = true; setTimeout(() => taste(c, box, recipe, pot, hits, onDone), 900); }
  };
}

function useUp(c, pot) {
  for (const p of pot) {
    const path = p.src === 'storage' ? 'storage' : 'bag';
    const it = (store.get(path) || {})[p.id]; if (!it) continue;
    if (num(it.qty) <= 1) store.set(`${path}/${p.id}`, null); else store.set(`${path}/${p.id}/qty`, num(it.qty) - 1);
    if (p.src === 'storage') ledger(it.guild, `${c.nickname} took ${p.name} ×1 from storage for Spinda’s stew`);
  }
}

function taste(c, box, recipe, pot, hits, onDone) {
  const sc = score(recipe, pot, hits); const [, tier, mood] = tierOf(sc);
  useUp(c, pot);
  store.set('kitchen/' + today(), { by: c.id, name: c.nickname, recipe: recipe.name, score: sc, tier, mood, t: Date.now() });
  box.innerHTML = `<div class="kitchen taste">${spinda('taste', 'Sniff sniff… I’m coming! Let me try it!')}
    <div class="kitchen-stage"><span class="pot-big">🍲</span>${sprite('walk')}</div><div class="taste-meter"><i></i></div></div>`;
  const spr = $('.spinda-spr', box);
  setTimeout(() => { if (box.isConnected) { spr.className = 'spinda-spr eat'; $('.kitchen .sentry-digg', box).outerHTML = spinda('hmm', 'Mmm… mm… hmm…'); } }, 1700);
  setTimeout(() => {
    if (!box.isConnected) return;
    spr.className = 'spinda-spr ' + (mood === 'bad' ? 'hurt' : mood === 'great' ? 'twirl' : '');
    $('.taste-meter i', box).style.width = sc + '%';
    const line = mood === 'great' ? 'THIS IS INCREDIBLE!! I’m serving it at dinner. Everyone is going to feel amazing!'
      : mood === 'good' ? 'Mm! Tasty! Dinner will be right on time tonight.' : 'PTOOEY!! Blegh! That’s… not my recipe. Dinner is going to be late…';
    const said = $('.kitchen .sentry-digg', box); said.outerHTML = spinda(mood, line);
    box.querySelector('.kitchen').insertAdjacentHTML('beforeend', `<div class="sentry-end">${faceHTML(c, mood === 'bad' ? 'sloppy' : mood === 'great' ? 'great' : 'good', 'big')}<div class="big">${esc(tier)}</div><p>Taste score: ${sc} / 100</p>
      ${mood === 'great' ? `<p class="pill">🌟 WHOLE TEAM effect: ${esc(recipe.buff || 'Homemade Stew')}</p><p class="small">${esc(recipe.buffText || 'Once each: heal 1 HP at any time.')}</p>` : ''}
      <p class="small muted">${mood === 'bad' ? 'Dinner is late tonight.' : 'Served at dinner tonight.'} Next stew tomorrow.</p></div>`);
    const what = pot.map((p) => p.name).join(', ') || 'nothing';
    logRoll(c.nickname, `Spinda’s Kitchen — ${recipe.name}`, null, `${sc}/100 · ${tier} · used ${what}`, 'note');
    if (mood === 'great') {
      addTeamFx(recipe.buff || 'Homemade Stew', `${recipe.buffText || 'Once each: heal 1 HP at any time.'} (Spinda’s ${recipe.name}, cooked by ${c.nickname})`.trim(), true);
      markWinner(c.id);
      store.pushLimited('log', { t: Date.now(), text: `${c.nickname}’s ${recipe.name} was REALLY REALLY good! The whole team gets ${recipe.buff || 'a stew buff'}.` });
      gameSay('Spinda', 'say', `${c.nickname}’s ${recipe.name} is the best stew I’ve tasted all season! Everyone, eat up!`, 'stew', c.nickname);
    } else if (mood === 'good') {
      store.pushLimited('log', { t: Date.now(), text: `${c.nickname} helped Spinda make ${recipe.name}. Dinner is served on time.` });
    } else {
      store.pushLimited('log', { t: Date.now(), text: `Spinda spat out ${c.nickname}’s stew! Dinner is late tonight.` });
      gmTodo(`Dinner is late tonight: Spinda spat out ${c.nickname}’s ${recipe.name}`, 'stew');
      gameSay('Spinda', 'do', `spits out today’s stew and starts again from scratch. Dinner will be late…`, 'stew', c.nickname);
    }
    onDone?.();
  }, 3400);
}

// A player writes (or edits) their own recipe: name, berries with +/- counts, a note. The team effect for a
// REALLY good result is left to the GM (until then it's a Homemade Stew: heal 1 HP once each).
function writeRecipe(c, item, onSaved) {
  const counts = Object.fromEntries(parseBerries(item?.berries));
  const box = modal(`<h2>✏️ ${item ? 'Edit recipe' : 'Write a recipe'}</h2>
    <label class="f">Recipe name<input id="rname" value="${esc(item?.name || '')}" placeholder="e.g. ${esc(c.nickname)}’s Sunny Soup"></label>
    <p class="small muted" style="margin:8px 0 4px">Pick the berries and how many (up to 6 in all).</p>
    <div class="rw-berries">${BERRIES.map((n) => `<div class="rw-b ${counts[n] ? 'on' : ''}" data-b="${esc(n)}">${berryImg(n)}<span>${esc(n.replace(/ Berry$/, ''))}</span><button class="btn alt sm" data-m="-1">−</button><b>${counts[n] || 0}</b><button class="btn alt sm" data-m="1">+</button></div>`).join('')}</div>
    <label class="f" style="margin-top:8px">Note for the recipe card<textarea id="rnote" rows="2">${esc(item?.note || '')}</textarea></label>
    <div class="row" style="margin-top:12px"><button class="btn" id="rsave">Save recipe</button>${item ? '<button class="btn bad" id="rdel">Delete</button>' : ''}</div>`);
  const total = () => Object.values(counts).reduce((a, b) => a + b, 0);
  $$('.rw-b', box).forEach((row) => $$('[data-m]', row).forEach((b) => b.onclick = () => {
    const n = row.dataset.b; const v = Math.max(0, (counts[n] || 0) + +b.dataset.m);
    if (+b.dataset.m > 0 && total() >= 6) { toast('Up to 6 berries in one recipe'); return; }
    if (v) counts[n] = v; else delete counts[n];
    $('b', row).textContent = v; row.classList.toggle('on', !!v);
  }));
  $('#rsave', box).onclick = () => {
    const name = $('#rname', box).value.trim(); const berries = Object.entries(counts).map(([n, k]) => `${n} ×${k}`).join(', ');
    if (!name || !berries) { toast('Give it a name and at least one berry'); return; }
    const id = item?.id || slug(name) + '-' + uid().slice(0, 3);
    const { id: _i, builtin: _b, edited: _e, ...rest } = item || {};
    saveContent('recipes', id, { ...rest, name, berries, note: $('#rnote', box).value.trim(), by: item?.by || c.nickname, byId: item?.byId || c.id });
    closeModal(); toast('Recipe saved'); onSaved?.();
  };
  const del = $('#rdel', box); if (del) del.onclick = () => { if (confirm('Delete this recipe?')) { deleteContent('recipes', item.id); closeModal(); onSaved?.(); } };
}

export function renderKitchen(main, g, gm, onEdit) {
  const c = me(); const recipe = recipeToday();
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a>${gm ? '<button class="btn alt sm" id="ed">Edit</button>' : ''}</div>
    <h1 style="margin:10px 0 4px">${esc(g.name)}</h1>
    <p>${esc(g.intro || '')}</p>
    <p><span class="pill">📋 Guild chore</span> <span class="pill">🍲 One stew a day for the guild</span> <span class="pill">🌟 REALLY good: a WHOLE TEAM effect</span></p>
    <div class="card sentry"><div id="kbox"></div></div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Kitchen log</h3><ul class="sentry-roster" id="klog"></ul>
    <h3>Recipe book</h3><ul class="mail-list">${recipes().map((r) => `<li><span class="grow">${esc(r.name)}${r.by ? ` <span class="small muted">by ${esc(r.by)}</span>` : ''}<br><span class="rb-berries">${parseBerries(r.berries).map(([n, k]) => `${berryImg(n)}×${k}`).join(' ')}</span>${!r.buff && r.by ? '<br><span class="small muted">Team effect: the GM picks one (Homemade Stew until then)</span>' : ''}</span>${gm ? `<button class="btn alt sm" data-red="${esc(r.id)}">Edit</button>` : c && r.byId === c.id ? `<button class="btn alt sm" data-mine="${esc(r.id)}">Edit</button>` : ''}</li>`).join('')}</ul>
    ${c ? '<button class="btn alt" id="rwrite">✏️ Write my own recipe</button>' : ''} ${gm ? '<button class="btn alt" id="radd">Add a recipe (GM)</button>' : ''}</div>`;
  const party = store.get('party') || {};
  const log = () => {
    const days = Object.entries(store.get('kitchen') || {}).sort().reverse().slice(0, 7);
    $('#klog', main).innerHTML = days.map(([d, s]) => { const who = party[s.by] || { nickname: s.name, species: '' };
      return `<li>${faceHTML(who, s.mood === 'bad' ? 'sloppy' : s.mood === 'great' ? 'great' : 'good')}<span class="grow">${esc(s.name)} · ${esc(s.recipe)}<br><span class="small muted">${esc(d)}</span></span><b>${esc(s.tier)}</b> <span class="small muted">${s.score}/100</span>${gm && d === today() ? ` <button class="btn alt sm" id="kredo">Redo</button>` : ''}</li>`; }).join('') || '<li class="muted">No stews yet.</li>';
    const r = $('#kredo', main); if (r) r.onclick = () => { store.set('kitchen/' + today(), null); toast('Today’s stew can be made again'); renderKitchen(main, g, gm, onEdit); };
  };
  log();
  const box = $('#kbox', main); const s = todaysStew();
  if (!recipe) box.innerHTML = '<p>Spinda hasn’t left a recipe today.</p>';
  else if (s) box.innerHTML = `<div class="sentry-end">${spinda(s.mood === 'bad' ? 'bad' : s.mood, s.mood === 'bad' ? 'Today’s stew… we don’t talk about today’s stew. Dinner’s late.' : s.mood === 'great' ? `${s.name}’s ${s.recipe} was amazing! Come back tomorrow!` : `${s.name} already helped with today’s ${s.recipe}. Thank you!`)}<p class="small muted">Next stew tomorrow.</p></div>`;
  else if (!c) box.innerHTML = '<p>Pick your character first (Play tab), then come help in the kitchen.</p>';
  else {
    const all = recipes();
    box.innerHTML = `<div class="sentry-start">${spinda('wait', `Ah, ${c.nickname}! I left today’s recipe on the counter: ${recipe.name}. Make it just right and I’ll serve it at dinner! Or cook one from the recipe book.`)}
      <div class="kitchen-stage small-stage">${sprite()}</div>
      <label class="f">Recipe<select id="kpick">${all.map((r) => `<option value="${esc(r.id)}" ${r.id === recipe.id ? 'selected' : ''}>${esc(r.name)}${r.id === recipe.id ? ' (Spinda’s pick today)' : r.by ? ` (by ${esc(r.by)})` : ''}</option>`).join('')}</select></label>
      <button class="btn block" id="kgo" style="margin-top:8px">Start cooking</button></div>`;
    $('#kgo', box).onclick = () => cook(c, box, all.find((r) => r.id === $('#kpick', box).value) || recipe, log);
  }
  $$('[data-red]', main).forEach((b) => b.onclick = () => editContent('recipes', RECIPE_SCHEMA, recipes().find((x) => x.id === b.dataset.red), { title: 'Edit recipe' }));
  const a = $('#radd', main); if (a) a.onclick = () => editContent('recipes', RECIPE_SCHEMA, null, { title: 'New recipe' });
  const redraw = () => renderKitchen(main, g, gm, onEdit);
  const w = $('#rwrite', main); if (w) w.onclick = () => writeRecipe(c, null, redraw);
  $$('[data-mine]', main).forEach((b) => b.onclick = () => writeRecipe(c, recipes().find((x) => x.id === b.dataset.mine), redraw));
  const e = $('#ed', main); if (e) e.onclick = onEdit;
}

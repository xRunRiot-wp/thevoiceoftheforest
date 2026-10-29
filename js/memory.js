// Humanity & memory: the Primal prompt at 0 HP, and each character's "Remembering" chat.
// Humanity 0 = only Pokémon thoughts; the closer to 5, the more of their human life comes back
// in daydreams, and in dreams or nightmares when they rest. Memories are built from the
// character's own memory seeds (written by the player or GM, never pulled from private forms).
import * as store from './store.js?v=6ae37b9f';
import { $, $$, esc, num, toast } from './util.js?v=6ae37b9f';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const TIERS = { 5: 'Human memories clear', 4: 'Details begin to fade', 3: 'Two lives in conflict', 2: 'Instinct overrides memory', 1: 'The human self is almost gone', 0: 'Fully Pokémon' };
export const humanityOf = (c) => Math.max(0, Math.min(5, num(c.humanity)));

// Pokémon thoughts: what a wild Pokémon thinks about
const MON = [
  'Hungry. The berries by the stream smelled sweet today.', 'This spot is warm. This spot is mine.', 'A noise in the bushes. Ears up. …Just the wind.',
  'The team smells familiar now. Safe smells.', 'Sun on the fur feels good. Nap soon.', 'That Apple was the best Apple.',
  'Something moved in the grass. Chase it? …Too sleepy.', 'Rain coming. The air tastes wet.', 'Stretch. Yawn. Scratch behind the ear.',
  'The lanterns at camp are bright like small moons.',
];
// how a memory surfaces, by kind and by how clear it is (h = Humanity)
const WRAP = {
  daydream: {
    clear: ['While {n} stares at the sky, a memory arrives whole: {m}.', 'For a moment {n} is somewhere else entirely, remembering {m}.', '{n} hums a tune without knowing why, and suddenly remembers {m}.'],
    faded: ['Something tugs at {n}: {m}… but the edges are blurry.', '{n} almost remembers {m}. The details slip away like water.', 'A half-memory: {m}. Was that real?'],
    conflict: ['{n} remembers {m}, and the Pokémon part of them doesn’t understand why it matters.', 'Two thoughts at once: the smell of berries, and {m}.'],
    faint: ['A strange word floats up, about {m}, then sinks again.', 'Something about {m}? {n} shakes their head. It’s gone.'],
  },
  dream: {
    clear: ['In the dream, {n} is human again, and it’s all there: {m}.', '{n} dreams of {m}, so clearly they wake up reaching for it.'],
    faded: ['{n} dreams of {m}, but every face is blurred.', 'A soft dream: {m}. By morning only the feeling is left.'],
    conflict: ['{n} dreams of {m}, but they are a Pokémon in it, and no one recognizes them.', 'In the dream {m}… then paws, fur, and the forest.'],
    faint: ['{n} dreams of running through tall grass. Somewhere far off: {m}.', 'A dream of the forest, with a strange echo of {m}.'],
  },
  nightmare: {
    clear: ['A nightmare: {m}, and then the shriek that echoed across the world. {n} wakes up shaking.', '{n} dreams of {m}, and of losing it forever. They wake with a gasp.'],
    faded: ['A nightmare of {m}, twisting into the storm. {n} wakes up not sure what they lost.', 'In the dark, {m}… then falling. {n} wakes up with their heart racing.'],
    conflict: ['{n} dreams of {m}, but their own claws keep getting in the way. They wake up frightened of themselves.'],
    faint: ['A nightmare of the storm. For a heartbeat there was {m}, then nothing.'],
  },
  fainted: {
    clear: ['As everything goes dark, {n} sees it plainly: {m}.', 'Falling, {n} suddenly remembers {m}.'],
    faded: ['The world tilts and fades, and for a second there is {m}.', 'Blackness, and somewhere inside it, {m}.'],
    conflict: ['{n} hits the ground. A flash of {m}, and the Pokémon part of them reaches for it.'],
    faint: ['Darkness. Just before it closes: {m}.'],
  },
  // primal energy pulling up a broken fragment (characters with primalEcho, e.g. Slakoth, even at Humanity 0)
  echo: {
    faint: ['Primal energy hums in the air. For a heartbeat {n} sees something that isn’t here: {m}', 'A jolt runs through {n}. A broken piece of something: {m}', '{n} goes very still. A fragment surfaces and is gone: {m}'],
  },
  primal: {
    clear: ['The Primal surge roars up, and {n} clings to one thing: {m}.', 'Instinct floods in. {n} holds on to {m} as hard as they can.'],
    faded: ['The surge washes over {n}, carrying {m} away with it.', 'Wild strength pours in. {m}… it slips further out of reach.'],
    conflict: ['Teeth, claws, heartbeat. Somewhere far below: {m}.'],
    faint: ['Only instinct now. A last echo of {m} is swallowed whole.'],
  },
};
// characters who were always Pokémon (bornMon, e.g. Puff): no human life to lose, their own memories of home stay clear
const HOME = {
  daydream: ['{n} drifts for a moment, remembering {m}.', '{n} goes quiet in the middle of a joke, thinking about {m}.', 'Something small brings it back: {m}.'],
  dream: ['{n} dreams of home: {m}.', 'In the dream it is all still there: {m}.'],
  nightmare: ['A bad dream: {m}. {n} wakes up with a joke ready before anyone can ask.', '{n} dreams of {m}, and wakes up floating a little closer to the others.'],
  fainted: ['As everything goes dark, {n} remembers {m}.'],
  primal: ['Instinct rushes in. Somewhere underneath it: {m}.'],
};
const clarity = (h) => (h >= 5 ? 'clear' : h === 4 ? 'faded' : h === 3 ? 'conflict' : 'faint');
// A memory seed: { id, what, who, where, sense, feeling } (old one-line seeds count as { what }).
export const seeds = (c) => [
  ...(c.memories || '').split('\n').map((x) => x.trim()).filter(Boolean).map((what, i) => ({ id: 'l' + i, what, legacy: true })),
  ...Object.entries(c.seedList || {}).map(([id, x]) => ({ ...x, id })).filter((x) => x && x.what),
];
// How much of a seed comes back depends on Humanity: everything at 5, then fewer details, then only a sense or a feeling.
function recall(sd, h) {
  const full = [sd.what, sd.who && `with ${sd.who}`, sd.where && `at ${sd.where}`].filter(Boolean).join(' ');
  if (h >= 5) return { m: full + (sd.sense ? ` (${sd.sense})` : ''), after: sd.feeling ? ` It felt ${sd.feeling}.` : '' };
  if (h === 4) return { m: [sd.what, sd.where && `at ${sd.where}`].filter(Boolean).join(' ') + (sd.sense ? ` (${sd.sense})` : ''), after: sd.feeling ? ` It felt ${sd.feeling}, maybe.` : '' };
  if (h === 3) return { m: sd.what, after: sd.feeling ? ` It felt ${sd.feeling}.` : '' };
  return { m: sd.sense || sd.feeling || sd.what, after: '' };
}
// The seed that has surfaced least often comes up next (ties broken at random).
function nextSeed(c, list) {
  const used = {};
  Object.values(store.get(`memories/${c.id}`) || {}).forEach((x) => { if (x.seed) used[x.seed] = (used[x.seed] || 0) + 1; });
  const low = Math.min(...list.map((x) => used[x.id] || 0));
  return pick(list.filter((x) => (used[x.id] || 0) === low));
}

// One thought for this character: human memory with chance Humanity/5 (none at 0), otherwise a Pokémon thought.
// kinds: daydream, dream, nightmare, fainted, primal. Fainting and Primal State always reach for a memory if there is one.
export function makeMemory(c, kind = 'daydream') {
  const h = humanityOf(c); const s = seeds(c);
  if (c.bornMon) {
    if (!s.length || kind === 'echo' || (kind === 'daydream' && Math.random() < 0.5)) return { kind: 'thought', text: pick(MON), human: false };
    const sd = nextSeed(c, s); const { m, after } = recall(sd, 5);
    return { kind, text: pick(HOME[kind] || HOME.dream).replace(/\{n\}/g, c.nickname).replace(/\{m\}/g, m) + after, human: false, seed: sd.id };
  }
  // primalEcho (GM-set, e.g. Slakoth): primal energy, Primal State and fainting bring back a broken fragment even at Humanity 0
  const echo = h === 0 && c.primalEcho && s.length && ['primal', 'fainted', 'echo'].includes(kind);
  if (echo) {
    const sd = nextSeed(c, s); const words = sd.what.split(' ');
    const frag = (words.length > 4 ? words.slice(0, 2 + Math.floor(Math.random() * 3)).join(' ') + '…' : sd.what) + (sd.feeling ? ` (${sd.feeling})` : '');
    return { kind: kind === 'echo' ? 'echo' : kind, text: pick(WRAP.echo.faint).replace(/\{n\}/g, c.nickname).replace(/\{m\}/g, frag), human: true, seed: sd.id };
  }
  const human = h > 0 && s.length && (kind === 'fainted' || kind === 'primal' || Math.random() < h / 5);
  if (!human) {
    const t = { daydream: pick(MON), nightmare: 'A bad dream of the storm and a huge shriek. Then just darkness and the smell of rain.',
      fainted: `${c.nickname} faints. Only darkness, and the smell of the forest floor.`, primal: `Pure instinct takes over ${c.nickname}. There is nothing else.` }[kind]
      || `${c.nickname} dreams of chasing berries down a hill. Nothing else.`;
    return { kind: kind === 'daydream' ? 'thought' : kind, text: t, human: false };
  }
  const sd = nextSeed(c, s); const { m, after } = recall(sd, h);
  return { kind, text: pick(WRAP[kind][clarity(h)]).replace(/\{n\}/g, c.nickname).replace(/\{m\}/g, m) + after, human: true, seed: sd.id };
}
export function addMemory(c, entry) { store.pushLimited(`memories/${c.id}`, { ...entry, h: humanityOf(c), t: Date.now() }, 60); }
// A dream when the character goes to sleep (rests and end of session): a nightmare one time in three.
export function restDream(c) { addMemory(c, makeMemory(c, Math.random() < 1 / 3 ? 'nightmare' : 'dream')); }

let seedsOpen = false;   // keep the seed box open across live re-renders
const ICON = { thought: '🐾', daydream: '☁️', dream: '🌙', nightmare: '🌩️', fainted: '💫', primal: '💢', echo: '⚡', note: '✍️' };
export function memoryHTML(c) {
  const h = humanityOf(c);
  const list = Object.entries(store.get(`memories/${c.id}`) || {}).sort().reverse().slice(0, 20);
  return `<div class="memory"><div class="row" style="justify-content:space-between"><b>🧠 Remembering <span class="small muted">(only you and the GM)</span></b><span class="pill">${c.bornMon ? 'Born a Pokémon · memories of home' : `Humanity ${h} · ${esc(TIERS[h])}`}</span></div>
    <div class="mem-feed">${list.length ? list.map(([, x]) => `<div class="mem ${esc(x.kind)}"><span class="ic">${ICON[x.kind] || '💭'}</span><span class="grow">${esc(x.text)}</span></div>`).join('') : `<p class="small muted">${h ? 'No memories have surfaced yet.' : `${esc(c.nickname)} only thinks Pokémon thoughts now.`}</p>`}</div>
    ${store.gmUnlocked() && c.primalEcho ? '<div class="row" style="margin:6px 0"><button class="btn alt sm" id="memecho">⚡ Primal energy nearby (fragment)</button><span class="small muted">GM only</span></div>' : ''}
    <div class="row nowrap mem-actions"><button class="btn alt sm" id="memday">${h || c.bornMon ? '☁️ Daydream' : '🐾 Think'}</button><input id="memnote" placeholder="Write a thought or memory…"><button class="btn sm" id="memadd">Add</button></div>
    <details class="small mem-seeds" ${seedsOpen ? 'open' : ''}><summary>🌱 Memory seeds (${seeds(c).length})</summary>
      <p class="muted">${c.bornMon ? `Pieces of ${esc(c.nickname)}’s life before the guild. They come back in daydreams, in dreams and nightmares when you sleep, and when you faint. They never fade. No real names.</p>` : `Pieces of your character’s human life. They come back in daydreams, in dreams and nightmares when you sleep, when you faint, and when you go Primal. The more Humanity you have, the more details come back. No real names.</p>`}
      ${seeds(c).map((x) => `<div class="seed"><span class="grow"><b>${esc(x.what)}</b>${[x.who && '👤 ' + x.who, x.where && '📍 ' + x.where, x.sense && '👃 ' + x.sense, x.feeling && '💗 ' + x.feeling].filter(Boolean).map((t) => `<span class="small muted"> · ${esc(t)}</span>`).join('')}</span><button class="x" data-unseed="${esc(x.id)}" aria-label="Remove">×</button></div>`).join('')}
      <div class="seedform"><b class="small">Make a memory seed</b>
        <input id="sd-what" placeholder="What do you remember? (a red bicycle with a squeaky bell)">
        <div class="grid g2"><input id="sd-who" placeholder="Who was there? (a nickname)"><input id="sd-where" placeholder="Where? (the bakery on the corner)"></div>
        <div class="grid g2"><input id="sd-sense" placeholder="A smell, sound or sight (warm bread)"><input id="sd-feeling" placeholder="How it felt (safe, happy)"></div>
        <button class="btn alt sm" id="sdadd">🌱 Plant this seed</button></div></details></div>`;
}
// GM's read-only look at a character's memories (character pop-up)
export function memoryFeedHTML(c) {
  const list = Object.entries(store.get(`memories/${c.id}`) || {}).sort().reverse().slice(0, 12);
  return `<div class="memory"><b>🧠 Remembering</b> <span class="small muted">(only this player and the GM see this)</span><div class="mem-feed">${list.length ? list.map(([, x]) => `<div class="mem ${esc(x.kind)}"><span class="ic">${ICON[x.kind] || '💭'}</span><span class="grow">${esc(x.text)}</span></div>`).join('') : '<p class="small muted">Nothing yet.</p>'}</div>${seeds(c).length ? `<p class="small"><b>Memory seeds:</b> ${esc(seeds(c).map((x) => x.what).join(' · '))}</p>` : ''}</div>`;
}
export function bindMemory(main, c) {
  const d = $('#memday', main);
  if (d) d.onclick = () => addMemory(c, makeMemory(c, (c.status || []).includes('Primal State') && (Math.random() < 0.5 || (humanityOf(c) === 0 && c.primalEcho)) ? 'primal' : 'daydream'));
  const e = $('#memecho', main);
  if (e) e.onclick = () => addMemory(c, makeMemory(c, 'echo'));
  const a = $('#memadd', main);
  if (a) a.onclick = () => { const t = $('#memnote', main).value.trim(); if (!t) return; addMemory(c, { kind: 'note', text: t }); };
  const box = $('.mem-seeds', main);
  if (box) box.ontoggle = () => { seedsOpen = box.open; };
  const s = $('#sdadd', main);
  if (s) s.onclick = () => {
    const v = (k) => $('#sd-' + k, main).value.trim();
    if (!v('what')) { toast('Write what they remember first'); return; }
    store.set(`party/${c.id}/seedList/${store.tid()}`, { what: v('what'), who: v('who'), where: v('where'), sense: v('sense'), feeling: v('feeling'), t: Date.now() });
    toast('Memory seed planted 🌱');
  };
  $$('[data-unseed]', main).forEach((b) => b.onclick = () => {
    const id = b.dataset.unseed;
    if (!confirm('Remove this memory seed?')) return;
    if (id.startsWith('l')) store.set(`party/${c.id}/memories`, (c.memories || '').split('\n').map((x) => x.trim()).filter(Boolean).filter((_, i) => 'l' + i !== id).join('\n'));
    else store.set(`party/${c.id}/seedList/${id}`, null);
  });
}

// ---- 0 HP: offer Primal State (banner on that player's sheet until they answer)
export function zeroHpHTML(c) {
  if (num(c.hp) > 0 || c.zeroAnswered || (c.status || []).includes('Primal State')) return '';
  return `<div class="zerohp"><b>💢 ${esc(c.nickname)} is at 0 HP!</b><p>Go into Primal State? You regain all HP, cure status, ignore pain and add your Instinct (${num(c.instinct)}) to every roll. Your Primal Score goes up by 1 and you lose 1 Humanity.</p>
    <div class="row"><button class="btn bad" id="goprimal">Yes, go Primal</button><button class="btn alt" id="nofaint">No, faint</button></div></div>`;
}
export function bindZeroHp(main, c, enterPrimal) {
  const y = $('#goprimal', main);
  if (y) y.onclick = () => { enterPrimal(c, true); };
  const n = $('#nofaint', main);
  if (n) n.onclick = () => {
    store.update('party/' + c.id, (x) => ({ ...x, zeroAnswered: true, status: [...new Set([...(x.status || []), 'Fainted'])] }));
    addMemory(c, makeMemory(c, 'fainted'));
    store.pushLimited('log', { t: Date.now(), text: `${c.nickname} fainted.` });
  };
}

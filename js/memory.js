// Humanity & memory: the Primal prompt at 0 HP, and each character's "Remembering" chat.
// Humanity 0 = only Pokémon thoughts; the closer to 5, the more of their human life comes back
// in daydreams, and in dreams or nightmares when they rest. Memories are built from the
// character's own memory seeds (written by the player or GM, never pulled from private forms).
import * as store from './store.js?v=6adea3eb';
import { $, $$, esc, num, toast } from './util.js?v=6adea3eb';

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
};
const clarity = (h) => (h >= 5 ? 'clear' : h === 4 ? 'faded' : h === 3 ? 'conflict' : 'faint');
const seeds = (c) => (c.memories || '').split('\n').map((x) => x.trim()).filter(Boolean);

// One thought for this character: human memory with chance Humanity/5 (none at 0), otherwise a Pokémon thought.
export function makeMemory(c, kind = 'daydream') {
  const h = humanityOf(c); const s = seeds(c);
  const human = h > 0 && s.length && Math.random() < h / 5;
  if (!human) {
    const t = kind === 'daydream' ? pick(MON) : kind === 'nightmare' ? 'A bad dream of the storm and a huge shriek. Then just darkness and the smell of rain.' : `${c.nickname} dreams of chasing berries down a hill. Nothing else.`;
    return { kind: kind === 'daydream' ? 'thought' : kind, text: t, human: false };
  }
  return { kind, text: pick(WRAP[kind][clarity(h)]).replace(/\{n\}/g, c.nickname).replace(/\{m\}/g, pick(s)), human: true };
}
export function addMemory(c, entry) { store.pushLimited(`memories/${c.id}`, { ...entry, h: humanityOf(c), t: Date.now() }, 60); }
// A dream when the character goes to sleep (rests and end of session): a nightmare one time in three.
export function restDream(c) { addMemory(c, makeMemory(c, Math.random() < 1 / 3 ? 'nightmare' : 'dream')); }

const ICON = { thought: '🐾', daydream: '☁️', dream: '🌙', nightmare: '🌩️', note: '✍️' };
export function memoryHTML(c) {
  const h = humanityOf(c);
  const list = Object.entries(store.get(`memories/${c.id}`) || {}).sort().reverse().slice(0, 20);
  return `<div class="memory"><div class="row" style="justify-content:space-between"><b>🧠 Remembering <span class="small muted">(only you and the GM)</span></b><span class="pill">Humanity ${h} · ${esc(TIERS[h])}</span></div>
    <div class="mem-feed">${list.length ? list.map(([, x]) => `<div class="mem ${esc(x.kind)}"><span class="ic">${ICON[x.kind] || '💭'}</span><span class="grow">${esc(x.text)}</span></div>`).join('') : `<p class="small muted">${h ? 'No memories have surfaced yet.' : `${esc(c.nickname)} only thinks Pokémon thoughts now.`}</p>`}</div>
    <div class="row nowrap mem-actions"><button class="btn alt sm" id="memday">${h ? '☁️ Daydream' : '🐾 Think'}</button><input id="memnote" placeholder="Write a thought or memory…"><button class="btn sm" id="memadd">Add</button></div>
    <details class="small"><summary>Memory seeds (${seeds(c).length})</summary>
      <p class="muted">Things from your character’s human life, one per line (a place, a person’s nickname, a smell, a song…). Dreams and daydreams are built from these. No real names.</p>
      <textarea id="memseeds" rows="4" placeholder="a red bicycle with a squeaky bell&#10;my little brother’s laugh&#10;the bakery on the corner">${esc(c.memories || '')}</textarea>
      <button class="btn alt sm" id="memsave">Save seeds</button></details></div>`;
}
// GM's read-only look at a character's memories (character pop-up)
export function memoryFeedHTML(c) {
  const list = Object.entries(store.get(`memories/${c.id}`) || {}).sort().reverse().slice(0, 12);
  return `<div class="memory"><b>🧠 Remembering</b> <span class="small muted">(only this player and the GM see this)</span><div class="mem-feed">${list.length ? list.map(([, x]) => `<div class="mem ${esc(x.kind)}"><span class="ic">${ICON[x.kind] || '💭'}</span><span class="grow">${esc(x.text)}</span></div>`).join('') : '<p class="small muted">Nothing yet.</p>'}</div>${seeds(c).length ? `<p class="small"><b>Memory seeds:</b> ${esc(seeds(c).join(' · '))}</p>` : ''}</div>`;
}
export function bindMemory(main, c) {
  const d = $('#memday', main);
  if (d) d.onclick = () => addMemory(c, makeMemory(c, 'daydream'));
  const a = $('#memadd', main);
  if (a) a.onclick = () => { const t = $('#memnote', main).value.trim(); if (!t) return; addMemory(c, { kind: 'note', text: t }); };
  const s = $('#memsave', main);
  if (s) s.onclick = () => { store.set(`party/${c.id}/memories`, $('#memseeds', main).value); toast('Memory seeds saved'); };
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
    store.pushLimited('log', { t: Date.now(), text: `${c.nickname} fainted.` });
  };
}

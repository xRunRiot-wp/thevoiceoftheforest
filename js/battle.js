// Battles (her asks 10-29): battle a friend's character live, or train against guild members (bragging rights only).
// Laid out like Pokémon Black & White: a slowly swaying camera over the field, the foe on a platform at the top right,
// your own Pokémon from behind at the bottom left, slim HP bars, a dark text box, a big red FIGHT button, and battle music.
// Practice only: both start at full HP and the real character sheets never change. Same dice as the table: accuracy
// needs 1 success (4+, two 1s cancel one, pain from low HP), damage = Strength/Special + Power − Vitality/Insight.
// battles/<id> = { a, b, phase: ask|fight|done|off, t, round, hp{}, max{}, picks{id: move}, mods{id: {stat: n}},
//   cond{id: {sleep, confused, yawn, encore, love}}, last{id: move}, ev[{text, hp{}, fx, who}], evRound, winner, lastAct }
// Guild Training: b = 'npc:<key>' (a guild member from GUILD below); the player's device picks for them and works out every round.
// spar/<playerId>/<key> = { w, l, first } = the Guild Training Board.
// Both players pick a move; when both are in, player a's device works out the round (player b's after a short wait).
import * as store from './store.js?v=6ae3bd59';
import { $, $$, esc, toast, num, uid, pool, painFor, die, roll } from './util.js?v=6ae3bd59';
import { portrait, maxHp } from './ui.js?v=6ae3bd59';
import { allMoves, me, statVal } from './play.js?v=6ae3bd59';
import { ensureAudio, jingle, missSound, pageMusic } from './chiptune.js?v=6ae3bd59';
import { TYPE_ICONS } from './theme.js?v=6ae3bd59';

export const isBattle = (g) => g.kind === 'battle' || g.id === 'friendly-battle';
export const GAME_ID = 'friendly-battle';
const P = (id) => 'battles/' + id;
const party = () => store.get('party') || {};

// guild members you can train against (her ask 10-29), easiest first. Stats use the table's own sheet names.
const S = (str, dex, vit, spe, ins, extra = {}) => ({ Strength: str, Dexterity: dex, Vitality: vit, Special: spe, Insight: ins, Brawl: 1, Channel: 1, Alert: 1, ...extra });
export const GUILD = {
  diglett: { nickname: 'Diglett', pokemon: 'Diglett', type1: 'Ground', tier: 'Rookie', baseHp: 3, ...S(1, 2, 1, 1, 1), moves: ['Scratch', 'Sand Attack'],
    hi: 'Sentry duty can wait! Let’s see what you’ve got!', win: 'Hehe, I popped up at just the right time!', lose: 'Ow ow ow… back into my hole I go!' },
  ralts: { nickname: 'Ralts', pokemon: 'Ralts', type1: 'Psychic', type2: 'Fairy', tier: 'Rookie', baseHp: 3, ...S(1, 2, 1, 2, 2, { Cute: 2, Perform: 2 }), moves: ['Confusion', 'Disarming Voice', 'Growl'],
    hi: 'A battle is just a dance with more spinning. Ready?', win: 'And… pose! Practice makes perfect!', lose: 'You moved so gracefully! Will you dance with me later?' },
  maushold: { nickname: 'Maushold', pokemon: 'Maushold', type1: 'Normal', tier: 'Bronze', baseHp: 4, ...S(2, 3, 1, 1, 1), moves: ['Double Hit', 'Bite', 'Tackle'],
    hi: 'The whole family wants a turn! Squeak squeak!', win: 'Family teamwork wins again!', lose: 'Squeak… the little ones need a nap now.' },
  mudkip: { nickname: 'Kippy', pokemon: 'Mudkip', type1: 'Water', tier: 'Silver', baseHp: 4, ...S(2, 2, 2, 2, 2, { Tough: 2, Intimidate: 1 }), moves: ['Water Gun', 'Mud Shot', 'Tackle'],
    hi: 'Diamond Rank or not, I never skip training. Come on!', win: 'Good effort! Keep at it and you’ll catch up to us.', lose: 'Whoa! Mimi’s going to hear about this one!' },
  pikachu: { nickname: 'Mimi', pokemon: 'Pikachu', type1: 'Electric', tier: 'Silver', baseHp: 4, ...S(2, 3, 1, 2, 2), moves: ['Thunder Shock', 'Quick Attack', 'Spark'],
    hi: 'The Relic Fragment stays in my bag. You get my full power though!', win: 'Bzzt! That was fun! Again sometime?', lose: 'You really sparked there! Nice one!' },
  machamp: { nickname: 'Machamp', pokemon: 'Machamp', art: 'assets/truck/machamp_face.png', type1: 'Fighting', tier: 'Gold', baseHp: 5, ...S(4, 2, 3, 1, 2, { Tough: 3, Intimidate: 2 }), moves: ['Karate Chop', 'Low Kick', 'Leer'],
    hi: 'Done hauling crates for today. Let’s lift something heavier: YOU!', win: 'HUP! Good workout! Come back stronger!', lose: 'HA! Now THAT is a strong one. Respect!' },
  // her sheet 10-29: Rayson (he/him), 8, a timid Beginner-rank Wingull with Keen Eye
  wingull: { nickname: 'Rayson', pokemon: 'Wingull', type1: 'Water', type2: 'Flying', tier: 'Rookie', baseHp: 3, ...S(1, 2, 1, 1, 1, { Brawl: 1, Channel: 1, Clash: 2, Evasion: 0, Alert: 2, Nature: 1, Stealth: 1, Etiquette: 1, Perform: 1, Tough: 1, Cool: 2, Beauty: 2, Clever: 1, Cute: 1 }), moves: ['Wing Attack', 'Water Gun', 'Supersonic', 'Growl'],
    hi: 'U-um… a practice battle? Okay. I won’t run away this time. I promise.', win: 'I… I won? I didn’t run! I didn’t run!', lose: 'That’s okay… I stayed the whole time. That counts, right?' },
  // her sheet 10-29: Beatrice (she/her), Champion rank, Mild, Swarm; traps the field, hardens up, then Pin Missile
  beedrill: { nickname: 'Beatrice', pokemon: 'Beedrill', type1: 'Bug', type2: 'Poison', tier: 'Champion', baseHp: 5, ...S(2, 2, 2, 2, 2, { Brawl: 4, Channel: 5, Clash: 2, Evasion: 4, Athletic: 2, Nature: 1, Allure: 1, Intimidate: 3, Tough: 3, Cool: 4, Beauty: 4, Clever: 5, Cute: 3 }), moves: ['Electroweb', 'Toxic Spikes', 'Harden', 'Iron Defense', 'Ominous Wind', 'Focus Energy', 'Pin Missile'],
    hi: 'A practice bout, dear? Very well. Do mind your manners.', win: 'There we are. Now, a cup of tea and a bandage, I think.', lose: 'Oh, well done, darling! That simply WILL do.' },
  // her sheet 10-29: Bramble (she/her), Champion rank, Naughty, Swarm; Screech, Agility, then Poison Tail, Double-Edge or Superpower
  scolipede: { nickname: 'Bramble', pokemon: 'Scolipede', type1: 'Bug', type2: 'Poison', tier: 'Champion', baseHp: 5, ...S(2, 3, 2, 1, 2, { Brawl: 4, Channel: 3, Clash: 2, Evasion: 2, Alert: 5, Allure: 1, Etiquette: 2, Intimidate: 3, Tough: 5, Cool: 3, Beauty: 3, Clever: 3, Cute: 5 }), moves: ['Screech', 'Agility', 'Poison Tail', 'Double-Edge', 'Superpower'],
    hi: 'Oh, you want to fight ME? Adorable. Don’t cry when I win.', win: '*playful shove* Not bad! Come back when you can make me sweat.', lose: 'Hah! You actually got me. Don’t tell Beautifly, he’ll never let me forget it.' },
  // her sheet 10-29: Champion rank, Jolly, Swarm; scores and skills as on his GM sheet
  beautifly: { nickname: 'Guildmaster Beautifly', pokemon: 'Beautifly', type1: 'Bug', type2: 'Flying', tier: 'Guildmaster', baseHp: 6, ...S(2, 2, 2, 3, 2, { Brawl: 3, Channel: 4, Clash: 3, Evasion: 2, Alert: 5, Athletic: 2, Allure: 1, Etiquette: 1, Intimidate: 1, Tough: 3, Cool: 5, Beauty: 4, Clever: 2, Cute: 5 }), moves: ['Giga Drain', 'Bug Buzz', 'Bug Bite', 'Silver Wind', 'Attract'],
    hi: 'So you want to test yourself against the Guildmaster. Very well.', win: 'You have heart. Train well, and try me again.', lose: '…Remarkable. The guild is in good wings.' },
};
const isNpc = (id) => String(id || '').startsWith('npc:');
const npcKey = (id) => String(id).slice(4);
const pc = (id) => (isNpc(id) ? { id, ...GUILD[npcKey(id)] } : party()[id] || {});
// a face for the lists: guild members use their species portrait (or their own art), never a player's cast art that shares their name
// her ask 10-29: frames match by group: player characters always get the black art frame, guild members the blue one
const frameAs = (html, art) => html.replace(/class="portrait( art)?/, `class="portrait${art ? ' art' : ''}`);
const face = (id, size = 'sm') => { const c = pc(id); return isNpc(id) ? frameAs(portrait(c.art ? { art: c.art, nickname: c.nickname } : { pokemon: c.pokemon }, size), false) : frameAs(portrait(c, size), true); };
const foeOf = (B, id) => (id === B.a ? B.b : B.a);
const nm = (id) => pc(id).nickname || 'Someone';

// PMD Explorers-style idle sprites (SpriteCollab): front = facing down-left (the foe), back = facing up-right (you)
// trimmed to the Pokémon so they stand on their platform: [front w, h, back w, h, frames, loop ms]
const SPRITES = { golett: [26, 31, 27, 31, 5, 1433], tinkatink: [18, 19, 20, 18, 4, 1400], jangmoo: [21, 22, 20, 24, 4, 1333], sudowoodo: [19, 26, 19, 25, 1, 133], swablu: [27, 25, 23, 24, 9, 900],
  magnemite: [15, 18, 16, 17, 4, 800], slakoth: [30, 23, 30, 23, 2, 1133], cleffa: [18, 19, 17, 19, 2, 900], cottonee: [18, 15, 20, 15, 4, 800], diglett: [22, 16, 22, 16, 2, 533],
  ralts: [15, 21, 16, 22, 2, 1083], maushold: [29, 25, 29, 27, 12, 1600], machamp: [30, 31, 30, 30, 10, 1133], scolipede: [42, 40, 43, 44, 4, 1267], mudkip: [19, 23, 16, 24, 7, 917],
  pikachu: [28, 30, 29, 28, 6, 883], beautifly: [27, 31, 30, 37, 4, 667], beedrill: [29, 29, 27, 25, 4, 267], wingull: [25, 23, 24, 22, 4, 600] };
// her report 10-29 (Golett and Machamp's frames looked wrong): each frame now shows for its own length from the sprite's
// timing data (1 tick = 1/60 s), instead of every frame for the same time. One @keyframes per species, built once.
const DUR = { golett: [56, 2, 6, 2, 20], tinkatink: [30, 12, 30, 12], jangmoo: [40, 12, 16, 12], sudowoodo: [8], swablu: [4, 4, 4, 4, 6, 8, 8, 8, 8], magnemite: [10, 14, 10, 14], slakoth: [60, 8], cleffa: [36, 18], cottonee: [10, 14, 10, 14], diglett: [16, 16], ralts: [40, 25], maushold: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8], machamp: [40, 2, 2, 2, 2, 2, 2, 2, 2, 12], scolipede: [40, 8, 20, 8], mudkip: [38, 2, 2, 5, 3, 3, 2], pikachu: [40, 2, 3, 3, 3, 2], beautifly: [10, 10, 10, 10], beedrill: [4, 4, 4, 4], wingull: [8, 10, 8, 10] };
const animMade = new Set();
function spriteAnim(k) {
  const d = DUR[k]; if (!d) return '';
  if (!animMade.has(k)) {
    animMade.add(k); const total = d.reduce((a, x) => a + x, 0); let at = 0;
    const steps = d.map((x, i) => { const pct = (at / total * 100).toFixed(3); at += x; return `${pct}% { background-position-x: calc(var(--w) * var(--s) * ${-i}px); }`; }).join(' ');
    const st = document.createElement('style'); st.textContent = `@keyframes bt-${k} { ${steps} 100% { background-position-x: calc(var(--w) * var(--s) * ${-(d.length - 1)}px); } }`; document.head.appendChild(st);
  }
  return `animation:bt-${k} ${Math.round(d.reduce((a, x) => a + x, 0) / 60 * 1000)}ms step-end infinite`;
}
function spriteHTML(c, side) {
  const k = String(c.pokemon || '').toLowerCase().replace(/[^a-z]/g, '');
  const s = SPRITES[k];
  if (!s) return `<div class="bt-port">${portrait(c)}</div>`;
  const [w, h, n, ms] = side === 'front' ? [s[0], s[1], s[4], s[5]] : [s[2], s[3], s[4], s[5]];
  return `<div class="bt-spr" style="--w:${w};--h:${h};--n:${n};--ms:${ms}ms;background-image:url(assets/battle/${k}_${side}.png);${spriteAnim(k)}" role="img" aria-label="${esc(c.pokemon)}"></div>`;
}

// type chart (attacking type: [super effective against], [not very effective against], [no effect on])
const CHART = {
  Normal: [[], ['Rock', 'Steel'], ['Ghost']], Fire: [['Grass', 'Ice', 'Bug', 'Steel'], ['Fire', 'Water', 'Rock', 'Dragon'], []],
  Water: [['Fire', 'Ground', 'Rock'], ['Water', 'Grass', 'Dragon'], []], Electric: [['Water', 'Flying'], ['Electric', 'Grass', 'Dragon'], ['Ground']],
  Grass: [['Water', 'Ground', 'Rock'], ['Fire', 'Grass', 'Poison', 'Flying', 'Bug', 'Dragon', 'Steel'], []], Ice: [['Grass', 'Ground', 'Flying', 'Dragon'], ['Fire', 'Water', 'Ice', 'Steel'], []],
  Fighting: [['Normal', 'Ice', 'Rock', 'Dark', 'Steel'], ['Poison', 'Flying', 'Psychic', 'Bug', 'Fairy'], ['Ghost']], Poison: [['Grass', 'Fairy'], ['Poison', 'Ground', 'Rock', 'Ghost'], ['Steel']],
  Ground: [['Fire', 'Electric', 'Poison', 'Rock', 'Steel'], ['Grass', 'Bug'], ['Flying']], Flying: [['Grass', 'Fighting', 'Bug'], ['Electric', 'Rock', 'Steel'], []],
  Psychic: [['Fighting', 'Poison'], ['Psychic', 'Steel'], ['Dark']], Bug: [['Grass', 'Psychic', 'Dark'], ['Fire', 'Fighting', 'Poison', 'Flying', 'Ghost', 'Steel', 'Fairy'], []],
  Rock: [['Fire', 'Ice', 'Flying', 'Bug'], ['Fighting', 'Ground', 'Steel'], []], Ghost: [['Psychic', 'Ghost'], ['Dark'], ['Normal']],
  Dragon: [['Dragon'], ['Steel'], ['Fairy']], Dark: [['Psychic', 'Ghost'], ['Fighting', 'Dark', 'Fairy'], []],
  Steel: [['Ice', 'Rock', 'Fairy'], ['Fire', 'Water', 'Electric', 'Steel'], []], Fairy: [['Fighting', 'Dragon', 'Dark'], ['Fire', 'Poison', 'Steel'], []],
};
function typeEff(type, defTypes) {
  const row = CHART[type]; if (!row) return { n: 0, immune: false };
  let n = 0; let immune = false;
  for (const t of defTypes.filter(Boolean)) { if (row[2].includes(t)) immune = true; else if (row[0].includes(t)) n++; else if (row[1].includes(t)) n--; }
  return { n, immune };
}

// moves: the site's moves list (cached), Struggle always there
let movesP = null;
const moveIndex = () => (movesP ||= allMoves().then((l) => new Map(l.map((m) => [m.name.toLowerCase(), m]))));
const STRUGGLE = { name: 'Struggle', type: '', cat: 'Physical', acc: ['Dexterity', 'Brawl'], power: 0, effect: '' };
const alias = (n) => ({ metranome: 'metronome' }[String(n).toLowerCase()] || String(n).toLowerCase());
const moveOf = (ix, name) => (name === 'Struggle' ? STRUGGLE : ix.get(alias(name)) || { name, type: 'Normal', cat: 'Status', acc: [], power: null, effect: '' });
const isMetronome = (m) => /^metronome$/i.test(m.name);
// a stat in battle: "Tough/cute" = the better one; battle-only drops (Growl, Leer...) count too
const STAT_ALIAS = { defense: 'Vitality', 'special defense': 'Insight', 'sp. defense': 'Insight', attack: 'Strength', 'special attack': 'Special' };
const bstat = (B, id, name) => Math.max(...String(name).split('/').map((n) => { const k = STAT_ALIAS[n.trim().toLowerCase()] || n.trim(); return statVal(pc(id), k) + num(B.mods?.[id]?.[k.toLowerCase()]); }));

// ---------------------------------------------------------------- one round
async function resolve(bid) {
  const B = structuredClone(store.get(P(bid)) || {});
  if (B.phase !== 'fight' || ![B.a, B.b].every((id) => B.picks?.[id])) return;
  const ix = await moveIndex();
  const hp = { ...B.hp }; const ev = []; const cond = B.cond || {}; B.mods ||= {}; B.last ||= {};
  const say = (text, fx = '', who = '') => ev.push({ text, fx, who, hp: { ...hp } });
  const init = Object.fromEntries([B.a, B.b].map((id) => [id, die(6) + bstat(B, id, 'Dexterity') + bstat(B, id, 'Alert') + Math.random() / 10]));
  const order = [B.a, B.b].sort((x, y) => init[y] - init[x]);
  const flinched = {};
  const randomMove = (min = 1) => { const l = [...ix.values()].filter((m) => m.power != null && num(m.power) >= min && m.cat !== 'Status' && !isMetronome(m)); return l[Math.floor(Math.random() * l.length)] || STRUGGLE; };

  // one attack: accuracy, then damage (or a status move's effect)
  const attack = (m, id, foe, { extra = 0, power = null } = {}) => {
    const pain = painFor(hp[id], B.max[id]);
    const accMod = num((m.effect.match(/(?:-|−)\s*(\d)\s*Accuracy|Accuracy\s*-\s*(\d)/i) || []).slice(1).find(Boolean));
    const accDice = Math.max(1, m.acc.reduce((s, a) => s + bstat(B, id, a), 0) + num(B.mods[id]?.accuracy));
    const acc = m.acc.length && !/Never Fail/i.test(m.effect) ? pool(accDice, { pain: pain + accMod }) : { succ: 1 };
    acc.succ += extra;
    if (acc.succ < 1) return say(`${nm(id)}’s attack missed!`, 'miss');
    if (m.power == null) return statusMove(B, m, id, foe, cond, say);
    const f = pc(foe);
    const eff = typeEff(m.type, [f.type1, f.type2]);
    if (eff.immune) return say(`It doesn’t affect ${nm(foe)}…`);
    const crit = acc.succ >= 4;
    const stab = m.type && [pc(id).type1, pc(id).type2].includes(m.type);
    const flail = /missing HP/i.test(m.effect) ? Math.min(5, B.max[id] - hp[id]) : 0;
    const dice = Math.max(1, bstat(B, id, m.cat === 'Special' ? 'Special' : 'Strength') + (power ?? num(m.power)) - bstat(B, foe, m.cat === 'Special' ? 'Insight' : 'Vitality') + (stab ? 1 : 0) + (crit ? 2 : 0) + flail);
    const dmg = Math.max(1, pool(dice, { pain }).succ + eff.n);  // a hit always does at least 1
    hp[foe] = Math.max(0, hp[foe] - dmg);
    say(foe === id ? `${nm(id)} hit itself for ${dmg} damage!` : `${nm(foe)} took ${dmg} damage!`, 'hit', foe);
    if (crit) say('A critical hit!');
    if (eff.n > 0) say('It’s super effective!'); else if (eff.n < 0) say('It’s not very effective…');
    if (/restores HP equal to half the damage/i.test(m.effect) && hp[id] < B.max[id] && Math.floor(dmg / 2)) { hp[id] = Math.min(B.max[id], hp[id] + Math.floor(dmg / 2)); say(`${nm(id)} drained some energy!`, 'heal', id); }
    if (hp[foe] <= 0) return;
    const fl = num((m.effect.match(/Roll\s+(\d+)\s+Chance Dice to Flinch/i) || [])[1]);
    if (fl && roll(fl).includes(6) && order.indexOf(id) === 0) flinched[foe] = true;
    const cf = num((m.effect.match(/Roll\s+(\d+)\s+Chance Dice to Confuse/i) || [])[1]);
    if (cf && roll(cf).includes(6) && !cond[foe]?.confused) { cond[foe] = { ...(cond[foe] || {}), confused: 2 }; say(`${nm(foe)} became confused!`); }
  };

  // Metronome spins Gemini's Metronome wheel (the Games page one, so the GM's edits count) and plays out the slice
  const metronome = async (id, foe) => {
    let slices = [];
    try { slices = (await import('./games.js?v=6ae3bd59')).games().find((g) => g.id === 'gemini-metronome')?.slices || []; } catch { /* plain Metronome */ }
    const wt = (x) => parseFloat(x[1]) || 1; let r = Math.random() * slices.reduce((s, x) => s + wt(x), 0);
    const sl = slices.find((x) => (r -= wt(x)) <= 0) || ['Lucky Star', 1, ''];
    say(`🌟 The Metronome wheel spins… ${sl[0]}!`, 'up', id);
    const go = (m, target = foe, o = {}) => { say(`${nm(id)}’s finger wag turned into ${m.name}!`, 'use', id); attack(m, id, target, o); };
    switch (sl[0]) {
      case 'Lucky Star': return go(randomMove(), foe, { extra: 1 });
      case 'Double Wag': go(randomMove()); if (hp[foe] > 0) go(randomMove()); return;
      case 'Jackpot Move': return go(randomMove(3));
      case 'Wish Upon a Star': hp[id] = Math.min(B.max[id], hp[id] + 2); return say(`A wish came true! ${nm(id)} healed 2 HP.`, 'heal', id);
      case 'Coin Shower': hp[foe] = Math.max(0, hp[foe] - 1); return say(`Coins rain down and bonk ${nm(foe)} for 1 damage!`, 'hit', foe);
      case 'Wobbly Wag': { const self = Math.random() < 0.5; if (self) say('The wag wobbled… it’s heading back!'); return go(randomMove(), self ? id : foe); }
      case 'Moonlit Charm': cond[foe] = { ...(cond[foe] || {}), love: 2 }; return say(`${nm(foe)} fell in love under the moonlight!`);
      case 'Backfire': cond[id] = { ...(cond[id] || {}), confused: 2 }; return say(`Backfire! ${nm(id)} became confused!`);
      case 'Just a Wave': return say(`${nm(id)} waved hello… nothing happened!`);
      default: if (sl[2]) say(sl[2]); return go(randomMove());
    }
  };

  for (const id of order) {
    const foe = foeOf(B, id); const c = cond[id] ||= {};
    if (hp[id] <= 0 || hp[foe] <= 0) break;
    if (flinched[id]) { say(`${nm(id)} flinched and couldn’t move!`); continue; }
    if (c.sleep) { c.sleep--; say(c.sleep ? `${nm(id)} is fast asleep.` : `${nm(id)} woke up!`); if (c.sleep) continue; }
    if (c.love) { c.love--; if (Math.random() < 0.5) { say(`${nm(id)} is in love and can’t attack!`); continue; } }
    if (c.confused) {
      c.confused--; say(`${nm(id)} is confused!`);
      if (die(3) === 1) { hp[id] = Math.max(0, hp[id] - 1); say('It hurt itself in its confusion!', 'hit', id); if (hp[id] <= 0) { say(`${nm(id)} fainted!`, 'faint', id); break; } continue; }
      if (!c.confused) say(`${nm(id)} snapped out of its confusion!`);
    }
    const m = moveOf(ix, B.picks[id]); B.last[id] = m.name;
    say(`${nm(id)} used ${m.name}!`, 'use', id);
    if (isMetronome(m)) await metronome(id, foe); else attack(m, id, foe);
    for (const x of [foe, id]) if (hp[x] <= 0 && !ev.some((e) => e.fx === 'faint' && e.who === x)) say(`${nm(x)} fainted!`, 'faint', x);
    if (hp[foe] <= 0 || hp[id] <= 0) break;
  }
  // Yawn: drowsy at the end of the round, asleep for the next one
  for (const id of [B.a, B.b]) { const c = cond[id] ||= {}; if (c.yawn && hp[id] > 0) { c.yawn = 0; c.sleep = 2; say(`${nm(id)} fell asleep!`); } else if (c.yawnSet) { c.yawnSet = 0; c.yawn = 1; } }
  const out = [B.a, B.b].filter((id) => hp[id] <= 0);
  const winner = out.length ? [B.a, B.b].find((id) => hp[id] > 0) || '' : null;
  if (winner !== null) {
    const npc = [B.a, B.b].find(isNpc);
    say(winner ? `${nm(winner)} won the battle!` : 'Both fainted! It’s a draw.', 'win', winner);
    if (npc) {
      const g = GUILD[npcKey(npc)]; const player = foeOf(B, npc);
      say(`${g.nickname}: “${winner === npc ? g.win : g.lose}”`);
      store.update(`spar/${player}/${npcKey(npc)}`, (x) => ({ w: num(x?.w) + (winner === player ? 1 : 0), l: num(x?.l) + (winner === npc ? 1 : 0), first: x?.first || (winner === player ? Date.now() : 0) }));
    }
    store.pushLimited('log', { t: Date.now(), text: npc
      ? (winner && !isNpc(winner) ? `🏋️ ${nm(winner)} beat ${nm(npc)} in Guild Training!` : `🏋️ ${nm(foeOf(B, npc))} trained with ${nm(npc)}.`)
      : winner ? `⚔️ ${nm(winner)} beat ${nm(foeOf(B, winner))} in a friendly battle!` : `⚔️ ${nm(B.a)} and ${nm(B.b)} fought to a draw.` });
  }
  // only if nobody else worked out this round first
  if ((store.get(P(bid))?.round) !== B.round) return;
  store.set(P(bid), { ...B, hp, cond, picks: {}, ev, evRound: B.round, round: B.round + 1, phase: winner !== null ? 'done' : 'fight', winner: winner || '', lastAct: Date.now() });
}

function statusMove(B, m, id, foe, cond, say) {
  const e = m.effect || '';
  // stat changes, in either wording: "Reduce the foe's Strength by 2" / "Increase the User's Defense" (index) or
  // "Strength -2" / "Foe's Defense -1" / "User's Strength +1 / User's Defense +1" (moves sheet)
  const ST = String.raw`(Strength|Special Defense|Sp\. ?Def(?:ense)?|Special|Dexterity|Defense|Vitality|Insight|Accuracy)`;
  const changes = [];
  for (const mm of e.matchAll(new RegExp(String.raw`(User'?’?s |Foe'?’?s )?${ST}\s*([+\-−])\s*(\d)`, 'gi'))) changes.push([/user/i.test(mm[1] || '') || (!mm[1] && mm[3] === '+') ? id : foe, mm[2], (mm[3] === '+' ? 1 : -1) * num(mm[4])]);
  if (!changes.length) {
    const lower = e.match(new RegExp(String.raw`Reduce (?:the )?foe'?’?s ${ST}(?: by (\d))?`, 'i')) || e.match(new RegExp(String.raw`Reduce the ${ST} of those affected`, 'i'));
    if (lower) changes.push([foe, lower[1], -(num(lower[2]) || 1)]);
    for (const mm of e.matchAll(new RegExp(String.raw`Increase (?:the )?user'?’?s ${ST}(?: and ${ST})?(?: by (\d))?`, 'gi'))) [mm[1], mm[2]].filter(Boolean).forEach((st) => changes.push([id, st, num(mm[3]) || 1]));
  }
  if (changes.length) {
    for (const [who, stat, by] of changes) {
      const k = (STAT_ALIAS[stat.toLowerCase().replace(/^sp\.? ?def(ense)?$/, 'special defense')] || stat).toLowerCase();
      B.mods[who] ||= {}; B.mods[who][k] = num(B.mods[who][k]) + by;
      const label = { strength: 'Strength', special: 'Special', dexterity: 'Dexterity', vitality: 'Defense', insight: 'Special Defense', accuracy: 'accuracy' }[k] || k;
      say(`${nm(who)}’s ${label} ${by < 0 ? 'fell' : 'rose'}${Math.abs(by) > 1 ? ' sharply' : ''}!`, by < 0 ? 'down' : 'up', who);
    }
    return;
  }
  if (/confuse/i.test(e)) { cond[foe] = { ...(cond[foe] || {}), confused: 2 }; return say(`${nm(foe)} became confused!`); }
  if (/fall asleep/i.test(e)) { cond[foe] = { ...(cond[foe] || {}), yawnSet: 1 }; return say(`${nm(foe)} grew drowsy!`); }
  if (/repeat the exact same action/i.test(e)) {
    if (!B.last[foe]) return say('But it failed!');
    cond[foe] = { ...(cond[foe] || {}), encore: B.last[foe], encoreN: 2 }; return say(`${nm(foe)} must keep using ${B.last[foe]}!`);
  }
  say('But nothing happened in a practice battle!');
}

// a guild member's move: mostly attacks, the best type match-up more often, now and then a status move
async function npcPick(B, id) {
  const ix = await moveIndex(); const f = pc(foeOf(B, id));
  const opts = (pc(id).moves || []).map((n) => moveOf(ix, n));
  const score = (m) => (m.power == null ? (B.round <= 2 ? 1.2 : 0.4) : 1 + num(m.power) * 0.3 + typeEff(m.type, [f.type1, f.type2]).n * 0.8);
  const w = opts.map((m) => Math.max(0.1, score(m)));
  let r = Math.random() * w.reduce((s, x) => s + x, 0);
  return (opts.find((_, i) => (r -= w[i]) <= 0) || opts[0] || STRUGGLE).name;
}

// ---------------------------------------------------------------- start / answer / leave
const fresh = (a, b) => { const mx = { [a]: Math.max(1, maxHp(pc(a))), [b]: Math.max(1, maxHp(pc(b))) }; return { a, b, t: Date.now(), round: 1, hp: { ...mx }, max: mx, lastAct: Date.now() }; };
export function challenge(foeId) {
  const c = me(); if (!c) return toast('Pick your character first.');
  if (!pc(foeId).nickname) return;
  const bid = uid();
  if (isNpc(foeId)) {
    const g = GUILD[npcKey(foeId)];
    store.set(P(bid), { ...fresh(c.id, foeId), phase: 'fight', ev: [{ text: `${g.nickname} wants to train!`, hp: fresh(c.id, foeId).hp }, { text: `${g.nickname}: “${g.hi}”`, hp: fresh(c.id, foeId).hp }], evRound: 0 });
  } else {
    store.set(P(bid), { ...fresh(c.id, foeId), phase: 'ask' });
    store.set(`invites/${foeId}/${uid()}`, { from: c.nickname, fromId: c.id, game: `${GAME_ID}/${bid}`, name: 'a Friendly Battle', t: Date.now() });
  }
  location.hash = `#/games/${GAME_ID}/${bid}`;
}
const myBattles = (id) => Object.entries(store.get('battles') || {}).filter(([, B]) => B && (B.a === id || B.b === id) && ['ask', 'fight'].includes(B.phase) && Date.now() - num(B.lastAct) < 24 * 3600e3);
const TIER_ICON = { Rookie: '🌱', Bronze: '🥉', Silver: '🥈', Gold: '🥇', Champion: '🏆', Guildmaster: '👑' };

// ---------------------------------------------------------------- pages
export function renderBattle(main, g, bid) {
  if (bid) return renderFight(main, bid);
  // old finished battles are tidied away by whoever opens the lobby
  for (const [k, B] of Object.entries(store.get('battles') || {})) if (B && Date.now() - num(B.lastAct) > (['done', 'off'].includes(B.phase) ? 3600e3 : 24 * 3600e3)) store.set(P(k), null);
  const draw = () => {
    const c = me();
    const friends = new Set(Array.isArray(c?.friends) ? c.friends : []);
    const others = Object.values(party()).filter((x) => c && x.id !== c.id && (!x.guest || x.guest.controller === 'player')).sort((x, y) => friends.has(y.id) - friends.has(x.id));
    const open = c ? myBattles(c.id) : [];
    const spar = store.get('spar') || {};
    const champs = (k) => Object.entries(spar).filter(([pid, r]) => num(r?.[k]?.w) && party()[pid]).sort((x, y) => num(x[1][k].first) - num(y[1][k].first)).map(([pid]) => party()[pid].nickname);
    const mine = (k) => spar[c?.id]?.[k] || {};
    const board = Object.entries(spar).filter(([pid]) => party()[pid]).map(([pid, r]) => [pid, Object.values(r || {}).filter((x) => num(x?.w)).length, Object.values(r || {}).reduce((s, x) => s + num(x?.w), 0)])
      .filter(([, n]) => n).sort((x, y) => y[1] - x[1] || y[2] - x[2]);
    main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a></div>
      <h1 style="margin:10px 0 4px">⚔️ Battles</h1><p>${esc(g.intro || '')}</p>
      <p><span class="pill">❤️ Everyone starts at full HP</span> <span class="pill">📜 Your sheet never changes</span> <span class="pill">🎵 Battle music</span></p>
      ${c ? '<p class="row bt-jump"><span class="small muted">Jump to:</span><button class="btn alt sm" data-jump="bt-friends">👥 Friendly Battle</button><button class="btn alt sm" data-jump="bt-train">🏋️ Guild Training</button></p>' : ''}
      <details class="card small"><summary><b>How it works</b></summary><ol>
        <li><b>Friendly Battle:</b> challenge someone at the table. They get a pop-up to accept. <b>Guild Training:</b> battle a guild member any time, just for bragging rights.</li>
        <li>Each round press <b>FIGHT</b> and pick a move. The faster Pokémon (1d6 + Dexterity + Alert) goes first.</li>
        <li>Moves roll the table’s dice: accuracy needs 1 success; damage is Strength or Special + Power − their Defense (Vitality) or Special Defense (Insight). Same type as you +1 die, a critical hit +2 dice, type match-ups count.</li>
        <li>Status moves work for the battle only: Growl, Charm and Leer lower stats, Supersonic confuses, Yawn puts the foe to sleep, Encore locks their move. <b>Metronome</b> spins Gemini’s Metronome wheel.</li>
        <li>First to 0 HP loses. <b>Run</b> gives up.</li></ol></details>
      ${!c ? '<p class="card">Pick your character first (Play tab), then come and battle.</p>' : `
      ${open.length ? `<h2 class="games-h">Your battles</h2><p class="small muted">Battles you started that aren’t finished yet. Tap <b>Continue</b> to go back in.</p><ul class="sentry-roster fr-list">${open.map(([k, B]) => `<li>${face(foeOf(B, c.id))}<span class="grow"><b>vs ${esc(nm(foeOf(B, c.id)))}</b><br><span class="small muted">${B.phase === 'ask' ? (B.a === c.id ? 'Waiting for them to accept' : 'They challenged you!') : `Round ${num(B.round)}`}</span></span><span class="fr-acts"><a class="btn sm" href="#/games/${GAME_ID}/${esc(k)}">${B.phase === 'ask' && B.b === c.id ? '⚔️ Answer' : '▶ Continue'}</a></span></li>`).join('')}</ul>` : ''}
      <h2 class="games-h" id="bt-friends">👥 Friendly Battle</h2>
      <ul class="sentry-roster fr-list">${others.map((x) => `<li>${face(x.id)}<span class="grow"><b>${esc(x.nickname)}</b>${friends.has(x.id) ? ' <span class="pill">Friend</span>' : ''}<br><span class="small muted">${esc(x.pokemon || '')} · ${maxHp(x)} HP</span></span><span class="fr-acts"><button class="btn sm" data-ch="${esc(x.id)}">⚔️ Challenge</button></span></li>`).join('') || '<li class="muted">Nobody else at the table yet.</li>'}</ul>
      <h2 class="games-h" id="bt-train">🏋️ Guild Training</h2><p class="small muted">Spar with the guild’s members. No prizes, just bragging rights: every guild member you beat goes on the Training Board.</p>
      <ul class="sentry-roster fr-list">${Object.entries(GUILD).map(([k, n]) => { const r = mine(k); const ch = champs(k);
        return `<li>${face(`npc:${k}`)}<span class="grow"><b>${esc(n.nickname)}</b> <span class="pill">${TIER_ICON[n.tier]} ${esc(n.tier)}</span>${r.w ? ' <span class="pill">🏅 Beaten</span>' : ''}<br><span class="small muted">${esc(n.pokemon)} · ${maxHp(n)} HP${r.w || r.l ? ` · you: ${num(r.w)} win${num(r.w) === 1 ? '' : 's'}, ${num(r.l)} loss${num(r.l) === 1 ? '' : 'es'}` : ''}${ch.length ? ` · beaten by ${esc(ch.slice(0, 4).join(', '))}${ch.length > 4 ? '…' : ''}` : ''}</span></span><span class="fr-acts"><button class="btn sm" data-ch="npc:${k}">🏋️ Train</button></span></li>`; }).join('')}</ul>
      <div class="card bt-board"><h3>🏆 Training Board</h3>${board.length ? `<ol>${board.map(([pid, n, w]) => `<li><b>${esc(party()[pid].nickname)}</b>: beat ${n} of ${Object.keys(GUILD).length} guild members <span class="small muted">(${w} win${w === 1 ? '' : 's'})</span>${n === Object.keys(GUILD).length ? ' 👑' : ''}</li>`).join('')}</ol>` : '<p class="small muted">Nobody has beaten a guild member yet. Be the first!</p>'}</div>`}`;
    $$('[data-ch]', main).forEach((b) => b.onclick = () => challenge(b.dataset.ch));
    $$('[data-jump]', main).forEach((b) => b.onclick = () => document.getElementById(b.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  draw();
  let last = '';
  const off = store.subscribe(() => { if (!main.isConnected || !/friendly-battle\/?$/.test(location.hash)) return off(); const now = JSON.stringify([store.get('battles'), store.get('spar')]) + (me()?.id || ''); if (now !== last) { last = now; draw(); } });
}

function renderFight(main, bid) {
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games/${GAME_ID}">← Battles</a><button class="btn alt sm" id="btmusic">🔊 Music on</button></div><div class="bt-wrap" id="bt"></div>`;
  const box = $('#bt', main);
  pageMusic(main, 'battle', 'btmusic');
  const seen = (() => { try { const v = sessionStorage.getItem('dc.bt.' + bid); return v == null ? -1 : num(v); } catch { return -1; } })();
  let shownRound = seen; let playing = false; let resolving = 0; let waitT = 0; let menu = 'main'; let intro = true;
  const markSeen = (r) => { shownRound = r; try { sessionStorage.setItem('dc.bt.' + bid, String(r)); } catch { /* ignore */ } };

  const scene = (B, myId, hpView, text, fx = {}) => {
    const near = myId && [B.a, B.b].includes(myId) ? myId : B.a; const far = foeOf(B, near);
    const hb = (id, mine) => { const c = pc(id); const h = hpView[id]; const mx = B.max[id]; const pct = Math.max(0, Math.min(100, (h / mx) * 100));
      return `<div class="bt-hp ${mine ? 'near' : 'far'}"><div class="bt-nm"><b>${esc(c.nickname || '?')}</b><span>${esc(c.tier ? TIER_ICON[c.tier] + ' ' + c.tier : c.pokemon || '')}</span></div>
        <div class="bt-bar"><span>HP</span><i><b class="${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}" style="width:${pct}%"></b></i></div>${mine ? `<div class="bt-num">${h}/${mx}</div>` : ''}</div>`; };
    const zoom = Object.entries(fx).find(([, v]) => v === 'lunge')?.[0];
    const html = `<div class="bt-scene ${intro ? 'intro' : ''}"><div class="bt-cam ${zoom ? (zoom === near ? 'zoom-near' : 'zoom-far') : ''}">
        <div class="bt-bg"></div><div class="bt-plat far"></div><div class="bt-plat near"></div>
        <div class="bt-side far ${fx[far] || ''}">${spriteHTML(pc(far), 'front')}</div>
        <div class="bt-side near ${fx[near] || ''}">${spriteHTML(pc(near), 'back')}</div></div>
      ${hb(far, false)}${hb(near, true)}${Object.values(fx).includes('hit') ? '<div class="bt-flash"></div>' : ''}
    </div><div class="bt-low"><div class="bt-text">${text}</div><div class="bt-menu" id="btmenu"></div></div>`;
    intro = false;
    return html;
  };

  const menuHTML = async (B, myId) => {
    const c = pc(myId); const cd = B.cond?.[myId] || {};
    if (B.picks?.[myId]) return `<p class="bt-wait">Waiting for ${esc(nm(foeOf(B, myId)))}…</p>`;
    if (menu === 'main') return '<button class="bt-cmd fight" data-fight>FIGHT</button><button class="bt-cmd run" data-run>RUN</button>';
    const ix = await moveIndex();
    const list = cd.encore && cd.encoreN ? [cd.encore] : [...(c.moves || []), 'Struggle'];
    return `<div class="bt-moves">${list.map((n) => { const m = moveOf(ix, n); const t = m.type || 'Normal';
      return `<button class="bt-mv ty-${esc(t)}" data-mv="${esc(n)}"><b>${esc(m.name)}</b><small><span class="bt-ty">${TYPE_ICONS[t] || ''} ${esc(m.type || 'Typeless')}</span> ${m.power == null ? 'Status' : 'Power ' + (isMetronome(m) ? '🎡' : m.power)}</small></button>`; }).join('')}</div>
      <button class="bt-cmd back" data-back>◀ Back</button>`;
  };

  const wire = (B, myId) => {
    const f = $('[data-fight]', box); if (f) f.onclick = () => { ensureAudio(); menu = 'moves'; draw(); };
    const bk = $('[data-back]', box); if (bk) bk.onclick = () => { menu = 'main'; draw(); };
    $$('[data-mv]', box).forEach((b) => b.onclick = async () => {
      ensureAudio(); $$('[data-mv]', box).forEach((x) => { x.disabled = true; }); menu = 'main';
      const cd = B.cond?.[myId];
      if (cd?.encoreN) store.update(`${P(bid)}/cond/${myId}`, (x) => ({ ...x, encoreN: num(x?.encoreN) - 1 }));
      const foe = foeOf(B, myId);
      if (isNpc(foe)) store.set(`${P(bid)}/picks/${foe}`, await npcPick(B, foe));
      store.set(`${P(bid)}/picks/${myId}`, b.dataset.mv);
      store.set(`${P(bid)}/lastAct`, Date.now());
      maybeResolve();
    });
    const run = $('[data-run]', box);
    if (run) run.onclick = () => { if (!confirm('Give up this battle?')) return; const foe = foeOf(B, myId);
      if (isNpc(foe)) store.update(`spar/${myId}/${npcKey(foe)}`, (x) => ({ ...(x || {}), w: num(x?.w), l: num(x?.l) + 1, first: x?.first || 0 }));
      store.set(P(bid), { ...B, phase: 'done', winner: foe, picks: {}, ev: [{ text: `${nm(myId)} ran away! ${nm(foe)} wins.`, fx: 'win', who: foe, hp: B.hp }], evRound: B.round, round: B.round + 1, lastAct: Date.now() }); };
  };

  const maybeResolve = () => {
    const B = store.get(P(bid)); if (!B || B.phase !== 'fight' || ![B.a, B.b].every((id) => B.picks?.[id]) || resolving === B.round) return;
    const myId = me()?.id;
    if (myId === B.a) { resolving = B.round; resolve(bid); return; }
    // player b (or anyone watching) steps in if player a's device doesn't
    clearTimeout(waitT); waitT = setTimeout(() => { const B2 = store.get(P(bid)); if (B2 && B2.round === B.round && B2.phase === 'fight') { resolving = B.round; resolve(bid); } }, myId === B.b ? 4000 : 9000);
  };

  // play the last round's messages one by one (HP bars move with them)
  const playEvents = async (B, myId) => {
    playing = true;
    for (const e of B.ev) {
      if (!box.isConnected) return;
      const fx = {}; if (e.fx === 'hit' || e.fx === 'faint') fx[e.who] = e.fx; if (e.fx === 'use') fx[e.who] = 'lunge'; if (e.fx === 'heal' || e.fx === 'up') fx[e.who] = 'glow'; if (e.fx === 'down') fx[e.who] = 'shrink';
      if (e.fx === 'miss') missSound();
      box.innerHTML = scene(B, myId, { ...e.hp }, esc(e.text), fx);
      await new Promise((r) => setTimeout(r, e.fx === 'use' ? 1000 : 1500));
    }
    markSeen(B.evRound);
    if (B.phase === 'done' && myId && [B.a, B.b].includes(myId)) jingle(B.winner === myId);
    playing = false; draw();
  };

  const draw = async () => {
    const B = store.get(P(bid));
    if (!B) { box.innerHTML = '<div class="card"><p>This battle is over and tidied away.</p><a class="btn" href="#/games/friendly-battle">Back to Battles</a></div>'; return; }
    const myId = me()?.id; const mine = [B.a, B.b].includes(myId);
    if (playing) return;
    if (B.ev?.length && num(B.evRound) > shownRound) return playEvents(B, myId);
    if (B.phase === 'ask') {
      box.innerHTML = `<div class="card bt-ask"><div class="row">${portrait(pc(B.a), 'sm')}<b>⚔️ vs</b>${portrait(pc(B.b), 'sm')}</div>
        <h2>${esc(nm(B.a))} challenged ${esc(nm(B.b))}!</h2>
        ${myId === B.b ? '<button class="btn" id="btyes">⚔️ Accept</button> <button class="btn alt" id="btno">Not now</button>' : myId === B.a ? `<p>Waiting for ${esc(nm(B.b))} to accept…</p><button class="btn alt" id="btno">Cancel</button>` : '<p class="muted">Waiting for them to start.</p>'}</div>`;
      const y = $('#btyes', box); if (y) y.onclick = () => store.set(P(bid), { ...B, phase: 'fight', ev: [{ text: `${nm(B.a)} vs ${nm(B.b)}! Battle start!`, hp: B.hp }], evRound: 0, lastAct: Date.now() });
      const n = $('#btno', box); if (n) n.onclick = () => { store.set(P(bid), { ...B, phase: 'off', lastAct: Date.now() }); location.hash = `#/games/${GAME_ID}`; };
      return;
    }
    if (B.phase === 'off') { box.innerHTML = `<div class="card"><p>${esc(myId === B.a ? `${nm(B.b)} said not now.` : 'This challenge was called off.')}</p><a class="btn" href="#/games/${GAME_ID}">Back to Battles</a></div>`; return; }
    const text = B.phase === 'done' ? `<b>${B.winner ? esc(nm(B.winner)) + ' won the battle!' : 'It’s a draw!'}</b>`
      : !mine ? `👀 Watching ${esc(nm(B.a))} vs ${esc(nm(B.b))}` : B.picks?.[myId] ? `${esc(nm(myId))} is ready!` : `What will <b>${esc(nm(myId))}</b> do?`;
    box.innerHTML = scene(B, myId, B.hp, text, B.phase === 'done' ? Object.fromEntries([B.a, B.b].filter((id) => num(B.hp[id]) <= 0).map((id) => [id, 'gone'])) : {});
    const mn = $('#btmenu', box);
    if (B.phase === 'done') mn.innerHTML = `<a class="bt-cmd run" href="#/games/${GAME_ID}">⚔️ Battles</a>${mine ? '<button class="bt-cmd fight" id="btagain">REMATCH</button>' : ''}`;
    else if (mine) mn.innerHTML = await menuHTML(B, myId);
    else mn.innerHTML = '';
    const ag = $('#btagain', box); if (ag) ag.onclick = () => challenge(foeOf(B, myId));
    if (mine && B.phase === 'fight') wire(B, myId);
    maybeResolve();
  };
  draw();
  let last = '';
  const off = store.subscribe(() => { if (!box.isConnected) return off(); const now = JSON.stringify(store.get(P(bid)) || null) + (me()?.id || ''); if (now !== last) { last = now; draw(); } });
}
export const battleMini = () => `<div class="bt-mini"><div class="bt-spr" style="--w:21;--h:22;--n:4;--ms:1333ms;--s:3;background-image:url(assets/battle/jangmoo_front.png)"></div><div class="bt-spr" style="--w:17;--h:19;--n:2;--ms:900ms;--s:3;background-image:url(assets/battle/cleffa_back.png)"></div></div>`;

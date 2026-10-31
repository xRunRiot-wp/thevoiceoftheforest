// Level up (her ask 10-31): when the GM ranks a player up, party/<id>/levelUp = { from, to } and a button shows on their
// Play page. It walks them through what the new rank gives (PokéRole rank benefits): Attribute and Social points,
// Skill points with the new Skill Limit, and the moves their species can now learn (Pokédex learnset by rank).
import * as store from './store.js?v=6ae5d191';
import { $, $$, esc, num, toast } from './util.js?v=6ae5d191';
import { modal, closeModal } from './ui.js?v=6ae5d191';
import { ATTRS, SKILLS, SOCIAL, RANK_NAMES } from './content.js?v=6ae5d191';
import { loadIndex, find } from './effects.js?v=6ae5d191';

// what each rank adds (rulebook "Ranking"); limit = the most points one Skill may hold
const GAINS = {
  Beginner: { attr: 2, social: 2, skill: 4, limit: 2 },
  Amateur: { attr: 2, social: 2, skill: 3, limit: 3 },
  Ace: { attr: 2, social: 2, skill: 2, limit: 4 },
  Pro: { attr: 2, social: 2, skill: 1, limit: 5 },
  Master: { attr: 0, social: 0, skill: 0, limit: 5, note: 'Social Attributes go up to a total of 14 points, roll 2 extra dice on every Skill roll, and HP, Will, Initiative, Defense and Special Defense each go up by 2. Ask your GM to help with these.' },
  Champion: { attr: 0, social: 0, skill: 1, limit: 5, note: 'Attributes go up to a total of 14 points and may go 2 points past your species’ limit. Ask your GM to help with these.' },
};
const SOCIAL_MAX = 5;
const short = { Strength: 'Str', Dexterity: 'Dex', Vitality: 'Vit', Special: 'Spe', Insight: 'Ins' };

// every rank passed through counts (e.g. Starter -> Amateur gets Beginner's and Amateur's points)
export function gainsFor(from, to) {
  const a = Math.max(0, RANK_NAMES.indexOf(from)); const b = RANK_NAMES.indexOf(to);
  const g = { attr: 0, social: 0, skill: 0, limit: 1, notes: [] };
  for (const r of RANK_NAMES.slice(a + 1, b + 1)) { const x = GAINS[r]; if (!x) continue; g.attr += x.attr; g.social += x.social; g.skill += x.skill; g.limit = x.limit; if (x.note) g.notes.push(`${r}: ${x.note}`); }
  return g;
}
// species limits and learnset from the Pokédex entry
function speciesInfo(ix, c) {
  const e = c.pokemon ? find(ix, c.pokemon) || find(ix, String(c.pokemon).toLowerCase()) : null;
  const max = {};
  for (const m of String(e?.roll || '').matchAll(/(Str|Dex|Vit|Spe|Ins) (\d+)\/(\d+)/g)) { const k = Object.keys(short).find((x) => short[x] === m[1]); max[k] = +m[3]; }
  const learn = {};
  for (const part of String(e?.learn || '').split('|')) { const [r, list] = part.split(':'); if (r && list) learn[r.trim()] = list.split(',').map((s) => s.trim()).filter(Boolean); }
  return { max, learn };
}

export const levelUpHTML = (c) => (c?.levelUp ? `<button class="btn block levelup-btn" id="levelup">⭐ Level up! You’re now ${esc(c.levelUp.to)} rank. Tap to add your new stats and moves</button>` : '');

export async function openLevelUp(c) {
  const lu = c.levelUp; if (!lu) return;
  const g = gainsFor(lu.from, lu.to); const ix = await loadIndex(); const sp = speciesInfo(ix, c);
  const add = {}; [...ATTRS, ...SOCIAL, ...SKILLS].forEach((k) => { add[k] = 0; });
  const upTo = RANK_NAMES.slice(0, RANK_NAMES.indexOf(lu.to) + 1);
  const newMoves = upTo.slice(Math.max(0, RANK_NAMES.indexOf(lu.from)) + 1).flatMap((r) => sp.learn[r] || []);
  const allMoves = [...new Set(upTo.flatMap((r) => sp.learn[r] || []))];
  let moves = [...(c.moves || [])];
  const left = (keys, total) => total - keys.reduce((s, k) => s + add[k], 0);
  const cap = (k) => (ATTRS.includes(k) ? sp.max[k] ?? 99 : SOCIAL.includes(k) ? SOCIAL_MAX : g.limit);
  const moveMax = () => num(c.Insight) + add.Insight + 2;
  const stepper = (k) => `<div class="lu-row"><span class="grow">${esc(k)}</span><button class="btn alt sm" data-dn="${k}">−</button><b class="lu-val">${num(c[k]) + add[k]}${add[k] ? ` <small class="lu-plus">+${add[k]}</small>` : ''}</b><button class="btn alt sm" data-up="${k}">+</button><small class="muted lu-cap">max ${cap(k) === 99 ? '—' : cap(k)}</small></div>`;
  const el = modal('<div id="luwrap"></div>');
  el.classList.add('levelup-sheet');
  const draw = () => {
    const aL = left(ATTRS, g.attr); const sL = left(SOCIAL, g.social); const kL = left(SKILLS, g.skill);
    $('#luwrap', el).innerHTML = `<h2>⭐ Level up: ${esc(lu.from || 'Starter')} → ${esc(lu.to)}</h2>
      <p class="small muted">Your new rank lets ${esc(c.nickname)} grow. Spend the points below, pick your moves, then tap <b>Save</b>. Your GM can see every change in the log.</p>
      ${g.attr ? `<h3>1. Attributes <span class="pill ${aL ? '' : 'done'}">${aL} of ${g.attr} left</span></h3><p class="small muted">Can’t go past your species’ limit.</p>${ATTRS.map(stepper).join('')}` : ''}
      ${g.social ? `<h3>2. Social Attributes <span class="pill ${sL ? '' : 'done'}">${sL} of ${g.social} left</span></h3><p class="small muted">Up to ${SOCIAL_MAX} in each.</p>${SOCIAL.map(stepper).join('')}` : ''}
      ${g.skill ? `<h3>3. Skills <span class="pill ${kL ? '' : 'done'}">${kL} of ${g.skill} left</span></h3><p class="small muted">New Skill Limit: no more than ${g.limit} in one Skill.</p>${SKILLS.map(stepper).join('')}` : ''}
      <h3>4. Moves <span class="pill">${moves.length} of ${moveMax()} known</span></h3>
      <p class="small muted">You can know Insight + 2 moves. ${newMoves.length ? `New at ${esc(lu.to)}: <b>${newMoves.map(esc).join(', ')}</b>.` : ''} Tick the ones ${esc(c.nickname)} knows.</p>
      ${allMoves.length ? `<div class="lu-moves">${allMoves.map((m) => `<label class="check ${newMoves.includes(m) ? 'lu-new' : ''}"><input type="checkbox" value="${esc(m)}" ${moves.includes(m) ? 'checked' : ''}> ${esc(m)}${newMoves.includes(m) ? ' ✨' : ''}</label>`).join('')}</div>` : '<p class="small">Your species’ move list isn’t in the Pokédex yet. Ask your GM which moves you can learn.</p>'}
      ${g.notes.map((n) => `<p class="win tight small">${esc(n)}</p>`).join('')}
      <button class="btn block" id="lusave" style="margin-top:12px">💾 Save my level up</button>
      <button class="btn alt block" id="lulater" style="margin-top:6px">Finish later</button>`;
    $$('[data-up]', el).forEach((b) => b.onclick = () => { const k = b.dataset.up; const pool = ATTRS.includes(k) ? [ATTRS, g.attr] : SOCIAL.includes(k) ? [SOCIAL, g.social] : [SKILLS, g.skill];
      if (left(...pool) <= 0) return toast('No points left there'); if (num(c[k]) + add[k] >= cap(k)) return toast(`${k} is at its limit`); add[k]++; draw(); });
    $$('[data-dn]', el).forEach((b) => b.onclick = () => { const k = b.dataset.dn; if (add[k] > 0) { add[k]--; draw(); } });
    $$('.lu-moves input', el).forEach((b) => b.onchange = () => {
      if (b.checked && !moves.includes(b.value) && moves.length >= moveMax()) { b.checked = false; return toast(`You can know ${moveMax()} moves. Untick one first.`); }
      moves = b.checked ? [...new Set([...moves, b.value])] : moves.filter((m) => m !== b.value); draw();
    });
    $('#lulater', el).onclick = () => closeModal();
    $('#lusave', el).onclick = () => {
      const unspent = left(ATTRS, g.attr) + left(SOCIAL, g.social) + left(SKILLS, g.skill);
      if (unspent && !confirm(`You still have ${unspent} point${unspent === 1 ? '' : 's'} to spend. Save anyway? (You won't be able to come back to them here.)`)) return;
      const cur = store.get('party/' + c.id) || c; const changed = [];
      for (const k of Object.keys(add)) if (add[k]) { store.set(`party/${c.id}/${k}`, num(cur[k]) + add[k]); changed.push(`${k} +${add[k]}`); }
      store.set(`party/${c.id}/moves`, moves);
      store.set(`party/${c.id}/levelUp`, null);
      store.pushLimited('log', { t: Date.now(), text: `⭐ ${c.nickname} leveled up to ${lu.to}${changed.length ? `: ${changed.join(', ')}` : ''}. Moves: ${moves.join(', ') || 'none'}.` });
      closeModal(); toast('Level up saved! 🎉');
    };
  };
  draw();
}

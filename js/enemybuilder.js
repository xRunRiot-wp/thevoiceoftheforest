// her ask 11-07: the GM's enemy builder and enemy battle board.
// Builder: pick an area (habitat tiles) -> tick the Pokémon you want (several at once, with how many) -> pick their rank
// -> stats, skills, HP, Will and moves are rolled for each one -> save them as enemy sheets (and drop them into the battle).
// Board: every enemy in the current battle gets its own card with HP and Will +/- and quick rolls for its moves and actions.
// Rolls follow PokéRole's rank steps roughly; the GM can change anything afterwards in the sheet editor.
import * as store from './store.js?v=6af0e855';
import { $, $$, esc, num, uid, clamp, pool, toast } from './util.js?v=6af0e855';
import { modal, closeModal, portrait, diceFaces } from './ui.js?v=6af0e855';
import { loadIndex, find } from './effects.js?v=6af0e855';
import { RANK_NAMES } from './content.js?v=6af0e855';
import { HABITATS } from './habitats.js?v=6af0e855';
import { logRoll } from './play.js?v=6af0e855';

const ATTRS = ['Strength', 'Dexterity', 'Vitality', 'Special', 'Insight'];
const SKILLS = ['Alert', 'Brawl', 'Channel', 'Evasion', 'Clash'];
// per rank: extra attribute points, skill points, highest skill, highest move tier
const RANK_STEP = { Starter: [0, 4, 1, 1], Beginner: [2, 6, 2, 2], Amateur: [4, 8, 3, 3], Ace: [6, 10, 4, 4], Pro: [8, 12, 5, 5], Master: [10, 14, 5, 5], Champion: [14, 16, 5, 5] };
const TIERS = ['Starter', 'Beginner', 'Amateur', 'Ace', 'Pro'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// one rolled enemy from its Index species entry
export function rollEnemy(sp, rank, ix, name) {
  const [extra, skillPts, skillCap, tierCap] = RANK_STEP[rank] || RANK_STEP.Beginner;
  const lim = {}; const a = {};
  for (const m of String(sp.roll || '').matchAll(/(Str|Dex|Vit|Spe|Ins)\s+(\d+)\/(\d+)/g)) {
    const k = ATTRS.find((x) => x.startsWith(m[1])); a[k] = num(m[2], 1); lim[k] = num(m[3], 5);
  }
  ATTRS.forEach((k) => { a[k] ??= 1; lim[k] ??= 5; });
  for (let i = 0, guard = 0; i < extra && guard < 200; guard++) { const k = pick(ATTRS); if (a[k] < lim[k]) { a[k]++; i++; } }
  const s = Object.fromEntries(SKILLS.map((k) => [k, 0]));
  for (let i = 0, guard = 0; i < skillPts && guard < 200; guard++) { const k = pick(SKILLS); if (s[k] < skillCap) { s[k]++; i++; } }
  const baseHp = num((String(sp.outcome || '').match(/Base HP (\d+)/) || [])[1], 3);
  // moves it could know by this rank, as many as Insight + 2
  const learn = String(sp.learn || '').split('|').map((x) => x.trim());
  const known = learn.filter((x) => TIERS.indexOf(x.split(':')[0].trim()) < Math.min(tierCap, TIERS.length) && TIERS.indexOf(x.split(':')[0].trim()) >= 0)
    .flatMap((x) => x.split(':').slice(1).join(':').split(',').map((n) => n.trim()).filter(Boolean));
  const moves = []; const pool2 = [...new Set(known)];
  while (pool2.length && moves.length < a.Insight + 2) { const n = pool2.splice(Math.floor(Math.random() * pool2.length), 1)[0]; const mv = find(ix, n); if (mv?.mv) moves.push({ name: mv.name, ...mv.mv }); }
  const type = (String(sp.outcome || '').match(/\.\s*([A-Za-z/]+) type/) || [])[1] || '';
  return {
    name, species: sp.name, rank, type, hp: baseHp + a.Vitality, def: a.Vitality, sdef: a.Insight, will: a.Insight + 2, ...a, ...s,
    mv: moves, moves: moves.map((m) => `${m.name} (${m.type} ${m.cat}): ${m.acc.join(' + ')}, ${m.dmg ? `${m.dmg} + ` : ''}Power ${m.power}${m.effect ? `. ${m.effect}` : ''}`).join('\n'),
  };
}

// ---- the builder (a pop-up from the GM's Battle section)
const B = { area: null, picks: {}, rank: 'Beginner', q: '', rolled: [] };
export async function openEnemyBuilder() {
  const ix = await loadIndex();
  const el = modal('<div id="ebw"></div>');
  const box = $('#ebw', el);
  const draw = () => {
    if (B.rolled.length) {
      box.innerHTML = `<h2>🎲 Rolled enemies</h2><p class="small muted">Rank ${esc(B.rank)}. Tap 🎲 on one to roll it again. Saving makes enemy sheets you can edit, fight and move to Recruit.</p>
        <div class="eb-rolled">${B.rolled.map((e, i) => `<div class="eb-card">${portrait({ pokemon: e.species, nickname: e.name }, 'sm')}<div class="grow"><b>${esc(e.name)}</b> <span class="small muted">${esc(e.type)} · ${esc(e.rank)}</span>
          <div class="small">❤️ ${e.hp} HP · 🔥 Will ${e.will} · Def ${e.def} / Sp.Def ${e.sdef}</div>
          <div class="small">${['Strength', 'Dexterity', 'Vitality', 'Special', 'Insight'].map((k) => `${k.slice(0, 3)} ${e[k]}`).join(' · ')}</div>
          <div class="small muted">${SKILLS.filter((k) => e[k]).map((k) => `${k} ${e[k]}`).join(' · ') || 'No skills'}</div>
          <div class="small">${e.mv.map((m) => `<span class="pill">${esc(m.name)}</span>`).join(' ') || '<span class="muted">No moves found</span>'}</div></div>
          <button class="btn alt sm" data-ebre="${i}" title="Roll again">🎲</button></div>`).join('')}</div>
        <label class="check" style="margin-top:8px"><input type="checkbox" id="ebstory"> 📖 Save them in the Story folder</label>
        <div class="row" style="margin-top:10px"><button class="btn" id="ebsave">💾 Save sheets</button><button class="btn alt" id="ebfight">⚔️ Save and add to the battle</button><button class="btn alt" id="ebback">← Back</button></div>`;
      $$('[data-ebre]', box).forEach((b) => b.onclick = () => { const e = B.rolled[+b.dataset.ebre]; B.rolled[+b.dataset.ebre] = rollEnemy(find(ix, e.species), B.rank, ix, e.name); draw(); });
      const save = (fight) => {
        const story = $('#ebstory', box).checked;
        const ids = B.rolled.map((e) => { const id = uid(); if (story) e.story = true; store.gmUpdate('enemies', (all) => ({ ...(all || {}), [id]: e })); return [id, e]; });
        if (fight) ids.forEach(([id, e]) => addToBattle(id, e));
        toast(`${ids.length} enemy sheet${ids.length === 1 ? '' : 's'} saved${fight ? ' and added to the battle (hidden until you reveal them)' : ''}`);
        Object.assign(B, { picks: {}, rolled: [] }); closeModal();
      };
      $('#ebsave', box).onclick = () => save(false); $('#ebfight', box).onclick = () => save(true);
      $('#ebback', box).onclick = () => { B.rolled = []; draw(); };
      return;
    }
    if (B.area == null) {
      box.innerHTML = `<h2>🌿 Enemy builder</h2><p class="small muted">Pick the area the team is exploring.</p>
        <div class="eb-areas">${HABITATS.map(([t, ic, mons], i) => `<button class="eb-area" data-eba="${i}"><span>${ic}</span><b>${esc(t)}</b><small>${mons.length} Pokémon</small></button>`).join('')}</div>
        <p class="small muted" style="margin-top:8px">Habitat lists from The World of Pokémon (theworldofpokemon.com).</p>`;
      $$('[data-eba]', box).forEach((b) => b.onclick = () => { B.area = +b.dataset.eba; B.q = ''; draw(); });
      return;
    }
    const [title, ic, mons] = HABITATS[B.area]; const q = B.q.toLowerCase();
    const count = Object.values(B.picks).reduce((s, n) => s + n, 0);
    box.innerHTML = `<h2>${ic} ${esc(title)}</h2>
      <div class="row nowrap"><input id="ebq" type="search" placeholder="🔍 Find a Pokémon…" value="${esc(B.q)}"><button class="btn alt sm" id="ebareas">← Areas</button></div>
      <p class="small muted">Tap to add one, tap again for more. Hold the − to take one off.</p>
      <div class="eb-mons">${mons.filter((m) => !q || m.toLowerCase().includes(q)).map((m) => `<button class="eb-mon ${B.picks[m] ? 'on' : ''}" data-ebm="${esc(m)}">${portrait({ pokemon: m, nickname: m }, 'xs')}<span>${esc(m)}</span>${B.picks[m] ? `<b class="eb-n">×${B.picks[m]}</b><span class="eb-minus" data-ebminus="${esc(m)}">−</span>` : ''}</button>`).join('')}</div>
      <div class="eb-foot"><label class="f">Their rank<select id="ebrank">${RANK_NAMES.map((r) => `<option ${r === B.rank ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <button class="btn" id="ebroll" ${count ? '' : 'disabled'}>🎲 Roll ${count || ''} ${count === 1 ? 'enemy' : 'enemies'}</button></div>`;
    $('#ebareas', box).onclick = () => { B.area = null; draw(); };
    const qi = $('#ebq', box); qi.oninput = () => { B.q = qi.value; const pos = qi.selectionStart; draw(); const n = $('#ebq', box); n.focus(); n.setSelectionRange(pos, pos); };
    $$('[data-ebm]', box).forEach((b) => b.onclick = (ev) => {
      const m = b.dataset.ebm;
      if (ev.target.closest('[data-ebminus]')) B.picks[m] = Math.max(0, (B.picks[m] || 0) - 1); else B.picks[m] = Math.min(12, (B.picks[m] || 0) + 1);
      if (!B.picks[m]) delete B.picks[m]; draw();
    });
    $('#ebrank', box).onchange = (e) => { B.rank = e.target.value; };
    $('#ebroll', box).onclick = () => {
      B.rolled = Object.entries(B.picks).flatMap(([m, n]) => { const sp = find(ix, m); if (!sp) return [];
        return Array.from({ length: n }, (_, i) => rollEnemy(sp, B.rank, ix, n > 1 ? `Wild ${m} ${String.fromCharCode(65 + i)}` : `Wild ${m}`)); });
      draw();
    };
  };
  draw();
}

// an enemy sheet joins the battle with everything the board needs
export function addToBattle(id, e) {
  store.set('combat/list/' + uid(), { name: e.name, kind: 'enemy', hp: num(e.hp, 1), maxHp: num(e.hp, 1), will: num(e.will, 0), maxWill: num(e.will, 0), def: e.def, sdef: e.sdef,
    Dexterity: e.Dexterity, Alert: e.Alert, init: null, status: [], revealed: false, enemy: id });
}

// ---- the enemy battle board (GM only): one card per enemy in the battle
export function enemyBoardHTML() {
  const list = Object.entries((store.get('combat') || {}).list || {}).filter(([, x]) => x?.kind === 'enemy');
  if (!list.length) return '';
  const sheets = store.gmData()?.enemies || {};
  return `<div class="eboard"><h3>👾 Enemies in this battle</h3><div class="eb-grid">${list.map(([cid, x]) => { const e = sheets[x.enemy] || {};
    const hpPct = Math.round(100 * num(x.hp) / Math.max(1, num(x.maxHp, 1))); const wPct = Math.round(100 * num(x.will) / Math.max(1, num(x.maxWill, 1)));
    return `<div class="eb-fight ${num(x.hp) <= 0 ? 'down' : ''}">
      <div class="row nowrap">${portrait({ pokemon: e.species || x.name, nickname: x.name }, 'sm')}<div class="grow"><b>${esc(x.name)}</b><div class="small muted">${esc(e.rank || '')}${x.revealed ? ' · 👁️ shown' : ' · hidden'}${(x.status || []).length ? ' · ' + x.status.map(esc).join(', ') : ''}</div></div></div>
      <div class="eb-bar"><span>❤️ ${num(x.hp)}/${num(x.maxHp)}</span><div class="n-bar"><i style="width:${hpPct}%"></i></div><button class="btn alt sm" data-ebhp="${cid}|-1">−</button><button class="btn alt sm" data-ebhp="${cid}|1">+</button></div>
      ${x.maxWill ? `<div class="eb-bar will"><span>🔥 Will ${num(x.will)}/${num(x.maxWill)}</span><div class="n-bar"><i style="width:${wPct}%"></i></div><button class="btn alt sm" data-ebwill="${cid}|-1">−</button><button class="btn alt sm" data-ebwill="${cid}|1">+</button></div>` : ''}
      <div class="eb-acts">${(e.mv || []).map((m, i) => `<button class="btn sm" data-ebmove="${cid}|${i}" title="${esc(m.effect || '')}">${esc(m.name)}</button>`).join('')}
        <button class="btn alt sm" data-ebact="${cid}|Evade">💨 Evade</button><button class="btn alt sm" data-ebact="${cid}|Clash">🛡️ Clash</button><button class="btn alt sm" data-ebact="${cid}|Alert">👀 Notice</button></div>
      <div class="eb-res" id="ebres-${cid}"></div></div>`; }).join('')}</div></div>`;
}
export function bindEnemyBoard(main) {
  const list = () => (store.get('combat') || {}).list || {};
  const sheet = (cid) => (store.gmData()?.enemies || {})[list()[cid]?.enemy] || {};
  const show = (cid, title, r, extra = '') => { const el = $(`#ebres-${CSS.escape(cid)}`, main); if (el) el.innerHTML = `${diceFaces(r.dice)}<div><b>${esc(title)}:</b> ${r.succ} success${r.succ === 1 ? '' : 'es'}${extra}</div>`; };
  $$('[data-ebhp]', main).forEach((b) => b.onclick = () => { const [cid, d] = b.dataset.ebhp.split('|'); const x = list()[cid]; if (x) store.set(`combat/list/${cid}/hp`, clamp(num(x.hp) + num(d), 0, num(x.maxHp, 99))); });
  $$('[data-ebwill]', main).forEach((b) => b.onclick = () => { const [cid, d] = b.dataset.ebwill.split('|'); const x = list()[cid]; if (x) store.set(`combat/list/${cid}/will`, clamp(num(x.will) + num(d), 0, num(x.maxWill, 99))); });
  $$('[data-ebmove]', main).forEach((b) => b.onclick = () => {
    const [cid, i] = b.dataset.ebmove.split('|'); const e = sheet(cid); const m = (e.mv || [])[+i]; if (!m) return;
    const acc = pool(Math.max(1, m.acc.reduce((s, k) => s + num(e[k]), 0)));
    const dmg = m.power ? pool(Math.max(1, num(e[m.dmg]) + num(m.power))) : null;
    show(cid, `${m.name} to hit`, acc, dmg ? ` · damage roll: ${dmg.succ} success${dmg.succ === 1 ? '' : 'es'}${m.effect ? `. ${esc(m.effect)}` : ''}` : (m.effect ? `. ${esc(m.effect)}` : ''));
    if (list()[cid]?.revealed) logRoll(list()[cid].name, m.name, acc.dice, `${acc.succ} to hit${dmg ? `, ${dmg.succ} damage` : ''}`);
  });
  $$('[data-ebact]', main).forEach((b) => b.onclick = () => {
    const [cid, k] = b.dataset.ebact.split('|'); const e = sheet(cid);
    const parts = { Evade: ['Dexterity', 'Evasion'], Clash: ['Strength', 'Clash'], Alert: ['Insight', 'Alert'] }[k];
    const r = pool(Math.max(1, parts.reduce((s, p) => s + num(e[p]), 0)));
    show(cid, { Evade: 'Evade', Clash: 'Clash', Alert: 'Notice' }[k], r, ` (${parts.join(' + ')})`);
  });
}

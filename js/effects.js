// The Index: every effect and interaction in the game, searchable, linked from everywhere.
import * as store from './store.js?v=6ae391e9';
import * as sheet from './sheetdata.js?v=6ae391e9';
import { esc, slug, pool, $, $$ } from './util.js?v=6ae391e9';
import { modal, diceFaces } from './ui.js?v=6ae391e9';
import { merged, editContent } from './content-store.js?v=6ae391e9';
import { ATTRS, SKILLS, SOCIAL } from './content.js?v=6ae391e9';

export const INDEX_SCHEMA = [['name', 'Name'], ['kind', 'Kind'], ['aka', 'Also called', 'list'], ['trigger', 'When it happens', 'area'], ['roll', 'Roll', 'area'],
  ['outcome', 'What it does', 'area'], ['duration', 'How long', 'area'], ['removal', 'How it ends / is removed', 'area'], ['links', 'Related entries', 'list'], ['source', 'Source']];

let base = null;
function loadBase() {
  return (base ||= (async () => {
    const [core, moves, abil, treasure] = await Promise.all([
      fetch('data/index.json').then((r) => r.json()),
      sheet.moves().catch(() => []), sheet.abilities().catch(() => []), sheet.treasure().catch(() => []),
    ]);
    const names = new Set(core.map((e) => e.name.toLowerCase()));
    const src = (t) => `Campaign spreadsheet (${t} tab)`;
    const out = [...core];
    sheetMoves = moves;
    for (const a of abil) {
      if (names.has(a.name.toLowerCase())) continue; names.add(a.name.toLowerCase());
      out.push({ id: 'ability-' + slug(a.name), name: a.name, kind: 'Ability', aka: [], trigger: a.desc, outcome: a.effect || a.desc, links: [], source: src('Abilities') });
    }
    for (const t of treasure) {
      if (names.has(t.name.toLowerCase())) continue; names.add(t.name.toLowerCase());
      out.push({ id: 'item-' + slug(t.name), name: t.name, kind: 'Item', aka: [t.kind.toLowerCase()], outcome: `${t.kind} · ${t.rarity} · ${t.price}. The GM can add the exact effect.`, links: [], source: src('Treasure Inventory') });
    }
    return out;
  })());
}

let sheetMoves = [];
const moveEntry = (m) => ({ id: 'move-' + slug(m.name), name: m.name, kind: 'Move', aka: [], type: m.type, cat: m.cat,
  roll: `Accuracy: ${(m.acc || []).join(' + ') || '—'}.${m.power != null ? ` Damage: ${m.cat === 'Special' ? 'Special' : 'Strength'} + Power ${m.power}.` : ''}`,
  outcome: `${m.type || ''} · ${m.cat || ''}${m.power != null ? ' · Power ' + m.power : ''}. ${m.effect || 'No added effect.'}`, links: [],
  source: m.edited ? 'Campaign spreadsheet (Moves tab), edited by the GM' : 'Campaign spreadsheet (Moves tab)' });

let cache = null; let cacheKey = '';
export async function loadIndex() {
  const b = await loadBase();
  const key = JSON.stringify([store.get('content/index') || {}, store.get('content/moves') || {}]);
  if (cache && key === cacheKey) return cache;
  const have = new Set(b.map((e) => e.name.toLowerCase()));
  const moves = merged('moves', sheetMoves, (m) => m.name.toLowerCase()).filter((m) => !have.has(m.name.toLowerCase())).map(moveEntry);
  const list = merged('index', [...b, ...moves]).sort((x, y) => x.name.localeCompare(y.name));
  const byName = new Map(); const byId = new Map();
  for (const e of list) {
    byId.set(e.id, e);
    byName.set(e.name.toLowerCase(), e);
    (e.aka || []).forEach((a) => { if (!byName.has(a.toLowerCase())) byName.set(a.toLowerCase(), e); });
  }
  // Prose names (case-insensitive) and move/ability names (exact case only, so "charm" in a sentence stays plain).
  const esc_ = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prose = list.filter((e) => !['Move', 'Ability', 'Item', 'Species', 'Nature'].includes(e.kind) && e.name.length > 3).map((e) => e.name).sort((a, b) => b.length - a.length);
  const exact = list.filter((e) => ['Move', 'Ability', 'Item', 'Species', 'Nature'].includes(e.kind) && e.name.length > 3 && (e.name.includes(' ') || !['Move', 'Ability'].includes(e.kind))).map((e) => e.name).sort((a, b) => b.length - a.length);
  cache = { list, byName, byId,
    reProse: prose.length ? new RegExp(`\\b(${prose.map(esc_).join('|')})\\b`, 'gi') : null,
    reExact: exact.length ? new RegExp(`\\b(${exact.map(esc_).join('|')})\\b`, 'g') : null };
  cacheKey = key;
  return cache;
}

export function find(ix, name) { return ix.byId.get(name) || ix.byName.get(String(name).toLowerCase()) || null; }

// Turn known names inside plain text into tappable links (first mention of each name only).
export function linkify(text, ix, self = '') {
  let html = esc(text || '');
  if (!ix) return html;
  const used = new Set([self.toLowerCase()]);
  const sub = (re) => { if (re) html = html.replace(re, (m) => { const k = m.toLowerCase(); if (used.has(k)) return m; const e = find(ix, m); if (!e) return m; used.add(k); return `<a class="ix" href="#" data-ix="${esc(e.id)}">${m}</a>`; }); };
  // Avoid replacing inside tags we've already made: run exact first on raw text, prose second skipping anchors.
  sub(ix.reExact);
  if (ix.reProse) {
    html = html.split(/(<a [^>]*>.*?<\/a>)/g).map((part) => (part.startsWith('<a ') ? part : part.replace(ix.reProse, (m) => {
      const k = m.toLowerCase(); if (used.has(k)) return m; const e = find(ix, m); if (!e) return m; used.add(k); return `<a class="ix" href="#" data-ix="${esc(e.id)}">${m}</a>`;
    }))).join('');
  }
  return html;
}

// A tappable name that opens its entry (used on sheets, moves, the tracker).
export const ixLink = (name, label = name) => `<a class="ix" href="#" data-ixname="${esc(name)}">${esc(label)}</a>`;

const STATWORDS = [...ATTRS, ...SKILLS, ...SOCIAL, 'Smart', 'Logic', 'Instinct', 'Will'];
export function rollChains(text) {
  const re = new RegExp(`\\b(${STATWORDS.join('|')})(\\s*\\+\\s*(${STATWORDS.join('|')}))*`, 'g');
  const out = [];
  for (const m of String(text || '').matchAll(re)) {
    const parts = m[0].split('+').map((s) => s.trim());
    const key = parts.join(' + ');
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

let getMe = () => null; let statOf = () => 0; let onRolled = () => {};
export function wireRolls(me, stat, logFn) { getMe = me; statOf = stat; onRolled = logFn; }

export async function openEntry(idOrName, { gm = false } = {}) {
  const ix = await loadIndex();
  const e = find(ix, idOrName);
  if (!e) { modal(`<h2>${esc(idOrName)}</h2><p class="muted">Not in the Index yet.${gm ? '' : ' Ask your GM to add it.'}</p>${gm ? '<button class="btn" id="ix-add">Add it</button>' : ''}`, (el) => { const b = $('#ix-add', el); if (b) b.onclick = () => editContent('index', INDEX_SCHEMA, null, { title: 'New Index entry' }); }); return; }
  const me = getMe();
  const chains = me ? [...new Set([...rollChains(e.roll), ...(STATWORDS.includes(e.name) ? [e.name] : [])])] : [];
  const row = (label, v) => (v ? `<h4 style="margin:10px 0 2px">${label}</h4><p style="margin:0">${linkify(v, ix, e.name)}</p>` : '');
  const el = modal(`<h2>${esc(e.name)}</h2>
    <div class="chips"><span class="pill">${esc(e.kind || '')}</span>${(e.aka || []).map((a) => `<span class="pill" style="opacity:.75">${esc(a)}</span>`).join('')}</div>
    ${row('What it does', e.outcome)}${row('When it happens', e.trigger)}${row('Roll', e.roll)}${row('How long', e.duration)}${row('How it ends / is removed', e.removal)}${e.evo ? row('Evolution', e.evo) : ''}${e.learn ? `<h4 style="margin:10px 0 2px">Moves by rank</h4>${e.learn.split(' | ').map((l) => { const [r, ms] = l.split(': '); return `<p class="small" style="margin:0 0 4px"><b>${esc(r)}:</b> ${(ms || '').split(', ').map((m) => (ix.byName.get(m.toLowerCase()) ? `<a href="#" class="ix" data-ixname="${esc(m)}">${esc(m)}</a>` : esc(m))).join(', ')}</p>`; }).join('')}` : ''}
    ${chains.length ? `<div class="row" style="margin-top:12px">${chains.map((c, i) => `<button class="btn" data-chain="${i}">Roll ${esc(c)}</button>`).join('')}</div><div class="result" id="ix-res"></div>` : ''}
    ${(e.links || []).length ? `<h4 style="margin:12px 0 4px">Related</h4><div class="chips">${e.links.map((l) => `<a class="chip ix" href="#" data-ixname="${esc(l)}">${esc(l)}</a>`).join('')}</div>` : ''}
    <p class="small muted" style="margin-top:12px">Source: ${esc(e.source || '—')}${e.edited ? ' · edited by the GM' : ''}</p>
    ${gm ? '<div class="row"><button class="btn alt sm" id="ix-edit">Edit entry</button><button class="btn alt sm" id="ix-new">New entry</button></div>' : ''}`);
  $$('[data-chain]', el).forEach((b) => b.onclick = () => {
    const parts = chains[+b.dataset.chain].split(' + ');
    const dice = Math.max(1, parts.reduce((s, p) => s + statOf(me, p), 0));
    const r = pool(dice);
    const text = `${r.succ} success${r.succ === 1 ? '' : 'es'}`;
    $('#ix-res', el).innerHTML = `${diceFaces(r.dice)}<div class="big">${text}</div>`;
    onRolled(me.nickname, `${e.name}: ${parts.join(' + ')}`, r.dice, text);
  });
  if (gm) {
    $('#ix-edit', el).onclick = () => editContent('index', INDEX_SCHEMA, e, { title: 'Edit ' + e.name });
    $('#ix-new', el).onclick = () => editContent('index', INDEX_SCHEMA, null, { title: 'New Index entry' });
  }
}

// One click handler for every [data-ix] / [data-ixname] on the page.
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('[data-ix],[data-ixname]');
  if (!a) return;
  ev.preventDefault(); ev.stopPropagation();
  openEntry(a.dataset.ix || a.dataset.ixname, { gm: store.gmUnlocked() });
});

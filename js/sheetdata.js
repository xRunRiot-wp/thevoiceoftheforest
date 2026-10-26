// Reads the GM's campaign spreadsheet. Live from Google Sheets when it is shared publicly;
// otherwise falls back to the snapshot in /data (refreshed by the sync script).
import { parseCSV, num } from './util.js?v=6adebfc5';

const SHEET_ID = '1GK62Zcn61JNy0vdmDKp15SusSsJ0R2jaSuf_d5vJPoQ';
export const TABS = { guild: '311637711', treasure: '1974854103', moves: '2096688911', abilities: '1595332622' };

const cache = {};
export const source = {};   // tab -> 'live' | 'snapshot'

async function fetchTab(key) {
  const gid = TABS[key];
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`, { cache: 'no-store' });
    const t = await r.text();
    if (!r.ok || t.trimStart().startsWith('<')) throw new Error('not public');
    source[key] = 'live';
    return parseCSV(t);
  } catch {
    const r = await fetch(`data/sheet_${gid}.csv`);
    source[key] = 'snapshot';
    return parseCSV(await r.text());
  }
}
const tab = (key) => (cache[key] ||= fetchTab(key));

// ---- Guild tab: party characters + guild coffers
const COLS = ['nickname', 'nature', 'pokemon', 'logic', 'instinct', 'rank', 'instinctRank', 'type1', 'type2', 'ability', 'baseHp', 'will', 'primal', 'humanity',
  'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'Strength', 'Dexterity', 'Vitality', 'Special', 'Insight',
  'Brawl', 'Channel', 'Clash', 'Evasion', 'Alert', 'Athletic', 'Nature', 'Stealth', 'Allure', 'Etiquette', 'Intimidate', 'Perform',
  'Tough', 'Cool', 'Beauty', 'Cute', 'Clever'];
const NUMERIC = new Set(['logic', 'instinct', 'baseHp', 'will', 'primal', 'humanity', 'Strength', 'Dexterity', 'Vitality', 'Special', 'Insight',
  'Brawl', 'Channel', 'Clash', 'Evasion', 'Alert', 'Athletic', 'Nature', 'Stealth', 'Allure', 'Etiquette', 'Intimidate', 'Perform', 'Tough', 'Cool', 'Beauty', 'Cute', 'Clever']);

export async function guild() {
  const rows = await tab('guild');
  let coffers = null;
  for (const r of rows) {
    const i = r.findIndex((c) => /Guild Coffers/i.test(c));
    if (i >= 0) { coffers = num(r[i + 1], null); break; }
  }
  const h = rows.findIndex((r) => /^Nic?k?h?name/i.test(r[0] || ''));
  const chars = [];
  if (h >= 0) {
    for (const r of rows.slice(h + 1)) {
      if (!r[0] || !r[2]) continue;
      const c = {};
      COLS.forEach((k, i) => { c[k] = NUMERIC.has(k) ? num(r[i], 0) : (r[i] || '').trim(); });
      c.moves = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].map((k) => c[k]).filter(Boolean);
      COLS.slice(14, 20).forEach((k) => delete c[k]);
      chars.push(c);
    }
  }
  return { coffers, chars };
}

// ---- Moves tab
export async function moves() {
  const rows = await tab('moves');
  const out = [];
  for (const r of rows) {
    const [, , name, type, cat, acc1, acc2, power, effect] = r;
    if (!name || !cat || !/Physical|Special|Status/i.test(cat)) continue;
    out.push({
      name: name.trim(), type: (type || '').trim(),
      cat: /Physical/i.test(cat) ? 'Physical' : /Special/i.test(cat) ? 'Special' : 'Status',
      acc: [acc1, acc2].map((s) => (s || '').trim()).filter((s) => s && s !== '-'),
      power: /^\d+$/.test((power || '').trim()) ? +power : null,
      effect: (effect || '').trim().replace(/^-$/, ''),
    });
  }
  return out;
}

// ---- Abilities tab
export async function abilities() {
  const rows = await tab('abilities');
  const out = [];
  for (const [name, desc, effect] of rows) {
    if (!name || !desc || /Type Ability Name/i.test(name)) continue;
    out.push({ name: name.trim(), desc: desc.trim(), effect: (effect || '').trim() });
  }
  return out;
}

// ---- Treasure Inventory tab: any "name, rarity, price" triple
const RARITY = /^(Mundane|Common|Uncommon|Rare|Very Rare)/i;
export async function treasure() {
  const rows = await tab('treasure');
  const seen = new Set(); const out = [];
  for (const r of rows) {
    for (let i = 0; i < r.length - 2; i++) {
      const name = (r[i] || '').trim();
      if (name && RARITY.test(r[i + 1] || '') && /Pok/i.test(r[i + 2] || '') && !seen.has(name)) {
        seen.add(name);
        const kind = /Orb$/.test(name) ? 'Orb' : /Band$/.test(name) ? 'Band' : /Scarf$/.test(name) ? 'Scarf' : /Bow$/.test(name) ? 'Bow' : /Ribbon$/.test(name) ? 'Ribbon' : 'Held item';
        out.push({ name, rarity: r[i + 1].trim(), price: r[i + 2].trim(), kind });
      }
    }
  }
  return out;
}

export function moveIndex(list) {
  const m = new Map(); list.forEach((x) => m.set(x.name.toLowerCase(), x)); return m;
}

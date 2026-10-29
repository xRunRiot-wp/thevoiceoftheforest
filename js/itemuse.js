// Using a bag item from the top bar's pins (her ask 10-27): shows what the item does (from the Index) and, on Use,
// applies the clear-cut benefits itself (healing HP, curing status, restoring Will) and takes one out of the bag.
// Anything that needs a roll or a target (seeds thrown at foes, food for Hunger) is used up and logged for the GM.
import * as store from './store.js?v=6ae39b40';
import { esc, num, toast } from './util.js?v=6ae39b40';
import { maxHp } from './ui.js?v=6ae39b40';
import { loadIndex, find } from './effects.js?v=6ae39b40';
import { logRoll } from './play.js?v=6ae39b40';

const CURES = [[/heals? poison/i, ['Poison', 'Badly Poisoned']], [/heals? paralysis/i, ['Paralysis']], [/heals? sleep/i, ['Sleep']], [/heals? burn/i, ['Burn']],
  [/heals? frozen/i, ['Frozen']], [/heals? confusion/i, ['Confused']], [/heals? infatuat/i, ['Infatuated']]];

export async function itemInfo(name) {
  const ix = await loadIndex().catch(() => null);
  return (ix && find(ix, name)?.outcome) || '';
}

// what Use will do for this character, worked out from the Index text
function effectOf(c, text) {
  const out = {}; const t = text || '';
  const mx = maxHp(c); const hp = num(c.hp ?? mx);
  if (/heals all hp/i.test(t)) out.hp = mx;
  else { const m = t.match(/heals (\d+) damage/i); if (m) out.hp = Math.min(mx, hp + num(m[1])); }
  const st = Array.isArray(c.status) ? c.status : [];
  let drop = [];
  if (/(heals|cures) all status/i.test(t)) drop = st.filter((s) => s !== 'Primal State');
  else CURES.forEach(([re, names]) => { if (re.test(t)) drop.push(...st.filter((s) => names.includes(s))); });
  if (out.hp && st.includes('Fainted')) drop.push('Fainted');
  if (drop.length) out.status = st.filter((s) => !drop.includes(s));
  if (/restores 1 spent will/i.test(t)) out.willCur = Math.min(num(c.will), num(c.willCur) + 1);
  const said = [out.hp != null && out.hp !== hp ? `HP ${hp} → ${out.hp}` : '', drop.length ? `cured ${drop.join(', ')}` : '', out.willCur != null && out.willCur !== num(c.willCur) ? `Will ${num(c.willCur)} → ${out.willCur}` : ''].filter(Boolean);
  return { out, said };
}

// a short preview line for the popup
export function usePreview(c, text) {
  const { said } = effectOf(c, text);
  return said.length ? `Use: ${said.join(' · ')}` : /heals|cures|restores/i.test(text || '') ? 'Nothing to heal right now.' : 'Your GM applies this one in play.';
}

export async function useBagItem(c, name) {
  const bag = Object.entries(store.get('bag') || {}).filter(([, b]) => b.name === name && (b.owner === c.id || b.owner === 'team'))
    .sort(([, a], [, b]) => (a.owner === 'team') - (b.owner === 'team'));
  if (!bag.length) { toast(`No ${name} left`); return false; }
  const [id, b] = bag[0];
  const text = await itemInfo(name);
  const fresh = (store.get('party') || {})[c.id] || c;
  const { out, said } = effectOf(fresh, text);
  if (Object.keys(out).length) store.update('party/' + c.id, (x) => ({ ...x, ...out }));
  if (num(b.qty) <= 1) store.set('bag/' + id, null); else store.set(`bag/${id}/qty`, num(b.qty) - 1);
  store.pushLimited('log', { t: Date.now(), text: `${c.nickname} used ${name}${said.length ? ` (${said.join(', ')})` : ''}.` });
  logRoll(c.nickname, `used ${name}`, null, said.join(' · '), 'note');
  toast(said.length ? `${name}: ${said.join(' · ')}` : `${name} used`);
  return true;
}

export const itemPopHTML = (c, name, qty, text) => `<div class="pm-head">📌 ${esc(name)}${qty > 1 ? ` <span class="muted">×${qty}</span>` : ''}</div>
  <p class="ip-text">${esc(text || 'No description in the Index yet.')}</p>
  <p class="ip-prev small">${esc(usePreview(c, text))}</p>
  <div class="ip-btns"><button class="btn sm" data-ipuse ${qty ? '' : 'disabled'}>Use one</button><button class="btn alt sm" data-ipix>More</button><button class="btn alt sm" data-ipunpin>Unpin</button></div>`;

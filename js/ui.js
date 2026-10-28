// Shared bits of UI: modal sheet, portraits, bars, dice faces.
import { esc } from './util.js?v=6ae15590';

const PORTRAITS = ['abra', 'swablu', 'aegislash', 'beedrill', 'castform', 'chandelure', 'cottonee', 'diglett', 'golett', 'hariyama', 'jangmoo', 'ludicolo', 'maushold', 'ralts', 'scolipede', 'tinkatink', 'beautifly', 'chatot', 'cleffa', 'ekans', 'gengar', 'groudon', 'kecleon', 'koffing', 'magnemite', 'medicham', 'mudkip', 'pikachu', 'riolu', 'skuntank', 'slakoth', 'sudowoodo', 'teddiursa', 'wigglytuff', 'wingull', 'zubat'];

export function portraitFile(species) {
  const k = String(species || '').toLowerCase().replace(/[^a-z]/g, '');
  return PORTRAITS.includes(k) ? `assets/portraits/${k}.png` : null;
}

// The GM's own character art (campaign site, Meet the Characters), by character name or species
// (the _centered copies are trimmed of empty space so the Pokémon sits in the middle of the frame)
const ART = { gemini: 'cast_gemini_centered.png', cleffa: 'cast_gemini_centered.png', slakoth: 'cast_slakoth_centered.png', magnemite: 'cast_magnemite.jpg', puff: 'cast_puff_centered.png', cottonee: 'cast_puff_centered.png',
  rox: 'cast_rox_centered.png', felicia: 'cast_felicia.jpg', rocky: 'cast_rocky.jpg', sudowoodo: 'cast_rocky.jpg', kippy: 'cast_mimi_kippy.jpg', mimikippy: 'cast_mimi_kippy.jpg', chid: 'cast_chid.jpg', golett: 'cast_chid.jpg' };
export function artFile(c) {
  for (const v of [c?.nickname, c?.name, c?.pokemon, c?.species]) { const k = String(v || '').toLowerCase().replace(/[^a-z]/g, ''); if (ART[k]) return 'assets/gs/' + ART[k]; }
  return null;
}

export function portrait(c, size = '') {
  const art = c?.art || artFile(c);
  if (art) return `<div class="portrait art ${size}"><img src="${esc(art)}" alt="${esc(c?.nickname || c?.name || '')}"></div>`;
  const f = c?.portrait ? `assets/portraits/${c.portrait}.png` : portraitFile(c?.pokemon || c?.species);
  const inner = f ? `<img src="${f}" alt="${esc(c?.pokemon || c?.species || '')}">` : `<div class="ph">${esc((c?.nickname || c?.name || '?')[0])}</div>`;
  return `<div class="portrait ${size}">${inner}</div>`;
}

export function typeChip(t) { return t ? `<span class="chip type ty-${esc(t)}">${esc(t)}</span>` : ''; }

export function bar(cur, max, cls = '') {
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  const lvl = cls ? cls : pct <= 25 ? 'low' : pct <= 50 ? 'mid' : '';
  return `<div class="bar ${lvl}"><i style="width:${pct}%"></i></div>`;
}

export function diceFaces(dice, { pool = true } = {}) {
  return `<span class="dice">${dice.map((d) => `<span class="d ${pool && d >= 4 ? 's' : ''} ${pool && d === 1 ? 'one' : ''} ${!pool && d === 6 ? 'six' : ''}">${d}</span>`).join('')}</span>`;
}

let modalClose = null;
export function modal(html, onMount) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="btn alt sm x" data-close>Close</button>${html}</div>`;
  bg.addEventListener('click', (e) => {
    if (!(e.target === bg || e.target.closest('[data-close]'))) return;
    closeModal();
    // a click on the top bar (hotbar, tabs, settings) behind the popup closes it AND does that thing, so the
    // first click on e.g. "Pin items in your Bag" works even while the welcome popup is still up
    if (e.target !== bg) return;
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('a, button');
    if (under && under.closest('.top')) under.click();
  });
  document.body.appendChild(bg);
  document.body.style.overflow = 'hidden';
  modalClose = () => { bg.remove(); document.body.style.overflow = ''; modalClose = null; window.dispatchEvent(new Event('modalclosed')); };
  onMount?.(bg.querySelector('.sheet'));
  return bg.querySelector('.sheet');
}
export function closeModal() { modalClose?.(); }

export function maxHp(c) { return (Number(c.baseHp) || 0) + (Number(c.Vitality) || 0); }

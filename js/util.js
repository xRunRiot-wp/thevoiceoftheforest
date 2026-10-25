// Small helpers shared by every page.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const uid = () => Math.random().toString(36).slice(2, 10);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const num = (v, d = 0) => { const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10); return Number.isFinite(n) ? n : d; };
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ---- dice
const rand = (n) => {
  const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] % n) + 1;
};
export const die = (sides) => rand(sides);
export const roll = (count, sides = 6) => Array.from({ length: Math.max(0, count) }, () => rand(sides));
export const sum = (a) => a.reduce((x, y) => x + y, 0);
export function rollExpr(n, sides, plus = 0) { const r = roll(n, sides); return { dice: r, total: sum(r) + plus }; }

// PokéRole pool: successes on 4+. House rule: every two 1s removes a success. Pain removes successes.
export function pool(dice, { pain = 0, ones = true } = {}) {
  const r = roll(dice);
  const raw = r.filter((d) => d >= 4).length;
  const onesN = r.filter((d) => d === 1).length;
  const onesPen = ones ? Math.floor(onesN / 2) : 0;
  const succ = Math.max(0, raw - pain - onesPen);
  return { dice: r, raw, onesPen, pain, succ };
}

export function painFor(hp, maxHp) {
  if (!maxHp) return 0;
  if (hp <= 1) return 2;
  if (hp <= maxHp / 2) return 1;
  return 0;
}

export function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function timeAgo(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}

export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

export function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

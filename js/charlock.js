// Character passwords (her ask): a simple word or number per character so nobody plays as someone else by an accidental tap.
// Not real security, like the GM passcode. Stored on the table at pins/<id>; a device that typed it once remembers it.
// The GM (unlocked) can open any character and see / change / remove every password on the GM page.
import * as store from './store.js?v=6ae166c0';
import { $, esc, toast } from './util.js?v=6ae166c0';
import { modal, closeModal } from './ui.js?v=6ae166c0';

const norm = (s) => String(s ?? '').trim().toLowerCase();
const key = (id) => `dc.pinok.${store.tableCode()}.${id}`;
export const pinOf = (id) => String(store.get('pins/' + id) || '');
const known = (id) => { try { return norm(localStorage.getItem(key(id))) === norm(pinOf(id)); } catch { return false; } };
const remember = (id, p) => { try { localStorage.setItem(key(id), p); } catch { /* ignore */ } };
const nameOf = (id) => (store.get('party') || {})[id]?.nickname || 'this character';

// may this device play as the character right now without asking?
export const charOpen = (id) => !id || store.gmUnlocked() || (!!pinOf(id) && known(id));

// run go() once this device may play as the character: asks for its password, or to pick one if it has none yet
export function unlockChar(id, go) {
  if (charOpen(id)) { if (pinOf(id)) remember(id, pinOf(id)); return go(); }
  if (!pinOf(id)) return setPin(id, go);
  const el = modal(`<h2>🔒 ${esc(nameOf(id))}</h2><p>Type ${esc(nameOf(id))}’s password to play as them.</p>
    <label class="f">Password<input id="pinin" autocomplete="off" autocapitalize="none" spellcheck="false"></label>
    <p class="small" id="pinbad" style="color:#b23a2a;font-weight:700" hidden>That’s not it. Ask your GM if you forgot it.</p>
    <button class="btn block" id="pingo" style="margin-top:8px">Unlock</button>`);
  const tryIt = () => {
    const p = $('#pinin', el).value;
    if (norm(p) !== norm(pinOf(id))) { $('#pinbad', el).hidden = false; $('#pinin', el).select(); return; }
    remember(id, pinOf(id)); closeModal(); go();
  };
  $('#pingo', el).onclick = tryIt;
  $('#pinin', el).onkeydown = (e) => { if (e.key === 'Enter') tryIt(); };
  setTimeout(() => $('#pinin', el)?.focus(), 50);
}

// pick (or, for the GM, change) a character's password
export function setPin(id, go, { later = false } = {}) {
  const el = modal(`<h2>🔒 Protect ${esc(nameOf(id))}</h2><p>Pick a simple password for ${esc(nameOf(id))} (a word or a few numbers), so nobody plays as them by an accidental tap.
    This device will remember it. Your GM can see it if you forget.</p>
    <label class="f">New password<input id="pinnew" autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(pinOf(id))}"></label>
    <p class="small muted">Not a bank vault: don’t reuse a real password.</p>
    <button class="btn block" id="pinsave" style="margin-top:8px">Save password</button>${later ? '<button class="btn alt block" id="pinlater" style="margin-top:8px">Later</button>' : ''}`);
  const save = () => {
    const p = $('#pinnew', el).value.trim();
    if (p.length < 2) { toast('At least 2 letters or numbers'); return; }
    store.set('pins/' + id, p); remember(id, p); closeModal(); toast(`Password saved for ${nameOf(id)}`); go?.();
  };
  $('#pinsave', el).onclick = save;
  $('#pinnew', el).onkeydown = (e) => { if (e.key === 'Enter') save(); };
  const l = $('#pinlater', el); if (l) l.onclick = () => closeModal();
  setTimeout(() => $('#pinnew', el)?.focus(), 50);
}

// players already playing a character with no password yet get asked once per page load (after any other popup closes)
let nagged = false;
export function askForPin(meId, waited = false) {
  if (nagged || !meId || pinOf(meId) || !(store.get('party') || {})[meId]) return;
  if (!waited) { setTimeout(() => askForPin(meId, true), 2500); return; }   // let the welcome popup open first
  if (document.querySelector('.sheet-bg')) { window.addEventListener('modalclosed', () => setTimeout(() => askForPin(meId, true), 300), { once: true }); return; }
  nagged = true; setPin(meId, null, { later: true });
}

// GM page: every character's password
export function gmPinsHTML() {
  const p = Object.values(store.get('party') || {}).filter((c) => !c.guest || c.guest.controller === 'player');
  return `<details class="gm-pins" style="margin-top:10px"><summary><b>🔒 Character passwords</b></summary>
    <p class="small muted">Players pick these the first time they play. You can open any character while the GM screen is unlocked.</p>
    ${p.map((c) => `<div class="row nowrap" style="padding:6px 0;border-bottom:1px dashed var(--cream3)"><b class="grow">${esc(c.nickname)}</b>
      <span class="pill">${pinOf(c.id) ? esc(pinOf(c.id)) : 'none yet'}</span><button class="btn alt sm" data-pinset="${esc(c.id)}">${pinOf(c.id) ? 'Change' : 'Set'}</button>${pinOf(c.id) ? `<button class="btn bad sm" data-pinclear="${esc(c.id)}">Remove</button>` : ''}</div>`).join('') || '<p class="small muted">No characters yet.</p>'}</details>`;
}
export function bindGmPins(root) {
  root.querySelectorAll('[data-pinset]').forEach((b) => b.onclick = () => setPin(b.dataset.pinset));
  root.querySelectorAll('[data-pinclear]').forEach((b) => b.onclick = () => { store.set('pins/' + b.dataset.pinclear, null); toast(`Password removed for ${nameOf(b.dataset.pinclear)}`); });
}

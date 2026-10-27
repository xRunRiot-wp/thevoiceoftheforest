// Table state: everything the table tracks (party, guild, missions, bag, combat, log).
// Saved on this device; when a Firebase Realtime Database URL is set in config.js the same
// tree is shared live with everyone at the table (REST + server-sent events, no SDK).
// GM-only data is encrypted with the GM passcode before it is stored anywhere.
import { CONFIG } from './config.js?v=6adffc18';
import { uid } from './util.js?v=6adffc18';

const LS = 'dc.table.';
const listeners = new Set();
let tree = {};
let code = '';
let remote = null;      // EventSource when shared
let gmKey = null;       // CryptoKey while the GM view is unlocked
let gm = null;          // decrypted GM data
export const status = { mode: 'local', connected: false, error: '' };

export const tableCode = () => code;
export const get = (path) => path.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), tree);
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

function setIn(obj, parts, value) {
  if (!parts.length) return value;
  const [k, ...rest] = parts;
  const base = obj && typeof obj === 'object' ? { ...obj } : {};
  const v = setIn(base[k], rest, value);
  if (v === null || v === undefined) delete base[k]; else base[k] = v;
  return base;
}

function persist() { try { localStorage.setItem(LS + code, JSON.stringify(tree)); } catch { /* storage full or blocked */ } }

const dbUrl = (path) => `${CONFIG.firebaseDbUrl.replace(/\/$/, '')}/tables/${encodeURIComponent(code)}${path ? '/' + path : ''}.json`;

export function set(path, value) {
  tree = setIn(tree, path.split('/').filter(Boolean), value);
  tree.updated = Date.now();
  persist(); emit(); bc?.postMessage({ code, path, value });
  if (status.mode === 'shared') {
    fetch(dbUrl(path), { method: 'PUT', body: JSON.stringify(value ?? null) }).catch(() => { status.error = 'Could not save to the shared table — check your connection.'; emit(); });
    fetch(dbUrl('updated'), { method: 'PUT', body: JSON.stringify(tree.updated) }).catch(() => {});
  }
}
// update() saves only the fields that changed (a PATCH), so two devices editing the same character
// (HP on one, status on another) can't put back each other's old values.
const plain = (v) => v && typeof v === 'object' && !Array.isArray(v);
function diffInto(a, b, pre, out) {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (plain(a[k]) && plain(b[k])) diffInto(a[k], b[k], pre + k + '/', out);
    else if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) out[pre + k] = b[k] ?? null;
  }
  return out;
}
export function update(path, fn) {
  const before = get(path) ?? null;
  const after = fn(structuredClone(before));
  if (!plain(before) || !plain(after)) return set(path, after);
  const diff = diffInto(before, after, '', {});
  if (!Object.keys(diff).length) return;
  tree = setIn(tree, path.split('/').filter(Boolean), after);
  tree.updated = Date.now();
  persist(); emit(); bc?.postMessage({ code, path, value: after });
  if (status.mode === 'shared') {
    fetch(dbUrl(path), { method: 'PATCH', body: JSON.stringify(diff) }).catch(() => { status.error = 'Could not save to the shared table — check your connection.'; emit(); });
    fetch(dbUrl('updated'), { method: 'PUT', body: JSON.stringify(tree.updated) }).catch(() => {});
  }
}

// Time-ordered id so log/roll entries sort naturally.
export const tid = () => Date.now().toString(36).padStart(9, '0') + uid().slice(0, 4);

export function pushLimited(path, entry, keep = 60) {
  const obj = { ...(get(path) || {}) };
  obj[tid()] = entry;
  const keys = Object.keys(obj).sort();
  keys.slice(0, Math.max(0, keys.length - keep)).forEach((k) => { obj[k] = null; delete obj[k]; });
  set(path, obj);
}

// Same-browser tabs stay in step.
const bc = 'BroadcastChannel' in window ? new BroadcastChannel('dc-table') : null;
if (bc) bc.onmessage = (e) => {
  if (e.data.code !== code) return;
  tree = setIn(tree, e.data.path.split('/').filter(Boolean), e.data.value); emit();
};

// Resolves once the shared table's first full copy has arrived: 'empty' (a brand-new table) or 'data'.
let loadedRes = null; let loadedP = Promise.resolve('local');
export const whenLoaded = () => loadedP;

export async function open(tableCode) {
  code = tableCode;
  firstRemote = true;
  loadedP = new Promise((r) => { loadedRes = r; });
  remote?.close(); remote = null;
  try { tree = JSON.parse(localStorage.getItem(LS + code) || '{}'); } catch { tree = {}; }
  gm = null; gmKey = null;
  if (CONFIG.firebaseDbUrl) {
    status.mode = 'shared';
    remote = new EventSource(dbUrl(''));
    remote.addEventListener('put', (e) => applyRemote(JSON.parse(e.data), false));
    remote.addEventListener('patch', (e) => applyRemote(JSON.parse(e.data), true));
    remote.onopen = () => { status.connected = true; status.error = ''; emit(); };
    remote.onerror = () => { status.connected = false; emit(); };
  } else {
    status.mode = 'local';
    loadedRes('local');
  }
  emit();
}

let firstRemote = true;
function applyRemote({ path, data }, patch) {
  const parts = path.split('/').filter(Boolean);
  if (!parts.length && firstRemote) {
    firstRemote = false;
    loadedRes?.(data == null ? 'empty' : 'data');
    // Empty shared table: upload what this device already has.
    if (data == null && Object.keys(tree).length) { fetch(dbUrl(''), { method: 'PUT', body: JSON.stringify(tree) }); return; }
  }
  if (patch) for (const [k, v] of Object.entries(data || {})) tree = setIn(tree, [...parts, ...k.split('/')], v);
  else tree = setIn(tree, parts, data);
  if (!parts.length && tree == null) tree = {};
  persist();
  if (gmKey && (parts[0] === 'gmEnc' || !parts.length)) loadGm().then(emit); else emit();
}

export function exportJSON() { return JSON.stringify({ app: 'dungeoncrawling', code, saved: Date.now(), tree }, null, 1); }
export function importJSON(text) {
  const j = JSON.parse(text);
  if (!j || !j.tree) throw new Error('Not a table save file');
  tree = j.tree; persist();
  if (status.mode === 'shared') fetch(dbUrl(''), { method: 'PUT', body: JSON.stringify(tree) });
  if (gmKey) loadGm(); emit();
}

// ---------------------------------------------------------------- GM data (encrypted)
const te = new TextEncoder(); const td = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFor(pass) {
  const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: te.encode('voice-of-the-forest-gm'), iterations: 150000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function enc(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}
async function dec(key, box) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
  return JSON.parse(td.decode(pt));
}
async function loadGm() {
  const box = get('gmEnc');
  gm = box ? await dec(gmKey, box) : {};
}

export const gmExists = () => !!get('gmEnc');
export const gmUnlocked = () => !!gmKey;
export const gmData = () => gm;

export async function gmUnlock(pass, remember) {
  const key = await keyFor(pass);
  const box = get('gmEnc');
  if (box) { try { gm = await dec(key, box); } catch { throw new Error('Wrong GM passcode'); } }
  else { gm = {}; set('gmEnc', await enc(key, gm)); }
  gmKey = key;
  try { if (remember) localStorage.setItem('dc.gmpass.' + code, pass); } catch { /* ignore */ }
  emit();
}
export async function gmTryRemembered() {
  let p = null; try { p = localStorage.getItem('dc.gmpass.' + code); } catch { /* ignore */ }
  if (p && gmExists()) { try { await gmUnlock(p); return true; } catch { /* stale */ } }
  return false;
}
export function gmLock() { gmKey = null; gm = null; try { localStorage.removeItem('dc.gmpass.' + code); } catch { /* ignore */ } emit(); }

let gmSaveChain = Promise.resolve();
export function gmSet(key, value) {
  if (!gmKey) return;
  gm = { ...gm, [key]: value };
  const snapshot = gm;
  emit();
  gmSaveChain = gmSaveChain.then(async () => set('gmEnc', await enc(gmKey, snapshot)));
}
export const gmUpdate = (key, fn) => gmSet(key, fn(structuredClone(gm?.[key] ?? null)));

// Watching friends play the skill games live (her ask 10-27: "allow all friends to watch all skill games").
// While someone plays, playing/<id> = { g, name, t } says what they're in. When a friend opens Watch, they add
// watching/<player>/<watcher> (refreshed every 30 s) and only then does the player's device stream: canvas games send a small
// picture ~6 times a second, the dance sends its board. The stream goes to a side table (tables/<code>-live/<id>) so it never
// wakes up everyone else's pages.
import { CONFIG } from './config.js?v=6ae3bd59';
import * as store from './store.js?v=6ae3bd59';
import { $, esc, num } from './util.js?v=6ae3bd59';
import { modal, closeModal } from './ui.js?v=6ae3bd59';

const FRESH = 90e3; const FRAME_MS = 160;
const meId = () => { try { return localStorage.getItem('dc.me.' + store.tableCode()) || ''; } catch { return ''; } };
const liveUrl = (id) => `${CONFIG.firebaseDbUrl.replace(/\/$/, '')}/tables/${encodeURIComponent(store.tableCode() + '-live')}/${encodeURIComponent(id)}.json`;
const party = () => store.get('party') || {};
export const playingNow = (id) => { const p = store.get('playing/' + id); return p && Date.now() - num(p.t) < FRESH ? p : null; };
const watchersOf = (id) => Object.entries(store.get('watching/' + id) || {}).filter(([w, t]) => t && Date.now() - num(t) < FRESH && party()[w]).map(([w]) => party()[w].nickname);

// player side: call when a run starts; returns stop()
export function startBroadcast(gameId, gameName, { canvas, el, box }) {
  const id = meId(); if (!id || !CONFIG.firebaseDbUrl) return () => {};
  let stopped = false; let busy = false; let lastHTML = ''; let tick = 0; let lastBeat = 0;
  const badge = document.createElement('div'); badge.className = 'watch-badge'; badge.hidden = true; box?.prepend(badge);
  const shrink = canvas ? document.createElement('canvas') : null;
  if (shrink) { shrink.width = 480; shrink.height = Math.round(480 * canvas.height / canvas.width); }
  const beat = () => { lastBeat = Date.now(); store.set('playing/' + id, { g: gameId, name: gameName, t: lastBeat }); };
  beat();
  const send = (body) => { busy = true; fetch(liveUrl(id), { method: 'PUT', body: JSON.stringify(body) }).catch(() => {}).finally(() => { busy = false; }); };
  const loop = () => {
    if (stopped) return;
    if (box && !box.isConnected) { stop(); return; }
    if (Date.now() - lastBeat > 30e3) beat();
    const who = watchersOf(id);
    badge.hidden = !who.length; if (who.length) badge.textContent = `👀 Watching you: ${who.join(', ')}`;
    if (who.length && !busy) {
      if (canvas) { const q = shrink.getContext('2d'); q.drawImage(canvas, 0, 0, shrink.width, shrink.height); send({ g: gameId, name: gameName, t: Date.now(), kind: 'img', d: shrink.toDataURL('image/jpeg', 0.6) }); }
      else if (el) { const h = el.outerHTML; if (h !== lastHTML || ++tick % 20 === 0) { lastHTML = h; send({ g: gameId, name: gameName, t: Date.now(), kind: 'html', d: h }); } }
    }
    setTimeout(loop, FRAME_MS);
  };
  const stop = (result) => {
    if (stopped) return; stopped = true; badge.remove();
    store.set('playing/' + id, null);
    if (watchersOf(id).length) fetch(liveUrl(id), { method: 'PUT', body: JSON.stringify({ g: gameId, name: gameName, t: Date.now(), end: true, result: result || '' }) }).catch(() => {});
  };
  loop();
  return stop;
}

// watcher side: a big pop-up showing the friend's game as it happens
export function openWatch(playerId) {
  const me = meId(); const who = party()[playerId]; if (!who || !me) return;
  const p = playingNow(playerId);
  const box = modal(`<h2>👀 Watching ${esc(who.nickname)}</h2><p class="small muted" id="wsub">${p ? `Playing <b>${esc(p.name)}</b>` : 'Waiting for them to start a game…'}</p>
    <div class="watch-view" id="wview"><p class="muted">Connecting…</p></div>`);
  box.classList.add('watch-sheet');
  const view = $('#wview', box); const sub = $('#wsub', box);
  const hb = () => store.set(`watching/${playerId}/${me}`, Date.now());
  hb(); const hbT = setInterval(hb, 30e3);
  const es = new EventSource(liveUrl(playerId));
  let img = null;
  const show = (v) => {
    if (!v || Date.now() - num(v.t) > 5 * 60e3) return;
    sub.innerHTML = `Playing <b>${esc(v.name || 'a game')}</b>`;
    if (v.end) { view.innerHTML = `<p class="watch-end"><b>${esc(who.nickname)}’s game is over.</b>${v.result ? ' ' + esc(v.result) : ''}</p><p class="small muted">Stay here to watch their next game.</p>`; img = null; return; }
    if (v.kind === 'img') { if (!img) { view.innerHTML = '<img class="watch-frame" alt="">'; img = $('img', view); } img.src = v.d; }
    else if (v.kind === 'html') { img = null; view.innerHTML = `<div class="watch-html">${v.d}</div>`; view.querySelectorAll('button, input').forEach((b) => { b.disabled = true; b.tabIndex = -1; }); }
  };
  let cur = null;
  es.addEventListener('put', (e) => { const { path, data } = JSON.parse(e.data); if (path === '/') cur = data; else if (cur) cur = { ...cur, [path.slice(1)]: data }; show(cur); });
  es.addEventListener('patch', (e) => { const { data } = JSON.parse(e.data); cur = { ...(cur || {}), ...data }; show(cur); });
  const done = () => { es.close(); clearInterval(hbT); store.set(`watching/${playerId}/${me}`, null); window.removeEventListener('modalclosed', done); };
  window.addEventListener('modalclosed', done);
}

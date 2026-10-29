// The site as an app (her ask 10-28): it can be added to a phone's home screen and opens full screen with its own icon.
// Android/computers get a real Install button; iPhones need Share → Add to Home Screen, so we show how.
import { $ } from './util.js?v=6ae3c3f4';
import { pushSupported, pushNeedsInstall, pushOn, enablePush, disablePush, syncPush } from './push.js?v=6ae3c3f4';

let prompt = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const phone = () => matchMedia('(pointer: coarse)').matches;
const NAG = 'dc.app.asked'; const NAG_PUSH = 'dc.push.asked';

export function startInstall() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); prompt = e; offer(); });
  addEventListener('appinstalled', () => { prompt = null; document.querySelector('.app-pop')?.remove(); });
  if (ios()) setTimeout(offer, 4000);
  syncPush();
  if (standalone()) setTimeout(offerPush, 4000);
}

// inside the app: ask once about notifications (phones need a tap before they'll ask permission)
async function offerPush() {
  let asked = false; try { asked = !!localStorage.getItem(NAG_PUSH); } catch { /* ignore */ }
  if (asked || !pushSupported() || Notification.permission !== 'default' || document.querySelector('.app-pop')) return;
  if (document.querySelector('.sheet-bg')) { setTimeout(offerPush, 5000); return; }
  const el = document.createElement('div'); el.className = 'app-pop';
  el.innerHTML = `<img src="assets/ui/app_icon_192.png" alt=""><div><b>Turn on notifications?</b><br><span class="small">Hear about gifts, game invites, your nursery buddy and when the GM goes live.</span><div class="row"><button class="btn sm" data-yes>🔔 Turn on</button><button class="btn alt sm" data-no>Not now</button></div></div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); try { localStorage.setItem(NAG_PUSH, '1'); } catch { /* ignore */ } };
  $('[data-no]', el).onclick = close;
  $('[data-yes]', el).onclick = () => { close(); enablePush(); };
}

// a one-time invite on phones; after that it lives in ⚙️ Settings
function offer() {
  let asked = false; try { asked = !!localStorage.getItem(NAG); } catch { /* ignore */ }
  if (asked || standalone() || !phone() || document.querySelector('.app-pop')) return;
  if (document.querySelector('.sheet-bg')) { setTimeout(offer, 5000); return; } // wait until other pop-ups are closed
  const el = document.createElement('div'); el.className = 'app-pop';
  el.innerHTML = `<img src="assets/ui/app_icon_192.png" alt=""><div><b>Get the Voice of the Forest app!</b><br><span class="small">Opens full screen from your home screen.</span><div class="row"><button class="btn sm" data-yes>📱 Get the app</button><button class="btn alt sm" data-no>Not now</button></div></div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); try { localStorage.setItem(NAG, '1'); } catch { /* ignore */ } };
  $('[data-no]', el).onclick = close;
  $('[data-yes]', el).onclick = () => { close(); install(); };
}

export const appSection = () => (standalone() ? '<p class="small muted">✅ You’re using the app.</p>'
  : `<p class="small muted">Put the site on your home screen with its own icon. It opens full screen, like any other app.</p><button class="btn alt" id="setapp">📱 Get the app</button><div id="setapphow" hidden></div>`)
  + `<h3 style="margin-top:14px">🔔 Notifications</h3><p class="small muted" id="setpushtxt">Get a notification on this device for gifts, game invites, your nursery buddy and when the GM goes live, even when the app is closed.</p><button class="btn alt" id="setpush" hidden></button>`;
export function wireAppSection(el) {
  const b = $('#setapp', el); if (b) b.onclick = () => install($('#setapphow', el));
  const p = $('#setpush', el); const txt = $('#setpushtxt', el);
  if (!pushSupported()) { txt.textContent = pushNeedsInstall() ? 'On iPhone, notifications work once the app is on your home screen (see Get the app above). Open it from there to turn them on.' : 'This browser can’t show notifications.'; return; }
  if (pushNeedsInstall()) { txt.textContent = 'On iPhone, notifications work once the app is on your home screen (see Get the app above). Open it from there to turn them on.'; return; }
  const draw = async () => { const on = await pushOn(); p.textContent = on ? '🔕 Turn off notifications' : '🔔 Turn on notifications'; p.hidden = false; p.onclick = async () => { p.disabled = true; if (on) await disablePush(); else await enablePush(); p.disabled = false; draw(); }; };
  draw();
}

async function install(where) {
  if (prompt) {
    try { await prompt.prompt(); const r = await prompt.userChoice; if (r?.outcome === 'accepted') prompt = null; return; } catch { /* the browser said no: show the steps instead */ }
  }
  const how = ios()
    ? '<b>On iPhone/iPad (Safari):</b><ol><li>Tap the <b>Share</b> button (the square with the arrow).</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>.</li></ol>'
    : '<b>To install:</b><ol><li>Open the browser menu (<b>⋮</b> at the top right).</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li></ol><p class="small muted">On a computer, look for the install icon at the right end of the address bar.</p>';
  if (where) { where.innerHTML = how; where.hidden = false; return; }
  const { modal } = await import('./ui.js?v=6ae3c3f4');
  modal(`<h2>📱 Get the app</h2>${how}`);
}

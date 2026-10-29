// Phone notifications (her ask 10-28: "full"), even when the app is closed. Each device that turns them on saves its push
// address under push/<character>/<key>. A scheduled job on the site's GitHub (push/notify.mjs) checks the table every
// few minutes and sends: gifts in the mailbox, game invites, the nursery buddy needing care, and the GM going live.
import * as store from './store.js?v=6ae3d84a';
import { toast } from './util.js?v=6ae3d84a';

const KEY = 'BKU1TFmEMnNgBd80c9auRExmRAE_nzOEYGIPtqlf_BDLi9vo_HGDKiN2UOvNi63mV4SQB4IFjh0S62Ay6TUj6RE';
const meId = () => { try { return localStorage.getItem('dc.me.' + store.tableCode()) || ''; } catch { return ''; } };
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const bytes = (b64) => { const s = atob((b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
const hashOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
// iPhones only allow it once the site is on the home screen
export const pushNeedsInstall = () => ios() && !standalone();
const reg = () => navigator.serviceWorker.ready;
async function currentSub() { try { return await (await reg()).pushManager.getSubscription(); } catch { return null; } }

// keep this device's push address filed under whoever is playing on it
function save(sub, id) {
  const k = hashOf(sub.endpoint);
  for (const [cid, subs] of Object.entries(store.get('push') || {})) if (cid !== id && subs && subs[k]) store.set(`push/${cid}/${k}`, null);
  if (!store.get(`push/${id}/${k}`)) store.set(`push/${id}/${k}`, { sub: sub.toJSON(), t: Date.now() });
}
export async function pushOn() { return pushSupported() && Notification.permission === 'granted' && !!(await currentSub()); }
export async function enablePush() {
  const id = meId(); if (!id) { toast('Pick your character first.'); return false; }
  if (!pushSupported()) { toast('This browser can’t show notifications.'); return false; }
  const ok = await Notification.requestPermission();
  if (ok !== 'granted') { toast('Notifications are blocked. You can allow them in your phone’s settings for this app.'); return false; }
  try {
    const r = await reg();
    const sub = (await r.pushManager.getSubscription()) || await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(KEY) });
    save(sub, id); toast('🔔 Notifications are on!'); return true;
  } catch { toast('Couldn’t turn on notifications. Try again in a moment.'); return false; }
}
export async function disablePush() {
  const sub = await currentSub(); if (!sub) return;
  const k = hashOf(sub.endpoint);
  for (const [cid, subs] of Object.entries(store.get('push') || {})) if (subs && subs[k]) store.set(`push/${cid}/${k}`, null);
  await sub.unsubscribe().catch(() => {}); toast('🔕 Notifications are off.');
}
export async function syncPush() {
  const id = meId(); if (!id || !pushSupported() || Notification.permission !== 'granted') return;
  await store.whenLoaded(); const sub = await currentSub(); if (sub) save(sub, id);
}

// Sends the phone notifications. Run every few minutes by .github/workflows/notify.yml.
// Reads the shared table, works out what each player should hear about, sends it to every device they turned
// notifications on for (push/<character>/<key>), and remembers what was sent in pushsent/<character> so nothing repeats.
import webpush from 'web-push';

const DB = 'https://voiceoftheforest-e071c-default-rtdb.firebaseio.com/tables/' + (process.env.TABLE || 'VOICE');
const SITE = 'https://xrunriot-wp.github.io/thevoiceoftheforest/';
const PUBLIC = 'BKU1TFmEMnNgBd80c9auRExmRAE_nzOEYGIPtqlf_BDLi9vo_HGDKiN2UOvNi63mV4SQB4IFjh0S62Ay6TUj6RE';
webpush.setVapidDetails(SITE, PUBLIC, process.env.VAPID_PRIVATE);

const get = async (p) => (await fetch(`${DB}/${p}.json`)).json();
const patch = (p, v) => fetch(`${DB}/${p}.json`, { method: 'PATCH', body: JSON.stringify(v) });
const num = (v) => Number(v) || 0;
const now = Date.now();
const H = 3600e3;
const easternHour = () => Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/New_York' }).format(now));

// nursery: same sums as the site (js/nursery.js), weather cover left out
const RATE = { warm: 14, feed: 14, play: 12, clean: 8 };
const NEEDS = { egg: ['warm'], baby: ['feed', 'play', 'clean'] };
const WANT = { warm: 'is getting cold', feed: 'is hungry', play: 'is bored and wants to play', clean: 'needs a bath' };
const stat = (b, k) => Math.max(0, Math.min(100, Math.round(100 - (now - num(b[k + 'At'])) / H * RATE[k])));
const BABY = { pichu: 'Pichu', cleffa: 'Cleffa', igglybuff: 'Igglybuff', togepi: 'Togepi', tyrogue: 'Tyrogue', smoochum: 'Smoochum', elekid: 'Elekid', magby: 'Magby', azurill: 'Azurill', wynaut: 'Wynaut', budew: 'Budew', chingling: 'Chingling', bonsly: 'Bonsly', mimejr: 'Mime Jr.', happiny: 'Happiny', munchlax: 'Munchlax', riolu: 'Riolu' };

const t = await get('');
const subsAll = t.push || {};
const party = t.party || {};
const sentAll = t.pushsent || {};
const awake = easternHour() >= 8 && easternHour() < 21;
let sentCount = 0;

for (const [id, subs] of Object.entries(subsAll)) {
  const c = party[id]; if (!c || !subs) continue;
  const since = Math.min(...Object.values(subs).map((s) => num(s.t)));
  const sent = { ...(sentAll[id] || {}) }; const out = [];
  const once = (key, msg) => { if (!sent[key]) { sent[key] = now; out.push(msg); } };
  const online = now - num(t.online?.[id]?.t) < 5 * 60e3;

  // gifts and GM rewards in the mailbox
  for (const [k, n] of Object.entries(t.giftmail?.[id] || {})) {
    if (n && !n.read && num(n.t) >= since && now - num(n.t) < 6 * H) once('g' + k, { title: `${n.icon || '🎁'} ${n.title}`, body: n.text || '', url: SITE + '#/play', tag: 'gift' });
  }
  // game invites from friends
  for (const [k, v] of Object.entries(t.invites?.[id] || {})) {
    if (v && now - num(v.t) < 30 * 60e3) once('i' + k, { title: `👥 ${v.from} invited you to play!`, body: `Join them at ${v.name || 'a game'}.`, url: SITE + '#/games/' + (v.game || ''), tag: 'invite' });
  }
  // the GM started a session
  const s = t.session || {};
  if (s.live && now - num(s.liveSince) < 3 * H) once('live' + num(s.liveSince), { title: '🎲 The GM is live!', body: 'A session just started. Come join the table!', url: SITE + '#/play', tag: 'live' });
  // nursery buddy needs care (daytime only, at most every 6 hours, not while they're on the site)
  const b = t.nursery?.[id];
  if (b && !b.recruited && num(b.stage) < 3 && awake && !online) {
    const low = (b.stage === 0 ? NEEDS.egg : NEEDS.baby).filter((k) => stat(b, k) < 40);
    const last = Math.max(0, ...Object.entries(sent).filter(([k]) => k.startsWith('n')).map(([, v]) => num(v)));
    if (low.length && now - last > 6 * H) {
      const name = b.name || (b.stage === 0 ? 'Your egg' : BABY[b.sp] || 'Your buddy');
      once('n' + now, { title: `🥚 ${name} needs you!`, body: `${name} ${WANT[low[0]]}. Beatrice says come by the nursery soon.`, url: SITE + '#/games/fernshade-nursery', tag: 'nursery' });
    }
  }

  if (!out.length) continue;
  for (const [k, s] of Object.entries(subs)) {
    for (const msg of out) {
      try { await webpush.sendNotification(s.sub, JSON.stringify(msg), { TTL: 6 * 3600 }); sentCount++; }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { await patch('push/' + id, { [k]: null }); break; } console.log('send failed', id, e.statusCode || e.message); }
    }
  }
  for (const [k, v] of Object.entries(sent)) if (now - num(v) > 3 * 24 * H) sent[k] = null;
  await patch('pushsent', { [id]: sent });
}
console.log(`sent ${sentCount}`);

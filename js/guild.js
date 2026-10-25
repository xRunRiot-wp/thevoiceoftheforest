// Between sessions: guild status, mission board, shop & storage, characters, session history.
import * as store from './store.js?v=6ade7aea';
import * as sheet from './sheetdata.js?v=6ade7aea';
import { $, $$, esc, num, uid, toast, timeAgo } from './util.js?v=6ade7aea';
import { portrait, modal, closeModal, maxHp } from './ui.js?v=6ade7aea';
import { MISSION_GP } from './content.js?v=6ade7aea';
import { ranks } from './rulebook.js?v=6ade7aea';
import { merged, editContent } from './content-store.js?v=6ade7aea';
import { editCharacter, viewCharacter, addItem } from './play.js?v=6ade7aea';
import { myId } from './app.js?v=6ade7aea';
import { ledger, canWithdraw, recordWithdrawal, lowAlertHTML } from './vault.js?v=6ade7aea';
import { ixLink } from './effects.js?v=6ade7aea';

export const SHOP_DEFAULTS = [
  ['Apple', 20, 'Food'], ['Big Apple', 50, 'Food'], ['Oran Berry', 50, 'Berry'], ['Pecha Berry', 50, 'Berry'], ['Rawst Berry', 50, 'Berry'], ['Cheri Berry', 50, 'Berry'],
  ['Blast Seed', 30, 'Seed'], ['Sleep Seed', 50, 'Seed'], ['Stun Seed', 50, 'Seed'], ['Encourage Seed', 100, 'Seed'], ['Heal Seed', 200, 'Seed'], ['Tiny Reviver Seed', 500, 'Seed'],
  ['Escape Orb', 150, 'Orb'], ['All-Hit Orb', 150, 'Orb'], ['Luminous Orb', 300, 'Orb'], ['Health Orb', 300, 'Orb'], ['All-Protect Orb', 500, 'Orb'],
].map(([name, price, kind]) => ({ name, price, kind, stock: '' }));
export const SHOP_SCHEMA = [['name', 'Item'], ['price', 'Price (Poké)', 'number'], ['kind', 'Kind'], ['stock', 'Stock (blank = unlimited)', 'number']];
export const shop = () => merged('shop', SHOP_DEFAULTS);

export const MISSION_SCHEMA = [['rank', 'Rank', 'select:E|D|C|B|A|S|X'], ['title', 'Title'], ['client', 'Client'], ['place', 'Where'], ['details', 'Details', 'area'], ['reward', 'Reward (items / Poké)'], ['gp', 'Guild Points (blank = by rank)', 'number'], ['status', 'Status', 'select:open|taken|done|failed'], ['guild', 'Guild (woodland or vanguard)', 'select:woodland|vanguard'], ['art', 'Picture link (optional)']];

export const GUILDS2 = [['woodland', 'Woodland Base'], ['vanguard', 'Vanguard Guild']];
export const guildPath = (k) => (k === 'vanguard' ? 'vanguard' : 'guild');
export const guildName = (k) => (k === 'vanguard' ? 'Vanguard Guild' : 'Woodland Base');
const guildBox = (k) => {
  const g = store.get(guildPath(k)) || {}; const r = rankFor(g.gp || 0);
  const nx = ranks().find((x) => x.gp != null && x.gp > (g.gp || 0));
  return `<div class="card emblem guildbox"><h3>${esc(guildName(k))}</h3>
    <div class="win tight"><span class="who">Rank:</span> ${esc(r?.name || '')} (${esc(r?.alt || '')})<br><span class="who">Guild Points:</span> ${g.gp || 0}<br><span class="who">Chapter:</span> ${g.chapter ?? '—'}</div>
    <div class="small nextrank">Next rank: ${nx ? `${esc(nx.name)} at ${nx.gp} GP` : 'top of the ladder!'}</div></div>`;
};

export function rankFor(gp) {
  const list = ranks().filter((r) => r.gp != null);
  let cur = list[0];
  for (const r of list) if (gp >= r.gp) cur = r;
  return cur;
}

export function missionCard(id, m, { gm = false } = {}) {
  const gp = m.gp ?? MISSION_GP[m.rank] ?? 0;
  return `<div class="card mission ${esc(m.status || '')} ${m.hidden ? 'hidden' : ''}">
    <div class="row" style="justify-content:space-between"><span class="pill">${esc(m.rank)} Rank · ${gp} GP${m.guild === 'vanguard' ? ' · Vanguard' : ''}</span><span class="pill">${m.hidden ? 'GM only' : esc(m.status || 'open')}</span></div>
    ${m.art ? `<a href="${esc(m.art)}" target="_blank"><img class="art-wide" src="${esc(m.art)}" alt="" loading="lazy" style="max-height:260px;object-fit:cover"></a>` : ''}
    <h3 style="margin:8px 0 4px">${esc(m.title)}</h3>
    ${m.client ? `<p class="small muted">Client: ${esc(m.client)}${m.place ? ' · ' + esc(m.place) : ''}</p>` : ''}
    ${m.details ? `<p class="small">${esc(m.details)}</p>` : ''}${m.reward ? `<p class="small"><b>Reward:</b> ${esc(m.reward)}</p>` : ''}
    <div class="row">${!gm && (m.status || 'open') === 'open' ? `<button class="btn sm" data-take="${id}">Take mission</button>` : ''}
    ${gm ? `<button class="btn alt sm" data-med="${id}">Edit</button>${m.hidden ? `<button class="btn sm" data-mreveal="${id}">Reveal</button>` : `<button class="btn good sm" data-mdone="${id}">Done</button><button class="btn bad sm" data-mfail="${id}">Failed</button><button class="btn alt sm" data-mcur="${id}">Set current</button>`}` : ''}</div>
  </div>`;
}

// ---- completed missions tracker (right-hand column): name + picture always shown, details fold open
const openTrack = new Set();   // stays open across live refreshes
function trackerHTML(list) {
  const gm = store.gmUnlocked();
  return `<div class="tracker"><h2>Completed missions</h2>
    ${list.length ? list.map(([id, m]) => `<details class="trk ${esc(m.status)}" data-trk="${id}" ${openTrack.has(id) ? 'open' : ''}>
      <summary>${m.art ? `<img src="${esc(m.art)}" alt="" loading="lazy">` : '<span class="trk-noart"></span>'}<span class="grow"><b>${esc(m.title)}</b><span class="small">${esc(m.rank)} Rank · ${m.status === 'failed' ? 'failed' : 'completed'}</span></span></summary>
      <div class="trk-body">
        ${m.client ? `<p class="small muted">Client: ${esc(m.client)}${m.place ? ' · ' + esc(m.place) : ''}</p>` : ''}
        ${m.details ? `<p class="small">${esc(m.details)}</p>` : ''}${m.reward ? `<p class="small"><b>Reward:</b> ${esc(m.reward)}</p>` : ''}
        ${m.art ? `<a class="small" href="${esc(m.art)}" target="_blank">Open picture</a>` : ''}
        <div class="trk-var"><b class="small">How it went (GM notes)</b>
          ${gm ? `<textarea rows="3" data-var="${id}" placeholder="Any changes from the posted mission: different twists, rewards, who went…">${esc(m.variation || '')}</textarea><button class="btn sm" data-varsave="${id}">Save notes</button>`
    : m.variation ? `<p class="small" style="white-space:pre-wrap">${esc(m.variation)}</p>` : '<p class="small muted">No notes yet.</p>'}</div>
      </div></details>`).join('') : '<p class="small muted">Finished missions show up here.</p>'}
    ${gm ? '' : '<p class="small muted" style="margin-top:8px">GM: unlock the GM screen to write notes here.</p>'}</div>`;
}
function bindTracker(main) {
  $$('[data-trk]', main).forEach((d) => d.ontoggle = () => (d.open ? openTrack.add(d.dataset.trk) : openTrack.delete(d.dataset.trk)));
  $$('[data-varsave]', main).forEach((b) => b.onclick = () => {
    const id = b.dataset.varsave;
    store.set(`missions/${id}/variation`, $(`[data-var="${id}"]`, main).value.trim() || null);
    toast('Mission notes saved');
  });
}

export function finishMission(id, ok) {
  const m = (store.get('missions') || {})[id]; if (!m) return;
  const gp = m.gp ?? MISSION_GP[m.rank] ?? 0;
  const delta = ok ? gp : (m.rank === 'X' ? -200 : -gp);  // to the mission's own guild
  store.update(guildPath(m.guild), (g) => ({ ...g, gp: (g?.gp || 0) + delta }));
  store.set(`missions/${id}/status`, ok ? 'done' : 'failed');
  store.pushLimited('log', { t: Date.now(), text: `Mission ${ok ? 'complete' : 'failed'}: ${m.title} (${delta > 0 ? '+' : ''}${delta} GP)` });
  toast(`${delta > 0 ? '+' : ''}${delta} Guild Points`);
}

export function renderGuild(main) {
  const g = store.get('guild') || {};
  const r = rankFor(g.gp || 0);
  const missions = Object.entries(store.get('missions') || {}).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
  const finished = missions.filter(([, m]) => !m.hidden && (m.status === 'done' || m.status === 'failed'));
  const active = missions.filter(([, m]) => !(m.status === 'done' || m.status === 'failed'));
  const storage = Object.entries(store.get('storage') || {});
  const party = Object.values(store.get('party') || {});
  const hist = Object.entries(store.get('history') || {}).sort().reverse();

  main.innerHTML = `
  <div class="hero"><img class="hdr" src="assets/banners/guilds.jpg" alt=""></div>
  <h1>${esc(g.name || 'Guild')}</h1>
  <div class="guild-layout"><aside class="guild-side">${trackerHTML(finished)}</aside><div class="guild-main">
  ${lowAlertHTML()}
  <div class="guildboxes">${GUILDS2.map(([k]) => guildBox(k)).join('')}</div>
  <div class="card coffers"><span class="pix">Shared guild coffers:</span> <b class="pix">${(g.coffers || 0).toLocaleString()} Poké</b></div>
  <p class="small" style="margin:-4px 0 10px">${ixLink('Guild Points', 'How Guild Points work')} · <a href="#/rules/ranks">All ranks</a></p>

  <div class="section-title"><h2>Mission board</h2></div>
  ${active.length ? active.map(([id, m]) => missionCard(id, m)).join('') : '<p class="muted">No open missions right now.</p>'}

  <div class="section-title"><h2>Shop</h2><span class="small muted">pays from the guild Poké</span></div>
  <div class="card" style="padding:6px 12px"><ul class="log" style="max-height:none">${shop().map((s) => `<li class="row nowrap"><span class="grow">${ixLink(s.name)} <span class="small muted">${esc(s.kind || '')}</span></span><b class="pix">${num(s.price)} P</b><button class="btn sm" data-buy="${esc(s.id)}" ${s.stock === 0 ? 'disabled' : ''}>Buy</button></li>`).join('')}</ul></div>

  <div class="section-title"><h2>Storage</h2><a class="btn alt sm" href="#/vault">Open Storage & Poké</a></div>
  <p class="small muted">Each guild's storage and Poké activity is on the <a href="#/vault">Vault</a> tab (${storage.length} item${storage.length === 1 ? '' : 's'} stored).</p>

  <div class="section-title"><h2>Characters</h2><button class="btn alt sm" id="newchar">+ New character</button></div>
  <div class="grid g2">${party.map((c) => `<button class="card row nowrap" style="text-align:left;cursor:pointer;margin:0" data-view="${c.id}">${portrait(c, 'sm')}<div class="grow"><div class="char-name" style="font-size:19px">${esc(c.nickname)}${c.id === myId() ? ' <span class="pill">you</span>' : ''}</div><div class="char-sub">${esc(c.pokemon)} · ${esc(guildName(c.guild))} · ${c.hp}/${maxHp(c)} HP · TP ${c.tp || 0} · ${num(c.poke).toLocaleString()} Poké</div></div></button>`).join('')}</div>
  <p class="small muted">Making a character? Fill in the <a href="https://forms.gle/GYmxXLQ7a3rcVRoH6" target="_blank" rel="noopener">Background Form</a> first, then read <a href="#/rules/r/new-character">New Character</a>.</p>

  <div class="section-title"><h2>Session history</h2></div>
  ${hist.length ? hist.map(([, h]) => `<div class="card"><h3 style="margin:0 0 4px">Session ${esc(h.n ?? '')}</h3><p class="small muted">${new Date(h.t).toLocaleDateString()}</p>${h.summary ? `<p>${esc(h.summary)}</p>` : ''}${h.rewards ? `<p class="small"><b>Rewards:</b> ${esc(h.rewards)}</p>` : ''}</div>`).join('') : '<p class="muted">No sessions recorded yet. The GM writes one at the end of each session.</p>'}
  </div></div>`;

  bindTracker(main);
  $$('[data-take]', main).forEach((b) => b.onclick = () => { store.set(`missions/${b.dataset.take}/status`, 'taken'); store.pushLimited('log', { t: Date.now(), text: `Mission taken: ${(store.get('missions') || {})[b.dataset.take]?.title}` }); });
  $$('[data-buy]', main).forEach((b) => b.onclick = () => buy(b.dataset.buy));
  $$('[data-view]', main).forEach((b) => b.onclick = () => viewCharacter(b.dataset.view));
  $('#newchar', main).onclick = () => editCharacter(null);
}

function buy(id) {
  const s = shop().find((x) => x.id === id); if (!s) return;
  const gpath = 'guild'; const g = store.get(gpath) || {};   // one shared coffer
  const price = num(s.price);
  if ((g.coffers || 0) < price) { toast('Not enough Poké'); return; }
  const buyerG = (store.get('party') || {})[myId()]?.guild;
  if (!canWithdraw(buyerG, price)) return;
  const party = Object.values(store.get('party') || {});
  const el = modal(`<h2>Buy ${esc(s.name)}</h2><p>${price} Poké from the shared guild coffers (has ${(g.coffers || 0).toLocaleString()}).</p>
    <label class="f">Who gets it<select id="ow"><option value="team">Team bag</option>${party.map((c) => `<option value="${c.id}" ${c.id === myId() ? 'selected' : ''}>${esc(c.nickname)}</option>`).join('')}</select></label>
    <button class="btn block" id="ok" style="margin-top:10px">Buy</button>`);
  $('#ok', el).onclick = () => {
    const ow = $('#ow', el).value;
    store.update(gpath, (x) => ({ ...x, coffers: (x.coffers || 0) - price }));
    const bag = store.get('bag') || {};
    const same = Object.entries(bag).find(([, b]) => b.name === s.name && b.owner === ow);
    if (same) store.set(`bag/${same[0]}/qty`, same[1].qty + 1); else store.set('bag/' + uid(), { name: s.name, qty: 1, owner: ow });
    if (s.stock !== '' && s.stock != null) store.set(`content/shop/${s.id}`, { ...s, builtin: undefined, edited: undefined, id: undefined, stock: Math.max(0, num(s.stock) - 1) });
    store.pushLimited('log', { t: Date.now(), text: `Bought ${s.name} for ${price} Poké.` });
    const buyer = (store.get('party') || {})[myId()];
    ledger(buyer?.guild, `${buyer?.nickname || 'Someone'} bought ${s.name}`, -price);
    recordWithdrawal(buyer?.guild, price);
    closeModal(); toast('Bought ' + s.name);
  };
}

function moveToBag(id) {
  const it = (store.get('storage') || {})[id]; if (!it) return;
  const owner = myId() || 'team';
  store.set('storage/' + id, null);
  const bag = store.get('bag') || {};
  const same = Object.entries(bag).find(([, b]) => b.name === it.name && b.owner === owner);
  if (same) store.set(`bag/${same[0]}/qty`, same[1].qty + it.qty); else store.set('bag/' + uid(), { ...it, owner });
  toast(`${it.name} moved to the bag`);
}

export { editContent };

// Friend Zone: where recruited Pokémon live, one area per location. The GM edits each location;
// recruits added at the table are kept per spot and shared live.
import * as store from './store.js?v=6ade87d3';
import { $, $$, esc, toast } from './util.js?v=6ade87d3';
import { merged, editContent } from './content-store.js?v=6ade87d3';

export const LOCATIONS = [
  {
    id: 'woodland-base', name: 'Woodland Base', icon: '🌳',
    welcome: 'Welcome to Woodland Base! Beneath the forest canopy, every recruit can find somewhere to belong. Some Pokémon train for the next mission, others gather berries or share stories, and the camp caretakers make sure no rescuer goes without a place to rest.',
    theme: 'Forest living, friendship, safety, community, and beginner exploration.',
    awning: 'The Great Canopy — a large green-and-gold canvas awning supported by collapsible poles and anchored between trees. Benches, message boards, and communal supplies surround a central meeting space.',
    caretaker: 'A Beatrice-like den-mother Beedrill who remembers everyone’s needs, organizes meals, and checks on returning rescuers.',
    sentinel: 'Bramble the Scolipede',
    relay: 'Rootpost Relay — Abra and Ralts rotate shifts beside the guild’s main mission board.',
    spotsText: [
      '🌟 Gravity Falls Guild | Fast responders and last line of defense. | Diglett, Vanguard Guild, the Guildmaster’s team and high-ranking members',
      '1. Mossy Hollow | Soft moss beds, shade tarps, and leafy shelters. Relaxed Pokémon care for plants and share herbal remedies. |',
      '2. Acorn Grove | Tree-root sleeping nooks and hanging hammocks. Energetic residents gather supplies and welcome visitors. | Gemini',
      '3. Fernshade Camp | Protected fern tents and woven resting mats. Patient caretakers look after smaller or newly recruited Pokémon. |',
      '4. Watcher’s Grove | Elevated lookout perches and lightweight canopy shelters. Disciplined scouts maintain patrol rotations. | Sandile',
      '5. Hearthstone Circle | Warm sleeping rolls around a safely enclosed camp lantern. Loyal companions enjoy social gatherings and guard duty. |',
      '6. Mushroom Rest | Shaded mushroom-themed tents with dim lanterns. Quiet residents offer rest and nighttime hospitality. | Nidorino',
    ].join('\n'),
  },
];
const SCHEMA = [['name', 'Location'], ['icon', 'Icon (emoji)'], ['welcome', 'Welcome text', 'area'], ['theme', 'Theme'],
  ['awning', 'Central awning', 'area'], ['caretaker', 'Caretaker', 'area'], ['sentinel', 'Sentinel'], ['relay', 'Relay station', 'area'],
  ['spotsText', 'Spots — one per line: Name | description | Pokémon living there (comma separated)', 'area']];

const spots = (loc) => (loc.spotsText || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0])
  .map(([name, desc, mons], i) => ({ i, key: name.replace(/^[^\w]*\d*\.?\s*/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 's' + i, name, desc: desc || '', mons: (mons || '').split(',').map((x) => x.trim()).filter(Boolean) }));
export const locations = () => merged('friendzone', LOCATIONS);

// Friend Zone summary on the Guild page: one card per location, tap to open its camp.
export function friendZoneSection() {
  return `<div class="section-title"><h2>Friend Zone</h2><span class="small muted">where recruited Pokémon live</span></div>
  <div class="fz-spots">${locations().map((l) => { const n = spots(l).reduce((s, x) => s + x.mons.length, 0) + Object.values(store.get('recruits/' + l.id) || {}).reduce((s, x) => s + Object.keys(x || {}).length, 0);
    return `<a class="card fz-spot fz-link" href="#/friends/${esc(l.id)}"><h3 style="margin:0">${esc(l.icon || '📍')} ${esc(l.name)}</h3><p class="small">${esc((l.welcome || '').split('. ').slice(0, 2).join('. '))}</p><span class="small"><b>${spots(l).length}</b> spots · <b>${n}</b> residents</span><span class="btn alt sm">Open camp →</span></a>`; }).join('')}</div>`;
}

export function renderFriendZone(main, [arg]) {
  const gm = store.gmUnlocked();
  const list = locations();
  const loc = list.find((l) => l.id === arg) || list[0];
  if (!loc) { main.innerHTML = '<p>No locations yet.</p>'; return; }
  const recruits = store.get('recruits/' + loc.id) || {};
  main.innerHTML = `<div class="hero"><img class="hdr" src="assets/banners/guilds.jpg" alt=""></div>
    <a class="btn alt sm" href="#/guild" style="margin-top:12px">← Guild</a>
    <div class="row" style="justify-content:space-between;margin-top:8px"><h1 style="margin:0">Friend Zone</h1>${gm ? `<span class="row"><button class="btn alt sm" id="fzedit">Edit ${esc(loc.name)}</button><button class="btn alt sm" id="fzadd">+ Location</button></span>` : ''}</div>
    <p class="small muted">Where recruited Pokémon live. Each location has its own camp.</p>
    ${list.length > 1 ? `<div class="fz-tabs">${list.map((l) => `<a class="btn ${l.id === loc.id ? '' : 'alt'} sm" href="#/friends/${esc(l.id)}">${esc(l.icon || '📍')} ${esc(l.name)}</a>`).join('')}</div>` : ''}
    <div class="card fz-head"><h2 style="margin:0 0 6px">${esc(loc.icon || '📍')} ${esc(loc.name)}</h2>
      ${loc.welcome ? `<p>${esc(loc.welcome)}</p>` : ''}${loc.theme ? `<p class="small"><b>Theme:</b> ${esc(loc.theme)}</p>` : ''}</div>
    <div class="fz-spots">${spots(loc).map((s) => { const extra = Object.entries(recruits[s.key] || {});
      return `<div class="card fz-spot"><h3 style="margin:0 0 4px">${esc(s.name)}</h3>${s.desc ? `<p class="small">${esc(s.desc)}</p>` : ''}
        <div class="fz-mons">${s.mons.map((m) => `<span class="pill">${esc(m)}</span>`).join('')}${extra.map(([id, r]) => `<span class="pill recruit">${esc(r.name)}${gm ? ` <button class="x" data-unrecruit="${esc(s.key)}/${id}" aria-label="Remove">×</button>` : ''}</span>`).join('')}${!s.mons.length && !extra.length ? '<span class="small muted">Nobody lives here yet.</span>' : ''}</div>
        <button class="btn alt sm" data-recruit="${esc(s.key)}">+ Recruit here</button></div>`; }).join('')}</div>
    <div class="card fz-staff">
      ${loc.awning ? `<p><b>⛺ Central awning:</b> ${esc(loc.awning)}</p>` : ''}${loc.caretaker ? `<p><b>🐝 Caretaker:</b> ${esc(loc.caretaker)}</p>` : ''}
      ${loc.sentinel ? `<p><b>🛡️ Sentinel:</b> ${esc(loc.sentinel)}</p>` : ''}${loc.relay ? `<p><b>📮 Relay station:</b> ${esc(loc.relay)}</p>` : ''}</div>`;
  $$('[data-recruit]', main).forEach((b) => b.onclick = () => {
    const name = prompt('Which Pokémon joins here? (name or species)'); if (!name || !name.trim()) return;
    store.set(`recruits/${loc.id}/${b.dataset.recruit}/${store.tid()}`, { name: name.trim(), t: Date.now() });
    store.pushLimited('log', { t: Date.now(), text: `${name.trim()} joined ${loc.name}’s Friend Zone.` });
    toast(`${name.trim()} moved in!`); renderFriendZone(main, [loc.id]);
  });
  $$('[data-unrecruit]', main).forEach((b) => b.onclick = () => { store.set(`recruits/${loc.id}/${b.dataset.unrecruit}`, null); renderFriendZone(main, [loc.id]); });
  const ed = $('#fzedit', main);
  if (ed) ed.onclick = () => editContent('friendzone', SCHEMA, loc, { title: 'Edit ' + loc.name, onSave: () => renderFriendZone(main, [loc.id]) });
  const ad = $('#fzadd', main);
  if (ad) ad.onclick = () => editContent('friendzone', SCHEMA, null, { title: 'New location', onSave: () => renderFriendZone(main, []) });
}

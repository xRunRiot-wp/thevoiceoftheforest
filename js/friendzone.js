// Friend Zone: where recruited Pokémon live, one area per location. The GM edits each location;
// recruits added at the table are kept per spot and shared live.
import * as store from './store.js?v=6ae5d191';
import { $, $$, esc, toast } from './util.js?v=6ae5d191';
import { modal, closeModal } from './ui.js?v=6ae5d191';
import { mountFzScene, MAPS, ZOOM_PICS } from './fzscene.js?v=6ae5d191';
import { merged, editContent } from './content-store.js?v=6ae5d191';
import { CHAPTERS } from './content.js?v=6ae5d191';
import { giftNote } from './mailbox.js?v=6ae5d191';
import { guildSay } from './chatter.js?v=6ae5d191';
import { myId } from './app.js?v=6ae5d191';

export const LOCATIONS = [
  {
    id: 'woodland-base', name: 'Woodland Base', icon: '🌳', loyalty: 3, onFoot: 'On-site', relayTime: '5–10 min',
    role: 'The central headquarters for the Friend Zone Network. It welcomes the greatest variety of Pokémon and provides the most comfortable facilities for new recruits.',
    welcome: 'Welcome to Woodland Base! Beneath the forest canopy, every recruit can find somewhere to belong. Some Pokémon train for the next mission, others gather berries or share stories, and the camp caretakers make sure no rescuer goes without a place to rest.',
    theme: 'Forest living, friendship, safety, community, and beginner exploration.',
    awning: 'The Great Canopy — a large green-and-gold canvas awning supported by collapsible poles and anchored between trees. Benches, message boards, and communal supplies surround a central meeting space.',
    caretaker: 'A Beatrice-like den-mother Beedrill who remembers everyone’s needs, organizes meals, and checks on returning rescuers.',
    sentinel: 'Bramble the Scolipede',
    relay: 'Rootpost Relay — Abra and Ralts rotate shifts beside the guild’s main mission board.',
    spotsText: [
      '🌟 Gravity Falls Guild | Fast responders and last line of defense. | Vanguard Guild, the Guildmaster’s team and high-ranking members',
      '↳ 🕯️ The Cellar | A cool, quiet stone room beneath the Guild, lit by a single lantern. Only one character can bed down here at a time. | | 1',
      '1. Mossy Hollow | Soft moss beds, shade tarps, and leafy shelters. Relaxed Pokémon care for plants and share herbal remedies. |',
      '2. Acorn Grove | Tree-root sleeping nooks and hanging hammocks. Energetic residents gather supplies and welcome visitors. | Gemini',
      '3. Fernshade Camp | Protected fern tents and woven resting mats. Patient caretakers look after smaller or newly recruited Pokémon. |',
      '4. Watcher’s Grove | Elevated lookout perches and lightweight canopy shelters. Disciplined scouts maintain patrol rotations. |',
      '5. Hearthstone Circle | Warm sleeping rolls around a safely enclosed camp lantern. Loyal companions enjoy social gatherings and guard duty. |',
      '6. Mushroom Rest | Shaded mushroom-themed tents with dim lanterns. Quiet residents offer rest and nighttime hospitality. | Nidorino',
    ].join('\n'),
  },
  ...[['sunshell-beach', 'Sunshell Beach', '🐚', '2–3 hr', '10–15 min'], ['mooncliff-mountains', 'Mooncliff Mountains', '🏔️', '5–7 hr', '15–20 min'],
    ['echo-cavern', 'Echo Cavern', '🕯️', '3–4 hr', '10–15 min'], ['crystal-lake', 'Crystal Lake', '💧', '2–3 hr', '10–15 min'],
    ['blossom-meadow', 'Blossom Meadow', '🌷', '1–2 hr', '5–10 min'], ['ancient-ruins', 'Ancient Ruins', '🏛️', '6–8 hr', '15–25 min'],
    ['whispering-falls', 'Whispering Falls', '🌊', '3–5 hr', '10–20 min']].map(([id, name, icon, onFoot, relayTime]) => ({ id, name, icon, onFoot, relayTime, loyalty: 0, spotsText: '' })),
];

// The Friend Zone Network: rules and lore shared by every location (GM can edit)
const NETWORK = [{
  id: 'network',
  about: 'The Friend Zone Network is a collection of portable Pokémon habitats established throughout the region. Recruited Pokémon live in environments that suit their species, develop relationships, help maintain the camps, and remain available when their rescue team needs them. Now, through the network, they help any Pokémon in need.\n\nUnlike permanent towns, these are expedition-style communities made of tents, tarps, modular shelters, movable furniture, and natural resting areas. Everything built by the guild can be dismantled and relocated during emergencies.',
  loyaltyText: 'Loyalty is the team’s relationship with a location. Every region starts at 0 🌸 because the team has never been there. Reaching a region for the first time earns 1 🌸.',
  typesText: [
    'The Sentinels | Serious, organized, and highly committed to rescue work. They enjoy drills, patrols, and structured assignments. They may become frustrated by careless behavior.',
    'The Caretakers | Like Beatrice, they look after everyone. They remember injuries, prepare meals, welcome new residents, and make sure the quieter Pokémon are included.',
    'The Social Butterflies | They want to meet new Pokémon, host games, trade stories, and help newcomers make friends. They enjoy guild events, but are not necessarily eager for dangerous missions.',
    'The Adventurers | Always eager to investigate unfamiliar places. They may volunteer for scouting assignments and bring back clues, rumors, or small discoveries.',
    'The Homebodies | They prefer familiar habitats and quieter routines. Some enjoy gardening, maintenance, crafts, or simply living among friends. They can still form strong bonds with their recruiting team.',
  ].join('\n'),
  relay: 'Every major encampment has an established communication and transport service known as the Friend Zone Relay Network. It exists so recruited Pokémon can live comfortably in their natural habitats without needing to remain physically attached to their rescue team.\n\nSpecial guild service: Abra’s and Ralts’s transport can come from relay equipment, trained teamwork, or a house-rule technique, rather than assuming every Ralts naturally knows Teleport.',
  relayRulesText: [
    '24/7 Service | One awake Abra or Ralts is always on duty at each staffed relay post.',
    'Safe Destinations | Transport connects registered, accessible relay stations.',
    'Travel Ready | Recruits maintain a packed travel kit and understand recall orders.',
    'Return Home | After deployment, recruits return to their assigned habitat.',
  ].join('\n'),
  staffText: [
    'Active Psychic | Awake, on-site, and available to initiate transport',
    'Relief Psychic | Resting or preparing to take over the next shift',
    'Camp Runner | Locates recruits and delivers deployment instructions',
    'Awning Coordinator | Manages large assemblies and emergency events',
  ].join('\n'),
  staffNote: 'At least one Abra or Ralts must remain awake and available at every functioning relay station: three eight-hour shifts, with backup staff where possible. Shift changes overlap so a station is never unattended. The eight outposts can share reserve personnel, and regular relay staff don’t count against player recruitment limits unless recruited onto an actual adventuring team.',
  pokemonRulesText: [
    'Recruits keep a personal travel pack with essential supplies.',
    'All recruits know their assigned home habitat and the route to their local relay station.',
    'Relays are free for authorized guild deployments; commercial or personal use follows separate guild policies.',
    'A Pokémon returning from danger should be offered medical assessment and recovery time.',
    'Recruits don’t have to accept every ordinary summons while injured, exhausted, or otherwise unavailable.',
    'During major story events, individual relay routes can be disrupted, as long as it’s established in the story.',
  ].join('\n'),
  campRulesText: [
    'Folding or collapsible support poles and weatherproof canvas.',
    'Portable lanterns, sleeping equipment, and removable signage.',
    'No permanent alterations to protected ruins or natural habitats.',
    'Prepacked evacuation containers.',
    'One shared supply inventory per camp.',
    'Clearly marked departure routes and safe relay assembly points.',
  ].join('\n'),
}];
// her characters walking in a camp's squares, per spot (her asks 10-29): the guild's crew in the Gravity Falls Guild, Chandelure and Maushold
// with the camp staff, Castform at
// Fernshade, Rayson the Wingull at Mossy Hollow, and Beatrice, who stays in the Woodland Base square itself ('camp')
const SPOT_CREW = { 'woodland-base': {
  'gravity-falls-guild': [{ name: 'Beautifly', label: 'Guildmaster Beautifly' }, { name: 'Pikachu', label: 'Mimi' }, { name: 'Mudkip', label: 'Kippy' },
    { name: 'Pikachu' }, { name: 'Squirtle' }],
  staff: [{ name: 'Chandelure' }, { name: 'Maushold', dex: '925' }],
  'fernshade-camp': [{ name: 'Castform' }],
  'mossy-hollow': [{ name: 'Wingull', label: 'Rayson' }],
  camp: [{ name: 'Beedrill', label: 'Beatrice', stay: true }],
  miltankshake: [{ name: 'Miltank' }],
} };
// everyone walking in a camp's squares, by the name players know them by (Gym training partners use this)
export const crewNames = (locId) => Object.values(SPOT_CREW[locId] || {}).flat().map((m) => String(m.label || m.name).replace(/^Guildmaster\s+/i, ''));
// map squares that aren't camp spots but open a box when tapped (her ask 10-29: the tent square is the Miltankshack)
const PLACES = { miltankshake: ['🥛 Miltankshack', 'Woodland Base’s milkshake shack. Miltank keeps the shakes coming for tired rescuers.'] };
const PATHS = { 'woodland-base': { 'chapter-2': [2], 'chapter-3-4-9': [3, 4, 9], 'chapter-5-7-8': [5, 7, 8], 'chapter-6': [6] } };
const NET_SCHEMA = [['about', 'About the network', 'area'], ['loyaltyText', 'What loyalty means', 'area'], ['typesText', 'Personality types — one per line: Name | description', 'area'],
  ['relay', 'Relay Network', 'area'], ['relayRulesText', 'Relay rules — one per line: Rule | description', 'area'],
  ['staffText', 'Relay staffing — one per line: Duty | responsibility', 'area'], ['staffNote', 'Staffing note', 'area'],
  ['pokemonRulesText', 'Pokémon rules — one per line', 'area'], ['campRulesText', 'Encampment rules — one per line', 'area']];
const network = () => merged('fznetwork', NETWORK)[0] || NETWORK[0];
const pairs = (t) => (t || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0]);
export const personalityTypes = () => pairs(network().typesText).map(([n]) => n);
const flowers = (n) => (Number(n) > 0 ? '🌸'.repeat(Math.min(5, Number(n))) : '');
const loyaltyLabel = (n) => (Number(n) > 0 ? flowers(n) : '0 🌸 · not visited yet');

function networkHTML(gm) {
  const n = network();
  const list = (t) => `<ul>${pairs(t).map(([a]) => `<li>${esc(a)}</li>`).join('')}</ul>`;
  const dl = (t) => pairs(t).map(([a, b]) => `<p><b>${esc(a)}:</b> ${esc(b || '')}</p>`).join('');
  return `<div class="card fz-net"><div class="row" style="justify-content:space-between"><h2 style="margin:0">🕸️ Friend Zone Network</h2>${gm ? '<button class="btn alt sm" id="fznetedit">Edit</button>' : ''}</div>
    ${(n.about || '').split('\n\n').map((x) => `<p>${esc(x)}</p>`).join('')}
    ${n.loyaltyText ? `<details><summary><b>🌸 Loyalty</b></summary><p>${esc(n.loyaltyText)}</p></details>` : ''}
    <details><summary><b>🗺️ Travel times from Woodland Base</b></summary><table class="fz-travel"><tr><th>Region</th><th>On foot</th><th>Relay</th></tr>
      ${locations().map((l) => `<tr><td><a href="#/friends/${esc(l.id)}">${esc(l.icon || '📍')} ${esc(l.name)}</a></td><td>${esc(l.onFoot || '—')}</td><td>${esc(l.relayTime || '—')}</td></tr>`).join('')}</table></details>
    <details><summary><b>🎭 Recruit personalities</b></summary>${dl(n.typesText)}</details>
    <details><summary><b>📮 The Psychic Relay Network</b></summary>${(n.relay || '').split('\n\n').map((x) => `<p>${esc(x)}</p>`).join('')}<h4>Operational rules</h4>${dl(n.relayRulesText)}
      <h4>Relay staffing</h4>${dl(n.staffText)}<p class="small">${esc(n.staffNote || '')}</p></details>
    <details><summary><b>📜 Pokémon rules</b></summary>${list(n.pokemonRulesText)}</details>
    <details><summary><b>⛺ Encampment rules</b></summary>${list(n.campRulesText)}</details></div>`;
}

const SCHEMA = [['name', 'Location'], ['icon', 'Icon (emoji)'], ['loyalty', 'Loyalty (0–5 🌸)'], ['onFoot', 'Travel on foot from Woodland Base'], ['relayTime', 'Relay arrival'],
  ['role', 'Role in the network', 'area'], ['welcome', 'Welcome text', 'area'], ['theme', 'Theme'],
  ['awning', 'Central awning', 'area'], ['caretaker', 'Caretaker', 'area'], ['sentinel', 'Sentinel'], ['relay', 'Relay station', 'area'],
  ['spotsText', 'Spots — one per line: Name | description | Pokémon living there (comma separated) | max player characters sleeping there (optional). Start a name with ↳ to make it a room inside the spot above it.', 'area']];

export const spots = (loc) => (loc.spotsText || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0])
  .map(([name, desc, mons, limit], i) => ({ i, key: name.replace(/^[^\w]*\d*\.?\s*/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 's' + i, name: name.replace(/^↳\s*/, ''), room: name.startsWith('↳'),
    limit: Math.max(0, parseInt(limit, 10) || 0), desc: desc || '', mons: (mons || '').split(',').map((x) => x.trim()).filter(Boolean) }));
// player characters sleeping in a spot (other than `exceptId`); a spot with a limit is full once this reaches it
export const spotSleepers = (locId, key, exceptId = '') => Object.values(store.get('party') || {}).filter((c) => !c.guest && c.id !== exceptId && c.sleep === locId + '|' + key);
export const spotFull = (locId, s, exceptId = '') => s.limit > 0 && spotSleepers(locId, s.key, exceptId).length >= s.limit;
export const locations = () => merged('friendzone', LOCATIONS);

// Friend Zone summary on the Guild page: one card per location, tap to open its camp.
export function friendZoneSection() {
  return `<div class="section-title"><h2>Friend Zone</h2><a class="small" href="#/friends">Network →</a></div>
  <div class="card fz-mini">${locations().map((l) => { const n = residents(l);
    return `<a class="fz-row" href="#/friends/${esc(l.id)}"><span class="fz-ic">${esc(l.icon || '📍')}</span><span class="fz-txt"><b class="fz-nm">${esc(l.name)}</b>
      <span class="fz-meta"><span class="fz-loy">${Number(l.loyalty) > 0 ? flowers(l.loyalty) : '0 🌸'}</span><span>relay ${esc(l.relayTime || '—')}</span><span class="${spots(l).length ? '' : 'muted'}">${spots(l).length ? `${n} resident${n === 1 ? '' : 's'}` : 'camp not set up'}</span></span></span></a>`; }).join('')}</div>`;
}
// her ask 10-29: the Fernshade Camp box lists the babies and eggs in Beatrice's nursery (each player's buddy, until it joins a team or flies the nest)
function nurseryHTML() {
  const party = store.get('party') || {};
  const kids = Object.entries(store.get('nursery') || {}).filter(([id, b]) => b && !b.recruited && party[id] && !party[id].guest);
  const sp = (k) => String(k || '').replace(/^./, (c) => c.toUpperCase());
  return `<div class="fz-nursery"><p class="small" style="margin:8px 0 4px"><b>🍼 In the nursery</b></p><div class="fz-mons">${kids.length ? kids.map(([id, b]) => `<span class="pill nursery">${!b.stage ? '🥚 Egg' : esc(b.name ? `${b.name} the ${sp(b.sp)}` : sp(b.sp))} <small>· ${esc(party[id].nickname)}’s</small></span>`).join('') : '<span class="small muted">No eggs or babies right now.</span>'}</div></div>`;
}
const residents = (l) => spots(l).reduce((s, x) => s + x.mons.length, 0) + Object.values(store.get('recruits/' + l.id) || {}).reduce((s, x) => s + Object.keys(x || {}).length, 0);

// a small private room inside a spot (e.g. the Guild's cellar): shows who has it and how many it fits
function roomHTML(loc, r) {
  const who = spotSleepers(loc.id, r.key); const full = r.limit > 0 && who.length >= r.limit;
  return `<div class="fz-room ${full ? 'full' : ''}"><div class="fz-room-hd"><b>${esc(r.name)}</b>${r.limit ? `<span class="pill fz-lock">🔒 ${r.limit === 1 ? 'One character only' : `${r.limit} characters max`}</span>` : ''}</div>
    ${r.desc ? `<p class="small">${esc(r.desc)}</p>` : ''}<div class="fz-mons">${r.mons.map((m) => `<span class="pill">${esc(m)}</span>`).join('')}${who.map((c) => `<span class="pill sleeper">💤 ${esc(c.nickname)}</span>`).join('')}${!who.length && !r.mons.length ? '<span class="small muted">Empty. Pick it as your sleeping spot to claim it.</span>' : ''}</div></div>`;
}

// who recruited each Pokémon (her ask 10-29), shown when you tap it on the map: a recruit's own `by`, else fzby/<key>, else these
const RECRUITED_BY = { sandile: 'Golett and Magnemite', nidorino: 'Golett, Magnemite and Gemini', pichu: 'Golett' };
const listOf = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '');
const moveKey = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
let fzAreas = [];   // the camp's areas and who is in each, from the last time the map was drawn (for the move picker)
const areaName = (loc, c) => (MAPS[loc.id]?.find((x) => x[0] === c.key)?.[5]) || PLACES[c.key]?.[0] || c.name || spots(loc).find((x) => x.key === c.key)?.name.replace(/^[^\w]*\d*\.?\s*/, '') || (c.key === 'staff' ? 'Camp staff' : c.key);
export function renderFriendZone(main, [arg]) {
  const gm = store.gmUnlocked();
  const lockdown = !!store.get('fzlockdown/' + arg) || (!arg && !!store.get('fzlockdown/' + (locations()[0] || {}).id));
  const list = locations();
  const loc = list.find((l) => l.id === arg) || list[0];
  if (!loc) { main.innerHTML = '<p>No locations yet.</p>'; return; }
  const recruits = store.get('recruits/' + loc.id) || {};
  const sleepers = Object.values(store.get('party') || {}).filter((c) => !c.guest && c.sleep && c.sleep.startsWith(loc.id + '|'));
  // player characters show only as their 💤 sleeping spot, never as a plain resident tag too
  const players = new Set(Object.values(store.get('party') || {}).filter((c) => !c.guest).map((c) => String(c.nickname || '').toLowerCase()));
  const spotMons = (s) => s.mons.filter((m) => !players.has(m.toLowerCase()));
  // her ask 10-29: Pokémon can be moved to another area (fzmove/<loc>/<name key> = { name, to }); a moved one leaves its
  // home area everywhere (the spot boxes and the map) and shows up in the new one
  const moves = store.get('fzmove/' + loc.id) || {};
  const movedAway = (name, key) => { const m = moves[moveKey(name)]; return !!m && m.to !== key; };
  const movedIn = (key) => Object.values(moves).filter((m) => m && m.to === key);
  main.innerHTML = `<div class="hero"><img class="hdr" src="assets/banners/guilds.jpg" alt=""></div>
    <a class="btn alt sm" href="#/guild" style="margin-top:12px">← Guild</a>
    <div class="row" style="justify-content:space-between;margin-top:8px"><h1 style="margin:0">Friend Zone</h1>${gm ? `<span class="row"><button class="btn sm ${lockdown ? '' : 'alt'} fz-lockbtn" id="fzlockdown">${lockdown ? '✅ End lockdown' : '🚨 Guild lockdown'}</button><button class="btn alt sm" id="fzedit">Edit ${esc(loc.name)}</button><button class="btn alt sm" id="fzadd">+ Location</button></span>` : ''}</div>
    <p class="small muted">Where recruited Pokémon live. Each location has its own camp.</p>
    ${list.length > 1 ? `<div class="fz-tabs">${list.map((l) => `<a class="btn ${l.id === loc.id ? '' : 'alt'} sm" href="#/friends/${esc(l.id)}">${esc(l.icon || '📍')} ${esc(l.name)}</a>`).join('')}</div>` : ''}
    <div class="card fz-head"><h2 style="margin:0 0 6px">${esc(loc.icon || '📍')} ${esc(loc.name)} <span class="fz-loyal${Number(loc.loyalty) > 0 ? '' : ' small muted'}" title="Loyalty">${loyaltyLabel(loc.loyalty)}</span></h2>
      <p class="small"><b>On foot:</b> ${esc(loc.onFoot || '—')} · <b>Relay:</b> ${esc(loc.relayTime || '—')}</p>
      ${loc.role ? `<p><i>${esc(loc.role)}</i></p>` : ''}${loc.welcome ? `<p>${esc(loc.welcome)}</p>` : ''}${!spots(loc).length ? `<p class="small muted">This camp hasn’t been set up yet.${gm ? ' Tap Edit to add its spots.' : ''}</p>` : ''}${loc.theme ? `<p class="small"><b>Theme:</b> ${esc(loc.theme)}</p>` : ''}</div>
    ${lockdown ? `<div class="card fz-alert-banner">🚨 <b>Guild lockdown!</b> Everyone is at their sleeping spot, ready to fight.</div>` : ''}
    <div class="fz-scene${lockdown ? ' fz-alert' : ''}" id="fzscene" data-alert="${lockdown ? 1 : 0}" aria-label="The camp's Pokémon at play"></div>
    <div class="fz-spots">${spots(loc).filter((s) => !s.room).map((s) => { const extra = Object.entries(recruits[s.key] || {});
      const rooms = []; for (const r of spots(loc).slice(s.i + 1)) { if (!r.room) break; rooms.push(r); }
      return `<div class="card fz-spot" data-spotkey="${esc(s.key)}"><h3 style="margin:0 0 4px">${esc(s.name)}</h3>${s.desc ? `<p class="small">${esc(s.desc)}</p>` : ''}
        <div class="fz-mons">${spotMons(s).filter((m) => !movedAway(m, s.key)).map((m) => `<span class="pill">${esc(m)}</span>`).join('')}${movedIn(s.key).map((m) => `<span class="pill moved">${esc(m.name)}</span>`).join('')}${extra.filter(([, r]) => !movedAway(r.name, s.key)).map(([id, r]) => `<span class="pill recruit">${esc(r.name)}${r.type ? ` <small>· ${esc(r.type.replace(/^The\s+/, ''))}</small>` : ''}${gm ? ` <button class="x" data-unrecruit="${esc(s.key)}/${id}" aria-label="Remove">×</button>` : ''}</span>`).join('')}${sleepers.filter((c) => c.sleep === loc.id + '|' + s.key).map((c) => `<span class="pill sleeper">💤 ${esc(c.nickname)}</span>`).join('')}${!spotMons(s).length && !extra.length && !sleepers.some((c) => c.sleep === loc.id + '|' + s.key) ? '<span class="small muted">Nobody lives here yet.</span>' : ''}</div>
        ${s.key === 'fernshade-camp' ? nurseryHTML() : ''}<button class="btn alt sm" data-recruit="${esc(s.key)}">+ Recruit or move here</button>${rooms.map((r) => roomHTML(loc, r)).join('')}</div>`; }).join('')}</div>
    <div class="card fz-staff">
      ${loc.awning ? `<p><b>⛺ Central awning:</b> ${esc(loc.awning)}</p>` : ''}${loc.caretaker ? `<p><b>🐝 Caretaker:</b> ${esc(loc.caretaker)}</p>` : ''}
      ${loc.sentinel ? `<p><b>🛡️ Sentinel:</b> ${esc(loc.sentinel)}</p>` : ''}${loc.relay ? `<p><b>📮 Relay station:</b> ${esc(loc.relay)}</p>` : ''}</div>
    ${networkHTML(gm)}`;   // her call: the network explainer sits at the bottom, under the camp
  // her asks 10-29: the camp's Pokémon roam and play, Cube World style: one cube room per spot (its residents, recruits
  // and any player characters sleeping there, rooms inside it included), plus a cube for the camp's staff
  { const ok = (n) => n && n.split(/\s+/).length <= 4 && !/guild|team|members/i.test(n);
    const all = spots(loc); const cubes = all.filter((x) => !x.room).map((x) => { const keys = [x.key]; for (const r of all.slice(x.i + 1)) { if (!r.room) break; keys.push(r.key); }
      return { key: x.key, name: x.name.replace(/^[^\w]*\d*\.?\s*/, ''), mons: [...spotMons(x).filter(ok).map((n) => ({ name: n })), ...keys.flatMap((k) => Object.values(recruits[k] || {})).map((r) => ({ name: r.name })),
        ...sleepers.filter((c) => keys.some((k) => c.sleep === loc.id + '|' + k)).map((c) => ({ name: c.pokemon || '', label: c.nickname }))].filter((m) => ok(m.name)) }; });
    // a long piece ('Ralts rotate shifts beside ...') keeps its first word, the Pokémon (her ask 10-29: add Ralts)
    const staff = [loc.sentinel, loc.caretaker, loc.relay].filter(Boolean).flatMap((t) => String(t).split(/[—–,]| and /).slice(0, 3)).map((t) => t.trim())
      .map((t) => (ok(t) ? t : t.split(/\s+/)[0])).filter(ok).map((t) => ({ name: t, label: t.split(/\s+/).slice(0, 3).join(' ') }));
    if (staff.length) cubes.unshift({ key: 'staff', name: 'Camp staff', mons: staff });
    // her ask 10-29: the guild's own crew lives in the Gravity Falls Guild square (it's a big 2x2 square, so room for more)
    const tag = (m) => m.label || m.name;
    for (const [key, crew] of Object.entries(SPOT_CREW[loc.id] || {})) {
      let cube = cubes.find((x) => x.key === key);
      if (!cube) { cube = { key, name: key === 'camp' ? loc.name : '', mons: [] }; cubes.push(cube); }
      cube.mons = [...crew, ...cube.mons.filter((m) => !crew.some((g) => tag(g) === tag(m)))];
      if (key === 'gravity-falls-guild') cube.max = 12;   // the big 2x2 square, so room for the whole crew
    }
    // her asks 10-29: map squares that are locked paths on to later chapters (bottom-left = Chapter 2; top-left waterfall =
    // Chapters 3, 4 and 9; top-left forest strip = 5, 7 and 8; bottom-right = 6). A square opens once the GM sets the guild's chapter to its first chapter; each chapter shows its own lock
    const ch = Number(store.get('guild')?.chapter) || 0; const chList = merged('chapters', CHAPTERS, (c) => 'ch' + c.n);
    const pathName = (ns) => `Path to Chapter${ns.length > 1 ? 's' : ''} ${ns.length > 1 ? ns.slice(0, -1).join(', ') + ' & ' + ns[ns.length - 1] : ns[0]}`;
    for (const [key, ns] of Object.entries(PATHS[loc.id] || {})) cubes.push({ key, name: pathName(ns), mons: [], locked: ch < Math.min(...ns) });
    const placeCard = (key) => { const d = document.createElement('div'); d.className = 'card fz-place'; d.innerHTML = `<h3 style="margin:0 0 4px">${esc(PLACES[key][0])}</h3><p>${esc(PLACES[key][1])}</p>`; return d; };
    const pathCard = (key) => { const ns = PATHS[loc.id][key]; const d = document.createElement('div'); d.className = 'card fz-path';
      d.innerHTML = `<h3 style="margin:0 0 4px">${ch < Math.min(...ns) ? '🔒 ' : ''}${esc(pathName(ns))}</h3>${ns.map((n) => { const c = chList.find((x) => Number(x.n) === n);
        return `<p>${ch < n ? '🔒' : '✅'} <b>Chapter ${n}${c?.title && c.title !== 'Chapter ' + n ? `: ${esc(c.title)}` : ''}</b>${c?.quote ? `<br><i>“${esc(c.quote)}”</i>` : ''}</p>`; }).join('')}
        <p class="small">${ns.every((n) => ch >= n) ? 'The trail is open.' : `Each part of this trail opens when the story reaches its chapter.`}</p>`; return d; };
    const box = $('#fzscene', main);
    if (box) {
      const mapped = !!MAPS[loc.id];
      cubes.forEach((x) => { if (!x.key) x.key = 'staff'; });
      for (const m of Object.values(moves)) {
        if (!m?.to) continue;
        let mon = null;
        for (const c of cubes) { const i = c.mons.findIndex((x) => moveKey(x.label || x.name) === moveKey(m.name)); if (i >= 0) { [mon] = c.mons.splice(i, 1); break; } }
        let to = cubes.find((c) => c.key === m.to); if (!to) { to = { key: m.to, name: '', mons: [] }; cubes.push(to); }
        if (!to.locked) to.mons.push(mon || { name: m.name });
      }
      const byOf = (n) => store.get('fzby/' + moveKey(n)) || RECRUITED_BY[moveKey(n)] || RECRUITED_BY[moveKey(String(n).split(/\s+/).pop())] || '';
      const recBy = new Map(Object.values(recruits).flatMap((x) => Object.values(x || {})).filter((r) => r?.by).map((r) => [moveKey(r.name), r.by]));
      cubes.forEach((c) => c.mons.forEach((x) => { const by = recBy.get(moveKey(x.label || x.name)) || byOf(x.label || x.name) || byOf(x.name); if (by) x.by = by; }));
      fzAreas = cubes.filter((c) => !c.locked).map((c) => ({ key: c.key, name: areaName(loc, c), mons: c.mons.map((x) => x.label || x.name) }));
      mountFzScene(box, mapped ? cubes : cubes.filter((x) => x.mons.length), mapped ? loc.id : '');
      // on a map camp the spot boxes live inside their squares. Tap a square (her ask 10-29): it zooms in to a big view
      // of its picture with its own Pokémon walking around, and its box underneath (the real box moves into the popup so
      // Recruit and the GM buttons keep working, and moves back when it closes; the staff and Woodland Base squares show a copy of the staff box and the camp box)
      if (mapped) {
        const holder = $('.fz-spots', main); if (holder) holder.classList.add('fz-hidden');
        box.addEventListener('fzspot', (e) => {
          const key = e.detail; const sq = $(`.fzs-cube[data-key="${key}"]`, box);
          const img = ZOOM_PICS[key] || (MAPS[loc.id].find((x) => x[0] === key) || [])[1]; const cube = cubes.find((x) => x.key === key);
          const card = $(`.fz-spot[data-spotkey="${key}"]`, main) || (key === 'staff' ? $('.fz-staff', main)?.cloneNode(true) : key === 'camp' ? $('.fz-head', main)?.cloneNode(true) : PATHS[loc.id]?.[key] ? pathCard(key) : PLACES[key] ? placeCard(key) : null);
          if (!card) return;
          const el = modal(`<div class="fz-zoom"${img ? ` style="background-image:url(${img}?v=4)"` : ''}></div><div class="fz-pop"></div>`);
          $('.fz-pop', el).appendChild(card);
          const zoom = $('.fz-zoom', el);
          if (sq) { const a = sq.getBoundingClientRect(); const b = zoom.getBoundingClientRect();
            if (b.width) zoom.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width})` }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.2, .8, .2, 1)' }); }
          if (lockdown) { zoom.dataset.alert = '1'; zoom.classList.add('fz-alert'); }
          if (img) mountFzScene(zoom, [{ key, mons: [], ...cube, max: Math.max(8, cube?.max || 0) }], '', img);
          if (card.classList.contains('fz-spot')) {
            const back = () => { if (!card.isConnected || card.closest('.fz-pop')) holder.appendChild(card); };
            window.addEventListener('modalclosed', back, { once: true });
          }
        });
      }
    } }
  $$('[data-recruit]', main).forEach((b) => b.onclick = () => {
    const here = areaName(loc, { key: b.dataset.recruit });
    const players = Object.values(store.get('party') || {}).filter((c) => !c.guest && c.nickname);
    const isName = (n) => /^[A-Z][\w'’. -]+$/.test(n) && n.length > 2 && !/relay|organizes/i.test(n);   // no stray staff notes
    const others = fzAreas.filter((a) => a.key !== b.dataset.recruit).map((a) => ({ ...a, mons: a.mons.filter(isName) })).filter((a) => a.mons.length);
    const el = modal(`<h2>New recruit</h2><label class="f">Pokémon (name or species)<input id="rcname"></label>
      ${players.length ? `<p class="f" style="margin:8px 0 2px"><b>Recruited by</b></p><div class="row rc-by">${players.map((c) => `<label class="check"><input type="checkbox" value="${esc(c.nickname)}" ${c.id === myId() ? 'checked' : ''}> ${esc(c.nickname)}</label>`).join('')}</div>` : ''}
      <label class="f">Personality<select id="rctype"><option value="">—</option>${personalityTypes().map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>
      <button class="btn block" id="rcgo" style="margin-top:10px">Move in</button>
      ${others.length ? `<h2 style="margin-top:18px">Move a Pokémon here</h2><p class="small muted">Someone from another area of ${esc(loc.name)} moves to ${esc(here)}.</p>
      <label class="f">Pokémon<select id="mvname">${others.map((a) => `<optgroup label="${esc(a.name)}">${a.mons.map((n) => `<option>${esc(n)}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <button class="btn block" id="mvgo" style="margin-top:10px">🔀 Move here</button>` : ''}`);
    const mv = $('#mvgo', el); if (mv) mv.onclick = () => {
      const name = $('#mvname', el).value; if (!name) return;
      store.set(`fzmove/${loc.id}/${moveKey(name)}`, { name, to: b.dataset.recruit, t: Date.now() });
      store.pushLimited('log', { t: Date.now(), text: `${name} moved to ${here} in ${loc.name}’s Friend Zone.` });
      closeModal(); toast(`${name} moved to ${here}!`); renderFriendZone(main, [loc.id]);
    };
    $('#rcgo', el).onclick = () => {
      const name = $('#rcname', el).value.trim(); if (!name) return;
      const by = listOf($$('.rc-by input:checked', el).map((x) => x.value));
      store.set(`recruits/${loc.id}/${b.dataset.recruit}/${store.tid()}`, { name, type: $('#rctype', el).value, t: Date.now(), ...(by ? { by } : {}) });
      store.pushLimited('log', { t: Date.now(), text: `${name} joined ${loc.name}’s Friend Zone${by ? ` (recruited by ${by})` : ''}.` });
      // her ask 10-29: each recruiter gets a letter saying who joined and where to find them
      const where = `${loc.name}’s Friend Zone${here ? `, at ${here}` : ''}`;
      for (const c of players.filter((x) => $$('.rc-by input:checked', el).some((i) => i.value === x.nickname)))
        giftNote(c.id, '🤝', `${name} joined the guild!`, `Thanks to you${by.includes(' and ') ? ` and ${listOf(by.split(/, | and /).filter((n) => n !== c.nickname))}` : ''}, ${name} is now part of the guild. You can find them in ${where}. Do drop by and say hello! — Guildmaster Beautifly`);
      // her ask 10-29: a recruit is news in Around the Guild
      guildSay('Guildmaster Beautifly', 'say', `Everyone, please welcome ${name} to ${loc.name}${here ? `, moving in at ${here}` : ''}!${by ? ` Thank you, ${by}, for bringing them in.` : ''}`, 'recruit');
      closeModal(); toast(`${name} moved in!`); renderFriendZone(main, [loc.id]);
    };
  });
  const ne = $('#fznetedit', main);
  if (ne) ne.onclick = () => editContent('fznetwork', NET_SCHEMA, network(), { title: 'Edit the Friend Zone Network', onSave: () => renderFriendZone(main, [loc.id]) });
  $$('[data-unrecruit]', main).forEach((b) => b.onclick = () => { store.set(`recruits/${loc.id}/${b.dataset.unrecruit}`, null); renderFriendZone(main, [loc.id]); });
  // her ask 10-29: the GM's guild lockdown button; shared, so every player's map switches over (and back) live
  const lk = $('#fzlockdown', main);
  if (lk) lk.onclick = () => {
    store.set('fzlockdown/' + loc.id, lockdown ? null : { t: Date.now() });
    store.pushLimited('log', { t: Date.now(), text: lockdown ? `The lockdown at ${loc.name} is over. Everyone can relax.` : `🚨 Guild lockdown at ${loc.name}! Everyone to their sleeping spots, ready to fight.` });
    toast(lockdown ? 'Lockdown ended' : '🚨 Guild lockdown!'); renderFriendZone(main, [loc.id]);
  };
  const unsub = store.subscribe(() => {
    if (!main.contains(lk || $('#fzscene', main))) { unsub(); return; }
    if (!!store.get('fzlockdown/' + loc.id) !== lockdown && !document.querySelector('.fz-pop')) { unsub(); renderFriendZone(main, [loc.id]); }
  });
  const ed = $('#fzedit', main);
  if (ed) ed.onclick = () => editContent('friendzone', SCHEMA, loc, { title: 'Edit ' + loc.name, onSave: () => renderFriendZone(main, [loc.id]) });
  const ad = $('#fzadd', main);
  if (ad) ad.onclick = () => editContent('friendzone', SCHEMA, null, { title: 'New location', onSave: () => renderFriendZone(main, []) });
}

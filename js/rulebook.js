// Rulebook: quick lookup from inside the game. Index of every effect/interaction, rules, story, cast, guild, items, handouts, links, credits.
import * as store from './store.js?v=6ae39064';
import * as sheet from './sheetdata.js?v=6ae39064';
import { $, $$, esc } from './util.js?v=6ae39064';
import { portrait } from './ui.js?v=6ae39064';
import { STATUSES, STATUS_IX, NATURES, TYPES, LOOT, SPECIAL_ROLLS, QUICK_TASKS, QUICK_SOCIAL, DUNGEON_EVENTS, RULES, CHAPTERS, CAST, RANKS, GUILDS, WORLD, ITEM_PAGES, ITEM_KINDS, GARMENTS, ITEM_ART, RARITY_ART, HANDOUTS, QUICK_LINKS, INTRO, FAILURE_RULES, MISSION_TYPES, MISSION_GP, DISCLAIMER } from './content.js?v=6ae39064';
import { loadIndex, linkify, INDEX_SCHEMA } from './effects.js?v=6ae39064';
import { merged, editContent } from './content-store.js?v=6ae39064';
import { pageHTML, navHTML, navTilesHTML } from './sitepages.js?v=6ae39064';

const gm = () => store.gmUnlocked();
const editBtn = (attr) => (gm() ? `<button class="btn alt sm" ${attr}>Edit</button>` : '');
const addBtn = (attr, label = '+ Add') => (gm() ? `<button class="btn alt sm" ${attr}>${label}</button>` : '');

export const RULE_SCHEMA = [['title', 'Title'], ['body', 'Paragraphs', 'lines'], ['list', 'Bullet points', 'lines'], ['img', 'Handout image name (optional)'], ['art', 'Extra picture (path or link, optional)']];
export const CHAPTER_SCHEMA = [['n', 'Chapter number', 'number'], ['title', 'Title'], ['quote', 'Quote'], ['rank', 'Rank'], ['promo', 'Promotion'], ['status', 'Status', 'select:|in progress|complete'], ['art', 'Chapter medallion (path or link, optional)'], ['scene', 'Chapter picture (path or link, optional)'], ['opening', 'Opening text', 'area'], ['recap', 'Last time… (one per line)', 'lines'], ['events', 'What happened (one per line)', 'lines']];
export const CAST_SCHEMA = [['name', 'Name'], ['species', 'Species'], ['portrait', 'Portrait file (e.g. cleffa)'], ['art', 'Character art (path or link, optional)'], ['nature', 'Nature'], ['text', 'About', 'area']];
export const RANK_SCHEMA = [['n', 'Order', 'number'], ['name', 'Name'], ['alt', 'Also called'], ['gp', 'Guild Points needed', 'number'], ['req', 'Requirements', 'lines'], ['rewards', 'Rewards', 'lines'], ['missions', 'Missions unlocked'], ['recruit', 'Recruiting Power', 'number']];
export const RIVAL_SCHEMA = [['name', 'Team name'], ['banner', 'Banner picture (path or link, optional)'], ['members', 'Members (Pokémon)', 'list'], ['text', 'About', 'lines']];

export const rules = () => merged('rules', RULES);
export const chapters = () => merged('chapters', CHAPTERS, (c) => 'ch' + c.n).sort((a, b) => (a.n ?? 99) - (b.n ?? 99));
export const cast = () => merged('cast', CAST);
export const ranks = () => merged('ranks', RANKS).sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
export const rivals = () => merged('rivals', GUILDS.rivals.map((r) => ({ ...r, members: r.members.map((m) => m[0]) })));

export async function renderRules(main, [sub, arg]) {
  const ix = await loadIndex();
  const L = (t) => linkify(t, ix);
  // Link to the full copy of a page from the GM's Google Site
  const gs = (key, title = 'From the campaign site') => `<a class="card linkcard" href="#/rules/site/${key}"><b>${esc(title.replace(/ — from the campaign site$/, ''))}</b><span>Read the full page from the campaign site, with all its pictures →</span></a>`;
  const gsOld = (key, title = 'From the campaign site', open = true, fromHeading = false) => {
    let b = GS_TEXT[key] || [];
    if (fromHeading) { const i = b.findIndex((x) => x[0] === 'h'); if (i > 0) b = b.slice(i); }
    if (!b.length) return '';
    let h = '', ul = false;
    for (const [k, t] of b) {
      if (k === 'li' && !ul) { h += '<ul>'; ul = true; }
      if (k !== 'li' && ul) { h += '</ul>'; ul = false; }
      h += k === 'h' ? `<h4>${esc(t)}</h4>` : k === 'li' ? `<li>${L(t)}</li>` : `<p>${L(t)}</p>`;
    }
    if (ul) h += '</ul>';
    return `<details class="card gs"${open ? ' open' : ''}><summary>${esc(title)}</summary>${h}</details>`;
  };
  const RULE_GS = { 'new-character': 'how-to-play_new-character', combat: 'how-to-play_beginner-mechanics_combat-and-movement', traps: 'how-to-play_beginner-mechanics_traps-and-hazards', evolution: 'how-to-play_advanced-mechanics_evolution', training: 'how-to-play_advanced-mechanics_training', recruiting: 'how-to-play_advanced-mechanics_recruiting', directing: 'how-to-play_advanced-mechanics_directing-teammates' };
  // every inner page: the top back button plus a floating one that stays on screen while scrolling (her ask)
  const back = '<a class="btn alt sm" href="#/rules">← Rulebook</a><a class="btn dark fab" href="#/rules" title="Back to the Rulebook">📖 Rulebook</a>';
  const pages = {
    '': hub, world: worldPage, site: sitePageView, coverage, index: indexPage, r: rulePage, story, cast: castPage, ranks: ranksPage, rivals: rivalsPage, items: itemsPage, handouts, links, credits,
  };
  (pages[sub || ''] || hub)();

  function hub() {
    main.innerHTML = `
      <div class="hero"><img class="hdr" src="assets/banners/how_to_play.jpg" alt=""></div>
      <h1>Rulebook</h1>
      <div class="search sbar" role="search"><span class="sbar-ico" aria-hidden="true">🔍</span><input id="q" type="search" enterkeyhint="search" placeholder="Search the index: rules, effects, moves, items…" autocomplete="off" aria-label="Search the rulebook"><button class="sbar-x" type="button" aria-label="Clear search" hidden>✕</button></div>
      <div id="results"></div>
      <div class="section-title"><h2>Your campaign site</h2></div>
      ${navTilesHTML()}
      <div class="section-title"><h2>Look things up</h2></div>
      <div class="toc">
        <a href="#/rules/index">Index of everything</a><a href="#/rules/r/dice">Rolling dice</a><a href="#/rules/r/combat">Combat</a>
        <a href="#/rules/index/Status">Status conditions</a><a href="#/rules/index/Trap">Traps</a><a href="#/rules/index/Move">Moves</a><a href="#/rules/index/Ability">Abilities</a><a href="#/rules/items">Items</a>
      </div>
      <div class="section-title"><h2>Rules</h2>${addBtn('id="addrule"', '+ Rule page')}</div>
      <div class="toc">${rules().map((r) => `<a href="#/rules/r/${esc(r.id)}">${esc(r.title)}</a>`).join('')}</div>
      <div class="section-title"><h2>The campaign</h2></div>
      <div class="toc"><a href="#/rules/world">World, guilds & NPCs</a><a href="#/rules/story">Story & chapters</a><a href="#/rules/cast">Meet the characters</a><a href="#/rules/ranks">Guild ranks</a><a href="#/rules/rivals">Rival teams</a><a href="#/rules/handouts">Handouts</a><a href="#/rules/links">Campaign links</a><a href="#/rules/credits">Credits</a><a href="#/rules/coverage">Index coverage check</a></div>`;
    const res = $('#results', main);
    $('#q', main).oninput = (e) => { const q = e.target.value.trim(); res.innerHTML = q ? resultsHTML(search(q).slice(0, 30)) : ''; };
    wireSbar(main);
    const a = $('#addrule', main); if (a) a.onclick = () => editContent('rules', RULE_SCHEMA, null, { title: 'New rule page', onSave: () => renderRules(main, [sub]) });
  }

  // the ✕ in the search bar: shows while there's text, clears it and puts the cursor back
  function wireSbar(root) {
    const q = $('#q', root); const x = $('.sbar-x', root); if (!q || !x) return;
    const show = () => { x.hidden = !q.value; };
    q.addEventListener('input', show);
    x.onclick = () => { q.value = ''; q.dispatchEvent(new Event('input')); q.focus(); };
  }

  function search(q, kind) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = [];
    for (const e of ix.list) {
      if (kind && e.kind !== kind) continue;
      const name = e.name.toLowerCase(); const aka = (e.aka || []).join(' ').toLowerCase();
      const body = [e.outcome, e.trigger, e.roll, e.removal, e.duration].join(' ').toLowerCase();
      let s = 0;
      for (const w of words) {
        if (name === w || aka.split(/\s*,\s*|\s+/).includes(w)) s += 10;
        else if (name.startsWith(w)) s += 6; else if (name.includes(w)) s += 4; else if (aka.includes(w)) s += 4;
        else if (body.includes(w)) s += 1; else { s = 0; break; }
      }
      if (s) scored.push([s, e]);
    }
    for (const r of rules()) {
      const t = [r.title, ...(r.body || []), ...(r.list || [])].join(' ').toLowerCase();
      if (words.every((w) => t.includes(w))) scored.push([words.some((w) => r.title.toLowerCase().includes(w)) ? 7 : 1, { id: 'rule:' + r.id, name: r.title, kind: 'Rule page', outcome: (r.body || [])[0] || '' }]);
    }
    return scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name)).map((x) => x[1]);
  }

  function resultsHTML(list) {
    if (!list.length) return '<p class="muted">Nothing found. Try another word.</p>';
    return `<div class="card" style="padding:4px 10px">${list.map((e) => e.id.startsWith('rule:')
      ? `<a class="ixrow" href="#/rules/r/${esc(e.id.slice(5))}"><span class="pill k">Rule page</span><b>${esc(e.name)}</b><p>${esc(e.outcome)}</p></a>`
      : `<a class="ixrow" href="#" data-ix="${esc(e.id)}"><span class="pill k">${esc(e.kind || '')}</span><b>${esc(e.name)}</b><p>${esc(e.outcome || e.trigger || '')}</p></a>`).join('')}</div>`;
  }

  function indexPage() {
    const kinds = [...new Set(ix.list.map((e) => e.kind).filter(Boolean))].sort();
    let kind = arg ? decodeURIComponent(arg) : '';
    main.innerHTML = `${back}<h1 style="margin-top:10px">Index</h1>
      <p class="small muted">Every effect and interaction in the game — ${ix.list.length} entries. Tap one to read it; underlined words anywhere on the site open here too.</p>
      <div class="search sbar" role="search"><span class="sbar-ico" aria-hidden="true">🔍</span><input id="q" type="search" enterkeyhint="search" placeholder="Search the index (try: burn, dodge, trap, money)…" autocomplete="off" aria-label="Search the index"><button class="sbar-x" type="button" aria-label="Clear search" hidden>✕</button></div>
      <div class="filters"><button class="chip ${kind ? '' : 'sel'}" data-k="">All</button>${kinds.map((k) => `<button class="chip ${k === kind ? 'sel' : ''}" data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div>
      ${addBtn('id="addix"', '+ New entry')}
      <div id="results"></div>`;
    const draw = () => { const q = $('#q', main).value.trim(); const list = q ? search(q, kind) : ix.list.filter((e) => !kind || e.kind === kind); $('#results', main).innerHTML = resultsHTML(list.slice(0, 300)) + (list.length > 300 ? `<p class="muted small">${list.length - 300} more — search to narrow it down.</p>` : ''); };
    $('#q', main).oninput = draw; wireSbar(main);
    $$('[data-k]', main).forEach((b) => b.onclick = () => { kind = b.dataset.k; $$('[data-k]', main).forEach((x) => x.classList.toggle('sel', x === b)); draw(); });
    const a = $('#addix', main); if (a) a.onclick = () => editContent('index', INDEX_SCHEMA, null, { title: 'New Index entry', onSave: () => renderRules(main, [sub, arg]) });
    draw();
  }

  function rulePage() {
    const r = rules().find((x) => x.id === arg);
    if (!r) { main.innerHTML = `${back}<p>That page doesn't exist.</p>`; return; }
    main.innerHTML = `<div class="row" style="justify-content:space-between">${back}${editBtn('id="ed"')}</div>
      <h1 style="margin-top:10px">${esc(r.title)}</h1>
      <div class="card">${(r.body || []).map((p) => `<p>${L(p)}</p>`).join('')}${(r.list || []).length ? `<ul>${r.list.map((p) => `<li>${L(p)}</li>`).join('')}</ul>` : ''}</div>
      ${RULE_GS[r.id] ? gs(RULE_GS[r.id]) : ''}
      ${r.art ? `<a class="handout" href="${esc(r.art)}" target="_blank" style="max-width:520px;margin-bottom:12px"><img src="${esc(r.art)}" alt="" loading="lazy" style="aspect-ratio:auto"><span>Tap to open full size</span></a>` : ''}
      ${r.img ? `<a class="handout" href="assets/handouts/${esc(r.img)}.jpg" target="_blank" style="max-width:520px"><img src="assets/handouts/${esc(r.img)}.jpg" alt="${esc(r.title)} handout" loading="lazy" style="aspect-ratio:auto"><span>GM handout — tap to open full size</span></a>` : ''}`;
    const e = $('#ed', main); if (e) e.onclick = () => editContent('rules', RULE_SCHEMA, r, { title: 'Edit ' + r.title, onSave: () => renderRules(main, [sub, arg]) });
  }

  function sitePageView() {
    main.innerHTML = `${back}${pageHTML(arg || 'home', L)}`;
  }

  function story() {
    const g = store.get('guild') || {};
    main.innerHTML = `<div class="row" style="justify-content:space-between">${back}${addBtn('id="addch"', '+ Chapter')}</div>
      <h1 style="margin-top:10px">Story & Guild Rank Progression</h1>
      <div class="card emblem"><div class="win">${esc(INTRO.humanity)}<br><br>${esc(INTRO.instinct)}</div></div>
      ${chapters().map((c) => { const medal = c.art || (c.n >= 0 && c.n <= 10 ? `assets/gs/ch${c.n}_medal.jpg` : ''); const scene = c.scene || (c.n === 0 || c.n === 1 ? `assets/gs/ch${c.n}_scene.jpg` : ''); return `<div class="card">
        <div class="row nowrap" style="justify-content:space-between">${medal ? `<img class="medal" src="${esc(medal)}" alt="" loading="lazy">` : ''}<h2 style="margin:0" class="grow">Chapter ${c.n} — ${esc(c.title)}</h2>${editBtn(`data-ed="${esc(c.id)}"`)}</div>
        <p class="muted"><i>“${esc(c.quote || '')}”</i></p>
        <p class="small"><span class="pill">${esc(c.rank || '')}</span> ${c.promo ? `<span class="pill">Promotion: ${esc(c.promo)}</span>` : ''} ${c.status ? `<span class="pill">${esc(c.status)}</span>` : ''} ${g.chapter === c.n ? '<span class="pill" style="background:var(--orange);color:#fff">current</span>' : ''}</p>
        ${c.opening ? `<p>${L(c.opening)}</p>` : ''}
        ${(c.recap || []).length ? `<h4>Last time…</h4><ul>${c.recap.map((t) => `<li>${L(t)}</li>`).join('')}</ul>` : ''}
        ${(c.events || []).length ? `<h4>What happened</h4><ul>${c.events.map((t) => `<li>${L(t)}</li>`).join('')}</ul>` : ''}
        ${scene ? `<span><img class="art-wide" src="${esc(scene)}" alt="" loading="lazy"></span>` : ''}
        ${c.n === 0 ? gs('story-guild-rank-progression_chapter-0-the-voice-of-the-forest', 'Chapter page from the campaign site', false) : c.n === 1 ? gs('story-guild-rank-progression_chapter-1-earthquake-at-woodland-base', 'Chapter page from the campaign site', false) : ''}
      </div>`; }).join('')}
      <a class="handout" href="assets/gs/story_ranks.jpg" target="_blank" style="max-width:520px"><img src="assets/gs/story_ranks.jpg" alt="Story and guild rank progression" loading="lazy" style="aspect-ratio:auto"><span>Story & Guild Rank Progression — tap to open full size</span></a>`;
    $$('[data-ed]', main).forEach((b) => b.onclick = () => editContent('chapters', CHAPTER_SCHEMA, chapters().find((c) => c.id === b.dataset.ed), { onSave: () => renderRules(main, [sub]) }));
    const a = $('#addch', main); if (a) a.onclick = () => editContent('chapters', CHAPTER_SCHEMA, null, { title: 'New chapter', onSave: () => renderRules(main, [sub]) });
  }

  function castPage() {
    main.innerHTML = `<div class="row" style="justify-content:space-between">${back}${addBtn('id="add"', '+ Character')}</div>
      <h1 style="margin-top:10px">Meet the Characters</h1>
      <div class="grid g2">${cast().map((c) => `<div class="card">${c.art ? `<span><img class="cast-art" src="${esc(c.art)}" alt="${esc(c.name)}" loading="lazy"></span>` : ''}<div class="char-head">${portrait({ ...c, nickname: c.name })}${c.portrait2 ? portrait({ portrait: c.portrait2, nickname: c.name }) : ''}<div class="grow">
        <div class="char-name">${esc(c.name)}</div><div class="char-sub">${esc(c.species || '')}${c.nature ? ' · ' + esc(c.nature) : ''}</div></div>${editBtn(`data-ed="${esc(c.id)}"`)}</div>
        <p style="margin-top:10px">${L(c.text)}</p></div>`).join('')}</div>
      ${gs('meet-the-characters', 'Full character bios from the campaign site', false)}`;
    $$('[data-ed]', main).forEach((b) => b.onclick = () => editContent('cast', CAST_SCHEMA, cast().find((c) => c.id === b.dataset.ed), { onSave: () => renderRules(main, [sub]) }));
    const a = $('#add', main); if (a) a.onclick = () => editContent('cast', CAST_SCHEMA, null, { title: 'New character', onSave: () => renderRules(main, [sub]) });
  }

  function ranksPage() {
    main.innerHTML = `<div class="row" style="justify-content:space-between">${back}${addBtn('id="add"', '+ Rank')}</div>
      <h1 style="margin-top:10px">Guild Ranks & Rewards</h1>
      ${ranks().map((r) => `<div class="card"><div class="rank-row"><div class="rank-n">${r.n ?? ''}</div><div class="grow">
        <div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(r.name)} <span class="muted small">[${esc(r.alt || '')}]</span></h3>${editBtn(`data-ed="${esc(r.id)}"`)}</div>
        <p class="small"><b>Needs:</b> ${(r.req || []).map(L).join(' · ')}</p>
        <p class="small"><b>Rewards:</b> ${(r.rewards || []).map(L).join(' · ')}</p>
        <p class="small"><span class="pill">Missions: ${esc(r.missions || '—')}</span> <span class="pill">Recruiting power: ${r.recruit === Infinity || r.recruit == null ? 'unlimited' : r.recruit}</span></p></div></div></div>`).join('')}
      <div class="card"><h3>Mission failure & losses</h3><ul>${FAILURE_RULES.map((t) => `<li>${L(t)}</li>`).join('')}</ul></div>
      <div class="card"><h3>Mission types</h3>${Object.entries(MISSION_TYPES).map(([k, list]) => `<h4>${k} Rank ${MISSION_GP[k] ? `(${MISSION_GP[k]} GP)` : '(special rewards)'}</h4><ul class="small">${list.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`).join('')}</div>
      <img src="assets/handouts/guild_rank.jpg" alt="Guild ranks handout" style="border-radius:10px;max-width:520px;width:100%" loading="lazy">
      <div class="grid g2" style="margin-top:12px"><a class="handout" href="assets/gs/story_ranks.jpg" target="_blank"><img src="assets/gs/story_ranks.jpg" alt="" loading="lazy" style="aspect-ratio:auto"><span>Story & rank progression</span></a><a class="handout" href="assets/gs/mission_ranks.jpg" target="_blank"><img src="assets/gs/mission_ranks.jpg" alt="" loading="lazy" style="aspect-ratio:auto"><span>Missions, items & garments</span></a></div>`;
    $$('[data-ed]', main).forEach((b) => b.onclick = () => editContent('ranks', RANK_SCHEMA, ranks().find((c) => c.id === b.dataset.ed), { onSave: () => renderRules(main, [sub]) }));
    const a = $('#add', main); if (a) a.onclick = () => editContent('ranks', RANK_SCHEMA, null, { title: 'New rank', onSave: () => renderRules(main, [sub]) });
  }

  function worldPage() {
    const card = (h, ps) => `<div class="card"><h3 style="margin-top:0">${esc(h)}</h3>${ps.map((t) => `<p>${L(t)}</p>`).join('')}</div>`;
    main.innerHTML = `${back}<h1 style="margin-top:10px">World, guilds & NPCs</h1>
      ${card('The Gravity Falls Guild Charter', WORLD.charter)}
      <p class="small"><b>When we play:</b> ${esc(WORLD.schedule)}</p>
      <span><img class="art-wide" src="assets/discord/vanguard_woodland.jpg" alt="Vanguard Guild and Woodland Guild" loading="lazy"></span>
      ${WORLD.guilds.map((g) => card('Welcome to the ' + g.name + '!', g.text)).join('')}
      <div class="section-title"><h2>Places</h2></div><div class="card"><ul>${WORLD.places.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>
      <div class="section-title"><h2>Camps & caretakers</h2></div>${WORLD.camps.map((c) => card(c.name, [c.text])).join('')}
      <div class="section-title"><h2>Guild & world NPCs</h2></div>${WORLD.npcs.map((c) => card(c.name, [c.text])).join('')}`;
  }

  function rivalsPage() {
    main.innerHTML = `<div class="row" style="justify-content:space-between">${back}${addBtn('id="add"', '+ Team')}</div>
      <h1 style="margin-top:10px">Guilds & Rival Teams</h1>
      <img class="art-wide" src="assets/gs/guild_banner.jpg" alt="The guild" loading="lazy">
      <div class="card">${GUILDS.intro.map((t) => `<p>${L(t)}</p>`).join('')}</div>
      <span><img class="art-wide" src="assets/gs/dungeon_missions.jpg" alt="Dungeon and non-dungeon missions" loading="lazy"></span>
      ${gs('guilds', 'Guilds — from the campaign site')}${gs('guilds_mission-ranks', 'Mission ranks')}${gs('guilds_mission-ranks_dungeon-missions', 'Dungeon missions')}${gs('guilds_mission-ranks_non-dungeon-missions', 'Non-dungeon missions')}
      <div class="section-title"><h2>Rival teams</h2></div>
      ${rivals().map((r) => `<div class="card">${r.banner ? `<img class="art-wide" src="${esc(r.banner)}" alt="" loading="lazy">` : ''}<div class="row" style="justify-content:space-between"><h2 style="margin:0">${esc(r.name)}</h2>${editBtn(`data-ed="${esc(r.id)}"`)}</div>
        <div class="row" style="margin:10px 0">${(r.members || []).map((m) => `<div style="text-align:center">${portrait({ pokemon: m, nickname: m }, 'sm')}<div class="small">${esc(m)}</div></div>`).join('')}</div>
        ${(r.text || []).map((t) => `<p>${L(t)}</p>`).join('')}
        ${r.name === 'Team Meanies' ? gs('guilds_team-meanies', 'Full story from the campaign site', false) : r.name === 'Team Skull' ? gs('guilds_team-skull', 'Full story from the campaign site', false) : ''}</div>`).join('')}`;
    $$('[data-ed]', main).forEach((b) => b.onclick = () => editContent('rivals', RIVAL_SCHEMA, rivals().find((c) => c.id === b.dataset.ed), { onSave: () => renderRules(main, [sub]) }));
    const a = $('#add', main); if (a) a.onclick = () => editContent('rivals', RIVAL_SCHEMA, null, { title: 'New team', onSave: () => renderRules(main, [sub]) });
  }

  async function itemsPage() {
    main.innerHTML = `${back}<h1 style="margin-top:10px">Items</h1>
      <div class="grid g2">${ITEM_ART.map(([k, s, f]) => `<div class="card" style="margin:0"><img class="art-sq" src="${f}" alt="${esc(k)}" loading="lazy"><h3 style="margin:8px 0 2px">${esc(k)}</h3><p class="small muted" style="margin:0">${esc(s)}</p></div>`).join('')}</div>
      <div class="card" style="margin-top:12px">${ITEM_KINDS.map(([k, t]) => `<h4>${esc(k)}</h4><p class="small">${L(t)}</p>`).join('')}</div>
      <div class="card"><h3>${linkify('Garments', ix)}</h3><table class="t"><tr><th>Garment</th><th>Rarity</th><th>Effect</th></tr>${GARMENTS.map(([n, r, e]) => `<tr><td>${linkify(n, ix)}</td><td><span class="pill r-${r.split(' ')[0]}">${r}</span></td><td>${esc(e)}</td></tr>`).join('')}</table></div>
      <div class="card"><h3>Items by rarity</h3>${Object.entries(ITEM_PAGES).map(([r, list]) => `<h4 class="row nowrap">${RARITY_ART[r] ? `<img class="rarity-card" src="${RARITY_ART[r]}" alt="" loading="lazy">` : ''}<span class="pill r-${r}">${r}</span></h4><p class="small">${list.map((n) => (ix.byName.get(n.toLowerCase()) ? `<a href="#" class="ix" data-ixname="${esc(n)}">${esc(n)}</a>` : esc(n))).join(', ')}</p>`).join('')}</div>
      ${gs('items', 'Item types — from the campaign site', true, true)}${gs('items_mundane', 'Mundane items (full list)', false)}${gs('items_common', 'Common items (full list)', false)}${gs('items_uncommon', 'Uncommon items (full list)', false)}
      <div class="card"><h3>Shop list</h3><p class="small muted">From the campaign spreadsheet (Treasure Inventory) — ${sheet.source.treasure === 'live' ? 'live' : 'saved copy'}.</p><div class="scroll-x" id="shop">Loading…</div></div>`;
    const t = await sheet.treasure();
    $('#shop', main).innerHTML = `<table class="t"><tr><th>Item</th><th>Kind</th><th>Rarity</th><th>Price</th></tr>${t.map((x) => `<tr><td><a href="#" class="ix" data-ixname="${esc(x.name)}">${esc(x.name)}</a></td><td>${esc(x.kind)}</td><td><span class="pill r-${esc(x.rarity.split(/[ —]/)[0])}">${esc(x.rarity)}</span></td><td>${esc(x.price)}</td></tr>`).join('')}</table>`;
  }

  async function coverage() {
    const { shop } = await import('./guild.js?v=6ae39064');
    const [sm, sa, st, g] = await Promise.all([sheet.moves(), sheet.abilities(), sheet.treasure(), sheet.guild().catch(() => ({ chars: [] }))]);
    const party = Object.values(store.get('party') || {});
    const lootNames = [];
    for (const tbl of [LOOT.projectile, LOOT.berry, LOOT.seed]) for (const [, rows] of Object.values(tbl)) for (const [, n] of rows) {
      for (const part of n.split(/ \/ /)) { const nm = part.replace(/ \(.*\)$/, '').trim(); if (/^(Roll|Two|One|GM|Preserved|Masterwork|Apple \(|Weighted|Plain Seed pair)/.test(nm) || /bundle|cache/i.test(nm)) continue; lootNames.push(/Berry$|Seed$|Spike$|Fossil$|Twig$|Thorn$|Pebble$|Stick$|rock$/.test(nm) || /Berry/.test(n) ? (/(Berry|Seed)$/.test(nm) ? nm : /Berry/.test(n) ? nm + ' Berry' : nm) : nm); }
    }
    const groups = {
      'Moves (spreadsheet + characters)': [...sm.map((m) => m.name), ...party.flatMap((c) => c.moves || []), ...g.chars.flatMap((c) => c.moves || [])],
      'Abilities (spreadsheet + characters)': [...sa.map((a) => a.name), ...party.map((c) => c.ability), ...g.chars.map((c) => c.ability)],
      'Items (site lists, shop, loot, spreadsheet)': [...Object.values(ITEM_PAGES).flat().filter((n) => !/\(GM rolls\)|Cache|Pouch/.test(n)), ...GARMENTS.map((x) => x[0]), ...shop().map((s) => s.name), ...st.map((t) => t.name), ...lootNames],
      'Status conditions': STATUSES.map((s) => STATUS_IX[s] || s),
      Natures: [...NATURES, ...party.map((c) => c.nature), ...g.chars.map((c) => c.nature)],
      'Type match-ups': TYPES.map((t) => t + ' type'),
      'Species (party, cast, rivals)': [...party.map((c) => c.pokemon), ...cast().flatMap((c) => String(c.species || '').split(/\s*&\s*/)), ...rivals().flatMap((r) => r.members || [])],
      Traps: ix.list.filter((e) => e.kind === 'Trap').map((e) => e.name),
      'Mission types': Object.values(MISSION_TYPES).flat(),
      'Quick rolls & actions': [...QUICK_TASKS.map((x) => x[0]), ...QUICK_SOCIAL.map((x) => x[0])],
      'Dungeon events': DUNGEON_EVENTS.filter(Boolean).map((x) => x[0] + ' (event)'),
      'Index cross-links': ix.list.flatMap((e) => e.links || []),
    };
    const rows = Object.entries(groups).map(([k, list]) => {
      const uniq = [...new Set(list.filter(Boolean).map((s) => String(s).trim()).filter(Boolean))];
      const missing = uniq.filter((n) => !ix.byName.get(n.toLowerCase()) && !ix.byId.get(n));
      return { k, total: uniq.length, missing };
    });
    const totalMissing = rows.reduce((s, r) => s + r.missing.length, 0);
    const kinds = {}; ix.list.forEach((e) => { kinds[e.kind] = (kinds[e.kind] || 0) + 1; });
    main.innerHTML = `${back}<h1 style="margin-top:10px">Index coverage check</h1>
      <div class="card"><p class="big pix" id="cov-result" data-missing="${totalMissing}" data-entries="${ix.list.length}" style="font-size:22px;margin:0">${totalMissing ? `${totalMissing} references not in the Index` : 'Every reference is in the Index'} — ${ix.list.length} entries</p></div>
      <div class="card"><table class="t" id="cov-table"><tr><th>Checked</th><th>Names</th><th>Not indexed</th></tr>${rows.map((r) => `<tr><td>${esc(r.k)}</td><td>${r.total}</td><td>${r.missing.length ? esc(r.missing.join(', ')) : '0'}</td></tr>`).join('')}</table></div>
      <div class="card"><h3>Entries by kind</h3><p class="small" id="cov-kinds">${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${esc(k)} ${n}`).join(' · ')}</p></div>`;
  }

  function handouts() {
    main.innerHTML = `${back}<h1 style="margin-top:10px">Handouts</h1><p class="small muted">The GM's player handouts. Tap one to open it full size.</p>
      <div class="grid g3" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${HANDOUTS.map(([f, t]) => `<a class="handout" href="assets/handouts/${f}.jpg" target="_blank"><img src="assets/handouts/${f}.jpg" alt="${esc(t)}" loading="lazy"><span>${esc(t)}</span></a>`).join('')}</div>`;
  }

  function links() {
    main.innerHTML = `${back}<h1 style="margin-top:10px">Campaign links</h1>
      <div class="grid g2">${QUICK_LINKS.map((l) => `<a class="linkbtn" href="${l.href}" target="_blank" rel="noopener"><b>${esc(l.label)}</b><span>${esc(l.sub)}</span></a>`).join('')}</div>`;
  }

  function credits() {
    main.innerHTML = `${back}<h1 style="margin-top:10px">Credits</h1>
      <div class="card"><h3>The campaign</h3><p>Story, handouts, guides, spreadsheet and campaign site by the GM of <i>Voice of the Forest</i>. The character art, chapter medallions, item and guild art, banners and infographics come from the GM's own campaign site (<a href="https://sites.google.com/view/dungeoncrawling/home" target="_blank" rel="noopener">Voice of the Forest Google Site</a>); character art belongs to its original artists.</p></div>
      <div class="card"><h3>Game rules</h3><p><b>PokéRole 2.0</b> core rulebook by the PokéRole team. <b>PokéRole Mystery Dungeon Unofficial v2.0</b> supplement — created by LatiusAuro; original rules development Ruben, Aleida, Mikel; additional rules LatiusAuro, Rockington. Page numbers in the Index point to these books.</p></div>
      <div class="card"><h3>Game art</h3>
        <p>Every game graphic on this site comes from <b>Pokémon Mystery Dungeon: Explorers of Time / Darkness / Sky</b> (Nintendo DS) and the original Rescue Team era, as ripped and shared by fans:</p>
        <ul class="small">
          <li><b>Portraits</b> — original game portraits (credited CHUNSOFT) from the PMD Sprite Repository / SpriteCollab by PMDCollab: <a href="https://sprites.pmdcollab.org" target="_blank" rel="noopener">sprites.pmdcollab.org</a>, taken from the repository's first commit so they are the unedited in-game portraits.</li>
          <li><b>Explorers-style portraits</b> for Pokémon that aren't in those games (Scolipede, Chandelure, Maushold, Aegislash, Golett, Jangmo-o, Cottonee, Tinkatink) — fan-drawn in the Explorers of Sky style by PMDCollab artists 0palite, Emmuffin, Precascer, G〜, baronessfaron, Soulja and mucrush (<a href="https://sprites.pmdcollab.org" target="_blank" rel="noopener">sprites.pmdcollab.org</a>).</li>
          <li><b>Hidden Gimmighoul</b> — its Roaming Form idle animation, an Explorers-style sprite by the PMDCollab artists (<a href="https://sprites.pmdcollab.org" target="_blank" rel="noopener">sprites.pmdcollab.org</a>).</li>
          <li><b>Berries</b> — Explorers-style berry sprites from PMDCollab’s RawAsset (<a href="https://github.com/PMDCollab/RawAsset" target="_blank" rel="noopener">GitHub</a>); berries Explorers doesn’t have (Pecha, Cheri, Chesto, Rawst, Aspear, Persim and more) use the main-series bag icons from PokéAPI’s sprite collection (<a href="https://github.com/PokeAPI/sprites" target="_blank" rel="noopener">GitHub</a>).</li>
          <li><b>Nursery egg and grass</b> — the egg is the Ruby &amp; Sapphire egg sprite (via PokéAPI’s sprite collection); the grass is the Tiny Woods tileset from Explorers of Sky (PMDCollab RawAsset). The twig nest was drawn for this site in the Explorers style, since the games don’t have one.</li>
          <li><b>Fernshade Nursery cries</b>: the babies’ Pokémon cries are from the Pokémon games (© Nintendo / Creatures / GAME FREAK), via the Pokémon Showdown audio files.</li>
          <li><b>Supply Wagon with Machamp</b> — Machamp, Voltorb and runner sprites and Machamp’s portrait from SpriteCollab; the basket, chest, logs and thrown items from PMDCollab’s RawAsset; the backdrop is the GM’s Woodland Base art.</li>
          <li><b>Rayson’s Mail Run</b> — Explorers of Sky skies and clouds (The Spriters Resource sheet 59281, ripped by Hawaltuck) and the Sunshell Beach sea and sand strips (sheet 14797, redblueyellow); Wingull, Taillow and Starly sprites from SpriteCollab; the letter and Woodland Base signpost from PMDCollab’s RawAsset.</li>
          <li><b>Fernshade Nursery</b> — the baby Pokémon’s idle, hop and sleep sprites and their faces, plus Beatrice’s (Beedrill’s) faces, from the PMD Sprite Repository / SpriteCollab (original Explorers sprites credited CHUNSOFT, many faces fan-drawn by PMDCollab artists; <a href="https://sprites.pmdcollab.org" target="_blank" rel="noopener">sprites.pmdcollab.org</a>).</li>
          <li><b>Spinda’s Kitchen</b> — Spinda’s idle, walk, twirl and hurt animations (original Explorers sprites credited CHUNSOFT) and eating animation by PMDCollab, from the PMD Sprite Repository / SpriteCollab (<a href="https://sprites.pmdcollab.org" target="_blank" rel="noopener">sprites.pmdcollab.org</a>).</li>
          <li><b>Ralts’s dance music, Rayson’s beach tune, the Sentry Duty march, Spinda’s kitchen tune, the nursery music box and Noctowl’s casino music and card sounds</b> — original little 8-bit tunes and sounds written for this site and played live in your browser.</li>
          <li><b>Ralts’s dance</b> — Ralts’s idle, hop and hurt animations from the PMD Sprite Repository / SpriteCollab (original Explorers sprites credited CHUNSOFT, touched up by PMDCollab; <a href="https://sprites.pmdcollab.org" target="_blank" rel="noopener">sprites.pmdcollab.org</a>).</li>
          <li><b>Golett’s Squirtle form</b> — Squirtle’s Explorers of Sky portraits (CHUNSOFT) from the PMD Sprite Repository / SpriteCollab (<a href="https://sprites.pmdcollab.org" target="_blank" rel="noopener">sprites.pmdcollab.org</a>), recolored in Golett’s clay colors for this site.</li>
          <li><b>Sentry Duty faces</b> — the visitors’ portraits and the emotion portraits (happy, sad, surprised…) of Diglett and the team from the PMD Sprite Repository / SpriteCollab by PMDCollab (<a href="https://sprites.pmdcollab.org" target="_blank" rel="noopener">sprites.pmdcollab.org</a>); many are fan-drawn in the Explorers of Sky style by its artists.</li>
          <li><b>Sentry Duty footprints</b> — the Pokédex footprint sprites from the main Pokémon games (the same shapes Sentry Duty uses), as collected on Bulbapedia / the Bulbagarden Archives (via eharian's Pokemon-Footprints, <a href="https://github.com/eharian/Pokemon-Footprints" target="_blank" rel="noopener">GitHub</a>). Used with the GM's OK.</li>
          <li><b>Window and portrait frames</b> — Explorers of Sky interface from Vauxhat's PMD-Text-Generator (<a href="https://github.com/Vauxhat/PMD-Text-Generator" target="_blank" rel="noopener">GitHub</a>).</li>
          <li><b>Treasure Town</b> and <b>Wigglytuff's Guild</b> backgrounds — ripped by redblueyellow, The Spriters Resource (Explorers of Time/Darkness sheets 5979, 5962).</li>
          <li><b>Beach</b> — redblueyellow (sheet 14797); <b>dusk sky</b> — RRen (Explorers of Sky sheet 232235). <b>Temporal Tower</b> — Eeveeloverthespriter8 (Explorers of Sky sheet 146840).</li>
          <li><b>Guild emblem pattern</b> — from "Various Graphics", ripped by Catcatcat, The Spriters Resource (Explorers of Time/Darkness sheet 19952).</li>
        </ul>
        <p class="small">Images are cropped and scaled with nearest-neighbour only.</p></div>
      <div class="card"><h3>Font</h3><p class="small">Pixel Operator by Jayvee Enaguas (HarvettFox96), CC0 public domain.</p></div>
      <div class="card"><p class="small">${esc(DISCLAIMER)}</p></div>`;
  }
}

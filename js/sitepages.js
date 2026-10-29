// The GM's Google Site, page for page: same menu, same text, her pictures in the same places.
import { GS_TEXT } from './gstext.js?v=6ae371ba';
import { esc } from './util.js?v=6ae371ba';
import { LINKS, CAST } from './content.js?v=6ae371ba';

// Her site's menu, in her order. [key in GS_TEXT, title, children]
export const SITE_NAV = [
  ['home', 'Home'],
  ['meet-the-characters', 'Meet the Characters!'],
  ['how-to-play', 'How To Play', [
    ['how-to-play_new-character', 'New Character'],
    ['how-to-play_beginner-mechanics', 'Beginner Mechanics', [
      ['how-to-play_beginner-mechanics_combat-and-movement', 'Combat and Movement'],
      ['how-to-play_beginner-mechanics_traps-and-hazards', 'Traps and Hazards']]],
    ['how-to-play_advanced-mechanics', 'Advanced Mechanics', [
      ['how-to-play_advanced-mechanics_evolution', 'Evolution'],
      ['how-to-play_advanced-mechanics_training', 'Training'],
      ['how-to-play_advanced-mechanics_recruiting', 'Recruiting'],
      ['how-to-play_advanced-mechanics_directing-teammates', 'Directing Teammates']]]]],
  ['story-guild-rank-progression', 'Story & Guild Rank Progression', [
    ['story-guild-rank-progression_chapter-0-the-voice-of-the-forest', 'Chapter 0 - The Voice of the Forest'],
    ['story-guild-rank-progression_chapter-1-earthquake-at-woodland-base', 'Chapter 1 - Earthquake at Woodland Base']]],
  ['guilds', 'Guilds', [
    ['guilds_mission-ranks', 'Mission Ranks'],
    ['guilds_mission-ranks_dungeon-missions', 'Dungeon Missions'],
    ['guilds_mission-ranks_non-dungeon-missions', 'Non-Dungeon Missions'],
    ['guilds_team-skull', 'Team Skull'],
    ['guilds_team-meanies', 'Team Meanies']]],
  ['items', 'Items', [['items_mundane', 'Mundane'], ['items_common', 'Common'], ['items_uncommon', 'Uncommon']]],
];
// Pages on her site that are only a menu of their sub-pages
const MENU_ONLY = new Set(['how-to-play_beginner-mechanics', 'how-to-play_advanced-mechanics']);

const flat = [];
(function walk(list, parent) { for (const [k, t, kids] of list) { flat.push({ key: k, title: t, parent, kids: kids || [] }); if (kids) walk(kids, k); } })(SITE_NAV, null);
export const sitePage = (key) => flat.find((p) => p.key === key);
export const sitePages = () => flat;

const href = (key) => `#/rules/site/${key}`;
const big = (src) => /logo|_wide|banner|scene|team_|missions|ranks\.|home_team/.test(src);

// Blocks -> HTML. L = linkify function (index links); plain escaping when not given.
export function blocksHTML(key, L = esc, { skipImgs = [] } = {}) {
  let b = GS_TEXT[key] || [];
  if (MENU_ONLY.has(key)) b = [];
  let h = ''; let ul = false;
  for (const [k, t] of b) {
    if (k === 'img' && skipImgs.includes(t)) continue;
    if (k === 'li' && !ul) { h += '<ul>'; ul = true; }
    if (k !== 'li' && ul) { h += '</ul>'; ul = false; }
    if (k === 'img') {
      h += /home_3\./.test(t)
        ? `<a href="${LINKS.discord}" target="_blank" rel="noopener" class="btn alt sm" style="margin:6px 0"><img src="${t}" alt="" style="height:22px;vertical-align:middle;margin-right:6px">Join the Discord</a>`
        : `<span class="site-img${big(t) ? ' wide' : ''}"><img src="${t}" alt="" loading="lazy"></span>`;
    } else if (k === 'h') h += `<h3>${esc(t)}</h3>`;
    else if (k === 'li') h += `<li>${L(t)}</li>`;
    else h += `<p>${L(t)}</p>`;
  }
  if (ul) h += '</ul>';
  return h;
}

// Home page: Humanity and Instinct side by side, then the team picture (no menu text, no Discord icon)
// remember the handout's open/closed state (toggle doesn't bubble, so listen while capturing; works on Home and the Rulebook copy)
document.addEventListener('toggle', (e) => {
  const ho = e.target; if (!ho.classList?.contains('home-handout')) return;
  try { localStorage.setItem('dc.homehandout', ho.open ? '1' : ''); } catch { /* ignore */ }
  ho.querySelector('summary small').textContent = ho.open ? 'Tap to fold away' : 'Tap to open the handout';
  dispatchEvent(new Event('resize'));   // the hidden Gimmighoul re-finds its spot
}, true);
export function homeHTML() {
  const b = GS_TEXT.home || [];
  const text = (label) => { const i = b.findIndex(([k, t]) => k === 'p' && t === label); return i >= 0 && b[i + 1] ? b[i + 1][1] : ''; };
  const col = (title, img, body, ask) => `<div class="home-col"><h3>${esc(title)}</h3>
    <span class="site-img wide"><img src="${img}" alt="${esc(title)}" loading="lazy"></span>
    <p>${esc(body)}</p><h3>${esc(ask)}</h3></div>`;
  // the Humanity / Instinct handout folds away (her ask); open or closed is remembered on this device
  let open = false; try { open = localStorage.getItem('dc.homehandout') === '1'; } catch { /* closed */ }
  return `<details class="home-handout" ${open ? 'open' : ''}><summary><span>📜 Your Humanity &amp; Your Instinct</span><small>${open ? 'Tap to fold away' : 'Tap to open the handout'}</small></summary>
    <div class="home-row">${col('Your Humanity', 'assets/gs/home_1.jpg', text('Your Humanity:'), 'What will you choose?')}${col('Your Instinct', 'assets/gs/home_5.png', text('Your Instinct:'), 'Will it consume you?')}</div>
    <span class="site-img"><img src="assets/gs/home_team_hd.webp" alt="" loading="lazy"></span></details>`;
}

// Rulebook hub: each section of her site as a picture tile in rows, its pages as buttons underneath
const TILE_ART = { 'meet-the-characters': 'assets/gs/home_team_hd.webp', 'story-guild-rank-progression': 'assets/banners/chapter_0.jpg' };
export function navTilesHTML() {
  // only a section's own pages here; their sub-pages show when that page is opened
  // (her call: the villain teams stay off the Guilds quick links; their pages are still on the Guilds page)
  const sub = (kids) => kids.filter(([k]) => !k.startsWith('guilds_team-')).map(([k, t]) => `<a href="${href(k)}">${esc(t)}</a>`);
  // her call: no Home tile; Story & Guild Rank Progression takes its wide spot at the top
  const tiles = [...SITE_NAV.filter(([k]) => k === STORY), ...SITE_NAV.filter(([k]) => k !== 'home' && k !== STORY && k !== 'meet-the-characters')];   // Meet the Characters lives on the Home page
  return `<div class="navtiles">${tiles.map(([k, t, kids]) => `<div class="navtile${k === STORY ? ' navtile-wide' : ''}">
    <a class="navtile-head" href="${href(k)}"><img src="${TILE_ART[k] || bannerFor(k)}" alt="" loading="lazy"><span>${esc(t)}</span></a>
    ${kids ? `<div class="navtile-kids">${sub(kids).join('')}</div>` : ''}</div>`).join('')}</div>`;
}

// Meet the Characters as the guild mess hall at the end of a long day: everyone at the tables, each seat folds open
// to their full bio from her site. Tables group who is known to be together; anyone new lands at "the rest of the hall".
const HALL = [
  ['Woodland Base rescue team', ['Gemini', 'Felicia', 'Rox']],
  ['The rest of the hall', ['Slakoth', 'Magnemite', 'Puff', 'Rocky']],
  ['Honored guests', ['Mimi & Kippy']],
];
function messHallHTML() {
  const b = GS_TEXT['meet-the-characters'] || [];
  const people = []; let cur = null;
  for (const [k, t] of b) {
    if (k === 'h') { cur = { name: t, blocks: [], art: '' }; people.push(cur); } else if (cur && k === 'img') cur.art = t; else if (cur) cur.blocks.push([k, t]);
  }
  const info = (n) => CAST.find((c) => c.name === n) || {};
  const placed = new Set(HALL.flatMap(([, ns]) => ns));
  const tables = HALL.map(([t, ns]) => [t, ns.map((n) => people.find((p) => p.name === n)).filter(Boolean)]);
  const extra = people.filter((p) => !placed.has(p.name));
  if (extra.length) tables[1][1].push(...extra);
  const body = (p) => {
    let h = ''; let ul = false;
    for (const [k, t] of p.blocks) {
      if (k === 'li' && !ul) { h += '<ul>'; ul = true; }
      if (k !== 'li' && ul) { h += '</ul>'; ul = false; }
      const m = k === 'p' && t.match(/^(Nature|Concept|Personality|Goal|Motivation):\s*(.*)$/s);
      h += k === 'li' ? `<li>${esc(t)}</li>` : m ? `<p><b>${m[1]}:</b> ${esc(m[2])}</p>` : `<p>${esc(t)}</p>`;
    }
    return h + (ul ? '</ul>' : '');
  };
  const seat = (p) => { const c = info(p.name); return `<details class="seat">
      <summary>${p.art ? `<img src="${esc(p.art)}" alt="" loading="lazy">` : ''}<span><b>${esc(p.name)}</b><small>${esc([c.species, c.nature].filter(Boolean).join(' · '))}</small></span></summary>
      <div class="seat-body">${p.art ? `<span><img class="seat-art" src="${esc(p.art)}" alt="${esc(p.name)}" loading="lazy"></span>` : ''}${body(p)}</div></details>`; };
  return `<div class="messhall">
    <div class="mh-head"><img src="assets/banners/guilds.jpg" alt=""><div><h2>The Mess Hall</h2><p>The lanterns are lit and the day's missions are done. Everyone's back at the guild for supper. Tap a seat to hear their story.</p></div></div>
    ${tables.map(([t, ps]) => `<div class="mh-table"><h3>${esc(t)}</h3><div class="mh-board">${ps.map(seat).join('')}</div></div>`).join('')}
  </div>`;
}

export function navHTML(current) {
  const item = ([k, t, kids], depth) => `<li><a href="${href(k)}" class="${k === current ? 'on' : ''}" style="padding-left:${8 + depth * 14}px">${esc(t)}</a>${kids ? `<ul>${kids.map((x) => item(x, depth + 1)).join('')}</ul>` : ''}</li>`;
  return `<ul class="site-nav">${SITE_NAV.map((x) => item(x, 0)).join('')}</ul>`;
}

// Her site's own page banners (the header picture on each Google Site page)
const BANNERS = [['guilds_team-meanies', 'team_meanies'], ['guilds_team-skull', 'team_skull'], ['guilds_mission-ranks_', 'home'], ['guilds', 'guilds'],
  ['how-to-play_new-character', 'new_character'], ['how-to-play', 'how_to_play'], ['items_', 'items_treasure'], ['items', 'items'],
  ['story-guild-rank-progression_chapter-0', 'chapter_0'], ['story-guild-rank-progression_chapter-1', 'chapter_1'], ['story-guild-rank-progression', 'story_ranks'], ['', 'home']];
export const bannerFor = (key) => `assets/banners/${BANNERS.find(([k]) => key.startsWith(k))[1]}.jpg`;

// Story & Guild Rank Progression in her site's layout: rank chart, then chapter medal cards in a grid
// (4 across, then 3 across, Chapter 10 wide), each with a chapter label, big title, quote, rank, promotion.
const STORY = 'story-guild-rank-progression';
function storyRanksHTML(L) {
  const b = GS_TEXT[STORY] || [];
  const at = b.findIndex(([k, t]) => k === 'h' && /Story Progression/.test(t));
  const chart = b.slice(0, at).find(([k]) => k === 'img');
  const subs = sitePage(STORY)?.kids || [];
  const chs = [];
  for (const [k, t] of b.slice(at + 1)) {
    if (k === 'img') { chs.push({ img: t }); continue; }
    const c = chs[chs.length - 1]; if (!c) continue;
    if (k === 'h') c.title = t;
    else if (/^\d+ Chapter/.test(t)) c.label = t.replace(/^\d+ /, '');
    else if (/^[“"]/.test(t)) c.quote = t;
    else if (/^Promotion:/.test(t)) c.promo = t;
    else if (/^\w+ Rank$/.test(t)) c.rank = t;
  }
  const card = (c, wide) => {
    const n = (c.title || '').replace(/\D+/g, '');
    const sub = subs.find(([, t]) => t === `Chapter ${n}` || t.startsWith(`Chapter ${n} `));
    const label = c.label ? (sub ? `<a class="ch-chip" href="${href(sub[0])}">${esc(c.label)}</a>` : `<span class="ch-chip">${esc(c.label)}</span>`) : '';
    const text = `${label}<h3 class="ch-title">${esc(c.title || '')}</h3>
      ${c.quote ? `<p class="ch-quote">${esc(c.quote)}</p>` : ''}
      ${c.rank ? `<p class="ch-meta">${L(c.rank)}</p>` : ''}${c.promo ? `<p class="ch-meta">${esc(c.promo)}</p>` : ''}`;
    const pic = `<img class="ch-medal" src="${c.img}" alt="" loading="lazy">`;
    return wide ? `<div class="ch-card ch-wide">${pic}<div>${text}</div></div>` : `<div class="ch-card">${pic}${text}</div>`;
  };
  const last = chs.length > 1 ? chs[chs.length - 1] : null;
  return `<div class="rk-row">
    <div class="rk-story"><h2 class="ch-sect" id="gp-story">Story Progression</h2>
      <div class="ch-grid ch3">${chs.slice(0, last ? -1 : undefined).map((c) => card(c)).join('')}</div>
      ${last ? card(last, true) : ''}</div>
    <div class="rk-guild"><h2 class="ch-sect" id="gp-guild">Guild Progression</h2>
      ${chart ? `<span class="site-img wide"><img src="${chart[1]}" alt="Guild ranks and rewards" loading="lazy"></span>` : ''}</div>
  </div>`;
}

export function pageHTML(key, L = esc) {
  const p = sitePage(key);
  if (!p) return '<p>That page is not on the campaign site.</p>';
  const parent = p.parent && sitePage(p.parent);
  const body = key === 'home' ? homeHTML() : key === 'meet-the-characters' ? messHallHTML() : key === STORY ? storyRanksHTML(L) : blocksHTML(key, L);   // same layout as the site's home page
  // sub-pages as picture cards with a short preview, so a menu page shows what is inside
  const peek = (k) => { const t = (GS_TEXT[k] || []).find(([kind, x]) => kind === 'p' && x.length > 40); return t ? (t[1].length > 150 ? t[1].slice(0, 150).replace(/\s+\S*$/, '') + '…' : t[1]) : ''; };
  const kids = p.kids.length && key !== STORY ? `<div class="subcards">${p.kids.map(([k, t]) => `<a class="subcard" href="${href(k)}"><img src="${TILE_ART[k] || ((GS_TEXT[k] || []).find(([kind, x]) => kind === 'img' && !/home_3\./.test(x)) || [])[1] || bannerFor(k)}" alt="" loading="lazy"><b>${esc(t)}</b>${peek(k) ? `<span>${esc(peek(k))}</span>` : ''}<em>Read more ›</em></a>`).join('')}</div>` : '';
  return `<div class="hero banner"><img class="hdr" src="${bannerFor(key)}" alt=""></div>
    <p class="small muted" style="margin:10px 0 0">${parent ? `<a href="${href(parent.key)}">${esc(parent.title)}</a> › ` : ''}Campaign site</p>
    <h1 style="margin-top:4px">${esc(p.title)}</h1>
    <div class="card site-page">${body || ''}${kids}</div>
    <p class="small"><a href="https://sites.google.com/view/dungeoncrawling/${key.replace(/_/g, '/')}" target="_blank" rel="noopener">Open the original page</a></p>
    <details class="card"><summary><b>All campaign site pages</b></summary>${navHTML(key)}</details>`;
}

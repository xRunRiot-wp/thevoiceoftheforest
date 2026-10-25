// The GM's Google Site, page for page: same menu, same text, her pictures in the same places.
import { GS_TEXT } from './gstext.js';
import { esc } from './util.js';
import { LINKS } from './content.js';

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
        : `<a href="${t}" target="_blank" class="site-img${big(t) ? ' wide' : ''}"><img src="${t}" alt="" loading="lazy"></a>`;
    } else if (k === 'h') h += `<h3>${esc(t)}</h3>`;
    else if (k === 'li') h += `<li>${L(t)}</li>`;
    else h += `<p>${L(t)}</p>`;
  }
  if (ul) h += '</ul>';
  return h;
}

export function navHTML(current) {
  const item = ([k, t, kids], depth) => `<li><a href="${href(k)}" class="${k === current ? 'on' : ''}" style="padding-left:${8 + depth * 14}px">${esc(t)}</a>${kids ? `<ul>${kids.map((x) => item(x, depth + 1)).join('')}</ul>` : ''}</li>`;
  return `<ul class="site-nav">${SITE_NAV.map((x) => item(x, 0)).join('')}</ul>`;
}

export function pageHTML(key, L = esc) {
  const p = sitePage(key);
  if (!p) return '<p>That page is not on the campaign site.</p>';
  const parent = p.parent && sitePage(p.parent);
  const body = blocksHTML(key, L);
  const kids = p.kids.length ? `<div class="toc" style="margin-top:12px">${p.kids.map(([k, t]) => `<a href="${href(k)}">${esc(t)}</a>`).join('')}</div>` : '';
  return `<p class="small muted" style="margin:10px 0 0">${parent ? `<a href="${href(parent.key)}">${esc(parent.title)}</a> › ` : ''}Campaign site</p>
    <h1 style="margin-top:4px">${esc(p.title)}</h1>
    <div class="card site-page">${body || '<p class="muted">This page is a menu:</p>'}${kids}</div>
    <p class="small"><a href="https://sites.google.com/view/dungeoncrawling/${key.replace(/_/g, '/')}" target="_blank" rel="noopener">Open the original page</a></p>
    <details class="card"><summary><b>All campaign site pages</b></summary>${navHTML(key)}</details>`;
}

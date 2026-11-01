// Your own base (her ask 11-01): like the friend areas in Red Rescue Team, each character gets a plot of their own once they
// reach Beginner rank. Tap the square next to the Guild on the Woodland Base map and it zooms in to your camp, where you
// build with what your rank allows (Beginner: a tent, a campfire, bedrolls, a drying rack and a sad little bed); later
// ranks will add more, up to a building in someone's likeness. Friends can visit from the Friends list (like visiting an
// igloo in Club Penguin). base/<charId> = { items: { id: { k, x, y } }, visits: { visitorId: t } }; x and y are % of the scene.
import * as store from './store.js?v=6ae72858';
import { $, $$, esc, toast, uid } from './util.js?v=6ae72858';
import { modal, closeModal } from './ui.js?v=6ae72858';
import { RANK_NAMES } from './content.js?v=6ae72858';
import { mountFzScene } from './fzscene.js?v=6ae72858';
import { myId } from './app.js?v=6ae72858';

// what can be built: [name, picture, width on screen (px at full size), what it says when tapped]
const ITEMS = {
  tent: ['Tent', 'assets/base/tent.png', 132, 'A sturdy little tent. Home sweet home!'],
  campfire: ['Campfire', 'assets/base/campfire.png', 72, 'The campfire crackles and pops.'],
  bedroll: ['Bedroll', 'assets/base/bedroll.png', 90, 'A rolled-out bedroll for a friend to crash on.'],
  rack: ['Drying Rack', 'assets/base/rack.png', 102, 'Berries and a towel drying in the breeze.'],
  sadbed: ['Sad Bed', 'assets/base/sadbed.png', 90, 'A thin pile of straw. It’s… a bed. Technically.'],
};
// how many of each a rank may build (each rank gets everything the ranks before it had); only Beginner for now
const BUILD = {
  Beginner: { tent: 1, campfire: 1, bedroll: 2, rack: 1, sadbed: 1 },
};
const rankIx = (c) => Math.max(0, RANK_NAMES.indexOf(c?.rank || 'Starter'));
export const hasBase = (c) => !!c && !c.guest && rankIx(c) >= 1;
const limitsFor = (c) => { const out = {}; for (const r of RANK_NAMES.slice(1, rankIx(c) + 1)) for (const [k, n] of Object.entries(BUILD[r] || {})) out[k] = Math.max(out[k] || 0, n); return out; };
const nextRank = (c) => RANK_NAMES[rankIx(c) + 1] || '';
const party = () => store.get('party') || {};
const baseOf = (id) => store.get('base/' + id) || {};
const GROUND_TOP = 30;   // % of the scene that is forest edge; things are built below it

// the scene: a grassy clearing with what's been built, and the owner's (and a visitor's) character walking about
async function drawScene(scene, owner, visitor) {
  const mons = [owner, visitor].filter((x) => x?.pokemon).map((x) => ({ name: x.pokemon, label: x.nickname, shiny: !!x.shiny }));
  await mountFzScene(scene, [{ key: 'base', mons, max: 4 }], '', 'assets/nursery/grass.png');
  if (!scene.isConnected) return;
  const strip = scene.firstChild; if (!strip) return;
  const layer = document.createElement('div'); layer.className = 'base-items'; strip.appendChild(layer);
  const paint = () => {
    const items = baseOf(owner.id).items || {}; const size = strip.clientWidth || 340; const k = size / 420;
    layer.innerHTML = Object.entries(items).filter(([, it]) => ITEMS[it?.k]).map(([id, it]) => { const [name, img, w] = ITEMS[it.k]; const px = Math.round(w * k);
      return `<button class="base-item bi-${esc(it.k)}" data-bi="${esc(id)}" title="${esc(name)}" style="left:${it.x}%;top:${it.y}%;width:${px}px;z-index:${10 + Math.round(it.y / 100 * size)}"><img src="${img}" alt="${esc(name)}"></button>`; }).join('');
  };
  paint();
  return { layer, paint, strip };
}

export function openBase(ownerId, { from = null } = {}) {
  const owner = party()[ownerId]; const meId = myId(); const me = party()[meId];
  if (!owner) return toast('That character isn’t at the table.');
  if (!hasBase(owner)) return toast(ownerId === meId ? 'Reach Beginner rank to set up your own base!' : `${owner.nickname} hasn’t set up a base yet.`);
  const mine = ownerId === meId; const visitor = !mine && me ? me : null;
  if (visitor) store.set(`base/${ownerId}/visits/${visitor.id}`, Date.now());
  const el = modal(`<h2>🏕️ ${esc(owner.nickname)}’s Base</h2><div class="fz-zoom base-scene" id="bscene"></div><div id="bpanel"></div>`);
  el.classList.add('base-sheet');
  const scene = $('#bscene', el);
  if (from) { const a = from.getBoundingClientRect(); const b = scene.getBoundingClientRect();
    if (b.width) scene.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width})` }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.2, .8, .2, 1)' }); }
  let placing = null;   // { k } a new thing, or { id } moving one already built
  let building = false; let picked = '';   // picked = a built piece tapped while building (Move / Put away)
  const panel = $('#bpanel', el);
  const counts = () => { const n = {}; for (const it of Object.values(baseOf(ownerId).items || {})) if (it) n[it.k] = (n[it.k] || 0) + 1; return n; };
  const drawPanel = () => {
    const lim = limitsFor(owner); const n = counts(); const visits = Object.entries(baseOf(ownerId).visits || {}).filter(([id]) => party()[id] && id !== ownerId).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const empty = !Object.keys(n).length;
    panel.innerHTML = mine ? `
      ${picked && !placing ? `<p class="base-hint">${esc(ITEMS[baseOf(ownerId).items?.[picked]?.k]?.[0] || '')}: <button class="btn sm" id="bmv">↔️ Move</button> <button class="btn alt sm" id="bdel">📦 Put away</button> <button class="btn alt sm" id="bcancel">Cancel</button></p>` : ''}
      ${placing ? `<p class="base-hint">👆 Tap the ground where the ${esc(ITEMS[placing.k || baseOf(ownerId).items?.[placing.id]?.k]?.[0] || 'piece')} should go. <button class="btn alt sm" id="bcancel">Cancel</button></p>` : ''}
      <div class="row" style="justify-content:space-between"><span class="pill">${esc(owner.rank || 'Beginner')} rank base</span><button class="btn ${building ? '' : 'alt'} sm" id="bbuild">${building ? '✓ Done building' : '🔨 Build'}</button></div>
      ${building ? `<p class="small muted">Pick something to build, then tap the ground. Tap something you’ve built to move it or put it away.</p>
        <div class="base-pal">${Object.entries(lim).map(([k, max]) => `<button class="base-pick ${placing?.k === k ? 'on' : ''}" data-pick="${k}" ${(n[k] || 0) >= max ? 'disabled' : ''}><img src="${ITEMS[k][1]}" alt=""><b>${esc(ITEMS[k][0])}</b><small>${n[k] || 0} / ${max}</small></button>`).join('')}</div>
        ${nextRank(owner) ? `<p class="small muted">🔒 More to build at ${esc(nextRank(owner))} rank. Keep at it, and one day this camp could be a real building!</p>` : ''}`
      : empty ? `<p class="small">Your very own patch of Woodland Base! Tap <b>🔨 Build</b> to pitch your tent and set up camp.</p>` : ''}
      ${visits.length ? `<p class="small muted" style="margin-top:10px">👣 Recent visitors: ${visits.map(([id]) => esc(party()[id].nickname)).join(', ')}</p>` : ''}`
      : `<p class="small">You’re visiting ${esc(owner.nickname)}’s camp${empty ? '. They haven’t built anything yet!' : '. Make yourself at home!'}</p>`;
    // her ask 11-01: a button straight to the nursery page
    panel.insertAdjacentHTML('beforeend', '<div class="row" style="justify-content:center;margin-top:10px"><button class="btn alt" id="bnurs">🍼 Visit the nursery</button></div>');
    $('#bnurs', panel).onclick = () => { closeModal(); location.hash = '#/games/fernshade-nursery'; };
    const bb = $('#bbuild', panel); if (bb) bb.onclick = () => { building = !building; placing = null; picked = ''; drawPanel(); };
    const bc = $('#bcancel', panel); if (bc) bc.onclick = () => { placing = null; picked = ''; drawPanel(); };
    const bm = $('#bmv', panel); if (bm) bm.onclick = () => { placing = { id: picked }; picked = ''; drawPanel(); };
    const bd = $('#bdel', panel); if (bd) bd.onclick = () => { store.set(`base/${ownerId}/items/${picked}`, null); picked = ''; drawPanel(); };
    $$('[data-pick]', panel).forEach((b) => b.onclick = () => { placing = { k: b.dataset.pick }; picked = ''; drawPanel(); });
  };
  drawPanel();
  drawScene(scene, owner, visitor).then((s) => {
    if (!s) return;
    const unsub = store.subscribe(() => { if (!scene.isConnected) { unsub(); return; } s.paint(); drawPanel(); });
    // building: tap the ground to place; tap a built piece for Move / Put away. Anyone may tap a piece to read about it.
    s.strip.addEventListener('click', (e) => {
      const it = e.target.closest('[data-bi]');
      if (placing && !it) {
        const r = s.strip.getBoundingClientRect(); const item = placing.k || baseOf(ownerId).items?.[placing.id]?.k; const w = ITEMS[item]?.[2] / 420 * r.width || 60;
        const x = Math.max(0, Math.min(100 - w / r.width * 100, ((e.clientX - r.left) - w / 2) / r.width * 100));
        const y = Math.max(GROUND_TOP, Math.min(88, ((e.clientY - r.top) / r.height * 100) - 8));
        const pos = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
        if (placing.id) store.update(`base/${ownerId}/items/${placing.id}`, (v) => (v ? { ...v, ...pos } : v));
        else { const n = counts()[placing.k] || 0; if (n >= (limitsFor(owner)[placing.k] || 0)) { toast('No room for another one of those yet.'); placing = null; drawPanel(); return; }
          store.set(`base/${ownerId}/items/${uid()}`, { k: placing.k, ...pos, t: Date.now() }); }
        placing = null; drawPanel(); return;
      }
      if (!it) return;
      const id = it.dataset.bi; const v = baseOf(ownerId).items?.[id]; if (!v) return;
      if (mine && building) { picked = id; placing = null; drawPanel(); return; }
      toast(ITEMS[v.k][3]); it.classList.remove('wig'); void it.offsetWidth; it.classList.add('wig');
    });
  });
}

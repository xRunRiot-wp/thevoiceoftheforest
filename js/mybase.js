// Your own base (her ask 11-01): like the friend areas in Red Rescue Team, each character gets a plot of their own once they
// reach Beginner rank. Tap the square next to the Guild on the Woodland Base map and it zooms in to your camp, where you
// build with what your rank allows (Beginner: a tent, a campfire, bedrolls, a drying rack and a sad little bed); later
// ranks will add more, up to a building in someone's likeness. Friends can visit from the Friends list (like visiting an
// igloo in Club Penguin). base/<charId> = { items: { id: { k, x, y } }, visits: { visitorId: t } }; x and y are % of the scene.
import * as store from './store.js?v=6ae75378';
import { $, $$, esc, toast, uid } from './util.js?v=6ae75378';
import { modal, closeModal } from './ui.js?v=6ae75378';
import { RANK_NAMES } from './content.js?v=6ae75378';
import { mountFzScene } from './fzscene.js?v=6ae75378';
import { myId } from './app.js?v=6ae75378';

// what can be built: [name, picture, width on screen (px at full size), what it says when tapped]
const ITEMS = {
  tent: ['Tent', 'assets/base/tent.png', 132, 'A sturdy little tent. Home sweet home!'],
  campfire: ['Campfire', 'assets/base/campfire.png', 72, 'The campfire crackles and pops.'],
  bedroll: ['Bedroll', 'assets/base/bedroll.png', 90, 'A rolled-out bedroll for a friend to crash on.'],
  rack: ['Drying Rack', 'assets/base/rack.png', 102, 'Berries and a towel drying in the breeze.'],
  sadbed: ['Sad Bed', 'assets/base/sadbed.png', 90, 'A thin pile of straw. It’s… a bed. Technically.'],
};
// her ask 11-01: a seasonal catalog (like Club Penguin's), fall and Halloween first, with Pokémon in place of animals.
// Pieces are bought with the owner's Poké and kept in base/<id>/owned/<key> (how many they may place). Pictures from
// tools/build_decor.py. [name, picture, width, what it says when tapped, price]
const SEASONS = [
  { key: 'fall', name: 'Fall & Halloween', icon: '🎃', months: [8, 9, 10], items: {
    pumpkaboo: ['Pumpkaboo Lantern', 'assets/base/pumpkaboo.png', 54, 'A Pumpkaboo glows softly by the door. Spooky, but cute!', 120],
    zubat: ['Zubat Bunting', 'assets/base/zubat_bunting.png', 168, 'A string of paper Zubat flutters in the breeze.', 80],
    noibat: ['Noibat Bunting', 'assets/base/noibat_bunting.png', 168, 'Paper Noibat sway on the line. Eeek!', 80],
    hoothoot: ['Hoothoot Perch', 'assets/base/hoothoot_perch.png', 54, 'A carved Hoothoot keeps watch. Hoo-hoo!', 150],
    murkrow: ['Murkrow Post', 'assets/base/murkrow_post.png', 46, 'A wooden Murkrow guards the camp from mischief. Probably.', 150],
    litwick: ['Litwick Candles', 'assets/base/litwick_candles.png', 84, 'Three little Litwick candles flicker in the dark.', 60],
    spinarak: ['Spinarak Web', 'assets/base/spinarak_web.png', 72, 'A Spinarak spun its finest web just for you.', 70],
    leaves: ['Leaf Pile', 'assets/base/leaf_pile.png', 72, 'Crunch! Perfect for jumping in.', 40],
    hay: ['Hay Bale', 'assets/base/hay_bale.png', 66, 'A cozy hay bale to sit on.', 50],
  } },
];
for (const se of SEASONS) Object.assign(ITEMS, se.items);
const season = () => SEASONS.find((se) => se.months.includes(new Date().getMonth())) || SEASONS[0];
// how many of each a rank may build (each rank gets everything the ranks before it had); only Beginner for now
const BUILD = {
  Beginner: { tent: 1, campfire: 1, bedroll: 2, rack: 1, sadbed: 1 },
};
const rankIx = (c) => Math.max(0, RANK_NAMES.indexOf(c?.rank || 'Starter'));
export const hasBase = (c) => !!c && !c.guest && rankIx(c) >= 1;
const limitsFor = (c) => { const out = {}; for (const r of RANK_NAMES.slice(1, rankIx(c) + 1)) for (const [k, n] of Object.entries(BUILD[r] || {})) out[k] = Math.max(out[k] || 0, n);
  for (const [k, n] of Object.entries(baseOf(c.id).owned || {})) if (ITEMS[k] && n > 0) out[k] = (out[k] || 0) + n;   // catalog pieces bought
  return out; };
const nextRank = (c) => RANK_NAMES[rankIx(c) + 1] || '';
const party = () => store.get('party') || {};
const baseOf = (id) => store.get('base/' + id) || {};
const GROUND_TOP = 30;   // % of the scene that is forest edge; things are built below it
// her ask 11-01: tap the tent to go inside and decorate it. Each built piece is in the clearing or (room: 'tent') inside.
const ROOMS = { camp: { pic: 'assets/nursery/grass.png', ground: GROUND_TOP }, tent: { pic: 'assets/base/tent_inside.png', ground: 46 } };
const NOT_INSIDE = new Set(['tent', 'campfire', 'rack']);   // no tents in tents, and no fires
const roomOf = (it) => (it?.room === 'tent' ? 'tent' : 'camp');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// little bits flying out of something (leaves out of the pile, sparks off the fire, Zzz off a sleeper)
function burst(strip, x, y, chars, n = 8, cls = '') {
  for (let i = 0; i < n; i++) { const s = document.createElement('span'); s.className = 'base-fx ' + cls; s.textContent = chars[i % chars.length];
    s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 90) + 'px'); s.style.setProperty('--dy', Math.round(-20 - Math.random() * 50) + 'px');
    s.style.animationDelay = Math.round(i * 40) + 'ms'; strip.appendChild(s); setTimeout(() => s.remove(), 1500 + i * 40); }
}

// the scene: a grassy clearing with what's been built, and the owner's (and a visitor's) character walking about
async function drawScene(scene, owner, visitor, room = 'camp') {
  const mons = [owner, visitor].filter((x) => x?.pokemon).map((x) => ({ name: x.pokemon, label: x.nickname, shiny: !!x.shiny, who: x.id }));
  // a fresh box each time, so the Pokémon of the room left behind stop walking
  scene.innerHTML = ''; scene.classList.toggle('in-tent', room === 'tent'); const box = document.createElement('div'); box.className = 'base-box'; scene.appendChild(box);
  const got = await mountFzScene(box, [{ key: 'base', mons, max: 4, floor: (ROOMS[room].ground + 4) / 100 }], '', ROOMS[room].pic);
  if (!box.isConnected) return;
  const strip = box.firstChild; if (!strip) return;
  const layer = document.createElement('div'); layer.className = 'base-items'; strip.appendChild(layer);
  const paint = () => {
    const items = baseOf(owner.id).items || {}; const size = strip.clientWidth || 340; const k = size / 420;
    layer.innerHTML = Object.entries(items).filter(([, it]) => ITEMS[it?.k] && roomOf(it) === room).map(([id, it]) => { const [name, img, w] = ITEMS[it.k]; const px = Math.round(w * k);
      return `<button class="base-item bi-${esc(it.k)}" data-bi="${esc(id)}" title="${esc(name)}" style="left:${it.x}%;top:${it.y}%;width:${px}px;z-index:${Math.min(880, 10 + Math.round(it.y / 100 * size))}"><img src="${img}" alt="${esc(name)}"></button>`; }).join('');
  };
  paint();
  return { layer, paint, strip, bots: got?.bots || [], room };
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
  let building = false; let picked = ''; let shopping = false; let buying = ''; let room = 'camp'; let s = null; const busyBots = new Set();   // Pokémon busy playing with something   // shopping = the catalog is open; buying = the piece being bought   // picked = a built piece tapped while building (Move / Put away)
  const panel = $('#bpanel', el);
  const counts = () => { const n = {}; for (const it of Object.values(baseOf(ownerId).items || {})) if (it) n[it.k] = (n[it.k] || 0) + 1; return n; };
  // the catalog: this season's pieces, what they cost and how many you have
  const catalogHTML = () => { const se = season(); const own = baseOf(ownerId).owned || {}; const poke = Number(party()[ownerId]?.poke) || 0;
    return `<div class="base-cat"><p style="margin:8px 0 2px"><b>${se.icon} ${esc(se.name)} catalog</b> <span class="small muted">· ${esc(owner.nickname)} has ${poke.toLocaleString()} Poké</span></p>
      ${buying ? `<p class="base-hint">Buy the <b>${esc(ITEMS[buying][0])}</b> for <b>${ITEMS[buying][4]} Poké</b>? <button class="btn sm" id="bbuyyes" ${poke < ITEMS[buying][4] ? 'disabled' : ''}>Buy it</button> <button class="btn alt sm" id="bbuyno">Cancel</button>${poke < ITEMS[buying][4] ? ' <span class="small bad-t">Not enough Poké yet.</span>' : ''}</p>` : ''}
      <div class="base-pal">${Object.entries(se.items).map(([k, it]) => `<button class="base-pick ${buying === k ? 'on' : ''}" data-buy="${k}"><img src="${it[1]}" alt=""><b>${esc(it[0])}</b><small>${it[4]} Poké${own[k] ? ` · have ${own[k]}` : ''}</small></button>`).join('')}</div></div>`; };
  const drawPanel = () => {
    const lim = limitsFor(owner); const n = counts(); const visits = Object.entries(baseOf(ownerId).visits || {}).filter(([id]) => party()[id] && id !== ownerId).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const empty = !Object.keys(n).length;
    panel.innerHTML = mine ? `
      ${picked && !placing ? `<p class="base-hint">${esc(ITEMS[baseOf(ownerId).items?.[picked]?.k]?.[0] || '')}: <button class="btn sm" id="bmv">↔️ Move</button> <button class="btn alt sm" id="bdel">📦 Put away</button> <button class="btn alt sm" id="bcancel">Cancel</button></p>` : ''}
      ${placing ? `<p class="base-hint">👆 Tap the ground where the ${esc(ITEMS[placing.k || baseOf(ownerId).items?.[placing.id]?.k]?.[0] || 'piece')} should go. <button class="btn alt sm" id="bcancel">Cancel</button></p>` : ''}
      <div class="row" style="justify-content:space-between"><span class="pill">${esc(owner.rank || 'Beginner')} rank base</span><span class="row" style="gap:6px"><button class="btn ${shopping ? '' : 'alt'} sm" id="bcat">${shopping ? '✓ Close catalog' : `📖 Catalog`}</button><button class="btn ${building ? '' : 'alt'} sm" id="bbuild">${building ? '✓ Done building' : '🔨 Build'}</button></span></div>
      ${shopping ? catalogHTML() : ''}
      ${building ? `<p class="small muted">Pick something to build, then tap the ground. Tap something you’ve built to move it or put it away.</p>
        <div class="base-pal">${Object.entries(lim).filter(([k]) => room === 'camp' || !NOT_INSIDE.has(k)).map(([k, max]) => `<button class="base-pick ${placing?.k === k ? 'on' : ''}" data-pick="${k}" ${(n[k] || 0) >= max ? 'disabled' : ''}><img src="${ITEMS[k][1]}" alt=""><b>${esc(ITEMS[k][0])}</b><small>${n[k] || 0} / ${max}</small></button>`).join('')}</div>
        ${nextRank(owner) ? `<p class="small muted">🔒 More to build at ${esc(nextRank(owner))} rank. Keep at it, and one day this camp could be a real building!</p>` : ''}`
      : empty ? `<p class="small">Your very own patch of Woodland Base! Tap <b>🔨 Build</b> to pitch your tent and set up camp.</p>` : ''}
      ${visits.length ? `<p class="small muted" style="margin-top:10px">👣 Recent visitors: ${visits.map(([id]) => esc(party()[id].nickname)).join(', ')}</p>` : ''}`
      : `<p class="small">You’re visiting ${esc(owner.nickname)}’s camp${empty ? '. They haven’t built anything yet!' : '. Make yourself at home!'}</p>`;
    // her ask 11-01: a button straight to the nursery page (and, inside the tent, one back out)
    panel.insertAdjacentHTML('afterbegin', room === 'tent' ? `<p class="base-hint">⛺ Inside the tent${mine ? '. Tap 🔨 Build to decorate it!' : ''} <button class="btn sm" id="bout">🚪 Step outside</button></p>` : '');
    panel.insertAdjacentHTML('beforeend', '<div class="row" style="justify-content:center;margin-top:10px"><button class="btn alt" id="bnurs">🍼 Visit the nursery</button></div>');
    const bo = $('#bout', panel); if (bo) bo.onclick = () => goRoom('camp');
    $('#bnurs', panel).onclick = () => { closeModal(); location.hash = '#/games/fernshade-nursery'; };
    const bb = $('#bbuild', panel); if (bb) bb.onclick = () => { building = !building; shopping = false; buying = ''; placing = null; picked = ''; drawPanel(); };
    const bk = $('#bcat', panel); if (bk) bk.onclick = () => { shopping = !shopping; building = false; buying = ''; placing = null; picked = ''; drawPanel(); };
    $$('[data-buy]', panel).forEach((b) => b.onclick = () => { buying = b.dataset.buy; drawPanel(); });
    const bno = $('#bbuyno', panel); if (bno) bno.onclick = () => { buying = ''; drawPanel(); };
    const byes = $('#bbuyyes', panel); if (byes) byes.onclick = () => {
      const k = buying; const price = ITEMS[k]?.[4] || 0; const me2 = party()[ownerId]; if (!k || !me2) return;
      if ((Number(me2.poke) || 0) < price) { toast('Not enough Poké for that one yet.'); return; }
      store.update('party/' + ownerId, (x) => ({ ...x, poke: (Number(x?.poke) || 0) - price }));
      store.update(`base/${ownerId}/owned/${k}`, (n) => (Number(n) || 0) + 1);
      store.pushLimited('log', { t: Date.now(), text: `${me2.nickname} bought a ${ITEMS[k][0]} for their base (${price} Poké).` });
      toast(`🎉 ${ITEMS[k][0]} is yours! Tap 🔨 Build to put it out.`); buying = ''; drawPanel();
    };
    const bc = $('#bcancel', panel); if (bc) bc.onclick = () => { placing = null; picked = ''; drawPanel(); };
    const bm = $('#bmv', panel); if (bm) bm.onclick = () => { placing = { id: picked }; picked = ''; drawPanel(); };
    const bd = $('#bdel', panel); if (bd) bd.onclick = () => { store.set(`base/${ownerId}/items/${picked}`, null); picked = ''; drawPanel(); };
    $$('[data-pick]', panel).forEach((b) => b.onclick = () => { placing = { k: b.dataset.pick }; picked = ''; drawPanel(); });
  };
  drawPanel();
  const unsub = store.subscribe(() => { if (!scene.isConnected) { unsub(); return; } s?.paint(); drawPanel(); });
  // her ask 11-01: everything at the base can be played with. Tap a piece and your Pokémon (the visitor's, when visiting) walks
  // over and uses it: jumps in the leaves, tends the fire, naps on a bed, gets spooked by the Spinarak web...
  const actor = () => s?.bots.find((b) => b.m.who === (visitor ? visitor.id : ownerId));
  const play = async (itEl, v, b = actor(), quiet = false) => {   // quiet: playing on its own (no messages)
    const who = (b && party()[b.m.who]) || visitor || owner; const nick = who.nickname; const tell = quiet ? () => {} : toast;
    const wig = (cls = 'wig', ms = 1200) => { itEl.classList.remove(cls); void itEl.offsetWidth; itEl.classList.add(cls); setTimeout(() => itEl.classList.remove(cls), ms); };
    const ix = itEl.offsetLeft; const iy = itEl.offsetTop; const iw = itEl.offsetWidth; const ih = itEl.offsetHeight; const W = s.strip.clientWidth;
    const clampX = (x) => Math.max(2, Math.min(W - (b?.w || 40) - 2, x));
    const onTop = (dy = 0) => [clampX(ix + iw / 2 - b.w / 2), iy + ih * 0.6 - b.h + dy];   // standing on (or in) the piece
    const beside = () => { const left = ix > W / 2; return [clampX(left ? ix - b.w + 6 : ix + iw - 6), Math.max(iy + ih - b.h, s.strip.clientHeight * ROOMS[room].ground / 100)]; };
    const over = () => { b.el.style.zIndex = Number(itEl.style.zIndex) + 1; };
    if (!b || busyBots.has(b)) { if (!quiet) { toast(ITEMS[v.k][3]); wig(); } return; }
    busyBots.add(b); b.busy = true;
    try {
      const k = v.k;
      if (k === 'tent') {
        await b.go(clampX(ix + iw / 2 - b.w / 2), iy + ih - b.h - 2); b.face('up'); await wait(250);
        tell(`${nick} ducks inside the tent.`); await b.vanish(); busyBots.clear(); return goRoom('tent');
      }
      if (k === 'leaves') {
        await b.go(clampX(ix + iw / 2 - b.w / 2), iy + ih - b.h * 0.8); over(); b.hop(); await wait(260); b.el.style.zIndex = Number(itEl.style.zIndex) - 1;   // down into the pile
        tell(`${nick} jumps into the leaf pile! Crunch crunch!`);
        for (let i = 0; i < 3; i++) { wig('crunch', 500); burst(s.strip, ix + iw / 2, iy + ih * 0.3, ['🍂', '🍁', '🍂', '🍃'], 7); b.hop(); await wait(650); }
        b.say('😆'); await wait(500); await b.go(...beside());
      } else if (k === 'campfire') {
        await b.go(...beside()); b.face(b.x < ix ? 'right' : 'left'); await wait(300);
        b.say('🔥'); b.hop(); await wait(500); itEl.classList.add('stoke'); tell(`${nick} adds a stick to the fire. It roars up bright and warm!`);
        for (let i = 0; i < 4; i++) { burst(s.strip, ix + iw / 2, iy + ih * 0.35, ['✨', '🔥', '✨'], 4, 'up'); await wait(700); }
        b.say('😊'); await wait(1200); itEl.classList.remove('stoke');
      } else if (k === 'bedroll' || k === 'sadbed') {
        await b.go(...onTop(4)); over(); b.nap(true); tell(k === 'sadbed' ? `${nick} lies down on the straw. It’s… lumpy. Zzz…` : `${nick} curls up on the bedroll for a nap. Zzz…`);
        for (let i = 0; i < 6; i++) { burst(s.strip, b.x + b.w * 0.7, b.y + b.h * 0.3, ['💤'], 1, 'zz'); await wait(1100); }
        b.nap(false); b.hop(); b.say(k === 'sadbed' ? '😣' : '☀️'); if (k === 'sadbed') tell(`${nick} wakes up a little stiff. A comfier bed someday, maybe!`);
        await wait(700); await b.go(...beside());
      } else if (k === 'hay') {
        await b.go(...onTop(-12)); over(); b.hop(); b.say('😌'); tell(`${nick} sits on the hay bale and swings their feet.`); await wait(3200); b.hop(); await wait(300); await b.go(...beside());
      } else if (k === 'spinarak') {
        await b.go(clampX(ix + iw / 2 - b.w / 2), iy + ih + 4 - b.h * 0.2); b.face('up'); await wait(500);
        wig('drop', 1100); await wait(350); b.say('❗'); b.hop(); tell(`A Spinarak swings down from its web! ${nick} jumps out of their skin!`);
        await wait(300); b.say('😱'); const away = b.x + (b.x > W / 2 ? -W * 0.35 : W * 0.35); await b.go(clampX(away), Math.min(s.strip.clientHeight - b.h - 20, b.y + 30)); b.hop(); await wait(400); b.say('💦');
      } else if (k === 'rack') {
        await b.go(...beside()); b.face(b.x < ix ? 'right' : 'left'); await wait(300); wig(); b.say('🍓'); tell(`${nick} sneaks a berry off the drying rack. Yum!`); await wait(900); b.hop(); b.say('😋'); await wait(600);
      } else if (k === 'pumpkaboo' || k === 'litwick') {
        await b.go(...beside()); b.face(b.x < ix ? 'right' : 'left'); itEl.classList.add('glow');
        tell(k === 'pumpkaboo' ? `The Pumpkaboo lantern glows brighter when ${nick} says hello. Boo!` : `${nick} warms up by the Litwick candles. So cozy!`);
        b.say(k === 'pumpkaboo' ? '🎃' : '🕯️'); await wait(1500); b.hop(); b.say('😊'); await wait(1300); itEl.classList.remove('glow');
      } else if (k === 'zubat' || k === 'noibat' || k === 'hoothoot' || k === 'murkrow') {
        await b.go(...beside()); b.face('up'); wig(); b.say(k === 'hoothoot' ? '🎶' : k === 'murkrow' ? '⭐' : '❗');
        tell({ zubat: `${nick} bats at the Zubat bunting and sets it swinging.`, noibat: `The Noibat bunting flutters. ${nick} jumps! Eeek!`, hoothoot: `${nick} hoots back at the carved Hoothoot. Hoo-hoo!`, murkrow: `${nick} finds something shiny tucked by the Murkrow post!` }[k]);
        await wait(900); b.hop(); await wait(900);
      } else { await b.go(...beside()); tell(ITEMS[k][3]); wig(); b.hop(); await wait(800); }
    } finally { if (busyBots.delete(b)) { if (b.el.isConnected) { b.face('down'); b.place(); } b.busy = false; } }
  };
  // the nursery buddy: follows the owner's Pokémon around (or sits by the beds if it's still an egg)
  const addBuddy = (bl) => {
    const strip = s.strip; const W = strip.clientWidth; const H = strip.clientHeight; const k = W / 420; const ground = H * ROOMS[room].ground / 100;
    const el2 = document.createElement('div'); el2.className = 'base-buddy'; strip.appendChild(el2);
    const label = bl.egg ? `${owner.nickname}’s egg` : bl.name;
    let pw; let ph; let spr = null;
    if (bl.egg) { pw = Math.round(38 * 2.2 * k); ph = Math.round(32 * 2.2 * k); el2.innerHTML = `<img class="bb-egg" src="assets/base/egg_blanket.png" alt="" style="width:${pw}px"><span class="fzs-tag">${esc(label)}</span>`; }
    else { const S = [1, 1.1, 1.3, 1.5][bl.stage] * Math.max(1, k * 1.15); pw = Math.round(bl.cw * S); ph = Math.round(bl.ch * S);
      el2.innerHTML = `<span class="baby-spr" style="width:${pw}px;height:${ph}px;background-image:url(${bl.url});background-size:${pw * 10}px ${ph * 7}px"></span><span class="fzs-tag" style="margin-top:-${Math.round(ph * 0.43) + 2}px">${esc(label)}</span>`; spr = el2.firstChild; }
    const R = { idle: 0, hop: 1, right: 3, left: 4 };
    const row = (name, loop = true) => { if (!spr) return; const r = R[name]; const n = bl.fr[r] || 1; spr.style.backgroundPositionY = `-${r * ph}px`; spr.style.setProperty('--fw', pw + 'px'); spr.style.setProperty('--n', n);
      spr.style.animation = 'none'; void spr.offsetWidth; spr.style.animation = `baby-anim ${Math.max(0.4, n * 0.12)}s steps(${n}, jump-none) ${loop ? 'infinite' : '1 forwards'}`; };
    // x, y = where its feet are; a baby sheet's feet sit a little below the middle of its frame, an egg's at the bottom
    let x; let y;
    const put = (ms = 0) => { el2.style.transition = ms ? `left ${ms}ms linear, top ${ms}ms linear` : 'none'; el2.style.left = Math.round(x - pw / 2) + 'px'; el2.style.top = Math.round(y - (bl.egg ? ph : ph * 0.57)) + 'px'; el2.style.zIndex = Math.min(880, 10 + Math.round(y)); };
    const items = Object.values(baseOf(ownerId).items || {}).filter((it) => roomOf(it) === room);
    const bed = items.find((it) => it.k === 'bedroll' || it.k === 'sadbed') || items.find((it) => it.k === 'campfire');
    if (bed) { const bw = ITEMS[bed.k][2] * k; x = bed.x / 100 * W + bw + pw * 0.45; if (x > W - pw / 2) x = bed.x / 100 * W - pw * 0.45; y = bed.y / 100 * H + (bed.k === 'campfire' ? 46 : 30) * k; }   // beside the bed, not on it
    else { x = W * 0.2; y = H * 0.8; }
    x = Math.max(pw / 2, Math.min(W - pw / 2, x)); y = Math.max(ground + 20, Math.min(H - 8, y));
    put(); row('idle');
    el2.onclick = (e) => { e.stopPropagation(); el2.classList.remove('hopb'); void el2.offsetWidth; el2.classList.add('hopb'); row('hop', false); setTimeout(() => row('idle'), 900);
      const h = document.createElement('span'); h.className = 'fzs-say'; h.textContent = '💕'; el2.appendChild(h); setTimeout(() => h.remove(), 1600);
      toast(bl.egg ? `${label} is snug and warm in its blanket. It wiggled!` : `${label} is so happy to be at camp!`); };
    if (bl.egg) { const wob = setInterval(() => { if (!el2.isConnected) return clearInterval(wob); if (Math.random() < 0.5) { el2.classList.remove('hopb'); void el2.offsetWidth; el2.classList.add('hopb'); } }, 4000); return; }
    const lead = s.bots.find((b) => b.m.who === ownerId) || s.bots[0];
    const tick = setInterval(() => {
      if (!el2.isConnected) return clearInterval(tick);
      let tx; let ty;
      if (lead) { const side = lead.x + lead.w / 2 > x ? -1 : 1; tx = lead.x + lead.w / 2 + side * (lead.w * 0.45 + pw * 0.3); ty = lead.y + lead.h * 0.85; }
      else { tx = pw / 2 + Math.random() * (W - pw); ty = ground + 30 + Math.random() * (H - ground - 40); }
      tx = Math.max(pw / 2, Math.min(W - pw / 2, tx)); ty = Math.max(ground + 20, Math.min(H - 8, ty));
      const d = Math.hypot(tx - x, ty - y);
      if (d < 30) { if (Math.random() < 0.2) { row('hop', false); setTimeout(() => row('idle'), 900); } return; }
      const ms = Math.round(d / 50 * 1000); row(tx > x ? 'right' : 'left'); x = tx; y = ty; put(ms); setTimeout(() => el2.isConnected && row('idle'), ms);
    }, 1600);
  };
  const goRoom = (r) => { room = r; placing = null; picked = ''; busyBots.clear(); drawPanel(); mount(); };
  const mount = () => drawScene(scene, owner, visitor, room).then((got) => {
    if (!got) return; s = got;
    // her ask 11-01: your own Pokémon is always in front of everything at the base
    actor()?.el.classList.add('me');
    // her ask 11-01: the owner and visitors play with things on their own now and then (quietly, no messages)
    const auto = setInterval(() => {
      if (!s.strip.isConnected) return clearInterval(auto);
      if (building || placing || Math.random() < 0.4) return;
      const free = s.bots.filter((b) => !b.busy && !busyBots.has(b)); const items = baseOf(ownerId).items || {};
      const els = [...s.layer.querySelectorAll('[data-bi]')].filter((el) => items[el.dataset.bi] && items[el.dataset.bi].k !== 'tent');
      if (!free.length || !els.length) return;
      const el2 = els[Math.floor(Math.random() * els.length)]; play(el2, items[el2.dataset.bi], free[Math.floor(Math.random() * free.length)], true);
    }, 7000);
    // her ask 11-01: the owner's nursery buddy hangs out at the base like a Puffle (an egg sits bundled in a blanket)
    import('./nursery.js?v=6ae75378').then((n) => n.buddyLook?.(ownerId)).then((bl) => { if (bl && s.strip.isConnected) addBuddy(bl); }).catch(() => {});
    // building: tap the ground to place; tap a built piece for Move / Put away. Anyone may tap a piece to play with it.
    s.strip.addEventListener('click', (e) => {
      const it = e.target.closest('[data-bi]');
      if (placing && !it) {
        const r = s.strip.getBoundingClientRect(); const item = placing.k || baseOf(ownerId).items?.[placing.id]?.k; const w = ITEMS[item]?.[2] / 420 * r.width || 60;
        const x = Math.max(0, Math.min(100 - w / r.width * 100, ((e.clientX - r.left) - w / 2) / r.width * 100));
        const y = Math.max(ROOMS[room].ground, Math.min(88, ((e.clientY - r.top) / r.height * 100) - 8));
        const pos = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
        if (placing.id) store.update(`base/${ownerId}/items/${placing.id}`, (v) => (v ? { ...v, ...pos } : v));
        else { const n = counts()[placing.k] || 0; if (n >= (limitsFor(owner)[placing.k] || 0)) { toast('No room for another one of those yet.'); placing = null; drawPanel(); return; }
          store.set(`base/${ownerId}/items/${uid()}`, { k: placing.k, ...pos, t: Date.now(), ...(room === 'tent' ? { room: 'tent' } : {}) }); }
        placing = null; drawPanel(); return;
      }
      if (!it) return;
      const id = it.dataset.bi; const v = baseOf(ownerId).items?.[id]; if (!v) return;
      if (mine && building) { picked = id; placing = null; drawPanel(); return; }
      play(it, v);
    });
  });
  mount();
}

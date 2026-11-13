// The carnival midway you walk around (her ask 11-12: "increase the detail off the types of rides and stands in the
// background. I want it to feel busy and where we can walk around"). A wide night midway that scrolls with you: an
// entrance arch, every booth game as its own stall (with its host Pokémon behind the counter), every ride built out
// (Ferris wheel, big top, carousel, tea cups, a running coaster, the funhouse), the snack stands, lamp posts with
// string lights, and a crowd of Pokémon wandering about. Walk with the arrow buttons, the keyboard or by tapping a spot;
// stand by a booth or ride and tap the pop-up (or tap the booth itself) to play / ride / buy.
const fz = () => import('./fzscene.js?v=6af6607f').catch(() => null);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const P = (k) => `assets/portraits/${k}.png`;
const ROW = { right: 2, left: 6 };
export const MW_W = 3120;          // world width in px
const FAR = 0.35;                   // far skyline moves at this share of the camera
const CROWD = ['Bidoof', 'Pachirisu', 'Buneary', 'Shinx', 'Starly', 'Chimchar', 'Piplup', 'Turtwig', 'Eevee', 'Azurill', 'Skitty', 'Teddiursa',
  'Phanpy', 'Marill', 'Meowth', 'Psyduck', 'Oddish', 'Mareep', 'Togepi', 'Sentret', 'Cyndaquil', 'Totodile', 'Chikorita', 'Treecko', 'Torchic',
  'Mudkip', 'Shroomish', 'Wingull', 'Plusle', 'Minun', 'Spheal', 'Swablu', 'Clefairy', 'Jigglypuff', 'Vulpix', 'Growlithe', 'Poochyena', 'Zigzagoon'];

// seeded random so the skyline and litter look the same every visit
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const bulbs = (n, w, y, cls = '') => Array.from({ length: n }, (_, i) => `<i class="mw-bulb ${cls}" style="left:${((i + 0.5) / n * w).toFixed(1)}px;top:${y}px;animation-delay:${(i % 4) * 0.25}s"></i>`).join('');
const prizes = (r, n) => Array.from({ length: n }, () => ['ted', 'bow', 'star', 'bal', 'yo', 'gift', 'gem', 'ted'][Math.floor(r() * 8)]).map((p, i) => `<i class="mw-pz ${p}" style="animation-delay:${(i * 0.3).toFixed(1)}s"></i>`).join('');

// a booth-game stall: striped awning, lit sign, prizes on the back wall, the host behind the counter
function booth(x, w, spot, title, host, a, b, r, extra = '') {
  return `<button class="mw-spot mw-booth" data-spot="${spot}" data-x="${x}" style="left:${x - w / 2}px;width:${w}px;--a:${a};--b:${b}" aria-label="${esc(title)}">
    <span class="mw-bpost l"></span><span class="mw-bpost r"></span>
    <span class="mw-back"><span class="mw-prz">${prizes(r, Math.round(w / 26))}</span></span>
    <span class="mw-host" data-sp="${esc(host)}"></span>${extra}
    <span class="mw-counter"><span class="mw-ctop"></span></span>
    <span class="mw-awn"></span><span class="mw-sign">${esc(title)}${bulbs(Math.round(w / 14), w - 16, -5, 'sm')}</span></button>`;
}

function wheel(x) {
  const n = 14; const R = 104;
  const arms = Array.from({ length: n }, (_, i) => { const t = i * 2 * Math.PI / n; const px = Math.cos(t) * R; const py = Math.sin(t) * R;
    return `<line x1="0" y1="0" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#f2c14e" stroke-width="1.6"/><circle class="cv-bulb" cx="${(px * 0.62).toFixed(1)}" cy="${(py * 0.62).toFixed(1)}" r="2.4" style="animation-delay:${(i % 3) * 0.3}s"/><circle class="cv-bulb" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.2" style="animation-delay:${(i % 4) * 0.25}s"/>`; }).join('');
  const cars = Array.from({ length: n / 2 }, (_, i) => { const t = i * 4 * Math.PI / n; const px = Math.cos(t) * R; const py = Math.sin(t) * R;
    return `<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})"><g class="mw-gond"><line x1="0" y1="0" x2="0" y2="8" stroke="#c99a3a" stroke-width="1.4"/><path d="M-11 8 h22 v10 q0 6 -6 6 h-10 q-6 0 -6 -6 Z" fill="${['#e24a4a', '#4a8fe2', '#f2c14e', '#a45ae2', '#3ec27a', '#ff8ad0', '#ff9b3a'][i]}" stroke="#2b1d12" stroke-width="1"/><rect x="-8" y="11" width="16" height="5" rx="1" fill="#ffe9b0" opacity=".85"/></g></g>`; }).join('');
  return `<button class="mw-spot mw-ride mw-wheel" data-spot="ride:wheel" data-x="${x}" style="left:${x - 125}px" aria-label="Wishing Star Wheel">
    <svg viewBox="-125 -125 250 290" aria-hidden="true"><path d="M0 0 L-62 158 M0 0 L62 158 M-40 102 L40 102" stroke="#c99a3a" stroke-width="5" fill="none"/>
      <g class="mw-wspin"><circle r="${R}" fill="none" stroke="#f2c14e" stroke-width="3"/><circle r="${R * 0.62}" fill="none" stroke="#f2c14e" stroke-width="1.6"/>${arms}${cars}</g>
      <circle r="13" fill="#f2c14e" stroke="#8a5a1a" stroke-width="2"/><text y="4" text-anchor="middle" font-size="12">⭐</text>
      <rect x="-70" y="152" width="140" height="12" rx="3" fill="#6b2a3a" stroke="#f2c14e" stroke-width="2"/></svg>
    <span class="mw-tag">Wishing Star Wheel</span></button>`;
}

function bigTop(x) {
  return `<button class="mw-spot mw-ride mw-bigtop" data-spot="game:hats" data-x="${x}" style="left:${x - 140}px" aria-label="Haunter’s Hat Trick">
    <svg viewBox="0 -30 280 220" aria-hidden="true"><defs><pattern id="mwst" width="28" height="10" patternUnits="userSpaceOnUse"><rect width="14" height="10" fill="#7a3ad6"/><rect x="14" width="14" height="10" fill="#f6eedf"/></pattern>
      <linearGradient id="mwsh" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
      <path d="M140 -6 L268 92 L268 186 L12 186 L12 92 Z" fill="url(#mwst)"/><path d="M12 92 h256 v94 h-256 Z" fill="url(#mwsh)"/>
      <path d="M140 -6 L268 92 L12 92 Z" fill="url(#mwst)" stroke="#3a1a6a" stroke-width="2"/><path d="M140 -6 L268 92 L12 92 Z" fill="url(#mwsh)"/>
      <path d="M140 -6 L140 -26 L162 -19 L140 -12" fill="#f2c14e"/><path d="M60 52 L60 40 L74 44 L60 48" fill="#ff6a6a"/><path d="M220 52 L220 40 L234 44 L220 48" fill="#6ad0ff"/>
      <path d="M12 92 Q32 106 52 92 Q72 106 92 92 Q112 106 132 92 Q152 106 172 92 Q192 106 212 92 Q232 106 252 92 Q262 100 268 92" fill="none" stroke="#f2c14e" stroke-width="4"/>
      <path class="cv-door" d="M108 186 Q140 118 172 186 Z" fill="#ffd77a"/><path d="M108 186 Q120 140 140 128 L140 186 Z M172 186 Q160 140 140 128 L140 186 Z" fill="#5a1f8a" opacity=".55"/>
      ${Array.from({ length: 11 }, (_, i) => `<circle class="cv-bulb" cx="${18 + i * 24.4}" cy="${100 + (i % 2) * 5}" r="2.6" style="animation-delay:${(i % 3) * 0.3}s"/>`).join('')}</svg>
    <span class="mw-host big" data-sp="Haunter"></span><span class="mw-tag">🎩 Haunter’s Hat Trick</span></button>`;
}

function carousel(x) {
  return `<button class="mw-spot mw-ride mw-carousel" data-spot="ride:carousel" data-x="${x}" style="left:${x - 100}px" aria-label="Rapidash Carousel">
    <svg viewBox="0 -14 200 180" aria-hidden="true"><path d="M100 -10 L196 46 L4 46 Z" fill="#e24a6a" stroke="#f2c14e" stroke-width="2.5"/><path d="M100 -10 L148 46 L52 46 Z" fill="#f6eedf" opacity=".9"/><path d="M100 -10 L100 -22" stroke="#f2c14e" stroke-width="3"/><circle cx="100" cy="-24" r="5" fill="#f2c14e"/>
      <path d="M4 46 Q16 58 28 46 Q40 58 52 46 Q64 58 76 46 Q88 58 100 46 Q112 58 124 46 Q136 58 148 46 Q160 58 172 46 Q184 58 196 46" fill="#f2c14e"/>
      ${Array.from({ length: 9 }, (_, i) => `<circle class="cv-bulb" cx="${12 + i * 22}" cy="52" r="2.4" style="animation-delay:${(i % 3) * 0.3}s"/>`).join('')}
      <rect x="86" y="56" width="28" height="84" fill="#a45ae2" stroke="#f2c14e" stroke-width="1.5"/>
      ${[24, 58, 142, 176].map((px, i) => `<line x1="${px}" y1="58" x2="${px}" y2="140" stroke="#f2c14e" stroke-width="2.5"/>`).join('')}
      <rect x="2" y="140" width="196" height="16" rx="4" fill="#6b2a3a" stroke="#f2c14e" stroke-width="2"/></svg>
    ${[24, 58, 142, 176].map((px, i) => `<span class="mw-horse" style="left:${px}px;animation-delay:${i * 0.45}s" data-sp="${['Rapidash', 'Ponyta', 'Rapidash', 'Ponyta'][i]}"></span>`).join('')}
    <span class="mw-tag">🎠 Rapidash Carousel</span></button>`;
}

function teacups(x) {
  const cup = (cx, col, d) => `<g transform="translate(${cx} 92)"><g class="mw-cup" style="animation-delay:${d}s"><ellipse cx="0" cy="10" rx="26" ry="9" fill="#2b1d12" opacity=".35"/><path d="M-24 -10 Q-22 14 0 16 Q22 14 24 -10 Z" fill="${col}" stroke="#fff" stroke-width="2"/><ellipse cx="0" cy="-10" rx="24" ry="7" fill="#fff"/><ellipse cx="0" cy="-10" rx="19" ry="5" fill="#4a2a1a"/><path d="M24 -4 q12 2 2 12" fill="none" stroke="#fff" stroke-width="3"/></g></g>`;
  return `<button class="mw-spot mw-ride mw-teacups" data-spot="ride:teacups" data-x="${x}" style="left:${x - 110}px" aria-label="Lapras Tea Cups">
    <svg viewBox="0 0 220 130" aria-hidden="true"><ellipse cx="110" cy="108" rx="106" ry="20" fill="#3a7ac2" stroke="#f2c14e" stroke-width="3"/><ellipse cx="110" cy="104" rx="96" ry="15" fill="#5fa8e8"/>
      ${cup(46, '#ff8ad0', 0)}${cup(110, '#6ad0ff', 0.4)}${cup(174, '#ffd24a', 0.8)}</svg>
    <span class="mw-host" data-sp="Lapras" style="left:50%;bottom:22px;z-index:0"></span><span class="mw-tag">🫖 Lapras Tea Cups</span></button>`;
}

// the coaster: a lattice track with a car (Dragonite up front) running the loop; offset-path keeps the car on the rails
function coaster(x) {
  const pts = []; for (let px = 0; px <= 360; px += 6) { const y = 196 - 160 * Math.exp(-(((px - 100) / 34) ** 2)) - 92 * Math.exp(-(((px - 236) / 30) ** 2)) - 36 * Math.exp(-(((px - 172) / 22) ** 2)); pts.push([px, +y.toFixed(1)]); }
  const d = 'M' + pts.map((p) => p.join(' ')).join(' L');
  const ret = 'M' + pts.map((p) => p.join(' ')).join(' L') + ' L360 204 L0 204 Z';
  const sup = pts.filter((_, i) => i % 3 === 0).map(([px, y]) => `<line x1="${px}" y1="${y}" x2="${px}" y2="204" stroke="#7a5a3a" stroke-width="1.6"/>`).join('');
  const cross = pts.filter((_, i) => i % 6 === 0).map(([px, y], i, a) => (a[i + 1] ? `<line x1="${px}" y1="${y + 4}" x2="${a[i + 1][0]}" y2="204" stroke="#7a5a3a" stroke-width="1"/><line x1="${px}" y1="204" x2="${a[i + 1][0]}" y2="${a[i + 1][1] + 4}" stroke="#7a5a3a" stroke-width="1"/>` : '')).join('');
  return `<button class="mw-spot mw-ride mw-coaster" data-spot="ride:coaster" data-x="${x}" style="left:${x - 180}px" aria-label="Dragonite Coaster">
    <svg viewBox="0 0 360 210" aria-hidden="true">${sup}${cross}<path d="${d}" fill="none" stroke="#e24a4a" stroke-width="5"/><path d="${d}" fill="none" stroke="#ffb0a0" stroke-width="1.2" transform="translate(0 -2)"/>
      ${pts.filter((_, i) => i % 5 === 0).map(([px, y], i) => `<circle class="cv-bulb" cx="${px}" cy="${y - 4}" r="2" style="animation-delay:${(i % 3) * 0.3}s"/>`).join('')}
      <rect x="0" y="196" width="40" height="12" fill="#6b2a3a" stroke="#f2c14e"/><text x="20" y="206" text-anchor="middle" font-size="8" fill="#ffe7a0">GO!</text></svg>
    <span class="mw-train" style="offset-path:path('${d}')"><span class="mw-car"></span><span class="mw-car"></span><span class="mw-car lead"></span></span>
    <span class="mw-dragfly" style="offset-path:path('${d}')"><span class="mw-drag" data-sp="Dragonite"></span></span>
    <svg class="mw-reinsvg" viewBox="0 0 360 210" aria-hidden="true"><line class="r1"/><line class="r2"/></svg>
    <span class="mw-tag">🎢 Dragonite Coaster</span></button>`;
}

function funhouse(x) {
  return `<button class="mw-spot mw-ride mw-fun" data-spot="ride:funhouse" data-x="${x}" style="left:${x - 110}px" aria-label="Haunter’s Funhouse">
    <svg viewBox="0 0 220 220" aria-hidden="true"><path d="M20 216 L14 70 L60 18 L112 52 L160 6 L208 64 L202 216 Z" fill="#2a1840" stroke="#a45ae2" stroke-width="3"/>
      <path d="M14 70 L60 18 L112 52 L160 6 L208 64" fill="none" stroke="#f2c14e" stroke-width="3"/>
      ${[[40, 90, -6], [170, 96, 8], [44, 150, 4], [172, 152, -5]].map(([wx, wy, rot]) => `<rect class="mw-win" x="${wx - 13}" y="${wy - 15}" width="26" height="30" rx="3" transform="rotate(${rot} ${wx} ${wy})" fill="#b47aff" stroke="#2b1d12" stroke-width="2"/>`).join('')}
      <ellipse cx="110" cy="112" rx="38" ry="46" fill="#1a0e2c" stroke="#f2c14e" stroke-width="4"/>
      <path d="M86 216 Q110 160 134 216 Z" fill="#0c0618"/><path d="M86 216 Q110 160 134 216" fill="none" stroke="#ff4ad0" stroke-width="2" class="mw-neon"/>
      <rect x="54" y="172" width="112" height="0" fill="none"/></svg>
    <img class="mw-ghost" src="${P('haunter')}" alt=""><span class="mw-fsign">FUNHOUSE</span><span class="mw-tag">🪞 Haunter’s Funhouse</span></button>`;
}

function strength(x) {
  return `<button class="mw-spot mw-booth mw-str" data-spot="game:hammer" data-x="${x}" style="left:${x - 50}px" aria-label="Scrafty’s Strength Test">
    <svg viewBox="0 0 100 230" aria-hidden="true"><rect x="40" y="18" width="20" height="196" rx="4" fill="#f6eedf" stroke="#8a5a1a" stroke-width="2"/>
      ${Array.from({ length: 9 }, (_, i) => `<rect x="43" y="${30 + i * 20}" width="14" height="14" rx="2" fill="${['#e24a4a', '#ff7a3a', '#ff9b3a', '#ffc23a', '#ffe14a', '#c6e84a', '#7ad84a', '#3ec27a', '#3aa0c2'][i]}" class="mw-meter" style="animation-delay:${(8 - i) * 0.12}s"/>`).join('')}
      <circle cx="50" cy="12" r="11" fill="#f2c14e" stroke="#8a5a1a" stroke-width="2" class="mw-bell"/><rect x="18" y="210" width="64" height="16" rx="3" fill="#6b2a3a" stroke="#f2c14e" stroke-width="2"/></svg>
    <span class="mw-host" data-sp="Scrafty" style="left:12px;bottom:12px"></span><span class="mw-tag">🔔 Strength Test</span></button>`;
}

// her ask 11-12 "make the the same stlye as the cotton candy": shelf prizes and treats are drawn (CSS) like the cotton
// candy cones instead of emoji
// snack counters (her ask 11-12 "give the swirlix a cotton candy counter"): a stall like the game booths, its treats on
// the back shelf, the snack maker behind the counter and a machine on top (cotton candy spinner, popcorn cart, cake stand)
const SNACK_LOOK = {
  cotton: { a: '#ff8ad0', b: '#bfe6ff', shelf: '<i class="mw-cc p"></i><i class="mw-cc b"></i><i class="mw-cc p"></i><i class="mw-cc b"></i>', top: '<span class="mw-spinner"><i></i></span>' },
  popcorn: { a: '#d63a3a', b: '#fff4c8', shelf: '<i class="mw-pz pop"></i><i class="mw-pz cup"></i><i class="mw-pz pop"></i><i class="mw-pz cup"></i>', top: '<span class="mw-popper"><i></i><i></i><i></i></span>' },
  puff: { a: '#ff9bc8', b: '#fff0f6', shelf: '<i class="mw-pz cake"></i><i class="mw-pz slice"></i><i class="mw-pz cake"></i><i class="mw-pz slice"></i>', top: '<span class="mw-cakestand"><i class="mw-pz cake"></i></span>' },
};
function stand(x, k, S) {
  const L = SNACK_LOOK[k] || SNACK_LOOK.popcorn; const w = k === 'cotton' ? 140 : 120;
  return `<button class="mw-spot mw-booth mw-snack s-${k}" data-spot="snack:${k}" data-x="${x}" style="left:${x - w / 2}px;width:${w}px;--a:${L.a};--b:${L.b}" title="${esc(S.name)} · ${S.cost} tickets" aria-label="${esc(S.name)}">
    <span class="mw-bpost l"></span><span class="mw-bpost r"></span>
    <span class="mw-back"><span class="mw-prz mw-treats">${L.shelf}</span></span>
    <span class="mw-host" data-sp="${esc(S.who)}"></span>${L.top}
    <span class="mw-counter"><span class="mw-ctop"></span><span class="mw-price">🎟️ ${S.cost}</span></span>
    <span class="mw-awn"></span><span class="mw-sign">${esc(S.name)}${bulbs(Math.round(w / 14), w - 16, -5, 'sm')}</span></button>`;
}

function arch(x) {
  return `<div class="mw-arch" style="left:${x - 110}px"><span class="mw-apost l"></span><span class="mw-apost r"></span><span class="mw-asign">⭐ STAR CARNIVAL ⭐${bulbs(16, 204, -6)}${bulbs(16, 204, 30)}</span></div>`;
}

// far skyline: hills, pines, distant tents, a drop tower and a second coaster, all in dark violet with tiny lights
function farHTML(w) {
  const r = rng(77); let s = '';
  s += `<path d="M0 150 ${Array.from({ length: Math.ceil(w / 60) + 1 }, (_, i) => `Q${i * 60 + 30} ${118 + r() * 22} ${i * 60 + 60} ${140 + r() * 12}`).join(' ')} L${w} 220 L0 220 Z" fill="#1c0f33"/>`;
  for (let px = 0; px < w; px += 16 + r() * 18) { const h = 22 + r() * 30; s += `<path d="M${px} 160 L${px + 8} ${160 - h} L${px + 16} 160 Z" fill="#160b29"/>`; }
  for (let px = 40; px < w; px += 170 + r() * 120) {
    const k = r(); const b = 168;
    if (k < 0.4) { const tw = 40 + r() * 30; s += `<path d="M${px} ${b} L${px + tw / 2} ${b - 34 - r() * 16} L${px + tw} ${b} Z" fill="#2c1748"/><circle class="mw-farl" cx="${px + tw / 2}" cy="${b - 40}" r="1.6" style="animation-delay:${r().toFixed(2)}s"/>`; }
    else if (k < 0.6) { s += `<rect x="${px}" y="${b - 120}" width="8" height="120" fill="#2c1748"/><rect x="${px - 6}" y="${b - 66 - r() * 40}" width="20" height="8" fill="#3a2060"/><circle class="mw-farl red" cx="${px + 4}" cy="${b - 124}" r="2.4"/>`; }
    else if (k < 0.8) { let p = `M${px} ${b}`; for (let j = 0; j <= 10; j++) p += ` L${px + j * 12} ${b - 30 - Math.abs(Math.sin(j * 0.9)) * 50}`; s += `<path d="${p}" fill="none" stroke="#3a2060" stroke-width="3"/>${Array.from({ length: 6 }, (_, j) => `<line x1="${px + j * 22}" y1="${b}" x2="${px + j * 22}" y2="${b - 30 - Math.abs(Math.sin(j * 22 / 12 * 0.9)) * 50}" stroke="#2c1748" stroke-width="1.5"/>`).join('')}`; }
    else { s += `<circle cx="${px + 30}" cy="${b - 40}" r="30" fill="none" stroke="#3a2060" stroke-width="2.5"/><path d="M${px + 30} ${b - 40} L${px + 12} ${b} M${px + 30} ${b - 40} L${px + 48} ${b}" stroke="#2c1748" stroke-width="2.5"/>${Array.from({ length: 8 }, (_, j) => `<circle class="mw-farl" cx="${(px + 30 + Math.cos(j * 0.785) * 30).toFixed(1)}" cy="${(b - 40 + Math.sin(j * 0.785) * 30).toFixed(1)}" r="1.4" style="animation-delay:${(j * 0.2).toFixed(1)}s"/>`).join('')}`; }
  }
  return `<svg class="mw-farsvg" viewBox="0 0 ${w} 220" width="${w}" height="220" preserveAspectRatio="none" aria-hidden="true">${s}</svg>`;
}

// lamp posts with string lights sagging between them, plus confetti, popcorn and ticket stubs on the path
function lampsHTML(w) {
  const gap = 260; const xs = []; for (let px = 30; px < w; px += gap) xs.push(px);
  const top = 300 - 176;
  let p = ''; let b = '';
  xs.forEach((px, i) => { const nx = xs[i + 1]; if (!nx) return; p += `M${px} ${top} Q${(px + nx) / 2} ${top + 46} ${nx} ${top} `;
    for (let j = 1; j < 10; j++) { const t = j / 10; const bx = px + (nx - px) * t; const by = top + 46 * 2 * t * (1 - t) + 3; b += `<circle class="cv-bulb ${j % 4 === 2 ? 'flick' : ''}" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="3" style="fill:${['#ffe07a', '#ff7a9a', '#7ad8ff', '#b4ff7a'][j % 4]};animation-delay:${(j % 4) * 0.28}s"/>`; } });
  const lamps = xs.map((px) => `<span class="mw-lamp" style="left:${px - 7}px"><i></i></span>`).join('');
  const r = rng(9); let lit = '';
  for (let i = 0; i < w / 22; i++) lit += `<i style="left:${(r() * w).toFixed(0)}px;bottom:${(4 + r() * 48).toFixed(0)}px;background:${['#ff7a9a', '#7ad8ff', '#ffe07a', '#b4ff7a', '#fff3c8'][Math.floor(r() * 5)]};transform:rotate(${(r() * 90).toFixed(0)}deg)"></i>`;
  return `<svg class="mw-strings" viewBox="0 0 ${w} 300" width="${w}" height="300" aria-hidden="true"><path d="${p}" fill="none" stroke="#1a1008" stroke-width="1.2"/>${b}</svg>${lamps}<div class="mw-litter">${lit}</div>`;
}

export function midwayHTML(pair, SNACKS) {
  const r = rng(31);
  const tank = '<span class="mw-tank"><span class="mw-plank"></span><span class="mw-water"></span></span>';
  const tub = '<span class="mw-tub"><i>🍃</i><i>🍃</i><i>🍃</i></span>';
  const pins = '<span class="mw-pins">🔑</span>';
  const balloons = '<span class="mw-bwall">' + Array.from({ length: 10 }, (_, i) => `<i style="background:${['#e24a4a', '#4a8fe2', '#f2c14e', '#3ec27a', '#ff8ad0'][i % 5]};animation-delay:${(i * 0.17).toFixed(2)}s"></i>`).join('') + '</span>';
  const world = [
    arch(130),
    stand(330, 'cotton', SNACKS.cotton),
    wheel(540),
    booth(800, 150, 'game:dunk', 'Dunk a Dwebble', 'Dwebble', '#2f7ad6', '#f6eedf', r, tank),
    stand(955, 'popcorn', SNACKS.popcorn),
    bigTop(1160),
    booth(1410, 150, 'game:rings', 'Klefki Toss', 'Slowpoke', '#d63a3a', '#f6eedf', r, pins),
    booth(1590, 150, 'game:balloons', 'Balloon Pop', 'Pikachu', '#f2b01e', '#fff4c8', r, balloons),
    strength(1745),
    carousel(1930),
    booth(2140, 150, 'game:lily', 'Lily Pad Search', 'Surskit', '#2fa86a', '#e8f6d8', r, tub),
    teacups(2340),
    stand(2510, 'puff', SNACKS.puff),
    coaster(2760),
    funhouse(2995),
  ].join('');
  return `<div class="mw-far"></div>
    <div class="mw-world" style="width:${MW_W}px"><div class="mw-ground"></div>${lampsHTML(MW_W)}${world}
      <div class="mw-crowd"></div><div class="cv-walk mw-me">${pair}</div><button class="mw-prompt" hidden></button></div>
    <button class="mw-pad l" aria-label="Walk left">◀</button><button class="mw-pad r" aria-label="Walk right">▶</button>
    <div class="mw-hint">◀ ▶ to walk around · tap a booth or ride</div>`;
}

const LABEL = (kind, key, D) => kind === 'game' ? `${D.GAMES[key].icon} Play ${D.GAMES[key].name}${D.GAME_COST?.[key] ? ` (💰${D.GAME_COST[key]})` : ''}` : kind === 'ride' ? `🎟️${D.RIDES[key].cost} Ride the ${D.RIDES[key].name}` : `🎟️${D.SNACKS[key].cost} Buy ${D.SNACKS[key].name}`;

// walking, camera, the crowd and the pop-up. D = { GAMES, RIDES, SNACKS }; onSpot(kind, key); onMove(dir|null)
export function mountMidway(scene, D, onSpot, onMove) {
  const world = scene.querySelector('.mw-world'); const far = scene.querySelector('.mw-far'); const me = scene.querySelector('.mw-me');
  const prompt = scene.querySelector('.mw-prompt'); const hint = scene.querySelector('.mw-hint');
  const vw = () => scene.clientWidth || 400;
  const farW = () => Math.ceil(vw() + (MW_W - vw()) * FAR) + 40;
  far.innerHTML = farHTML(farW());
  const spots = [...world.querySelectorAll('[data-spot]')].map((el) => { const [kind, key] = el.dataset.spot.split(':'); return { el, kind, key, x: +el.dataset.x }; });
  let x = 300; let target = null; let dir = 0; let held = 0; let face = 'right'; let moving = false; let pending = null; let near = null;
  // hosts and ride riders as little moving sprites
  fz().then((m) => { if (!m) return; world.querySelectorAll('[data-sp]').forEach(async (el) => { const fly = el.classList.contains('mw-drag'); const w = await m.walkSprite(el.dataset.sp, fly ? 1.5 : el.classList.contains('mw-horse') ? 1.2 : 1.6, fly ? 'right' : 'down', !fly).catch(() => null); if (w && el.isConnected) el.innerHTML = w.html.replace('class="fzs-spr"', 'class="fzs-spr idling"'); }); });
  // the crowd: Pokémon strolling the midway, a few holding balloons
  const crowd = []; const box = world.querySelector('.mw-crowd'); const r = Math.random;
  const pool = CROWD.slice().sort(() => r() - 0.5).slice(0, 16);
  fz().then((m) => { if (!m) return; pool.forEach(async (name, i) => {
    const w = await m.walkSprite(name, 1.5, 'right', false).catch(() => null); if (!w || !box.isConnected) return;
    const el = document.createElement('div'); el.className = 'mw-npc'; const depth = r();
    el.style.bottom = (24 + depth * 26).toFixed(0) + 'px'; el.style.zIndex = String(6 - Math.round(depth * 2));
    el.innerHTML = w.html.replace('class="fzs-spr"', 'class="fzs-spr walking"') + (r() < 0.35 ? `<span class="mw-ball" style="background:${['#e24a4a', '#4a8fe2', '#f2c14e', '#3ec27a', '#ff8ad0'][i % 5]}"></span>` : '');
    box.appendChild(el);
    const spr = el.firstElementChild; const h = parseFloat(spr.style.height) || 48;
    const n = { el, spr, h, x: 80 + r() * (MW_W - 160), to: 0, sp: 26 + r() * 30, wait: r() * 3, f: '' };
    n.to = n.x + (r() - 0.5) * 600; crowd.push(n);
  }); });
  const setFace = (spr, h, f) => { if (spr) spr.style.backgroundPositionY = `-${ROW[f] * h}px`; };
  const meSpr = () => me.querySelector('.cv-char .fzs-spr');
  const show = () => {
    const cam = Math.max(0, Math.min(MW_W - vw(), x - vw() / 2));
    world.style.transform = `translateX(${-cam}px)`; far.style.transform = `translateX(${-cam * FAR}px)`;
    me.style.transform = `translateX(${x}px) translateX(-50%)`;
    const nb = spots.reduce((b, s) => (Math.abs(s.x - x) < 80 && (!b || Math.abs(s.x - x) < Math.abs(b.x - x)) ? s : b), null);
    if (nb !== near) { near = nb; spots.forEach((s) => s.el.classList.toggle('near', s === nb));
      if (nb) { prompt.hidden = false; prompt.textContent = LABEL(nb.kind, nb.key, D); prompt.style.left = nb.x + 'px'; prompt.style.bottom = Math.min(250, 58 + nb.el.offsetHeight + 30) + 'px'; } else prompt.hidden = true; }
  };
  const walkTo = (tx, then) => { target = Math.max(40, Math.min(MW_W - 40, tx)); pending = then || null; };
  spots.forEach((s) => { s.el.onclick = (e) => { e.preventDefault(); if (Math.abs(s.x - x) < 80) { onSpot(s.kind, s.key); return; } walkTo(s.x - 50 * Math.sign(s.x - x), () => onSpot(s.kind, s.key)); }; });
  prompt.onclick = () => { if (near) onSpot(near.kind, near.key); };
  world.querySelector('.mw-ground').onclick = (e) => { const rc = world.getBoundingClientRect(); walkTo(e.clientX - rc.left); };
  const hold = (btn, d) => {
    const on = (e) => { e.preventDefault(); held = d; target = null; pending = null; }; const off = () => { if (held === d) held = 0; };
    btn.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, off));
  };
  hold(scene.querySelector('.mw-pad.l'), -1); hold(scene.querySelector('.mw-pad.r'), 1);
  const typing = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
  const inView = () => { const rc = scene.getBoundingClientRect(); return rc.bottom > 0 && rc.top < innerHeight; };
  const kd = (e) => { if (!scene.isConnected) return cleanup(); if (typing() || !inView()) return;
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) { held = -1; target = null; e.preventDefault(); }
    else if (['ArrowRight', 'd', 'D'].includes(e.key)) { held = 1; target = null; e.preventDefault(); }
    else if (['Enter', 'ArrowUp', 'w', 'W'].includes(e.key) && near && !e.repeat && e.target === document.body) { e.preventDefault(); onSpot(near.kind, near.key); } };
  const ku = (e) => { if (['ArrowLeft', 'a', 'A'].includes(e.key) && held === -1) held = 0; if (['ArrowRight', 'd', 'D'].includes(e.key) && held === 1) held = 0; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  function cleanup() { removeEventListener('keydown', kd); removeEventListener('keyup', ku); }
  // her ask 11-12 "fix the dragonite sleigh situation": Dragonite flies upright just ahead of the cars on the same
  // track; two reins are redrawn every frame from the lead car to him so they always stay attached
  const cBox = world.querySelector('.mw-coaster'); const lead = cBox?.querySelector('.mw-car.lead'); const drag = cBox?.querySelector('.mw-dragfly');
  const rl = cBox ? [...cBox.querySelectorAll('.mw-reinsvg line')] : [];
  const reins = () => {
    if (!cBox || !lead || !drag) return; const b = cBox.getBoundingClientRect(); if (b.right < 0 || b.left > innerWidth) return;
    const a = lead.getBoundingClientRect(); const d = drag.getBoundingClientRect(); const k = 360 / (b.width || 360);
    const ax = (a.left + a.width / 2 - b.left) * k; const ay = (a.top + a.height / 2 - b.top) * k;
    const dx = (d.left + d.width * 0.35 - b.left) * k; const dy = (d.top + d.height * 0.62 - b.top) * k;
    rl.forEach((l, i) => { l.setAttribute('x1', ax.toFixed(1)); l.setAttribute('y1', (ay - 2 + i * 4).toFixed(1)); l.setAttribute('x2', dx.toFixed(1)); l.setAttribute('y2', (dy - 2 + i * 4).toFixed(1)); });
  };
  let last = performance.now(); let hinted = false;
  const tick = (now) => {
    if (!scene.isConnected) { cleanup(); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!document.hidden && inView()) {
      dir = held || (target != null ? Math.sign(target - x) : 0);
      if (target != null && Math.abs(target - x) < 4) { dir = 0; target = null; const p = pending; pending = null; if (p) p(); }
      if (dir) { x = Math.max(40, Math.min(MW_W - 40, x + dir * 200 * dt)); if (!hinted) { hinted = true; hint.classList.add('gone'); } }
      const f = dir > 0 ? 'right' : dir < 0 ? 'left' : face;
      const mv = !!dir;
      if (f !== face || mv !== moving) { face = f; moving = mv; const s = meSpr(); if (s) { setFace(s, parseFloat(s.style.height) || 48, face); s.classList.toggle('walking', moving); } onMove?.(moving ? face : null); }
      for (const n of crowd) {
        if (n.wait > 0) { n.wait -= dt; if (n.f !== 'stop') { n.f = 'stop'; n.spr.classList.remove('walking'); } continue; }
        const d = Math.sign(n.to - n.x); n.x += d * n.sp * dt;
        const nf = d > 0 ? 'right' : 'left'; if (n.f !== nf) { n.f = nf; setFace(n.spr, n.h, nf); n.spr.classList.add('walking'); }
        if (Math.abs(n.to - n.x) < 3) { n.wait = 1 + r() * 4; n.to = Math.max(60, Math.min(MW_W - 60, n.x + (r() - 0.5) * 700)); }
        n.el.style.transform = `translateX(${n.x.toFixed(1)}px)`;
      }
      show(); reins();
    }
    requestAnimationFrame(tick);
  };
  show(); requestAnimationFrame(tick);
  const s0 = meSpr(); if (s0) setFace(s0, parseFloat(s0.style.height) || 48, 'right');
  return { refaceMe: () => { const s = meSpr(); if (s) { setFace(s, parseFloat(s.style.height) || 48, face); s.classList.toggle('walking', moving); } } };
}

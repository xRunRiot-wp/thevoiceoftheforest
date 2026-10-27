// 3D dice: every d6 roll on this device plays as tumbling dice over the screen, then shows the result.
// Results always come from the site's own roller; the animation just lands each die on its value.
// Skins are per device (each player picks their own) and saved in this browser.
import { $, $$, esc } from './util.js?v=6ae08cda';
import { modal } from './ui.js?v=6ae08cda';

const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const KEY = 'dc.dice';
const MAX3D = 24;

export const PRESETS = {
  classic: { name: 'Classic', body: '#f6efe0', pip: '#3b2a1a', style: 'solid' },
  pokeball: { name: 'Poké Ball', body: '#e3350d', pip: '#1b1b1b', style: 'pokeball' },
  greatball: { name: 'Great Ball', body: '#2f6fd6', pip: '#1b1b1b', style: 'pokeball' },
  ultraball: { name: 'Ultra Ball', body: '#2b2b2b', pip: '#f5c518', style: 'pokeball' },
  leaf: { name: 'Leaf', body: '#4f9d4a', pip: '#f4f1d0', style: 'marble' },
  ember: { name: 'Ember', body: '#d9531e', pip: '#fff4c2', style: 'marble' },
  water: { name: 'Water', body: '#3a8fd8', pip: '#ffffff', style: 'gem' },
  night: { name: 'Night', body: '#2a2440', pip: '#c9b8ff', style: 'gem' },
  gold: { name: 'Gold', body: '#d6a93a', pip: '#4a3008', style: 'metal' },
  oak: { name: 'Oak', body: '#9a6b3c', pip: '#2b1a0c', style: 'wood' },
};
const STYLES = [['solid', 'Solid'], ['pokeball', 'Poké Ball band'], ['marble', 'Marble'], ['gem', 'Gem (see-through)'], ['metal', 'Metal'], ['wood', 'Wood']];

export function skin() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* private mode */ }
  const out = { on: true, preset: 'classic', ...PRESETS.classic, numbers: false, ...s };
  // dice sets are unlocked per player (theme.js sets window.diceAllowed); a locked set falls back to Classic
  const ok = window.diceAllowed;
  if (ok && !ok.has(out.preset in PRESETS ? out.preset : 'custom')) return { ...out, preset: 'classic', ...PRESETS.classic };
  return out;
}
function saveSkin(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

let threeP = null;
function loadThree() {
  if (window.THREE) return Promise.resolve(window.THREE);
  if (!threeP) threeP = new Promise((ok, bad) => { const s = document.createElement('script'); s.src = THREE_URL; s.onload = () => ok(window.THREE); s.onerror = bad; document.head.appendChild(s); });
  return threeP;
}

// ---------------------------------------------------------------- face pictures
const PIPS = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.27, .27], [.5, .5], [.73, .73]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]],
  5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]], 6: [[.27, .25], [.73, .25], [.27, .5], [.73, .5], [.27, .75], [.73, .75]] };

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export function drawFace(v, s, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const S = size;
  const grad = g.createLinearGradient(0, 0, S, S); grad.addColorStop(0, shade(s.body, 1.15)); grad.addColorStop(1, shade(s.body, .85));
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  if (s.style === 'pokeball') {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, S * .5, S, S * .5);
    g.fillStyle = '#1b1b1b'; g.fillRect(0, S * .46, S, S * .08);
  } else if (s.style === 'marble') {
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 2;
    for (let i = 0; i < 5; i++) { g.beginPath(); let y = ((v * 37 + i * 29) % 100) / 100 * S; g.moveTo(0, y); for (let x = 0; x <= S; x += 16) { y += Math.sin((x + i * 40 + v * 13) / 18) * 6; g.lineTo(x, y); } g.stroke(); }
  } else if (s.style === 'wood') {
    for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(40,20,5,${.12 + (i % 3) * .05})`; g.lineWidth = 1 + (i % 2); g.beginPath(); const y0 = i * S / 14; g.moveTo(0, y0); g.bezierCurveTo(S * .3, y0 + 6, S * .6, y0 - 6, S, y0 + 3); g.stroke(); }
  } else if (s.style === 'metal') {
    const m = g.createLinearGradient(0, 0, 0, S); m.addColorStop(0, 'rgba(255,255,255,.45)'); m.addColorStop(.5, 'rgba(255,255,255,0)'); m.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = m; g.fillRect(0, 0, S, S);
  }
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = S * .05; g.strokeRect(0, 0, S, S); // edge
  g.fillStyle = s.pip;
  if (s.numbers) {
    g.font = `bold ${S * .55}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), S / 2, S * .54);
    if (v === 6 || v === 9) g.fillRect(S * .38, S * .8, S * .24, S * .04);
  } else {
    for (const [x, y] of PIPS[v]) { g.beginPath(); g.arc(x * S, y * S, S * (v === 1 ? .12 : .085), 0, Math.PI * 2); g.fill(); }
  }
  return c;
}

// A 1x1x1 box with rounded edges and corners (radius r): a finely split box whose points are
// pulled onto a smaller box plus a sphere of radius r. Keeps the box's six face materials.
function roundedBox(THREE, r, seg) {
  const geo = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
  const pos = geo.attributes.position; const nor = geo.attributes.normal;
  const h = 0.5 - r; const p = new THREE.Vector3(); const inner = new THREE.Vector3();
  // squeeze the grid so one step covers the flat middle and the rest sit in the rounded band
  const k = seg / 2;
  const remap = (c) => { const j = Math.round((Math.abs(c) / 0.5) * k); return Math.sign(c) * (j === 0 ? 0 : h + r * ((j - 1) / (k - 1))); };
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    p.set(remap(p.x), remap(p.y), remap(p.z));
    inner.set(Math.max(-h, Math.min(h, p.x)), Math.max(-h, Math.min(h, p.y)), Math.max(-h, Math.min(h, p.z)));
    const n = p.sub(inner).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
    pos.setXYZ(i, inner.x + n.x * r, inner.y + n.y * r, inner.z + n.z * r);
  }
  // move the texture with the squeezed grid so the face picture keeps its size
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, remap(uv.getX(i) - 0.5) + 0.5, remap(uv.getY(i) - 0.5) + 0.5);
  pos.needsUpdate = true; nor.needsUpdate = true; uv.needsUpdate = true;
  return geo;
}

// ---------------------------------------------------------------- the roll
// Box face order in three.js: +x, -x, +y, -y, +z, -z. Opposite faces add to 7.
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
let busy = null;

export async function show(values, { kind = 'pool', sides = 6 } = {}) {
  const s = skin();
  if (!s.on || sides !== 6 || !values || !values.length || values.some((v) => v < 1 || v > 6)) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let THREE;
  try { THREE = await loadThree(); } catch { return; }
  if (busy) busy();
  const dice = values.slice(0, MAX3D);

  const wrap = document.createElement('div'); wrap.className = 'dice3d';
  wrap.innerHTML = dice.length < values.length ? `<span class="more">+${values.length - dice.length} more</span>` : '';
  document.body.appendChild(wrap);
  const W = innerWidth, H = innerHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, W / H, .1, 100);
  const cols = Math.min(dice.length, W < 500 ? 4 : 6); const rows = Math.ceil(dice.length / cols);
  const span = Math.max(7, Math.max(cols, rows * 1.2) * 1.5 + 3);
  cam.position.set(0, span * 1.35, span * .55); cam.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, .65));
  const sun = new THREE.DirectionalLight(0xffffff, .75); sun.position.set(4, 12, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span }); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(span * 4, span * 4), new THREE.ShadowMaterial({ opacity: .28 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const look = { gem: { transparent: true, opacity: .82, roughness: .08, metalness: .1 }, metal: { roughness: .25, metalness: .75 }, wood: { roughness: .85 } }[s.style] || { roughness: .45 };
  const mats = FACE_VALUES.map((v) => { const t = new THREE.CanvasTexture(drawFace(v, s)); t.anisotropy = 4; return new THREE.MeshStandardMaterial({ map: t, ...look }); });
  const geo = roundedBox(THREE, 0.14, 10);
  const up = new THREE.Vector3(0, 1, 0);
  const objs = dice.map((v, i) => {
    const mesh = new THREE.Mesh(geo, mats.map((m) => m.clone())); mesh.castShadow = true; scene.add(mesh);
    const face = FACE_VALUES.indexOf(v);
    const qFace = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...NORMALS[face]), up);
    const qEnd = new THREE.Quaternion().setFromAxisAngle(up, Math.random() * Math.PI * 2).multiply(qFace);
    const c = i % cols, r = Math.floor(i / cols);
    const end = new THREE.Vector3((c - (Math.min(cols, dice.length - r * cols) - 1) / 2) * 1.6 + (Math.random() - .5) * .3, .5, (r - (rows - 1) / 2) * 1.6 + (Math.random() - .5) * .3);
    const start = new THREE.Vector3(end.x * .3 + (Math.random() - .5) * 2, 2.5 + Math.random() * 2, span * .9 + Math.random() * 2);
    const axis = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
    return { mesh, v, qEnd, start, end, axis, spin: 10 + Math.random() * 8, delay: i * 35 };
  });

  const T = 1250, HOLD = 900, FADE = 250;
  const t0 = performance.now(); let raf = 0; let done = false;
  const q = new THREE.Quaternion();
  const finish = () => {
    if (done) return; done = true; cancelAnimationFrame(raf);
    wrap.classList.add('out');
    setTimeout(() => { renderer.dispose(); geo.dispose(); objs.forEach((o) => o.mesh.material.forEach((m) => { m.map?.dispose(); m.dispose(); })); wrap.remove(); }, FADE);
    busy = null;
  };
  busy = finish;
  wrap.onclick = finish;
  const frame = (now) => {
    const el = now - t0;
    for (const o of objs) {
      const t = Math.min(1, Math.max(0, (el - o.delay) / T));
      const e = 1 - Math.pow(1 - t, 3);
      o.mesh.position.lerpVectors(o.start, o.end, e);
      o.mesh.position.y = .5 + (1 - t) * (o.start.y - .5) * (1 - e) + Math.abs(Math.sin(t * Math.PI * 3)) * Math.pow(1 - t, 2) * 1.6;
      q.setFromAxisAngle(o.axis, o.spin * Math.pow(1 - e, 2));
      o.mesh.quaternion.copy(q).multiply(o.qEnd);
      if (t >= 1 && !o.lit && kind !== 'note') {
        o.lit = true;
        const glow = kind === 'pool' ? (o.v >= 4 ? 0x2e8b3a : o.v === 1 ? 0x8b2020 : 0) : kind === 'chance' && o.v === 6 ? 0x2e8b3a : 0;
        if (glow) o.mesh.material.forEach((m) => { m.emissive = new THREE.Color(glow); m.emissiveIntensity = .3; });
      }
    }
    renderer.render(scene, cam);
    if (el < T + objs.length * 35 + HOLD) raf = requestAnimationFrame(frame); else finish();
  };
  raf = requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- skin picker
export function skinPicker() {
  let s = skin();
  const preview = (x) => drawFace(5, x, 96).toDataURL();
  const el = modal(`<h2>Your dice</h2>
    <p class="small muted">Pick how your dice look. This is saved on this device, so everyone at the table can have their own.</p>
    <label class="check"><input type="checkbox" id="on" ${s.on ? 'checked' : ''}> Show 3D dice when I roll</label>
    <div class="dice-presets">${Object.entries(PRESETS).map(([k, p]) => { const lock = window.diceAllowed && !window.diceAllowed.has(k); return `<button class="dp ${s.preset === k ? 'sel' : ''} ${lock ? 'locked' : ''}" data-p="${k}" ${lock ? 'disabled title="A GM reward"' : ''}><img src="${preview({ ...s, ...p })}" alt=""><span>${lock ? '🔒 ' : ''}${esc(p.name)}</span></button>`; }).join('')}</div>
    <p class="small muted">🔒 sets are rewards the GM can hand out.</p>
    <h3 style="margin-top:12px">Make your own${window.diceAllowed && !window.diceAllowed.has('custom') ? ' 🔒' : ''}</h3>
    ${window.diceAllowed && !window.diceAllowed.has('custom') ? '<p class="small muted">Custom dice colours are a GM reward.</p><div hidden>' : '<div>'}
    <div class="grid g2">
      <label class="f">Dice colour<input type="color" id="body" value="${s.body}"></label>
      <label class="f">Pip colour<input type="color" id="pip" value="${s.pip}"></label>
      <label class="f">Finish<select id="style">${STYLES.map(([k, l]) => `<option value="${k}" ${s.style === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f">Faces<select id="num"><option value="0" ${s.numbers ? '' : 'selected'}>Pips</option><option value="1" ${s.numbers ? 'selected' : ''}>Numbers</option></select></label>
    </div></div>
    <div class="row" style="margin-top:10px;align-items:center"><img id="pv" src="${preview(s)}" alt="" style="width:64px;height:64px;border-radius:8px"><button class="btn" id="test">Test roll</button></div>`);
  const refresh = () => { saveSkin(s); $('#pv', el).src = preview(s); $$('[data-p]', el).forEach((b) => b.classList.toggle('sel', b.dataset.p === s.preset)); };
  $('#on', el).onchange = (e) => { s.on = e.target.checked; refresh(); };
  $$('[data-p]', el).forEach((b) => b.onclick = () => { const p = PRESETS[b.dataset.p]; s = { ...s, preset: b.dataset.p, body: p.body, pip: p.pip, style: p.style }; $('#body', el).value = s.body; $('#pip', el).value = s.pip; $('#style', el).value = s.style; refresh(); });
  $('#body', el).oninput = (e) => { s.body = e.target.value; s.preset = 'custom'; refresh(); };
  $('#pip', el).oninput = (e) => { s.pip = e.target.value; s.preset = 'custom'; refresh(); };
  $('#style', el).onchange = (e) => { s.style = e.target.value; s.preset = 'custom'; refresh(); };
  $('#num', el).onchange = (e) => { s.numbers = e.target.value === '1'; refresh(); };
  $('#test', el).onclick = () => show(Array.from({ length: 5 }, () => 1 + Math.floor(Math.random() * 6)));
}

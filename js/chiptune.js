// Little original 8-bit tunes for Ralts's dance and Rayson's Mail Run (her asks 10-27), made live with Web Audio: square-wave lead,
// triangle bass and a noise hi-hat, looping in time with the dance. Each arrow has its own note; a miss buzzes.
// Muting is remembered per device (localStorage dc.music).
let ctx = null; let master = null; let loop = 0; let nextAt = 0; let stepIdx = 0; let song = null;
const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> Hz
// 16 eighth-notes per bar, 4 bars: [lead MIDI or 0, bass MIDI or 0]
const LEAD = [76, 0, 79, 76, 74, 0, 72, 74, 76, 0, 76, 0, 79, 81, 79, 0,
  77, 0, 76, 74, 72, 0, 74, 76, 74, 0, 72, 0, 69, 72, 74, 0,
  76, 0, 79, 76, 74, 0, 72, 74, 76, 79, 81, 0, 84, 81, 79, 0,
  77, 76, 74, 72, 74, 0, 76, 0, 72, 0, 0, 0, 72, 74, 76, 79];
const BASS = [48, 0, 55, 0, 48, 0, 55, 0, 45, 0, 52, 0, 45, 0, 52, 0,
  41, 0, 48, 0, 41, 0, 48, 0, 43, 0, 50, 0, 43, 0, 47, 0,
  48, 0, 55, 0, 48, 0, 55, 0, 45, 0, 52, 0, 45, 0, 52, 0,
  41, 0, 48, 0, 43, 0, 50, 0, 48, 0, 43, 0, 48, 0, 0, 0];
// Rayson's Mail Run (her ask 10-27: beachy 8-bit music): an original breezy calypso loop, C F G C | Am F G C, one chord per 8 eighths.
// Square lead, calypso bass (root, root, fifth), soft high triangle "steel drum" plinks on the off-beats and a wave wash every 4 chords.
const BEACH_LEAD = [79, 0, 76, 79, 81, 0, 79, 76, 77, 0, 81, 0, 84, 81, 77, 0, 79, 0, 83, 81, 79, 0, 74, 0, 76, 79, 0, 76, 72, 0, 0, 0,
  76, 0, 72, 76, 81, 0, 79, 0, 77, 81, 0, 77, 74, 0, 72, 0, 74, 0, 79, 0, 83, 81, 79, 74, 72, 0, 76, 79, 84, 0, 0, 0];
const BEACH_CHORDS = [[48, [84, 88, 91]], [41, [81, 84, 89]], [43, [83, 86, 91]], [48, [84, 88, 91]], [45, [81, 84, 88]], [41, [81, 84, 89]], [43, [83, 86, 91]], [48, [84, 88, 91]]];
const CALYPSO = [0, null, null, 0, 7, null, 0, null]; // bass: semitones above the root per eighth
const BEACH_BASS = BEACH_CHORDS.flatMap(([r]) => CALYPSO.map((o) => (o === null ? 0 : r + o)));
const BEACH_ARP = BEACH_CHORDS.flatMap(([, ch]) => [0, ch[2], ch[1], 0, 0, ch[0], 0, ch[1]]);
// Noctowl's 21 (her ask 10-29: casino music): an original swinging lounge loop, C6 A7 Dm7 G7 twice, walking bass on the beats,
// soft vibraphone chord stabs on the off-beats and a smooth triangle lead. Swung eighths.
const CASINO_LEAD = [76, 0, 79, 0, 81, 79, 76, 0, 73, 0, 76, 0, 79, 0, 76, 73, 74, 0, 77, 0, 81, 0, 84, 0, 83, 0, 79, 0, 77, 74, 71, 0,
  72, 76, 79, 81, 84, 0, 81, 0, 82, 0, 81, 79, 76, 0, 73, 0, 74, 77, 81, 0, 79, 0, 77, 74, 76, 0, 72, 0, 0, 0, 0, 0];
const WALK = [[48, 52, 55, 56], [45, 49, 52, 51], [50, 48, 45, 44], [43, 47, 50, 47], [48, 52, 55, 56], [45, 49, 52, 51], [50, 53, 43, 47], [48, 52, 55, 47]];
const CASINO_BASS = WALK.flatMap((b) => b.flatMap((n) => [n, 0]));
const VOICE = { C6: [64, 67, 69], A7: [61, 64, 67], Dm7: [65, 69, 72], G7: [65, 71, 74] };
const CASINO_COMP = [['C6', 'C6'], ['A7', 'A7'], ['Dm7', 'Dm7'], ['G7', 'G7'], ['C6', 'C6'], ['A7', 'A7'], ['Dm7', 'G7'], ['C6', 'C6']]
  .flatMap(([a, b]) => [0, 0, 0, VOICE[a], 0, 0, VOICE[b], 0]);
// Fernshade Nursery (her ask 10-29: a slow 8-bit music box lullaby): an original waltz in F, 3/4, bell-like music box notes
// (a sine with a soft octave shimmer and a long ring), a low note on each downbeat and two little chord plinks.
const BOX_LEAD = [72, 0, 77, 0, 76, 0, 74, 0, 72, 0, 0, 0, 69, 0, 74, 0, 72, 0, 70, 0, 69, 0, 67, 0,
  69, 0, 72, 0, 77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 72, 0, 70, 67, 65, 0, 0, 0, 0, 0,
  81, 0, 79, 0, 77, 0, 76, 0, 72, 0, 0, 0, 74, 0, 77, 0, 74, 0, 72, 0, 69, 0, 0, 0,
  70, 0, 74, 0, 79, 0, 77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0, 77, 0, 0, 0, 0, 0];
const BOX_BARS = [[53, 57, 60], [48, 55, 60], [50, 57, 62], [46, 58, 62], [53, 57, 60], [48, 55, 60], [46, 58, 64], [53, 57, 60],
  [53, 57, 60], [45, 57, 60], [46, 58, 62], [53, 57, 60], [43, 58, 62], [48, 55, 60], [46, 58, 64], [53, 57, 60]];
const BOX_BASS = BOX_BARS.flatMap(([b]) => [b, 0, 0, 0, 0, 0]);
const BOX_ARP = BOX_BARS.flatMap(([, x, y]) => [0, 0, x + 12, 0, y + 12, 0]);
// Sentry Duty (her ask 10-29: serious 8-bit military music): an original march in D minor, square bugle lead,
// oom-pah triangle bass on the beats, a kick on 1 and 3, snare on 2 and 4 with a roll at the end of every phrase.
const MARCH_LEAD = [62, 0, 0, 62, 62, 0, 65, 0, 69, 0, 0, 0, 67, 0, 65, 0, 70, 0, 0, 70, 69, 0, 67, 0, 69, 0, 0, 0, 64, 0, 61, 0,
  62, 0, 0, 62, 62, 0, 69, 0, 70, 0, 69, 0, 67, 0, 65, 0, 64, 0, 65, 0, 67, 0, 61, 0, 62, 0, 0, 0, 0, 0, 0, 0];
const MARCH_BASS = [[38, 45], [38, 45], [34, 41], [33, 40], [38, 45], [31, 38], [33, 40], [38, 45]].flatMap(([r, f]) => [r, 0, f, 0, r, 0, f, 0]);
const MARCH_DRUMS = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) => (b === 7 ? ['k', 's', 's', 's', 's', 's', 's', 's'] : b === 3 ? ['k', 0, 's', 0, 'k', 0, 's', 's'] : ['k', 0, 's', 0, 'k', 0, 's', 0]));
// Spinda's Kitchen (her ask 10-29: an 8-bit cooking-game soundtrack): an original bouncy kitchen tune in G, short perky
// square notes, oom-pah bass and little xylophone plinks on the off-beats.
const KITCHEN_LEAD = [74, 0, 79, 74, 71, 0, 74, 0, 76, 0, 72, 76, 79, 0, 76, 0, 78, 79, 78, 0, 74, 0, 69, 0, 71, 0, 74, 0, 79, 0, 0, 0,
  71, 0, 76, 71, 67, 0, 71, 0, 72, 0, 76, 72, 69, 0, 72, 0, 74, 0, 78, 0, 81, 0, 78, 0, 79, 0, 74, 0, 67, 0, 0, 0];
const KITCHEN_BARS = [[43, 50, [83, 86]], [48, 43, [84, 88]], [50, 45, [81, 86]], [43, 50, [83, 86]], [40, 47, [83, 88]], [48, 43, [84, 88]], [50, 45, [84, 86]], [43, 50, [83, 86]]];
const KITCHEN_BASS = KITCHEN_BARS.flatMap(([r, f]) => [r, 0, f, 0, r, 0, f, 0]);
const KITCHEN_ARP = KITCHEN_BARS.flatMap(([, , [a, b]]) => [0, 0, 0, a, 0, 0, 0, b]);
const SONGS = {
  dance: { bpm: 160, lead: LEAD, bass: BASS, hat: 2 },
  beach: { bpm: 132, lead: BEACH_LEAD, bass: BEACH_BASS, arp: BEACH_ARP, hat: 4, waves: 32, leadVol: 0.04 },
  kitchen: { bpm: 150, lead: KITCHEN_LEAD, bass: KITCHEN_BASS, arp: KITCHEN_ARP, hat: 2, leadLen: 0.5, leadVol: 0.045 },
  march: { bpm: 112, lead: MARCH_LEAD, bass: MARCH_BASS, drums: MARCH_DRUMS, leadVol: 0.05 },
  musicbox: { bpm: 84, lead: BOX_LEAD, bass: BOX_BASS, arp: BOX_ARP, bell: true },
  casino: { bpm: 116, lead: CASINO_LEAD, bass: CASINO_BASS, comp: CASINO_COMP, hat: 2, swing: 0.33, leadType: 'triangle', leadVol: 0.07 },
};
const STEP_NOTE = { up: 84, right: 79, left: 76, down: 72 };

export const muted = () => { try { return localStorage.getItem('dc.music') === 'off'; } catch { return false; } };
export function setMuted(m) { try { localStorage.setItem('dc.music', m ? 'off' : 'on'); } catch { /* ignore */ } if (master) master.gain.value = m ? 0 : 0.5; }

function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted() ? 0 : 0.5; master.connect(ctx.destination);
  return true;
}
function tone(freq, t, dur, type = 'square', vol = 0.08) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function hat(t) {
  const len = Math.floor(ctx.sampleRate * 0.03); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(); const g = ctx.createGain(); g.gain.value = 0.03; s.buffer = buf; s.connect(g); g.connect(master); s.start(t);
}
// a soft wave washing in and out: low-passed noise that swells and fades
function wave(t) {
  const len = Math.floor(ctx.sampleRate * 2.6); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); const f = ctx.createBiquadFilter(); const g = ctx.createGain(); s.buffer = buf; f.type = 'lowpass'; f.frequency.value = 900;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 2.7);
}

// march drums: a low thump that drops in pitch, and a crisp noise snare
function kick(t) {
  const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2);
}
function snare(t) {
  const len = Math.floor(ctx.sampleRate * 0.12); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = ctx.createBufferSource(); const f = ctx.createBiquadFilter(); const g = ctx.createGain(); s.buffer = buf; f.type = 'bandpass'; f.frequency.value = 1800; g.gain.value = 0.22;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
  tone(190, t, 0.06, 'triangle', 0.05);
}

// schedule a little ahead so the tune never stutters
function pump() {
  const S = song; const EIGHTH = 60 / S.bpm / 2;
  while (nextAt < ctx.currentTime + 0.25) {
    const i = stepIdx % S.lead.length;
    if (S.bell) { // music box: everything rings like little tuned teeth
      if (S.lead[i]) { tone(N(S.lead[i]), nextAt, EIGHTH * 5, 'sine', 0.09); tone(N(S.lead[i] + 12), nextAt, EIGHTH * 1.5, 'triangle', 0.02); }
      if (S.bass[i]) tone(N(S.bass[i] + 12), nextAt, EIGHTH * 5, 'sine', 0.05);
      if (S.arp?.[i]) tone(N(S.arp[i]), nextAt, EIGHTH * 3, 'sine', 0.035);
    } else {
      if (S.lead[i]) tone(N(S.lead[i]), nextAt, EIGHTH * (S.leadLen || 0.9), S.leadType || 'square', S.leadVol || 0.05);
      if (S.bass[i]) tone(N(S.bass[i]), nextAt, EIGHTH * 1.8, 'triangle', 0.12);
      if (S.arp?.[i]) tone(N(S.arp[i]), nextAt, EIGHTH * 1.4, 'triangle', 0.035);
    }
    if (S.hat && i % S.hat === 0) hat(nextAt);
    if (S.drums?.[i] === 'k') kick(nextAt); else if (S.drums?.[i] === 's') snare(nextAt);
    if (S.waves && i % S.waves === 0) wave(nextAt);
    if (S.comp?.[i]) S.comp[i].forEach((n) => tone(N(n), nextAt, EIGHTH * 1.6, 'sine', 0.035));
    nextAt += EIGHTH * (S.swing ? (i % 2 ? 1 - S.swing : 1 + S.swing) : 1); stepIdx++;
  }
}
// sound effects without the dance tune (the Mail Run): make sure audio is ready after a tap
export function ensureAudio() { if (init()) ctx.resume?.(); }
export function startMusic(name = 'dance') {
  if (!init()) return; song = SONGS[name] || SONGS.dance;
  ctx.resume?.();
  stopMusic(); stepIdx = 0; nextAt = ctx.currentTime + 0.05;
  loop = setInterval(pump, 60); pump();
}
export function stopMusic() { clearInterval(loop); loop = 0; }
export function stepSound(dir) { if (!ctx) return; const t = ctx.currentTime; tone(N(STEP_NOTE[dir] || 76), t, 0.18, 'square', 0.09); tone(N((STEP_NOTE[dir] || 76) + 12), t + 0.05, 0.12, 'square', 0.04); }
export function missSound() { if (!ctx) return; const t = ctx.currentTime; tone(110, t, 0.25, 'sawtooth', 0.08); tone(98, t + 0.08, 0.25, 'sawtooth', 0.06); }
export function jingle(good) {
  if (!ctx) return; const t = ctx.currentTime + 0.05;
  (good ? [72, 76, 79, 84] : [72, 69, 65, 60]).forEach((n, i) => tone(N(n), t + i * 0.13, 0.22, 'square', 0.08));
}

// card table sounds for Noctowl's 21 (her ask 10-29): a riffle shuffle, a card snapping down, chips clinking
function swish(t, dur, vol, hp) {
  const len = Math.floor(ctx.sampleRate * dur); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const s = ctx.createBufferSource(); const f = ctx.createBiquadFilter(); const g = ctx.createGain(); s.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
export function cardSound(kind, delay = 0) {
  if (!ctx) return; const t = ctx.currentTime + delay;
  if (kind === 'shuffle') for (let i = 0; i < 14; i++) swish(t + i * 0.035 + Math.random() * 0.01, 0.03, 0.25, 2500);
  else if (kind === 'card') { swish(t, 0.07, 0.4, 1800); tone(220, t + 0.01, 0.05, 'triangle', 0.08); }
  else if (kind === 'chips') [2637, 3136, 2794].forEach((f, i) => { tone(f, t + i * 0.06, 0.12, 'sine', 0.04); swish(t + i * 0.06, 0.02, 0.15, 5000); });
}

// a page's own background tune (the nursery): starts now if the visitor has tapped already, else on their first tap;
// stops once the page's music button is gone (they left). Safe to call again when the page redraws.
let pageSong = ''; let pageBtnId = '';
export function pageMusic(main, name, btnId) {
  const btn = document.getElementById(btnId);
  if (btn) { btn.textContent = muted() ? '🔇 Music off' : '🔊 Music on'; btn.onclick = () => { const m = !muted(); setMuted(m); btn.textContent = m ? '🔇 Music off' : '🔊 Music on'; go(); }; }
  pageBtnId = btnId;
  function go() { if (pageSong === name || !document.getElementById(btnId)) return; ensureAudio(); startMusic(name); pageSong = name; }
  if (pageSong === name) return;
  main.addEventListener('pointerdown', go, { once: true });
  if (navigator.userActivation?.hasBeenActive) go();
  const leave = () => setTimeout(() => { if (document.getElementById(pageBtnId)) return; window.removeEventListener('hashchange', leave); if (pageSong) { if (song === SONGS[pageSong]) stopMusic(); pageSong = ''; } }, 300);
  window.addEventListener('hashchange', leave);
}

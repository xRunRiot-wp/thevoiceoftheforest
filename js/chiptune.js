// Little original 8-bit tune for Ralts's dance (her ask 10-27), made live with Web Audio: square-wave lead,
// triangle bass and a noise hi-hat, looping in time with the dance. Each arrow has its own note; a miss buzzes.
// Muting is remembered per device (localStorage dc.music).
let ctx = null; let master = null; let loop = 0; let nextAt = 0; let stepIdx = 0;
const BPM = 160; const EIGHTH = 60 / BPM / 2;
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

// schedule a little ahead so the tune never stutters
function pump() {
  while (nextAt < ctx.currentTime + 0.25) {
    const i = stepIdx % LEAD.length;
    if (LEAD[i]) tone(N(LEAD[i]), nextAt, EIGHTH * 0.9, 'square', 0.05);
    if (BASS[i]) tone(N(BASS[i]), nextAt, EIGHTH * 1.8, 'triangle', 0.12);
    if (i % 2 === 0) hat(nextAt);
    nextAt += EIGHTH; stepIdx++;
  }
}
// sound effects without the dance tune (the Mail Run): make sure audio is ready after a tap
export function ensureAudio() { if (init()) ctx.resume?.(); }
export function startMusic() {
  if (!init()) return;
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

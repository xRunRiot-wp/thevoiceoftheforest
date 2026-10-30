// Fernshade Nursery (her ask 10-27): a Tamagotchi-style buddy. Beatrice, the Beedrill den-mother of Fernshade Camp,
// gives each character an egg from the nursery. Keep it warm until it hatches, then feed it, play with it and keep it
// clean every day. Each day the buddy is fully cared for counts toward growing up: Egg → Baby → Kid → Teen.
// A teen can be asked to join the team (it goes on the GM checklist as a recruit).
// Stats drop in real time from when you last did each thing. State: nursery/<charId>.
// Her asks 10-27 (round 2): needs come up more often; tap the buddy and it walks up to the screen and a Yellow-style
// window shows how it feels; harsh weather changes its mood and adds a need (umbrella in sun or rain, blanket in hail or
// wind, the tent in a sandstorm); the room and its day follow the player's own clock (dawn, day, dusk, night).
// Follow-up: a bigger close-up, and sky over the room (coloured for the time of day, clouds by day, stars at night).
import * as store from './store.js?v=6ae3efa5';
import { $, $$, esc, toast, num } from './util.js?v=6ae3efa5';
import { me, logRoll } from './play.js?v=6ae3efa5';
import { currentWeather, WEATHERS, wxFxHTML } from './weather.js?v=6ae3efa5';
import { gameSay, gmTodo, RESIDENTS } from './chatter.js?v=6ae3efa5';
import { markWinner } from './sparkle.js?v=6ae3efa5';
import { pageMusic, visitMusic } from './chiptune.js?v=6ae3efa5';
import { modal, closeModal } from './ui.js?v=6ae3efa5';

export const isNursery = (g) => g.kind === 'nursery' || g.id === 'fernshade-nursery';

// baby sprites: assets/nursery/<key>.png, 10 frames wide, rows Idle / Hop / Sleep / Walk right / Walk left / Eat / Nod (fr = frames per row),
// cells cw×ch; faces in assets/portraits/emo/<key>/
const BABIES = {pichu: { name: 'Pichu', cw: 32, ch: 88, fr: [4, 10, 2, 8, 8, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, cleffa: { name: 'Cleffa', cw: 32, ch: 80, fr: [2, 10, 2, 8, 8, 2, 10], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, igglybuff: { name: 'Igglybuff', cw: 24, ch: 72, fr: [2, 10, 2, 5, 5, 2, 10], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, togepi: { name: 'Togepi', cw: 24, ch: 72, fr: [4, 10, 2, 6, 6, 4, 10], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, tyrogue: { name: 'Tyrogue', cw: 24, ch: 88, fr: [7, 10, 2, 4, 4, 4, 10], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, smoochum: { name: 'Smoochum', cw: 32, ch: 80, fr: [5, 10, 2, 4, 4, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, elekid: { name: 'Elekid', cw: 32, ch: 96, fr: [4, 10, 2, 4, 4, 4, 10], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, magby: { name: 'Magby', cw: 24, ch: 88, fr: [6, 10, 2, 4, 4, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, azurill: { name: 'Azurill', cw: 48, ch: 88, fr: [4, 10, 2, 7, 7, 4, 10], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, wynaut: { name: 'Wynaut', cw: 24, ch: 80, fr: [6, 10, 2, 8, 8, 6, 10], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, budew: { name: 'Budew', cw: 24, ch: 80, fr: [8, 10, 2, 8, 8, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, chingling: { name: 'Chingling', cw: 40, ch: 80, fr: [2, 10, 2, 9, 9, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, bonsly: { name: 'Bonsly', cw: 24, ch: 88, fr: [5, 10, 2, 4, 4, 5, 10], emo: ['Normal', 'Sad'] }, mimejr: { name: 'Mime Jr.', cw: 24, ch: 88, fr: [8, 10, 2, 10, 10, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, happiny: { name: 'Happiny', cw: 32, ch: 80, fr: [5, 10, 2, 8, 8, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, munchlax: { name: 'Munchlax', cw: 32, ch: 88, fr: [4, 10, 2, 4, 4, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }, riolu: { name: 'Riolu', cw: 32, ch: 88, fr: [4, 10, 2, 4, 4, 4, 3], emo: ['Normal', 'Happy', 'Joyous', 'Sad', 'Crying', 'Teary-Eyed', 'Worried', 'Inspired', 'Pain', 'Dizzy'] }};
const STAGES = ['Egg', 'Baby', 'Kid', 'Teen'];
const DAYS_TO_GROW = [1, 2, 2]; // cared-for days to leave Egg, Baby, Kid
const NEEDS = { egg: { warm: 4 }, baby: { feed: 3, play: 3, clean: 2 } };
const RATE = { warm: 14, feed: 14, play: 12, clean: 8 }; // points lost per hour
const LABEL = { warm: ['🔥', 'Warmth', 'Keep warm'], feed: ['🍼', 'Food', 'Feed'], play: ['🎈', 'Fun', 'Play'], clean: ['🛁', 'Clean', 'Bath'] };

// the player's own local date and hour (her ask: match the user's time)
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const asleep = (h = new Date().getHours()) => h >= 21 || h < 6;
// the sky: night from 7:30pm (her ask 10-29), even though buddies stay up until 9
const tod = (d = new Date()) => { const m = d.getHours() * 60 + d.getMinutes(); return m >= 19 * 60 + 30 || m < 6 * 60 ? 'night' : m < 8 * 60 ? 'dawn' : m < 17 * 60 ? 'day' : 'dusk'; };
// harsh weather: [icon, stat name, button, what Beatrice says, what the buddy wants]. Azurill loves rain, Magby loves the sun.
const COVER = {
  sunny: ['⛱️', 'Shade', 'Umbrella', 'It’s so hot out!', 'an umbrella for some shade'], harsh: ['⛱️', 'Shade', 'Umbrella', 'It’s scorching out there!', 'an umbrella for some shade'],
  rain: ['☂️', 'Dry', 'Umbrella', 'It’s pouring!', 'an umbrella'], typhoon: ['☂️', 'Dry', 'Umbrella', 'This storm is so scary!', 'an umbrella'],
  hail: ['🧣', 'Cozy', 'Blanket', 'Brr, it’s hailing!', 'a warm blanket'], wind: ['🧣', 'Cozy', 'Blanket', 'The wind is so cold!', 'a warm blanket'],
  sandstorm: ['⛺', 'Sheltered', 'Tent', 'Sand is getting everywhere!', 'to hide in the tent'],
};
const LOVES = { azurill: ['rain', 'typhoon'], magby: ['sunny', 'harsh'] };
const wx = () => currentWeather();
const coverNeed = (b) => { const k = wx().key; return b && b.stage > 0 && COVER[k] && !(LOVES[b.sp] || []).includes(k) ? k : null; };
const lab = (k) => (k === 'cover' ? COVER[wx().key] || ['☂️', 'Cover', 'Cover'] : LABEL[k]);
const buddyOf = (id) => store.get('nursery/' + id) || null;
const stat = (b, k) => k === 'cover' ? (b.coverBlock === wx().block ? 100 : 0) : Math.max(0, Math.min(100, Math.round(100 - (Date.now() - num(b[k + 'At'])) / 3600e3 * RATE[k])));
const needsOf = (b) => (b.stage === 0 ? NEEDS.egg : { ...NEEDS.baby, ...(coverNeed(b) ? { cover: 1 } : {}) });
const todayOf = (b) => (b.days || {})[today()] || {};
const caredToday = (b) => Object.entries(needsOf(b)).every(([k, n]) => num(todayOf(b)[k]) >= n);
// the daily chore is done once every need got some care today (or is still full, so it can't take more) and nothing is running low (her report 10-27: the full 3/3/2 count is for
// growing up, and a full buddy refuses more care, so it kept the chore open after she'd looked after it)
export const nurseryDue = () => { const c = me(); if (!c) return false; const b = buddyOf(c.id); return !b || (!b.recruited && b.stage < 3 && Object.keys(needsOf(b)).some((k) => stat(b, k) < 40 || (!num(todayOf(b)[k]) && stat(b, k) < 90))); };

const BEA = { wait: ['Normal'], happy: ['Happy', 'Joyous'], worry: ['Worried', 'Sad'], proud: ['Inspired', 'Joyous'] };
const beaFace = (mood) => { const have = ['Normal', 'Happy', 'Joyous', 'Sad', 'Worried', 'Inspired', 'Surprised', 'Determined', 'Sigh']; return `assets/portraits/emo/beedrill/${(BEA[mood] || []).find((e) => have.includes(e)) || 'Normal'}.png`; };
const bea = (mood, line) => `<div class="sentry-digg"><img class="sface dig" src="${beaFace(mood)}" alt="Beatrice"><div class="bubble"><b>Beatrice:</b> “${esc(line)}”</div></div>`;
// how the buddy feels right now: a face from its portrait set + a line for the feelings window
function feeling(b) {
  const n = nameOf(b); const k = wx().key; const cv = coverNeed(b);
  const low = Object.keys(needsOf(b)).filter((x) => x !== 'cover' && stat(b, x) < 40).sort((p, q) => stat(b, p) - stat(b, q));
  const avg = Object.keys(NEEDS.baby).reduce((s, x) => s + stat(b, x), 0) / Object.keys(NEEDS.baby).length;
  if (asleep()) return [['Normal'], `${n} is fast asleep. Shh…`];
  if (cv && stat(b, 'cover') < 50) return [['Worried', 'Teary-Eyed', 'Sad'], `${COVER[k][3]} ${n} wants ${COVER[k][4]}.`];
  if (low.length && stat(b, low[0]) < 15) return [['Crying', 'Teary-Eyed', 'Sad'], { feed: `${n} is SO hungry…`, play: `${n} is bored and lonely…`, clean: `${n} feels all grubby and itchy…` }[low[0]]];
  if (low[0] === 'feed') return [['Sad', 'Worried'], `${n}’s tummy is rumbling.`];
  if (low[0] === 'play') return [['Sad', 'Worried'], `${n} wants to play!`];
  if (low[0] === 'clean') return [['Worried', 'Sad'], `${n} could use a bath.`];
  if ((LOVES[b.sp] || []).includes(k)) return [['Joyous', 'Inspired', 'Happy'], `${n} LOVES the ${WEATHERS[k].name.toLowerCase()}!`];
  if (cv) return [['Happy'], `${n} is snug and safe from the ${WEATHERS[k].name.toLowerCase()}.`];
  if (avg >= 75) return [['Joyous', 'Happy'], `${n} is overjoyed to see you!`];
  if (avg >= 45) return [['Happy', 'Normal'], `${n} is happy.`];
  return [['Sad', 'Normal'], `${n} feels a little down.`];
}
const faceOf = (b, want) => { const B = BABIES[b.sp]; return B ? `assets/portraits/emo/${b.sp}/${want.find((e) => B.emo.includes(e)) || 'Normal'}.png` : ''; };
const buddyFace = (b) => faceOf(b, feeling(b)[0]);
// ---- Nintendogs-style extras (her ask 10-29): walks around Woodland Base that turn up accessories, dress-up, petting by
// stroking, calling the baby over, and a Bond meter. nursery/<id>: acc = { key: true } (found), wear = { head, face, neck },
// bond = points (petting, walks and care raise it; 20 a heart, 5 hearts), walkAt = when the last walk ended.
const ACC = {
  bow: ['🎀', 'Pink Bow', 'head'], flower: ['🌸', 'Flower Clip', 'head'], sunhat: ['👒', 'Sun Hat', 'head'], cap: ['🧢', 'Explorer Cap', 'head'],
  tophat: ['🎩', 'Top Hat', 'head'], crown: ['👑', 'Tiny Crown', 'head'], leaf: ['🍃', 'Leaf Sprig', 'head'], shades: ['🕶️', 'Sunglasses', 'face'],
  specs: ['👓', 'Round Glasses', 'face'], scarf: ['🧣', 'Cozy Scarf', 'neck'], bell: ['🔔', 'Silver Bell', 'neck'], medal: ['🏅', 'Guild Ribbon', 'neck'],
  // her ask 10-29: walks also turn up umbrella patterns, toys and beds. [icon, name, slot, CSS filter (umbrellas and beds)]
  umb_cherry: ['☂️', 'Cherry Umbrella', 'umbrella', 'hue-rotate(95deg) saturate(1.4)'], umb_leaf: ['☂️', 'Leaf Umbrella', 'umbrella', 'hue-rotate(-150deg) saturate(1.2)'],
  umb_sky: ['☂️', 'Sky Umbrella', 'umbrella', 'hue-rotate(-60deg)'], umb_sun: ['☂️', 'Sunny Umbrella', 'umbrella', 'hue-rotate(150deg) saturate(1.8) brightness(1.15)'],
  umb_night: ['☂️', 'Starry Umbrella', 'umbrella', 'brightness(.55) saturate(1.3)'], umb_rainbow: ['☂️', 'Rainbow Umbrella', 'umbrella', 'rainbow'],
  toy_teddy: ['🧸', 'Teddiursa Plush', 'toy'], toy_duck: ['assets/nursery/toy_ducklett.png', 'Rubber Ducklett', 'toy'], toy_kite: ['🪁', 'Kite', 'toy'], toy_yoyo: ['🪀', 'Yo-yo', 'toy'],
  toy_balloon: ['🎈', 'Balloon', 'toy'], toy_star: ['⭐', 'Star Plush', 'toy'],
  bed_moss: ['🛏️', 'Mossy Nest', 'bed', 'hue-rotate(55deg) saturate(1.4)'], bed_cloud: ['☁️', 'Cloud Cushion', 'bed', 'saturate(.15) brightness(1.55)'],
  bed_berry: ['🫐', 'Berry Basket', 'bed', 'hue-rotate(-75deg) saturate(1.5)'], bed_sunset: ['🌅', 'Sunset Nest', 'bed', 'hue-rotate(-25deg) saturate(2.2)'],
  bed_star: ['🌙', 'Starry Bed', 'bed', 'hue-rotate(185deg) brightness(.75) saturate(1.4)'],
};
const accFilter = (k) => (ACC[k]?.[3] === 'rainbow' ? '' : ACC[k]?.[3] || '');
// an accessory's picture: an emoji, or an image path (the Rubber Ducklett, her ask 10-29)
const accIcon = (k) => (ACC[k][0].endsWith('.png') ? `<img class="acc-img" src="${ACC[k][0]}" alt="${esc(ACC[k][1])}">` : ACC[k][0]);
const toyHTML = (b) => (ACC[b?.wear?.toy] ? `<span class="prop ball toy">${accIcon(b.wear.toy)}</span>` : '<img class="prop ball" src="assets/nursery/ball.png" alt="">');
const SECTIONS = [['Wear', ['head', 'face', 'neck']], ['Umbrellas', ['umbrella']], ['Toys', ['toy']], ['Beds', ['bed']]];
// where each baby's body sits in its sprite cell (top and bottom of the idle frame, measured from the sprite sheets)
const BODY = { pichu: [0.307, 0.557], cleffa: [0.35, 0.575], igglybuff: [0.361, 0.583], togepi: [0.333, 0.583], tyrogue: [0.284, 0.557], smoochum: [0.312, 0.562], elekid: [0.281, 0.552],
  magby: [0.307, 0.568], azurill: [0.318, 0.568], wynaut: [0.325, 0.562], budew: [0.325, 0.562], chingling: [0.312, 0.562], bonsly: [0.307, 0.557], mimejr: [0.261, 0.557],
  happiny: [0.287, 0.562], munchlax: [0.295, 0.557], riolu: [0.318, 0.557] };
const SLOT = { head: [0.02, 0.45], face: [0.36, 0.3], neck: [0.72, 0.32] };
// how high the head sits in each animation row (median of the frames), so accessories follow it; jumpy rows (hops) hide them for a moment
const ROWTOP = { pichu: [0.273, 0.085, 0.312, 0.29, 0.295, 0.341, 0.307], cleffa: [0.338, 0.131, 0.381, 0.319, 0.319, 0.338, 0.131], igglybuff: [0.354, 0.125, 0.382, 0.292, 0.292, 0.354, 0.125], togepi: [0.326, 0.097, 0.354, 0.319, 0.319, 0.326, 0.097], tyrogue: [0.25, 0.091, 0.324, 0.278, 0.278, 0.278, 0.091], smoochum: [0.3, 0.106, 0.331, 0.306, 0.306, 0.319, 0.312], elekid: [0.25, 0.104, 0.307, 0.266, 0.266, 0.25, 0.104], magby: [0.273, 0.119, 0.347, 0.312, 0.312, 0.301, 0.307], azurill: [0.33, 0.142, 0.398, 0.352, 0.352, 0.33, 0.142], wynaut: [0.294, 0.125, 0.375, 0.319, 0.319, 0.294, 0.125], budew: [0.325, 0.144, 0.344, 0.319, 0.325, 0.331, 0.325], chingling: [0.338, 0.144, 0.4, 0.312, 0.312, 0.331, 0.312], bonsly: [0.307, 0.114, 0.347, 0.307, 0.307, 0.307, 0.114], mimejr: [0.239, 0.08, 0.312, 0.25, 0.25, 0.278, 0.261], happiny: [0.287, 0.087, 0.319, 0.287, 0.287, 0.3, 0.287], munchlax: [0.301, 0.108, 0.312, 0.29, 0.29, 0.318, 0.307], riolu: [0.33, 0.142, 0.358, 0.324, 0.324, 0.312, 0.318] };
const accRow = (spr, sp, name, ph) => { const t = ROWTOP[sp]; if (!t) return; const d = t[ROW[name]] - t[0];
  spr.classList.toggle('acc-off', Math.abs(d) > 0.12); spr.style.setProperty('--acc-dy', Math.round(d * ph) + 'px'); }; // [how far down the body, size as a share of the body height]
const accHTML = (b, pw, ph) => { const [t0, bt] = BODY[b?.sp] || [0.3, 0.56]; const t = ROWTOP[b?.sp]?.[0] ?? t0; const bh = (bt - t0) * ph;
  return Object.entries(b?.wear || {}).filter(([slot, k]) => ACC[k] && SLOT[slot]).map(([slot, k]) =>
    `<i class="acc acc-${slot}" style="top:${Math.round(t * ph + SLOT[slot][0] * bh)}px;font-size:${Math.max(10, Math.round(SLOT[slot][1] * bh))}px">${accIcon(k)}</i>`).join(''); };
const bondOf = (b) => num(b?.bond);
const hearts = (b) => Math.min(5, Math.floor(bondOf(b) / 20));
const addBond = (id, n) => store.update('nursery/' + id, (x) => (x ? { ...x, bond: Math.min(100, num(x.bond) + n) } : x));
const WALK_REST = 45 * 60e3;
// their Pokémon cries (her ask 10-29): assets/cries/<species>.mp3. Little ones squeak a bit higher; quiet when music is muted;
// never more than one cry every few seconds per baby, so a busy room doesn't turn into a chorus.
const lastCry = {};
// her report 10-29 "I don't hear it": cries no longer follow the music button (she had the lullaby off), they're louder,
// and each baby's cry is loaded ahead so the first one isn't lost. The 🔊 button next to Name plays it on demand.
// her ask 10-29: cries have their own mute button (dc.cries on this device), separate from the music
const criesOff = () => { try { return localStorage.getItem('dc.cries') === 'off'; } catch { return false; } };
const cryAudio = {};
const cryOf = (sp) => (cryAudio[sp] ||= Object.assign(new Audio(`assets/cries/${sp}.mp3`), { preload: 'auto' }));
function cry(b, { vol = 0.8, odds = 1, force = false } = {}) {
  if (!b || !BABIES[b.sp] || Math.random() > odds || (!force && (criesOff() || Date.now() - (lastCry[b.sp] || 0) < 3500))) return;
  lastCry[b.sp] = Date.now();
  const a = cryOf(b.sp); a.pause(); a.currentTime = 0; a.volume = Math.min(1, vol * 0.4); // her ask 10-29: cries softer a.preservesPitch = false; a.playbackRate = [1.2, 1.2, 1.1, 1][b.stage] || 1;
  a.play().catch(() => { /* not allowed before the first tap */ });
}
const listOf = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
// the species of a host known by name only
const WALK_SPECIES = { Beatrice: 'Beedrill' };
const WALK_SPOTS = [
  ['camp', '🏕️', 'Fernshade Camp', 'Beatrice', ['Mind the eggs, little one!', 'Out for a walk? How lovely!']],
  ['kitchen', '🍲', 'Spinda’s Kitchen', 'Spinda', ['Something smells good, huh? Not for babies… okay, one crumb.', 'Wobble wobble! Hello!']],
  ['sentry', '⛏️', 'Sentry Post', 'Diglett', ['Halt! Who goes there? Oh, it’s you. Carry on!', 'Watch the soft spot by the big root!']],
  ['oak', '🦉', 'Noctowl’s Oak', 'Noctowl', ['Hoo… a fine evening stroll.', 'Too young for cards. Come back in a few years.']],
  ['beach', '🌊', 'Sunshell Beach', 'Rayson the Wingull', ['Wanna race to the waves?', 'No letters for you today, but here’s a shell!']],
  ['lab', '🧪', 'Boltund’s Lab', 'Boltund', ['ARF! A test subject! Kidding. Mostly.', 'Zoom zoom! Want to see a Poké Ball pile?']],
  ['hall', '🏛️', 'Guild Hall', 'Guildmaster Beautifly', ['A future guild member, I see.', 'Walk with pride, little one.']],
];

// ---- the living pet (her ask 10-27: feel like a little virtual pet). The buddy wanders the room on its own, hops when
// happy, naps at night, shows a thought bubble when it needs something, and acts out each care action:
// feed = a berry drops in and it walks over to eat it; play = it chases a bouncing ball; bath = bubbles, then a shake-off.
// her ask 10-29: the buddy grows with its age, a teen is the full size
const SIZE = [3, 1.8, 2.4, 3]; const ROW = { idle: 0, hop: 1, sleep: 2, right: 3, left: 4, eat: 5, nod: 6 };
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
// tap Celebi or Beatrice while they visit (her ask 10-29): their portrait window, like the baby's
function visitorPane(roomEl, img, sym, text) {
  if ($('.emo-pane', roomEl)) return;
  roomEl.insertAdjacentHTML('beforeend', `<div class="emo-pane yf" role="status"><div class="yf-pic"><span class="yf-sym ${sym === '♥' ? 'heart' : ''}">${sym}</span><img src="${img}" alt=""></div><p>${esc(text)}</p></div>`);
  const pane = $('.emo-pane', roomEl); const bye = () => { pane.classList.add('bye'); setTimeout(() => pane.remove(), 300); };
  pane.onclick = bye; setTimeout(bye, 4200);
}
const petHTML = () => '<div class="pet" id="npet"><span class="pet-cover"></span><span class="baby-spr"></span><span class="pet-think"></span></div><div class="props"></div>';
function startPet(root, b, scene, ownerId) {
  const B = BABIES[b.sp]; const roomEl = $('.nursery-room', root); const pet = $('#npet', root); if (!B || !roomEl || !pet) return;
  const spr = $('.baby-spr', pet); const think = $('.pet-think', pet); const cov = $('.pet-cover', pet); const props = $('.props', root);
  const S = SIZE[b.stage] || 3; const pw = Math.round(B.cw * S); const ph = Math.round(B.ch * S);
  spr.style.cssText = `width:${pw}px;height:${ph}px;background-image:url(assets/nursery/${b.sp}.png);background-size:${pw * 10}px ${ph * 7}px`;
  pet.style.width = pw + 'px'; pet.style.bottom = Math.round(64 - ph / 2) + 'px';
  spr.innerHTML = accHTML(b, pw, ph);
  // an umbrella pattern only changes the umbrella (not the sun shade, blanket or tent)
  const paintCover = () => { const k = b.wear?.umbrella; const umb = lab('cover')[2] === 'Umbrella' && ACC[k];
    cov.style.filter = umb ? accFilter(k) : ''; cov.classList.toggle('rainbow', !!umb && ACC[k][3] === 'rainbow'); };
  const alive = () => roomEl.isConnected;
  const row = (name, loop = true, secs = null) => {
    const r = ROW[name]; const n = B.fr[r] || 1;
    spr.style.backgroundPositionY = `-${r * ph}px`; spr.style.setProperty('--fw', pw + 'px'); spr.style.setProperty('--n', n);
    spr.style.animation = 'none'; void spr.offsetWidth;
    spr.style.animation = `baby-anim ${secs || Math.max(0.4, n * 0.12)}s steps(${n}, jump-none) ${loop ? 'infinite' : '1 forwards'}`; accRow(spr, b.sp, name, ph);
  };
  let x = Math.max(10, roomEl.clientWidth * 0.5 - pw / 2);
  const maxX = () => Math.max(10, roomEl.clientWidth - pw - 10);
  pet.style.left = x + 'px';
  const fx = (ch, dx = 0) => { const e = document.createElement('span'); e.className = 'pet-fx'; e.textContent = ch; e.style.left = (x + pw / 2 - 12 + dx) + 'px'; roomEl.appendChild(e); setTimeout(() => e.remove(), 1400); };
  const walkTo = async (tx, sp = 75) => {
    tx = Math.max(10, Math.min(maxX(), tx)); const d = Math.abs(tx - x); if (d < 4) return;
    row(tx > x ? 'right' : 'left'); pet.style.transition = `left ${(d / sp).toFixed(2)}s linear`; pet.style.left = tx + 'px'; x = tx;
    await wait(d / sp * 1000); row('idle');
  };
  const mood = () => { const k = Object.keys(needsOf(b)); return k.reduce((t, n) => t + stat(b, n), 0) / k.length; };
  const need = () => { const low = Object.keys(needsOf(b)).filter((n) => stat(b, n) < 40).sort((p, q) => stat(b, p) - stat(b, q))[0]; return low ? lab(low)[0] : ''; };
  let busy = false;
  // tap: it walks up to the screen and the feelings window (like Pikachu's in Pokémon Yellow) shows how it feels
  // her ask 10-29 (Nintendogs): stroke it to pet it. Hold and rub (or move the mouse over it with the button down): hearts, a happy nod, more Bond.
  let rub = 0; let rubbed = false; let rubSaved = 0; let pendingBond = 0;
  let lx = null; let ly = 0;
  pet.onpointerdown = (e) => { rubbed = false; rub = 0; lx = e.clientX; ly = e.clientY; try { pet.setPointerCapture(e.pointerId); } catch { /* fine */ } };
  pet.onpointerup = pet.onpointercancel = () => { lx = null; };
  pet.onpointermove = (e) => {
    if (lx === null) return;
    rub += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly); lx = e.clientX; ly = e.clientY;
    if (rub < 90) return;
    rub = 0; rubbed = true; fx(Math.random() < 0.5 ? '💕' : '💗'); if (!busy) { row('nod', false); setTimeout(() => !busy && row('idle'), 700); }
    pendingBond++; if (ownerId && Date.now() - rubSaved > 2500) { addBond(ownerId, pendingBond); pendingBond = 0; rubSaved = Date.now(); }
  };
  pet.style.touchAction = 'none';
  // the Call button: it hurries over, hops and looks at you
  pet.addEventListener('call', async () => {
    if (busy || asleep()) { if (asleep()) fx('💤'); return; } busy = true; think.className = 'pet-think';
    await walkTo(roomEl.clientWidth / 2 - pw / 2, 240); if (!alive()) return; fx('❗'); cry(b); row('hop', false); await wait(700); row('nod', false); await wait(800); row('idle'); busy = false;
  });
  // playdates (her ask 10-29: more interaction): the visiting buddy asks this one to run, hop, nod, face it or nap
  pet.addEventListener('duo', async (e) => {
    const d = e.detail || {};
    if (busy || (asleep() && d.act !== 'sleep')) return d.done?.(false);
    busy = true; think.className = 'pet-think';
    if (d.act === 'go') await walkTo(d.x, d.sp || 75);
    else if (d.act === 'hop') { row('hop', false); if (d.fx) fx(d.fx); cry(b, { vol: 0.6, odds: 0.35 }); await wait(750); row('idle'); }
    else if (d.act === 'nod') { row('nod', false); if (d.fx) fx(d.fx); await wait(850); row('idle'); }
    else if (d.act === 'face') { row(d.dir); await wait(d.ms || 600); row('idle'); }
    else if (d.act === 'sleep') { row('sleep', true, 1.6); await wait(d.ms || 4000); row('idle'); }
    busy = false; d.done?.(true);
  });
  pet.hostX = () => x; pet.hostW = pw;
  pet.onclick = async () => {
    if (rubbed) { rubbed = false; return; }
    if (busy) return; busy = true; if (!asleep()) cry(b); think.className = 'pet-think';
    const [want, text] = feeling(b); const sleeping = asleep();
    if (!sleeping) await walkTo(roomEl.clientWidth / 2 - pw / 2, 260); // hurries over when tapped
    if (!alive()) return;
    if (!sleeping) { row('idle'); pet.classList.add('close'); }
    // her ask: the window looks like Pikachu's frames in Pokémon Yellow (square double-line frame with corner knobs,
    // a mood mark over the head) and nearly fills the nursery room
    const sym = sleeping ? 'z Z' : /Joyous|Happy|Inspired/.test(want[0]) ? '♥' : /Crying|Teary/.test(want[0]) ? '…' : /Sad|Worried/.test(want[0]) ? '?' : '♪';
    roomEl.insertAdjacentHTML('beforeend', `<div class="emo-pane yf" role="status"><div class="yf-pic"><span class="yf-sym ${sym === '♥' ? 'heart' : ''}">${sym}</span><img src="${faceOf(b, want)}" alt=""></div><p>${esc(text)}</p></div>`);
    const pane = $('.emo-pane', roomEl);
    await Promise.race([wait(4200), new Promise((ok) => { pane.onclick = ok; })]);
    pane.classList.add('bye'); pet.classList.remove('close'); setTimeout(() => pane.remove(), 300);
    if (!sleeping) { await wait(450); fx('💕', -14); fx('💗', 14); row('nod', false); await wait(900); row('idle'); } else row('sleep', true, 1.6);
    busy = false;
  };
  const scenes = {
    async feed() {
      const berry = ['oran', 'sitrus', 'pecha', 'leppa'][Math.floor(Math.random() * 4)];
      const bx = Math.max(20, Math.min(maxX() + pw / 2 - 20, x + pw + 30 > maxX() ? x - 50 : x + pw + 30));
      props.innerHTML = `<img class="prop drop" src="assets/items/${berry}-berry.png" alt="" style="left:${bx}px">`;
      await wait(650); await walkTo(bx - pw / 2 + 16);
      row('eat', true); $('.prop', props)?.classList.add('eaten'); fx('😋'); await wait(900); fx('💕', 10); await wait(1300);
      props.innerHTML = ''; row('hop', false); await wait(700); row('idle');
    },
    // full: it glances at the berry, turns away, and the berry fades
    async feedMeh() {
      const berry = ['oran', 'sitrus', 'pecha', 'leppa'][Math.floor(Math.random() * 4)];
      const bx = Math.max(20, Math.min(maxX() + pw / 2 - 20, x + pw + 30 > maxX() ? x - 50 : x + pw + 30));
      props.innerHTML = `<img class="prop drop" src="assets/items/${berry}-berry.png" alt="" style="left:${bx}px">`;
      await wait(900); row(bx > x ? 'right' : 'left'); fx('😑'); await wait(900); row(bx > x ? 'left' : 'right'); await wait(700); row('idle');
      $('.prop', props)?.classList.add('fade'); await wait(1600); props.innerHTML = '';
    },
    playMeh() { return scenes.play(true); },
    // her ask 10-29: drag the toy and let go to throw it; the baby runs after it. Nobody throws for a while = it plays by itself.
    async play(meh = false) {
      props.innerHTML = `<span class="ball-wrap throwable rest">${toyHTML(b)}</span>`;
      const ball = $('.ball-wrap', props);
      const W = () => roomEl.clientWidth - 36; const H = () => roomEl.clientHeight - 40;
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      let bx = x + pw / 2 - 18; let by = 28;
      const place = () => { ball.style.left = bx + 'px'; ball.style.bottom = by + 'px'; };
      ball.style.transition = 'none'; place();
      roomEl.insertAdjacentHTML('beforeend', `<div class="toy-hint">${meh ? `😑 ${esc(nameOf(b))} doesn’t feel like playing… throw it anyway?` : '👆 Drag the toy and let go to throw it!'}</div>`);
      const hint = $('.toy-hint', roomEl);
      const throwIt = () => new Promise((ok) => {
        let drag = null; let hist = [];
        const t = setTimeout(() => { if (!drag) ok(null); }, 9000);
        ball.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); clearTimeout(t); drag = { sx: e.clientX, sy: e.clientY, bx, by }; hist = [[e.clientX, e.clientY, performance.now()]]; try { ball.setPointerCapture(e.pointerId); } catch { /* fine */ } ball.classList.add('held'); hint?.remove(); };
        ball.onpointermove = (e) => {
          if (!drag) return;
          bx = clamp(drag.bx + e.clientX - drag.sx, 0, W()); by = clamp(drag.by - (e.clientY - drag.sy), 0, H()); place();
          hist.push([e.clientX, e.clientY, performance.now()]); if (hist.length > 6) hist.shift();
        };
        ball.onpointerup = ball.onpointercancel = () => {
          if (!drag) return; drag = null; ball.classList.remove('held'); ball.onpointerdown = ball.onpointermove = ball.onpointerup = null;
          const a = hist[0]; const z = hist[hist.length - 1]; const dt = Math.max(16, z[2] - a[2]);
          ok({ vx: clamp((z[0] - a[0]) / dt * 16, -38, 38), vy: clamp(-(z[1] - a[1]) / dt * 16, -38, 38) });
        };
      });
      // it flies, bounces off the walls and slows down on the grass
      const fly = (vx, vy) => new Promise((ok) => {
        ball.classList.remove('rest'); let spin = 0;
        const step = () => {
          if (!alive()) return ok();
          bx += vx; by += vy; spin += vx * 6;
          if (bx < 0 || bx > W()) { vx = -vx * 0.7; bx = clamp(bx, 0, W()); }
          if (by < 0 || by > H()) { vy = -vy * 0.7; by = clamp(by, 0, H()); }
          vx *= 0.95; vy *= 0.95; place(); ball.firstElementChild.style.rotate = spin + 'deg';
          if (Math.hypot(vx, vy) > 0.4) requestAnimationFrame(step); else { ball.classList.add('rest'); ok(); }
        };
        requestAnimationFrame(step);
      });
      const fetchIt = async (last) => {
        await walkTo(bx - pw / 2 + 18, 120); if (!alive()) return;
        bx = x + pw / 2 - 18; ball.style.transition = 'left .3s, bottom .3s'; by = 28; place(); await wait(300); ball.style.transition = 'none';
        row('hop', false); fx(last ? '💕' : '♪'); cry(b, { vol: 0.5 }); await wait(650); row('idle');
      };
      for (let i = 0; i < 6 && alive(); i++) {
        const v = await throwIt(); if (!alive()) break;
        if (!v && meh) break;
        if (!v) {   // nobody threw it: the baby plays on its own like before
          hint?.remove(); ball.classList.remove('rest'); ball.style.transition = '';
          for (let k = 0; k < 3 && alive(); k++) { const tx = k % 2 ? 20 : maxX(); ball.style.left = (tx + pw / 2 - 18) + 'px'; ball.style.bottom = '28px'; await wait(150); await walkTo(tx); row('hop', false); fx(k === 2 ? '💕' : '♪'); await wait(650); }
          break;
        }
        await fly(v.vx, v.vy); if (!alive()) break;
        if (meh) { row(bx + 18 > x + pw / 2 ? 'right' : 'left'); fx(Math.random() < 0.5 ? '😑' : '💤'); await wait(700); row('idle'); continue; }   // it just watches; the toy stays where it landed
        await fetchIt(i === 5);
        if (ownerId) addBond(ownerId, 1);
      }
      hint?.remove(); props.innerHTML = ''; row('nod', false); await wait(800); row('idle');
    },
    async clean() {
      row('idle'); const bub = Array.from({ length: 16 }, (_, i) => `<i style="left:${x - 10 + Math.random() * (pw + 20)}px;animation-delay:${(i * 0.12).toFixed(2)}s;--s:${(0.6 + Math.random() * 0.9).toFixed(2)}"></i>`).join('');
      props.innerHTML = `<div class="suds">${bub}</div>`; await wait(2200);
      pet.classList.add('shake'); props.innerHTML = `<div class="drops">${Array.from({ length: 10 }, (_, i) => `<i style="left:${x + pw / 2}px;--a:${i * 36}deg"></i>`).join('')}</div>`;
      await wait(800); pet.classList.remove('shake'); props.innerHTML = ''; fx('✨', -16); fx('✨', 16); row('hop', false); await wait(700); row('idle');
    },
    async cover() { cov.textContent = lab('cover')[0]; paintCover(); cov.classList.add('show', 'pop'); row('hop', false); fx('💕'); await wait(800); cov.classList.remove('pop'); row('idle'); },
    async grew() { row('hop', false); fx('✨'); await wait(700); row('hop', false); fx('🎉'); await wait(700); row('idle'); },
  };
  // her ask 10-29: a very rare visit from Celebi, who flutters in and plays chase (add ?celebi to the address to see it now),
// with its own tune and flowers springing up across the room (glowing at night); it can come at night too and wakes the baby
  let celebiDone = false;
  // a visit booked for a set time (tables/<code>/celebiAt, her ask 10-29 'spawn one at 3:08'): comes if the nursery is open within 15 minutes of it
  const celebiDue = () => { const t = num(store.get('celebiAt')); return t > 0 && Date.now() >= t && Date.now() - t < 15 * 60000; };
  const celebi = async () => {
    celebiDone = true; const W = roomEl.clientWidth; const c = document.createElement('span'); c.className = 'flyer celebi';
    const dir = (d) => { c.style.backgroundPositionY = `-${{ down: 0, right: 1, left: 2 }[d] * 120}px`; };
    const fly = async (cx, ms) => { dir(cx > parseFloat(c.style.left) ? 'right' : 'left'); c.style.transition = `left ${ms}ms ease-in-out`; c.style.left = cx + 'px'; await wait(ms); dir('down'); };
    visitMusic('celebi'); row('idle');
    const glow = roomEl.classList.contains('tod-night') ? ' glow' : '';
    Array.from({ length: 9 }, (_, i) => { const f = document.createElement('span'); f.className = 'cflower' + glow; f.textContent = ['🌸', '🌼', '🌷', '💮', '🌺'][i % 5];
      f.style.left = (8 + (i / 8) * (W - 46) + (Math.random() * 14 - 7)) + 'px'; f.style.animationDelay = (0.6 + i * 0.35 + Math.random() * 0.3).toFixed(2) + 's, ' + (2 + i * 0.35).toFixed(2) + 's'; roomEl.appendChild(f); });
    c.onclick = () => visitorPane(roomEl, `assets/portraits/emo/celebi/${['Happy', 'Joyous', 'Normal'][Math.floor(Math.random() * 3)]}.png`, '♥',
      ['Celebi giggles and twirls around in the air.', 'Celebi is having the best time playing with ' + nameOf(b) + '!', 'Celebi smiles. The flowers seem to sway along with it.'][Math.floor(Math.random() * 3)]);
    c.style.left = W + 'px'; roomEl.appendChild(c); const cap = document.createElement('div'); cap.className = 'duo-cap show'; cap.textContent = '✨ Celebi came to play!'; roomEl.appendChild(cap);
    const trail = setInterval(() => { const e = document.createElement('span'); e.className = 'pet-fx'; e.textContent = '✨'; e.style.left = (c.offsetLeft + 18) + 'px'; e.style.bottom = '150px'; roomEl.appendChild(e); setTimeout(() => e.remove(), 1400); }, 450);
    await wait(50); await fly(Math.min(W - 70, x + pw + 20), 1800); if (!alive()) return clearInterval(trail);
    fx('❗'); cry(b, { vol: 0.8 }); row('hop', false); await wait(750); row('idle');
    for (let i = 0; i < 3 && alive(); i++) { const tx = i % 2 ? W - 80 : 20; await Promise.all([fly(tx, 1300), (async () => { await wait(250); await walkTo(tx - pw / 2 + 30, 110); })()]); row('hop', false); fx(i === 2 ? '💕' : '♪'); await wait(650); row('idle'); }
    if (!alive()) return clearInterval(trail);
    row('nod', false); fx('💕', -14); fx('💗', 14); await wait(1200); row('idle');
    c.classList.add('bye'); await fly(W + 40, 1600); clearInterval(trail); c.remove(); cap.remove(); fx('✨'); visitMusic();
  };
  // free time: wander, hop, nod, nap
  const life = async () => {
    while (alive()) {
      if (busy) { await wait(400); continue; }
      const h = new Date().getHours(); const m = mood(); const ic = need();
      think.className = 'pet-think' + (ic ? ' show' : ''); think.textContent = ic;
      const cv = coverNeed(b) && stat(b, 'cover') >= 50; cov.textContent = cv ? lab('cover')[0] : ''; cov.classList.toggle('show', !!cv); paintCover();
      if (!celebiDone && (Math.random() < (asleep(h) ? 0.004 : 0.002) || /celebi/.test(location.search) || celebiDue())) { busy = true; think.className = 'pet-think'; await celebi(); busy = false; continue; }
      if (asleep(h)) { row('sleep', true, 1.6); think.className = 'pet-think show zz'; think.textContent = 'z Z'; await wait(5000); continue; }
      const r = Math.random();
      if (r < 0.4) await walkTo(10 + Math.random() * maxX());
      else if (r < 0.55 && m >= 60) { row('hop', false); if (Math.random() < 0.5) fx('♪'); cry(b, { vol: 0.6, odds: 0.15 }); await wait(800); row('idle'); }
      else if (r < 0.65) { row('nod', false); await wait(900); row('idle'); }
      else if (r < 0.72 && m >= 50) { row('sleep', true, 1.6); await wait(3500); row('idle'); }
      else { row('idle'); await wait(1500 + Math.random() * 2000); }
    }
  };
  row('idle');
  (async () => { if (scene && scenes[scene]) { busy = true; think.className = 'pet-think'; await wait(200); await scenes[scene](); if (scene !== 'cover' && !scene.endsWith('Meh')) cry(b, { vol: 0.7 }); busy = false; } })().then(life);
}
// the egg is the Ruby & Sapphire egg sprite (her ask 10-27), assets/nursery/egg.png
const eggHTML = (b, cls = '') => `<img class="egg ${cls}" src="assets/nursery/egg.png" alt="An egg">`;
// her ask 10-27: the egg (and later the baby) sits in a nest on Tiny Woods grass. Nest = two layers so the front rim covers the egg.
const nestHTML = (inner) => `<div class="nest"><img class="nest-b" src="assets/nursery/nest_back.png" alt="">${inner}<img class="nest-f" src="assets/nursery/nest_front.png" alt=""></div>`;
const nameOf = (b) => b.name || (b.stage === 0 ? 'your egg' : BABIES[b.sp]?.name || 'your buddy');

function adopt(c) {
  const keys = Object.keys(BABIES); const sp = keys[Math.floor(Math.random() * keys.length)];
  const now = Date.now();
  store.set('nursery/' + c.id, { sp, stage: 0, grown: 0, born: now, warmAt: now - 6 * 3600e3, feedAt: now, playAt: now, cleanAt: now, days: {} });
  logRoll(c.nickname, 'Fernshade Nursery', null, 'took home an egg from Beatrice', 'note');
}

function act(c, k) {
  const b = buddyOf(c.id); if (!b) return '';
  if (stat(b, k) >= 90) return k === 'cover' ? `${nameOf(b)} is already safe from the weather.` : k === 'feed' ? `${nameOf(b)} is full!` : k === 'play' ? `${nameOf(b)} is all played out. Let it rest a bit.` : k === 'clean' ? 'Already squeaky clean!' : 'It’s nice and toasty already.';
  const d = today(); const day = { ...todayOf(b) }; day[k] = num(day[k]) + 1;
  const next = { ...b, [k + 'At']: Date.now(), ...(k === 'cover' ? { coverBlock: wx().block } : {}), days: { ...(b.days || {}), [d]: day } };
  // a fully cared-for day counts once toward growing up
  if (!day.counted && Object.entries(needsOf(next)).every(([n, want]) => num(day[n]) >= want)) {
    day.counted = true; next.grown = num(b.grown) + 1;
    if (b.stage < 3 && next.grown >= DAYS_TO_GROW[b.stage]) { next.stage = b.stage + 1; next.grown = 0; next.grewAt = Date.now(); }
  }
  // keep only the last 2 weeks of day records
  next.days = Object.fromEntries(Object.entries(next.days).sort().slice(-14));
  next.bond = Math.min(100, num(b.bond) + 2);
  store.set('nursery/' + c.id, next);
  if (next.stage !== b.stage) {
    const msg = next.stage === 1 ? `${c.nickname}’s egg hatched into a ${BABIES[b.sp].name}!` : `${c.nickname}’s ${BABIES[b.sp].name} grew into a ${STAGES[next.stage].toLowerCase()}!`;
    store.pushLimited('log', { t: Date.now(), text: msg });
    gameSay('Beatrice', 'say', next.stage === 1 ? `${c.nickname}’s egg just hatched! Welcome to Fernshade, little ${BABIES[b.sp].name}!` : `${c.nickname}’s ${BABIES[b.sp].name} is growing up so fast!`, 'nursery', c.nickname);
    markWinner(c.id);
    return 'grew';
  }
  return 'ok';
}

// ---- playdates (her ask 10-29: the babies can visit each other). nursery/<host>/visit = { id: guest owner, t } for 20 minutes:
// the friend's buddy toddles around your room with yours, they hop and trade hearts, and it counts as play time for both.
const VISIT_FOR = 20 * 60e3;
const visitOf = (b) => (b?.visit && Date.now() - num(b.visit.t) < VISIT_FOR && buddyOf(b.visit.id)?.stage > 0 ? b.visit : null);
// where my buddy is visiting right now (another host whose visit is me)
const visitingAt = (id) => Object.entries(store.get('nursery') || {}).find(([h, x]) => h !== id && visitOf(x)?.id === id)?.[0] || null;
const hatched = (meId) => Object.entries(store.get('nursery') || {}).filter(([id, x]) => id !== meId && x && x.stage > 0 && !x.recruited && (store.get('party') || {})[id]);
function startGuest(root, gb, label) {
  const B = BABIES[gb.sp]; const roomEl = $('.nursery-room', root); const pet = $('#ngpet', root); if (!B || !roomEl || !pet) return;
  const spr = $('.baby-spr', pet);
  const S = SIZE[gb.stage] || 3; const pw = Math.round(B.cw * S); const ph = Math.round(B.ch * S);
  spr.style.cssText = `width:${pw}px;height:${ph}px;background-image:url(assets/nursery/${gb.sp}.png);background-size:${pw * 10}px ${ph * 7}px`;
  pet.style.width = pw + 'px'; pet.style.bottom = Math.round(64 - ph / 2) + 'px';
  $('.pet-tag', pet).textContent = label; spr.innerHTML = accHTML(gb, pw, ph);
  const alive = () => roomEl.isConnected;
  // her ask 10-29: the name tag is always in front (over the other baby, the nest, flowers, rain and the night tint),
  // so it lives on the room itself and follows the visitor around
  const tag = $('.pet-tag', pet); tag.classList.add('front'); roomEl.appendChild(tag);
  (function follow() { if (!alive()) return; const r = roomEl.getBoundingClientRect(); const q = pet.getBoundingClientRect();
    tag.style.left = (q.left - r.left + q.width / 2) + 'px'; tag.style.top = (q.top - r.top + q.height * 0.62) + 'px'; requestAnimationFrame(follow); })();
  const row = (name, loop = true, secs = null) => {
    const r = ROW[name]; const n = B.fr[r] || 1;
    spr.style.backgroundPositionY = `-${r * ph}px`; spr.style.setProperty('--fw', pw + 'px'); spr.style.setProperty('--n', n);
    spr.style.animation = 'none'; void spr.offsetWidth;
    spr.style.animation = `baby-anim ${secs || Math.max(0.4, n * 0.12)}s steps(${n}, jump-none) ${loop ? 'infinite' : '1 forwards'}`; accRow(spr, gb.sp, name, ph);
  };
  let x = Math.max(10, roomEl.clientWidth * 0.2);
  const maxX = () => Math.max(10, roomEl.clientWidth - pw - 10);
  pet.style.left = x + 'px';
  const fx = (ch) => { const e = document.createElement('span'); e.className = 'pet-fx'; e.textContent = ch; e.style.left = (x + pw / 2 - 12) + 'px'; roomEl.appendChild(e); setTimeout(() => e.remove(), 1400); };
  const walkTo = async (tx, sp = 70) => {
    tx = Math.max(10, Math.min(maxX(), tx)); const d = Math.abs(tx - x); if (d < 4) return;
    row(tx > x ? 'right' : 'left'); pet.style.transition = `left ${(d / sp).toFixed(2)}s linear`; pet.style.left = tx + 'px'; x = tx;
    await wait(d / sp * 1000); row('idle');
  };
  pet.onclick = async () => { row('hop', false); fx('💕'); cry(gb); await wait(700); row('idle'); };
  const gname = label.split('’s ').pop(); const props = $('.props', root);
  const hostEl = () => $('#npet', root);
  const meOwner = () => me()?.id;
  // ask the host buddy to do something; resolves when it's done (or straight away if it's busy)
  const host = (act, extra = {}) => new Promise((ok) => { const h = hostEl(); if (!h) return ok(false); h.dispatchEvent(new CustomEvent('duo', { detail: { act, ...extra, done: ok } })); setTimeout(() => ok(false), 7000); });
  const hx = () => hostEl()?.hostX?.() ?? maxX() / 2; const hw = () => hostEl()?.hostW || pw;
  const hfx = (ch, dx = 0) => { const e = document.createElement('span'); e.className = 'pet-fx'; e.textContent = ch; e.style.left = (hx() + hw() / 2 - 12 + dx) + 'px'; roomEl.appendChild(e); setTimeout(() => e.remove(), 1400); };
  const cap = (t) => { let c = $('.duo-cap', roomEl); if (!c) { c = document.createElement('div'); c.className = 'duo-cap'; roomEl.appendChild(c); } c.textContent = t; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); };
  const hostName = () => $('#nname', root)?.closest('.n-head')?.querySelector('b')?.textContent || 'your buddy';
  const GAMES = {
    // tag: one chases, the other runs off squealing, then they swap
    async tag() {
      cap(`${gname} and ${hostName()} are playing tag!`); cry(gb, { vol: 0.7 });
      for (let k = 0; k < 2 && alive(); k++) {
        const far = hx() < maxX() / 2 ? maxX() : 10;
        await Promise.all([walkTo(hx(), 200), wait(250).then(() => host('go', { x: far, sp: 210 }))]);
        fx('💨'); await wait(300);
        const back = x < maxX() / 2 ? maxX() : 10;
        await Promise.all([host('go', { x: x, sp: 200 }), wait(250).then(() => walkTo(back, 210))]);
        hfx('❗'); if (k === 0) cry(buddyOf(meOwner()), { vol: 0.7 });
      }
      await Promise.all([host('hop', { fx: '♪' }), (async () => { row('hop', false); fx('♪'); await wait(750); row('idle'); })()]);
    },
    // catch: a ball bounces back and forth between them
    async ball() {
      cap(`${gname} and ${hostName()} are playing catch!`);
      await walkTo(hx() < maxX() / 2 ? hx() + 150 : hx() - 150, 120);
      props.insertAdjacentHTML('beforeend', `<span class="ball-wrap duo-ball">${toyHTML(buddyOf(meOwner()))}</span>`);
      const ball = $('.duo-ball', props); ball.style.transition = 'none'; ball.style.left = (x + pw / 2 - 18) + 'px'; void ball.offsetWidth; ball.style.transition = '';
      for (let k = 0; k < 4 && alive(); k++) {
        const toHost = k % 2 === 0; ball.style.left = ((toHost ? hx() + hw() / 2 : x + pw / 2) - 18) + 'px';
        await wait(650);
        if (toHost) await host('hop', { fx: k === 2 ? '💕' : '' }); else { row('hop', false); await wait(700); row('idle'); }
      }
      ball.remove(); fx('💕'); hfx('💕'); cry(gb, { vol: 0.7 });
    },
    // a cuddle: they walk up to each other, face each other and nuzzle
    async cuddle() {
      cap(`${gname} and ${hostName()} are having a cuddle!`);
      const left = x < hx(); await walkTo(left ? hx() - pw * 0.7 : hx() + hw() * 0.7, 110);
      await Promise.all([host('face', { dir: left ? 'left' : 'right', ms: 300 }), (async () => { row(left ? 'right' : 'left'); await wait(300); })()]);
      for (let k = 0; k < 2; k++) { await Promise.all([host('nod'), (async () => { row('nod', false); await wait(850); })()]); fx('💕', 10); hfx('💞', -10); if (k === 0) cry(gb, { vol: 0.7 }); else cry(buddyOf(meOwner()), { vol: 0.7 }); }
      row('idle');
    },
    // a dance: they take turns hopping, then hop together
    async dance() {
      cap(`${gname} and ${hostName()} are dancing!`);
      await walkTo(hx() < maxX() / 2 ? hx() + 110 : hx() - 110, 110);
      for (let k = 0; k < 3 && alive(); k++) { row('hop', false); fx('♪'); await wait(700); row('idle'); await host('hop', { fx: '♫' }); }
      await Promise.all([host('hop', { fx: '✨' }), (async () => { row('hop', false); fx('✨'); cry(gb, { vol: 0.7 }); await wait(750); row('idle'); })()]);
    },
    // her ask 10-29: every so often Beatrice buzzes in and tries to settle them down (it doesn't always stick)
    async beatrice() {
      const W = roomEl.clientWidth; const bz = document.createElement('span'); bz.className = 'flyer bea-fly';
      const dir = (d) => { bz.style.backgroundPositionY = `-${{ down: 0, right: 1, left: 2 }[d] * 120}px`; };
      const fly = async (cx, ms) => { dir(cx > parseFloat(bz.style.left) ? 'right' : 'left'); bz.style.transition = `left ${ms}ms ease-in-out`; bz.style.left = cx + 'px'; await wait(ms); dir('down'); };
      bz.onclick = () => visitorPane(roomEl, beaFace(Math.random() < 0.5 ? 'happy' : 'proud'), '♪', ['Beatrice is keeping a close eye on the little ones.', 'Beatrice hums a little. She loves these babies, even the noisy ones.', 'Beatrice sighs fondly. Playdates are a lot of work!'][Math.floor(Math.random() * 3)]);
      bz.style.left = W + 'px'; roomEl.appendChild(bz); await wait(50);
      const [ask, after] = [['Settle down, you two! Inside voices, please.', 'That’s better. Play nicely!'], ['My goodness, what a racket! Deep breaths, little ones.', 'Much calmer. Good babies.'],
        ['Easy now, before somebody bumps a nest!', 'There we go. Gently, gently.'], ['Shh, shh! The other eggs are trying to sleep.', 'Thank you, dears.']][Math.floor(Math.random() * 4)];
      await fly(W / 2 - 40, 1500); if (!alive()) return; cap(`Beatrice: “${ask}”`);
      const mid = W / 2 - pw / 2; await Promise.all([walkTo(mid - 60, 110), host('go', { x: mid + 60, sp: 110 })]);
      fx('😳'); hfx('😳'); await wait(900);
      await Promise.all([host('nod'), (async () => { row('nod', false); await wait(850); row('idle'); })()]); await wait(1400);
      cap(`Beatrice: “${after}”`); await wait(1200); await fly(W + 50, 1500); bz.remove();
      if (Math.random() < 0.5) { await wait(500); await Promise.all([host('hop', { fx: '♪' }), (async () => { row('hop', false); fx('♪'); await wait(750); row('idle'); })()]); cap(`…they’re giggling again.`); }
    },
    // a nap side by side
    async nap() {
      cap(`${gname} and ${hostName()} are napping together. Shh…`);
      await walkTo(hx() < maxX() / 2 ? hx() + pw * 0.9 : hx() - pw * 0.9, 90);
      row('sleep', true, 1.6); fx('💤'); await host('sleep', { ms: 4200 }); await wait(400); row('idle'); fx('♪'); cry(gb, { vol: 0.6 });
    },
  };
  (async () => {
    row('hop', false); fx('👋'); cry(gb); await wait(900);
    let next = Date.now() + 2500; let last = ''; let beaBooked = false;
    while (alive()) {
      if (asleep()) { row('sleep', true, 1.6); await wait(5000); continue; }
      // every few seconds they play something together; in between it potters about near its friend
      if (Date.now() > next) {
        // a visit booked for a set time (tables/<code>/beatriceAt, her ask 10-29 'show up at 3:16'): once per playdate, within 15 minutes of it
        const beaDue = () => { const t = num(store.get('beatriceAt')); if (beaBooked || !(t > 0 && Date.now() >= t && Date.now() - t < 15 * 60000)) return false; beaBooked = true; return true; };
        const pick = Object.keys(GAMES).filter((g) => g !== last && g !== 'beatrice'); last = last && last !== 'beatrice' && (Math.random() < 0.15 || /beatrice/.test(location.search) || beaDue()) ? 'beatrice' : pick[Math.floor(Math.random() * pick.length)];
        try { await GAMES[last](); } catch { /* the room was closed mid-game */ }
        next = Date.now() + 3000 + Math.random() * 3000; continue;
      }
      const r = Math.random();
      if (r < 0.5) await walkTo(hx() + (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 50));
      else if (r < 0.75) { row('hop', false); fx(Math.random() < 0.6 ? '💕' : '♪'); await wait(800); row('idle'); }
      else { row('nod', false); await wait(900); row('idle'); await wait(800); }
    }
  })();
}
function invite(c, box) {
  const list = hatched(c.id);
  if (!list.length) return toast('No other hatched babies yet. Eggs can’t visit!');
  const party = store.get('party') || {};
  const el = modal(`<h2>🏠 Invite a playdate</h2><p class="small muted">Pick a friend’s baby to come and play in your room for 20 minutes. It counts as play time for both of them!</p>
    <ul class="sentry-roster">${list.map(([id, x]) => `<li><img class="sface" src="${buddyFace(x)}" alt=""><span class="grow"><b>${esc(party[id].nickname)}’s ${esc(x.name ? `${x.name} (${BABIES[x.sp]?.name})` : BABIES[x.sp]?.name || 'buddy')}</b><br><span class="small muted">${STAGES[x.stage]}${visitingAt(id) ? ' · on a playdate right now' : ''}</span></span>
      <button class="btn sm" data-pd="${esc(id)}" ${visitingAt(id) ? 'disabled' : ''}>Invite</button></li>`).join('')}</ul>`);
  $$('[data-pd]', el).forEach((btn) => btn.onclick = () => {
    const gid = btn.dataset.pd; const gb = buddyOf(gid); const mine = buddyOf(c.id); if (!gb || !mine) return;
    store.set(`nursery/${c.id}/visit`, { id: gid, t: Date.now() });
    // a playdate is play time for both babies (the usual "all played out" rule still applies)
    act(c, 'play'); act({ id: gid, nickname: party[gid].nickname }, 'play');
    store.pushLimited('log', { t: Date.now(), text: `🏠 ${c.nickname}’s ${BABIES[mine.sp].name} and ${party[gid].nickname}’s ${BABIES[gb.sp].name} are having a playdate!` });
    gameSay('Beatrice', 'say', `${c.nickname}’s ${BABIES[mine.sp].name} invited ${party[gid].nickname}’s ${BABIES[gb.sp].name} over to play. Oh, they’re adorable together!`, 'nursery', c.nickname);
    closeModal(); room(c, box, 'playdate');
  });
}

function dressUp(c, box) {
  const b = buddyOf(c.id); if (!b) return;
  const have = Object.keys(b.acc || {}).filter((k) => ACC[k]); const wear = b.wear || {};
  const btn = (k) => `<button class="btn ${wear[ACC[k][2]] === k ? '' : 'alt'}" data-wear="${k}"><span class="big-emo ${ACC[k][3] === 'rainbow' ? 'rainbow' : ''}" style="${ACC[k][2] !== 'toy' && ACC[k][3] ? `filter:${accFilter(k)}` : ''}">${ACC[k][2] === 'bed' ? '🪺' : accIcon(k)}</span>${esc(ACC[k][1])}</button>`;
  const el = modal(`<h2>🎀 Dress up ${esc(nameOf(b))}</h2>${have.length ? `<p class="small muted">Tap to use it, tap again to put it away. One of each kind at a time.</p>
    ${SECTIONS.map(([title, slots]) => { const list = have.filter((k) => slots.includes(ACC[k][2])); return list.length ? `<h3 class="n-closet-h">${title}</h3><div class="n-closet">${list.map(btn).join('')}</div>` : ''; }).join('')}`
    : `<p>Nothing found yet! Take ${esc(nameOf(b))} for a <b>🦮 Walk</b> around Woodland Base and look for presents: accessories, umbrella patterns, toys and beds.</p>`}
    <p class="small muted">Found ${have.length} of ${Object.keys(ACC).length}.</p>`);
  $$('[data-wear]', el).forEach((btn) => btn.onclick = () => {
    const k = btn.dataset.wear; const slot = ACC[k][2];
    store.set(`nursery/${c.id}/wear/${slot}`, (buddyOf(c.id)?.wear || {})[slot] === k ? null : k);
    closeModal(); room(c, box); setTimeout(() => dressUp(c, box), 60);
  });
}
// pick up to 3 stops around Woodland Base (like drawing a route), then go
function walkPlan(c, box) {
  const b = buddyOf(c.id); const picked = [];
  const draw = () => {
    box.innerHTML = `<div class="walk-plan">${bea('happy', `A walk! Pick up to 3 places to visit, ${c.nickname}. Keep an eye out: little ones always sniff out presents.`)}
      <div class="walk-map">${WALK_SPOTS.map(([k, ic, name]) => `<button class="walk-spot ${picked.includes(k) ? 'on' : ''}" data-spot="${k}"><span class="big-emo">${ic}</span>${esc(name)}${picked.includes(k) ? `<b class="walk-n">${picked.indexOf(k) + 1}</b>` : ''}</button>`).join('')}</div>
      <div class="row" style="gap:8px;justify-content:center"><button class="btn" id="wgo" ${picked.length ? '' : 'disabled'}>🦮 Start the walk${picked.length ? ` (${picked.length} stop${picked.length === 1 ? '' : 's'})` : ''}</button><button class="btn alt" id="wback">Not now</button></div></div>`;
    $$('[data-spot]', box).forEach((btn) => btn.onclick = () => { const k = btn.dataset.spot; const i = picked.indexOf(k); if (i >= 0) picked.splice(i, 1); else if (picked.length < 3) picked.push(k); else toast('Three stops is plenty for little legs!'); draw(); });
    $('#wgo', box).onclick = () => walkGo(c, box, picked.map((k) => WALK_SPOTS.find((x) => x[0] === k)));
    $('#wback', box).onclick = () => room(c, box);
  };
  draw();
}
async function walkGo(c, box, stops) {
  const b = buddyOf(c.id); const B = BABIES[b.sp]; if (!B) return room(c, box);
  const S = Math.min(SIZE[b.stage] || 3, 2.6); const pw = Math.round(B.cw * S); const ph = Math.round(B.ch * S);
  box.innerHTML = `<div class="walk"><div class="walk-scene tod-${tod()}"><div class="n-sky" aria-hidden="true"><i></i><i></i><i></i></div><div class="walk-ground"></div>${wxFxHTML(wx().key)}<div class="walk-sign" id="wsign"></div>
      <div class="walk-pet" id="wpet" style="width:${pw}px;bottom:${Math.round(40 - ph / 2)}px"><span class="baby-spr" style="width:${pw}px;height:${ph}px;background-image:url(assets/nursery/${b.sp}.png);background-size:${pw * 10}px ${ph * 7}px">${accHTML(b, pw, ph)}</span></div>
      <div class="walk-gift" id="wgift"></div><div class="walk-host" id="whost"></div></div><div class="walk-text" id="wtext"></div></div>`;
  const scene = $('.walk-scene', box); const spr = $('.baby-spr', box); const text = $('#wtext', box); const sign = $('#wsign', box); const gift = $('#wgift', box);
  const row = (name, loop = true) => { const r = ROW[name]; const n = B.fr[r] || 1; spr.style.backgroundPositionY = `-${r * ph}px`; spr.style.setProperty('--fw', pw + 'px'); spr.style.setProperty('--n', n);
    spr.style.animation = 'none'; void spr.offsetWidth; spr.style.animation = `baby-anim ${Math.max(0.4, n * 0.12)}s steps(${n}, jump-none) ${loop ? 'infinite' : '1 forwards'}`; accRow(spr, b.sp, name, ph); };
  const alive = () => scene.isConnected;
  const say = (html) => { text.innerHTML = html; };
  const walking = async (ms) => { row('right'); scene.classList.add('moving'); await wait(ms); scene.classList.remove('moving'); row('idle'); };
  // her ask 10-29: your own character walks along behind the baby
  const fz = import('./fzscene.js?v=6ae3efa5').catch(() => null);
  if (c.pokemon) fz.then((m) => m?.walkSprite(c.pokemon, 2)).then((w) => {
    if (!w || !alive()) return;
    scene.insertAdjacentHTML('beforeend', `<div class="walk-char" title="${esc(c.nickname)}">${w.html}</div>`);
  }).catch(() => {});
  // ...and the Pokémon you're visiting waits at each stop, facing you (her ask 10-29)
  const hosts = Object.fromEntries(stops.map(([k, , , who]) => [k, fz.then((m) => m?.walkSprite(WALK_SPECIES[who] || who, 2, 'left', true)).catch(() => null)]));
  const host = $('#whost', box);
  const found = []; const owned = { ...(b.acc || {}) };
  say(`Off you go! ${esc(nameOf(b))} trots out of Fernshade Camp…`); cry(b);
  for (const [k, ic, name, who, lines] of stops) {
    await walking(2600); if (!alive()) return;
    sign.innerHTML = `${ic} ${esc(name)}`; sign.classList.add('show');
    const hw = await Promise.race([hosts[k], wait(1500)]); if (hw && alive()) { host.innerHTML = hw.html; host.classList.add('show'); }
    const face = RESIDENTS[who]?.img;
    say(`${face ? `<img class="sface" src="${face}" alt="">` : ''}<span><b>${esc(who)}:</b> “${esc(lines[Math.floor(Math.random() * lines.length)])}”</span>`);
    row('hop', false); await wait(1900); if (!alive()) return;
    // a present? (most stops have one; the first walk of the day always finds something)
    if (Math.random() < 0.65 || (!found.length && k === stops[stops.length - 1][0] && !num(b.walkAt))) {
      const left = Object.keys(ACC).filter((x) => !owned[x]);
      const prize = left.length ? left[Math.floor(Math.random() * left.length)] : null;
      gift.innerHTML = '<button class="walk-box" aria-label="Open the present">🎁</button>'; gift.classList.add('show');
      say(`${esc(nameOf(b))} sniffed something out! Tap the present!`); row('nod', true);
      await Promise.race([wait(6000), new Promise((ok) => { $('.walk-box', gift).onclick = ok; })]); if (!alive()) return;
      if (prize) { owned[prize] = true; found.push(prize); gift.innerHTML = `<span class="walk-prize ${ACC[prize][3] === 'rainbow' ? 'rainbow' : ''}" style="${ACC[prize][2] !== 'toy' && ACC[prize][3] ? `filter:${accFilter(prize)}` : ''}">${ACC[prize][2] === 'bed' ? '🪺' : accIcon(prize)}</span>`; say(`🎉 It’s a <b>${esc(ACC[prize][1])}</b>! ${esc(nameOf(b))} looks very proud.${ACC[prize][2] === 'toy' ? ' A new toy to play with!' : ACC[prize][2] === 'bed' ? ' A comfy new bed!' : ACC[prize][2] === 'umbrella' ? ' A new umbrella for rainy days!' : ''}`); cry(b, { vol: 0.8 }); }
      else { const poke = 10 + Math.floor(Math.random() * 11); found.push(poke); gift.innerHTML = '<span class="walk-prize">🪙</span>'; say(`🎉 ${poke} Poké! (${esc(nameOf(b))} already has every accessory.)`); store.update('party/' + c.id, (x) => ({ ...x, poke: num(x?.poke) + poke })); }
      row('hop', false); await wait(2200); gift.classList.remove('show'); gift.innerHTML = '';
    }
    sign.classList.remove('show'); host.classList.remove('show');
  }
  await walking(2000); if (!alive()) return;
  // home again: it counts as play time, raises Bond, and the walk needs a rest before the next one
  store.update('nursery/' + c.id, (x) => (x ? { ...x, acc: owned, walkAt: Date.now(), bond: Math.min(100, num(x.bond) + 10) } : x));
  act(c, 'play');
  const accs = found.filter((x) => typeof x === 'string');
  store.pushLimited('log', { t: Date.now(), text: `🦮 ${c.nickname} took ${nameOf(b)} for a walk around Woodland Base${accs.length ? ` and found: ${listOf(accs.map((x) => ACC[x][1]))}` : ''}!` });
  box.innerHTML = `<div class="sentry-end">${bea('happy', `Welcome back! ${nameOf(b)} looks so happy${accs.length ? `, and look what you found: ${listOf(accs.map((x) => ACC[x][1]))}!` : '.'}`)}
    ${accs.length ? `<p class="walk-haul">${accs.map((x) => `<span>${accIcon(x)}<small>${esc(ACC[x][1])}</small></span>`).join('')}</p>` : ''}
    <p class="small muted" style="text-align:center">❤️ Bond went up · 🎈 counts as play time</p>
    <div class="row" style="gap:8px;justify-content:center">${accs.length ? '<button class="btn" id="wdress">🎀 Try it on</button>' : ''}<button class="btn alt" id="whome">Back to the nursery</button></div></div>`;
  $('#whome', box).onclick = () => room(c, box);
  const wd = $('#wdress', box); if (wd) wd.onclick = () => { room(c, box); dressUp(c, box); };
}

function room(c, box, anim) {
  const b = buddyOf(c.id);
  if (!b) {
    box.innerHTML = `<div class="sentry-start">${bea('happy', `Oh, ${c.nickname}, dear! The nursery has more eggs than I have arms. Would you look after one for me? Keep it warm, and once it hatches, feed it, play with it and give it baths. Raise it to a teen, and maybe it’ll want to join your team!`)}
      <div class="nursery-room tod-${tod()}"><div class="n-sky" aria-hidden="true"><i></i><i></i><i></i></div>${wxFxHTML(wx().key)}${nestHTML(eggHTML({ sp: '' }))}</div><button class="btn block" id="nadopt">Take an egg home 🥚</button></div>`;
    $('#nadopt', box).onclick = () => { adopt(c); room(c, box, 'new'); };
    return;
  }
  const B = BABIES[b.sp]; const egg = b.stage === 0; const needs = needsOf(b); const day = todayOf(b);
  const v = egg ? null : visitOf(b); const guest = v && buddyOf(v.id); const away = egg ? null : visitingAt(c.id); const party = store.get('party') || {};
  const cared = caredToday(b); const left = b.stage < 3 ? DAYS_TO_GROW[b.stage] - num(b.grown) : 0;
  const low = Object.keys(needs).filter((k) => k !== 'cover' && stat(b, k) < 30); const cv = coverNeed(b) && stat(b, 'cover') < 50 ? COVER[wx().key] : null;
  const line = b.recruited ? `${B.name} is part of your team now. I’m so proud of you both!`
    : b.stage === 3 ? `Look how big ${nameOf(b)} has grown! I think ${B.name} would follow you anywhere. Why not ask?`
    : anim === 'playdate' ? 'A playdate! Play nicely, you two. I’ll bring snacks!'
    : anim === 'grew' ? (b.stage === 1 ? `It hatched! Say hello to your ${B.name}, ${c.nickname}!` : `${nameOf(b)} is a ${STAGES[b.stage].toLowerCase()} now!`)
    : cv ? `${cv[3]} Quick, ${nameOf(b)} wants ${cv[4]}!`
    : low.length ? `${nameOf(b)} needs you: ${low.map((k) => LABEL[k][1].toLowerCase()).join(' and ')} is low!`
    : cared ? `All done for today. ${nameOf(b)} is happy and growing!` : egg ? 'Keep it warm, three times a day. I can hear it wiggling!' : 'Feed, play and bath time. A little every day!';
  box.innerHTML = `<div class="nursery">
    ${bea(b.recruited || b.stage === 3 ? 'proud' : low.length || cv ? 'worry' : 'happy', line)}
    <div class="nursery-room tod-${tod()} ${egg ? 'is-egg' : ''}"><div class="n-sky" aria-hidden="true"><i></i><i></i><i></i></div>${wxFxHTML(wx().key)}
      ${egg ? nestHTML(eggHTML(b, anim === 'warm' ? 'wiggle' : '')) : `<div class="nest-spot" style="${b.wear?.bed && ACC[b.wear.bed] ? `filter:${accFilter(b.wear.bed)}` : ''}">${nestHTML('')}</div>${petHTML()}${guest ? '<div class="pet guest" id="ngpet"><span class="pet-tag"></span><span class="baby-spr"></span></div>' : ''}`}
      ${anim === 'grew' ? '<span class="n-burst">✨</span>' : ''}${egg && anim === 'warm' ? '<span class="n-fx">🔥</span>' : ''}
    </div>
    <div class="n-head">${egg ? '' : `<img class="sface" src="${buddyFace(b)}" alt="">`}<div class="grow"><b>${esc(b.name || (egg ? 'Mystery egg' : B.name))}</b> <span class="pill">${STAGES[b.stage]}</span>
      <div class="small muted">${b.stage < 3 ? `${left} more cared-for day${left === 1 ? '' : 's'} to grow` : b.recruited ? 'On your team' : 'Ready to join a team!'}</div></div>
      ${egg ? '' : '<button class="btn alt sm" id="nname">Name</button>'}</div>
    <div class="n-stats">${Object.keys(needs).map((k) => { const v = stat(b, k); return `<div class="n-stat"><span>${lab(k)[0]} ${lab(k)[1]}</span><div class="n-bar ${v < 30 ? 'low' : ''}"><i style="width:${v}%"></i></div><span class="small muted">${k === 'cover' ? (v ? 'safe now' : 'needed now') : `${Math.min(num(day[k]), needs[k])}/${needs[k]} today`}</span></div>`; }).join('')}</div>
    ${egg ? '' : `<div class="n-bond"><span>❤️ Bond</span><span class="n-hearts">${'❤️'.repeat(hearts(b))}${'🤍'.repeat(5 - hearts(b))}</span><span class="small muted">${hearts(b) >= 5 ? 'Best friends!' : 'Pet, walk and care to grow it'}</span></div>
      <div class="n-fun"><button class="btn" id="nwalk">🦮 Walk</button><button class="btn alt" id="ncall">📣 Call ${esc(nameOf(b))}</button><button class="btn alt" id="ndress">🎀 Dress up</button></div>
      <p class="small muted" style="text-align:center;margin:2px 0 6px">Tip: hold and rub ${esc(nameOf(b))} to pet it.</p>`}
    ${b.recruited ? '<button class="btn alt block" id="nnew">Take a new egg home 🥚</button>' : b.stage === 3 ? `<p class="small" style="text-align:center;margin:4px 0">${esc(nameOf(b))} is all grown up. What will you do?</p><div class="n-choice"><button class="btn" id="nrecruit">🤝 Ask ${esc(nameOf(b))} to join the team</button><button class="btn alt" id="nwild">🌿 Let ${esc(nameOf(b))} go into the wild</button></div>`
      : `<div class="n-acts">${Object.keys(needs).map((k) => `<button class="btn ${(k === 'cover' ? stat(b, k) : num(day[k]) >= needs[k]) ? 'alt' : ''}" data-nact="${k}">${lab(k)[0]} ${lab(k)[2]}</button>`).join('')}</div>`}
    ${cared && b.stage < 3 ? '<p class="small" style="text-align:center;color:#2f6d2b">✅ Fully cared for today</p>' : ''}
    ${egg ? '' : guest ? `<p class="n-visit">🏠 ${esc(party[v.id]?.nickname || 'A friend')}’s ${esc(guest.name || BABIES[guest.sp]?.name)} is visiting! <button class="btn alt sm" id="nhome">Say goodbye</button></p>`
      : `<p class="n-visit">${away ? `🏠 ${esc(nameOf(b))} has been invited over to ${esc(party[away]?.nickname || 'a friend')}’s room for a playdate!` : ''}<button class="btn alt sm" id="nvisit">🏠 Invite a playdate</button></p>`}</div>`;
  // her ask 10-29: on a computer the care buttons sit in a column right beside the room, so no scrolling to reach them
  const acts = $('.n-acts', box); const rm = $('.nursery-room', box);
  if (acts && rm && matchMedia('(min-width: 900px)').matches) { const w = document.createElement('div'); w.className = 'n-wide'; rm.before(w); w.append(rm, acts); }
  if (!egg) startPet(box, b, anim, c.id);
  if (!egg) { cryOf(b.sp); if (guest) cryOf(guest.sp); }
  if (guest) startGuest(box, guest, `${party[v.id]?.nickname || 'Friend'}’s ${guest.name || BABIES[guest.sp]?.name}`);
  const iv = $('#nvisit', box); if (iv) iv.onclick = () => invite(c, box);
  const cl = $('#ncall', box); if (cl) cl.onclick = () => $('#npet', box)?.dispatchEvent(new Event('call'));
  const dr = $('#ndress', box); if (dr) dr.onclick = () => dressUp(c, box);
  const wk = $('#nwalk', box); if (wk) wk.onclick = () => {
    const bb = buddyOf(c.id); const rest = WALK_REST - (Date.now() - num(bb?.walkAt));
    if (asleep()) return toast(`${nameOf(bb)} is asleep. Walks start again in the morning!`);
    if (rest > 0) return toast(`${nameOf(bb)} is still tired from the last walk. Try again in ${Math.ceil(rest / 60e3)} min.`);
    walkPlan(c, box);
  };
  const hm = $('#nhome', box); if (hm) hm.onclick = () => { store.set(`nursery/${c.id}/visit`, null); room(c, box); };
  $$('[data-nact]', box).forEach((btn) => btn.onclick = () => {
    const k = btn.dataset.nact; const r = act(c, k);
    // her ask 10-29: feeding or playing when it isn't time still happens; the baby just isn't interested
    if (r !== 'ok' && r !== 'grew') { toast(r); if (k === 'feed' || k === 'play') room(c, box, k + 'Meh'); return; }
    room(c, box, r === 'grew' ? 'grew' : k === 'warm' ? 'warm' : k);
  });
  const nm = $('#nname', box); if (nm) nm.onclick = () => { const v = prompt(`Name your ${B.name}:`, b.name || ''); if (v != null) { store.set(`nursery/${c.id}/name`, v.trim().slice(0, 24) || null); room(c, box); } };
  const rc = $('#nrecruit', box); if (rc) rc.onclick = () => {
    store.set(`nursery/${c.id}/recruited`, Date.now());
    gmTodo(`${c.nickname}’s nursery ${B.name}${b.name ? ` “${b.name}”` : ''} grew up and wants to join the team: play out the recruit`, 'nursery');
    store.pushLimited('log', { t: Date.now(), text: `${c.nickname} asked their nursery ${B.name} to join the team!` });
    gameSay('Beatrice', 'say', `${c.nickname} raised that ${B.name} from an egg, and now it wants to join their team. I might cry!`, 'nursery', c.nickname);
    markWinner(c.id); room(c, box, 'grew');
  };
  // her ask 10-27: a grown teen can also be set free; then the nursery has room for a new egg
  const wild = $('#nwild', box); if (wild) wild.onclick = () => {
    if (!confirm(`Let ${nameOf(b)} go into the wild? You can take a new egg home afterwards.`)) return;
    store.pushLimited('log', { t: Date.now(), text: `${c.nickname} let their nursery ${B.name}${b.name ? ` “${b.name}”` : ''} go into the wild.` });
    gameSay('Beatrice', 'say', `${c.nickname}’s ${B.name} flew the nest today, off to explore the wild. Safe travels, little one!`, 'nursery', c.nickname);
    logRoll(c.nickname, 'Fernshade Nursery', null, `let ${B.name} go into the wild`, 'note');
    store.set('nursery/' + c.id, null);
    box.innerHTML = `<div class="sentry-end">${bea('happy', `${nameOf(b)} looked back once, then ran off into the trees. You raised it well, ${c.nickname}. Whenever you’re ready, there’s another egg waiting.`)}<button class="btn block" id="nagain">Visit the nursery again</button></div>`;
    $('#nagain', box).onclick = () => room(c, box);
  };
  const nn = $('#nnew', box); if (nn) nn.onclick = () => { if (confirm(`${nameOf(b)} stays on your team. Take a new egg home to raise?`)) { adopt(c); room(c, box, 'new'); } };
}

function visit(who, b) {
  const [want, text] = feeling(b); const sleeping = asleep();
  const sym = sleeping ? 'z Z' : /Joyous|Happy|Inspired/.test(want[0]) ? '♥' : /Crying|Teary/.test(want[0]) ? '…' : /Sad|Worried/.test(want[0]) ? '?' : '♪';
  const el = modal(`<h2>${esc(who?.nickname || 'A friend')}’s ${esc(nameOf(b))}</h2><div class="nvisit"><div class="emo-pane yf" role="status"><div class="yf-pic"><span class="yf-sym ${sym === '♥' ? 'heart' : ''}">${sym}</span><img src="${faceOf(b, want)}" alt=""></div><p>${esc(text)}</p></div></div>`);
  $('.emo-pane', el).onclick = () => closeModal();
}
export function renderNursery(main, g, gm, onEdit) {
  const c = me();
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a>${gm ? '<button class="btn alt sm" id="ed">Edit</button>' : ''}</div>
    <h1 style="margin:10px 0 4px">${esc(g.name)}</h1>
    <p>${esc(g.intro || '')}</p>
    <p><span class="pill">🥚 Egg → Baby → Kid → Teen</span> <span class="pill">📅 A little care every day</span> <span class="pill">🤝 Teens can join your team</span></p>
    <p class="small muted" style="text-align:right;margin:0 0 4px"><button class="btn alt sm" id="ncries"></button> <button class="btn alt sm" id="nmusic"></button></p>
    <div class="card sentry"><div id="nbox"></div></div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">The nursery</h3><ul class="sentry-roster" id="nlist"></ul></div>`;
  const party = store.get('party') || {};
  const list = () => {
    $('#nlist', main).innerHTML = Object.entries(store.get('nursery') || {}).map(([id, b]) => { const who = party[id]; if (!who || !b) return '';
      return `<li>${b.stage === 0 ? eggHTML(b, 'mini') : `<button class="nvisit-btn" data-nvisit="${esc(id)}" title="See how they feel" aria-label="See how ${esc(nameOf(b))} feels"><img class="sface" src="${buddyFace(b)}" alt=""></button>`}<span class="grow">${esc(who.nickname)}’s ${esc(b.stage === 0 ? 'egg' : (b.name ? `${b.name} (${BABIES[b.sp]?.name})` : BABIES[b.sp]?.name || 'buddy'))}<br><span class="small muted">${STAGES[b.stage]}${b.recruited ? ' · on the team' : caredToday(b) ? ' · cared for today' : ''}${visitOf(b) ? ` · 🏠 ${esc(party[visitOf(b).id]?.nickname || 'a friend')}’s buddy is visiting` : ''}</span></span>
        ${gm ? `<button class="btn alt sm" data-nup="${esc(id)}">Grow</button><button class="btn alt sm" data-nreset="${esc(id)}">Reset</button>` : ''}</li>`; }).join('') || '<li class="muted">No eggs taken home yet.</li>';
    // her ask 10-29: tapping a friend's buddy shows its feelings window, just like tapping your own
    $$('[data-nvisit]', main).forEach((x) => x.onclick = () => { const bb = buddyOf(x.dataset.nvisit); if (!bb) return; visit(party[x.dataset.nvisit], bb); });
    $$('[data-nup]', main).forEach((x) => x.onclick = () => { const b = buddyOf(x.dataset.nup); if (b && b.stage < 3) store.set(`nursery/${x.dataset.nup}`, { ...b, stage: b.stage + 1, grown: 0 }); renderNursery(main, g, gm, onEdit); });
    $$('[data-nreset]', main).forEach((x) => x.onclick = () => { if (confirm('Give this buddy back to the nursery? They can take a new egg.')) { store.set('nursery/' + x.dataset.nreset, null); renderNursery(main, g, gm, onEdit); } });
  };
  list();
  const box = $('#nbox', main);
  if (!c) box.innerHTML = '<p>Pick your character first (Play tab), then visit Beatrice.</p>';
  else room(c, box);
  const e = $('#ed', main); if (e) e.onclick = onEdit;
  // her ask 10-29: on rainy days the lullaby has rain falling under it (a typhoon pours harder)
  pageMusic(main, 'musicbox', 'nmusic', { rain: wx().key === 'typhoon' ? 'heavy' : wx().key === 'rain' ? 'light' : '' });
  const cb = $('#ncries', main); const cbText = () => { cb.textContent = criesOff() ? '🔇 Cries off' : '🐣 Cries on'; };
  cbText(); cb.onclick = () => { try { localStorage.setItem('dc.cries', criesOff() ? 'on' : 'off'); } catch { /* fine */ } cbText(); };
}

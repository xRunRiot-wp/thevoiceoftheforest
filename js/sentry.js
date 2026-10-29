// Sentry Duty (from Explorers of Time/Sky): stand watch at the Woodland Base gate with Diglett and name each visitor
// from their footprint. A daily guild chore every character is expected to do, not a gamble: an okay shift is just
// doing your duty, a great shift pays Poké and can turn up a rare item. One shift per character per day.
import * as store from './store.js?v=6ae3dc78';
import { $, $$, esc, toast, num, uid } from './util.js?v=6ae3dc78';
import { me, logRoll } from './play.js?v=6ae3dc78';
import { dailyRoll } from './weather.js?v=6ae3dc78';
import { gameSay } from './chatter.js?v=6ae3dc78';
import { markWinner } from './sparkle.js?v=6ae3dc78';
import * as sheet from './sheetdata.js?v=6ae3dc78';
import { portraitFile, formArt } from './ui.js?v=6ae3dc78';
import { pageMusic } from './chiptune.js?v=6ae3dc78';

export const isSentry = (g) => g.kind === 'sentry' || g.id === 'sentry-duty';

// footprints: the main-series Pokédex footprints (same shapes Sentry Duty uses), one 16px tile each in assets/ui/footprints.png
const PRINTS = ['Bulbasaur', 'Charmander', 'Squirtle', 'Pidgey', 'Rattata', 'Pikachu', 'Oddish', 'Poliwag', 'Abra', 'Bellsprout', 'Eevee', 'Chikorita', 'Cyndaquil', 'Totodile', 'Sentret', 'Hoothoot', 'Ledyba', 'Pichu', 'Togepi', 'Mareep', 'Marill', 'Hoppip', 'Aipom', 'Wooper', 'Snubbull', 'Teddiursa', 'Swinub', 'Phanpy', 'Treecko', 'Torchic', 'Mudkip', 'Poochyena', 'Zigzagoon', 'Lotad', 'Seedot', 'Taillow', 'Wingull', 'Surskit', 'Shroomish', 'Slakoth', 'Nincada', 'Whismur', 'Azurill', 'Skitty', 'Aron', 'Plusle', 'Roselia', 'Numel', 'Trapinch', 'Swablu', 'Zangoose', 'Corphish', 'Kecleon', 'Absol', 'Wynaut', 'Turtwig', 'Chimchar', 'Piplup', 'Starly', 'Bidoof', 'Kricketot', 'Shinx', 'Budew', 'Pachirisu', 'Buizel', 'Shellos', 'Buneary', 'Glameow', 'Chingling', 'Stunky', 'Bonsly', 'Mime Jr.', 'Happiny', 'Chatot', 'Gible', 'Munchlax', 'Riolu', 'Hippopotas', 'Croagunk'];
const ROUNDS = 8; const SECONDS = 12;
// shift grades: [lowest score, name, Poké, rare-item chance, what Diglett says, mood]
const GRADES = [
  [8, 'Great job!', 300, 0.5, 'Every single one! The whole base is safer thanks to you!', 'great'],
  [7, 'Good job', 100, 0, 'Nice work! Just one slipped past.', 'good'],
  [5, 'Duty done', 0, 0, 'Shift done. That’s what the guild expects. Thanks!', 'duty'],
  [0, 'Sloppy shift', 0, 0, 'Hmm… a few strangers walked right in. Let’s do better tomorrow.', 'sloppy'],
];
const moodOf = (grade) => (GRADES.find((x) => x[1] === grade) || [])[5] || 'wait';

// Faces (her ask 10-27): Explorers-style emotion portraits from PMDCollab, assets/portraits/emo/<species>/<Emotion>.png.
// Diglett reacts to every footprint; each character's face shows how their shift went.
const FULL = ['Normal', 'Happy', 'Joyous', 'Inspired', 'Determined', 'Sad', 'Teary-Eyed', 'Sigh', 'Worried', 'Surprised', 'Dizzy', 'Stunned', 'Pain', 'Angry', 'Shouting'];
const EMO = { spinda: FULL, ralts: FULL, diglett: FULL, sudowoodo: FULL, swablu: FULL, magnemite: FULL, cleffa: FULL, golett: FULL, tinkatink: FULL, jangmoo: FULL, slakoth: ['Normal', 'Happy', 'Inspired', 'Sad', 'Sigh'], cottonee: ['Normal'], cottoneeshiny: ['Normal'], squirtle: FULL, golettclay: FULL };
const MOODS = { great: ['Joyous', 'Inspired', 'Happy'], good: ['Happy', 'Joyous'], duty: ['Determined', 'Normal'], sloppy: ['Sad', 'Teary-Eyed', 'Sigh', 'Worried'],
  hit: ['Happy', 'Joyous'], miss: ['Surprised', 'Worried', 'Sad'], slow: ['Dizzy', 'Stunned', 'Sigh'], wait: ['Normal'] };
const DIG = { great: ['Inspired', 'Joyous'], good: ['Happy'], duty: ['Normal'], sloppy: ['Sigh', 'Sad'], hit: ['Joyous', 'Happy'], miss: ['Shouting', 'Angry'], slow: ['Teary-Eyed', 'Sad'], wait: ['Normal'] };
export const spKey = (c) => { const fa = formArt(c); if (fa && EMO[fa]) return fa; const k = String(c?.species || c?.pokemon || '').toLowerCase().replace(/[^a-z]/g, ''); return c?.shiny && EMO[k + 'shiny'] ? k + 'shiny' : k; };
export function faceSrc(sp, mood, moods = MOODS) {
  const have = EMO[sp]; if (!have) return portraitFile(sp);
  return `assets/portraits/emo/${sp}/${(moods[mood] || []).find((e) => have.includes(e)) || 'Normal'}.png`;
}
export const faceHTML = (c, mood, cls = '') => { const f = faceSrc(spKey(c), mood); return f ? `<img class="sface ${cls}" src="${f}" alt="${esc(c.nickname)}">` : `<span class="sface ph ${cls}">${esc((c.nickname || '?')[0])}</span>`; };
const digHTML = (mood, line) => `<div class="sentry-digg"><img class="sface dig" src="${faceSrc('diglett', mood, DIG)}" alt="Diglett"><div class="bubble"><b>Diglett:</b> “${esc(line)}”</div></div>`;
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const HIT = ['Right! It’s {p}! Come on in!', 'Yup yup! That’s {p}! Good eye!', '{p}! Correct! Next visitor!', 'That’s {p}, all right! Welcome to Woodland Base!', 'Correct! {p} may pass!'];
const MISS = ['Wrong! Wrong! That was {p}!', 'Nooo! That footprint was {p}!', 'Huh?! No, no, that was {p}!', 'That’s not it! It was {p}!'];
const SLOW = ['Too slow! {p} already walked in!', 'Hey! Say something! That was {p}!', '…Hello? {p} just strolled right past!'];
const STREAK = ['', '', '', 'Three in a row!', 'Four in a row! You’re on fire!', 'Five! Amazing!', 'Six in a row?! Wow!', 'Seven! Don’t stop now!', 'EIGHT! PERFECT!'];
const gradeOf = (score) => GRADES.find(([min]) => score >= min);
const today = () => dailyRoll().day;
const shift = (id) => store.get('sentry/' + id) || {};
export const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const printHTML = (i, size = 128) => `<div class="fp" role="img" aria-label="A footprint" style="width:${size}px;height:${size}px;background-size:${PRINTS.length * size}px ${size}px;background-position:-${i * size}px 0"></div>`;
// Games list: a banner across the card until this device's character has done today's shift (her ask 10-27)
export const sentryDue = () => { const c = me(); return !!c && shift(c.id).day !== today(); };
export const sentryMini = () => `<div class="sentry-mini">${[5, 49, 59].map((i) => printHTML(i, 64)).join('')}</div>`;

export async function rareItem() {
  const t = await sheet.treasure().catch(() => []);
  const rare = t.filter((x) => /^rare/i.test(x.rarity));
  return rare.length ? rare[Math.floor(Math.random() * rare.length)].name : '';
}

function finish(c, score, box, onDone) {
  const [, name, poke, chance, line] = gradeOf(score);
  store.set('sentry/' + c.id, { day: today(), score, grade: name, t: Date.now(), shifts: num(shift(c.id).shifts) + 1 });
  const done = (item) => {
    if (poke) store.update('party/' + c.id, (x) => ({ ...x, poke: num(x?.poke) + poke }));
    if (item) store.set('bag/' + uid(), { name: item, qty: 1, owner: c.id });
    if (poke || item) markWinner(c.id);
    const reward = [poke ? `${poke} Poké` : '', item ? `a rare ${item}` : ''].filter(Boolean).join(' and ');
    logRoll(c.nickname, 'Sentry Duty', null, `${score}/${ROUNDS} footprints · ${name}${reward ? ' · ' + reward : ''}`, 'note');
    if (score === ROUNDS) gameSay('Diglett', 'say', `${c.nickname} named every visitor at the gate today! Woodland Base is safer for it.`, 'sentry', c.nickname);
    const mood = gradeOf(score)[5];
    box.innerHTML = `<div class="sentry-end">${faceHTML(c, mood, 'big')}<div class="big">${esc(name)}</div><p>${score} of ${ROUNDS} footprints right.</p>
      ${digHTML(mood, line)}
      ${reward ? `<p class="pill">🎁 ${esc(reward)}</p>` : ''}<p class="small muted">Next shift tomorrow.</p></div>`;
    onDone?.();
  };
  if (chance && Math.random() < chance) rareItem().then(done); else done('');
}

function play(c, box, onDone) {
  const visitors = shuffle([...PRINTS.keys()]).slice(0, ROUNDS);
  let n = 0; let score = 0; let timer = 0; let streak = 0;
  const round = () => {
    if (n >= ROUNDS) { finish(c, score, box, onDone); return; }
    const v = visitors[n];
    const choices = shuffle([v, ...shuffle([...PRINTS.keys()].filter((i) => i !== v)).slice(0, 3)]);
    box.innerHTML = `<div class="sentry-round"><div class="sentry-top">${faceHTML(c, 'wait', 'me')}<span class="small muted">${esc(c.nickname)} · visitor ${n + 1} of ${ROUNDS} · ${score} right</span></div>
      <div class="sentry-react">${digHTML('wait', 'Footprint! Footprint! Whose footprint is it?!')}</div>
      <div class="sentry-sand">${printHTML(v)}<span class="digsprite" aria-hidden="true"></span></div><div class="sentry-time"><i></i></div>
      <div class="sentry-choices">${choices.map((i) => `<button class="btn alt" data-fp="${i}">${esc(PRINTS[i])}</button>`).join('')}</div>
      </div>`;
    const bar = $('.sentry-time i', box); const t0 = Date.now();
    const answer = (pick) => {
      clearInterval(timer);
      const ok = pick === v; if (ok) { score++; streak++; } else streak = 0;
      const kind = ok ? 'hit' : pick == null ? 'slow' : 'miss';
      const line = pickOne(ok ? HIT : pick == null ? SLOW : MISS).replace('{p}', PRINTS[v]) + (ok && STREAK[streak] ? ' ' + STREAK[streak] : '');
      $('.sentry-react', box).innerHTML = digHTML(kind, line);
      const mine = $('.sface.me', box); const f = faceSrc(spKey(c), kind); if (f && mine?.tagName === 'IMG') mine.src = f;
      $('.digsprite', box).className = 'digsprite ' + kind;
      // her ask 10-27: as the answer is revealed, show the Pokémon the footprint belongs to
      $('.sentry-sand', box).insertAdjacentHTML('beforeend', `<figure class="fp-reveal ${kind}"><img src="assets/portraits/fp/${v}.png" alt=""><figcaption>${esc(PRINTS[v])}</figcaption></figure>`);
      $$('[data-fp]', box).forEach((b) => { b.disabled = true; if (+b.dataset.fp === v) b.classList.add('right'); else if (+b.dataset.fp === pick) b.classList.add('wrong'); });
      n++; setTimeout(round, 2200);
    };
    timer = setInterval(() => {
      if (!box.isConnected) { clearInterval(timer); return; }
      const left = 1 - (Date.now() - t0) / (SECONDS * 1000);
      bar.style.width = Math.max(0, left * 100) + '%';
      if (left <= 0) answer(null);
    }, 100);
    $$('[data-fp]', box).forEach((b) => b.onclick = () => answer(+b.dataset.fp));
  };
  round();
}

export function renderSentry(main, g, gm, onEdit) {
  const c = me();
  const party = Object.values(store.get('party') || {}).filter((x) => !x.guest);
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a>${gm ? '<button class="btn alt sm" id="ed">Edit</button>' : ''}</div>
    <h1 style="margin:10px 0 4px">${esc(g.name)}</h1>
    <p>${esc(g.intro || '')}</p>
    <p><span class="pill">📋 Guild chore</span> <span class="pill">📅 One shift a day</span> <span class="pill">🌟 Great job: ${GRADES[0][2]} Poké + a chance at a rare item</span></p>
    <p class="small muted" style="text-align:right;margin:0 0 4px"><button class="btn alt sm" id="smusic"></button></p>
    <div class="card sentry"><div id="sentrybox"></div></div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Today’s gate roster</h3><ul class="sentry-roster" id="sroster"></ul></div>`;
  pageMusic(main, 'march', 'smusic');
  const roster = () => {
    $('#sroster', main).innerHTML = party.map((x) => { const s = shift(x.id); const on = s.day === today();
      return `<li>${faceHTML(x, on ? moodOf(s.grade) : 'wait')}<span class="grow">${esc(x.nickname)}<br><span class="small">${on ? `<b>${esc(s.grade)}</b> <span class="muted">${s.score}/${ROUNDS}</span>` : '<span class="muted">not yet</span>'}<span class="muted"> · ${num(s.shifts)} shift${num(s.shifts) === 1 ? '' : 's'}</span></span></span>${gm && on ? ` <button class="btn alt sm" data-sreset="${esc(x.id)}">Redo</button>` : ''}</li>`; }).join('') || '<li class="muted">No characters yet.</li>';
    $$('[data-sreset]', main).forEach((b) => b.onclick = () => { store.set(`sentry/${b.dataset.sreset}/day`, null); toast('They can do today’s shift again'); renderSentry(main, g, gm, onEdit); });
  };
  roster();
  const box = $('#sentrybox', main);
  if (!c) box.innerHTML = '<p>Pick your character first (Play tab), then come take your shift.</p>';
  else if (shift(c.id).day === today()) { const s = shift(c.id); box.innerHTML = `<div class="sentry-end">${faceHTML(c, moodOf(s.grade), 'big')}<div class="big">${esc(s.grade)}</div><p>${esc(c.nickname)} already stood watch today: ${s.score} of ${ROUNDS} right.</p><p class="small muted">Next shift tomorrow.</p></div>`; }
  else {
    box.innerHTML = `<div class="sentry-start">${digHTML('wait', `${c.nickname}! You’re on sentry duty today. I’ll be down in the hole watching the footprints. Tell me who’s coming!`)}
      <p class="small muted">${ROUNDS} visitors · ${SECONDS} seconds each · pick the Pokémon that made the footprint.</p><button class="btn block" id="sgo">Start my shift</button></div>`;
    $('#sgo', box).onclick = () => play(c, box, roster);
  }
  const e = $('#ed', main); if (e) e.onclick = onEdit;
}

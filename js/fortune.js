// "What's the Weather?" — Castform's fortune-telling table. Instead of a wheel, the player picks a weather card
// for the NEXT weather reading (every 6 hours). Once a day per character; a right guess pays the prize.
// If today's 1d100 sky roll hits 100 the game breaks and Castform stops hosting until the GM reopens it.
import { markWinner } from './sparkle.js?v=6ae15f5c';
import * as store from './store.js?v=6ae15f5c';
import { unlockChar, charOpen, pinOf } from './charlock.js?v=6ae15f5c';
import { $, $$, esc, toast, num } from './util.js?v=6ae15f5c';
import { modal, closeModal, portrait } from './ui.js?v=6ae15f5c';
import { logRoll, me } from './play.js?v=6ae15f5c';
import { WEATHERS, currentWeather, dailyRoll } from './weather.js?v=6ae15f5c';
import { gameSay } from './chatter.js?v=6ae15f5c';

export const isFortune = (g) => g.kind === 'fortune' || g.id === 'what-s-the-weather';

// the tarot deck: one card per everyday weather (disasters can't be guessed)
const CARDS = [['clear', 'I', 'The Clear Sky'], ['cloudy', 'II', 'The Clouds'], ['sunny', 'III', 'The Sun'], ['rain', 'IV', 'The Rain'],
  ['fog', 'V', 'The Fog'], ['wind', 'VI', 'The Wind'], ['sandstorm', 'VII', 'The Sandstorm'], ['hail', 'VIII', 'The Hail']];
const cardOf = (k) => CARDS.find((x) => x[0] === k);

const betPath = (id) => `fortune/bets/${id}`;
const costOf = (g) => num(g.cost) || 25;
const prizeOf = (g) => num(((g.intro || '').match(/win\s+([\d,]+)/i) || [])[1]) || 100;
const timeOf = (t) => new Date(t).toLocaleString([], { ...(t - Date.now() > 12 * 3600e3 ? { weekday: 'short' } : {}), hour: 'numeric', minute: '2-digit' });
const givePoke = (id, amt) => store.update('party/' + id, (x) => ({ ...x, poke: num(x?.poke) + amt }));
const say = (text, player) => player ? gameSay('Castform', 'do', text, 'fortune', player)
  : store.pushLimited('chatter', { who: 'Castform', kind: 'do', text, tag: 'fortune', t: Date.now() }, 80);

// a disaster day (sky roll 100) breaks the game for good, until the GM reopens it
function checkBroken() {
  const d = dailyRoll();
  if (d.roll === 100 && !store.get('fortune/closed') && store.get('fortune/reopened') !== d.day) {
    store.set('fortune/closed', d.day);
    say('flees the fortune table as the sky splits open! "The cards… the cards didn’t see THIS coming." What’s the Weather? is closed.');
  }
  return store.get('fortune/closed');
}

// Settle a guess once its reading has happened. Only the guesser's own device settles it, so it pays once.
export function resolveFortunes(g = { cost: '', intro: '' }) {
  const mine = me(); if (!mine) return;
  const b = store.get(betPath(mine.id));
  if (!b || b.done || Date.now() < b.target) return;
  const actual = currentWeather(b.target).key; const w = WEATHERS[actual];
  const res = !w.w ? 'refund' : actual === b.key ? 'win' : 'lose';
  store.set(betPath(mine.id), { ...b, done: true, actual, res });
  const pick = WEATHERS[b.key];
  if (res === 'win') {
    givePoke(mine.id, b.prize); markWinner(mine.id);
    say(`reads the sky for ${mine.nickname}: ${w.icon} ${w.name}! The card was right. +${b.prize} Poké and a sparkly cursor for a day!`, mine.nickname);
  } else if (res === 'refund') {
    givePoke(mine.id, b.cost);
    say(`couldn’t read the sky for ${mine.nickname}: ${w.icon} ${w.name} came instead. ${b.cost} Poké given back.`, mine.nickname);
  } else say(`reads the sky for ${mine.nickname}: ${w.icon} ${w.name}, not ${pick.icon} ${pick.name}. Better luck tomorrow!`, mine.nickname);
  logRoll(mine.nickname, `${g.name || 'What’s the Weather?'} — reading`, null, `guessed ${pick.name}, the sky showed ${w.name}${res === 'win' ? ` · won ${b.prize} Poké` : res === 'refund' ? ' · cost given back' : ''}`, 'note');
}

const cardHTML = (k, cls = '', attrs = '') => {
  const [, num_, title] = cardOf(k) || ['', '', WEATHERS[k]?.name || '?']; const w = WEATHERS[k];
  return `<div class="tarot ${cls}" ${attrs}><span class="tr-n">${num_}</span><span class="tr-ic"><span class="wxo wxo-${k}">${w.icon}</span></span><span class="tr-t">${esc(title)}</span></div>`;
};
const backHTML = (cls = '') => '<div class="tarot back ' + cls + '"><span class="tr-ic">✦</span></div>';

// small fan of cards for the Games list
export const fortuneMini = () => `<div class="tarot-fan">${backHTML()}${cardHTML('rain')}${backHTML()}</div>`;

export function renderFortune(main, g, gm, onEdit) {
  const cost = costOf(g); const prize = prizeOf(g);
  const party = () => Object.values(store.get('party') || {}).filter((c) => !c.guest);
  let who = me()?.id || '';
  main.innerHTML = `<div class="row" style="justify-content:space-between;margin-top:12px"><a class="btn alt sm" href="#/games">← Games</a>${gm ? '<button class="btn alt sm" id="ed">Edit</button>' : ''}</div>
    <h1 style="margin:10px 0 4px">${esc(g.name)}</h1>
    <p>${esc(g.intro || '')}</p>
    <p><span class="pill">💰 Cost: ${cost} Poké</span> <span class="pill">🏆 Right guess: ${prize} Poké</span> <span class="pill">📅 Once a day</span></p>
    ${g.legend ? `<details class="card legend"><summary><b>📜 ${esc(g.legendTitle || 'The story')}</b></summary>${g.legend.split(/\n\s*\n/).map((x) => `<p>${esc(x.trim())}</p>`).join('')}</details>` : ''}
    <div class="wheel-layout">
    <aside class="spinners"><div class="sp-title">Who’s asking?</div><div id="splist"></div></aside>
    <div class="fortune ft-table" id="ftable"></div>
    </div>`;
  const draw = () => {
    resolveFortunes(g);
    const closed = checkBroken();
    $('#splist', main).innerHTML = party().map((c) => { const b = store.get(betPath(c.id)); const today = b && b.day === dailyRoll().day;
      return `<button class="sp ${c.id === who ? 'on' : ''}" data-sp="${c.id}">${portrait(c, 'sm')}<span><b>${esc(c.nickname)}</b><small>${num(c.poke).toLocaleString()} Poké${today ? ' · ' + WEATHERS[b.key].icon + (b.done ? '' : ' waiting') : ''}</small></span></button>`; }).join('') || '<p class="small muted">No characters at this table yet.</p>';
    $$('[data-sp]', main).forEach((b) => b.onclick = () => { const go = () => { who = b.dataset.sp; draw(); };
      if (b.dataset.sp === me()?.id || !pinOf(b.dataset.sp) || charOpen(b.dataset.sp)) go(); else unlockChar(b.dataset.sp, go); });
    const box = $('#ftable', main); const c = (store.get('party') || {})[who];
    const cw = currentWeather(); const b = c && store.get(betPath(c.id));
    const head = `<div class="ft-top">✦ Castform’s Fortune Table ✦</div><div class="ft-orb" aria-hidden="true">🔮</div>`;
    if (closed) {
      box.innerHTML = `${head}<div class="ft-name">The table is empty</div><p class="ft-say">${esc(g.twistsText || 'The sky roll hit 100. Castform was so shaken by the storm that he stopped hosting.')}</p>
        ${gm ? '<button class="ft-more" id="reopen">GM: reopen the table</button>' : '<p class="small ft-none">Only the GM can bring Castform back.</p>'}`;
      const r = $('#reopen', box); if (r) r.onclick = () => { store.set('fortune/reopened', dailyRoll().day); store.set('fortune/closed', null); draw(); };
      return;
    }
    if (!c) { box.innerHTML = `${head}<div class="ft-name">Who’s asking?</div><p class="ft-say">Tap a character to sit at Castform’s table.</p>`; return; }
    // already asked today: their card and the reading
    if (b && b.day === dailyRoll().day) {
      const w = b.actual && WEATHERS[b.actual];
      box.innerHTML = `${head}<div class="ft-say">${esc(c.nickname)} drew…</div>
        <div class="tarot-row">${cardHTML(b.key, 'chosen')}${b.done ? cardHTML(b.actual, 'sky ' + b.res) : backHTML('sky')}</div>
        <div class="tarot-labels"><span>Your card</span><span>The sky at ${timeOf(b.target - 60e3)}</span></div>
        ${b.done ? `<div class="ft-name">${b.res === 'win' ? `The cards were right! +${b.prize} Poké` : b.res === 'refund' ? 'The sky broke the cards. Poké given back.' : 'Not this time.'}</div>
          <p class="ft-say">${b.res === 'win' ? 'Castform bows and pays out with a grin.' : `The sky showed ${w.icon} ${esc(w.name)}.`} Come back tomorrow for another reading.</p>`
          : `<div class="ft-name">Castform is reading the sky…</div><p class="ft-say">The sky card turns over at <b>${timeOf(b.target - 60e3)}</b>. Open this page after that to see if you won.</p>`}`;
      return;
    }
    const target = cw.next + 60e3;
    box.innerHTML = `${head}<div class="ft-name">Pick a card, ${esc(c.nickname)}</div>
      <p class="ft-say">Which weather will the next reading show at <b>${timeOf(cw.next)}</b>? Right now: ${WEATHERS[cw.key].icon} ${esc(WEATHERS[cw.key].name)}.</p>
      <div class="tarot-deck">${CARDS.map(([k]) => cardHTML(k, 'pickable', `role="button" tabindex="0" data-card="${k}"`)).join('')}</div>
      <p class="small ft-none">${cost} Poké to ask · ${esc(c.nickname)} has ${num(c.poke).toLocaleString()} Poké</p>`;
    $$('[data-card]', box).forEach((el) => el.onclick = () => {
      const k = el.dataset.card; const w = WEATHERS[k];
      const fresh = (store.get('party') || {})[c.id] || c;
      if (num(fresh.poke) < cost) { toast(`${fresh.nickname} needs ${cost} Poké (has ${num(fresh.poke).toLocaleString()})`); return; }
      const sh = modal(`<div class="fortune ft-full"><div class="ft-top">✦ Castform’s Fortune Table ✦</div>${cardHTML(k, 'chosen solo')}
        <p class="ft-say">Bet ${cost} Poké that the ${timeOf(cw.next)} reading shows <b>${w.icon} ${esc(w.name)}</b>?</p>
        <div class="row" style="justify-content:center"><button class="btn" id="ftyes">Draw it</button><button class="btn alt" data-close>Cancel</button></div></div>`, (s) => s.classList.add('ft-sheet'));
      $('#ftyes', sh).onclick = () => {
        if (store.get(betPath(c.id))?.day === dailyRoll().day) { closeModal(); draw(); return; }
        givePoke(c.id, -cost);
        store.set(betPath(c.id), { day: dailyRoll().day, key: k, target, cost, prize, t: Date.now() });
        logRoll(c.nickname, `${g.name} — card`, null, `paid ${cost} Poké · drew ${cardOf(k)[2]} (${w.name}) for the ${timeOf(cw.next)} reading`, 'note');
        say(`turns a card for ${c.nickname}: ${w.icon} ${cardOf(k)[2]}. "We’ll see at ${timeOf(cw.next)}…"`, c.nickname);
        closeModal(); draw();
      };
    });
    $$('[data-card]', box).forEach((el) => el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
  };
  draw();
  const e = $('#ed', main); if (e) e.onclick = onEdit;
}

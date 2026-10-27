// Pelipper Post: a little mailbox above each player's name. Once a day every character gets one letter with a
// small solo mission; they roll for it and can earn an item, Poké, a recruit chance or a new place to explore.
// Letters are GM-editable (content/mail). Recruits and new places go on the GM checklist for the GM to play out.
import * as store from './store.js?v=6ae13a2b';
import { $, $$, esc, toast, num, pool, uid } from './util.js?v=6ae13a2b';
import { modal, closeModal } from './ui.js?v=6ae13a2b';
import { merged, editContent } from './content-store.js?v=6ae13a2b';
import { logRoll, statVal } from './play.js?v=6ae13a2b';
import { dailyRoll, hash } from './weather.js?v=6ae13a2b';
import { gameSay, gmTodo } from './chatter.js?v=6ae13a2b';
import { markWinner } from './sparkle.js?v=6ae13a2b';

const KINDS = { item: ['🎁', 'Item'], poke: ['💰', 'Poké'], recruit: ['🤝', 'Recruit chance'], place: ['🧭', 'New place'] };
export const MAIL_SCHEMA = [['title', 'Title'], ['from', 'From'], ['text', 'Letter', 'area'], ['attr', 'Roll: attribute (e.g. Insight)'], ['skill', 'Roll: skill (e.g. Alert)'],
  ['need', 'Successes needed', 'number'], ['kind', 'Reward kind', 'select:item|poke|recruit|place'], ['reward', 'Reward (item name ×qty, Poké amount, Pokémon, or place)'], ['fail', 'If it goes wrong (optional)', 'area']];

const LETTERS = [
  { id: 'lost-scarf', title: 'A Scarf in the Wind', from: 'Azurill', attr: 'Insight', skill: 'Alert', need: 1, kind: 'item', reward: 'Oran Berry ×2',
    text: 'My favourite scarf blew away somewhere around Acorn Grove! Could you look for it? I’ll share my berries with you!' },
  { id: 'berry-run', title: 'Berry Delivery', from: 'Kecleon Shop', attr: 'Dexterity', skill: 'Athletic', need: 1, kind: 'poke', reward: '150',
    text: 'A crate of berries needs to get from the gate to the Miltankshake Shack before they spoil. Quick feet, please!' },
  { id: 'echo-noise', title: 'Humming Under the Roots', from: 'Whismur', attr: 'Insight', skill: 'Nature', need: 2, kind: 'place', reward: 'A hollow under the great tree’s roots at Acorn Grove',
    text: 'Something keeps humming under the big tree roots at Acorn Grove at night. I’m too scared to look. Will you find out what it is?' },
  { id: 'shy-visitor', title: 'A Shy Visitor', from: 'Chansey', attr: 'Cute', skill: 'Allure', need: 2, kind: 'recruit', reward: 'Pichu',
    text: 'A little Pichu keeps peeking into the infirmary but runs off whenever anyone says hello. Maybe you can make friends?' },
  { id: 'tide-shells', title: 'Pretty Pebbles', from: 'Shellos', attr: 'Dexterity', skill: 'Nature', need: 1, kind: 'item', reward: 'Pecha Berry',
    text: 'The stream by Fernshade Camp is low today! Help me gather shiny pebbles before it fills back up?' },
  { id: 'stuck-cart', title: 'Stuck Cart', from: 'Bidoof', attr: 'Strength', skill: 'Athletic', need: 2, kind: 'poke', reward: '250',
    text: 'Golly, my cart’s wheel is stuck in the mud right outside the Woodland Base gate. Could you give it a big push, yup yup?' },
  { id: 'falls-path', title: 'The Old Lookout', from: 'Old Torkoal', attr: 'Insight', skill: 'Stealth', need: 2, kind: 'place', reward: 'An old lookout hidden above Woodland Base',
    text: 'When I was young there was a lookout up in the trees above Woodland Base. My eyes are too smoky to find it now. Is it still there?' },
  { id: 'lost-egg', title: 'The Lost Egg', from: 'Happiny', attr: 'Vitality', skill: 'Alert', need: 1, kind: 'item', reward: 'Reviver Seed',
    text: 'I was looking after a round white stone in Fernshade Camp and now it’s gone! Please help me find it. It’s very important (it might be an egg)!' },
  { id: 'cliff-song', title: 'A Song at Dusk', from: 'Jigglypuff', attr: 'Cool', skill: 'Perform', need: 2, kind: 'recruit', reward: 'Swablu',
    text: 'A Swablu sings on the mess hall roof every evening, all alone. I think it wants someone to sing back!' },
  { id: 'mail-mixup', title: 'Mail Mix-up', from: 'Pelipper Post', attr: 'Clever', skill: 'Etiquette', need: 1, kind: 'poke', reward: '100',
    text: 'Oh dear, a whole bag of letters got muddled in the rain. Could you help sort them back to the right homes around Woodland Base?' },
  { id: 'ruins-glow', title: 'A Glow in the Ferns', from: 'Natu', attr: 'Special', skill: 'Channel', need: 2, kind: 'place', reward: 'A glowing clearing hidden past Fernshade Camp',
    text: 'I saw a light flicker deep in the ferns past Fernshade Camp, where there was only shade before. The future feels… curious.' },
  { id: 'bully-trouble', title: 'Trouble at the Pond', from: 'Lotad', attr: 'Tough', skill: 'Intimidate', need: 1, kind: 'item', reward: 'Apple ×2',
    text: 'Some big Pokémon keep splashing us out of the little pond behind storage. Could you ask them nicely (or not so nicely) to stop?' },
];
export const letters = () => merged('mail', LETTERS);

const meId = () => { try { return localStorage.getItem('dc.me.' + store.tableCode()) || ''; } catch { return ''; } };
const today = () => dailyRoll().day;
const slot = (id) => store.get('mail/' + id) || {};
// everyone gets their own letter each day; the same on every device at the table
export function letterFor(c, day = today()) {
  const all = letters().filter((l) => l.title); if (!all.length) return null;
  return all[Math.floor(hash(`${store.tableCode()}|mail|${day}|${c.id}`) * all.length)];
}
export const mailWaiting = (c) => !!c && !!letterFor(c) && slot(c.id).day !== today();

const rewardText = (l) => l.kind === 'poke' ? `${num(l.reward).toLocaleString()} Poké` : l.kind === 'recruit' ? `A chance to recruit ${l.reward}` : l.reward;
const letterHTML = (l) => `<div class="mail-letter"><div class="mail-from">✉️ From <b>${esc(l.from || 'Someone')}</b></div>
  <h3>${esc(l.title)}</h3><p>${esc(l.text)}</p>
  <div class="mail-meta"><span class="pill">🎲 ${esc(l.attr || 'Insight')} + ${esc(l.skill || 'Alert')} · need ${num(l.need) || 1}</span><span class="pill">${KINDS[l.kind]?.[0] || '🎁'} ${esc(rewardText(l))}</span></div></div>`;

function giveReward(c, l) {
  if (l.kind === 'poke') { store.update('party/' + c.id, (x) => ({ ...x, poke: num(x?.poke) + num(l.reward) })); return; }
  if (l.kind === 'item') {
    const m = String(l.reward).match(/^(.*?)\s*[×x]\s*(\d+)$/); const name = (m ? m[1] : l.reward).trim(); const q = m ? num(m[2]) : 1;
    const same = Object.entries(store.get('bag') || {}).find(([, b]) => b.name.toLowerCase() === name.toLowerCase() && b.owner === c.id);
    if (same) store.set(`bag/${same[0]}/qty`, num(same[1].qty) + q); else store.set('bag/' + uid(), { name, qty: q, owner: c.id });
    return;
  }
  gmTodo(l.kind === 'recruit' ? `${c.nickname} earned a chance to recruit ${l.reward} (mail: “${l.title}”)` : `${c.nickname} discovered a new place: ${l.reward} (mail: “${l.title}”)`, 'mail');
}

function go(c, l, box) {
  if (slot(c.id).day === today()) return;
  const dice = Math.max(1, statVal(c, l.attr || 'Insight') + statVal(c, l.skill || 'Alert'));
  const r = pool(dice); const need = num(l.need) || 1; const ok = r.succ >= need;
  store.set('mail/' + c.id, { day: today(), id: l.id, res: ok ? 'win' : 'lose', t: Date.now() });
  logRoll(c.nickname, `Mail — ${l.title} (${l.attr} + ${l.skill})`, r.dice, `${r.succ}/${need} success${need === 1 ? '' : 'es'} · ${ok ? rewardText(l) : 'not this time'}`);
  if (ok) {
    giveReward(c, l); markWinner(c.id);
    store.pushLimited('log', { t: Date.now(), text: `${c.nickname} finished a mail mission: ${l.title} (${rewardText(l)}).` });
    gameSay('Pelipper', 'do', `drops off a thank-you note from ${l.from}: ${c.nickname} finished “${l.title}”!`, 'mail', c.nickname);
  }
  $('.mail-act', box).innerHTML = resultHTML(l, ok ? 'win' : 'lose');
}

const resultHTML = (l, res) => res === 'win'
  ? `<div class="big">Mission done! ${KINDS[l.kind]?.[0] || '🎁'}</div><p>${l.kind === 'item' ? `${esc(l.reward)} went into your bag.` : l.kind === 'poke' ? `+${num(l.reward).toLocaleString()} Poké!` : l.kind === 'recruit' ? `You made friends with ${esc(l.reward)}! Your GM will play out the recruiting.` : `You found <b>${esc(l.reward)}</b>! Your GM will tell you what’s there.`}</p><p class="small muted">New mail arrives tomorrow.</p>`
  : `<div class="big">Not this time…</div><p>${esc(l.fail || 'It didn’t work out today, but they thank you for trying.')}</p><p class="small muted">New mail arrives tomorrow.</p>`;

export function openMailbox(c) {
  if (!c) return;
  const l = letterFor(c); const s = slot(c.id); const done = s.day === today();
  const gm = store.gmUnlocked();
  const box = modal(`<h2>📬 Pelipper Post</h2><p class="small muted">One letter a day for ${esc(c.nickname)}. Help out and earn a reward!</p>
    ${l ? letterHTML(l) : '<p class="muted">No mail today.</p>'}
    <div class="mail-act result">${!l ? '' : done ? resultHTML(letters().find((x) => x.id === s.id) || l, s.res) : '<button class="btn block" id="mailgo">Take the mission 🎲</button>'}</div>
    ${gm ? `<h3 style="margin-top:16px">Letters (GM)</h3><ul class="mail-list">${letters().map((x) => `<li><span class="grow">${KINDS[x.kind]?.[0] || '🎁'} ${esc(x.title || '(untitled)')}</span><button class="btn alt sm" data-mailed="${esc(x.id)}">Edit</button></li>`).join('')}</ul>
      <button class="btn alt" id="mailadd">Add a letter</button>${done ? ' <button class="btn alt" id="mailreset">Let them try again today</button>' : ''}` : ''}`);
  box.classList.add('mail-sheet');
  const g = $('#mailgo', box); if (g) g.onclick = () => { g.disabled = true; go(c, l, box); };
  $$('[data-mailed]', box).forEach((b) => b.onclick = () => editContent('mail', MAIL_SCHEMA, letters().find((x) => x.id === b.dataset.mailed), { title: 'Edit letter' }));
  const a = $('#mailadd', box); if (a) a.onclick = () => editContent('mail', MAIL_SCHEMA, null, { title: 'New letter' });
  const rs = $('#mailreset', box); if (rs) rs.onclick = () => { store.set('mail/' + c.id, null); closeModal(); toast('Mail reset for today'); };
}

export const openMyMailbox = () => openMailbox((store.get('party') || {})[meId()]);

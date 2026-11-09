// The Miltankshack (her ask 11-01): buy Moomoo Milk for your bag, or buy a milkshake and watch your Pokémon drink it
import * as store from './store.js?v=6af10e0f';
import { $, esc, toast, uid } from './util.js?v=6af10e0f';
import { modal } from './ui.js?v=6af10e0f';
import { buyDialog, logSale } from './shopkit.js?v=6af10e0f';

const num = (v) => Number(v) || 0;
export const MILK_PRICE = 350;   // Pokérole Core 2.0's price for it
export const SHAKE_PRICE = 30;
const THANKS = ['*Miltank gives a happy moo*', 'Fresh from the farm! Come back soon!', 'Moo! Enjoy every drop!'];
const thanks = () => THANKS[Math.floor(Math.random() * THANKS.length)];
const pay = (buyer, total) => store.update('party/' + buyer.id, (x) => ({ ...x, poke: num(x?.poke) - total }));

// the two buttons under the Miltankshack's box
export function shackButtons(card) {
  card.insertAdjacentHTML('beforeend', `<div class="shack-buy">
    <button class="btn" data-shack="shake"><img src="assets/items/milkshake.png" alt=""> Buy a Milkshake <small>${SHAKE_PRICE} Poké</small></button>
    <button class="btn alt" data-shack="milk"><img src="assets/items/moomoo-milk.png" alt=""> Buy Moomoo Milk <small>${MILK_PRICE} Poké</small></button></div>`);
  $('[data-shack="milk"]', card).onclick = buyMilk;
  $('[data-shack="shake"]', card).onclick = buyShake;
}

// Moomoo Milk goes into the buyer's bag, like any shop item
function buyMilk() {
  buyDialog({ item: 'Moomoo Milk', price: MILK_PRICE, seller: 'Miltank', onBuy: (buyer, qty, total) => {
    pay(buyer, total);
    const bag = store.get('bag') || {};
    const same = Object.entries(bag).find(([, b]) => b.name === 'Moomoo Milk' && b.owner === buyer.id);
    if (same) store.set(`bag/${same[0]}/qty`, num(same[1].qty) + qty); else store.set('bag/' + uid(), { name: 'Moomoo Milk', qty, owner: buyer.id });
    const text = `${buyer.nickname} bought ${qty > 1 ? qty + ' × ' : ''}Moomoo Milk for ${total.toLocaleString()} Poké.`;
    store.pushLimited('log', { t: Date.now(), text }); logSale('miltank', buyer, text, thanks());
    toast(`Bought ${qty > 1 ? qty + ' × ' : ''}Moomoo Milk`);
  } });
}

// a milkshake is drunk on the spot: your Pokémon bounces about excitedly and slurps it down
function buyShake() {
  buyDialog({ item: 'Milkshake', unit: 'a Milkshake', price: SHAKE_PRICE, max: 1, seller: 'Miltank', onBuy: (buyer, qty, total) => {
    pay(buyer, total);
    const text = `${buyer.nickname} had a milkshake at the Miltankshack.`;
    store.pushLimited('log', { t: Date.now(), text }); logSale('miltank', buyer, text, thanks());
    drink(buyer);
  } });
}

async function drink(c) {
  const el = modal(`<h2>🥤 Milkshake time!</h2><div class="shake-scene"><div class="shake-mon"></div><img class="shake-cup" src="assets/items/milkshake.png" alt=""><div class="shake-fx"></div></div>
    <p class="shake-say" role="status">${esc(c.nickname)} can’t wait…</p>`);
  const fz = await import('./fzscene.js?v=6af10e0f').catch(() => null);
  const w = c.pokemon && fz ? await fz.walkSprite(c.pokemon, 3, 'down', true, !!c.shiny).catch(() => null) : null;
  const mon = $('.shake-mon', el); if (!mon) return;
  mon.innerHTML = w ? w.html : `<span class="shake-emo">😋</span>`;
  const spr = $('.fzs-spr', mon); if (spr) spr.classList.add('walking');
  const scene = $('.shake-scene', el); const say = $('.shake-say', el); const fx = $('.shake-fx', el);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pop = (t) => { const s = document.createElement('span'); s.textContent = t; s.style.left = (30 + Math.random() * 40) + '%'; fx.appendChild(s); setTimeout(() => s.remove(), 1400); };
  scene.classList.add('excited'); for (const t of ['❗', '✨', '💕']) { pop(t); await wait(450); }
  if (!el.isConnected) return;
  scene.classList.remove('excited'); scene.classList.add('sipping'); say.textContent = `${c.nickname} is slurping it down!`;
  for (let i = 0; i < 6 && el.isConnected; i++) { pop(i % 2 ? '♪' : '💕'); await wait(500); }
  if (!el.isConnected) return;
  scene.classList.remove('sipping'); scene.classList.add('done', 'excited'); pop('😋'); pop('✨');
  say.innerHTML = `<b>Ahh!</b> ${esc(c.nickname)} loved it. Thanks, Miltank!`;
  await wait(1200); scene.classList.remove('excited');
}

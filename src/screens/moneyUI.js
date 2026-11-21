// Money menu pop-ups: bank & funds, shopping, property, and the debt ladder.
// H: { c, age, modal, closeModal, toast, save, render, root }
import { esc } from '../engine/util.js';
import { SHOP, item, home, room, cantBuy, buy, sell, cantMove, moveHome, buyRoom, roomSlots, netWorth, payIntoFund, takeFromFund, debtOptions, takeOption } from '../sim/money.js';
import { weeklyBills } from '../sim/career.js';

export const money = n => (n < 0 ? '-£' : '£') + Math.abs(Math.round(n)).toLocaleString('en-GB');
const q = (H, s) => H.root.querySelector(s), qa = (H, s) => H.root.querySelectorAll(s);
const row = (l, v) => `<div class="row"><span>${l}</span><b>${v}</b></div>`;

export function showBank(H) {
  const c = H.c, bills = weeklyBills(c), out = bills.reduce((a, b) => a + b.amount, 0);
  H.modal(`<h2>Bank & loans</h2><div class="scroll">
    ${row('Bank balance', money(c.bank))}${row('Net worth (incl. what you own)', money(netWorth(c)))}
    <h3>Every week</h3>${row('Wages', '+' + money(c.contract.wage))}${bills.map(b => row(esc(b.what), '-' + money(b.amount))).join('')}${row('Left over', money(c.contract.wage - out))}
    <h3>Savings funds</h3><p class="dim">Put money aside. Tempting to raid when you're skint. Family will notice.</p>
    ${SHOP.funds.map(([k, l]) => `<div class="fund"><span>${l}</span><b>${money(c.funds[k])}</b><button class="btn small" data-f="${k}" data-a="50">+£50</button><button class="btn small" data-f="${k}" data-a="500">+£500</button><button class="btn small" data-f="${k}" data-a="5000">+£5k</button><button class="btn small red" data-f="${k}" data-a="-1">Take it out</button></div>`).join('')}
    <h3>Debts</h3>${c.debts.length ? c.debts.map(d => row(esc(d.name) + (d.rate ? ` <small>(${Math.round(d.rate * 100)}%/wk)</small>` : ''), money(d.balance))).join('') : '<p class="dim">None. Gran is proud.</p>'}
  </div>`);
  qa(H, '.fund button').forEach(b => b.onclick = () => {
    const k = b.dataset.f, a = +b.dataset.a;
    if (a < 0) { const v = takeFromFund(c, k, c.funds[k]); H.toast(v ? `Took ${money(v)} out. It feels like nothing. It isn't.` : 'Nothing in there.'); }
    else { const v = payIntoFund(c, k, a); H.toast(v ? `${money(v)} put away. Very grown up.` : 'You haven\'t got it to put away.'); }
    H.save(); H.render(); showBank(H);
  });
}

export function showShop(H, cat = 'look') {
  const c = H.c, age = H.age(c), items = SHOP.items.filter(i => i.cat === cat);
  H.modal(`<h2>Shopping</h2><div class="tabs">${SHOP.categories.map(([k, l]) => `<button class="tab ${k === cat ? 'on' : ''}" data-cat="${k}">${l}</button>`).join('')}</div>
    <div class="row"><span>Bank balance</span><b>${money(c.bank)}</b></div>
    <div class="scroll shop">${items.map(i => { const why = cantBuy(c, i, age), owned = c.owned.includes(i.id); return `<div class="item ${owned ? 'owned' : ''}"><div><b>${esc(i.name)}</b><span class="price">${money(i.price)}${i.weekly ? ` + ${money(i.weekly)}/wk` : ''}</span><p>${esc(i.blurb)}</p></div>
      ${owned && i.resale ? `<button class="btn small red" data-sell="${i.id}">Sell for ${money(i.price * i.resale)}</button>` : `<button class="btn small gold" data-buy="${i.id}" ${why ? 'disabled' : ''}>${why ? esc(why) : 'Buy'}</button>`}</div>`; }).join('')}</div>`);
  qa(H, '.tab').forEach(b => b.onclick = () => showShop(H, b.dataset.cat));
  qa(H, '[data-buy]').forEach(b => b.onclick = () => { const r = buy(c, b.dataset.buy, age); H.save(); H.render(); H.toast(r.ok ? `Bought: ${item(b.dataset.buy).name}.` : r.why); showShop(H, cat); });
  qa(H, '[data-sell]').forEach(b => b.onclick = () => { const v = sell(c, b.dataset.sell); H.save(); H.render(); H.toast(`Sold for ${money(v)}.`); showShop(H, cat); });
}

export function showProperty(H) {
  const c = H.c, age = H.age(c), cur = home(c.home), slots = roomSlots(c);
  H.modal(`<h2>Property</h2><div class="scroll">
    ${row('You live in', esc(cur.name) + (c.homeOwned ? ' (yours)' : cur.rent ? ` (renting, ${money(cur.rent)}/wk)` : ''))}${row('Bank balance', money(c.bank))}
    <h3>Move</h3><div class="shop">${SHOP.homes.filter(h => h.id !== c.home).map(h => {
      const r = cantMove(c, h, 'rent', age), b = cantMove(c, h, 'buy', age);
      return `<div class="item"><div><b>${esc(h.name)}</b><span class="price">${h.price ? money(h.price) : ''}${h.rent ? `${h.price ? ' or ' : ''}${money(h.rent)}/wk rent` : ''}${h.rooms ? ` · ${h.rooms} spare room${h.rooms > 1 ? 's' : ''}` : ''}</span><p>${esc(h.blurb)}</p></div><div class="btncol">
        ${h.id === 'mums' ? `<button class="btn small" data-mv="mums" data-m="rent">Move back</button>` : ''}
        ${h.rent && h.id !== 'mums' ? `<button class="btn small" data-mv="${h.id}" data-m="rent" ${r ? 'disabled' : ''}>${r ? esc(r) : 'Rent'}</button>` : ''}
        ${h.price ? `<button class="btn small gold" data-mv="${h.id}" data-m="buy" ${b ? 'disabled' : ''}>${b ? esc(b) : 'Buy'}</button>` : ''}</div></div>`; }).join('')}</div>
    <h3>Rooms ${c.homeOwned ? `(${c.rooms.length} of ${slots} used)` : ''}</h3>${!c.homeOwned ? '<p class="dim">Own a house with spare rooms to kit them out.</p>' : `<div class="shop">${SHOP.rooms.map(r => { const have = c.rooms.includes(r.id), why = have ? 'Built' : c.rooms.length >= slots ? 'No spare rooms' : c.bank < r.price ? 'Can\'t afford it' : null; return `<div class="item ${have ? 'owned' : ''}"><div><b>${esc(r.name)}</b><span class="price">${money(r.price)}</span><p>${esc(r.blurb)}</p></div><button class="btn small gold" data-room="${r.id}" ${why ? 'disabled' : ''}>${why || 'Build'}</button></div>`; }).join('')}</div>`}
  </div>`);
  qa(H, '[data-mv]').forEach(b => b.onclick = () => { const r = moveHome(c, b.dataset.mv, b.dataset.m, b.dataset.mv === 'mums' ? 99 : age); H.save(); H.render(); H.toast(r.ok ? (b.dataset.mv === 'mums' ? 'Back in the single bed. Mum\'s delighted.' : `Moved in: ${home(b.dataset.mv).name}.${r.sold ? ` Sold the old place for ${money(r.sold)}.` : ''}`) : r.why); showProperty(H); });
  qa(H, '[data-room]').forEach(b => b.onclick = () => { const r = buyRoom(c, b.dataset.room); H.save(); H.render(); H.toast(r.ok ? `${room(b.dataset.room).name} built.` : r.why); showProperty(H); });
}

/** You're in the red: work down the ladder until you're not. */
export function showDebt(H, next) {
  const c = H.c;
  if (c.bank >= 0) return next();
  const need = -c.bank, opts = debtOptions(c);
  const RUNG = { 1: 'Sell something', 2: 'Raid the family funds', 3: 'Borrow from people close to you', 4: 'Loan companies' };
  let last = 0;
  H.modal(`<div class="evvia">💸 Bank alert</div><h2>You're ${money(need)} overdrawn</h2><p class="evtext">The bank has sent a letter. It's written in red. Even the envelope looks disappointed. Sort it out before next week.</p>
    <div class="choices">${opts.map((o, i) => { const head = o.rung !== last ? `<h3>${RUNG[o.rung]}</h3>` : ''; last = o.rung; return head + `<button class="btn choice" data-i="${i}">${esc(o.label)} <small>${o.type === 'borrow' ? 'up to ' : ''}${money(o.value)}${o.warn ? ' · ' + esc(o.warn) : ''}</small></button>`; }).join('')}</div>`, true);
  qa(H, '.choice').forEach(b => b.onclick = () => { const o = opts[+b.dataset.i], v = takeOption(c, o, need); H.save(); H.render(); H.toast(o.type === 'borrow' && c.lastLoanLine ? `${money(v)}. ${c.lastLoanLine}` : `${money(v)} found.`); showDebt(H, next); });
}
/** Ask someone for money, any time. */
export function showBorrow(H) {
  const c = H.c, opts = debtOptions(c).filter(o => o.type === 'borrow');
  H.modal(`<h2>Ask someone for money</h2><p class="dim">Who you can ask depends on how they feel about you. Everyone wants it back.</p><div class="choices">${opts.map((o, i) => `<button class="btn choice" data-i="${i}">${esc(o.label)} <small>up to ${money(o.value)}${o.warn ? ' · ' + esc(o.warn) : ''}</small></button>`).join('') || '<p class="dim">Nobody\'s lending you anything right now. Be nicer to people.</p>'}</div>`);
  qa(H, '.choice').forEach(b => b.onclick = () => { const o = opts[+b.dataset.i], v = takeOption(c, o, o.value); H.save(); H.render(); H.toast(`${money(v)}. ${c.lastLoanLine || ''}`); showBorrow(H); });
}

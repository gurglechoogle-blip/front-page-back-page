// Money: possessions, homes, rooms, savings funds, net worth and the debt
// ladder. Pure logic on the career object.
import SHOP from '../data/shop.json';
import { applyEffects, surname } from './life.js';

export { SHOP };
const ITEMS = new Map(SHOP.items.map(i => [i.id, i])), HOMES = new Map(SHOP.homes.map(h => [h.id, h])), ROOMS = new Map(SHOP.rooms.map(r => [r.id, r]));
export const item = id => ITEMS.get(id), home = id => HOMES.get(id), room = id => ROOMS.get(id);
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));

export function initMoney(c) {
  c.owned = c.owned || []; c.home = c.home || 'mums'; c.homeOwned = !!c.homeOwned; c.rooms = c.rooms || [];
  c.funds = Object.assign(Object.fromEntries(SHOP.funds.map(([k]) => [k, 0])), c.funds || {}); c.debts = c.debts || [];
  return c;
}
const ageOf = (c, ageFn) => ageFn(c);

/** Why you can't buy something right now, or null if you can. */
export function cantBuy(c, it, age) {
  if (it.minAge && age < it.minAge) return `${it.minAge}+ only`;
  if (it.needs && !c.flags[it.needs]) return it.needs === 'canDrive' ? 'Pass your driving lessons first' : 'Not yet';
  if (!it.consumable && c.owned.includes(it.id)) return 'Got one';
  if (c.bank < it.price) return 'Can\'t afford it';
  return null;
}
export function buy(c, id, age) {
  const it = item(id), why = cantBuy(c, it, age); if (why) return { ok: false, why };
  c.bank -= it.price; if (!it.consumable) c.owned.push(it.id);
  if (it.flag) c.flags[it.flag] = true;
  const effects = applyEffects(c, it.once || {});
  if (it.news) (c.weekNews = c.weekNews || []).push({ page: 'front', headline: fill(it.news, { NAME: surname(c) }) });
  return { ok: true, effects };
}
export function sell(c, id) {
  const i = c.owned.indexOf(id); if (i < 0) return 0;
  c.owned.splice(i, 1); const v = Math.round(item(id).price * (item(id).resale || 0)); c.bank += v; return v;
}
export const hasCar = c => c.owned.some(id => item(id) && item(id).car);

/* ---------- homes and rooms ---------- */
export function cantMove(c, h, mode, age) {
  if (h.minAge && age < h.minAge) return `${h.minAge}+ only`;
  if (c.home === h.id) return 'You live here';
  if (mode === 'buy' && c.bank < h.price) return 'Can\'t afford it';
  if (mode === 'rent' && !h.rent) return 'Not for rent';
  return null;
}
export function moveHome(c, id, mode, age) {
  const h = home(id), why = cantMove(c, h, mode, age); if (why) return { ok: false, why };
  // Leaving a house you own: sell it (and its rooms go with it).
  let sold = 0; if (c.homeOwned) { sold = Math.round(home(c.home).price * .95 + c.rooms.reduce((a, r) => a + room(r).price * .5, 0)); c.bank += sold; c.rooms = []; }
  const fromMums = c.home === 'mums';
  c.home = id; c.homeOwned = mode === 'buy'; if (mode === 'buy') c.bank -= h.price;
  if (fromMums && id !== 'mums') { c.flags.movedOut = true; applyEffects(c, { family: -3 }); }
  if (h.news) (c.weekNews = c.weekNews || []).push({ page: 'front', headline: fill(h.news, { NAME: surname(c) }) });
  return { ok: true, sold };
}
export const roomSlots = c => c.homeOwned ? home(c.home).rooms : 0;
export function buyRoom(c, id) {
  const r = room(id);
  if (!c.homeOwned) return { ok: false, why: 'Buy a house first' };
  if (c.rooms.includes(id)) return { ok: false, why: 'Got one' };
  if (c.rooms.length >= roomSlots(c)) return { ok: false, why: 'No spare rooms' };
  if (c.bank < r.price) return { ok: false, why: 'Can\'t afford it' };
  c.bank -= r.price; c.rooms.push(id); return { ok: true };
}

/* ---------- weekly ---------- */
/** Running costs this week: rent, insurance and running costs, loan repayments. */
export function moneyBills(c) {
  const out = [];
  const h = home(c.home); if (h.rent && !c.homeOwned) out.push({ what: `Rent: ${h.name}`, amount: h.rent });
  c.owned.forEach(id => { const it = item(id); if (it && it.weekly) out.push({ what: `${it.name}: insurance and running costs`, amount: it.weekly }); });
  c.debts.forEach(d => out.push({ what: `Repayment: ${d.name}`, amount: repayment(d) }));
  return out;
}
const repayment = d => Math.min(Math.round(d.balance), Math.max(20, Math.round(d.balance * (d.rate ? .08 : .05))));
/** End of week: interest, repayments, and what your things do for you. */
export function moneyWeek(c) {
  c.debts.forEach(d => { const pay = repayment(d); d.balance = d.balance - pay; d.balance *= 1 + (d.rate || 0); });
  c.debts = c.debts.filter(d => d.balance > 1);
  const eff = {};
  const add = o => Object.entries(o || {}).forEach(([k, v]) => eff[k] = (eff[k] || 0) + v);
  c.owned.forEach(id => item(id) && add(item(id).perWeek)); add(home(c.home).perWeek); c.rooms.forEach(r => add(room(r).perWeek));
  applyEffects(c, eff);
}
export function netWorth(c) {
  const things = c.owned.reduce((a, id) => a + Math.round((item(id)?.price || 0) * (item(id)?.resale || 0)), 0);
  const prop = c.homeOwned ? home(c.home).price * .95 + c.rooms.reduce((a, r) => a + room(r).price * .5, 0) : 0;
  const funds = Object.values(c.funds).reduce((a, b) => a + b, 0), debt = c.debts.reduce((a, d) => a + d.balance, 0);
  return Math.round(c.bank + things + prop + funds - debt);
}

/* ---------- savings funds ---------- */
export function payIntoFund(c, k, amt) { amt = Math.min(amt, Math.max(0, c.bank)); c.bank -= amt; c.funds[k] += amt; return amt; }
export function takeFromFund(c, k, amt) { amt = Math.min(amt, c.funds[k]); c.funds[k] -= amt; c.bank += amt; return amt; }

/* ---------- the debt ladder ---------- */
/** Rungs available when you're in the red, in the order you'd work down them. */
export function debtOptions(c) {
  const opts = [];
  c.owned.filter(id => item(id) && item(id).resale).forEach(id => opts.push({ rung: 1, type: 'sell', id, label: `Sell your ${item(id).name}`, value: Math.round(item(id).price * item(id).resale) }));
  if (c.homeOwned) opts.push({ rung: 1, type: 'sellHome', label: `Sell ${home(c.home).name} and move back to Mum's`, value: Math.round(home(c.home).price * .95 + c.rooms.reduce((a, r) => a + room(r).price * .5, 0)) });
  Object.entries(c.funds).filter(([, v]) => v > 0).forEach(([k, v]) => opts.push({ rung: 2, type: 'raid', id: k, label: `Raid the ${SHOP.funds.find(f => f[0] === k)[1].toLowerCase()}`, value: v, warn: k === 'mum' ? 'Mum will find out.' : k === 'holiday' ? 'Somebody was looking forward to that holiday.' : '' }));
  for (const [key, L] of Object.entries(SHOP.lenders)) {
    const ok = !L.min || Object.entries(L.min).every(([m, v]) => (c.meters[m] ?? 0) >= v);
    const owing = c.debts.some(d => d.key === key);
    if (ok && !(owing && key !== 'loanShark')) opts.push({ rung: key === 'loanShark' ? 4 : 3, type: 'borrow', id: key, label: `Borrow from ${L.name}`, value: L.max, warn: L.rate ? `${Math.round(L.rate * 100)}% interest a week. Compounding.` : 'They\'ll want it back.' });
  }
  return opts.sort((a, b) => a.rung - b.rung);
}
export function takeOption(c, o, need) {
  if (o.type === 'sell') return sell(c, o.id);
  if (o.type === 'sellHome') { const r = moveHome(c, 'mums', 'rent', 99); return r.sold; }
  if (o.type === 'raid') { const v = takeFromFund(c, o.id, c.funds[o.id]); applyEffects(c, o.id === 'mum' ? { family: -10, honour: -3 } : { family: -3 }); if (o.id === 'mum') (c.weekNews = c.weekNews || []).push({ page: 'front', headline: fill('{NAME} RAIDS MUM\'S PENSION POT', { NAME: surname(c) }) }); return v; }
  if (o.type === 'borrow') {
    const L = SHOP.lenders[o.id], amt = Math.min(L.max, Math.max(need, 100));
    c.bank += amt; c.debts.push({ key: o.id, name: L.name, balance: amt, rate: L.rate }); applyEffects(c, L.cost);
    if (o.id === 'loanShark') (c.weekNews = c.weekNews || []).push({ page: 'front', headline: fill('SKINT! {NAME} IN PAYDAY LOAN SHAME', { NAME: surname(c) }), weak: true });
    return amt;
  }
  return 0;
}
void ageOf;

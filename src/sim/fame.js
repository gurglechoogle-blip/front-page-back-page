// Social media, community and charity, staff, businesses and merch.
import L3 from '../data/life3.json';
import { applyEffects, surname } from './life.js';

export { L3 };
const pick = (a, R = Math.random) => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const news = (c, t) => (c.weekNews = c.weekNews || []).push({ page: 'front', headline: t.replace('{NAME}', surname(c)) });
export function initFame(c) {
  c.followers = c.followers ?? 250; c.posts = c.posts || []; c.staff = c.staff || []; c.charity = c.charity || 0;
  c.business = c.business || { merch: null, inv: [] }; return c;
}
export const hasStaff = (c, id) => (c.staff || []).includes(id);
export const staffBills = c => (c.staff || []).map(id => { const s = L3.staff.find(x => x.id === id); return { what: s.name, amount: s.wage }; });

/* ---------- social media ---------- */
export const postedThisWeek = c => c.weekLog.some(x => x.t === 'post');
export function postOptions(c) { return c.weekLog.some(x => x.t === 'night') ? L3.latePosts : L3.posts; }
export function post(c, i, R = Math.random) {
  const P = postOptions(c)[i], room = followerCeiling(c) - c.followers;
  const gain = Math.round((room > 0 ? room * P.followers * .6 : c.followers * P.followers * .05) * (.5 + R()) + 50);
  c.followers += gain; c.weekLog.push({ t: 'post' }); applyEffects(c, P.effects);
  if (P.news) news(c, P.news);
  c.posts.unshift({ week: c.week, text: P.text, likes: Math.round(gain * (3 + R() * 8)) }); if (c.posts.length > 30) c.posts.length = 30;
  return gain;
}
export function sponsored(c, id) {
  const S = L3.sponsors.find(x => x.id === id), pay = Math.round(c.followers * S.per);
  c.bank += pay; c.weekLog.push({ t: 'post' }); applyEffects(c, S.effects); if (S.news) news(c, S.news);
  c.sponsoredRecent = (c.sponsoredRecent || []).filter(w => c.week - w < 8).concat(c.week);
  if (c.sponsoredRecent.length >= 3) { applyEffects(c, { fans: -3 }); news(c, 'SELLOUT! FANS TURN ON AD-MAD {NAME}'); }
  c.posts.unshift({ week: c.week, text: `#ad Loving my ${S.name}! 😍`, likes: Math.round(c.followers * .02) });
  return pay;
}

/* ---------- community ---------- */
export function community(c, id, R = Math.random) {
  const A = L3.community.find(x => x.id === id);
  if (c.bank < A.cost) return { ok: false, why: 'Can\'t afford it' };
  c.bank -= A.cost; c.slotsUsed += A.slots; c.weekLog.push({ t: 'community', id }); c.charity++;
  const eff = Object.assign({}, A.effects); if (c.redeeming > 0 && eff.honour > 0) eff.honour *= 2;
  applyEffects(c, eff); if (A.money) c.bank += A.money; if (A.flag) c.flags[A.flag] = true;
  if (A.risk && R() < A.risk) { c.followUps.push({ id: 'mpScandal', week: c.week + 3 }); c.flags.mpRisk = true; }
  return { ok: true, line: A.blurb };
}

/* ---------- staff ---------- */
export function hire(c, id) { if (!hasStaff(c, id)) c.staff.push(id); c.flags.hiredHelp = true; }
export function fire(c, id) { c.staff = c.staff.filter(x => x !== id); }

/* ---------- businesses ---------- */
export function launchMerch(c, supplierId) {
  const S = L3.merchSuppliers.find(x => x.id === supplierId); if (c.bank < S.cost) return { ok: false, why: 'Can\'t afford it' };
  c.bank -= S.cost; c.business.merch = { supplier: S.id, quality: S.quality, profit: 0, weeks: 0, badWeeks: 0, invested: S.cost }; return { ok: true };
}
export function invest(c, id, amount) {
  const I = L3.investments.find(x => x.id === id); if (amount < I.min || c.bank < amount) return { ok: false, why: `Minimum ${I.min.toLocaleString('en-GB')}` };
  c.bank -= amount; c.business.inv.push({ id, amount, value: amount }); return { ok: true };
}
export function cashOutInvestment(c, i) { const v = c.business.inv[i]; c.bank += Math.round(v.value); c.business.inv.splice(i, 1); return v.value; }

/** How many followers your fame can sustain: a few thousand for a youth player, millions for a superstar. */
const STAGE = { PL: 1, ES: 1, IT: 1, DE: 1, FR: 1, CH: .3, L1: .12, L2: .06, NL: .03 };
export const followerCeiling = c => Math.round(2000 + Math.pow(Math.max(0, c.meters.fans), 2.4) * 18 * (STAGE[c.div] ?? .1) * (c.contract && /scholarship|academy/i.test(c.contract.kind || '') ? .3 : 1) + (c.flags.firstCap ? 150000 : 0));
/** Weekly: followers, invitations, staff mishaps, business returns. */
export function fameWeek(c, matchGoals, avgRating, R = Math.random) {
  const out = [];
  const cap = followerCeiling(c), drift = (cap - c.followers) * (c.followers > cap ? .02 : .006);
  c.followers = Math.max(50, Math.round(c.followers + drift + matchGoals * cap * .002 + (avgRating >= 8 ? cap * .004 : 0) + (c.partner && c.partner.job === 'influencer' ? 200 : 0)));
  if (c.followers >= 100000) c.flags.viral = true;
  if (c.redeeming > 0) c.redeeming--;
  // Invitations: say no and it costs you.
  if (R() < .12) c.pending.push({ type: 'invite' });
  // Trolls after a bad week.
  if (avgRating && avgRating < 5.6 && R() < .6) c.pending.push({ type: 'troll' });
  // Staff: perks and what can go wrong.
  if (hasStaff(c, 'nutritionist')) applyEffects(c, { energy: 3 });
  if (hasStaff(c, 'chef')) applyEffects(c, { energy: 2, partner: .3 });
  if (hasStaff(c, 'psych')) c.form = Math.max(c.form, 40);
  if (hasStaff(c, 'nanny') && c.kids && c.kids.length) applyEffects(c, { family: .6 });
  if (hasStaff(c, 'adviser')) for (const k in c.funds) c.funds[k] = Math.round(c.funds[k] * 1.003);
  for (const id of c.staff) if (R() < .015) {
    const s = L3.staff.find(x => x.id === id);
    if (s.oopsEffects) applyEffects(c, s.oopsEffects);
    if (s.oopsFunds) { for (const k in c.funds) c.funds[k] = 0; fire(c, id); }
    if (s.oopsNews) news(c, s.oopsNews);
    out.push([s.name, s.oops]);
  }
  // Merch.
  const m = c.business.merch;
  if (m && !m.closed) {
    m.weeks++;
    const effort = c.weekLog.filter(x => x.t === 'merch').length;
    const p = Math.round(Math.sqrt(c.followers) * m.quality * 4 * (1 + effort * .4) + c.meters.fans * m.quality * 6 - 300 + (R() - .5) * 200);
    m.profit += p; c.bank += p; m.badWeeks = p < 0 ? m.badWeeks + 1 : 0;
    if (m.profit > 20000 && m.profit > m.invested) c.flags.merchProfit = true;
    const S = L3.merchSuppliers.find(x => x.id === m.supplier);
    if (R() < S.risk / 20 || m.badWeeks >= 8) { m.closed = true; applyEffects(c, { honour: -3, fans: -2 }); news(c, S.riskNews || 'FLOP: {NAME} MERCH LINE FOLDS'); out.push(['Merch line', m.badWeeks >= 8 ? 'Eight weeks of losses. It\'s over. The garage is full.' : 'It\'s all gone wrong. Check the paper.']); }
  }
  // Investments.
  c.business.inv.forEach(v => {
    const I = L3.investments.find(x => x.id === v.id);
    if (R() < I.bust) { v.value = 0; news(c, I.bustNews); out.push(['Investments', `${I.label}: gone. All of it.`]); }
    else v.value = Math.max(0, v.value * (1 + I.weekly[0] + R() * (I.weekly[1] - I.weekly[0])));
  });
  c.business.inv = c.business.inv.filter(v => v.value > 0);
  return out;
}
export const businessWorth = c => Math.round((c.business ? c.business.inv.reduce((a, v) => a + v.value, 0) : 0));

// Injuries, bans (and prison), kids, holidays, and the ways back from a scandal.
import L2 from '../data/life2.json';
import names from '../data/names.json';
import { applyEffects, surname } from './life.js';

export { L2 };
const pick = (a, R = Math.random) => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function initTrouble(c) { c.kids = c.kids || []; if (c.injury === undefined) c.injury = null; c.ban = c.ban || 0; return c; }

/* ---------- injuries ---------- */
export function rollInjury(c, S, age, R = Math.random) {
  if (S.role === 'none' || c.injury) return null;
  let p = .022 + Math.max(0, 40 - c.energy) / 1200 + (age > 30 ? .012 : 0);
  if (c.rooms && c.rooms.includes('recovery')) p *= .6;
  if (R() > p) return null;
  const [name, a, b] = pick(L2.injuries, R); let weeks = a + Math.floor(R() * (b - a + 1));
  if (c.staff && c.staff.includes('physio')) weeks = Math.max(1, Math.round(weeks * .7));
  c.injury = { name, weeks, total: weeks, id: c.week }; return c.injury;
}
/** Weekly: injuries heal, bans run down. Returns lines for the phone. */
export function troubleWeek(c, R = Math.random) {
  const out = [];
  if (c.injury && --c.injury.weeks <= 0) { out.push(['Club physio', `You're fit again! ${c.injury.name.replace(/^an? /, '').replace(/^./, s => s.toUpperCase())} all healed.`]); c.injury = null; }
  if (c.ban > 0 && --c.ban <= 0) { out.push([c.flags.prison ? 'HMP Ford' : 'The FA', c.flags.prison ? 'You\'re out. Free to play again. The hard part starts now.' : 'Your ban is over. Try not to do it again.']); c.flags.servedBan = true; }
  // Babies arrive; birthdays happen whether you're there or not.
  if (c.babyDue && c.week >= c.babyDue) {
    c.babyDue = null; const boy = R() < .5, nm = pick(boy ? ['Harry', 'Alfie', 'Leo', 'Teddy', 'Arlo', 'Jude'] : ['Isla', 'Ivy', 'Rosie', 'Maya', 'Florence', 'Bonnie'], R);
    c.kids.push({ name: nm, born: c.week, boy }); c.flags.parent = true;
    out.push(['Mum', `${nm}'s here! ${boy ? 'He' : 'She'}'s got your nose and your partner's everything else. Gran's already bought ${boy ? 'him' : 'her'} a betting slip.`]);
    (c.weekNews = c.weekNews || []).push({ page: 'front', headline: `BABY JOY: ${surname(c)} BECOMES A DAD` });
  }
  c.kids.forEach(k => { if ((c.week - k.born) % 52 === 0 && c.week > k.born) { const busy = c.slotsUsed >= 4 && !c.weekLog.some(x => x.t === 'kids'); if (busy && R() < .6) c.followUps.push({ id: 'missedBirthday', week: c.week + 1 }); } });
  return out;
}
export const kidBills = c => c.kids.length ? [{ what: 'Kids (nursery, nappies and Lego)', amount: 150 * c.kids.length }] : [];

/* ---------- holidays ---------- */
export function holiday(c, id, age, R = Math.random) {
  const h = L2.holidays.find(x => x.id === id);
  if (h.minAge && age < h.minAge) return { ok: false, why: `${h.minAge}+` };
  if (h.needPartner && !c.partner) return { ok: false, why: 'Need a partner' };
  if (h.needKids && !c.kids.length) return { ok: false, why: 'Need kids' };
  if (c.bank < h.cost) return { ok: false, why: 'Skint' };
  c.bank -= h.cost; c.slotsUsed += h.slots; c.weekLog.push({ t: 'holiday', id }); if (id === 'disney' || id === 'caravan') c.weekLog.push({ t: 'kids' });
  applyEffects(c, h.effects);
  if (h.risk && R() < h.risk) { applyEffects(c, { honour: -3 }); (c.weekNews = c.weekNews || []).push({ page: 'front', headline: h.headline.replace('{NAME}', surname(c)) }); }
  return { ok: true, line: h.blurb };
}

/* ---------- redemption ---------- */
export const inDisgrace = c => c.honour < 45 || ['fixingBan', 'prison', 'affair', 'bookieDebt'].some(f => c.flags[f]);
export function memoir(c, honest) {
  c.flags.memoir = true; c.bank += 60000;
  applyEffects(c, honest ? { honour: 12, family: 3 } : { honour: -5, teammates: -10 });
  (c.weekNews = c.weekNews || []).push({ page: 'front', headline: honest ? `${surname(c)}'S HONEST MEMOIR: "I GOT IT ALL WRONG"` : `${surname(c)} BOOK BLAMES EVERYONE ELSE` });
}
/** The sit-down interview: score = sum of answer values. */
export function interviewResult(c, score) {
  const good = score >= 6, bad = score <= 0;
  applyEffects(c, good ? { honour: 14, fans: 6 } : bad ? { honour: -8, fans: -4 } : { honour: 3 });
  c.flags.interviewed = true;
  (c.weekNews = c.weekNews || []).push({ page: 'front', headline: good ? `TEARS AND TRUTH: ${surname(c)}'S DAME FIONA INTERVIEW WINS NATION OVER` : bad ? `CAR CRASH TV: ${surname(c)} FLOUNDERS WITH DAME FIONA` : `${surname(c)} FACES THE MUSIC` });
  return good ? 'great' : bad ? 'bad' : 'ok';
}
export { names, clamp };

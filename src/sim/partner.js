// Your partner: meeting someone, dates, gifts, and where it goes.
import PD from '../data/partners.json';
import { applyEffects, surname } from './life.js';

export { PD };
const pick = (a, R = Math.random) => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const STAGES = { dating: 'Dating', living: 'Living together', engaged: 'Engaged', married: 'Married' };

export function initPartner(c) { if (c.partner === undefined) c.partner = null; c.exes = c.exes || []; c.datePref = c.datePref || null; return c; }
/** Three people you might go on a date with. */
export function candidates(c, R = Math.random) {
  const pools = c.datePref === 'both' ? ['women', 'men'] : [c.datePref || 'women'];
  const used = new Set(c.exes.map(e => e.name.split(' ')[0]));
  return [0, 1, 2].map(() => {
    let first; do { first = pick(PD.names[pick(pools, R)], R); } while (used.has(first)); used.add(first);
    const j = pick(PD.jobs, R);
    return { name: `${first} ${pick(PD.lastNames, R)}`, job: j.job, blurb: j.blurb, quirk: pick(PD.quirks, R), meet: pick(PD.meet, R) };
  });
}
export function startDating(c, cand) {
  c.partner = Object.assign({}, cand, { meter: 45, stage: 'dating', since: c.week, lastDate: c.week, weeks: 0 });
  c.flags.firstPartner = true;
  (c.weekNews = c.weekNews || []).push({ page: 'front', headline: `LOVE-STRUCK ${surname(c)} IN NEW ROMANCE`, weak: true });
}
export function date(c, id, R = Math.random) {
  const d = PD.dates.find(x => x.id === id), p = c.partner;
  if (c.bank < d.cost) return { ok: false, why: 'Can\'t afford it' };
  c.bank -= d.cost; c.slotsUsed++; c.weekLog.push({ t: 'date' }); p.meter = clamp(p.meter + d.gain, 0, 100); p.lastDate = c.week;
  applyEffects(c, { energy: 3 });
  return { ok: true, line: pick(d.lines, R) };
}
export function gift(c, id) {
  const g = PD.gifts.find(x => x.id === id), p = c.partner;
  if (c.bank < g.cost) return { ok: false, why: 'Can\'t afford it' };
  c.bank -= g.cost; p.meter = clamp(p.meter + g.gain, 0, 100); return { ok: true };
}
export function textThem(c) { if (c.weekLog.some(x => x.t === 'text')) return false; c.weekLog.push({ t: 'text' }); c.partner.meter = clamp(c.partner.meter + 1.5, 0, 100); return true; }
export function breakUp(c, why) {
  const p = c.partner; if (!p) return;
  c.exes.push({ name: p.name, weeks: c.week - p.since, why, stage: p.stage }); c.partner = null;
  if (p.stage !== 'dating' && c.home === 'mums') { /* still at Mum's */ }
  applyEffects(c, { family: -2, energy: -5 });
}
/** Weekly: love needs time. Milestones turn up as events. */
export function partnerWeek(c, age, R = Math.random) {
  const p = c.partner; if (!p) return;
  p.weeks++;
  const ignored = c.week - p.lastDate;
  let decay = ignored >= 1 ? 2.5 + Math.min(4, ignored - 1) : 0;
  if (c.rooms && c.rooms.includes('cinema')) decay *= .5;
  if (p.stage === 'married') decay *= .6;
  p.meter = clamp(p.meter - decay, 0, 100);
  const job = PD.jobs.find(j => j.job === p.job); if (job) applyEffects(c, job.perWeek);
  if (p.meter >= 60) applyEffects(c, { energy: 2, family: .3 });
  const queued = id => c.followUps.some(f => f.id === id) || c.pending.some(x => x.id === id);
  if (p.meter < 18 && !queued('partnerEnds')) c.followUps.push({ id: 'partnerEnds', week: c.week + 1 });
  else if (p.stage === 'dating' && age >= 18 && p.weeks >= 12 && p.weeks % 12 === 0 && p.meter >= 70 && !queued('moveIn')) c.followUps.push({ id: 'moveIn', week: c.week + 1 });
  else if (p.stage === 'living' && age >= 20 && p.weeks >= 40 && p.weeks % 20 === 0 && p.meter >= 80 && !queued('propose')) c.followUps.push({ id: 'propose', week: c.week + 1 });
  else if (p.stage === 'engaged' && p.weeks >= 70 && !queued('wedding')) c.followUps.push({ id: 'wedding', week: c.week + 2 });
}
export { pick };

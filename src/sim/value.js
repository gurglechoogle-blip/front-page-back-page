// Market value and club budgets. Pure functions: nothing here changes the career.
// Calibrated against Transfermarkt-style figures (League Two stars ~£0.5-1m,
// League One stars £2-5m, Championship top ~£10-15m, Premier League £15-150m).
import { club } from './season.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ok = v => typeof v === 'number' && Number.isFinite(v);

// What an average regular, aged 25, is worth at each level.
const LEVEL_BASE = { NL: 40e3, L2: 150e3, L1: 600e3, CH: 3e6, PL: 20e6, ES: 18e6, IT: 16e6, DE: 16e6, FR: 13e6 };
const LEAGUE_AVG = { NL: 28, L2: 41, L1: 49, CH: 62, PL: 76, ES: 75, IT: 75, DE: 75, FR: 73 };
const AGE = { 16: 1.6, 17: 2.0, 18: 2.2, 19: 2.1, 20: 1.9, 21: 1.7, 22: 1.45, 23: 1.25, 24: 1.1, 25: 1.0, 26: 1.0, 27: .95, 28: .88, 29: .78, 30: .66, 31: .54, 32: .42, 33: .3, 34: .2 };
export const ageFactor = a => AGE[a] ?? (a < 16 ? 1.6 : .12);

/** Round like a valuation: £5k steps under £100k, £25k under £1m, £100k under £10m, £1m above. */
export function niceMoney(v) {
  if (!ok(v) || v <= 0) return 0;
  const step = v < 1e5 ? 5e3 : v < 1e6 ? 25e3 : v < 1e7 ? 1e5 : 1e6;
  return Math.max(step, Math.round(v / step) * step);
}
export const fmtValue = v => v >= 1e6 ? `£${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, '')}m` : `£${Math.round(v / 1e3)}k`;

/**
 * p: { age, div, clubId, skill (0-100), apps, goals, avg, lastApps, lastGoals, lastAvg, lastDiv, yearsLeft }
 * Returns { value, parts } where parts explains the sum (for the stats screen).
 */
export function marketValue(p) {
  const div = LEVEL_BASE[p.div] ? p.div : 'L2', cl = club(p.clubId) || { strength: LEAGUE_AVG[div] };
  // Level: the league, nudged by how big the club is within it.
  const level = LEVEL_BASE[div] * clamp(1 + ((cl.strength || LEAGUE_AVG[div]) - LEAGUE_AVG[div]) / 30, .6, 1.8);
  // Performance: this season counts most; last season fills in early on.
  const w = clamp((p.apps || 0) / 15, 0, 1);
  const gpg = (n, g) => n ? g / n : 0;
  const nowS = (ok(p.avg) && p.apps ? (p.avg - 6.6) * .9 : 0) + (gpg(p.apps, p.goals) - .35) * 2.2;
  const lastS = (ok(p.lastAvg) && p.lastApps ? (p.lastAvg - 6.6) * .9 : 0) + (gpg(p.lastApps, p.lastGoals) - .35) * 2.2;
  const s = p.apps || p.lastApps ? w * nowS + (1 - w) * (p.lastApps ? lastS : nowS * .5) : -.6;
  const perf = clamp(Math.exp(s * .8), .3, 5);
  // Proven? Nobody pays much for a player they've hardly seen.
  const games = (p.apps || 0) + (p.lastApps || 0) * .6, proven = clamp(.15 + games / 30, .15, 1);
  // The youth premium only fully applies once you've shown it on the pitch.
  const af = ageFactor(p.age), ageF = af > 1 ? 1 + (af - 1) * proven : af;
  const skill = 1 + clamp(p.skill || 0, 0, 100) / 100;
  const contract = !ok(p.yearsLeft) ? 1 : p.yearsLeft < .5 ? .35 : p.yearsLeft < 1 ? .6 : 1;
  const raw = level * perf * Math.max(.3, proven) * ageF * skill * contract;
  return { value: niceMoney(clamp(raw, 10e3, 200e6)), parts: { level, perf, proven, age: ageF, skill, contract } };
}

/** The most a club can pay in a transfer fee (its budget). */
const TOP_MONEY = { PL: 1, ES: .9, DE: .85, IT: .8, FR: .75 };
export function clubBudget(id) {
  const cl = club(id); if (!cl || !ok(cl.strength)) return 0;
  // Top flights: about £20m at the bottom of the Premier League up to ~£150m for the elite.
  if (TOP_MONEY[cl.league]) return niceMoney(Math.max(8e6, (20e6 + (cl.strength - 64) * 6e6) * TOP_MONEY[cl.league]));
  // The Football League: from a few hundred thousand in League Two to ~£20m at the top of the Championship.
  return niceMoney(Math.min(25e6, 1000 * Math.exp(cl.strength * .1423)));
}

/** Read the inputs off a career. */
export function careerValueInputs(c, skill, age, today) {
  const st = c.stats || {}, last = (c.history || [])[c.history.length - 1] || null, senior = (st.apps || 0) - (st.u21 || 0);
  const r = st.ratings || [], avg = r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
  const until = c.contract && c.contract.until;
  const years = until && today ? (Date.parse(until) - Date.parse(today)) / (365.25 * 864e5) : 2;
  return { age, div: c.div, clubId: c.clubId, skill, apps: senior, goals: st.goals || 0, avg, lastApps: last ? Math.max(0, (last.apps || 0) - (last.u21 || 0)) : 0, lastGoals: last ? last.goals || 0 : 0, lastAvg: last ? last.avg : null, lastDiv: last ? last.div : null, yearsLeft: years };
}

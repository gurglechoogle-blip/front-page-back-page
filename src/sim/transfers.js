// Agents, transfer offers, loans, contract talks and moving clubs.
import AG from '../data/agents.json';
import { club, divisionClubs, leagueFixtures, quickResult, weekStart, weekOf, CAL, addDays, seasonYear, ABROAD } from './season.js';
import { applyEffects, surname } from './life.js';

export { AG };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a, R = Math.random) => a[Math.floor(R() * a.length)];
import { clubClauses, standardBonuses } from './contracts.js';
export const agentOf = c => c.agent ? AG.agents.find(a => a.id === c.agent) : null;

/** How the football world rates you, 0-100. */
export function reputation(c, skill, age) {
  const avg = c.stats.ratings.length ? c.stats.ratings.reduce((a, b) => a + b, 0) / c.stats.ratings.length : (c.history.length ? c.history[c.history.length - 1].avg || 6.3 : 6.3);
  const goals = c.stats.goals + (c.history.length ? c.history[c.history.length - 1].goals : 0) * .6;
  const lvl = club(c.clubId).strength;
  // Nobody rates a player they've never seen play: senior games are what count.
  const seen = clamp(seniorApps(c) / 25, .15, 1);
  return clamp((skill * .4 + (avg - 6) * 14 + goals * .9 + lvl * .12) * seen + (c.honour - 50) * .1 - Math.max(0, age - 30) * 3, 0, 100);
}
/** Senior (non-U21) league and cup appearances this season and last, last season counting half. */
export function seniorApps(c) {
  const now = c.stats.apps - (c.stats.u21 || 0), last = c.history.length ? c.history[c.history.length - 1] : null;
  return now + (last ? Math.max(0, (last.apps || 0) - (last.u21 || 0)) * .5 : 0);
}
/** The strength of club you're good enough for. */
const targetStrength = rep => 28 + rep * .68;

/* ---------- transfer windows ---------- */
/** During a window, offers trickle in week by week (with a text to tell you). Returns the new ones. */
export function windowWeek(c, rep, age, R = Math.random) {
  const win = inWindow(c); if (!win || age < 17) return [];
  const year = weekStart(c.week).slice(0, 4);
  if (!c.windowOffers || c.windowOffers.window !== win || c.windowOffers.year !== year) c.windowOffers = { window: win, year, list: [] };
  if (R() > .45) return [];
  const fresh = makeOffers(c, rep, age, win, R).filter(o => !c.windowOffers.list.some(x => x.clubId === o.clubId && x.type === o.type)).slice(0, 1 + (R() < .3 ? 1 : 0));
  c.windowOffers.list.push(...fresh);
  return fresh;
}
export function inWindow(c) {
  const d = weekStart(c.week), y = d.slice(0, 4), md = d.slice(5);
  if (md >= '06-01' && md <= '09-01') return 'summer';
  if (md >= '12-29' || md <= '02-02') return 'january';
  return null;
}
/** Offers from clubs who rate you. */
export function makeOffers(c, rep, age, window, R = Math.random) {
  const ag = agentOf(c), mult = ag ? ag.offers : .8, want = targetStrength(rep);
  const pool = ['PL', 'CH', 'L1', 'L2', ...(rep >= 50 ? ABROAD : [])].flatMap(d => divisionClubs(d)).filter(id => id !== c.clubId && !(c.loan && id === c.loan.parent));
  const scored = pool.map(id => ({ id, d: Math.abs(club(id).strength - want) + R() * 10 })).sort((a, b) => a.d - b.d);
  let n = Math.round((rep / 30 + R()) * mult) + (c.transferListed ? 2 : 0); if (window === 'january') n = Math.round(n * .6);
  // Young and not playing: the phone rings with loan offers from lower down, not Real Madrid.
  const apps = seniorApps(c), unproven = apps < 12;
  let picks = scored;
  if (unproven) picks = scored.filter(x => club(x.id).strength <= club(c.loan ? c.loan.parent : c.clubId).strength - 4 && !ABROAD.includes(club(x.id).league));
  const out = picks.slice(0, clamp(unproven ? Math.min(n, 1) : n, 0, 4)).map(x => offerFrom(c, x.id, rep, age, R));
  // Boyhood club: the dream move, if you're good enough.
  if (c.boyhood && c.boyhood !== c.clubId && Math.abs(club(c.boyhood).strength - want) < 12 && R() < .5 && !out.some(o => o.clubId === c.boyhood)) out.push(offerFrom(c, c.boyhood, rep, age, R));
  // Big club, young, not playing: a loan.
  const myStr = club(c.loan ? c.loan.parent : c.clubId).strength;
  if ((c.wantLoan || age <= 23 && (unproven || myStr > want + 8) && R() < .85)) {
    // Loans: mostly from a division or two below, where you'd actually play.
    const lower = pool.filter(id => club(id).strength < myStr - 6 && !ABROAD.includes(club(id).league)).sort(() => R() - .5);
    const k = unproven ? 1 + (R() < .6 ? 1 : 0) + (R() < .3 ? 1 : 0) : 1;
    lower.slice(0, k).forEach(id => out.unshift(Object.assign(offerFrom(c, id, rep, age, R), { type: 'loan', wage: c.contract.wage, years: 1, fee: 0, role: 'first choice' })));
  }
  return out;
}
function offerFrom(c, id, rep, age, R) {
  const cl = club(id), base = Math.round((cl.strength ** 2.6) / 60 + rep * 18);
  const wage = Math.max(c.contract.wage + 50, Math.round(base * (.8 + R() * .5) * (ABROAD.includes(cl.league) ? 1.3 : 1) / 10) * 10);
  const role = cl.strength > targetStrength(rep) + 6 ? 'squad player' : cl.strength < targetStrength(rep) - 6 ? 'first choice' : 'rotation player';
  return { type: 'transfer', clubId: id, wage, years: 2 + Math.floor(R() * 3), role, fee: Math.round(rep * rep * 120 / 1000) * 1000, dream: id === c.boyhood, clubClauses: clubClauses(R) };
}
/** Your own club offers a new deal when yours is running down. */
export function renewalOffer(c, rep) {
  return { type: 'renewal', clubId: c.clubId, wage: Math.max(c.contract.wage, Math.round((c.contract.wage * 1.15 + rep * 8) / 10) * 10), years: 3, role: 'your current role', fee: 0, clubClauses: clubClauses() };
}
export const contractEnding = c => c.contract.until <= addDays(CAL.seasonEnd, 40);

/* ---------- contract talks ---------- */
/** How much a club wants you: patience for your demands. */
export function patience(c, offer, rep) {
  const ag = agentOf(c);
  return clamp(1 + (rep - (club(offer.clubId).strength - 28) / .68) / 40 + (ag ? ag.haggle : 0), .4, 2);
}
/** ask: { wage, years, imageRights, goalBonus, releaseClause, silly } -> { verdict, counter } */
export function respond(offer, ask, pat, round, R = Math.random) {
  let greed = Math.max(0, ask.wage / offer.wage - 1) * 2.2 + (ask.imageRights ? .25 : 0) + (ask.goalBonus ? ask.goalBonus / offer.wage * .4 : 0) + (ask.assistBonus ? ask.assistBonus / offer.wage * .3 : 0) + (ask.releaseClause ? .2 : 0) + (ask.silly ? .12 : 0) + Math.abs(ask.years - offer.years) * .05;
  greed += round * .08;
  if (greed <= pat * .45) return { verdict: 'accept' };
  if (greed > pat * 1.25 || round >= 3) return greed > pat * .9 ? { verdict: 'walk' } : { verdict: 'accept' };
  const counter = Object.assign({}, ask, { wage: Math.round((offer.wage + (ask.wage - offer.wage) * (pat * .5 / greed)) / 10) * 10 });
  if (R() < .5) counter.silly = null; else if (counter.imageRights && R() < .5) counter.imageRights = false;
  return { verdict: 'counter', counter };
}

/* ---------- signing ---------- */
export function sign(c, offer, terms, midSeason, R = Math.random) {
  const ag = agentOf(c), until = `${seasonYear() + terms.years + (midSeason ? 0 : 1)}-06-30`;
  const prev = c.clubId; c.wantLoan = false; c.transferListed = false;
  // A new loan while already on loan still belongs to the same parent club.
  if (offer.type === 'loan') { c.loan = { parent: c.loan ? c.loan.parent : c.clubId, until: CAL.seasonEnd, prev: c.loan ? c.loan.prev : Object.assign({}, c.contract) }; }
  else if (c.loan && offer.clubId !== c.loan.parent) c.loan = null;
  c.contract = Object.assign({}, c.contract, { kind: offer.type === 'loan' ? `Season-long loan from ${club(prev).name}` : 'Professional contract', label: offer.type === 'loan' ? 'Loan' : offer.type === 'renewal' ? c.contract.label : offer.role, role: offer.type === 'renewal' ? (c.contract.role || c.contract.label) : offer.role, wage: terms.wage, until: offer.type === 'loan' ? c.contract.until : until, clauses: { imageRights: !!terms.imageRights, goalBonus: terms.goalBonus || 0, assistBonus: terms.assistBonus || 0, releaseClause: terms.releaseClause || 0, silly: terms.silly || null, ...standardBonuses(terms.wage), club: offer.clubClauses || [] }, pathway: offer.role === 'first choice' ? .55 : offer.role === 'rotation player' ? .35 : offer.role === 'squad player' ? .15 : c.contract.pathway, housing: false });
  if (ag && offer.type === 'transfer') { const cut = Math.round(offer.fee * .02); c.bank -= Math.min(cut, Math.max(0, c.bank)); }
  if (terms.silly) (c.weekNews = c.weekNews || []).push({ page: 'front', headline: `${surname(c)}'S CONTRACT DEMAND: "${terms.silly.toUpperCase()}"` });
  if (offer.type !== 'renewal') { moveClub(c, offer.clubId, midSeason, R); c.transfers = c.transfers || []; c.transfers.push({ from: prev, to: offer.clubId, season: CAL.season, type: offer.type, fee: offer.fee }); }
  if (offer.dream) { c.flags.dreamMove = true; (c.weekNews = c.weekNews || []).push({ page: 'back', headline: `DREAM COME TRUE: ${surname(c)} SIGNS FOR BOYHOOD CLUB` }); applyEffects(c, { family: 6, fans: 6, honour: 2 }); }
  applyEffects(c, { manager: 55 - c.approval });
}
/** Move clubs. Mid-season: the new division's season so far is filled in; you're cup-tied. */
export function moveClub(c, id, midSeason, R = Math.random) {
  c.clubId = id; const div = club(id).league; c.div = div;
  if (!midSeason) return;
  const today = weekStart(c.week);
  const league = leagueFixtures(div, R).map(f => Object.assign(f, { mine: f.home === id || f.away === id }));
  league.filter(f => f.date < today).forEach(f => Object.assign(f, quickResult(f.home, f.away, {}, R), { played: true }));
  const keep = c.fixtures.filter(f => f.played && f.mine && f.comp !== 'league');
  c.fixtures = [...keep, ...league].sort((a, b) => a.date < b.date ? -1 : 1);
  for (const k in c.cups) c.cups[k].alive = false; c.trophyGroup = null;
}
/** End of a loan: back to the parent club. */
export function endLoan(c) { if (!c.loan) return null; const back = c.loan.parent, prev = c.loan.prev; c.loan = null; c.clubId = back; c.div = club(back).league; if (prev) c.contract = Object.assign({}, prev); else c.contract.kind = 'Professional contract'; return back; }
export { pick, weekOf };

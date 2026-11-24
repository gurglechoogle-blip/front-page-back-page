// Career rules: the week loop, selection, approval, form, energy, money and
// the phone. Pure logic on a plain `career` object (saved whole by gameState).
import academies from '../data/academies.json';
import M from '../data/messages.json';
import {
  CAL, DIVS, club, divisionClubs, leagueFixtures, cupEntries, cupFixture, drawOpponent, nextRound, trophyGroup, europePhase, ABROAD,
  quickResult, winnerOf, weekStart, weekOf, lastWeek, prettyDate, addDays, table, compName, roundName, pickR,
  setWorld, firstWeek, seasonYear,
} from './season.js';
import { endSeason } from './world.js';
import { endLoan, agentOf, inWindow, reputation, windowWeek, setValueSkillSource, valueNow } from './transfers.js';
import { initIntl, maybeCallUp, recordIntl, LEVELS } from './international.js';
import { buildIntlSeason, intlWeek, linkResult } from './intlSchedule.js';
import { initLook, lookFields } from './looks.js';
import { initTrouble, rollInjury, troubleWeek, kidBills } from './trouble.js';
import { initFame, staffBills, fameWeek, hasStaff } from './fame.js';
import { initAch, checkAchievements } from './achievements.js';
import { initInvites, inviteWeek, makeSquad } from './invites.js';
import { matchPay, gafferVerdict, clauseWeek, clauseSummer } from './contracts.js';
import { playoffOverride } from './playoffs.js';
import { computeAwards } from './awards.js';
// The training profile's skill level is handed in by the app (keeps this module DOM-free).
let skillLevelExact = () => 30;
export function setSkillSource(fn) { skillLevelExact = fn; setValueSkillSource(fn); }
import { initMoney, moneyBills, moneyWeek, hasCar, netWorth as worth } from './money.js';
import { initPartner, partnerWeek } from './partner.js';
import { archiveWeek } from './calendar.js';
import { friend as friendOf } from './social.js';
import { initSocial, friendsWeek, nightPenalty, chatWeek } from './social.js';
import { MatchSim } from './matchSim.js';
import { initLife, rollEvents, makePaper, pressAfter, afterMatch, honourPatience, support, familyWeek, taper } from './life.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
export const ACADEMY = academies.types;

/* ---------- academy offers ---------- */
/** 3 offers, or 4 if the scouts rate you (average best drill score, 0-5). */
export function academyOffers(scout, R = Math.random) {
  // Everyone starts at the bottom: three League Two clubs come calling. A better scout
  // report gets you the bigger clubs in the division.
  const used = new Set(), l2 = divisionClubs('L2').slice().sort((a, b) => club(b).strength - club(a).strength);
  const pool = scout >= academies.minScoutForHigh ? l2.slice(0, 10) : scout >= academies.minScoutForFour ? l2.slice(0, 16) : l2;
  return ['pathway', 'money', 'family'].map(t => {
    const A = ACADEMY[t]; let id; let tries = 0;
    do { id = pickR(pool, R); } while (used.has(id) && tries++ < 30);
    used.add(id);
    return { type: t, clubId: id, pitch: pickR(A.pitch, R) };
  });
}

/* ---------- creating a career ---------- */
export function createCareer(name, offer, R = Math.random, extra = {}) {
  const A = ACADEMY[offer.type];
  // Born summer 2009 to summer 2010: 16 now, 17 at some point this season.
  const dob = addDays('2009-09-01', Math.floor(R() * 270));
  setWorld(null); // a new career starts in 2026-27 with the real divisions
  const c = {
    v: 1, name, dob, world: { year: 0, leagues: {}, strength: {} }, totals: { apps: 0, goals: 0, assists: 0, seasons: 0 }, season: CAL.season, clubId: offer.clubId, div: club(offer.clubId).league,
    contract: { type: offer.type, label: A.label, wage: A.wage, signingFee: A.signingFee, coaching: A.coaching, pathway: A.pathway, patience: A.patience, prestige: A.prestige, housing: A.housing, until: '2028-06-30', kind: 'Academy scholarship' },
    week: 0, slotsUsed: 0, weekLog: [], approval: A.approval, form: 50, energy: 80, honour: 50, bank: 50 + A.signingFee,
    stats: { apps: 0, starts: 0, subs: 0, goals: 0, assists: 0, ratings: [], u21: 0 },
    fixtures: [], cups: {}, trophyGroup: null, inbox: [], msgId: 0, matchday: null, lastWeek: null, history: [], seasonOver: false,
  };
  buildSeason(c, R); initLife(c); initMoney(c);
  c.boyhood = extra.boyhood || null; c.spurned = extra.spurned || [];
  c.hometown = c.boyhood ? club(c.boyhood).name.replace(/ (City|Town|United|Rovers|Athletic|Wanderers|Albion|County|Alexandra|Argyle|Hotspur|Stanley|& Hove Albion|North End|Orient|Wednesday)$/, '') : null;
  initSocial(c, R); initPartner(c); initIntl(c); initLook(c, R); initTrouble(c); initFame(c); initAch(c); initInvites(c);
  M.start.forEach(m => message(c, m.from, fill(m.text, { name })));
  if (offer.type === 'money') message(c, 'Unknown number', pickR(M.shark, R).replace(/^Unknown number: /, ''));
  return c;
}
function buildSeason(c, R) {
  buildIntlSeason(c, seasonYear(), R);
  const fx = leagueFixtures(c.div, R).map(f => Object.assign(f, { mine: f.home === c.clubId || f.away === c.clubId }));
  CAL.friendlies.forEach((d, i) => {
    const opp = pickR(divisionClubs(i === 2 ? (c.div === 'PL' ? 'CH' : c.div === 'CH' ? 'L1' : 'L2') : 'NL').filter(id => id !== c.clubId), R);
    fx.push({ id: `friendly-${i + 1}`, comp: 'friendly', date: d, home: i === 2 ? c.clubId : opp, away: i === 2 ? opp : c.clubId, mine: true });
  });
  for (const e of cupEntries(c.clubId)) {
    c.cups[e.comp] = { team: e.team, alive: true, round: e.from, played: [] };
    if (e.comp === 'trophy') { const g = trophyGroup(e.team, R); c.trophyGroup = g.teams; fx.push(...g.fixtures); }
    else if (e.from === 'L') fx.push(...europePhase(e.comp, e.team, R));
    else if (e.comp === 'natcup') { c.cups[e.comp].cupName = e.cupName; fx.push(Object.assign(cupFixture(e.comp, e.from, e.team, drawOpponent(e.comp, e.from, e.team, [], R), R), { cupName: e.cupName })); }
    else fx.push(cupFixture(e.comp, e.from, e.team, drawOpponent(e.comp, e.from, e.team, [], R), R));
  }
  c.fixtures = fx.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

/* ---------- queries ---------- */
export const myTeamIn = (c, f) => f.myTeam || [f.home, f.away].find(id => id === c.clubId || id === c.clubId + '-u21');
export const isMine = (c, f) => !!myTeamIn(c, f);
/** 'W' | 'D' | 'L' from your side's point of view (penalties decide cup ties). */
export function resultFor(c, f) {
  if (!f.played) return '';
  const home = f.home === myTeamIn(c, f), w = winnerOf(f);
  return w == null ? 'D' : (w === f.home) === home ? 'W' : 'L';
}
export const myFixtures = c => c.fixtures.filter(f => isMine(c, f));
export const nextFixture = c => myFixtures(c).find(f => !f.played);
export const weekFixtures = (c, w = c.week) => myFixtures(c).filter(f => !f.played && weekOf(f.date) === w);
export const isPreseason = (c, w = c.week) => weekStart(w) < addDays(DIVS[c.div].start, -6);
/* ---------- days: one activity a day, matches on their actual date ---------- */
export const dayDate = c => addDays(weekStart(c.week), c.day || 0);
const unplayedOn = (c, d) => weekFixtures(c).filter(f => f.date === d && !f.played);
/** Your unplayed fixture today, if any. */
export const todaysFixture = c => unplayedOn(c, dayDate(c))[0] || null;
/** Free days this week (days without one of your matches). */
export const slotsTotal = c => { const ws = weekStart(c.week); let n = 0; for (let d = 0; d < 7; d++) if (!weekFixtures(c).some(f => f.date === addDays(ws, d))) n++; return Math.max(1, n); };
/** How many days of activity you can start today: 0 if you've already done something, or it's a match day.
 * Otherwise the run of free days from today (multi-day things like holidays need several). */
export function slotsLeft(c) {
  consumeDays(c);
  if (c.seasonOver || c.dayUsed === (c.day || 0) || todaysFixture(c)) return 0;
  const ws = weekStart(c.week); let n = 0;
  for (let d = c.day || 0; d <= 6; d++) { if (unplayedOn(c, addDays(ws, d)).length) break; n++; }
  return n;
}
/** Called after anything that used time: today's done (and multi-day things move the clock on). */
export function consumeDays(c) {
  if (c._slotsSeen == null) c._slotsSeen = c.slotsUsed;
  const used = c.slotsUsed - c._slotsSeen; c._slotsSeen = c.slotsUsed;
  (c.weekLog || []).forEach(e => { if (e.day == null) e.day = c.day || 0; });
  if (used <= 0) return;
  // A personal assistant juggles your diary: once a week, a single activity doesn't use up the day.
  if (used === 1 && hasStaff(c, 'pa') && !c.paUsedWeek) { c.paUsedWeek = true; return; }
  c.day = Math.min(6, (c.day || 0) + used - 1); c.dayUsed = c.day;
}
/** Continue: move on a day. Returns 'match' (a game today: play it first), 'day' or 'endweek'. */
export function advanceDay(c) {
  consumeDays(c);
  if (todaysFixture(c)) return 'match';
  if ((c.day || 0) >= 6) return 'endweek';
  if (c.dayUsed !== c.day) c.energy = clamp(c.energy + 3, 0, 100); // a quiet day
  c.day = (c.day || 0) + 1;
  return todaysFixture(c) ? 'match' : 'day';
}
export const age = (c, date = weekStart(c.week)) => { const b = new Date(c.dob), d = new Date(date); let a = d.getFullYear() - b.getFullYear(); if (d < new Date(d.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
export const unread = c => c.inbox.filter(m => !m.read).length + (c.invites || []).filter(v => !v.seen).length;
export const leagueTable = c => table(divisionClubs(c.div), c.fixtures.filter(f => f.comp === 'league'));
export const position = c => leagueTable(c).findIndex(r => r.id === c.clubId) + 1;
export const avgRating = c => c.stats.ratings.length ? c.stats.ratings.reduce((a, b) => a + b, 0) / c.stats.ratings.length : 0;
export const netWorth = c => worth(c);
export function honourBadge(h) { return h >= 81 ? 'National Treasure' : h >= 61 ? 'Good Egg' : h >= 41 ? 'Fresh Face' : h >= 21 ? 'Bit Dodgy' : 'Pantomime Villain'; }
export function weeklyBills(c) {
  const b = [];
  if (c.home === 'mums' || !c.home) b.push({ what: c.contract.housing ? 'Club digs (Mrs Pemberton)' : 'Board to Mum', amount: c.contract.housing ? 0 : 25 });
  b.push({ what: 'Phone contract', amount: 12 });
  if (!hasCar(c)) b.push({ what: 'Bus pass', amount: 15 });
  const ag = agentOf(c); if (ag) b.push({ what: `Agent's cut (${ag.name.split(' ')[0]})`, amount: Math.round(c.contract.wage * ag.fee) });
  return [...b, ...moneyBills(c), ...kidBills(c), ...staffBills(c)];
}
// Club news, the kit man, the physio and the gaffer go on the noticeboard,
// not your phone: texts are for people who want something from you.
const NOTICE = /( News$|^Dennis|^Club physio$|^The Gaffer$|^England$)/;
export function notice(c, from, text) { (c.notices = c.notices || []).unshift({ from, text, week: c.week }); if (c.notices.length > 60) c.notices.length = 60; }
export function message(c, from, text) { if (NOTICE.test(from)) return notice(c, from, text); c.inbox.unshift({ id: ++c.msgId, from, text, week: c.week, read: false }); if (c.inbox.length > 60) c.inbox.length = 60; }

/* ---------- training and rest (time slots) ---------- */
export function logTraining(c, drill, score, gained) {
  c.slotsUsed++; c.weekLog.push({ t: 'train', drill, score, gained });
  c.energy = clamp(c.energy - 8, 0, 100);
  if (score >= 4) c.honour = clamp(c.honour + .5, 0, 100);
}
export function logRest(c) { c.slotsUsed++; c.weekLog.push({ t: 'rest' }); c.energy = clamp(c.energy + 22, 0, 100); }

/* ---------- matchday ---------- */
/** Who picks you? Start, bench or stand. U21 and early-cup games favour the kids. */
// How good you need to be (skill level) before a club's league side will trust you.
// Calibrated to how skill really grows (about 5-8% at 18, 12-18% at 21, 20-30% at 25).
// League One and below: no bar at all. That's the bottom rung, where you play.
const LEVEL_NEEDED = { PL: 22, ES: 22, IT: 22, DE: 22, FR: 20, CH: 10 };
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
/** At least 60 hours between games: anything under three days apart, you rest. */
export const needsRest = (c, f) => !!c.lastPlayed && c.lastPlayed !== f.date && daysBetween(c.lastPlayed, f.date) < 3 && daysBetween(c.lastPlayed, f.date) >= 0 || c.lastPlayed === f.date;
/** Chance a sub actually gets on: the gaffer's trust, your form and this week's training. */
export const subChance = c => clamp(.5 + (c.approval - 50) / 160 + (c.form - 50) / 250 + Math.min(3, (c.weekLog || []).filter(x => x.t === 'train').length) * .05, .3, .93);
/** Out on the town the night before this game? */
export const nightBefore = (c, f) => (c.weekLog || []).some(e => e.t === 'night' && e.day != null && addDays(weekStart(c.week), e.day) === addDays(f.date, -1));
export function selection(c, f, R = Math.random) {
  const hung = nightBefore(c, f); c._hang = hung;
  const r = pickRole(c, f, R); delete c._hang;
  if (hung && r !== 'start' && c.matchday) (c.matchday.why = c.matchday.why || {})[f.id] = 'night';
  return r;
}
function pickRole(c, f, R) {
  if (needsRest(c, f)) { if (c.matchday) (c.matchday.why = c.matchday.why || {})[f.id] = 'rest'; return 'none'; }
  if (f.comp === 'friendly') return R() < .75 ? 'start' : 'sub';
  if (f.comp === 'intl') return c.injury || c.ban > 0 ? 'none' : R() < .7 ? 'start' : 'sub';
  if (c.intlWeek === c.week) return 'none'; // away with England
  if (c.injury || c.ban > 0) return 'none';
  if (myTeamIn(c, f).endsWith('-u21')) return R() < .9 ? 'start' : 'sub';
  // A professional contract (or a loan) says what you were signed to be. That's the
  // starting point; the gaffer's opinion of you and your form move it either way.
  const ROLE = { 'first choice': .8, 'rotation player': .5, 'squad player': .16 }, base = ROLE[c.contract.role || c.contract.label];
  if (base != null) {
    let p = base + (c.approval - 55) / 130 + (c.form - 50) / 220;
    if (f.comp !== 'league') p += ['R1', 'R2', 'G'].includes(f.round) ? .2 : .05;
    if (c.energy < 30) p -= .15;
    if (c.promised >= c.week) p += .2;
    if (c.transferListed) p *= .75;
    if (c._hang) p *= .35; // the gaffer heard about last night
    p = clamp(p, .02, .96);
    const subP = clamp(.4 + base * .4 + (c.approval - 55) / 200, .2, .85) * (c._hang ? .6 : 1), r = R();
    if (r < p) return 'start';
    return r < p + subP * (1 - p) ? 'sub' : 'none';
  }
  // Academy and scholarship deals: approval matters more where there's a real pathway.
  // At an elite academy even the gaffer's favourite kid mostly watches.
  let p = c.contract.pathway + ((c.approval - 50) / 110 + (c.form - 50) / 220) * (.4 + c.contract.pathway);
  if (f.comp !== 'league') p += ['R1', 'R2', 'G'].includes(f.round) ? .3 : .1;
  if (c.energy < 30) p -= .15;
  if (c.promised >= c.week) p += .15;
  if (c.transferListed) p *= .75;
  if (c._hang) p *= .35;
  p = clamp(p, .02, .92);
  // Big clubs don't hand out league minutes: you have to be genuinely good enough.
  let subP = clamp(.35 + c.contract.pathway, .2, .75);
  const need = (LEVEL_NEEDED[club(c.clubId).league] ?? 0) + (club(c.clubId).strength >= 85 ? 8 : 0), gap = skillLevelExact() - need;
  if (need && gap < 0) { const k = f.comp === 'league' ? 1 : .5; p *= Math.max(.005, 1 + gap / (8 / k)); subP *= Math.max(.02, 1 + gap / (12 / k)); }
  if (c._hang) subP *= .6;
  const r = R();
  if (r < p) return 'start';
  return r < p + subP * (1 - p) ? 'sub' : 'none';
}
/** Effective form for the number of chances: tiredness takes the edge off. */
export const effectiveForm = c => clamp(c.form - Math.max(0, 35 - c.energy) - nightPenalty(c), 0, 100) / 100;

/** Start (or resume) this week's matchday: returns the queue of fixture ids. */
export function startMatchday(c) {
  if (!c.matchday) c.matchday = { queue: weekFixtures(c).map(f => f.id), results: [], sel: {} };
  return c.matchday;
}
export function matchParams(c, f, role) {
  const mine = myTeamIn(c, f), mySide = f.home === mine ? 'home' : 'away';
  return {
    home: club(f.home), away: club(f.away), mySide, cup: !!f.knockout, extraTime: !!f.extraTime, role,
    stadium: f.neutral || null, label: compName(f), bigGame: f.round === 'F' || f.comp === 'intl' || f.comp === 'tourn', trust: c.approval / 100, form: effectiveForm(c), fixtureId: f.id, subChance: subChance(c),
    support: support(c), fans: c.meters.fans, year: +CAL.season.slice(0, 4),
  };
}
/** Play a match nobody's watching (you're not in the squad). */
export function playHeadless(c, f) {
  const p = matchParams(c, f, 'none'); const sim = new MatchSim(Object.assign({}, p, { playerName: c.name }));
  let n = 0; while (!sim.done && n++ < 2000) sim.tick();
  return sim;
}
/** Record a finished match of yours (summary from MatchSim.summary()). */
/** Every competitive appearance, for the stats screen. */
export function logApp(c, team, comp, S) {
  (c.appLog = c.appLog || []).push({ s: CAL.season, t: team, c: comp, g: S.my.goals || 0, a: S.my.assists || 0, r: Math.round((S.rating || 0) * 10) / 10 });
}
export function recordMatch(c, f, S, R = Math.random) {
  if (f.link) linkResult(c, f.link, S.score.home, S.score.away);
  Object.assign(f, { played: true, hs: S.score.home, as: S.score.away, role: S.role });
  if (S.pens) f.pens = [S.pens.home, S.pens.away];
  const played = S.role === 'start' || S.role === 'sub';
  const res = { id: f.id, role: S.role, rating: played ? S.rating : null, goals: S.my.goals, assists: S.my.assists, headline: S.headline, unused: !!S.unusedSub, hooked: S.hooked || null, verdict: S.gafferLine || gafferVerdict(S, R) };
  if (played) c.lastPlayed = f.date;
  if (f.date === dayDate(c)) { consumeDays(c); c.dayUsed = c.day; } // a match day is a match day
  if (played && f.comp !== 'friendly') logApp(c, myTeamIn(c, f) || c.clubId, f.comp === 'intl' ? 'intl-' + (f.level || 'senior') : f.comp, S);
  { const mt = myTeamIn(c, f) || c.clubId, opp = club(f.home === mt ? f.away : f.home), us = f.home === mt ? S.score.home : S.score.away, them = f.home === mt ? S.score.away : S.score.home;
    (c.diary = c.diary || {})[f.date] = (c.diary[f.date] || []).concat({ t: 'match', text: `${compName(f)}: ${f.home === mt ? 'v' : '@'} ${opp.name} ${us}-${them}${played ? ` · you: ${S.rating.toFixed(1)}${S.my.goals ? `, ${S.my.goals} goal${S.my.goals > 1 ? 's' : ''}` : ''}` : S.unusedSub ? ' · unused sub' : ' · not involved'}` }); }
  res.pay = matchPay(c, f, S); res.pay.forEach(x => c.bank += x.amount);
  if (played) {
    f.rating = S.rating; f.myGoals = S.my.goals; f.myAssists = S.my.assists;
    if (f.comp === 'intl') recordIntl(c, f, S);
    else if (f.comp !== 'friendly') {
      const st = c.stats; st.apps++; if (S.role === 'start') st.starts++; else st.subs++; st.goals += S.my.goals; st.assists += S.my.assists; st.ratings.push(S.rating);
      if (myTeamIn(c, f).endsWith('-u21')) st.u21++;
    }
    let d = (S.rating - 6.6) * 3; if (d < 0) d *= c.contract.patience * honourPatience(c); if (f.comp === 'friendly' || myTeamIn(c, f).endsWith('-u21')) d *= .5; if (f.comp === 'intl') d = 0;
    d = taper(c.approval, d); c.approval = clamp(c.approval + d, 0, 100); res.approval = d;
    c.energy = clamp(c.energy - (S.role === 'start' ? 18 : 8), 0, 100);
  }
  if (c.granBet && c.granBet.fixture === f.id) {
    const g = c.granBet; c.granBet = null;
    message(c, 'Gran', !played ? pickR(M.granBenched, R) : S.my.goals > 0 ? fill(pickR(M.granWon, R), { win: '£' + g.win }) : pickR(M.granLost, R));
    if (played && S.my.goals > 0) c.flags.granWon = true;
  }
  afterMatch(c, S);
  { const team = myTeamIn(c, f) || ''; checkAchievements(c, 'match', { f, S, played, team, senior: played && f.comp !== 'friendly' && !team.endsWith('-u21') && !(f.level && f.level !== 'senior') }); }
  const inj = rollInjury(c, S, age(c), R);
  if (inj && inj.weeks >= 3) message(c, 'A TV producer', `Sorry to hear about the injury! While you're out, fancy some telly? Punditry, panel shows, maybe even a reality show... Have a look under Football → While you're injured. x`);
  if (inj) { message(c, 'Club physio', `Bad news: ${inj.name}. You're out for ${inj.weeks} week${inj.weeks > 1 ? 's' : ''}. Rest, ice, and no more TikTok dances.`); c.weekNews.push({ page: 'back', headline: `INJURY BLOW FOR ${c.name.trim().split(/\s+/).pop().toUpperCase()}` }); }
  if (played && c.flags.servedBan && c.flags.prison && !c.flags.freeMan) { c.flags.freeMan = true; c.weekNews.push({ page: 'back', headline: `REDEMPTION: ${c.name.trim().split(/\s+/).pop().toUpperCase()} PLAYS AGAIN AFTER PRISON` }); }
  const press = pressAfter(c, f, S, myTeamIn(c, f), R); if (press) c.pending.push(press);
  // Form: your last five ratings.
  const recent = myFixtures(c).filter(x => x.rating != null).slice(-5).map(x => x.rating);
  if (recent.length) c.form = clamp(50 + (recent.reduce((a, b) => a + b, 0) / recent.length - 6.4) * 22, 0, 100);
  if (f.knockout) advanceCup(c, f, R);
  c.matchday.results.push(res); c.matchday.queue = c.matchday.queue.filter(id => id !== f.id);
  return res;
}
function advanceCup(c, f, R) {
  const cup = c.cups[f.comp]; if (!cup) return;
  const won = winnerOf(f) === cup.team; cup.played.push(f.id);
  if (!won) { cup.alive = false; message(c, club(c.clubId).short + ' News', fill(M.cupOut, { cup: cup.cupName || CAL.cups[f.comp].short })); return; }
  const nr = nextRound(f.comp, f.round);
  if (!nr) { cup.alive = false; cup.won = true; message(c, club(c.clubId).short + ' News', `WE'VE WON THE ${(cup.cupName || CAL.cups[f.comp].short).toUpperCase()}! Open-top bus on Sunday. Bring a coat.`); return; }
  drawNext(c, f.comp, nr, R);
}
function drawNext(c, comp, nr, R) {
  const cup = c.cups[comp], opp = drawOpponent(comp, nr, cup.team, cup.played.map(id => { const x = c.fixtures.find(y => y.id === id); return x.home === cup.team ? x.away : x.home; }), R);
  const nf = cupFixture(comp, nr, cup.team, opp, R); cup.round = nr; if (cup.cupName) nf.cupName = cup.cupName;
  c.fixtures.push(nf); c.fixtures.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  message(c, club(c.clubId).short + ' News', fill(M.cupDraw, { cup: cup.cupName || CAL.cups[comp].short, round: roundName(nf), home: club(nf.home).name, away: club(nf.away).name, date: prettyDate(nf.date, true) }));
}

/* ---------- end of the week ---------- */
/** Simulate everyone else's games this week, settle money and approval. */
export function finishWeek(c, R = Math.random) {
  intlWeek(c, addDays(weekStart(c.week), 6), R);
  archiveWeek(c, weekStart(c.week), myFixtures(c).map(f => f.date), id => (friendOf(id) || { name: id }).name);
  const w = c.week, others = c.fixtures.filter(f => !f.played && !isMine(c, f) && weekOf(f.date) <= w);
  others.forEach(f => Object.assign(f, quickResult(f.home, f.away, { knockout: f.knockout, extraTime: f.extraTime }, R), { played: true }));
  // European league phase finished? Ten points usually gets you through.
  for (const comp of ['ucl', 'uel']) {
    const cup = c.cups[comp]; if (!cup || cup.round !== 'L') continue;
    const lf = c.fixtures.filter(f => f.comp === comp && f.round === 'L');
    if (lf.every(f => f.played)) {
      const pts = lf.reduce((a, f) => { const r = resultFor(c, f); return a + (r === 'W' ? 3 : r === 'D' ? 1 : 0); }, 0);
      cup.leaguePts = pts; cup.played.push(...lf.map(f => f.id));
      if (pts >= 10 || (pts >= 7 && R() < .5)) drawNext(c, comp, 'R16', R);
      else { cup.alive = false; message(c, club(c.clubId).short + ' News', `Out of the ${CAL.cups[comp].name} after the league phase with ${pts} points.`); }
    }
  }
  // Trophy group finished? Top two go through.
  if (c.trophyGroup && c.cups.trophy && c.cups.trophy.round === 'G') {
    const gf = c.fixtures.filter(f => f.comp === 'trophy' && f.round === 'G');
    if (gf.every(f => f.played)) {
      const t = table(c.trophyGroup, gf), team = c.cups.trophy.team, pos = t.findIndex(r => r.id === team) + 1;
      c.cups.trophy.groupPos = pos;
      if (pos <= 2) { c.cups.trophy.played.push(...gf.filter(f => isMine(c, f)).map(f => f.id)); drawNext(c, 'trophy', 'R2', R); }
      else { c.cups.trophy.alive = false; message(c, club(c.clubId).short + ' News', `Out of the ${CAL.cups.trophy.short} at the group stage. Finished ${pos}${['st', 'nd', 'rd', 'th'][pos - 1]}.`); }
    }
  }
  // Time slots.
  const log = c.weekLog, drills = log.filter(x => x.t === 'train'), rests = log.filter(x => x.t === 'rest').length, unused = Math.max(0, slotsTotal(c) - c.slotsUsed);
  // Training only ever helps: two or more drills a week and the gaffer notices.
  // Skipping it costs nothing here, you just don't improve.
  const dA = drills.length >= 2 ? taper(c.approval, drills.reduce((a, d) => a + (d.score >= 3 ? 1 : .6), 0)) : 0;
  c.approval = clamp(c.approval + dA, 0, 100);
  c.energy = clamp(c.energy + 12 - Math.max(0, age(c) - 29) * 1.5 * (c.rooms && c.rooms.includes('gym') ? .5 : 1), 0, 100); // recovery slows in your thirties
  familyWeek(c); friendsWeek(c, R);
  troubleWeek(c, R).forEach(([from, text]) => message(c, from, text));
  const wr = (c.matchday ? c.matchday.results : []).filter(r => r.rating != null);
  fameWeek(c, wr.reduce((a, r) => a + (r.goals || 0), 0), wr.length ? wr.reduce((a, r) => a + r.rating, 0) / wr.length : 0, R).forEach(([from, text]) => message(c, from, text));
  checkAchievements(c, 'week');
  if (ABROAD.includes(c.div)) { c.meters.family = clamp(c.meters.family - .8, 0, 100); if (c.partner) c.partner.meter = clamp(c.partner.meter - .6, 0, 100); } partnerWeek(c, age(c), R);
  // Money.
  c.lastWeekDate = weekStart(c.week);
  // Market value, once a week, for the trend.
  { const v = valueNow(c, age(c)); if (Number.isFinite(v)) { c.valueLog = (c.valueLog || []).concat({ d: weekStart(c.week), v }); if (c.valueLog.length > 52) c.valueLog = c.valueLog.slice(-52); } }
  const [fines, fineNotes] = clauseWeek(c, (c.matchday ? c.matchday.results : []).some(r => r.role !== 'none'), R);
  fineNotes.forEach(t => notice(c, 'Contract', t));
  const bills = [...weeklyBills(c), ...fines], out = bills.reduce((a, b) => a + b.amount, 0); c._lastBills = out;
  c.bank += c.contract.wage - out;
  // Image rights and sponsorship: the more the fans love you, the more it pays.
  const cl = c.contract.clauses || {}, ag2 = agentOf(c);
  if (cl.imageRights) { const v = Math.round(c.meters.fans * 3 + c.stats.goals * 10); c.bank += v; bills.push({ what: 'Image rights (shirt sales)', amount: -v }); }
  if (ag2 && ag2.sponsor) { const v = Math.round(c.meters.fans * 4); c.bank += v; bills.push({ what: 'Boot and drinks deals (Saffron)', amount: -v }); }
  moneyWeek(c);
  if (c.bank < 0) c.pending.push({ type: 'debt' });
  const md = c.matchday || { results: [] };
  c.lastWeek = {
    week: w, date: weekStart(w), results: md.results, training: drills.length, rests, unused, approvalTraining: dA,
    wage: c.contract.wage, bills, bank: c.bank, approval: c.approval, form: c.form, energy: c.energy,
    others: others.filter(f => f.comp === 'league').map(f => f.id), pos: position(c),
  };
  c.matchday = null;
  return c.lastWeek;
}
/** Roll on to next week; returns false when the season is over. */
export function nextWeek(c, R = Math.random) {
  buildIntlSeason(c, seasonYear(), R); // no-op if this season's already built (older saves pick it up here)
  c.week++; c.slotsUsed = 0; c.weekLog = []; c.day = 0; c.dayUsed = -1; c._slotsSeen = 0; c.paUsedWeek = false;
  if (c.lastWeek) makePaper(c, R);
  if (c.week > lastWeek() || !myFixtures(c).some(f => !f.played) && weekStart(c.week) > CAL.seasonEnd) { c.seasonOver = true; return false; }
  const ws = weekStart(c.week), we = addDays(ws, 6);
  if (c.dob.slice(5) >= ws.slice(5) && c.dob.slice(5) <= we.slice(5) && age(c, we) === 17) message(c, M.birthday.from, M.birthday.text);
  inviteWeek(c, age(c), Object.values(makeSquad(c.clubId, club(c.clubId).league)).flat(), R);
  const nf = weekFixtures(c)[0];
  if (nf && R() < .15) {
    const opp = club(nf.home === myTeamIn(c, nf) ? nf.away : nf.home), odds = pickR(['3/1', '4/1', '9/2', '6/1', '8/1', '12/1'], R), stake = pickR(M.granStakes, R);
    const n = +odds.split('/')[0], win = Math.round(5 * (n + 1));
    c.granBet = { fixture: nf.id, win };
    message(c, 'Gran', fill(M.granOdds, { odds, stake, opp: opp.name }));
  }
  if (c.contract.type === 'money' && R() < .12) message(c, 'Unknown number', pickR(M.shark, R).replace(/^Unknown number: /, ''));
  c._abroad = ABROAD.includes(c.div);
  rollEvents(c, isPreseason(c), R, age(c), lookFields(c, age(c)).recede || 0);
  delete c._abroad;
  const lvl = maybeCallUp(c, reputation(c, skillLevelExact(), age(c)), age(c), R);
  if (lvl) message(c, 'England', `You've been called up to the England ${LEVELS[lvl] === 'Senior' ? 'senior squad' : LEVELS[lvl]}! Report to St George's Park.${lvl === 'senior' ? ' Gran is already at the bookies.' : ''}`);
  // Transfer windows: offers when January opens, and deadline day at the end of each window.
  const win = inWindow(c);
  if (win === 'january' && !c.janWindowSeen) { c.janWindowSeen = true; c.pending.push({ type: 'window', window: 'january' }); }
  if (win !== 'january') c.janWindowSeen = false;
  windowWeek(c, reputation(c, skillLevelExact(), age(c)), age(c), R).forEach(o => {
    const cl = club(o.clubId), ag = agentOf(c);
    if (c.loan) { message(c, ag ? ag.name : `${club(c.loan.parent).short} (your parent club)`, `${club(c.loan.parent).name} have had ${o.type === 'loan' ? 'a loan' : 'a transfer'} offer for you from ${cl.name}${o.type === 'loan' ? ', to replace your current loan' : ''}. ${o.role === 'squad player' ? 'They\'ve said you wouldn\'t start.' : o.role === 'first choice' ? 'They see you as a starter.' : 'You\'d be rotating.'} Accepting it ends your loan here. Football → Contract & transfers.`); return; }
    message(c, ag ? ag.name : 'The club secretary', o.type === 'loan' ? `${cl.name} want you on loan for the season. You'd be ${o.role === 'first choice' ? 'their first-choice striker' : 'in the squad'}. Have a look: Football → Contract & transfers.` : `${cl.name} have made an offer. ${o.dev ? 'It\'s a development signing: they rate your potential, but you\'d be nowhere near the starting XI.' : o.role === 'squad player' ? 'Be warned: they\'ve been clear you wouldn\'t start.' : o.role === 'first choice' ? 'They see you as a starter.' : 'You\'d be rotating.'} Football → Contract & transfers.`);
  });
  const deadline = d => ws <= d && d <= we;
  if ((deadline(ws.slice(0, 4) + '-02-02') || deadline(ws.slice(0, 4) + '-09-01')) && age(c) >= 17 && R() < .55) c.pending.push({ type: 'deadline' });
  chatWeek(c, R);
  return true;
}
/** In-season week number (1 = first week of pre-season). */
export const seasonWeek = c => c.week - firstWeek() + 1;

/** Summer, part 1: wrap up the season and move the world on a year. */
export function rollWorld(c, R = Math.random) {
  computeAwards(c, age(c)); // the season's awards, before the books close
  const S = seasonSummary(c), oldClub = club(c.clubId);
  c.history.push({ season: CAL.season, club: c.clubId, div: c.div, pos: S.pos, apps: c.stats.apps, u21: c.stats.u21 || 0, goals: c.stats.goals, assists: c.stats.assists, avg: S.avg, cups: Object.fromEntries(Object.entries(c.cups).map(([k, v]) => [k, v.won ? 'won' : v.round])) });
  ['apps', 'goals', 'assists'].forEach(k => c.totals[k] += c.stats[k]); c.totals.seasons++;
  const { world, moves } = endSeason(c.div, c.fixtures, R, playoffOverride(c));
  c.world = world; setWorld(world);
  c.div = club(c.clubId).league;
  const mv = moves.find(m => m.id === c.clubId), news = oldClub.short + ' News';
  c.weekNews = c.weekNews || [];
  if (mv) {
    const up = mv.why !== 'relegated';
    message(c, news, up ? `We're going up to ${DIVS[c.div].name}${mv.why === 'play-offs' ? ' through the play-offs' : ''}! Bigger crowds, better pies.` : `Relegated to ${DIVS[c.div].name}. The chairman's selling the team bus.`);
    c.weekNews.push({ page: 'back', headline: up ? `${oldClub.name.toUpperCase()} GO UP!` : `${oldClub.name.toUpperCase()} GO DOWN` });
  }
  checkAchievements(c, 'season', { pos: S.pos, avg: S.avg, div: c.history[c.history.length - 1].div, wasLoan: !!c.loan, mv });
  clauseSummer(c, mv).forEach(t => notice(c, 'Contract', t));
  if (c.loan) { const back = endLoan(c); message(c, club(back).short + ' News', `Your loan's over. Welcome back to ${club(back).name}. Your peg's still there. Someone's been using it.`); }
  c.summer = { stage: 'window' };
  return { moves, mv };
}
/** Summer, part 2 (after the transfer window): build the new season. */
export function beginSeason(c, R = Math.random) {
  c.div = club(c.clubId).league;
  Object.assign(c, { stats: { apps: 0, starts: 0, subs: 0, goals: 0, assists: 0, ratings: [], u21: 0 }, cups: {}, trophyGroup: null, matchday: null, lastWeek: null, seasonOver: false, slotsUsed: 0, weekLog: [], liveMatch: null, summer: null });
  c.week = firstWeek(); c.season = CAL.season;
  buildSeason(c, R);
  // Still on a scholarship at 18 and nothing signed: the club hands you a first pro deal.
  if (age(c) >= 18 && c.contract.kind === 'Academy scholarship') {
    c.contract = Object.assign({}, c.contract, { kind: 'First professional contract', wage: Math.round(c.contract.wage * 2.5 + 200), until: `${seasonYear() + 2}-06-30` });
    message(c, club(c.clubId).short + ' News', `Your scholarship's up, so here's your first professional contract: £${c.contract.wage} a week.`);
  }
  message(c, 'Mum', `New season, love. ${age(c)} years old! Where does the time go. Clean boots, clean pants.`);
}
/** Both halves, with no transfer business (used by tests). */
export function startNextSeason(c, R = Math.random) { const r = rollWorld(c, R); beginSeason(c, R); return r; }

export function seasonSummary(c) {
  const t = leagueTable(c), pos = t.findIndex(r => r.id === c.clubId) + 1;
  return { pos, of: t.length, row: t[pos - 1], stats: c.stats, avg: avgRating(c), cups: c.cups, approval: c.approval, bank: c.bank };
}

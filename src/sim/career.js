// Career rules: the week loop, selection, approval, form, energy, money and
// the phone. Pure logic on a plain `career` object (saved whole by gameState).
import academies from '../data/academies.json';
import M from '../data/messages.json';
import {
  CAL, DIVS, club, divisionClubs, leagueFixtures, cupEntries, cupFixture, drawOpponent, nextRound, trophyGroup,
  quickResult, winnerOf, weekStart, weekOf, lastWeek, prettyDate, addDays, table, compName, roundName, pickR,
} from './season.js';
import { MatchSim } from './matchSim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
export const ACADEMY = academies.types;

/* ---------- academy offers ---------- */
/** 3 offers, or 4 if the scouts rate you (average best drill score, 0-5). */
export function academyOffers(scout, R = Math.random) {
  const tier = scout >= academies.minScoutForHigh ? 'high' : 'low', used = new Set();
  const types = ['elite', 'pathway', 'money', 'family'];
  if (scout < academies.minScoutForFour) types.splice(1 + Math.floor(R() * 3), 1); // only three clubs come calling
  return types.map(t => {
    const A = ACADEMY[t]; let id; let tries = 0;
    do { id = pickR(A[tier], R); } while (used.has(id) && tries++ < 20);
    used.add(id);
    return { type: t, clubId: id, pitch: pickR(A.pitch, R) };
  });
}

/* ---------- creating a career ---------- */
export function createCareer(name, offer, R = Math.random) {
  const A = ACADEMY[offer.type];
  // Born summer 2009 to summer 2010: 16 now, 17 at some point this season.
  const dob = addDays('2009-09-01', Math.floor(R() * 270));
  const c = {
    v: 1, name, dob, season: CAL.season, clubId: offer.clubId, div: club(offer.clubId).league,
    contract: { type: offer.type, label: A.label, wage: A.wage, signingFee: A.signingFee, coaching: A.coaching, pathway: A.pathway, patience: A.patience, prestige: A.prestige, housing: A.housing, until: '2028-06-30', kind: 'Academy scholarship' },
    week: 0, slotsUsed: 0, weekLog: [], approval: A.approval, form: 50, energy: 80, honour: 50, bank: 50 + A.signingFee,
    stats: { apps: 0, starts: 0, subs: 0, goals: 0, assists: 0, ratings: [], u21: 0 },
    fixtures: [], cups: {}, trophyGroup: null, inbox: [], msgId: 0, matchday: null, lastWeek: null, history: [], seasonOver: false,
  };
  buildSeason(c, R);
  M.start.forEach(m => message(c, m.from, fill(m.text, { name })));
  if (offer.type === 'money') message(c, 'Unknown number', pickR(M.shark, R).replace(/^Unknown number: /, ''));
  return c;
}
function buildSeason(c, R) {
  const fx = leagueFixtures(c.div, R).map(f => Object.assign(f, { mine: f.home === c.clubId || f.away === c.clubId }));
  CAL.friendlies.forEach((d, i) => {
    const opp = pickR(divisionClubs(i === 2 ? (c.div === 'PL' ? 'CH' : c.div === 'CH' ? 'L1' : 'L2') : 'NL').filter(id => id !== c.clubId), R);
    fx.push({ id: `friendly-${i + 1}`, comp: 'friendly', date: d, home: i === 2 ? c.clubId : opp, away: i === 2 ? opp : c.clubId, mine: true });
  });
  for (const e of cupEntries(c.clubId)) {
    c.cups[e.comp] = { team: e.team, alive: true, round: e.from, played: [] };
    if (e.comp === 'trophy') { const g = trophyGroup(e.team, R); c.trophyGroup = g.teams; fx.push(...g.fixtures); }
    else fx.push(cupFixture(e.comp, e.from, e.team, drawOpponent(e.comp, e.from, e.team, [], R), R));
  }
  c.fixtures = fx.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

/* ---------- queries ---------- */
export const myTeamIn = (c, f) => [f.home, f.away].find(id => id === c.clubId || id === c.clubId + '-u21');
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
export const slotsTotal = c => isPreseason(c) ? 6 : 4;
export const slotsLeft = c => slotsTotal(c) - c.slotsUsed;
export const age = (c, date = weekStart(c.week)) => { const b = new Date(c.dob), d = new Date(date); let a = d.getFullYear() - b.getFullYear(); if (d < new Date(d.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
export const unread = c => c.inbox.filter(m => !m.read).length;
export const leagueTable = c => table(divisionClubs(c.div), c.fixtures.filter(f => f.comp === 'league'));
export const position = c => leagueTable(c).findIndex(r => r.id === c.clubId) + 1;
export const avgRating = c => c.stats.ratings.length ? c.stats.ratings.reduce((a, b) => a + b, 0) / c.stats.ratings.length : 0;
export const netWorth = c => c.bank;
export function honourBadge(h) { return h >= 81 ? 'National Treasure' : h >= 61 ? 'Good Egg' : h >= 41 ? 'Fresh Face' : h >= 21 ? 'Bit Dodgy' : 'Pantomime Villain'; }
export function weeklyBills(c) {
  const b = [{ what: c.contract.housing ? 'Club digs (Mrs Pemberton)' : 'Board to Mum', amount: c.contract.housing ? 0 : 25 }, { what: 'Phone contract', amount: 12 }, { what: 'Bus pass', amount: 15 }];
  return b;
}
export function message(c, from, text) { c.inbox.unshift({ id: ++c.msgId, from, text, week: c.week, read: false }); if (c.inbox.length > 60) c.inbox.length = 60; }

/* ---------- training and rest (time slots) ---------- */
export function logTraining(c, drill, score, gained) {
  c.slotsUsed++; c.weekLog.push({ t: 'train', drill, score, gained });
  c.energy = clamp(c.energy - 8, 0, 100);
  if (score >= 4) c.honour = clamp(c.honour + .5, 0, 100);
}
export function logRest(c) { c.slotsUsed++; c.weekLog.push({ t: 'rest' }); c.energy = clamp(c.energy + 22, 0, 100); }

/* ---------- matchday ---------- */
/** Who picks you? Start, bench or stand. U21 and early-cup games favour the kids. */
export function selection(c, f, R = Math.random) {
  if (f.comp === 'friendly') return R() < .75 ? 'start' : 'sub';
  if (myTeamIn(c, f).endsWith('-u21')) return R() < .9 ? 'start' : 'sub';
  // Approval matters more where there's a real pathway: at an elite academy
  // even the gaffer's favourite kid mostly watches.
  let p = c.contract.pathway + ((c.approval - 50) / 110 + (c.form - 50) / 220) * (.4 + c.contract.pathway);
  if (f.comp !== 'league') p += ['R1', 'R2', 'G'].includes(f.round) ? .3 : .1;
  if (c.energy < 30) p -= .15;
  p = clamp(p, .02, .92);
  const r = R();
  if (r < p) return 'start';
  return r < p + clamp(.35 + c.contract.pathway, .2, .75) * (1 - p) ? 'sub' : 'none';
}
/** Effective form for the number of chances: tiredness takes the edge off. */
export const effectiveForm = c => clamp(c.form - Math.max(0, 35 - c.energy), 0, 100) / 100;

/** Start (or resume) this week's matchday: returns the queue of fixture ids. */
export function startMatchday(c) {
  if (!c.matchday) c.matchday = { queue: weekFixtures(c).map(f => f.id), results: [], sel: {} };
  return c.matchday;
}
export function matchParams(c, f, role) {
  const mine = myTeamIn(c, f), mySide = f.home === mine ? 'home' : 'away';
  return {
    home: club(f.home), away: club(f.away), mySide, cup: !!f.knockout, extraTime: !!f.extraTime, role,
    stadium: f.neutral || null, label: compName(f), trust: c.approval / 100, form: effectiveForm(c), fixtureId: f.id,
  };
}
/** Play a match nobody's watching (you're not in the squad). */
export function playHeadless(c, f) {
  const p = matchParams(c, f, 'none'); const sim = new MatchSim(Object.assign({}, p, { playerName: c.name }));
  let n = 0; while (!sim.done && n++ < 2000) sim.tick();
  return sim;
}
/** Record a finished match of yours (summary from MatchSim.summary()). */
export function recordMatch(c, f, S, R = Math.random) {
  Object.assign(f, { played: true, hs: S.score.home, as: S.score.away, role: S.role });
  if (S.pens) f.pens = [S.pens.home, S.pens.away];
  const played = S.role === 'start' || S.role === 'sub';
  const res = { id: f.id, role: S.role, rating: played ? S.rating : null, goals: S.my.goals, assists: S.my.assists, headline: S.headline };
  if (played) {
    f.rating = S.rating; f.myGoals = S.my.goals; f.myAssists = S.my.assists;
    if (f.comp !== 'friendly') {
      const st = c.stats; st.apps++; if (S.role === 'start') st.starts++; else st.subs++; st.goals += S.my.goals; st.assists += S.my.assists; st.ratings.push(S.rating);
      if (myTeamIn(c, f).endsWith('-u21')) st.u21++;
    }
    let d = (S.rating - 6.6) * 3; if (d < 0) d *= c.contract.patience; if (f.comp === 'friendly' || myTeamIn(c, f).endsWith('-u21')) d *= .5;
    c.approval = clamp(c.approval + d, 0, 100); res.approval = d;
    c.energy = clamp(c.energy - (S.role === 'start' ? 18 : 8), 0, 100);
    if (S.rating < 5.5) message(c, 'The Gaffer', pickR(M.gafferAngry, R).replace(/^The Gaffer: /, ''));
    if (S.rating >= 8) message(c, 'The Gaffer', pickR(M.gafferHappy, R).replace(/^The Gaffer: /, ''));
  }
  if (c.granBet && c.granBet.fixture === f.id) {
    const g = c.granBet; c.granBet = null;
    message(c, 'Gran', !played ? pickR(M.granBenched, R) : S.my.goals > 0 ? fill(pickR(M.granWon, R), { win: '£' + g.win }) : pickR(M.granLost, R));
  }
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
  if (!won) { cup.alive = false; message(c, club(c.clubId).short + ' News', fill(M.cupOut, { cup: CAL.cups[f.comp].short })); return; }
  const nr = nextRound(f.comp, f.round);
  if (!nr) { cup.alive = false; cup.won = true; message(c, club(c.clubId).short + ' News', `WE'VE WON THE ${CAL.cups[f.comp].short.toUpperCase()}! Open-top bus on Sunday. Bring a coat.`); return; }
  drawNext(c, f.comp, nr, R);
}
function drawNext(c, comp, nr, R) {
  const cup = c.cups[comp], opp = drawOpponent(comp, nr, cup.team, cup.played.map(id => { const x = c.fixtures.find(y => y.id === id); return x.home === cup.team ? x.away : x.home; }), R);
  const nf = cupFixture(comp, nr, cup.team, opp, R); cup.round = nr;
  c.fixtures.push(nf); c.fixtures.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  message(c, club(c.clubId).short + ' News', fill(M.cupDraw, { cup: CAL.cups[comp].short, round: roundName(nf), home: club(nf.home).name, away: club(nf.away).name, date: prettyDate(nf.date, true) }));
}

/* ---------- end of the week ---------- */
/** Simulate everyone else's games this week, settle money and approval. */
export function finishWeek(c, R = Math.random) {
  const w = c.week, others = c.fixtures.filter(f => !f.played && !isMine(c, f) && weekOf(f.date) <= w);
  others.forEach(f => Object.assign(f, quickResult(f.home, f.away, { knockout: f.knockout, extraTime: f.extraTime }, R), { played: true }));
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
  const dA = drills.length >= 2 ? drills.reduce((a, d) => a + (d.score >= 3 ? 1 : .6), 0) : 0;
  c.approval = clamp(c.approval + dA, 0, 100);
  c.energy = clamp(c.energy + 12, 0, 100);
  // Money.
  const bills = weeklyBills(c), out = bills.reduce((a, b) => a + b.amount, 0);
  c.bank += c.contract.wage - out;
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
  c.week++; c.slotsUsed = 0; c.weekLog = [];
  if (c.week > lastWeek() || !myFixtures(c).some(f => !f.played) && weekStart(c.week) > CAL.seasonEnd) { c.seasonOver = true; return false; }
  const ws = weekStart(c.week), we = addDays(ws, 6);
  if (c.dob.slice(5) >= ws.slice(5) && c.dob.slice(5) <= we.slice(5) && age(c, we) === 17) message(c, M.birthday.from, M.birthday.text);
  const nf = weekFixtures(c)[0];
  if (nf) {
    const opp = club(nf.home === myTeamIn(c, nf) ? nf.away : nf.home), odds = pickR(['3/1', '4/1', '9/2', '6/1', '8/1', '12/1'], R), stake = pickR(M.granStakes, R);
    const n = +odds.split('/')[0], win = Math.round(5 * (n + 1));
    c.granBet = { fixture: nf.id, win };
    message(c, 'Gran', fill(M.granOdds, { odds, stake, opp: opp.name }));
  }
  if (R() < .2) message(c, 'Dennis (kit man)', pickR(M.kitman, R).replace(/^Dennis \(kit man\): /, ''));
  if (c.contract.type === 'money' && R() < .12) message(c, 'Unknown number', pickR(M.shark, R).replace(/^Unknown number: /, ''));
  return true;
}
export function seasonSummary(c) {
  const t = leagueTable(c), pos = t.findIndex(r => r.id === c.clubId) + 1;
  return { pos, of: t.length, row: t[pos - 1], stats: c.stats, avg: avgRating(c), cups: c.cups, approval: c.approval, bank: c.bank };
}

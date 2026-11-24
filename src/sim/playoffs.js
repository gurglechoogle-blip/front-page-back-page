// Your own play-offs: if your club finishes in the play-off places, you play a
// two-legged semi-final and (if you get through) a one-off final at Wembley.
// The result decides who goes up; the rest of the world's play-offs stay simulated.
import { DIVS, club, CAL, addDays, quickResult, winnerOf } from './season.js';

const NAMES = { CH: 'Championship', L1: 'League One', L2: 'League Two', NL: 'National League' };
const pick = (a, R) => a[Math.floor(R() * a.length)];

/** Is your club in the play-off places (and the play-offs not yet played)? pos: final league position. */
export function playoffEligible(c, pos) {
  const P = DIVS[c.div] && DIVS[c.div].places;
  if (!P || !P.playoffs || !NAMES[c.div]) return false;
  return pos >= P.playoffs[0] && pos <= P.playoffs[1] && !(c.playoff && c.playoff.season === c.season && c.playoff.done);
}
/** Set up the semis from the final table (ids in order). */
export function setupPlayoffs(c, tableIds, R = Math.random) {
  const P = DIVS[c.div].places, po = tableIds.slice(P.playoffs[0] - 1, P.playoffs[1]);
  const me = c.clubId, i = po.indexOf(me), partner = po[3 - i], others = po.filter(id => id !== me && id !== partner);
  const end = CAL.seasonEnd, name = `${NAMES[c.div]} play-off`;
  // Higher seed (better league position) at home in the second leg.
  const higher = i < 3 - i ? me : partner, lower = higher === me ? partner : me;
  const mk = (id, date, home, away, round, label, extra) => Object.assign({ id, comp: 'playoff', round, label, date, home, away, myTeam: me, mine: true, div: c.div }, extra || {});
  c.playoff = {
    season: c.season, div: c.div, name, seeds: po, partner, others, stage: 'semi', done: false, winner: null, result: null,
    fixtures: [
      mk('po-s1', addDays(end, 4), lower, higher, 'S1', `${name} semi-final, first leg`),
      mk('po-s2', addDays(end, 8), higher, lower, 'S2', `${name} semi-final, second leg`),
    ],
  };
  // The other semi, simulated over two legs.
  const [a, b] = others, l1 = quickResult(b, a, {}, R), l2 = quickResult(a, b, {}, R), aggA = l1.as + l2.hs, aggB = l1.hs + l2.as;
  const otherWinner = aggA > aggB ? a : aggB > aggA ? b : (R() < .5 + (club(a).strength - club(b).strength) / 80 ? a : b);
  c.playoff.otherSemi = { a, b, l1: [l1.hs, l1.as], l2: [l2.hs, l2.as], winner: otherWinner, pens: aggA === aggB };
  return c.playoff;
}
export const nextPlayoffFixture = c => c.playoff && c.playoff.fixtures.find(f => !f.played) || null;
/** After one of your play-off games has been recorded: move the play-offs on. */
export function advancePlayoffs(c, R = Math.random) {
  const PO = c.playoff, me = c.clubId, [s1, s2, fin] = PO.fixtures;
  if (PO.stage === 'semi' && s1.played && s2.played) {
    const mine = f => f.home === me ? f.hs : f.as, theirs = f => f.home === me ? f.as : f.hs;
    const forMe = mine(s1) + mine(s2), against = theirs(s1) + theirs(s2);
    let through = forMe > against;
    if (forMe === against) {
      // Level on aggregate: penalties after the second leg.
      through = R() < .5 + (club(me).strength - club(PO.partner).strength) / 80;
      const mp = 3 + Math.floor(R() * 3), tp = through ? mp - 1 - Math.floor(R() * 2) : mp + 1;
      PO.semiPens = through ? [mp, Math.max(0, tp)] : [Math.max(0, mp - 1), mp];
    }
    PO.semiAgg = [forMe, against];
    if (!through) { PO.stage = 'out'; PO.done = true; PO.result = 'Out in the semi-finals'; PO.winner = finalWinnerWithout(c, R); return; }
    PO.stage = 'final';
    const opp = PO.otherSemi.winner, home = R() < .5;
    PO.fixtures.push({ id: 'po-f', comp: 'playoff', round: 'F', label: `${PO.name} final`, date: addDays(CAL.seasonEnd, 22), home: home ? me : opp, away: home ? opp : me, myTeam: me, mine: true, div: PO.div, knockout: true, extraTime: true, neutral: 'Wembley Stadium' });
    return;
  }
  if (PO.stage === 'final' && fin && fin.played) {
    const won = winnerOf(Object.assign({}, fin)) === me;
    PO.stage = 'done'; PO.done = true; PO.result = won ? 'PROMOTED via the play-offs!' : 'Lost the play-off final';
    PO.winner = won ? me : (fin.home === me ? fin.away : fin.home);
  }
}
// Out in the semis: the other two finalists play it out.
function finalWinnerWithout(c, R) {
  const PO = c.playoff, a = PO.partner, b = PO.otherSemi.winner;
  const f = Object.assign({ home: a, away: b }, quickResult(a, b, { knockout: true, extraTime: true, neutral: true }, R));
  PO.otherFinal = { home: a, away: b, hs: f.hs, as: f.as, pens: f.pens || null };
  return winnerOf(f);
}
/** For the end of the season: who your play-offs sent up. */
export const playoffOverride = c => c.playoff && c.playoff.done && c.playoff.season === c.season ? { [c.playoff.div]: c.playoff.winner } : {};
export { pick };

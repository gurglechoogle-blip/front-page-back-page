// England's real-shaped international calendar, built a season at a time.
// - Autumn of a tournament year (2026, 2028...): Nations League, a group of four,
//   six games over the September, October and November breaks. 2026-27 is the
//   real draw: Spain, Czechia and Croatia, in the real order.
// - The following March: a Nations League quarter-final (two legs) if England
//   finished in the top two, otherwise friendlies.
// - Autumn of the year before a tournament (2027, 2029...): qualifiers against
//   European sides only, a group of four, home and away. Top two qualify.
// - March of a tournament year: warm-up friendlies against anyone.
import NAT from '../data/nations.json';
import { club, CAL, addDays, quickResult, table } from './season.js';

const ENG = 'nat-eng';
const shuffle = (a, R) => a.map(v => [R(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
const euro = () => NAT.europeans.filter(id => id !== ENG);
const strong = () => euro().filter(id => club(id).strength >= 76);
const mid = () => euro().filter(id => club(id).strength >= 66 && club(id).strength < 76);
const weak = () => euro().filter(id => club(id).strength < 66);

/** The two match dates in an international break (Sat + Tue, or Thu + Sun in November). */
export function breakDates(sat) { return sat.slice(5, 7) === '11' ? [addDays(sat, -2), addDays(sat, 1)] : [sat, addDays(sat, 3)]; }

/** A double round-robin for four teams across three breaks, England's games in a fixed order. */
function groupFixtures(comp, teams, breaks, label) {
  const [e, a, b, d] = teams, fx = [];
  // England's order (matches 2026-27): H a, A b | A d, H b | H d, A a. Others play alongside.
  const rounds = [[[e, a], [b, d]], [[b, e], [d, a]], [[d, e], [a, b]], [[e, b], [a, d]], [[e, d], [b, a]], [[a, e], [d, b]]];
  rounds.forEach((pairs, r) => {
    const date = breakDates(breaks[Math.floor(r / 2)])[r % 2];
    pairs.forEach(([h, aw]) => fx.push({ id: `${comp}-${r}-${h}-${aw}`, comp, date, home: h, away: aw, label, england: h === e || aw === e }));
  });
  return fx;
}
/** Build this season's senior internationals. Y = the year the season starts. */
export function buildIntlSeason(c, Y, R = Math.random) {
  const breaks = CAL.internationalBreakWeekends.slice().sort();
  if (breaks.length < 4) return;
  c.intlComps = (c.intlComps || []).filter(x => x.season >= Y - 3);
  if (c.intlComps.some(x => x.season === Y)) return;
  const autumn = breaks.slice(0, 3), march = breaks[3];
  if (Y % 2 === 0) {
    const opps = Y === 2026 ? ['nat-esp', 'nat-cze', 'nat-cro'] : shuffle(strong(), R).slice(0, 3);
    const id = `nl${Y}`;
    c.intlComps.push({ id, season: Y, type: 'nl', name: `Nations League ${Y}-${String(Y + 1).slice(2)}`, short: 'Nations League', teams: [ENG, ...opps], fixtures: groupFixtures(id, [ENG, ...opps], autumn, `Nations League ${Y === 2026 ? 'A3' : 'A'}`), march });
  } else {
    const target = Y + 1, euroYear = target % 4 === 0, name = euroYear ? `Euro ${target}` : `World Cup ${target}`;
    const opps = [shuffle(mid(), R)[0], ...shuffle(weak(), R).slice(0, 2)];
    const id = `q${target}`;
    c.intlComps.push({ id, season: Y, type: 'qual', target, name: `${name} qualifying`, short: `${name} qualifier`, teams: [ENG, ...opps], fixtures: groupFixtures(id, [ENG, ...opps], autumn, `${name} qualifier`) });
    c.intlComps.push(friendlies(`f${Y}`, Y, march, R, 'Warm-up friendly'));
  }
}
function friendlies(id, Y, sat, R, label = 'International friendly') {
  const pool = shuffle(NAT.nations.map(n => n.id).filter(x => x !== ENG && club(x).strength >= 68), R).slice(0, 2);
  const [d1, d2] = breakDates(sat);
  return { id, season: Y, type: 'friendly', name: `Friendlies (March ${+sat.slice(0, 4)})`, short: 'Friendly', teams: [ENG, ...pool], fixtures: [{ id: `${id}-0`, comp: id, date: d1, home: ENG, away: pool[0], label, england: true }, { id: `${id}-1`, comp: id, date: d2, home: pool[1], away: ENG, label, england: true }] };
}
/** After the autumn: Nations League quarter-final or friendlies in March. Called weekly; does it once. */
function marchFixtures(c, R) {
  const nl = (c.intlComps || []).find(x => x.type === 'nl' && !x.marchDone && x.fixtures.every(f => f.played));
  if (!nl) return;
  nl.marchDone = true;
  const pos = table(nl.teams, nl.fixtures).findIndex(r => r.id === ENG) + 1;
  nl.finish = pos;
  if (pos <= 2) {
    const opp = shuffle(strong().filter(x => !nl.teams.includes(x)), R)[0], [d1, d2] = breakDates(nl.march), id = `nlqf${nl.season}`;
    c.intlComps.push({ id, season: nl.season, type: 'nlqf', name: 'Nations League quarter-final', short: 'Nations League QF', teams: [ENG, opp], fixtures: [{ id: `${id}-0`, comp: id, date: d1, home: opp, away: ENG, label: 'Nations League quarter-final, first leg', england: true }, { id: `${id}-1`, comp: id, date: d2, home: ENG, away: opp, label: 'Nations League quarter-final, second leg', england: true }] });
  } else c.intlComps.push(friendlies(`f${nl.season}`, nl.season, nl.march, R));
}
/** England's senior fixtures in a date range. */
export function englandFixtures(c, from, to) {
  return (c.intlComps || []).flatMap(x => x.fixtures).filter(f => f.england && f.date >= from && f.date <= to && !f.played);
}
/** End of a week: play every international fixture that's due and isn't yours to play. */
export function intlWeek(c, weekEnd, R = Math.random) {
  marchFixtures(c, R);
  for (const comp of c.intlComps || []) for (const f of comp.fixtures) {
    if (f.played || f.date > weekEnd || f.mine) continue;
    Object.assign(f, quickResult(f.home, f.away, { neutral: false }, R), { played: true });
  }
  // Qualifying done: did England make it?
  for (const q of (c.intlComps || []).filter(x => x.type === 'qual' && x.qualified == null && x.fixtures.every(f => f.played))) {
    const pos = table(q.teams, q.fixtures).findIndex(r => r.id === ENG) + 1;
    q.finish = pos; q.qualified = pos <= 2;
    (c.qualified = c.qualified || {})[q.target] = q.qualified;
  }
}
/** Has England qualified for this summer's tournament? (Euro 2028: co-hosts, so yes.) */
export function qualifiedFor(c, year) {
  if (year === 2028 || year === 2046) return true;
  const q = (c.qualified || {})[year];
  return q !== false;
}
/** Record your result back into the competition. */
export function linkResult(c, linkId, hs, as) {
  for (const comp of c.intlComps || []) { const f = comp.fixtures.find(x => x.id === linkId); if (f) { Object.assign(f, { hs, as, played: true }); return; } }
}
export const compTable = comp => table(comp.teams, comp.fixtures.filter(f => f.played));

// England: youth and senior call-ups in international breaks, and summer
// tournaments (real ones while they exist, invented after).
import NAT from '../data/nations.json';
import { club, CAL, weekStart, addDays, quickResult, winnerOf, table } from './season.js';
import { applyEffects, surname } from './life.js';

const pick = (a, R = Math.random) => a[Math.floor(R() * a.length)];
export const LEVELS = { u17: 'Under-17s', u19: 'Under-19s', u21: 'Under-21s', senior: 'Senior' };
export function initIntl(c) { c.intl = c.intl || { caps: { u17: 0, u19: 0, u21: 0, senior: 0 }, goals: { u17: 0, u19: 0, u21: 0, senior: 0 }, tournaments: [] }; return c; }

/** Which England side would pick you, if any. */
// Senior call-ups need proper top-flight football (or a decent youth record and
// regular games at the next level down). Youth call-ups need you to be playing.
const TOP = ['PL', 'ES', 'IT', 'DE', 'FR'];
function topFlightApps(c) {
  const now = TOP.includes(c.div) ? c.stats.apps - (c.stats.u21 || 0) : 0, last = c.history.length ? c.history[c.history.length - 1] : null;
  return now + (last && TOP.includes(last.div) ? Math.max(0, last.apps - (last.u21 || 0)) : 0);
}
const youthCaps = c => c.intl ? c.intl.caps.u17 + c.intl.caps.u19 + c.intl.caps.u21 : 0;
export function levelFor(age, rep, c) {
  const playing = !c || c.stats.apps >= 3 || (c.history.length && c.history[c.history.length - 1].apps >= 8);
  if (c && rep >= 60 && age >= 18 && (topFlightApps(c) >= 8 || (youthCaps(c) >= 4 && c.stats.apps - (c.stats.u21 || 0) >= 15 && c.div === 'CH'))) return 'senior';
  if (!playing) return null;
  if (age <= 16) return rep >= 22 ? 'u17' : null;
  if (age <= 18) return rep >= 28 ? 'u19' : null;
  if (age <= 20) return rep >= 36 ? 'u21' : null;
  return null;
}
const teamId = level => level === 'senior' ? 'nat-eng' : `nat-eng-${level}`;
/** The Saturday of an international break in this week, if there is one. */
export function breakIn(c) { const ws = weekStart(c.week), we = addDays(ws, 6); return CAL.internationalBreakWeekends.find(d => d >= ws && d <= we) || null; }

function opponent(strength, R, pool) {
  const ids = (pool || NAT.nations.map(n => n.id)).filter(id => id !== 'nat-eng');
  const scored = ids.map(id => ({ id, d: Math.abs(club(id).strength - strength) + R() * 14 })).sort((a, b) => a.d - b.d);
  return scored[Math.floor(R() * 4)].id;
}
/** International break: maybe a call-up, and a match for England this week. */
export function maybeCallUp(c, rep, age, R = Math.random) {
  const date = breakIn(c), level = date && levelFor(age, rep, c);
  if (!level || c.intlWeek === c.week) return null;
  const mine = teamId(level), next = NAT.tournaments.find(t => t.year > +date.slice(0, 4) || (t.year === +date.slice(0, 4) && date.slice(5) < '06-01'));
  const oppBase = opponent(club('nat-eng').strength, R), opp = level === 'senior' ? oppBase : `${oppBase}-${level}`;
  const label = level === 'senior' ? (next ? `${next.name} qualifier` : 'International friendly') : `${LEVELS[level]} ${R() < .5 ? 'European Championship qualifier' : 'friendly'}`;
  const home = R() < .5;
  c.fixtures.push({ id: `intl-${c.week}`, comp: 'intl', level, label: `England ${label}`, date, home: home ? mine : opp, away: home ? opp : mine, myTeam: mine, mine: true });
  c.fixtures.sort((a, b) => a.date < b.date ? -1 : 1);
  c.intlWeek = c.week;
  return level;
}
/** After an England match. */
export function recordIntl(c, f, S) {
  const L = f.level || 'senior', played = S.role !== 'none';
  if (!played) return;
  const first = !c.intl.caps[L];
  c.intl.caps[L]++; c.intl.goals[L] += S.my.goals;
  if (L === 'senior') { applyEffects(c, { fans: 2, honour: 1 }); if (first) { c.flags.firstCap = true; (c.weekNews = c.weekNews || []).push({ page: 'back', headline: `THREE LIONS ON HIS SHIRT: ${surname(c)} WINS FIRST CAP` }); } }
}

/* ---------- tournaments ---------- */
export const tournamentFor = year => NAT.tournaments.find(t => t.year === year);
const ROUNDS = ['R16', 'QF', 'SF', 'F'], RNAME = { R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', F: 'Final' };
/** selected: you're in the squad. role: 'start' or 'sub'. */
export function createTournament(c, t, selected, role, R = Math.random) {
  const pool = t.type === 'euro' ? NAT.europeans : NAT.nations.map(n => n.id).filter(id => id !== 'nat-eng');
  const strong = pool.filter(id => club(id).strength >= 80), rest = pool.filter(id => club(id).strength < 80);
  const group = ['nat-eng', pick(strong, R), ...rest.sort(() => R() - .5).slice(0, 2)];
  const fx = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]].map(([a, b], i) => ({ id: `t-G${Math.floor(i / 2) + 1}-${group[a]}-${group[b]}`, comp: 'tourn', round: 'G', label: `${t.name} group stage`, home: group[a], away: group[b], myTeam: group[a] === 'nat-eng' || group[b] === 'nat-eng' ? 'nat-eng' : null }));
  c.tournament = { name: t.name, year: t.year, hosts: t.hosts, final: t.final, type: t.type, selected, role, group, fixtures: fx, alive: true, stage: 'G', result: null, finale: t.year === 2046 };
  return c.tournament;
}
export const nextEngland = T => T.fixtures.find(f => f.myTeam && !f.played);
/** Record England's game (S from a match, or a quick result) and move the tournament on. */
export function tournamentRecord(c, f, res, R = Math.random) {
  const T = c.tournament;
  Object.assign(f, { played: true, hs: res.hs, as: res.as, pens: res.pens || null });
  if (f.round === 'G') {
    const other = T.fixtures[T.fixtures.indexOf(f) ^ 1]; // the group's other game that matchday
    if (other && !other.played) Object.assign(other, quickResult(other.home, other.away, { neutral: true }, R), { played: true });
    if (T.fixtures.filter(x => x.round === 'G').every(x => x.played)) {
      const tab = table(T.group, T.fixtures.filter(x => x.round === 'G')), pos = tab.findIndex(r => r.id === 'nat-eng') + 1;
      T.groupPos = pos;
      if (pos > 2) return out(c, `${T.name}: out in the group stage. ${pos}${pos === 3 ? 'rd' : 'th'} in the group.`);
      return draw(c, 'R16', R);
    }
    return;
  }
  const won = winnerOf(Object.assign({}, f)) === 'nat-eng';
  if (!won) return out(c, `${T.name}: out in the ${RNAME[f.round].toLowerCase()}.`);
  if (f.round === 'F') { T.alive = false; T.result = 'WINNERS'; c.intl.tournaments.push({ name: T.name, result: 'Winners' }); c.flags.wonTournament = true; return; }
  return draw(c, ROUNDS[ROUNDS.indexOf(f.round) + 1], R);
}
function draw(c, round, R) {
  const T = c.tournament, pool = (T.type === 'euro' ? NAT.europeans : NAT.nations.map(n => n.id).filter(id => id !== 'nat-eng')).filter(id => !T.fixtures.some(f => f.home === id || f.away === id) || round === 'F');
  const want = 72 + ROUNDS.indexOf(round) * 4;
  // The 2046 final is always against Germany.
  const opp = round === 'F' && T.finale ? 'nat-ger' : opponent(want, R, pool);
  T.stage = round;
  T.fixtures.push({ id: `t-${round}`, comp: 'tourn', round, label: `${T.name} ${RNAME[round].toLowerCase()}`, home: R() < .5 ? 'nat-eng' : opp, away: null, myTeam: 'nat-eng', knockout: true, extraTime: true, neutral: round === 'F' ? T.final : null });
  const f = T.fixtures[T.fixtures.length - 1]; f.away = f.home === 'nat-eng' ? opp : 'nat-eng';
}
function out(c, line) { const T = c.tournament; T.alive = false; T.result = line; c.intl.tournaments.push({ name: T.name, result: line.replace(/^[^:]+: /, '') }); }
/** You weren't picked: England play on without you. */
export function simulateEngland(c, R = Math.random) {
  const T = c.tournament; let f, n = 0;
  while (T.alive && (f = nextEngland(T)) && n++ < 12) tournamentRecord(c, f, quickResult(f.home, f.away, { neutral: true, knockout: !!f.knockout, extraTime: true }, R), R);
}
export { RNAME };

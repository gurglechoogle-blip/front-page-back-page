// The season: clubs, dates, fixtures, cup draws, quick results and tables.
// Pure logic, no DOM. Dates are 'YYYY-MM-DD' strings throughout.
import clubsData from '../data/clubs.json';
import leagues from '../data/leagues.json';
import cal from '../data/calendar.json';
import NAT from '../data/nations.json';

// The calendar and divisions for the CURRENT season. They start as 2026-27 and
// are rebuilt in place by setWorld() each summer (same pattern, a year on).
const BASE_CAL = JSON.parse(JSON.stringify(cal)), BASE_DIVS = JSON.parse(JSON.stringify(leagues.divisions));
export const DIVS = leagues.divisions;
export const CAL = cal;
const BASE = new Map(clubsData.clubs.map(c => [c.id, c]));
const CAREER_START = BASE_CAL.careerStart; // week 0, fixed for the whole career

/* ---------- the world: which season, who's in which division, how good they are ---------- */
let WORLD = { year: 0, leagues: {}, strength: {} };
export const getWorld = () => WORLD;
export function setWorld(w) {
  WORLD = Object.assign({ year: 0, leagues: {}, strength: {} }, w || {});
  const shift = 7 * Math.round(365.25 * WORLD.year / 7);   // whole weeks, so Saturdays stay Saturdays
  const move = o => { if (typeof o === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(o) ? addDays(o, shift) : o; if (Array.isArray(o)) return o.map(move); if (o && typeof o === 'object') { const r = {}; for (const k in o) r[k] = move(o[k]); return r; } return o; };
  const nc = move(BASE_CAL); Object.keys(cal).forEach(k => delete cal[k]); Object.assign(cal, nc);
  cal.season = `${2026 + WORLD.year}-${String(27 + WORLD.year).slice(-2)}`;
  const nd = move(BASE_DIVS); Object.keys(nd).forEach(k => Object.assign(DIVS[k], nd[k]));
  return WORLD;
}
export const seasonYear = () => 2026 + WORLD.year;
export const divisionClubs = div => clubsData.clubs.filter(c => (WORLD.leagues[c.id] || c.league) === div).map(c => c.id);

/* ---------- clubs (incl. under-21 sides for the EFL Trophy) ---------- */
const NATIONS = new Map(NAT.nations.map(n => [n.id, n]));
const YOUTH = { u17: ['Under-17s', 34], u19: ['Under-19s', 30], u21: ['Under-21s', 24] };
export function club(id) {
  if (id.startsWith('nat-')) {
    const m = id.match(/^(nat-[a-z]+)(?:-(u17|u19|u21))?$/), n = NATIONS.get(m[1]);
    if (!m[2]) return n;
    const [lbl, minus] = YOUTH[m[2]];
    return Object.assign({}, n, { id, name: `${n.name} ${lbl}`, strength: n.strength - minus, stadium: n.id === 'nat-eng' ? "St George's Park" : n.stadium });
  }
  if (id.endsWith('-u21')) {
    const b = club(id.slice(0, -4));
    return Object.assign({}, b, { id, name: b.name + ' U21', stadium: `the ${b.name} academy ground`, strength: Math.round(b.strength * .5 + 18), league: 'U21', parent: b.id });
  }
  const b = BASE.get(id); if (!b) return b;
  const lg = WORLD.leagues[id], st = WORLD.strength[id];
  return lg == null && st == null ? b : Object.assign({}, b, lg != null ? { league: lg } : {}, st != null ? { strength: st } : {});
}
export const allClubs = () => clubsData.clubs.map(c => club(c.id));

/* ---------- dates ---------- */
const D = s => new Date(s + 'T12:00:00Z');
const S = d => d.toISOString().slice(0, 10);
export const addDays = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return S(d); };
export const weekStart = i => addDays(CAREER_START, 7 * i);
export const weekOf = s => Math.floor((D(s) - D(CAREER_START)) / 864e5 / 7);
/** First week of the current season (pre-season starts here). */
export const firstWeek = () => weekOf(cal.careerStart);
export const lastWeek = () => weekOf(cal.seasonEnd);
export const prettyDate = (s, long) => D(s).toLocaleDateString('en-GB', long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' });
export const dayName = s => D(s).toLocaleDateString('en-GB', { weekday: 'short' });

/* ---------- random helpers ---------- */
export const pickR = (a, R = Math.random) => a[Math.floor(R() * a.length)];
function shuffle(a, R = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function poisson(l, R = Math.random) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1; }

/** A result for a match nobody is watching. Same goal model as MatchSim. */
export function quickResult(homeId, awayId, opts = {}, R = Math.random) {
  const h = club(homeId), a = club(awayId), d = (h.strength - a.strength) / 60, ha = opts.neutral ? 1 : 1.1, aa = opts.neutral ? 1 : .9;
  const r = { hs: poisson(1.3 * Math.exp(d) * ha, R), as: poisson(1.3 * Math.exp(-d) * aa, R) };
  if (opts.knockout && r.hs === r.as) {
    if (opts.extraTime) { r.hs += poisson(.35 * Math.exp(d), R); r.as += poisson(.35 * Math.exp(-d), R); r.aet = true; }
    if (r.hs === r.as) { const p = 3 + Math.floor(R() * 3); r.pens = R() < .5 ? [p, p - 1 - Math.floor(R() * 2)] : [p - 1 - Math.floor(R() * 2), p]; }
  }
  return r;
}
export const winnerOf = f => f.hs > f.as ? f.home : f.as > f.hs ? f.away : f.pens ? (f.pens[0] > f.pens[1] ? f.home : f.away) : null;

/* ---------- league fixtures ---------- */
function leagueDates(div) {
  const L = DIVS[div], skip = new Set();
  if (L.skipsBreaks) cal.internationalBreakWeekends.forEach(d => skip.add(d));
  const english = ['PL', 'CH', 'L1', 'L2', 'NL'].includes(div);
  const fa = english ? cal.cups.facup.rounds : [], faSkip = div === 'PL' || div === 'CH' ? ['R3', 'R4', 'QF', 'SF'] : ['R1', 'R2', 'R3', 'R4'];
  fa.filter(r => faSkip.includes(r.id)).forEach(r => skip.add(r.date));
  if (div === 'PL') skip.add(cal.cups.eflcup.rounds.find(r => r.id === 'F').date);
  const sats = [];
  for (let d = L.start; d <= L.end; d = addDays(d, 7)) if (!skip.has(d)) sats.push(d);
  if (L.finalDaySunday) sats[sats.length - 1] = L.end;
  let dates = [...sats, ...cal.festive];
  // Midweek rounds (Tuesdays) to make up the numbers, spread evenly, avoiding cup weeks.
  const need = L.games - dates.length;
  if (need > 0) {
    const cupTue = new Set();
    Object.values(cal.cups).forEach(c => { (c.rounds || []).forEach(r => cupTue.add(weekOf(r.date))); (c.groupDates || []).forEach(g => cupTue.add(weekOf(g))); });
    cal.festive.forEach(f => cupTue.add(weekOf(f)));
    const cands = [];
    for (let d = addDays(L.start, 17); d < addDays(L.end, -14); d = addDays(d, 7)) if (!cupTue.has(weekOf(d)) && !skip.has(addDays(d, 4))) cands.push(d);
    for (let i = 0; i < need; i++) dates.push(cands[Math.floor((i + .5) * cands.length / need)]);
  }
  dates = dates.sort();
  while (dates.length > L.games) dates.splice(Math.floor(dates.length / 2), 1);
  return dates;
}
/** Double round-robin by the circle method; second half mirrors the first. */
export function leagueFixtures(div, R = Math.random) {
  const teams = shuffle(divisionClubs(div), R), n = teams.length, rounds = [];
  const arr = teams.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const ring = [teams[0], ...arr], round = [];
    for (let i = 0; i < n / 2; i++) { const a = ring[i], b = ring[n - 1 - i]; round.push((i === 0 ? r % 2 : i % 2) ? [a, b] : [b, a]); }
    rounds.push(round); arr.unshift(arr.pop());
  }
  const all = [...rounds, ...rounds.map(rd => rd.map(([h, a]) => [a, h]))];
  const dates = leagueDates(div), out = [];
  all.forEach((rd, i) => rd.forEach(([h, a]) => out.push({ id: `${div}-${i + 1}-${h}`, comp: 'league', div, round: i + 1, date: dates[i], home: h, away: a })));
  return out;
}

/* ---------- cups ---------- */
const CUP_NAMES = { league: null, friendly: 'Friendly', eflcup: cal.cups.eflcup.short, facup: cal.cups.facup.short, trophy: cal.cups.trophy.short };
export const compName = f => f.comp === 'intl' || f.comp === 'tourn' || f.comp === 'playoff' ? f.label : f.comp === 'natcup' ? `${f.cupName || 'Cup'} ${roundName(f)}` : f.comp === 'league' ? DIVS[f.div].short : f.comp === 'friendly' ? 'Pre-season friendly' : `${CUP_NAMES[f.comp] || (cal.cups[f.comp] || {}).short || f.comp} ${roundName(f)}`;
export function roundName(f) { if (f.round === 'G') return 'group stage'; if (f.round === 'L') return 'league phase'; const r = cal.cups[f.comp].rounds.find(x => x.id === f.round); return r ? r.name : f.round; }
const europeClubs = () => divisionClubs('PL').map(club).sort((a, b) => b.strength - a.strength).slice(0, DIVS.PL.europeSpots).map(c => c.id);
function trophyU21s() { return [...divisionClubs('PL'), ...divisionClubs('CH')].map(club).sort((a, b) => b.strength - a.strength).slice(0, 16).map(c => c.id + '-u21'); }

export const ABROAD = ['ES', 'IT', 'DE', 'FR'];
/** Champions League and Europa League places: from last season's tables, or club strength at the start. */
export function europeQualifiers() {
  if (WORLD.europe) return WORLD.europe;
  const ucl = [], uel = [];
  for (const d of ['PL', ...ABROAD]) { const ids = divisionClubs(d).sort((a, b) => club(b).strength - club(a).strength); const n = d === 'FR' ? 3 : 4; ucl.push(...ids.slice(0, n)); uel.push(...ids.slice(n, n + 2)); }
  return { ucl, uel };
}
/** Which round my club enters each cup, and as which team (first team or U21s). */
export function cupEntries(clubId) {
  const div = club(clubId).league, L = DIVS[div], out = [];
  const eu = europeQualifiers();
  if (eu.ucl.includes(clubId)) out.push({ comp: 'ucl', team: clubId, from: 'L' });
  else if (eu.uel.includes(clubId)) out.push({ comp: 'uel', team: clubId, from: 'L' });
  if (ABROAD.includes(div)) { out.push({ comp: 'natcup', team: clubId, from: 'R16', cupName: L.natCup }); return out; }
  if (L.eflCupFrom) out.push({ comp: 'eflcup', team: clubId, from: div === 'PL' && europeClubs().includes(clubId) ? L.eflCupFromEurope : L.eflCupFrom });
  out.push({ comp: 'facup', team: clubId, from: L.faCupFrom });
  if (L.trophy === 'group') out.push({ comp: 'trophy', team: clubId, from: 'G' });
  else if (trophyU21s().includes(clubId + '-u21')) out.push({ comp: 'trophy', team: clubId + '-u21', from: 'G' });
  return out;
}
/** Draw an opponent for a cup round. Stronger clubs are likelier to still be in it later on. */
export function drawOpponent(comp, roundId, team, exclude = [], R = Math.random) {
  const rounds = cal.cups[comp].rounds.map(r => r.id), depth = Math.max(0, rounds.indexOf(roundId));
  let pool;
  const efl = [...divisionClubs('CH'), ...divisionClubs('L1'), ...divisionClubs('L2')];
  if (comp === 'eflcup') pool = roundId === 'R1' ? efl : roundId === 'R2' ? [...efl, ...divisionClubs('PL').filter(c => !europeClubs().includes(c))] : [...efl, ...divisionClubs('PL')];
  else if (comp === 'natcup') pool = divisionClubs(club(team.replace(/-u21$/, '')).league);
  else if (comp === 'ucl' || comp === 'uel') { const eu = europeQualifiers(); pool = [...eu.ucl, ...eu.uel].filter(id => club(id).league !== club(team).league || roundId !== 'L'); }
  else if (comp === 'facup') pool = ['R1', 'R2'].includes(roundId) ? [...divisionClubs('L1'), ...divisionClubs('L2'), ...divisionClubs('NL')] : [...divisionClubs('PL'), ...divisionClubs('CH'), ...divisionClubs('L1'), ...divisionClubs('L2'), ...divisionClubs('NL').slice(0, 4)];
  else pool = [...divisionClubs('L1'), ...divisionClubs('L2'), ...trophyU21s()];
  const own = team.replace(/-u21$/, '');
  pool = pool.filter(id => id !== team && id.replace(/-u21$/, '') !== own && !exclude.includes(id));
  const w = pool.map(id => Math.pow(club(id).strength / 50, depth * .8));
  let r = R() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
export function cupFixture(comp, roundId, team, opp, R = Math.random) {
  const rd = cal.cups[comp].rounds.find(r => r.id === roundId), home = R() < .5;
  return { id: `${comp}-${roundId}`, comp, round: roundId, date: rd.date, home: home ? team : opp, away: home ? opp : team, neutral: rd.neutral || null, knockout: true, extraTime: cal.cups[comp].extraTime || roundId === 'F', mine: true };
}
export function nextRound(comp, roundId) { const rs = cal.cups[comp].rounds, i = rs.findIndex(r => r.id === roundId); return i >= 0 && i < rs.length - 1 ? rs[i + 1].id : null; }
/** Trophy group: my team plus three others; all six group games. */
export function trophyGroup(team, R = Math.random) {
  const isU21 = team.endsWith('-u21');
  const l12 = shuffle([...divisionClubs('L1'), ...divisionClubs('L2')].filter(id => id !== team), R), u21 = shuffle(trophyU21s().filter(id => id !== team), R);
  const others = isU21 ? l12.slice(0, 3) : [...l12.slice(0, 2), u21[0]];
  const g = [team, ...others], pairs = [[[0, 1], [2, 3]], [[3, 0], [1, 2]], [[0, 2], [3, 1]]], fx = [];
  pairs.forEach((md, i) => md.forEach(([a, b]) => fx.push({ id: `trophy-G${i + 1}-${g[a]}`, comp: 'trophy', round: 'G', md: i + 1, date: cal.cups.trophy.groupDates[i], home: g[a], away: g[b], mine: g[a] === team || g[b] === team })));
  return { teams: g, fixtures: fx };
}

/** A European league phase: six games against teams from other countries. */
export function europePhase(comp, team, R = Math.random) {
  const eu = europeQualifiers(), mine = club(team).league;
  const pool = (comp === 'ucl' ? eu.ucl : [...eu.ucl.slice(-8), ...eu.uel]).filter(id => club(id).league !== mine && id !== team);
  const opps = pool.sort(() => R() - .5).slice(0, 6);
  return opps.map((o, i) => ({ id: `${comp}-L${i + 1}`, comp, round: 'L', md: i + 1, date: cal.cups[comp].leagueDates[i], home: i % 2 ? o : team, away: i % 2 ? team : o, mine: true, cupName: cal.cups[comp].short }));
}
/* ---------- tables ---------- */
export function table(teams, fixtures) {
  const T = new Map(teams.map(id => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }]));
  fixtures.filter(f => f.played).sort((a, b) => a.date < b.date ? -1 : 1).forEach(f => {
    const h = T.get(f.home), a = T.get(f.away); if (!h || !a) return;
    h.p++; a.p++; h.gf += f.hs; h.ga += f.as; a.gf += f.as; a.ga += f.hs;
    if (f.hs > f.as) { h.w++; a.l++; h.pts += 3; h.form.push('W'); a.form.push('L'); }
    else if (f.hs < f.as) { a.w++; h.l++; a.pts += 3; h.form.push('L'); a.form.push('W'); }
    else { h.d++; a.d++; h.pts++; a.pts++; h.form.push('D'); a.form.push('D'); }
  });
  return [...T.values()].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || club(x.id).name.localeCompare(club(y.id).name));
}
/** Zone of a league position: 'champ' | 'promo' | 'playoff' | 'europe' | 'releg' | null. */
export function zone(div, pos, n) {
  const P = DIVS[div].places;
  if (P.champions && pos === 1) return 'champ';
  if (P.europe && pos <= P.europe) return 'europe';
  if (P.promotion && pos <= P.promotion) return 'promo';
  if (P.playoffs && pos >= P.playoffs[0] && pos <= P.playoffs[1]) return 'playoff';
  if (pos > n - P.relegation) return 'releg';
  return null;
}

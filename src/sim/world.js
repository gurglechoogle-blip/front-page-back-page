// Summer: the season ends everywhere. Final tables for every division (yours
// from real results, the rest simulated), play-offs, promotion and relegation,
// clubs getting better or worse, and then next season's world.
import { DIVS, club, divisionClubs, leagueFixtures, quickResult, table, getWorld, winnerOf } from './season.js';

const ORDER = ['PL', 'CH', 'L1', 'L2', 'NL'], RANK = { PL: 0, CH: 1, L1: 2, L2: 3, NL: 4 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function finalTable(div, myDiv, myFixtures, R) {
  if (div === myDiv) return table(divisionClubs(div), myFixtures.filter(f => f.comp === 'league'));
  const fx = leagueFixtures(div, R); fx.forEach(f => Object.assign(f, quickResult(f.home, f.away, {}, R), { played: true }));
  return table(divisionClubs(div), fx);
}
/** Two-legged-ish play-offs, played as one-off ties: semis then a Wembley final. */
function playoffs(ids, R) {
  const tie = (a, b, neutral) => { const f = Object.assign({ home: a, away: b }, quickResult(a, b, { knockout: true, extraTime: true, neutral }, R)); return winnerOf(f); };
  const w1 = tie(ids[0], ids[3]), w2 = tie(ids[1], ids[2]);
  return tie(w1, w2, true);
}

/** Work out the new world. Returns { world, moves: [{id, from, to, why}], tables }. */
export function endSeason(myDiv, myFixtures, R = Math.random) {
  const old = getWorld(), leagues = Object.assign({}, old.leagues), strength = Object.assign({}, old.strength), moves = [], tables = {};
  ORDER.forEach(d => { tables[d] = finalTable(d, myDiv, myFixtures, R).map(r => r.id); });
  const move = (id, to, why) => { moves.push({ id, from: club(id).league, to, why }); leagues[id] = to; };
  for (let i = 0; i < ORDER.length - 1; i++) {
    const up = ORDER[i + 1], down = ORDER[i], P = DIVS[up].places, t = tables[up], above = tables[down];
    const auto = t.slice(0, P.promotion), po = t.slice(P.playoffs[0] - 1, P.playoffs[1]);
    const poWinner = playoffs(po, R);
    [...auto, poWinner].forEach(id => move(id, down, id === poWinner ? 'play-offs' : 'promoted'));
    above.slice(-DIVS[down].places.relegation).forEach(id => move(id, up, 'relegated'));
  }
  // Strength drifts: promoted clubs invest, relegated ones lose players, everyone wobbles.
  const tier = { PL: 80, CH: 62, L1: 49, L2: 41, NL: 30 };
  ORDER.forEach(d => divisionClubs(d).forEach(id => {
    const now = club(id).strength, to = leagues[id] || d, mv = moves.find(m => m.id === id);
    let s = now + (R() - .5) * 6 + (tier[to] - now) * .06;
    if (mv) s += RANK[mv.to] < RANK[mv.from] ? 2 : -2;
    strength[id] = Math.round(clamp(s, 18, 94));
  }));
  return { world: { year: old.year + 1, leagues, strength }, moves, tables };
}

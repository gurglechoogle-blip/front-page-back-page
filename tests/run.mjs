// The automatic checks. GitHub runs these before every deploy; if any fail, the
// live game isn't updated. Run them yourself with:  npm test
// (Add LONG=1 for the full 20-year careers report: LONG=1 npm test)
import { best, cmp, card } from '../src/sim/cards.js';
import { marketValue, clubBudget } from '../src/sim/value.js';
import { MatchSim } from '../src/sim/matchSim.js';
import { createCareer, setSkillSource, selection, myFixtures, weeklyBills, startMatchday, recordMatch, playHeadless, finishWeek, nextWeek, seasonSummary, age } from '../src/sim/career.js';
import { makeOffers, reputation } from '../src/sim/transfers.js';
import { club, allClubs, divisionClubs, quickResult } from '../src/sim/season.js';
import { setupPlayoffs, advancePlayoffs, nextPlayoffFixture, playoffOverride } from '../src/sim/playoffs.js';
import { computeAwards } from '../src/sim/awards.js';
import { packSave, unpackSave } from '../src/state/pack.js';
import { longRun } from './longrun.mjs';

let failed = 0, passed = 0;
function test(name, fn) {
  const t = Date.now();
  try { fn(); passed++; console.log(`  ✓ ${name} (${Date.now() - t}ms)`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
const ok = (v, msg) => { if (!v) throw new Error(msg); };
const finite = (v, what) => ok(Number.isFinite(v), `${what} is ${v}`);
/** Look through a whole object for NaN or Infinity hiding in a number. */
function noBadNumbers(o, path = 'career', seen = new Set()) {
  if (o && typeof o === 'object') { if (seen.has(o)) return; seen.add(o); for (const k in o) noBadNumbers(o[k], `${path}.${k}`, seen); }
  else if (typeof o === 'number') ok(Number.isFinite(o), `${path} is ${o}`);
}
let skill = 10; setSkillSource(() => skill);

console.log('\nCards');
test('poker hands rank in the right order', () => {
  const h = s => best(s.split(' ').map(x => card(+x.slice(0, -1), 'shdc'.indexOf(x.slice(-1)))));
  const order = ['2s 5h 9d 11c 13s', '2s 2h 9d 11c 13s', '2s 2h 9d 9c 13s', '2s 2h 2d 11c 13s', '5s 6h 7d 8c 9s', '2s 5s 9s 11s 13s', '2s 2h 2d 9c 9s', '2s 2h 2d 2c 9s', '5h 6h 7h 8h 9h'];
  for (let i = 1; i < order.length; i++) ok(cmp(h(order[i]), h(order[i - 1])) > 0, `${order[i]} should beat ${order[i - 1]}`);
});
test('the kicker settles a tie, and 6-card hands pick the best five', () => {
  const h = s => best(s.split(' ').map(x => card(+x.slice(0, -1), 'shdc'.indexOf(x.slice(-1)))));
  ok(cmp(h('9s 9h 14d 5c 3s'), h('9d 9c 13d 5h 3c')) > 0, 'ace kicker should beat king kicker');
  ok(h('2s 3h 4d 5c 6s 6h')[0] === 4, '6-card straight not found');
  ok(h('14s 14h 14d 9c 9s 2h 3d')[0] === 6, '7-card full house not found');
});

console.log('\nMoney and values');
test('every club has a sensible transfer budget', () => {
  for (const cl of allClubs()) { const b = clubBudget(cl.id); finite(b, cl.id + ' budget'); ok(b > 0 && b <= 300e6, `${cl.id} budget £${b}`); }
  const avg = d => divisionClubs(d).reduce((a, id) => a + clubBudget(id), 0) / divisionClubs(d).length;
  ok(avg('PL') > avg('CH') && avg('CH') > avg('L1') && avg('L1') > avg('L2'), 'bigger leagues should have bigger budgets');
});
test('market value goes up with skill and stays in range', () => {
  const base = { age: 21, div: 'CH', clubId: divisionClubs('CH')[0], apps: 30, goals: 10, avg: 7, yearsLeft: 2 };
  let prev = 0;
  for (const s of [0, 20, 40, 60, 80, 100]) { const v = marketValue(Object.assign({}, base, { skill: s })).value; finite(v, 'value'); ok(v >= prev, `value fell as skill rose (${s})`); ok(v >= 10e3 && v <= 200e6, `value £${v}`); prev = v; }
  finite(marketValue({ age: 17, div: 'XX', clubId: 'nobody' }).value, 'value with missing inputs');
});

console.log('\nCareer');
test('a new career starts with sane numbers', () => {
  for (const id of ['bristolrovers', 'salford', 'portvale']) { const c = createCareer('Test', { type: 'family', clubId: id, pitch: '' }); noBadNumbers(c); weeklyBills(c).forEach(b => finite(b.amount, b.what)); ok(myFixtures(c).length > 40, 'too few fixtures'); }
});
test('selection follows the contract: first choice starts far more than a squad player', () => {
  const starts = role => {
    const c = createCareer('Test', { type: 'family', clubId: 'bristolrovers', pitch: '' });
    Object.assign(c, { approval: 55, form: 50, energy: 80, lastPlayed: null, injury: null, ban: 0 }); c.contract.role = role;
    const f = myFixtures(c).find(x => x.comp === 'league'); let n = 0;
    for (let i = 0; i < 2000; i++) if (selection(c, f) === 'start') n++;
    return n / 2000;
  };
  const fc = starts('first choice'), rot = starts('rotation player'), sq = starts('squad player');
  ok(fc > rot && rot > sq, `first choice ${fc}, rotation ${rot}, squad ${sq}`);
  ok(fc > .6 && sq < .3, `first choice ${fc}, squad ${sq}`);
});
test('a full season plays every league game with no broken numbers', () => {
  const c = createCareer('Test', { type: 'family', clubId: 'bristolrovers', pitch: '' }); let g = 0;
  while (!c.seasonOver && g++ < 80) { c.pending = []; const md = startMatchday(c); while (md.queue.length) { const f = c.fixtures.find(x => x.id === md.queue[0]); recordMatch(c, f, playHeadless(c, f).summary()); } finishWeek(c); nextWeek(c); }
  ok(c.seasonOver, 'season never finished');
  ok(myFixtures(c).filter(f => f.comp === 'league' && f.played).length === 46, 'not all 46 league games played');
  noBadNumbers(c);
  const A = computeAwards(c, age(c));
  ok(A.scorers.length === 10 && A.scorers.every((s, i) => i === 0 || s.goals <= A.scorers[i - 1].goals), 'top scorers not sorted');
  ok(A.ballon.length === 10 && !A.ballonWon, 'a League Two player won the Ballon d\'Or');
  ok(computeAwards(c, age(c)) === A, 'awards worked out twice');
  ok(seasonSummary(c).pos >= 1, 'no league position');
});

console.log('\nMatches');
const sims = (home, away, n = 300) => {
  let W = 0, L = 0, goals = 0;
  for (let i = 0; i < n; i++) {
    const s = new MatchSim({ home: club(home), away: club(away), mySide: 'home', trust: .5, form: .5, playerName: 'Test' });
    let g = 0; while (!s.done && g++ < 3000) for (const e of s.tick()) if (e.kind === 'chance') { const sc = Math.random() < .35; s.resolveChance({ key: e.moment, outcome: sc ? 'goal' : 'save', goal: sc, gained: 40, msg: '', q: .5 }); }
    ok(s.done, 'match never finished');
    const S = s.summary(); if (S.result === 'W') W++; if (S.result === 'L') L++; goals += s.score.home + s.score.away; finite(S.rating, 'rating');
  }
  return { W, L, gpg: goals / n };
};
test('match engine: the better team wins far more', () => { const r = sims('arsenal', 'barrow'); ok(r.W > r.L * 3, `Arsenal v Barrow: won ${r.W}, lost ${r.L}`); });
test('match engine: an even game has a football-ish number of goals', () => { const r = sims('shrewsbury', 'barrow'); ok(r.gpg > 1.5 && r.gpg < 6, `goals per game ${r.gpg.toFixed(2)}`); });

console.log('\nTransfers');
test('transfer offers never cost more than the club can afford', () => {
  const c = createCareer('Test', { type: 'family', clubId: 'bristolrovers', pitch: '' }); c.summer = null;
  for (let i = 0; i < 300; i++) {
    skill = 5 + (i % 60); c.stats.apps = i % 40; c.stats.goals = i % 25;
    for (const o of makeOffers(c, reputation(c, skill, 19 + (i % 10)), 19 + (i % 10), 'summer')) {
      finite(o.wage, 'offer wage'); ok(o.wage > 0, 'zero wage');
      if (o.type === 'transfer' && o.fee > 0) ok(o.fee <= clubBudget(o.clubId), `${o.clubId} bid £${o.fee} with a budget of £${clubBudget(o.clubId)}`);
    }
  }
  skill = 10;
});

console.log('\nPlay-offs');
test('play-offs always produce one winner from the four, who goes up', () => {
  for (let t = 0; t < 60; t++) {
    const c = createCareer('Test', { type: 'family', clubId: 'bristolrovers', pitch: '' });
    const others = divisionClubs('L2').filter(id => id !== c.clubId), pos = 4 + (t % 4);
    const table = [...others.slice(0, pos - 1), c.clubId, ...others.slice(pos - 1)];
    const PO = setupPlayoffs(c, table);
    ok(PO.seeds.length === 4 && PO.seeds.includes(c.clubId), 'wrong semi-finalists');
    let f, g = 0;
    while ((f = nextPlayoffFixture(c)) && g++ < 5) { Object.assign(f, quickResult(f.home, f.away, f.round === 'F' ? { knockout: true, extraTime: true, neutral: true } : {}), { played: true }); advancePlayoffs(c); }
    ok(PO.done, 'play-offs never finished');
    ok(PO.seeds.includes(PO.winner), `winner ${PO.winner} wasn't in the play-offs`);
    ok(playoffOverride(c).L2 === PO.winner, 'the winner isn\'t the one going up');
  }
});

console.log('\nSaves');
test('saves shrink when packed and come back exactly the same', () => {
  const c = createCareer('Test', { type: 'family', clubId: 'bristolrovers', pitch: '' });
  const json = JSON.stringify({ v: 3, career: c, profile: { name: 'Test £ ünïcödé 🎉' } }), packed = packSave(json);
  ok(packed.length < json.length * .6, `packed ${packed.length} vs ${json.length}`);
  ok(unpackSave(packed) === json, 'packed save did not unpack to the same thing');
  ok(unpackSave(json) === json, 'an old unpacked save no longer loads');
});

if (process.env.LONG) { console.log('\nTwenty-year careers'); longRun(test, ok, noBadNumbers, s => { skill = s; }, 2); }
else { console.log('\nTwenty-year careers (quick version: one of each)'); longRun(test, ok, noBadNumbers, s => { skill = s; }, 1); }

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

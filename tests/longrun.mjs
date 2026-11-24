// Twenty-year careers, played start to finish by three kinds of player, to check
// nothing drifts out of shape over a long save: money, skill, value, moves, caps.
import { createCareer, startMatchday, selection, recordMatch, finishWeek, nextWeek, playHeadless, matchParams, logTraining, slotsTotal, rollWorld, beginSeason, age, seasonSummary } from '../src/sim/career.js';
import { makeOffers, renewalOffer, contractEnding, reputation, sign, valueNow } from '../src/sim/transfers.js';
import { MatchSim } from '../src/sim/matchSim.js';
import { club, seasonYear, CAL } from '../src/sim/season.js';
import { mulberry } from '../src/engine/util.js';

// Casual: plays now and then. Keen: plays most days. Grinder: trains every slot, well.
// Skill (0-100%) follows the slow curve the real drills give each kind of player.
const PROFILES = [
  { name: 'casual', drill: 2, conv: .15, skill: a => Math.min(22, 2 + (a - 16) * 1.3), ambition: 8 },
  { name: 'keen', drill: 3, conv: .22, skill: a => Math.min(40, 4 + (a - 16) * 2.2), ambition: 4 },
  { name: 'grinder', drill: 4, conv: .3, skill: a => Math.min(65, 6 + (a - 16) * 3.4), ambition: 0 },
];
const fmt = v => v >= 1e6 ? `£${(v / 1e6).toFixed(1)}m` : `£${Math.round(v / 1e3)}k`;

function playMine(c, f, role, conv, R) {
  const sim = new MatchSim(Object.assign({}, matchParams(c, f, role), { playerName: c.name }));
  let n = 0; while (!sim.done && n++ < 3000) for (const e of sim.tick()) if (e.kind === 'chance') { const g = R() < conv; sim.resolveChance({ key: e.moment, outcome: g ? 'goal' : 'save', goal: g, gained: 40, msg: g ? 'GOAL!' : 'Saved!', q: .5 }); }
  return sim.summary();
}

export function career(P, seed, setSkill) {
  const R = mulberry(seed), rnd = Math.random; Math.random = R; // repeatable runs
  try {
    const c = createCareer('Test', { type: 'family', clubId: ['bristolrovers', 'salford', 'portvale', 'grimsby'][seed % 4], pitch: '' }, R);
    c.flags.welcomeTalk = true;
    const rows = [];
    for (let s = 0; s < 21; s++) {
      setSkill(P.skill(age(c)));
      let g = 0;
      while (!c.seasonOver && g++ < 80) {
        c.pending = [];
        for (let i = 0; i < slotsTotal(c); i++) logTraining(c, 'volley', P.drill, 30);
        const md = startMatchday(c);
        while (md.queue.length) { const f = c.fixtures.find(x => x.id === md.queue[0]); const role = selection(c, f, R); recordMatch(c, f, role === 'none' ? playHeadless(c, f).summary() : playMine(c, f, role, P.conv, R), R); }
        finishWeek(c, R); nextWeek(c, R);
      }
      const S = seasonSummary(c);
      rows.push({ season: CAL.season, age: age(c), club: club(c.clubId).short, div: c.div, apps: c.stats.apps, goals: c.stats.goals, avg: S.avg, bank: c.bank, wage: c.contract.wage, value: valueNow(c, age(c)), caps: c.intl.caps.senior, skill: P.skill(age(c)) });
      rollWorld(c, R);
      if (seasonYear() >= 2046) break;
      // The summer window: take the best offer that's a step up (or anything, if the contract's up).
      const a = age(c), rep = reputation(c, P.skill(a), a), ending = contractEnding(c);
      const offers = makeOffers(c, rep, a, 'summer', R).filter(o => o.type === 'transfer');
      const bestO = offers.sort((x, y) => club(y.clubId).strength - club(x.clubId).strength)[0];
      if (bestO && (club(bestO.clubId).strength > club(c.clubId).strength + P.ambition || ending)) sign(c, bestO, { wage: bestO.wage, years: bestO.years }, false, R);
      else if (ending) sign(c, renewalOffer(c, rep), { wage: renewalOffer(c, rep).wage, years: 3 }, false, R);
      beginSeason(c, R);
    }
    return { c, rows };
  } finally { Math.random = rnd; }
}

export function longRun(test, ok, noBadNumbers, setSkill, perProfile = 1) {
  for (const P of PROFILES) for (let k = 0; k < perProfile; k++) {
    test(`${P.name} player, 20 seasons (run ${k + 1})`, () => {
      const { c, rows } = career(P, 1000 + k * 7 + P.drill, setSkill);
      for (const r of rows) console.log(`      ${r.season} age ${r.age} ${r.club.padEnd(4)} ${r.div.padEnd(3)} apps ${String(r.apps).padStart(2)} goals ${String(r.goals).padStart(2)} avg ${r.avg ? r.avg.toFixed(2) : ' -  '} wage £${r.wage}/wk bank ${fmt(r.bank)} value ${fmt(r.value)} caps ${r.caps} skill ${Math.round(r.skill)}%`);
      noBadNumbers(c);
      ok(rows.length >= 19, `only ${rows.length} seasons played`);
      for (const r of rows) {
        ok(r.apps <= 75, `${r.season}: ${r.apps} appearances`);
        ok(r.value >= 10e3 && r.value <= 200e6, `${r.season}: value ${r.value}`);
        ok(r.wage > 0 && r.wage < 1e6, `${r.season}: wage £${r.wage}/wk`);
        ok(r.bank > -2e6 && r.bank < 1e9, `${r.season}: bank £${r.bank}`);
      }
      ok((c.transfers || []).length <= 14, `${c.transfers.length} moves in 20 years`);
      ok(c.intl.caps.senior <= 160, `${c.intl.caps.senior} England caps`);
      const peakWage = Math.max(...rows.map(r => r.wage));
      if (P.name === 'casual') ok(peakWage < 120e3, `a casual player peaked on £${peakWage}/wk`);
      if (P.name === 'grinder') ok(peakWage >= 50e3, `a grinder peaked on only £${peakWage}/wk`);
      if (P.name === 'grinder') ok(rows.some(r => ['CH', 'PL', 'ES', 'IT', 'DE', 'FR'].includes(r.div)), 'a grinder never got above League One');
    });
  }
}

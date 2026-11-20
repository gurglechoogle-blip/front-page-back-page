// Headless run of full careers (every academy type) through a whole season.
//   npx esbuild tools/seasontest.mjs --bundle --platform=node --outfile=/tmp/st.cjs && node /tmp/st.cjs
import { academyOffers, createCareer, startMatchday, selection, recordMatch, finishWeek, nextWeek, leagueTable, myFixtures, playHeadless, matchParams, logTraining, slotsTotal, seasonSummary, unread } from '../src/sim/career.js';
import { MatchSim } from '../src/sim/matchSim.js';
import { club, compName, weekOf } from '../src/sim/season.js';
function playMine(c, f, role) { // simulate a played match with random chance outcomes
  const sim = new MatchSim(Object.assign({}, matchParams(c, f, role), { playerName: c.name }));
  let n = 0; while (!sim.done && n++ < 3000) { for (const e of sim.tick()) if (e.kind === 'chance') { const g = Math.random() < .35; sim.resolveChance({ key: e.moment, outcome: g ? 'goal' : 'save', goal: g, gained: 40, msg: g ? 'GOAL!' : 'Saved!', q: .5 }); } }
  return sim.summary();
}
for (const skill of [5, 30]) {
  const offers = academyOffers(skill);
  console.log('skill', skill, 'offers:', offers.map(o => o.type + ':' + o.clubId).join(', '));
  for (const o of offers) {
    const c = createCareer('Smith', o); let weeks = 0, roles = { start: 0, sub: 0, none: 0 }, guard = 0, perComp = {};
    while (!c.seasonOver && guard++ < 80) {
      for (let i = 0; i < slotsTotal(c); i++) logTraining(c, 'volley', 3, 50);
      const md = startMatchday(c);
      while (md.queue.length) {
        const f = c.fixtures.find(x => x.id === md.queue[0]); const role = selection(c, f); roles[role]++;
        const S = role === 'none' ? playHeadless(c, f).summary() : playMine(c, f, role);
        recordMatch(c, f, S); perComp[f.comp] = (perComp[f.comp] || 0) + 1;
      }
      finishWeek(c); nextWeek(c); weeks++;
    }
    const unplayed = c.fixtures.filter(f => !f.played);
    const S = seasonSummary(c), cups = Object.entries(c.cups).map(([k, v]) => `${k}:${v.won ? 'WON' : v.alive ? 'alive?' : 'out@' + v.round}`).join(' ');
    console.log(` ${o.type.padEnd(8)} ${club(c.clubId).name.padEnd(22)} ${c.div} weeks ${weeks} pos ${S.pos}/${S.of} myMatches ${JSON.stringify(perComp)} roles ${JSON.stringify(roles)} apps ${c.stats.apps} goals ${c.stats.goals} avg ${S.avg.toFixed(2)} approval ${Math.round(c.approval)} bank £${c.bank} | ${cups} | unplayed ${unplayed.length} msgs ${c.inbox.length} | saveKB ${(JSON.stringify(c).length / 1024).toFixed(0)}`);
    const leaguePlayed = myFixtures(c).filter(f => f.comp === 'league' && f.played).length;
    if (unplayed.length) console.log('   UNPLAYED:', unplayed.slice(0, 5).map(f => f.id + ' ' + f.date + ' wk' + weekOf(f.date)).join(', '));
    if (leaguePlayed !== (c.div === 'PL' ? 38 : 46)) console.log('   LEAGUE GAMES WRONG', leaguePlayed);
    const t = leagueTable(c); if (t.some(r => r.p !== t[0].p)) console.log('   TABLE UNEVEN', t.map(r => r.p).join(','));
  }
}

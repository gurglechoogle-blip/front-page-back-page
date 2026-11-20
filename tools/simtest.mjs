// Headless sanity check of the match simulation: plays thousands of matches
// with random chance outcomes and prints the averages.
//   npx esbuild tools/simtest.mjs --bundle --platform=node --outfile=/tmp/simtest.cjs && node /tmp/simtest.cjs
import { MatchSim } from '../src/sim/matchSim.js';
import clubs from '../src/data/clubs.json';

const by = id => clubs.clubs.find(c => c.id === id);
function run(homeId, awayId, cup, n = 3000, conv = .38) {
  let goals = 0, mine = 0, chances = [0, 0, 0, 0, 0, 0, 0], et = 0, pens = 0, res = { W: 0, D: 0, L: 0 }, rating = 0, maxLines = 0, lines = 0, unresolved = 0;
  for (let i = 0; i < n; i++) {
    const s = new MatchSim({ home: by(homeId), away: by(awayId), mySide: 'home', cup, trust: Math.random(), form: Math.random(), playerName: 'Smith' });
    let ev = 0, guard = 0;
    while (!s.done && guard++ < 1000) {
      const out = s.tick(); ev += out.length;
      for (const e of out) if (e.kind === 'chance') { const r = Math.random(), g = r < conv; ev += s.resolveChance({ key: e.moment, outcome: g ? 'goal' : ['save', 'wide', 'miss'][Math.floor(Math.random() * 3)], goal: g, gained: 50, msg: g ? 'GOAL!' : 'Saved!', q: Math.random() }).length; }
    }
    if (!s.done) unresolved++;
    const sum = s.summary();
    goals += s.score.home + s.score.away; mine += s.score.home; chances[s.my.chances]++; res[sum.result]++; rating += sum.rating; lines += ev; maxLines = Math.max(maxLines, ev);
    if (s.period !== '2H') et++; if (s.pens) pens++;
  }
  console.log(`${homeId} v ${awayId}${cup ? ' (cup)' : ''}: goals/game ${(goals / n).toFixed(2)}, mine ${(mine / n).toFixed(2)}, W/D/L ${res.W}/${res.D}/${res.L}, ET ${et}, pens ${pens}, avg rating ${(rating / n).toFixed(2)}, feed lines avg ${(lines / n).toFixed(0)} max ${maxLines}, chances dist ${chances.slice(3).join('/')} (3..6), regulation-only counts include ET extra; unfinished ${unresolved}`);
}
run('shrewsbury', 'barrow', false);
run('shrewsbury', 'liverpool', false);
run('arsenal', 'barrow', true);
run('stoke', 'norwich', true);

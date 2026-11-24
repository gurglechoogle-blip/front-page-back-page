// End-of-season awards night: your club's awards, your league's top scorers and
// Team of the Year, and the Ballon d'Or. Worked out once per season and kept.
import { club, divisionClubs, CAL, ABROAD, DIVS } from './season.js';
import { makeSquad } from './squads.js';
import { leagueTable } from './career.js';
import { applyEffects } from './life.js';
import { mulberry } from '../engine/util.js';

const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ELITE = () => [...divisionClubs('PL'), ...ABROAD.flatMap(d => divisionClubs(d))].filter(id => club(id).strength >= 82);

/** Your league numbers this season (from the appearance log). */
function myLeague(c) {
  const log = (c.appLog || []).filter(x => x.s === CAL.season && x.c === 'league' && !String(x.t).startsWith('nat-') && !String(x.t).endsWith('-u21'));
  const rt = log.filter(x => x.r).map(x => x.r);
  return { apps: log.length, goals: log.reduce((a, x) => a + x.g, 0), assists: log.reduce((a, x) => a + x.a, 0), avg: rt.length ? rt.reduce((a, b) => a + b, 0) / rt.length : 0 };
}

export function computeAwards(c, age) {
  c.awards = c.awards || {};
  if (c.awards[CAL.season]) return c.awards[CAL.season];
  const R = mulberry(hash(CAL.season + c.clubId + c.name)), me = myLeague(c), div = c.div, ids = divisionClubs(div);
  const t = leagueTable(c), gf = Object.fromEntries(t.map(r => [r.id, r.gf]));
  // Top scorers: each club's main striker scores a share of its goals; yours is you or a teammate.
  const scorers = ids.map(id => {
    const sq = makeSquad(id, club(id).league), team = gf[id] || 40;
    if (id === c.clubId) {
      const mate = sq.fwd[1] || sq.mid[0], mateGoals = Math.round(Math.max(0, team - me.goals) * (.25 + R() * .15));
      return me.goals >= mateGoals ? { name: c.name, club: id, goals: me.goals, you: true } : { name: mate, club: id, goals: mateGoals };
    }
    return { name: sq.fwd[0], club: id, goals: Math.round(team * (.24 + R() * .2)) };
  }).sort((a, b) => b.goals - a.goals);
  if (!scorers.some(s => s.you) && me.goals > 0) scorers.push({ name: c.name, club: c.clubId, goals: me.goals, you: true });
  scorers.sort((a, b) => b.goals - a.goals || (b.you ? 1 : 0) - (a.you ? 1 : 0));
  const myRank = scorers.findIndex(s => s.you) + 1;
  // Club awards: you against a couple of teammates' seasons.
  const sq = makeSquad(c.clubId, club(c.clubId).league);
  const rivalAvg = 6.9 + R() * .5, potsWinner = me.apps >= 15 && me.avg >= rivalAvg ? 'you' : pick(R, [...sq.mid, ...sq.def]);
  const young = age <= 21 && me.apps >= 10 && me.avg >= 6.8 ? 'you' : pick(R, sq.subs);
  const clubTop = scorers.find(s => s.club === c.clubId);
  // Team of the Year: the league's best eleven.
  const toty = me.apps >= 25 && me.avg >= 7.35;
  const totyOthers = t.slice(0, 6).flatMap(r => { const s2 = makeSquad(r.id, club(r.id).league); return [s2.def[0], s2.def[1], s2.mid[0], s2.fwd[0]].map(n => ({ name: n, club: r.id })); }).filter((x, i, arr) => x.name && arr.findIndex(y => y.name === x.name) === i).slice(0, toty ? 10 : 11);
  // Ballon d'Or: the world's stars, and you if you're good enough.
  const stars = ELITE().slice(0, 30).map(id => { const s2 = makeSquad(id, club(id).league); return { name: s2.fwd[0], club: id, pts: Math.round(420 + (club(id).strength - 82) * 30 + R() * 320) }; });
  const top = ABROAD.includes(div) || div === 'PL';
  // You need a huge season at a big club; titles and trophies help.
  const won = k => c.cups && c.cups[k] && c.cups[k].won, champs = t.length && t[0].id === c.clubId;
  const myPts = top ? Math.round(me.goals * 14 + (me.avg - 6.8) * 260 + clamp(club(c.clubId).strength - 75, -10, 15) * 12 + (champs ? 100 : 0) + (won('ucl') ? 160 : 0) + (c.flags.wonTournament ? 150 : 0)) : 0;
  const ballon = [...stars, ...(top && myPts > 0 ? [{ name: c.name, club: c.clubId, pts: myPts, you: true }] : [])].sort((a, b) => b.pts - a.pts);
  const ballonRank = ballon.findIndex(s => s.you) + 1;
  const A = {
    season: CAL.season, div, divName: DIVS[div] ? DIVS[div].name : div, me, scorers: scorers.slice(0, 10), myRank, goldenBoot: myRank === 1 && me.goals > 0,
    clubAwards: { pots: potsWinner, young, top: clubTop ? (clubTop.you ? 'you' : clubTop.name) : null },
    toty, totyOthers, ballon: ballon.slice(0, 10), ballonRank: ballonRank > 0 && ballonRank <= 30 ? ballonRank : null, ballonWon: ballonRank === 1,
  };
  c.awards[CAL.season] = A;
  // Rewards and headlines.
  const wins = [A.clubAwards.pots === 'you', A.clubAwards.young === 'you', A.goldenBoot, A.toty, A.ballonWon].filter(Boolean).length;
  if (wins) applyEffects(c, { fans: 2 * wins, honour: wins, manager: 2 });
  const sur = c.name.trim().split(/\s+/).pop().toUpperCase();
  c.weekNews = c.weekNews || [];
  if (A.ballonWon) c.weekNews.push({ page: 'back', headline: `BALLON D'OR! ${sur} IS THE BEST PLAYER ON THE PLANET` });
  else if (A.goldenBoot) c.weekNews.push({ page: 'back', headline: `GOLDEN BOOT FOR ${sur}` });
  return A;
}
const pick = (R, a) => a[Math.floor(R() * a.length)];

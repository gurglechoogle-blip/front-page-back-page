// Which scenery to show. Bigger clubs, better facilities.
import { club } from '../sim/season.js';

const STADIUM = { PL: 'prem', CH: 'champ', L1: 'lower', L2: 'lower', NL: 'park' };
const TRAINING = { PL: 'trainElite', CH: 'trainMid', L1: 'trainMid', L2: 'park', NL: 'park' };
const league = c => c.league === 'U21' ? club(c.parent).league : c.league;

/** The home side's ground (U21 games are at the academy ground; finals at Wembley). */
export function matchVenue(home, away, neutral) {
  if (home.league === 'INT') return { tier: /-u\d\d$/.test(home.id) ? 'trainElite' : 'prem', name: neutral || home.name, colours: home.home, away: neutral ? away.home : undefined };
  if (neutral) return { tier: 'prem', name: neutral, colours: home.home, away: away.home };
  if (home.league === 'U21') return { tier: TRAINING[league(home)] || 'park', name: club(home.parent).name, colours: home.home };
  return { tier: STADIUM[home.league] || 'park', name: home.name, colours: home.home };
}
/** Your club's training ground. */
export function trainingVenue(clubId) {
  const c = club(clubId);
  return { tier: TRAINING[c.league] || 'park', name: c.name, colours: c.home };
}

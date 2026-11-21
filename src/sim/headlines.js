// Today's headline for the hub ticker: mostly daft real-life news, sometimes you.
import HL from '../data/headlines.json';
import { fresh } from './life.js';
import { club } from './season.js';

const fill = (t, c) => t.replace(/\{NAME\}/g, c.name.trim().split(/\s+/).pop().toUpperCase()).replace(/\{FIRST\}/g, c.name.trim().split(/\s+/)[0]).replace(/\{CLUB\}/g, club(c.clubId).name);
/** The headline for a date: picked once, then remembered. */
export function headlineFor(c, date, R = Math.random) {
  c.headlineLog = c.headlineLog || {};
  if (!c.headlineLog[date]) {
    const recent = (c.recentGames || []).slice(-3), last = recent[recent.length - 1];
    let k = null;
    if (R() < .22 + (c.meters.fans > 70 ? .1 : 0)) {
      if (last && last.played && last.rating >= 7.8) k = 'goal';
      else if (last && last.played && last.rating < 5.6) k = 'bad';
      else if (recent.length >= 3 && recent.every(g => !g.played)) k = 'bench';
      else if (c.windowOffers && c.windowOffers.list && c.windowOffers.list.length) k = 'transfer';
      else if (c.meters.fans > 55) k = 'life';
    }
    const list = k ? HL.player[k] : HL.general;
    const i = fresh(c, 'hl-' + (k || 'gen'), list.map((x, j) => j), R);
    c.headlineLog[date] = { k, i };
    const keys = Object.keys(c.headlineLog); if (keys.length > 120) delete c.headlineLog[keys.sort()[0]];
  }
  const { k, i } = c.headlineLog[date], h = (k ? HL.player[k] : HL.general)[i];
  return { h: fill(h.h, c), sub: fill(h.sub, c), mine: !!k };
}

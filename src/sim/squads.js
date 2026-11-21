// Made-up squads, generated deterministically from the club id so a club's
// players keep the same names every time you meet them. National sides and
// clubs abroad get surnames from their own country (with the odd import).
import names from '../data/names.json';
import WN from '../data/worldNames.json';
import { mulberry } from '../engine/util.js';

function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Which surname pool a team uses: null means the usual English names. */
export function nameGroup(clubId, league) {
  const m = /^nat-([a-z]+)/.exec(clubId || '');
  if (m) return WN.nations[m[1]] || null;
  return WN.leagues[league] || null;
}
export function makeSquad(clubId, league) {
  const R = mulberry(hash(clubId)), used = new Set(), group = nameGroup(clubId, league), isNation = /^nat-/.test(clubId);
  const pool = group ? WN.groups[group] : names.last;
  const surname = () => {
    // Club sides abroad have a few foreign imports; national sides don't.
    if (group && !isNation && R() < .2) { const g = Object.keys(WN.groups), gp = WN.groups[g[Math.floor(R() * g.length)]]; return gp[Math.floor(R() * gp.length)]; }
    return pool[Math.floor(R() * pool.length)];
  };
  const person = () => { let n, k = 0; do { n = surname(); if (k++ > 200) n += ' Jr'; } while (used.has(n)); used.add(n); return n; };
  const make = k => Array.from({ length: k }, person);
  void names.first;
  return { gk: make(1)[0], def: make(4), mid: make(4), fwd: make(2), subs: make(4) };
}

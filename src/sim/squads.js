// Made-up squads, generated deterministically from the club id so a club's
// players keep the same names every time you meet them.
import names from '../data/names.json';
import { mulberry } from '../engine/util.js';

function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export function makeSquad(clubId) {
  const R = mulberry(hash(clubId)), used = new Set();
  const person = () => { let n; do { n = names.first[Math.floor(R() * names.first.length)] + ' ' + names.last[Math.floor(R() * names.last.length)]; } while (used.has(n)); used.add(n); return n; };
  const short = n => n.split(' ').slice(1).join(' ');
  const make = k => Array.from({ length: k }, () => short(person()));
  return { gk: make(1)[0], def: make(4), mid: make(4), fwd: make(2), subs: make(4) };
}

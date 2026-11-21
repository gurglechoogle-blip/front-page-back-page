// Cards: a deck, a 7-card poker hand evaluator, and a quick equity estimate.
export const RANKS = '23456789TJQKA', SUITS = '♠♥♦♣';
export const card = (r, s) => ({ r, s }); // r: 2..14, s: 0..3
export function deck(n = 1) { const d = []; for (let k = 0; k < n; k++) for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push(card(r, s)); return d; }
export function shuffle(d, R = Math.random) { for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; }
export const label = c => (c.r === 10 ? '10' : RANKS[c.r - 2]) + SUITS[c.s];
export const red = c => c.s === 1 || c.s === 2;

/** Score 5 cards: [category, ...tiebreakers]. 8 straight flush ... 0 high card. */
function score5(cs) {
  const rs = cs.map(c => c.r).sort((a, b) => b - a), flush = cs.every(c => c.s === cs[0].s);
  const uniq = [...new Set(rs)]; let straight = 0;
  if (uniq.length === 5) { if (rs[0] - rs[4] === 4) straight = rs[0]; else if (rs[0] === 14 && rs[1] === 5) straight = 5; }
  const cnt = {}; rs.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
  const groups = Object.entries(cnt).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  if (straight && flush) return [8, straight];
  if (groups[0][0] === 4) return [7, groups[0][1], groups[1][1]];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, groups[0][1], groups[1][1]];
  if (flush) return [5, ...rs];
  if (straight) return [4, straight];
  if (groups[0][0] === 3) return [3, groups[0][1], ...groups.slice(1).map(g => g[1])];
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, groups[0][1], groups[1][1], groups[2][1]];
  if (groups[0][0] === 2) return [1, groups[0][1], ...groups.slice(1).map(g => g[1])];
  return [0, ...rs];
}
export const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
/** Best 5 of up to 7 cards. */
export function best(cs) {
  let top = null; const n = cs.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const five = cs.filter((_, i) => i !== a && i !== b);
    if (five.length !== 5) continue; const s = score5(five); if (!top || cmp(s, top) > 0) top = s;
  }
  return top || score5(cs);
}
export const HAND_NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
/** Chance of winning with these hole cards against `opp` random hands, given the board. */
export function equity(hole, board, opp, iters = 120, R = Math.random) {
  const known = new Set([...hole, ...board].map(c => c.r * 4 + c.s));
  const rest = deck().filter(c => !known.has(c.r * 4 + c.s)); let win = 0;
  for (let i = 0; i < iters; i++) {
    const d = shuffle(rest.slice(), R); let k = 0;
    const bd = board.concat(d.slice(k, k + 5 - board.length)); k += 5 - board.length;
    const mine = best(hole.concat(bd)); let ok = 1;
    for (let o = 0; o < opp; o++) { const h = [d[k++], d[k++]], t = cmp(best(h.concat(bd)), mine); if (t > 0) { ok = 0; break; } if (t === 0) ok = Math.min(ok, .5); }
    win += ok;
  }
  return win / iters;
}

const RN = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
const pl = r => (r === 6 ? 'Sixes' : RN[r] + (r > 10 ? 's' : 's'));
/** Plain-English name of your best hand so far, e.g. "Three of a kind, 7s". */
export function describe(cs) {
  if (cs.length < 5) { const [a, b] = cs.map(c => c.r).sort((x, y) => y - x); return a === b ? `Pair of ${pl(a)}` : `${RN[a]} high`; }
  const s = best(cs), n = HAND_NAMES[s[0]];
  switch (s[0]) {
    case 8: return s[1] === 14 ? 'Royal flush!' : `Straight flush, ${RN[s[1]]} high`;
    case 7: return `Four of a kind, ${pl(s[1])}`;
    case 6: return `Full house, ${pl(s[1])} over ${pl(s[2])}`;
    case 5: return `Flush, ${RN[s[1]]} high`;
    case 4: return `Straight, ${RN[s[1]]} high`;
    case 3: return `Three of a kind, ${pl(s[1])}`;
    case 2: return `Two pair, ${pl(s[1])} and ${pl(s[2])}`;
    case 1: return `Pair of ${pl(s[1])}`;
    default: return `${RN[s[1]]} high`;
  }
  void n;
}

// Kits and NPC appearance. Colours from the prototype.
import { pick } from './util.js';

export const SKINS = ['#f1c7a5', '#e3ad86', '#c68a62', '#8d5a3b', '#5e3b26'];
export const HAIRS = ['#2b1d14', '#5a3a22', '#c9a25a', '#161616', '#a0522d', '#3b2a1e'];
export const KIT_US = { shirt: '#c8202f', trim: '#ffffff', shorts: '#f4f4f4', socks: '#c8202f', skin: '#e9b896', hair: '#5a3a22', num: '#ffffff', number: '9' };
export const KIT_THEM = { shirt: '#1f3a7a', trim: '#f2c230', shorts: '#1f3a7a', socks: '#f2c230' };
export const KIT_GK = { shirt: '#36b25a', trim: '#111', shorts: '#151515', socks: '#36b25a', gloves: '#f5f5f5', skin: '#e7b48f', hair: '#2b1d14' };
export const npcKit = base => Object.assign({}, base, { skin: pick(SKINS), hair: pick(HAIRS) });

/**
 * The kit set a moment needs: 4 opponents, a passing team-mate and 3 crossing
 * targets. Random calls happen in the same order as the prototype's startDrill.
 */
export function makeKitSet(us = KIT_US, them = KIT_THEM, gk = KIT_GK) {
  const npc = [0, 1, 2, 3].map(() => npcKit(them));
  const mateKit = npcKit(us);
  const mateKits = [0, 1, 2].map(() => npcKit(us));
  return { us, gk, npc, mateKit, mateKits };
}

/* ---------- club colours ---------- */
const rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
export const colourDist = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
export const luminance = h => { const [r, g, b] = rgb(h); return (.299 * r + .587 * g + .114 * b) / 255; };

/** Which kits each side wears: the away side changes if the shirts clash. */
export function matchColours(home, away) {
  const awayKit = colourDist(home.home.shirt, away.home.shirt) < 150 ? away.away : away.home;
  return { home: home.home, away: awayKit };
}
/** Our striker's kit (number 9) in club colours. */
export function playerKitFrom(c) { return Object.assign({}, KIT_US, { shirt: c.shirt, trim: c.trim, shorts: c.shorts, socks: c.socks, num: luminance(c.shirt) > .6 ? '#111' : '#ffffff', number: '9' }); }
export function teamKitFrom(c) { return { shirt: c.shirt, trim: c.trim, shorts: c.shorts, socks: c.socks }; }
/** Keeper in green unless that clashes, then yellow, then grey. */
export function keeperKitFor(...shirts) {
  for (const s of ['#36b25a', '#f2c230', '#8a8f96']) if (shirts.every(x => colourDist(x, s) > 110)) return Object.assign({}, KIT_GK, { shirt: s, socks: s });
  return KIT_GK;
}

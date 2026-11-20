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
export function makeKitSet(us = KIT_US, them = KIT_THEM) {
  const npc = [0, 1, 2, 3].map(() => npcKit(them));
  const mateKit = npcKit(us);
  const mateKits = [0, 1, 2].map(() => npcKit(us));
  return { us, gk: KIT_GK, npc, mateKit, mateKits };
}

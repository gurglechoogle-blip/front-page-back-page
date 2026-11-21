// Your looks over twenty years: the barber, tattoos, and time doing its thing.
import LK from '../data/looks.json';
import { applyEffects } from './life.js';

export { LK };
const HAIRS = ['#2b1d14', '#5a3a22', '#c9a25a', '#161616', '#a0522d', '#3b2a1e'];
const SKINS = ['#f1c7a5', '#e3ad86', '#c68a62', '#8d5a3b', '#5e3b26'];
export function initLook(c, R = Math.random) {
  c.look = c.look || { natural: HAIRS[Math.floor(R() * HAIRS.length)], skin: SKINS[Math.floor(R() * SKINS.length)], hair: 'short', colour: null, beard: false, tattoo: null, gene: .5 + R() * .8, transplant: 0 };
  return c;
}
const mix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
/** Kit fields that draw your hair, beard and tattoos, aged correctly. */
export function lookFields(c, age) {
  const L = c.look; if (!L) return {};
  const grey = Math.max(0, Math.min(.85, (age - 32) / 12)), recede = Math.max(0, Math.min(1, (age - 29) / 9 * L.gene - L.transplant));
  return { hairStyle: L.hair === 'short' ? 'default' : L.hair, hair: mix(L.colour || L.natural, '#c8c8c8', grey), skin: L.skin, recede, beard: L.beard, tattoo: L.tattoo };
}
export function haircut(c, id, age) {
  const h = LK.hair.find(x => x.id === id); if (age < h.minAge) return { ok: false, why: `${h.minAge}+` }; if (c.bank < h.price) return { ok: false, why: 'Skint' };
  c.bank -= h.price; c.look.hair = id; c.look.colour = h.colour || null; applyEffects(c, h.effects); return { ok: true };
}
export function tattoo(c, id, age) {
  const t = LK.tattoos.find(x => x.id === id); if (age < t.minAge) return { ok: false, why: `${t.minAge}+` }; if (c.bank < t.price) return { ok: false, why: 'Skint' };
  c.bank -= t.price; c.look.tattoo = id; applyEffects(c, t.effects); return { ok: true };
}

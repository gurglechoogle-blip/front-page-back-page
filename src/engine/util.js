// Small maths helpers, verbatim from the training ground prototype (v1.1).
export const rand = (a, b) => a + Math.random() * (b - a);
export const randn = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.5;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const pick2 = (a, R) => a[Math.floor(R() * a.length)];
export function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

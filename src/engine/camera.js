// Pitch projection and cameras. World units: x = metres across the pitch
// (0 = centre of goal), z = depth (0 = near the camera, GOALZ = goal line),
// h = metres above the ground. Tuned values from the prototype; do not change.
import { clamp } from './util.js';

export const W = 800, H = 600, GOALZ = 0.96, GW = 3.66, GH = 2.44;

export const CAMS = {
  def: { n: 'def', sn: 1.3, sf: .6, yn: 590, yf: 272, cx: 0 },
  fk: { n: 'fk', sn: .95, sf: .45, yn: 490, yf: 252, cx: 0 },
  cross: { n: 'cross', sn: .7, sf: .45, yn: 540, yf: 262, cx: -4.5 },
};

let CAM = CAMS.def;
export const getCam = () => CAM;
export function setCam(c) { CAM = typeof c === 'string' ? CAMS[c] : c; }

function camK() {
  const a = 1 / CAM.sn, b = 1 / CAM.sf - a, c = (CAM.yn - CAM.yf) / (CAM.sn - CAM.sf);
  return { a: a, b: b, c: c, yh: CAM.yf - c * CAM.sf };
}
/** Project a world point to screen. Returns {x, y, s} where s is the scale. */
export function P(x, z, h) {
  h = h || 0; const k = camK(), s = 1 / Math.max(.08, k.a + k.b * z);
  return { x: 400 + (x - CAM.cx) * 100 * s, y: k.yh + k.c * s - h * 100 * s, s: s };
}
/** Inverse projection onto the ground plane. */
export function groundAt(mx, my) {
  const k = camK(); const s = clamp((my - k.yh) / k.c, .2, 3);
  return { x: CAM.cx + (mx - 400) / (100 * s), z: (1 / s - k.a) / k.b };
}

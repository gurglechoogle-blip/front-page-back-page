// The frame loop. Advances clock.now by the real frame time (capped at 0.05s)
// and calls the active screen's frame(). Same timing as the prototype.
import { clock } from './clock.js';

let screen = null;
export function setScreen(s) { if (screen && screen.unmount) screen.unmount(); screen = s; if (s && s.mount) s.mount(); }
export const getScreen = () => screen;

let last = performance.now() / 1000;
function frame(ts) {
  const t = ts / 1000, dt = Math.min(.05, Math.max(0, t - last)); last = t; clock.now += dt;
  try { if (screen && screen.frame) screen.frame(); } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
export function startLoop() { requestAnimationFrame(frame); }

// Pointer input in canvas space (800x600). Screens set the active handlers;
// the training ground and match screen route them to the current moment.
import { W, H } from './camera.js';

export const mouse = { x: 400, y: 300, down: false };
let handlers = { down: null, up: null };
export function setInputHandlers(h) { handlers = Object.assign({ down: null, up: null }, h); }

export function attachInput(cv) {
  function setMouse(e) { const r = cv.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * W / r.width; mouse.y = (e.clientY - r.top) * H / r.height; }
  cv.addEventListener('pointermove', setMouse);
  cv.addEventListener('pointerdown', e => { setMouse(e); mouse.down = true; try { cv.setPointerCapture(e.pointerId); } catch (_) { } handlers.down && handlers.down(); e.preventDefault(); });
  cv.addEventListener('pointerup', e => { setMouse(e); mouse.down = false; handlers.up && handlers.up(); });
  cv.addEventListener('pointercancel', () => { mouse.down = false; handlers.up && handlers.up(); });
}

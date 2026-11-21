// Goal replays: record a moment's frames, then draw them back with the same
// drawing code. A clip is ~2 seconds at 30fps of plain numbers.
import { setCam, GOALZ } from './camera.js';
import { setCtx, setVenue, drawBackground, drawNet, drawPosts, drawPerson, drawBall, drawKeeper, bigText } from './draw.js';
import { clock } from './clock.js';

/** A recorder to hang on a moment: keeps the last `seconds`, every other frame. */
export function makeRecorder(seconds = 2.4) {
  const frames = []; let n = 0;
  const rec = f => { if (n++ % 2) return; frames.push(f); if (frames.length > seconds * 30) frames.shift(); };
  rec.frames = frames; return rec;
}
/** Turn recorded frames into a storable clip (kits stored once, by reference index). */
export function makeClip(frames, kits, cam, venue) {
  const table = [kits.us, kits.gk, ...kits.npc, kits.mateKit, ...kits.mateKits];
  const idx = k => Math.max(0, table.indexOf(k));
  const okits = (frames[0] && frames[0].ok || []).map(idx);
  // Store only what changed since the previous frame (most of the cast stand still), to the centimetre.
  const rd = v => Array.isArray(v) ? v.map(rd) : typeof v === 'number' ? Math.round(v * 100) / 100 : v;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let prev = null;
  const packed = frames.map(f => {
    const g = { b: rd(f.b), k: rd(f.k), p: rd(f.p), rr: f.rr, o: rd(f.o), n: rd(f.n), s: f.s }, out = {};
    for (const key in g) {
      if (key === 'o') { const arr = g.o.map((x, j) => prev && same(x, prev.o[j]) ? 0 : x); if (!prev || arr.some(x => x !== 0)) out.o = arr; }
      else if (!prev || !same(g[key], prev[key])) out[key] = g[key];
    }
    prev = g; return out;
  });
  return { v: 2, cam, venue, kits: table, okits, frames: packed };
}
/** Undo makeClip's packing (cached, never saved). */
const unpacked = new WeakMap();
function full(clip) {
  if (unpacked.has(clip)) return unpacked.get(clip);
  let prev = {};
  const fr = clip.v !== 2 ? clip.frames : clip.frames.map(f => { const g = Object.assign({}, prev, f); if (f.o) g.o = f.o.map((x, j) => x === 0 ? prev.o[j] : x); if (!('rr' in f)) g.rr = prev.rr; prev = g; return g; });
  unpacked.set(clip, fr); return fr;
}
export const clipLength = clip => full(clip).length;
const unpose = (a, kit) => ({ x: a[0], z: a[1], facing: a[2] ? 'back' : 'front', armL: a[3] ?? undefined, armR: a[4] ?? undefined, legL: a[5] ?? undefined, legR: a[6] ?? undefined, lenR: a[7] ?? undefined, lift: a[8] ?? undefined, ang: a[9] ?? undefined, scaleY: a[10] ?? undefined, alpha: a[11] ?? undefined, kit });
const clean = o => { for (const k in o) if (o[k] === undefined || o[k] === null) delete o[k]; return o; };

/** Draw frame i of a clip onto ctx. */
export function drawClipFrame(ctx, clip, i, caption) {
  const fr = full(clip), f = fr[Math.min(i, fr.length - 1)];
  setCam(clip.cam); setVenue(clip.venue); setCtx(ctx); drawBackground();
  const items = [{ z: 1.001, d: () => drawNet(f.n >= 0 ? clock.now - f.n : null) }, { z: GOALZ, d: drawPosts },
    { z: GOALZ - .012, d: () => drawKeeper({ x: f.k[0], h: f.k[1], ang: f.k[2], dive: f.k[3] ? { t0: -1 } : null }, clip.kits[1]) }];
  f.o.forEach((o, j) => items.push({ z: o[1], d: () => drawPerson(clean(unpose(o, clip.kits[clip.okits[j]] || clip.kits[2]))) }));
  const pl = clean(unpose(f.p, clip.kits[0])); if (f.rr) pl.reachR = { x: f.rr[0], y: f.rr[1] };
  items.push({ z: pl.z, d: () => drawPerson(pl) });
  const b = { x: f.b[0], z: f.b[1], h: f.b[2] }; let bz = b.z; if (Math.abs(b.z - pl.z) < .03) bz = pl.z + .001;
  items.push({ z: bz, d: () => drawBall(b, !!f.s) });
  items.sort((a, c) => c.z - a.z).forEach(it => it.d());
  if (caption && i >= fr.length - 30) bigText(caption, '#ffc928', caption.length > 22 ? 34 : 46);
}

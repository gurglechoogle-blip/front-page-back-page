// Drawing: pitch background, goal, players, ball and HUD primitives.
// Ported verbatim from the prototype; the only change is that state the old
// code read from the global `G` is now passed in as arguments.
import { W, H, GOALZ, GW, GH, P, getCam } from './camera.js';
import { clamp, pick2, mulberry } from './util.js';
import { clock } from './clock.js';
import { KIT_GK } from './kits.js';

export let ctx = null;
const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const tctx = tmp.getContext('2d');
/** Point all drawing at a canvas context. */
export function setCtx(c) { ctx = c; }

/* ---------- background ---------- */
const bgCache = {};
export function getBg() { const CAM = getCam(); if (!bgCache[CAM.n]) bgCache[CAM.n] = buildBg(); return bgCache[CAM.n]; }
export function drawBackground() { ctx.drawImage(getBg(), 0, 0); }

function buildBg() {
  const CAM = getCam();
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H; const c = bg.getContext('2d'); const R = mulberry(7);
  let g = c.createLinearGradient(0, 0, 0, 262); g.addColorStop(0, '#8ea3b8'); g.addColorStop(1, '#d5dbe0'); c.fillStyle = g; c.fillRect(0, 0, W, CAM.yf); c.save(); c.translate(0, CAM.yf - 262);
  c.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 9; i++) { const x = R() * W, y = 20 + R() * 110; for (let j = 0; j < 5; j++) { c.beginPath(); c.ellipse(x + j * 28 - 56, y + R() * 10, 40 + R() * 30, 14 + R() * 8, 0, 0, 7); c.fill(); } }
  // tower blocks
  [[30, 96, 70], [690, 110, 80]].forEach(([x, top, w]) => {
    c.fillStyle = '#8b9097'; c.fillRect(x, top, w, 262 - top); c.fillStyle = '#a3a8ae'; c.fillRect(x, top, w, 6);
    for (let yy = top + 14; yy < 250; yy += 13) for (let xx = x + 6; xx < x + w - 8; xx += 12) { c.fillStyle = R() < .25 ? '#e6d9a8' : '#5f666e'; c.fillRect(xx, yy, 7, 7); }
  });
  // terraced houses
  const bricks = ['#8d5a44', '#9a6248', '#7f4f3c', '#a36a4e'];
  for (let x = -20; x < W; x += 48) {
    const top = 196 + R() * 4; c.fillStyle = pick2(bricks, R); c.fillRect(x, top, 48, 262 - top);
    c.fillStyle = '#4b4e57'; c.beginPath(); c.moveTo(x - 2, top); c.lineTo(x + 8, top - 14); c.lineTo(x + 42, top - 14); c.lineTo(x + 50, top); c.fill();
    c.fillStyle = '#6b4636'; c.fillRect(x + 34, top - 22, 7, 10); c.fillStyle = '#c6cfd4'; c.fillRect(x + 8, top + 10, 12, 10); c.fillRect(x + 28, top + 10, 12, 10);
    c.fillStyle = '#e8ecef'; c.fillRect(x + 8, top + 15, 12, 1); c.fillRect(x + 28, top + 15, 12, 1);
  }
  c.fillStyle = 'rgba(210,220,228,.28)'; c.fillRect(0, 80, W, 182);
  // trees
  for (let i = 0; i < 16; i++) { const x = R() * W, y = 236 + R() * 10, r = 14 + R() * 16; c.fillStyle = R() < .5 ? '#3f5c38' : '#4b6b40'; for (let j = 0; j < 4; j++) { c.beginPath(); c.arc(x + (R() - .5) * r * 1.4, y - (R()) * r * .8, r * .7, 0, 7); c.fill(); } }
  // fence
  c.fillStyle = '#2e4a3b'; c.fillRect(0, 244, W, 2); c.fillRect(0, 256, W, 2); for (let x = 0; x < W; x += 6) c.fillRect(x, 240, 2, 22);
  // sign
  c.fillStyle = '#2f5d3a'; c.fillRect(560, 214, 150, 30); c.strokeStyle = '#e9efe9'; c.lineWidth = 2; c.strokeRect(563, 217, 144, 24); c.fillStyle = '#fff'; c.font = 'bold 11px Roboto Condensed, Arial'; c.textAlign = 'center'; c.fillText('ASHWORTH REC', 635, 228); c.font = '9px Roboto Condensed, Arial'; c.fillText('No golf · Dogs on leads', 635, 238); c.fillStyle = '#333'; c.fillRect(575, 244, 4, 18); c.fillRect(690, 244, 4, 18);
  c.restore();
  // grass
  const gy0 = CAM.yf - 4; g = c.createLinearGradient(0, gy0, 0, H); g.addColorStop(0, '#6d8b48'); g.addColorStop(1, '#52762f'); c.fillStyle = g; c.fillRect(0, gy0, W, H - gy0);
  for (let i = 0; i < 12; i++) { const z0 = i / 12, z1 = (i + 1) / 12; if (i % 2) continue; const a = P(-30, z0), b = P(30, z0), cc = P(30, z1), d = P(-30, z1); c.fillStyle = 'rgba(255,255,255,.035)'; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(cc.x, cc.y); c.lineTo(d.x, d.y); c.fill(); }
  // mud
  const blob = (x, z, r, col) => { const p = P(x, z); c.fillStyle = col; c.beginPath(); c.ellipse(p.x, p.y, r * 100 * p.s, r * 100 * p.s * (.12 + .3 * (1 - z)), 0, 0, 7); c.fill(); };
  blob(0, .9, 3.4, 'rgba(96,74,46,.55)'); blob(0, .88, 2.2, 'rgba(82,62,38,.5)'); blob(0, .4, 1.3, 'rgba(92,70,44,.5)'); blob(0, .08, 2.5, 'rgba(92,70,44,.35)');
  for (let i = 0; i < 40; i++) blob((R() - .5) * 12, R() * .95, .3 + R() * 1.2, 'rgba(' + (80 + R() * 25 | 0) + ',' + (62 + R() * 15 | 0) + ',40,' + (.25 + R() * .35) + ')');
  for (let i = 0; i < 6; i++) { const x = (R() - .5) * 9, z = R() * .85; blob(x, z, .25 + R() * .4, 'rgba(120,140,155,.55)'); blob(x + .05, z + .005, .12, 'rgba(220,230,235,.35)'); }
  // lines
  c.strokeStyle = 'rgba(255,255,255,.5)';
  const line = (pts) => { c.beginPath(); pts.forEach(([x, z], i) => { const p = P(x, z); c.lineWidth = Math.max(1, 6 * p.s); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }); c.stroke(); };
  line([[-30, GOALZ], [30, GOALZ]]); line([[-5.5, GOALZ], [-5.5, .82], [5.5, .82], [5.5, GOALZ]]); line([[-16.5, GOALZ], [-16.5, .2], [16.5, .2], [16.5, GOALZ]]);
  c.beginPath(); for (let a = -56; a <= 56; a += 4) { const r = a * Math.PI / 180, p = P(9.15 * Math.sin(r), .4 - .366 * Math.cos(r)); c.lineWidth = Math.max(1, 6 * p.s); a === -56 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y); } c.stroke();
  let sp = P(0, .4); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(sp.x, sp.y, 6 * sp.s, 2 * sp.s, 0, 0, 7); c.fill();
  // litter
  [[-5.2, .3, '#d23a3a'], [4.6, .18, '#2f7fd6'], [-2.6, .75, '#f0c419']].forEach(([x, z, col]) => { const p = P(x, z); c.fillStyle = col; c.fillRect(p.x, p.y - 3 * p.s, 9 * p.s, 5 * p.s); });
  // vignette
  g = c.createRadialGradient(400, 330, 250, 400, 330, 560); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  return bg;
}

/* ---------- goal ---------- */
/** netT0: game time the ball hit the net (makes it ripple), or null. */
export function drawNet(netT0) {
  const now = clock.now;
  const shake = netT0 && now - netT0 < .7 ? Math.sin((now - netT0) * 40) * (1 - (now - netT0) / .7) * 3 : 0;
  const tl = P(-GW, GOALZ, GH), br = P(GW, GOALZ, 0);
  ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 1;
  for (let x = -GW; x <= GW + .01; x += .3) { const a = P(x, GOALZ, GH), b = P(x, GOALZ, 0); ctx.beginPath(); ctx.moveTo(a.x + shake, a.y); ctx.quadraticCurveTo(a.x + shake * 2, (a.y + b.y) / 2, b.x, b.y); ctx.stroke(); }
  for (let h = 0; h <= GH; h += .3) { const a = P(-GW, GOALZ, h), b = P(GW, GOALZ, h); ctx.beginPath(); ctx.moveTo(a.x, a.y + shake * .5); ctx.lineTo(b.x, b.y + shake * .5); ctx.stroke(); }
  ctx.restore();
}
export function drawPosts() {
  const s = P(0, GOALZ).s, lw = Math.max(3, 12 * s);
  ctx.save(); ctx.lineCap = 'square'; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = lw;
  const a = P(-GW, GOALZ, 0), b = P(-GW, GOALZ, GH), c = P(GW, GOALZ, GH), d = P(GW, GOALZ, 0);
  ctx.beginPath(); ctx.moveTo(a.x + 3, a.y); ctx.lineTo(b.x + 3, b.y + 3); ctx.lineTo(c.x + 3, c.y + 3); ctx.lineTo(d.x + 3, d.y); ctx.stroke();
  ctx.strokeStyle = '#f6f6f6'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke(); ctx.restore();
}

/* ---------- people ---------- */
/**
 * Draw a footballer standing at world (o.x, o.z). Pose fields: facing
 * ('front'|'back'), lift, ang, scaleY, flipY, legL/legR, lenL/lenR, reachR
 * (screen point the right foot reaches for), armL/armR, alpha, bubble.
 */
export function drawPerson(o) {
  if (o.alpha != null && o.alpha < 1 && ctx !== tctx) { const real = ctx; tctx.clearRect(0, 0, W, H); ctx = tctx; drawPerson(Object.assign({}, o, { alpha: 1 })); ctx = real; ctx.save(); ctx.globalAlpha = o.alpha; ctx.drawImage(tmp, 0, 0); ctx.restore(); return; }
  const p = P(o.x, o.z, 0), u = 100 * p.s, k = o.kit, al = o.alpha == null ? 1 : o.alpha;
  ctx.save(); ctx.globalAlpha = al * .28 * Math.max(.3, 1 - (o.lift || 0) * .4); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(p.x, p.y, .3 * u, .07 * u, 0, 0, 7); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalAlpha = al; ctx.translate(p.x, p.y - (o.lift || 0) * u);
  if (o.ang) { ctx.translate(0, -.95 * u); ctx.rotate(o.ang); ctx.translate(0, .95 * u); }
  if (o.scaleY) ctx.scale(1, o.scaleY);
  if (o.flipY) { ctx.translate(0, -.95 * u); ctx.scale(1, o.flipY); ctx.translate(0, .95 * u); }
  const R = (x, y, w, h, r, f) => { ctx.fillStyle = f; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x * u, y * u, w * u, h * u, r * u); else ctx.rect(x * u, y * u, w * u, h * u); ctx.fill(); };
  const leg = (hx, a, len, reach) => {
    ctx.save(); ctx.translate(hx * u, -.92 * u);
    if (reach) { const m = ctx.getTransform().invertSelf(), lp = m.transformPoint(new DOMPoint(reach.x, reach.y)); a = Math.atan2(-lp.x, lp.y); len = clamp(Math.hypot(lp.x, lp.y) / (.86 * u), .45, 1.5); }
    ctx.rotate(a || 0); ctx.scale(1, len || 1);
    R(-.075, 0, .15, .44, .05, k.skin); R(-.072, .42, .144, .4, .04, k.socks); R(-.072, .42, .144, .045, 0, k.trim); R(-.085, .8, .17, .11, .045, '#151515'); ctx.restore();
  };
  leg(-.11, o.legL || .03, o.lenL); leg(.11, o.legR || -.03, o.lenR, o.reachR);
  R(-.225, -1.0, .45, .37, .06, k.shorts);
  const arm = (sx, a) => { ctx.save(); ctx.translate(sx * u, -1.43 * u); ctx.rotate(a); R(-.065, 0, .13, .24, .05, k.shirt); R(-.05, .22, .1, .28, .05, k.skin); R(-.065, .46, .13, .12, .05, k.gloves || k.skin); ctx.restore(); };
  arm(-.24, o.armL == null ? .18 : o.armL); arm(.24, o.armR == null ? -.18 : o.armR);
  R(-.235, -1.5, .47, .56, .1, k.shirt); R(-.235, -1.5, .47, .05, .02, k.trim);
  R(-.05, -1.6, .1, .12, .02, k.skin);
  if (o.facing === 'back' && k.number) { ctx.fillStyle = k.num; ctx.font = 'bold ' + (.24 * u) + 'px Roboto Condensed, Arial'; ctx.textAlign = 'center'; ctx.fillText(k.number, 0, -1.13 * u); }
  ctx.fillStyle = k.skin; ctx.beginPath(); ctx.arc(0, -1.72 * u, .135 * u, 0, 7); ctx.fill();
  if (o.facing === 'back') {
    ctx.beginPath(); ctx.arc(-.13 * u, -1.71 * u, .035 * u, 0, 7); ctx.arc(.13 * u, -1.71 * u, .035 * u, 0, 7); ctx.fill();
    ctx.fillStyle = k.hair; ctx.beginPath(); ctx.arc(0, -1.735 * u, .138 * u, Math.PI * .92, Math.PI * 2.08); ctx.lineTo(.11 * u, -1.63 * u); ctx.lineTo(-.11 * u, -1.63 * u); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = k.hair; ctx.beginPath(); ctx.arc(0, -1.74 * u, .142 * u, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-.045 * u, -1.72 * u, .016 * u, 0, 7); ctx.arc(.045 * u, -1.72 * u, .016 * u, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(60,20,20,.7)'; ctx.lineWidth = Math.max(1, .012 * u); ctx.beginPath(); ctx.moveTo(-.035 * u, -1.65 * u); ctx.lineTo(.035 * u, -1.65 * u); ctx.stroke();
  }
  ctx.restore();
  if (o.bubble) {
    const hx = p.x + .25 * u, hy = p.y - 2.05 * u; ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(hx, hy - 18, 46, 22, 6); else ctx.rect(hx, hy - 18, 46, 22); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + 6, hy + 4); ctx.lineTo(hx + 2, hy + 12); ctx.lineTo(hx + 14, hy + 4); ctx.fill(); ctx.fillStyle = '#111'; ctx.font = 'bold 13px Roboto Condensed, Arial'; ctx.textAlign = 'center'; ctx.fillText(o.bubble, hx + 23, hy - 2); ctx.restore();
  }
}

/** spinning: whether the ball is in flight (it rotates). */
export function drawBall(b, spinning) {
  const now = clock.now;
  const g = P(b.x, b.z, 0), p = P(b.x, b.z, b.h), r = Math.max(2.5, .14 * 100 * p.s);
  ctx.save(); ctx.globalAlpha = clamp(.35 - b.h * .08, .08, .35); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(g.x, g.y, r * 1.1, r * .35, 0, 0, 7); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(p.x, p.y - r * .3);
  const gr = ctx.createRadialGradient(-r * .35, -r * .35, r * .1, 0, 0, r); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#cfd3d6');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.rotate(now * 6 * (spinning ? 1 : 0)); ctx.fillStyle = '#262626';
  ctx.beginPath(); ctx.arc(0, 0, r * .3, 0, 7); ctx.fill();
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .85, Math.sin(a) * r * .85, r * .22, 0, 7); ctx.fill(); }
  ctx.restore();
}
export function drawKeeper(kp, kit = KIT_GK) {
  const diving = kp.dive && clock.now >= kp.dive.t0;
  drawPerson({ x: kp.x, z: GOALZ - .012, kit: kit, facing: 'front', lift: kp.h, ang: kp.ang, armL: diving ? 2.7 : .75, armR: diving ? -2.7 : -.75, scaleY: diving ? 1 : .96, legL: diving ? .25 : .12, legR: diving ? -.25 : -.12 });
}

/* ---------- HUD primitives ---------- */
export function bar(x, y, w, h) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6); }
export function label(t, x, y, bgc) { ctx.save(); ctx.font = 'bold 11px Roboto Condensed, Arial'; const w = ctx.measureText(t).width + 12; ctx.fillStyle = bgc || '#c42a1d'; ctx.fillRect(x - w / 2, y - 12, w, 15); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(t, x, y); ctx.restore(); }
export function ghostBall(x, z, h, a) { const p = P(x, z, h), r = Math.max(2.5, .14 * 100 * p.s); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y - r * .3, r, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(p.x, p.y - r * .3, r * .3, 0, 7); ctx.fill(); ctx.restore(); }
export function bigText(t, col, size) { ctx.save(); ctx.font = 'italic ' + size + 'px Anton, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(t, 400, 140); ctx.fillStyle = col; ctx.fillText(t, 400, 140); ctx.restore(); }
export function wrap(t, x, y, maxW, lh) {
  const words = t.split(' '); let line = '', lines = []; words.forEach(w => { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }); lines.push(line);
  const y0 = y - (lines.length - 1) * lh / 2 + 4; lines.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh));
}
/** Big red arrow from screen point a to e (free kick aim). */
export function aimArrow(a, e) {
  const ang = Math.atan2(e.y - a.y, e.x - a.x); ctx.save(); ctx.strokeStyle = '#e0261c'; ctx.fillStyle = '#e0261c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(e.x - Math.cos(ang) * 10, e.y - Math.sin(ang) * 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x - Math.cos(ang - .5) * 16, e.y - Math.sin(ang - .5) * 16); ctx.lineTo(e.x - Math.cos(ang + .5) * 16, e.y - Math.sin(ang + .5) * 16); ctx.fill(); ctx.restore();
}

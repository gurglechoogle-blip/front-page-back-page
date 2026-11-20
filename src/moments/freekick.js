// FREE KICK: outside the D, varied position, zoomed-out camera.
// Mouse = direction (red arrow) and power (ghost-ball trail); click locks the
// curve from the sweeping marker on the white bar.
import { BaseMoment, CURVE, clock, rand, randn, clamp, lerp, pick, mouse } from './core.js';
import { W, H, GOALZ, P, getCam } from '../engine/camera.js';
import { ctx, ghostBall, aimArrow, label } from '../engine/draw.js';

export class FreeKick extends BaseMoment {
  get key() { return 'freekick'; }
  get title() { return 'Free Kick'; }
  get instructions() { return 'Mouse left/right = direction (red arrow). Up/down = power (ghost balls). Click when the curve marker on the white bar is where you want it.'; }
  get camera() { return 'fk'; }
  get standPose() { return { armL: .6, armR: -.6, legR: -.12, legL: .05 }; }

  setup() {
    const G = this;
    G.mode = 'fk'; G.bx = rand(-3.4, 3.4); G.bz = rand(-.05, .02); G.plx = G.bx - .62; G.plz = G.bz - .06; G.wallZ = G.bz + .36;
    G.uW = (G.wallZ - G.bz) / (GOALZ - G.bz); const sg = G.bx >= 0 ? 1 : -1;
    G.wallX = lerp(G.bx, 0, G.uW) + sg * .45; G.keeper.x = -sg * .8;
    for (let i = 0; i < 4; i++) this.def(G.wallX - .75 + i * .5, G.wallZ, i, { armL: -.45, armR: .45, def: false });
    G.phase = 'aim'; G.markT0 = clock.now; G.markSpd = 4.3 / this.sf('freekick');
  }
  goalAimX() { const CAM = getCam(), pg = P(0, GOALZ, 0); return clamp(CAM.cx + (mouse.x - 400) / (100 * pg.s), -7, 7); }
  fkPower() { return clamp((520 - mouse.y) / 330, 0, 1); }
  fkPath(gxAim, c, p) {
    const G = this, uW = G.uW, h0 = .11, hW = 1 + 2.2 * p, hG = -.3 + 3.2 * p;
    return { hW: hW, hG: hG, x: u => lerp(G.bx, gxAim, u) + CURVE * c * u * u, h: (gh) => u => h0 * ((u - uW) * (u - 1)) / (uW) + hW * (u * (u - 1)) / (uW * (uW - 1)) + gh * (u * (u - uW)) / (1 - uW) };
  }
  onDown() { if (this.phase === 'aim') this.shootFreeKick(); }
  shootFreeKick() {
    const G = this;
    const gxAim = this.goalAimX(), p = this.fkPower(), c = this.sweep(), jit = randn() * .15;
    const fp = this.fkPath(gxAim, c, p), gh = fp.hG + randn() * .1;
    const xPath = u => fp.x(u) + jit * u, gx = xPath(1), xw = xPath(G.uW);
    const blocked = fp.hW < 1.95 && Math.abs(xw - G.wallX) < 1.05;
    G.pose = 'kick'; G.poseT0 = clock.now;
    this.launchShot({ delay: .06, x: G.bx, z: G.bz, h: .11, q: clamp(1 - Math.abs(p - .62) * 1.8, 0, 1) * .6 + Math.abs(c) * .4, power: .55 + p * .35, gx: gx, gh: Math.max(.05, gh), hPath: fp.h(gh), xPath: xPath, blocked: blocked, durMul: .9 });
  }

  ballPos() { return { x: this.bx, z: this.bz, h: .11 }; }
  renderAids() {
    const G = this;
    if (G.phase !== 'aim') return;
    const ga = this.goalAimX(), p = this.fkPower(), fp = this.fkPath(ga, 0, p), hp = fp.h(fp.hG);
    for (let i = 1; i <= 7; i++) { const u = i * .06; ghostBall(fp.x(u), lerp(G.bz, GOALZ, u), hp(u), .42 - i * .035); }
    aimArrow(P(G.bx, G.bz), P(lerp(G.bx, ga, .2), lerp(G.bz, GOALZ, .2)));
  }
  renderBars() {
    const G = this;
    if (G.phase !== 'aim') return;
    const cy = H - 96, c = this.sweep(), L = G.bx > 0 ? 60 : 560, M = L + 90, Rr = L + 180;
    ctx.fillStyle = 'rgba(10,12,14,.6)'; ctx.fillRect(L - 16, cy - 30, Rr - L + 32, 58);
    ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(L, cy); ctx.quadraticCurveTo(M, cy + 22, Rr, cy); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(L, cy); ctx.quadraticCurveTo(M, cy + 22, Rr, cy); ctx.stroke();
    const t = (c + 1) / 2, bx = (1 - t) * (1 - t) * L + 2 * (1 - t) * t * M + t * t * Rr, by = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * (cy + 22) + t * t * cy;
    ctx.fillStyle = '#e0261c'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 8, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.fillRect(M - 1, cy + 6, 2, 10); ctx.font = 'bold 10px Roboto Condensed, Arial'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('◀ BEND LEFT', L + 18, cy + 20); ctx.fillText('BEND RIGHT ▶', Rr - 18, cy + 20); ctx.restore();
    label('CURVE', M, cy - 14, '#333');
    ctx.save(); ctx.font = 'bold 12px Roboto Condensed, Arial'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText('POWER ' + Math.round(this.fkPower() * 100) + '%', G.bx > 0 ? W - 90 : 14, H - 70); ctx.restore();
  }

  goalComment({ high, corner, low, side }) { return high && corner ? 'GOAL! Curled into the top ' + side + ' corner!' : low ? 'GOAL! Low and into the ' + (corner ? 'bottom ' + side + ' corner' : 'net') + '!' : 'GOAL! Bent it round the wall!'; }
  wallComment() { return pick(['Straight into the wall!', 'Charged down by the wall!']); }
}

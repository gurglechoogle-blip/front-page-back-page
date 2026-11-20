// TURN & SHOOT: click as the ball reaches your feet to turn and cut inside
// away from the defender, hold (bar fills in 0.35s = across goal), release.
// Keeper covers the near post.
import { BaseMoment, clock, rand, randn, clamp } from './core.js';

export class TurnShoot extends BaseMoment {
  get key() { return 'turn'; }
  get title() { return 'Turn & Shoot'; }
  get instructions() { return 'Click as the ball reaches your feet to turn and cut inside. Hold: the longer you hold, the further across goal the shot goes. Release to shoot.'; }
  get standPose() { return { scaleY: .93, armL: .6, armR: -.6, legL: .12, legR: -.12 }; }
  get chargeTimeout() { return .5; }
  keeperStartX() { return rand(-2.1, 1.1); }

  setup() {
    const G = this;
    G.mode = 'turn'; G.plx = -2.3; G.plz = .55; G.pz = .54; G.facing = 'front';
    G.x0 = -2.0; G.z0 = -.2; G.xL = -2.24; G.h0 = .11; G.hA = .11; G.T = .38;
    G.defObj = this.def(-2.65, .6, 0, { bx: -2.65, facing: 'back', armL: .6, armR: -.6, scaleY: .95, def: false });
    G.phase = 'ready'; G.phaseT0 = clock.now;
  }
  cutX() { return this.plx + (this.cutT0 == null ? 0 : .95 * Math.min(1, (clock.now - this.cutT0) / .3)); }
  onDown() {
    const G = this, now = clock.now;
    if (G.phase !== 'incoming') return;
    if (G.clicked) return; G.clicked = true;
    const e = now - (G.t0 + G.T), tw = .14 * this.sf('turn');
    if (Math.abs(e) < tw) { G.controlQ = clamp(1 - Math.abs(e) / tw * .6, 0, 1); G.phase = 'charge'; G.chargeStart = now; G.facing = 'back'; G.held = true; G.cutT0 = now; }
    else this.miss(e < 0 ? 'Went to turn too early!' : 'Heavy touch, it\'s run away from you!');
  }
  onUp() {
    const G = this, now = clock.now;
    if (G.phase !== 'charge') return;
    G.pose = 'kick'; G.poseT0 = now;
    const p = Math.min(1, this.charge(.35)), cq = G.controlQ;
    const gx = -4.6 + 9.2 * p + randn() * (.15 + (1 - cq) * .8), gh = rand(.15, 1.4) + (1 - cq) * Math.random() * 1.6;
    G.held = false;
    this.launchShot({ x: this.cutX() + .15, z: G.plz + .015, h: .11, q: cq, power: .9, gx: gx, gh: gh, delay: .06 });
  }
  updateIncoming(now) {
    const G = this;
    if (!G.clicked && now > G.t0 + G.T + .2 * this.sf('turn')) { G.clicked = true; this.miss('It\'s run straight under your foot!'); }
  }
  updateMid(now) { const G = this; if (G.defObj && G.cutT0 != null) G.defObj.x = G.defObj.bx + .4 * Math.min(1, (now - G.cutT0) / .5); }
  keeperProfile() { return [.97, .22]; }
  saveBias(gx) { return gx < -1.5 ? .2 + (this.keeper.x < -.5 ? .15 : 0) : gx > 1.5 ? .08 : 0; }

  ballPos(now) {
    const G = this;
    if (G.held) return { x: this.cutX() + .12, z: G.plz + .015, h: .11 };
    if (G.phase === 'ready') return { x: G.x0, z: G.z0, h: G.h0 };
    return this.incomingPos(now);
  }
  posePlayer(pl, kickT, kickPose) {
    const G = this;
    pl.x = this.cutX(); pl.z = G.plz;
    if (G.phase === 'charge') { pl.legR = -.45; pl.armL = .9; pl.armR = -.4; pl.ang = .1; pl.scaleY = .96; }
    kickPose();
  }
  renderBars() { if (this.phase === 'charge') this.drawChargeBar(.35, { np: .1, fp: .9 }); }

  goalComment({ gx }) { return gx > 2.3 ? 'GOAL! Turns and curls it into the far corner!' : gx < -2.3 ? 'GOAL! Turns and squeezes it in at the near post!' : 'GOAL! Lovely turn and finish!'; }
}

// HEADER: player starts deep in the box, left of goal. Drilled or floated
// cross. Hold to load (bar fills in 0.5s = how far across goal), release as the
// ball meets his head. Keeper is weaker against drilled crosses.
import { BaseMoment, JFG, clock, rand, randn, clamp, pick } from './core.js';

export class Header extends BaseMoment {
  get key() { return 'header'; }
  get title() { return 'Headers'; }
  get instructions() { return 'Position your man with the mouse. Hold the button to load up (longer = further across goal), and release exactly as the ball reaches his head.'; }
  get standPose() { return JFG; }
  keeperStartX() { return rand(-1.3, 1.3); }

  setup() {
    const G = this;
    G.mode = 'header'; G.pz = .68; const floated = Math.random() < .5;
    G.floated = floated;
    if (floated) Object.assign(G, { x0: 7, xL: -7, z0: G.pz - .004, h0: 1.0, hA: .4, arc: 1.55, T: 2.1, variant: 'Floated cross…' });
    else { Object.assign(G, { x0: 7, xL: -7, z0: G.pz - .004, h0: rand(1.82, 2.0), T: 1.25, variant: 'Drilled cross…' }); G.hA = G.h0; }
    this.def(1.3, .695, 0);
    G.phase = 'ready'; G.phaseT0 = clock.now;
  }
  onDown() {
    const G = this;
    if (G.phase === 'incoming' || G.phase === 'ready') { if (G.clicked || G.charging) return; G.charging = true; G.chargeStart = clock.now; }
  }
  onUp() {
    const G = this, now = clock.now;
    if (!G.charging) return;
    G.charging = false;
    if (G.phase !== 'incoming') return;
    G.clicked = true; const p = Math.min(1, (now - G.chargeStart) / .5), b = this.incomingPos(now), px = this.playerPX(), d = b.x - px, tol = 1.0 * this.sf('header');
    G.contactX = px; G.jumpT0 = now;
    if (Math.abs(d) < tol && b.h > 2.55) this.miss('It\'s sailed over his head!');
    else if (Math.abs(d) < tol) {
      const cq = clamp(1 - Math.abs(d) / tol * .7, 0, 1); G.pose = 'header'; G.poseT0 = now; G.contactX = b.x; G.needLift = clamp(b.h + .05 - 1.72, 0, .7);
      this.launchShot({ x: b.x, z: b.z, h: b.h, q: cq, power: .75, delay: .1, gx: -3.3 + 8 * p + randn() * (.2 + (1 - cq) * .8), gh: rand(.15, 1.6) + (1 - cq) * Math.random() * 1.3 });
    }
    else this.miss(d > 0 ? 'Jumped too early!' : 'Too late, it\'s flashed past you!');
  }
  updateIncoming(now) {
    const G = this;
    if (!G.clicked && this.incomingPos(now).x < this.playerPX() - 1.05 * this.sf('header')) { G.clicked = true; G.charging = false; this.miss('It flashes across the box!'); }
  }
  keeperProfile() { return this.floated ? [.95, .19] : [.84, .3]; }

  ballPos(now) {
    if (this.phase === 'ready') return { x: this.x0, z: this.z0, h: this.h0 };
    return this.incomingPos(now);
  }
  posePlayer(pl, kickT, kickPose, now) {
    const G = this;
    pl.x = G.contactX != null ? G.contactX : this.playerPX(); pl.z = G.pz;
    if (G.charging) { const c = Math.min(1, (now - G.chargeStart) / .5); pl.scaleY = .94 - .1 * c; pl.armL = .4 + .3 * c; pl.armR = -.4 - .3 * c; pl.legL = .12; pl.legR = -.12; pl.lenR = 1; pl.ang = 0; }
    if (G.pose === 'header') { const t = now - G.poseT0, nl = G.needLift || 0; pl.lift = t < .1 ? nl * t / .1 : nl * Math.max(0, 1 - (t - .1) / .45); pl.armL = 2.1; pl.armR = -2.1; pl.legL = .2; pl.legR = -.15; pl.lenR = 1; pl.scaleY = 1; pl.ang = t < .15 ? 0 : .12; }
    else if (G.jumpT0 != null && now - G.jumpT0 < .55) { const t = (now - G.jumpT0) / .55; pl.lift = .5 * 4 * t * (1 - t); pl.armL = 2.1; pl.armR = -2.1; pl.legL = .2; pl.legR = -.15; pl.scaleY = 1; pl.ang = G.pose === 'header' ? .12 : 0; }
  }
  renderBars() { if (this.phase === 'charge' || this.charging) this.drawChargeBar(.5, { np: 0, fp: .87 }); }

  goalComment({ high, corner, low, spot }) { return high && corner ? 'GOAL! Powered into the top corner!' : low && corner ? 'GOAL! Glanced into the ' + spot + '!' : pick(['GOAL! Headed home!', 'GOAL! Great header!']); }
  saveComment(info, near) { return near ? 'Header straight at the keeper!' : 'Header saved!'; }
  wideSubject() { return 'Header goes'; }
  overComment() { return 'Header over the bar!'; }
}

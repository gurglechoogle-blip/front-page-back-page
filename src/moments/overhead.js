// OVERHEAD KICK: flat cross from either side (arrow shows which). Line up
// anywhere along the cross and click; timing in the ball's flight sets direction.
import { MovingMoment } from './moving.js';
import { rand, lerp, pick } from './core.js';

export class Overhead extends MovingMoment {
  get key() { return 'overhead'; }
  get title() { return 'Overhead Kick'; }
  get instructions() { return 'The arrow shows which side the cross is coming from. Line up anywhere across the box and click as it reaches you. Timing sets the direction.'; }
  get standPose() { return { armL: 1.1, armR: -1.1, scaleY: .95, legL: .15, legR: -.15 }; }
  get timingWindow() { return .2; }
  get strikePower() { return .8; }
  get strikePose() { return 'bicycle'; }
  contactError(b, px, e, dx, sf) { const tol = 1.3 * sf; e = ((b.x - px) * this.dir) / tol; if (Math.abs(b.h - 2.05) > .6) e = 9; return { e, dx: 0 }; }
  qPenalty(e) { return .2 + Math.abs(e) * .2; }
  passedPlayer(now) { return (this.incomingPos(now).x - this.playerPX()) * this.dir > 1.3 * this.sf(); }

  setup(side) {
    const G = this;
    G.mode = 'moving'; G.flat = true; const fromR = side > 0; G.dir = fromR ? -1 : 1;
    Object.assign(G, { pz: .45, ghost: false, facing: 'front', x0: fromR ? 7 : -7, xL: fromR ? -7 : 7, z0: .446, zL: .446, h0: rand(1.95, 2.15), T: 2.0 }); G.hA = G.h0;
    G.arrow = { x: -G.dir * 2.4, z: .45, h: 0, dx: G.dir, dz: 0 };
    this.def(fromR ? -2.4 : 2.4, .58, 0);
    G.phase = 'ready'; G.phaseT0 = this.clockNow();
  }
  posePlayer(pl, kickT, kickPose) {
    const G = this;
    pl.x = G.contactX != null && G.phase !== 'incoming' ? G.contactX : this.playerPX(); pl.z = G.pz - .006; if (G.ghost) pl.alpha = .55;
    if (G.pose === 'bicycle') {
      const sg = G.side > 0 ? -1 : 1, t = kickT; pl.scaleY = 1; pl.armL = 1.5; pl.armR = -1.5; pl.legL = .5; pl.legR = -.9;
      if (t < .45) { pl.lift = .95 * Math.sin(Math.min(1, t / .3) * Math.PI / 2); pl.ang = sg * 2.3 * Math.min(1, t / .14); }
      else if (t < .8) { const f = (t - .45) / .35; pl.lift = lerp(.95, .12, f); pl.ang = sg * lerp(2.3, 1.57, f); pl.legL = lerp(.5, .1, f); pl.legR = lerp(-.9, -.2, f); }
      else { pl.lift = .12; pl.ang = sg * 1.57; pl.legL = .1; pl.legR = -.2; pl.armL = .4; pl.armR = -.4; }
    } else kickPose();
  }
  goalComment({ corner }) { return pick(['GOAL! A stunning overhead kick!', 'GOAL! Bicycle kick, and it\'s in!']) + (corner ? '' : ''); }
  wideSubject() { return 'Overhead kick goes'; }
  overComment() { return 'Overhead kick sails over!'; }
}

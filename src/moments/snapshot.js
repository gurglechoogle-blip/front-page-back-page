// SNAPSHOT: diagonal pass from behind the play. Stand on the arrowed line and
// click; how far the ball has run across your body decides direction.
import { MovingMoment } from './moving.js';
import { JFG, rand, lerp } from './core.js';

export class Snapshot extends MovingMoment {
  get key() { return 'snapshot'; }
  get title() { return 'Snapshot'; }
  get instructions() { return 'Stand on the line of the pass (arrow). Strike it before it crosses you to wrap it left; let it run across your body to send it right.'; }
  get standPose() { return JFG; }
  get timingWindow() { return .26; }
  get strikePower() { return .75; }
  get freshAirMsg() { return 'Fresh air! You\'re not on the line of the pass.'; }
  get aimBase() { return -.6; }
  get aimSpread() { return 5; }
  contactError(b, px, e, dx, sf) { const tol = 1.0 * sf; return { e: (b.x - px) / tol, dx: Math.abs(b.z - this.pz) > .07 ? 9 : 0 }; }
  passedPlayer(now) { return this.incomingPos(now).x - this.playerPX() > 1.0 * this.sf('snapshot'); }

  setup() {
    const G = this;
    G.mode = 'moving'; const xL = rand(.5, 1.4);
    Object.assign(G, { pz: .2, ghost: true, xL: xL, x0: xL - 5.6, z0: -.06, zL: .21, h0: .11, hA: .11, T: .85 });
    const u0 = .82; G.arrow = { x: lerp(G.x0, xL, u0), z: lerp(G.z0, .21, u0), dx: xL - G.x0, dz: .21 - G.z0 };
    this.def(-2.0, .72, 0); this.def(4.4, .8, 1);
    G.phase = 'ready'; G.phaseT0 = this.clockNow();
  }
  keeperProfile() { return [.92, .24]; }
  goalComment({ corner, spot }) { return corner ? 'GOAL! Snapped into the ' + spot + '!' : 'GOAL! Quick shot, it\'s in!'; }
}

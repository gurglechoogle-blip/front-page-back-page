// VOLLEY: always from the left. Three crosses: whipped, dipping, low bouncing.
// Timing (early = left, late = right) and striking off-centre decide direction.
import { MovingMoment } from './moving.js';
import { JFG, rand, pick } from './core.js';

export class Volley extends MovingMoment {
  get key() { return 'volley'; }
  get title() { return 'Volley'; }
  get instructions() { return 'Move the mouse to get under the cross. Click as the ball drops to hit it on the volley. Strike it off-centre to place it.'; }
  get standPose() { return JFG; }
  get timingWindow() { return .32; }
  get strikePower() { return .85; }
  get aimSpread() { return 5.8; }
  adjustAim(gx) { return gx - ((this.contactPX - this.xL) / 1.0) * 2.6; }

  setup() {
    const G = this;
    G.mode = 'moving'; const v = Math.floor(Math.random() * 3);
    Object.assign(G, { pz: .2, ghost: true, xL: rand(-1.3, 1.5), x0: -5, z0: .205, zL: .205, T: 1.1 });
    if (v === 0) { G.h0 = 1.35; G.hA = .62; G.variant = 'Ball whipped in…'; }
    else if (v === 1) { G.h0 = 1.7; G.hA = .6; G.hFn = u => 1.7 - 1.1 * u * u; G.variant = 'Dipping cross…'; }
    else { G.h0 = 1.3; G.hA = .49; G.hFn = u => { const ub = .6; if (u < ub) return 1.3 - 1.19 * (u / ub) * (u / ub); const w = (u - ub) / (1 - ub); return .11 + .65 * Math.sin(Math.PI * .8 * w); }; G.variant = 'Low bouncing ball…'; G.bounceU = .6; }
    this.def(-1.7, .55, 0); this.def(2.1, .72, 1);
    G.phase = 'ready'; G.phaseT0 = this.clockNow();
  }
  goalComment({ high, corner, q, side, spot }) {
    return high && corner && q > .7 ? 'GOAL! What a volley, top ' + side + ' corner!' : corner ? 'GOAL! Volleyed into the ' + spot + '!' : high ? 'GOAL! Lashed into the roof of the net!' : 'GOAL! Crisp volley, it\'s in!';
  }
}
export { pick };

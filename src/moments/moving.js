// MovingMoment: shared logic for the moments where you steer a ghost player
// with the mouse and click to strike a moving ball (volley, snapshot, overhead).
import { BaseMoment, clock, randn, rand, clamp, lerp } from './core.js';

export class MovingMoment extends BaseMoment {
  get timingWindow() { return .3; }      // seconds, before skill
  get strikePower() { return .8; }
  get strikePose() { return 'kick'; }
  get freshAirMsg() { return 'Fresh air! Nowhere near it.'; }
  keeperStartX() { return rand(-1.3, 1.3); }

  /** Override to judge contact differently. Returns {e, dx}. */
  contactError(b, px, e, dx) { return { e, dx }; }
  qPenalty() { return 0; }
  /** True once the ball has got past the player without a swing. */
  passedPlayer(now) { return now > this.t0 + this.T + this.timingWindow * this.sf(); }

  onDown() {
    const G = this, now = clock.now, k = G.k;
    if (G.phase !== 'incoming') return;
    if (G.clicked) return; G.clicked = true;
    const T = G.t0 + G.T, sf = this.sf(k), tw = this.timingWindow * sf, tolX = 1.0 * sf, px = this.playerPX(), b = this.incomingPos(now);
    let dx = Math.abs(px - G.xL), e = (now - T) / tw;
    ({ e, dx } = this.contactError(b, px, e, dx, sf));
    G.pose = this.strikePose; G.poseT0 = now; G.contactX = px; G.contactPX = px;
    if (dx >= tolX) this.miss(this.freshAirMsg);
    else if (e < -1) this.miss('Too eager, swung before it arrived!');
    else if (e > 1) this.miss('Too late, it\'s gone past you!');
    else {
      G.contactX = px + (b.x - px) * .6;
      const q = clamp(1 - dx / tolX * .6 - this.qPenalty(e), 0, 1);
      this.shootFromMoving(q, this.strikePower, e, b, .07);
    }
  }
  updateIncoming(now) {
    const G = this;
    if (!G.clicked && this.passedPlayer(now)) { G.clicked = true; this.miss('Missed it completely!'); }
  }
  // Early strike wraps round the ball -> back across to the left; late -> straight on / wide right.
  get aimBase() { return .4; }
  get aimSpread() { return 4.6; }
  adjustAim(gx) { return gx; }
  shootFromMoving(q, pw, e, b, dl) {
    const G = this, k = G.k;
    let gx = this.aimBase + e * this.aimSpread + randn() * (.2 + .45 * (1 - q));
    gx = this.adjustAim(gx);
    gx = clamp(gx, -7, 7);
    const r = Math.random();
    // The prototype evaluated all three heights (three random draws) and kept
    // one. Kept as-is so the random sequence, and therefore feel, is identical.
    const gh = { volley: .2 + r * 1.4 + (1 - q) * Math.random() * 2.2, snapshot: .1 + r * .8 + (1 - q) * Math.random() * 1.6, overhead: .3 + r * 1.6 + (1 - q) * Math.random() * 1.6 }[k];
    this.launchShot({ x: b.x, z: b.z, h: b.h, q: q, power: pw, gx: gx, gh: gh, delay: dl || .07 });
  }

  ballPos(now) {
    const G = this;
    if (G.phase === 'ready') return { x: G.x0, z: G.z0, h: G.h0 };
    return this.incomingPos(now);
  }
  posePlayer(pl, kickT, kickPose) {
    const G = this;
    pl.x = G.contactX != null && G.phase !== 'incoming' ? G.contactX : this.playerPX(); pl.z = G.pz - .006; if (G.ghost) pl.alpha = .55;
    kickPose();
  }
}
export { lerp };

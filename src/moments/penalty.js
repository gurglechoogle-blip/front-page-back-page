// PENALTY: click to stop the DIRECTION marker, hold for power, release.
// Too far either side = wide; held too long = over.
import { BaseMoment, MX, MW, MH, MY, clock, rand, randn, clamp } from './core.js';
import { GW } from '../engine/camera.js';
import { ctx, bar, label } from '../engine/draw.js';

export class Penalty extends BaseMoment {
  get key() { return 'penalty'; }
  get title() { return 'Penalty'; }
  get instructions() { return 'Click to stop the marker on the DIRECTION bar, then hold for power and release. Too far either side is wide; hold too long and it\'s over.'; }
  get standPose() { return { armL: .4, armR: -.3, legR: -.2, ang: .07 }; }
  get chargeTimeout() { return 1.3; }

  setup() {
    const G = this;
    G.mode = 'pen'; G.bx = 0; G.bz = .4; G.plx = -.38; G.plz = .33; G.phase = 'aim'; G.markT0 = clock.now; G.markSpd = 5.6 / this.sf('penalty');
  }
  onDown() {
    const G = this;
    if (G.phase === 'aim') { G.penX = this.sweep() * 5.6; G.phase = 'charge'; G.chargeStart = clock.now; }
  }
  onUp() {
    const G = this, now = clock.now;
    if (G.phase !== 'charge') return;
    G.pose = 'kick'; G.poseT0 = now;
    const p = this.charge(.9), q = clamp(1 - Math.abs(p - .7) * 1.4, 0, 1);
    const gh = .15 + 2.45 * Math.pow(Math.min(p, 1.05), 1.6);
    this.launchShot({ delay: .06, dur: clamp(.42 - .2 * p, .2, .42), x: G.bx, z: G.bz, h: .11, q: q, power: Math.min(1, p), gx: G.penX + randn() * .12, gh: Math.max(.05, gh + randn() * .08) });
  }
  saveChance(o, gx, gh) {
    let ps = .62 - .11 * Math.abs(gx) - .35 * (o.power - .5) - (gh > 1.5 ? .12 : 0) + .22 * (1 - o.q); if (Math.abs(gx) > 3 && gh > 1.8) ps -= .15;
    return ps;
  }
  beatenDive(gx, gh) {
    if (Math.random() < .5) return { tx: -(Math.sign(gx) || 1) * rand(1.5, 2.6), th: rand(.3, .9) };
    return super.beatenDive(gx, gh);
  }

  ballPos() { return { x: this.bx, z: this.bz, h: .11 }; }
  posePlayer(pl, kickT, kickPose) {
    pl.x = this.plx; pl.z = this.plz - .004;
    if (this.phase === 'charge') { pl.legR = -.5; pl.armL = .7; pl.ang = .1; }
    kickPose();
  }
  renderBars() {
    const G = this, mx = MX, mw = MW, mh = MH, my = MY;
    if (G.phase === 'aim' || G.phase === 'charge') {
      const yy = G.phase === 'charge' ? my - 30 : my;
      bar(mx, yy, mw, mh); ctx.fillStyle = '#7d1610'; ctx.fillRect(mx, yy, mw, mh);
      const post = GW / 5.6 * mw / 2; ctx.fillStyle = '#b8261d'; ctx.fillRect(400 - post, yy, post * 2, mh);
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(400 - post - 1, yy - 3, 2, mh + 6); ctx.fillRect(400 + post - 1, yy - 3, 2, mh + 6);
      const m = G.phase === 'charge' ? G.penX / 5.6 : this.sweep(); ctx.fillStyle = '#fff'; ctx.fillRect(400 + m * mw / 2 - 2, yy - 5, 4, mh + 10);
      label('DIRECTION', 400, yy - 8);
    }
    if (G.phase === 'charge') this.drawChargeBar(.9, 'power');
  }

  goalComment({ wrong, high, corner, low, side, gx }) {
    return wrong ? 'GOAL! Sends the keeper the wrong way!' : high && corner ? 'GOAL! Smashed into the top ' + side + ' corner!' : low && corner ? 'GOAL! Slotted into the bottom ' + side + ' corner!' : !corner && Math.abs(gx) < 1 ? 'GOAL! Straight down the middle!' : 'GOAL! Penalty scored!';
  }
  saveComment(info, near) { return near ? 'Penalty saved, straight at him!' : 'Penalty saved! The keeper guessed right!'; }
  overComment(n) { return n + ' blazes the penalty over!'; }
}

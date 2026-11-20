// PASSING: click when the marker is in the green. Green = perfect,
// orange = 50/50 finish. The receiver turns and finishes.
import { BaseMoment, JFG, ORANGE, clock, rand, clamp, lerp, pick } from './core.js';

export class Passing extends BaseMoment {
  get key() { return 'passing'; }
  get title() { return 'Passing'; }
  get instructions() { return 'Click when the marker is in the green zone to play a perfect pass. Find your man and he\'ll finish it.'; }
  get standPose() { return JFG; }

  setup() {
    const G = this;
    G.mode = 'pass'; G.plx = 0; G.plz = .1;
    const D = [[-2.2, .42], [1.6, .5], [-.2, .7]]; D.forEach((p, i) => this.def(p[0], p[1], i));
    let mx, mz, tries = 0; do { mx = rand(-3, 3); mz = rand(.55, .7); tries++; } while (tries < 40 && D.some(p => Math.abs(p[0] - mx) < 1.1));
    G.mate = { x: mx, z: mz };
    G.zoneC = rand(.25, .75); G.zoneW = Math.min(.24, .092 * this.sf('passing')); G.markT0 = clock.now; G.markSpd = rand(4.5, 5.3);
    G.mateObj = { x: mx, z: mz, kit: this.kits.mateKit, facing: 'front', mate: true, armR: -1.1 }; G.others.push(G.mateObj);
    G.phase = 'pass';
  }
  onDown() { if (this.phase === 'pass') this.doPass(); }
  doPass() {
    const G = this, now = clock.now;
    const m = this.markerPos(), o = m - G.zoneC, hw = G.zoneW / 2, ow = ORANGE, ok = Math.abs(o) <= hw, half = !ok && Math.abs(o) <= hw + ow;
    const sk = Math.sign(o) || 1;
    const to = ok ? { x: G.mate.x, z: G.mate.z } : half ? { x: G.mate.x + sk * .55, z: G.mate.z + .01 } : { x: G.mate.x + sk * (1.6 + (Math.abs(o) - hw - ow) * 12), z: G.mate.z + rand(-.12, .04) };
    G.pass = { t0: now + .06, to: to, dur: ok || half ? .5 : .6, outcome: ok ? 'ok' : half ? 'half' : 'miss', q: ok ? 1 - Math.abs(o) / hw : .3, resolved: false };
    G.pose = 'kick'; G.poseT0 = now; G.phase = 'passing';
  }
  passPos(t) {
    const G = this;
    const p = G.pass, u = clamp((t - p.t0) / p.dur, 0, 1), b = Math.abs(Math.sin(u * Math.PI * 2)) * .12 * (1 - u);
    if (p.outcome === 'miss' && u >= 1) { const v = (t - p.t0) / p.dur - 1; return { x: p.to.x + (p.to.x - G.plx) * v * .3, z: p.to.z + (p.to.z - G.plz) * v * .3, h: .11 }; }
    return { x: lerp(G.plx + .05, p.to.x, u), z: lerp(G.plz + .02, p.to.z, u), h: .11 + b };
  }
  updateLate(now) {
    const G = this;
    if (G.pass && !G.pass.resolved && now - G.pass.t0 >= G.pass.dur) {
      const p = G.pass; p.resolved = true;
      if (p.outcome === 'ok' || p.outcome === 'half') {
        const ok = p.outcome === 'ok'; G.gained += ok ? Math.round(30 + 40 * p.q) : 10;
        G.mateObj.facing = 'back'; G.mateObj.legR = -1; G.mateObj.lenR = .78; G.mateObj.armR = -.5; G.mateObj.x = p.to.x;
        const force = ok || Math.random() < .5 ? 'goal' : pick(['save', 'wide']);
        const gx = force === 'wide' ? (Math.random() < .5 ? -1 : 1) * rand(3.8, 4.6) : (Math.random() < .5 ? -1 : 1) * rand(1.8, 3.1);
        this.launchShot({
          x: p.to.x, z: G.mate.z + .012, h: .11, q: 1, power: .9, gx: gx, gh: rand(.3, 1.7), force: force,
          msg: force === 'goal' ? (ok ? (p.q > .6 ? 'Perfect pass! ' : 'Found him! ') + 'He turns and buries it!' : 'Slightly behind him… but he scores!') : (force === 'save' ? 'Slightly behind him… keeper saves!' : 'Slightly behind him… he drags it wide!')
        });
      } else { G.gained += 15; G.msg = pick(['Skewed it! Out for a throw.', 'Way off target!', 'Misplaced, that\'s gone astray!']); G.msgGood = false; G.phase = 'result'; G.resT0 = now; G.outcome = 'misplaced'; }
    }
  }

  ballPos(now) { return this.pass ? this.passPos(now) : { x: this.plx + .05, z: this.plz + .02, h: .11 }; }
  renderBars() { if (this.phase === 'pass') this.drawPassBar(); }
}

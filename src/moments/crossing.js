// CROSSING: wide, level with the 18-yard line. Same bar as passing:
// green = on his head, orange = 50/50, red = cleared or overhit.
import { BaseMoment, ORANGE, clock, rand, clamp, lerp, pick } from './core.js';
import { GOALZ } from '../engine/camera.js';

const ZM = 24;

export class Crossing extends BaseMoment {
  get key() { return 'crossing'; }
  get title() { return 'Crossing'; }
  get instructions() { return 'Click when the marker is in the green zone to whip the cross onto your teammate\'s head. Orange is hit or miss.'; }
  get camera() { return 'cross'; }
  get standPose() { return { armL: .6, armR: -.6, legR: -.12, legL: .05, ang: .08 }; }
  get defendersBlock() { return false; }

  setup() {
    const G = this, kits = this.kits;
    G.mode = 'cross'; G.bx = -9.5; G.bz = rand(.17, .23); G.plx = G.bx - .5; G.plz = G.bz - .04; G.keeper.x = -.8;
    G.att = [[-1.6, .82], [1.1, .77], [.1, .64]].map((p, i) => { const o = { x: p[0], z: p[1], bx: p[0], bz: p[1], kit: kits.mateKits[i], facing: 'back', att: true, armL: .3, armR: -.3 }; G.others.push(o); return o; });
    [[-1.15, .87], [1.45, .81], [-.35, .7]].forEach((p, i) => this.def(p[0], p[1], i));
    G.target = Math.floor(Math.random() * 3); G.zoneC = rand(.25, .75); G.zoneW = Math.min(.24, .092 * this.sf('crossing')); G.markT0 = clock.now; G.markSpd = rand(4.5, 5.3);
    G.phase = 'pass';
  }
  onDown() { if (this.phase === 'pass') this.doCross(); }

  crossPath(ax, az, c) {
    const G = this;
    const dxm = ax - G.bx, dzm = (az - G.bz) * ZM, L = Math.hypot(dxm, dzm) || 1, px = -dzm / L, pz = dxm / L;
    const ox = px * c * 2.4, oz = pz * c * 2.4 / ZM, apex = 1.2 + L * .07;
    return { x: u => lerp(G.bx, ax, u) + ox * u * u, z: u => lerp(G.bz, az, u) + oz * u * u, h: u => lerp(.11, 1.95, u) + apex * 4 * u * (1 - u), fx: ax + ox, fz: az + oz, dur: .75 + L * .022 };
  }
  doCross() {
    const G = this, now = clock.now;
    const m = this.markerPos(), o = m - G.zoneC, hw = G.zoneW / 2, sk = Math.sign(o) || 1;
    const zone = Math.abs(o) <= hw ? 'green' : Math.abs(o) <= hw + ORANGE ? 'orange' : 'red';
    const t = G.att[G.target]; let L;
    if (zone === 'green') L = { x: t.bx, z: t.bz };
    else if (zone === 'orange') L = { x: t.bx + sk * .9, z: t.bz + .015 };
    else L = { x: clamp(t.bx + sk * (3 + (Math.abs(o) - hw - ORANGE) * 14), -9, 9), z: clamp(t.bz + sk * .09, .5, 1.08) };
    const cp = this.crossPath(L.x, L.z, 0);
    G.cross = { t0: now + .06, cp: cp, resolved: false, L: L, zone: zone, best: t, dA: zone === 'red' ? 9 : 0 };
    G.pose = 'kick'; G.poseT0 = now; G.phase = 'crossing';
  }
  crossPos(t) {
    const G = this;
    const X = G.cross, cp = X.cp, u = clamp((t - X.t0) / cp.dur, 0, 1.6);
    if (u <= 1) return { x: cp.x(u), z: cp.z(u), h: cp.h(u) };
    const v = u - 1;
    if (X.out === 'keeper') return { x: G.keeper.x + .3, z: GOALZ - .02, h: 1.6 };
    if (X.out === 'clear') return { x: cp.fx - v * 6, z: cp.fz - v * .4, h: Math.max(.11, 1.95 + v * 4 - v * v * 12) };
    return { x: cp.fx + (cp.fx - cp.x(.95)) * v * 20, z: Math.min(1.1, cp.fz + (cp.fz - cp.z(.95)) * v * 20), h: Math.max(.11, 1.95 - v * v * 20) };
  }
  resolveCross() {
    const G = this, now = clock.now;
    const X = G.cross; X.resolved = true; const L = X.L;
    if (X.zone === 'red') {
      if (L.z < 1 && Math.abs(L.x) < 6 && Math.random() < .6) { X.out = 'clear'; G.msg = pick(['Cleared by the defender!', 'Headed away!', 'Defender gets there first!']); }
      else { X.out = 'poor'; G.msg = pick(['Overhit, out for a goal kick!', 'Poor delivery, nobody near it!', 'That\'s gone straight out!']); }
      G.msgGood = false; G.gained += 15; G.phase = 'result'; G.resT0 = now; G.outcome = X.out; return;
    }
    X.out = 'shot'; const green = X.zone === 'green', o = X.best; o.x = L.x; o.z = L.z; o.lift = .25; o.armL = 2; o.armR = -2;
    const force = green ? (Math.random() < .85 ? 'goal' : 'save') : (Math.random() < .5 ? 'goal' : pick(['save', 'wide', 'over']));
    const gx = force === 'wide' ? (Math.random() < .5 ? -1 : 1) * rand(3.8, 4.6) : (G.keeper.x < L.x ? 1 : -1) * rand(1.6, 3.2);
    this.launchShot({
      x: L.x, z: L.z, h: 1.95, q: green ? 1 : .4, power: .75, gx: gx, gh: force === 'over' ? 2.7 : rand(.2, 1.7), force: force,
      msgs: { goal: green ? pick(['GOAL! What a delivery, headed home!', 'GOAL! Right on his head!', 'Inch-perfect cross, GOAL!']) : 'Slightly behind him… but he gets his head on it, GOAL!', save: green ? 'Great ball, but the keeper saves the header!' : 'Slightly behind him… keeper saves!', wide: 'Slightly behind him… header goes wide!', over: 'Slightly behind him… header over the bar!' }
    });
  }
  updateMid(now) {
    const G = this;
    if (G.cross && !G.cross.resolved && now >= G.cross.t0 + G.cross.cp.dur) this.resolveCross();
    if (G.cross && !G.cross.resolved && G.cross.zone !== 'red') { const X = G.cross, o = X.best, u = clamp((now - X.t0) / X.cp.dur, 0, 1); o.x = lerp(o.bx, X.L.x, u * u); o.z = lerp(o.bz, X.L.z, u * u); }
  }

  ballPos(now) { return this.cross ? this.crossPos(now) : { x: this.bx, z: this.bz, h: .11 }; }
  renderBars() { if (this.phase === 'pass') this.drawPassBar(); }
}

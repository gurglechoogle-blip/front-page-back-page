// BaseMoment: the shared machinery behind every match moment.
//
// A moment is ONE attempt (one chance). The common interface:
//   moment.start(context)  set up a fresh attempt
//   moment.update()        advance one frame (reads clock.now)
//   moment.render(ctx, hud) draw the scene; `hud(ctx, moment)` is an optional
//                           callback drawn above the scene but beneath the
//                           timing bars (the prototype's draw order)
//   moment.onDown()/onUp()  pointer handlers
//   moment.onResult        callback, called once when the result has been shown
//
// context = { kits, skillFactor(k), playerName, onResult? }
//   kits: from engine/kits.js makeKitSet()
//   skillFactor(k): 1..1.5 multiplier that widens timing windows
//
// Everything below is the prototype's logic with `G` (the old global drill
// state) replaced by `this`. Per-moment differences live in hooks that the
// moment modules override; the numbers are untouched.
import { clock } from '../engine/clock.js';
import { W, H, GOALZ, P, setCam } from '../engine/camera.js';
import { rand, randn, clamp, lerp, pick } from '../engine/util.js';
import { mouse } from '../engine/input.js';
import { ctx, setCtx, drawBackground, drawNet, drawPosts, drawPerson, drawBall, drawKeeper, bar, label, bigText } from '../engine/draw.js';

export const ORANGE = .05;
export const CURVE = 2.4;
// Timing-bar geometry shared by the passing, penalty and charge bars.
export const MX = 270, MW = 260, MH = 14, MY = H - 84;

// The pose each moment's striker holds while waiting.
export const JFG = { legR: -.2, lenR: .68, legL: .12, armL: .62, armR: -.42, ang: -.04, scaleY: .97 };

export class BaseMoment {
  // ---- identity (overridden) ----
  get key() { return 'base'; }
  get title() { return ''; }
  get instructions() { return ''; }
  get camera() { return 'def'; }
  get standPose() { return null; }
  get chargeTimeout() { return 1.25; }
  get defendersBlock() { return true; }

  // ---- lifecycle ----
  start(context) {
    this.context = context;
    if (context.onResult) this.onResult = context.onResult;
    this.k = this.key; this.d = { t: this.title, i: this.instructions };
    this.done = false; this.score = 0; this.gained = 0; this.netT0 = null; this.outcome = null; this.shotQ = null;
    setCam(this.camera);
    const G = this;
    Object.assign(G, { hFn: null, zL: null, variant: '', jumpT0: null, defObj: null, shot: null, pass: null, msg: '', msgGood: false, clicked: false, charging: false, evaluated: false, pose: 'stand', poseT0: 0, controlQ: 1, missed: false, contactX: null, others: [], facing: 'back', ghost: false, held: false, cutT0: null, flat: false, arrow: null, needLift: 0, arc: 0, dir: 1, cross: null, att: null, bounceU: null, floated: false });
    const kx = this.keeperStartX();
    G.keeper = { x: kx, h: 0, ang: 0, dive: null };
    const side = Math.random() < .5 ? -1 : 1; G.side = side;
    this.setup(side);
    return this;
  }
  keeperStartX() { return 0; }
  clockNow() { return clock.now; }
  setup() { }

  /** Place an opponent (or wall member). i picks one of the 4 opponent kits. */
  def(x, z, i, extra) { const d = Object.assign({ x: x, z: z, kit: this.context.kits.npc[i], facing: 'front', def: true }, extra || {}); this.others.push(d); return d; }
  sf(k) { return this.context.skillFactor ? this.context.skillFactor(k || this.k) : 1; }
  nm() { return this.context.playerName || 'Player'; }
  get kits() { return this.context.kits; }

  // ---- helpers shared by several moments ----
  incomingPos(t) {
    const G = this;
    const u = (t - G.t0) / G.T;
    const zL = G.zL == null ? G.pz : G.zL;
    if (u <= 1) return { x: lerp(G.x0, G.xL, u), z: lerp(G.z0, zL, u), h: G.hFn ? G.hFn(u) : lerp(G.h0, G.hA, u) + G.arc * 4 * u * (1 - u) };
    const v = u - 1, vx = (G.xL - G.x0), vz = (zL - G.z0);
    let h = G.hA - (G.hA - G.h0 + G.arc * 4) * v * 1.2; if (G.mode === 'header') h = G.hA - v * v * 6; if (h < .11) { h = .11 + Math.abs(Math.sin(v * 9)) * .25 * Math.max(0, 1 - v * 2); }
    return { x: G.xL + vx * v, z: Math.max(-.2, zL + vz * v), h: h };
  }
  sweep() { return Math.sin((clock.now - this.markT0) * this.markSpd); }
  markerPos() { return .5 + .5 * Math.sin((clock.now - this.markT0) * this.markSpd - Math.PI / 2); }
  playerPX() { const G = this; const s = P(0, G.pz, 0).s, lim = 360 / (100 * s); const r = G.mode === 'header' ? [-3.4, .6] : [-lim, lim]; return clamp((clamp(mouse.x, 40, 760) - 400) / (100 * s), r[0], r[1]); }
  charge(full) { return Math.min(1.05, (clock.now - this.chargeStart) / (full || 1)); }

  miss(m) { const G = this; G.msg = m; G.msgGood = false; G.missed = true; G.gained += 10; G.phase = 'result'; G.resT0 = clock.now; G.outcome = 'miss'; }

  // ---- input (overridden) ----
  onDown() { }
  onUp() { }

  // ---- the shot ----
  /** Keeper's chance of saving a shot on target. */
  saveChance(o, gx, gh) {
    const G = this;
    const dist = Math.abs(gx - G.keeper.x); const KP = this.keeperProfile(); let ps = KP[0] - KP[1] * dist + this.saveBias(gx) - .35 * (o.power - .5) - (gh > 1.6 ? .1 : 0) + .2 * (1 - o.q); if (Math.abs(gx) > 3 && gh > 1.8) ps -= .12;
    return ps;
  }
  keeperProfile() { return [.88, .3]; }
  saveBias() { return 0; }
  /** Where the keeper dives when he's beaten. */
  beatenDive(gx, gh) { return { tx: gx - (Math.sign(gx - this.keeper.x) || 1) * rand(.55, .95), th: gh * .92 }; }

  launchShot(o) {
    const G = this, now = clock.now;
    let gx = o.gx, gh = o.gh, outcome = null, stopU = 1, blockZ = null;
    const hPath = o.hPath || (u => lerp(o.h, gh, u) + (gh > 1.2 ? .18 : .08) * 4 * u * (1 - u) * (o.h > 1.2 ? .3 : 1));
    const xp = o.xPath || (u => lerp(o.x, gx, u));
    if (o.force) outcome = o.force;
    else if (o.blocked) { outcome = 'wall'; stopU = G.uW; blockZ = G.wallZ; }
    else {
      if (this.defendersBlock) G.others.forEach(d => { if (!d.def || outcome || d.z <= o.z + .02 || d.z >= GOALZ) return; const u = (d.z - o.z) / (GOALZ - o.z); if (Math.abs(xp(u) - d.x) < .2 && hPath(u) < 1.6) { outcome = 'wall'; stopU = u; blockZ = d.z; } });
      if (!outcome) {
        if (gh > 2.38) outcome = 'over'; else if (Math.abs(gx) > 3.55) outcome = 'wide';
        else { let ps = this.saveChance(o, gx, gh); ps = clamp(ps, .04, .9); outcome = Math.random() < ps ? 'save' : 'goal'; }
      }
    }
    const dur = o.dur || clamp(.68 - .32 * o.power, .3, .62) * (o.durMul || 1);
    let tx, th;
    if (outcome === 'save') { tx = gx; th = gh; }
    else if (outcome === 'goal') { ({ tx, th } = this.beatenDive(gx, gh)); }
    else { tx = clamp(lerp(G.keeper.x, gx, .6), -3, 3); th = Math.min(gh, 1.6) * .6; }
    tx = clamp(tx, -3.4, 3.4);
    const dl = o.delay || 0;
    G.keeper.dive = { t0: now + dl + (outcome === 'wall' ? 99 : .05), dur: clamp(dur * .7, .16, .38), tx: tx, th: th, x0: G.keeper.x };
    G.shot = { o: o, gx: gx, gh: gh, dur: dur, t0: now + dl, outcome: outcome, resolved: false, hPath: hPath, stopU: stopU, blockZ: blockZ };
    G.phase = 'shot';
  }
  shotPos(t) {
    const G = this;
    const s = G.shot, o = s.o, u = Math.max(0, (t - s.t0) / s.dur), xp = o.xPath || (uu => lerp(o.x, s.gx, uu));
    if (u <= s.stopU) return { x: xp(u), z: lerp(o.z, GOALZ, u), h: s.hPath(u) };
    const v = u - s.stopU, sg = Math.sign(s.gx) || 1;
    if (s.outcome === 'goal') return { x: s.gx + sg * Math.min(v, .3) * .4, z: Math.min(1, GOALZ + v * .2), h: Math.max(.11, s.gh - v * v * 14) };
    if (s.outcome === 'save') { let h = s.gh + v * 2.2 - v * v * 9; if (h < .11) h = .11; return { x: s.gx + sg * v * 3.5, z: GOALZ - v * .22, h: h }; }
    if (s.outcome === 'wall') { const xw = xp(s.stopU); let h = s.hPath(s.stopU) * (1 - v * 2.2); if (h < .11) h = .11 + Math.abs(Math.sin(v * 10)) * .15 * Math.max(0, 1 - v); return { x: xw + sg * v * .8, z: s.blockZ - v * .55, h: h }; }
    const ux = Math.min(u, 1.35); return { x: o.xPath ? xp(1) + (xp(1) - xp(.9)) * (ux - 1) * 10 : lerp(o.x, s.gx, ux), z: Math.min(1, lerp(o.z, GOALZ, ux)), h: Math.max(.11, s.hPath(Math.min(u, 1)) + (s.outcome === 'over' ? v * 1.5 : -v * 1.5)) };
  }

  // ---- commentary: describes what actually happened ----
  goalComment() { return null; }
  saveComment() { return null; }
  wideSubject(n) { return n + '\'s shot goes'; }
  overComment() { return 'Over the bar!'; }
  wallComment() { return pick(['Blocked by the defender!', 'Charged down!', 'Straight into the defender!']); }
  commentary(s) {
    const G = this;
    const n = this.nm(), gx = s.gx, gh = s.gh, q = s.o.q, side = gx < 0 ? 'left' : 'right', corner = Math.abs(gx) > 2.3, low = gh < .8, high = gh > 1.6;
    const spot = corner ? (high ? 'top ' + side + ' corner' : low ? 'bottom ' + side + ' corner' : side + ' corner') : (high ? 'roof of the net' : low ? 'low' : '');
    const info = { n, gx, gh, q, side, corner, low, high, spot };
    if (s.outcome === 'goal') {
      const kp = G.keeper.dive; info.wrong = kp && Math.sign(kp.tx - kp.x0) !== Math.sign(gx - kp.x0) && Math.abs(gx - kp.x0) > 1;
      const m = this.goalComment(info, s); if (m != null) return m;
      return corner ? 'GOAL! Into the ' + spot + '!' : 'GOAL!';
    }
    if (s.outcome === 'save') {
      const near = Math.abs(gx - G.keeper.dive.x0) < 1.1;
      const m = this.saveComment(info, near); if (m != null) return m;
      return near ? 'Straight at the keeper!' : high ? 'Keeper tips it over the bar!' : low ? 'Keeper gets down well to save!' : 'Great save from the keeper!';
    }
    if (s.outcome === 'wide') return this.wideSubject(n) + ' wide of the ' + side + ' post!';
    if (s.outcome === 'over') return this.overComment(n);
    return this.wallComment();
  }
  resolveShot() {
    const G = this, now = clock.now;
    const s = G.shot; s.resolved = true;
    G.msg = (s.o.msgs && s.o.msgs[s.outcome]) || s.o.msg || this.commentary(s); G.msgGood = s.outcome === 'goal';
    if (s.outcome === 'goal') { G.netT0 = now; if (!s.o.noScore) { G.score++; G.gained += Math.round(100 + 150 * s.o.q); } } else G.gained += 15;
    G.outcome = s.outcome; G.shotQ = s.o.q;
    G.phase = 'result'; G.resT0 = now;
  }

  // ---- update ----
  updateIncoming() { }
  updateMid() { }
  updateLate() { }
  update() {
    if (this.done) return;
    const G = this, now = clock.now;
    if (G.phase === 'ready' && now - G.phaseT0 > .75) { G.phase = 'incoming'; G.t0 = now; }
    if (G.phase === 'incoming') this.updateIncoming(now);
    if (G.phase === 'charge' && now - G.chargeStart > this.chargeTimeout) this.onUp();
    this.updateMid(now);
    if (G.shot && !G.shot.resolved && (now - G.shot.t0) / G.shot.dur >= G.shot.stopU) this.resolveShot();
    this.updateLate(now);
    const kp = G.keeper;
    if (kp.dive && now >= kp.dive.t0) {
      const e = clamp((now - kp.dive.t0) / kp.dive.dur, 0, 1), ee = 1 - (1 - e) * (1 - e); const d = kp.dive;
      kp.x = lerp(d.x0, d.tx - Math.sign(d.tx - d.x0) * .75 * Math.min(1, Math.abs(d.tx - d.x0) / 2), ee); kp.h = Math.max(0, d.th - .6) * .8 * Math.sin(ee * Math.PI * .6) + (Math.abs(d.tx - d.x0) > 1.5 ? .25 : 0) * ee;
      kp.ang = (Math.sign(d.tx - d.x0) || 1) * Math.min(1.35, Math.abs(d.tx - d.x0) * .45 + (d.th > 1.4 ? .2 : 0)) * ee;
    }
    if (G.phase === 'result' && now - G.resT0 > 1.9) this.finish();
  }
  /** The result has been shown: report it. */
  finish() {
    this.done = true;
    const r = { key: this.k, outcome: this.outcome || 'miss', goal: this.score > 0, gained: this.gained, msg: this.msg, q: this.shotQ == null ? 0 : this.shotQ };
    this.result = r;
    if (this.onResult) this.onResult(r);
  }

  // ---- render ----
  ballPos() { return { x: this.plx + .05, z: this.plz + .02, h: .11 }; }
  currentBall() { return this.shot ? this.shotPos(clock.now) : this.ballPos(clock.now); }
  /** Default (set pieces, passing, crossing): stand on the ball. */
  posePlayer(pl, kickT, kickPose) { pl.x = this.plx; pl.z = this.plz - .004; kickPose(); }
  renderAids() { }
  renderBars() { }
  render(c, hud) {
    setCtx(c); drawBackground();
    const G = this, now = clock.now, kits = this.kits;
    if (G.arrow && (G.phase === 'ready' || G.phase === 'incoming')) {
      const A = G.arrow, p0 = P(A.x, A.z, A.h || 0), p1 = P(A.x + A.dx * .05, A.z + A.dz * .05, A.h || 0); let vx = p1.x - p0.x, vy = p1.y - p0.y; const L = Math.hypot(vx, vy) || 1; vx /= L; vy /= L; const nx = -vy, ny = vx, len = 78, w = 13, hw = 30, hl = 34;
      const pt = (a, b) => [p0.x + vx * a + nx * b, p0.y + vy * a * .6 + ny * b]; ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath();
      [[-len / 2, -w], [len / 2 - hl, -w], [len / 2 - hl, -hw], [len / 2, 0], [len / 2 - hl, hw], [len / 2 - hl, w], [-len / 2, w]].forEach((q, i) => { const r = pt(q[0], q[1]); i ? ctx.lineTo(r[0], r[1]) : ctx.moveTo(r[0], r[1]); }); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    const items = [{ z: 1.001, d: () => drawNet(G.netT0) }, { z: GOALZ, d: drawPosts }, { z: GOALZ - .012, d: () => drawKeeper(G.keeper, kits.gk) }];
    G.others.forEach(o => items.push({ z: o.z, d: () => drawPerson(Object.assign({}, o, { bubble: (o.mate || (G.att && o === G.att[G.target])) && G.phase === 'pass' ? 'Here!' : null })) }));
    const pl = { kit: kits.us, facing: G.facing };
    const kickT = G.pose !== 'stand' ? now - G.poseT0 : 99;
    const kickPose = () => { if (G.pose === 'kick' && kickT < .35) { pl.legR = -1.0; pl.lenR = .78; pl.armL = .9; pl.armR = -.6; pl.scaleY = 1; pl.ang = .04; } };
    if (G.pose === 'stand' && !(G.phase === 'result' && G.missed && G.k !== 'header')) Object.assign(pl, this.standPose || {});
    this.posePlayer(pl, kickT, kickPose, now);
    if (G.shot && (G.pose === 'kick' || G.pose === 'bicycle') && now < G.shot.t0 + .05) { const sb = this.shotPos(now), sp = P(sb.x, sb.z, sb.h); pl.reachR = { x: sp.x, y: sp.y }; }
    if (G.cross && G.pose === 'kick' && now < G.cross.t0 + .05) { const sp = P(G.bx, G.bz, .11); pl.reachR = { x: sp.x, y: sp.y }; }
    if (G.pass && G.pose === 'kick' && now - G.pass.t0 < .05) { const sb = this.passPos(now), sp = P(sb.x, sb.z, sb.h); pl.reachR = { x: sp.x, y: sp.y }; }
    items.push({ z: pl.z, d: () => drawPerson(pl) });
    const b = this.currentBall();
    let bz = b.z; if (Math.abs(b.z - pl.z) < .03) bz = G.mode === 'header' ? pl.z - .001 : pl.z + .001;
    items.push({ z: bz, d: () => drawBall(b, !!(G.shot || G.phase === 'incoming')) });
    if (this.recorder) this.recorder(this.snapFrame(pl, b, now)); // scrapbook: read-only snapshot, draws nothing
    items.sort((a, b2) => b2.z - a.z).forEach(i => i.d());

    this.renderAids(now);
    if (hud) hud(ctx, this);
    this.renderBars(now);
    if (G.phase === 'ready') bigText(G.variant || 'GET READY', '#fff', 30);
    if (G.phase === 'result' && G.msg) bigText(G.msg, G.msgGood ? '#ffc928' : '#fff', G.msgGood ? (G.msg.length > 22 ? 34 : 46) : 36);
  }

  /** A compact copy of what's on screen this frame, for goal replays. */
  snapFrame(pl, b, now) {
    const G = this, r = v => v == null ? null : Math.round(v * 1000) / 1000, kp = G.keeper;
    const pose = o => [r(o.x), r(o.z), o.facing === 'back' ? 1 : 0, r(o.armL), r(o.armR), r(o.legL), r(o.legR), r(o.lenR), r(o.lift), r(o.ang), r(o.scaleY), r(o.alpha)];
    return { b: [r(b.x), r(b.z), r(b.h)], k: [r(kp.x), r(kp.h), r(kp.ang), kp.dive && now >= kp.dive.t0 ? 1 : 0], p: pose(pl), rr: pl.reachR ? [Math.round(pl.reachR.x), Math.round(pl.reachR.y)] : null, o: G.others.map(pose), n: G.netT0 && now - G.netT0 < .7 ? r(now - G.netT0) : -1, s: G.shot || G.phase === 'incoming' ? 1 : 0, ok: G.others.map(o => o.kit) };
  }

  // ---- shared bars ----
  /** Green/orange/red timing bar used by passing and crossing. */
  drawPassBar() {
    const G = this, mx = MX, mw = MW, mh = MH, my = MY;
    bar(mx, my, mw, mh); ctx.fillStyle = '#b8261d'; ctx.fillRect(mx, my, mw, mh); ctx.fillStyle = '#f08a1c'; ctx.fillRect(mx + (G.zoneC - G.zoneW / 2 - ORANGE) * mw, my, (G.zoneW + 2 * ORANGE) * mw, mh); ctx.fillStyle = '#3fbf3f'; ctx.fillRect(mx + (G.zoneC - G.zoneW / 2) * mw, my, G.zoneW * mw, mh);
    ctx.fillStyle = '#fff'; ctx.fillRect(mx + this.markerPos() * mw - 2, my - 5, 4, mh + 10); label('PASS', 400, my - 8);
  }
  /** Hold-to-power bar. full = seconds to fill. markers: 'power' or {np, fp}. */
  drawChargeBar(full, markers) {
    const mx = MX, mw = MW, mh = MH, my = MY;
    const p = Math.min(1, (clock.now - this.chargeStart) / full);
    bar(mx, my, mw, mh); ctx.fillStyle = '#2a2e34'; ctx.fillRect(mx, my, mw, mh);
    const gr = ctx.createLinearGradient(mx, 0, mx + mw, 0); gr.addColorStop(0, '#3fbf3f'); gr.addColorStop(.7, '#f2c230'); gr.addColorStop(1, '#d8352a'); ctx.fillStyle = gr; ctx.fillRect(mx, my, p * mw, mh);
    if (markers === 'power') { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(mx + .94 * mw, my - 4, 2, mh + 8); label('POWER', 400, my + mh + 16, '#333'); }
    else { const np = markers.np, fp = markers.fp; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(mx + fp * mw, my - 4, 2, mh + 8); if (np) ctx.fillRect(mx + np * mw, my - 4, 2, mh + 8); ctx.font = 'bold 10px Roboto Condensed, Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('NEAR POST', mx + Math.max(14, np * mw), my + mh + 13); ctx.fillText('FAR POST', mx + fp * mw, my + mh + 13); label('ACROSS GOAL', 400, my - 8); }
  }
}
export { randn, rand, clamp, lerp, pick, W, H, GOALZ, P, mouse, clock };

// MatchSim: the match minus the bits you play. Pure logic, no DOM.
//
// The screen calls tick() once per match minute (or per penalty in a
// shootout). tick() returns feed events. When an event has kind 'chance',
// the screen stops the clock, plays that moment, then calls
// resolveChance(result) and carries on.
//
// Event: { label, text, kind, side }  kind: info | goal | chance | result |
//        card | break | end.  side: 'home' | 'away' | null.
import C from '../data/commentary.json';
import { makeSquad } from './squads.js';
import { pickR, fill } from './text.js';

const PERIODS = { '1H': [1, 45], '2H': [46, 90], 'ET1': [91, 105], 'ET2': [106, 120] };
const MOMENT_WEIGHTS = { volley: 14, snapshot: 14, header: 14, turn: 14, overhead: 5, freekick: 10, penalty: 7, passing: 11, crossing: 11 };
const ASSIST_MOMENTS = ['passing', 'crossing'];

function poisson(l, R) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** 3-6 chances. trust and form are 0..1. */
export function chancesFor(trust, form, R = Math.random) {
  return clamp(Math.round(3 + 3 * (.6 * trust + .4 * form) + (R() - .5)), 3, 6);
}

export class MatchSim {
  /**
   * opts: { home, away (club objects), mySide: 'home'|'away', cup: bool,
   *         trust, form (0..1), playerName, rng?,
   *         role: 'start' | 'sub' | 'none' (not in the squad: no chances),
   *         extraTime: false for cups that go straight to penalties,
   *         stadium: venue name for neutral grounds }
   */
  constructor(opts) {
    const R = this.R = opts.rng || Math.random;
    Object.assign(this, { home: opts.home, away: opts.away, mySide: opts.mySide || 'home', cup: !!opts.cup, me: opts.playerName || 'Player' });
    this.role = opts.role || 'start'; this.extraTime = opts.extraTime !== false; this.stadium = opts.stadium || this.home.stadium;
    this.onPitch = this.role === 'start';
    this.oppSide = this.mySide === 'home' ? 'away' : 'home';
    this.squads = { home: makeSquad(this.home.id, this.home.league), away: makeSquad(this.away.id, this.away.league) };
    if (this.role !== 'none') this.squads[this.mySide].fwd[0] = this.me;
    this.score = { home: 0, away: 0 }; this.pens = null;
    this.stats = { home: this.blankStats(), away: this.blankStats() };
    this.my = { goals: 0, assists: 0, chances: 0, onTarget: 0, gained: {}, log: [] };
    this.scorers = { home: [], away: [] };
    this.rating = 6.0;
    this.period = null; this.minute = 0; this.done = false; this.queue = [];
    this.possession = clamp(.5 + (this.home.strength - this.away.strength) / 200 + .03, .3, .7);
    this.possTicks = 0; this.homePossTicks = 0;
    this.stoppage = { '1H': 1 + Math.floor(R() * 4), '2H': 2 + Math.floor(R() * 5), 'ET1': Math.floor(R() * 3), 'ET2': 1 + Math.floor(R() * 3) };
    // Team-mates who rate you pass to you more: support (-1..1) is worth up to a chance either way.
    this.fans = opts.fans ?? 50; this.year = opts.year || 2026; this.subChance = opts.subChance ?? .78; this.unusedSub = false; this.hooked = null;
    // Your chances: the gaffer's trust and your form set the base; then the match itself.
    // Against much stronger opposition you see less of the ball, against weaker sides more,
    // a bit more at home, and big games (finals, internationals) are tighter.
    const myStr = this[this.mySide].strength || 60, oppStr = this[this.oppSide].strength || 60;
    // The strength gap scales your chances (against a much better side you barely see the ball).
    const gapF = clamp(Math.exp((myStr - oppStr) / 24), .35, 1.5), home = this.mySide === 'home' ? .3 : 0, big = opts.bigGame ? .4 : 0;
    const adj = clamp((myStr - oppStr) / 14, -1.6, 1.6) + home - big;
    if (this.role === 'none') this.nChances = 0;
    else if (this.role === 'sub') this.nChances = clamp(Math.round((1 + (R() < .45 ? 1 : 0)) * gapF), adj <= -1.2 ? 0 : 1, 3);
    else { const n = (chancesFor(opts.trust ?? .5, opts.form ?? .5, R) + Math.round(opts.support || 0)) * gapF + home - big; this.nChances = clamp(Math.round(n), myStr - oppStr <= -15 ? 1 : 2, opts.bigGame ? 5 : 7); }
    this.subMinute = this.role === 'sub' ? 58 + Math.floor(R() * 18) : null;
    this.schedule = {};
    this.planRegulation();
    this.lastMoment = null; this.penTaken = false;
  }
  /** Plain-data copy of the match, for saving mid-game. */
  snapshot() { const o = {}; for (const k of Object.keys(this)) if (k !== 'R') o[k] = this[k]; return JSON.parse(JSON.stringify(o)); }
  /** Rebuild a match from snapshot(). */
  static restore(data, R = Math.random) { return Object.assign(Object.create(MatchSim.prototype), data, { R }); }
  blankStats() { return { shots: 0, onTarget: 0, corners: 0, fouls: 0, yellows: 0 }; }
  name(side) { return this[side].name; }

  // ---------- planning ----------
  slots(periods) { const s = []; periods.forEach(p => { const [a, b] = PERIODS[p]; for (let m = a; m <= b + this.stoppage[p]; m++) s.push(p + ':' + m); }); return s; }
  add(key, ev) { (this.schedule[key] = this.schedule[key] || []).push(ev); }
  planRegulation() {
    const R = this.R, slots = this.slots(['1H', '2H']).filter(k => !k.endsWith(':1') && k !== '2H:46');
    // Your chances, spread out (after you come on, if you're a sub).
    const mine = this.subMinute ? slots.filter(k => k.startsWith('2H:') && +k.split(':')[1] > this.subMinute + 1) : slots;
    const n = this.nChances, seg = mine.length / Math.max(1, n);
    for (let i = 0; i < n; i++) this.add(mine[Math.floor(i * seg + R() * seg * .8 + seg * .1)], { t: 'chance' });
    if (this.subMinute) this.add('2H:' + this.subMinute, { t: 'subOn' });
    this.planGoals(slots, 1);
    // Substitutions around the hour.
    ['home', 'away'].forEach(side => { for (let i = 0; i < 2; i++) this.add('2H:' + (58 + Math.floor(R() * 24)), { t: 'sub', side, i }); });
  }
  planGoals(slots, scale) {
    const R = this.R, d = (this.home.strength - this.away.strength) / 34; // big gaps matter: Bayern should usually beat St Pauli
    const lam = { home: 1.3 * Math.exp(d) * 1.1 * scale, away: 1.3 * Math.exp(-d) * .9 * scale };
    // Your chances are part of your team's attack, not extra to it: each one you get is
    // worth about 0.3 of a goal to a typical striker, and that comes out of the team's share.
    if (this.role !== 'none') {
      const yours = scale === 1 ? this.nChances * .3 : .2 * scale * 3;
      lam[this.mySide] = Math.max(lam[this.mySide] * .1, lam[this.mySide] - yours);
    }
    ['home', 'away'].forEach(side => { const g = poisson(lam[side], R); for (let i = 0; i < g; i++) { let k; do { k = slots[Math.floor(R() * slots.length)]; } while ((this.schedule[k] || []).some(e => e.t === 'chance')); this.add(k, { t: 'goal', side }); } });
  }
  planExtraTime() {
    const R = this.R, slots = this.slots(['ET1', 'ET2']).filter(k => k !== 'ET1:91' && k !== 'ET2:106');
    if (this.onPitch && R() < .6) this.add(slots[Math.floor(R() * slots.length)], { t: 'chance' });
    this.planGoals(slots, 1 / 3);
  }

  // ---------- helpers ----------
  label(p = this.period, m = this.minute) { const end = PERIODS[p] ? PERIODS[p][1] : 0; return m > end ? end + '+' + (m - end) + '\'' : m + '\''; }
  /** Clock display, e.g. "45+2:00" style is handled by the screen; this gives minutes for the big clock. */
  outfield(side, roles = ['def', 'mid', 'fwd'], exclude = []) { const sq = this.squads[side]; const pool = roles.flatMap(r => sq[r]).filter(n => !exclude.includes(n)); return pickR(pool, this.R); }
  scorer(side) { const r = this.R(), role = r < .5 ? 'fwd' : r < .85 ? 'mid' : 'def'; return this.outfield(side, [role], [this.me]) || this.outfield(side, ['mid'], [this.me]); }
  vars(side, extra = {}) {
    const opp = side === 'home' ? 'away' : 'home';
    const player = this.outfield(side, ['def', 'mid', 'fwd'], [this.me]);
    return Object.assign({ team: this.name(side), opp: this.name(opp), player, player2: this.outfield(side, ['mid', 'fwd'], [player, this.me]), oppPlayer: this.outfield(opp, ['def', 'mid']), gk: this.squads[side].gk, oppGk: this.squads[opp].gk, me: this.me, home: this.home.name, away: this.away.name, hs: this.score.home, as: this.score.away, stadium: this.stadium }, extra);
  }
  ev(text, kind = 'info', side = null, label = this.label()) { return { label, text, kind, side }; }
  line(key, side, extra) {
    // No line twice in the same match (until a list runs out).
    let pool = this.home.league === 'INT' ? C[key].filter(l => !/chairman|season ticket/i.test(l)) : C[key];
    const used = (this.usedLines = this.usedLines || {})[key] = (this.usedLines[key] || []);
    let fresh = pool.filter(l => !used.includes(l)); if (!fresh.length) { used.length = 0; fresh = pool; }
    const l = pickR(fresh, this.R); used.push(l);
    return fill(l, this.vars(side, extra));
  }
  scoreLine() { return `${this.home.name} ${this.score.home}-${this.score.away} ${this.away.name}`; }
  bump(delta) { this.rating = clamp(this.rating + delta, 3, 10); }

  // ---------- the clock ----------
  /** Advance one minute (or one penalty kick). Returns new events. */
  tick() {
    if (this.done) return [];
    const out = [];
    if (this.period === null) {
      this.period = '1H'; this.minute = 0;
      out.push(this.ev(fill(pickR(C.preMatch, this.R), this.vars('home', { weather: pickR(C.weather, this.R) })), 'info', null, ''));
      if (this.role === 'start') out.push(this.ev(this.line('lineup', this.mySide), 'info', this.mySide, ''));
      if (this.role !== 'none' && (this.fans >= 68 || this.fans <= 32)) out.push(this.ev(fill(pickR(this.fans >= 68 ? C.fansHigh : C.fansLow, this.R), this.vars(this.mySide)), 'info', this.mySide, ''));
      if (this.role === 'sub') out.push(this.ev(`${this.me} starts on the bench for ${this.name(this.mySide)}. Warm-up bib on, fingers crossed.`, 'info', this.mySide, ''));
      out.push(this.ev(this.line('kickOff', 'home'), 'info', 'home', '0\''));
      return out;
    }
    if (this.period === 'PENS') return this.shootoutKick();
    const [, end] = PERIODS[this.period];
    if (this.minute >= end + this.stoppage[this.period]) return this.endPeriod();
    this.minute++;
    const key = this.period + ':' + this.minute;
    if (this.minute === end && this.stoppage[this.period] > 0) out.push(this.ev(this.line('stoppage', 'home', { n: this.stoppage[this.period] })));
    // possession
    this.possTicks++; const homeBall = this.R() < this.possession; if (homeBall) this.homePossTicks++;
    const planned = this.schedule[key] || [];
    for (const e of planned) {
      if (e.t === 'goal') out.push(...this.teamGoal(e.side));
      else if (e.t === 'subOn' && this.R() >= this.subChance) { this.unusedSub = true; out.push(this.ev(`${this.name(this.mySide)} make their changes. ${this.me} stays on the bench, bib still on, gently dying inside.`, 'info', this.mySide)); }
      else if (e.t === 'subOn') { const off = this.squads[this.mySide].fwd[1]; this.onPitch = true; out.push(this.ev(`SUBSTITUTION: ${off} off, ${this.me} ON for ${this.name(this.mySide)}. Here we go.`, 'chance', this.mySide)); out[out.length - 1].kind = 'subOn'; }
      else if (e.t === 'sub') { const sq = this.squads[e.side]; const off = sq.mid[e.i] || sq.def[e.i], on = sq.subs[e.i]; if (off && on) { out.push(this.ev(this.line('sub', e.side, { player: off, player2: on }), 'info', e.side)); sq.mid[e.i] = on; } }
    }
    // A stinker can get you hooked, sooner if you're losing.
    if (this.onPitch && this.role === 'start' && !this.hooked && this.period !== '1H' && this.minute >= 55 && this.rating < 5) {
      const losing = this.score[this.mySide] < this.score[this.oppSide];
      if (this.R() < (losing ? .07 : .03)) { this.onPitch = false; this.hooked = this.minute; const on = this.squads[this.mySide].subs[3] || 'the sub'; out.push(this.ev(`SUBSTITUTION: ${this.me} OFF, ${on} on. ${this.me} doesn't look at the bench. The bench doesn't look at ${this.me}.`, 'info', this.mySide)); return out; }
    }
    if (planned.some(e => e.t === 'chance') && this.onPitch) { out.push(this.startChance()); return out; }
    if (!planned.length && this.R() < .3) out.push(...this.filler(homeBall ? 'home' : 'away'));
    return out;
  }
  filler(side) {
    const R = this.R, W = { possession: 3, corner: 2, foul: 2, shotWide: 1.5, shotSaved: 1.5, offside: 1, yellow: .6, woodwork: .25, crowd: .7, injury: .3 };
    let r = R() * Object.values(W).reduce((a, b) => a + b, 0), kind = 'possession';
    for (const k in W) { r -= W[k]; if (r <= 0) { kind = k; break; } }
    const st = this.stats[side], opp = side === 'home' ? 'away' : 'home';
    if (kind === 'crowd' && this.year >= 2031 && R() < .5) return [this.ev(fill(pickR(C.future, R), this.vars(side)), 'info', side)];
    if (kind === 'corner') st.corners++;
    if (kind === 'foul') this.stats[opp].fouls++;
    if (kind === 'yellow') { this.stats[opp].fouls++; this.stats[opp].yellows++; }
    if (kind === 'shotWide' || kind === 'woodwork') st.shots++;
    if (kind === 'shotSaved') { st.shots++; st.onTarget++; }
    return [this.ev(this.line(kind, side), kind === 'yellow' ? 'card' : 'info', side)];
  }
  teamGoal(side) {
    const opp = side === 'home' ? 'away' : 'home', og = this.R() < .06;
    const v = this.vars(side); let who;
    if (og) { v.oppPlayer = this.outfield(opp, ['def']); who = v.oppPlayer + ' (og)'; }
    else { v.player = this.scorer(side); v.player2 = this.outfield(side, ['mid', 'fwd'], [v.player, this.me]); who = v.player; }
    this.score[side]++; this.stats[side].shots++; this.stats[side].onTarget++;
    this.scorers[side].push({ name: who, label: this.label() });
    if (opp === this.mySide) this.bump(-.05);
    const out = [this.ev(fill(pickR(og ? C.ownGoal : C.goal, this.R), v) + ' ' + this.scoreLine(), 'goal', side)];
    out.push(this.ev(fill(pickR(side === this.mySide ? C.goalReactionFor : C.goalReactionAgainst, this.R), this.vars(this.mySide)), 'info', this.mySide, ''));
    return out;
  }
  endPeriod() {
    const out = [], p = this.period;
    const v = this.vars('home');
    if (p === '1H') { out.push(this.ev(fill(pickR(C.halfTime, this.R), v), 'break')); out.push(this.ev(C.halfTimeTalk[this.myState()], 'info', this.mySide, '')); out.push(this.ev(this.line('secondHalf', 'home'), 'info', null, '46\'')); this.period = '2H'; this.minute = 45; return out; }
    const level = this.score.home === this.score.away;
    if (p === '2H' && this.cup && level && !this.extraTime) { out.push(this.ev(fill(pickR(C.penaltiesIntro, this.R), v).replace('after extra time', 'after 90 minutes'), 'break')); this.startShootout(); return out; }
    if (p === '2H' && this.cup && level) { out.push(this.ev(fill(pickR(C.extraTime, this.R), v), 'break')); this.planExtraTime(); this.period = 'ET1'; this.minute = 90; return out; }
    if (p === 'ET1') { out.push(this.ev(fill(pickR(C.extraTimeHalf, this.R), v), 'break')); this.period = 'ET2'; this.minute = 105; return out; }
    if (p === 'ET2' && level) { out.push(this.ev(fill(pickR(C.penaltiesIntro, this.R), v), 'break')); this.startShootout(); return out; }
    return this.finish();
  }
  myState() { const d = this.score[this.mySide] - this.score[this.oppSide]; return d > 0 ? 'winning' : d < 0 ? 'losing' : 'drawing'; }

  // ---------- your chances ----------
  pickMoment() {
    const R = this.R, W = Object.assign({}, MOMENT_WEIGHTS);
    if (this.penTaken) W.penalty = 0;
    if (this.lastMoment) W[this.lastMoment] *= .25;
    let r = R() * Object.values(W).reduce((a, b) => a + b, 0);
    for (const k in W) { r -= W[k]; if (r <= 0) return k; }
    return 'volley';
  }
  startChance(forced, shootout) {
    const key = forced || this.pickMoment(); this.lastMoment = key; if (key === 'penalty' && !shootout) this.penTaken = true;
    const mate = this.outfield(this.mySide, ['mid', 'fwd'], [this.me]), def = this.outfield(this.oppSide, ['def']);
    this.pending = { key, mate, def, shootout: !!shootout, label: this.label() };
    const text = shootout ? `${this.me} steps up to take ${this.name(this.mySide)}'s first penalty...` : fill(pickR(C.chanceIntro[key], this.R), this.vars(this.mySide, { mate, def }));
    return { label: shootout ? '' : this.label(), text, kind: 'chance', side: this.mySide, moment: key };
  }
  /** result: from the moment's onResult ({ key, outcome, goal, gained, msg, q }). */
  resolveChance(result) {
    const P = this.pending; this.pending = null;
    this.my.gained[result.key] = (this.my.gained[result.key] || 0) + result.gained;
    if (P.shootout) return this.shootoutResult(this.mySide, this.me, result.goal, true, result);
    this.my.chances++;
    const side = this.mySide, st = this.stats[side], v = this.vars(side, { mate: P.mate, def: P.def });
    const assist = ASSIST_MOMENTS.includes(result.key), o = result.outcome;
    const shot = ['goal', 'save', 'wide', 'over', 'wall'].includes(o);
    if (shot) st.shots++;
    if (o === 'goal' || o === 'save') { st.onTarget++; if (!assist) this.my.onTarget++; }
    const out = []; let text = result.msg;
    if (result.goal) {
      this.score[side]++;
      if (assist) { this.my.assists++; this.scorers[side].push({ name: P.mate, label: P.label, assist: this.me }); this.bump(.6); text += ' ' + fill(pickR(C.chanceGoalAssist, this.R), v); }
      else { this.my.goals++; this.scorers[side].push({ name: this.me, label: P.label, me: true }); this.bump(.8 + .4 * (result.q || 0)); text += ' ' + fill(pickR(C.chanceGoalFlavour, this.R), v); if (this.fans >= 60) text += ' ' + fill(pickR(C.fansChant, this.R), v); }
      if (P.key === 'penalty') text = text.replace(/^GOAL!/, 'GOAL! Penalty converted!');
      out.push({ label: P.label, text: text + ' ' + this.scoreLine(), kind: 'goal', side, mine: true });
    } else {
      const d = { save: assist ? .05 : .1, wide: assist ? -.05 : -.15, over: -.15, wall: -.1, miss: -.35, clear: -.25, poor: -.25, misplaced: -.3 }[o] ?? -.2;
      this.bump(d);
      if (d < 0 && this.R() < .6) text += ' ' + fill(pickR(C.chanceMissFlavour, this.R), v);
      out.push({ label: P.label, text, kind: 'result', side, mine: true });
    }
    this.my.log.push({ key: result.key, outcome: o, goal: result.goal, label: P.label });
    return out;
  }

  // ---------- penalties ----------
  startShootout() {
    this.period = 'PENS'; this.pens = { home: 0, away: 0, taken: { home: 0, away: 0 }, order: ['home', 'away'], i: 0, log: [] };
    const takers = side => { const sq = this.squads[side]; return [...sq.fwd, ...sq.mid, ...sq.def, sq.gk].filter((n, i, a) => a.indexOf(n) === i); };
    this.pens.takers = { home: takers('home'), away: takers('away') };
    if (this.onPitch) this.pens.takers[this.mySide] = [this.me, ...this.pens.takers[this.mySide].filter(n => n !== this.me)];
  }
  shootoutKick() {
    const P = this.pens, side = P.order[P.i % 2];
    const n = P.taken[side], taker = P.takers[side][n % P.takers[side].length];
    if (side === this.mySide && n === 0 && this.onPitch) { return [this.startChance('penalty', true)]; }
    return this.shootoutResult(side, taker, this.R() < .76, false);
  }
  shootoutResult(side, taker, scored, mine) {
    const P = this.pens; P.taken[side]++; if (scored) P[side]++; P.i++; P.log.push({ side, scored });
    const opp = side === 'home' ? 'away' : 'home';
    const v = this.vars(side, { player: taker });
    const out = [];
    if (mine) { this.bump(scored ? .2 : -.4); out.push({ label: '', text: (scored ? 'SCORED! ' : '') + v.player + (scored ? ' buries it.' : ' fails to score. Gutted.') + ` (${this.pensLine()})`, kind: scored ? 'goal' : 'result', side, mine: true }); }
    else out.push(this.ev(fill(pickR(scored ? C.shootoutScored : this.R() < .6 ? C.shootoutSaved : C.shootoutMissed, this.R), v) + ` (${this.pensLine()})`, scored ? 'goal' : 'info', side, ''));
    // decided?
    const h = P.home, a = P.away, th = P.taken.home, ta = P.taken.away;
    let over = false;
    if (th <= 5 && ta <= 5 && Math.max(th, ta) <= 5) { if (h + (5 - th) < a || a + (5 - ta) < h) over = true; }
    if (th >= 5 && ta >= 5 && th === ta && h !== a) over = true;
    if (over) out.push(...this.finish());
    return out;
  }
  pensLine() { return `${this.home.short} ${this.pens.home}-${this.pens.away} ${this.away.short}`; }

  // ---------- full time ----------
  winner() {
    if (this.score.home !== this.score.away) return this.score.home > this.score.away ? 'home' : 'away';
    if (this.pens) return this.pens.home > this.pens.away ? 'home' : 'away';
    return null;
  }
  finish() {
    this.done = true;
    const w = this.winner(), res = w == null ? 'D' : w === this.mySide ? 'W' : 'L';
    this.bump(res === 'W' ? .3 : res === 'L' ? -.3 : 0);
    this.result = res;
    const v = this.vars('home');
    const out = [this.ev(fill(pickR(C.fullTime, this.R), v) + (this.pens ? ` ${this.name(w)} win ${Math.max(this.pens.home, this.pens.away)}-${Math.min(this.pens.home, this.pens.away)} on penalties.` : ''), 'end', null, 'FT')];
    return out;
  }
  possessionPct() { return this.possTicks ? Math.round(100 * this.homePossTicks / this.possTicks) : Math.round(this.possession * 100); }

  /** Everything the full-time screen needs. */
  summary() {
    const R = this.R, NAME = this.me.toUpperCase(), team = this.name(this.mySide), opp = this.name(this.oppSide);
    const g = this.my.goals, res = this.result, margin = this.score[this.mySide] - this.score[this.oppSide];
    let hk;
    if (g >= 3) hk = 'hattrick'; else if (g === 2) hk = 'brace';
    else if (this.pens && g === 0) hk = res === 'W' ? 'shootoutWin' : 'shootoutLose';
    else if (g === 1) hk = res === 'W' && margin === 1 ? 'winner' : res === 'L' ? 'scoredLost' : 'scored';
    else if (this.my.assists) hk = 'assist'; else hk = res === 'W' ? 'blankWin' : 'blank';
    const headline = fill(pickR(C.headlines[hk], R), { NAME, TEAM: team.toUpperCase(), OPP: opp.toUpperCase() });
    const r = Math.round(this.rating * 10) / 10, vk = r >= 8 ? 'great' : r >= 7 ? 'good' : r >= 6 ? 'ok' : 'poor';
    return { role: this.unusedSub ? 'none' : this.role, unusedSub: this.unusedSub, hooked: this.hooked, result: res, headline, verdict: pickR(C.verdict[vk], R), rating: r, score: { ...this.score }, pens: this.pens && { home: this.pens.home, away: this.pens.away }, scorers: this.scorers, my: this.my };
  }
}

/** The gaffer's mood: ecstatic | happy | neutral | worried | furious. */
export function managerMood(sim) {
  const d = sim.score[sim.mySide] - sim.score[sim.oppSide], s = (sim.rating - 6.2) * 1.2 + d * .8;
  return s > 1.6 ? 'ecstatic' : s > .5 ? 'happy' : s > -.5 ? 'neutral' : s > -1.4 ? 'worried' : 'furious';
}

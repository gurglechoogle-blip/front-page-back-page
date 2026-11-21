// No-limit Texas Hold'em: you against three characters. Pure logic.
import { deck, shuffle, best, cmp, equity, HAND_NAMES } from './cards.js';

const r2 = v => Math.round(v * 100) / 100;

export class Poker {
  /** opts: { you: {name, stack}, opponents: [{name, stack, tight, aggr, bluff}], blinds: [sb, bb], R } */
  constructor(opts) {
    this.R = opts.R || Math.random; this.sb = opts.blinds[0]; this.bb = opts.blinds[1];
    this.players = [Object.assign({ human: true }, opts.you), ...opts.opponents.map(o => Object.assign({}, o))].map(p => Object.assign(p, { hole: [], folded: false, allIn: false, bet: 0, contrib: 0, last: '' }));
    this.dealer = Math.floor(this.R() * this.players.length); this.log = []; this.handNo = 0; this.over = false;
  }
  get you() { return this.players[0]; }
  live() { return this.players.filter(p => p.stack > 0 || p.contrib > 0); }
  next(i, f = p => !p.folded && !p.allIn && !p.out) { for (let k = 1; k <= this.players.length; k++) { const j = (i + k) % this.players.length; if (f(this.players[j])) return j; } return -1; }
  say(t) { this.log.push(t); if (this.log.length > 60) this.log.shift(); }

  newHand() {
    this.players.forEach(p => Object.assign(p, { hole: [], folded: false, allIn: false, bet: 0, contrib: 0, last: '', out: p.stack <= 0, shown: false, won: 0 }));
    if (this.you.stack <= 0 || this.players.filter(p => !p.out).length < 2) { this.over = true; return false; }
    this.handNo++; this.board = []; this.street = 'preflop'; this.result = null;
    this.deck = shuffle(deck(), this.R);
    this.dealer = this.next(this.dealer, p => !p.out);
    this.players.forEach(p => { if (!p.out) p.hole = [this.deck.pop(), this.deck.pop()]; else p.folded = true; });
    const sbI = this.next(this.dealer, p => !p.out), bbI = this.next(sbI, p => !p.out);
    this.post(sbI, this.sb, 'small blind'); this.post(bbI, this.bb, 'big blind');
    this.currentBet = this.bb; this.minRaise = this.bb; this.lastAggr = bbI;
    this.players.forEach(p => p.acted = false);
    this.toAct = this.next(bbI);
    this.say(`— Hand ${this.handNo} —`);
    if (this.toAct < 0) this.runOut();
    return true;
  }
  post(i, amt, what) { const p = this.players[i], a = Math.min(p.stack, amt); p.stack = r2(p.stack - a); p.bet = r2(p.bet + a); p.contrib = r2(p.contrib + a); if (!p.stack) p.allIn = true; p.last = what; }
  pot() { return r2(this.players.reduce((a, p) => a + p.contrib, 0)); }
  /** What the player to act can do. */
  options() {
    const p = this.players[this.toAct], toCall = r2(Math.min(p.stack, this.currentBet - p.bet));
    const minTo = r2(Math.min(p.bet + p.stack, this.currentBet + this.minRaise)), maxTo = r2(p.bet + p.stack);
    return { toCall, canCheck: toCall <= 0, minTo, maxTo, potTo: r2(Math.min(maxTo, this.currentBet + this.pot() + toCall)) };
  }
  /** action: 'fold' | 'check' | 'call' | 'raise' (to: total bet this street) */
  act(action, to) {
    const i = this.toAct, p = this.players[i], o = this.options();
    if (action === 'fold') { p.folded = true; p.last = 'folds'; this.say(`${p.name} folds.`); }
    else if (action === 'check' || (action === 'call' && o.toCall <= 0)) { p.last = 'checks'; this.say(`${p.name} checks.`); }
    else if (action === 'call') { this.post(i, o.toCall, p.stack <= o.toCall ? 'all in' : 'calls'); this.say(`${p.name} ${p.allIn ? 'calls, all in' : 'calls'} ${fmt(o.toCall)}.`); }
    else {
      to = r2(Math.max(o.minTo, Math.min(o.maxTo, to)));
      const add = r2(to - p.bet), raiseBy = r2(to - this.currentBet);
      this.post(i, add, '');
      if (to > this.currentBet) { if (raiseBy >= this.minRaise) this.minRaise = raiseBy; this.currentBet = to; this.lastAggr = i; this.players.forEach(q => { if (q !== p) q.acted = false; }); }
      p.last = p.allIn ? 'ALL IN' : `raises to ${fmt(to)}`; this.say(`${p.name} ${p.allIn ? 'goes ALL IN' : 'raises to ' + fmt(to)}.`);
    }
    p.acted = true;
    this.advance();
  }
  advance() {
    const inHand = this.players.filter(p => !p.folded);
    if (inHand.length === 1) return this.award([{ amount: this.pot(), winners: inHand }], false);
    const canAct = inHand.filter(p => !p.allIn);
    const done = canAct.length === 0 || canAct.every(p => p.acted && p.bet === this.currentBet);
    if (!done) { this.toAct = this.next(this.toAct); if (this.toAct >= 0) return; }
    // Next street.
    this.players.forEach(p => { p.bet = 0; p.acted = false; if (!p.folded && !p.allIn) p.last = ''; });
    this.currentBet = 0; this.minRaise = this.bb;
    if (this.street === 'river') return this.showdown();
    const n = this.street === 'preflop' ? 3 : 1; for (let k = 0; k < n; k++) this.board.push(this.deck.pop());
    this.street = { preflop: 'flop', flop: 'turn', turn: 'river' }[this.street];
    if (inHand.filter(p => !p.allIn).length < 2) return this.runOut();
    this.toAct = this.next(this.dealer);
  }
  runOut() { while (this.board.length < 5) this.board.push(this.deck.pop()); this.street = 'river'; this.showdown(); }
  showdown() {
    const contrib = this.players.map(p => p.contrib), pots = [];
    while (contrib.some(v => v > 0)) {
      const m = Math.min(...contrib.filter(v => v > 0)); let amount = 0; const elig = [];
      contrib.forEach((v, i) => { if (v > 0) { amount += Math.min(v, m); contrib[i] = r2(v - m); if (!this.players[i].folded) elig.push(this.players[i]); } });
      if (!elig.length) { pots[pots.length - 1].amount += amount; continue; }
      const scored = elig.map(p => ({ p, s: best(p.hole.concat(this.board)) }));
      const top = scored.reduce((a, b) => cmp(b.s, a.s) > 0 ? b : a).s;
      pots.push({ amount: r2(amount), winners: scored.filter(x => cmp(x.s, top) === 0).map(x => x.p), hand: HAND_NAMES[top[0]] });
    }
    this.players.filter(p => !p.folded).forEach(p => p.shown = true);
    this.award(pots, true);
  }
  award(pots, showdown) {
    this.street = 'done'; this.toAct = -1; const lines = [];
    pots.forEach(pt => { const share = r2(pt.amount / pt.winners.length); pt.winners.forEach(w => { w.stack = r2(w.stack + share); w.won = r2((w.won || 0) + share); }); lines.push(`${pt.winners.map(w => w.name).join(' and ')} win${pt.winners.length === 1 ? 's' : ''} ${fmt(pt.amount)}${showdown && pt.hand ? ' with ' + pt.hand.toLowerCase() : ''}.`); });
    lines.forEach(l => this.say(l)); this.result = { lines, showdown, youWon: this.you.won || 0 };
  }
  /** The computer player to act makes a decision. */
  aiAct() {
    const p = this.players[this.toAct], o = this.options(), pot = this.pot(), R = this.R;
    const opp = this.players.filter(q => !q.folded && q !== p).length;
    let eq = equity(p.hole, this.board, opp, this.board.length ? 90 : 60, R) - p.tight * .06;
    if (this.street === 'preflop') eq += .04;
    const strong = .66 - p.aggr * .12;
    if (o.canCheck) {
      if (eq > strong || R() < p.bluff * .2) return this.act('raise', this.currentBet + Math.max(this.bb, pot * (.5 + R() * .5)));
      return this.act('check');
    }
    const odds = o.toCall / (pot + o.toCall);
    if (eq > strong + .1 && R() < .5 + p.aggr * .4) return this.act('raise', eq > .82 && R() < .5 ? o.maxTo : this.currentBet + Math.max(this.minRaise, pot * .75));
    if (eq >= odds - (1 - p.tight) * .07) return this.act('call');
    if (R() < p.bluff * .08) return this.act('raise', this.currentBet + this.minRaise * 2);
    return this.act('fold');
  }
}
export let fmt = v => '£' + (v < 1 ? v.toFixed(2) : v % 1 ? v.toFixed(2) : v.toLocaleString('en-GB'));
export function setMoneyFormat(f) { fmt = f; }

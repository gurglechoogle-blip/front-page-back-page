// Blackjack: six-deck shoe, dealer stands on soft 17, blackjack pays 3:2,
// double down on any two cards. No splitting (the dealer at Big Lee's
// doesn't know how either).
import { deck, shuffle } from './cards.js';

export function value(h) {
  let v = 0, aces = 0; h.forEach(c => { if (c.r === 14) { aces++; v += 11; } else v += Math.min(10, c.r); });
  while (v > 21 && aces) { v -= 10; aces--; } return v;
}
const isBJ = h => h.length === 2 && value(h) === 21;

export class Blackjack {
  constructor(opts) { this.R = opts.R || Math.random; this.stack = opts.stack; this.shoe = []; this.state = 'bet'; this.msg = ''; }
  draw() { if (this.shoe.length < 60) this.shoe = shuffle(deck(6), this.R); return this.shoe.pop(); }
  deal(bet) {
    if (bet > this.stack || bet <= 0) return false;
    this.bet = bet; this.stack -= bet; this.player = [this.draw(), this.draw()]; this.dealer = [this.draw(), this.draw()];
    this.state = 'play'; this.msg = '';
    if (isBJ(this.player) || isBJ(this.dealer)) this.settle();
    return true;
  }
  get canDouble() { return this.state === 'play' && this.player.length === 2 && this.stack >= this.bet; }
  hit() { if (this.state !== 'play') return; this.player.push(this.draw()); if (value(this.player) > 21) this.settle(); else if (value(this.player) === 21) this.stand(); }
  double() { if (!this.canDouble) return; this.stack -= this.bet; this.bet *= 2; this.player.push(this.draw()); if (value(this.player) > 21) this.settle(); else this.stand(); }
  stand() { if (this.state !== 'play') return; while (value(this.dealer) < 17) this.dealer.push(this.draw()); this.settle(); }
  settle() {
    const p = value(this.player), d = value(this.dealer), pBJ = isBJ(this.player), dBJ = isBJ(this.dealer);
    let pay = 0;
    if (pBJ && !dBJ) { pay = this.bet * 2.5; this.msg = 'BLACKJACK! Pays 3 to 2.'; }
    else if (pBJ && dBJ) { pay = this.bet; this.msg = 'Both blackjack. Push.'; }
    else if (dBJ) { this.msg = 'Dealer has blackjack.'; }
    else if (p > 21) { this.msg = `Bust with ${p}.`; }
    else if (d > 21) { pay = this.bet * 2; this.msg = `Dealer busts with ${d}. You win!`; }
    else if (p > d) { pay = this.bet * 2; this.msg = `${p} beats ${d}. You win!`; }
    else if (p === d) { pay = this.bet; this.msg = `${p} each. Push.`; }
    else { this.msg = `Dealer's ${d} beats your ${p}.`; }
    this.stack += pay; this.won = pay - this.bet; this.state = 'done';
  }
}

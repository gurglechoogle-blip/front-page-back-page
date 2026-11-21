// CASINO: poker or blackjack at a venue, with chips bought in from your bank.
// params: { venue, game, buyIn }
import { esc } from '../engine/util.js';
import { state, save } from '../state/gameState.js';
import CZ from '../data/casino.json';
import { Poker, setMoneyFormat } from '../sim/poker.js';
import { Blackjack, value } from '../sim/blackjack.js';
import { label, red, describe } from '../sim/cards.js';
import { applyEffects, surname } from '../sim/life.js';
import { message } from '../sim/career.js';

const fmt = v => (v < 0 ? '-£' : '£') + (Math.abs(v) < 1000 && Math.round(Math.abs(v) * 100) % 100 ? Math.abs(v).toFixed(2) : Math.round(Math.abs(v)).toLocaleString('en-GB'));
setMoneyFormat(fmt);
const cardHTML = (c, hidden) => hidden ? '<span class="card back"></span>' : `<span class="card ${red(c) ? 'red' : ''}">${label(c)}</span>`;

export function createCasinoScreen(root, go, params) {
  const c = state.career, V = CZ.venues.find(v => v.id === params.venue), buyIn = params.buyIn;
  const $ = id => root.querySelector('#' + id);
  let poker = null, bj = null, timer = 0, talkI = 0, betAmt = V.bet ? V.bet[0] : 0, finished = false;

  function mount() {
    root.innerHTML = `<div id="casino"><div class="ctop"><div><b>${esc(V.name)}</b><small>${params.game === 'poker' ? `Texas Hold'em · blinds ${fmt(V.blinds[0])}/${fmt(V.blinds[1])}` : `Blackjack · bets ${fmt(V.bet[0])}-${fmt(V.bet[1])}`}</small></div><div class="chips" id="chips"></div><button class="btn red small" id="cash">Cash out</button></div>
      <div class="felt" id="felt"></div><div class="flash" id="flash"></div><div class="ctalk" id="talk"></div></div>`;
    $('cash').onclick = cashOut;
    if (params.game === 'poker') {
      poker = new Poker({ you: { name: c.name, stack: buyIn }, opponents: V.opponents.map(o => Object.assign({ stack: buyIn * (.8 + Math.random() * .6) }, o)), blinds: V.blinds });
      poker.newHand(); stepAI();
    } else bj = new Blackjack({ stack: buyIn });
    talk(V.talk[0]); draw();
  }
  function chips() { return poker ? poker.you.stack + (poker.street !== 'done' ? poker.you.contrib : 0) : bj.stack + (bj.state === 'play' ? bj.bet : 0); }
  function talk(t) { const d = document.createElement('div'); d.textContent = t; $('talk').prepend(d); while ($('talk').children.length > 8) $('talk').lastChild.remove(); }

  /* ---------- poker ---------- */
  /* Flashcards: every action, every new street and every result gets its own
     card in the middle of the table, one at a time, so nothing gets missed. */
  const flashQ = []; let flashing = false, seenLog = 0, seenBoard = 0, yourTurnShown = false;
  function flash(text, kind) { flashQ.push({ text, kind }); if (!flashing) nextFlash(); }
  function nextFlash() {
    const f = flashQ.shift(), el = $('flash'); if (!el) { flashing = false; return; }
    if (!f) { flashing = false; el.className = 'flash'; draw(); return; }
    flashing = true; el.textContent = f.text; el.className = 'flash show ' + (f.kind || '');
    setTimeout(nextFlash, f.kind === 'turn' ? 900 : 1150);
  }
  function syncFlash() {
    if (!poker) return;
    const log = poker.log;
    if (seenLog > log.length) seenLog = 0;
    for (; seenLog < log.length; seenLog++) {
      const t = log[seenLog];
      if (/^— Hand/.test(t)) { seenBoard = 0; yourTurnShown = false; flash(t.replace(/—/g, '').trim().toUpperCase(), 'street'); continue; }
      flash(t, /wins/.test(t) ? 'win' : /raises|ALL IN/.test(t) ? 'raise' : /folds/.test(t) ? 'fold' : '');
    }
    const b = poker.board ? poker.board.length : 0;
    if (b > seenBoard && poker.street !== 'done' || (b === 5 && seenBoard < 5)) { const name = b >= 5 && seenBoard < 5 && b - seenBoard > 1 ? 'THE BOARD RUNS OUT' : { 3: 'THE FLOP', 4: 'THE TURN', 5: 'THE RIVER' }[b]; if (name && b > seenBoard) flash(name, 'street'); seenBoard = b; }
    const myTurn = poker.street !== 'done' && poker.toAct >= 0 && poker.players[poker.toAct].human;
    if (myTurn && !yourTurnShown) { flash('YOUR TURN', 'turn'); yourTurnShown = true; }
    if (!myTurn) yourTurnShown = false;
  }
  function stepAI() {
    clearTimeout(timer);
    syncFlash();
    if (!poker || poker.street === 'done' || poker.toAct < 0) return draw();
    if (poker.players[poker.toAct].human) return draw();
    // Wait for the flashcards to catch up before the next player acts.
    if (flashing || flashQ.length) { timer = setTimeout(stepAI, 250); return draw(); }
    timer = setTimeout(() => { poker.aiAct(); if (Math.random() < .12) talk(V.talk[++talkI % V.talk.length]); stepAI(); }, 500);
    draw();
  }
  function drawPoker() {
    const g = poker, done = g.street === 'done', myTurn = !done && g.toAct >= 0 && g.players[g.toAct].human, o = myTurn ? g.options() : null;
    const seat = (p, i) => `<div class="seat ${p.folded ? 'folded' : ''} ${g.toAct === i && !done ? 'acting' : ''} ${p.out ? 'out' : ''}"><b>${esc(p.name)}${g.dealer === i ? ' <i class="dbtn">D</i>' : ''}</b><div class="hole">${p.hole.map(cd => cardHTML(cd, !(p.human || (done && p.shown)))).join('')}</div><small>${p.out ? 'Out' : fmt(p.stack)}${p.bet ? ` · bet ${fmt(p.bet)}` : ''}</small><em>${esc(p.last || '')}</em></div>`;
    $('felt').innerHTML = `<div class="opps">${g.players.slice(1).map((p, i) => seat(p, i + 1)).join('')}</div>
      <div class="board">${g.board.map(cd => cardHTML(cd)).join('') || '<span class="dim">Pre-flop</span>'}<div class="pot">Pot ${fmt(g.pot())}</div></div>
      ${done && g.result ? `<div class="hres">${g.result.lines.map(esc).join('<br>')}</div>` : ''}
      <div class="mine">${seat(g.you, 0)}${g.you.hole.length && !g.you.folded ? `<div class="myhand"><small>YOUR HAND</small>${esc(describe(g.you.hole.concat(g.board)))}</div>` : ''}</div>
      <div class="acts">${g.over ? `<p>${g.you.stack <= 0 ? 'You\'re cleaned out.' : 'Everyone else is bust. You\'ve cleaned the table out!'}</p>` : done ? '<button class="btn gold" id="nextHand">Next hand ▶</button>' : myTurn ? `
        <button class="btn red" data-a="fold">Fold</button>
        <button class="btn" data-a="${o.canCheck ? 'check' : 'call'}">${o.canCheck ? 'Check' : 'Call ' + fmt(o.toCall)}</button>
        ${o.maxTo > g.currentBet ? `<button class="btn gold" data-a="raise" data-to="${o.minTo}">Raise to ${fmt(o.minTo)}</button>${o.potTo > o.minTo ? `<button class="btn gold" data-a="raise" data-to="${o.potTo}">Pot: ${fmt(o.potTo)}</button>` : ''}<button class="btn gold" data-a="raise" data-to="${o.maxTo}">All in</button>` : ''}` : '<p class="dim">Waiting for the others...</p>'}</div>`;
    root.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { g.act(b.dataset.a, +b.dataset.to || 0); stepAI(); });
    if ($('nextHand')) $('nextHand').onclick = () => { if (!g.newHand()) return draw(); stepAI(); };
    // Your buttons wake up once the flashcards have caught up.
    if (flashing || flashQ.length) root.querySelectorAll('[data-a], #nextHand').forEach(b => { b.disabled = true; });
  }

  /* ---------- blackjack ---------- */
  function drawBJ() {
    const g = bj, play = g.state === 'play', done = g.state === 'done';
    const opts = [V.bet[0], V.bet[0] * 2, V.bet[0] * 5, Math.min(V.bet[1], V.bet[0] * 20), V.bet[1]].filter((v, i, a) => a.indexOf(v) === i);
    $('felt').innerHTML = `<div class="bjrow"><b>Dealer</b><div class="hole">${g.dealer ? g.dealer.map((cd, i) => cardHTML(cd, play && i === 1)).join('') : ''}</div><small>${g.dealer && !play ? value(g.dealer) : ''}</small></div>
      <div class="hres">${esc(g.msg || (g.state === 'bet' ? 'Place your bet.' : ''))}</div>
      <div class="bjrow"><b>${esc(c.name)}</b><div class="hole">${g.player ? g.player.map(cd => cardHTML(cd)).join('') : ''}</div><small>${g.player ? value(g.player) : ''}${play ? ` · bet ${fmt(g.bet)}` : ''}</small></div>
      <div class="acts">${play ? `<button class="btn" id="hit">Hit</button><button class="btn" id="stand">Stand</button>${g.canDouble ? '<button class="btn gold" id="dbl">Double</button>' : ''}` :
        `<div class="bets">${opts.map(v => `<button class="btn small ${v === betAmt ? 'on' : ''}" data-b="${v}" ${v > g.stack ? 'disabled' : ''}>${fmt(v)}</button>`).join('')}</div><button class="btn gold" id="deal" ${betAmt > g.stack ? 'disabled' : ''}>Deal (${fmt(betAmt)})</button>`}</div>`;
    root.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { betAmt = +b.dataset.b; draw(); });
    if ($('deal')) $('deal').onclick = () => { g.deal(betAmt); if (Math.random() < .15) talk(V.talk[++talkI % V.talk.length]); draw(); };
    if ($('hit')) $('hit').onclick = () => { g.hit(); draw(); };
    if ($('stand')) $('stand').onclick = () => { g.stand(); draw(); };
    if ($('dbl')) $('dbl').onclick = () => { g.double(); draw(); };
    void done;
  }

  function draw() {
    if (finished) return;
    poker ? drawPoker() : drawBJ();
    const ch = chips(), net = ch - buyIn;
    $('chips').innerHTML = `Chips <b>${fmt(ch)}</b> <span class="${net >= 0 ? 'good' : 'bad'}">${net >= 0 ? '+' : ''}${fmt(net)}</span>`;
  }
  function cashOut() {
    if (poker && poker.street !== 'done' && !poker.you.folded && poker.you.contrib > 0 && !poker.over && !confirm('Leave mid-hand? You\'ll forfeit what you\'ve put in.')) return;
    clearTimeout(timer); finished = true;
    const final = poker ? poker.you.stack : bj.stack, net = final - buyIn;
    c.bank += final; c.casinoLive = null; c.weekLog.push({ t: 'gamble', venue: V.id, net });
    c.gambling = c.gambling || { sessions: 0, net: 0, biggestWin: 0 }; c.gambling.sessions++; c.gambling.net += net; c.gambling.biggestWin = Math.max(c.gambling.biggestWin, net);
    if (V.id === 'casino' && params.buyIn >= 10000 && params.game === 'poker' && net > 0) c.flags.cardShark = true;
    if (c.gambling.net < -20000 && !c.flags.bookieOffered) { c.flags.bookieOffered = true; c.followUps.push({ id: 'bookieCredit', week: c.week + 1 }); }
    if (V.id === 'gran') { applyEffects(c, net > 0 ? { family: 1 } : { family: 2 }); message(c, 'Gran', net > 0 ? `You took ${fmt(net)} off me! You're out of the will. (You're back in the will.)` : `Thanks for the ${fmt(-net)}, pet. That's my bus fare sorted.`); }
    if (V.risk && Math.random() < V.risk) { applyEffects(c, { honour: -3 }); (c.weekNews = c.weekNews || []).push({ page: 'front', headline: (V.news || '{NAME} SPOTTED AT CASINO').replace('{NAME}', surname(c)) }); }
    if (V.bigNews && Math.abs(net) >= V.bigNews) { applyEffects(c, net > 0 ? { fans: 1, honour: -1 } : { honour: -3, family: -3 }); (c.weekNews = c.weekNews || []).push({ page: 'front', headline: net > 0 ? `JACKPOT! ${surname(c)} SCOOPS ${fmt(net)} AT CASINO` : `${surname(c)}'S ${fmt(-net)} CASINO BLOWOUT` }); }
    save();
    root.querySelector('#felt').innerHTML = `<div class="hres big">${net >= 0 ? `You walk out ${fmt(net)} up.` : `You walk out ${fmt(-net)} down.`}<br><small>${net >= 0 ? 'Quit while you\'re ahead. Nobody ever does.' : 'The house always wins. The house has a moat.'}</small></div><div class="acts"><button class="btn gold" id="leave">Back to the hub</button></div>`;
    root.querySelector('#leave').onclick = () => go('hub');
  }
  return { mount, frame() { }, unmount() { clearTimeout(timer); } };
}

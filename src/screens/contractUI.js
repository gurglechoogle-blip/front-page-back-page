// Transfer windows, contract talks, agents and deadline day. Self-contained
// pop-ups, usable from the hub and from the summer screen.
import { esc } from '../engine/util.js';
import { club, DIVS } from '../sim/season.js';
import { clause, standardBonuses } from '../sim/contracts.js';
import { AG, agentOf, makeOffers, renewalOffer, contractEnding, patience, respond, sign } from '../sim/transfers.js';
import { applyEffects, surname } from '../sim/life.js';
import { message } from '../sim/career.js';

const money = n => (n < 0 ? '-£' : '£') + Math.abs(Math.round(n)).toLocaleString('en-GB');
const pick = a => a[Math.floor(Math.random() * a.length)];

/** A pop-up of our own. Returns { $, close }. */
function pop(html, noClose) {
  const d = document.createElement('div'); d.className = 'modal';
  d.innerHTML = `<div class="mbox">${noClose ? '' : '<button class="mclose">✕</button>'}<div class="mbody2">${html}</div></div>`;
  document.body.appendChild(d);
  const close = () => d.remove(); const q = s => d.querySelector(s);
  if (!noClose) q('.mclose').onclick = close;
  return { $: q, all: s => d.querySelectorAll(s), close, set: h => { q('.mbody2').innerHTML = h; } };
}
const offerTitle = o => o.type === 'loan' ? 'Season-long loan' : o.type === 'renewal' ? 'New contract' : 'Transfer';

/* ---------- agents ---------- */
export function showAgents(c, done) {
  const ag = agentOf(c);
  if (ag) {
    const p = pop(`<h2>${esc(ag.name)}</h2><p class="evtext">${esc(pick(ag.advice))}</p><div class="row"><span>Their cut</span><b>${Math.round(ag.fee * 100)}% of your wages</b></div><p class="dim">What they really want: you'll work it out.</p><div class="endBtns"><button class="btn red" id="sack">Sack them (4 weeks' wages)</button></div>`);
    p.$('#sack').onclick = () => {
      c.bank -= c.contract.wage * 4; c.agent = null; applyEffects(c, { honour: -1 });
      if (ag.id === 'tony' || ag.id === 'rocco') (c.weekNews = c.weekNews || []).push({ page: 'front', headline: `${ag.id === 'tony' ? 'TONY' : 'ROCCO'} SPILLS: "${surname(c)} OWES ME EVERYTHING"` });
      message(c, ag.name, ag.id === 'clive' ? 'Fair enough, son. No hard feelings. I\'ll still come to the games.' : 'You\'ll regret this. People like me always find a way back in.');
      p.close(); done && done();
    };
    return;
  }
  if (!c.agentPitch || !c.agentPitch.ids || c.agentPitch.season !== c.season) c.agentPitch = { season: c.season, ids: AG.agents.slice().sort(() => Math.random() - .5).slice(0, 3).map(a => a.id) };
  const list = c.agentPitch.ids.map(id => AG.agents.find(a => a.id === id));
  const p = pop(`<h2>Agents available</h2><p class="dim">These three want to represent you this season. Next season it'll be a different bunch. They take a cut of your wages; they bring offers, and they bring motives.</p><div class="shop">${list.map(a => `<div class="item"><div><b>${esc(a.name)}</b><span class="price">${Math.round(a.fee * 100)}% cut</span><p>${esc(a.pitch)}</p></div><button class="btn small gold" data-a="${a.id}">Sign with them</button></div>`).join('')}</div>`);
  p.all('[data-a]').forEach(b => b.onclick = () => { c.agent = b.dataset.a; c.agentPitch = null; message(c, AG.agents.find(a => a.id === c.agent).name, pick(AG.agents.find(a => a.id === c.agent).advice)); p.close(); done && done(); });
}

/* ---------- a transfer window ---------- */
/** opts: { rep, age, window, midSeason, onDone } */
export function showWindow(c, opts) {
  const list = c.windowOffers && c.windowOffers.week === c.week && c.windowOffers.window === opts.window ? c.windowOffers.list : makeOffers(c, opts.rep, opts.age, opts.window);
  c.windowOffers = { week: c.week, window: opts.window, list };
  const ending = opts.window === 'summer' && contractEnding(c) && !c.loan;
  const offers = ending ? [renewalOffer(c, opts.rep), ...list] : list;
  const ag = agentOf(c);
  const p = pop(`<h2>${opts.window === 'summer' ? 'Summer' : 'January'} transfer window</h2>
    ${ending ? '<p class="bad">Your contract is up this summer. Sign something, or the club will offer you a year out of pity.</p>' : ''}
    ${ag ? `<p class="evtext"><b>${esc(ag.name)}:</b> ${esc(pick(ag.advice))}</p>` : ''}
    <div class="scroll shop">${offers.map((o, i) => { const cl = club(o.clubId); return `<div class="item ${o.dream ? 'owned' : ''}"><div><b>${esc(cl.name)}</b> <small class="kind">${offerTitle(o)}</small>${o.dream ? ' <small class="kind dream">★ BOYHOOD CLUB</small>' : ''}<p>${esc(DIVS[cl.league] ? DIVS[cl.league].short : '')} · ${esc(o.role)} · ${money(o.wage)}/wk · ${o.years} year${o.years > 1 ? 's' : ''}${o.fee ? ` · fee ${money(o.fee)}` : ''}</p></div><button class="btn small gold" data-o="${i}">Talk terms</button></div>`; }).join('') || '<p class="dim">Nobody\'s come in for you. Yet.</p>'}</div>
    <div class="endBtns"><button class="btn" id="stay">${ending ? 'Done' : 'Stay where I am'}</button></div>`);
  p.all('[data-o]').forEach(b => b.onclick = () => { const o = offers[+b.dataset.o]; p.close(); showTalks(c, o, opts, signed => { if (signed) opts.onDone && opts.onDone(true); else showWindow(c, opts); }); });
  p.$('#stay').onclick = () => {
    p.close();
    if (ending) { c.contract.until = c.contract.until.replace(/^\d{4}/, y => String(+y + 1)); message(c, club(c.clubId).short + ' News', 'Nothing signed, so we\'ve given you a one-year deal. Out of pity, mainly.'); }
    opts.onDone && opts.onDone(false);
  };
}

/* ---------- contract talks ---------- */
export function showTalks(c, offer, opts, done) {
  const cl = club(offer.clubId), pat = patience(c, offer, opts.rep);
  let round = 0, ask = { wage: offer.wage, years: offer.years, imageRights: false, goalBonus: 0, assistBonus: 0, releaseClause: 0, silly: null };
  const small = offer.type === 'loan' ? '' : (() => { const sb = standardBonuses(offer.wage); return `<div class="smallprint"><b>The small print</b><div>Appearance fee: ${money(sb.appearanceFee)} · Win bonus: ${money(sb.winBonus)}</div>${(offer.clubClauses || []).map(id => `<div>• ${esc(clause(id).text)}</div>`).join('')}</div>`; })();
  // No agent, no leverage: take it or leave it.
  if (!agentOf(c)) {
    const p0 = pop(`<h2>${esc(cl.name)}: ${offerTitle(offer)}</h2><p class="evtext">${money(offer.wage)} a week for ${offer.years} year${offer.years > 1 ? 's' : ''}, as a ${esc(offer.role)}.</p>${small}<p class="bad">You haven't got an agent, so there's no negotiating. Their club secretary slides the contract across the table and taps where you sign. (Get an agent under Football → Agent to haggle.)</p><div class="endBtns"><button class="btn gold" id="take">Sign it</button><button class="btn red" id="back">Walk away</button></div>`, true);
    p0.$('#take').onclick = () => { sign(c, offer, { wage: offer.wage, years: offer.years }, opts.midSeason); p0.set(`<h2>DEAL!</h2><p class="evtext">Signed. ${money(offer.wage)} a week. You didn't even read it. Nobody does.</p><div class="endBtns"><button class="btn gold" id="ok">Brilliant</button></div>`); p0.$('#ok').onclick = () => { p0.close(); done(true); }; };
    p0.$('#back').onclick = () => { p0.close(); done(false); };
    return;
  }
  const bonusOpts = [0, Math.round(offer.wage * .05 / 10) * 10 || 10, Math.round(offer.wage * .15 / 10) * 10 || 20], relOpts = [0, Math.max(50000, offer.fee * 3)];
  const p = pop('', true);
  const form = (note) => {
    p.set(`<h2>${esc(cl.name)}: ${offerTitle(offer)}</h2><p class="dim">${esc(note || `Their offer: ${money(offer.wage)} a week for ${offer.years} year${offer.years > 1 ? 's' : ''}, as a ${offer.role}. Ask for too much and they'll walk.`)}</p>${small}
      <div class="talks">
        <label>Wages <b id="wv">${money(ask.wage)}/wk</b><input type="range" id="w" min="${offer.wage}" max="${offer.wage * 2}" step="10" value="${ask.wage}"></label>
        ${offer.type === 'loan' ? '' : `<label>Length <select id="y">${[1, 2, 3, 4, 5].map(y => `<option ${y === ask.years ? 'selected' : ''}>${y}</option>`).join('')}</select> years</label>
        <label class="chk"><input type="checkbox" id="ir" ${ask.imageRights ? 'checked' : ''}> Image rights (you get a cut of shirt sales)</label>
        <label>Goal bonus <select id="gb">${bonusOpts.map(v => `<option value="${v}" ${v === ask.goalBonus ? 'selected' : ''}>${v ? money(v) + ' a goal' : 'None'}</option>`).join('')}</select></label>
        <label>Assist bonus <select id="ab">${bonusOpts.map(v => `<option value="${v}" ${v === ask.assistBonus ? 'selected' : ''}>${v ? money(v) + ' an assist' : 'None'}</option>`).join('')}</select></label>
        <label>Release clause <select id="rc">${relOpts.map(v => `<option value="${v}" ${v === ask.releaseClause ? 'selected' : ''}>${v ? money(v) : 'None'}</option>`).join('')}</select></label>`}
        <label>Special request <select id="sc"><option value="">None</option>${AG.sillyClauses.map(t => `<option ${t === ask.silly ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      </div>
      <div class="endBtns"><button class="btn gold" id="go">Make your demands</button><button class="btn red" id="back">Walk away</button></div>`);
    p.$('#w').oninput = e => { p.$('#wv').textContent = money(+e.target.value) + '/wk'; };
    p.$('#go').onclick = () => {
      ask = { wage: +p.$('#w').value, years: p.$('#y') ? +p.$('#y').value : 1, imageRights: p.$('#ir') ? p.$('#ir').checked : false, goalBonus: p.$('#gb') ? +p.$('#gb').value : 0, assistBonus: p.$('#ab') ? +p.$('#ab').value : 0, releaseClause: p.$('#rc') ? +p.$('#rc').value : 0, silly: p.$('#sc').value || null };
      const r = respond(offer, ask, pat, round++);
      if (r.verdict === 'accept') return deal(ask);
      if (r.verdict === 'walk') { p.set(`<h2>They've walked away</h2><p class="evtext">"${esc(pick(['We\'re not paying that for someone who still gets his mum to iron his kit.', 'Our chairman laughed so hard he needed a sit-down.', 'We\'ll go another way. The other way is cheaper.']))}"</p><div class="endBtns"><button class="btn" id="ok">Back</button></div>`); p.$('#ok').onclick = () => { p.close(); done(false); }; return; }
      const k = r.counter;
      p.set(`<h2>They've come back with a counter</h2><div class="evtext">${money(k.wage)}/wk · ${k.years} year${k.years > 1 ? 's' : ''}${k.imageRights ? ' · image rights' : ''}${k.goalBonus ? ` · ${money(k.goalBonus)} a goal` : ''}${k.assistBonus ? ` · ${money(k.assistBonus)} an assist` : ''}${k.releaseClause ? ` · release clause ${money(k.releaseClause)}` : ''}${k.silly ? ` · "${esc(k.silly)}"` : ' · (no special request)'}</div><div class="endBtns"><button class="btn gold" id="take">Accept their counter</button><button class="btn" id="push">Push for more</button></div>`);
      p.$('#take').onclick = () => deal(k);
      p.$('#push').onclick = () => { ask = k; form('Push your luck. Every round tests their patience.'); };
    };
    p.$('#back').onclick = () => { p.close(); done(false); };
  };
  const deal = terms => {
    sign(c, offer, terms, opts.midSeason);
    p.set(`<h2>DEAL!</h2><p class="evtext">${offer.type === 'renewal' ? `You've signed a new deal at ${esc(cl.name)}.` : offer.type === 'loan' ? `You're off on loan to ${esc(cl.name)}. Pack a bag. Pack two.` : `You're a ${esc(cl.name)} player.`} ${money(terms.wage)} a week${terms.silly ? `, and yes, "${esc(terms.silly.toLowerCase())}"` : ''}.</p><div class="endBtns"><button class="btn gold" id="ok">Brilliant</button></div>`);
    p.$('#ok').onclick = () => { p.close(); done(true); };
  };
  form();
}

/* ---------- deadline day ---------- */
export function showDeadline(c, opts) {
  const ag = agentOf(c), offers = makeOffers(c, opts.rep + 6, opts.age, 'january').filter(o => o.type === 'transfer').slice(0, 3);
  if (!offers.length) return opts.onDone(false);
  const p = pop('', true);
  const panic = { clive: 'Clive: "I don\'t know what a medical is. Is it a doctor? Should I bring a doctor?"', tony: 'Tony: "Tony is ON IT. Tony has three phones. Tony is using all of them."', saffron: 'Saffron: "Whatever happens, wear the white trainers. The white ones."', grey: 'Mr Grey: "Leave it with me. Don\'t ask how."', rocco: 'Rocco: "The cameras are rolling. Look worried. Now look determined. Good."' };
  const step = (time, html) => p.set(`<div class="evvia">📱 Deadline day · ${time}</div>${html}`);
  step('6:00pm', `<h2>The phone won't stop</h2><p class="evtext">${offers.length} club${offers.length > 1 ? 's have' : ' has'} made a late move. ${ag ? esc(panic[ag.id]) : 'You haven\'t got an agent. Your mum\'s answering the phone.'}</p><div class="choices">${offers.map((o, i) => `<button class="btn choice" data-o="${i}">${esc(club(o.clubId).name)} <small>${money(o.wage)}/wk · ${esc(o.role)}</small></button>`).join('')}<button class="btn choice red" id="stay">Turn the phone off and stay put</button></div>`);
  p.all('[data-o]').forEach(b => b.onclick = () => {
    const o = offers[+b.dataset.o];
    if (Math.random() < .25) { step('8:10pm', `<h2>Fee rejected</h2><p class="evtext">Your club have rejected ${esc(club(o.clubId).name)}'s bid. "He's not for sale," says the chairman, who'd have sold you for a minibus in August.</p><div class="endBtns"><button class="btn" id="ok">Oh well</button></div>`); p.$('#ok').onclick = () => { p.close(); opts.onDone(false); }; return; }
    step('9:30pm', `<h2>Fee agreed! But...</h2><p class="evtext">The fax machine at your club has broken. It's from 1994. It was broken in 1994. The paperwork has to be there by midnight.</p><div class="choices"><button class="btn choice" data-f="drive">Drive the paperwork there yourself</button><button class="btn choice" data-f="tesco">Find a fax at the 24-hour Tesco</button><button class="btn choice" data-f="agent">Leave it to ${ag ? esc(ag.name.split(' ')[0]) : 'Mum'}</button></div>`);
    p.all('[data-f]').forEach(f => f.onclick = () => {
      const odds = { drive: .8, tesco: .6, agent: ag ? (ag.id === 'clive' ? .4 : ag.id === 'grey' ? .9 : .7) : .5 }[f.dataset.f];
      if (f.dataset.f === 'drive') applyEffects(c, { energy: -10 });
      step('11:40pm', `<h2>Driving to the medical</h2><p class="evtext">Twenty minutes. A motorway. A sat-nav that keeps saying "turn around where possible".</p><div class="choices"><button class="btn choice" data-d="fast">Put your foot down</button><button class="btn choice" data-d="safe">Drive sensibly</button></div>`);
      p.all('[data-d]').forEach(d => d.onclick = () => {
        const fast = d.dataset.d === 'fast', made = Math.random() < odds * (fast ? 1 : .7);
        if (fast && Math.random() < .3) { applyEffects(c, { honour: -3 }); (c.weekNews = c.weekNews || []).push({ page: 'front', headline: `${surname(c)} CLOCKED AT 98MPH ON DEADLINE DASH` }); }
        if (made) {
          step('11:58pm', `<h2>Signed. At 11:58.</h2><p class="evtext">The doctor checks your knees, your eyes and whether you can say "I've always wanted to play for this club" with a straight face. You can.</p><div class="endBtns"><button class="btn gold" id="ok">Brilliant</button></div>`);
          p.$('#ok').onclick = () => { sign(c, o, { wage: o.wage, years: o.years }, true); (c.weekNews = c.weekNews || []).push({ page: 'back', headline: `DEADLINE DASH: ${surname(c)} SEALS LATE MOVE TO ${club(o.clubId).name.toUpperCase()}` }); p.close(); opts.onDone(true); };
        } else {
          step('00:01am', `<h2>Too late</h2><p class="evtext">The paperwork arrives at 00:01. The deal collapses. You're stood in a car park in your socks.</p><div class="endBtns"><button class="btn" id="ok">Drive home</button></div>`);
          p.$('#ok').onclick = () => { (c.weekNews = c.weekNews || []).push({ page: 'back', headline: `FAX FIASCO: ${surname(c)} MOVE COLLAPSES AT MIDNIGHT` }); applyEffects(c, { manager: -6 }); p.close(); opts.onDone(false); };
        }
      });
    });
  });
  p.$('#stay').onclick = () => { applyEffects(c, { manager: 3, fans: 2 }); p.close(); opts.onDone(false); };
}

// START OF CAREER: name entry, then 3-4 academy offers from real clubs.
import { W, H, setCam } from '../engine/camera.js';
import { setCtx, drawBackground, setVenue } from '../engine/draw.js';
import { esc } from '../engine/util.js';
import { state, save, scoutRating } from '../state/gameState.js';
import { luminance } from '../engine/kits.js';
import { club, DIVS } from '../sim/season.js';
import { academyOffers, createCareer, ACADEMY } from '../sim/career.js';

export function createStartScreen(root, go) {
  let ctx, offers = null;
  const $ = id => root.querySelector('#' + id);
  function mount() {
    root.innerHTML = `<div id="app"><div id="stage" class="tall"><canvas id="c" width="${W}" height="${H}"></canvas><div class="overlay"><div class="panel" id="sp"></div></div></div></div>`;
    ctx = $('c').getContext('2d'); setCam('def'); setVenue(null); nameStep();
  }
  function nameStep() {
    const sc = scoutRating();
    $('sp').innerHTML = `<h1>FRONT PAGE, <span>BACK PAGE</span></h1>
      <div class="sub">Summer 2026. You're 16, you're English, you're a striker, and the scouts have been watching.</div>
      <div class="namebox">Your name <input id="nm" maxlength="16" placeholder="Surname works best" value="${esc(state.profile.name)}"></div>
      <p class="prenote">Scout report: <b>${sc.toFixed(1)} / 5</b> (your best score in each training drill, averaged). That decides who comes calling.${sc < 2.5 ? ' Want bigger clubs? Show them some quality at the training ground first.' : ' Some big clubs have noticed.'}</p>
      <div class="endBtns"><button class="btn gold big" id="go">FIND ME A CLUB ▶</button></div>
      <div class="hint"><a href="#" id="tg">Training ground (free practice)</a> · <a href="#" id="md">One-off match</a></div>`;
    $('go').onclick = () => { const n = $('nm').value.trim(); if (!n) { $('nm').focus(); $('nm').classList.add('shake'); return; } state.profile.name = n; save(); offerStep(); };
    $('nm').onkeydown = e => { if (e.key === 'Enter') $('go').click(); };
    $('tg').onclick = e => { e.preventDefault(); go('training'); };
    $('md').onclick = e => { e.preventDefault(); go('setup'); };
  }
  function offerStep() {
    offers = offers || academyOffers(scoutRating());
    const star = n => '★'.repeat(n) + '<i>' + '★'.repeat(5 - n) + '</i>';
    const lvl = v => v >= 1.2 ? 5 : v >= 1 ? 3 : 2;
    $('sp').innerHTML = `<h1>ACADEMY <span>OFFERS</span></h1><div class="sub">${offers.length} clubs want ${esc(state.profile.name)}. Pick one. Choose wisely, Gran's already told the neighbours.</div>
      <div class="offers">${offers.map((o, i) => { const C = club(o.clubId), A = ACADEMY[o.type]; return `<div class="offer" style="--shirt:${C.home.shirt};--trim:${C.home.trim}"${luminance(C.home.shirt) > .62 ? ' data-light' : ''}>
        <div class="ohead"><b>${esc(C.name)}</b><small>${esc(DIVS[C.league].short)}</small></div>
        <div class="otype">${esc(A.label)}</div>
        <div class="oplus">✔ ${esc(A.strength)}</div><div class="ominus">✘ ${esc(A.catch)}</div>
        <div class="oterms"><div><span>Wages</span><b>£${A.wage}/wk</b></div><div><span>Signing-on</span><b>£${A.signingFee.toLocaleString('en-GB')}</b></div><div><span>Coaching</span><b>${star(lvl(A.coaching))}</b></div><div><span>Game time</span><b>${star(Math.max(1, Math.round(A.pathway * 10)))}</b></div><div><span>Patience</span><b>${star(Math.max(1, Math.round(5 - (A.patience - .5) * 4)))}</b></div><div><span>Prestige</span><b>${star(A.prestige)}</b></div></div>
        <p class="opitch">${esc(o.pitch)}</p>
        <button class="btn gold" data-i="${i}">Sign for ${esc(C.short)}</button></div>`; }).join('')}</div>
      <div class="hint"><a href="#" id="backN">◀ Change name</a></div>`;
    root.querySelectorAll('.offer button').forEach(b => b.onclick = () => { state.career = createCareer(state.profile.name, offers[+b.dataset.i]); save(); go('hub'); });
    $('backN').onclick = e => { e.preventDefault(); nameStep(); };
  }
  function frame() { setCtx(ctx); drawBackground(); }
  return { mount, frame };
}

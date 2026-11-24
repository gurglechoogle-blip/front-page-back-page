// THE PLAY-OFFS: two-legged semi, then Wembley. Your results decide who goes up.
import { esc } from '../engine/util.js';
import { state, save } from '../state/gameState.js';
import { club, prettyDate } from '../sim/season.js';
import { selection, playHeadless, recordMatch, matchParams } from '../sim/career.js';
import { nextPlayoffFixture, advancePlayoffs } from '../sim/playoffs.js';

export function createPlayoffsScreen(root, go) {
  const c = state.career, PO = c.playoff;
  const ensureMatchday = () => { if (!c.matchday) c.matchday = { queue: [], results: [], sel: {} }; c.matchday.queue = c.matchday.queue || []; };
  function record(f, S) { ensureMatchday(); recordMatch(c, f, S); advancePlayoffs(c); save(); }
  function mount() {
    const f = nextPlayoffFixture(c), me = c.clubId;
    const res = x => x.played ? `${x.hs}-${x.as}${x.pens ? ` (${x.pens[0]}-${x.pens[1]} pens)` : ''}` : 'v';
    const os = PO.otherSemi;
    const role = f ? (c.matchday && c.matchday.sel && c.matchday.sel[f.id]) || null : null;
    root.innerHTML = `<div id="weekscr"><div class="wpanel narrow">
      <h1>${esc(PO.name.toUpperCase().replace(/ PLAY-OFF$/, ''))} <span>PLAY-OFFS</span></h1>
      <div class="sub">Two legs, then Wembley. Win it and you're going up.</div>
      <h3>Your semi-final</h3>${PO.fixtures.filter(x => x.round !== 'F').map(x => `<div class="row"><span>${esc(x.round === 'S1' ? 'First leg' : 'Second leg')} · ${prettyDate(x.date, true)}</span><b>${esc(club(x.home).short)} ${res(x)} ${esc(club(x.away).short)}</b></div>`).join('')}
      ${PO.semiAgg ? `<p class="${PO.stage === 'out' ? 'bad' : 'good'}">Aggregate ${PO.semiAgg[0]}-${PO.semiAgg[1]}${PO.semiPens ? `, ${PO.stage === 'out' ? 'lost' : 'won'} ${Math.max(...PO.semiPens)}-${Math.min(...PO.semiPens)} on penalties` : ''}.</p>` : ''}
      <h3>The other semi-final</h3><div class="row"><span>${esc(club(os.a).short)} v ${esc(club(os.b).short)}</span><b>${os.l1[1] + os.l2[0]}-${os.l1[0] + os.l2[1]} on aggregate${os.pens ? ' (pens)' : ''} · ${esc(club(os.winner).short)} through</b></div>
      ${PO.fixtures.some(x => x.round === 'F') ? `<h3>The final · Wembley Stadium</h3>${PO.fixtures.filter(x => x.round === 'F').map(x => `<div class="row"><span>${prettyDate(x.date, true)}</span><b>${esc(club(x.home).short)} ${res(x)} ${esc(club(x.away).short)}</b></div>`).join('')}` : ''}
      ${PO.otherFinal ? `<h3>The final · Wembley Stadium</h3><div class="row"><span>Without you</span><b>${esc(club(PO.otherFinal.home).short)} ${PO.otherFinal.hs}-${PO.otherFinal.as} ${esc(club(PO.otherFinal.away).short)}</b></div>` : ''}
      ${PO.done ? `<p class="verdict">${esc(PO.result)}${PO.winner !== me ? ` ${esc(club(PO.winner).name)} go up instead.` : ''}</p><div class="endBtns"><button class="btn gold big" id="done">Back to the season review ▶</button></div>`
        : f ? `<div class="endBtns"><button class="btn gold big" id="play">${f.round === 'F' ? 'THE FINAL' : f.round === 'S1' ? 'FIRST LEG' : 'SECOND LEG'}: ${esc(club(f.home === me ? f.away : f.home).name)} ${f.home === me ? '(H)' : '(A)'} ▶</button></div><p class="dim" id="role">${role ? '' : 'The gaffer will name his team when you get there.'}</p>` : ''}
    </div></div>`;
    const done = root.querySelector('#done'), play = root.querySelector('#play');
    if (done) done.onclick = () => { save(); go('season'); };
    if (play) play.onclick = () => {
      ensureMatchday();
      const r = c.matchday.sel[f.id] || (c.matchday.sel[f.id] = selection(c, f)); save();
      if (r === 'none') {
        const S = playHeadless(c, f).summary(); record(f, S);
        root.querySelector('#role').textContent = `You weren't in the squad. You watched: ${club(f.home).short} ${S.score.home}-${S.score.away} ${club(f.away).short}.`;
        setTimeout(mount, 1600); return;
      }
      go('match', Object.assign(matchParams(c, f, r), { playerName: c.name, bigGame: f.round === 'F', onDone: S => { record(f, S); go('playoffs'); } }));
    };
  }
  return { mount, frame() { } };
}

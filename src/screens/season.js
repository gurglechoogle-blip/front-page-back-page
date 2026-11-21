// SEASON REVIEW: where you finished and what you did. Season two comes later.
import { esc } from '../engine/util.js';
import { state, save } from '../state/gameState.js';
import { club, zone, DIVS, CAL, roundName } from '../sim/season.js';
import { seasonSummary, rollWorld, beginSeason, age } from '../sim/career.js';
import { showWindow } from './contractUI.js';
import { reputation } from '../sim/transfers.js';
import { skillLevelExact } from '../state/gameState.js';
import { seasonYear } from '../sim/season.js';
import { tournamentFor, createTournament } from '../sim/international.js';

export function createSeasonScreen(root, go) {
  const c = state.career, S = seasonSummary(c), z = zone(c.div, S.pos, S.of);
  const verdict = { champ: 'CHAMPIONS!', europe: 'Europe next season.', promo: 'PROMOTED!', playoff: 'Into the play-offs. (Play-offs coming soon: Dennis says you\'d have won.)', releg: 'Relegated. Mum says it\'s not your fault. Gran disagrees.' }[z] || 'Mid-table. Steady. Like a nice cup of tea.';
  const sfx = n => (n % 100 > 10 && n % 100 < 14) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  function mount() {
    const cups = Object.entries(c.cups).map(([k, v]) => `<div class="row"><span>${esc(v.cupName || CAL.cups[k].short)}</span><b>${v.won ? 'WINNERS' : v.alive ? 'still going' : 'out in the ' + (v.round === 'G' ? 'group stage' : roundName({ comp: k, round: v.round }))}</b></div>`).join('');
    root.innerHTML = `<div id="weekscr"><div class="wpanel narrow">
      <h1>SEASON <span>${esc(c.season)}</span></h1>
      <div class="bigpos">${S.pos}<sup>${sfx(S.pos)}</sup></div><div class="sub">in the ${esc(DIVS[c.div].name)} with ${esc(club(c.clubId).name)}</div>
      <p class="verdict">${verdict}</p>
      <h3>You</h3><div class="row"><span>Appearances</span><b>${S.stats.apps}</b></div><div class="row"><span>Goals</span><b>${S.stats.goals}</b></div><div class="row"><span>Assists</span><b>${S.stats.assists}</b></div><div class="row"><span>Average rating</span><b>${S.avg ? S.avg.toFixed(2) : '–'}</b></div><div class="row"><span>Bank balance</span><b>£${Math.round(S.bank).toLocaleString('en-GB')}</b></div>
      <h3>Cups</h3>${cups}
      <p class="dim">Transfers, loans and contract talks arrive in a later update. For now your club keeps you, and the world moves on: promotions, relegations and all.</p>
      <div class="endBtns"><button class="btn gold big" id="nextSeason">START ${seasonYear() + 1}-${String(seasonYear() + 2).slice(-2)} ▶</button></div>
      <div class="endBtns"><button class="btn" id="hub">Back to the hub</button><button class="btn red" id="new">Start a new career</button></div>
    </div></div>`;
    root.querySelector('#hub').onclick = () => go('hub');
    const openWindow = () => showWindow(c, { rep: reputation(c, skillLevelExact(), age(c)), age: age(c), window: 'summer', midSeason: false, onDone: () => { beginSeason(c); save(); go('hub'); } });
    root.querySelector('#nextSeason').onclick = () => {
      rollWorld(c);
      // Tournament summer? England first, then the window.
      const t = tournamentFor(seasonYear()), rep = reputation(c, skillLevelExact(), age(c));
      if (t && !t.finaleOnly && age(c) >= 17) {
        const caps = c.intl.caps.senior, selected = rep >= 58 || (caps >= 2 && rep >= 52);
        createTournament(c, t, selected, rep >= 68 ? 'start' : 'sub'); c.summer.stage = 'tournament'; save(); go('tournament'); return;
      }
      save(); openWindow();
    };
    if (c.summer && c.summer.stage === 'window') openWindow(); // came back mid-summer
    root.querySelector('#new').onclick = () => { if (confirm('Start a new career? This one goes in the bin.')) { state.career = null; save(); go('start'); } };
  }
  return { mount, frame() { } };
}

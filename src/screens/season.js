import { ask } from '../engine/ask.js';
// SEASON REVIEW: where you finished and what you did. Season two comes later.
import { esc } from '../engine/util.js';
import { state, save, newGame, exportSave } from '../state/gameState.js';
import { club, zone, DIVS, CAL, roundName } from '../sim/season.js';
import { seasonSummary, rollWorld, beginSeason, age, message } from '../sim/career.js';
import { showWindow } from './contractUI.js';
import { reputation } from '../sim/transfers.js';
import { skillLevelExact, ageSkills } from '../state/gameState.js';
import { rateCard } from '../sim/card.js';
import { applyEffects, surname } from '../sim/life.js';
import { seasonYear } from '../sim/season.js';
import { tournamentFor, createTournament, levelFor } from '../sim/international.js';
import { qualifiedFor } from '../sim/intlSchedule.js';
import { playoffEligible, setupPlayoffs } from '../sim/playoffs.js';
import { leagueTable } from '../sim/career.js';

export function createSeasonScreen(root, go) {
  const c = state.career, S = seasonSummary(c), z = zone(c.div, S.pos, S.of);
  const verdict = { champ: 'CHAMPIONS!', europe: 'Europe next season.', promo: 'PROMOTED!', playoff: 'Into the play-offs!', releg: 'Relegated. Mum says it\'s not your fault. Gran disagrees.' }[z] || 'Mid-table. Steady. Like a nice cup of tea.';
  const sfx = n => (n % 100 > 10 && n % 100 < 14) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  function mount() {
    const cups = Object.entries(c.cups).map(([k, v]) => `<div class="row"><span>${esc(v.cupName || CAL.cups[k].short)}</span><b>${v.won ? 'WINNERS' : v.alive ? 'still going' : 'out in the ' + (v.round === 'G' ? 'group stage' : roundName({ comp: k, round: v.round }))}</b></div>`).join('');
    root.innerHTML = `<div id="weekscr"><div class="wpanel narrow">
      <h1>SEASON <span>${esc(c.season)}</span></h1>
      <div class="bigpos">${S.pos}<sup>${sfx(S.pos)}</sup></div><div class="sub">in the ${esc(DIVS[c.div].name)} with ${esc(club(c.clubId).name)}</div>
      <p class="verdict">${verdict}</p>
      <h3>You</h3><div class="row"><span>Appearances</span><b>${S.stats.apps}</b></div><div class="row"><span>Goals</span><b>${S.stats.goals}</b></div><div class="row"><span>Assists</span><b>${S.stats.assists}</b></div><div class="row"><span>Average rating</span><b>${S.avg ? S.avg.toFixed(2) : '–'}</b></div><div class="row"><span>Bank balance</span><b>£${Math.round(S.bank).toLocaleString('en-GB')}</b></div>
      <h3>Cups</h3>${cups}
      <div id="cardBox"></div>
      <div class="backupbox"><b>💾 Back up your career</b><p class="dim">The game saves in your browser, which can clear it without asking. A downloaded save file is the only copy that survives anything. ${c.lastExport ? `Last downloaded: ${esc(c.lastExport.season)}.` : 'You\'ve never downloaded one.'}</p><button class="btn gold small" id="seasonDl">Download save file</button></div>
      <p class="dim">Next: the summer transfer window, where offers, loans and contract talks happen. Then a new season, with all the promotions and relegations settled.</p>
      <div class="endBtns"><button class="btn gold big" id="nextSeason">START ${seasonYear() + 1}-${String(seasonYear() + 2).slice(-2)} ▶</button></div>
      <div class="endBtns"><button class="btn" id="hub">Back to the hub</button><button class="btn red" id="new">Start a new career</button></div>
    </div></div>`;
    root.querySelector('#hub').onclick = () => go('hub');
    root.querySelector('#seasonDl').onclick = () => { exportSave(); const b = root.querySelector('#seasonDl'); b.textContent = 'Downloaded ✓'; b.disabled = true; };
    const openWindow = () => showWindow(c, { rep: reputation(c, skillLevelExact(), age(c)), age: age(c), window: 'summer', midSeason: false, onDone: () => {
      const lost = ageSkills(age(c), (c.rooms && c.rooms.includes('gym')) || (c.staff || []).includes('trainer'));
      beginSeason(c);
      if (lost) message(c, 'Dennis (kit man)', `Your knees made a noise getting off the bus. The first one's always the worst. (Skills faded a little over the summer${c.rooms && c.rooms.includes('gym') ? ', less thanks to the home gym' : ''}.)`);
      save(); go('hub');
    } });
    // The video-game card for next season.
    c.cards = c.cards || [];
    let card = c.cards.find(x => x.year === seasonYear());
    if (!card && !c.summer) { card = rateCard(c, state.profile.skills, age(c), seasonYear(), S.avg, S.stats.goals); c.cards.push(card); save(); }
    if (card) {
      const prev = c.cards[c.cards.indexOf(card) - 1], diff = prev ? card.ovr - prev.ovr : 0;
      root.querySelector('#cardBox').innerHTML = `<h3>Your ${esc(card.game)} card</h3><div class="gcard ${card.tier}"><div class="ovr">${card.ovr}</div><div class="pos">ST</div><div class="nm">${esc(surname(c))}</div><div class="attrs">${Object.entries(card.attrs).map(([k, v]) => `<span><b>${v}</b> ${k}</span>`).join('')}</div></div>${prev ? `<p class="dim">${diff >= 0 ? '+' : ''}${diff} on last year's ${esc(prev.game)}.</p>` : ''}
        ${card.reacted ? '' : `<div class="choices small"><button class="btn choice" data-r="moan">Complain online: "${card.ovr} is a JOKE"</button><button class="btn choice" data-r="laugh">Post a laughing emoji and move on</button></div>`}`;
      root.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
        card.reacted = b.dataset.r;
        if (b.dataset.r === 'moan') { applyEffects(c, { fans: -2, honour: -1 }); (c.weekNews = c.weekNews || []).push({ page: 'front', headline: `RATING RAGE: ${surname(c)} FUMES AT ${card.game} SCORE` }); }
        else applyEffects(c, { fans: 2 });
        save(); mount();
      });
    }
    // Retirement is your choice, from 33.
    if (age(c) >= 33 && !c.retired) { const d = document.createElement('div'); d.className = 'endBtns'; d.innerHTML = '<button class="btn red" id="retire">Hang up your boots</button>'; root.querySelector('.wpanel').appendChild(d); root.querySelector('#retire').onclick = () => ask('Retire? Your playing days end here. The phone may ring again one day...', 'Retire', 'Not yet').then(ok => { if (ok) { c.retired = true; c.retiredAt = age(c); rollWorld(c); c.summer = null; save(); go('finale'); } }); }
    // Play-offs first, if you finished in the places.
    const POnow = c.playoff && c.playoff.season === c.season ? c.playoff : null, needPO = !c.summer && (playoffEligible(c, S.pos) || (POnow && !POnow.done));
    if (POnow && POnow.done) root.querySelector('.verdict').textContent = POnow.winner === c.clubId ? 'PROMOTED VIA THE PLAY-OFFS! Wembley. Bedlam. Mum cried.' : POnow.result === 'Lost the play-off final' ? 'Lost the play-off final. Wembley heartbreak. Gran blames the referee.' : 'Out in the play-off semi-finals. So close.';
    if (needPO) { const b = root.querySelector('#nextSeason'); b.textContent = POnow ? 'BACK TO THE PLAY-OFFS ▶' : 'TO THE PLAY-OFFS ▶'; b.onclick = () => { if (!POnow) setupPlayoffs(c, leagueTable(c).map(r => r.id)); save(); go('playoffs'); }; }
    else root.querySelector('#nextSeason').onclick = () => {
      rollWorld(c);
      // Tournament summer? England first, then the window.
      // Summer 2046: the end of the story.
      if (seasonYear() >= 2046) { c.summer = null; save(); go('finale'); return; }
      const t = tournamentFor(seasonYear()), rep = reputation(c, skillLevelExact(), age(c));
      if (t && !t.finaleOnly && !qualifiedFor(c, t.year)) message(c, 'England', `England failed to qualify for ${t.name}. The nation sulks. You get a summer off.`);
      if (t && !t.finaleOnly && qualifiedFor(c, t.year) && age(c) >= 17) {
        const caps = c.intl.caps.senior, selected = levelFor(age(c), rep, c) === 'senior' && (rep >= 58 || (caps >= 2 && rep >= 52));
        createTournament(c, t, selected, rep >= 68 ? 'start' : 'sub'); c.summer.stage = 'tournament'; save(); go('tournament'); return;
      }
      save(); openWindow();
    };
    if (c.summer && c.summer.stage === 'window') openWindow(); // came back mid-summer
    root.querySelector('#new').onclick = () => ask('Start a new career? This one goes in the bin.', 'Start again', 'Not yet').then(ok => { if (ok) { newGame(); go('start'); } });
  }
  return { mount, frame() { } };
}

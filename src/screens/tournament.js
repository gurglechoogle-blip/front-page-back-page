import { logApp } from '../sim/career.js';
// SUMMER TOURNAMENT: England at a Euros or World Cup.
import { esc } from '../engine/util.js';
import { state, save } from '../state/gameState.js';
import { club, table } from '../sim/season.js';
import { nextEngland, tournamentRecord, simulateEngland } from '../sim/international.js';
import { surname } from '../sim/life.js';

export function createTournamentScreen(root, go) {
  const c = state.career, T = c.tournament;
  function finishUp() {
    const won = T.result === 'WINNERS';
    (c.weekNews = c.weekNews || []).push({ page: 'back', headline: won ? `IT'S COME HOME! ENGLAND WIN ${T.name.toUpperCase()}` : `HEARTBREAK: ENGLAND ${T.result.toUpperCase().replace(/^[^:]+: /, '').replace(/\.$/, '')}` });
    if (T.selected && won) c.flags.tournamentWinner = true;
    c.summer.stage = 'window'; save(); go('season');
  }
  function mount() {
    const f = nextEngland(T), g = T.fixtures.filter(x => x.round === 'G'), tab = table(T.group, g);
    const res = x => x.played ? `${x.hs}-${x.as}${x.pens ? ` (${x.pens[0]}-${x.pens[1]} pens)` : ''}` : 'v';
    root.innerHTML = `<div id="weekscr"><div class="wpanel narrow">
      <h1>${esc(T.name.toUpperCase().replace(/ (\d+)$/, ' <span>$1</span>'))}</h1><div class="sub">Hosted by ${esc(T.hosts)}</div>
      <p class="verdict">${T.selected ? (T.role === 'start' ? 'You\'re in the squad, and you\'re starting.' : 'You\'re in the squad, on the bench.') : 'You didn\'t make the squad. You\'re watching from the sofa with Gran.'}</p>
      <h3>Group</h3><table class="lt small"><tr><th></th><th class="tn">Team</th><th>P</th><th>GD</th><th>Pts</th></tr>${tab.map((r, i) => `<tr class="${r.id === 'nat-eng' ? 'me' : ''}${i < 2 ? ' z-promo' : ''}"><td>${i + 1}</td><td class="tn">${esc(club(r.id).name)}</td><td>${r.p}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</table>
      <h3>England's games</h3>${T.fixtures.filter(x => x.myTeam).map(x => `<div class="row"><span>${esc(x.label.replace(T.name + ' ', ''))}</span><b>${esc(club(x.home).short)} ${res(x)} ${esc(club(x.away).short)}</b></div>`).join('')}
      ${T.alive && f ? `<div class="endBtns"><button class="btn gold big" id="play">${T.selected ? 'PLAY' : 'WATCH'}: ${esc(club(f.home === 'nat-eng' ? f.away : f.home).name)} ▶</button></div>` : `<p class="verdict">${esc(T.result === 'WINNERS' ? 'ENGLAND ARE CHAMPIONS!' : T.result)}</p><div class="endBtns"><button class="btn gold big" id="done">On to the transfer window ▶</button></div>`}
    </div></div>`;
    const play = root.querySelector('#play'), done = root.querySelector('#done');
    if (done) done.onclick = finishUp;
    if (play) play.onclick = () => {
      if (!T.selected) { simulateEngland(c); save(); mount(); return; }
      go('match', { home: club(f.home), away: club(f.away), mySide: f.home === 'nat-eng' ? 'home' : 'away', cup: !!f.knockout, bigGame: true, extraTime: true, role: T.role, stadium: f.neutral || `a stadium in ${T.hosts.split(/[,(]/)[0].replace(/ and .*/, '')}`, label: f.label, trust: .7, form: Math.max(.3, c.form / 100), playerName: c.name,
        onDone: S => { tournamentRecord(c, f, { hs: S.score.home, as: S.score.away, pens: S.pens ? [S.pens.home, S.pens.away] : null }); if (S.role !== 'none') { c.intl.caps.senior++; c.intl.goals.senior += S.my.goals; logApp(c, 'nat-eng', 'tourn', S); } save(); go('tournament'); } });
    };
    void surname;
  }
  return { mount, frame() { } };
}

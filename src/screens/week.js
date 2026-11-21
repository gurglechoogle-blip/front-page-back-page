// RESULTS: the end of a week. Your matches, the gaffer's verdict on your
// week, money in and out, results around the league and the table.
import { esc } from '../engine/util.js';
import { state, save, backup } from '../state/gameState.js';
import { club, compName, prettyDate, zone, DIVS } from '../sim/season.js';
import { nextWeek, leagueTable, resultFor } from '../sim/career.js';
import { firstWeek } from '../sim/season.js';

const money = n => (n < 0 ? '-£' : '£') + Math.abs(Math.round(n)).toLocaleString('en-GB');
const sign = n => (n > 0 ? '+' : '') + n.toFixed(1);

export function createWeekScreen(root, go) {
  const c = state.career, L = c.lastWeek;
  const $ = id => root.querySelector('#' + id);
  function mount() {
    const fx = id => c.fixtures.find(f => f.id === id);
    const mine = L.results.map(r => {
      const f = fx(r.id), res = resultFor(c, f);
      const you = r.role === 'none' ? 'Not in the squad' : `${r.role === 'sub' ? 'Off the bench' : 'Started'} · rating <b>${r.rating.toFixed(1)}</b>${r.goals ? ` · ${r.goals} goal${r.goals > 1 ? 's' : ''}` : ''}${r.assists ? ` · ${r.assists} assist${r.assists > 1 ? 's' : ''}` : ''}`;
      return `<div class="wres r${res}"><small>${esc(compName(f))} · ${prettyDate(f.date, true)}</small><b>${esc(club(f.home).name)} ${f.hs}-${f.as} ${esc(club(f.away).name)}${f.pens ? ` <small>(${f.pens[0]}-${f.pens[1]} pens)</small>` : ''}</b><span>${you}${r.approval != null ? ` · approval ${sign(r.approval)}` : ''}</span></div>`;
    }).join('') || '<p class="dim">No match for you this week.</p>';
    const trainLine = `${L.training} drill${L.training === 1 ? '' : 's'}, ${L.rests} rest${L.rests === 1 ? '' : 's'}${L.unused ? `, ${L.unused} slot${L.unused > 1 ? 's' : ''} unused` : ''}${L.approvalTraining ? ` · the gaffer noticed: approval ${sign(L.approvalTraining)}` : L.training === 1 ? ' · do two or more and the gaffer notices' : ''}`;
    const others = L.others.map(fx).map(f => `<li>${esc(club(f.home).name)} <b>${f.hs}-${f.as}</b> ${esc(club(f.away).name)}</li>`).join('');
    const t = leagueTable(c), n = t.length, i = t.findIndex(r => r.id === c.clubId);
    const show = new Set([0, 1, 2, i - 2, i - 1, i, i + 1, i + 2, n - 1].filter(x => x >= 0 && x < n));
    let last = -1; const rows = [...show].sort((a, b) => a - b).map(k => { const r = t[k], gap = k > last + 1 ? '<tr class="gap"><td colspan="5">⋯</td></tr>' : ''; last = k; return gap + `<tr class="${r.id === c.clubId ? 'me' : ''} z-${zone(c.div, k + 1, n) || ''}"><td>${k + 1}</td><td class="tn">${esc(club(r.id).name)}</td><td>${r.p}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`; }).join('');
    const bills = L.bills.filter(b => b.amount).map(b => `<div class="row"><span>${esc(b.what)}</span><b class="bad">-${money(b.amount)}</b></div>`).join('');
    root.innerHTML = `<div id="weekscr"><div class="wpanel">
      <h1>WEEK ${L.week - firstWeek() + 1} <span>RESULTS</span></h1><div class="sub">w/c ${prettyDate(L.date)} ${L.date.slice(0, 4)}</div>
      <div class="wgrid">
        <section><h3>Your matches</h3>${mine}<h3>Training</h3><p>${trainLine}</p></section>
        <section><h3>Money</h3><div class="row"><span>Wages</span><b class="good">+${money(L.wage)}</b></div>${bills}<div class="row tot"><span>Bank balance</span><b>${money(L.bank)}</b></div>
          <h3>You</h3><div class="row"><span>Manager approval</span><b>${Math.round(L.approval)}</b></div><div class="row"><span>Form</span><b>${Math.round(L.form)}</b></div><div class="row"><span>Energy</span><b>${Math.round(L.energy)}</b></div></section>
        <section><h3>${esc(DIVS[c.div].short)}</h3>${t[0].p ? `<table class="lt small"><tr><th></th><th class="tn">Team</th><th>P</th><th>GD</th><th>Pts</th></tr>${rows}</table>` : '<p class="dim">The league hasn\'t started yet.</p>'}
          ${others ? `<h3>Around the league</h3><ul class="others">${others}</ul>` : ''}</section>
      </div>
      <div class="endBtns"><button class="btn gold big" id="next">NEXT WEEK ▶</button></div>
    </div></div>`;
    $('next').onclick = () => { const more = nextWeek(c); save(); backup(); go(more ? 'hub' : 'season'); };
  }
  return { mount, frame() { } };
}

// Competitions (every table and cup run, internationals included) and your own
// stats, split by team and competition, with totals.
import { esc } from '../engine/util.js';
import { club, CAL, DIVS, zone, table, roundName } from '../sim/season.js';
import { leagueTable, myFixtures, resultFor } from '../sim/career.js';
import { compTable } from '../sim/intlSchedule.js';

const COMP = { league: 'League', facup: 'FA Cup', eflcup: 'EFL Cup', trophy: 'EFL Trophy', natcup: 'Domestic cup', ucl: 'Champions League', uel: 'Europa League', tourn: 'Summer tournament', 'intl-senior': 'Internationals', 'intl-u21': 'Internationals', 'intl-u19': 'Internationals', 'intl-u17': 'Internationals' };
const teamName = id => id === 'nat-eng' ? 'England' : /^nat-eng-u/.test(id) ? `England ${id.slice(-3).toUpperCase()}` : club(id).name;
const tbl = (rows, meId, zoneFn) => `<table class="lt small"><tr><th></th><th class="tn">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th><th title="Power rating">Pwr</th></tr>${rows.map((r, i) => `<tr class="${r.id === meId ? 'me' : ''} ${zoneFn ? 'z-' + (zoneFn(i + 1) || '') : ''}"><td>${i + 1}</td><td class="tn">${esc(club(r.id).name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td><b>${r.pts}</b></td><td class="pwr">${club(r.id).strength}</td></tr>`).join('')}</table>`;

export function showCompetitions(H, tab = 'league') {
  const c = H.c, tabs = [['league', 'League'], ['cups', 'Cups & Europe'], ['intl', 'International']];
  let body = '';
  if (tab === 'league') {
    const t = leagueTable(c);
    body = `<h3>${esc(DIVS[c.div].name)}</h3>${tbl(t, c.clubId, p => zone(c.div, p, t.length))}`;
  } else if (tab === 'cups') {
    const cups = Object.entries(c.cups || {});
    body = cups.map(([k, v]) => {
      const name = v.cupName || (CAL.cups[k] || {}).name || k, fx = myFixtures(c).filter(f => f.comp === k);
      const status = v.won ? '🏆 WINNERS' : v.alive ? `Still in: ${v.round === 'L' ? 'league phase' : v.round === 'G' ? 'group stage' : roundName({ comp: k, round: v.round })}` : `Out (${v.round === 'G' ? 'group stage' : v.round === 'L' ? 'league phase' : roundName({ comp: k, round: v.round })})`;
      let extra = '';
      if (k === 'trophy' && c.trophyGroup) extra = tbl(table(c.trophyGroup, c.fixtures.filter(f => f.comp === 'trophy' && f.round === 'G' && f.played)), v.team);
      if ((k === 'ucl' || k === 'uel') && fx.some(f => f.round === 'L')) { const lf = fx.filter(f => f.round === 'L' && f.played), pts = lf.reduce((a, f) => a + ({ W: 3, D: 1 }[resultFor(c, f)] || 0), 0); extra = `<p class="dim">League phase: ${lf.length} played, ${pts} points.</p>`; }
      const res = fx.filter(f => f.played).map(f => `<div class="row"><span>${esc(f.round ? roundName(f) : '')}: ${esc(club(f.home).short)} ${f.hs}-${f.as} ${esc(club(f.away).short)}${f.pens ? ` (${f.pens[0]}-${f.pens[1]} pens)` : ''}</span><b class="r${resultFor(c, f)}">${resultFor(c, f)}</b></div>`).join('');
      return `<h3>${esc(name)}</h3><p><b>${status}</b></p>${extra}${res}`;
    }).join('') || '<p class="dim">No cup runs this season.</p>';
  } else {
    const comps = (c.intlComps || []).slice().reverse();
    body = comps.map(x => {
      const played = x.fixtures.filter(f => f.england);
      return `<h3>${esc(x.name)}</h3>${x.type === 'nl' || x.type === 'qual' ? tbl(compTable(x), 'nat-eng', p => p <= 2 ? 'promo' : '') : ''}${x.qualified != null ? `<p class="${x.qualified ? 'good' : 'bad'}">${x.qualified ? 'England qualified.' : 'England failed to qualify.'}</p>` : ''}${played.map(f => `<div class="row"><span>${esc(f.date.slice(8))}/${esc(f.date.slice(5, 7))} ${esc(club(f.home).name)} ${f.played ? `${f.hs}-${f.as}` : 'v'} ${esc(club(f.away).name)}</span><b>${f.mine ? 'you were there' : ''}</b></div>`).join('')}`;
    }).join('') || '<p class="dim">No England fixtures yet.</p>';
    const caps = c.intl ? c.intl.caps : {};
    body = `<p class="dim">Your caps: senior ${caps.senior || 0} · U21 ${caps.u21 || 0} · U19 ${caps.u19 || 0} · U17 ${caps.u17 || 0}</p>` + body;
  }
  H.modal(`<h2>Competitions</h2><div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${k === tab ? 'on' : ''}" data-ct="${k}">${l}</button>`).join('')}</div><div class="scroll">${body}</div>`);
  H.root.querySelectorAll('[data-ct]').forEach(b => b.onclick = () => showCompetitions(H, b.dataset.ct));
}

export function showMyStats(H, season = 'all') {
  const c = H.c, log = (c.appLog || []).filter(x => season === 'all' || x.s === season), seasons = [...new Set((c.appLog || []).map(x => x.s))];
  const sum = rows => { const n = rows.length, g = rows.reduce((a, x) => a + x.g, 0), as = rows.reduce((a, x) => a + x.a, 0), rt = rows.filter(x => x.r).map(x => x.r); return { n, g, as, avg: rt.length ? (rt.reduce((a, b) => a + b, 0) / rt.length).toFixed(2) : '–' }; };
  const line = (label, s, cls = '') => `<tr class="${cls}"><td class="tn">${esc(label)}</td><td>${s.n}</td><td>${s.g}</td><td>${s.as}</td><td>${s.avg}</td></tr>`;
  const teams = [...new Set(log.map(x => x.t))];
  const rows = teams.map(t => {
    const tl = log.filter(x => x.t === t), comps = [...new Set(tl.map(x => x.c))];
    return line(teamName(t), sum(tl), 'team') + comps.map(k => line('   ' + (COMP[k] || k), sum(tl.filter(x => x.c === k)), 'sub')).join('');
  }).join('');
  const clubTotal = sum(log.filter(x => !x.t.startsWith('nat-'))), intlTotal = sum(log.filter(x => x.t.startsWith('nat-')));
  const older = c.history.filter(h => !seasons.includes(h.season));
  H.modal(`<h2>My stats</h2><div class="tabs"><button class="tab ${season === 'all' ? 'on' : ''}" data-ss="all">Career</button>${seasons.map(s => `<button class="tab ${s === season ? 'on' : ''}" data-ss="${s}">${s}</button>`).join('')}</div>
    <div class="scroll"><table class="lt small mystats"><tr><th class="tn"></th><th>Apps</th><th>Goals</th><th>Assists</th><th>Avg</th></tr>${rows || '<tr><td colspan="5" class="dim">No competitive games yet.</td></tr>'}
    ${log.length ? line('Club total', clubTotal, 'tot') + (intlTotal.n ? line('International total', intlTotal, 'tot') : '') + line('All competitions', sum(log), 'tot') : ''}</table>
    ${season === 'all' && older.length ? `<h3>Earlier seasons (before stats were split)</h3>${older.map(h => `<div class="row"><span>${esc(h.season)} · ${esc(club(h.club).name)}</span><b>${h.apps} apps · ${h.goals} goals · ${h.assists} assists</b></div>`).join('')}` : ''}</div>`);
  H.root.querySelectorAll('[data-ss]').forEach(b => b.onclick = () => showMyStats(H, b.dataset.ss));
}

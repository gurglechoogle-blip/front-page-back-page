// The calendar: a yesterday / today / tomorrow strip on the hub, and a full
// month view with fixtures and everything you've done.
import { esc } from '../engine/util.js';
import { weekPlan, iconFor, addDays } from '../sim/calendar.js';
import { club, compName, weekStart } from '../sim/season.js';
import { myFixtures, myTeamIn } from '../sim/career.js';
import { friend } from '../sim/social.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const nice = d => { const x = new Date(d + 'T12:00:00Z'); return `${DOW[x.getUTCDay()]} ${x.getUTCDate()} ${MONTHS[x.getUTCMonth()].slice(0, 3)}`; };
const names = id => (friend(id) || { name: id }).name;

/** Everything on a date: diary, this week's plan, and unplayed fixtures. */
function entries(c, d, plan) {
  const out = [...((c.diary || {})[d] || []), ...((plan && plan[d]) || [])];
  myFixtures(c).filter(f => f.date === d && !f.played).forEach(f => { const mt = myTeamIn(c, f) || c.clubId, opp = club(f.home === mt ? f.away : f.home); out.push({ t: 'match', text: `${compName(f)}: ${f.home === mt ? 'v' : '@'} ${opp.name}`, upcoming: true }); });
  return out;
}
function thisWeek(c) { const ws = weekStart(c.week), fx = myFixtures(c).filter(f => f.date >= ws && f.date <= addDays(ws, 6)); return weekPlan(c, ws, fx.map(f => f.date), names, fx.length > 0 && fx.every(f => f.played)); }

export function stripHTML(c) {
  const { plan, today } = thisWeek(c);
  const cell = (d, label, cls) => { const e = entries(c, d, plan); return `<div class="cday ${cls}"><small>${label} · ${nice(d)}</small>${e.length ? e.slice(0, 3).map(x => `<span class="${x.t === 'match' ? 'cm-match' : ''}">${iconFor(x.t)} ${esc(x.text)}</span>`).join('') : `<span class="dim">${cls === 'today' ? 'Nothing yet. Use a time slot.' : 'Nothing'}</span>`}</div>`; };
  return `<div class="calstrip" id="calstrip" title="Open the calendar">${cell(addDays(today, -1), 'Yesterday', 'yday')}${cell(today, 'Today', 'today')}${cell(addDays(today, 1), 'Tomorrow', 'tmrw')}<b class="calopen">📅</b></div>`;
}

/** Full month view in the hub's modal. H: { c, modal, root } */
export function showCalendar(H, ym) {
  const c = H.c, { plan, today } = thisWeek(c);
  ym = ym || today.slice(0, 7);
  const [y, m] = ym.split('-').map(Number), first = `${ym}-01`, startDow = (new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push('<div class="mcell empty"></div>');
  for (let d = 1; d <= daysIn; d++) {
    const date = `${ym}-${String(d).padStart(2, '0')}`, e = entries(c, date, plan);
    cells.push(`<div class="mcell ${date === today ? 'today' : ''} ${e.some(x => x.t === 'match') ? 'match' : ''}"><b>${d}</b>${e.map(x => `<span class="${x.upcoming ? 'up' : ''}">${iconFor(x.t)} ${esc(x.text)}</span>`).join('')}</div>`);
  }
  const shift = k => { const x = new Date(Date.UTC(y, m - 1 + k, 1)); return x.toISOString().slice(0, 7); };
  H.modal(`<h2>Calendar</h2><div class="calnav"><button class="btn small" id="cprev">◀</button><b>${MONTHS[m - 1]} ${y}</b><button class="btn small" id="cnext">▶</button><button class="btn small" id="ctoday">Today</button></div>
    <div class="mgrid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="mhead">${d}</div>`).join('')}${cells.join('')}</div>
    <p class="dim small">Fixtures, results and everything you did. At least 60 hours between your games: play twice in three days and you'll be rested.</p>`);
  const q = s => H.root.querySelector(s);
  q('#cprev').onclick = () => showCalendar(H, shift(-1)); q('#cnext').onclick = () => showCalendar(H, shift(1)); q('#ctoday').onclick = () => showCalendar(H);
}

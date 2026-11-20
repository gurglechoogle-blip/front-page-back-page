// THE HUB: your week at a glance. Centre: you in club kit, the week and the
// gaffer's approval. Left: career stats and skills. Right: money and honour.
// Top: next fixture, time slots, phone. Bottom: five category buttons.
import { W, H, setCam } from '../engine/camera.js';
import { setCtx, drawBackground, drawPerson } from '../engine/draw.js';
import { esc } from '../engine/util.js';
import { clock } from '../engine/clock.js';
import { playerKitFrom } from '../engine/kits.js';
import { SKILLS } from '../moments/index.js';
import { state, save, skillLevel } from '../state/gameState.js';
import {
  club, compName, prettyDate, weekStart, DIVS, CAL, zone, table, roundName,
} from '../sim/season.js';
import {
  nextFixture, weekFixtures, slotsLeft, slotsTotal, isPreseason, unread, leagueTable, avgRating, netWorth, honourBadge,
  age, myFixtures, myTeamIn, resultFor, logRest, startMatchday, selection, playHeadless, recordMatch, finishWeek, matchParams, weeklyBills,
} from '../sim/career.js';
import M from '../data/messages.json';
import { playFixture } from './flow.js';
import { exportSave, importSave } from '../state/gameState.js';

const MENUS = {
  football: { label: 'Football', icon: '⚽' },
  life: { label: 'Life', icon: '🏠', soon: ['Partner', 'Family', 'Friends', 'Nights out', 'Holidays'] },
  money: { label: 'Money', icon: '💷', soon: ['Bank & loans', 'Property & shopping', 'Staff', 'Businesses & merch'] },
  casino: { label: 'Casino', icon: '🎲', soon: ['Poker', 'Blackjack'] },
  fame: { label: 'Fame', icon: '⭐', soon: ['Social media', 'Press', 'Community & charity', 'Achievements'] },
};
const money = n => (n < 0 ? '-£' : '£') + Math.abs(Math.round(n)).toLocaleString('en-GB');
const oppOf = (c, f) => { const me = myTeamIn(c, f); return club(f.home === me ? f.away : f.home); };
const ha = (c, f) => f.neutral ? 'N' : f.home === myTeamIn(c, f) ? 'H' : 'A';

export function createHubScreen(root, go, params = {}) {
  const c = state.career, me = club(c.clubId), kit = playerKitFrom(me.home);
  let pctx, openMenu = null;
  const $ = id => root.querySelector('#' + id);

  function mount() {
    root.innerHTML = `
<div id="hubscr">
  <div class="htop">
    <div class="nextfx" id="nextfx"></div>
    <div class="slots" id="slots"></div>
    <button class="phone" id="phone" title="Phone"><svg viewBox="0 0 24 36" width="22" height="32"><rect x="1" y="1" width="22" height="34" rx="4" fill="#23272d" stroke="#cfd5db" stroke-width="2"/><rect x="4" y="5" width="16" height="22" rx="1" fill="#6fb3e0"/><circle cx="12" cy="31" r="2" fill="#cfd5db"/></svg><em id="unread"></em></button>
  </div>
  <div class="hmain">
    <aside class="hcol" id="left"></aside>
    <div class="hcentre">
      <div class="weekbadge" id="weekbadge"></div>
      <canvas id="pc" width="${W}" height="${H}"></canvas>
      <div class="meters" id="meters"></div>
    </div>
    <aside class="hcol" id="right"></aside>
  </div>
  <div class="hbar" id="hbar">${Object.entries(MENUS).map(([k, m]) => `<div class="hbtn-wrap"><button class="btn hbtn" data-m="${k}"><span>${m.icon}</span>${m.label}<em class="badge" id="badge-${k}"></em></button><div class="menu hidden" id="menu-${k}"></div></div>`).join('')}</div>
  <div class="hfoot"><span id="saved">Saved automatically</span> · <a href="#" id="dl">Download save file</a> · <a href="#" id="ul">Load save file</a><input type="file" id="ulf" accept=".json,application/json" hidden> · <a href="#" id="newCareer">Start a new career</a></div>
  <div id="modal" class="modal hidden"><div class="mbox"><button class="mclose" id="mclose">✕</button><div id="mbody"></div></div></div>
  <div id="toast" class="toast"></div>
</div>`;
    pctx = $('pc').getContext('2d');
    root.querySelectorAll('.hbtn').forEach(b => b.onclick = e => { e.stopPropagation(); toggleMenu(b.dataset.m); });
    $('hubscr').onclick = () => toggleMenu(null);
    $('phone').onclick = e => { e.stopPropagation(); showPhone(); };
    $('nextfx').onclick = e => { e.stopPropagation(); matchday(); };
    $('mclose').onclick = closeModal; $('modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
    $('newCareer').onclick = e => { e.preventDefault(); modal(`<h2>Start a new career?</h2><p>This one will be gone for good. Gran will be devastated.</p><div class="endBtns"><button class="btn red" id="reallyNew">Yes, start again</button><button class="btn" id="keep">Keep this one</button></div>`); $('reallyNew').onclick = () => { state.career = null; save(); go('start'); }; $('keep').onclick = closeModal; };
    $('dl').onclick = e => { e.preventDefault(); exportSave(); toast('Save file downloaded. Keep it somewhere safe, like under the mattress.'); };
    $('ul').onclick = e => { e.preventDefault(); $('ulf').click(); };
    $('ulf').onchange = async e => { const f = e.target.files[0]; if (!f) return; const ok = await importSave(f); if (ok) location.reload(); else toast('That file isn\'t a Front Page, Back Page save.'); };
    setCam('def'); render();
    if (params.teamsheet) teamSheet(params.teamsheet);
    else if (c.matchday && c.matchday.queue.length) toast('Matchday in progress. Click the next fixture to carry on.');
  }

  /* ---------- panels ---------- */
  function render() {
    const nf = nextFixture(c), wf = weekFixtures(c), sl = slotsLeft(c), st = c.stats;
    $('nextfx').innerHTML = nf
      ? `<small>${wf.length ? 'THIS WEEK' : 'NEXT FIXTURE'} · ${esc(compName(nf))}</small><b>${esc(oppOf(c, nf).name)} (${ha(c, nf)})</b><span>${prettyDate(nf.date, true)}${wf.length ? ' · <i>Play ▶</i>' : ''}</span>`
      : `<small>NO FIXTURES LEFT</small><b>Season's done</b>`;
    $('slots').innerHTML = `<small>TIME SLOTS</small><div>${Array.from({ length: slotsTotal(c) }, (_, i) => `<i class="${i < sl ? 'on' : ''}"></i>`).join('')}</div><span>${sl} left${isPreseason(c) ? ' · pre-season' : ''}</span>`;
    const u = unread(c); $('unread').textContent = u || ''; $('unread').style.display = u ? '' : 'none';
    $('badge-football').textContent = wf.length ? wf.length : ''; $('badge-football').style.display = wf.length ? '' : 'none';
    root.querySelectorAll('.badge').forEach(b => { if (!b.textContent) b.style.display = 'none'; });
    $('weekbadge').innerHTML = `<b>WEEK ${c.week + 1}</b> · w/c ${prettyDate(weekStart(c.week))} ${weekStart(c.week).slice(0, 4)}${isPreseason(c) ? ' · PRE-SEASON' : ''}`;
    const bar = (label, v, cls) => `<div class="meter ${cls || ''}"><span>${label}</span><div class="bar"><i style="width:${Math.round(v)}%"></i></div><b>${Math.round(v)}</b></div>`;
    $('meters').innerHTML = bar('Manager approval', c.approval, 'appr') + `<div class="two">${bar('Form', c.form, 'form')}${bar('Energy', c.energy, 'energy')}</div>`;
    const avg = avgRating(c);
    $('left').innerHTML = `<h2>${esc(c.name)}</h2><div class="sub2">${age(c)} · Striker · ${esc(me.name)}</div>
      <h3>Career</h3>${row('Appearances', st.apps + (st.subs ? ` <small>(${st.subs} sub)</small>` : ''))}${row('Goals', st.goals)}${row('Assists', st.assists)}${row('Avg rating', avg ? avg.toFixed(2) : '–')}${st.u21 ? row('U21 games', st.u21) : ''}
      <div class="lvl">${skillLevel()}%</div><div class="lvlcap">Skill level</div>
      <h3>Skills</h3>${SKILLS.map(([k, l]) => { const v = state.profile.skills[k]; return `<div class="row" style="border:0"><span>${l}</span><b>${v}</b></div><div class="bar"><i style="width:${Math.min(100, v / 120)}%"></i></div>`; }).join('')}`;
    const bills = weeklyBills(c).reduce((a, b) => a + b.amount, 0), hb = honourBadge(c.honour);
    $('right').innerHTML = `<h2>Money</h2>${row('Wages', money(c.contract.wage) + '/wk')}${row('Bills', money(bills) + '/wk')}${row('Bank balance', money(c.bank))}${row('Net worth', money(netWorth(c)))}
      <h3>Honour</h3><div class="honour h${Math.min(4, Math.floor(c.honour / 20.01))}"><div class="medal">${Math.round(c.honour)}</div><b>${hb}</b></div>
      <h3>Club</h3>${row('Club', esc(me.name))}${row('League', esc(DIVS[c.div].short))}${row('Position', posText())}${row('Deal', esc(c.contract.label))}`;
  }
  const row = (l, v) => `<div class="row"><span>${l}</span><b>${v}</b></div>`;
  function posText() { const t = leagueTable(c), i = t.findIndex(r => r.id === c.clubId); return t[0].p ? `${i + 1}${suffix(i + 1)} of ${t.length}` : '–'; }
  const suffix = n => (n % 100 > 10 && n % 100 < 14) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';

  /* ---------- menus ---------- */
  function toggleMenu(k) {
    root.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
    if (!k || k === openMenu) { openMenu = null; return; }
    openMenu = k; const el = $('menu-' + k);
    const items = k === 'football' ? footballItems() : MENUS[k].soon.map(s => ({ label: s, soon: true }));
    el.innerHTML = `<h4>${MENUS[k].label}</h4>` + items.map((it, i) => `<button data-i="${i}" class="${it.soon ? 'soon' : ''}${it.main ? ' main' : ''}">${it.label}${it.soon ? '<small>coming soon</small>' : it.note ? `<small>${it.note}</small>` : ''}</button>`).join('');
    el.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); const it = items[+b.dataset.i]; toggleMenu(null); if (it.soon) toast(`${it.label}: coming soon. Your agent says it's "in development". He hasn't got an agent yet either.`); else it.go(); });
    el.classList.remove('hidden');
  }
  function footballItems() {
    const wf = weekFixtures(c), sl = slotsLeft(c);
    return [
      { label: wf.length ? `▶ Matchday: ${esc(oppOf(c, wf[0]).name)} (${ha(c, wf[0])})` : '▶ End the week', note: wf.length ? esc(compName(wf[0])) : 'No match this week', main: true, go: matchday },
      { label: 'Training', note: `${sl} slot${sl === 1 ? '' : 's'} left`, go: trainingPicker },
      { label: 'Rest', note: 'Uses a slot, +energy', go: rest },
      { label: 'Fixtures & results', go: showFixtures },
      { label: 'League table', go: showTable },
      { label: 'Contract & transfers', go: showContract },
      { label: 'Agent', go: () => modal(`<h2>Agent</h2><p>You haven't got one. At 16, agents are mostly blokes in car parks with lanyards they printed themselves.</p><p class="dim">Proper agents (and their hidden motives) are coming in a later update.</p>`) },
    ];
  }

  /* ---------- actions ---------- */
  function trainingPicker() {
    if (slotsLeft(c) <= 0) return toast('No time slots left this week. Time for the match.');
    modal(`<h2>Training</h2><p class="dim">One drill uses one time slot. Coaching at ${esc(me.name)}: ${c.contract.coaching > 1 ? 'top class' : c.contract.coaching < 1 ? 'well-meaning' : 'decent'} (x${c.contract.coaching} skill points).</p>
      <div class="grid">${SKILLS.map(([k, , t]) => `<button class="btn" data-k="${k}">${t}<small>Skill ${state.profile.skills[k]}</small></button>`).join('')}</div>
      <div class="endBtns"><button class="btn gold" id="restBtn">Rest instead<small>+energy</small></button></div>`);
    root.querySelectorAll('#mbody .grid button').forEach(b => b.onclick = () => go('training', { drill: b.dataset.k, career: true }));
    $('restBtn').onclick = () => { closeModal(); rest(); };
  }
  function rest() {
    if (slotsLeft(c) <= 0) return toast('No time slots left this week.');
    logRest(c); save(); render(); toast(pickLine(['Feet up. Box set. Energy restored.', 'A nap and a Pot Noodle. Bliss.', 'Ice bath, then the sofa. Mum brought biscuits.']));
  }
  function matchday() {
    if (!nextFixture(c) && !weekFixtures(c).length && c.seasonOver) return go('season');
    const sl = slotsLeft(c);
    if (sl > 0 && !c.matchday) {
      modal(`<h2>Unused time slots</h2><p>You've still got <b>${sl}</b> slot${sl === 1 ? '' : 's'} this week. Unused slots annoy the gaffer, and he's already annoyed about the fishing season.</p>
        <div class="endBtns"><button class="btn red" id="goAnyway">Go anyway</button><button class="btn" id="useThem">Use them</button></div>`);
      $('goAnyway').onclick = () => { closeModal(); proceed(); }; $('useThem').onclick = closeModal;
      return;
    }
    proceed();
  }
  function proceed() {
    const md = startMatchday(c); save();
    const id = md.queue[0];
    if (!id) { finishWeek(c); save(); go('week'); return; }
    teamSheet(id);
  }
  function teamSheet(id) {
    const f = c.fixtures.find(x => x.id === id), md = c.matchday;
    const role = md.sel[id] || (md.sel[id] = selection(c, f)); save();
    const mine = club(myTeamIn(c, f));
    modal(`<h2 class="ts">TEAM SHEET</h2><div class="tsfix"><small>${esc(compName(f))} · ${prettyDate(f.date, true)}${f.neutral ? ' · ' + esc(f.neutral) : ''}</small>
      <b>${esc(club(f.home).name)} v ${esc(club(f.away).name)}</b></div>
      <p class="tsrole ${role}">${esc(M.selection[role])}</p>
      ${mine.id.endsWith('-u21') ? `<p class="dim">It's the under-21s. Proper game though: the ${esc(CAL.cups.trophy.short)} puts you up against men with mortgages.</p>` : ''}
      <div class="endBtns">${role === 'none' ? `<button class="btn" id="watch">See how they get on</button>` : `<button class="btn gold" id="toMatch">TO THE MATCH ▶</button>`}</div>`, true);
    if (role === 'none') {
      $('watch').onclick = () => {
      const sim = playHeadless(c, f), S = sim.summary(); recordMatch(c, f, S); save();
      const sc = `${club(f.home).name} ${S.score.home}-${S.score.away} ${club(f.away).name}${S.pens ? ` (${S.pens.home}-${S.pens.away} pens)` : ''}`;
      modal(`<h2>FULL TIME</h2><p class="bigscore">${esc(sc)}</p><p class="dim">You watched from the stand. ${S.result === 'W' ? 'They won without you. Hmm.' : S.result === 'L' ? 'They lost. You could have made a difference. Probably.' : 'A draw. Nobody enjoyed it.'}</p><div class="endBtns"><button class="btn gold" id="cont">Continue</button></div>`, true);
        $('cont').onclick = () => { closeModal(); proceed(); };
      };
    } else {
      $('toMatch').onclick = () => playFixture(go, f, role);
    }
  }

  /* ---------- info pop-ups ---------- */
  function showFixtures() {
    const rows = myFixtures(c).map(f => {
      const me2 = myTeamIn(c, f), res = resultFor(c, f);
      const sc = f.played ? `${f.home === me2 ? f.hs : f.as}-${f.home === me2 ? f.as : f.hs}${f.pens ? ' p' : ''}` : '';
      const you = f.played ? (f.role === 'none' ? '<i class="dim">not picked</i>' : f.rating != null ? `${f.role === 'sub' ? 'sub · ' : ''}${f.rating.toFixed(1)}${f.myGoals ? ' · ' + '⚽'.repeat(f.myGoals) : ''}` : '') : '';
      return `<tr class="${f.played ? 'p' : ''}${weekFixtures(c).includes(f) ? ' now' : ''}"><td>${prettyDate(f.date, true)}</td><td class="comp c-${f.comp}">${esc(compName(f))}</td><td>${esc(oppOf(c, f).name)}${me2.endsWith('-u21') ? ' <small>(U21)</small>' : ''}</td><td>${ha(c, f)}</td><td class="res r${res}">${res ? res + ' ' + sc : ''}</td><td>${you}</td></tr>`;
    }).join('');
    modal(`<h2>Fixtures & results</h2><div class="scroll"><table class="fx">${rows}</table></div>`);
    const now = root.querySelector('.fx tr.now') || root.querySelector('.fx tr:not(.p)'); if (now) now.scrollIntoView({ block: 'center' });
  }
  function showTable() {
    const t = leagueTable(c), n = t.length;
    const rows = t.map((r, i) => `<tr class="${r.id === c.clubId ? 'me' : ''} z-${zone(c.div, i + 1, n) || ''}"><td>${i + 1}</td><td class="tn">${esc(club(r.id).name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td><b>${r.pts}</b></td><td class="frm">${r.form.slice(-5).map(x => `<i class="f${x}">${x}</i>`).join('')}</td></tr>`).join('');
    let extra = '';
    if (c.trophyGroup) {
      const g = table(c.trophyGroup, c.fixtures.filter(f => f.comp === 'trophy' && f.round === 'G'));
      extra = `<h3>${esc(CAL.cups.trophy.short)} group</h3><table class="lt small"><tr><th></th><th class="tn">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>${g.map((r, i) => `<tr class="${r.id === c.cups.trophy.team ? 'me' : ''}${i < 2 ? ' z-promo' : ''}"><td>${i + 1}</td><td class="tn">${esc(club(r.id).name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</table>`;
    }
    const cups = Object.entries(c.cups).map(([k, v]) => `<span class="cupst ${v.won ? 'won' : v.alive ? 'alive' : 'out'}">${esc(CAL.cups[k].short)}: ${v.won ? 'WINNERS' : v.alive ? 'in it, ' + (v.round === 'G' ? 'group stage' : roundName({ comp: k, round: v.round })) : 'out'}</span>`).join('');
    modal(`<h2>${esc(DIVS[c.div].name)}</h2><div class="scroll"><table class="lt"><tr><th></th><th class="tn">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>F</th><th>A</th><th>GD</th><th>Pts</th><th>Form</th></tr>${rows}</table>${extra}</div><div class="cups">${cups}</div>`);
    const mine = root.querySelector('.lt tr.me'); if (mine) mine.scrollIntoView({ block: 'center' });
  }
  function showContract() {
    const k = c.contract, star = n => '★'.repeat(n) + '☆'.repeat(5 - n);
    modal(`<h2>Contract</h2>${row('Club', esc(me.name))}${row('Deal', esc(k.kind) + ' · ' + esc(k.label))}${row('Wages', money(k.wage) + ' a week')}${row('Signing-on fee', money(k.signingFee))}${row('Runs until', prettyDate(k.until) + ' 2028')}${row('Coaching', 'x' + k.coaching)}${row('Prestige', star(k.prestige))}${row('Housing', k.housing ? 'Club digs, free' : 'At home with Mum')}
      <h3>Transfers</h3><p class="dim">You're 16. Nobody's buying yet. Loans, first pro contracts and transfers are coming in a later update.</p>`);
  }
  function showPhone() {
    const list = c.inbox.map(m => `<div class="msg ${m.read ? '' : 'new'}"><b>${esc(m.from)}</b><span>Week ${m.week + 1}</span><p>${esc(m.text)}</p></div>`).join('') || '<p class="dim">No messages. Nobody loves you yet.</p>';
    modal(`<h2>Phone</h2><div class="scroll phone-list">${list}</div>`);
    c.inbox.forEach(m => m.read = true); save(); render();
  }

  /* ---------- modal / toast ---------- */
  function modal(html, noClose) { $('mbody').innerHTML = html; $('modal').classList.remove('hidden'); $('mclose').style.display = noClose ? 'none' : ''; }
  function closeModal() { $('modal').classList.add('hidden'); }
  let toastT = 0;
  function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 3200); }
  const pickLine = a => a[Math.floor(Math.random() * a.length)];

  /* ---------- centre figure ---------- */
  function frame() {
    setCtx(pctx); drawBackground();
    const t = clock.now, sway = Math.sin(t * 1.6) * .03;
    drawPerson({ x: 0, z: .1, kit, facing: 'front', armL: .25 + sway, armR: -.25 + sway, legL: .06, legR: -.06, ang: Math.sin(t * .8) * .015 });
  }

  return { mount, frame };
}

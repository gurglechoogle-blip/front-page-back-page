import { ask } from '../engine/ask.js';
// THE HUB: your week at a glance. Centre: you in club kit, the week and the
// gaffer's approval. Left: career stats and skills. Right: money and honour.
// Top: next fixture, time slots, phone. Bottom: five category buttons.
import { W, H, setCam } from '../engine/camera.js';
import { setCtx, drawBackground, drawPerson, setVenue } from '../engine/draw.js';
import { trainingVenue } from './venue.js';
import { esc } from '../engine/util.js';
import { clock } from '../engine/clock.js';
import { playerKitFrom } from '../engine/kits.js';
import { SKILLS } from '../moments/index.js';
import { state, save, skillLevelText, SKILL_MAX , newGame } from '../state/gameState.js';
import {
  club, compName, prettyDate, weekStart, DIVS, CAL, zone, table, roundName, addDays,
} from '../sim/season.js';
import {
  nextFixture, weekFixtures, slotsLeft, slotsTotal, todaysFixture, advanceDay, dayDate, consumeDays, isPreseason, unread, leagueTable, avgRating, netWorth, honourBadge,
  age, myFixtures, myTeamIn, resultFor, seasonWeek, logRest, startMatchday, selection, playHeadless, recordMatch, finishWeek, matchParams, weeklyBills,
} from '../sim/career.js';
import M from '../data/messages.json';
import { playFixture } from './flow.js';
import { METERS, meter, EVENTS, chooseEvent, answerPress, paperByN, framePage, applyEffects } from '../sim/life.js';
import { paperHTML, paperPhotos } from './paper.js';
import { showBank, showShop, showProperty, showDebt, showBorrow } from './moneyUI.js';
import { FR, friend, hangOut, nightsFor, nightOut, chatPrompt, chatAnswer } from '../sim/social.js';
import CZ from '../data/casino.json';
import { drawClipFrame, clipLength } from '../engine/replay.js';
import { showAgents, showWindow, showDeadline } from './contractUI.js';
import { LK, lookFields, haircut, tattoo } from '../sim/looks.js';
import { L2, holiday, inDisgrace, memoir, interviewResult } from '../sim/trouble.js';
import { ACH, achCount } from '../sim/achievements.js';
import { clause } from '../sim/contracts.js';
import { stripHTML, showCalendar, todayDate } from './calendarUI.js';
import { headlineFor } from '../sim/headlines.js';
import { welcomeHTML } from './welcome.js';
import { avatar } from '../engine/avatar.js';
import { showCompetitions, showMyStats } from './statsUI.js';
import { ACTIVITIES, available as injAvail, doActivity, longInjury } from '../sim/injuryLife.js';
import { requestsFor, cantAsk, odds, ask as askGaffer, raiseOffer } from '../sim/gaffer.js';
import { endLoan as endLoanNow, moveClub } from '../sim/transfers.js';
import { managerFor } from '../sim/managers.js';
import { showTalks } from './contractUI.js';
import { inviteText, inviteFrom, inviteData, acceptInvite, declineInvite } from '../sim/invites.js';
import { showSocial, showTroll, showCommunity, showInvite, showStaff, showBusiness } from './fameUI.js';
import { reputation, inWindow, agentOf } from '../sim/transfers.js';
import { skillLevelExact } from '../state/gameState.js';
import { MOMENTS } from '../moments/index.js';
import { PD, STAGES, candidates, startDating, date, gift, textThem, breakUp, maybeMeet, meetScene, meetTries, tryMeet } from '../sim/partner.js';
import { exportSave, importSave } from '../state/gameState.js';

const MENUS = {
  football: { label: 'Football', icon: '⚽' },
  life: { label: 'Life', icon: '🏠', soon: [] },
  money: { label: 'Money', icon: '💷', soon: [] },
  casino: { label: 'Casino', icon: '🎲', soon: [] },
  fame: { label: 'Fame', icon: '⭐', soon: [] },
};
const money = n => (n < 0 ? '-£' : '£') + Math.abs(Math.round(n)).toLocaleString('en-GB');
const oppOf = (c, f) => { const me = myTeamIn(c, f); return club(f.home === me ? f.away : f.home); };
const ha = (c, f) => f.neutral ? 'N' : f.home === myTeamIn(c, f) ? 'H' : 'A';

const MEDAL = { bronze: '🥉', silver: '🥈', gold: '🥇' }, TIER = { bronze: '#c98b4b', silver: '#c0c7cf', gold: '#ffc928' };
export function createHubScreen(root, go, params = {}) {
  const c = state.career, me = club(c.clubId), kit = Object.assign(playerKitFrom(me.home), lookFields(c, age(c)));
  let pctx, openMenu = null;
  const $ = id => root.querySelector('#' + id);

  function mount() {
    root.innerHTML = `
<div id="hubscr">
  <div class="htop">
    <div class="nextfx" id="nextfx"></div>
    <div class="slots" id="slots"></div>
    <button class="hlbox" id="paperbtn" title="Today's paper"><small>📰 THE WEEKLY SPLASH · <span id="hldate"></span></small><b id="hline"></b></button>
    <button class="phone" id="phone" title="Phone"><svg viewBox="0 0 24 36" width="22" height="32"><rect x="1" y="1" width="22" height="34" rx="4" fill="#23272d" stroke="#cfd5db" stroke-width="2"/><rect x="4" y="5" width="16" height="22" rx="1" fill="#6fb3e0"/><circle cx="12" cy="31" r="2" fill="#cfd5db"/></svg><em id="unread"></em></button>
  </div>
  <div class="hmain">
    <aside class="hcol" id="left"></aside>
    <div class="hcentre">
      <div class="weekbadge" id="weekbadge"></div>
      <canvas id="pc" width="${W}" height="${H}"></canvas>
      <div id="calbox"></div>
      <div class="meters" id="meters"></div>
    </div>
    <div class="rcol"><aside class="hcol" id="right"></aside><div id="contbox"></div></div>
  </div>
  <div class="hbar" id="hbar">${Object.entries(MENUS).map(([k, m]) => `<div class="hbtn-wrap"><button class="btn hbtn" data-m="${k}"><span>${m.icon}</span>${m.label}<em class="badge" id="badge-${k}"></em></button><div class="menu hidden" id="menu-${k}"></div></div>`).join('')}</div>
  <div class="hfoot"><span id="saved">Saved automatically</span> · <a href="#" id="dl">Download save file</a> · <a href="#" id="ul">Load save file</a><input type="file" id="ulf" accept=".json,application/json" hidden> · <a href="#" id="newCareer">Start a new career</a></div>
  <div id="modal" class="modal hidden"><div class="mbox"><button class="mclose" id="mclose">✕</button><div id="mbody"></div></div></div>
  <div id="toast" class="toast"></div>
</div>`;
    pctx = $('pc').getContext('2d'); setVenue(trainingVenue(c.clubId));
    root.querySelectorAll('.hbtn').forEach(b => b.onclick = e => { e.stopPropagation(); toggleMenu(b.dataset.m); });
    $('hubscr').onclick = () => toggleMenu(null);
    $('phone').onclick = e => { e.stopPropagation(); showPhone(); };
    $('paperbtn').onclick = e => { e.stopPropagation(); const td = todayDate(c), H0 = headlineFor(c, td); modal(`<div class="paper front"><div class="mast"><b>THE WEEKLY SPLASH</b><span>${esc(prettyDate(td))}</span></div><h1 class="ph">${esc(H0.h)}</h1><p class="psub" style="padding:0 16px 14px">${esc(H0.sub)}</p></div><div class="endBtns">${c.papers.length ? '<button class="btn gold" id="latest">This week\'s full paper</button>' : ''}<button class="btn" id="arch">All issues</button></div>`); if ($('latest')) $('latest').onclick = () => showPaper(c.papers[c.papers.length - 1].n); $('arch').onclick = showArchive; };
    $('nextfx').onclick = e => { e.stopPropagation(); matchday(); };
    $('mclose').onclick = closeModal; $('modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
    $('newCareer').onclick = e => { e.preventDefault(); modal(`<h2>Start a new career?</h2><p>This one will be gone for good. Gran will be devastated.</p><div class="endBtns"><button class="btn red" id="reallyNew">Yes, start again</button><button class="btn" id="keep">Keep this one</button></div>`); $('reallyNew').onclick = () => { newGame(); go('start'); }; $('keep').onclick = closeModal; };
    $('dl').onclick = e => { e.preventDefault(); exportSave(); toast('Save file downloaded. Keep it somewhere safe, like under the mattress.'); };
    $('ul').onclick = e => { e.preventDefault(); $('ulf').click(); };
    $('ulf').onchange = async e => { const f = e.target.files[0]; if (!f) return; const ok = await importSave(f); if (ok) location.reload(); else toast('That file isn\'t a Front Page, Back Page save.'); };
    setCam('def'); render();
    // First day: the head of development's talk.
    if (!c.flags.welcomeTalk) { c.flags.welcomeTalk = true; save(); modal(welcomeHTML(c, true) + '<div class="endBtns"><button class="btn gold" id="gotit">Got it, boss</button></div>'); $('gotit').onclick = () => { closeModal(); runPending(() => {}); }; return; }
    // Monday's paper, events and press conferences come first.
    runPending(() => {
      if (params.teamsheet) teamSheet(params.teamsheet);
      else if (todaysFixture(c)) toast('Match day! Press "To the match" when you\'re ready.');
    });
  }

  /* ---------- panels ---------- */
  function render() {
    consumeDays(c);
    showAchToasts();
    const nf = nextFixture(c), wf = weekFixtures(c), sl = slotsLeft(c), st = c.stats;
    $('nextfx').innerHTML = nf
      ? `<small>${wf.length ? 'THIS WEEK' : 'NEXT FIXTURE'} · ${esc(compName(nf))}</small><b>${esc(oppOf(c, nf).name)} (${ha(c, nf)})</b><span>${prettyDate(nf.date, true)}${wf.length ? ' · <i>Play ▶</i>' : ''}</span>`
      : `<small>NO FIXTURES LEFT</small><b>Season's done</b>`;
    { const ws = weekStart(c.week), D = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], tf = todaysFixture(c), used = c.dayUsed === (c.day || 0);
      $('slots').innerHTML = `<small>${esc(prettyDate(dayDate(c), true).toUpperCase())}${isPreseason(c) ? ' · PRE-SEASON' : ''}</small><div class="days">${D.map((d, i) => { const ds = addDays(ws, i), m = weekFixtures(c).some(f => f.date === ds); return `<i class="${i < (c.day || 0) ? 'past' : i === (c.day || 0) ? 'today' : ''} ${m ? 'mday' : ''}">${m ? '⚽' : d}</i>`; }).join('')}</div>
        <span>${tf ? 'Match day!' : used ? 'Done for today' : 'Free day: do one thing'}</span>`;
      $('contbox').innerHTML = `<button class="btn gold bigcont" id="dayCont"><b>${tf ? 'TO THE MATCH' : (c.day || 0) >= 6 ? 'END WEEK' : 'CONTINUE'} ▶</b><small>${tf ? esc(oppOf(c, tf).name) + ' (' + ha(c, tf) + ')' : (c.day || 0) >= 6 ? 'See the week\'s results' : 'On to ' + esc(prettyDate(addDays(dayDate(c), 1), true))}</small></button>`;
      $("dayCont").onclick = e => { e.stopPropagation(); continueDay(); }; }
    const u = unread(c); $('unread').textContent = u || ''; $('unread').style.display = u ? '' : 'none';
    { const td = todayDate(c), H0 = headlineFor(c, td); $('hline').textContent = H0.h; $('hldate').textContent = prettyDate(td); $('paperbtn').classList.toggle('mine', H0.mine); }
    $('badge-football').textContent = wf.length ? wf.length : ''; $('badge-football').style.display = wf.length ? '' : 'none';
    root.querySelectorAll('.badge').forEach(b => { if (!b.textContent) b.style.display = 'none'; });
    $('weekbadge').innerHTML = `<b>${esc(CAL.season)} · WEEK ${seasonWeek(c)}</b> · w/c ${prettyDate(weekStart(c.week))} ${weekStart(c.week).slice(0, 4)}${isPreseason(c) ? ' · PRE-SEASON' : ''}`;
    $('calbox').innerHTML = stripHTML(c); $('calstrip').onclick = () => showCalendar(MH);
    const bar = (label, v, cls) => `<div class="meter ${cls || ''}"><span>${label}</span><div class="bar"><i style="width:${Math.round(v)}%"></i></div><b>${Math.round(v)}</b></div>`;
    $('meters').innerHTML = bar('Manager approval', c.approval, 'appr') + `<div class="two">${bar('Form', c.form, 'form')}${bar('Energy', c.energy, 'energy')}</div>`;
    const avg = avgRating(c);
    $('left').innerHTML = `<h2>${esc(c.name)}</h2><div class="sub2">${age(c)} · Striker · ${esc(me.name)}</div>
      ${c.hometown ? `<div class="sub2">From ${esc(c.hometown)} · ${esc(club(c.boyhood).name)} fan</div>` : ''}<h3>This season</h3>${row('Appearances', st.apps + (st.subs ? ` <small>(${st.subs} sub)</small>` : ''))}${row('Goals', st.goals)}${row('Assists', st.assists)}${c.totals.seasons ? row('Career', `${c.totals.apps + st.apps} apps · ${c.totals.goals + st.goals} goals`) : ''}${row('Avg rating', avg ? avg.toFixed(2) : '–')}${st.u21 ? row('U21 games', st.u21) : ''}
      <div class="lvl">${skillLevelText()}</div><div class="lvlcap">Skill level</div>
      <h3>Skills</h3>${SKILLS.map(([k, l]) => { const v = state.profile.skills[k]; return `<div class="row" style="border:0"><span>${l}</span><b>${v}</b></div><div class="bar"><i style="width:${Math.min(100, v / SKILL_MAX * 100)}%"></i></div>`; }).join('')}`;
    const bills = weeklyBills(c).reduce((a, b) => a + b.amount, 0), hb = honourBadge(c.honour);
    $('right').innerHTML = `<h2>Money</h2>${row('Wages', money(c.contract.wage) + '/wk')}${row('Bills', money(bills) + '/wk')}${row('Bank balance', money(c.bank))}${row('Net worth', money(netWorth(c)))}
      <h3>Honour</h3><div class="honour h${Math.min(4, Math.floor(c.honour / 20.01))}"><div class="medal">${Math.round(c.honour)}</div><b>${hb}</b></div>
      <h3>Relationships</h3>${c.partner ? `<div class="rel"><span>${esc(c.partner.name.split(' ')[0])}</span><div class="bar"><i class="m-family" style="width:${Math.round(c.partner.meter)}%"></i></div><b>${Math.round(c.partner.meter)}</b></div>` : ''}${METERS.map(([k, l]) => `<div class="rel"><span>${l}</span><div class="bar"><i class="m-${k}" style="width:${Math.round(meter(c, k))}%"></i></div><b>${Math.round(meter(c, k))}</b></div>`).join('')}
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
    const items = k === 'football' ? footballItems() : [...(k === 'life' ? lifeItems() : k === 'fame' ? fameItems() : k === 'money' ? moneyItems() : k === 'casino' ? casinoItems() : []), ...MENUS[k].soon.map(s => ({ label: s, soon: true }))];
    el.innerHTML = `<h4>${MENUS[k].label}</h4>` + items.map((it, i) => `<button data-i="${i}" class="${it.soon ? 'soon' : ''}${it.main ? ' main' : ''}">${it.label}${it.soon ? '<small>coming soon</small>' : it.note ? `<small>${it.note}</small>` : ''}</button>`).join('');
    el.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); const it = items[+b.dataset.i]; toggleMenu(null); if (it.soon) toast(`${it.label}: coming soon. Your agent says it's "in development". He hasn't got an agent yet either.`); else it.go(); });
    el.classList.remove('hidden');
  }
  function footballItems() {
    const wf = weekFixtures(c), sl = slotsLeft(c);
    return [
      { label: 'Training', note: `${sl} slot${sl === 1 ? '' : 's'} left`, go: trainingPicker },
      { label: 'Rest', note: 'Takes your day, +energy', go: rest },
      { label: 'Fixtures & results', go: showFixtures },
      { label: 'Competitions', note: 'League, cups, Europe, England', go: () => showCompetitions(MH) },
      { label: 'My stats', note: 'By team and competition', go: () => showMyStats(MH) },
      { label: 'Contract & transfers', go: showContract },
      ...(longInjury(c) ? [{ label: 'While you\'re injured', note: `Out for ${c.injury.weeks} more week${c.injury.weeks > 1 ? 's' : ''}: the telly's calling`, main: true, go: showInjured }] : []),
      { label: 'Head of Development\'s notes', note: 'What\'s ahead, and when', go: () => modal(welcomeHTML(c)) },
      { label: 'Calendar', note: 'Fixtures and your diary', go: () => showCalendar(MH) },
      { label: 'Talk to the gaffer', note: 'Contract, minutes, loans, transfers', go: showGaffer },
      { label: 'Agent', note: agentOf(c) ? agentOf(c).name : age(c) < 17 ? 'At 17' : 'Sign one', go: () => age(c) < 17 ? modal(`<h2>Agent</h2><p>You haven't got one. At 16, agents are mostly blokes in car parks with lanyards they printed themselves. Come back at 17.</p>`) : showAgents(c, () => { save(); render(); }) },
    ];
  }

  /* ---------- actions ---------- */
  function trainingPicker() {
    if (slotsLeft(c) <= 0) return toast('Done for today. Press Continue to move on.');
    if (c.injury) return toast(`You're injured (${c.injury.name}, ${c.injury.weeks} week${c.injury.weeks > 1 ? 's' : ''} left). The physio says rest. The physio is very firm about it.`);
    modal(`<h2>Training</h2><p class="dim">One drill takes your day. Coaching at ${esc(me.name)}: ${c.contract.coaching > 1 ? 'top class' : c.contract.coaching < 1 ? 'well-meaning' : 'decent'} (x${c.contract.coaching} skill points).</p>
      <div class="grid">${SKILLS.map(([k, , t]) => `<button class="btn" data-k="${k}">${t}<small>Skill ${state.profile.skills[k]}</small></button>`).join('')}</div>
      <div class="endBtns"><button class="btn gold" id="restBtn">Rest instead<small>+energy</small></button></div>`);
    root.querySelectorAll('#mbody .grid button').forEach(b => b.onclick = () => go('training', { drill: b.dataset.k, career: true }));
    $('restBtn').onclick = () => { closeModal(); rest(); };
  }
  function rest() {
    if (slotsLeft(c) <= 0) return toast('Done for today. Press Continue to move on.');
    logRest(c); save(); render(); toast(pickLine(['Feet up. Box set. Energy restored.', 'A nap and a Pot Noodle. Bliss.', 'Ice bath, then the sofa. Mum brought biscuits.']));
  }
  function continueDay() {
    if (c.seasonOver) return go('season');
    const r = advanceDay(c); save();
    if (r === 'endweek') { finishWeek(c); save(); go('week'); return; }
    render();
    if (r === 'match') { const f = todaysFixture(c); startMatchday(c); save(); teamSheet(f.id); }
  }
  function matchday() {
    if (!nextFixture(c) && !weekFixtures(c).length && c.seasonOver) return go('season');
    const tf = todaysFixture(c);
    if (tf) { startMatchday(c); save(); return teamSheet(tf.id); }
    const nf = nextFixture(c); if (nf) return toast(`${oppOf(c, nf).name} is on ${prettyDate(nf.date, true)}. Press Continue to move through the days.`);
  }
  function proceed() { save(); render(); const tf = todaysFixture(c); if (tf) { startMatchday(c); teamSheet(tf.id); } }
  function teamSheet(id) {
    const f = c.fixtures.find(x => x.id === id), md = c.matchday;
    const role = md.sel[id] || (md.sel[id] = selection(c, f)); save();
    const mine = club(myTeamIn(c, f));
    modal(`<h2 class="ts">TEAM SHEET</h2><div class="tsfix"><small>${esc(compName(f))} · ${prettyDate(f.date, true)}${f.neutral ? ' · ' + esc(f.neutral) : ''}</small>
      <b>${esc(club(f.home).name)} v ${esc(club(f.away).name)}</b></div>
      <p class="tsrole ${role}">${esc((md.why || {})[id] === 'night' ? `${managerFor(myTeamIn(c, f) || c.clubId).name}: "${role === 'sub' ? 'You\'re on the bench' : 'You\'re not in the squad'}. Someone saw you out last night, the night before a game. Did you think I wouldn\'t find out? Everyone finds out."` : role === 'none' && (md.why || {})[id] === 'rest' ? `You played on ${prettyDate(c.lastPlayed, true)}. That's under 60 hours ago, so the physio has hidden your boots. You're resting this one.` : role === 'none' && c.injury ? `You're injured (${c.injury.name}).${c.cocommSeason !== c.season ? ' The club channel wants you on co-commentary.' : ' You watch from the stand with a blanket and a Bovril.'}` : role === 'none' && c.ban > 0 ? `You're banned (${c.ban} more week${c.ban > 1 ? 's' : ''}). ${c.flags.prison && !c.flags.servedBan ? 'You\'re listening on the radio in your cell.' : 'You\'re watching from your sofa.'}` : role === 'none' && c.intlWeek === c.week && f.comp !== 'intl' ? 'You\'re away with England this week.' : M.selection[role])}</p>
      ${mine.id.endsWith('-u21') ? `<p class="dim">It's the under-21s. Proper game though: the ${esc(CAL.cups.trophy.short)} puts you up against men with mortgages.</p>` : ''}
      <div class="endBtns">${role === 'none' ? `<button class="btn" id="watch">See how they get on</button>` : `<button class="btn gold" id="toMatch">TO THE MATCH ▶</button>`}</div>`, true);
    if (role === 'none' && c.injury && c.cocommSeason !== c.season) { $('watch').textContent = 'Co-commentate 🎙'; $('watch').onclick = () => { c.cocommSeason = c.season; save(); coCommentary(f); }; }
    else if (role === 'none') {
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
    const cups = Object.entries(c.cups).map(([k, v]) => `<span class="cupst ${v.won ? 'won' : v.alive ? 'alive' : 'out'}">${esc(v.cupName || CAL.cups[k].short)}: ${v.won ? 'WINNERS' : v.alive ? 'in it, ' + (v.round === 'G' ? 'group stage' : roundName({ comp: k, round: v.round })) : 'out'}</span>`).join('');
    modal(`<h2>${esc(DIVS[c.div].name)}</h2><div class="scroll"><table class="lt"><tr><th></th><th class="tn">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>F</th><th>A</th><th>GD</th><th>Pts</th><th>Form</th></tr>${rows}</table>${extra}</div><div class="cups">${cups}</div>`);
    const mine = root.querySelector('.lt tr.me'); if (mine) mine.scrollIntoView({ block: 'center' });
  }
  const rep = () => reputation(c, skillLevelExact(), age(c));
  function showInjured() {
    modal(`<h2>While you're injured</h2><p class="evtext">${esc(c.injury.name.replace(/^./, s => s.toUpperCase()))}. ${c.injury.weeks} more week${c.injury.weeks > 1 ? 's' : ''} out. Your agent's phone hasn't stopped ringing.</p><div class="choices">${ACTIVITIES.map(a => { const why = injAvail(c, a); return `<button class="btn choice" data-ij="${a.id}" ${why || slotsLeft(c) <= 0 ? 'disabled' : ''}>${esc(a.label)}<small>${why || (slotsLeft(c) <= 0 ? 'Done for today' : a.slots === 'all' ? 'the rest of the week' : 'takes the day')}</small></button>`; }).join('')}</div>`);
    root.querySelectorAll('[data-ij]').forEach(b => b.onclick = () => {
      const r = doActivity(c, b.dataset.ij, slotsLeft(c)); save(); render();
      if (!r.ok) return toast(r.why);
      modal(`<p class="evtext">${esc(r.line)}</p>${r.pay ? `<p>Paid: <b class="good">${money(r.pay)}</b></p>` : ''}<p class="effects">${fmtEffects(r.effects)}</p><div class="endBtns"><button class="btn gold" id="ok">Back</button></div>`);
      $('ok').onclick = showInjured;
    });
  }
  /** After a night out or a social: maybe someone catches your eye. Returns true if a scene opened. */
  function afterOuting(where) {
    if (c.partner) return false;
    const cand = maybeMeet(c, where); if (!cand) return false;
    const scene = meetScene(where);
    const run = () => {
      const cd = candidates(c)[0];
      modal(`<div class="evvia">👀 Someone catches your eye</div><h2>${avatar(cd.name, 40)} ${esc(cd.name)}</h2><p class="evtext">${esc(cd.name.split(' ')[0])}, ${esc(cd.job.toLowerCase())}, is ${esc(scene)}. ${esc(cd.quirk.replace(/^./, x => x.toUpperCase()))}</p><div class="choices">${meetTries().map(t => `<button class="btn choice" data-mt="${t.id}">${esc(t.label)}</button>`).join('')}<button class="btn choice" data-mt="no">Not tonight</button></div>`, true);
      root.querySelectorAll('[data-mt]').forEach(b => b.onclick = () => {
        if (b.dataset.mt === 'no') { closeModal(); return; }
        const r = tryMeet(c, cd, b.dataset.mt); save(); render();
        modal(`<h2>${r.ok ? 'It\'s a date!' : 'Oh dear.'}</h2><p class="evtext">${esc(r.line)}</p>${r.ok ? `<p>You're now dating ${esc(cd.name)}. Look after it: Life → Partner.</p>` : ''}<div class="endBtns"><button class="btn gold" id="ok">${r.ok ? 'Smooth' : 'Never mind'}</button></div>`);
        $('ok').onclick = closeModal;
      });
    };
    if (!c.datePref) {
      modal(`<h2>Someone's looking your way...</h2><p class="evtext">First things first: who are you interested in?</p><div class="choices"><button class="btn choice" data-p="women">Women</button><button class="btn choice" data-p="men">Men</button><button class="btn choice" data-p="both">Both</button></div>`, true);
      root.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { c.datePref = b.dataset.p; save(); run(); });
    } else run();
    return true;
  }
  function showGaffer() {
    const boss = managerFor(c.clubId), o = odds(c, avgRating(c)), mood = o > .6 ? 'He rates you. Strike while it\'s hot.' : o > .35 ? 'He\'s on the fence about you.' : 'He\'s not your biggest fan right now.';
    modal(`<h2>${esc(boss.name)}'s office</h2><p class="evtext">The door says "KNOCK". Underneath, in smaller writing: "THEN GO AWAY". ${esc(mood)}</p><div class="choices">${requestsFor(c).map(r => { const why = cantAsk(c, r.id, age(c)); return `<button class="btn choice" data-q="${r.id}" ${why ? 'disabled' : ''}>${esc(r.label)}${why ? `<small>${esc(why)}</small>` : ''}</button>`; }).join('')}</div><p class="dim">Your chances depend on his approval of you and how you've been playing.${!agentOf(c) ? ' Without an agent you\'ll get whatever he offers.' : ''}</p>`);
    root.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      const id = b.dataset.q, r = askGaffer(c, id, avgRating(c)); save(); render();
      const win = inWindow(c);
      if (id === 'endLoan' && r.yes) { const back = endLoanNow(c); moveClub(c, back, true); c.matchday = null; save(); render(); }
      modal(`<h2>${r.yes ? 'He says yes' : 'He says no'}</h2><p class="evtext">${esc(r.line)}</p>${id === 'loan' && r.yes ? `<p>${win ? 'The window\'s open, so let\'s see who wants you.' : 'He\'ll find you a club when the next window opens.'}</p>` : ''}${id === 'minutes' && r.yes ? '<p>You\'ll get more chances over the next six weeks.</p>' : ''}${id === 'endLoan' && r.yes ? `<p>Your loan's over. You're back at ${esc(club(c.clubId).name)}.</p>` : ''}${id === 'transfer' && r.yes ? '<p>You\'re on the transfer list. Expect more offers in the next window, and fewer minutes until then.</p>' : ''}<div class="endBtns">${r.raise ? '<button class="btn gold" id="talks">Talk terms</button>' : ''}${id === 'loan' && r.yes && win ? '<button class="btn gold" id="win">See loan offers</button>' : ''}<button class="btn" id="ok">Leave his office</button></div>`);
      $('ok').onclick = closeModal;
      if ($('talks')) $('talks').onclick = () => { closeModal(); showTalks(c, raiseOffer(c, rep()), { rep: rep(), age: age(c), midSeason: !c.summer }, () => { save(); render(); }); };
      if ($('win')) $('win').onclick = () => { closeModal(); showWindow(c, { rep: rep(), age: age(c), window: win, midSeason: win === 'january' || !c.summer, onDone: () => { save(); go('hub'); } }); };
    });
  }
  function showContract() {
    const k = c.contract, star = n => '★'.repeat(n) + '☆'.repeat(5 - n), cl = k.clauses || {}, win = inWindow(c);
    const extra = `${cl.imageRights ? row('Image rights', 'Yes') : ''}${cl.appearanceFee ? row('Appearance fee', money(cl.appearanceFee)) : ''}${cl.winBonus ? row('Win bonus', money(cl.winBonus)) : ''}${cl.goalBonus ? row('Goal bonus', money(cl.goalBonus) + ' a goal') : ''}${cl.assistBonus ? row('Assist bonus', money(cl.assistBonus) + ' an assist') : ''}${cl.releaseClause ? row('Release clause', money(cl.releaseClause)) : ''}${cl.silly ? row('Special request', esc(cl.silly)) : ''}${c.loan ? row('On loan from', esc(club(c.loan.parent).name)) : ''}${(cl.club || []).length ? `<div class="smallprint"><b>The small print (the club will hold you to it)</b>${cl.club.map(id => `<div>• ${esc(clause(id).text)}</div>`).join('')}</div>` : ''}`;
    if (age(c) >= 17 || c.week > 60) {
      modal(`<h2>Contract & transfers</h2>${row('Club', esc(me.name))}${row('Deal', esc(k.kind))}${row('Wages', money(k.wage) + ' a week')}${row('Runs until', prettyDate(k.until) + ' ' + k.until.slice(0, 4))}${extra}${row('Reputation', Math.round(rep()) + '/100')}
        <h3>Transfers</h3>${win ? `<p>The ${win} window is open.</p><div class="endBtns"><button class="btn gold" id="offers">See offers</button></div>` : '<p class="dim">Windows: summer (June to 1 September) and January (to 2 February). Offers depend on your reputation, and your agent.</p>'}`);
      if (win) $('offers').onclick = () => { closeModal(); showWindow(c, { rep: rep(), age: age(c), window: win, midSeason: win === 'january' || !c.summer, onDone: () => { save(); go('hub'); } }); };
      return;
    }
    modal(`<h2>Contract</h2>${row('Club', esc(me.name))}${row('Deal', esc(k.kind) + ' · ' + esc(k.label))}${row('Wages', money(k.wage) + ' a week')}${row('Signing-on fee', money(k.signingFee))}${row('Runs until', prettyDate(k.until) + ' ' + k.until.slice(0, 4))}${row('Coaching', 'x' + k.coaching)}${row('Prestige', star(k.prestige))}${row('Housing', k.housing ? 'Club digs, free' : 'At home with Mum')}
      <h3>Transfers</h3><p class="dim">You're 16. Nobody's buying yet. Loans, first pro contracts and transfers are coming in a later update.</p>`);
  }
  function showPhone(tab = 'msgs') {
    const fname = id => (friend(id) || { name: id }).name;
    const invs = c.invites.map((v, k) => { const d = inviteData(v), full = !d.venue && slotsLeft(c) <= 0; return `<div class="msg invite ${v.seen ? '' : 'new'}"><b>${avatar(['mum','gran'].includes(v.from) || friend(v.from) ? v.from : v.from === 'squad' ? (v.a || 'squad') : inviteData(v).text.slice(0, 12), 26)} ${esc(inviteFrom(v, fname))}</b><p>${esc(inviteText(v))}</p><div class="invbtns"><button class="btn small gold" data-acc="${k}" ${full ? 'disabled title="Done for today"' : ''}>${esc(d.label)}${d.pay ? ` · ${money(d.pay)}` : ''}${d.venue ? '' : ' (takes the day)'}</button><button class="btn small" data-dec="${k}">Not this time</button></div></div>`; }).join('');
    const list = (invs ? `<h3>Invitations</h3>${invs}<p class="dim small">Ignore them and they lapse at the end of the week (friends notice).</p><h3>Messages</h3>` : '') + (c.inbox.map(m => `<div class="msg ${m.read ? '' : 'new'}"><b>${avatar(m.from, 26)} ${esc(m.from)}</b><p>${esc(m.text)}</p></div>`).join('') || '<p class="dim">No messages. Nobody loves you yet.</p>');
    const chat = c.chat.slice(-40).map(m => `<div class="cm ${m.me ? 'me' : ''}">${esc(m.text)}</div>`).join('') || '<p class="dim">The lads haven\'t added you yet.</p>';
    const notes = (c.notices || []).map(m => `<div class="msg"><b>${avatar(m.from, 22)} ${esc(m.from)}</b><span>${esc(prettyDate(weekStart(m.week)))}</span><p>${esc(m.text)}</p></div>`).join('') || '<p class="dim">Nothing on the noticeboard. Dennis has pinned up a lost sock.</p>';
    modal(`<h2>Phone</h2><div class="tabs"><button class="tab" data-t="msgs">Messages${c.invites.length ? ` (${c.invites.length})` : ''}</button><button class="tab" data-t="chat">${esc(club(c.clubId).short)} LADS</button><button class="tab" data-t="notes">Noticeboard</button></div><div class="scroll phone-list" id="pmsgs">${list}</div><div class="scroll chatlog" id="pchat">${chat}</div><div class="scroll phone-list" id="pnotes">${notes}</div>`);
    const pick = t => { root.querySelectorAll('.tab[data-t]').forEach(x => x.classList.toggle('on', x.dataset.t === t)); ['msgs', 'chat', 'notes'].forEach(k => $('p' + k).classList.toggle('hidden', k !== t)); const pc = $('pchat'); pc.scrollTop = pc.scrollHeight; };
    root.querySelectorAll('.tab[data-t]').forEach(b => b.onclick = () => pick(b.dataset.t)); pick(tab);
    root.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => {
      const acceptedFrom = c.invites[+b.dataset.acc].from, r = acceptInvite(c, +b.dataset.acc); save(); render();
      if (r.venue) { const v = CZ.venues.find(x => x.id === r.venue); if (v.needs) c.flags[v.needs] = true; save(); return showVenue(v); }
      if (afterOuting(['shaz', 'ty', 'lee', 'deano'].includes(acceptedFrom) ? 'party' : 'social')) return;
      modal(`<div class="evvia">📱 Invitation</div><p class="evtext">${esc(r.line)}</p><p class="effects">${fmtEffects(r.effects)}</p><div class="endBtns"><button class="btn gold" id="ok">Back to the phone</button></div>`);
      $('ok').onclick = () => showPhone();
    });
    root.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { declineInvite(c, +b.dataset.dec); save(); render(); showPhone(); toast('Maybe next time. (They\'ll remember.)'); });
    c.inbox.forEach(m => m.read = true); c.invites.forEach(v => v.seen = true); save(); render();
  }

  /* ---------- life and fame ---------- */
  function lifeItems() {
    const called = c.weekLog.some(x => x.t === 'callMum');
    return [
      { label: c.partner ? `Partner: ${esc(c.partner.name.split(' ')[0])}` : 'Partner', note: c.partner ? `${STAGES[c.partner.stage]} · ${Math.round(c.partner.meter)}/100` : 'Single. Very single.', go: showPartner },
      { label: 'Family', note: c.kids.length ? `${c.kids.length} kid${c.kids.length > 1 ? 's' : ''}, Mum, Gran` : 'Mum, Gran', go: showFamily },
      { label: 'Holidays', note: 'Two days', go: showHolidays },
      { label: 'Your look', note: 'Barber, beard, tattoos', go: showLook },
      { label: 'Friends', note: `${FR.friends.length} mates · uses a slot`, go: showFriends },
      { label: 'Nights out', note: age(c) < 18 ? 'House parties (18+ for pubs and clubs)' : 'Pub, clubs, VIP tables', go: showNights },
      { label: 'Call Mum', note: called ? 'Already rung her this week' : 'Free, once a week', go: () => { if (called) return toast('You rang her already. She\'s still talking.'); c.weekLog.push({ t: 'callMum' }); applyEffects(c, { family: 3 }); save(); render(); toast(pickLine(['Mum: "Are you eating properly?" (x4)', 'Mum tells you about next door\'s extension for 25 minutes. Family +3', 'Mum: "Your Gran\'s got a tattoo." You don\'t ask.'])); } },
      { label: 'Visit Gran', note: 'Takes your day · family, energy', go: () => { if (slotsLeft(c) <= 0) return toast('Done for today. Press Continue to move on.'); c.slotsUsed++; c.weekLog.push({ t: 'gran' }); applyEffects(c, { family: 6, energy: 4 }); save(); render(); toast(pickLine(['Gran makes you a fry-up and asks for a tip on the 3.40 at Kempton.', 'Gran shows you her new betting app. She\'s up £340.', 'You watch Countdown with Gran. She gets a nine-letter word. It\'s rude.'])); } },
    ];
  }
  function coCommentary(f) {
    const sim = playHeadless(c, f), S = sim.summary(); let i = 0, gaffe = false;
    const qs = L2.cocomm.slice().sort(() => Math.random() - .5).slice(0, 4);
    const step = () => {
      if (i >= qs.length) {
        if (!gaffe) c.flags.cleanCommentary = true;
        recordMatch(c, f, S); save();
        const sc = `${club(f.home).name} ${S.score.home}-${S.score.away} ${club(f.away).name}`;
        modal(`<h2>FULL TIME</h2><p class="bigscore">${esc(sc)}</p><p class="dim">${c.flags.commentaryGaffe ? 'Your clip is doing the rounds online. Not in a good way.' : 'The producer says you\'re a natural. Possibly a future pundit.'}</p><div class="endBtns"><button class="btn gold" id="cont">Continue</button></div>`, true);
        $('cont').onclick = () => { closeModal(); proceed(); }; return;
      }
      const q = qs[i++];
      modal(`<div class="evvia">🎙 Co-commentary · ${esc(club(f.home).short)} v ${esc(club(f.away).short)}</div><p class="evtext">${esc(q.q)}</p><div class="choices">${q.a.map((a, k) => `<button class="btn choice" data-k="${k}">${esc(a[1].replace('{RIVAL}', c.rival ? c.rival.short : 'the new lad'))}</button>`).join('')}</div>`, true);
      root.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        const a = q.a[+b.dataset.k]; applyEffects(c, a[2]);
        if (a[0] === 'gaffe') { gaffe = true; c.flags.commentaryGaffe = true; c.weekNews.push({ page: 'front', headline: `MIC DROP: ${c.name.trim().split(/\s+/).pop().toUpperCase()}'S COMMENTARY GAFFE GOES VIRAL` }); }
        if (a[0] === 'insight') c.flags.pundit = (c.flags.pundit || 0) + 1;
        step();
      });
    };
    step();
  }
  function showFamily() {
    const kids = c.kids.map(k => `${esc(k.name)} (${Math.floor((c.week - k.born) / 52)})`).join(', ');
    modal(`<h2>Family</h2><div class="row"><span>Mum</span><b>Worries about you. Loves you.</b></div><div class="row"><span>Gran</span><b>${c.flags.granWon ? 'Up on the bookies, thanks to you' : 'Waiting for you to score'}</b></div>${c.kids.length ? `<div class="row"><span>Kids</span><b>${kids}</b></div>` : ''}
      ${c.kids.length ? `<div class="endBtns"><button class="btn gold" id="kids" ${slotsLeft(c) <= 0 ? 'disabled' : ''}>Spend the day with the kids (a slot)</button></div>` : '<p class="dim">No kids yet. Settle down, and one day there might be.</p>'}`);
    if ($('kids')) $('kids').onclick = () => { c.slotsUsed++; c.weekLog.push({ t: 'kids' }); applyEffects(c, { family: 7, energy: -3 }); save(); render(); closeModal(); toast(pickLine(['Soft play. You get stuck in the tube slide. A seven-year-old rescues you.', 'You build a den. It\'s structurally unsound. It\'s perfect.', 'Kickabout in the park. Your kid nutmegs you. You\'ve never been prouder.'])); };
  }
  function showHolidays() {
    const a = age(c);
    modal(`<h2>Holidays</h2><p class="dim">A holiday takes two days.</p><div class="scroll shop">${L2.holidays.map(h => { const why = h.minAge && a < h.minAge ? h.minAge + '+' : h.needPartner && !c.partner ? 'Need a partner' : h.needKids && !c.kids.length ? 'Need kids' : c.bank < h.cost ? 'Skint' : slotsLeft(c) < h.slots ? 'Not enough slots' : null; return `<div class="item"><div><b>${esc(h.label)}</b><span class="price">${money(h.cost)}</span><p>${esc(h.blurb)}</p></div><button class="btn small gold" data-hol="${h.id}" ${why ? 'disabled' : ''}>${why || 'Book it'}</button></div>`; }).join('')}</div>`);
    root.querySelectorAll('[data-hol]').forEach(b => b.onclick = () => { const r = holiday(c, b.dataset.hol, a); save(); render(); closeModal(); toast(r.ok ? r.line : r.why); });
  }
  function showAmends() {
    modal(`<h2>Make amends</h2><p class="dim">Every way back can go wrong. Strongest when the damage came from one big act.</p><div class="choices">
      <button class="btn choice" id="mem" ${c.flags.memoir ? 'disabled' : ''}>Write a tell-all memoir <small>£60k advance</small></button>
      <button class="btn choice" id="intv" ${c.flags.interviewed ? 'disabled' : ''}>Sit-down interview with Dame Fiona Bluntly</button>
      <button class="btn choice" id="pledge">Pledge yourself to community work <small>see Fame &gt; Community & charity</small></button>
      <button class="btn choice" id="fresh">A fresh start abroad <small>clubs abroad care less about the English press</small></button></div>`);
    $('mem').onclick = () => modal(`<h2>The memoir</h2><p class="evtext">Your ghostwriter, Clive (not that Clive), needs to know the angle.</p><div class="choices"><button class="btn choice" id="hon">Honest: it was my fault</button><button class="btn choice" id="blame">Settle some scores</button></div>`) || ($('hon').onclick = () => { memoir(c, true); save(); render(); closeModal(); toast('"Front Page, Back Page: My Story" goes to number 3 in the charts. Number 1 is a cookbook by a dog.'); }, $('blame').onclick = () => { memoir(c, false); save(); render(); closeModal(); toast('It sells. Everyone you mentioned is furious.'); });
    $('intv').onclick = () => {
      const I = L2.interview; let k = 0, score = 0;
      const ask = () => {
        if (k >= I.questions.length) { const r = interviewResult(c, score); save(); render(); modal(`<h2>${r === 'great' ? 'The nation forgives you (a bit)' : r === 'bad' ? 'That went badly' : 'That was... fine'}</h2><p class="evtext">${r === 'great' ? 'Dame Fiona nods once. From her, that\'s a standing ovation.' : r === 'bad' ? 'Clips of you are already memes. One has been set to sad violin music.' : 'Neither a disaster nor a triumph. Gran thought you looked thin.'}</p><div class="endBtns"><button class="btn gold" id="ok">OK</button></div>`); $('ok').onclick = closeModal; return; }
        const q = I.questions[k++];
        modal(`<div class="evvia">📺 ${esc(I.journalist)}</div><p class="evtext">"${esc(q.q)}"</p><div class="choices">${q.a.map((a, j) => `<button class="btn choice" data-j="${j}">${esc(a[0])}</button>`).join('')}</div>`, true);
        root.querySelectorAll('[data-j]').forEach(b => b.onclick = () => { score += q.a[+b.dataset.j][1]; ask(); });
      };
      ask();
    };
    $('pledge').onclick = () => { c.redeeming = 10; save(); closeModal(); toast('Ten weeks of community work will count double for your honour. Stay out of trouble.'); };
    $('fresh').onclick = () => { closeModal(); toast(age(c) < 18 ? 'You\'re a bit young to emigrate. Mum says no.' : 'Your reputation travels less abroad. Look for foreign clubs in the next transfer window.'); };
  }
  function showLook() {
    const a = age(c), L = c.look;
    modal(`<h2>Your look</h2><div class="scroll shop"><h3>The barber (Dazza)</h3>${LK.hair.map(h => `<div class="item ${L.hair === h.id ? 'owned' : ''}"><div><b>${esc(h.name)}</b><span class="price">${h.price ? money(h.price) : 'Free'}</span><p>${esc(h.blurb)}</p></div><button class="btn small gold" data-h="${h.id}" ${a < h.minAge || c.bank < h.price || L.hair === h.id ? 'disabled' : ''}>${L.hair === h.id ? 'Current' : a < h.minAge ? h.minAge + '+' : 'Do it'}</button></div>`).join('')}
      <div class="item"><div><b>${L.beard ? 'Shave the beard off' : 'Grow a beard'}</b><p>${L.beard ? 'Baby face returns.' : 'Takes three weeks and a lot of itching.'}</p></div><button class="btn small" id="beard" ${a < 18 ? 'disabled' : ''}>${a < 18 ? '18+' : L.beard ? 'Shave' : 'Grow'}</button></div>
      <h3>Tattoo parlour</h3>${LK.tattoos.map(t => `<div class="item ${L.tattoo === t.id ? 'owned' : ''}"><div><b>${esc(t.name)}</b><span class="price">${money(t.price)}</span><p>${esc(t.blurb)}</p></div><button class="btn small gold" data-t="${t.id}" ${a < t.minAge || c.bank < t.price || L.tattoo === t.id ? 'disabled' : ''}>${L.tattoo === t.id ? 'Got it' : a < t.minAge ? '18+' : 'Ink it'}</button></div>`).join('')}</div>`);
    const after = msg => { Object.assign(kit, lookFields(c, age(c))); save(); render(); showLook(); toast(msg); };
    root.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { const r = haircut(c, b.dataset.h, a); r.ok ? after('Dazza does his thing. The mirror gasps.') : toast(r.why); });
    root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const r = tattoo(c, b.dataset.t, a); r.ok ? after('Inked. Mum will have opinions.') : toast(r.why); });
    $('beard').onclick = () => { L.beard = !L.beard; after(L.beard ? 'Beard: grown. You stroke it thoughtfully now.' : 'Clean-shaven. You look about twelve.'); };
  }
  function showFriends() {
    const rows = FR.friends.map(f => { const L = Math.round(c.friends[f.id].loyalty); return `<div class="item friend ${f.kind}"><div><b>${avatar(f.id, 30)} ${esc(f.name)}</b> <small class="kind">${f.kind}</small><p>${esc(f.trait)}</p><div class="rel"><span>Loyalty</span><div class="bar"><i class="m-${f.kind === 'chaotic' ? 'fans' : 'teammates'}" style="width:${L}%"></i></div><b>${L}</b></div></div><button class="btn small gold" data-f="${f.id}" ${slotsLeft(c) <= 0 ? 'disabled' : ''}>${slotsLeft(c) <= 0 ? 'No slots' : 'Hang out'}</button></div>`; }).join('');
    modal(`<h2>Friends</h2><p class="dim">Hanging out takes your day. Chaotic friends bring fun, schemes and trouble; grounded ones open sensible doors. Ignore them and they drift.</p><div class="scroll shop">${rows}</div>`);
    root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { const r = hangOut(c, b.dataset.f); save(); render(); closeModal(); toast(`${friend(b.dataset.f).name}: ${r.line}`); afterOuting(b.dataset.f === 'shaz' ? 'party' : 'social'); });
  }
  function showNights() {
    const opts = nightsFor(age(c));
    modal(`<h2>Nights out</h2><p class="dim">Takes your day. A big night in a match week costs you on the pitch${age(c) < 18 ? '. Pubs and clubs open at 18' : ''}.</p>${weekFixtures(c).some(f => !f.played && f.date === addDays(dayDate(c), 1)) ? '<p class="bad">You\'ve got a match tomorrow. Go out tonight and the gaffer will probably drop you.</p>' : ''}<div class="scroll shop">${opts.map(n => `<div class="item"><div><b>${esc(n.label)}</b><span class="price">${money(n.cost)}</span></div><button class="btn small gold" data-n="${n.id}" ${slotsLeft(c) <= 0 || c.bank < n.cost ? 'disabled' : ''}>${slotsLeft(c) <= 0 ? 'No slots' : c.bank < n.cost ? 'Skint' : 'Go'}</button></div>`).join('')}</div>`);
    root.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { const r = nightOut(c, b.dataset.n); save(); render(); closeModal(); if (!r.ok) return toast(r.why); toast(r.line + (r.story ? ' Then the photos turn up...' : '')); afterOuting('night'); });
  }
  function showPartner() {
    if (!c.datePref) {
      modal(`<h2>Love life</h2><p class="evtext">Gran wants to know if you're "courting". Who are you interested in?</p><div class="choices"><button class="btn choice" data-p="women">Women</button><button class="btn choice" data-p="men">Men</button><button class="btn choice" data-p="both">Both</button></div><p class="dim">You can't change this later. Well, you can, but Gran will need it explained.</p>`);
      root.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { c.datePref = b.dataset.p; save(); showPartner(); });
      return;
    }
    const p = c.partner, a = age(c);
    if (!p) {
      modal(`<h2>Love life</h2><p class="evtext">You're single. Nobody's handing out a list of people to date: you meet someone by getting out there. Nights out, parties, invitations from friends. Most nights, nothing happens. Sometimes someone catches your eye, and then it's down to you not to blow it.</p>${c.exes.length ? `<h3>Exes</h3>${c.exes.slice(-6).reverse().map(e => `<div class="row"><span>${avatar(e.name, 22)} ${esc(e.name)}</span><b>${esc(e.why)}</b></div>`).join('')}` : ''}<p class="dim">Interested in: ${esc(c.datePref)}. <a href="#" id="pref">Change</a></p>`);
      $('pref').onclick = e => { e.preventDefault(); c.datePref = null; save(); showPartner(); };
      return;
    }
    if (false) {
      modal(`<h2>Meet someone</h2><p class="dim">A first date takes your day. New faces each week.</p><div class="scroll shop">${c.cands.list.map((x, i) => `<div class="item"><div><b>${esc(x.name)}</b> <small class="kind">${esc(x.job)}</small><p>${esc(x.meet)} ${esc(x.blurb)} Also: ${esc(x.quirk)}.</p></div><button class="btn small gold" data-c="${i}" ${slotsLeft(c) <= 0 ? 'disabled' : ''}>${slotsLeft(c) <= 0 ? 'No slots' : 'Ask them out'}</button></div>`).join('')}</div>${c.exes.length ? `<p class="dim">Exes: ${c.exes.map(e => esc(e.name.split(' ')[0])).join(', ')}. Gran keeps a list.</p>` : ''}`);
      root.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { startDating(c, c.cands.list[+b.dataset.c]); c.slotsUsed++; c.weekLog.push({ t: 'date' }); c.cands = null; save(); render(); showPartner(); toast('First date: a walk, a chippy, a nervous laugh. It went well!'); });
      return;
    }
    const M = Math.round(p.meter);
    modal(`<h2>${avatar(p.name, 40)} ${esc(p.name)}</h2><div class="sub2">${esc(STAGES[p.stage])} · ${esc(p.job)} · ${esc(p.quirk)}</div>
      <div class="rel"><span>Happiness</span><div class="bar"><i class="m-family" style="width:${M}%"></i></div><b>${M}</b></div>
      <p class="dim">${c.week - p.lastDate >= 2 ? 'You haven\'t taken them out in a while. They\'ve noticed.' : 'Things are good.'} Dates use a time slot.</p>
      <div class="scroll shop"><h3>Date night</h3>${PD.dates.filter(d => a >= d.minAge).map(d => `<div class="item"><div><b>${esc(d.label)}</b><span class="price">${money(d.cost)}</span></div><button class="btn small gold" data-d="${d.id}" ${slotsLeft(c) <= 0 || c.bank < d.cost ? 'disabled' : ''}>${slotsLeft(c) <= 0 ? 'No slots' : c.bank < d.cost ? 'Skint' : 'Go'}</button></div>`).join('')}
      <h3>Gifts</h3>${PD.gifts.filter(g => !g.minAge || a >= g.minAge).map(g => `<div class="item"><div><b>${esc(g.label)}</b><span class="price">${money(g.cost)}</span></div><button class="btn small" data-g="${g.id}" ${c.bank < g.cost ? 'disabled' : ''}>${c.bank < g.cost ? 'Skint' : 'Buy'}</button></div>`).join('')}
      <div class="endBtns"><button class="btn" id="txt">Send a soppy text (free)</button><button class="btn red" id="dump">Break up</button></div></div>`);
    root.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const r = date(c, b.dataset.d); save(); render(); if (!r.ok) return toast(r.why); showPartner(); toast(r.line); });
    root.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { const r = gift(c, b.dataset.g); save(); render(); if (!r.ok) return toast(r.why); showPartner(); toast('They love it. Or they\'re very good at pretending.'); });
    $('txt').onclick = () => { toast(textThem(c) ? 'You send three hearts and a pigeon emoji. They send seven hearts back.' : 'You\'ve already texted this week. Don\'t be needy.'); save(); render(); };
    $('dump').onclick = () => ask(`Break up with ${p.name}?`, 'End it', 'Keep trying').then(ok => { if (ok) { breakUp(c, 'you ended it'); save(); render(); closeModal(); toast('It\'s over. Mum brings a lasagne round.'); } });
  }
  function casinoItems() {
    const a = age(c);
    return CZ.venues.map(v => {
      const lock = a < v.minAge ? `${v.minAge}+ only` : v.needs && !c.flags[v.needs] ? 'Invite only (get to know Big Lee)' : null;
      return { label: v.name, note: lock || v.games.map(g => g === 'poker' ? 'Poker' : 'Blackjack').join(' · '), go: () => lock ? toast(lock === 'Invite only (get to know Big Lee)' ? 'Big Lee\'s card nights are invite only. Spend some time with Lee.' : `You're ${a}. The bouncer laughs at your provisional licence.`) : showVenue(v) };
    });
  }
  function showVenue(v) {
    const lo = v.buyIn[0], hi = Math.max(lo, Math.floor(c.bank)); // no limit: whatever you can afford
    const canAfford = c.bank >= lo, slot = slotsLeft(c) > 0;
    modal(`<h2>${esc(v.name)}</h2><p class="evtext">${esc(v.blurb)}</p>
      ${canAfford && slot ? `<div class="buyin"><span>Buy-in</span><input type="number" id="bi" min="${lo}" max="${hi}" step="1" value="${lo}"><b id="biv">${money(lo)}</b></div><p class="dim small">Anything from ${money(lo)} up to everything you've got (${money(hi)}). Bigger buy-ins, bigger blinds.</p>
      <div class="choices">${v.games.map(g => `<button class="btn gold choice" data-g="${g}">${g === 'poker' ? 'Texas Hold\'em' : 'Blackjack'}</button>`).join('')}</div>
      <p class="dim">Takes your day. Pretend money only, but it comes out of your bank. ${v.risk ? 'People talk.' : ''}</p>` : `<p class="bad">${!slot ? 'Done for today. Press Continue to move on.' : `You need at least ${money(lo)} to sit down.`}</p>`}`);
    const bi = $('bi'); if (bi) bi.oninput = () => $('biv').textContent = money(Math.max(lo, Math.min(hi, +bi.value || lo)));
    root.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
      const buy = Math.max(lo, Math.min(hi, Math.floor(+bi.value) || lo)); c.bank -= buy; c.slotsUsed++; c.casinoLive = { venue: v.id, buyIn: buy }; save(); closeModal();
      go('casino', { venue: v.id, game: b.dataset.g, buyIn: buy });
    });
  }
  let replaying = 0;
  const momentTitle = k => (MOMENTS[k] ? new MOMENTS[k]().title : k);
  function showScrapbook() {
    const sb = c.scrapbook || [];
    modal(`<h2>Scrapbook</h2><p class="dim">Every goal you score or set up in a match. Star the best ones to keep them forever; otherwise the latest 40 stay.</p><div class="scroll shop">${sb.map((g, i) => `<div class="item"><div><b>${esc(g.msg)}</b><p>${esc(g.season)} · ${esc(g.label)} v ${esc(g.opp)}${g.minute ? ' · ' + esc(g.minute) : ''} · ${esc(momentTitle(g.key))}${g.assist ? ' (assist)' : ''}</p></div><div class="btncol"><button class="btn small gold" data-play="${i}">▶ Watch</button><button class="btn small ${g.keep ? 'on' : ''}" data-keep="${i}">${g.keep ? '★ Kept' : '☆ Keep'}</button></div></div>`).join('') || '<p class="dim">No goals yet. Get scoring.</p>'}</div>`);
    root.querySelectorAll('[data-play]').forEach(b => b.onclick = () => playClip(sb[+b.dataset.play]));
    root.querySelectorAll('[data-keep]').forEach(b => b.onclick = () => { const g = sb[+b.dataset.keep]; g.keep = !g.keep; save(); showScrapbook(); });
  }
  function playClip(g) {
    modal(`<h2>${esc(g.msg)}</h2><canvas id="replay" width="${W}" height="${H}" class="replaycv"></canvas><div class="sub2">${esc(g.season)} · ${esc(g.label)} v ${esc(g.opp)} · ${esc(momentTitle(g.key))}</div><div class="endBtns"><button class="btn" id="again">↺ Again</button><button class="btn gold" id="back">Scrapbook</button></div>`);
    const x = $('replay').getContext('2d'); let i = 0;
    clearInterval(replaying);
    const len = clipLength(g);
    replaying = setInterval(() => { if (!$('replay') || $('modal').classList.contains('hidden')) { stopReplay(); return; } drawClipFrame(x, g, i, i >= len - 30 ? (g.assist ? 'ASSIST!' : 'GOAL!') : null); if (++i > len + 20) i = len + 20; }, 1000 / 30);
    $('again').onclick = () => { i = 0; };
    $('back').onclick = () => { stopReplay(); showScrapbook(); };
    $('mclose').onclick = () => { stopReplay(); closeModal(); };
  }
  function stopReplay() { clearInterval(replaying); replaying = 0; setCam('def'); setVenue(trainingVenue(c.clubId)); }
  function showRival() {
    const r = c.rival, rc = club(r.clubId), same = r.clubId === c.clubId;
    modal(`<h2>${esc(r.name)}</h2><p class="evtext">Came through the academy with you. ${same ? 'Still at ' + esc(rc.name) + ', still after your shirt.' : 'Now at ' + esc(rc.name) + '.'}</p>
      <table class="lt"><tr><th></th><th>You</th><th>${esc(r.short)}</th></tr><tr><td class="tn">Club</td><td>${esc(club(c.clubId).short)}</td><td>${esc(rc.short)}</td></tr><tr><td class="tn">Goals this season</td><td>${c.stats.goals}</td><td>${r.seasonGoals}</td></tr><tr><td class="tn">Career goals</td><td>${c.totals.goals + c.stats.goals}</td><td>${r.goals}</td></tr><tr><td class="tn">Form</td><td>${Math.round(c.form)}</td><td>${Math.round(r.form)}</td></tr></table>
      ${same && r.form > c.form ? '<p class="bad">He\'s in better form. The gaffer\'s noticed.</p>' : ''}`);
  }
  function fameItems() {
    return [
      { label: 'Social media', note: `${c.followers.toLocaleString('en-GB')} followers`, go: () => showSocial(MH) },
      { label: 'Community & charity', note: c.redeeming > 0 ? 'Pledge running: honour counts double' : 'Takes a day or two', go: () => showCommunity(MH) },
      { label: 'Newspapers', note: c.papers.length ? `${c.papers.length} issue${c.papers.length === 1 ? '' : 's'} · ${c.framed.length} framed` : 'The first issue lands Monday', go: showArchive },
      ...(inDisgrace(c) ? [{ label: 'Make amends', note: 'Memoir, interview, community, fresh start', go: showAmends }] : []),
      { label: 'Scrapbook', note: (c.scrapbook || []).length ? `${c.scrapbook.length} goal${c.scrapbook.length === 1 ? '' : 's'} to watch again` : 'Score in a match to start it', go: showScrapbook },
      { label: 'Achievements', note: `${achCount(c)} of ${ACH.length} in the cabinet`, go: showCabinet },
      { label: 'Press cuttings', note: c.quotes.length ? `${c.quotes.length} quote${c.quotes.length === 1 ? '' : 's'}` : 'Nothing said yet', go: () => modal(`<h2>Press cuttings</h2><div class="scroll">${c.quotes.map(q => `<div class="msg"><b>${esc(q.journo)}</b><span>Week ${q.week + 1}</span><p class="dim">${esc(q.q)}</p><p>${esc(q.a)}</p></div>`).join('') || '<p class="dim">You haven\'t faced the press yet.</p>'}</div>`) },
    ];
  }

  const MH = { c, age, slotsLeft: () => slotsLeft(c), modal: (h, n) => modal(h, n), closeModal: () => closeModal(), toast: t => toast(t), save, render: () => render(), root };
  function moneyItems() {
    return [
      { label: 'Bank & loans', note: `${money(c.bank)} · savings funds, debts`, go: () => showBank(MH) },
      { label: 'Shopping', note: 'Look, tech, wheels, bling', go: () => showShop(MH) },
      { label: 'Ask someone for money', note: c.debts.length ? `${c.debts.length} debt${c.debts.length > 1 ? 's' : ''} outstanding` : 'Friends, family, the club...', go: () => showBorrow(MH) },
      { label: 'Staff', note: c.staff.length ? `${c.staff.length} on the payroll` : 'Hire help', go: () => showStaff(MH) },
      { label: 'Businesses & merch', note: c.business.merch ? 'Merch line, investments' : 'Launch a merch line', go: () => showBusiness(MH) },
      { label: 'Property', note: c.home === 'mums' ? (age(c) < 18 ? 'Still at Mum\'s (18+ to move out)' : 'Still at Mum\'s') : 'Homes and rooms', go: () => showProperty(MH) },
    ];
  }

  /* ---------- pending: newspaper, events, press ---------- */
  function runPending(done) {
    const item = c.pending[0];
    if (!item) return done();
    const next = () => { c.pending.shift(); save(); render(); closeModal(); runPending(done); };
    if (item.type === 'paper') next(); // the paper waits behind the headline ticker; no alert
    else if (item.type === 'event') showEvent(item.id, next);
    else if (item.type === 'press') showPress(item, next);
    else if (item.type === 'debt') showDebt(MH, next);
    else if (item.type === 'chat') showChatPrompt(item, next);
    else if (item.type === 'troll') showTroll(MH, next);
    else if (item.type === 'invite') showInvite(MH, next);
    else if (item.type === 'window') { closeModal(); showWindow(c, { rep: rep(), age: age(c), window: 'january', midSeason: true, onDone: () => { save(); render(); next(); } }); }
    else if (item.type === 'deadline') { closeModal(); showDeadline(c, { rep: rep(), age: age(c), onDone: () => { save(); render(); next(); } }); }
    else next();
  }
  const fmtEffects = eff => Object.entries(eff).filter(([k, v]) => v && k !== 'slot').map(([k, v]) => `<span class="${v > 0 ? 'good' : 'bad'}">${k.startsWith('friend:') ? (friend(k.slice(7)) || { name: k }).name : ({ partner: c.partner ? c.partner.name.split(' ')[0] : 'Partner', manager: 'Gaffer', teammates: 'Teammates', fans: 'Fans', family: 'Family', honour: 'Honour', money: 'Money', energy: 'Energy' })[k] || k} ${v > 0 ? '+' : ''}${k === 'money' ? money(v) : v}</span>`).join(' ');
  function showEvent(id, next) {
    let e = EVENTS.get(id); if (!e) return next();
    const via = { call: '📞 Incoming call', text: '💬 New message', moment: '⚡ Meanwhile…' }[e.via] || '';
    if (e.needPartner && !c.partner) return next();
    e = Object.assign({}, e, { from: e.from.replace('{PARTNER}', c.partner ? c.partner.name : 'Your ex') });
    modal(`<div class="evvia">${via}</div><h2>${avatar(e.from, 36)} ${esc(e.from)}</h2><p class="evtext">${esc(e.text)}</p><div class="choices">${e.choices.map((ch, i) => `<button class="btn choice" data-i="${i}" ${ch.effects && ch.effects.slot && slotsLeft(c) <= 0 ? 'disabled title="Done for today"' : ''}>${esc(ch.label)}</button>`).join('')}</div>`, true);
    root.querySelectorAll('.choice').forEach(b => b.onclick = () => {
      const r = chooseEvent(c, id, +b.dataset.i); save(); render();
      modal(`<div class="evvia">${via}</div><h2>${avatar(e.from, 36)} ${esc(e.from)}</h2><p class="evtext">${esc(r.result)}</p><p class="effects">${fmtEffects(r.effects)}</p><div class="endBtns"><button class="btn gold" id="evok">OK</button></div>`, true);
      $('evok').onclick = next;
    });
  }
  function showChatPrompt(item, next) {
    const P = chatPrompt(item);
    modal(`<div class="evvia">💬 ${esc(club(c.clubId).short)} LADS (group chat)</div><div class="chatlog">${c.chat.slice(-4).map(m => `<div class="cm">${esc(m.text)}</div>`).join('')}<div class="cm q">${esc(P.q)}</div></div><div class="choices">${P.options.map((o, i) => `<button class="btn choice" data-i="${i}">${esc(o.text)}</button>`).join('')}</div>`, true);
    root.querySelectorAll('.choice').forEach(b => b.onclick = () => {
      const r = chatAnswer(c, item, +b.dataset.i); save(); render();
      modal(`<div class="evvia">💬 Group chat</div><h2>${r.leaked ? 'Uh oh.' : 'Sent.'}</h2><p class="evtext">${r.leaked ? 'Someone screenshotted it. It\'s already with Sid Scoop. Monday\'s paper will be fun.' : chatReaction(r.effects)}</p><p class="effects">${fmtEffects(r.effects)}</p><div class="endBtns"><button class="btn gold" id="evok">OK</button></div>`, true);
      $('evok').onclick = next;
    });
  }
  function showPress(item, next) {
    modal(`<div class="evvia">🎤 Press conference</div><h2>${esc(item.journo)}</h2><p class="evtext">"${esc(item.q)}"</p><div class="choices">${item.answers.map((a, i) => `<button class="btn choice" data-i="${i}">${esc(a.text)}<small>${a.tone}</small></button>`).join('')}</div>`, true);
    root.querySelectorAll('.choice').forEach(b => b.onclick = () => {
      const r = answerPress(c, item, +b.dataset.i); save(); render();
      modal(`<div class="evvia">🎤 Press conference</div><h2>Quote noted</h2><p class="evtext">That'll be in Monday's paper.</p><p class="effects">${fmtEffects(r.effects)}</p><div class="endBtns"><button class="btn gold" id="evok">OK</button></div>`, true);
      $('evok').onclick = next;
    });
  }
  function showPaper(n, next, startPage) {
    const p = paperByN(c, n); if (!p) return next && next();
    let page = startPage || 'front';
    const draw = () => {
      const framed = c.framed.some(f => f.n === n && f.page === page);
      modal(`${paperHTML(p, page, c)}<div class="endBtns paperbtns"><button class="btn" id="flip">${page === 'front' ? 'Turn to the back page ▶' : '◀ Front page'}</button><button class="btn gold" id="frame" ${framed ? 'disabled' : ''}>${framed ? 'Framed ✓' : '🖼 Frame this page'}</button>${next ? '<button class="btn red" id="done">Put it down</button>' : ''}</div>`, !!next);
      paperPhotos(root, p, page, c);
      $('flip').onclick = () => { page = page === 'front' ? 'back' : 'front'; draw(); };
      $('frame').onclick = () => { framePage(c, n, page); save(); toast('Framed. It\'ll go in the trophy room when you\'ve got one. For now, Mum\'s fridge.'); draw(); };
      if (next) $('done').onclick = next;
    };
    draw();
  }
  function showArchive() {
    const card = (p, page) => `<button class="paperthumb" data-n="${p.n}" data-p="${page || 'front'}"><small>No. ${p.n} · ${prettyDate(p.date)}${page ? ' · framed' : ''}</small><b>${esc((page === 'back' ? p.back : p.front).headline)}</b>${page ? '' : `<i>${esc(p.back.headline)}</i>`}</button>`;
    modal(`<h2>Newspapers</h2><div class="scroll">${c.framed.length ? `<h3>Framed (Mum's fridge)</h3><div class="thumbs">${c.framed.map(p => card(p, p.page)).join('')}</div>` : ''}<h3>Every issue</h3><div class="thumbs">${c.papers.map(p => card(p)).join('') || '<p class="dim">Your first issue lands on Monday.</p>'}</div></div>`);
    root.querySelectorAll('.paperthumb').forEach(b => b.onclick = () => showPaper(+b.dataset.n, null, b.dataset.p));
  }

  /* ---------- modal / toast ---------- */
  function modal(html, noClose) { $('mbody').innerHTML = html; $('modal').classList.remove('hidden'); $('mclose').style.display = noClose ? 'none' : ''; }
  function closeModal() { $('modal').classList.add('hidden'); }
  let toastT = 0;
  function showAchToasts() {
    if (window.__achBusy || !c.achNew || !c.achNew.length) return;
    const id = c.achNew.shift(), a = ACH.find(x => x.id === id); save(); if (!a) return showAchToasts();
    let el = document.getElementById('achtoast'); if (!el) { el = document.createElement('div'); el.id = 'achtoast'; el.className = 'achtoast'; document.body.appendChild(el); } window.__achBusy = true;
    el.style.setProperty('--tier', TIER[a.tier]);
    el.innerHTML = `<span class="medal">${MEDAL[a.tier]}</span><div><small>Achievement unlocked</small><b>${esc(a.name)}</b><br><small style="text-transform:none;letter-spacing:0">${esc(a.how)}</small></div>`;
    el.classList.add('show');
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => { window.__achBusy = false; if (document.body.contains(root)) showAchToasts(); }, 350); }, 3400);
  }
  function showCabinet() {
    const tiers = ['gold', 'silver', 'bronze'];
    modal(`<h2>Trophy cabinet</h2><p class="dim">${achCount(c)} of ${ACH.length}. Mum's dusted them all.</p><div class="scroll">${tiers.map(t => `<h3>${t[0].toUpperCase() + t.slice(1)}</h3><div class="cabinet">${ACH.filter(a => a.tier === t).map(a => { const got = c.achievements[a.id]; return `<div class="trophy ${t} ${got ? '' : 'locked'}"><span class="medal">${got ? MEDAL[t] : '🔒'}</span><b>${esc(a.name)}</b><p>${esc(a.how)}</p>${got ? `<p>${esc(got.season || '')}</p>` : ''}</div>`; }).join('')}</div>`).join('')}</div>`);
  }
  function chatReaction(eff) {
    const t = (eff && (eff.teammates || 0) + (eff.fans || 0)) || 0;
    const good = ['The lads react with 14 crying-laughing emojis.', 'Three voice notes of pure laughter. One is just someone wheezing.', 'The captain replies "🐐". High praise.', 'Someone makes it the group chat picture. You\'re immortal.', '"HAHAHA" from everyone, including the physio, who isn\'t in the chat. Nobody knows how.', 'It gets pinned. Nothing ever gets pinned.', 'The kit man replies with a thumbs up. From Dennis, that\'s a standing ovation.'];
    const bad = ['Silence. Then: "...ok". The worst reply in the English language.', 'Two people leave the group. One rejoins to say "no".', 'Someone screenshots it "for the lads". It\'s not for the lads.', 'Read by 23. Replies: 0.', '"bro" says the captain. Just "bro".'];
    const meh = ['A couple of thumbs-ups. The chat moves on to someone\'s new trainers.', 'Nobody replies. Someone posts a dog video. Fair enough.', 'One "lol". You\'ll take it.', '"👍" from the goalkeeper, who reacts to everything with 👍.', 'Ignored, because someone\'s just posted a picture of a massive sandwich.'];
    return pickLine(t > 0 ? good : t < 0 ? bad : meh);
  }
  function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 3200); }
  const pickLine = a => a[Math.floor(Math.random() * a.length)];

  /* ---------- centre figure ---------- */
  function frame() {
    if (replaying) return; // the replay owns the drawing for now
    setCtx(pctx); drawBackground();
    const t = clock.now, sway = Math.sin(t * 1.6) * .03;
    drawPerson({ x: 0, z: .1, kit, facing: 'front', armL: .25 + sway, armR: -.25 + sway, legL: .06, legR: -.06, ang: Math.sin(t * .8) * .015 });
  }

  return { mount, frame };
}

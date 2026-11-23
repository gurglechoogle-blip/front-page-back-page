import { ask } from '../engine/ask.js';
// MATCH DAY: score blocks on top, live commentary feed in the middle, clock
// bottom-left, your rating bottom-right, quick stats and the gaffer on the side.
// When a chance comes your way the clock stops and the moment plays in place.
import { W, H, setCam } from '../engine/camera.js';
import { attachInput, setInputHandlers } from '../engine/input.js';
import { setCtx, drawBackground, wrap, setVenue } from '../engine/draw.js';
import { matchVenue } from './venue.js';
import { makeRecorder, makeClip } from '../engine/replay.js';
import { getCam } from '../engine/camera.js';
import { getVenue } from '../engine/draw.js';
import { esc } from '../engine/util.js';
import { clock } from '../engine/clock.js';
import { makeKitSet, matchColours, playerKitFrom, teamKitFrom, keeperKitFor, luminance } from '../engine/kits.js';
import { drawManager } from '../engine/manager.js';
import { managerFor } from '../sim/managers.js';
import { sfx, startCrowd } from '../engine/audio.js';
import { matchPay, gafferVerdict } from '../sim/contracts.js';
import { createMoment, SKILLS } from '../moments/index.js';
import { MatchSim, managerMood } from '../sim/matchSim.js';
import { pickR } from '../sim/text.js';
import C from '../data/commentary.json';
import clubsData from '../data/clubs.json';
import { state, save, skillF, playerName, addSkill, skillLevelExact } from '../state/gameState.js';
import { matchSkillFactor } from '../sim/difficulty.js';
import { lookFields } from '../sim/looks.js';
import { age as careerAge } from '../sim/career.js';

const MINUTES_PER_SEC = 1.6;           // the clock "races": ~60s for 90 minutes plus your chances
const FAST = 4;                        // fast-forward multiplier
const HOLD = { goal: 1.6, break: 2.4, chance: 1.6, result: 1.6, pens: 1.2 };
const PERIOD_NAME = { '1H': '1ST HALF', '2H': '2ND HALF', 'ET1': 'EXTRA TIME', 'ET2': 'EXTRA TIME', 'PENS': 'PENALTIES' };
const PERIOD_END = { '1H': 45, '2H': 90, 'ET1': 105, 'ET2': 120 };
const club = id => clubsData.clubs.find(c => c.id === id);

// params: either a career fixture { home, away (club objects), mySide, cup,
// extraTime, role, stadium, label, trust, form, playerName, onDone(summary) }
// or a one-off { clubId, oppId, venue, cup, trust, form } from the setup screen.
export function createMatchScreen(root, go, params) {
  let home, away, mySide;
  if (params.home) ({ home, away, mySide } = params);
  else {
    const mine = club(params.clubId), them = club(params.oppId);
    mySide = params.venue === 'away' ? 'away' : 'home';
    home = mySide === 'home' ? mine : them; away = mySide === 'home' ? them : mine;
  }
  const career = !!params.onDone, role = params.role || 'start', stadium = params.stadium || home.stadium, pName = params.playerName || playerName();
  const boss = managerFor(mySide === 'home' ? home.id : away.id);
  const colours = matchColours(home, away), myCol = colours[mySide], oppCol = colours[mySide === 'home' ? 'away' : 'home'];
  const kits = makeKitSet(playerKitFrom(myCol), teamKitFrom(oppCol), keeperKitFor(myCol.shirt, oppCol.shirt));
  // Career matches save themselves as they go (params.persist) and can be resumed (params.resume).
  const resume = params.resume || null;
  if (params.onDone && state.career) Object.assign(kits.us, lookFields(state.career, careerAge(state.career)));
  const sim = resume ? MatchSim.restore(resume.sim) : new MatchSim({ home, away, mySide, cup: params.cup, extraTime: params.extraTime !== false, role, stadium, trust: params.trust, form: params.form, playerName: pName, support: params.support, subChance: params.subChance, fans: params.fans, year: params.year, bigGame: params.bigGame });
  const feedLog = resume ? resume.feed.slice() : [];
  let lastPersist = 0;
  function persist(chancePending, force) {
    if (!params.persist || !state.career) return;
    const t = performance.now(); if (!force && t - lastPersist < 1500) return; lastPersist = t;
    state.career.liveMatch = { fixtureId: params.fixtureId, role, sim: sim.snapshot(), feed: feedLog.slice(-120), chancePending: !!chancePending };
    save();
  }

  let cv, ctx, mctx, moment = null, chanceResult = null, chanceEvent = null;
  let phase = 'pre', acc = 0, hold = 0, lastT = null, fast = false, paused = false;
  let mood = 'neutral', moodUntil = 0, quoteMood = null, shownScore = { home: 0, away: 0 }, ftAt = 0;
  const $ = id => root.querySelector('#' + id);

  /* ---------- layout ---------- */
  function mount() {
    const block = (side, c, col) => `<div class="tblock ${side}" style="--shirt:${col.shirt};--trim:${col.trim}"${luminance(col.shirt) > .62 ? ' data-light' : ''}><span class="tname">${esc(c.name)}</span><span class="tscore" id="s-${side}">0</span></div>`;
    root.innerHTML = `
<div id="match">
  <div class="mtop">${block('home', home, colours.home)}${block('away', away, colours.away)}</div>
  <div class="mcomp">${esc((params.label || (params.cup ? 'Cup tie' : 'League')).toUpperCase())} · ${esc(stadium.replace(/^the /, 'The '))}<span id="pensTag"></span></div>
  <div class="mbody">
    <div id="stage">
      <canvas id="c" width="${W}" height="${H}"></canvas>
      <div id="feed" class="feed"><div id="feedIn"></div></div>
      <div id="pre" class="overlay"><div class="panel">
        <h1>${esc(home.short)} <span>v</span> ${esc(away.short)}</h1>
        <div class="sub">${esc(home.name)} v ${esc(away.name)} · ${params.cup ? (params.extraTime === false ? 'Level after 90? Straight to penalties' : 'Extra time and penalties if level') : esc(params.label || 'League match')}</div>
        <div class="prenote">${role === 'sub' ? `<b>${esc(pName)}</b> starts on the bench. Get on, and a chance or two might come your way.` : `Chances will come to <b>${esc(pName)}</b> during the match. When one does, the clock stops and you play it.`}</div>
        <button class="btn gold big" id="ko">KICK OFF ▶</button>
      </div></div>
      <div id="ft" class="overlay hidden"></div>
    </div>
    <aside id="mside">
      <h2>QUICK STATS</h2>
      <div id="stats"></div>
      <h2 class="gh">${esc(boss.name.toUpperCase())}<small style="display:block;font-size:11px;opacity:.7">${esc(boss.role)}</small></h2>
      <canvas id="mgr" width="200" height="190"></canvas>
      <div class="quote" id="quote"></div>
    </aside>
  </div>
  <div class="mbottom">
    <div class="clock"><span id="clk">00:00</span><small id="per">KICK-OFF</small></div>
    <div class="ctrls"><button class="btn small" id="pause">❚❚ Pause</button><button class="btn small" id="fast">▶▶ Faster</button>${career ? '' : '<button class="btn small red" id="leave">✕ Leave</button>'}</div>
    <div class="rating" id="ratingBox"><span id="rat">6.0</span><small>YOUR RATING</small><i id="ratDelta"></i></div>
  </div>
</div>`;
    cv = $('c'); ctx = cv.getContext('2d'); mctx = $('mgr').getContext('2d');
    setVenue(matchVenue(home, away, params.stadium && params.stadium !== home.stadium ? params.stadium : null));
    attachInput(cv);
    setInputHandlers({ down: () => moment && !moment.done && moment.onDown(), up: () => { if (moment && !moment.done) { sfx.kick(); moment.onUp(); } } });
    startCrowd({ prem: 1, champ: .8, lower: .55, park: .3 }[matchVenue(home, away).tier] || .6);
    $('ko').onclick = () => {
      $('pre').classList.add('hidden');
      if (resume) {
        if (sim.done) { phase = 'ft'; ftAt = clock.now + .3; }
        else if (sim.pending) { chanceEvent = { label: sim.pending.label, moment: sim.pending.key, kind: 'chance' }; if (sim.pending.shootout) chanceEvent.label = ''; phase = 'chanceIntro'; hold = .8; }
        else { phase = 'running'; hold = .8; }
        return;
      }
      if (!resume) sfx.whistle(1); phase = 'running'; addEvents(sim.tick()); hold = 1.2;
    };
    if (resume) {
      $('ko').textContent = 'RESUME ▶'; $('pre').querySelector('.prenote').textContent = 'Match saved. Pick up where you left off.';
      replayFeed(resume.feed);
      if (resume.chancePending && sim.pending) {
        const p = sim.pending;
        addEvents(sim.resolveChance({ key: p.key, outcome: 'miss', goal: false, gained: 5, msg: 'The moment\'s gone! You walked off mid-chance.', q: 0 }));
        persist(false, true);
      }
    }
    $('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? '▶ Play' : '❚❚ Pause'; };
    $('fast').onclick = () => { fast = !fast; $('fast').classList.toggle('on', fast); };
    if (!career) $('leave').onclick = () => { if (phase === 'ft') { setCam('def'); go('setup'); } else ask('Leave the match? It won\'t count.', 'Leave', 'Stay').then(ok => { if (ok) { setCam('def'); go('setup'); } }); };
    setCam('def'); renderStats(); setQuote(true);
  }

  /* ---------- feed ---------- */
  function replayFeed(evs) { const keep = phase; phase = 'replay'; evs.forEach(e => addFeedLine(e)); phase = keep; renderStats(); renderScore(); const f = $('feed'); f.scrollTop = f.scrollHeight; }
  function addFeedLine(e) {
    const d = document.createElement('div');
    d.className = `fl k-${e.kind}${e.side ? ' s-' + e.side : ''}${e.mine ? ' mine' : ''}${e.side === mySide ? ' us' : e.side ? ' them' : ''}`;
    d.innerHTML = (e.label ? `<b>${esc(e.label)}</b> ` : '') + esc(e.text);
    $('feedIn').appendChild(d);
  }
  function addEvents(evs) {
    if (evs.length) { feedLog.push(...evs.map(e => ({ label: e.label, text: e.text, kind: e.kind, side: e.side, mine: e.mine }))); }
    for (const e of evs) { addFeedLine(e); react(e); }
    const f = $('feed'); f.scrollTop = f.scrollHeight;
    renderStats(); renderScore();
    if (evs.length) persist(false, evs.some(e => e.kind !== 'info'));
  }
  function react(e) {
    const now = clock.now;
    if (e.kind === 'goal') { if (e.side === mySide) sfx.roar(e.mine ? 1.3 : 1); else sfx.groan(); }
    if (e.kind === 'break') sfx.whistle(2); if (e.kind === 'end') sfx.whistle(3, true);
    if (e.kind === 'goal' && phase !== 'pens') { hold = Math.max(hold, HOLD.goal / (fast ? 2 : 1)); setMood(e.side === mySide ? (e.mine ? 'ecstatic' : 'happy') : 'worried', 3.5); }
    if (e.kind === 'break') hold = Math.max(hold, HOLD.break);
    if (e.kind === 'result') setMood(sim.rating < 5.5 ? 'furious' : 'worried', 3);
    if (e.kind === 'chance') { phase = 'chanceIntro'; chanceEvent = e; hold = HOLD.chance; }
    if (e.kind === 'subOn') { hold = Math.max(hold, HOLD.result); setMood('happy', 3); }
    if (e.kind === 'end') { phase = 'ft'; ftAt = now + 1.8; }
    if (sim.period === 'PENS' && e.kind !== 'chance') hold = Math.max(hold, HOLD.pens);
  }

  /* ---------- chances ---------- */
  function startMoment() {
    $('feed').classList.add('hidden'); phase = 'moment'; persist(true, true);
    const opp = mySide === 'home' ? away : home, lvl = skillLevelExact(), msf = k => matchSkillFactor(skillF(k), lvl, opp.strength || 60);
    moment = createMoment(chanceEvent.moment).start({ kits, skillFactor: msf, playerName: pName, onResult: r => { chanceResult = r; if (!r.goal) sfx.groan(); } });
    moment.recorder = makeRecorder(); moment.recCam = getCam().n; moment.recVenue = Object.assign({}, getVenue());
  }
  function endMoment() {
    const r = chanceResult; chanceResult = null;
    // Scrapbook: keep the clip of every goal you score or set up in a career match.
    if (r.goal && career && state.career && moment.recorder.frames.length) {
      const c = state.career, clip = makeClip(moment.recorder.frames.slice(-72), kits, moment.recCam, moment.recVenue);
      c.scrapbook = c.scrapbook || [];
      c.scrapbook.unshift(Object.assign(clip, { id: Date.now(), week: c.week, season: c.season, opp: (mySide === 'home' ? away : home).name, label: params.label || '', minute: chanceEvent.label, key: r.key, msg: r.msg, q: r.q || 0, assist: ['passing', 'crossing'].includes(r.key), keep: false }));
      // Keep starred clips forever; otherwise the 40 most recent.
      while (c.scrapbook.length > 25) { const i = c.scrapbook.map(x => x.keep).lastIndexOf(false); if (i < 0) break; c.scrapbook.splice(i, 1); }
    }
    moment = null; setCam('def');
    $('feed').classList.remove('hidden');
    const before = sim.rating;
    phase = sim.done ? phase : 'running';
    addEvents(sim.resolveChance(r));
    showDelta(sim.rating - before);
    if (r.goal) setMood('ecstatic', 4);
    if (phase === 'running') hold = Math.max(hold, HOLD.result);
  }
  // Moment HUD: same look as the training ground's.
  function hud(c, m) {
    c.save(); c.fillStyle = 'rgba(10,12,14,.72)'; c.fillRect(0, 0, 300, 36); c.fillStyle = '#ffc928'; c.font = 'italic 22px Anton, Impact, sans-serif'; c.textAlign = 'left';
    c.fillText((chanceEvent.label ? 'CHANCE! ' + chanceEvent.label.replace('\'', '’') + ' · ' : 'SHOOTOUT · ') + m.d.t.toUpperCase(), 12, 26);
    c.fillStyle = 'rgba(10,12,14,.72)'; c.fillRect(0, H - 58, W, 58);
    c.fillStyle = '#fff'; c.font = 'bold 13px Roboto Condensed, Arial'; c.textAlign = 'center'; wrap(m.d.i, 330, H - 36, 450, 16);
    c.textAlign = 'right'; c.font = 'italic 22px Anton, Impact, sans-serif'; c.fillText(`${home.short} ${sim.score.home}-${sim.score.away} ${away.short}`, W - 14, H - 20); c.restore();
  }

  /* ---------- side panel, scores, clock ---------- */
  function renderScore() {
    ['home', 'away'].forEach(s => { if (shownScore[s] !== sim.score[s]) { const el = $('s-' + s); el.textContent = sim.score[s]; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } });
    shownScore = { ...sim.score };
    $('pensTag').textContent = sim.pens ? ` · PENS ${sim.pens.home}-${sim.pens.away}` : '';
  }
  function renderStats() {
    const s = sim.stats, poss = sim.possessionPct();
    const row = (l, a, b) => `<div class="srow"><b>${a}</b><span>${l}</span><b>${b}</b></div>`;
    $('stats').innerHTML = `<div class="srow head"><b>${esc(home.short)}</b><span></span><b>${esc(away.short)}</b></div>
      <div class="possbar"><i style="width:${poss}%;background:${colours.home.shirt}"></i><i style="width:${100 - poss}%;background:${colours.away.shirt}"></i></div>
      ${row('Possession', poss + '%', (100 - poss) + '%')}${row('Shots', s.home.shots, s.away.shots)}${row('On target', s.home.onTarget, s.away.onTarget)}${row('Corners', s.home.corners, s.away.corners)}${row('Fouls', s.home.fouls, s.away.fouls)}${row('Yellow cards', s.home.yellows, s.away.yellows)}
      <div class="you"><div><b>${sim.my.chances}</b>chances</div><div><b>${sim.my.goals}</b>goals</div><div><b>${sim.my.assists}</b>assists</div><div><b>${sim.my.onTarget}</b>on target</div></div>`;
  }
  function renderRating() {
    const r = sim.rating, el = $('rat');
    el.textContent = r.toFixed(1);
    $('ratingBox').className = 'rating ' + (r >= 8.5 ? 'gold' : r >= 7 ? 'good' : r >= 5.5 ? 'mid' : 'bad');
  }
  function showDelta(d) {
    if (Math.abs(d) < .05) return; const el = $('ratDelta');
    el.textContent = (d > 0 ? '+' : '') + d.toFixed(1); el.className = d > 0 ? 'up' : 'down'; void el.offsetWidth; el.classList.add('show');
  }
  const fmt = x => { const m = Math.floor(x), s = Math.floor((x - m) * 60); return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); };
  function renderClock() {
    let per = 'KICK-OFF', txt = '00:00';
    if (sim.period && sim.period !== 'PENS') {
      const E = PERIOD_END[sim.period], cap = E + sim.stoppage[sim.period], t = Math.min(cap, sim.minute + (phase === 'running' ? Math.min(acc, .999) : 0));
      txt = t <= E ? fmt(t) : `${E}:00 <em>+${fmt(t - E)}</em>`;
      per = PERIOD_NAME[sim.period];
    }
    if (sim.period === 'PENS') { txt = '120:00'; per = 'PENALTIES'; }
    if (phase === 'ft' || sim.done) per = 'FULL TIME';
    else if (phase === 'chanceIntro' || phase === 'moment') per = 'CHANCE!';
    $('clk').innerHTML = txt; $('per').textContent = per;
  }
  function setMood(m, secs) { mood = m; moodUntil = clock.now + secs; setQuote(); }
  function setQuote(force) {
    const m = currentMood();
    if (!force && m === quoteMood) return; quoteMood = m;
    $('quote').textContent = pickR(C.manager[m]);
  }
  const currentMood = () => clock.now < moodUntil ? mood : managerMood(sim);

  /* ---------- full time ---------- */
  function showFullTime() {
    const S = sim.summary(), r = S.rating;
    const cc = career && state.career, fx = cc && params.fixtureId && cc.fixtures.find(x => x.id === params.fixtureId);
    S.gafferLine = sim.gafferLine = sim.gafferLine || gafferVerdict(S);
    const pay = fx ? matchPay(cc, fx, S) : [], money = n => '£' + Math.round(n).toLocaleString('en-GB');
    const payHTML = cc ? `<div class="ftpay"><b>Your pay packet</b>${pay.length ? pay.map(p => `<div class="row"><span>${esc(p.what)}</span><b>${p.amount ? '+' + money(p.amount) : '-'}</b></div>`).join('') + (pay.some(p => p.amount) ? `<div class="row tot"><span>Total bonuses</span><b>+${money(pay.reduce((a, p) => a + p.amount, 0))}</b></div>` : '') : '<p class="dim">No bonuses in your contract for this one. ' + (S.role === 'none' ? 'You have to play to get paid extra.' : 'Get an agent and ask for some.') + '</p>'}</div>` : '';
    // Skill points from the match go into your training profile.
    if (!sim.skillsAwarded) { let g = 0; for (const k in sim.my.gained) g += addSkill(k, sim.my.gained[k]); sim.skillsAwarded = g; persist(false, true); save(); }
    const gained = sim.skillsAwarded || 0;
    const scorerList = side => S.scorers[side].map(g => `<li${g.me ? ' class="me"' : ''}>${esc(g.name)} ${esc(g.label)}${g.assist ? ` <small>(ast ${esc(g.assist)})</small>` : ''}</li>`).join('') || '<li class="none">No scorers</li>';
    const resWord = { W: 'WIN', D: 'DRAW', L: 'DEFEAT' }[S.result];
    $('ft').innerHTML = `<div class="panel ftp">
      <h1>FULL <span>TIME</span></h1>
      <div class="ftscore"><span>${esc(home.name)}</span><b>${S.score.home} - ${S.score.away}</b><span>${esc(away.name)}</span></div>
      ${S.pens ? `<div class="ftpens">${esc(sim.name(sim.winner()))} win ${Math.max(S.pens.home, S.pens.away)}-${Math.min(S.pens.home, S.pens.away)} on penalties</div>` : ''}
      <div class="scorers"><ul>${scorerList('home')}</ul><ul>${scorerList('away')}</ul></div>
      <div class="backpage"><div class="mast">THE BACK PAGE</div><div class="head">${esc(S.headline)}</div>
        <div class="byline">${resWord}${S.unusedSub ? ' · Unused sub' : S.hooked ? ` · Hooked on ${S.hooked}'` : role === 'sub' ? ' · Off the bench' : ''}${S.unusedSub ? '' : ` · Rating <b>${r.toFixed(1)}</b>`} · ${S.my.goals} goal${S.my.goals === 1 ? '' : 's'} · ${S.my.assists} assist${S.my.assists === 1 ? '' : 's'} · ${S.my.chances} chance${S.my.chances === 1 ? '' : 's'}</div>
        <div class="verdict">${esc(boss.name)} (${esc(boss.role.toLowerCase())}): "${esc(cc ? S.gafferLine : S.verdict)}"</div></div>${payHTML}
      <div class="gain">+${gained} skill points from the match</div>
      <div class="endBtns">${career ? '<button class="btn gold" id="cont">Continue ▶</button>' : '<button class="btn gold" id="again">Another match</button><button class="btn red" id="toTraining">Training ground</button>'}</div>
    </div>`;
    $('ft').classList.remove('hidden');
    if (career) $('cont').onclick = () => params.onDone(S);
    else { $('again').onclick = () => go('setup'); $('toTraining').onclick = () => go('training'); }
  }

  /* ---------- frame ---------- */
  function frame() {
    const now = clock.now, dt = lastT == null ? 0 : now - lastT; lastT = now;
    if (moment) { moment.update(); if (chanceResult) endMoment(); }
    if (moment) moment.render(ctx, hud); else { setCtx(ctx); drawBackground(); }

    if (!paused && (phase === 'running' || phase === 'chanceIntro')) {
      if (hold > 0) hold -= dt;
      else if (phase === 'chanceIntro') startMoment();
      else {
        acc += dt * MINUTES_PER_SEC * (fast ? FAST : 1);
        while (acc >= 1 && phase === 'running' && hold <= 0) { acc -= 1; addEvents(sim.tick()); }
        if (phase !== 'running') acc = 0;
      }
    }
    if (phase === 'ft' && ftAt && now >= ftAt) { ftAt = 0; showFullTime(); }
    if (now >= moodUntil) setQuote();
    renderClock(); renderRating();
    drawManager(mctx, 200, 190, currentMood(), now, myCol.shirt, boss.look);
  }

  window.__fpbpMatch = { sim, get moment() { return moment; }, get phase() { return phase; }, setFast: v => { fast = v; } };
  return { mount, frame };
}

// TRAINING GROUND: five attempts per drill, goals earn skill points.
// Same layout, flow and HUD as the v1.1 prototype, built on the moment modules.
import { W, H, P, setCam } from '../engine/camera.js';
import { mouse, attachInput, setInputHandlers } from '../engine/input.js';
import { setCtx, drawBackground, wrap, setVenue } from '../engine/draw.js';
import { trainingVenue } from './venue.js';
import { esc } from '../engine/util.js';
import { makeKitSet } from '../engine/kits.js';
import { clock } from '../engine/clock.js';
import { createMoment, SKILLS } from '../moments/index.js';
import { state, save, skillF, skillLevelText, playerName, addSkill, SKILL_MAX } from '../state/gameState.js';
import { logTraining } from '../sim/career.js';

const ATTEMPTS = 5;

// params.drill + params.career: one drill as a career time slot, then back to the hub.
export function createTrainingScreen(root, go, params = {}) {
  const profile = state.profile, career = params.career ? state.career : null, gainMul = career ? career.contract.coaching * ((career.staff || []).includes('trainer') ? 1.15 : 1) : 1;
  let cv, ctx, session = null, moment = null, lastDrill = 'volley';
  const $ = id => root.querySelector('#' + id);

  function mount() {
    root.innerHTML = `
<div id="app">
  <div id="stage">
    <canvas id="c" width="${W}" height="${H}"></canvas>
    <button id="quit" class="btn red hidden">✕ Quit drill</button>
    <div id="hub" class="overlay">
      <div class="panel">
        <h1>TRAINING <span>GROUND</span></h1>
        <div class="sub"><b>FRONT PAGE, BACK PAGE</b> · Get your touch in before the real thing</div>
        <div class="namebox">Player name <input id="pname" maxlength="16" placeholder="Your name"></div>
        <div class="grid" id="drills"></div>
        <button class="btn gold big" id="matchday">MATCH DAY ▶<small>Play a one-off match</small></button>
        <div class="hint"><a href="#" id="back2start">◀ Back to the career</a></div>
        <div class="hint">Five attempts per drill. Goals earn skill points, and higher skill widens your timing windows.<br>Moving drills: steer your player with the mouse. Set pieces: aim with the mouse, hold to power up, release to strike.</div>
      </div>
    </div>
    <div id="end" class="overlay hidden">
      <div class="panel">
        <h1 id="endTitle">SESSION <span>OVER</span></h1>
        <div id="endScore">0 / 5</div>
        <div id="endText"></div>
        <div class="endBtns"><button class="btn" id="again">Go again</button><button class="btn red" id="back">Back to training</button></div>
      </div>
    </div>
  </div>
  <aside id="side"></aside>
</div>`;
    cv = $('c'); ctx = cv.getContext('2d');
    setVenue(career ? trainingVenue(career.clubId) : null); // free practice: the rec
    attachInput(cv);
    setInputHandlers({ down: () => moment && !moment.done && moment.onDown(), up: () => moment && !moment.done && moment.onUp() });
    $('pname').value = profile.name;
    $('pname').oninput = e => { profile.name = e.target.value.trim(); save(); renderSide(); };
    $('matchday').onclick = () => go('setup');
    if (!career) $('back2start').onclick = e => { e.preventDefault(); go('start'); };
    $('again').onclick = () => { if (career) { logTraining(career, lastDrill, lastScore, lastGain); save(); go('hub'); } else startDrill(lastDrill); };
    $('back').onclick = () => { setCam('def'); $('end').classList.add('hidden'); $('hub').classList.remove('hidden'); renderHub(); };
    $('quit').onclick = () => { if (career) { go('hub'); return; } moment = null; session = null; setCam('def'); $('quit').classList.add('hidden'); $('hub').classList.remove('hidden'); renderHub(); };
    setCam('def'); renderHub(); renderSide();
    if (career) { $('again').textContent = 'Back to the hub'; $('back').classList.add('hidden'); $('pname').disabled = true; startDrill(params.drill); }
  }

  function renderSide() {
    let h = '<h2>PLAYER CARD</h2>';
    h += `<div class="row"><span>Name</span><b>${esc(playerName())}</b></div><div class="row"><span>Age</span><b>16</b></div><div class="row"><span>Club</span><b>Unattached</b></div>`;
    h += `<div class="lvl">${skillLevelText()}</div><div class="lvlcap">Skill level</div>`;
    SKILLS.forEach(([k, l]) => { const v = profile.skills[k]; h += `<div class="row" style="border:0"><span>${l}</span><b>${v}</b></div><div class="bar"><i style="width:${Math.min(100, v / SKILL_MAX * 100)}%"></i></div>`; });
    $('side').innerHTML = h;
  }
  function renderHub() {
    $('drills').innerHTML = SKILLS.map(([k, , t]) => `<button class="btn" data-k="${k}">${t}<small>Best: ${profile.best[k]}/5</small></button>`).join('');
    $('drills').querySelectorAll('button').forEach(b => b.onclick = () => startDrill(b.dataset.k));
  }

  function startDrill(k) {
    lastDrill = k;
    $('hub').classList.add('hidden'); $('end').classList.add('hidden'); $('quit').classList.remove('hidden');
    session = { k, attempt: 0, score: 0, gained: 0, kits: makeKitSet() };
    nextAttempt();
  }
  function nextAttempt() {
    session.attempt++;
    if (session.attempt > ATTEMPTS) { endDrill(); return; }
    moment = createMoment(session.k).start({
      kits: session.kits, skillFactor: skillF, playerName: playerName(),
      onResult: r => { session.score += r.goal ? 1 : 0; session.gained += r.gained; nextAttempt(); },
    });
  }
  let lastScore = 0, lastGain = 0;
  function endDrill() {
    const k = session.k, title = moment.title, gained = addSkill(k, session.gained, gainMul);
    lastScore = session.score; lastGain = gained; profile.best[k] = Math.max(profile.best[k], session.score); save();
    $('endScore').textContent = session.score + ' / 5';
    $('endTitle').innerHTML = session.score >= 4 ? 'TOP <span>DRAWER</span>' : session.score >= 2 ? 'DECENT <span>SESSION</span>' : 'BACK TO <span>BASICS</span>';
    $('endText').textContent = '+' + gained + ' ' + title + ' skill points' + (gainMul !== 1 ? ` (coaching x${gainMul})` : '');
    moment = null; $('quit').classList.add('hidden'); $('end').classList.remove('hidden'); renderSide();
  }

  // Drill HUD, drawn between the scene and the timing bars.
  function hud(c, m) {
    const score = session.score + (m.done ? 0 : m.score);
    c.save(); c.fillStyle = 'rgba(10,12,14,.72)'; c.fillRect(0, 0, 240, 36); c.fillStyle = '#ffc928'; c.font = 'italic 22px Anton, Impact, sans-serif'; c.textAlign = 'left'; c.fillText(m.d.t.toUpperCase() + ' DRILL', 12, 26);
    c.fillStyle = 'rgba(10,12,14,.72)'; c.fillRect(0, H - 58, W, 58);
    c.fillStyle = '#fff'; c.font = 'bold 13px Roboto Condensed, Arial'; c.textAlign = 'center'; wrap(m.d.i, 330, H - 36, 450, 16);
    c.textAlign = 'right'; c.font = 'italic 20px Anton, Impact, sans-serif'; c.fillText('ATTEMPT ' + Math.min(session.attempt, 5) + '/5', W - 14, H - 32); c.fillStyle = '#ffc928'; c.fillText('SCORE ' + score, W - 14, H - 10); c.restore();
  }

  function frame() {
    if (moment) moment.update();
    if (moment) moment.render(ctx, hud);
    else { setCtx(ctx); drawBackground(); }
  }

  // Test/debug hook, mirrors the prototype's window.__tf.
  window.__fpbp = { startDrill, mouse, P, onDown: () => moment && moment.onDown(), onUp: () => moment && moment.onUp(), get G() { return moment; }, get now() { return clock.now; } };

  return { mount, frame };
}

// MATCH DAY setup: a one-off match until the career exists (Stage 3 drives
// matches from the fixture list instead).
import { W, H, setCam } from '../engine/camera.js';
import { setCtx, drawBackground } from '../engine/draw.js';
import { esc } from '../engine/util.js';
import clubsData from '../data/clubs.json';
import { state, save } from '../state/gameState.js';

const CLUBS = clubsData.clubs;

export function createMatchSetupScreen(root, go) {
  const f = state.friendly;
  let ctx;
  const $ = id => root.querySelector('#' + id);
  const options = sel => CLUBS.map(c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('');

  function expected() {
    // Same formula as the sim (3 + 3*(0.6*trust + 0.4*form), +/- half a chance).
    const x = 3 + 3 * (.6 * f.trust / 100 + .4 * f.form / 100), lo = Math.max(3, Math.round(x - .5)), hi = Math.min(6, Math.round(x + .49));
    return lo === hi ? `${lo}` : `${lo}–${hi}`;
  }
  function mount() {
    root.innerHTML = `
<div id="app">
  <div id="stage">
    <canvas id="c" width="${W}" height="${H}"></canvas>
    <div class="overlay">
      <div class="panel setup">
        <h1>MATCH <span>DAY</span></h1>
        <div class="sub">A one-off match. The career, with its fixture list, comes next.</div>
        <div class="form">
          <label>Your club<select id="club">${options(f.clubId)}</select></label>
          <label>Opponents<select id="opp">${options(f.oppId)}</select></label>
          <div class="seg" id="venue"><button data-v="home">Home</button><button data-v="away">Away</button></div>
          <div class="seg" id="comp"><button data-v="league">League</button><button data-v="cup">Cup tie</button></div>
          <label class="slider">Manager trust <b id="trustV"></b><input type="range" id="trust" min="0" max="100" value="${f.trust}"></label>
          <label class="slider">Form <b id="formV"></b><input type="range" id="form" min="0" max="100" value="${f.form}"></label>
        </div>
        <div class="expect">Chances coming your way: <b id="exp"></b></div>
        <div class="hint" id="cupHint"></div>
        <div class="endBtns"><button class="btn gold" id="go">KICK OFF ▶</button><button class="btn red" id="back">Training ground</button></div>
      </div>
    </div>
  </div>
</div>`;
    ctx = $('c').getContext('2d'); setCam('def');
    const seg = (id, key, val) => { root.querySelectorAll(`#${id} button`).forEach(b => { b.classList.toggle('on', b.dataset.v === val); b.onclick = () => { key(b.dataset.v); refresh(); }; }); };
    const refresh = () => {
      seg('venue', v => f.venue = v, f.venue); seg('comp', v => f.cup = v === 'cup', f.cup ? 'cup' : 'league');
      $('trustV').textContent = f.trust; $('formV').textContent = f.form; $('exp').textContent = expected();
      $('cupHint').textContent = f.cup ? 'Level after 90? Extra time, then penalties.' : '';
      $('go').disabled = f.clubId === f.oppId; $('go').title = f.clubId === f.oppId ? 'Pick two different clubs' : '';
      save();
    };
    $('club').onchange = e => { f.clubId = e.target.value; refresh(); };
    $('opp').onchange = e => { f.oppId = e.target.value; refresh(); };
    $('trust').oninput = e => { f.trust = +e.target.value; refresh(); };
    $('form').oninput = e => { f.form = +e.target.value; refresh(); };
    $('go').onclick = () => go('match', { clubId: f.clubId, oppId: f.oppId, venue: f.venue, cup: f.cup, trust: f.trust / 100, form: f.form / 100 });
    $('back').onclick = () => go('training');
    refresh();
  }
  function frame() { setCtx(ctx); drawBackground(); }
  return { mount, frame };
}

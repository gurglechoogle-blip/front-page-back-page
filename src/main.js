import './style.css';
import { startLoop, setScreen } from './engine/loop.js';
import { state, skillLevelExact } from './state/gameState.js';
import { setSkillSource } from './sim/career.js';
setSkillSource(skillLevelExact);
import { resumeLiveMatch } from './screens/flow.js';
import { createTrainingScreen } from './screens/training.js';
import { createMatchSetupScreen } from './screens/matchSetup.js';
import { createMatchScreen } from './screens/match.js';
import { createStartScreen } from './screens/start.js';
import { createHubScreen } from './screens/hub.js';
import { createWeekScreen } from './screens/week.js';
import { createSeasonScreen } from './screens/season.js';
import { createCasinoScreen } from './screens/casino.js';
import { createTournamentScreen } from './screens/tournament.js';
import { createFinaleScreen } from './screens/finale.js';
import { message } from './sim/career.js';
import { save } from './state/gameState.js';
import { unlockAudio, startMusic, stopMusic, stopCrowd, settings, setSfx, setMusic, sfx } from './engine/audio.js';

// Sound and full screen: a little control bar that's always there.
unlockAudio();
const MUSIC_SCREENS = ['start', 'hub', 'week', 'season', 'tournament'];
function controls() {
  const d = document.createElement('div'); d.className = 'gctl';
  const fs = document.documentElement.requestFullscreen ? '<button id="g-fs" title="Full screen">⛶</button>' : '';
  d.innerHTML = `${fs}<button id="g-sfx" title="Sound effects"></button><button id="g-mus" title="Music"></button>`;
  document.body.appendChild(d);
  const paint = () => { d.querySelector('#g-sfx').textContent = settings.sfx ? '🔊' : '🔇'; d.querySelector('#g-mus').textContent = '🎵'; d.querySelector('#g-mus').classList.toggle('off', !settings.music); d.querySelector('#g-sfx').classList.toggle('off', !settings.sfx); };
  d.querySelector('#g-sfx').onclick = () => { setSfx(!settings.sfx); paint(); };
  d.querySelector('#g-mus').onclick = () => { setMusic(!settings.music); paint(); };
  if (fs) d.querySelector('#g-fs').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => { }); };
  paint();
}
controls();
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button.btn')) sfx.tick(); });

const root = document.getElementById('root');
const SCREENS = { start: createStartScreen, hub: createHubScreen, week: createWeekScreen, season: createSeasonScreen, casino: createCasinoScreen, tournament: createTournamentScreen, finale: createFinaleScreen, training: createTrainingScreen, setup: createMatchSetupScreen, match: createMatchScreen };
/** Switch screen: go('match', { ...params }). */
function go(name, params) {
  stopCrowd(); if (MUSIC_SCREENS.includes(name)) startMusic(); else stopMusic();
  try { setScreen(SCREENS[name](root, go, params || {})); window.scrollTo(0, 0); }
  catch (err) { console.error(err); showError(err); }
}
// If a screen ever fails to open, say so instead of leaving a dead button.
function showError(err) {
  const d = document.createElement('div'); d.className = 'modal';
  d.innerHTML = `<div class="mbox"><h2>Well, that's embarrassing</h2><p>Something went wrong opening that screen. Your career is saved. Reload the page to carry on.</p><p class="dim" style="font-size:12px">${String(err && err.message || err).replace(/[<>&]/g, '')}</p><div class="endBtns"><button class="btn gold" onclick="location.reload()">Reload</button></div></div>`;
  document.body.appendChild(d);
}
window.addEventListener('error', e => { if (!document.querySelector('.modal:not(.hidden) h2')) showError(e.error || e.message); });
// Pick up exactly where you left off: mid-match, mid-week or at the season review.
const c = state.career;
if (c && c.casinoLive) { message(c, 'The casino', `You walked out without cashing in your ${c.casinoLive.buyIn < 1 ? 'pennies' : 'chips'}. We'll keep those. Thanks!`); c.casinoLive = null; save(); }
if (c && c.liveMatch) resumeLiveMatch(go);
else go(c ? c.finale ? 'finale' : (c.summer && c.summer.stage === 'tournament' ? 'tournament' : c.seasonOver || c.summer ? 'season' : 'hub') : 'start');
startLoop();

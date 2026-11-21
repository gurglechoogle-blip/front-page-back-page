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
import { message } from './sim/career.js';
import { save } from './state/gameState.js';

const root = document.getElementById('root');
const SCREENS = { start: createStartScreen, hub: createHubScreen, week: createWeekScreen, season: createSeasonScreen, casino: createCasinoScreen, tournament: createTournamentScreen, training: createTrainingScreen, setup: createMatchSetupScreen, match: createMatchScreen };
/** Switch screen: go('match', { ...params }). */
function go(name, params) {
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
else go(c ? (c.summer && c.summer.stage === 'tournament' ? 'tournament' : c.seasonOver || c.summer ? 'season' : 'hub') : 'start');
startLoop();

import './style.css';
import { startLoop, setScreen } from './engine/loop.js';
import { state } from './state/gameState.js';
import { createTrainingScreen } from './screens/training.js';
import { createMatchSetupScreen } from './screens/matchSetup.js';
import { createMatchScreen } from './screens/match.js';
import { createStartScreen } from './screens/start.js';
import { createHubScreen } from './screens/hub.js';
import { createWeekScreen } from './screens/week.js';
import { createSeasonScreen } from './screens/season.js';

const root = document.getElementById('root');
const SCREENS = { start: createStartScreen, hub: createHubScreen, week: createWeekScreen, season: createSeasonScreen, training: createTrainingScreen, setup: createMatchSetupScreen, match: createMatchScreen };
/** Switch screen: go('match', { ...params }). */
function go(name, params) { setScreen(SCREENS[name](root, go, params || {})); window.scrollTo(0, 0); }
go(state.career ? (state.career.seasonOver ? 'season' : 'hub') : 'start');
startLoop();

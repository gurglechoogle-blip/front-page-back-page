import './style.css';
import { startLoop, setScreen } from './engine/loop.js';
import { state, save } from './state/gameState.js';
import { createCareer } from './sim/career.js';
import { createTrainingScreen } from './screens/training.js';
import { createMatchSetupScreen } from './screens/matchSetup.js';
import { createMatchScreen } from './screens/match.js';
import { createHubScreen } from './screens/hub.js';
import { createWeekScreen } from './screens/week.js';

const root = document.getElementById('root');
const SCREENS = { hub: createHubScreen, week: createWeekScreen, training: createTrainingScreen, setup: createMatchSetupScreen, match: createMatchScreen };
function go(name, params) { setScreen(SCREENS[name](root, go, params || {})); window.scrollTo(0, 0); }
// Until the career start exists, everyone signs for Shrewsbury.
if (!state.career) { state.career = createCareer(state.profile.name || 'Player', { type: 'pathway', clubId: 'shrewsbury', pitch: '' }); save(); }
go('hub');
startLoop();

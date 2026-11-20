import './style.css';
import { startLoop, setScreen } from './engine/loop.js';
import { createTrainingScreen } from './screens/training.js';
import { createMatchSetupScreen } from './screens/matchSetup.js';
import { createMatchScreen } from './screens/match.js';

const root = document.getElementById('root');
const SCREENS = { training: createTrainingScreen, setup: createMatchSetupScreen, match: createMatchScreen };
/** Switch screen: go('match', { ...params }). */
function go(name, params) { setScreen(SCREENS[name](root, go, params || {})); window.scrollTo(0, 0); }
go('training');
startLoop();

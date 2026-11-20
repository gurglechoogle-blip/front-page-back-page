import './style.css';
import { startLoop, setScreen } from './engine/loop.js';
import { createTrainingScreen } from './screens/training.js';

const root = document.getElementById('root');
setScreen(createTrainingScreen(root));
startLoop();

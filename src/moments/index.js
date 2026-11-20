// Registry of the nine match moments, in training-ground order.
import { Volley } from './volley.js';
import { Snapshot } from './snapshot.js';
import { Header } from './header.js';
import { Overhead } from './overhead.js';
import { Penalty } from './penalty.js';
import { FreeKick } from './freekick.js';
import { TurnShoot } from './turn.js';
import { Passing } from './passing.js';
import { Crossing } from './crossing.js';

export const MOMENTS = { volley: Volley, snapshot: Snapshot, header: Header, overhead: Overhead, penalty: Penalty, freekick: FreeKick, turn: TurnShoot, passing: Passing, crossing: Crossing };
/** [key, short label, plural label] — order and labels from the prototype. */
export const SKILLS = [['volley', 'Volley', 'Volleys'], ['snapshot', 'Snapshot', 'Snapshots'], ['header', 'Headers', 'Headers'], ['overhead', 'Overhead Kick', 'Overhead kicks'], ['penalty', 'Penalty', 'Penalties'], ['freekick', 'Free Kick', 'Free kicks'], ['turn', 'Turn & Shoot', 'Turn & shoot'], ['passing', 'Passing', 'Passing'], ['crossing', 'Crossing', 'Crossing']];
/** Create a fresh moment instance. Call .start(context) on it. */
export function createMoment(key) { return new MOMENTS[key](); }

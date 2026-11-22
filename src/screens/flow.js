// Career match flow shared by the hub and by resuming after a reload.
import { state, save } from '../state/gameState.js';
import { matchParams, recordMatch, finishWeek } from '../sim/career.js';

function onDone(go, c, f) {
  return S => {
    c.liveMatch = null; recordMatch(c, f, S); save();
    // Back to the hub: the day's done. Another game today (rare) comes straight up.
    const next = c.fixtures.find(x => x.mine && !x.played && x.date === f.date);
    go('hub', next ? { teamsheet: next.id } : {});
  };
}
/** Kick off one of your fixtures in the match screen. */
export function playFixture(go, f, role) {
  const c = state.career;
  go('match', Object.assign(matchParams(c, f, role), { playerName: c.name, persist: true, onDone: onDone(go, c, f) }));
}
/** Carry on a match that was in progress when the page was closed. */
export function resumeLiveMatch(go) {
  const c = state.career, L = c.liveMatch, f = c.fixtures.find(x => x.id === L.fixtureId);
  if (!f || f.played) { c.liveMatch = null; save(); go('hub'); return; }
  go('match', Object.assign(matchParams(c, f, L.role), { playerName: c.name, persist: true, resume: L, onDone: onDone(go, c, f) }));
}

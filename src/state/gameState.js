// Game state and save/load. One object, saved whole to localStorage.
// Stage 1 holds the training profile; the career is added on top later.
import { store } from './storage.js';
import { SKILLS } from '../moments/index.js';

export const SAVE_KEY = 'fpbp_save_v1';
const LEGACY_KEY = 'tf_profile'; // the v1.1 prototype's save

function freshProfile() { return { name: '', skills: {}, best: {} }; }
function normaliseProfile(p) {
  p = Object.assign(freshProfile(), p || {});
  SKILLS.forEach(([k]) => { if (p.skills[k] == null) p.skills[k] = 0; if (p.best[k] == null) p.best[k] = 0; });
  return p;
}

export const state = load();

function load() {
  const saved = store.get(SAVE_KEY, null);
  const s = (saved && saved.profile) ? saved
    // First run: bring across anything earned in the prototype.
    : { version: 1, profile: store.get(LEGACY_KEY, null) };
  s.profile = normaliseProfile(s.profile);
  // Settings for one-off matches from the training ground.
  s.career = s.career || null;
  s.friendly = Object.assign({ clubId: 'shrewsbury', oppId: 'barrow', venue: 'home', cup: false, trust: 50, form: 50 }, s.friendly || {});
  return s;
}
export function save() { store.set(SAVE_KEY, state); }

/** Skill points widen timing windows, up to 1.5x at 12,000 points. */
export const skillF = k => 1 + Math.min(state.profile.skills[k], 12000) / 24000;
export const skillLevel = () => Math.min(100, Math.round(Object.values(state.profile.skills).reduce((a, b) => a + b, 0) / 400));
export const playerName = () => (state.profile.name || 'Player');

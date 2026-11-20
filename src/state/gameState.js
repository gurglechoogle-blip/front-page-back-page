// Game state and save/load. One object (training profile + career), saved
// whole to localStorage after every action. A copy is kept as a weekly backup;
// if the main save is ever unreadable, the backup is loaded instead.
import { store } from './storage.js';
import { SKILLS } from '../moments/index.js';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'fpbp_save_v1';
export const BACKUP_KEY = 'fpbp_save_backup';
const LEGACY_KEY = 'tf_profile'; // the v1.1 prototype's save

function freshProfile() { return { name: '', skills: {}, best: {} }; }
function normaliseProfile(p) {
  p = Object.assign(freshProfile(), p || {});
  SKILLS.forEach(([k]) => { if (p.skills[k] == null) p.skills[k] = 0; if (p.best[k] == null) p.best[k] = 0; });
  return p;
}
const valid = s => !!(s && typeof s === 'object' && s.profile && typeof s.profile === 'object');

/** Bring any older save up to date. Safe to run on a current one. */
export function migrate(s) {
  s.profile = normaliseProfile(s.profile);
  s.career = s.career || null;
  // Settings for one-off matches from the training ground.
  s.friendly = Object.assign({ clubId: 'shrewsbury', oppId: 'barrow', venue: 'home', cup: false, trust: 50, form: 50 }, s.friendly || {});
  if (s.career) {
    const c = s.career;
    c.liveMatch = c.liveMatch || null; c.history = c.history || []; c.inbox = c.inbox || []; c.weekLog = c.weekLog || [];
  }
  s.version = SAVE_VERSION;
  return s;
}

export let loadedFrom = 'save';
function load() {
  let saved = store.get(SAVE_KEY, null);
  if (!valid(saved)) {
    const backup = store.get(BACKUP_KEY, null);
    if (valid(backup)) { saved = backup; loadedFrom = 'backup'; }
    else { saved = { profile: store.get(LEGACY_KEY, null) }; loadedFrom = 'new'; } // first run: bring across prototype skills
  }
  return migrate(saved);
}
export const state = load();

let lastSaved = 0;
/** Save everything now. */
export function save() { store.set(SAVE_KEY, state); lastSaved = Date.now(); }
export const lastSaveTime = () => lastSaved;
if (loadedFrom === 'backup') save(); // repair the main save straight away
/** Weekly safety copy. */
export function backup() { store.set(BACKUP_KEY, state); }

/** The whole save as a file to download. */
export function exportSave() {
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  const who = (state.profile.name || 'player').replace(/[^\w-]+/g, '-').toLowerCase();
  a.download = `front-page-back-page-${who}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
/** Replace the save with one from a file. Resolves true if it worked. */
export function importSave(file) {
  return file.text().then(t => {
    const s = JSON.parse(t);
    if (!valid(s)) return false;
    backup();
    Object.keys(state).forEach(k => delete state[k]);
    Object.assign(state, migrate(s)); save();
    return true;
  }).catch(() => false);
}

/** Skill points widen timing windows, up to 1.5x at 12,000 points. */
export const skillF = k => 1 + Math.min(state.profile.skills[k], 12000) / 24000;
export const skillLevel = () => Math.min(100, Math.round(Object.values(state.profile.skills).reduce((a, b) => a + b, 0) / 400));
export const playerName = () => (state.profile.name || 'Player');

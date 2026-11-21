// Game state and save/load. One object (training profile + career), saved
// whole to localStorage after every action. A copy is kept as a weekly backup;
// if the main save is ever unreadable, the backup is loaded instead.
import { store } from './storage.js';
import { SKILLS } from '../moments/index.js';
import { initLife } from '../sim/life.js';
import { setWorld } from '../sim/season.js';
import { initMoney } from '../sim/money.js';
import { initSocial } from '../sim/social.js';
import { initPartner } from '../sim/partner.js';
import { initIntl } from '../sim/international.js';
import { initLook } from '../sim/looks.js';

export const SAVE_VERSION = 3;
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
  // v3 rebalanced skills (much slower). Older saves start again, as agreed.
  if ((s.version || 1) < 3) { s = { profile: { name: s.profile && s.profile.name || '' } }; }
  s.profile = normaliseProfile(s.profile);
  s.career = s.career || null;
  // Settings for one-off matches from the training ground.
  s.friendly = Object.assign({ clubId: 'shrewsbury', oppId: 'barrow', venue: 'home', cup: false, trust: 50, form: 50 }, s.friendly || {});
  if (s.career) {
    const c = s.career;
    initLife(c); initMoney(c); initSocial(c); initPartner(c); initIntl(c); initLook(c); c.liveMatch = c.liveMatch || null;
    c.world = c.world || { year: 0, leagues: {}, strength: {} }; c.totals = c.totals || { apps: 0, goals: 0, assists: 0, seasons: 0 }; c.history = c.history || []; c.inbox = c.inbox || []; c.weekLog = c.weekLog || [];
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
    else { const old = store.get(LEGACY_KEY, null); saved = { version: SAVE_VERSION, profile: { name: old && old.name || '' } }; loadedFrom = 'new'; } // first run: keep the prototype's name only
  }
  return migrate(saved);
}
export const state = load();
setWorld(state.career ? state.career.world : null); // the right season's calendar and divisions

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

/* ---------- skills ----------
 * Each skill runs 0 to SKILL_MAX points. Gains shrink as you improve, so
 * 100% skill level (every skill maxed) takes a whole career of steady
 * training: every slot trained well gets you to ~85% by 2046; 100% needs near-perfect
 * sessions all career. A 16-year-old sits at a few %. */
export const SKILL_MAX = 20000;
/** Timing windows widen with skill, up to 1.5x at the maximum. */
export const skillF = k => 1 + Math.min(state.profile.skills[k], SKILL_MAX) / (2 * SKILL_MAX);
/** Add points earned in a drill or a match; returns what was actually added. */
export function addSkill(k, raw, mul = 1) {
  const s = state.profile.skills[k], g = Math.max(0, Math.round(raw * .18 * mul / (1 + s / 5000)));
  state.profile.skills[k] = Math.min(SKILL_MAX, s + g); return g;
}
export const skillLevelExact = () => 100 * Object.values(state.profile.skills).reduce((a, b) => a + Math.min(b, SKILL_MAX), 0) / (SKILL_MAX * SKILLS.length);
/** Your thirties: skills fade a little every summer (a home gym halves it). */
export function ageSkills(age, gym) { if (age < 30) return 0; const f = (age - 29) * .025 * (gym ? .5 : 1); let lost = 0; for (const k in state.profile.skills) { const d = Math.round(state.profile.skills[k] * f); state.profile.skills[k] -= d; lost += d; } return lost; }
export const skillLevel = () => Math.round(skillLevelExact());
/** Skill level for display: one decimal place while it's small. */
export const skillLevelText = () => { const v = skillLevelExact(); return (v < 10 ? v.toFixed(1) : Math.round(v)) + '%'; };
/** Scouts judge quality, not hours: the average of your best drill scores (0-5). */
export const scoutRating = () => SKILLS.reduce((a, [k]) => a + state.profile.best[k], 0) / SKILLS.length;
export const playerName = () => (state.profile.name || 'Player');

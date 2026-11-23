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
import { initTrouble } from '../sim/trouble.js';
import { initFame } from '../sim/fame.js';
import { initAch } from '../sim/achievements.js';
import { initInvites } from '../sim/invites.js';

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
    initLife(c); initMoney(c); initSocial(c); initPartner(c); initIntl(c); initLook(c); initTrouble(c); initFame(c); initAch(c); initInvites(c); c.liveMatch = c.liveMatch || null;
    c.world = c.world || { year: 0, leagues: {}, strength: {} }; c.totals = c.totals || { apps: 0, goals: 0, assists: 0, seasons: 0 }; c.history = c.history || []; c.inbox = c.inbox || []; c.weekLog = c.weekLog || [];
  }
  // Repair any NaN money from the old contract-talks bug.
  if (s.career) {
    const c = s.career, ok = v => typeof v === 'number' && Number.isFinite(v);
    if (!ok(c.contract.wage)) c.contract.wage = ok(c.lastWeek && c.lastWeek.wage) ? c.lastWeek.wage : 500;
    for (const k of ['appearanceFee', 'winBonus', 'goalBonus', 'assistBonus', 'releaseClause']) if (c.contract.clauses && c.contract.clauses[k] != null && !ok(c.contract.clauses[k])) c.contract.clauses[k] = 0;
    if (!ok(c.bank)) { c.bank = ok(c.lastWeek && c.lastWeek.bank) ? c.lastWeek.bank : c.contract.wage * 4; c.flags = c.flags || {}; c.flags.bankRepaired = true; (c.inbox = c.inbox || []).unshift({ id: (c.msgId = (c.msgId || 0) + 1), from: 'The bank', text: 'Sorry about that. A glitch in our systems scrambled your balance. We\'ve restored it to the last figure we trust. Have a free pen.', week: c.week, read: false }); }
    if (c.lastWeek) { if (!ok(c.lastWeek.bank)) c.lastWeek.bank = c.bank; if (!ok(c.lastWeek.wage)) c.lastWeek.wage = c.contract.wage; }
    (c.debts || []).forEach(d => { if (!ok(d.balance)) d.balance = 0; });
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
/** A brand-new game: no career, no skills, no drill records. The name is kept as a convenience. */
export function newGame() {
  state.career = null; state.profile = normaliseProfile({ name: state.profile.name }); setWorld(null); save();
}

let lastSaved = 0, saveFailed = false;
/** Trim the bulky, non-essential stuff (old replays, old papers, old diary) to make the save smaller. */
export function compact(s = state, hard = false) {
  const c = s.career; if (!c) return;
  if (c.scrapbook) { const keep = c.scrapbook.filter(g => g.keep), rest = c.scrapbook.filter(g => !g.keep).slice(0, hard ? 4 : 12); c.scrapbook = [...keep.slice(0, hard ? 10 : 30), ...rest]; }
  if (c.papers && c.papers.length > (hard ? 12 : 40)) { const framed = new Set((c.framed || []).map(f => f.n)); c.papers = c.papers.filter((p, i, a) => framed.has(p.n) || i >= a.length - (hard ? 12 : 40)); }
  if (c.diary) { const keys = Object.keys(c.diary).sort(), cut = keys.length - (hard ? 120 : 400); keys.slice(0, Math.max(0, cut)).forEach(k => delete c.diary[k]); }
  if (c.headlineLog) { const keys = Object.keys(c.headlineLog).sort(); keys.slice(0, Math.max(0, keys.length - 30)).forEach(k => delete c.headlineLog[k]); }
  ['inbox', 'notices', 'chat', 'quotes', 'lifeLog'].forEach(k => { if (Array.isArray(c[k]) && c[k].length > (hard ? 20 : 50)) c[k].length = hard ? 20 : 50; });
}
/** Save everything now. If the browser's storage is full, make room and try again; if it still fails, say so. */
export function save() {
  let data; try { data = JSON.stringify(state); } catch (e) { console.warn('Save could not be written:', e); saveFailed = true; window.dispatchEvent(new Event('fpbp-save')); return false; }
  let ok = store.set(SAVE_KEY, data);
  if (!ok) { store.remove(BACKUP_KEY); compact(state); ok = store.set(SAVE_KEY, JSON.stringify(state)); }
  if (!ok) { compact(state, true); ok = store.set(SAVE_KEY, JSON.stringify(state)); }
  saveFailed = !ok; if (ok) lastSaved = Date.now();
  window.dispatchEvent(new Event('fpbp-save'));
  return ok;
}
export const lastSaveTime = () => lastSaved;
export const saveOk = () => !saveFailed;
if (loadedFrom === 'backup') save(); // repair the main save straight away
/** Weekly safety copy (dropped, not forced, if there isn't room for two). */
export function backup() { if (!store.set(BACKUP_KEY, JSON.stringify(state))) store.remove(BACKUP_KEY); }

/** The whole save as a file to download. */
/** Ask the browser to keep the save for good (it won't clear 'persistent' storage on its own). */
let persisted = null;
export const storageProtected = () => persisted;
export async function protectStorage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) { persisted = false; return false; }
    persisted = await navigator.storage.persisted() || await navigator.storage.persist();
  } catch (e) { persisted = false; }
  window.dispatchEvent(new Event('fpbp-save'));
  return persisted;
}
export function exportSave() {
  if (state.career) { state.career.lastExport = { week: state.career.week, season: state.career.season }; save(); }
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

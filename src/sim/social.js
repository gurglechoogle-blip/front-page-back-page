// Friends, nights out, the rival striker and the team group chat.
import FR from '../data/friends.json';
import CH from '../data/chat.json';
import names from '../data/names.json';
import { applyEffects, surname } from './life.js';
import { club, divisionClubs } from './season.js';
import { makeSquad } from './squads.js';

export { FR };
const FRIENDS = new Map(FR.friends.map(f => [f.id, f]));
export const friend = id => FRIENDS.get(id);
const pick = (a, R = Math.random) => a[Math.floor(R() * a.length)];
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- set-up ---------- */
export function initSocial(c, R = Math.random) {
  c.friends = c.friends || Object.fromEntries(FR.friends.map(f => [f.id, { loyalty: f.loyalty }]));
  c.chat = c.chat || [];
  if (!c.rival) {
    const first = pick(names.first, R), last = pick(names.last.filter(n => n.toUpperCase() !== surname(c)), R);
    c.rival = { name: `${first} ${last}`, short: last, clubId: c.clubId, form: 55, apps: 0, goals: 0, seasonGoals: 0, moves: [] };
  }
  return c;
}

/* ---------- friends ---------- */
export function hangOut(c, id, R = Math.random) {
  const f = friend(id), st = c.friends[id];
  c.slotsUsed++; c.weekLog.push({ t: 'friend', id });
  st.loyalty = clamp(st.loyalty + 8, 0, 100);
  const eff = applyEffects(c, f.hang.effects);
  // Their storyline moves on.
  const nextId = f.chain.find(e => !c.eventsSeen[e] && !c.followUps.some(x => x.id === e) && !c.pending.some(p => p.id === e));
  if (nextId && f.chain.indexOf(nextId) === 0 || nextId && R() < .5) c.followUps.push({ id: nextId, week: c.week + 1 });
  return { line: pick(f.hang.lines, R), effects: eff };
}
/** Weekly: friends drift if ignored; chaotic ones sometimes turn up anyway. */
export function friendsWeek(c, R = Math.random) {
  for (const [id, st] of Object.entries(c.friends)) {
    const seen = c.weekLog.some(x => x.t === 'friend' && x.id === id);
    if (!seen) st.loyalty = clamp(st.loyalty - .6, 0, 100);
  }
  if (R() < .1) {
    const f = pick(FR.friends.filter(f => f.kind === 'chaotic'), R), n = f.chain.find(e => !c.eventsSeen[e]);
    if (n && !c.followUps.some(x => x.id === n)) c.followUps.push({ id: n, week: c.week + 1 });
  }
}

/* ---------- nights out ---------- */
export const nightsFor = age => FR.nightsOut.filter(n => age >= n.minAge && (!n.maxAge || age <= n.maxAge));
export function nightOut(c, id, R = Math.random) {
  const n = FR.nightsOut.find(x => x.id === id);
  if (c.bank < n.cost) return { ok: false, why: 'Can\'t afford it' };
  c.slotsUsed++; c.bank -= n.cost; c.weekLog.push({ t: 'night', id });
  const eff = {}; for (const [k, v] of Object.entries(n.effects)) { if (k.startsWith('friend:')) { const f = c.friends[k.slice(7)]; if (f) f.loyalty = clamp(f.loyalty + v, 0, 100); } else eff[k] = v; }
  const applied = applyEffects(c, eff);
  let story = null;
  if (R() < n.risk * ((c.staff || []).includes('driver') ? .5 : 1)) { story = pick(FR.nightRisks, R); applyEffects(c, story.effects); (c.weekNews = c.weekNews || []).push({ page: 'front', headline: fill(story.headline, { NAME: surname(c) }) }); }
  return { ok: true, line: pick(n.lines, R), effects: applied, story };
}
/** A big night this week takes the edge off matchday. */
export const nightPenalty = c => c.weekLog.some(x => x.t === 'night') ? 15 : 0;

/* ---------- the rival ---------- */
/** Every week he plays somewhere. Returns a line for the paper if he did something. */
export function rivalWeek(c, preseason, myRoles, R = Math.random) {
  const r = c.rival; if (!r || preseason) return null;
  r.form = clamp(r.form + (R() - .48) * 10, 20, 95);
  const sameClub = r.clubId === c.clubId, startedOverMe = sameClub && myRoles.some(x => x !== 'start');
  const plays = sameClub ? (startedOverMe || R() < .3) : R() < .85;
  if (!plays) return null;
  let g = 0; const lam = (r.form / 100) * .55; for (let L = Math.exp(-lam), p = R(); p > L; p *= R()) g++;
  r.apps++; r.goals += g; r.seasonGoals += g;
  if (g >= 2) return `${r.name} bags ${g === 2 ? 'a brace' : g} for ${club(r.clubId).name}.${sameClub && startedOverMe ? ' Picked ahead of you, too.' : ''}`;
  if (startedOverMe && R() < .4) return `${r.name} starts up front for ${club(r.clubId).name}. You watched.`;
  return null;
}
/** Summer: the rival might move, often to a club you turned down. */
export function rivalSummer(c, R = Math.random) {
  const r = c.rival; if (!r) return null;
  r.lastSeason = r.seasonGoals; r.seasonGoals = 0;
  if (R() < (r.lastSeason >= 10 ? .6 : .3)) {
    const cur = club(r.clubId), wanted = (c.spurned || []).filter(id => id !== r.clubId && id !== c.clubId);
    const better = ['PL', 'CH', 'L1', 'L2'].slice(0, Math.max(1, ['PL', 'CH', 'L1', 'L2', 'NL'].indexOf(cur.league))).flatMap(d => divisionClubs(d)).filter(id => id !== c.clubId);
    const to = wanted.length && R() < .6 ? pick(wanted, R) : pick(better.length ? better : divisionClubs(cur.league), R);
    r.moves.push({ from: r.clubId, to }); r.clubId = to;
    return { to, wanted: wanted.includes(to) };
  }
  return null;
}
/** He's at your club and in better form: the gaffer leans his way. */
export const rivalSelectionPenalty = c => c.rival && c.rival.clubId === c.clubId && c.rival.form > c.form ? .1 : 0;

/* ---------- group chat ---------- */
function chatVars(c, R) {
  const sq = makeSquad(c.clubId), pool = [...sq.def, ...sq.mid, ...sq.fwd];
  const a = pick(pool, R); let b = pick(pool, R); if (b === a) b = pick(pool, R);
  return { a, b, me: c.name, rival: c.rival ? c.rival.short : 'the new lad', gaffer: 'the gaffer' };
}
export function chatWeek(c, R = Math.random) {
  const v = chatVars(c, R), n = 2 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) c.chat.push({ week: c.week, text: fill(pick(CH.banter, R), v) });
  if (c.chat.length > 80) c.chat.splice(0, c.chat.length - 80);
  if (R() < .25) { const p = pick(CH.prompts, R), i = CH.prompts.indexOf(p); c.pending.push({ type: 'chat', i, vars: v }); }
}
export const chatPrompt = item => { const p = CH.prompts[item.i]; return { q: fill(p.q, item.vars), options: p.options.map(o => Object.assign({}, o, { text: fill(o.text, item.vars) })) }; };
export function chatAnswer(c, item, k, R = Math.random) {
  const P = chatPrompt(item), o = P.options[k];
  c.chat.push({ week: c.week, text: P.q }, { week: c.week, text: `${c.name}: ${o.text}`, me: true });
  const effects = applyEffects(c, o.effects);
  let leaked = false;
  if (o.risky && R() < o.leak) { leaked = true; applyEffects(c, o.leakEffects); (c.weekNews = c.weekNews || []).push({ page: 'front', headline: fill(o.headline, { NAME: surname(c) }) }); }
  return { effects, leaked };
}

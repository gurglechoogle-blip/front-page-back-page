// Invitations by text: friends, Mum, Gran and the squad asking you to do
// something. They sit in your phone until you say yes or no (or the week ends).
import INV from '../data/invites.json';
import { applyEffects, fresh } from './life.js';
import { makeSquad } from './squads.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const FROM = { mum: 'Mum', gran: 'Gran', squad: 'Squad group chat' };
export function initInvites(c) { c.invites = c.invites || []; return c; }
const listFor = from => INV.friends[from] || INV[from];
export const inviteData = inv => listFor(inv.from)[inv.i];

/** Start of a week: old invites lapse, new ones may arrive. */
export function inviteWeek(c, age, names, R = Math.random) {
  initInvites(c);
  // Ignoring an invite isn't free.
  c.invites.filter(v => v.week < c.week).forEach(v => { if (c.friends[v.from]) c.friends[v.from].loyalty = clamp(c.friends[v.from].loyalty - 2, 0, 100); });
  c.invites = c.invites.filter(v => v.week >= c.week);
  const add = (from, R) => {
    const list = listFor(from), ok = list.map((x, i) => i).filter(i => !list[i].minAge || age >= list[i].minAge);
    if (!ok.length) return;
    const i = fresh(c, 'inv-' + from, ok, R); c.invites.push({ from, i, week: c.week, a: names ? names[Math.floor(R() * names.length)] : 'Gaz' });
  };
  // Friends you're closer to ask more often.
  const fids = Object.keys(INV.friends).filter(id => c.friends[id]);
  if (fids.length && R() < .5) { const w = fids.map(id => 10 + c.friends[id].loyalty), t = w.reduce((a, b) => a + b, 0); let r = R() * t, k = 0; while ((r -= w[k]) > 0 && k < w.length - 1) k++; add(fids[k], R); }
  if (R() < .1) add('mum', R);
  if (R() < .08) add('gran', R);
  if (R() < .2) add('squad', R);
}
export const inviteText = inv => inviteData(inv).text.replace(/\{a\}/g, inv.a || 'Gaz');
export const inviteResult = inv => (inviteData(inv).result || '').replace(/\{a\}/g, inv.a || 'Gaz');
export const inviteFrom = (inv, friendName) => FROM[inv.from] || friendName(inv.from);

/** Say yes. Returns { venue } for a card game, or { effects, line }. */
export function acceptInvite(c, k) {
  const inv = c.invites[k], d = inviteData(inv); c.invites.splice(k, 1);
  const fr = c.friends[inv.from]; if (fr) fr.loyalty = clamp(fr.loyalty + 8, 0, 100);
  if (inv.from === 'mum' || inv.from === 'gran') applyEffects(c, { family: 1 });
  if (d.venue) return { venue: d.venue };
  c.slotsUsed++; c.weekLog.push({ t: 'invite', from: inv.from, label: d.label });
  return { effects: applyEffects(c, d.effects || {}), line: inviteResult(inv) };
}
export function declineInvite(c, k) {
  const inv = c.invites[k]; c.invites.splice(k, 1);
  const fr = c.friends[inv.from]; if (fr) fr.loyalty = clamp(fr.loyalty - 3, 0, 100);
  if (inv.from === 'mum' || inv.from === 'gran') applyEffects(c, { family: -2 });
  if (inv.from === 'squad') applyEffects(c, { teammates: -1 });
}
export { makeSquad };

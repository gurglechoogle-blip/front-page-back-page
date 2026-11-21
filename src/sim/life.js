// Life off the pitch: honour, relationship meters, events with choices, press
// conferences and the weekly newspaper. Pure logic on the career object.
import E from '../data/events.json';
import PR from '../data/press.json';
import NP from '../data/newspaper.json';
import { club, compName, prettyDate, weekStart, CAL, DIVS } from './season.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a, R = Math.random) => a[Math.floor(R() * a.length)];
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
export const EVENTS = new Map(E.events.map(e => [e.id, e]));

/* ---------- meters ---------- */
export const METERS = [['manager', 'Manager'], ['teammates', 'Teammates'], ['fans', 'Fans'], ['family', 'Family']];
export function initLife(c) {
  c.meters = Object.assign({ teammates: 50, fans: 50, family: 65 }, c.meters || {});
  c.flags = c.flags || {}; c.eventsSeen = c.eventsSeen || {}; c.followUps = c.followUps || [];
  c.pending = c.pending || []; c.weekNews = c.weekNews || []; c.papers = c.papers || []; c.framed = c.framed || []; c.quotes = c.quotes || [];
  c.lifeLog = c.lifeLog || [];
  return c;
}
export const meter = (c, k) => k === 'manager' ? c.approval : k === 'honour' ? c.honour : k === 'money' ? c.bank : c.meters[k];
export function applyEffects(c, eff = {}) {
  const out = {};
  for (const [k, v] of Object.entries(eff)) {
    if (!v) continue;
    if (k === 'honour') c.honour = clamp(c.honour + v, 0, 100);
    else if (k === 'manager') c.approval = clamp(c.approval + v, 0, 100);
    else if (k === 'money') c.bank += v;
    else if (k === 'energy') c.energy = clamp(c.energy + v, 0, 100);
    else if (k === 'slot') c.slotsUsed += v;
    else if (k.startsWith('friend:')) { const f = c.friends && c.friends[k.slice(7)]; if (f) f.loyalty = clamp(f.loyalty + v, 0, 100); }
    else c.meters[k] = clamp((c.meters[k] ?? 50) + v, 0, 100);
    out[k] = v;
  }
  return out;
}
/** Surname for headlines. */
export const surname = c => c.name.trim().split(/\s+/).pop().toUpperCase();

/* ---------- events ---------- */
function eligible(c, e) {
  if (e.followUpOnly || c.eventsSeen[e.id]) return false;
  if (e.minWeek && c.week < e.minWeek) return false;
  if (e.maxWeek && c.week > e.maxWeek) return false;
  if (e.notPreseason && c._preseason) return false;
  if (e.needFlag && !c.flags[e.needFlag]) return false;
  if (e.notFlag && c.flags[e.notFlag]) return false;
  if (e.types && !e.types.includes(c.contract.type)) return false;
  for (const [k, v] of Object.entries(e.min || {})) if (meter(c, k) < v) return false;
  for (const [k, v] of Object.entries(e.max || {})) if (meter(c, k) > v) return false;
  return true;
}
/** At the start of a week: follow-ups that are due, else maybe a new event. */
export function rollEvents(c, preseason, R = Math.random) {
  c._preseason = preseason;
  const due = c.followUps.filter((f, i, a) => f.week <= c.week && !c.eventsSeen[f.id] && a.findIndex(x => x.id === f.id) === i);
  c.followUps = c.followUps.filter(f => f.week > c.week);
  due.forEach(f => c.pending.push({ type: 'event', id: f.id }));
  if (!due.length && R() < .6) {
    const pool = E.events.filter(e => eligible(c, e));
    if (pool.length) {
      let r = R() * pool.reduce((a, e) => a + (e.weight || 1), 0), ev = pool[0];
      for (const e of pool) { r -= e.weight || 1; if (r <= 0) { ev = e; break; } }
      c.pending.push({ type: 'event', id: ev.id });
    }
  }
  delete c._preseason;
}
/** Pick a choice. Returns { result, effects }. */
export function chooseEvent(c, id, i, R = Math.random) {
  const e = EVENTS.get(id), ch = e.choices[i];
  c.eventsSeen[id] = true;
  const eff = Object.assign({}, ch.effects); if (eff.loyalty != null) { if (e.friend) eff['friend:' + e.friend] = eff.loyalty; delete eff.loyalty; }
  const effects = applyEffects(c, eff);
  if (ch.flag) c.flags[ch.flag] = true;
  if (ch.next && R() < (ch.next.chance ?? 1)) c.followUps.push({ id: ch.next.id, week: c.week + ch.next.in });
  if (ch.news) c.weekNews.push({ page: ch.news.page, headline: fill(ch.news.headline, { NAME: surname(c) }), from: id });
  c.lifeLog.unshift({ week: c.week, id, choice: ch.label }); if (c.lifeLog.length > 80) c.lifeLog.length = 80;
  return { result: ch.result, effects };
}

/* ---------- press ---------- */
/** Maybe a press conference after a match you were involved in. */
export function pressAfter(c, f, S, myTeam, R = Math.random) {
  if (f.comp === 'friendly' || S.role === 'none') return null;
  const big = S.my.goals >= 2 || S.rating >= 8.3 || S.rating <= 5.2;
  if (!big && R() > .45) return null;
  const won = S.result === 'W', lost = S.result === 'L';
  let ctx = S.my.goals ? 'scored' : S.role === 'sub' ? 'benched' : S.rating < 6.2 ? 'missed' : won ? 'won' : lost ? 'lost' : 'gaffer';
  if (S.rating >= 7.6 && R() < .25) ctx = 'rumour';
  if (R() < .12) ctx = 'gaffer';
  const q = pick(PR.questions[ctx], R), opp = club(f.home === myTeam ? f.away : f.home);
  return { type: 'press', journo: pick(PR.journalists, R), q: fill(q.q, { OPP: opp.name, TEAM: club(myTeam).name }), answers: q.answers, ctx, fixture: f.id };
}
export function answerPress(c, item, i) {
  const a = item.answers[i], effects = applyEffects(c, a.effects);
  const quote = { week: c.week, q: item.q, a: a.text, tone: a.tone, journo: item.journo };
  c.quotes.unshift(quote); if (c.quotes.length > 60) c.quotes.length = 60;
  c.weekNews.push({ page: 'back', quote: a.text, tone: a.tone });
  if (a.tone === 'dig') c.weekNews.push({ page: 'front', headline: fill(pick(['{NAME} IN FURIOUS OUTBURST', 'MOUTH ALMIGHTY: {NAME} LETS RIP', '{NAME} SPARKS ROW']), { NAME: surname(c) }), weak: true });
  return { effects };
}

/* ---------- match effects ---------- */
/** How a match moves the fans; how honour softens or sharpens the gaffer. */
export function afterMatch(c, S) {
  if (S.role === 'none') return;
  c.meters.fans = clamp(c.meters.fans + taper(c.meters.fans, (S.rating - 6.6) * 1.4 + S.my.goals * 1.2), 0, 100);
}
/** Good news counts for less when everyone already loves you. */
export const taper = (now, d) => d > 0 ? d * Math.max(.1, 1 - now / 110) : d;
export const honourPatience = c => c.honour >= 65 ? .8 : c.honour <= 35 ? 1.25 : 1;
/** Teammates who like you pass to you: -1 to +1 chances. */
export const support = c => clamp((c.meters.teammates - 50) / 40, -1, 1);
/** Home life: a stable family helps you recover. */
export function familyWeek(c) {
  const f = c.meters.family;
  c.energy = clamp(c.energy + (f - 50) / 8, 0, 100);
  if (f >= 70) c.form = Math.max(c.form, 38);
  c.meters.family = clamp(f + (60 - f) * .03, 0, 100);
  c.meters.teammates = clamp(c.meters.teammates + (50 - c.meters.teammates) * .02, 0, 100);
}

/* ---------- the newspaper ---------- */
function verb(c, R) { const v = NP.verbs[surname(c)[0]] || NP.verbs.S; return pick(v, R); }
/** Build Monday's paper from last week. results: lastWeek.results; fixtures: c.fixtures. */
export function makePaper(c, R = Math.random) {
  const L = c.lastWeek, NAME = surname(c), myClub = club(c.clubId);
  const res = (L && L.results) || [], fx = id => c.fixtures.find(f => f.id === id);
  const mineOf = f => [f.home, f.away].find(id => id === c.clubId || id === c.clubId + '-u21');
  // Back page: the biggest football story of the week.
  let key = 'quiet', star = null;
  const played = res.filter(r => r.role !== 'none'), goals = res.reduce((a, r) => a + (r.goals || 0), 0);
  if (res.length) {
    star = [...res].sort((a, b) => (b.goals || 0) - (a.goals || 0) || (b.rating || 0) - (a.rating || 0))[0];
    const f = fx(star.id), me = mineOf(f), u21 = me.endsWith('-u21');
    const mine = f.home === me ? f.hs : f.as, theirs = f.home === me ? f.as : f.hs;
    if (star.goals >= 3) key = 'hattrick';
    else if (star.goals === 2) key = 'brace';
    else if (star.goals === 1) key = u21 ? 'u21' : mine === theirs + 1 ? 'winner' : mine < theirs ? 'scoredLost' : 'scored';
    else if (star.assists) key = 'assist';
    else if (star.role === 'none') key = 'dropped';
    else if (star.role === 'sub') key = 'bench';
    else key = star.rating < 6.3 ? 'blank' : 'played';
    const cupOut = res.some(r => { const g = fx(r.id); return g.knockout && c.cups[g.comp] && !c.cups[g.comp].alive && c.cups[g.comp].played.slice(-1)[0] === g.id; });
    if (cupOut && !goals) key = 'cupOut';
  } else if (c.weekNews.some(n => n.page === 'back' && n.headline)) key = 'event';
  else if (c.lastWeek && new Date(weekStart(c.lastWeek.week)) < new Date(DIVS[c.div].start) - 6 * 864e5) key = 'preseason';
  const sf = star && fx(star.id), opp = sf ? club(sf.home === mineOf(sf) ? sf.away : sf.home) : null;
  const vars = { NAME, VERB: verb(c, R), OPP: opp ? opp.name.toUpperCase() : '', TEAM: myClub.short === club(c.clubId).short ? myClub.name.toUpperCase() : '' };
  const backEvent = c.weekNews.find(n => n.page === 'back' && n.headline);
  let backHead = key === 'event' || (backEvent && ['quiet', 'preseason', 'played', 'bench', 'dropped'].includes(key)) ? backEvent.headline : fill(pick((NP.back[key] || NP.back.played), R), vars);
  let backSub = sf ? `${club(sf.home).name} ${sf.hs}-${sf.as} ${club(sf.away).name}${sf.pens ? ` (${sf.pens[0]}-${sf.pens[1]} pens)` : ''} · ${compName(sf)}${star.rating != null ? ` · ${NAME.charAt(0) + NAME.slice(1).toLowerCase()} rated ${star.rating.toFixed(1)}` : ''}` : (key === 'preseason' ? 'Pre-season: cones, laps and a man with a whistle.' : 'No match this week.');
  const quote = c.weekNews.find(n => n.quote);
  // Front page: the biggest life story, or something daft if you behaved.
  const fronts = c.weekNews.filter(n => n.page === 'front' && n.headline);
  const frontStory = fronts.find(n => !n.weak) || fronts[0];
  let frontHead, frontSub;
  if (frontStory) { frontHead = frontStory.headline; frontSub = c.honour >= 65 ? `Friends insist the ${pick(NP.tone.good, R).toLowerCase()} is "a lovely lad really".` : c.honour <= 35 ? `Latest chapter in the ${pick(NP.tone.bad, R).toLowerCase()}'s rollercoaster year.` : 'Club refuse to comment. Gran refuses to stop commenting.'; }
  else if (c.honour >= 80) { frontHead = fill(pick(['{NAME}: NICEST LAD IN FOOTBALL?', 'SAINT {NAME}? FANS SAY YES']), vars); frontSub = 'Our reporters searched for dirt for a whole week. They found a parking ticket. He paid it.'; }
  else if (R() < .55) { frontHead = fill(pick(NP.sightings, R), vars); frontSub = 'Our photographer has been following him all week. It\'s been a long week.'; }
  else { frontHead = fill(pick(NP.frontFillers, R), vars); frontSub = 'Nothing scandalous about ' + NAME.charAt(0) + NAME.slice(1).toLowerCase() + ' this week. We checked. Twice.'; }
  const paper = {
    n: c.papers.length + 1, week: c.week, date: weekStart(c.week), price: pick(NP.price, R), masthead: NP.masthead,
    front: { headline: frontHead, sub: frontSub, photo: frontStory ? 'scandal' : 'filler' },
    back: { headline: backHead, sub: backSub, quote: quote ? quote.quote : null, photo: key, pos: L ? L.pos : null, div: DIVS[c.div].short, rival: (c.weekNews.find(n => n.rival) || {}).rival || null },
    dennis: pick(NP.dennis, R), gran: c.granBet ? 'Gran\'s tip of the week: you to score. She\'s already spent the winnings.' : 'Gran\'s tip of the week: the 3.40 at Kempton. Don\'t ask why.',
    kit: myClub.home,
  };
  c.papers.unshift(paper); if (c.papers.length > 60) c.papers.length = 60;
  c.weekNews = [];
  c.pending.unshift({ type: 'paper', n: paper.n });
  return paper;
}
export const paperByN = (c, n) => c.papers.find(p => p.n === n) || c.framed.find(p => p.n === n);
export function framePage(c, n, page) {
  const p = paperByN(c, n); if (!p) return false;
  if (c.framed.some(f => f.n === n && f.page === page)) return false;
  c.framed.unshift(Object.assign({}, p, { page })); return true;
}
export { prettyDate, CAL };

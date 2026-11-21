// The diary: every activity you do gets a day, and the calendar shows them
// alongside your fixtures. This week's plan is worked out from weekLog; at the
// end of each week it's written into c.diary for good.
const DRILL = { volley: 'Volleys', snapshot: 'Snapshots', header: 'Headers', overhead: 'Overhead kicks', penalty: 'Penalties', freekick: 'Free kicks', turn: 'Turn & shoot', passing: 'Passing', crossing: 'Crossing' };
const ICON = { train: '⚽', rest: '🛋', friend: '🍻', night: '🌃', date: '❤', post: '📱', community: '🤝', invite: '💌', holiday: '✈', gamble: '🃏', merch: '👕', kids: '🧸', callMum: '📞', gran: '👵', text: '💬', match: '🏟', injuryJob: '📺' };
export const iconFor = t => ICON[t] || '•';

const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export { addDays };

/** A short line for a weekLog entry. names(id) gives a friend's name. */
export function describe(e, names = id => id) {
  switch (e.t) {
    case 'train': return `Training: ${DRILL[e.drill] || e.drill}${e.score != null ? ` (${e.score}/5)` : ''}`;
    case 'rest': return 'Rest day';
    case 'friend': return `Hung out with ${names(e.id)}`;
    case 'night': return 'Night out';
    case 'date': return 'Date night';
    case 'post': return 'Posted on social media';
    case 'community': return 'Community work';
    case 'invite': return e.label || 'Accepted an invitation';
    case 'holiday': return 'Holiday';
    case 'gamble': return `Cards${e.net != null ? ` (${e.net >= 0 ? 'won' : 'lost'} £${Math.abs(Math.round(e.net)).toLocaleString('en-GB')})` : ''}`;
    case 'merch': return 'Worked on the merch line';
    case 'kids': return 'Day with the kids';
    case 'callMum': return 'Rang Mum';
    case 'gran': return 'Visited Gran';
    case 'text': return 'Texted your other half';
    default: return e.label || e.t;
  }
}

/** This week's activities, each given a day before your first match of the week
 * (you train, rest and live before you play). myDates: this week's fixture dates;
 * played: whether those matches are done. */
export function weekPlan(c, weekStartDate, myDates, names, played = false) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
  const mine = myDates.filter(d => days.includes(d)).sort(), first = mine[0];
  let before = first ? days.filter(d => d < first) : days;
  if (!before.length) before = [days[0]];
  const plan = {}; let i = 0;
  (c.weekLog || []).forEach(e => {
    // Texts, calls and posts are quick: they share a day with whatever came before.
    const quick = ['text', 'callMum', 'post'].includes(e.t);
    const d = before[Math.min(before.length - 1, quick ? Math.max(0, i - 1) : i)];
    if (!quick) i++;
    (plan[d] = plan[d] || []).push({ t: e.t, text: describe(e, names) });
  });
  const today = played ? (mine[mine.length - 1] || days[6]) : i < before.length ? before[i] : (first || before[before.length - 1]);
  return { plan, today, days };
}
/** End of the week: keep the diary. */
export function archiveWeek(c, weekStartDate, myDates, names) {
  const { plan } = weekPlan(c, weekStartDate, myDates, names, true);
  c.diary = c.diary || {};
  for (const d in plan) c.diary[d] = (c.diary[d] || []).concat(plan[d]);
}

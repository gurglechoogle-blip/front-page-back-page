// Knocking on the gaffer's door: a new contract, more game time, a loan or a
// transfer. Whether he says yes depends on how much he rates you (approval)
// and how you've been playing. Each kind of request has a cooldown.
import { applyEffects } from './life.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a, R) => a[Math.floor(R() * a.length)];
export const REQUESTS = [
  { id: 'contract', label: 'Ask for a better contract', cool: 10 },
  { id: 'minutes', label: 'Ask for more game time', cool: 6 },
  { id: 'loan', label: 'Ask to go out on loan', cool: 10 },
  { id: 'transfer', label: 'Hand in a transfer request', cool: 16 },
  { id: 'endLoan', label: 'Ask to cut your loan short', cool: 8 },
];
/** The requests that make sense right now: on loan, you can't ask for a contract, a loan or a transfer. */
export const requestsFor = c => REQUESTS.filter(r => c.loan ? ['minutes', 'endLoan'].includes(r.id) : r.id !== 'endLoan');
const LINES = {
  contract: { yes: ['"Fair enough. You\'ve earned it. Don\'t tell the others, they\'ll all want one."', '"I\'ll speak to the chairman. He\'ll moan. Then he\'ll pay."', '"Go on then. Keep scoring and we\'ll keep paying."'], no: ['"A new contract? You\'ve played like a deckchair in a hurricane. Come back when you\'re scoring."', '"The chairman laughed for a full minute. Then he asked who you were."', '"Earn it first. Then we\'ll talk. Then I\'ll probably still say no."'] },
  minutes: { yes: ['"Alright. You\'ll get your chance. Don\'t waste it, I\'m not a charity."', '"Keep training like this and you\'ll play. That\'s a promise. Sort of."'], no: ['"More minutes? Show me more in training first. I\'ve seen more urgency from a sleeping cat."', '"Everyone wants game time. Not everyone deserves it. Shut the door on your way out."'] },
  loan: { yes: ['"A loan would do you good. Proper men, proper mud. I\'ll make some calls."', '"Good idea. You\'ll learn more in six months there than six years on my bench."'], no: ['"Loan? I need you here. Which is a compliment, so take it and go."', '"Nobody\'s asked for you. I\'ve checked. Twice."'] },
  endLoan: { yes: ['"Honestly? It\'s not working for either of us. I\'ll ring your parent club. No hard feelings. Some hard feelings."'], no: ['"You signed for the season. You\'re staying for the season. Get your head down."', '"Cut it short? We\'re paying half your wages. You\'re going nowhere, son."', '"Your parent club were very clear: you stay and you learn. So stay. And learn."'] },
  transfer: { yes: ['"If that\'s how you feel, fine. I\'ll stick you on the list. Don\'t expect a leaving card."', '"Right. Noted. Very disappointing. Close the door properly this time."'], no: ['"Request denied. You\'re under contract and I like you, God help me. Get back out there."', '"You\'re going nowhere. The fans would burn my car. Again."'] },
};

/** Why you can't ask this right now, or null. */
export function cantAsk(c, id, age) {
  const r = REQUESTS.find(x => x.id === id), last = (c.asked || {})[id];
  if (last != null && c.week - last < r.cool) return `Asked ${c.week - last} week${c.week - last === 1 ? '' : 's'} ago. Give it ${r.cool - (c.week - last)} more.`;
  if (id === 'contract' && (age < 17 || c.loan)) return age < 17 ? 'You\'re still on a scholarship' : 'You\'re on loan';
  if (id === 'loan' && (c.loan || age > 23)) return c.loan ? 'Already on loan' : 'Loans are for young players';
  if (id === 'transfer' && c.transferListed) return 'Already on the transfer list';
  if (id === 'transfer' && age < 17) return 'Too young';
  if (id === 'endLoan' && !c.loan) return 'You\'re not on loan';
  return null;
}
/** How keen the gaffer is: his approval of you, your recent form and your season so far. */
export function odds(c, avg) {
  return clamp(.15 + (c.approval - 50) / 80 + (c.form - 50) / 200 + ((avg || 6.4) - 6.4) * .35 + Math.min(.15, c.stats.goals * .01), .05, .92);
}
/** Make the request. Returns { yes, line, offer? }. */
export function ask(c, id, avg, R = Math.random) {
  (c.asked = c.asked || {})[id] = c.week;
  let p = odds(c, avg);
  if (id === 'minutes') p += .1;
  if (id === 'loan') p = clamp(1.05 - p + (c.stats.apps < 5 ? .2 : 0), .15, .9); // the less he rates you, the happier he is to loan you out
  if (id === 'transfer') p = clamp(1 - p, .2, .85);
  // A loan only gets cut short if you've been rubbish, and even then not often.
  if (id === 'endLoan') p = c.approval < 35 || (avg && avg < 6.0) ? .25 : .03;
  const yes = R() < p, line = pick(LINES[id][yes ? 'yes' : 'no'], R);
  if (id === 'contract') { if (yes) return { yes, line, raise: true }; applyEffects(c, { manager: -3 }); }
  if (id === 'minutes') { if (yes) c.promised = c.week + 6; else applyEffects(c, { manager: -2 }); }
  if (id === 'loan') { if (yes) c.wantLoan = true; }
  if (id === 'endLoan') { if (yes) c.loanEndAgreed = true; else applyEffects(c, { manager: -3 }); }
  if (id === 'transfer') { applyEffects(c, yes ? { manager: -8, fans: -4, honour: -2 } : { manager: -4 }); if (yes) c.transferListed = true; }
  return { yes, line };
}
/** A renewal offer that reflects how well you're doing. */
export function raiseOffer(c, rep) {
  const w = Math.round((c.contract.wage * (1.2 + Math.max(0, c.approval - 60) / 100) + rep * 10) / 10) * 10;
  return { type: 'renewal', clubId: c.clubId, wage: Math.max(c.contract.wage + 50, w), years: 3, role: 'your current role', fee: 0, clubClauses: [] };
}

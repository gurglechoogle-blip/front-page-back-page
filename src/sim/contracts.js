// What your contract actually says, and the game holding you to it:
// appearance fees, win, goal and assist bonuses, promotion bonuses, and the
// daft clauses clubs slip in (which are enforced, mostly to your cost).
import { applyEffects } from './life.js';

export const CLUB_CLAUSES = [
  { id: 'noFriday', text: 'No nights out in a week with a match. Fine: a week\'s wages.', kind: 'fine' },
  { id: 'panto', text: 'Must appear in the club\'s Christmas pantomime (as the back half of the horse if required)', kind: 'duty' },
  { id: 'mascot', text: 'One home game a season inside the mascot costume, at half-time', kind: 'duty' },
  { id: 'hair', text: 'Hair to remain "a colour found in nature". £2,000 fine per unnatural colour', kind: 'fine' },
  { id: 'weight', text: 'Fined £100 for every week you turn up to training "looking like you\'ve had a big weekend"', kind: 'fine' },
  { id: 'chairmanWedding', text: 'Must attend the chairman\'s daughter\'s wedding and do a speech', kind: 'duty' },
  { id: 'promotion', text: 'Promotion bonus: 20 weeks\' wages if the club goes up', kind: 'bonus' },
  { id: 'relegation', text: 'Relegation clause: wages cut by a quarter if the club goes down', kind: 'cut' },
  { id: 'noSki', text: 'No skiing, skydiving, bull riding or "anything Deano suggests"', kind: 'fine' },
  { id: 'loyalty', text: 'Loyalty bonus: 10 weeks\' wages for every full season you stay', kind: 'bonus' },
];
const CL = new Map(CLUB_CLAUSES.map(x => [x.id, x]));
export const clause = id => CL.get(id);

/** The clauses a club puts in an offer: 0 to 2, plus the usual bonuses. */
export function clubClauses(R = Math.random) {
  const n = R() < .3 ? 0 : R() < .7 ? 1 : 2, ids = CLUB_CLAUSES.map(x => x.id).sort(() => R() - .5);
  return ids.slice(0, n);
}
/** Standard bonuses that come with a professional contract, scaled to the wage. */
export const standardBonuses = wage => ({ appearanceFee: Math.round(wage * .08 / 5) * 5, winBonus: Math.round(wage * .12 / 5) * 5 });

/** What a match earns you under your contract. Pure: use it to preview and to pay. */
export function matchPay(c, f, S) {
  const cl = (c.contract && c.contract.clauses) || {}, out = [];
  const played = S.role === 'start' || S.role === 'sub';
  if (!played || f.comp === 'friendly' || f.comp === 'intl' || f.comp === 'tourn') {
    if (f.comp === 'intl' && played) out.push({ what: 'England match fee (donated to charity, obviously)', amount: 0 });
    return out;
  }
  if (cl.appearanceFee) out.push({ what: 'Appearance fee', amount: cl.appearanceFee });
  if (cl.winBonus && S.result === 'W') out.push({ what: 'Win bonus', amount: cl.winBonus });
  if (cl.goalBonus && S.my.goals) out.push({ what: `Goal bonus (${S.my.goals} × £${cl.goalBonus.toLocaleString('en-GB')})`, amount: cl.goalBonus * S.my.goals });
  if (cl.assistBonus && S.my.assists) out.push({ what: `Assist bonus (${S.my.assists} × £${cl.assistBonus.toLocaleString('en-GB')})`, amount: cl.assistBonus * S.my.assists });
  return out;
}

/** End of a week: the club enforces the small print. Returns [bills, notices]. */
export function clauseWeek(c, hadMatch, R = Math.random) {
  const ids = (c.contract.clauses && c.contract.clauses.club) || [], bills = [], notes = [], wage = c.contract.wage;
  const log = c.weekLog || [];
  if (ids.includes('noFriday') && hadMatch && log.some(x => x.t === 'night')) { bills.push({ what: 'Fine: night out in a match week (it\'s in your contract)', amount: wage }); notes.push('You went out in a match week. The club fined you a week\'s wages. It\'s in your contract. You signed it. In biro.'); }
  if (ids.includes('weight') && log.filter(x => x.t === 'night').length >= 2) { bills.push({ what: 'Fine: "big weekend" face', amount: 100 }); notes.push('The fitness coach looked at you, looked at his clipboard, and wrote "£100".'); }
  if (ids.includes('hair') && c.look && (c.look.colour || c.look.hair === 'mohican') && !c.flags.hairFined) { c.flags.hairFined = true; bills.push({ what: 'Fine: hair "not found in nature"', amount: 2000 }); notes.push('The club has fined you £2,000 for your hair. Your hair says it was worth it.'); }
  const month = (c.lastWeekDate || '').slice(5, 7);
  if (ids.includes('panto') && month === '12' && !c.flags['panto' + c.season]) { c.flags['panto' + c.season] = true; applyEffects(c, { fans: 3, energy: -6, teammates: 2 }); notes.push('Contractual pantomime duty: you were the back half of the horse in Cinderella. The front half was the club captain. Standing ovation.'); }
  if (ids.includes('mascot') && hadMatch && !c.flags['mascot' + c.season] && R() < .08) { c.flags['mascot' + c.season] = true; applyEffects(c, { fans: 4, energy: -4 }); notes.push('Contractual mascot duty: you spent half-time inside the club mascot costume. It smells of Bovril and sadness. The crowd loved it.'); }
  if (ids.includes('chairmanWedding') && !c.flags.chairmanWedding && R() < .03) { c.flags.chairmanWedding = true; applyEffects(c, { manager: 3, energy: -5, family: -1 }); notes.push('Contractual duty: you did a speech at the chairman\'s daughter\'s wedding. You\'d never met her. You made the bride cry (good tears, mostly).'); }
  return [bills, notes];
}
/** Summer: promotion, relegation and loyalty clauses. */
export function clauseSummer(c, mv) {
  const ids = (c.contract.clauses && c.contract.clauses.club) || [], notes = [], wage = c.contract.wage;
  if (ids.includes('promotion') && mv && mv.why !== 'relegated') { c.bank += wage * 20; notes.push(`Promotion bonus paid: £${(wage * 20).toLocaleString('en-GB')}. It's in the contract. Treat yourself. Not too much.`); }
  if (ids.includes('relegation') && mv && mv.why === 'relegated') { c.contract.wage = Math.round(wage * .75); notes.push(`Relegation clause: your wages are cut to £${c.contract.wage.toLocaleString('en-GB')} a week. Should've read the small print.`); }
  if (ids.includes('loyalty')) { c.bank += wage * 10; notes.push(`Loyalty bonus paid: £${(wage * 10).toLocaleString('en-GB')}. For staying. Which is the least you could do.`); }
  return notes;
}

/* ---------- the gaffer's verdict after a match ---------- */
const VERDICT = {
  awful: ['I\'ve seen better touches on a pinball machine.', 'You looked like a man trying to find his car keys for 90 minutes.', 'If that was a trial, you wouldn\'t get a second one. Good job it isn\'t. Yet.', 'The kit man asked if you were feeling alright. The kit man.', 'Training. Monday. 7am. Bring a sense of shame.', 'My nan could\'ve done that. My nan\'s been dead since 1998.'],
  poor: ['Not your day. Not your week, judging by that.', 'You ran about a lot. Some of it was in the right direction.', 'I\'ll be honest: I forgot you were on.', 'Bit of a passenger today. Buy a ticket next time.', 'Decent first five minutes. The other 85 need work.', 'You and the ball weren\'t on speaking terms.'],
  ok: ['Solid. Not spectacular. Solid. Like a good shed.', 'You did a job. Nobody will write songs about it, but you did a job.', 'Six out of ten. Seven if I\'m in a good mood, and I\'m not.', 'Fine. Tidy. I\'ve got no complaints, and that\'s rare.', 'You were alright. Don\'t let it go to your head.', 'Steady. I like steady. Steady wins leagues. Sometimes.'],
  good: ['That\'s more like it. Keep doing that and I\'ll learn your name.', 'Lovely stuff. The chairman even put his phone down.', 'Proper performance. I almost smiled. Almost.', 'You were a menace today. In the good way.', 'Very good. I\'m saying that once, so frame it.', 'That\'s why we signed you. Well, that and you were cheap.'],
  great: ['Unbelievable. Get yourself an ice bath and a biscuit.', 'Best I\'ve seen from you. Best I\'ve seen from anyone in that shirt this year.', 'If you play like that every week I\'ll buy you a car. I won\'t. But I\'ll think about it.', 'Absolutely outstanding. Don\'t read the papers this week, you\'ll get a big head.', 'World class. Well, division class. But top of the division.', 'Magnificent. I\'ve told the press you were "fine" so you don\'t get cocky.'],
  bench: ['Didn\'t need you today. Keep the bib warm.', 'You stayed on the bench because the game didn\'t need you. Next time it might.', 'Good warm-up. Shame about the not playing.'],
  hooked: ['I took you off because you were drowning. Better I pull you out than let you sink.', 'Nothing personal, son. Well, a bit personal.', 'Sometimes it\'s just not your day. Today was very much not your day.'],
};
export function gafferVerdict(S, R = Math.random) {
  const p = a => a[Math.floor(R() * a.length)];
  if (S.unusedSub) return p(VERDICT.bench);
  if (S.hooked) return p(VERDICT.hooked);
  const r = S.rating, band = r < 5.2 ? 'awful' : r < 6.2 ? 'poor' : r < 7.1 ? 'ok' : r < 8.1 ? 'good' : 'great';
  return p(VERDICT[band]);
}

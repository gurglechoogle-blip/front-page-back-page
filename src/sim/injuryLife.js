// Long-term injury: the telly comes calling. Things to do while you can't
// play, all of which still move your meters (and your bank balance).
import { applyEffects } from './life.js';

const pick = (a, R) => a[Math.floor(R() * a.length)];
export const LONG = 3; // weeks out before the offers start
export const longInjury = c => !!(c.injury && (c.injury.total || c.injury.weeks) >= LONG);

export const ACTIVITIES = [
  { id: 'pundit', label: 'Pundit on "Match of the Week" (Saturday night telly)', slots: 1, pay: c => 800 + Math.round(c.meters.fans * 40),
    good: ['You call a formation "a bit of a flat lasagne". It trends for two days. The producer wants you back.', 'Crisp, clever, funny. The presenter keeps glancing at you nervously. You might have a career here.'],
    bad: ['You forget the name of a player you shared a flat with. Live. The internet is merciless.', 'You call the studio sofa "comfy" four times. Nothing else. Just the sofa.'], effects: { fans: 2 }, goodFx: { honour: 1 }, badFx: { honour: -1, teammates: -1 } },
  { id: 'jungle', label: 'Reality show: "Get Me Off This Island!" (uses the rest of the week)', slots: 'all', minWeeks: 4, once: true, pay: c => 25000 + Math.round((c.followers || 0) * .05),
    good: ['You win the bushtucker trial by eating a whole sheep\'s eye without blinking. The nation falls in love. Your gaffer does not.', 'Crowned King of the Island! You cry, thank your Gran, and immediately ask if anyone has a Twix.'],
    bad: ['You complain about the rice for nine days and get voted off first. The memes will outlive you.', 'You have a row with a weather presenter about a log. Three million people take the weather presenter\'s side.'], effects: { fans: 6, manager: -6, energy: -10 }, goodFx: { honour: 3, family: 2 }, badFx: { honour: -4 } },
  { id: 'panel', label: 'Panel show: "A Question of Footy"', slots: 1, pay: () => 900,
    good: ['You get every question right on the "guess who\'s been sent off" round. Your team captain hugs you a bit too long.'], bad: ['You buzz in and say "Peter Crouch?" to a question about Formula One. It\'s wrong. It was always going to be wrong.'], effects: { fans: 2 }, goodFx: { honour: 1 }, badFx: {} },
  { id: 'badges', label: 'Coaching badges course', slots: 1, pay: () => 0,
    good: ['You learn what a "low block" is. You explain it to Deano. He nods and says "like Tetris". It is not like Tetris.'], bad: ['You fall asleep in the session on set pieces. You wake up with a whistle in your mouth. Nobody knows how.'], effects: { manager: 3 }, goodFx: { honour: 1 }, badFx: {} },
  { id: 'hospital', label: 'Visit the children\'s ward', slots: 1, pay: () => 0,
    good: ['A seven-year-old signs YOUR cast. It says "GET BETTER YOU MUPPET". It\'s the best thing anyone\'s ever written on you.'], bad: ['A kid beats you at FIFA 11 times in a row and asks if you\'re "actually a footballer". Fair question.'], effects: { honour: 3, fans: 1, family: 1 }, goodFx: {}, badFx: {} },
  { id: 'rehab', label: 'Extra rehab with the physio', slots: 1, pay: () => 0, rehab: true,
    good: ['Ice, bands, a machine that hums ominously. The physio says you\'re ahead of schedule.'], bad: ['The physio says "slow and steady". You do neither. You\'re back where you started, but with more swearing.'], effects: { manager: 1 }, goodFx: {}, badFx: {} },
  { id: 'book', label: 'Ghost-written autobiography: "My Story (So Far)"', slots: 1, once: true, career: true, pay: c => 5000 + Math.round(c.meters.fans * 500),
    good: ['It\'s a bestseller in two service stations. Chapter 7 is mostly about a sandwich.'], bad: ['Chapter 4 is about your teammates. They\'ve read chapter 4. The group chat has gone very quiet.'], effects: { fans: 2 }, goodFx: { honour: 1 }, badFx: { teammates: -5, honour: -2 } },
  { id: 'voice', label: 'Voice a character in a video game', slots: 1, pay: () => 3000,
    good: ['You play "Footballer #2". Your line is "Over here!". You nail it. Take 41.'], bad: ['They cut your line and replace you with a man who sounds more like you than you do.'], effects: { fans: 1 }, goodFx: {}, badFx: {} },
];

export function available(c, a) {
  if (!longInjury(c)) return 'Only while you\'re injured';
  if (a.minWeeks && c.injury.weeks < a.minWeeks) return 'Not enough weeks out left';
  const used = c.injuryDone || {};
  if (a.once && (a.career ? used[a.id] : used[a.id] === c.injury.id)) return 'Done';
  return null;
}
export function doActivity(c, id, slotsLeft, R = Math.random) {
  const a = ACTIVITIES.find(x => x.id === id), why = available(c, a);
  if (why) return { ok: false, why };
  const need = a.slots === 'all' ? Math.max(1, slotsLeft) : a.slots;
  if (slotsLeft < 1) return { ok: false, why: 'No time slots left this week' };
  c.slotsUsed += need; c.weekLog.push({ t: 'injuryJob', label: a.label.replace(/ \(.*\)$/, '') });
  (c.injuryDone = c.injuryDone || {})[id] = a.career ? true : c.injury.id;
  const good = R() < .55 + (c.honour - 50) / 200, pay = a.pay(c);
  c.bank += pay;
  const eff = applyEffects(c, Object.assign({}, a.effects, good ? a.goodFx : a.badFx));
  let extra = '';
  if (a.rehab && good && c.injury.weeks > 1) { c.injury.weeks--; extra = ' (A week off your recovery.)'; }
  return { ok: true, line: pick(good ? a.good : a.bad, R) + extra, pay, effects: eff };
}

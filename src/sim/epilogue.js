// The end of the game: how you're remembered, the 2046 tournament run-in,
// and "where are they now". Pure logic on the career object.
import FR from '../data/friends.json';
import NAT from '../data/nations.json';
import { club } from './season.js';
import { netWorth } from './money.js';
import { honourBadge } from './career.js';
import { ACH, seasonsAtClub } from './achievements.js';

const SCANDALS = { affair: 'the affair', bookieDebt: 'the bookie debts', cheated: 'the cheating', fixed1: 'the match-fixing', leaked: 'the leaks', tapped: 'the tapping-up', prison: 'prison', fixingBan: 'the ban' };
const pick = (a, R = Math.random) => a[Math.floor(R() * a.length)];
const money = n => '£' + Math.round(n).toLocaleString('en-GB');
export const careerGoals = c => c.totals.goals + (c.retired ? 0 : c.stats.goals);
export const scandals = c => Object.keys(SCANDALS).filter(k => c.flags[k]);

/** 'legend', 'redeemed' or 'hasbeen': how the country sees you in 2046. */
export function legacy(c) {
  const caps = c.intl ? c.intl.caps.senior : 0, golds = ACH.filter(a => a.tier === 'gold' && c.achievements && c.achievements[a.id]).length;
  const big = caps >= 25 || careerGoals(c) >= 150 || golds >= 3;
  if (scandals(c).length && c.honour >= 50) return 'redeemed';
  if (big && c.honour >= 40) return 'legend';
  return 'hasbeen';
}
export const LEGACY = {
  legend: { title: 'THE LEGEND', letter: 'You\'re 36. You\'re a legend. We\'re not picking you for your legs. We\'re picking you because the young lads are terrified of the Germans and they\'re not terrified of you. Bring your boots. And maybe a cardigan.' },
  redeemed: { title: 'THE REDEEMED', letter: 'I know what the papers said, back then. I also know what you\'ve done since. Everyone deserves a last chapter. Yours starts in Giza. Don\'t make me regret this. (The FA have asked me to add: please don\'t make us regret this.)' },
  hasbeen: { title: 'THE HAS-BEEN', letter: 'Look, I\'ll be honest. We\'ve got eleven injuries, a stomach bug and a lad who walked into a glass door. You\'re the only striker who answered the phone. You\'re 36. Can you still run? Don\'t answer that. Just come.' },
};

/** England's run to the 2046 final, with you on the bench. */
export function roadToFinal(R = Math.random) {
  const pool = NAT.nations.map(n => n.id).filter(id => id !== 'nat-eng' && id !== 'nat-ger').sort(() => R() - .5);
  const rounds = [['Group stage', '2-0'], ['Group stage', '1-1'], ['Group stage', '3-1'], ['Round of 16', '2-1'], ['Quarter-final', '1-1 (won 5-4 on penalties)'], ['Semi-final', '1-0']];
  const quips = ['You warmed up for 40 minutes. You were not brought on.', 'You did a lovely job with the water bottles.', 'The cameras kept cutting to you on the bench. You were eating a Twix.', 'The young lads asked you about the old days. You told them about the 3G pitches.', 'You were the first off the bench to celebrate. Pulled a hamstring. Kept quiet about it.', 'The manager said "not yet". You nodded like you knew what that meant.'];
  return rounds.map(([round, score], i) => ({ round, opp: club(pool[i]).name, score, quip: quips[i] }));
}

/** Your strongest shooting skill: that's the chance you get in the final. */
export function bestShot(skills) {
  const keys = ['volley', 'snapshot', 'header', 'overhead', 'penalty', 'freekick', 'turn'];
  return keys.reduce((a, k) => (skills[k] || 0) > (skills[a] || 0) ? k : a, 'volley');
}
export const FINAL_SETUP = {
  volley: 'A long throw. It drops out of the Egyptian night sky, right onto your laces.',
  snapshot: 'A scramble in the box. The ball pops loose at your feet. No time to think.',
  header: 'The last corner of the World Cup. The keeper\'s come up. You\'re at the back post.',
  overhead: 'The cross is behind you. Of course it is. There\'s only one thing for it.',
  penalty: 'The referee points to the spot! The VAR check takes four minutes. You hold the ball the whole time.',
  freekick: 'A free kick, 22 yards out. The young lads look at you. You take the ball off them.',
  turn: 'The ball\'s played into you, back to goal. The German centre-half is breathing on your neck.',
};

// Your retirement gig: a weekly column in a shouty right-wing tabloid.
export const COLUMN_TITLES = ['VAR IS CONTROLLED FROM THE MOON. I HAVE SEEN THE DOCUMENTS (A NAPKIN)', 'PIGEONS AREN\'T REAL: WHY HAS NO ONE ASKED WHERE THE BABY ONES ARE?', 'THE OFFSIDE RULE WAS INVENTED BY BIG SHIN PAD', 'WHY I\'VE STOPPED TRUSTING ROUNDABOUTS', 'MY KETTLE IS LISTENING TO ME, AND SO IS YOURS', 'THEY\'VE SHRUNK THE GOALS BY AN INCH. I MEASURED THEM WITH MY FEET', 'THE 1966 FINAL WAS FILMED IN A STUDIO IN SLOUGH', 'WHO REALLY OWNS THE CORNER FLAGS? FOLLOW THE MONEY', 'ENERGY DRINKS ARE MADE FROM RECYCLED LINESMEN', 'THE MOON IS JUST A VERY FAR AWAY FOOTBALL. WAKE UP', 'BRING BACK MUD (AND HEAVY BALLS, AND SHORTS YOU COULD SEE YOUR SOUL THROUGH)', 'GRASS IS A LIBERAL INVENTION'];
export function column(c, R = Math.random) {
  const t = COLUMN_TITLES.slice().sort(() => R() - .5).slice(0, 3);
  return `Every Sunday you write "Full Time with ${c.name.trim().split(/\s+/).pop()}" for The Daily Bulldog, a tabloid that's mostly shouting and adverts for stairlifts. Your recent columns: "${t[0]}", "${t[1]}" and "${t[2]}". The editor calls you "box office". Your mum has cancelled her subscription.`;
}
/** "Where are they now": a list of [heading, text] for the epilogue. */
export function epilogue(c, won, scored, R = Math.random) {
  const out = [], sur = c.name.trim().split(/\s+/).pop(), nw = netWorth(c), sc = scandals(c), leg = legacy(c);
  // You.
  let you = leg === 'legend' ? `${c.name} is remembered as one of the greats. There's a statue outside ${club(c.clubId).name}'s ground. It looks nothing like you. You love it.`
    : leg === 'redeemed' ? `${c.name} is the comeback story they'll make a film about. In the film you're played by someone much better looking.`
    : `${c.name} is a pub quiz answer. "Which 36-year-old came out of nowhere for the 2046 World Cup?" Most people get it wrong.`;
  if (scored && won) you += ' And of course, there\'s the goal. Every pub in England has the photo on the wall. Some have it on the ceiling.';
  else if (!scored) you += ' People still bring up the chance in Giza. You\'ve learned to smile and say "the pitch was bobbly".';
  if (c.flags.pundit >= 3) you += ' You now do the telly on Saturday nights, in a jacket you\'d never have worn as a player.';
  out.push(['You', you]);
  out.push(['Your column', column(c, R)]);
  // Love and family.
  const kids = (c.kids || []).map(k => k.name);
  let love = !c.partner ? (c.exes && c.exes.length ? `Single. ${c.exes.length} ex${c.exes.length > 1 ? 'es' : ''} watched the final. At least one cheered for Germany.` : 'Single, happily. Your mum still asks. Every Sunday.')
    : c.partner.stage === 'married' ? `Still married to ${c.partner.name}. ${c.partner.meter >= 60 ? 'Still daft about each other.' : 'It\'s been a long road. You\'re still on it, together.'}`
    : `Still with ${c.partner.name}. The wedding's "next year". It's been next year for a while.`;
  if (kids.length) love += ` ${kids.join(' and ')} ${kids.length > 1 ? 'have' : 'has'} your old boots on the bedroom wall${c.meters.family >= 55 ? ', and your number on their backs.' : '. They don\'t talk to you much. Maybe that\'s the next chapter.'}`;
  out.push(['Love and family', love]);
  out.push(['Mum and Gran', c.meters.family >= 60 ? `Mum watched the final with the whole street in her front room. Gran, 97, put a fiver on you at 40-1 and ${scored ? 'has bought a caravan with it' : 'says she\'ll get it back next time'}.` : `Mum watched alone. She rang you after. You didn't pick up. You should ring her back.`]);
  // Friends.
  const fr = Object.entries(c.friends || {}).map(([id, f]) => ({ id, name: (FR.friends.find(x => x.id === id) || {}).name || id, loyalty: f.loyalty })).sort((a, b) => b.loyalty - a.loyalty);
  if (fr.length) out.push(['Friends', `${fr[0].name} is still your best mate${fr[0].loyalty >= 70 ? ' and was there in Giza, shirt off, crying' : ''}. ${fr[fr.length - 1].loyalty < 35 ? `You and ${fr[fr.length - 1].name} don't speak any more. You both pretend not to mind.` : 'The group chat is still going. It\'s mostly photos of dogs now.'}`]);
  // Money.
  out.push(['Money', nw >= 5e7 ? `Worth ${money(nw)}. You own a vineyard. You don't like wine.` : nw >= 1e6 ? `Worth ${money(nw)}. Comfortable. You still turn the lights off when you leave a room.` : nw >= 0 ? `Worth ${money(nw)}. Not the fortune people assume. You drive a sensible car and you're fine with it.` : `Still ${money(-nw)} in debt. The man from the loan company sent a card after the final. It said "congratulations" and "we'll be in touch".`]);
  if (c.business && c.business.merch && !c.business.merch.closed) out[out.length - 1][1] += ' Your merch line is still going. The slippers are a cult classic.';
  if (c.flags.schoolBuilt) out[out.length - 1][1] += ' The school you built has your name over the door. The kids call you "the old man from the photo".';
  // Scandals.
  const past = sc.map(k => SCANDALS[k]).join(', ').replace(/, ([^,]*)$/, ' and $1');
  if (sc.length) out.push(['The past', `${past[0].toUpperCase() + past.slice(1)}. ${c.honour >= 50 ? 'The papers mention it less every year. You mention it more: in schools, as a warning.' : 'The papers still mention it. Every. Single. Time.'}`]);
  void pick;
  return out;
}
/** The numbers on the last page. */
export function finalStats(c) {
  return [['Seasons', c.totals.seasons], ['Club appearances', c.totals.apps], ['Club goals', c.totals.goals], ['England caps', c.intl ? c.intl.caps.senior : 0], ['England goals', c.intl ? c.intl.goals.senior : 0], ['Longest spell at one club', seasonsAtClub(c) + ' seasons'], ['Achievements', `${Object.keys(c.achievements || {}).length} of ${ACH.length}`], ['Honour', `${Math.round(c.honour)} (${honourBadge(c.honour)})`]];
}

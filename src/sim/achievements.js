// The trophy cabinet: 62 achievements in three tiers. checkAchievements is
// called after each match, each week, at the end of each season, and at the
// very end of the game; anything new is queued in c.achNew for a toast.
import { CAL, ABROAD, club, winnerOf } from './season.js';
import { netWorth, hasCar, item } from './money.js';
const owns = (c, cat) => (c.owned || []).filter(id => item(id) && item(id).cat === cat).length;

const CUP = ['eflcup', 'facup', 'trophy', 'natcup', 'ucl', 'uel'], EURO = ['ucl', 'uel'];
const RANK = { PL: 1, CH: 2, L1: 3, L2: 4, NL: 5 };
const SCANDALS = ['affair', 'bookieDebt', 'cheated', 'fixed1', 'leaked', 'tapped', 'prison', 'fixingBan', 'mpScandal'];
const careerGoals = c => c.totals.goals + c.stats.goals;
const won = (c, k) => c.cups && c.cups[k] && c.cups[k].won;

// [id, tier, name, how, when, test]
export const ACH = [
  ['offMark', 'bronze', 'Off the Mark', 'Score your first senior goal', 'match', (c, x) => x.senior && x.S.my.goals > 0],
  ['hatTrick', 'bronze', 'Hat-Trick Hero', 'Score three in one game', 'match', (c, x) => x.senior && x.S.my.goals >= 3],
  ['double', 'bronze', 'Double Figures', '10 goals in a season', 'week', c => c.stats.goals >= 10],
  ['brace', 'bronze', 'Brace Yourself', 'Score twice in a cup tie', 'match', (c, x) => CUP.includes(x.f.comp) && x.S.my.goals >= 2],
  ['headBoy', 'bronze', 'Head Boy', 'Score 5 headers in a season', 'week', c => c.ach.headers >= 5],
  ['bicycle', 'bronze', 'Bicycle Thief', 'Score an overhead kick in a match', 'match', (c, x) => x.senior && (x.S.my.log || []).some(l => l.key === 'overhead' && l.goal)],
  ['iceCold', 'bronze', 'Ice Cold', 'Score 5 penalties in a row', 'week', c => c.ach.pensRow >= 5],
  ['signedUp', 'bronze', 'Signed Up', 'First professional contract', 'week', c => !/scholarship|academy|youth|trial/i.test(c.contract.kind || '')],
  ['loanRanger', 'bronze', 'Loan Ranger', 'Complete a loan spell', 'season', (c, x) => x.wasLoan],
  ['upWeGo', 'bronze', 'Up We Go', 'Win promotion', 'season', (c, x) => x.mv && x.mv.why !== 'relegated'],
  ['giantKiller', 'bronze', 'Giant Killer', 'Knock a higher-division team out of the FA Cup', 'match', (c, x) => {
    if (x.f.comp !== 'facup' || !x.played || winnerOf(Object.assign({}, x.f)) !== x.team) return false;
    const opp = x.f.home === x.team ? x.f.away : x.f.home, a = RANK[club(x.team).league], b = RANK[club(opp).league];
    return a && b && b < a; }],
  ['plusOne', 'bronze', 'Plus One', 'Get your first partner', 'week', c => c.flags.firstPartner],
  ['keys', 'bronze', 'Keys to Freedom', 'Move out of your parents\' house', 'week', c => c.flags.movedOut],
  ['wheels', 'bronze', 'First Wheels', 'Buy your first car', 'week', c => hasCar(c)],
  ['goodEgg', 'bronze', 'Good Egg', 'Attend 5 charity events', 'week', c => c.charity >= 5],
  ['viral', 'bronze', 'Going Viral', 'Hit 100,000 followers', 'week', c => c.followers >= 1e5],
  ['hiredHelp', 'bronze', 'Hired Help', 'Hire your first member of staff', 'week', c => c.flags.hiredHelp || c.staff.length > 0],

  ['fifty', 'silver', 'Fifty Up', '50 career goals', 'week', c => careerGoals(c) >= 50],
  ['century', 'silver', 'Century', '100 career goals', 'week', c => careerGoals(c) >= 100],
  ['twenty', 'silver', 'Twenty Club', '20 goals in a season', 'week', c => c.stats.goals >= 20],
  ['four', 'silver', 'Four-Midable', '4 goals in one game', 'match', (c, x) => x.senior && x.S.my.goals >= 4],
  ['wembley', 'silver', 'Wembley Way', 'Score in a cup final', 'match', (c, x) => (CUP.includes(x.f.comp) || x.f.comp === 'tourn') && x.f.round === 'F' && x.S.my.goals > 0],
  ['continental', 'silver', 'Continental', 'Score in European competition', 'match', (c, x) => EURO.includes(x.f.comp) && x.S.my.goals > 0],
  ['threeLions', 'silver', 'Three Lions', 'Win your first England cap', 'week', c => c.flags.firstCap],
  ['passport', 'silver', 'Passport Stamped', 'Sign for a club abroad', 'week', c => ABROAD.includes(c.div)],
  ['silverware', 'silver', 'Silverware', 'Win the FA Cup or EFL Cup', 'season', c => won(c, 'facup') || won(c, 'eflcup')],
  ['knee', 'silver', 'Down on One Knee', 'Get engaged', 'week', c => c.flags.engaged || (c.partner && ['engaged', 'married'].includes(c.partner.stage))],
  ['familyMan', 'silver', 'Family Man', 'Have your first child', 'week', c => c.flags.parent],
  ['countryPile', 'silver', 'Country Pile', 'Own a country house and a luxury car', 'week', c => c.home === 'countryPile' && c.homeOwned && c.owned.some(id => id === 'rangeRover' || id === 'lambo')],
  ['brandNew', 'silver', 'Brand New', 'Launch a merch line that turns a profit', 'week', c => c.flags.merchProfit],
  ['cardShark', 'silver', 'Card Shark', 'Win a high-stakes poker game', 'week', c => c.flags.cardShark],
  ['pillar', 'silver', 'Pillar of the Community', 'Build a school or fund an education programme', 'week', c => c.flags.schoolBuilt],
  ['micDrop', 'silver', 'Mic Drop', 'Do a commentary stint without upsetting anyone', 'week', c => c.flags.cleanCommentary],
  ['comeback', 'silver', 'Comeback Kid', 'Recover from rock-bottom honour', 'week', c => c.ach.rockBottom && c.honour >= 55],

  ['millionaire', 'gold', 'Millionaire', 'Net worth of £1 million', 'week', c => netWorth(c) >= 1e6],
  ['goldenBoot', 'gold', 'Golden Boot', 'Top scorer in the Premier League', 'season', (c, x) => x.div === 'PL' && c.stats.goals >= 22],
  ['champion', 'gold', 'Champion', 'Win a league title', 'season', (c, x) => x.pos === 1],
  ['bigEars', 'gold', 'Big Ears', 'Win the Champions League', 'season', c => won(c, 'ucl')],
  ['dreamMove', 'gold', 'Dream Move', 'Transfer to the club you supported as a boy', 'week', c => c.flags.dreamMove],
  ['ballon', 'gold', 'Ballon d\'Or', 'Be named the world\'s best player', 'season', (c, x) => (x.div === 'PL' || ABROAD.includes(x.div)) && c.stats.goals >= 28 && x.avg >= 7.4],
  ['centurion', 'gold', 'Centurion', '100 England caps', 'week', c => c.intl && c.intl.caps.senior >= 100],
  ['oneClub', 'gold', 'One-Club Legend', 'Spend 10+ seasons at one club', 'season', c => seasonsAtClub(c) >= 10],
  ['happily', 'gold', 'Happily Ever After', 'Still married at the end of the game', 'end', c => c.partner && c.partner.stage === 'married'],
  ['saint', 'gold', 'Saint', 'Finish with maximum honour', 'end', c => c.honour >= 95],
  ['tycoon', 'gold', 'Tycoon', 'Net worth of £50 million', 'week', c => netWorth(c) >= 5e7],
  ['freeMan', 'gold', 'Free Man', 'Serve a prison sentence and come back to play again', 'week', c => c.flags.freeMan],
  ['teflon', 'gold', 'Teflon', 'Survive three major scandals without being sacked', 'week', c => SCANDALS.filter(f => c.flags[f]).length >= 3 && !c.flags.forcedOut],
  // Shopping.
  ['firstBuy', 'bronze', 'Treat Yourself', 'Buy anything from the shops', 'week', c => (c.shopping || {}).bought >= 1],
  ['giftGiver', 'bronze', 'Mum\'s Favourite', 'Buy 3 gifts for family, friends or teammates', 'week', c => ((c.shopping || {}).gifts || []).length >= 3],
  ['bestFriend', 'bronze', 'Best Friend', 'Own a pet', 'week', c => owns(c, 'pets') >= 1],
  ['dressed', 'bronze', 'Dressed to Impress', 'Own 4 things from the Look shop', 'week', c => owns(c, 'look') >= 4],
  ['petrolhead', 'silver', 'Petrolhead', 'Own 3 vehicles at once', 'week', c => (c.owned || []).filter(id => item(id) && item(id).cat === 'wheels' && id !== 'lessons').length >= 3],
  ['blingBling', 'silver', 'Bling Bling', 'Own 4 pieces of bling', 'week', c => owns(c, 'bling') >= 4],
  ['dolittle', 'silver', 'Doctor Dolittle', 'Own 4 pets at once', 'week', c => owns(c, 'pets') >= 4],
  ['gadgetGeek', 'silver', 'Gadget Geek', 'Own 6 gadgets (tech or home)', 'week', c => owns(c, 'tech') + owns(c, 'home') >= 6],
  ['bestSon', 'silver', 'Best Child Ever', 'Buy your mum a house', 'week', c => ((c.shopping || {}).gifts || []).includes('mumHouse')],
  ['bigSpender', 'silver', 'Big Spender', 'Spend £1 million in the shops', 'week', c => (c.shopping || {}).spent >= 1e6],
  ['jetSet', 'gold', 'Jet Set', 'Own a private jet or a superyacht', 'week', c => (c.owned || []).some(id => id === 'privateJet' || id === 'superyacht')],
  ['islandLife', 'gold', 'Island Life', 'Own your own island', 'week', c => (c.owned || []).includes('island')],
  ['chairman', 'gold', 'Mr Chairman', 'Buy a football club', 'week', c => (c.owned || []).includes('localClub')],
  ['collector', 'gold', 'The Collector', 'Own 40 different things at once', 'week', c => new Set(c.owned || []).size >= 40],
  ['comingHome', 'gold', 'Football\'s Coming Home', 'Score the winner in the 2046 World Cup final', 'end', (c, x) => x && x.scoredWinner],
].map(([id, tier, name, how, when, test]) => ({ id, tier, name, how, when, test }));

/** Seasons in a row at your current club (the history includes the one just finished). */
export function seasonsAtClub(c) { let n = 0; for (let i = c.history.length - 1; i >= 0 && c.history[i].club === c.clubId; i--) n++; return n; }

export function initAch(c) {
  c.achievements = c.achievements || {}; c.achNew = c.achNew || [];
  c.ach = Object.assign({ headers: 0, headSeason: null, pensRow: 0, rockBottom: false }, c.ach || {});
  return c;
}
/** Track the counters some achievements need, from a match's chance log. */
function track(c, x) {
  if (c.ach.headSeason !== CAL.season) { c.ach.headSeason = CAL.season; c.ach.headers = 0; }
  if (!x.senior) return;
  (x.S.my.log || []).forEach(l => { if (l.key === 'header' && l.goal) c.ach.headers++; if (l.key === 'penalty') c.ach.pensRow = l.goal ? c.ach.pensRow + 1 : 0; });
}
/** when: 'match' | 'week' | 'season' | 'end'. Returns the newly unlocked achievements. */
export function checkAchievements(c, when, x = {}) {
  initAch(c);
  if (when === 'match' && x.S) track(c, x);
  if (c.honour <= 15) c.ach.rockBottom = true;
  const fresh = [];
  for (const a of ACH) {
    if (c.achievements[a.id] || (a.when !== when && !(a.when === 'week' && when !== 'match'))) continue;
    let ok = false; try { ok = !!a.test(c, x); } catch (e) { ok = false; }
    if (ok) { c.achievements[a.id] = { week: c.week, season: CAL.season }; fresh.push(a); c.achNew.push(a.id); }
  }
  return fresh;
}
export const achCount = c => Object.keys(c.achievements || {}).length;

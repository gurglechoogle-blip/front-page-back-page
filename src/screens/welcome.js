// Your first day: the club's head of development sits you down and explains
// what's ahead. Shown once at the start, and kept under Football afterwards.
import { esc } from '../engine/util.js';
import { club } from '../sim/season.js';
import { managerFor } from '../sim/managers.js';
import { age, dayDate } from '../sim/career.js';
import { skillLevelExact } from '../state/gameState.js';
import { addDays } from '../sim/season.js';

const SECTIONS = [
  [16, 'At 16', ['One thing a day: train, rest, see people. Press Continue to move on a day. Matches happen on their day. Two or more drills a week and the gaffer notices.', 'Friends, dating, Gran\'s 2p poker and modest shopping. Your phone will ring with invitations: say yes and people like you more.', 'Under-21 games are where you prove yourself. Do well and you\'ll get on the bench with the first team.']],
  [17, 'At 17', ['Driving lessons, then a first car. Insurance will make you cry.', 'You can sign an agent. Without one, contracts are take it or leave it. With one, you can haggle (and they take a cut).', 'Transfer windows open up: summer and January. Loans are a good way to get real minutes.']],
  [18, 'At 18', ['Your scholarship ends and you get a first professional contract. Read the small print: clubs hold you to it.', 'Pubs, clubs and the casino. Legal now, which isn\'t the same as a good idea.', 'You can move out of your Mum\'s and rent or buy. Houses have rooms that actually do something.']],
  [null, 'As you get better', ['England call-ups, from the under-17s up. Big clubs barely hand out league minutes, so earn them.', 'Social media, sponsors, staff, merch and investments, once you\'re famous enough to matter.', 'Every few seasons there\'s a summer tournament. Be in the squad.']],
  [null, 'Risks and rewards', ['Nights out: fun, but tiredness, fines and the papers follow. In a match week, doubly so.', 'Gambling: the house always wins. Lose big and you\'re on the debt ladder: selling things, raiding savings, borrowing from people you love.', 'Honour is your public reputation. It makes the gaffer patient (or not), and some doors only open for good eggs. Scandals sink it fast; charity and keeping your word bring it back.', 'Family matters: a happy home helps you recover, and they notice when you don\'t call.']],
];

export function welcomeHTML(c, first) {
  const hod = managerFor(c.clubId + '-hod'), cl = club(c.clubId), a = age(c);
  const tag = n => n == null ? '' : n === Math.min(a, 18) ? ' (now)' : n < Math.min(a, 18) ? ' (done ✓)' : '';
  return `<div class="evvia">🏟 ${first ? 'First day at' : 'Notes from'} ${esc(cl.name)}</div><h2>${esc(hod.name)}, Head of Development</h2>
    <p class="evtext">${first ? '"Sit down, son. Phone away. Right. Here\'s how the next twenty years go, if you let them."' : `"You're ${a} now. Here's where you are, and what's next."`}</p>
    <div class="scroll welcome">${SECTIONS.map(([n, h, l]) => `<h3 class="${n != null && n < Math.min(a, 18) ? 'dim' : ''}">${esc(h + tag(n))}</h3><ul>${l.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}
    ${trainingHTML(c, a)}
    <p class="evtext">"Any questions? No? Good. These notes are under Football if you forget. You will forget."</p></div>`;
}

// How fast you climb: worked out from the game's own skill formula.
const HABITS = [
  { name: 'Casual', how: 'about 1–2 drills a week', ages: [16, 18, 22, 28, 30], cols: ['6%', '11%', '16%', '22%', '27%'], ch: 20, pl: 25, el: 30 },
  { name: 'Keen', how: 'about 3 drills a week', ages: [], cols: ['12%', '20%', '28%', '37%', '45%'], ch: 18, pl: 20, el: 22 },
  { name: 'Grinder', how: 'training on almost every free day', ages: [], cols: ['19%', '31%', '42%', '55%', '66%'], ch: 17, pl: 19, el: 20 },
];
function trainingHTML(c, a) {
  const lvl = skillLevelExact(), from = addDays(dayDate(c), -56);
  const drills = Object.entries(c.diary || {}).filter(([d]) => d >= from).reduce((n, [, e]) => n + e.filter(x => x.t === 'train').length, 0) + (c.weekLog || []).filter(x => x.t === 'train').length;
  const pace = drills / 8, h = pace < 2.2 ? HABITS[0] : pace < 3.8 ? HABITS[1] : HABITS[2];
  const when = (bar, age) => lvl >= bar ? 'you\'re there now' : age <= a ? 'any time now' : `around ${age}`;
  return `<h3>Training: how fast you climb</h3>
    <p>Every drill takes a day you could spend on something else. That's the choice: the more you train, the faster you climb, and the more your friends, your other half and your mum notice you're never around. Drills also cost energy, so training every single day without rest wrecks your form and invites injuries. Most players who go for it settle on three or four drills a week plus some rest.</p>
    <table class="lt small"><tr><th class="tn">Skill by age</th><th>18</th><th>20</th><th>22</th><th>25</th><th>28</th></tr>${HABITS.map(x => `<tr><td class="tn"><b>${x.name}</b> <small>(${x.how})</small></td>${x.cols.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</table>
    <p class="dim small">Better drill scores, a club with good coaching and a personal trainer all speed it up.</p>
    <ul><li><b>League One and below:</b> your level from day one.</li><li><b>Championship:</b> about 10% skill.</li><li><b>Premier League and Europe's big leagues:</b> about 22%.</li><li><b>The elite (Man City and co.):</b> about 30% to get a game, 35%+ to score for fun.</li></ul>
    <p><b>You:</b> ${lvl < 10 ? lvl.toFixed(1) : Math.round(lvl)}% skill, about ${pace.toFixed(1)} drills a week lately (${h.name.toLowerCase()} pace). At that rate: Championship level ${when(10, h.ch)}, Premier League level ${when(22, h.pl)}, elite level ${when(30, h.el)}.</p>`;
}

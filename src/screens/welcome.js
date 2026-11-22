// Your first day: the club's head of development sits you down and explains
// what's ahead. Shown once at the start, and kept under Football afterwards.
import { esc } from '../engine/util.js';
import { club } from '../sim/season.js';
import { managerFor } from '../sim/managers.js';
import { age } from '../sim/career.js';

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
    <p class="evtext">"Any questions? No? Good. These notes are under Football if you forget. You will forget."</p></div>`;
}

// Your first day: the club's head of development sits you down and explains
// what's ahead. Shown once at the start, and kept under Football afterwards.
import { esc } from '../engine/util.js';
import { club } from '../sim/season.js';
import { managerFor } from '../sim/managers.js';

const SECTIONS = [
  ['At 16 (now)', ['Train, rest and play: you get a few time slots a week (more in pre-season). Two or more drills a week and the gaffer notices.', 'Friends, dating, Gran\'s 2p poker and modest shopping. Your phone will ring with invitations: say yes and people like you more.', 'Under-21 games are where you prove yourself. Do well and you\'ll get on the bench with the first team.']],
  ['At 17', ['Driving lessons, then a first car. Insurance will make you cry.', 'You can sign an agent. Without one, contracts are take it or leave it. With one, you can haggle (and they take a cut).', 'Transfer windows open up: summer and January. Loans are a good way to get real minutes.']],
  ['At 18', ['Your scholarship ends and you get a first professional contract. Read the small print: clubs hold you to it.', 'Pubs, clubs and the casino. Legal now, which isn\'t the same as a good idea.', 'You can move out of your Mum\'s and rent or buy. Houses have rooms that actually do something.']],
  ['As you get better', ['England call-ups, from the under-17s up. Big clubs barely hand out league minutes, so earn them.', 'Social media, sponsors, staff, merch and investments, once you\'re famous enough to matter.', 'Every few seasons there\'s a summer tournament. Be in the squad.']],
  ['Risks and rewards', ['Nights out: fun, but tiredness, fines and the papers follow. In a match week, doubly so.', 'Gambling: the house always wins. Lose big and you\'re on the debt ladder: selling things, raiding savings, borrowing from people you love.', 'Honour is your public reputation. It makes the gaffer patient (or not), and some doors only open for good eggs. Scandals sink it fast; charity and keeping your word bring it back.', 'Family matters: a happy home helps you recover, and they notice when you don\'t call.']],
];

export function welcomeHTML(c) {
  const hod = managerFor(c.clubId + '-hod'), cl = club(c.clubId);
  return `<div class="evvia">🏟 First day at ${esc(cl.name)}</div><h2>${esc(hod.name)}, Head of Development</h2>
    <p class="evtext">"Sit down, son. Phone away. Right. Here's how the next twenty years go, if you let them."</p>
    <div class="scroll welcome">${SECTIONS.map(([h, l]) => `<h3>${esc(h)}</h3><ul>${l.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}
    <p class="evtext">"Any questions? No? Good. These notes are under Football if you forget. You will forget."</p></div>`;
}

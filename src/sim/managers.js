// Every team has its own manager: the senior gaffer, a separate U21 coach,
// and a different boss for each England side. Fixed per team id.
import WN from '../data/worldNames.json';

const FIRST = ['Terry', 'Graham', 'Steve', 'Mick', 'Dave', 'Neil', 'Gary', 'Howard', 'Ron', 'Brian', 'Kevin', 'Alan', 'Colin', 'Pete', 'Tony', 'Sean', 'Gareth', 'Ian', 'Phil', 'Keith', 'Barry', 'Lee', 'Martin', 'Sam'];
const LAST = ['Pulis', 'Hargreaves', 'Bramble', 'Crouch', 'Whitlock', 'Ashworth', 'Dunmore', 'Kettering', 'Pennock', 'Mabbutt', 'Fairclough', 'Stubbs', 'Tanner', 'Oakes', 'Haslam', 'Rudge', 'Cotterill', 'Brayford', 'Lumb', 'Snodin', 'Gorman', 'Pickles', 'Nuttall', 'Bellamy'];
const HATS = ['bucket', 'none', 'cap', 'flatcap', 'none', 'bald'];
const COATS = ['#1e2a3d', '#2b2b2b', '#3a2f24', '#16324f', '#4a4f55', '#262a1f'];
const SKINS = ['#f1c7a5', '#e9b896', '#d9a079', '#b9805a', '#8d5a3b', '#5e3b26'];
const HAIR = ['#3b2a1e', '#9c9c9c', '#d8d8d8', '#5a3a22', '#161616', '#b98b4a'];
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export function managerFor(teamId) {
  const h = hash('mgr:' + teamId), at = (a, k) => a[(h >>> k) % a.length];
  const nat = /^nat-([a-z]+)/.exec(teamId), group = nat ? WN.nations[nat[1]] : null;
  const last = group ? at(WN.groups[group], 3) : at(LAST, 3);
  const name = `${at(FIRST, 7)} ${last}`;
  const role = /-u21$/.test(teamId) ? 'U21 coach' : /^nat-eng-u/.test(teamId) ? 'England youth coach' : nat ? `${teamId === 'nat-eng' ? 'England' : 'National'} manager` : 'Manager';
  return { name, role, look: { hat: /-u21$/.test(teamId) ? 'cap' : at(HATS, 11), coat: nat === null && /-u21$/.test(teamId) ? '#2f6b3a' : at(COATS, 13), skin: at(SKINS, 17), hair: at(HAIR, 19), glasses: (h >>> 23) % 3 === 0 } };
}

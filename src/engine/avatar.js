// Little drawn faces for the people in your life, as inline SVG. Known people
// have fixed looks; anyone else gets a face built from their name.
const SKINS = ['#f1c7a5', '#e3ad86', '#c68a62', '#8d5a3b', '#5e3b26'];
const HAIRS = ['#2b1d14', '#5a3a22', '#c9a25a', '#161616', '#a0522d', '#8a8a8a', '#d8d8d8'];
const BG = ['#3b5b8c', '#7a3b6e', '#2f6b3a', '#8c5a2b', '#5b4a8c', '#2b6b6b', '#8c2b3b', '#4a5560'];
function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// style: short | long | bun | bald | cap | flat | spiky | pony | bob
const KNOWN = {
  mum: { skin: 1, hair: '#5a3a22', style: 'bob', bg: '#8c2b3b' },
  gran: { skin: 0, hair: '#d8d8d8', style: 'bun', glasses: true, bg: '#7a3b6e' },
  dennis: { skin: 0, hair: '#8a8a8a', style: 'bald', bg: '#4a5560', tache: true },
  deano: { skin: 0, hair: '#c9a25a', style: 'spiky', bg: '#8c5a2b' },
  shaz: { skin: 1, hair: '#e05a9c', style: 'long', bg: '#7a3b6e' },
  lee: { skin: 2, hair: '#161616', style: 'bald', beard: true, bg: '#2b6b6b' },
  ty: { skin: 3, hair: '#161616', style: 'cap', bg: '#3b5b8c' },
  priya: { skin: 2, hair: '#161616', style: 'long', glasses: true, bg: '#5b4a8c' },
  mo: { skin: 3, hair: '#161616', style: 'short', beard: true, bg: '#2f6b3a' },
  jess: { skin: 0, hair: '#a0522d', style: 'pony', bg: '#2f6b3a' },
  stan: { skin: 1, hair: '#d8d8d8', style: 'flat', bg: '#4a5560' },
};
const ALIAS = { 'Mum': 'mum', 'Gran': 'gran', 'Dennis (kit man)': 'dennis', 'Dennis': 'dennis', 'Deano': 'deano', 'Shaz': 'shaz', 'Big Lee': 'lee', 'Ty': 'ty', 'Priya': 'priya', 'Mo': 'mo', 'Jess': 'jess', 'Stan': 'stan' };

function looks(who) {
  const k = KNOWN[who] || KNOWN[ALIAS[who]];
  if (k) return Object.assign({ skinC: SKINS[k.skin] }, k);
  const h = hash(who), styles = ['short', 'long', 'bob', 'short', 'pony', 'spiky', 'bald', 'long'];
  return { skinC: SKINS[h % 5], hair: HAIRS[(h >>> 3) % 5], style: styles[(h >>> 6) % styles.length], glasses: (h >>> 9) % 5 === 0, beard: (h >>> 11) % 6 === 0, bg: BG[(h >>> 13) % BG.length] };
}

/** An inline SVG face. who: a known id ('mum', 'deano'...), a display name, or anything. */
export function avatar(who, size = 28) {
  if (/^(📱|💬|🏟|📞|💌)/.test(who || '')) return '';
  const L = looks(who || '?'), hc = L.hair, s = L.skinC;
  let back = '', front = '';
  if (L.style === 'long') back = `<path d="M6 16 Q6 5 16 5 Q26 5 26 16 L27 29 L5 29 Z" fill="${hc}"/>`;
  if (L.style === 'bob') back = `<path d="M7 17 Q7 6 16 6 Q25 6 25 17 L25 22 L7 22 Z" fill="${hc}"/>`;
  if (L.style === 'pony') back = `<circle cx="25" cy="10" r="3.5" fill="${hc}"/>`;
  if (L.style === 'bun') back = `<circle cx="16" cy="5" r="4" fill="${hc}"/>`;
  if (['short', 'long', 'bob', 'pony', 'bun'].includes(L.style)) front = `<path d="M9 14 Q9 7 16 7 Q23 7 23 14 Q20 10 16 10.5 Q12 10 9 14 Z" fill="${hc}"/>`;
  if (L.style === 'spiky') front = `<path d="M9 13 L10 7 L12.5 10 L14 6 L16 9.5 L18 6 L19.5 10 L22 7 L23 13 Q16 9 9 13 Z" fill="${hc}"/>`;
  if (L.style === 'bald') front = `<path d="M9.5 15 Q9 13 10 13 L10 16 Z M22.5 15 Q23 13 22 13 L22 16 Z" fill="${hc}"/><ellipse cx="13.5" cy="10" rx="2" ry="1" fill="rgba(255,255,255,.35)"/>`;
  if (L.style === 'cap') front = `<path d="M9 13 Q9 6.5 16 6.5 Q23 6.5 23 13 Z" fill="#c8202f"/><rect x="16" y="11.5" width="9" height="2" rx="1" fill="#a01a26"/>`;
  if (L.style === 'flat') front = `<ellipse cx="16.5" cy="10" rx="8" ry="3.2" fill="#6b5a45"/>`;
  const beard = L.beard ? `<path d="M10 17 Q16 26 22 17 Q22 22 16 23.5 Q10 22 10 17 Z" fill="${hc}"/>` : '';
  const tache = L.tache ? `<path d="M13 19 Q16 17.5 19 19 Q16 18.6 13 19 Z" fill="${hc}"/>` : '';
  const glasses = L.glasses ? `<g fill="none" stroke="#111" stroke-width=".9"><circle cx="13" cy="15" r="2.2"/><circle cx="19" cy="15" r="2.2"/><path d="M15.2 15 L16.8 15"/></g>` : '';
  return `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="${L.bg}"/>${back}<path d="M6 32 Q6 24 16 24 Q26 24 26 32 Z" fill="${L.bg === '#4a5560' ? '#2b3138' : 'rgba(0,0,0,.35)'}"/><rect x="14" y="20" width="4" height="5" fill="${s}"/><ellipse cx="16" cy="15" rx="7" ry="8" fill="${s}"/>${front}<circle cx="13.3" cy="15" r=".9" fill="#222"/><circle cx="18.7" cy="15" r=".9" fill="#222"/><path d="M13.8 19.2 Q16 20.6 18.2 19.2" stroke="#7a3a2a" stroke-width=".9" fill="none"/>${beard}${tache}${glasses}</svg>`;
}

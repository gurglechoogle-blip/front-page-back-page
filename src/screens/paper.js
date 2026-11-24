// THE WEEKLY SPLASH: rendering a front or back page, with a "photo" drawn in
// the game's own art style.
import { esc } from '../engine/util.js';
import { setCam } from '../engine/camera.js';
import { setCtx, drawBackground, drawPerson, ctx as liveCtx } from '../engine/draw.js';
import { playerKitFrom } from '../engine/kits.js';
import { prettyDate } from '../sim/season.js';

export function paperHTML(p, page, c) {
  const P = page === 'front' ? p.front : p.back, d = new Date(p.date + 'T12:00:00Z');
  const dateText = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const side = page === 'front'
    ? `<p class="psub">${esc(P.sub)}</p><div class="pbox">${esc(p.dennis)}</div><div class="pbox">${esc(p.gran)}</div>`
    : `<p class="psub">${esc(P.sub)}</p>${P.quote ? `<blockquote>${esc(P.quote)}</blockquote>` : ''}${P.rival ? `<div class="pbox"><b>Elsewhere:</b> ${esc(P.rival)}</div>` : ''}${P.pos ? `<div class="pbox"><b>${esc(P.div)}:</b> ${esc(c.name)}'s side sit ${P.pos}${['th', 'st', 'nd', 'rd'][P.pos % 10 > 3 || [11, 12, 13].includes(P.pos % 100) ? 0 : P.pos % 10]}.</div>` : ''}`;
  return `<div class="paper ${page}">
    <div class="mast"><b>${esc(p.masthead)}</b><span>No. ${p.n} · ${dateText} · ${esc(p.price)}</span></div>
    <div class="pagelabel">${page === 'front' ? (p.front.series ? esc(p.front.series) : p.front.photo === 'scandal' ? 'EXCLUSIVE' : 'NEWS') : 'SPORT'}</div>
    <h1 class="ph">${esc(P.headline)}</h1>
    <div class="pbody"><canvas class="pphoto ${page === 'front' && p.front.photo === 'scandal' ? 'pap' : ''}" width="800" height="600"></canvas><div class="pcol">${side}</div></div>
  </div>`;
}

/** Draw the photo into the page's canvas. */
export function paperPhotos(root, p, page, c) {
  const cv = root.querySelector('.pphoto'); if (!cv) return;
  const keep = liveCtx, x = cv.getContext('2d'), kit = playerKitFrom(p.kit || { shirt: '#c8202f', trim: '#fff', shorts: '#fff', socks: '#c8202f' });
  setCam('def'); setCtx(x); drawBackground();
  const key = page === 'front' ? p.front.photo : p.back.photo;
  const happy = ['hattrick', 'brace', 'winner', 'scored', 'u21', 'assist'].includes(key), sad = ['blank', 'cupOut', 'scoredLost', 'dropped'].includes(key);
  if (key === 'saga-clint' || key === 'saga-all') {
    // Clint: a ginger cat, looking pleased with himself.
    const cat = (cx, cy, k) => {
      x.save(); x.translate(cx, cy); x.scale(k, k); x.fillStyle = '#e0812b';
      x.beginPath(); x.ellipse(0, 10, 30, 22, 0, 0, 7); x.fill(); // body
      x.beginPath(); x.arc(0, -22, 18, 0, 7); x.fill(); // head
      x.beginPath(); x.moveTo(-16, -30); x.lineTo(-12, -48); x.lineTo(-3, -36); x.moveTo(16, -30); x.lineTo(12, -48); x.lineTo(3, -36); x.fill(); // ears
      x.strokeStyle = '#e0812b'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(26, 22); x.quadraticCurveTo(58, 18, 50, -14); x.stroke(); // tail
      x.strokeStyle = '#b25a14'; x.lineWidth = 3; [-10, 0, 10].forEach(d => { x.beginPath(); x.moveTo(d - 6, 0); x.lineTo(d + 6, 4); x.stroke(); }); // stripes
      x.fillStyle = '#1a1a1a'; x.beginPath(); x.ellipse(-7, -24, 3, 1.6, .15, 0, 7); x.ellipse(7, -24, 3, 1.6, -.15, 0, 7); x.fill(); // smug half-closed eyes
      x.strokeStyle = '#1a1a1a'; x.lineWidth = 1.5; x.beginPath(); x.arc(0, -16, 5, .2, Math.PI - .2); x.stroke(); // smirk
      x.strokeStyle = '#fff'; x.lineWidth = 1; [-1, 1].forEach(sd => [-3, 1].forEach(dy => { x.beginPath(); x.moveTo(sd * 8, -17 + dy); x.lineTo(sd * 24, -19 + dy * 2); x.stroke(); }));
      x.restore();
    };
    if (key === 'saga-all') {
      drawPerson({ x: -1.4, z: .02, kit: playerKitFrom({ shirt: '#1d1d24', trim: '#fff', shorts: '#1d1d24', socks: '#111' }), armL: .3, armR: -1.2 });
      drawPerson({ x: 1.4, z: .02, kit: playerKitFrom({ shirt: '#8a6a3c', trim: '#5a4422', shorts: '#4a5a7a', socks: '#777' }), armL: 2.6, armR: -2.6, ang: .15 });
      cat(400, 470, 2);
    } else cat(400, 330, 4);
  } else if (key === 'saga-carr') {
    // Joseph Carr, Esq.: sharp black suit, one hand in pocket, admiring himself.
    drawPerson({ x: 0, z: .02, kit: playerKitFrom({ shirt: '#1d1d24', trim: '#fff', shorts: '#1d1d24', socks: '#111' }), armL: .1, armR: -1.3 });
  } else if (key === 'saga-loveday') {
    // J.A. Loveday: cardigan, mid-calamity.
    drawPerson({ x: 0, z: .02, kit: playerKitFrom({ shirt: '#8a6a3c', trim: '#5a4422', shorts: '#4a5a7a', socks: '#777' }), armL: 2.9, armR: -2.4, ang: .35, legL: .5, legR: -.4 });
  } else if (key === 'filler') {
    // A seagull. With a chip.
    x.save(); x.translate(400, 300); x.scale(3, 3); x.fillStyle = '#f4f4f4'; x.beginPath(); x.ellipse(0, 0, 26, 14, 0, 0, 7); x.fill();
    x.beginPath(); x.arc(22, -14, 10, 0, 7); x.fill(); x.fillStyle = '#9aa3ad'; x.beginPath(); x.ellipse(-6, -4, 18, 7, -.3, 0, 7); x.fill();
    x.fillStyle = '#f2c230'; x.beginPath(); x.moveTo(30, -14); x.lineTo(44, -10); x.lineTo(30, -9); x.fill(); x.fillStyle = '#ffd56b'; x.fillRect(40, -13, 14, 3);
    x.fillStyle = '#111'; x.beginPath(); x.arc(25, -17, 1.6, 0, 7); x.fill(); x.strokeStyle = '#f2c230'; x.lineWidth = 2; x.beginPath(); x.moveTo(-4, 12); x.lineTo(-6, 26); x.moveTo(6, 12); x.lineTo(8, 26); x.stroke(); x.restore();
  } else {
    const pose = happy ? { armL: 2.8, armR: -2.8, lift: .15, legL: .3, legR: -.25 } : sad ? { armL: 2.6, armR: -2.6, scaleY: .9, ang: .12 } : key === 'scandal' ? { armL: 1.2, armR: -.3, ang: -.15, legL: .2 } : { armL: .2, armR: -.2 };
    drawPerson(Object.assign({ x: 0, z: .02, kit, facing: happy ? 'back' : 'front' }, pose));
    if (key === 'scandal') { x.fillStyle = '#ff7a1a'; x.beginPath(); x.moveTo(380, 70); x.lineTo(420, 70); x.lineTo(400, 10); x.fill(); x.fillStyle = '#fff'; x.fillRect(385, 50, 30, 6); } // the traffic cone
  }
  if (keep) setCtx(keep);
  void prettyDate;
}

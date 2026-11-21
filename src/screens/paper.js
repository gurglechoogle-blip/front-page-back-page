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
    : `<p class="psub">${esc(P.sub)}</p>${P.quote ? `<blockquote>${esc(P.quote)}</blockquote>` : ''}${P.pos ? `<div class="pbox"><b>${esc(P.div)}:</b> ${esc(c.name)}'s side sit ${P.pos}${['th', 'st', 'nd', 'rd'][P.pos % 10 > 3 || [11, 12, 13].includes(P.pos % 100) ? 0 : P.pos % 10]}.</div>` : ''}`;
  return `<div class="paper ${page}">
    <div class="mast"><b>${esc(p.masthead)}</b><span>No. ${p.n} · ${dateText} · ${esc(p.price)}</span></div>
    <div class="pagelabel">${page === 'front' ? (p.front.photo === 'scandal' ? 'EXCLUSIVE' : 'NEWS') : 'SPORT'}</div>
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
  if (key === 'filler') {
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

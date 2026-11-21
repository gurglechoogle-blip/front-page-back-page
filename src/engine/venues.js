// Scenery behind the goal, by venue. Everything here sits above the pitch's
// horizon, so the camera, pitch lines and goal never move. Drawn in a
// 800x262 space (the background builder lines it up for each camera).
// 'park' (the rec) is drawn by draw.js exactly as in the prototype.
import { SKINS } from './kits.js';

/** Pitch quality per tier: grass colours, mowing stripes, mud, puddles, line paint, litter. */
export const PITCH = {
  park: { grass: ['#6d8b48', '#52762f'], stripes: .035, mud: 40, puddles: 6, lines: .5, litter: true },
  lower: { sky: '#8d9fb2', grass: ['#678c45', '#4d7530'], stripes: .05, mud: 16, puddles: 2, lines: .6, litter: true, wear: .8 },
  trainMid: { sky: '#90a6bb', grass: ['#6a9246', '#4f7a31'], stripes: .05, mud: 10, puddles: 1, lines: .6, litter: false, wear: .5 },
  champ: { sky: '#8ea7c0', grass: ['#5f9443', '#447a2c'], stripes: .07, mud: 4, puddles: 0, lines: .75, litter: false, wear: .35 },
  prem: { sky: '#86a8cc', grass: ['#58a043', '#3b8228'], stripes: .1, mud: 0, puddles: 0, lines: .9, litter: false, wear: 0 },
  trainElite: { sky: '#88aad0', grass: ['#5aa245', '#3d842a'], stripes: .1, mud: 0, puddles: 0, lines: .85, litter: false, wear: 0 },
};

const pickR = (a, R) => a[Math.floor(R() * a.length)];
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; const m = v => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); return `rgb(${m(r)},${m(g)},${m(b)})`; };

/** Rows of fans. palettes: arrays of shirt colours to sample from, split left/right if two. */
function crowd(c, R, x0, x1, top, bottom, rows, density, palettes, seat) {
  const rh = (bottom - top) / rows, w = rh * .8;
  c.fillStyle = seat; c.fillRect(x0, top, x1 - x0, bottom - top);
  for (let r = 0; r < rows; r++) {
    const y = top + r * rh;
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x0, y + rh - 1, x1 - x0, 1);
    for (let x = x0 + (r % 2) * w * .5; x < x1 - w * .5; x += w) {
      if (R() > density) continue;
      const pal = palettes.length > 1 && x > (x0 + x1) / 2 ? palettes[1] : palettes[0];
      c.fillStyle = R() < .78 ? pickR(pal, R) : pickR(['#2b2f35', '#4a4f57', '#6b5a48', '#e8e8e8'], R);
      c.fillRect(x + w * .1, y + rh * .45, w * .8, rh * .55);
      c.fillStyle = pickR(SKINS, R); c.beginPath(); c.arc(x + w * .5, y + rh * .32, rh * .2, 0, 7); c.fill();
      if (R() < .04) { c.fillStyle = pickR(pal, R); c.fillRect(x - w * .2, y - rh * .2, w * 1.4, rh * .3); } // scarf held up
    }
  }
}
function boards(c, R, y, h, ads, led) {
  let x = -10, i = Math.floor(R() * ads.length);
  while (x < 810) {
    const [txt, bgc, fg] = ads[i++ % ads.length], w = 128;
    c.fillStyle = bgc; c.fillRect(x, y, w - 2, h);
    if (led) { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,.25)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x, y, w - 2, h); }
    c.fillStyle = fg; c.font = `bold ${Math.round(h * .55)}px Roboto Condensed, Arial`; c.textAlign = 'center'; c.fillText(txt, x + w / 2, y + h * .72);
    x += w;
  }
}
function pylon(c, x, top, bottom) {
  c.strokeStyle = '#5b636c'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x - 9, bottom); c.lineTo(x - 3, top + 20); c.moveTo(x + 9, bottom); c.lineTo(x + 3, top + 20); c.stroke();
  c.lineWidth = 1; for (let y = top + 24; y < bottom; y += 14) { const k = (y - top) / (bottom - top), a = 3 + 6 * k; c.beginPath(); c.moveTo(x - a, y); c.lineTo(x + a, y + 14); c.moveTo(x + a, y); c.lineTo(x - a, y + 14); c.stroke(); }
  c.fillStyle = '#3c434b'; c.fillRect(x - 20, top, 40, 22);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { c.fillStyle = '#fffbe0'; c.fillRect(x - 17 + i * 9, top + 3 + j * 9, 7, 7); }
}
function roof(c, x0, x1, y, h, col, fascia, name) {
  c.fillStyle = col; c.fillRect(x0, y, x1 - x0, h);
  c.fillStyle = fascia.shirt; c.fillRect(x0, y + h - 9, x1 - x0, 9);
  if (name) { c.fillStyle = fascia.trim; c.font = 'bold 8px Roboto Condensed, Arial'; c.textAlign = 'center'; for (let x = 160; x < x1; x += 320) c.fillText(name, x, y + h - 2); }
}
const LOCAL = [['DAVE\'S TYRES', '#f2c230', '#1d1d1d'], ['KEBAB KINGDOM', '#c42a1d', '#fff'], ['PLUMB PERFECT', '#1f4e9a', '#fff'], ['LUCKY STAR CHIPPY', '#2e7d32', '#ffe27a'], ['BOB\'S SKIPS', '#ffffff', '#c42a1d'], ['SEXTON & SONS', '#2b2f35', '#e8e8e8']];
const NATIONAL = [['BURGER BARN', '#c42a1d', '#ffe27a'], ['FLOGIT.COM', '#1f4e9a', '#fff'], ['TURBO ENERGY', '#111', '#8fdc5a'], ['GLOBAL INSURANCE', '#ffffff', '#1f4e9a'], ['PIEFACE', '#f2c230', '#1d1d1d']];
const GLOBAL = [['ZOOMPAY', '#2b1a7a', '#7af0ff'], ['SPLENDID AIR', '#7a0f2a', '#ffd76a'], ['CRYPTOBANK 3000', '#0b0b0b', '#f2c230'], ['HYPERDRIVE', '#0a3d62', '#ffffff'], ['MEGAPHONE MOBILE', '#c2185b', '#ffffff']];

export function drawVenue(c, V, R) {
  const col = V.colours || { shirt: '#c8202f', trim: '#ffffff' };
  const pal = [col.shirt, col.shirt, shade(col.shirt, -.25), col.trim];
  const pals = V.away ? [pal, [V.away.shirt, V.away.shirt, shade(V.away.shirt, -.25), V.away.trim]] : [pal];
  const NAME = (V.name || '').toUpperCase();
  if (V.tier === 'lower') {
    for (let x = -20; x < 820; x += 46) { c.fillStyle = pickR(['#8d5a44', '#9a6248', '#7f4f3c'], R); c.fillRect(x, 150, 44, 40); c.fillStyle = '#4b4e57'; c.beginPath(); c.moveTo(x - 2, 150); c.lineTo(x + 8, 138); c.lineTo(x + 38, 138); c.lineTo(x + 46, 150); c.fill(); }
    c.fillStyle = 'rgba(210,220,228,.3)'; c.fillRect(0, 100, 800, 100);
    pylon(c, 34, 36, 236); pylon(c, 766, 36, 236);
    roof(c, 80, 720, 112, 22, '#5d646c', col, NAME);
    crowd(c, R, 80, 720, 134, 234, 9, .38, pals, '#3a3f45');
    c.fillStyle = '#6d747c'; for (let x = 80; x <= 720; x += 128) c.fillRect(x, 134, 4, 100);
    boards(c, R, 234, 22, LOCAL, false); c.fillStyle = '#8b9097'; c.fillRect(0, 256, 800, 6);
  } else if (V.tier === 'champ') {
    roof(c, -10, 810, 40, 26, '#4a5058', col, NAME);
    for (let x = 30; x < 800; x += 70) { c.fillStyle = '#fffbe0'; c.fillRect(x, 42, 18, 6); }
    crowd(c, R, -10, 810, 66, 146, 10, .62, pals, shade(col.shirt, -.55));
    c.fillStyle = col.shirt; c.fillRect(-10, 146, 820, 10); c.fillStyle = col.trim; c.font = 'bold 8px Roboto Condensed, Arial'; c.textAlign = 'center'; c.fillText(NAME + ' · ' + NAME, 400, 154);
    crowd(c, R, -10, 810, 156, 234, 10, .66, pals, shade(col.shirt, -.45));
    boards(c, R, 234, 23, NATIONAL, true); c.fillStyle = '#2b2f35'; c.fillRect(0, 257, 800, 5);
  } else if (V.tier === 'prem') {
    if (/WEMBLEY/.test(NAME)) { c.strokeStyle = '#f4f4f4'; c.lineWidth = 6; c.beginPath(); c.ellipse(400, 60, 470, 140, 0, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); c.lineWidth = 1; c.strokeStyle = '#c9ced4'; for (let i = 0; i < 40; i++) { const a = Math.PI * (1.1 + i * .02); c.beginPath(); c.moveTo(400 + 470 * Math.cos(a), 60 + 140 * Math.sin(a)); c.lineTo(400 + 470 * Math.cos(a), 30); c.stroke(); } }
    c.fillStyle = '#2a2f36'; c.fillRect(-10, 8, 820, 24); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; for (let x = 0; x < 800; x += 26) { c.beginPath(); c.moveTo(x, 8); c.lineTo(x + 13, 32); c.lineTo(x + 26, 8); c.stroke(); }
    for (let x = 20; x < 800; x += 46) { const g = c.createRadialGradient(x, 30, 1, x, 30, 18); g.addColorStop(0, 'rgba(255,252,220,.9)'); g.addColorStop(1, 'rgba(255,252,220,0)'); c.fillStyle = g; c.fillRect(x - 18, 22, 36, 26); }
    crowd(c, R, -10, 810, 32, 118, 13, .9, pals, shade(col.shirt, -.6));
    c.fillStyle = '#0b0d10'; c.fillRect(300, 40, 200, 58); c.fillStyle = shade(col.shirt, -.2); c.fillRect(304, 44, 192, 50);
    c.fillStyle = '#fff'; c.font = 'italic 22px Anton, Impact, sans-serif'; c.textAlign = 'center'; c.fillText(NAME.length > 18 ? NAME.split(' ')[0] : NAME, 400, 72); c.font = 'bold 9px Roboto Condensed, Arial'; c.fillText('PLEASE REMAIN SEATED (YOU WON\'T)', 400, 87);
    c.fillStyle = '#1b2026'; c.fillRect(-10, 118, 820, 18);
    for (let x = 0; x < 800; x += 22) { c.fillStyle = R() < .7 ? 'rgba(255,240,200,.75)' : 'rgba(120,160,200,.5)'; c.fillRect(x + 2, 121, 18, 12); }
    crowd(c, R, -10, 810, 136, 234, 12, .92, pals, shade(col.shirt, -.5));
    boards(c, R, 234, 24, GLOBAL, true); c.fillStyle = '#14171a'; c.fillRect(0, 258, 800, 4);
  } else if (V.tier === 'trainMid') {
    for (let i = 0; i < 22; i++) { const x = R() * 800, y = 200 + R() * 20, r = 16 + R() * 18; c.fillStyle = R() < .5 ? '#3f5c38' : '#4b6b40'; for (let j = 0; j < 4; j++) { c.beginPath(); c.arc(x + (R() - .5) * r * 1.4, y - R() * r * .8, r * .7, 0, 7); c.fill(); } }
    [[90, 176, 120, '#e8ecef'], [220, 186, 100, '#cfd8e0'], [90, 150, 120, '#dfe5ea']].forEach(([x, y, w, f]) => { c.fillStyle = f; c.fillRect(x, y, w, 26); c.fillStyle = '#8a929c'; c.fillRect(x, y, w, 3); for (let k = x + 10; k < x + w - 10; k += 24) { c.fillStyle = '#6fa3c9'; c.fillRect(k, y + 8, 14, 10); } });
    c.fillStyle = col.shirt; c.fillRect(520, 190, 200, 26); c.fillStyle = col.trim; c.font = 'bold 10px Roboto Condensed, Arial'; c.textAlign = 'center'; c.fillText(NAME + ' TRAINING GROUND', 620, 202); c.font = '8px Roboto Condensed, Arial'; c.fillText('Please shut the gate. And the kit room.', 620, 212);
    c.fillStyle = '#333'; c.fillRect(530, 216, 3, 30); c.fillRect(707, 216, 3, 30);
    c.strokeStyle = 'rgba(40,70,50,.8)'; c.lineWidth = 1; for (let x = 0; x < 800; x += 5) { c.beginPath(); c.moveTo(x, 226); c.lineTo(x + 5, 262); c.moveTo(x + 5, 226); c.lineTo(x, 262); c.stroke(); }
    c.fillStyle = '#2e4a3b'; for (let x = 0; x < 800; x += 80) c.fillRect(x, 222, 3, 40); c.fillRect(0, 222, 800, 3);
  } else if (V.tier === 'trainElite') {
    for (let i = 0; i < 26; i++) { const x = R() * 800, y = 170 + R() * 30, r = 20 + R() * 22; c.fillStyle = R() < .5 ? '#365a33' : '#44703d'; for (let j = 0; j < 4; j++) { c.beginPath(); c.arc(x + (R() - .5) * r * 1.4, y - R() * r * .9, r * .7, 0, 7); c.fill(); } }
    const bx = 400, bw = 380, by = 128;
    c.fillStyle = '#d9dee3'; c.fillRect(bx, by, bw, 104);
    for (let x = bx + 8; x < bx + bw - 8; x += 30) { const g = c.createLinearGradient(x, by, x + 26, by + 90); g.addColorStop(0, '#9cc6e6'); g.addColorStop(.5, '#5d8fb8'); g.addColorStop(1, '#3d6a91'); c.fillStyle = g; c.fillRect(x, by + 22, 26, 76); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x + 3, by + 24, 6, 70); }
    c.fillStyle = col.shirt; c.fillRect(bx, by, bw, 18); c.fillStyle = col.trim; c.font = 'bold 11px Roboto Condensed, Arial'; c.textAlign = 'center'; c.fillText(NAME + ' PERFORMANCE CENTRE', bx + bw / 2, by + 13);
    c.fillStyle = '#7ab04a'; c.fillRect(0, 232, 800, 26); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(0, 238, 800, 1);
    c.strokeStyle = '#f4f4f4'; c.lineWidth = 2; c.strokeRect(80, 216, 70, 24); c.strokeRect(300, 220, 40, 16);
    for (let i = 0; i < 5; i++) { const x = 170 + i * 22; c.fillStyle = col.shirt; c.fillRect(x, 222, 10, 24); c.fillStyle = '#e9b896'; c.beginPath(); c.arc(x + 5, 218, 5, 0, 7); c.fill(); }
    for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#ff7a1a' : '#ffd21a'; c.beginPath(); c.moveTo(380 + i * 30, 256); c.lineTo(385 + i * 30, 246); c.lineTo(390 + i * 30, 256); c.fill(); }
    c.strokeStyle = 'rgba(30,40,45,.18)'; c.lineWidth = 1; for (let x = 0; x < 800; x += 6) { c.beginPath(); c.moveTo(x, 110); c.lineTo(x, 262); c.stroke(); } c.fillStyle = 'rgba(43,47,53,.55)'; for (let x = 60; x < 800; x += 230) c.fillRect(x, 106, 2, 156);
  }
}

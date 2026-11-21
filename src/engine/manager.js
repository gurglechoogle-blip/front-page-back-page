// The gaffer in his technical area. Same flat style as the players.
// mood: ecstatic | happy | neutral | worried | furious. t: seconds (for idle motion).

export function drawManager(c, W, H, mood, t, scarf = '#c8202f', look = {}) {
  c.clearRect(0, 0, W, H);
  // dugout backdrop
  let g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a434d'); g.addColorStop(.62, '#22282e'); g.addColorStop(.62, '#5d7f3c'); g.addColorStop(1, '#4b6b30'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(190,220,240,.12)'; c.beginPath(); c.moveTo(0, 18); c.quadraticCurveTo(W / 2, -6, W, 18); c.lineTo(W, 40); c.quadraticCurveTo(W / 2, 16, 0, 40); c.fill();
  for (let i = 0; i < 6; i++) { c.fillStyle = '#2d343b'; c.fillRect(8 + i * (W - 16) / 6, H * .5, (W - 16) / 6 - 4, 10); c.fillStyle = '#c42a1d'; c.fillRect(8 + i * (W - 16) / 6, H * .5 - 12, (W - 16) / 6 - 4, 12); }
  c.strokeStyle = 'rgba(255,255,255,.6)'; c.setLineDash([6, 5]); c.lineWidth = 2; c.strokeRect(14, H * .7, W - 28, H * .26); c.setLineDash([]);

  const u = H / 2.7, cx = W / 2;
  let bob = Math.sin(t * 2) * .01 * u, lift = 0;
  if (mood === 'ecstatic') lift = Math.abs(Math.sin(t * 7)) * .16 * u;
  if (mood === 'furious') bob = Math.sin(t * 15) * .025 * u;
  const by = H - 10 - lift;
  // shadow
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(cx, H - 10, .32 * u * (1 - lift / u), .07 * u, 0, 0, 7); c.fill();
  c.save(); c.translate(cx + bob, by);
  const R = (x, y, w, h, r, f) => { c.fillStyle = f; c.beginPath(); if (c.roundRect) c.roundRect(x * u, y * u, w * u, h * u, r * u); else c.rect(x * u, y * u, w * u, h * u); c.fill(); };
  const skin = mood === 'furious' ? '#e58a74' : (look.skin || '#e9b896'), coat = look.coat || '#1e2a3d', hat = look.hat || 'bucket', hair = look.hair || '#3b2a1e';
  // legs
  const legSpread = mood === 'ecstatic' ? .2 : mood === 'furious' ? .12 : .05;
  [[-.1, legSpread], [.1, -legSpread]].forEach(([x, a]) => { c.save(); c.translate(x * u, -.85 * u); c.rotate(a); R(-.08, 0, .16, .78, .04, '#23262b'); R(-.1, .74, .22, .1, .05, '#111'); c.restore(); });
  // arms (behind coat when crossed? draw after coat)
  const arm = (sx, a, len) => { c.save(); c.translate(sx * u, -1.42 * u); c.rotate(a); c.scale(1, len || 1); R(-.075, 0, .15, .5, .06, coat); R(-.06, .48, .12, .12, .06, skin); c.restore(); };
  const sw = Math.sin(t * 10);
  const arms = { ecstatic: [[2.7], [-2.7]], happy: [[.25], [-2.5]], neutral: [[-1.35, .78], [1.35, .78]], worried: [[3.39, .74], [-3.39, .74]], furious: [[1.7 + sw * .6], [-1.7 - Math.sin(t * 10 + 1.3) * .6]] }[mood] || [[.2], [-.2]];
  const crossed = mood === 'neutral';
  if (!crossed) { arm(-.27, arms[0][0], arms[0][1]); arm(.27, arms[1][0], arms[1][1]); }
  // coat, scarf
  R(-.28, -1.55, .56, .82, .1, coat); R(-.02, -1.5, .04, .72, 0, '#151d2b');
  R(-.2, -1.56, .4, .11, .05, scarf); R(.06, -1.5, .1, .38, .03, scarf); R(.06, -1.16, .1, .04, 0, '#fff');
  if (crossed) { arm(-.27, arms[0][0], arms[0][1]); arm(.27, arms[1][0], arms[1][1]); }
  // head
  R(-.06, -1.66, .12, .12, .02, skin);
  c.fillStyle = skin; c.beginPath(); c.arc(0, -1.8 * u, .16 * u, 0, 7); c.fill();
  // face
  const ey = -1.8 * u, ex = .055 * u;
  c.fillStyle = '#222'; c.beginPath(); c.arc(-ex, ey, .017 * u, 0, 7); c.arc(ex, ey, .017 * u, 0, 7); c.fill();
  c.strokeStyle = '#3b2a1e'; c.lineWidth = Math.max(1.5, .018 * u); c.lineCap = 'round';
  const brow = { ecstatic: .03, happy: .01, neutral: 0, worried: -.05, furious: .07 }[mood] || 0;
  c.beginPath(); c.moveTo(-ex - .035 * u, ey - .045 * u + brow * u); c.lineTo(-ex + .03 * u, ey - .045 * u - brow * u); c.moveTo(ex + .035 * u, ey - .045 * u + brow * u); c.lineTo(ex - .03 * u, ey - .045 * u - brow * u); c.stroke();
  const my = -1.71 * u; c.strokeStyle = 'rgba(70,20,20,.85)';
  if (mood === 'ecstatic' || mood === 'furious') { c.fillStyle = '#5a1414'; c.beginPath(); if (mood === 'ecstatic') { c.moveTo(-.05 * u, my - .01 * u); c.quadraticCurveTo(0, my + .08 * u, .05 * u, my - .01 * u); c.closePath(); } else c.ellipse(0, my + .005 * u, .035 * u, .028 * u + Math.abs(sw) * .01 * u, 0, 0, 7); c.fill(); }
  else { c.beginPath(); const k = { happy: .035, neutral: 0, worried: -.03 }[mood] || 0; c.moveTo(-.045 * u, my); c.quadraticCurveTo(0, my + k * u, .045 * u, my); c.stroke(); }
  if (look.glasses) { c.strokeStyle = '#111'; c.lineWidth = Math.max(1.2, .012 * u); c.beginPath(); c.arc(-ex, ey, .04 * u, 0, 7); c.moveTo(ex + .04 * u, ey); c.arc(ex, ey, .04 * u, 0, 7); c.moveTo(-ex + .04 * u, ey); c.lineTo(ex - .04 * u, ey); c.stroke(); }
  if (hat === 'cap') { c.fillStyle = scarf; c.beginPath(); c.arc(0, -1.86 * u, .155 * u, Math.PI, 0); c.fill(); R(0, -1.9, .26, .04, .02, scarf); }
  else if (hat === 'flatcap') { c.fillStyle = '#6b5a45'; c.beginPath(); c.ellipse(.02 * u, -1.92 * u, .19 * u, .07 * u, -.1, 0, 7); c.fill(); R(.02, -1.92, .2, .035, .02, '#5a4a38'); }
  else if (hat === 'none') { c.fillStyle = hair; c.beginPath(); c.arc(0, -1.86 * u, .155 * u, Math.PI, 0); c.fill(); }
  else if (hat === 'bald') { c.fillStyle = hair; c.fillRect(-.16 * u, -1.86 * u, .05 * u, .07 * u); c.fillRect(.11 * u, -1.86 * u, .05 * u, .07 * u); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-.04 * u, -1.92 * u, .05 * u, .02 * u, 0, 0, 7); c.fill(); }
  // bucket hat with a fly on it
  else if (!(mood === 'furious' && Math.floor(t * 1.2) % 4 === 3)) {
    c.fillStyle = '#6b7a4a'; c.beginPath(); c.ellipse(0, -1.9 * u, .24 * u, .05 * u, 0, 0, 7); c.fill();
    R(-.15, -2.06, .3, .17, .06, '#7d8c56'); R(-.15, -1.95, .3, .03, 0, '#4f5a36');
    c.fillStyle = '#d23a3a'; c.beginPath(); c.arc(.08 * u, -2.0 * u, .025 * u, 0, 7); c.fill(); c.fillStyle = '#f0c419'; c.fillRect(.095 * u, -2.02 * u, .05 * u, .012 * u);
  } else { c.fillStyle = '#3b2a1e'; c.beginPath(); c.arc(0, -1.86 * u, .15 * u, Math.PI, 0); c.fill(); }
  c.restore();
  if (mood === 'furious') { c.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 3; i++) { const p = (t * .8 + i / 3) % 1; c.beginPath(); c.arc(cx + (i - 1) * 18 + Math.sin(t * 3 + i) * 4, by - 2.1 * u - p * 30, 5 + p * 6, 0, 7); c.fill(); } }
}

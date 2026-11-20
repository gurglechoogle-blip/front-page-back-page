// Side-by-side check: runs the v1.1 prototype and the rebuilt training ground
// with identical seeded randomness, a fixed 60fps clock and identical scripted
// inputs, hashing the canvas every frame. Any difference is reported.
//   node tools/compare.mjs [baseUrl] [seed]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright'); // npm i -D playwright (or set NODE_PATH to a global install)
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = process.argv[2] || 'http://localhost:5173/';
const SEEDS = (process.argv[3] || '12345,777,4242').split(',').map(Number);
const DRILLS = ['volley', 'snapshot', 'header', 'overhead', 'penalty', 'freekick', 'turn', 'passing', 'crossing'];

const init = seed => {
  let a = seed; Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let T = 0, q = [];
  performance.now = () => T;
  window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
  window.__step = () => { T += 1000 / 60; const c = q; q = []; c.forEach(f => f(T)); };
};

// Runs inside the page. api = window.__tf (prototype) or window.__fpbp (new).
async function scenario({ k, apiName }) {
  const api = window[apiName], cv = document.querySelector('canvas'), cx = cv.getContext('2d');
  const hash = () => { const d = new Uint32Array(cx.getImageData(0, 0, 800, 600).data.buffer); let h = 2166136261; for (let i = 0; i < d.length; i += 3) { h ^= d[i]; h = Math.imul(h, 16777619); } return h >>> 0; };
  const out = []; const step = () => { window.__step(); out.push(hash()); };
  const m = api.mouse; const offs = [-.12, 0, .05, -.03, .15];
  api.startDrill(k); step();
  for (let att = 0; att < 5; att++) {
    const off = offs[att];
    let G = api.G, guard = 0;
    const waitPhase = (ok, max = 400) => { let n = 0; while (api.G && !ok(api.G) && n++ < max) step(); return api.G; };
    G = waitPhase(g => g.phase !== 'result');
    if (!G) break;
    if (G.mode === 'moving') {
      const s = api.P(0, G.pz, 0).s; m.x = 400 + (G.xL * (k === 'overhead' ? .3 : 1) + off * 2) * 100 * s;
      G = waitPhase(g => g.phase === 'incoming'); step();
      if (k === 'overhead') { const px = (m.x - 400) / (100 * s); waitPhase(g => (g.x0 + (g.xL - g.x0) * ((api.now - g.t0) / g.T) - px) * g.dir > -off * 6 - .3 || g.phase !== 'incoming'); }
      else waitPhase(g => api.now - g.t0 >= g.T + off * 1.5 || g.phase !== 'incoming');
      api.onDown(); step(); api.onUp();
    } else if (G.mode === 'header') {
      const s = api.P(0, G.pz, 0).s; m.x = 400 + (-1 + off) * 100 * s;
      const ballX = g => g.x0 + (g.xL - g.x0) * ((api.now - g.t0) / g.T), rel = -1 + off * 3 + .2;
      waitPhase(g => g.phase === 'incoming');
      waitPhase(g => api.now - g.t0 >= (g.x0 - rel) / (g.x0 - g.xL) * g.T - (.1 + att * .1) || g.phase !== 'incoming');
      api.onDown(); waitPhase(g => ballX(g) < rel || g.phase !== 'incoming'); api.onUp();
    } else if (G.mode === 'turn') {
      waitPhase(g => g.phase === 'incoming'); waitPhase(g => api.now - g.t0 >= g.T + off * .5 || g.phase !== 'incoming');
      api.onDown(); for (let i = 0; i < 6 + att * 4; i++) step(); api.onUp();
    } else if (G.mode === 'pen') {
      for (let i = 0; i < 10 + att * 7; i++) step(); api.onDown(); for (let i = 0; i < 20 + att * 9; i++) step(); api.onUp();
    } else if (G.mode === 'fk') {
      m.x = 400 + (att - 2) * 60; m.y = 300 + att * 30; for (let i = 0; i < 20 + att * 11; i++) step(); api.onDown(); step(); api.onUp();
    } else {
      // passing / crossing: aim the marker at green, orange or red
      const tgt = G.zoneC + [0, G.zoneW / 2 + .02, .3, -G.zoneW / 2 - .025, G.zoneW * .3][att];
      for (let i = 0; i < 10; i++) step();
      waitPhase(g => Math.abs(.5 + .5 * Math.sin((api.now - g.markT0) * g.markSpd - Math.PI / 2) - tgt) < .03 || g.phase !== 'pass', 300);
      api.onDown(); step(); api.onUp();
    }
    waitPhase(g => g.phase === 'result');
    out.push('MSG:' + (api.G ? api.G.msg : ''));
  }
  for (let i = 0; i < 200 && api.G; i++) step();
  for (let i = 0; i < 3; i++) step();
  out.push('END:' + document.querySelector('#endScore').textContent + '|' + document.querySelector('#endText').textContent);
  return out;
}

const browser = await chromium.launch();
let fails = 0;
for (const SEED of SEEDS) for (const k of DRILLS) {
  const runs = [];
  for (const [url, apiName] of [['file://' + path.join(root, 'reference/training-ground-v1.1.html'), '__tf'], [BASE, '__fpbp']]) {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    await ctx.addInitScript(init, SEED);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR', apiName, e.message));
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    await page.goto(url); await page.waitForFunction(n => window[n], apiName);
    await page.evaluate(() => { for (let i = 0; i < 3; i++) window.__step(); });
    runs.push(await page.evaluate(scenario, { k, apiName }));
    await ctx.close();
  }
  const [a, b] = runs; let firstDiff = -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { firstDiff = i; break; }
  const msgs = a.filter(x => typeof x === 'string');
  if (firstDiff < 0) console.log(`✓ [${SEED}] ${k.padEnd(9)} ${a.length} frames identical  ${msgs.join(' / ')}`);
  else { fails++; console.log(`✗ ${k.padEnd(9)} differs at entry ${firstDiff}: ${a[firstDiff]} vs ${b[firstDiff]}`); console.log('   proto:', msgs.join(' / ')); console.log('   new:  ', b.filter(x => typeof x === 'string').join(' / ')); }
}
await browser.close();
process.exit(fails ? 1 : 0);

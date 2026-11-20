# Front Page, Back Page

A browser football life-sim. What you do on the pitch makes the back pages; what you do off it makes the front pages. Spiritual successor to Mousebreaker's *Jumpers for Goalposts*: same click-and-time match moments, same week-by-week career, our own art and jokes.

The design doc is the source of truth for what the game should be. This repo is plain JavaScript modules drawing to an HTML canvas, served by Vite. No framework.

## Play it online

https://gurglechoogle-blip.github.io/front-page-back-page/

Every push to `main` rebuilds and republishes it automatically (`.github/workflows/pages.yml`).

## Running it locally

```bash
npm install && npm run dev
```

Then open the URL Vite prints (normally http://localhost:5173).

- `npm run build`: production build into `dist/`
- `npm run preview`: serve the production build

## How the code is organised

```
index.html              page shell (fonts, #root)
src/
  main.js               entry point: picks the first screen, starts the loop
  style.css             shared styles (the prototype's look)
  engine/               no game rules in here, just the machinery
    camera.js           pitch projection P(x,z,h), groundAt(), the three tuned cameras
    draw.js             background, goal, players, ball, keeper, HUD primitives
    input.js            pointer → 800x600 canvas space; screens set the handlers
    kits.js             kits, skin/hair variety, makeKitSet()
    clock.js            game time (clock.now)
    loop.js             requestAnimationFrame loop, active screen
    util.js             rand, clamp, lerp, pick, seeded PRNG
  moments/              the nine match moments, one module each
    core.js             BaseMoment: shot physics, keeper, commentary, render pipeline
    moving.js           MovingMoment: shared by volley, snapshot, overhead
    volley.js  snapshot.js  header.js  overhead.js  penalty.js
    freekick.js  turn.js  passing.js  crossing.js
    index.js            registry: MOMENTS, SKILLS, createMoment(key)
  screens/
    training.js         the training ground (5 attempts per drill)
  data/                 game data as JSON: clubs, leagues, fixtures, match commentary
                        (arrives with the match screen and the career)
  state/
    gameState.js        the one saved state object, save(), skill helpers
    storage.js          localStorage wrapper that never throws
reference/
  training-ground-v1.1.html   the original tuned prototype, kept for comparison
tools/
  compare.mjs           side-by-side pixel check against the prototype
```

### The moment interface

Each moment is one attempt (one chance in a match). Every moment module exports a class that extends `BaseMoment`:

```js
import { createMoment } from './moments/index.js';
import { makeKitSet } from './engine/kits.js';

const m = createMoment('volley').start({
  kits: makeKitSet(),          // our kit, their kit, keeper
  skillFactor: k => 1.2,       // 1 to 1.5, widens timing windows
  playerName: 'Smith',
  onResult: r => { /* { key, outcome, goal, gained, msg, q } */ },
});
// each frame:
m.update();
m.render(ctx, hud);            // hud(ctx, m) draws your overlay under the timing bars
// input:
m.onDown(); m.onUp();
```

`outcome` is one of `goal`, `save`, `wide`, `over`, `wall`, `miss`, `clear`, `poor` or `misplaced`. `onResult` fires once, after the result message has been on screen for 1.9 seconds, the same as the prototype.

A moment module only holds what is specific to it: its set-up, input, ball path, poses, timing bars and its own commentary. The shared work (shot outcome, keeper dive and save odds, defenders blocking, commentary scaffolding, draw order) lives in `core.js` and is overridden through small hooks such as `keeperProfile()`, `saveChance()`, `goalComment()` and `renderBars()`.

### The tuned mechanics are frozen

Controls, timing windows, ball paths, camera settings, keeper logic and commentary come straight from the v1.1 prototype and must not change unless that's a deliberate design decision. The code was ported line by line with the old global `G` replaced by `this`, and the numbers were left alone.

To prove it, `tools/compare.mjs` loads the prototype and the new build side by side with the same random seed, a fixed 60fps clock and identical scripted inputs for all nine drills, then hashes the canvas every frame. Run it after any change that goes near the moments:

```bash
npm i -D playwright      # once
npm run dev              # in another terminal
node tools/compare.mjs   # optional: node tools/compare.mjs <url> <seed,seed,...>
```

Every frame should come back identical.

## Saving

Everything lives in one state object (`src/state/gameState.js`), saved to `localStorage` under `fpbp_save_v1`. On first run, skill points earned in the old prototype (`tf_profile`) are carried across.

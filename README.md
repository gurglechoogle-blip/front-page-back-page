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
    kits.js             kits, skin/hair variety, makeKitSet(), club colours and clashes
    manager.js          the gaffer figure, drawn per mood
    clock.js            game time (clock.now)
    loop.js             requestAnimationFrame loop, active screen
    util.js             rand, clamp, lerp, pick, seeded PRNG
  moments/              the nine match moments, one module each
    core.js             BaseMoment: shot physics, keeper, commentary, render pipeline
    moving.js           MovingMoment: shared by volley, snapshot, overhead
    volley.js  snapshot.js  header.js  overhead.js  penalty.js
    freekick.js  turn.js  passing.js  crossing.js
    index.js            registry: MOMENTS, SKILLS, createMoment(key)
  sim/                  game rules with no drawing or DOM (testable headless)
    matchSim.js         the match: clock, goals, filler events, your chances, stats, rating
    season.js           clubs, the 2026-27 calendar, fixture generation, cup draws, quick results, tables
    career.js           the career: academy offers, the week loop, selection, approval, money, the phone
    squads.js           made-up squads, same names every time for a club
    text.js             pick a line, fill its {placeholders}
  screens/
    start.js            name entry and academy offers
    hub.js              the hub: you, your week, five category menus
    week.js             end-of-week results
    season.js           season review
    training.js         the training ground (5 attempts per drill; one drill per slot in a career)
    matchSetup.js       pick a one-off match (until the career drives fixtures)
    match.js            match day: score blocks, feed, clock, rating, stats, the gaffer
  data/                 game data as JSON
    clubs.json          all 92 clubs for 2026-27 plus non-league sides: stadium, strength, kits
    leagues.json        the four divisions: games, dates, cup entry points, promotion places
    calendar.json       2026-27 dates: pre-season, international breaks, every cup round
    academies.json      the four academy offer types and their trade-offs
    messages.json       phone messages (Gran's betting tips, the kit man's prophecies)
    names.json          first names and surnames for squads
    commentary.json     every line of match commentary, manager quotes, headlines
  state/
    gameState.js        the one saved state object, save(), skill helpers
    storage.js          localStorage wrapper that never throws
reference/
  training-ground-v1.1.html   the original tuned prototype, kept for comparison
tools/
  compare.mjs           side-by-side pixel check against the prototype
  simtest.mjs           plays thousands of simulated matches and prints the averages
  seasontest.mjs        plays whole careers headless (every academy type) through a season
```

### How a match works

`MatchSim` is ticked once per match minute; the screen races the clock at 1.6 minutes a second (4x faster with *Faster*). Goals for both sides are scheduled up front from the clubs' strengths, and the rest of the feed (corners, fouls, cards, saves, subs, the odd dog on the pitch) is filled in as the clock runs. You get 3 to 6 chances, set by manager trust and form. When one arrives, the sim returns a `chance` event, the screen stops the clock, plays that moment with the real moment module in the clubs' kits, and passes the result back through `resolveChance()`, which updates the score, feed, stats and your rating. Cup ties that are level go to extra time (maybe one more chance) and then penalties, where you take your side's first kick yourself. Skill points earned in a match go into your training profile.

Writing commentary is just editing `src/data/commentary.json`; no code changes needed.

### How a career works

You start at 16 in summer 2026, pick a name, and choose from 3-4 academy offers (elite academy, pathway club, money club, family club). Your training-ground skill level decides which clubs come calling. Each week you get 4 time slots (6 in pre-season) to spend on drills or rest, then matchday: the team sheet says whether you start, sit on the bench (1-2 chances if you come on) or watch from the stand, depending on the club's pathway, manager approval and form. The week ends with your rating, approval, wages in and bills out, results around the league and the table.

The season is built from `season.js`: a double round-robin league on the real 2026-27 calendar (38 or 46 games, Saturdays, midweeks, Boxing Day and New Year), pre-season friendlies, and every cup your club is in: FA Cup (League One and Two from R1, the top two divisions from R3), EFL Cup (R1, R2 or R3 depending on division and Europe), and the EFL Trophy (League One and Two clubs, or the U21s of 16 big academies). Other teams' matches are simulated each week so the table works. Cup ties are drawn one round at a time.

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

Everything (training profile and career) lives in one state object (`src/state/gameState.js`), saved to `localStorage` under `fpbp_save_v1` after every action: each drill, rest, team sheet, match event and week. Reloading picks up exactly where you were, including halfway through a match (the match sim snapshots itself as it goes). Leaving in the middle of a chance counts as a miss, so a reload can't buy you a second go.

- A backup copy is kept each week (`fpbp_save_backup`). If the main save is ever unreadable, the backup loads and repairs it.
- Saves carry a version number and pass through `migrate()` on load, so older saves keep working.
- The hub footer can download the save as a file and load it back, for moving between computers.
- On first run, skill points from the old prototype (`tf_profile`) are carried across.

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
    venues.js           scenery by venue: rec, lower-league ground, Championship, Premier League, training grounds
    replay.js           goal replays: record a moment's frames compactly, draw them back
    clock.js            game time (clock.now)
    audio.js            synthesised sound: crowd, roars, whistles, kicks, an original theme tune (own RNG, never touches Math.random)
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
    life.js             honour, relationship meters, events with choices, press, the weekly newspaper
    world.js            summer: every division finishes, play-offs, promotion/relegation, strength drift
    money.js            possessions, homes and rooms, savings funds, net worth, the debt ladder
    social.js           friends, nights out, the rival striker, the team group chat
    partner.js          meeting someone, dates, gifts, milestones
    cards.js            deck, poker hand evaluator, equity by simulation
    poker.js            no-limit Texas Hold'em against three characters
    blackjack.js        six-deck blackjack
    squads.js           made-up squads, same names every time for a club
    transfers.js        reputation, offers, loans, contract talks, deadline day
    international.js    England call-ups, summer tournaments
    looks.js  card.js   your appearance as you age; the yearly video-game card
    trouble.js          injuries, bans and prison, kids, holidays, the ways back from a scandal
    fame.js             social media, community and charity, staff, merch and investments
    achievements.js     the 48 achievements and when each is checked
    epilogue.js         legacy, the road to the 2046 final, "where are they now", the tabloid column
    invites.js          friends, Mum, Gran and the squad texting you to do things
    contracts.js        bonuses, the club's small print (enforced), the gaffer's post-match verdict
    gaffer.js           asking the gaffer for a contract, minutes, a loan or a transfer
    calendar.js         the diary: activities get days, results get logged
    injuryLife.js       telly work and other things to do on a long injury
    managers.js         a different manager for every team (club, U21s, each England side)
    intlSchedule.js     England's calendar: Nations League, March games, qualifiers, friendlies
    headlines.js        today's headline for the hub ticker
    squads.js           also picks surnames by country (data/worldNames.json)
    text.js             pick a line, fill its {placeholders}
  screens/
    start.js            name entry and academy offers
    hub.js              the hub: you, your week, five category menus
    week.js             end-of-week results
    season.js           season review
    paper.js            The Weekly Splash: front and back pages with drawn photos
    flow.js             playing (and resuming) a career fixture
    venue.js            which scenery a match or screen uses
    moneyUI.js          bank, shopping, property and debt-ladder pop-ups
    fameUI.js           social media, community, staff and business pop-ups
    contractUI.js  tournament.js   transfer window and contract talks; England in the summer
    calendarUI.js       the yesterday/today/tomorrow strip and month view
    statsUI.js          competitions (every table and cup run) and your stats by team and competition
    welcome.js          the head of development's first-day talk
    finale.js           the end: testimonial, the years passing, scrapbook montage, the 2046 final, epilogue
    casino.js           the poker and blackjack tables
    training.js         the training ground (5 attempts per drill; one drill per slot in a career)
    matchSetup.js       pick a one-off match (until the career drives fixtures)
    match.js            match day: score blocks, feed, clock, rating, stats, the gaffer
  data/                 game data as JSON
    clubs.json          all 92 clubs for 2026-27 plus non-league sides: stadium, strength, kits
    leagues.json        the four divisions: games, dates, cup entry points, promotion places
    calendar.json       2026-27 dates: pre-season, international breaks, every cup round
    academies.json      the four academy offer types and their trade-offs
    messages.json       phone messages (Gran's betting tips, the kit man's prophecies)
    events.json         life events: choices, effects, follow-ups, newspaper stories
    press.json          press-conference questions and answers
    newspaper.json      headline templates, alliterative verbs, fillers and sightings
    shop.json           things to buy, homes, rooms, savings funds, lenders
    friends.json        eight friends, their hang-outs, nights out and what can go wrong
    chat.json           team group chat banter and risky prompts
    partners.json       names, jobs, quirks, dates and gifts
    casino.json         gambling venues by age and their regulars
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

The career moves a day at a time. Each day you get one main activity (training, rest, seeing people, a night out); quick things like texts are free. Press Continue to move on a day. Matches are played on their actual date, with at least 60 hours between your games. After Sunday the week's results come up.

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

Every frame should come back identical, except where the mechanics were deliberately changed after Stage 3: volleys only miss on a bad click or when the ball leaves the screen, and the penalty keeper saves about 1 in 5. Since then every moment except passing and crossing has 8% tighter timing windows (`HARDER` in `src/state/gameState.js`); `tools/compare.mjs` sets `window.__prototypeTiming` to switch that off so the frame check still means something.

### Honour, relationships and the newspaper

Honour is public; the meters are private: manager (approval), teammates, fans and family. Teammates who like you pass to you more (up to a chance either way), the fans' mood shows up in the commentary, honour makes the gaffer more or less forgiving, and a stable family helps you recover. Each week may bring an event (a call, a text or a dressing-room moment) from `events.json`: every choice costs something, some use a time slot, and some come back weeks later. After some matches you face the press. Every Monday *The Weekly Splash* lands: the back page covers your football and the front page covers your life, with headlines built from what you actually did and alliterative puns on your surname. Pages can be framed.

### Life between matches

The career rolls on past the first season: every summer all five divisions finish, play-offs are played, clubs go up and down, and you age (a first pro contract arrives at 18). Things open up with age: friends, dating, house parties, Gran's 2p poker and modest shopping from 16; driving lessons and a first car at 17; pubs and clubs, the casino, moving out and the flash stuff at 18; houses with rooms that do something as the money grows. If you go overdrawn you work down the debt ladder: sell things, raid the savings funds, borrow from people close to you, then the loan sharks. Your rival from the academy runs a career alongside yours, the team group chat leaks, and every goal you score in a match is saved to the scrapbook to watch again.

### Fame, achievements and the end

Social media followers grow towards a ceiling set by how famous you are (the fans meter and the size of your league), with posts, sponsored posts and the odd troll. Community work and charity use time slots and rebuild honour. Staff cost wages and each does something (a PA adds a time slot, a driver halves night-out trouble, a trainer boosts training) with a small chance of going wrong. A merch line and investments make (or lose) money. There are 48 achievements in a trophy cabinet (Fame → Achievements), checked after each match, each week, each season and at the end.

The game ends in the summer of 2046, either when you get there still playing or when you retire (from 33; retired players fast-forward). After 10+ seasons at one club you get a testimonial. A montage of your scrapbook plays, then the England manager rings: framed as the legend, the redeemed or the has-been depending on your legacy. You sit on the bench all tournament, then in the last minute of extra time in the final against Germany you get one chance, using your best shooting skill. Then the front page, and where everyone is now.

### Sound and full screen

The buttons in the bottom-right corner toggle full screen, sound effects and music. Everything is synthesised with the Web Audio API (no recordings), so there is no licensing to worry about; real radio stations aren't included for the same reason. Audio uses its own random numbers, so the seeded drill comparison stays identical.

## Saving

Everything (training profile and career) lives in one state object (`src/state/gameState.js`), saved to `localStorage` under `fpbp_save_v1` after every action: each drill, rest, team sheet, match event and week. Reloading picks up exactly where you were, including halfway through a match (the match sim snapshots itself as it goes). Leaving in the middle of a chance counts as a miss, so a reload can't buy you a second go.

- A backup copy is kept each week (`fpbp_save_backup`). If the main save is ever unreadable, the backup loads and repairs it.
- Saves carry a version number and pass through `migrate()` on load, so older saves keep working.
- The hub footer can download the save as a file and load it back, for moving between computers.
- On first run, skill points from the old prototype (`tf_profile`) are carried across.

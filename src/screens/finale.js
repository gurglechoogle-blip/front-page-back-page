// THE FINALE: testimonial, the years passing, a scrapbook montage, the call
// nobody expected, one chance in the 2046 World Cup final, and the epilogue.
// Progress is saved in c.finale.phase, so a reload picks up where you were.
import { W, H, setCam } from '../engine/camera.js';
import { attachInput, setInputHandlers } from '../engine/input.js';
import { setCtx, drawBackground, setVenue } from '../engine/draw.js';
import { esc } from '../engine/util.js';
import { makeKitSet, matchColours, playerKitFrom, teamKitFrom, keeperKitFor } from '../engine/kits.js';
import { drawClipFrame, clipLength } from '../engine/replay.js';
import { createMoment, MOMENTS } from '../moments/index.js';
import { state, save, skillF } from '../state/gameState.js';
import { club, seasonYear } from '../sim/season.js';
import { age } from '../sim/career.js';
import { lookFields } from '../sim/looks.js';
import { seasonsAtClub, checkAchievements, ACH } from '../sim/achievements.js';
import { legacy, LEGACY, roadToFinal, bestShot, FINAL_SETUP, epilogue, finalStats, careerGoals } from '../sim/epilogue.js';
import { applyEffects } from '../sim/life.js';
import { paperHTML, paperPhotos } from './paper.js';
import NP from '../data/newspaper.json';

export function createFinaleScreen(root, go) {
  const c = state.career;
  c.finale = c.finale || { phase: seasonsAtClub(c) >= 10 && !c.flags.testimonial ? 'testimonial' : c.retired && seasonYear() < 2046 ? 'years' : 'montage' };
  const F = c.finale, sur = c.name.trim().split(/\s+/).pop();
  let cv, ctx, moment = null, clips = [], clipI = 0, clipF = 0, hudText = null;
  const $ = id => root.querySelector('#' + id);
  const setPhase = p => { F.phase = p; save(); show(); };

  function mount() {
    root.innerHTML = `<div id="app" class="finale"><div id="stage" class="tall"><canvas id="c" width="${W}" height="${H}"></canvas>
      <button id="skip" class="btn hidden">Skip ▶</button>
      <div id="panel" class="overlay"><div class="panel" id="pbody"></div></div></div></div>`;
    cv = $('c'); ctx = cv.getContext('2d'); setCtx(ctx); setCam('def'); save();
    attachInput(cv);
    setInputHandlers({ down: () => moment && !moment.done && moment.onDown(), up: () => moment && !moment.done && moment.onUp() });
    show();
  }
  const panel = (html, btns) => {
    $('panel').classList.remove('hidden'); $('skip').classList.add('hidden');
    $('pbody').innerHTML = html + `<div class="endBtns">${btns.map(([id, label, cls]) => `<button class="btn ${cls || 'gold'}" id="${id}">${label}</button>`).join('')}</div>`;
  };
  const on = (id, f) => { const b = $(id); if (b) b.onclick = f; };
  const hidePanel = () => $('panel').classList.add('hidden');

  function show() {
    moment = null; hudText = null;
    const ph = F.phase;
    if (ph === 'testimonial') {
      const n = seasonsAtClub(c), cl = club(c.clubId);
      setVenue({ tier: 'prem', name: cl.name, colours: cl.home });
      panel(`<h1>TESTIMONIAL <span>MATCH</span></h1><p class="evtext">${n} seasons at ${esc(cl.name)}. Tonight the ground is full, for you. The old lads are back, including some who've let themselves go. Dennis the kit man is in goal. He has asked you not to "do anything daft".</p><p class="dim">With ten minutes left, the crowd start chanting for a penalty. The referee (your mum's neighbour) gives one.</p>`, [['go', 'Take the penalty']]);
      on('go', () => playMoment('penalty', `TESTIMONIAL · ${cl.short.toUpperCase()} LEGENDS`, r => {
        const purse = Math.round(20000 + c.meters.fans * 4000 + n * 15000);
        c.bank += purse; c.flags.testimonial = true; applyEffects(c, { fans: 3, honour: 2 });
        panel(`<h1>${r.goal ? 'SCORED!' : 'SAVED!'}</h1><p class="evtext">${r.goal ? 'Dennis dives the wrong way on purpose. Everyone knows. Nobody cares. The whole ground sings your name.' : 'Dennis saves it. Dennis has never saved anything in his life. He runs a lap of honour. You let him have it.'}</p><p>The gate receipts come to <b>£${purse.toLocaleString('en-GB')}</b>. ${c.flags.schoolBuilt ? 'Half goes to your school.' : 'You buy everyone a pint. Then another.'}</p>`, [['next', 'Carry on']]);
        on('next', () => setPhase(c.retired && seasonYear() < 2046 ? 'years' : 'montage'));
      }));
    } else if (ph === 'years') {
      drawBackground();
      const from = seasonYear(), lines = [];
      for (let y = from; y < 2046; y++) lines.push(`<div class="row"><span>${y}</span><b>${esc(yearLine(y - from))}</b></div>`);
      panel(`<h1>THE YEARS <span>GO BY</span></h1><p class="dim">You hung up your boots at ${c.retiredAt}. Life went on.</p>${lines.join('')}<p class="evtext">Then, one evening in the summer of 2046, your phone rings. Withheld number.</p>`, [['go', 'Answer it']]);
      on('go', () => setPhase('montage'));
    } else if (ph === 'montage') startMontage();
    else if (ph === 'callup') {
      const L = LEGACY[legacy(c)];
      setVenue({ tier: 'trainElite', name: 'St George\'s Park', colours: club('nat-eng').home });
      panel(`<div class="evvia">📞 The England manager</div><h1>${L.title.replace(/^THE /, 'THE <span>')}</span></h1><p class="evtext">"${esc(c.name.split(' ')[0])}? ${esc(L.letter)}"</p><p class="dim">World Cup 2046 · Egypt and Greece · Final at the Pharaoh Arena, Giza</p>`, [['go', 'Pack your boots']]);
      on('go', () => { F.road = roadToFinal(); setPhase('road'); });
    } else if (ph === 'road') {
      F.road = F.road || roadToFinal();
      panel(`<h1>ROAD TO <span>GIZA</span></h1>${F.road.map(m => `<div class="row"><span>${esc(m.round)}: England ${esc(m.score)} ${esc(m.opp)}</span></div><p class="dim" style="margin:2px 0 8px">${esc(m.quip)}</p>`).join('')}<p class="evtext">England are in the World Cup final. Against Germany. Obviously.</p>`, [['go', 'To the final']]);
      on('go', () => setPhase('final'));
    } else if (ph === 'final') {
      F.key = F.key || bestShot(state.profile.skills);
      setFinalVenue();
      panel(`<h1>THE <span>FINAL</span></h1><p class="evtext">England 1-1 Germany. Extra time. The 120th minute. Your knees have been warming up since the 60th.</p><p class="evtext">The manager turns round: "${esc(c.name.split(' ')[0])}. You're on. Do the thing you're best at."</p><p class="evtext"><b>${esc(FINAL_SETUP[F.key])}</b></p><p class="dim">One chance: ${esc(new MOMENTS[F.key]().title)}. Your best skill.</p>`, [['go', 'This is it']]);
      on('go', () => playMoment(F.key, '120+1\' · ENGLAND 1-1 GERMANY', r => { F.scored = !!r.goal; F.won = F.scored || Math.random() < .5; c.flags.wc2046 = F.won; checkAchievements(c, 'end', { scoredWinner: F.scored && F.won }); setPhase('result'); }));
    } else if (ph === 'result') showResult();
    else showEpilogue();
  }

  function yearLine(i) {
    const opts = ['Started a Sunday column in The Daily Bulldog, a shouty right-wing tabloid. First one: "VAR is controlled from the moon". Mum has cancelled her subscription.', c.flags.pundit >= 2 ? 'Did the telly. Wore a scarf indoors.' : 'Played five-a-side on Tuesdays. Still the best player there. Still moaned.',
      c.partner ? `Long walks with ${c.partner.name}. Bought a dog. The dog rules the house.` : 'Took up golf. Golf did not take you up.',
      careerGoals(c) >= 100 ? 'Did a book signing. Signed 400 books and one forehead.' : 'Opened a sports shop. Sold mostly goalkeeper gloves to dads.',
      'Coached the under-9s on Sundays. They lost 14-0. You were proud of them anyway.',
      'Did a reality TV show in the jungle. Ate a kangaroo bit. Came fourth.'];
    return opts[i % opts.length];
  }

  /* ---------- montage ---------- */
  function startMontage() {
    const sb = (c.scrapbook || []).filter(g => !g.assist);
    clips = sb.filter(g => g.keep).concat(sb.filter(g => !g.keep)).slice(0, 6).reverse();
    if (!clips.length) { setPhase('callup'); return; }
    hidePanel(); clipI = 0; clipF = 0; $('skip').classList.remove('hidden'); $('skip').onclick = () => { clips = []; setCam('def'); setPhase('callup'); };
  }
  function montageFrame() {
    const g = clips[clipI], len = clipLength(g);
    drawClipFrame(ctx, g, Math.min(clipF, len - 1), clipF >= len - 30 ? `${g.season} · v ${g.opp}` : null);
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, 34); ctx.fillStyle = '#ffc928'; ctx.font = 'italic 20px Anton, Impact, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('THE SCRAPBOOK', 12, 25); ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.font = 'bold 14px Roboto Condensed, Arial'; ctx.fillText(g.msg.slice(0, 60), W - 12, 23); ctx.restore();
    if (++clipF > len + 25) { clipF = 0; clipI++; if (clipI >= clips.length) { clips = []; setCam('def'); setPhase('callup'); } }
  }

  /* ---------- the moment ---------- */
  function setFinalVenue() { setVenue({ tier: 'prem', name: 'Pharaoh Arena', colours: club('nat-eng').home, away: club('nat-ger').home }); }
  function playMoment(key, text, done) {
    hidePanel(); hudText = text;
    let kits;
    if (F.phase === 'final') { const col = matchColours(club('nat-eng'), club('nat-ger')); kits = makeKitSet(playerKitFrom(col.home), teamKitFrom(col.away), keeperKitFor(col.home.shirt, col.away.shirt)); }
    else kits = makeKitSet();
    Object.assign(kits.us, lookFields(c, age(c)));
    moment = createMoment(key).start({ kits, skillFactor: skillF, playerName: sur.toUpperCase(), onResult: r => { setTimeout(() => { moment = null; done(r); }, 900); } });
  }
  function hud(x, m) {
    x.save(); x.fillStyle = 'rgba(10,12,14,.75)'; x.fillRect(0, 0, W, 36); x.fillStyle = '#ffc928'; x.font = 'italic 22px Anton, Impact, sans-serif'; x.textAlign = 'center'; x.fillText(hudText || '', W / 2, 26);
    x.fillStyle = 'rgba(10,12,14,.72)'; x.fillRect(0, H - 40, W, 40); x.fillStyle = '#fff'; x.font = 'bold 13px Roboto Condensed, Arial'; x.fillText(m.d.i, W / 2, H - 16); x.restore();
  }

  /* ---------- result and epilogue ---------- */
  function finalPaper() {
    const won = F.won, scored = F.scored;
    const headline = scored ? `IT'S COME HOME! ${sur.toUpperCase()}, 36, WINS IT` : won ? `PENALTY PARADISE! ENGLAND WIN IT (NO THANKS TO ${sur.toUpperCase()})` : `GERMANY. PENALTIES. OF COURSE.`;
    const sub = scored ? `A ${new MOMENTS[F.key]().title.toLowerCase()} in the 121st minute. Grown men wept. So did the Germans, a bit.` : won ? `${sur} missed the chance of a lifetime, then cried through the whole shoot-out. England won it anyway.` : `${sur} had the chance to win it in the 121st minute. He's still thinking about it. So are we.`;
    return { masthead: NP.masthead, n: 1040, date: '2046-07-20', price: '£4.20', kit: club('nat-eng').home, front: { headline, sub, photo: won ? 'winner' : 'cupOut' }, dennis: `Dennis (ex-kit man, 81): "I always said he'd do it." He did not.`, gran: `Gran, 97: "${scored ? 'Caravan!' : 'Next time, love.'}"`, back: { headline, sub } };
  }
  function showResult() {
    setFinalVenue(); drawBackground();
    const p = finalPaper();
    panel(`<h1>${F.scored ? 'GOAL! <span>2-1</span>' : F.won ? 'MISSED... <span>BUT</span>' : 'MISSED. <span>PENALTIES.</span>'}</h1><p class="evtext">${F.scored ? 'Bedlam. Absolute bedlam. You run to the corner and you don\'t remember the rest. Neither does anyone in England.' : F.won ? 'You put your head in your hands. Then England win the shoot-out, 5-4, and you\'re a world champion anyway. Football is ridiculous.' : 'You put your head in your hands. The shoot-out goes to sudden death. Germany win it. Of course they do.'}</p><div id="paperbox" class="paperwrap">${paperHTML(p, 'front', c)}</div>`, [['go', 'Where are they now? ▶']]);
    paperPhotos(root, p, 'front', c);
    on('go', () => setPhase('epilogue'));
  }
  function showEpilogue() {
    drawBackground();
    checkAchievements(c, 'end', { scoredWinner: F.scored && F.won });
    const lines = epilogue(c, F.won, F.scored), stats = finalStats(c);
    const got = ACH.filter(a => c.achievements[a.id]);
    panel(`<h1>WHERE ARE THEY <span>NOW?</span></h1><div class="scroll epi">${lines.map(([h, t]) => `<h3>${esc(h)}</h3><p>${esc(t)}</p>`).join('')}
      <h3>The numbers</h3>${stats.map(([k, v]) => `<div class="row"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('')}
      <h3>Trophy cabinet</h3><p class="dim">${got.map(a => esc(a.name)).join(' · ') || 'Empty. Mum put a photo of you in it instead.'}</p>
      <p class="evtext" style="margin-top:14px"><b>THE END.</b> Thanks for playing Front Page, Back Page.</p></div>`, [['new', 'Start a new career', 'red']]);
    on('new', () => { if (confirm('Start a new career? This one goes in the record books (and the bin).')) { state.career = null; save(); go('start'); } });
  }

  function frame() {
    if (moment) { moment.update(); if (moment) moment.render(ctx, hud); }
    else if (clips.length && F.phase === 'montage') montageFrame();
    else { setCtx(ctx); drawBackground(); }
  }
  window.__fpbp = { get G() { return moment; }, onDown: () => moment && moment.onDown(), onUp: () => moment && moment.onUp() };
  return { mount, frame };
}

// Sound, all synthesised in the browser (no recordings, no copyright):
// crowd ambience, roars and groans, whistles, ball strikes, UI ticks, and an
// original little theme tune. Sound effects and music toggle separately and
// the choice is remembered.
import { store } from '../state/storage.js';

const KEY = 'fpbp_settings';
export const settings = Object.assign({ sfx: true, music: true }, store.get(KEY) || {});
const saveSettings = () => store.set(KEY, settings);

let ac = null, master, sfxBus, musicBus, noiseBuf;
// Audio has its own random numbers so it never disturbs the game's (the drills are seeded for testing).
let seed = 99991; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function ctx() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ac = new AC();
  master = ac.createGain(); master.gain.value = .8; master.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.gain.value = settings.sfx ? 1 : 0; sfxBus.connect(master);
  musicBus = ac.createGain(); musicBus.gain.value = settings.music ? .32 : 0; musicBus.connect(master);
  // Two seconds of pink-ish noise, reused for every crowd sound.
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) { const w = rnd() * 2 - 1; b0 = .997 * b0 + w * .029591; b1 = .985 * b1 + w * .032534; b2 = .95 * b2 + w * .048056; d[i] = (b0 + b1 + b2 + w * .1848) * .2; }
  return ac;
}
/** Browsers only allow sound after a click: wake the audio on the first one. */
export function unlockAudio() {
  const go = () => { const a = ctx(); if (a && a.state === 'suspended') a.resume().then(() => { if (wantMusic) startMusic(); if (pendingCrowd != null) startCrowd(pendingCrowd); }); else { if (wantMusic) startMusic(); if (pendingCrowd != null) startCrowd(pendingCrowd); } };
  window.addEventListener('pointerdown', go, { once: false, passive: true });
  window.addEventListener('keydown', go, { once: false });
}
const ready = () => { const a = ctx(); return a && a.state === 'running' ? a : null; };

function noise(dest, { freq = 800, q = .8, gain = .5, attack = .05, hold = .3, release = .6, sweepTo = null, type = 'bandpass' }) {
  const a = ready(); if (!a) return;
  const src = a.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(), t = a.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.setValueAtTime(gain, t + attack + hold); g.gain.exponentialRampToValueAtTime(.0001, t + attack + hold + release);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + hold + release);
  src.connect(f); f.connect(g); g.connect(dest); src.start(t, rnd() * 1.5); src.stop(t + attack + hold + release + .1);
}
function tone(dest, { freq = 440, type = 'sine', gain = .2, attack = .005, dur = .2, to = null, at = 0 }) {
  const a = ready(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + .05);
}

/* ---------- sound effects ---------- */
export const sfx = {
  kick() { tone(sfxBus, { freq: 150, to: 50, gain: .5, dur: .14 }); noise(sfxBus, { freq: 2500, q: .5, gain: .25, attack: .002, hold: 0, release: .05, type: 'highpass' }); },
  roar(big = 1) { noise(sfxBus, { freq: 700, q: .4, gain: .55 * big, attack: .25, hold: 1.4 * big, release: 2.2, sweepTo: 500 }); noise(sfxBus, { freq: 1500, q: .7, gain: .25 * big, attack: .2, hold: 1, release: 1.8 }); },
  groan() { noise(sfxBus, { freq: 900, q: 1.4, gain: .3, attack: .15, hold: .3, release: 1, sweepTo: 300 }); },
  cheer() { noise(sfxBus, { freq: 1100, q: .8, gain: .22, attack: .1, hold: .3, release: .8 }); },
  whistle(n = 1, long = false) { for (let i = 0; i < n; i++) { const at = i * (long ? .55 : .3), dur = long && i === n - 1 ? .9 : .22; tone(sfxBus, { freq: 2900, type: 'triangle', gain: .12, dur, at }); tone(sfxBus, { freq: 3150, type: 'sine', gain: .07, dur, at }); } },
  tick() { tone(sfxBus, { freq: 1200, type: 'square', gain: .04, dur: .04 }); },
  ching() { tone(sfxBus, { freq: 1568, type: 'triangle', gain: .12, dur: .25 }); tone(sfxBus, { freq: 2093, type: 'triangle', gain: .1, dur: .35, at: .07 }); },
};

/* ---------- crowd ambience (in a match) ---------- */
let amb = null;
export function startCrowd(level = .6) {
  const a = ready(); stopCrowd(); if (!a) { pendingCrowd = level; return; }
  const src = a.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = .5;
  const g = a.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(.12 * level, a.currentTime + 1.5);
  // A slow swell so it breathes like a real crowd.
  const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = .13; lg.gain.value = .035 * level; lfo.connect(lg); lg.connect(g.gain); lfo.start();
  src.connect(f); f.connect(g); g.connect(sfxBus); src.start();
  amb = { src, lfo, g }; pendingCrowd = null;
}
let pendingCrowd = null;
export function stopCrowd() { if (!amb) return; const a = ac; try { amb.g.gain.linearRampToValueAtTime(0, a.currentTime + .4); amb.src.stop(a.currentTime + .5); amb.lfo.stop(a.currentTime + .5); } catch (e) { } amb = null; }

/* ---------- music: an original, cheerful loop ---------- */
let wantMusic = false, musicTimer = null, step = 0;
// I-vi-IV-V in G, with a bouncy bassline and a whistled-sounding melody.
const CHORDS = [[196, 247, 294], [165, 196, 247], [131, 165, 196], [147, 185, 220]];
const MELODY = [392, 440, 494, 440, 392, 330, 392, null, 330, 392, 440, 392, 330, 294, 330, null, 262, 294, 330, 392, 440, 392, 330, null, 294, 330, 370, 440, 392, 370, 392, null];
export function startMusic() {
  wantMusic = true;
  const a = ready(); if (!a || musicTimer) return;
  const beat = .26;
  musicTimer = setInterval(() => {
    if (!settings.music) return;
    const bar = Math.floor(step / 8) % 4, ch = CHORDS[bar], s = step % 8;
    if (s === 0 || s === 4) tone(musicBus, { freq: ch[0] / 2, type: 'triangle', gain: .35, dur: beat * 1.8 });
    if (s === 2 || s === 6) tone(musicBus, { freq: ch[0] / 2 * 1.5, type: 'triangle', gain: .25, dur: beat * .9 });
    if (s % 2 === 1) ch.forEach(f => tone(musicBus, { freq: f, type: 'square', gain: .025, dur: beat * .6 }));
    const m = MELODY[step % MELODY.length]; if (m) tone(musicBus, { freq: m * 2, type: 'sine', gain: .09, dur: beat * .9 });
    if (s === 4) noise(musicBus, { freq: 6000, q: .5, gain: .05, attack: .002, hold: 0, release: .05, type: 'highpass' });
    step++;
  }, beat * 1000);
}
export function stopMusic() { wantMusic = false; clearInterval(musicTimer); musicTimer = null; }

/* ---------- toggles ---------- */
export function setSfx(on) { settings.sfx = on; saveSettings(); if (sfxBus) sfxBus.gain.value = on ? 1 : 0; }
export function setMusic(on) { settings.music = on; saveSettings(); if (musicBus) musicBus.gain.value = on ? .32 : 0; if (on && wantMusic) startMusic(); }
export const resumeCrowd = () => { if (pendingCrowd != null) startCrowd(pendingCrowd); };

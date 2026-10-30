/* =========================================================================
   audio.js — every sound is synthesized with the Web Audio API (no sound
   files). Browsers only allow audio after the player interacts, so
   initAudio() runs when they click "Enter the forest".
   ========================================================================= */

let ac = null;       // the AudioContext, created on first click
let noiseBuf = null; // 0.3 s of white noise, used for leaf rustles

/** Create the audio engine. Safe to call more than once. */
function initAudio() {
  if (ac) return;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ac = null; } // no audio support: the game just stays silent
}

/**
 * Play a short beep that slides from pitch f0 to f1 (Hz) over `dur` seconds,
 * fading out. `type` is the waveform: 'sine' (soft), 'triangle' (woody),
 * 'square' (buzzy) or 'sawtooth' (harsh). `delay` starts it later, for arpeggios.
 */
function tone(f0, f1, dur, type, vol, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}

/** A burst of filtered noise that sounds like leaves rustling. */
function rustle(vol) {
  if (!ac) return;
  const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.8;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  s.connect(f).connect(g).connect(ac.destination); s.start(t);
}

// XP pickups rise in pitch when you collect several in quick succession.
let pickStreak = 0, lastPick = 0;

/** Every sound effect in the game, by name. */
const sfx = {
  throw: () => tone(520, 160, 0.12, 'sine', 0.06),
  knock: () => tone(300, 200, 0.08, 'triangle', 0.18),                    // creature hit but not killed
  kill: () => { tone(420, 70, 0.22, 'square', 0.06); rustle(0.12); },
  thud: v => tone(170, 80, 0.09, 'sine', Math.min(0.25, v * 0.03)),       // ball hits ground/rock; v = impact speed
  trunk: () => tone(240, 90, 0.12, 'triangle', 0.22),                     // ball hits a tree trunk
  rico: () => tone(600, 1200, 0.1, 'sine', 0.08),                         // Ricochet perk redirects a ball
  hurt: () => { tone(180, 60, 0.25, 'sawtooth', 0.14); tone(90, 50, 0.3, 'sine', 0.25); },
  roar: () => tone(110, 45, 0.9, 'sawtooth', 0.09),                       // a Mossback appears
  heal: () => [440, 554, 659].forEach((f, i) => tone(f, f * 1.01, 0.16, 'sine', 0.1, i * 0.06)),
  magnet: () => tone(200, 1600, 0.6, 'sine', 0.1),
  death: () => [330, 262, 196, 131].forEach((f, i) => tone(f, f * 0.97, 0.35, 'triangle', 0.14, i * 0.18)),
  pick: () => {
    const now = performance.now();
    pickStreak = now - lastPick < 600 ? Math.min(pickStreak + 1, 14) : 0; lastPick = now;
    tone(660 * Math.pow(1.06, pickStreak), 1320 * Math.pow(1.06, pickStreak), 0.09, 'sine', 0.06);
  },
  level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.18, 'triangle', 0.12, i * 0.08)),
};

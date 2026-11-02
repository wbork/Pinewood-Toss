/* =========================================================================
   state.js — every value that changes while you play, in one place.
   game.js → resetRun() puts all of these back to their starting values.
   ========================================================================= */

// ---------- The player ----------
const player = {
  pos: new V3(0, h(0, 0), 0), // feet position in the world
  vel: new V3(),              // horizontal velocity (x and z are used)
  vy: 0,                      // vertical velocity, for jumping and falling
  onGround: true,
  standOn: null,              // the rock the deer is standing on, if any (player.js)
  wet: false,                 // wading in a lake (for the splash when stepping in)
};
let hp = 100;      // current health; max health comes from mod.maxHp (items.js)
let iframes = 0;   // seconds of invulnerability left after taking a hit
let hurtFlash = 0; // strength of the red screen-edge flash, 0..1
let shake = 0;     // camera shake strength, fades out after a hit

// ---------- Camera look angles (radians) ----------
// yaw turns left/right (0 looks toward -z), pitch tilts up/down.
let yaw = 0, pitch = 0;

// ---------- The run ----------
let runTime = 0;    // seconds survived; only counts while playing
let spawnT = 2.5;   // seconds until the spawner (enemies.js → director) acts again
let lastThreat = 1; // last threat level shown, so the HUD can flash when it rises
const stats = { kills: 0, throws: 0 };
const prog = { level: 1, xp: 0, pending: 0 }; // pending = level-ups still waiting for a pick
let money = 0;        // coins carried, spent on chests (chests.js)
let chestsOpened = 0; // chests bought this run; each one makes the next cost more
let endless = false;  // the Hollow King is dead: score counts and spawns ramp up (bosses.js)
let endlessAt = 0;    // runTime when that happened
let score = 0;        // points earned in the endless phase

// Best survival time, remembered in this browser between visits.
// Storage can be unavailable (private windows, locked-down browsers), so failures are ignored.
let best = 0;
try { best = +localStorage.getItem('pinewood-best') || 0; } catch (e) { /* no storage; best starts at 0 */ }

// ---------- What screen we're on ----------
let started = false;  // left the title screen at least once
let playing = false;  // the simulation is running (false while paused, picking a perk, or dead)
let choosing = false; // the level-up menu is open
let dead = false;     // the game-over screen is showing

// ---------- Input ----------
const keys = {};        // keys currently held, by KeyboardEvent.code (e.g. keys.KeyW)
let locked = false;     // the mouse pointer is captured by the game
let wasLocked = false;  // it has been captured at least once (so losing it means "pause")
let drag = null;        // fallback when pointer capture isn't allowed: click-and-drag to look
let firing = false;     // the mouse button is held down (aimed weapons keep firing)

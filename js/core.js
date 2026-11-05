/* =========================================================================
   core.js — small helpers that every other file uses.

   How the files share code: index.html loads each js/ file as a plain
   <script> (no modules, no build step, so the game also runs straight from
   disk). In plain scripts, anything declared at the top level with
   const / let / function is visible to every script loaded AFTER it.
   That's why index.html lists the files in a specific order.
   ========================================================================= */

// THREE.Vector3 is used constantly, so give it a short name.
const V3 = THREE.Vector3;

// Honor the operating system's "reduce motion" setting
// (turns off camera shake, the deer's idle breathing, and card animations).
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Gravity in meters per second², shared by balls, XP orbs, wood chips and jumping.
const G = 20;

/**
 * Seeded random number generator (the "mulberry32" algorithm).
 * Unlike Math.random(), the same seed always produces the same sequence, so a
 * map's seed (MAP_SEED, terrain.js) always gives the same forest.
 * Returns a function that gives a new number in [0, 1) each call.
 */
function mulberry(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// The world's random source. world.js reseeds it from each new map's seed (newMap) and
// draws from it while it builds that map's forest.
let R = mulberry(20261030);

/** Random number between a and b, from the seeded source. */
const rand = (a, b) => a + (b - a) * R();

/** Smoothstep: 0 below a, 1 above b, and an S-shaped blend in between. */
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

/** Shorthand for document.getElementById. */
const $ = id => document.getElementById(id);

// Scratch objects reused every frame so the game doesn't create garbage.
// Their contents are only valid until the next function borrows them.
const tmp = new V3(), tmp2 = new V3(), nrm = new V3();
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new V3(), P = new V3(), C = new THREE.Color();
const UP = new V3(0, 1, 0); // world "up"; never modified

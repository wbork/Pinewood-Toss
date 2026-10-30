/* =========================================================================
   terrain.js — the shape of the land.

   The arena is a gently rolling forest floor. Past RIDGE_R the ground climbs
   into a ring of rocky ridges, which hides the edge of the world. Everything
   that touches the ground (the deer, creatures, balls, orbs) asks h(x, z)
   for the ground height, so the visible ground mesh (world.js) and the
   physics always agree.
   ========================================================================= */

const ARENA_R = 70;  // the deer can't walk farther than this from the center
const FOE_R = 76;    // creatures may roam a little farther, to the foot of the ridge
const RIDGE_R = 76;  // where the ground starts rising into the ridges

/** Rolling forest floor: a few overlapping sine waves, about ±1.5 m. */
const floorH = (x, z) =>
  0.9 * Math.sin(x * 0.07) * Math.cos(z * 0.06) +
  0.45 * Math.sin(x * 0.16 + z * 0.12) +
  0.25 * Math.cos(z * 0.21 - x * 0.05);

/** Ground height in meters at world position (x, z). */
function h(x, z) {
  const r = Math.hypot(x, z); // distance from the arena center
  let y = floorH(x, z);
  if (r > RIDGE_R) {
    // The ridge crest height varies around the circle (angle a) so it looks
    // like a natural mountain range rather than a perfect bowl.
    const a = Math.atan2(z, x), s = smooth(RIDGE_R, RIDGE_R + 28, r);
    const crest = 24 + 9 * Math.sin(a * 5 + 1.3) + 6 * Math.sin(a * 11 + 0.4) + 3 * Math.sin(a * 23 + 2);
    // ...plus small bumps for craggy rock, and a steady climb far out so no gap ever shows the horizon.
    y += s * (crest + 3 * Math.sin(x * 0.29) * Math.cos(z * 0.31)) + Math.max(0, r - 104) * 0.35;
  }
  return y;
}

/** Surface normal (the "uphill-facing" direction) at (x, z), written into `out`. Used for ball bounces. */
function normalAt(x, z, out) {
  const e = 0.1; // sample the height a little to each side and compare
  return out.set(-(h(x + e, z) - h(x - e, z)) / (2 * e), 1, -(h(x, z + e) - h(x, z - e)) / (2 * e)).normalize();
}

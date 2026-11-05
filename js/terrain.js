/* =========================================================================
   terrain.js — the shape of the land, and where the water is.

   The arena is a rolling forest floor with hills and lakes. Past RIDGE_R the
   ground climbs into a ring of rocky ridges, which hides the edge of the world.
   Everything that touches the ground (the deer, creatures, balls, orbs) asks
   h(x, z) for the ground height, so the visible ground mesh (world.js) and the
   physics always agree. Things that float or splash ask surfH(x, z) instead,
   which is the water surface over a lake.

   A NEW MAP EVERY RUN: generateTerrain(seed) picks the hills, the lakes, the
   ripples of the forest floor, the shape of the ridge and the mountains behind
   it from a seed. world.js → newMap() calls it with a random seed and then
   rebuilds the scenery to match. The middle (where the deer starts) is always
   kept clear and flat-ish.
   ========================================================================= */

const RIDGE_R = 102;          // where the ground starts rising into the ridges
const ARENA_R = RIDGE_R + 14; // the deer can't go farther than this: about 10 m up the mountainside
                              // (where it's this steep, player.js slides the deer back down anyway)
const FOE_R = ARENA_R + 2;    // creatures may follow a little farther
const SPAWN_R = RIDGE_R;      // creatures only climb out of the ground on the flat, not up the mountains

// The current map's random shape: phases of the floor's ripples and of the ridge's crest
// (set by generateTerrain).
const TERRAIN = { p1: 0, p2: 0, p3: 0, p4: 0, c1: 1.3, c2: 0.4, c3: 2 };

/** Rolling forest floor: a few overlapping sine waves, about ±1.5 m. */
const floorH = (x, z) =>
  0.9 * Math.sin(x * 0.07 + TERRAIN.p1) * Math.cos(z * 0.06 + TERRAIN.p2) +
  0.45 * Math.sin(x * 0.16 + z * 0.12 + TERRAIN.p3) +
  0.25 * Math.cos(z * 0.21 - x * 0.05 + TERRAIN.p4);

// Round hills added on top of the floor: center (x, z), radius r and height ht in meters.
const HILLS = [];
// Each lake is a bowl carved into the floor: center (x, z), radius r (to the edge of its
// sandy shore), depth (meters of water at the middle) and level (the water's height).
// The water line sits at about 0.77 × r from the center.
const LAKES = [];
const SHORE = 0.45; // how far the shore sits above the water
// Mountains behind the ridge, part of the same terrain (so they share its rock and snow
// colors). Each is a cone that steepens toward its summit: center (x, z), foot radius r,
// height ht. Where two overlap the higher one wins, leaving saddles and sharp ridgelines.
const PEAKS = [];

let MAP_SEED = 0; // the current map's seed

// The title screen always shows the same map (this seed), with a STAGE kept clear in front of
// the ranger (from the title camera's view: behind him, +z) where every monster poses.
// world.js keeps trees, rocks and bushes off it; hills keep away from it.
const TITLE_SEED = 20261105;
const STAGE = { x0: -17, x1: 17, z0: -2, z1: 30 };
const onStage = (x, z) => TERRAIN.stage && x > STAGE.x0 && x < STAGE.x1 && z > STAGE.z0 && z < STAGE.z1;

/**
 * Lay out a new map from `seed`: 2–4 lakes, 5–7 hills, new ripples in the floor, a new
 * ridge line and new mountains. Lakes and hills keep clear of each other and of the
 * clearing in the middle, where the deer starts. stage: also keep the title STAGE clear.
 */
function generateTerrain(seed, stage = false) {
  MAP_SEED = seed;
  TERRAIN.stage = stage;
  const r = mulberry(seed), between = (a, b) => a + (b - a) * r();
  Object.assign(TERRAIN, { p1: r() * 6.28, p2: r() * 6.28, p3: r() * 6.28, p4: r() * 6.28, c1: r() * 6.28, c2: r() * 6.28, c3: r() * 6.28 });
  HILLS.length = 0; LAKES.length = 0; PEAKS.length = 0;
  const lakes = 2 + Math.floor(r() * 3);
  for (let tries = 0; LAKES.length < lakes && tries < 300; tries++) {
    const a = r() * 6.28, d = between(30, 82), rad = between(9, 15);
    const L = { x: Math.cos(a) * d, z: Math.sin(a) * d, r: rad, depth: between(0.8, 1.15) };
    if (LAKES.some(o => Math.hypot(o.x - L.x, o.z - L.z) < (o.r + rad) * 1.7 + 8)) continue;
    const reach = rad * 1.6;   // its shore
    if (stage && L.x + reach > STAGE.x0 && L.x - reach < STAGE.x1 && L.z + reach > STAGE.z0 && L.z - reach < STAGE.z1) continue;
    LAKES.push(L);
  }
  for (const L of LAKES) L.level = floorH(L.x, L.z) - 0.2;
  const hills = 5 + Math.floor(r() * 3);
  for (let tries = 0; HILLS.length < hills && tries < 300; tries++) {
    const a = r() * 6.28, d = between(25, 92), rad = between(10, 24);
    const k = { x: Math.cos(a) * d, z: Math.sin(a) * d, r: rad, ht: between(3, 8) * (rad / 20 + 0.3) };
    if (d - rad < 12) continue;                                                              // keep the middle clear
    if (stage && k.x + rad > STAGE.x0 && k.x - rad < STAGE.x1 && k.z + rad > STAGE.z0 && k.z - rad < STAGE.z1) continue;   // and the title stage
    if (LAKES.some(L => Math.hypot(L.x - k.x, L.z - k.z) < rad + L.r * 1.7 + 4)) continue;   // no hills on lakes
    if (HILLS.some(o => Math.hypot(o.x - k.x, o.z - k.z) < (o.r + rad) * 0.7)) continue;     // overlapping a little is fine
    HILLS.push(k);
  }
  const n = 34;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.15, d = 140 + r() * 55;
    // keep each mountain's foot behind the ridge so none spill into the arena
    PEAKS.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: Math.min(28 + r() * 18, d - RIDGE_R - 8), ht: 40 + r() * 45 });
  }
}
generateTerrain(TITLE_SEED, true); // the title screen's map first; world.js builds its scenery

/** Ground height in meters at world position (x, z). */
function h(x, z) {
  let y = floorH(x, z);

  // hills: a smooth bell, 0 at the hill's edge and ht at its center
  for (const k of HILLS) {
    const d2 = (x - k.x) ** 2 + (z - k.z) ** 2;
    if (d2 < k.r * k.r) { const f = 1 - d2 / (k.r * k.r); y += k.ht * f * f; }
  }

  // lakes: flatten the ground into a shore just above the water (out to 1.6 × r),
  // then dip it into a bowl whose bottom is `depth` below the water
  for (const L of LAKES) {
    const t = Math.hypot(x - L.x, z - L.z) / L.r;
    if (t > 1.6) continue;
    y += (L.level + SHORE - y) * (1 - smooth(1.0, 1.6, t));
    y += (L.level - L.depth - y) * (1 - smooth(0.35, 1.0, t));
  }

  // ridges
  const r = Math.hypot(x, z); // distance from the arena center
  if (r > RIDGE_R) {
    // The ridge crest height varies around the circle (angle a) so it looks
    // like a natural mountain range rather than a perfect bowl.
    const a = Math.atan2(z, x), s = smooth(RIDGE_R, RIDGE_R + 28, r);
    const crest = 24 + 9 * Math.sin(a * 5 + TERRAIN.c1) + 6 * Math.sin(a * 11 + TERRAIN.c2) + 3 * Math.sin(a * 23 + TERRAIN.c3);
    // ...plus small bumps for craggy rock, and a steady climb far out so no gap ever shows the horizon.
    let top = s * (crest + 3 * Math.sin(x * 0.29) * Math.cos(z * 0.31)) + Math.max(0, r - (RIDGE_R + 28)) * 0.35;
    // the mountains behind: whichever peak is tallest here, roughened a little so the faces aren't smooth
    if (r > RIDGE_R + 10) {
      let m = 0;
      for (const k of PEAKS) {
        const dx = x - k.x, dz = z - k.z;
        if (Math.abs(dx) > k.r || Math.abs(dz) > k.r) continue; // quick reject
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < k.r) { const f = 1 - d / k.r; m = Math.max(m, k.ht * f * (0.55 + 0.45 * f)); } // broad shoulders, pointed top
      }
      m *= 1 + 0.1 * Math.sin(x * 0.17 + z * 0.05) * Math.cos(z * 0.15 - x * 0.08);
      top = Math.max(top, m);
    }
    y += top;
  }
  return y;
}

/** The lake whose bowl contains (x, z), or null. Cheap, so it's fine to call every frame. */
function lakeAt(x, z) {
  for (const L of LAKES) if ((x - L.x) ** 2 + (z - L.z) ** 2 < L.r * L.r) return L;
  return null;
}

/** How deep the water is at (x, z): 0 on dry land. */
function waterDepth(x, z) {
  const L = lakeAt(x, z);
  return L ? Math.max(0, L.level - h(x, z)) : 0;
}

/** The surface things rest on: the water over a lake, otherwise the ground. */
function surfH(x, z) {
  const L = lakeAt(x, z), y = h(x, z);
  return L ? Math.max(y, L.level) : y;
}

/** Surface normal (the "uphill-facing" direction) at (x, z), written into `out`. Used for ball bounces. */
function normalAt(x, z, out) {
  const e = 0.1; // sample the height a little to each side and compare
  return out.set(-(h(x + e, z) - h(x - e, z)) / (2 * e), 1, -(h(x, z + e) - h(x, z - e)) / (2 * e)).normalize();
}

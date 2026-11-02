/* =========================================================================
   terrain.js — the shape of the land, and where the water is.

   The arena is a rolling forest floor with a few big hills and three lakes.
   Past RIDGE_R the ground climbs into a ring of rocky ridges, which hides the
   edge of the world. Everything that touches the ground (the deer, creatures,
   balls, orbs) asks h(x, z) for the ground height, so the visible ground mesh
   (world.js) and the physics always agree. Things that float or splash ask
   surfH(x, z) instead, which is the water surface over a lake.
   ========================================================================= */

const RIDGE_R = 102;          // where the ground starts rising into the ridges
const ARENA_R = RIDGE_R + 14; // the deer can't go farther than this: about 10 m up the mountainside
                              // (where it's this steep, player.js slides the deer back down anyway)
const FOE_R = ARENA_R + 2;    // creatures may follow a little farther
const SPAWN_R = RIDGE_R;      // creatures only climb out of the ground on the flat, not up the mountains

/** Rolling forest floor: a few overlapping sine waves, about ±1.5 m. */
const floorH = (x, z) =>
  0.9 * Math.sin(x * 0.07) * Math.cos(z * 0.06) +
  0.45 * Math.sin(x * 0.16 + z * 0.12) +
  0.25 * Math.cos(z * 0.21 - x * 0.05);

// ---------- Hills ----------
// Round hills added on top of the floor: center (x, z), radius r and height ht in meters.
// They're kept clear of the lakes and of the spawn clearing in the middle.
const HILLS = [
  { x: -45, z: -25, r: 24, ht: 7 },
  { x: 62, z: 20, r: 20, ht: 6 },
  { x: -10, z: -80, r: 18, ht: 8 },
  { x: 40, z: -75, r: 18, ht: 6 },
  { x: -75, z: 62, r: 18, ht: 6 },
  { x: -15, z: 35, r: 10, ht: 3 },
];

// ---------- Lakes ----------
// Each lake is a bowl carved into the floor: center (x, z), radius r (to the edge of
// its sandy shore) and depth (meters of water at the middle). The water line sits at
// about 0.77 × r from the center. `level`, the water surface height, is worked out
// below from the floor at the lake's center.
const LAKES = [
  { x: 36, z: -28, r: 15, depth: 1.1 },
  { x: -50, z: 30, r: 12, depth: 1.0 },
  { x: 18, z: 58, r: 10, depth: 0.9 },
];
const SHORE = 0.45; // how far the shore sits above the water
for (const L of LAKES) L.level = floorH(L.x, L.z) - 0.2;

// ---------- Mountains ----------
// Peaks that rise out of the ground behind the ridge, part of the same terrain so they
// share its rock and snow colors and low-poly faces. Each is a cone that steepens
// toward its summit: center (x, z), foot radius r, height ht. Where two overlap, the
// higher one wins, which leaves natural-looking saddles and sharp ridgelines between them.
// They have their own random generator so they don't disturb the forest layout.
const PEAKS = [];
{
  const rp = mulberry(9031), n = 34;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rp() - 0.5) * 0.15, d = 140 + rp() * 55;
    // keep each mountain's foot behind the ridge so none spill into the arena
    PEAKS.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: Math.min(28 + rp() * 18, d - RIDGE_R - 8), ht: 40 + rp() * 45 });
  }
}

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
    const crest = 24 + 9 * Math.sin(a * 5 + 1.3) + 6 * Math.sin(a * 11 + 0.4) + 3 * Math.sin(a * 23 + 2);
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

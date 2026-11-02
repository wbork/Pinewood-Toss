/* =========================================================================
   world.js — builds the scenery: ground, distant peaks, trees, rocks and
   bushes, plus the collision helpers that let things bump into them.

   NOTE: every R() / rand() call here comes from the seeded generator in
   core.js. The forest looks the same each visit only because these calls
   always happen in the same order, so add new scenery at the END of this
   file, or give it its own mulberry(seed) generator.

   Trees, rocks and bushes use InstancedMesh: one mesh drawn hundreds of
   times with different positions/sizes/colors, which is far faster than
   hundreds of separate meshes.
   ========================================================================= */

/** Add a mesh to the scene with shadows on (it both casts and receives them). */
const shadowy = m => { m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };

// ---------- Ground ----------
// A big flat grid bent to match h(x, z), colored per vertex: grass in the arena,
// sand and mud around the lakes, rock on the ridges and snow on the highest parts.
{
  const g = new THREE.PlaneGeometry(480, 480, 240, 240); // 2 m between vertices
  g.rotateX(-Math.PI / 2);                                // lay it flat
  const p = g.attributes.position, cols = [];
  const a = new THREE.Color(0x587f35), b = new THREE.Color(0x7b9b44), dirt = new THREE.Color(0x6e5a3b);
  const sand = new THREE.Color(0xa4925f), mud = new THREE.Color(0x4a4a33);
  const rockA = new THREE.Color(0x6d675b), rockB = new THREE.Color(0x4f4b44), snow = new THREE.Color(0xe8ece9);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = h(x, z), r = Math.hypot(x, z);
    p.setY(i, y);
    // two grass greens in soft patches, with the odd dirt spot
    const v = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.cos(z * 0.27) * 2) * Math.cos(z * 0.19);
    const c = a.clone().lerp(b, v);
    if (R() < 0.07) c.lerp(dirt, 0.55);
    // lakes: a sandy beach just above the water line, dark mud under the water
    const L = lakeAt(x, z);
    if (L) c.lerp(y < L.level ? mud : sand, y < L.level ? 0.85 : 1 - smooth(L.level + 0.15, L.level + SHORE + 0.05, y) * 0.7);
    // rock past the foot of the ridge (with a ragged edge), snow up high
    c.lerp(rockA.clone().lerp(rockB, R()), smooth(RIDGE_R + 3, RIDGE_R + 15, r + R() * 4));
    // snow above the snow line, except on steep faces (snow slides off), which stay bare rock
    if (y > 31 + 4 * Math.sin(x * 0.2 + z * 0.13) + R() * 3 && (r < RIDGE_R + 10 || normalAt(x, z, nrm).y > 0.45)) c.copy(snow);
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  // flatShading gives each triangle one flat color: the low-poly look
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  ground.receiveShadow = true;
  scene.add(ground);
}

// The mountains behind the ridge are part of the ground above (PEAKS in terrain.js).
// They replaced a ring of separate cone meshes. Those used 276 numbers from R, so skip
// the same amount here, or every tree and rock below would move.
for (let i = 0; i < 276; i++) R();

// ---------- Trees ----------
// Sizes below are for a tree at scale 1; each tree gets its own scale s.
// Pines are three stacked cones (b = base height, h = cone height, r = radius);
// "round" trees have one ball-shaped crown.
const PINE = [{ b: 1.2, h: 2.6, r: 1.8 }, { b: 2.4, h: 2.3, r: 1.4 }, { b: 3.5, h: 2.0, r: 1.0 }];
const CROWN = { c: 3.6, r: 1.7 }; // crown center height and radius

// Scatter up to 680 trees, at least ~3 m apart, keeping the spawn clearing (7 m) and the lakes open.
// Each entry: position (x, y, z), scale s, kind, trunk radius r, trunk height th, rotation.
const trees = [];
for (let tries = 0; trees.length < 680 && tries < 14000; tries++) {
  const ang = R() * Math.PI * 2, d = Math.sqrt(R()) * 124;
  const x = Math.cos(ang) * d, z = Math.sin(ang) * d;
  if (d < 7 || lakeAt(x, z)) continue;
  if (trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < 10)) continue;
  const s = rand(0.8, 1.5), kind = R() < 0.25 && d < RIDGE_R ? 'round' : 'pine';
  trees.push({ x, z, y: h(x, z) - 0.1, s, kind, r: 0.28 * s, th: (kind === 'pine' ? 2.2 : 2.9) * s, rot: R() * 6.28 });
}
const pines = trees.filter(t => t.kind === 'pine'), rounds = trees.filter(t => t.kind === 'round');

// Trunks: one tapered cylinder per tree.
const trunks = shadowy(new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.64, 1, 1, 7).translate(0, 0.5, 0),
  addDither(new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 1, flatShading: true })), trees.length));
trees.forEach((t, i) => {
  trunks.setMatrixAt(i, M.compose(P.set(t.x, t.y, t.z), Q.setFromAxisAngle(UP, t.rot), S.set(t.r, t.th, t.r)));
});

// Leaves. White base color, so each instance's own green (setColorAt) shows through.
// Shared by pine tiers, round crowns and bushes; dithers when it hides the deer.
const leafMat = addDither(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }));
PINE.forEach((k, ti) => {
  const m = shadowy(new THREE.InstancedMesh(new THREE.ConeGeometry(k.r, k.h, 8).translate(0, k.b + k.h / 2, 0), leafMat, pines.length));
  const r2 = mulberry(ti + 3); // separate generator per tier so colors don't disturb R's sequence
  pines.forEach((t, i) => {
    m.setMatrixAt(i, M.compose(P.set(t.x, t.y, t.z), Q.setFromAxisAngle(UP, t.rot + ti), S.setScalar(t.s)));
    m.setColorAt(i, C.setHSL(0.31 + (r2() - 0.5) * 0.06, 0.42, 0.2 + ti * 0.025 + r2() * 0.06)); // higher tiers slightly lighter
  });
});
{
  const m = shadowy(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(CROWN.r, 1).translate(0, CROWN.c, 0), leafMat, rounds.length));
  rounds.forEach((t, i) => {
    m.setMatrixAt(i, M.compose(P.set(t.x, t.y, t.z), Q.setFromAxisAngle(UP, t.rot), S.set(t.s, t.s * rand(0.9, 1.15), t.s)));
    m.setColorAt(i, C.setHSL(0.22 + R() * 0.06, 0.5, 0.3 + R() * 0.08)); // yellower green than the pines
  });
}

// ---------- Rocks ----------
// Up to 120 boulders, never inside a tree or out in a lake; the ones on the ridges are
// twice as big. They're sunk 30% into the ground so they look settled.
// Each entry: center (x, y, z), size r, plus the shape the deer can stand on (see rockTop):
// hr = footprint radius, vr = height of the dome above the center, peak = top height.
const rocks = [];
for (let tries = 0; rocks.length < 120 && tries < 3000; tries++) {
  const ang = R() * 6.28, d = rand(6, 128), x = Math.cos(ang) * d, z = Math.sin(ang) * d, r = rand(0.4, 1.3) * (d > RIDGE_R ? 2 : 1);
  if (trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < (r + 1.2) ** 2)) continue;
  const L = lakeAt(x, z);
  if (L && Math.hypot(x - L.x, z - L.z) < L.r * 0.85) continue; // shore rocks are fine, rocks in open water aren't
  rocks.push({ x, z, r, y: h(x, z) - r * 0.3 });
}
{
  const m = shadowy(new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0),
    addDither(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true })), rocks.length));
  rocks.forEach((k, i) => {
    // random squash, a spin, and only a slight tilt, so the squashed side stays roughly upright
    // and the rock's shape matches the dome the deer stands on
    const sx = rand(1, 1.3), sy = rand(0.75, 0.95), sz = rand(1, 1.25);
    m.setMatrixAt(i, M.compose(P.set(k.x, k.y, k.z), Q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.3, R() * 6, (R() - 0.5) * 0.3)), S.set(k.r * sx, k.r * sy, k.r * sz)));
    m.setColorAt(i, C.setHSL(0.25, 0.06, 0.42 + R() * 0.12));
    // 0.9: between the dodecahedron's inner and outer radius
    k.hr = k.r * 0.9 * Math.min(sx, sz); k.vr = k.r * 0.9 * sy; k.peak = k.y + k.vr;
  });
}

/** Height of rock k's upper surface at (x, z), or -Infinity if (x, z) is outside its footprint. */
function rockTop(k, x, z) {
  const q = ((x - k.x) ** 2 + (z - k.z) ** 2) / (k.hr * k.hr);
  return q < 1 ? k.y + k.vr * Math.sqrt(1 - q) : -Infinity;
}

// ---------- Bushes ----------
// Purely decorative: nothing collides with them.
{
  const n = 280, m = shadowy(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.7, 0), leafMat, n));
  for (let i = 0; i < n; i++) {
    const ang = R() * 6.28, d = rand(4, 106), x = Math.cos(ang) * d, z = Math.sin(ang) * d, s = rand(0.5, 1.2);
    const L = lakeAt(x, z);
    if (L && Math.hypot(x - L.x, z - L.z) < L.r * 0.9) { m.setMatrixAt(i, M.makeScale(0, 0, 0)); continue; } // none in the water: hide this one
    m.setMatrixAt(i, M.compose(P.set(x, h(x, z) + 0.25 * s, z), Q.setFromAxisAngle(UP, R() * 6), S.set(s * 1.3, s * 0.8, s * 1.2)));
    m.setColorAt(i, C.setHSL(0.27 + R() * 0.05, 0.45, 0.24 + R() * 0.08));
  }
}

// ---------- Lakes ----------
// A flat, see-through disc at each lake's water level (terrain.js carves the bowl).
// The disc reaches a little past the water line; the sandy shore covers the rest.
// A few lily pads float on top. Uses its own random generator so it doesn't
// disturb the forest layout above.
const waterMat = new THREE.MeshStandardMaterial({ color: 0x3f7684, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.78 });
{
  const r3 = mulberry(77);
  const padMat = new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.8, flatShading: true });
  const padGeo = new THREE.CylinderGeometry(1, 1, 0.04, 9, 1, false, 0.5, Math.PI * 1.8); // a disc with a notch cut out
  for (const L of LAKES) {
    const water = new THREE.Mesh(new THREE.CircleGeometry(L.r * 0.92, 48).rotateX(-Math.PI / 2), waterMat);
    water.position.set(L.x, L.level, L.z);
    water.receiveShadow = true;
    scene.add(water);
    for (let i = 0; i < 7; i++) {
      const a = r3() * 6.28, d = (0.15 + r3() * 0.5) * L.r, s = 0.35 + r3() * 0.35;
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(L.x + Math.cos(a) * d, L.level + 0.03, L.z + Math.sin(a) * d);
      pad.scale.set(s, 1, s); pad.rotation.y = r3() * 6.28;
      scene.add(pad);
    }
  }
}

// ---------- Collision helpers ----------

/** Is point p inside tree t's leaves? Balls passing through leaves get slowed down. */
function inFoliage(t, p) {
  const dx = p.x - t.x, dz = p.z - t.z, d2 = dx * dx + dz * dz, s = t.s;
  if (d2 > 3.4 * s * s) return false; // quick reject: too far sideways
  const ly = (p.y - t.y) / s;         // height up the tree, in scale-1 units
  if (t.kind === 'pine') {
    const d = Math.sqrt(d2) / s;
    // inside a cone if within that tier's height and its radius at this height
    for (const k of PINE) if (ly > k.b && ly < k.b + k.h && d < k.r * (1 - (ly - k.b) / k.h)) return true;
    return false;
  }
  const dy = ly - CROWN.c;
  return d2 / (s * s) + dy * dy < CROWN.r * CROWN.r;
}

/** Push point p (only x/z) out of a circle at (x, z) with radius r. Used for trunks, rocks and bodies. */
function pushOut(p, x, z, r) {
  const dx = p.x - x, dz = p.z - z;
  if (Math.abs(dx) > r || Math.abs(dz) > r) return; // quick reject
  const d2 = dx * dx + dz * dz;
  if (d2 < r * r) { const d = Math.sqrt(d2) || 1e-4; p.x = x + dx / d * r; p.z = z + dz / d * r; }
}

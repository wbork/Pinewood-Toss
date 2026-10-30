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
// blending to rock on the ridges and snow on the highest parts.
{
  const g = new THREE.PlaneGeometry(380, 380, 190, 190); // 2 m between vertices
  g.rotateX(-Math.PI / 2);                                // lay it flat
  const p = g.attributes.position, cols = [];
  const a = new THREE.Color(0x587f35), b = new THREE.Color(0x7b9b44), dirt = new THREE.Color(0x6e5a3b);
  const rockA = new THREE.Color(0x6d675b), rockB = new THREE.Color(0x4f4b44), snow = new THREE.Color(0xe8ece9);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = h(x, z), r = Math.hypot(x, z);
    p.setY(i, y);
    // two grass greens in soft patches, with the odd dirt spot
    const v = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.cos(z * 0.27) * 2) * Math.cos(z * 0.19);
    const c = a.clone().lerp(b, v);
    if (R() < 0.07) c.lerp(dirt, 0.55);
    // rock past the foot of the ridge (with a ragged edge), snow up high
    c.lerp(rockA.clone().lerp(rockB, R()), smooth(RIDGE_R + 3, RIDGE_R + 15, r + R() * 4));
    if (y > 31 + 4 * Math.sin(x * 0.2 + z * 0.13) + R() * 3) c.copy(snow);
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  // flatShading gives each triangle one flat color: the low-poly look
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  ground.receiveShadow = true;
  scene.add(ground);
}

// ---------- Far peaks ----------
// A ring of tall snow-capped cones behind the ridge, for a mountain skyline.
// Each peak is a grey cone plus a smaller white cone sitting on its top third.
{
  const n = 46, rock = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const peaks = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), rock, n);
  const caps = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xeef1ef, roughness: 0.9, flatShading: true }), n);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + R() * 0.12, d = rand(140, 175);
    const x = Math.cos(ang) * d, z = Math.sin(ang) * d, w = rand(22, 38), ht = rand(45, 80), y = h(x, z) - 6;
    Q.setFromAxisAngle(UP, R() * 6);
    peaks.setMatrixAt(i, M.compose(P.set(x, y, z), Q, S.set(w, ht, w)));
    peaks.setColorAt(i, C.setHSL(0.09, 0.06, 0.32 + R() * 0.1));
    caps.setMatrixAt(i, M.compose(P.set(x, y + ht * 0.64, z), Q, S.set(w * 0.375, ht * 0.36, w * 0.375)));
  }
  scene.add(peaks, caps);
}

// ---------- Trees ----------
// Sizes below are for a tree at scale 1; each tree gets its own scale s.
// Pines are three stacked cones (b = base height, h = cone height, r = radius);
// "round" trees have one ball-shaped crown.
const PINE = [{ b: 1.2, h: 2.6, r: 1.8 }, { b: 2.4, h: 2.3, r: 1.4 }, { b: 3.5, h: 2.0, r: 1.0 }];
const CROWN = { c: 3.6, r: 1.7 }; // crown center height and radius

// Scatter up to 400 trees, at least ~3 m apart, keeping the spawn clearing (7 m) open.
// Each entry: position (x, y, z), scale s, kind, trunk radius r, trunk height th, rotation.
const trees = [];
for (let tries = 0; trees.length < 400 && tries < 8000; tries++) {
  const ang = R() * Math.PI * 2, d = Math.sqrt(R()) * 94;
  const x = Math.cos(ang) * d, z = Math.sin(ang) * d;
  if (d < 7) continue;
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
// Up to 70 boulders, never inside a tree; the ones out on the ridges are twice as big.
// They're sunk 30% into the ground so they look settled.
const rocks = [];
for (let tries = 0; rocks.length < 70 && tries < 2000; tries++) {
  const ang = R() * 6.28, d = rand(6, 98), x = Math.cos(ang) * d, z = Math.sin(ang) * d, r = rand(0.4, 1.3) * (d > RIDGE_R ? 2 : 1);
  if (trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < (r + 1.2) ** 2)) continue;
  rocks.push({ x, z, r, y: h(x, z) - r * 0.3 });
}
{
  const m = shadowy(new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0),
    addDither(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true })), rocks.length));
  rocks.forEach((k, i) => {
    // random tumble and squash so no two rocks look alike
    m.setMatrixAt(i, M.compose(P.set(k.x, k.y, k.z), Q.setFromEuler(new THREE.Euler(R(), R() * 6, R())), S.set(k.r * rand(1, 1.3), k.r * rand(0.75, 0.95), k.r * rand(1, 1.25))));
    m.setColorAt(i, C.setHSL(0.25, 0.06, 0.42 + R() * 0.12));
  });
}

// ---------- Bushes ----------
// Purely decorative: nothing collides with them.
{
  const n = 160, m = shadowy(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.7, 0), leafMat, n));
  for (let i = 0; i < n; i++) {
    const ang = R() * 6.28, d = rand(4, 80), x = Math.cos(ang) * d, z = Math.sin(ang) * d, s = rand(0.5, 1.2);
    m.setMatrixAt(i, M.compose(P.set(x, h(x, z) + 0.25 * s, z), Q.setFromAxisAngle(UP, R() * 6), S.set(s * 1.3, s * 0.8, s * 1.2)));
    m.setColorAt(i, C.setHSL(0.27 + R() * 0.05, 0.45, 0.24 + R() * 0.08));
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

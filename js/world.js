/* =========================================================================
   world.js — builds the scenery: ground, trees, rocks, bushes and lakes,
   lays out the Hollow King cult's ritual sites (cult.js draws them), plus
   the collision helpers that let things bump into them.

   A NEW MAP EVERY RUN: newMap() picks a random seed, lays out new terrain
   (terrain.js → generateTerrain) and rebuilds all the scenery here to match
   (buildWorld). game.js calls it when a new run begins, and newMap(TITLE_SEED,
   true) for the title screen, which is always the same forest with a clear
   stage for the monsters. Every R() / rand()
   in buildWorld comes from the seeded generator, reseeded from the map's
   seed, so a given seed always makes the same forest.

   Trees, rocks and bushes use InstancedMesh: one mesh drawn hundreds of
   times with different positions/sizes/colors, which is far faster than
   hundreds of separate meshes. Materials, textures and shapes are made
   once and reused by every map; only the meshes are rebuilt.
   ========================================================================= */

/** Add a mesh to the scene with shadows on (it both casts and receives them), remembered for the next rebuild. */
const worldObjs = [];
const shadowy = m => { m.castShadow = true; m.receiveShadow = true; return keep(m); };
const keep = m => { scene.add(m); worldObjs.push(m); return m; };

// ---------- Shared looks (made once) ----------
// A 512×512 grain texture painted in code: thousands of short pale and dark flecks on white,
// so it only shades the ground's vertex colors. It repeats every 5 m.
const groundTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const cx = cv.getContext('2d'), rt = mulberry(9200);
  cx.fillStyle = '#e6e6e6'; cx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14000; i++) {
    const l = Math.round(200 + rt() * 55), x = rt() * 512, y = rt() * 512, a2 = rt() * Math.PI, len = 3 + rt() * 7;
    cx.strokeStyle = 'rgb(' + l + ',' + l + ',' + l + ')'; cx.lineWidth = 1 + rt() * 1.5;
    cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + Math.cos(a2) * len, y + Math.sin(a2) * len); cx.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(96, 96);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
})();
// flatShading gives each triangle one flat color: the low-poly look
const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: groundTex, roughness: 1, flatShading: true });
const trunkMat = addDither(new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 1, flatShading: true }));
// Leaves: a white base color, so each instance's own green (setColorAt) shows through. Shared by
// pine tiers, round crowns and bushes; like the trunks and rocks it dithers when it hides the deer.
const leafMat = addDither(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }));
const rockMat = addDither(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }));
const waterMat = new THREE.MeshStandardMaterial({ color: 0x3f7684, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.78 });
const padMat = new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.8, flatShading: true });

// Tree sizes for a tree at scale 1; each tree gets its own scale s.
// Pines are three stacked cones (b = base height, h = cone height, r = radius);
// "round" trees have one ball-shaped crown.
const PINE = [{ b: 1.2, h: 2.6, r: 1.8 }, { b: 2.4, h: 2.3, r: 1.4 }, { b: 3.5, h: 2.0, r: 1.0 }];
const CROWN = { c: 3.6, r: 1.7 }; // crown center height and radius
const SHAPES = {
  trunk: new THREE.CylinderGeometry(0.64, 1, 1, 12).translate(0, 0.5, 0),
  pine: PINE.map(k => new THREE.ConeGeometry(k.r, k.h, 14, 2).translate(0, k.b + k.h / 2, 0)),
  crown: new THREE.IcosahedronGeometry(CROWN.r, 2).translate(0, CROWN.c, 0),
  rock: new THREE.DodecahedronGeometry(1, 1),
  bush: new THREE.IcosahedronGeometry(0.7, 1),
  pad: new THREE.CylinderGeometry(1, 1, 0.04, 9, 1, false, 0.5, Math.PI * 1.8), // a lily pad: a disc with a notch cut out
};

// The scenery of the current map (rebuilt by buildWorld). Other files read these for collisions.
// trees: position (x, y, z), scale s, kind, trunk radius r, trunk height th, rotation.
// rocks: center (x, y, z), size r, plus the dome the deer can stand on (see rockTop):
//        hr = footprint radius, vr = height of the dome above the center, peak = top height.
const trees = [];
const rocks = [];

// ---------- The cult of the Hollow King ----------
// Why the game happens in these woods: a cult that worships the Hollow King has been holding its
// rites here. Every map has 3–5 ritual sites (a sigil burned glowing into the ground, an altar with
// a deer skull and candles, a ring of carved standing stones, antlered totems and a wicker effigy),
// plus lone totems, stones and effigies scattered through the trees. On the title map one site
// stands right behind the monsters, with the Hollow King before his altar.
// This file only decides WHERE everything goes (so trees, rocks and bushes keep clear of it);
// cult.js builds the meshes and glows once the Blender props are loaded.
const cult = [];        // every fixture: { name, x, z, y (ground height), rot (radians about Y; its front is local +Z) }
const cultSites = [];   // ritual site centers: { x, z, rot }
const cultClear = [];   // circles { x, z, r } that trees, rocks and bushes stay out of
// Solid fixtures: their collision circle (radius r, height th), added to trees[] as kind 'post'.
const CULT_SOLID = { altar: { r: 0.9, th: 1.1 }, monolith: { r: 0.45, th: 2.6 }, totem: { r: 0.16, th: 3.1 }, effigy: { r: 0.3, th: 3.0 } };
const TITLE_SITE = { x: -1.0, z: 22, rot: Math.PI, altar: -3.6 };   // facing the title camera; the altar 3.6 m behind the King

/** Lay out the cult's fixtures for the current terrain. Uses its own random numbers so the forest doesn't shift. */
function layCult() {
  cult.length = 0; cultSites.length = 0; cultClear.length = 0;
  const rc = mulberry(MAP_SEED + 6660), rr = (a, b) => a + rc() * (b - a);
  const add = (name, x, z, rot) => cult.push({ name, x, z, rot, y: h(x, z) });
  const dry = (x, z, r) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([dx, dz]) => !lakeAt(x + dx, z + dz));
  const offStage = (x, z, r) => !onStage(x, z) && !onStage(x + r, z) && !onStage(x - r, z) && !onStage(x, z + r) && !onStage(x, z - r);
  const free = (x, z, r) => !cultClear.some(c => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + r) ** 2);

  /** A ritual site centered at (x, z), its front (the open side of the stone ring) facing rot. */
  function site(x, z, rot, altarAt = 0) {
    const at = (lx, lz) => [x + lx * Math.cos(rot) + lz * Math.sin(rot), z - lx * Math.sin(rot) + lz * Math.cos(rot)];
    cultSites.push({ x, z, rot });
    cultClear.push({ x, z, r: 9 });
    add('sigil', x, z, rot);
    add('altar', ...at(0, altarAt), rot);
    for (let i = 0; i < 6; i++) {   // six standing stones in a ring 5.2 m out, each facing in; the front is left open, and a gap at the back frames the effigy
      const a = Math.PI / 3 + i / 5 * (Math.PI * 4 / 3);
      add('monolith', ...at(Math.sin(a) * 5.2, Math.cos(a) * 5.2), rot + a + Math.PI + (rc() - 0.5) * 0.2);
    }
    for (const [lx, lz] of [[1.7, 1.6], [-1.7, 1.6], [1.9, altarAt - 1.4], [-1.9, altarAt - 1.4]]) add('candles', ...at(lx, lz), rc() * 6.28);
    for (const s of [1, -1]) add('totem', ...at(s * 4.6, -5.6), rot + s * 0.35);   // two totems behind, either side
    add('effigy', ...at(0, -7.4), rot);                                          // the effigy looms at the back
  }

  // the title map: one site right behind the monsters, facing the camera
  if (TERRAIN.stage) {
    site(TITLE_SITE.x, TITLE_SITE.z, TITLE_SITE.rot, TITLE_SITE.altar);
    cultClear.push({ x: TITLE_SITE.x, z: TITLE_SITE.z + 13, r: 8 });   // and no big tree right behind the effigy
  }
  // 3–5 sites out in the woods, each facing the middle of the arena, on dry and fairly level ground
  const want = TERRAIN.stage ? 3 : 3 + Math.floor(rc() * 3);
  for (let tries = 0; cultSites.length < want + (TERRAIN.stage ? 1 : 0) && tries < 400; tries++) {
    const ang = rc() * 6.28, d = rr(24, 92), x = Math.cos(ang) * d, z = Math.sin(ang) * d;
    if (!dry(x, z, 9) || !offStage(x, z, 10) || cultSites.some(s => (s.x - x) ** 2 + (s.z - z) ** 2 < 36 * 36)) continue;
    const y = h(x, z);
    if ([[6, 0], [-6, 0], [0, 6], [0, -6]].some(([dx, dz]) => Math.abs(h(x + dx, z + dz) - y) > 1.2)) continue;
    site(x, z, Math.atan2(-x, -z));
  }
  // lone fixtures scattered through the trees: totems, standing stones, effigies (each with candles)
  for (const [name, n] of [['totem', 12], ['monolith', 8], ['effigy', 4]]) {
    for (let k = 0, tries = 0; k < n && tries < 300; tries++) {
      const ang = rc() * 6.28, d = rr(12, 100), x = Math.cos(ang) * d, z = Math.sin(ang) * d;
      if (!dry(x, z, 2) || !offStage(x, z, 3) || !free(x, z, 3)) continue;
      const rot = rc() * 6.28;
      add(name, x, z, rot);
      if (name !== 'totem') add('candles', x + Math.sin(rot) * 1.1, z + Math.cos(rot) * 1.1, rc() * 6.28);
      cultClear.push({ x, z, r: 2 });
      k++;
    }
  }
}
const inCultClear = (x, z, pad = 0) => cultClear.some(c => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + pad) ** 2);

/** Rebuild every piece of scenery for the current terrain (generateTerrain first). */
function buildWorld() {
  for (const o of worldObjs) {
    scene.remove(o);
    if (o.isInstancedMesh && o.dispose) o.dispose();
    if (o.userData.ownGeo) o.geometry.dispose();
  }
  worldObjs.length = 0; trees.length = 0; rocks.length = 0;
  layCult();   // first, so the scenery below keeps clear of the cult's sites

  // ---------- Ground ----------
  // A big flat grid bent to match h(x, z), 1 m between vertices, colored per vertex: grass in
  // the arena, sand and mud around the lakes, rock on the ridges and snow on the highest parts.
  {
    const g = new THREE.PlaneGeometry(480, 480, 480, 480);
    g.rotateX(-Math.PI / 2);                                // lay it flat
    const p = g.attributes.position, cols = new Float32Array(p.count * 3);
    const rg = mulberry(MAP_SEED + 9100); // the ground's own random numbers
    const a = new THREE.Color(0x587f35), b = new THREE.Color(0x7b9b44), dirt = new THREE.Color(0x6e5a3b);
    const sand = new THREE.Color(0xa4925f), mud = new THREE.Color(0x4a4a33);
    const rockA = new THREE.Color(0x6d675b), rockB = new THREE.Color(0x4f4b44), snow = new THREE.Color(0xe8ece9);
    const c = new THREE.Color(), rc = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = h(x, z), r = Math.hypot(x, z);
      p.setY(i, y);
      // two grass greens in soft patches, with the odd dirt spot
      const v = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.cos(z * 0.27) * 2) * Math.cos(z * 0.19);
      c.copy(a).lerp(b, v);
      if (rg() < 0.05) c.lerp(dirt, 0.45);
      // lakes: a sandy beach just above the water line, dark mud under the water
      const L = lakeAt(x, z);
      if (L) c.lerp(y < L.level ? mud : sand, y < L.level ? 0.85 : 1 - smooth(L.level + 0.15, L.level + SHORE + 0.05, y) * 0.7);
      // rock past the foot of the ridge (with a ragged edge), snow up high
      c.lerp(rc.copy(rockA).lerp(rockB, rg()), smooth(RIDGE_R + 3, RIDGE_R + 15, r + rg() * 4));
      // snow above the snow line, except on steep faces (snow slides off), which stay bare rock
      if (y > 31 + 4 * Math.sin(x * 0.2 + z * 0.13) + rg() * 3 && (r < RIDGE_R + 10 || normalAt(x, z, nrm).y > 0.45)) c.copy(snow);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const ground = keep(new THREE.Mesh(g, groundMat));
    ground.receiveShadow = true; ground.userData.ownGeo = true;
  }

  // ---------- Trees ----------
  // Scatter up to 680 trees, at least ~3 m apart, keeping the spawn clearing (7 m) and the lakes
  // open. Sizes vary: about 1 in 8 is a big old giant (up to ~3× a sapling), about 1 in 6 a
  // young sapling.
  const rs = mulberry(MAP_SEED + 4242);
  for (let tries = 0; trees.length < 680 && tries < 14000; tries++) {
    const ang = R() * Math.PI * 2, d = Math.sqrt(R()) * 124;
    const x = Math.cos(ang) * d, z = Math.sin(ang) * d;
    if (d < 7 || lakeAt(x, z) || onStage(x, z) || inCultClear(x, z)) continue;   // (onStage: the title screen's stage, terrain.js)
    if (trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < 10)) continue;
    const roll = rs(), age = roll < 0.12 ? 1.45 + rs() * 0.45 : roll < 0.29 ? 0.55 + rs() * 0.2 : 0.9 + rs() * 0.25;
    const s = rand(0.8, 1.5) * age, kind = R() < 0.25 && d < RIDGE_R ? 'round' : 'pine';
    trees.push({ x, z, y: h(x, z) - 0.1, s, kind, r: 0.28 * s, th: (kind === 'pine' ? 2.2 : 2.9) * s, rot: R() * 6.28 });
  }
  const pines = trees.filter(t => t.kind === 'pine'), rounds = trees.filter(t => t.kind === 'round');
  const trunks = shadowy(new THREE.InstancedMesh(SHAPES.trunk, trunkMat, trees.length));
  trees.forEach((t, i) => trunks.setMatrixAt(i, M.compose(P.set(t.x, t.y, t.z), Q.setFromAxisAngle(UP, t.rot), S.set(t.r, t.th, t.r))));
  PINE.forEach((k, ti) => {
    const m = shadowy(new THREE.InstancedMesh(SHAPES.pine[ti], leafMat, pines.length));
    const r2 = mulberry(MAP_SEED + ti + 3);
    pines.forEach((t, i) => {
      m.setMatrixAt(i, M.compose(P.set(t.x, t.y, t.z), Q.setFromAxisAngle(UP, t.rot + ti), S.setScalar(t.s)));
      m.setColorAt(i, C.setHSL(0.31 + (r2() - 0.5) * 0.06, 0.42, 0.2 + ti * 0.025 + r2() * 0.06)); // higher tiers slightly lighter
    });
  });
  {
    const m = shadowy(new THREE.InstancedMesh(SHAPES.crown, leafMat, rounds.length));
    rounds.forEach((t, i) => {
      m.setMatrixAt(i, M.compose(P.set(t.x, t.y, t.z), Q.setFromAxisAngle(UP, t.rot), S.set(t.s, t.s * rand(0.9, 1.15), t.s)));
      m.setColorAt(i, C.setHSL(0.22 + R() * 0.06, 0.5, 0.3 + R() * 0.08)); // yellower green than the pines
    });
  }

  // ---------- Rocks ----------
  // Up to 120 boulders, never inside a tree or out in a lake; the ones on the ridges are twice
  // as big. They're sunk 30% into the ground so they look settled.
  for (let tries = 0; rocks.length < 120 && tries < 3000; tries++) {
    const ang = R() * 6.28, d = rand(6, 128), x = Math.cos(ang) * d, z = Math.sin(ang) * d, r = rand(0.4, 1.3) * (d > RIDGE_R ? 2 : 1);
    if (trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < (r + 1.2) ** 2) || onStage(x, z) || inCultClear(x, z, r)) continue;
    const L = lakeAt(x, z);
    if (L && Math.hypot(x - L.x, z - L.z) < L.r * 0.85) continue; // shore rocks are fine, rocks in open water aren't
    rocks.push({ x, z, r, y: h(x, z) - r * 0.3 });
  }
  {
    const m = shadowy(new THREE.InstancedMesh(SHAPES.rock, rockMat, rocks.length));
    rocks.forEach((k, i) => {
      // random squash, a spin, and only a slight tilt, so the squashed side stays roughly upright
      // and the rock's shape matches the dome the deer stands on
      const sx = rand(1, 1.3), sy = rand(0.75, 0.95), sz = rand(1, 1.25);
      m.setMatrixAt(i, M.compose(P.set(k.x, k.y, k.z), Q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.3, R() * 6, (R() - 0.5) * 0.3)), S.set(k.r * sx, k.r * sy, k.r * sz)));
      m.setColorAt(i, C.setHSL(0.25, 0.06, 0.42 + R() * 0.12));
      // 0.95: the subdivided dodecahedron is nearly round (its surface sits just inside radius 1)
      k.hr = k.r * 0.95 * Math.min(sx, sz); k.vr = k.r * 0.95 * sy; k.peak = k.y + k.vr;
    });
  }

  // ---------- Bushes ----------
  // Purely decorative: nothing collides with them.
  {
    const n = 280, m = shadowy(new THREE.InstancedMesh(SHAPES.bush, leafMat, n));
    for (let i = 0; i < n; i++) {
      const ang = R() * 6.28, d = rand(4, 106), x = Math.cos(ang) * d, z = Math.sin(ang) * d, s = rand(0.5, 1.2);
      const L = lakeAt(x, z);
      if ((L && Math.hypot(x - L.x, z - L.z) < L.r * 0.9) || (onStage(x, z) && Math.abs(x) < 9) || inCultClear(x, z)) { m.setMatrixAt(i, M.makeScale(0, 0, 0)); continue; } // none in the water, the cult's sites, or blocking the title's monsters: hide this one
      m.setMatrixAt(i, M.compose(P.set(x, h(x, z) + 0.25 * s, z), Q.setFromAxisAngle(UP, R() * 6), S.set(s * 1.3, s * 0.8, s * 1.2)));
      m.setColorAt(i, C.setHSL(0.27 + R() * 0.05, 0.45, 0.24 + R() * 0.08));
    }
  }

  // ---------- Lakes ----------
  // A flat, see-through disc at each lake's water level (terrain.js carves the bowl), reaching
  // a little past the water line; the sandy shore covers the rest. Lily pads float on top.
  const r3 = mulberry(MAP_SEED + 77);
  for (const L of LAKES) {
    const water = keep(new THREE.Mesh(new THREE.CircleGeometry(L.r * 0.92, 48).rotateX(-Math.PI / 2), waterMat));
    water.position.set(L.x, L.level, L.z);
    water.receiveShadow = true; water.userData.ownGeo = true;
    for (let i = 0; i < 7; i++) {
      const a = r3() * 6.28, d = (0.15 + r3() * 0.5) * L.r, s = 0.35 + r3() * 0.35;
      const pad = keep(new THREE.Mesh(SHAPES.pad, padMat));
      pad.position.set(L.x + Math.cos(a) * d, L.level + 0.03, L.z + Math.sin(a) * d);
      pad.scale.set(s, 1, s); pad.rotation.y = r3() * 6.28;
    }
  }

  // ---------- Cult fixtures: collisions ----------
  // The solid ones (altars, standing stones, totems, effigies) block the deer, creatures and balls
  // like trunks do: they join trees[] as kind 'post' (no leaves; see inFoliage). Added after the
  // tree meshes are built, so they aren't drawn as trees. cult.js draws them.
  for (const c of cult) {
    const k = CULT_SOLID[c.name];
    if (k) trees.push({ x: c.x, z: c.z, y: c.y, s: 1, kind: 'post', r: k.r, th: k.th, rot: c.rot });
  }
  if (typeof buildCult === 'function') buildCult();   // (not yet loaded on the very first map: cult.js builds that one itself)
}

/**
 * A brand-new map: new terrain from `seed` (random by default) and new scenery to match.
 * stage: keep the title screen's stage clear (only for the title map, TITLE_SEED).
 */
function newMap(seed = (Math.random() * 2 ** 31) | 0, stage = false) {
  generateTerrain(seed, stage);
  R = mulberry(seed ^ 0x5eed);
  buildWorld();
}
R = mulberry(MAP_SEED ^ 0x5eed);
buildWorld(); // the first map: the title screen's (terrain.js already laid out its terrain)

// ---------- Collision helpers ----------

/** Height of rock k's upper surface at (x, z), or -Infinity if (x, z) is outside its footprint. */
function rockTop(k, x, z) {
  const q = ((x - k.x) ** 2 + (z - k.z) ** 2) / (k.hr * k.hr);
  return q < 1 ? k.y + k.vr * Math.sqrt(1 - q) : -Infinity;
}

/** Is point p inside tree t's leaves? Balls passing through leaves get slowed down. */
function inFoliage(t, p) {
  if (t.kind === 'post') return false; // the cult's stones and totems have no leaves
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

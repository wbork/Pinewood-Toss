/* =========================================================================
   cult.js — draws the Hollow King cult's fixtures that world.js laid out
   (layCult → cult[]): altars, carved standing stones, antlered totems, wicker
   effigies, candles, and the King's sigil burned glowing into the ground at
   each ritual site. The models come from Blender (blender/build_props.py →
   js/models/props.js).

   Each kind of fixture is one InstancedMesh (every altar on the map in one
   draw call, and so on). The ground sigils are the exception: each gets its
   own copy of the geometry, bent to follow the ground under it, so the
   burned lines never float or sink on a slope. Candle flames and sigils get
   soft glow sprites that flicker (stepCult, called every frame by game.js).
   ========================================================================= */

// How far each model sinks into the ground (so nothing looks perched on top of it).
const CULT_SINK = { altar: 0.08, monolith: 0, totem: 0, effigy: 0.05, candles: 0.02 };
// Glows on each kind of fixture: [local x, y, z, size, color]. Candle flames are warm; sigils ember red.
const CULT_GLOWS = {
  candles: [[0, 0.32, 0, 1.3, 0xffa040]],
  altar: [[0.7, 1.13, 0.32, 0.6, 0xffa040], [-0.7, 1.13, 0.32, 0.6, 0xffa040], [0.7, 1.13, -0.32, 0.6, 0xffa040], [-0.7, 1.13, -0.32, 0.6, 0xffa040],
          [0, 0.76, 0.6, 0.9, 0xff4a24]],
  monolith: [[0, 1.5, 0.4, 1.0, 0xff4a24]],
};
const cultGlows = []; // { s: sprite, base: size, ph: phase } for the flicker

/** Build every cult fixture on the current map (world.js's buildWorld calls this; so does this file, for the first map). */
function buildCult() {
  cultGlows.length = 0;
  if (!propMesh('altar')) return; // the props file isn't loaded: no cult (the game still works)
  const byName = {};
  for (const c of cult) (byName[c.name] = byName[c.name] || []).push(c);

  // the solid fixtures and candles: one instanced mesh per kind. The tall ones fade out (dither)
  // when they stand between the camera and the deer, like trees do.
  for (const name of ['altar', 'monolith', 'totem', 'effigy', 'candles']) {
    const list = byName[name];
    if (!list) continue;
    const pm = propMesh(name);
    if (name !== 'candles' && !pm.material.dithered) { pm.material.forEach(addDither); pm.material.dithered = true; }
    const m = shadowy(new THREE.InstancedMesh(pm.geometry, pm.material, list.length));
    list.forEach((c, i) => m.setMatrixAt(i, M.compose(P.set(c.x, c.y - CULT_SINK[name], c.z), Q.setFromAxisAngle(UP, c.rot), S.setScalar(1))));
    // glows, turned with the fixture
    for (const c of list) for (const [lx, ly, lz, size, color] of CULT_GLOWS[name] || []) {
      const s = keep(new THREE.Sprite(glow(color)));
      s.position.set(c.x + lx * Math.cos(c.rot) + lz * Math.sin(c.rot), c.y + ly, c.z - lx * Math.sin(c.rot) + lz * Math.cos(c.rot));
      s.scale.setScalar(size);
      cultGlows.push({ s, base: size, ph: Math.random() * 100 });
    }
  }

  // the ground sigils: each vertex is turned into place and dropped onto the ground beneath it
  const sig = propMesh('sigil');
  for (const c of byName.sigil || []) {
    const g = sig.geometry.clone(), p = g.attributes.position, co = Math.cos(c.rot), si = Math.sin(c.rot);
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i), lz = p.getZ(i), x = c.x + lx * co + lz * si, z = c.z - lx * si + lz * co;
      p.setXYZ(i, x, h(x, z) + p.getY(i) - 0.03, z);
    }
    g.computeVertexNormals(); g.computeBoundingSphere();
    const m = keep(new THREE.Mesh(g, sig.material));
    m.receiveShadow = true; m.userData.ownGeo = true;
    // a low red haze hanging over the sigil
    const haze = keep(new THREE.Sprite(glow(0xff3a1a)));
    haze.material.opacity = 0.45;
    haze.position.set(c.x, c.y + 0.6, c.z); haze.scale.setScalar(6.5);
    cultGlows.push({ s: haze, base: 6.5, ph: Math.random() * 100, slow: true });
  }
}

/** Candle flames and sigils flicker (a gentle, uneven pulse). */
function stepCult(now) {
  for (const g of cultGlows) {
    const t = now / (g.slow ? 600 : 90) + g.ph;
    g.s.scale.setScalar(g.base * (0.86 + 0.1 * Math.sin(t) + 0.05 * Math.sin(t * 2.7)));
  }
}

buildCult(); // the first map (world.js built its scenery before the props were loaded)

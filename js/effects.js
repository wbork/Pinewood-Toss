/* =========================================================================
   effects.js — short-lived visual effects: flying chips when something is
   hit or a creature spawns, and the expanding ring of a Pinecone Burst.
   ========================================================================= */

// ---------- Chips ----------
// Little boxes that fly out, bounce once on the ground, and shrink away.
const chipGeo = new THREE.BoxGeometry(0.1, 0.06, 0.14);
const chipMats = {}; // one material per color, created the first time it's needed
const chips = [];

/** Spray `n` chips of `color` from point `at`. */
function burst(at, color, n = 12) {
  const mat = chipMats[color] || (chipMats[color] = new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(chipGeo, mat);
    m.position.copy(at); m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    scene.add(m);
    chips.push({ m, vel: new V3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6), life: 1.2 + Math.random() * 0.6 });
  }
}

// ---------- Splash rings ----------
// A flat ring on the ground (or water) that grows to `radius` and fades in 0.35 s.
// Pale gold for a Pinecone Burst; pale blue for splashes in a lake.
const rings = [];
const ringGeo = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);

/** Show a splash ring of `radius` meters centered under point `at`. */
function ring(at, radius, color = 0xffe2a0) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
  m.position.set(at.x, surfH(at.x, at.z) + 0.08, at.z);
  scene.add(m);
  rings.push({ m, radius, t: 0 });
}

/** Move chips and grow rings. Called every frame while playing. */
function stepEffects(dt) {
  for (let i = chips.length - 1; i >= 0; i--) {
    const c = chips[i];
    c.life -= dt; c.vel.y -= G * dt;
    c.m.position.addScaledVector(c.vel, dt);
    c.m.rotation.x += dt * 8; c.m.rotation.y += dt * 5;
    const gy = surfH(c.m.position.x, c.m.position.z) + 0.03; // chips float on water
    if (c.m.position.y < gy) { c.m.position.y = gy; c.vel.multiplyScalar(0.3); c.vel.y = 0; } // land and skid
    if (c.life < 0.3) c.m.scale.setScalar(Math.max(0.001, c.life / 0.3));                       // shrink away
    if (c.life <= 0) { scene.remove(c.m); chips.splice(i, 1); }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const q = rings[i];
    q.t += dt;
    const k = Math.min(1, q.t / 0.35);
    q.m.scale.setScalar(0.2 + q.radius * (1 - Math.pow(1 - k, 2))); // fast at first, easing out
    q.m.material.opacity = 0.8 * (1 - k);
    if (k >= 1) { scene.remove(q.m); q.m.material.dispose(); rings.splice(i, 1); }
  }
}

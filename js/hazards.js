/* =========================================================================
   hazards.js — the creatures' ranged and area attacks, which all hurt the
   deer (creature abilities live in creatures.js and bosses.js; this file is
   the shared machinery they use):

   - bolts:  slow projectiles flying in a straight line (wisps, bosses). Dodge them.
   - clouds: poison clouds that hurt while you stand in them (spore puffers).
   - marks:  a red circle on the ground that erupts after a delay (boss slams
             and roots). Get out of the circle before it fills in.
   - waves:  a shockwave ring racing outward along the ground (Hollow King).
             Jump over it as it passes.

   Every hazard is cleared when a run resets (clearHazards).
   ========================================================================= */

const bolts = [], clouds = [], marks = [], waves = [];

// ---------- Looks ----------
const boltGeo = new THREE.SphereGeometry(0.16, 8, 6);
const boltMats = {}; // one per color
const markGeo = new THREE.CircleGeometry(1, 36).rotateX(-Math.PI / 2);
const markRingGeo = new THREE.RingGeometry(0.93, 1, 48).rotateX(-Math.PI / 2);
const waveGeo = new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2);

/** Fire a bolt from `from` toward point `to` at `speed` m/s, dealing `dmg`. color: its glow. */
function fireBolt(from, to, speed, dmg, color = 0x9a6cff) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(boltGeo, boltMats[color] || (boltMats[color] = new THREE.MeshBasicMaterial({ color })));
  const halo = new THREE.Sprite(glow(color)); halo.scale.setScalar(1.1);
  g.add(core, halo); g.position.copy(from);
  scene.add(g);
  bolts.push({ g, vel: to.clone().sub(from).normalize().multiplyScalar(speed), dmg, life: 5 });
}

/** A poison cloud at p: radius r, lasting t seconds, hurting `dps` per second while you're inside. */
function poisonCloud(p, r, t, dps) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ color: 0x9be04a, transparent: true, opacity: 0.25, depthWrite: false }));
  disc.scale.setScalar(r); g.add(disc);
  const puff = new THREE.Sprite(glow(0x8fd040)); puff.scale.setScalar(r * 2.6); puff.position.y = 0.9; g.add(puff);
  g.position.set(p.x, surfH(p.x, p.z) + 0.06, p.z);
  scene.add(g);
  clouds.push({ g, disc, puff, r, t, life: t, dps });
}

/**
 * A telegraphed eruption: a red circle at p (radius r) that fills in over `delay` seconds,
 * then erupts for `dmg` if the deer is inside. `color` tints the spikes that shoot up.
 */
function markGround(p, r, delay, dmg, color = 0x5a2a3a) {
  const g = new THREE.Group();
  const fill = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.12, depthWrite: false }));
  const edge = new THREE.Mesh(markRingGeo, new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.8, depthWrite: false }));
  edge.scale.setScalar(r); fill.scale.setScalar(0.01); g.add(fill, edge);
  g.position.set(p.x, surfH(p.x, p.z) + 0.07, p.z);
  scene.add(g);
  marks.push({ g, fill, r, t: delay, delay, dmg, color });
}

/** A shockwave ring from p, expanding to `max` m at `speed` m/s. Hits for `dmg` unless you jump it. */
function shockwave(p, speed, max, dmg) {
  const m = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(p.x, h(p.x, p.z) + 0.15, p.z);
  scene.add(m);
  waves.push({ m, x: p.x, z: p.z, rad: 0.5, speed, max, dmg, hit: false });
  sfx.boom();
}

/** Where the deer's body is, for bolt hits. */
const deerChest = () => tmp2.set(player.pos.x, player.pos.y + 1.1, player.pos.z);

/** Move and resolve every hazard. Called every frame while playing. */
function stepHazards(dt) {
  // bolts: fly straight; hit the deer, the ground, or fizzle out
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i], p = b.g.position;
    p.addScaledVector(b.vel, dt);
    b.life -= dt;
    b.g.children[1].scale.setScalar(1 + Math.sin(b.life * 20) * 0.15);
    let gone = b.life <= 0 || p.y < h(p.x, p.z);
    if (!gone && p.distanceTo(deerChest()) < 0.75) { hurt(b.dmg, p); gone = true; }
    if (gone) { scene.remove(b.g); bolts.splice(i, 1); }
  }
  // poison clouds: hurt while you stand inside; fade out at the end
  for (let i = clouds.length - 1; i >= 0; i--) {
    const c = clouds[i];
    c.t -= dt;
    if (Math.hypot(player.pos.x - c.g.position.x, player.pos.z - c.g.position.z) < c.r && player.pos.y < c.g.position.y + 2.5) sting(c.dps * dt);
    const fade = Math.min(1, c.t);
    c.disc.material.opacity = 0.25 * fade; c.puff.material.opacity = fade;
    c.puff.scale.setScalar(c.r * (2.4 + Math.sin(c.t * 3) * 0.15));
    if (c.t <= 0) { scene.remove(c.g); clouds.splice(i, 1); }
  }
  // marks: fill in, then erupt
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i];
    m.t -= dt;
    const k = 1 - Math.max(0, m.t) / m.delay;
    m.fill.scale.setScalar(Math.max(0.01, m.r * k));
    m.fill.material.opacity = 0.12 + 0.3 * k;
    if (m.t <= 0) {
      const p = m.g.position;
      burst(p.clone().add(P.set(0, 0.4, 0)), m.color, 14);
      ring(p, m.r, 0xff7a5a);
      if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < m.r + 0.3 && player.pos.y < p.y + 1.6) hurt(m.dmg, p);
      sfx.thud(8);
      scene.remove(m.g); marks.splice(i, 1);
    }
  }
  // waves: grow outward; hit once if the deer is on the ground where the ring passes
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i];
    w.rad += w.speed * dt;
    w.m.scale.setScalar(w.rad);
    w.m.material.opacity = 0.85 * (1 - w.rad / w.max);
    const d = Math.hypot(player.pos.x - w.x, player.pos.z - w.z);
    // (a jump clears it from about 0.07 s after takeoff until landing)
    if (!w.hit && Math.abs(d - w.rad) < 0.6 && player.pos.y < h(player.pos.x, player.pos.z) + 0.4) { w.hit = true; hurt(w.dmg, new V3(w.x, 0, w.z)); }
    if (w.rad >= w.max) { scene.remove(w.m); waves.splice(i, 1); }
  }
}

/** Remove every hazard (when a run resets). */
function clearHazards() {
  for (const b of bolts) scene.remove(b.g);
  for (const c of clouds) scene.remove(c.g);
  for (const m of marks) scene.remove(m.g);
  for (const w of waves) scene.remove(w.m);
  bolts.length = clouds.length = marks.length = waves.length = 0;
}

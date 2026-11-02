/* =========================================================================
   combat.js — everything that's thrown: launching projectiles on an arc,
   and simulating them as they fly, bounce off the ground, trunks and rocks,
   slow down in leaves, splash into lakes and hit creatures.

   The aimed weapons in weapons.js (Pine Ball, Acorn Sling, Beehive, Frost
   Cone) all launch through here and differ only in the options they pass:
   - roll:   bounces and rolls along the ground like a ball (Pine Ball)
   - pierce: passes through this many creatures before stopping (acorns)
   - rico:   after a hit, flies on to the nearest other creature this many times
   - burst:  a function called at the first thing it touches; then it's gone (hive, frost)
   - grav:   how strongly gravity pulls it (1 = normal; acorns fly flatter)
   Anything that isn't `roll` disappears when it hits the ground.
   ========================================================================= */

const BALL_R = 0.16;  // Pine Ball radius in meters, before size items
const MAX_BALLS = 90; // oldest projectiles are removed past this
const ballGeo = new THREE.SphereGeometry(BALL_R, 16, 12);
const ballMat = new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.6 });

// Each projectile: mesh, r (radius), vel, age, rest (seconds lying still), dead, the
// options above, dmg, w (weapon id), onHit (optional extra effect per creature hit),
// leafy/wet (inside leaves/water last step), last/lastAge (last creature hit, and when).
const balls = [];

/**
 * Velocity that carries a projectile from `from` to `to`, arriving after flying
 * at roughly `speed`: fly the distance in time T, plus just enough upward speed
 * that gravity (scaled by `grav`) brings it down exactly on the target.
 */
function arcTo(from, to, speed, grav = 1) {
  const d = tmp.copy(to).sub(from), T = Math.max(0.12, d.length() / speed);
  return new V3(d.x / T, d.y / T + 0.5 * G * grav * T, d.z / T);
}

/** Where thrown things leave the deer: 0.3 m right, 0.2 m forward, 1.85 m up (the right hand). */
function handPos() {
  const f = deer.facing;
  return new V3(player.pos.x + Math.cos(f) * 0.3 - Math.sin(f) * 0.2, player.pos.y + 1.85, player.pos.z - Math.sin(f) * 0.3 - Math.cos(f) * 0.2);
}

/** Launch a projectile. `o` holds mesh, r, vel and the options described at the top. */
function launch(o) {
  const b = Object.assign({ age: 0, rest: 0, dead: false, leafy: false, wet: false, last: null, lastAge: 0, pierce: 0, rico: 0, grav: 1, roll: false }, o);
  b.mesh.castShadow = true;
  scene.add(b.mesh);
  balls.push(b);
  if (balls.length > MAX_BALLS) scene.remove(balls.shift().mesh);
  return b;
}

/** Remove a projectile at the end of this step (and set off its burst, if it has one). */
function endBall(b) {
  if (b.dead) return;
  b.dead = true;
  if (b.burst) b.burst(b.mesh.position.clone());
}

/** Projectile `b` touched creature `e`; `off` points from the creature's capsule to it. */
function ballHitsFoe(b, e, off) {
  const v = b.vel, p = b.mesh.position;
  const d = off.length() || 1e-4;
  const push = tmp.set(v.x, 0, v.z).normalize().multiplyScalar(b.burst ? 2 : 7).clone(); // knockback along its path
  const at = centerOf(e, new V3());
  b.last = e; b.lastAge = b.age; // so the same projectile can't hit the same creature twice in a row
  if (b.burst) return endBall(b); // bursting projectiles do their damage in the burst

  const dmg = b.dmg * (b.dmgVs ? b.dmgVs(e) : 1);
  hitFoe(e, dmg, push);
  if (b.onHit) b.onHit(e, at);

  // Pinecone Charm item: a share of the damage splashes onto everything nearby
  if (mod.splash) {
    for (const o of foes) {
      if (o === e || o.state !== 'alive') continue;
      const oc = centerOf(o, new V3());
      if (oc.distanceTo(at) < 2.5 + o.def.r) hitFoe(o, dmg * mod.splash, oc.sub(at).setY(0).normalize().multiplyScalar(3), true);
    }
    ring(at, 2.5);
  }

  // Pierce: keep flying straight through
  if (b.pierce > 0) { b.pierce--; return; }

  // Ricochet: fly on to the nearest other creature within 15 m
  if (b.rico > 0) {
    let next = null, bestD = 15;
    for (const o of foes) {
      if (o === e || o.state !== 'alive') continue;
      const dd = o.group.position.distanceTo(p);
      if (dd < bestD) { bestD = dd; next = o; }
    }
    if (next) {
      b.rico--;
      v.copy(arcTo(p, centerOf(next, new V3()), 16, b.grav));
      sfx.rico();
      return;
    }
  }

  // Otherwise: a ball bounces off, losing speed; anything else stops here
  if (!b.roll) return endBall(b);
  const n = tmp.copy(off).divideScalar(d), vn = v.dot(n);
  if (vn < 0) v.addScaledVector(n, -1.35 * vn);
  v.multiplyScalar(0.6);
}

/** Advance one projectile by dt seconds (called 3 times per frame for accuracy at high speed). */
function stepBall(b, dt) {
  const p = b.mesh.position, v = b.vel, r = b.r;
  v.y -= G * b.grav * dt;
  p.addScaledVector(v, dt);
  if (b.spin) b.mesh.rotation.x += dt * b.spin; // tumbling hives and cones

  // --- Water: a splash on the way in, then heavy drag so a ball sinks to the lake bed ---
  const L = lakeAt(p.x, p.z), wet = !!L && p.y < L.level;
  if (wet && !b.wet) {
    ring(p, 0.6 + Math.min(1, v.length() * 0.05), 0xdff3ff); splash(Math.min(0.3, v.length() * 0.02));
    if (!b.roll) { p.y = L.level; return endBall(b); } // everything else bursts or stops at the surface
  }
  if (wet) v.multiplyScalar(Math.pow(0.04, dt));
  b.wet = wet;

  // --- Ground: a ball bounces (losing some energy), then rolls and slows down ---
  const gy = h(p.x, p.z);
  if (p.y - r < gy) {
    p.y = gy + r;
    if (!b.roll) return endBall(b);
    normalAt(p.x, p.z, nrm);
    const vn = v.dot(nrm); // speed into the ground
    if (vn < 0) {
      if (vn < -2.5) sfx.thud(-vn);
      v.addScaledVector(nrm, -(1 + (vn < -1 ? 0.45 : 0)) * vn); // bouncy when fast, no bounce when slow (no jitter)
    }
    v.multiplyScalar(Math.pow(0.45, dt)); // rolling friction
    // spin the mesh to match how far it rolled
    const sp = Math.hypot(v.x, v.z);
    if (sp > 0.01) b.mesh.rotateOnWorldAxis(tmp.set(v.z, 0, -v.x).normalize(), sp * dt / r);
    b.rest = sp < 0.15 ? b.rest + dt : 0;
  }

  // --- Trees: trunks are solid, leaves act like thick air ---
  let leafy = false;
  for (const t of trees) {
    const dx = p.x - t.x, dz = p.z - t.z;
    if (dx * dx + dz * dz > 12) continue; // more than ~3.5 m away: skip
    if (p.y < t.y + t.th) {
      const rr = t.r + r, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) {
        if (!b.roll) return endBall(b);
        const d = Math.sqrt(d2) || 1e-4;
        nrm.set(dx / d, 0, dz / d);
        p.x = t.x + nrm.x * rr; p.z = t.z + nrm.z * rr;
        const vn = v.dot(nrm);
        if (vn < 0) { v.addScaledVector(nrm, -1.5 * vn); if (vn < -3) sfx.trunk(); }
      }
    }
    if (!leafy && inFoliage(t, p)) leafy = true;
  }
  if (leafy) {
    if (!b.leafy && v.length() > 4) rustle(Math.min(0.2, v.length() * 0.01)); // rustle on entering the leaves
    v.multiplyScalar(Math.pow(b.roll ? 0.03 : 0.3, dt)); // small, fast things punch through leaves more easily
  }
  b.leafy = leafy;

  // --- Rocks: round bounces ---
  for (const k of rocks) {
    const rr = k.r * 0.9 + r;
    tmp.set(p.x - k.x, p.y - k.y, p.z - k.z);
    const d2 = tmp.lengthSq();
    if (d2 < rr * rr) {
      if (!b.roll) return endBall(b);
      const d = Math.sqrt(d2) || 1e-4;
      nrm.copy(tmp).divideScalar(d);
      p.set(k.x, k.y, k.z).addScaledVector(nrm, rr);
      const vn = v.dot(nrm);
      if (vn < 0) { v.addScaledVector(nrm, -1.4 * vn); if (vn < -3) sfx.thud(-vn); }
    }
  }

  // --- Creatures ---
  if (v.lengthSq() < 4) return; // a slow or resting ball does no damage
  for (const e of foes) {
    if (e.state === 'dying') continue;
    if (e === b.last && b.age - b.lastAge < 0.3) continue;
    const off = capsuleOffset(e, p, tmp2), rr = e.def.r + r;
    if (off.lengthSq() < rr * rr) { ballHitsFoe(b, e, off.clone()); if (b.dead) return; }
  }
}

/** Advance every projectile, and clear out finished, old or lost ones. Called every frame while playing. */
function stepBalls(dt) {
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    b.age += dt;
    for (let s = 0; s < 3 && !b.dead; s++) stepBall(b, dt / 3);
    if (b.dead || b.rest > 8 || b.age > (b.roll ? 30 : 4) || b.mesh.position.y < -20) { scene.remove(b.mesh); balls.splice(i, 1); }
  }
}

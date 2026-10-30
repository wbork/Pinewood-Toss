/* =========================================================================
   combat.js — throwing balls and simulating them: arcs, bounces off the
   ground, trunks and rocks, slowing down in leaves, and hitting creatures
   (with the Pinecone Burst splash and Ricochet perks).
   ========================================================================= */

const BALL_R = 0.16;  // ball radius in meters before the Big Ball perk
const MAX_BALLS = 70; // oldest balls are removed past this
const ballGeo = new THREE.SphereGeometry(BALL_R, 16, 12);
const ballMat = new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.6 });

// Each ball: mesh, radius r, velocity vel, age, rest (seconds lying still),
// leafy (inside leaves last step), rico (ricochets left), last/lastAge (last creature hit, and when).
const balls = [];

/** Throw (if the cooldown allows): from the deer's right shoulder, on an arc that lands on the crosshair. */
function throwBall() {
  if (throwCooldown > 0) return;
  throwCooldown = mod.cooldown;
  const n = 1 + rank.split, r = mod.ballR, f = deer.facing;
  // launch point: 0.3 m right, 0.2 m forward and 1.85 m up from the deer's feet
  const from = new V3(player.pos.x + Math.cos(f) * 0.3 - Math.sin(f) * 0.2, player.pos.y + 1.85, player.pos.z - Math.sin(f) * 0.3 - Math.cos(f) * 0.2);
  // Solve the arc: fly the distance in time T at throw speed, adding just enough
  // upward speed that gravity brings the ball down exactly on the target.
  const delta = aimPoint(new V3()).sub(from), T = Math.max(0.12, delta.length() / mod.throwSpeed);
  const base = new V3(delta.x / T, delta.y / T + 0.5 * G * T, delta.z / T);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(ballGeo, ballMat);
    m.castShadow = true; m.scale.setScalar(r / BALL_R);
    m.position.copy(from);
    scene.add(m);
    // Split Shot: extra balls fan out about 6° apart
    const vel = base.clone().applyAxisAngle(UP, (i - (n - 1) / 2) * 0.1);
    balls.push({ mesh: m, r, vel, age: 0, rest: 0, leafy: false, rico: rank.rico, last: null, lastAge: 0 });
    if (balls.length > MAX_BALLS) scene.remove(balls.shift().mesh);
  }
  deer.throwT = 1; // start the arm animation (deer.js)
  stats.throws++; sfx.throw();
}

/** Ball `b` touched creature `e`; `off` points from the creature's capsule to the ball. */
function ballHitsFoe(b, e, off) {
  const v = b.vel, p = b.mesh.position;
  const d = off.length() || 1e-4;
  const push = tmp.set(v.x, 0, v.z).normalize().multiplyScalar(7).clone(); // knockback along the ball's path
  const at = centerOf(e, new V3());
  b.last = e; b.lastAge = b.age; // so the same ball can't hit the same creature twice in a row
  const dmg = mod.damage;
  hitFoe(e, dmg, push);

  // Pinecone Burst: half damage to every other creature in the splash radius
  if (mod.blastR) {
    ring(at, mod.blastR);
    for (const o of foes) {
      if (o === e || o.state !== 'alive') continue;
      const oc = centerOf(o, new V3());
      if (oc.distanceTo(at) < mod.blastR + o.def.r) hitFoe(o, dmg * 0.5, oc.sub(at).setY(0).normalize().multiplyScalar(4));
    }
  }

  // Bounce off the creature, losing some speed...
  const n = tmp.copy(off).divideScalar(d), vn = v.dot(n);
  if (vn < 0) v.addScaledVector(n, -1.35 * vn);
  v.multiplyScalar(0.6);
  // ...or, with Ricochet, fly on to the nearest other creature within 15 m.
  if (b.rico > 0) {
    let next = null, bestD = 15;
    for (const o of foes) {
      if (o === e || o.state !== 'alive') continue;
      const dd = o.group.position.distanceTo(p);
      if (dd < bestD) { bestD = dd; next = o; }
    }
    if (next) {
      b.rico--;
      const aim = centerOf(next, new V3()).sub(p);
      const flatD = Math.hypot(aim.x, aim.z), T = Math.max(0.15, flatD / 16); // same arc math as throwBall, at 16 m/s
      v.set(aim.x / T, aim.y / T + 0.5 * G * T, aim.z / T);
      sfx.rico();
    }
  }
}

/** Advance one ball by dt seconds (called 3 times per frame for accuracy at high speed). */
function stepBall(b, dt) {
  const p = b.mesh.position, v = b.vel, r = b.r;
  v.y -= G * dt;
  p.addScaledVector(v, dt);

  // --- Ground: bounce (losing some energy), then roll and slow down ---
  const gy = h(p.x, p.z);
  if (p.y - r < gy) {
    p.y = gy + r;
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
    v.multiplyScalar(Math.pow(0.03, dt));
  }
  b.leafy = leafy;

  // --- Rocks: round bounces ---
  for (const k of rocks) {
    const rr = k.r * 0.9 + r;
    tmp.set(p.x - k.x, p.y - k.y, p.z - k.z);
    const d2 = tmp.lengthSq();
    if (d2 < rr * rr) {
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
    if (off.lengthSq() < rr * rr) ballHitsFoe(b, e, off.clone());
  }
}

/** Advance every ball, and clear out old or lost ones. Called every frame while playing. */
function stepBalls(dt) {
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    b.age += dt;
    for (let s = 0; s < 3; s++) stepBall(b, dt / 3);
    if (b.rest > 8 || b.age > 30 || b.mesh.position.y < -20) { scene.remove(b.mesh); balls.splice(i, 1); }
  }
}

/* =========================================================================
   pickups.js — things creatures drop: blue XP orbs, gold coins, hearts that
   heal, and magnets that pull every orb and coin on the map to you.
   ========================================================================= */

// ---------- XP orbs ----------
// A spinning blue diamond with a glow. Orbs pop out of a defeated creature, settle and
// hover, then fly to the deer once it's within pickup range (mod.pickupR).
const orbGeo = new THREE.OctahedronGeometry(1);
const orbMat = new THREE.MeshBasicMaterial({ color: 0x8fd0ff });
const orbGlow = glow(0x5aa8ff);
const orbs = [];

/** Drop `xp` worth of orbs at point `at`, split into a few orbs (bigger orbs hold more). */
function dropXP(at, xp) {
  const chunk = xp >= 24 ? 6 : xp >= 9 ? 3 : xp >= 4 ? 2 : 1;
  for (let left = xp; left > 0; left -= chunk) {
    const v = Math.min(chunk, left), s = 0.08 + Math.min(v, 6) * 0.025;
    const g = new THREE.Group();
    const core = new THREE.Mesh(orbGeo, orbMat); core.scale.setScalar(s);
    const halo = new THREE.Sprite(orbGlow); halo.scale.setScalar(s * 6);
    g.add(core, halo); g.position.copy(at);
    scene.add(g);
    const a = Math.random() * 6.28, sp = 1.5 + Math.random() * 2.5; // pop out in a random direction
    orbs.push({ g, core, v, age: 0, phase: Math.random() * 6, homing: false, vacuum: false, vel: new V3(Math.cos(a) * sp, 4 + Math.random() * 3, Math.sin(a) * sp) });
  }
  while (orbs.length > 400) scene.remove(orbs.shift().g); // safety cap: drop the oldest
}

// ---------- Coins ----------
// Gold coins behave just like XP orbs (pop out, hover, fly to you, get pulled by magnets)
// but add to `money`, which buys chests (chests.js). They share the orbs list; o.coin marks them.
const coinGeo = new THREE.CylinderGeometry(1, 1, 0.25, 12).rotateX(Math.PI / 2); // a disc standing on its edge
const coinMat = std({ color: 0xf2c14e, emissive: 0x5a3c00, roughness: 0.35, metalness: 0.6, flatShading: false });
const coinGlow = glow(0xffc85a);

/** Drop `value` coins at point `at`. Fractions round up by chance, so 2.4 is 2 coins 60% of the time and 3 otherwise. */
function dropCoins(at, value) {
  let left = Math.floor(value) + (Math.random() < value % 1 ? 1 : 0);
  while (left > 0) {
    const v = left >= 25 ? 10 : left >= 8 ? 5 : 1, s = v >= 10 ? 0.2 : v >= 5 ? 0.16 : 0.12; // bigger coins are worth more
    left -= v;
    const g = new THREE.Group();
    const core = new THREE.Mesh(coinGeo, coinMat); core.scale.setScalar(s);
    const halo = new THREE.Sprite(coinGlow); halo.scale.setScalar(s * 4);
    g.add(core, halo); g.position.copy(at);
    scene.add(g);
    const a = Math.random() * 6.28, sp = 1.5 + Math.random() * 2.5;
    orbs.push({ g, core, v, coin: true, age: 0, phase: Math.random() * 6, homing: false, vacuum: false, vel: new V3(Math.cos(a) * sp, 4 + Math.random() * 3, Math.sin(a) * sp) });
  }
}

/** Move orbs: fall and hover, or fly to the deer and get collected. Called every frame while playing. */
function stepOrbs(dt) {
  const chest = tmp2.set(player.pos.x, player.pos.y + 1.0, player.pos.z); // orbs fly to the deer's chest
  const pr = mod.pickupR;
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i], p = o.g.position;
    o.age += dt;
    o.core.rotation.y += dt * 3; o.core.rotation.x += dt * 1.3;
    const d = p.distanceTo(chest);
    if (!o.homing && o.age > 0.5 && d < pr) o.homing = true; // short delay so the pop-out is visible
    if (o.homing) {
      // steer toward the deer, faster the longer it's been flying (much faster when vacuumed by a magnet)
      const dir = tmp.copy(chest).sub(p).normalize().multiplyScalar(10 + o.age * 4 + (o.vacuum ? 30 : 0));
      o.vel.lerp(dir, 1 - Math.exp(-10 * dt));
      p.addScaledVector(o.vel, dt);
      if (p.distanceTo(chest) < 0.6) {
        scene.remove(o.g); orbs.splice(i, 1);
        if (o.coin) { money += o.v; sfx.coin(); hud(); }
        else { sfx.pick(); gainXP(o.v); }
        continue;
      }
    } else {
      // gravity, then a gentle bob a little above the ground (or the water)
      o.vel.y -= G * 0.6 * dt;
      p.addScaledVector(o.vel, dt);
      const floor = surfH(p.x, p.z) + 0.35 + Math.sin(o.age * 3 + o.phase) * 0.07;
      if (p.y < floor) {
        p.y = floor; o.vel.y = Math.max(0, -o.vel.y * 0.3);
        const fr = Math.pow(0.02, dt); o.vel.x *= fr; o.vel.z *= fr;
      }
      if (o.age > 90) { scene.remove(o.g); orbs.splice(i, 1); } // uncollected orbs vanish after 90 s
    }
  }
}

// ---------- Hearts and magnets ----------
// Rare drops (chances are in enemies.js → killFoe). They bob and spin, last 35 s,
// and blink during their final 7 s. Walk into one to use it.
// (Not to be confused with the stat items from chests, in items.js.)
const drops = [];

/** Drop a 'heart' or 'magnet' at point `at`. */
function dropItem(kind, at) {
  const g = new THREE.Group();
  if (kind === 'heart') {
    // a heart: two balls on top of an upside-down cone
    for (const x of [-0.11, 0.11]) g.add(mesh(new THREE.SphereGeometry(0.16, 12, 8), MAT.heart, x, 0.08, 0));
    const tip = mesh(new THREE.ConeGeometry(0.255, 0.36, 12), MAT.heart, 0, -0.13, 0); tip.rotation.x = Math.PI; g.add(tip);
    const halo = new THREE.Sprite(glow(0xff5a6e)); halo.scale.setScalar(1.3); g.add(halo);
  } else {
    // a horseshoe magnet: a red half-ring with two steel tips
    const arc = mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 20, Math.PI), MAT.magnet, 0, 0.06, 0); g.add(arc);
    for (const x of [-0.2, 0.2]) g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 10), MAT.steel, x, -0.01, 0));
    const halo = new THREE.Sprite(glow(0x5aa8ff)); halo.scale.setScalar(1.4); g.add(halo);
  }
  g.position.copy(at);
  scene.add(g);
  drops.push({ kind, g, age: 0, vy: 4 }); // vy: a small upward pop when dropped
}

/** Animate hearts and magnets and handle pickup. Called every frame while playing. */
function stepDrops(dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const it = drops[i], p = it.g.position;
    it.age += dt;
    it.vy -= G * 0.5 * dt;
    p.y += it.vy * dt;
    const floor = surfH(p.x, p.z) + 0.6 + Math.sin(it.age * 3) * 0.1;
    if (p.y < floor) { p.y = floor; it.vy = 0; }
    it.g.rotation.y += dt * 2;
    it.g.visible = it.age < 28 || Math.floor(it.age * 8) % 2 === 0; // blink before vanishing
    const close = Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 1.4 && Math.abs(p.y - player.pos.y - 0.8) < 2;
    const wanted = it.kind !== 'heart' || hp < mod.maxHp; // hearts wait on the ground until you're hurt
    if (close && wanted && it.age > 0.4) {
      if (it.kind === 'heart') {
        const heal = Math.min(mod.maxHp - hp, Math.round(mod.maxHp * 0.3)); // 30% of max HP
        hp += heal;
        pop(p.clone().add(nrm.set(0, 0.6, 0)), '+' + Math.round(heal) + ' HP', '', 'heal');
        sfx.heal(); vitals();
      } else {
        for (const o of orbs) { o.homing = true; o.vacuum = true; } // every orb on the map flies to you
        pop(p.clone().add(nrm.set(0, 0.6, 0)), 'XP magnet', orbs.length ? orbs.length + ' orbs' : '', 'magnet');
        sfx.magnet();
      }
      scene.remove(it.g); drops.splice(i, 1);
    } else if (it.age > 35) { scene.remove(it.g); drops.splice(i, 1); }
  }
}

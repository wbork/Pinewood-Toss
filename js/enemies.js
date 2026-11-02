/* =========================================================================
   enemies.js — creatures in action: the spawner that decides when and
   where they appear, how they chase and attack the deer, and what happens
   when a ball hits them.

   Each live creature is an object `e` with:
     id, def          its type and its FOES entry (creatures.js)
     group, parts     its 3D model and the pieces that animate
     state            'rising' (climbing out of the ground), 'alive', or 'dying'
     hp, dmg, speed, xp   its stats, scaled by how long the run has lasted
     vel, kb          walking velocity and knockback velocity
     atk              seconds until it can attack again
     flash, lunge     hit-flash and attack-lunge animation amounts (1 → 0)
   ========================================================================= */

const foes = []; // every creature currently in the world

/**
 * How much stronger creatures are at the current point in the run.
 * At 3:00 they have 3× health, 1.75× damage, 1.25× speed (the speed cap), and drop
 * 2.5× XP and 2× coins. Coins follow a gentle curve (√) on top of the straight line, so
 * income keeps rising smoothly all game as creatures get tougher and chests pricier.
 */
const power = () => ({
  hp: 1 + runTime / 90,
  dmg: 1 + runTime / 240,
  speed: Math.min(1.25, 1 + runTime / 600),
  xp: 1 + runTime / 120,
  coin: 1 + runTime / 240 + Math.sqrt(runTime / 60) * 0.5,
});

/**
 * Create a creature of type `id` at (x, z), facing the deer.
 * `risen` skips the climb-out-of-the-ground animation (used on the title screen).
 */
function spawnFoe(id, x, z, risen) {
  const def = FOES[id], pw = power();
  const e = {
    id, def, group: new THREE.Group(), parts: {}, flashMats: [], state: risen ? 'alive' : 'rising', timer: 0,
    hp: def.hp * pw.hp, dmg: def.dmg * pw.dmg, speed: def.speed * pw.speed * rand(0.9, 1.1), xp: Math.max(1, Math.round(def.xp * pw.xp)),
    vel: new V3(), kb: new V3(), atk: 0.8, flash: 0, lunge: 0, phase: Math.random() * 6, seed: Math.random() * 100, yaw: 0,
  };
  e.maxHp = e.hp; // for healing (Sap shaman) and the boss health bar
  def.build(e);
  e.group.position.set(x, h(x, z), z);
  e.yaw = Math.atan2(player.pos.x - x, player.pos.z - z);
  e.group.rotation.y = e.yaw;
  if (!risen) { e.group.scale.setScalar(0.01); burst(e.group.position.clone().add(P.set(0, 0.2, 0)), 0x4a3a2a, 6); } // dirt kicks up
  scene.add(e.group);
  foes.push(e);
  if (id === 'mossback') sfx.roar();
  return e;
}

/** Pick a creature type at random, weighted, from the ones unlocked so far. */
function pickFoe() {
  const open = FOE_LIST.filter(([, d]) => d.unlock <= runTime); // (bosses aren't in FOE_LIST; bosses.js spawns them)
  let r = Math.random() * open.reduce((s, [, d]) => s + d.weight, 0);
  for (const [id, d] of open) if ((r -= d.weight) < 0) return id;
  return 'imp';
}

/** Find a spawn spot 22–36 m from the deer, inside the arena, preferably out of view. */
function spawnPoint() {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw); // the direction the camera faces
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * 6.28, d = 22 + Math.random() * 14;
    let x = player.pos.x + Math.cos(a) * d, z = player.pos.z + Math.sin(a) * d;
    const r = Math.hypot(x, z);
    if (r > SPAWN_R) { x *= SPAWN_R / r; z *= SPAWN_R / r; } // pull back off the mountains
    const dx = x - player.pos.x, dz = z - player.pos.z, dd = Math.hypot(dx, dz);
    if (dd < 14) continue; // too close after being pulled in
    if (i < 28 && (dx * fx + dz * fz) / dd > 0.5) continue; // in front of the camera: try elsewhere first
    if (trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < 2)) continue; // not inside a trunk
    if (lakeAt(x, z)) continue;                                          // not out of a lake
    return { x, z };
  }
  return { x: player.pos.x + 25, z: player.pos.z };
}

/**
 * The spawner, run every frame. It starts sparse (a creature every ~4.5 s,
 * at most 4 alive) and keeps tightening: by 2:00 it's one every ~1.1 s with
 * up to 34 alive, and imps start arriving in growing packs (up to 6). Once the
 * endless phase begins it ramps further: faster spawns, up to 150 alive, bigger packs.
 */
function director(dt) {
  spawnT -= dt;
  if (spawnT > 0) return;
  // Endless phase (after the Hollow King): from where 10:00 left off (a spawn every 0.35 s,
  // 90 alive), spawns keep speeding up and the cap keeps rising: 0.21 s and 120 alive a
  // minute in, 0.1 s and 150 alive (the limit) two minutes in.
  const et = endlessT();
  spawnT = (et ? Math.max(0.1, 0.35 / (1 + et / 90)) : Math.max(0.35, 4.5 / (1 + runTime / 40))) * (boss ? 2 : 1); // half as many during a boss fight
  const alive = foes.filter(e => e.state !== 'dying').length;
  if (alive >= (et ? Math.min(150, 90 + et * 0.5) : Math.min(90, 4 + runTime / 4))) return;
  const id = pickFoe(), at = spawnPoint();
  const n = id === 'imp' && Math.random() < Math.min(0.6, runTime / 200) ? Math.min(6 + Math.floor(et / 60), 2 + Math.floor(runTime / 120)) : 1;
  for (let i = 0; i < n; i++) spawnFoe(id, at.x + (i ? rand(-1.5, 1.5) : 0), at.z + (i ? rand(-1.5, 1.5) : 0));
}

/** The middle of a creature's hit capsule, written into `out`. */
const centerOf = (e, out) => out.copy(e.group.position).add(nrm.set(0, (e.def.lo + e.def.hi) / 2, 0));

/** Vector from the nearest point on a creature's hit capsule to point p, written into `out`. */
function capsuleOffset(e, p, out) {
  const c = e.group.position, y = Math.max(c.y + e.def.lo, Math.min(c.y + e.def.hi, p.y));
  return out.set(p.x - c.x, p.y - y, p.z - c.z);
}

/**
 * Damage a creature and shove it by `push` (a velocity). May roll a critical hit
 * (Lucky Clover). `quiet` hits (splash, damage over time) can't crit, don't flash
 * or knock, and show a smaller number.
 */
function hitFoe(e, dmg, push, quiet) {
  if (e.state === 'dying') return;
  let crit = false;
  if (!quiet && mod.crit && Math.random() < mod.crit) { dmg *= 3; crit = true; }
  if (warded(e)) dmg *= 0.5; // a nearby Hollow stump's bark ward halves the damage
  if (e.shield > 0) {        // a Sap shaman's shield soaks damage first
    const soak = Math.min(e.shield, dmg);
    e.shield -= soak; dmg -= soak;
    if (e.shield <= 0) breakShield(e);
    if (!dmg) { pop(centerOf(e, new V3()).add(nrm.set(0, 0.7 + e.def.r * 0.6, 0)), fmt(soak), '', 'small shielded'); if (!quiet) sfx.knock(); return; }
  }
  e.hp -= dmg;
  if (!quiet) e.flash = 1;
  if (push) e.kb.addScaledVector(push, 1 / e.def.mass); // heavy creatures barely budge
  const at = centerOf(e, new V3());
  pop(at.clone().add(nrm.set(0, 0.7 + e.def.r * 0.6, 0)), (crit ? 'Crit ' : '') + fmt(dmg), '', crit ? 'crit' : quiet ? 'small dim' : 'small');
  if (e.hp <= 0) killFoe(e, at);
  else if (!quiet) sfx.knock();
}

// ---------- Status effects ----------
// Weapons (weapons.js) leave these on creatures:
//   chill  — seconds left moving at half speed (Frost Cone)
//   frozen — seconds left not moving at all (Frost Cone at level 5)
//   poison — damage per second, for poisonT seconds (Beehive, Mushroom Mines)
//   burn   — damage per second, for burnT seconds (Firefly Lantern)
// A stronger dose replaces a weaker one; the timer refreshes either way.
const chillFoe = (e, t) => { e.chill = Math.max(e.chill || 0, t); };
const freezeFoe = (e, t) => { e.frozen = Math.max(e.frozen || 0, t); chillFoe(e, t + 1); };
const poisonFoe = (e, dps, t) => { e.poison = Math.max(e.poison || 0, dps); e.poisonT = Math.max(e.poisonT || 0, t); };
const burnFoe = (e, dps, t) => { e.burn = Math.max(e.burn || 0, dps); e.burnT = Math.max(e.burnT || 0, t); };

/** Tick a creature's status effects. Damage over time lands every half second. Returns the speed factor. */
function stepStatus(e, dt) {
  if (e.chill > 0) e.chill -= dt;
  if (e.frozen > 0) e.frozen -= dt;
  let dps = 0;
  if (e.poisonT > 0) { e.poisonT -= dt; dps += e.poison; } else e.poison = 0;
  if (e.burnT > 0) { e.burnT -= dt; dps += e.burn; } else e.burn = 0;
  if (dps) {
    e.dot = (e.dot || 0) + dps * dt;
    e.dotT = (e.dotT || 0) + dt;
    if (e.dotT >= 0.5) { const d = e.dot; e.dot = 0; e.dotT = 0; hitFoe(e, d, null, true); }
  }
  // tint: a pulsing warning glow while winding up an ability (e.warn, set by its ai), else
  // orange when burning, green when poisoned, icy blue when chilled (the red hit flash wins)
  if (e.flash <= 0) {
    const w = e.warn * (0.6 + 0.4 * Math.sin(performance.now() / 60));
    const c = e.warn ? [0.9 * w, 0.4 * w, 0.05 * w] : e.burn ? [0.4, 0.13, 0] : e.poison ? [0.05, 0.28, 0.02] : e.chill > 0 ? [0.08, 0.2, 0.42] : null;
    if (c || e.tinted) for (const m of e.flashMats) m.emissive.setRGB(...(c || [0, 0, 0]));
    e.tinted = !!c;
  }
  // bosses shrug off most of it: chill only slows them a little, and they can't be frozen
  if (e.def.boss) return e.chill > 0 ? 0.8 : 1;
  return e.frozen > 0 ? 0 : e.chill > 0 ? 0.5 : 1;
}

// ---------- Sap shields (cast by the Sap shaman, creatures.js) ----------
// A shield is a pool of extra health that takes damage first. It shows as an amber bubble.
const shieldGeo = new THREE.SphereGeometry(1, 14, 10);
const shieldMat = new THREE.MeshBasicMaterial({ color: 0xffb43a, transparent: true, opacity: 0.28, depthWrite: false });

/** Give creature e a shield worth `amount` damage. */
function shieldFoe(e, amount) {
  e.shield = amount;
  if (!e.shieldMesh) {
    e.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    e.shieldMesh.position.y = (e.def.lo + e.def.hi) / 2;
    e.shieldMesh.scale.set(e.def.r + 0.35, (e.def.hi - e.def.lo) / 2 + 0.45, e.def.r + 0.35);
    e.group.add(e.shieldMesh);
  }
  e.shieldMesh.visible = true;
}

/** A shield ran out: pop the bubble. */
function breakShield(e) {
  e.shield = 0;
  if (e.shieldMesh) e.shieldMesh.visible = false;
  burst(centerOf(e, new V3()), 0xffb43a, 8);
}

/** Is creature e inside a Hollow stump's bark ward (another stump within WARD_R)? */
const WARD_R = 5;
const warded = e => !e.def.ward && foes.some(o => o.def.ward && o.state === 'alive' &&
  Math.hypot(o.group.position.x - e.group.position.x, o.group.position.z - e.group.position.z) < WARD_R);

/** A creature is defeated: count it, drop XP and coins, maybe drop a heart or magnet. */
function killFoe(e, at) {
  e.state = 'dying'; e.timer = 0;
  stats.kills++;
  scoreKill(e); // endless phase only (bosses.js)
  burst(at, e.def.chip, 12);
  dropXP(at, e.xp);
  dropCoins(at, e.def.coin * power().coin);
  if (e.def.onDeath) e.def.onDeath(e, at); // e.g. a spore puffer's cloud, a boss's rewards
  // Drop chances: hearts 5% (25% from a Mossback), doubled when you're under 35% HP;
  // magnets 2% (15% from a Mossback). At most one item per creature.
  const big = e.id === 'mossback', low = hp / mod.maxHp < 0.35;
  if (Math.random() < (big ? 0.25 : 0.05) * (low ? 2 : 1)) dropItem('heart', at);
  else if (Math.random() < (big ? 0.15 : 0.02)) dropItem('magnet', at);
  sfx.kill();
  hud();
}

/**
 * Update one creature for this frame: rise, chase, attack, animate, or die.
 * Returns false once it has finished dying and can be removed.
 */
function stepFoe(e, dt, now) {
  const g = e.group, p = g.position;

  // Climbing out of the ground: grow from nothing over 0.6 s. Can't move or attack yet.
  if (e.state === 'rising') {
    e.timer += dt;
    const k = Math.min(1, e.timer / 0.6);
    g.scale.setScalar(Math.max(0.01, k));
    p.y = h(p.x, p.z) - (1 - k) * 0.8;
    if (k >= 1) e.state = 'alive';
    return true;
  }
  // Defeated: hop up, spin and shrink away over 0.35 s.
  if (e.state === 'dying') {
    e.timer += dt;
    const k = e.timer / 0.35;
    g.scale.setScalar(Math.max(0.01, 1 - k));
    p.y += dt * 2; g.rotation.z += dt * 6;
    return k < 1;
  }

  // --- Status effects (may slow or stop it, and may finish it off) ---
  const slow = stepStatus(e, dt);
  if (e.state === 'dying') return true;

  // --- Chase: head straight for the deer... ---
  const dx = player.pos.x - p.x, dz = player.pos.z - p.z, dist = Math.hypot(dx, dz) || 1e-4;
  const want = tmp.set(dx / dist * e.speed, 0, dz / dist * e.speed);
  // ...while nudging away from neighbors so the pack spreads out instead of stacking into one blob.
  for (const o of foes) {
    if (o === e || o.state === 'dying') continue;
    const ox = p.x - o.group.position.x, oz = p.z - o.group.position.z, min = e.def.r + o.def.r;
    if (Math.abs(ox) > min || Math.abs(oz) > min) continue;
    const d2 = ox * ox + oz * oz;
    if (d2 < min * min && d2 > 1e-6) { const d = Math.sqrt(d2), f = (min - d) / min * e.speed * 1.5; want.x += ox / d * f; want.z += oz / d * f; }
  }
  // --- Special ability (creatures.js / bosses.js): may steer, stop, or act. Setting
  //     e.snap makes the move instant (dashes and charges) instead of easing in. ---
  e.snap = false; e.warn = 0;
  if (e.def.ai) e.def.ai(e, dt, want, dist);
  want.multiplyScalar(slow);                                               // chilled or frozen
  if (!e.def.fly && waterDepth(p.x, p.z) > 0.3) want.multiplyScalar(0.55); // wading through a lake is slow
  if (e.snap) e.vel.copy(want); else e.vel.lerp(want, 1 - Math.exp(-6 * dt)); // turn and accelerate smoothly
  e.kb.multiplyScalar(Math.exp(-5 * dt));  // knockback fades quickly
  p.x += (e.vel.x + e.kb.x) * dt; p.z += (e.vel.z + e.kb.z) * dt;

  // --- Collisions: slide around trunks and big rocks (fliers ignore them), stop at the deer, stay in the arena ---
  const rr = e.def.r * 0.8;
  if (!e.def.fly) {
    for (const t of trees) pushOut(p, t.x, t.z, t.r + rr);
    for (const k of rocks) if (k.r > 0.55) pushOut(p, k.x, k.z, k.r * 0.95 + rr);
  }
  pushOut(p, player.pos.x, player.pos.z, e.def.r + 0.5);
  const r = Math.hypot(p.x, p.z);
  if (r > FOE_R) { p.x *= FOE_R / r; p.z *= FOE_R / r; }
  p.y = e.def.fly ? surfH(p.x, p.z) : h(p.x, p.z); // walkers wade along the lake bed; fliers skim the water

  // --- Turn to face the deer (smoothly, taking the short way around) ---
  let turn = Math.atan2(dx, dz) - e.yaw;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  e.yaw += turn * Math.min(1, dt * 8);
  g.rotation.y = e.yaw;

  // --- Attack when in reach, at most once every 1.1 s ---
  e.atk -= dt;
  if (dist < e.def.r + 0.85 && e.atk <= 0 && !(e.frozen > 0) && Math.abs(player.pos.y - p.y) < 2.2) {
    e.atk = 1.1; e.lunge = 1;
    hurt(e.dmg, p);
  }
  e.lunge = Math.max(0, e.lunge - dt * 4);
  e.parts.body.position.z = e.lunge * 0.35; // lean into the attack

  // --- Red flash when hit ---
  if (e.flash > 0) {
    e.flash = Math.max(0, e.flash - dt * 6);
    for (const m of e.flashMats) m.emissive.setRGB(e.flash, e.flash * 0.55, e.flash * 0.45);
  }
  e.def.animate(e, dt, now);
  return true;
}

/** Update every creature and remove the ones that finished dying. */
function stepFoes(dt, now) {
  for (let i = foes.length - 1; i >= 0; i--) {
    if (!stepFoe(foes[i], dt, now)) { scene.remove(foes[i].group); foes.splice(i, 1); }
  }
}

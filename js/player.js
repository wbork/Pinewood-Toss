/* =========================================================================
   player.js — moving the deer around (walk, run, jump, collide) and taking
   damage from creatures.
   ========================================================================= */

/** Move the player for this frame, then pose the deer and place the camera. */
function stepPlayer(dt) {
  // Turn WASD / arrow keys into a direction relative to where the camera faces.
  const fwd = tmp.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = tmp2.set(Math.cos(yaw), 0, -Math.sin(yaw));
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const wish = new V3().addScaledVector(fwd, f).addScaledVector(right, s);
  const wading = waterDepth(player.pos.x, player.pos.z) > 0.3 && player.pos.y < h(player.pos.x, player.pos.z) + 0.3;
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(mod.walk * (keys.ShiftLeft || keys.ShiftRight ? 1.8 : 1) * (wading ? 0.6 : 1)); // Shift = run; water slows you
  // Ease toward that velocity: snappy on the ground, floaty in the air.
  const k = 1 - Math.exp(-(player.onGround ? 12 : 3) * dt);
  player.vel.x += (wish.x - player.vel.x) * k;
  player.vel.z += (wish.z - player.vel.z) * k;

  // Mountainsides: where the ground is steeper than about 45°, the deer can't climb
  // any higher and slides back down. (Only the ridges are that steep.) The ground's
  // normal leans downhill, so its x/z part is the downhill direction.
  if (player.onGround && !player.standOn) {
    normalAt(player.pos.x, player.pos.z, nrm);
    if (nrm.y < 0.71) {
      const len = Math.hypot(nrm.x, nrm.z), dx = nrm.x / len, dz = nrm.z / len;
      const up = -(player.vel.x * dx + player.vel.z * dz); // speed heading uphill
      if (up > 0) { player.vel.x += dx * up; player.vel.z += dz * up; } // cancel it
      const slide = (0.71 - nrm.y) * 120; // downhill push in m/s²: steeper = faster slide
      player.vel.x += dx * slide * dt; player.vel.z += dz * slide * dt;
    }
  }

  // Jump and gravity.
  if (keys.Space && player.onGround) { player.vy = 7; player.onGround = false; }
  player.vy -= G * dt;

  const p = player.pos;
  p.x += player.vel.x * dt; p.z += player.vel.z * dt; p.y += player.vy * dt;

  // Slide around tree trunks.
  for (const t of trees) pushOut(p, t.x, t.z, t.r + 0.35);

  // Invisible wall at the edge of the arena.
  const d = Math.hypot(p.x, p.z);
  if (d > ARENA_R) { p.x *= ARENA_R / d; p.z *= ARENA_R / d; }

  // Rocks. The deer's feet cover a small circle (FOOT), so a rock supports them as soon as
  // that circle reaches its dome. A low rock (peak under STEP above the ground) can just be
  // walked over. A taller one is a wall while you're on the ground, but you can land on it
  // from a jump and then walk around on top until you step off.
  const FOOT = 0.25, STEP = 0.5;
  let gy = h(p.x, p.z), on = null;
  for (const k of rocks) {
    const dx = p.x - k.x, dz = p.z - k.z, reach = k.hr + FOOT;
    if (dx * dx + dz * dz > reach * reach) continue;
    const dd = Math.sqrt(dx * dx + dz * dz), nd = Math.max(0, dd - FOOT);  // nearest point of the feet to the rock's center
    const top = rockTop(k, k.x + dx / (dd || 1) * nd, k.z + dz / (dd || 1) * nd);
    if (top <= gy) continue;
    const low = k.peak - h(k.x, k.z) < STEP;
    if (low || player.standOn === k || (!player.onGround && p.y >= top - 0.25)) { gy = top; on = k; }
    else pushOut(p, k.x, k.z, reach); // too tall to step onto: slide around it
  }
  player.standOn = on;

  // Land on the ground (or the rock).
  if (p.y <= gy) { p.y = gy; player.vy = 0; player.onGround = true; }
  else if (p.y > gy + 0.05) { player.onGround = false; player.standOn = null; }

  // A splash ring when stepping into a lake.
  const wet = waterDepth(p.x, p.z) > 0.1 && p.y < surfH(p.x, p.z);
  if (wet && !player.wet) { ring(p, 1.2, 0xdff3ff); splash(0.25); }
  player.wet = wet;

  updateDeer(dt, true);
  placeCamera(dt);
}

/** Small, continuous damage (standing in a poison cloud): no knockback and no invulnerability window. */
function sting(dmg) {
  if (!playing) return;
  hp -= dmg;
  hurtFlash = Math.max(hurtFlash, 0.35);
  vitals();
  if (hp <= 0) gameOver();
}

/** A creature at position `from` hits the deer for `dmg`. */
function hurt(dmg, from) {
  if (iframes > 0 || !playing) return; // briefly invulnerable after each hit
  hp -= dmg;
  iframes = 0.45; hurtFlash = 1; shake = 0.35; deer.flash = 1;
  // knock the deer away from the attacker
  const dx = player.pos.x - from.x, dz = player.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
  player.vel.x += dx / d * 7; player.vel.z += dz / d * 7;
  sfx.hurt();
  vitals();
  if (hp <= 0) gameOver();
}

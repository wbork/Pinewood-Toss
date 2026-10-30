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
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(mod.walk * (keys.ShiftLeft || keys.ShiftRight ? 1.8 : 1)); // Shift = run
  // Ease toward that velocity: snappy on the ground, floaty in the air.
  const k = 1 - Math.exp(-(player.onGround ? 12 : 3) * dt);
  player.vel.x += (wish.x - player.vel.x) * k;
  player.vel.z += (wish.z - player.vel.z) * k;

  // Jump and gravity.
  if (keys.Space && player.onGround) { player.vy = 7; player.onGround = false; }
  player.vy -= G * dt;

  const p = player.pos;
  p.x += player.vel.x * dt; p.z += player.vel.z * dt; p.y += player.vy * dt;

  // Slide around tree trunks and big rocks.
  for (const t of trees) pushOut(p, t.x, t.z, t.r + 0.35);
  for (const k of rocks) if (k.r > 0.55) pushOut(p, k.x, k.z, k.r * 0.95 + 0.3);

  // Invisible wall at the edge of the arena.
  const d = Math.hypot(p.x, p.z);
  if (d > ARENA_R) { p.x *= ARENA_R / d; p.z *= ARENA_R / d; }

  // Land on the ground.
  const gy = h(p.x, p.z);
  if (p.y <= gy) { p.y = gy; player.vy = 0; player.onGround = true; }
  else if (p.y > gy + 0.05) player.onGround = false;

  updateDeer(dt, true);
  placeCamera(dt);
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

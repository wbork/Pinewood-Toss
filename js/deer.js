/* =========================================================================
   deer.js — the player character: a deer ranger in an olive vest.

   The model is a hierarchy of groups (hips → torso parts, head, arms,
   legs) so joints can rotate naturally: turning a shoulder group swings the
   whole arm, turning a knee group bends just the lower leg. It's built
   facing +z with its feet at y = 0.
   ========================================================================= */

function buildDeer() {
  const fur = std({ color: 0xa8703f }), pale = std({ color: 0xe9d6b0 }), dark = std({ color: 0x2a1a10 });
  const horn = std({ color: 0xe6d6ae }), vest = std({ color: 0x55683a }), badge = std({ color: 0xe7b84a, metalness: 0.6, roughness: 0.4 });
  // mats: the materials that flash red when hurt. phase: walk cycle. throwT/fall/flash: animation timers.
  const d = { root: new THREE.Group(), mats: [fur, vest, pale], phase: 0, throwT: 0, sweepT: 0, fall: 0, flash: 0, facing: 0 };
  d.root.rotation.order = 'YXZ'; // turn (Y) first, then tip over (X) when falling

  // ---- Torso, hanging off the hips at waist height ----
  const hips = new THREE.Group(); hips.position.y = 0.95; d.root.add(hips); d.hips = hips;
  hips.add(mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.3, 8), fur, 0, 0.1, 0));     // waist
  hips.add(mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.45, 8), vest, 0, 0.45, 0)); // chest, covered by the vest
  hips.add(mesh(new THREE.BoxGeometry(0.16, 0.36, 0.06), pale, 0, 0.45, 0.235));     // chest fur where the vest is open
  hips.add(mesh(new THREE.BoxGeometry(0.07, 0.08, 0.02), badge, 0.15, 0.53, 0.25));  // ranger badge
  const tail = mesh(new THREE.ConeGeometry(0.07, 0.16, 5), pale, 0, 0.14, -0.2); tail.rotation.x = -2.2; hips.add(tail);

  // ---- Head: neck, skull, muzzle, nose, eyes, ears and antlers ----
  const head = new THREE.Group(); head.position.set(0, 0.78, 0.02); hips.add(head); d.head = head;
  head.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.2, 6), fur, 0, -0.08, 0));
  const skull = mesh(new THREE.SphereGeometry(0.16, 8, 6), fur, 0, 0.1, 0); skull.scale.z = 1.1; head.add(skull);
  head.add(mesh(new THREE.BoxGeometry(0.15, 0.12, 0.2), pale, 0, 0.04, 0.17)); // muzzle
  head.add(mesh(new THREE.BoxGeometry(0.08, 0.06, 0.04), dark, 0, 0.08, 0.27)); // nose
  /** One antler prong: a thin cylinder growing from height y on `parent`, tilted by rx (forward) and rz (sideways). */
  const tine = (parent, y, rx, rz, len) => {
    const g = new THREE.Group(); g.position.y = y; g.rotation.set(rx, 0, rz); parent.add(g);
    g.add(mesh(new THREE.CylinderGeometry(0.011, 0.018, len, 5), horn, 0, len / 2, 0)); return g;
  };
  for (const s of [-1, 1]) { // s = -1 for the left side, +1 for the right
    head.add(mesh(new THREE.SphereGeometry(0.03, 6, 4), dark, s * 0.1, 0.13, 0.11)); // eye
    const ear = mesh(new THREE.ConeGeometry(0.06, 0.22, 4), fur, s * 0.17, 0.17, -0.02);
    ear.rotation.z = -s * 1.15; ear.scale.z = 0.5; head.add(ear); // flat, sticking out sideways
    // antler: a main beam leaning outward, two prongs angled forward, and a top fork
    const beam = new THREE.Group(); beam.position.set(s * 0.07, 0.23, -0.02); beam.rotation.z = -s * 0.45; head.add(beam);
    beam.add(mesh(new THREE.CylinderGeometry(0.018, 0.027, 0.42, 5), horn, 0, 0.21, 0));
    tine(beam, 0.12, 0.9, 0, 0.17); tine(beam, 0.28, 0.75, 0, 0.15); tine(beam, 0.4, 0.2, -s * 0.5, 0.13);
  }

  // ---- Arms: shoulder joint → upper arm → elbow joint → forearm and hand ----
  d.arms = [-1, 1].map(s => {
    const sh = new THREE.Group(); sh.position.set(s * 0.32, 0.62, 0); sh.rotation.z = s * 0.12; hips.add(sh);
    sh.add(mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.34, 6), fur, 0, -0.17, 0));
    const fore = new THREE.Group(); fore.position.y = -0.34; sh.add(fore);
    fore.add(mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.3, 6), fur, 0, -0.15, 0));
    fore.add(mesh(new THREE.BoxGeometry(0.09, 0.1, 0.09), dark, 0, -0.34, 0)); // hand
    return { sh, fore };
  });

  // ---- Legs: hip joint → thigh → knee joint → shin and hoof ----
  d.legs = [-1, 1].map(s => {
    const hip = new THREE.Group(); hip.position.set(s * 0.12, 0, 0); hips.add(hip);
    hip.add(mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.46, 6), fur, 0, -0.23, 0));
    const knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
    knee.add(mesh(new THREE.CylinderGeometry(0.065, 0.045, 0.42, 6), fur, 0, -0.21, 0));
    knee.add(mesh(new THREE.BoxGeometry(0.1, 0.09, 0.15), dark, 0, -0.45, 0.02)); // hoof
    return { hip, knee };
  });
  return d;
}

const deer = buildDeer();
scene.add(deer.root);

/**
 * Pose the deer for this frame: follow the player position, face the camera
 * direction, and animate walking, jumping, throwing, getting hurt and falling.
 * `follow` = turn toward where the camera looks (off on the title screen and after death).
 */
function updateDeer(dt, follow) {
  const d = deer;
  d.root.position.copy(player.pos);
  if (follow) {
    let turn = yaw - d.facing;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn)); // shortest way around
    d.facing += turn * Math.min(1, dt * 14);
  }
  d.root.rotation.y = d.facing + Math.PI; // the model faces +z; yaw 0 means looking toward -z
  // Antler Sweep (weapons.js): one quick full spin with the head lowered (sweepT runs 1 → 0)
  d.sweepT = Math.max(0, d.sweepT - dt * 3.5);
  if (d.sweepT > 0) d.root.rotation.y += (1 - d.sweepT) * Math.PI * 2;

  // Walk cycle. `amt` is 0 standing still and 1 at walking speed or faster.
  const sp = playing ? Math.hypot(player.vel.x, player.vel.z) : 0, amt = Math.min(1, sp / 5.5);
  const ahead = -Math.sin(d.facing) * player.vel.x - Math.cos(d.facing) * player.vel.z; // speed in the facing direction
  d.phase += sp * dt * 1.6 * (ahead < -0.5 ? -1 : 1); // walking backward runs the cycle in reverse
  const s = Math.sin(d.phase), air = playing && !player.onGround;
  d.legs.forEach((L, i) => {
    const sg = i ? 1 : -1; // left and right legs move opposite each other
    L.hip.rotation.x = air ? -0.6 + i * 0.3 : sg * s * 0.75 * amt;                 // swing (tucked up in the air)
    L.knee.rotation.x = air ? 1.0 : 0.05 + Math.max(0, sg * s) * 0.9 * amt;        // bend when the leg is behind
    d.arms[i].sh.rotation.x = -sg * s * 0.6 * amt;                                 // arms swing opposite the legs
    d.arms[i].fore.rotation.x = -0.25 - 0.25 * amt;                                // elbows a little bent
  });

  // Throw: the right arm starts overhead and whips forward over ~0.2 s (throwT runs 1 → 0).
  d.throwT = Math.max(0, d.throwT - dt * 4.5);
  if (d.throwT > 0) { const k = 1 - d.throwT; d.arms[1].sh.rotation.x = -3.3 + 2.5 * k * k; d.arms[1].fore.rotation.x = -0.3; }

  // Bob while walking; breathe gently while standing.
  const breathe = reduceMotion ? 0 : Math.sin(performance.now() / 600) * 0.008 * (1 - amt);
  d.hips.position.y = 0.95 + Math.abs(Math.cos(d.phase)) * 0.05 * amt + breathe;
  d.head.rotation.x = -pitch * 0.45 + Math.sin(d.sweepT * Math.PI) * 0.7; // look up and down with the camera (and dip for a sweep)

  // Flash red when hurt.
  if (d.flash > 0) {
    d.flash = Math.max(0, d.flash - dt * 4);
    for (const m of d.mats) m.emissive.setRGB(d.flash * 0.8, 0, 0);
  }
  // Topple backward after dying.
  if (dead) d.fall = Math.min(1, d.fall + dt * 2.2);
  d.root.rotation.x = -d.fall * d.fall * 1.45;
}

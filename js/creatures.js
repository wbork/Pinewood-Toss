/* =========================================================================
   creatures.js — the four creature types: their stats, how each one is
   built out of simple shapes, and how each one animates.

   To add a new creature, add an entry to FOES with the same fields. The
   spawner (enemies.js) picks it up automatically once `unlock` seconds
   have passed.

   Fields:
     label   name of the creature
     hp      health at the start of a run (grows over time, see enemies.js → power)
     dmg     damage per attack (also grows)
     speed   walking speed in m/s (the deer walks 5.5 and runs ~10)
     xp      XP dropped when defeated (grows)
     coin    coins dropped when defeated (grows; see enemies.js → power)
     r       body radius, for collisions and hits
     lo, hi  bottom and top of the vertical hit capsule, in meters above the feet
     mass    how hard it is to knock back (higher = barely moves)
     unlock  seconds survived before it starts appearing
     weight  how often it's picked compared to the others
     chip    color of the chips that fly off when it's defeated
     fly     (optional) floats, so trees and rocks don't block it
     ability what makes it special, in words
     build(e)            adds meshes to e.group, saving parts to animate in e.parts
     animate(e, dt, now) moves those parts each frame
     ai(e, dt, want, dist)  (optional) its special behavior, run every frame. `want` is the
                         velocity it's about to walk with (toward the deer); change it to steer,
                         set e.snap for an instant dash, e.warn (0–1) to glow as a warning.
                         dist = flat distance to the deer.
     ward    (optional) creatures near it take half damage (enemies.js → warded)
     onDeath(e, at)      (optional) something that happens when it's defeated

   Every creature is built facing +z (toward its target) with its feet at y = 0.
   Abilities use e.act / e.actT (current action and its timer) and e.cd (ability cooldown).
   ========================================================================= */

/** Flat unit vector from creature e toward the deer. */
const toDeer = e => new V3(player.pos.x - e.group.position.x, 0, player.pos.z - e.group.position.z).normalize();

/** Count an ability's cooldown down (starting it at `first` seconds the first time). Returns true when ready. */
function ready(e, dt, first) {
  if (e.cd === undefined) e.cd = first;
  e.cd -= dt;
  return e.cd <= 0;
}

// The Hollow stump's ward ring (shared by every stump).
const wardGeo = new THREE.RingGeometry(4.8, 5, 48).rotateX(-Math.PI / 2);
const wardMat = new THREE.MeshBasicMaterial({ color: 0x8fd06a, transparent: true, opacity: 0.35, depthWrite: false });

const FOES = {
  // Small and common: a spiky ball on spindly bramble legs with long thorn arms.
  imp: {
    label: 'Bramble imp', hp: 3, dmg: 6, speed: 3.0, xp: 1, coin: 1, r: 0.42, lo: 0.55, hi: 1.05, mass: 1, unlock: 0, weight: 6, chip: 0x3b2436,
    ability: 'Pounce: crouches, then leaps the last few meters at you. Keep moving.',
    ai(e, dt, want, dist) {
      if (e.act === 'crouch') {          // 0.3 s crouch (glowing): the warning
        want.set(0, 0, 0); e.snap = true; e.warn = 0.7;
        if ((e.actT -= dt) <= 0) { e.act = 'pounce'; e.actT = 0.35; e.dir = toDeer(e); }
      } else if (e.act === 'pounce') {   // 0.35 s leap at triple speed, in the direction it locked in
        want.copy(e.dir).multiplyScalar(e.speed * 3.2); e.snap = true;
        if ((e.actT -= dt) <= 0) { e.act = null; e.cd = 3 + Math.random(); }
      } else if (ready(e, dt, 1 + Math.random() * 2) && dist > 2.5 && dist < 6) { e.act = 'crouch'; e.actT = 0.3; }
    },
    build(e) {
      const skin = std({ color: 0x3b2436 }); e.flashMats.push(skin); // own material so it can flash when hit
      const body = new THREE.Group(); body.position.y = 1.0; e.group.add(body); e.parts.body = body;
      e.parts.legs = [-0.13, 0.13].map(x => {
        const leg = new THREE.Group(); leg.position.set(x, 0.72, 0); e.group.add(leg); // pivot at the hip
        leg.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.74, 5), MAT.thorn, 0, -0.37, 0));
        return leg;
      });
      e.parts.arms = [-1, 1].map(s => {
        const arm = new THREE.Group(); arm.position.set(s * 0.3, 0.05, 0); arm.rotation.z = s * 0.5; body.add(arm); // angled outward
        arm.add(mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.55, 5), MAT.thorn, 0, -0.27, 0));
        const claw = mesh(new THREE.ConeGeometry(0.05, 0.16, 4), MAT.thorn, 0, -0.6, 0.03); claw.rotation.x = Math.PI; arm.add(claw);
        return arm;
      });
      body.add(mesh(new THREE.DodecahedronGeometry(0.36, 0), skin));
      // thorns stick out in random directions (from their own seed, so every imp matches),
      // but never from the front, which stays clear for the face
      const rnd = mulberry(7);
      for (let i = 0; i < 10; i++) {
        const d = new V3(rnd() - 0.5, rnd() * 0.9 - 0.2, rnd() - 0.5);
        if (d.z > 0) d.z = -d.z;
        d.normalize();
        const c = mesh(new THREE.ConeGeometry(0.06, 0.3, 4), MAT.thorn);
        c.position.copy(d).multiplyScalar(0.36); c.quaternion.setFromUnitVectors(UP, d); body.add(c);
      }
      for (const x of [-0.12, 0.12]) body.add(mesh(new THREE.SphereGeometry(0.06, 6, 4), EYE.amber, x, 0.08, 0.31));
    },
    animate(e, dt) {
      e.phase += dt * e.speed * 2.6; // stride speed follows walking speed
      const s = Math.sin(e.phase);
      e.parts.legs[0].rotation.x = s * 0.7; e.parts.legs[1].rotation.x = -s * 0.7;
      // arms swing opposite the legs, and both lash forward when it attacks (e.lunge)
      e.parts.arms[0].rotation.x = -s * 0.5 - e.lunge * 1.6; e.parts.arms[1].rotation.x = s * 0.5 - e.lunge * 1.6;
      e.parts.body.position.y = 1.0 + Math.abs(Math.cos(e.phase)) * 0.07 - (e.act === 'crouch' ? 0.28 : 0); // crouch before a pounce
      e.parts.body.rotation.z = s * 0.08;
    },
  },

  // Fast and floating: a dark crystal head with a ragged tail and a purple glow. Drifts over obstacles.
  wisp: {
    label: 'Gloom wisp', hp: 4, dmg: 8, speed: 3.8, xp: 2, coin: 2, r: 0.45, lo: 1.25, hi: 1.65, mass: 0.8, unlock: 90, weight: 3, chip: 0x2b2340, fly: true,
    ability: 'Shadow bolts: hovers 8–12 m away, circling, and shoots slow bolts. Dodge them or close in.',
    ai(e, dt, want, dist) {
      // keep its distance: back off when close, hold when in range, and always drift sideways
      if (dist < 8) want.multiplyScalar(-0.8); else if (dist < 12) want.multiplyScalar(0);
      const side = e.seed % 2 < 1 ? 1 : -1, d = toDeer(e);
      want.x += -d.z * side * e.speed * 0.5; want.z += d.x * side * e.speed * 0.5;
      if (ready(e, dt, 1.5 + Math.random() * 1.5) && dist < 22) {
        e.cd = 2.8;
        fireBolt(e.group.position.clone().add(P.set(0, 1.45, 0)), deerChest().clone(), 10, e.dmg * 0.8, 0x9a6cff);
        sfx.bolt();
      }
      e.warn = e.cd < 0.4 ? 0.6 : 0; // glows just before firing
    },
    build(e) {
      const shade = std({ color: 0x2b2340, roughness: 0.6 }); e.flashMats.push(shade);
      const body = new THREE.Group(); body.position.y = 1.45; e.group.add(body); e.parts.body = body;
      body.add(mesh(new THREE.OctahedronGeometry(0.38, 0), shade));
      const tail = mesh(new THREE.ConeGeometry(0.3, 1.0, 6), shade, 0, -0.62, -0.12);
      tail.rotation.x = Math.PI + 0.3; body.add(tail); e.parts.tail = tail; // point down and trail behind
      for (const x of [-0.12, 0.12]) body.add(mesh(new THREE.SphereGeometry(0.055, 6, 4), EYE.pale, x, 0.05, 0.3));
      const halo = new THREE.Sprite(glow(0x9a6cff)); halo.scale.setScalar(1.7); body.add(halo);
    },
    animate(e, dt, now) {
      e.phase += dt;
      // bob up and down, weave side to side, flick the tail (e.seed keeps wisps out of sync)
      e.parts.body.position.y = 1.45 + Math.sin(now / 300 + e.seed) * 0.15;
      e.parts.body.position.x = Math.sin(now / 520 + e.seed) * 0.25;
      e.parts.tail.rotation.z = Math.sin(now / 160 + e.seed) * 0.3;
    },
  },

  // Slow and tough: a walking tree stump with a jagged top and glowing red eyes and mouth.
  stump: {
    label: 'Hollow stump', hp: 9, dmg: 12, speed: 2.0, xp: 3, coin: 3, r: 0.6, lo: 0.5, hi: 1.1, mass: 2.5, unlock: 180, weight: 3, chip: 0x6b4a32,
    ward: true,
    ability: 'Bark ward: every other creature within 5 m of it (the green ring) takes half damage. Kill stumps first.',
    build(e) {
      const bark = std({ color: 0x4a3424 }); e.flashMats.push(bark);
      // the ward's ring on the ground, 5 m across (WARD_R in enemies.js)
      const ward = new THREE.Mesh(wardGeo, wardMat); ward.position.y = 0.06; e.group.add(ward); e.parts.ward = ward;
      const body = new THREE.Group(); body.position.y = 0.32; e.group.add(body); e.parts.body = body;
      body.add(mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.0, 8), bark, 0, 0.5));
      for (let i = 0; i < 7; i++) { // splintered top
        const a = i / 7 * Math.PI * 2;
        body.add(mesh(new THREE.ConeGeometry(0.1, 0.22 + (i % 3) * 0.1, 4), bark, Math.cos(a) * 0.32, 1.1, Math.sin(a) * 0.32));
      }
      for (const x of [-0.15, 0.15]) body.add(mesh(new THREE.BoxGeometry(0.11, 0.07, 0.04), EYE.red, x, 0.72, 0.44));
      body.add(mesh(new THREE.BoxGeometry(0.26, 0.06, 0.04), EYE.red, 0, 0.45, 0.47)); // mouth slit
      for (const s of [-1, 1]) { const arm = mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.6, 5), bark, s * 0.5, 0.6, 0.05); arm.rotation.z = -s * 1.0; body.add(arm); }
      e.parts.legs = [-0.2, 0.2].map(x => {
        const leg = new THREE.Group(); leg.position.set(x, 0.34, 0); e.group.add(leg);
        leg.add(mesh(new THREE.BoxGeometry(0.18, 0.34, 0.22), MAT.bark, 0, -0.17, 0)); return leg;
      });
    },
    animate(e, dt) {
      e.phase += dt * e.speed * 2.2;
      const s = Math.sin(e.phase);
      e.parts.legs[0].rotation.x = s * 0.6; e.parts.legs[1].rotation.x = -s * 0.6;
      e.parts.body.rotation.z = s * 0.06; // waddle
      e.parts.ward.rotation.y += dt * 0.4; // the ward ring slowly turns
    },
  },

  // Rare and huge: a hunched boulder beast with a mossy back and long stone arms.
  mossback: {
    label: 'Mossback', hp: 32, dmg: 22, speed: 1.6, xp: 10, coin: 12, r: 1.05, lo: 0.7, hi: 1.4, mass: 8, unlock: 300, weight: 1, chip: 0x5f6157,
    ability: 'Charge: glows and paws the ground for a second, then charges in a straight line for heavy damage. Sidestep it.',
    ai(e, dt, want, dist) {
      if (e.act === 'windup') {            // 1 s glowing warning, standing still
        want.set(0, 0, 0); e.snap = true; e.warn = 1;
        if ((e.actT -= dt) <= 0) { e.act = 'charge'; e.actT = 1.3; e.dir = toDeer(e); e.hitThis = false; sfx.roar(); }
      } else if (e.act === 'charge') {     // 1.3 s straight-line charge at 13 m/s
        want.copy(e.dir).multiplyScalar(13); e.snap = true;
        if (!e.hitThis && dist < e.def.r + 1.2) {
          e.hitThis = true; iframes = 0; hurt(e.dmg * 1.5, e.group.position);
          player.vel.addScaledVector(e.dir, 9); // bowled over
        }
        if ((e.actT -= dt) <= 0) { e.act = 'daze'; e.actT = 1.2; }
      } else if (e.act === 'daze') {       // catches its breath: a window to punish it
        want.multiplyScalar(0.2);
        if ((e.actT -= dt) <= 0) { e.act = null; e.cd = 6 + Math.random() * 2; }
      } else if (ready(e, dt, 3) && dist > 5 && dist < 20) { e.act = 'windup'; e.actT = 1.0; }
    },
    build(e) {
      const stone = std({ color: 0x5f6157 }); e.flashMats.push(stone);
      const body = new THREE.Group(); body.position.y = 1.0; e.group.add(body); e.parts.body = body;
      const torso = mesh(new THREE.DodecahedronGeometry(1, 0), stone); torso.scale.set(1.15, 0.85, 1.0); body.add(torso);
      const moss = mesh(new THREE.DodecahedronGeometry(0.8, 0), MAT.moss, 0, 0.55, -0.1); moss.scale.set(1.2, 0.45, 1.1); body.add(moss);
      body.add(mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), stone, 0, -0.1, 0.85)); // head
      for (const x of [-0.17, 0.17]) body.add(mesh(new THREE.BoxGeometry(0.13, 0.08, 0.03), EYE.orange, x, -0.04, 1.11));
      e.parts.arms = [-1, 1].map(s => {
        const arm = new THREE.Group(); arm.position.set(s * 1.0, 0.2, 0.2); body.add(arm); // pivot at the shoulder
        arm.add(mesh(new THREE.BoxGeometry(0.38, 1.1, 0.38), stone, 0, -0.5, 0)); return arm;
      });
    },
    animate(e, dt) {
      e.phase += dt * e.speed * 1.6;
      const s = Math.sin(e.phase);
      e.parts.arms[0].rotation.x = s * 0.5 - e.lunge; e.parts.arms[1].rotation.x = -s * 0.5 - e.lunge; // knuckle-walk, swipe on attack
      e.parts.body.position.y = 1.0 + Math.abs(s) * 0.08;
    },
  },

  // Bloated and slow: a walking mushroom with a spotted violet cap. Pops into a poison cloud.
  puffer: {
    label: 'Spore puffer', hp: 6, dmg: 4, speed: 2.2, xp: 3, coin: 3, r: 0.55, lo: 0.3, hi: 1.2, mass: 1.5, unlock: 120, weight: 2, chip: 0x8a4ab0,
    ability: 'Toxic burst: swells up and pops when it reaches you, and when it dies, leaving a poison cloud. Kill it from range.',
    build(e) {
      const cap = std({ color: 0x7a3a9a }); e.flashMats.push(cap);
      const body = new THREE.Group(); body.position.y = 0.35; e.group.add(body); e.parts.body = body;
      body.add(mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.45, 8), MAT.mushStem, 0, 0.22, 0)); // stem
      const top = mesh(new THREE.SphereGeometry(0.55, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.6), cap, 0, 0.42, 0); body.add(top); e.parts.cap = top;
      const rnd = mulberry(11);
      for (let i = 0; i < 9; i++) { // pale spots on the cap
        const d = new V3(rnd() - 0.5, 0.4 + rnd() * 0.6, rnd() - 0.5).normalize();
        top.add(mesh(new THREE.SphereGeometry(0.07, 5, 4), EYE.pale, d.x * 0.52, d.y * 0.52, d.z * 0.52));
      }
      for (const x of [-0.1, 0.1]) body.add(mesh(new THREE.SphereGeometry(0.05, 6, 4), EYE.lime, x, 0.32, 0.27));
      e.parts.legs = [-0.15, 0.15].map(x => { const leg = new THREE.Group(); leg.position.set(x, 0.2, 0); e.group.add(leg); leg.add(mesh(new THREE.BoxGeometry(0.12, 0.2, 0.14), MAT.bark, 0, -0.1, 0)); return leg; });
    },
    ai(e, dt, want, dist) {
      if (e.act === 'swell') {            // 1 s swelling (and glowing): run!
        want.set(0, 0, 0); e.snap = true; e.warn = 1;
        if ((e.actT -= dt) <= 0) { e.hp = 0; killFoe(e, centerOf(e, new V3())); } // pops itself (onDeath makes the cloud)
      } else if (dist < 2.6) { e.act = 'swell'; e.actT = 1.0; sfx.swell(); }
    },
    onDeath(e, at) { poisonCloud(e.group.position, 3.2, 5, e.dmg * 1.5); splash(0.25); },
    animate(e, dt) {
      e.phase += dt * e.speed * 3;
      const s = Math.sin(e.phase);
      e.parts.legs[0].rotation.x = s * 0.6; e.parts.legs[1].rotation.x = -s * 0.6;
      const swell = e.act === 'swell' ? 1 + (1 - e.actT) * 0.6 : 1 + Math.sin(e.phase * 0.5) * 0.04; // breathes; balloons before popping
      e.parts.cap.scale.setScalar(swell);
    },
  },

  // A lean shadow hound, nearly invisible until it's close. Circles around to strike from behind.
  stalker: {
    label: 'Shade stalker', hp: 7, dmg: 10, speed: 4.4, xp: 4, coin: 4, r: 0.45, lo: 0.3, hi: 0.95, mass: 1.2, unlock: 240, weight: 2, chip: 0x1c2430,
    ability: 'Ambush: almost invisible from afar, it circles around and attacks from behind. Watch your back.',
    build(e) {
      const shade = std({ color: 0x1c2430, roughness: 0.5, transparent: true, opacity: 0.15 }); e.flashMats.push(shade);
      const eyes = new THREE.MeshBasicMaterial({ color: 0x6af0ff, transparent: true }); e.parts.eyeMat = eyes;
      const body = new THREE.Group(); body.position.y = 0.62; e.group.add(body); e.parts.body = body;
      const torso = mesh(new THREE.BoxGeometry(0.4, 0.32, 1.0), shade); body.add(torso);
      const head = mesh(new THREE.BoxGeometry(0.3, 0.26, 0.36), shade, 0, 0.12, 0.6); body.add(head);
      for (const x of [-0.1, 0.1]) { body.add(mesh(new THREE.ConeGeometry(0.06, 0.2, 4), shade, x, 0.33, 0.52)); body.add(mesh(new THREE.SphereGeometry(0.035, 5, 4), eyes, x, 0.16, 0.79)); }
      const tail = mesh(new THREE.ConeGeometry(0.08, 0.6, 5), shade, 0, 0.1, -0.7); tail.rotation.x = -1.9; body.add(tail);
      e.parts.legs = [[-0.15, 0.35], [0.15, 0.35], [-0.15, -0.35], [0.15, -0.35]].map(([x, z]) => {
        const leg = new THREE.Group(); leg.position.set(x, 0.5, z); e.group.add(leg);
        leg.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 5), shade, 0, -0.25, 0)); return leg;
      });
    },
    ai(e, dt, want, dist) {
      if (dist > 4.5) {
        // head for a point 3 m behind the deer (behind = the way the camera looks from)
        const tx = player.pos.x + Math.sin(yaw) * 3, tz = player.pos.z + Math.cos(yaw) * 3;
        const d = new V3(tx - e.group.position.x, 0, tz - e.group.position.z).normalize().multiplyScalar(e.speed);
        want.set(d.x, 0, d.z);
      }
      // fade in from a faint shimmer (far) to solid (close)
      const k = 1 - smooth(4, 10, dist);
      e.flashMats[0].opacity = 0.12 + 0.88 * k;
      e.parts.eyeMat.opacity = 0.35 + 0.65 * k;
    },
    animate(e, dt) {
      e.phase += dt * e.speed * 2.4;
      const s = Math.sin(e.phase);
      e.parts.legs.forEach((L, i) => { L.rotation.x = (i === 0 || i === 3 ? s : -s) * 0.7; });
      e.parts.body.position.y = 0.62 + Math.abs(Math.cos(e.phase)) * 0.05;
    },
  },

  // A hunched hooded figure with a glowing staff. Stays back and shields its allies in sap.
  shaman: {
    label: 'Sap shaman', hp: 10, dmg: 6, speed: 2.6, xp: 6, coin: 6, r: 0.45, lo: 0.3, hi: 1.5, mass: 1.5, unlock: 360, weight: 1, chip: 0x3d4a22,
    ability: 'Sap shields: hangs back and coats nearby creatures in hardened sap that soaks up damage (half their health) until it breaks. Hunt it down first.',
    build(e) {
      const robe = std({ color: 0x3d4a22 }); e.flashMats.push(robe);
      const body = new THREE.Group(); e.group.add(body); e.parts.body = body;
      body.add(mesh(new THREE.ConeGeometry(0.45, 1.3, 8), robe, 0, 0.65, 0));             // robe
      const hood = mesh(new THREE.SphereGeometry(0.24, 8, 6), robe, 0, 1.35, 0.08); hood.scale.z = 1.2; body.add(hood);
      for (const x of [-0.08, 0.08]) body.add(mesh(new THREE.SphereGeometry(0.04, 5, 4), EYE.lime, x, 1.33, 0.32));
      const staff = new THREE.Group(); staff.position.set(0.38, 0.9, 0.15); body.add(staff); e.parts.staff = staff;
      staff.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.6, 5), MAT.bark, 0, 0, 0));
      const orb = new THREE.Sprite(glow(0xffb43a)); orb.position.y = 0.85; orb.scale.setScalar(0.7); staff.add(orb); e.parts.orb = orb;
    },
    ai(e, dt, want, dist) {
      // keep 12–16 m away, sidling around
      if (dist < 12) want.multiplyScalar(-0.7); else if (dist < 16) want.multiplyScalar(0.1);
      // every 3.5 s, shield up to 5 unshielded creatures within 9 m (never itself or a boss)
      if (ready(e, dt, 1.5)) {
        e.cd = 3.5;
        const near = foes.filter(o => o !== e && o.state === 'alive' && !o.def.boss && !(o.shield > 0) && o.group.position.distanceTo(e.group.position) < 9).slice(0, 5);
        for (const o of near) shieldFoe(o, o.maxHp * 0.5);
        ring(e.group.position, 9, 0xffb43a);
        if (near.length) sfx.shaman();
      }
      e.warn = e.cd < 0.5 ? 0.6 : 0;
    },
    animate(e, dt, now) {
      e.parts.staff.rotation.z = Math.sin(now / 400 + e.seed) * 0.15;
      e.parts.orb.scale.setScalar(0.6 + (e.cd < 0.5 ? 0.6 : 0) + Math.sin(now / 150) * 0.08); // flares before shielding
      e.parts.body.rotation.z = Math.sin(now / 500 + e.seed) * 0.05;
    },
  },
};

// [id, definition] pairs, handy for weighted random picks.
const FOE_LIST = Object.entries(FOES);

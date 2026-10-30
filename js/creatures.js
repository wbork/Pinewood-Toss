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
     r       body radius, for collisions and hits
     lo, hi  bottom and top of the vertical hit capsule, in meters above the feet
     mass    how hard it is to knock back (higher = barely moves)
     unlock  seconds survived before it starts appearing
     weight  how often it's picked compared to the others
     chip    color of the chips that fly off when it's defeated
     fly     (optional) floats, so trees and rocks don't block it
     build(e)            adds meshes to e.group, saving parts to animate in e.parts
     animate(e, dt, now) moves those parts each frame

   Every creature is built facing +z (toward its target) with its feet at y = 0.
   ========================================================================= */

const FOES = {
  // Small and common: a spiky ball on spindly bramble legs with long thorn arms.
  imp: {
    label: 'Bramble imp', hp: 3, dmg: 6, speed: 3.0, xp: 1, r: 0.42, lo: 0.55, hi: 1.05, mass: 1, unlock: 0, weight: 6, chip: 0x3b2436,
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
      e.parts.body.position.y = 1.0 + Math.abs(Math.cos(e.phase)) * 0.07;
      e.parts.body.rotation.z = s * 0.08;
    },
  },

  // Fast and floating: a dark crystal head with a ragged tail and a purple glow. Drifts over obstacles.
  wisp: {
    label: 'Gloom wisp', hp: 4, dmg: 8, speed: 3.8, xp: 2, r: 0.45, lo: 1.25, hi: 1.65, mass: 0.8, unlock: 90, weight: 3, chip: 0x2b2340, fly: true,
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
    label: 'Hollow stump', hp: 9, dmg: 12, speed: 2.0, xp: 3, r: 0.6, lo: 0.5, hi: 1.1, mass: 2.5, unlock: 180, weight: 3, chip: 0x6b4a32,
    build(e) {
      const bark = std({ color: 0x4a3424 }); e.flashMats.push(bark);
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
    },
  },

  // Rare and huge: a hunched boulder beast with a mossy back and long stone arms.
  mossback: {
    label: 'Mossback', hp: 32, dmg: 22, speed: 1.6, xp: 10, r: 1.05, lo: 0.7, hi: 1.4, mass: 8, unlock: 300, weight: 1, chip: 0x5f6157,
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
};

// [id, definition] pairs, handy for weighted random picks.
const FOE_LIST = Object.entries(FOES);

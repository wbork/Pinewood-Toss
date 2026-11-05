/* =========================================================================
   gear.js — the weapons you carry, shown on the ranger.

   Every weapon has a model attached to the deer's skeleton (deer.js), so
   it moves with the body:
     Pine Ball        a leather satchel of balls on the right hip
     Acorn Sling      a forked slingshot in the left hand
     Beehive          a hive hanging off the left side of the pack
     Frost Cone       an icy canister of frozen cones on the right of the pack
     Antler Sweep     carved brass bands on both antlers
     Thorn Ring       a bramble bracer on the right forearm
     Firefly Lantern  a glowing lantern hanging under the pack
     Mushroom Mines   a little basket of red mushrooms on the left hip
   When two weapons fuse (weapons.js), both pieces are replaced by the
   fusion's own merged piece (an icy satchel of snowballs, a honey-amber
   slingshot, a smoker can, ice-crusted antlers, ...).

   refreshGear() rebuilds everything from the weapon slots (`owned`); hud.js
   calls it whenever the slots change. stepGear() animates the little moving
   parts (glows flickering, bees buzzing).
   ========================================================================= */

// ---------- Looks ----------
const GM = {
  leather: std({ color: 0x6b4426 }), leatherDark: std({ color: 0x4a3020 }), wood: std({ color: 0x7a5232 }),
  band: std({ color: 0x2a2018 }), brass: std({ color: 0xe0b84a, metalness: 0.65, roughness: 0.35 }),
  steel: std({ color: 0x8a8f93, metalness: 0.6, roughness: 0.4 }),
  ice: std({ color: 0xcfeeff, emissive: 0x2a6a9a, roughness: 0.25 }), icePouch: std({ color: 0x9cc8e0 }),
  snow: soft(0xf4f8fb), amber: std({ color: 0xe0a030, emissive: 0x5a3000, roughness: 0.3 }),
  honey: soft(0xf0b030, { emissive: 0x6a3a00, roughness: 0.25 }),
  thornDark: std({ color: 0x3a2a3a }), toxic: std({ color: 0x9fe060, emissive: 0x4a8a10 }),
  ember: std({ color: 0xff8a2a, emissive: 0xc04010 }), basket: std({ color: 0x9a7a4a }),
  lanternGlass: new THREE.MeshBasicMaterial({ color: 0xffe08a }),
};

/** A mesh at (x, y, z) with rotation (rx, ry, rz). */
const gp = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = mesh(geo, mat, x, y, z); m.rotation.set(rx, ry, rz); return m; };
/** Move object o to (x, y, z) and return it. */
const place = (o, x, y, z) => { o.position.set(x, y, z); return o; };
/** A group at (x, y, z) holding the given children. */
const gg = (x, y, z, ...kids) => { const g = new THREE.Group(); g.position.set(x, y, z); if (kids.length) g.add(...kids); return g; };
/** A glowing halo that can flicker (stepGear). */
function gearGlow(color, size, x = 0, y = 0, z = 0, flicker = 0.15) {
  const s = new THREE.Sprite(glow(color)); s.position.set(x, y, z); s.scale.setScalar(size);
  s.userData.tick = t => s.scale.setScalar(size * (1 + Math.sin(t * 9 + x * 50) * flicker * 0.6 + Math.sin(t * 23) * flicker * 0.4));
  return s;
}

// ---------- Pieces shared by several builders ----------

/** A satchel: a pouch with a flap, its contents peeking out the top (`fill(group)`), on a belt loop. */
function satchel(pouchMat, flapMat, fill) {
  const g = gg(0, 0, 0,
    gp(new THREE.BoxGeometry(0.11, 0.13, 0.08), pouchMat, 0, -0.02, 0),
    gp(new THREE.BoxGeometry(0.115, 0.035, 0.085), flapMat, 0, 0.04, 0.004, 0.25),
    gp(new THREE.BoxGeometry(0.02, 0.05, 0.012), flapMat, 0, 0.09, -0.03),   // belt loop
    gp(new THREE.SphereGeometry(0.01, 6, 4), GM.brass, 0, 0.025, 0.046));   // button
  fill(g);
  return g;
}

/** A slingshot held in the hand: a handle, a fork and its band. */
function slingshot(mat, bandMat) {
  const g = gg(0, -0.05, 0.03,
    gp(new THREE.CylinderGeometry(0.011, 0.013, 0.1, 8), mat, 0, -0.04, 0),
    gp(new THREE.CylinderGeometry(0.008, 0.01, 0.085, 8), mat, 0.022, -0.125, 0, 0, 0, 0.45),
    gp(new THREE.CylinderGeometry(0.008, 0.01, 0.085, 8), mat, -0.022, -0.125, 0, 0, 0, -0.45),
    gp(new THREE.BoxGeometry(0.085, 0.006, 0.006), bandMat, 0, -0.16, 0),
    gp(new THREE.BoxGeometry(0.03, 0.02, 0.012), GM.leatherDark, 0, -0.165, 0.008)); // the pouch
  g.rotation.x = -0.35; // points a little forward
  return g;
}

/** A hive hanging from a strap, with bees buzzing around it. */
function hiveModel(extra) {
  const hive = gp(new THREE.SphereGeometry(1, 14, 10), LOOK.hive); hive.scale.set(0.075, 0.095, 0.075);
  const g = gg(0, 0, 0, hive,
    gp(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 10), GM.band, 0, -0.03, 0.072, Math.PI / 2), // entrance
    gp(new THREE.BoxGeometry(0.012, 0.08, 0.012), GM.leatherDark, 0, 0.12, 0));                   // strap
  const bees = [];
  for (let i = 0; i < 3; i++) { const b = gp(beeGeo, LOOK.bee); g.add(b); bees.push(b); }
  g.userData.tick = t => bees.forEach((b, i) => { const a = t * (3 + i) + i * 2; b.position.set(Math.cos(a) * 0.12, Math.sin(a * 1.7) * 0.05, Math.sin(a) * 0.12); });
  if (extra) extra(g);
  return g;
}

/** A small mushroom: a stem and a spotted cap (`capMat` red unless given). */
const shroom = (x, y, z, s, capMat = LOOK.mushCap) => gg(x, y, z,
  gp(new THREE.CylinderGeometry(0.01 * s, 0.013 * s, 0.03 * s, 6), LOOK.mushStem, 0, 0.015 * s, 0),
  gp(new THREE.SphereGeometry(0.028 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat, 0, 0.028 * s, 0),
  gp(new THREE.SphereGeometry(0.006 * s, 4, 3), LOOK.mushDot, 0.012 * s, 0.045 * s, 0.01 * s));

/** A woven basket with things in it. */
function basket(fill) {
  const g = gg(0, 0, 0,
    gp(new THREE.CylinderGeometry(0.06, 0.045, 0.07, 12), GM.basket, 0, 0, 0),
    gp(new THREE.TorusGeometry(0.06, 0.006, 4, 16), GM.wood, 0, 0.035, 0, Math.PI / 2),
    gp(new THREE.TorusGeometry(0.05, 0.005, 4, 12, Math.PI), GM.wood, 0, 0.035, 0, 0, Math.PI / 2)); // handle
  fill(g);
  return g;
}

/** A hanging lantern: brass frame, glowing glass, and a halo. */
function lantern(size, glassMat, glowColor) {
  const s = size;
  const g = gg(0, 0, 0,
    gp(new THREE.CylinderGeometry(0.035 * s, 0.035 * s, 0.07 * s, 8), glassMat, 0, 0, 0),
    gp(new THREE.CylinderGeometry(0.042 * s, 0.042 * s, 0.012 * s, 8), GM.brass, 0, -0.04 * s, 0),
    gp(new THREE.ConeGeometry(0.045 * s, 0.035 * s, 8), GM.brass, 0, 0.052 * s, 0),
    gp(new THREE.TorusGeometry(0.018 * s, 0.004 * s, 4, 10), GM.brass, 0, 0.08 * s, 0),
    gearGlow(glowColor, 0.35 * s));
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.add(gp(new THREE.CylinderGeometry(0.004 * s, 0.004 * s, 0.075 * s, 4), GM.brass, Math.cos(a) * 0.036 * s, 0, Math.sin(a) * 0.036 * s)); }
  return g;
}

/** A bracer on the forearm: a band with spikes all around (`spikeMat`). */
function bracer(bandMat, spikeMat, glowColor) {
  const g = gg(0, -0.13, 0, gp(new THREE.CylinderGeometry(0.048, 0.044, 0.07, 12), bandMat, 0, 0, 0));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, y = (i % 2) * 0.03 - 0.015;
    const c = gp(new THREE.ConeGeometry(0.009, 0.045, 4), spikeMat, Math.cos(a) * 0.05, y, Math.sin(a) * 0.05);
    c.quaternion.setFromUnitVectors(UP, new V3(Math.cos(a), 0.2, Math.sin(a)).normalize()); g.add(c);
  }
  if (glowColor) g.add(gearGlow(glowColor, 0.22));
  return g;
}

// ---------- One builder per weapon and per fusion ----------
// Each returns a list of [bone, object] pairs: where each piece attaches.
const GEAR = {
  pine: B => [[B.pelvis, place(satchel(GM.leather, GM.leatherDark, g => {
    for (const [x, z] of [[-0.03, 0], [0.02, 0.015], [0.03, -0.018]]) { const b = gp(new THREE.SphereGeometry(0.03, 12, 8), ballMat, x, 0.065, z); g.add(b); }
  }), -0.175, -0.03, 0.02)]],

  acorn: B => [[B.handL, slingshot(GM.wood, GM.band)]],

  hive: B => [[B.chest, place(hiveModel(), 0.19, 0.02, -0.2)]],

  frost: B => {
    const g = gg(-0.185, 0.06, -0.2,
      gp(new THREE.CylinderGeometry(0.045, 0.045, 0.15, 12), GM.steel, 0, 0, 0),
      gp(new THREE.CylinderGeometry(0.048, 0.048, 0.015, 12), GM.brass, 0, 0.065, 0),
      gearGlow(0x9fdcff, 0.25, 0, 0.1, 0));
    for (const [x, z, r] of [[0, 0, 0], [0.02, 0.015, 0.3], [-0.02, -0.01, -0.3]]) { const c = gp(frostGeo, LOOK.frost, x, 0.1, z, 0, 0, r); c.scale.set(0.022, 0.04, 0.022); g.add(c); }
    return [[B.chest, g]];
  },

  antler: B => deer.antlers.map((beam, i) => [beam, gg(0, 0, 0,
    gp(new THREE.TorusGeometry(0.031, 0.009, 6, 14), GM.brass, 0, 0.06, 0, Math.PI / 2),
    gp(new THREE.TorusGeometry(0.026, 0.008, 6, 14), GM.brass, 0, 0.2, 0, Math.PI / 2),
    gearGlow(0xffd36a, 0.12, 0, 0.13, 0.03, 0.3))]),

  thorn: B => [[B.foreR, bracer(GM.band, LOOK.thorn)]],

  firefly: B => [[B.chest, place(lantern(1, GM.lanternGlass, 0xffd36a), 0, -0.13, -0.29)]],

  mush: B => [[B.pelvis, place(basket(g => { g.add(shroom(-0.02, 0.03, 0.01, 1.1), shroom(0.025, 0.03, -0.01, 0.9), shroom(0, 0.03, 0.025, 0.8)); }), 0.15, -0.04, -0.1)]],

  // ---- fusions ----
  avalanche: B => [[B.pelvis, place(satchel(GM.icePouch, GM.ice, g => {             // Snowball Mortar: an icy satchel of snowballs
    for (const [x, z] of [[-0.03, 0], [0.02, 0.015], [0.03, -0.018]]) g.add(gp(new THREE.SphereGeometry(0.032, 12, 8), GM.snow, x, 0.07, z));
    for (const [x, r] of [[-0.05, 0.4], [0.05, -0.4]]) { const c = gp(frostGeo, GM.ice, x, 0.03, 0.04, 0, 0, r); c.scale.set(0.015, 0.035, 0.015); g.add(c); }
    g.add(gearGlow(0x9fdcff, 0.3, 0, 0.06, 0));
  }), -0.175, -0.03, 0.02)]],

  mark: B => {                                                                        // Hunter's Lantern: a brass lantern on the hip with a burning pine ball inside
    const g = lantern(1.5, GM.amber, 0xffb040);
    g.add(gp(new THREE.SphereGeometry(0.025, 10, 8), GM.ember, 0, 0, 0));
    g.position.set(-0.18, -0.02, 0.02);
    return [[B.pelvis, g]];
  },

  coldsnap: B => {                                                                    // Hailstorm Sling: a slingshot of ice
    const g = slingshot(GM.ice, GM.icePouch);
    for (const x of [-0.04, 0.04]) { const c = gp(frostGeo, GM.ice, x, -0.17, 0); c.scale.set(0.012, 0.025, 0.012); g.add(c); }
    g.add(gearGlow(0x9fdcff, 0.25, 0, -0.12, 0));
    return [[B.handL, g]];
  },

  honey: B => {                                                                       // Honeyshot: a honey-amber slingshot, dripping
    const g = slingshot(GM.honey, GM.amber);
    for (const [x, y] of [[0.03, -0.2], [-0.025, -0.19], [0, -0.09]]) g.add(gp(new THREE.SphereGeometry(0.009, 6, 4), GM.honey, x, y, 0.005));
    const hv = gp(new THREE.SphereGeometry(1, 10, 8), LOOK.hive, 0, -0.03, 0.015); hv.scale.set(0.02, 0.026, 0.02); g.add(hv);
    return [[B.handL, g]];
  },

  smoked: B => {                                                                      // Smoker's Hive: a beekeeper's smoker with embers inside
    const smoke = gearGlow(0x9a9a9a, 0.3, 0, 0.16, 0, 0.4); smoke.material.opacity = 0.5;
    const g = gg(0.19, 0.02, -0.2,
      gp(new THREE.CylinderGeometry(0.045, 0.045, 0.13, 12), GM.steel, 0, 0, 0),
      gp(new THREE.CylinderGeometry(0.047, 0.047, 0.012, 12), GM.brass, 0, -0.03, 0),
      gp(new THREE.ConeGeometry(0.045, 0.05, 12), GM.steel, 0, 0.09, 0),
      gp(new THREE.CylinderGeometry(0.008, 0.012, 0.04, 6), GM.steel, 0.012, 0.13, 0, 0, 0, -0.5),
      gp(new THREE.BoxGeometry(0.02, 0.09, 0.06), GM.leather, 0.06, 0.0, 0),        // bellows
      gearGlow(0xff7a2a, 0.22, 0, 0.0, 0.05, 0.4), smoke);
    return [[B.chest, g]];
  },

  shatter: B => deer.antlers.map(beam => {                                            // Glacier Antlers: crusted in ice crystals
    const g = gg(0, 0, 0, gearGlow(0x9fdcff, 0.18, 0, 0.2, 0, 0.2));
    for (const [y, x, s] of [[0.04, 0.02, 1], [0.16, -0.02, 0.8], [0.27, 0.015, 1.1], [0.3, -0.02, 0.7]]) {
      const c = gp(frostGeo, GM.ice, x, y, 0.01, 0.3, 0, x * 10); c.scale.set(0.022 * s, 0.045 * s, 0.022 * s); g.add(c);
    }
    return [beam, g];
  }),

  bramble: B => [                                                                     // Crown of Thorns: vines up the antlers, a thorn crown on the hat
    ...deer.antlers.map(beam => {
      const g = gg(0, 0, 0);
      for (let i = 0; i < 6; i++) { const a = i * 2.1, y = 0.03 + i * 0.045; const c = gp(new THREE.ConeGeometry(0.008, 0.04, 4), LOOK.thorn, Math.cos(a) * 0.028, y, Math.sin(a) * 0.028); c.quaternion.setFromUnitVectors(UP, new V3(Math.cos(a), 0.5, Math.sin(a)).normalize()); g.add(c); }
      g.add(gp(new THREE.TorusGeometry(0.03, 0.007, 4, 12), LOOK.thorn, 0, 0.12, 0, Math.PI / 2 + 0.3));
      return [beam, g];
    }),
    [B.head, (() => {
      const g = gg(0, 0.255, 0, gp(new THREE.TorusGeometry(0.15, 0.012, 5, 20), LOOK.thorn, 0, 0, 0, Math.PI / 2));
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(gp(new THREE.ConeGeometry(0.01, 0.06, 4), LOOK.thorn, Math.cos(a) * 0.15, 0.03, Math.sin(a) * 0.15)); }
      return g;
    })()],
  ],

  toxic: B => [[B.foreR, bracer(GM.thornDark, GM.toxic, 0x9fe060)]],                // Blight Ring: a poisoned bracer with glowing thorns

  wildfire: B => [[B.pelvis, place(basket(g => {                                     // Ember Caps: a basket of smouldering mushrooms
    g.add(shroom(-0.02, 0.03, 0.01, 1.1, GM.ember), shroom(0.025, 0.03, -0.01, 0.9, GM.ember), shroom(0, 0.03, 0.025, 0.8, GM.ember));
    g.add(gearGlow(0xff7a2a, 0.3, 0, 0.07, 0, 0.35));
  }), 0.15, -0.04, -0.1)]],

  hivemind: B => [[B.chest, place(hiveModel(g => {                                   // Swarm Garden: a hive sprouting mushrooms
    g.add(shroom(0.05, 0.05, 0.03, 0.9), shroom(-0.055, 0.02, 0.02, 0.8), shroom(0.01, 0.085, -0.02, 1));
  }), 0.19, 0.02, -0.2)]],
};

// ---------- Keeping the gear in step with the weapon slots ----------
let gearOn = []; // every object currently attached

/** Rebuild the gear from the weapon slots: one piece per weapon, one merged piece per fusion. */
function refreshGear() {
  for (const o of gearOn) o.parent && o.parent.remove(o);
  gearOn = [];
  for (const id of owned) {
    if (!GEAR[id]) continue;
    for (const [bone, obj] of GEAR[id](deer.bones)) { bone.add(obj); gearOn.push(obj); }
  }
}

/** Animate the gear's little moving parts (flickering glows, buzzing bees). Runs every frame. */
function stepGear(dt) {
  const t = performance.now() / 1000;
  for (const o of gearOn) o.traverse(c => { if (c.userData.tick) c.userData.tick(t); });
}

/* =========================================================================
   deer.js — the player character: a deer who is a Pinewood park ranger,
   built as a rigged, skinned 3D model with procedural animation.

   The look follows the design sheet ("Deer Ranger Redesign" canvas): a
   campaign hat with the antlers coming up through its crown and the ears
   under the brim, a khaki shirt with flap pockets, a gold badge, a name tag
   and shoulder patches, sleeves rolled to the elbow, a green neckerchief, a
   duty belt (buckle, radio, canteen, flashlight), slim green trousers,
   boots ending in split hooves, and a backpack with a bedroll.

   HOW IT'S BUILT
   - A skeleton of 17 bones (THREE.Bone): pelvis → spine → chest → neck →
     head, the two arms (upper arm → forearm → hand) off the chest, and the
     two legs (thigh → shin → foot) off the pelvis.
   - The body itself (torso, trouser seat, legs, sleeves, forearms, neck) is
     made of faceted tubes (few sides, flat-shaded) that are SKINNED to those
     bones: each vertex follows one or two bones by weight, so knees, elbows,
     hips and the waist bend smoothly instead of hinging like blocks.
   - Rigid details (hat, antlers, face, pockets, belt kit, backpack, boots,
     hands) are simply attached to the bone they belong to.

   HOW IT MOVES (updateDeer)
   Every frame computes a target angle for each bone from layered motions
   (walking or running in any direction, idle breathing, jumping, landing,
   throwing, the Antler Sweep) and then eases each bone toward its target,
   which is what keeps the motion fluid rather than snapping between poses.

   The model is built facing +z (its left is +x) with its feet at y = 0.
   ========================================================================= */

// ---------- Materials ----------
// Everything is flat-shaded and matte, like the rest of the game (see "THE LOOK" in
// creatures.js): the body and head are built from shapes with few sides, so the ranger
// reads as crisp facets, matching the creatures, trees and rocks.
// `soft` is for the cloth and fur (slightly less rough than `std`).
const soft = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, flatShading: true }, o));
const RANGER = {
  fur: soft(0x9a6538), furDark: soft(0x6b4426), pale: soft(0xe8d9bd), dark: soft(0x24170f, { roughness: 0.5 }),
  horn: std({ color: 0xe6d8b8 }), earPink: soft(0xd9a98a),
  shirt: soft(0xc8b07a), shirtDark: std({ color: 0x9c895f }),
  pants: soft(0x3f5a32), pantsDark: std({ color: 0x30452a }),
  hat: std({ color: 0xb89a62 }), band: std({ color: 0x5a3a22 }), leather: std({ color: 0x4a3020 }),
  scarf: soft(0x2f6b3a), brass: std({ color: 0xe0b84a, metalness: 0.6, roughness: 0.4 }),
  pack: std({ color: 0x5f6b4a }), packDark: std({ color: 0x4d5839 }), bedroll: std({ color: 0x8a6a44 }),
  gear: std({ color: 0x2a2a2a }), boot: std({ color: 0x2b1d14 }), white: soft(0xefe4cc),
};
// The skinned body gets its own copies of those materials, told they'll be bent by bones.
// (In this three.js version a skinning material doesn't draw on an ordinary mesh, so the
// rigid parts — skull, collar, ... — keep the plain ones.)
for (const k of ['fur', 'shirt', 'pants']) { RANGER[k + 'Skin'] = RANGER[k].clone(); RANGER[k + 'Skin'].skinning = true; }

/**
 * A smooth, closed tube for a skinned body part. `rings` go from bottom to top; each is
 * { y, x, z (center), rx, rz (ellipse radii), w: [[bone, weight], [bone, weight]] }.
 * Every vertex of a ring follows those bones by those weights.
 */
function skinTube(rings, radial, mat, bones, root) {
  const pos = [], si = [], sw = [], idx = [];
  const weigh = w => { si.push(bones.indexOf(w[0][0]), w[1] ? bones.indexOf(w[1][0]) : 0, 0, 0); sw.push(w[0][1], w[1] ? w[1][1] : 0, 0, 0); };
  for (const R of rings) for (let j = 0; j < radial; j++) {
    const a = (j / radial) * Math.PI * 2;
    pos.push(R.x + R.rx * Math.sin(a), R.y, R.z + R.rz * Math.cos(a)); weigh(R.w);
  }
  // sides (wound so they face outward)
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial, c = a + radial, d = b + radial;
    idx.push(a, b, c, b, d, c);
  }
  // end caps: a center point joined to its ring (bottom faces down, top faces up)
  for (const [ri, up] of [[0, false], [rings.length - 1, true]]) {
    const R = rings[ri], ci = pos.length / 3;
    pos.push(R.x, R.y, R.z); weigh(R.w);
    for (let j = 0; j < radial; j++) {
      const a = ri * radial + j, b = ri * radial + (j + 1) % radial;
      if (up) idx.push(ci, a, b); else idx.push(ci, b, a);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.SkinnedMesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  m.frustumCulled = false; // its bind-pose bounds don't follow the animation
  root.add(m);
  return m;
}

function buildDeer() {
  const M = RANGER;
  const d = {
    root: new THREE.Group(), mats: [M.fur, M.shirt, M.pants, M.furSkin, M.shirtSkin, M.pantsSkin, M.hat, M.pack, M.pale],
    phase: 0, spd: 0, airK: 0, land: 0, wasAir: false, mz: 1, mx: 0, t: 0,
    throwT: 0, sweepT: 0, fall: 0, flash: 0, facing: 0, blinkT: 2, earT: 3, earSide: 0,
  };
  d.root.rotation.order = 'YXZ'; // turn (Y) first, then tip over (X) when falling, then lean (Z)

  // ---- Skeleton (bind pose: standing straight, arms hanging) ----
  const bone = (parent, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); parent.add(b); return b; };
  const B = {};
  B.pelvis = bone(d.root, 0, 1.0, 0);
  B.spine = bone(B.pelvis, 0, 0.16, 0);
  B.chest = bone(B.spine, 0, 0.2, 0);
  B.neck = bone(B.chest, 0, 0.27, 0.01);
  B.head = bone(B.neck, 0, 0.13, 0.01);
  for (const [k, s] of [['L', 1], ['R', -1]]) { // L = the deer's left (+x)
    B['arm' + k] = bone(B.chest, s * 0.215, 0.22, -0.01);
    B['fore' + k] = bone(B['arm' + k], 0, -0.29, 0);
    B['hand' + k] = bone(B['fore' + k], 0, -0.26, 0);
    B['thigh' + k] = bone(B.pelvis, s * 0.095, -0.05, 0);
    B['shin' + k] = bone(B['thigh' + k], 0, -0.44, 0);
    B['foot' + k] = bone(B['shin' + k], 0, -0.42, 0);
  }
  d.bones = B;
  d.root.updateMatrixWorld(true);
  const bones = Object.values(B), skeleton = new THREE.Skeleton(bones);
  const tube = (rings, radial, mat) => { const m = skinTube(rings, radial, mat, bones, d.root); m.bind(skeleton); return m; };
  const W = (b1, w1, b2) => (b2 ? [[b1, w1], [b2, 1 - w1]] : [[b1, 1]]); // ring weights
  const ring = (y, rx, rz, w, x = 0, z = 0) => ({ y, rx, rz, w, x, z });

  // ---- Skinned body ----
  // uniform shirt: tucked in at the waist, broadening to the chest, closing around the neck
  tube([
    ring(1.06, 0.15, 0.115, W(B.pelvis)), ring(1.14, 0.152, 0.117, W(B.pelvis, 0.5, B.spine)),
    ring(1.24, 0.158, 0.12, W(B.spine)), ring(1.34, 0.172, 0.125, W(B.spine, 0.5, B.chest)),
    ring(1.44, 0.186, 0.13, W(B.chest)), ring(1.54, 0.192, 0.13, W(B.chest)), ring(1.6, 0.182, 0.124, W(B.chest)),
    ring(1.65, 0.135, 0.105, W(B.chest)), ring(1.68, 0.068, 0.068, W(B.chest, 0.5, B.neck)),
  ], 10, M.shirtSkin);
  // trouser seat
  tube([ring(0.86, 0.13, 0.108, W(B.pelvis)), ring(0.94, 0.147, 0.117, W(B.pelvis)), ring(1.04, 0.152, 0.118, W(B.pelvis)), ring(1.12, 0.15, 0.116, W(B.pelvis))], 10, M.pantsSkin);
  // neck
  tube([ring(1.58, 0.06, 0.06, W(B.chest), 0, 0.01), ring(1.66, 0.055, 0.058, W(B.neck, 0.7, B.chest), 0, 0.012), ring(1.74, 0.05, 0.055, W(B.neck, 0.5, B.head), 0, 0.016), ring(1.8, 0.045, 0.05, W(B.head), 0, 0.02)], 6, M.furSkin);
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const th = B['thigh' + k], sh = B['shin' + k], ua = B['arm' + k], fa = B['fore' + k], hd = B['hand' + k];
    const x = s * 0.095, ax = s * 0.215;
    // a slim trouser leg from hip to ankle, bending at the knee
    tube([
      ring(0.16, 0.042, 0.045, W(sh), x), ring(0.22, 0.044, 0.047, W(sh), x), ring(0.33, 0.05, 0.055, W(sh), x),
      ring(0.44, 0.052, 0.056, W(sh, 0.8, th), x), ring(0.51, 0.053, 0.056, W(sh, 0.5, th), x), ring(0.58, 0.057, 0.06, W(th, 0.8, sh), x),
      ring(0.72, 0.066, 0.07, W(th), x), ring(0.88, 0.072, 0.078, W(th), x), ring(0.98, 0.075, 0.08, W(th, 0.5, B.pelvis), x),
    ], 7, M.pantsSkin);
    // khaki sleeve from the shoulder to just above the elbow
    tube([
      ring(1.31, 0.046, 0.045, W(ua, 0.7, fa), ax, -0.01), ring(1.38, 0.046, 0.045, W(ua), ax, -0.01), ring(1.48, 0.05, 0.048, W(ua), ax, -0.01),
      ring(1.58, 0.055, 0.052, W(ua, 0.8, B.chest), ax, -0.01), ring(1.63, 0.045, 0.045, W(ua, 0.5, B.chest), ax, -0.01),
    ], 7, M.shirtSkin);
    // fur forearm from the elbow to the wrist
    tube([
      ring(1.03, 0.028, 0.028, W(fa, 0.6, hd), ax, -0.01), ring(1.06, 0.03, 0.03, W(fa), ax, -0.01), ring(1.17, 0.037, 0.036, W(fa), ax, -0.01),
      ring(1.27, 0.04, 0.04, W(fa, 0.8, ua), ax, -0.01), ring(1.33, 0.04, 0.04, W(fa, 0.5, ua), ax, -0.01),
    ], 6, M.furSkin);
  }

  // ---- Rigid details, attached to their bones ----
  const at = (b, geo, mat, x, y, z) => { const m = mesh(geo, mat, x, y, z); b.add(m); return m; };
  const C = B.chest, P = B.pelvis, H = B.head;
  // shirt front: placket, two flap pockets, badge, name tag, collar, neckerchief
  at(C, new THREE.BoxGeometry(0.012, 0.36, 0.012), M.shirtDark, 0, 0.08, 0.131);
  for (const s of [-1, 1]) {
    at(C, new THREE.BoxGeometry(0.07, 0.07, 0.018), M.shirtDark, s * 0.072, 0.1, 0.122);
    at(C, new THREE.BoxGeometry(0.078, 0.024, 0.022), M.shirtDark, s * 0.072, 0.145, 0.124);
    const collar = at(C, new THREE.ConeGeometry(0.045, 0.08, 3), M.shirt, s * 0.055, 0.29, 0.085); collar.rotation.set(0.6, 0, s * 2.6);
    at(C, new THREE.BoxGeometry(0.026, 0.36, 0.014), M.leather, s * 0.118, 0.1, 0.102).rotation.z = s * 0.08; // pack shoulder strap
  }
  const badge = at(C, new THREE.CylinderGeometry(0.03, 0.03, 0.012, 5), M.brass, 0.072, 0.205, 0.124); badge.rotation.x = Math.PI / 2;
  at(C, new THREE.BoxGeometry(0.06, 0.018, 0.01), M.dark, -0.072, 0.205, 0.125);
  const kerchief = at(C, new THREE.ConeGeometry(0.085, 0.15, 3), M.scarf, 0, 0.235, 0.118); kerchief.rotation.x = Math.PI; kerchief.scale.z = 0.35;
  at(C, new THREE.SphereGeometry(0.03, 6, 4), M.scarf, 0, 0.29, 0.1);
  // backpack: body, top flap, front pocket with a brass emblem, bedroll strapped on top
  at(C, new THREE.BoxGeometry(0.3, 0.34, 0.13), M.pack, 0, 0.1, -0.19);
  at(C, new THREE.BoxGeometry(0.28, 0.1, 0.04), M.packDark, 0, 0.22, -0.265);
  at(C, new THREE.BoxGeometry(0.2, 0.12, 0.04), M.packDark, 0, 0.02, -0.27);
  at(C, new THREE.CylinderGeometry(0.026, 0.026, 0.01, 8), M.brass, 0, 0.02, -0.292).rotation.x = Math.PI / 2;
  at(C, new THREE.CylinderGeometry(0.062, 0.062, 0.36, 7), M.bedroll, 0, 0.32, -0.19).rotation.z = Math.PI / 2;
  for (const x of [-0.1, 0.1]) at(C, new THREE.CylinderGeometry(0.066, 0.066, 0.025, 7), M.leather, x, 0.32, -0.19).rotation.z = Math.PI / 2;
  // duty belt and canteen (the hips also carry weapon gear: gear.js), and a radio clipped to the left strap
  const belt = at(P, new THREE.CylinderGeometry(0.155, 0.155, 0.05, 10), M.leather, 0, 0.12, 0); belt.scale.z = 0.78;
  at(P, new THREE.BoxGeometry(0.05, 0.042, 0.016), M.brass, 0, 0.12, 0.124);
  at(P, new THREE.SphereGeometry(0.05, 7, 5), M.pack, 0.16, 0.05, 0.03).scale.set(0.6, 1.15, 1);   // canteen
  at(C, new THREE.BoxGeometry(0.04, 0.07, 0.025), M.gear, 0.118, 0.17, 0.118);                      // radio
  at(C, new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4), M.gear, 0.13, 0.24, 0.118);              // its antenna
  // white tail, poking out under the pack
  const tailPivot = new THREE.Group(); tailPivot.position.set(0, 0.0, -0.12); P.add(tailPivot); d.tail = tailPivot;
  const tail = mesh(new THREE.SphereGeometry(0.055, 6, 4), M.white, 0, 0.03, -0.03); tail.scale.set(0.9, 1.3, 0.8); tailPivot.add(tail);
  // shoulder patches, rolled cuffs, hoof hands
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const patch = at(B['arm' + k], new THREE.CylinderGeometry(0.03, 0.03, 0.01, 5), M.pantsDark, s * 0.05, -0.08, 0); patch.rotation.z = Math.PI / 2;
    const rim = at(B['arm' + k], new THREE.CylinderGeometry(0.035, 0.035, 0.006, 5), M.brass, s * 0.047, -0.08, 0); rim.rotation.z = Math.PI / 2;
    at(B['fore' + k], new THREE.CylinderGeometry(0.052, 0.05, 0.05, 7), M.shirtDark, 0, 0.0, 0);
    at(B['hand' + k], new THREE.SphereGeometry(1, 6, 4), M.furDark, 0, -0.035, 0.005).scale.set(0.036, 0.05, 0.038);
    at(B['hand' + k], new THREE.ConeGeometry(0.026, 0.05, 5), M.dark, 0, -0.085, 0.006).rotation.x = Math.PI;
    // boot with a leather cuff, ending in a split hoof
    at(B['foot' + k], new THREE.CylinderGeometry(0.05, 0.058, 0.15, 7), M.boot, 0, 0.02, 0.004);
    at(B['foot' + k], new THREE.CylinderGeometry(0.054, 0.054, 0.022, 7), M.leather, 0, 0.09, 0.004);
    for (const x of [-0.019, 0.019]) at(B['foot' + k], new THREE.BoxGeometry(0.033, 0.055, 0.11), M.dark, x, -0.062, 0.022);
  }

  // ---- Head: skull, muzzle, nose, eyes, ears, campaign hat, antlers ----
  // (few-sided spheres throughout, so the face reads as facets like the rest of the forest)
  const skull = at(H, new THREE.SphereGeometry(0.14, 9, 6), M.fur, 0, 0.1, 0); skull.scale.set(0.92, 1, 1.05);
  at(H, new THREE.SphereGeometry(1, 8, 5), M.fur, 0, 0.055, 0.12).scale.set(0.062, 0.058, 0.105);     // snout
  at(H, new THREE.SphereGeometry(1, 8, 5), M.pale, 0, 0.028, 0.13).scale.set(0.046, 0.032, 0.09);     // pale chin and lower muzzle
  at(H, new THREE.SphereGeometry(1, 6, 4), M.dark, 0, 0.075, 0.222).scale.set(0.03, 0.022, 0.02);    // nose
  at(H, new THREE.SphereGeometry(1, 7, 4), M.pale, 0, -0.03, 0.06).scale.set(0.06, 0.05, 0.05);      // pale throat patch
  at(H, new THREE.SphereGeometry(1, 6, 4), M.furDark, 0, 0.098, 0.15).scale.set(0.03, 0.016, 0.07);  // darker stripe down the top of the muzzle
  d.eyes = [];
  d.ears = [];
  for (const s of [-1, 1]) {
    const eye = at(H, new THREE.SphereGeometry(0.024, 7, 5), M.dark, s * 0.085, 0.13, 0.088); d.eyes.push(eye);
    at(H, new THREE.SphereGeometry(0.007, 4, 3), M.white, s * 0.092, 0.139, 0.108);                    // glint
    // cheek tufts: little faceted wedges of fur sweeping back below the eyes
    const tuft = at(H, new THREE.ConeGeometry(0.03, 0.09, 4), M.fur, s * 0.115, 0.06, 0.02); tuft.rotation.set(-1.1, 0, -s * 0.9);
    // ear: a leaf sticking out sideways under the brim, pink inside; its own pivot so it can flick
    const ear = new THREE.Group(); ear.position.set(s * 0.115, 0.15, -0.01); ear.rotation.z = -s * 1.2; H.add(ear); d.ears.push(ear);
    at(ear, new THREE.SphereGeometry(1, 6, 4), M.fur, 0, 0.08, 0).scale.set(0.042, 0.1, 0.018);
    at(ear, new THREE.SphereGeometry(1, 6, 4), M.earPink, 0, 0.08, 0.009).scale.set(0.028, 0.075, 0.01);
  }
  // a tuft of forelock poking out from under the brim
  for (const x of [-0.025, 0.02]) at(H, new THREE.ConeGeometry(0.022, 0.06, 4), M.furDark, x, 0.2, 0.13).rotation.set(2.3, 0, x * 8);
  // campaign hat: wide flat brim, a crown pinched to a four-dent peak, a leather band and a pine pin
  at(H, new THREE.CylinderGeometry(0.245, 0.245, 0.016, 10), M.hat, 0, 0.225, 0);
  at(H, new THREE.CylinderGeometry(0.045, 0.135, 0.19, 4), M.hat, 0, 0.33, 0).rotation.y = Math.PI / 4;
  at(H, new THREE.CylinderGeometry(0.13, 0.14, 0.04, 4), M.band, 0, 0.256, 0).rotation.y = Math.PI / 4;
  at(H, new THREE.ConeGeometry(0.016, 0.04, 4), M.scarf, 0.07, 0.258, 0.074);
  /** One antler prong: a thin cylinder growing from height y on `parent`, tilted by rx (forward) and rz (sideways). */
  const tine = (parent, y, rx, rz, len) => {
    const g = new THREE.Group(); g.position.y = y; g.rotation.set(rx, 0, rz); parent.add(g);
    g.add(mesh(new THREE.CylinderGeometry(0.01, 0.017, len, 5), M.horn, 0, len / 2, 0)); return g;
  };
  for (const s of [-1, 1]) {
    // antler: through a slit in the side of the crown; a burr, a lower beam leaning out, an upper
    // beam curving back in, a brow prong forward, prongs angled out and in, and a fork at the tip
    const beam = new THREE.Group(); beam.position.set(s * 0.095, 0.285, -0.02); beam.rotation.z = -s * 0.7; H.add(beam);
    (d.antlers = d.antlers || []).push(beam); // weapon gear can decorate the antlers (gear.js)
    beam.add(mesh(new THREE.SphereGeometry(0.034, 5, 4), M.horn, 0, 0, 0));
    beam.add(mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.3, 5), M.horn, 0, 0.15, 0));
    const upper = new THREE.Group(); upper.position.y = 0.3; upper.rotation.set(-0.15, 0, s * 0.55); beam.add(upper);
    upper.add(mesh(new THREE.CylinderGeometry(0.015, 0.022, 0.32, 5), M.horn, 0, 0.16, 0));
    tine(beam, 0.06, 1.15, 0, 0.16); tine(beam, 0.22, 0.6, -s * 0.45, 0.17);
    tine(upper, 0.12, 0.45, s * 0.6, 0.16); tine(upper, 0.3, 0.2, -s * 0.5, 0.13); tine(upper, 0.3, 0.3, s * 0.35, 0.11);
  }
  return d;
}

// ---------- The Blender model ----------
/**
 * Build the ranger from the model made in Blender (blender/ranger.blend, exported by
 * blender/pinewood_export.py to js/models/ranger.js as PINEWOOD_MODELS.ranger).
 *
 * The export is ONE skinned mesh (one draw group per material) plus its bones. The bones
 * have the same names and rest positions as buildDeer's skeleton, so updateDeer animates
 * it the same way, and gear.js hangs weapons on the same bones. Extra bones:
 *   earL / earR  the ears (modeled already turned out sideways: rig.earRest)
 *   eyeL / eyeR  the eyes (scaled flat to blink)
 *   tail         the tail
 * Rigid parts (hat, antlers, boots, pack...) are weighted 100% to their bone.
 */
function buildDeerFromModel(mdl) {
  const d = {
    root: new THREE.Group(), mats: [],
    phase: 0, spd: 0, airK: 0, land: 0, wasAir: false, mz: 1, mx: 0, t: 0,
    throwT: 0, sweepT: 0, fall: 0, flash: 0, facing: 0, blinkT: 2, earT: 3, earSide: 0,
    earRest: (mdl.rig && mdl.rig.earRest) || 0,
  };
  d.root.rotation.order = 'YXZ';

  // bones: positions in the file are in model space; three.js wants them relative to the parent
  const B = {}, list = [], at = {};
  for (const b of mdl.bones) {
    const bone = new THREE.Bone();
    bone.name = b.name;
    const pp = b.parent ? at[b.parent] : [0, 0, 0];
    bone.position.set(b.pos[0] - pp[0], b.pos[1] - pp[1], b.pos[2] - pp[2]);
    (b.parent ? B[b.parent] : d.root).add(bone);
    B[b.name] = bone; at[b.name] = b.pos; list.push(bone);
  }
  d.bones = B;
  d.root.updateMatrixWorld(true);

  // the mesh: flat-shaded, skinned, one material per group (all of them flash red when hurt)
  const geo = modelGeometry(mdl);                          // materials.js
  d.mats = mdl.materials.map(m => modelMaterial(m, true));
  const body = new THREE.SkinnedMesh(geo, d.mats);
  body.castShadow = body.receiveShadow = true;
  body.frustumCulled = false; // its bind-pose bounds don't follow the animation
  d.root.add(body);
  body.bind(new THREE.Skeleton(list));

  // hooks the animation and gear.js expect (same order as buildDeer: right side first)
  d.eyes = [B.eyeR, B.eyeL];
  d.ears = [B.earR, B.earL];
  d.tail = B.tail;
  // where gear.js decorates the antlers: the base of each beam, tilted out along it
  // (the export says where the antlers start: rig.antlers, in model space)
  const hp = at.head, spots = (mdl.rig && mdl.rig.antlers) || [-1, 1].map(s => ({ pos: [s * 0.095 + hp[0], 0.27 + hp[1], -0.03 + hp[2]], rotZ: -s * 0.7 }));
  d.antlers = spots.map(a => { const g = new THREE.Group(); g.position.set(a.pos[0] - hp[0], a.pos[1] - hp[1], a.pos[2] - hp[2]); g.rotation.z = a.rotZ; B.head.add(g); return g; });
  return d;
}

// Use the Blender model when its file is loaded (index.html), else the built-in one above.
const deer = window.PINEWOOD_MODELS && PINEWOOD_MODELS.ranger ? buildDeerFromModel(PINEWOOD_MODELS.ranger) : buildDeer();
scene.add(deer.root);

// ---------- Animation ----------

/** Ease `cur` toward `target` at `rate` per second (frame-rate independent). */
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** Ease a bone's rotation toward (x, y, z). */
function pose(b, x, y, z, rate, dt) {
  b.rotation.x = damp(b.rotation.x, x, rate, dt);
  b.rotation.y = damp(b.rotation.y, y, rate, dt);
  b.rotation.z = damp(b.rotation.z, z, rate, dt);
}

/**
 * Pose the deer for this frame: follow the player position, face the camera direction,
 * and animate. `follow` = turn toward where the camera looks (off on the title screen and
 * after death). Layers, blended by how fast the deer is moving:
 *   idle   breathing, a slow weight shift in the upper body, head tilts, ear flicks, blinks,
 *          tail flicks; the hips and feet stay planted
 *   move   legs step in whatever direction the deer is moving relative to where it faces:
 *          forward, backward, sideways (side-steps, never crossing the legs) or any mix.
 *          The knees bend through each step and the hooves roll off the toe going forward;
 *          hips twist and bob, the chest counter-twists, arms swing opposite the legs,
 *          and the upper body leans slightly into the direction of travel
 *   run    longer strides, more knee lift, a forward lean, arms pumping with bent elbows
 *   air    knees tuck, arms lift a little; landing dips the hips and bends the knees
 *   throw  the right arm winds up overhead (chest twisting back) and whips through
 *   sweep  one full spin with the head lowered and the arms out (Antler Sweep)
 */
function updateDeer(dt, follow) {
  const d = deer, B = d.bones;
  d.t += dt;
  d.root.position.copy(player.pos);
  if (follow) {
    let turn = yaw - d.facing;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn)); // shortest way around
    d.facing += turn * Math.min(1, dt * 12);
  }

  // ---- How we're moving ----
  const sp = playing ? Math.hypot(player.vel.x, player.vel.z) : 0;
  d.spd = damp(d.spd, sp, 8, dt);
  const walk = Math.min(1, d.spd / 5.5);                          // 0 standing → 1 walking
  const run = Math.max(0, Math.min(1, (d.spd - 6) / 4));          // 0 walking → 1 sprinting
  // direction of travel in the deer's own frame: mz = forward (+) / backward (−), mx = its left (+) / right (−)
  if (sp > 0.3) {
    const fx = -Math.sin(d.facing), fz = -Math.cos(d.facing);       // the way it faces, in the world
    const rx = Math.cos(d.facing), rz = -Math.sin(d.facing);        // its right, in the world
    d.mz = damp(d.mz, (player.vel.x * fx + player.vel.z * fz) / sp, 10, dt);
    d.mx = damp(d.mx, -(player.vel.x * rx + player.vel.z * rz) / sp, 10, dt);
  }
  const mz = d.mz, mx = d.mx;
  d.phase += d.spd * dt * (1.7 - 0.45 * run);                     // stride timing
  const air = playing && !player.onGround;
  if (!air && d.wasAir) d.land = Math.min(1, 0.4 + Math.abs(player.vy) * 0.05 + 0.4); // touching down
  d.wasAir = air;
  d.land = Math.max(0, d.land - dt * 3.5);
  d.airK = damp(d.airK, air ? 1 : 0, 10, dt);
  const idle = 1 - walk, A = d.airK, Ld = d.land * d.land;
  const t = reduceMotion ? 0 : d.t;

  // ---- Hips and spine ----
  const ph = d.phase, sn = Math.sin(ph), cs = Math.cos(ph);
  const bob = 0.028 * walk * Math.cos(2 * ph) + 0.015 * run * Math.cos(2 * ph);
  const fwd = Math.abs(mz); // how much of the movement is forward/backward (hip twist and arm swing go with that)
  // (in idle the hips stay still so the feet stay planted; the weight shift happens in the spine)
  B.pelvis.position.y = damp(B.pelvis.position.y, 1.0 - 0.025 * walk - 0.04 * run + bob - 0.09 * Ld - 0.05 * A, 18, dt);
  pose(B.pelvis, 0.03 * run, sn * (0.13 * walk + 0.05 * run) * fwd, cs * 0.05 * walk, 12, dt);
  pose(B.spine,
    (0.05 * walk + 0.14 * run) * mz + 0.12 * Ld + 0.06 * A,           // lean the way we're going (back a little when backing up)
    -sn * 0.06 * walk * fwd,
    -cs * 0.03 * walk - mx * 0.08 * walk + Math.sin(t * 0.9) * 0.03 * idle, // lean into side-steps; idle weight shift
    10, dt);

  // throw: k runs 0 → 1 over the throw; the chest twists back on the wind-up and through on the release
  d.throwT = Math.max(0, d.throwT - dt * 3.2);
  const thr = d.throwT > 0 ? Math.min(1, d.throwT * 5) : 0, k = 1 - d.throwT;
  const windup = k < 0.18 ? k / 0.18 : 1, release = k < 0.18 ? 0 : (k - 0.18) / 0.82;
  const twist = thr * (-0.35 * windup + 0.7 * Math.sin(release * Math.PI * 0.5)); // right shoulder back, then through
  pose(B.chest, Math.sin(t * 2.2) * 0.025 * idle + 0.03 * run, -sn * (0.16 * walk + 0.08 * run) + twist, 0, 12, dt);

  // ---- Head and neck: steady the gaze against the body's sway, look where the camera looks ----
  d.sweepT = Math.max(0, d.sweepT - dt * 3.5);
  const sweepDip = Math.sin(d.sweepT * Math.PI);
  pose(B.neck, -0.05 * run, sn * 0.08 * walk - twist * 0.5, 0, 10, dt);
  pose(B.head, -pitch * 0.45 + sweepDip * 0.7 - 0.06 * walk * Math.cos(2 * ph) * 0.4, Math.sin(t * 0.6) * 0.08 * idle, Math.sin(t * 0.7 + 1) * 0.05 * idle, 9, dt);

  // ---- Legs ----
  // Each leg swings along the direction of travel: forward/back is a rotation about x,
  // sideways is a rotation about z (a negative x angle brings the hoof forward; a positive
  // z angle brings it out to the deer's left).
  for (const [i, kk, s] of [[0, 'L', 1], [1, 'R', -1]]) {
    const p = ph + i * Math.PI, ls = Math.sin(p), lc = Math.cos(p);
    const w = ls * (0.48 * walk + 0.32 * run);                                       // how far along the step this leg is
    let thigh = -w * mz;
    let spread = s * 0.025 + w * mx * 0.8;
    spread = s > 0 ? Math.max(spread, -0.04) : Math.min(spread, 0.04);               // side-steps never cross the legs
    let knee = 0.06 + walk * (0.12 + Math.max(0, lc) * (0.75 + 0.55 * run)) + run * 0.15; // bend through each step
    // air: tuck the legs (one more than the other); landing: soak it up in the knees
    thigh = thigh * (1 - A) + A * (i ? -0.25 : -0.7) - Ld * 0.45;
    knee = knee * (1 - A) + A * (i ? 0.55 : 1.2) + Ld * 0.9;
    spread = spread * (1 - A) + A * s * 0.04;
    const foot = -(thigh + knee) * 0.75 + walk * Math.max(0, -lc) * 0.35 * Math.max(0, mz); // keep the hoof level, roll off the toe going forward
    pose(B['thigh' + kk], thigh, 0, spread, 16, dt);
    pose(B['shin' + kk], knee, 0, 0, 18, dt);
    pose(B['foot' + kk], foot, 0, -spread * 0.8, 18, dt);                          // keep the sole flat when stepping sideways
  }

  // ---- Arms ----
  const sweepOut = d.sweepT > 0 ? sweepDip : 0;
  for (const [i, kk, s] of [[0, 'L', 1], [1, 'R', -1]]) {
    const p = ph + i * Math.PI, ls = Math.sin(p);
    // arms swing opposite the legs going forward (reversed going backward, gentle when side-stepping).
    // In the air the swing stops: the arms simply lift out to the sides for balance, held still,
    // and settle back in as the deer lands (A eases 1 → 0).
    const ground = 1 - A;
    let arm = (ls * (0.42 * walk + 0.4 * run) * (mz + 0.25 * (1 - fwd)) + 0.08 * run) * ground + Math.sin(t * 2.2 + 1) * 0.02 * idle - 0.15 * A;
    let elbow = (-(0.22 + 0.25 * walk + 0.75 * run) - Math.max(0, -ls) * 0.3 * walk) * ground - 0.3 * A;
    let out = s * (0.1 + 0.05 * run * ground + 0.65 * A + 1.1 * sweepOut);
    let rate = 12;
    if (i === 1 && thr > 0) { // the throwing arm: up and back overhead, then whip through
      const armT = -3.4 + release * 2.8; // cocked up and back past vertical, then down and forward
      const elbowT = -1.4 * (1 - release) - 0.15;
      arm = arm * (1 - thr) + armT * thr; elbow = elbow * (1 - thr) + elbowT * thr; out = out * (1 - thr) + s * 0.2 * thr; rate = 30;
    }
    pose(B['arm' + kk], arm, 0, out, rate, dt);
    pose(B['fore' + kk], elbow, 0, 0, rate, dt);
    pose(B['hand' + kk], -0.15 - 0.2 * run, 0, 0, 10, dt);
  }

  // ---- Little touches: ear flicks, blinks, tail ----
  d.earT -= dt;
  if (d.earT <= 0) { d.earT = 2 + Math.random() * 4; d.earSide = Math.random() < 0.5 ? 0 : 1; d.earFlick = 1; }
  d.earFlick = Math.max(0, (d.earFlick || 0) - dt * 5);
  d.ears.forEach((e, i) => {
    const s = i ? 1 : -1, flick = i === d.earSide ? Math.sin(d.earFlick * Math.PI) * 0.5 : 0;
    // (earRest: how far the model's ears are already turned out, so only the difference is applied)
    e.rotation.z = damp(e.rotation.z, -s * (1.2 - 0.25 * run - flick) + s * (d.earRest || 0), 14, dt);
    e.rotation.x = damp(e.rotation.x, -0.3 * run - 0.2 * A, 10, dt);
  });
  d.blinkT -= dt;
  if (d.blinkT <= 0) d.blinkT = 2.5 + Math.random() * 3;
  const blink = d.blinkT < 0.12 ? 0.15 : 1;
  for (const e of d.eyes) e.scale.y = blink;
  d.tail.rotation.x = damp(d.tail.rotation.x, -0.4 - 0.5 * run + Math.sin(t * (2 + 8 * walk)) * (0.15 + 0.2 * walk), 12, dt);

  // ---- The whole body: facing, the sweep spin, falling over ----
  d.root.rotation.y = d.facing + Math.PI; // the model faces +z; yaw 0 means looking toward -z
  if (d.sweepT > 0) d.root.rotation.y += (1 - d.sweepT) * Math.PI * 2;
  if (dead) d.fall = Math.min(1, d.fall + dt * 2.2);
  d.root.rotation.x = -d.fall * d.fall * 1.45;

  // ---- Flash red when hurt ----
  if (d.flash > 0) {
    d.flash = Math.max(0, d.flash - dt * 4);
    for (const m of d.mats) m.emissive.setRGB(d.flash * 0.8, 0, 0);
  }
}

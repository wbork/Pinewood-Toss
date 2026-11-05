/* =========================================================================
   creatures.js — the creature types: their stats, their special abilities,
   and how each one moves. Their MODELS are made in Blender
   (blender/build_creatures.py → js/models/<id>.js) and loaded here.

   To add a new creature, add an entry to FOES with the same fields (and a
   model in build_creatures.py). The spawner (enemies.js) picks it up
   automatically once `unlock` seconds have passed.

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
     build(e)            loads its model (useModel) and adds any glows, saving parts in e.parts
     animate(e, dt, now) poses its bones each frame
     ai(e, dt, want, dist)  (optional) its special behavior, run every frame. `want` is the
                         velocity it's about to walk with (toward the deer); change it to steer,
                         set e.snap for an instant dash, e.warn (0–1) to glow as a warning.
                         dist = flat distance to the deer.
     ward    (optional) creatures near it take half damage (enemies.js → warded)
     onDeath(e, at)      (optional) something that happens when it's defeated

   Every creature faces +z (toward its target) with its feet at y = 0.
   Abilities use e.act / e.actT (current action and its timer) and e.cd (ability cooldown).

   HOW THEY MOVE
   Each model has a skeleton (e.b.<bone>) and its bones' rest positions (e.rest.<bone>).
   Animations never set a pose outright: they ease every bone toward a target (pose and damp
   from deer.js), so motion flows. The tricks that make it read well:
     - follow-through: parts further down a chain (forearms, tail tips, caps) ease more slowly,
       so they lag and swing after the part that drives them;
     - anticipation: big moves are wound up first (the imp crouches, the Mossback rears up);
     - eased states: e.<x>K values fade in and out (0–1) instead of switching instantly;
     - walk ↔ idle: e.mv (0 standing → 1 full speed, set by enemies.js from how fast it's really
       moving) scales the walk cycle down and an idle (breathing, looking around, twitching,
       chewing) up, so nothing walks in place. The title screen shows them all idling.
   ========================================================================= */

/** Flat unit vector from creature e toward the deer. */
const toDeer = e => new V3(player.pos.x - e.group.position.x, 0, player.pos.z - e.group.position.z).normalize();

/** Count an ability's cooldown down (starting it at `first` seconds the first time). Returns true when ready. */
function ready(e, dt, first) {
  if (e.cd === undefined) e.cd = first;
  e.cd -= dt;
  return e.cd <= 0;
}

/** Ease e[key] toward `on` (true → 1, false → 0) at `rate` per second; returns the eased value. */
const ease = (e, key, on, rate, dt) => (e[key] = damp(e[key] || 0, on ? 1 : 0, rate, dt));

// ---------- Models made in Blender ----------
const MODEL_CACHE = {};
/**
 * Give creature e the Blender model `id` (js/models/<id>.js): one skinned mesh and its bones,
 * added to e.group. Sets e.b (bones by name), e.rest (their rest positions), e.mats (this
 * creature's own copies of the materials, so it can flash on its own), e.flashMats (the ones
 * that flash red when hit: not the glowing eyes and embers), and e.parts.body (the root bone,
 * which enemies.js leans into attacks).
 */
function useModel(e, id) {
  const d = window.PINEWOOD_MODELS && PINEWOOD_MODELS[id];
  if (!d) throw new Error('Missing model js/models/' + id + '.js (build it with blender/build_creatures.py)');
  const c = MODEL_CACHE[id] || (MODEL_CACHE[id] = (() => {
    const geo = modelGeometry(d);
    geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.5; // room for animated limbs (frustum culling uses it)
    return { geo, mats: d.materials.map(m => modelMaterial(m, true)) };
  })());
  e.mats = c.mats.map(m => m.clone());
  e.flashMats = e.mats.filter((m, i) => !d.materials[i].emit);
  e.matByName = Object.fromEntries(d.materials.map((m, i) => [m.name, e.mats[i]]));
  const B = {}, rest = {}, list = [], at = {};
  for (const b of d.bones) {
    const bone = new THREE.Bone();
    const pp = b.parent ? at[b.parent] : [0, 0, 0];
    bone.position.set(b.pos[0] - pp[0], b.pos[1] - pp[1], b.pos[2] - pp[2]);
    (b.parent ? B[b.parent] : e.group).add(bone);
    B[b.name] = bone; rest[b.name] = bone.position.clone(); at[b.name] = b.pos; list.push(bone);
  }
  e.group.updateMatrixWorld(true);
  const sm = new THREE.SkinnedMesh(c.geo, e.mats);
  sm.castShadow = sm.receiveShadow = true;
  e.group.add(sm);
  sm.bind(new THREE.Skeleton(list));
  e.b = B; e.rest = rest; e.parts.body = B.body;
}

/** Ease a bone's position to its rest position plus (dx, dy, dz). */
function nudge(e, name, dx, dy, dz, rate, dt) {
  const b = e.b[name], r = e.rest[name];
  b.position.set(damp(b.position.x, r.x + dx, rate, dt), damp(b.position.y, r.y + dy, rate, dt), damp(b.position.z, r.z + dz, rate, dt));
}

// The Hollow stump's ward ring (shared by every stump).
const wardGeo = new THREE.RingGeometry(4.8, 5, 48).rotateX(-Math.PI / 2);
const wardMat = new THREE.MeshBasicMaterial({ color: 0x8fd06a, transparent: true, opacity: 0.35, depthWrite: false });

const FOES = {
  // Small and common: a gaunt, hunched bramble ghoul with a starved, ribby torso, a long
  // skull-like head with four sunken eyes and needle teeth, long dragging claws and
  // backward-bending legs. It skitters, its head twitching in sudden jerks.
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
    build(e) { useModel(e, 'imp'); },
    animate(e, dt, now) {
      const mv = e.mv || 0;
      e.phase += dt * e.speed * 3.0 * mv; // a quick, skittering stride
      const b = e.b, ph = e.phase, c = Math.cos(ph), t = now / 1000 + e.seed;
      const ck = ease(e, 'ck', e.act === 'crouch', 14, dt), lk = ease(e, 'lk', e.act === 'pounce', 16, dt);
      const walk = mv * (1 - Math.max(ck, lk)), idle = (1 - mv) * (1 - Math.max(ck, lk));
      // a low, skittering scuttle; crouching sinks to the ground, the leap stretches it out flat
      nudge(e, 'body', 0, Math.abs(c) * 0.05 * walk - ck * 0.2 + lk * 0.05 + idle * Math.sin(t * 2) * 0.01, 0, 18, dt);
      pose(e.b.body, -0.1 * ck + 0.15 * lk, 0, Math.sin(ph) * 0.06 * walk, 12, dt);
      // the hunched torso heaves as it breathes, rolls with the stride, lunges forward to leap
      pose(b.torso, 0.1 + idle * Math.sin(t * 2) * 0.05 + ck * 0.25 - lk * 0.35, Math.sin(ph) * 0.12 * walk, 0, 10, dt);
      // standing still, the head TWITCHES: every so often it picks a new tilt and snaps to it (a high
      // ease rate), the unsettling, jerky look of something not quite alive. On the move the twitch
      // fades out and the head stares straight ahead, turning against the torso's roll to stay level.
      if (!(e.twT > 0)) { e.twT = 0.25 + Math.random() * 1.1; e.twX = (Math.random() - 0.5) * 0.5; e.twY = (Math.random() - 0.5) * 1.0; e.twZ = (Math.random() - 0.5) * 0.8; }
      e.twT -= dt;
      const tw = idle;
      pose(b.head, e.twX * tw - lk * 0.3 + ck * 0.2, e.twY * tw - Math.sin(ph) * 0.12 * walk, e.twZ * tw, 24, dt);
      // the jaw clacks, and gapes wide as it crouches and leaps
      pose(b.jaw, 0.1 + Math.max(0, Math.sin(t * 9)) * 0.25 * (0.3 + idle) + ck * 0.5 + lk * 0.7 + e.lunge * 0.6, 0, 0, 25, dt);
      [['L', 0], ['R', Math.PI]].forEach(([k, off], i) => {
        const ls = Math.sin(ph + off), lc = Math.cos(ph + off), s = i ? -1 : 1;
        // backward-bending legs: thigh forward (−), shin back (+), the foot rolling under
        const thigh = -ls * 0.7 * walk - ck * 0.9 + lk * 0.9;
        const shin = Math.max(0, lc) * 0.9 * walk + ck * 1.3 + lk * 0.2;
        pose(b['leg' + k], thigh, 0, 0, 16, dt);
        pose(b['shin' + k], shin, 0, 0, 16, dt);
        pose(b['foot' + k], -(thigh + shin) * 0.7, 0, 0, 16, dt);
        // long arms reaching forward in turn as it scuttles (claws nearly dragging), flung forward
        // to rake or leap; idle they hang and the claws twitch. The forearms trail the arms.
        pose(b['arm' + k], ls * 0.7 * walk - e.lunge * 1.4 - lk * 1.6 + ck * 0.3 + idle * Math.sin(t * 1.3 + i * 2) * 0.1, 0, s * (0.05 + lk * 0.3), 12, dt);
        pose(b['fore' + k], -0.2 - e.lunge * 0.7 - lk * 0.4 + Math.max(0, ls) * 0.3 * walk - idle * Math.max(0, Math.sin(t * 4 + i * 1.7)) * 0.3, 0, 0, 7, dt);
      });
      pose(b.tail, lk * 0.5 - ck * 0.3 + Math.sin(t * 2) * 0.1, Math.sin(ph * 0.5) * 0.4 * walk + Math.sin(t * 3) * 0.4 * idle, 0, 8, dt);   // the thorny whip
    },
  },

  // Fast and floating: a wraith. A pale skull deep in a tattered hood (its jaw drops as it
  // charges a bolt), bony clawed arms, a shroud that frays into strips and wisps, and soul
  // crystals orbiting it. Drifts over obstacles.
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
      useModel(e, 'wisp');
      const halo = new THREE.Sprite(glow(0x9a6cff)); halo.scale.setScalar(1.7); e.b.body.add(halo);
    },
    animate(e, dt, now) {
      const b = e.b, t = now / 1000 + e.seed;
      // bob and weave, rolling into the weave
      nudge(e, 'body', Math.sin(t * 1.9) * 0.25, Math.sin(t * 3.3) * 0.15, 0, 6, dt);
      pose(b.body, Math.sin(t * 1.3) * 0.08, 0, -Math.cos(t * 1.9) * 0.15, 5, dt);
      // the tail: a wave travelling down its three segments, each a beat behind the last
      const w = (lag, amp) => Math.sin(t * 4 - lag) * amp;
      pose(b.tail1, 0.25 + w(0, 0.15), 0, w(0.3, 0.2), 10, dt);
      pose(b.tail2, 0.2 + w(0.9, 0.25), 0, w(1.2, 0.3), 10, dt);
      pose(b.tail3, 0.15 + w(1.8, 0.35), 0, w(2.1, 0.4), 10, dt);
      b.orbit.rotation.y += dt * 1.8;
      // the jaw drops open as a bolt charges, and snaps shut when it fires; the bony arms reach
      // out at you as it charges, and otherwise drift and curl their claws
      const charging = e.cd !== undefined && e.cd < 0.5;
      const reach = ease(e, 'rch', charging, 6, dt);
      pose(b.armL, 0.35 - reach * 0.75 + w(0.6, 0.15), 0, -0.15 + reach * 0.25 + w(1.0, 0.1), 7, dt);
      pose(b.armR, 0.35 - reach * 0.75 + w(1.4, 0.15), 0, 0.15 - reach * 0.25 + w(1.8, 0.1), 7, dt);
      pose(b.jaw, charging ? 0.7 : 0.05 + Math.max(0, Math.sin(t * 2)) * 0.05, 0, 0, charging ? 8 : 25, dt);
    },
  },

  // Slow and tough: a rotting stump split by a tall maw of splinter teeth (its jaw drops to
  // bite), five mismatched ember eyes that blink one at a time, dead moss in strands, shelf
  // fungus, and long root-tendril arms with many twig fingers.
  stump: {
    label: 'Hollow stump', hp: 9, dmg: 12, speed: 2.0, xp: 3, coin: 3, r: 0.6, lo: 0.5, hi: 1.1, mass: 2.5, unlock: 180, weight: 3, chip: 0x6b4a32,
    ward: true,
    ability: 'Bark ward: every other creature within 5 m of it (the green ring) takes half damage. Kill stumps first.',
    build(e) {
      useModel(e, 'stump');
      // the ward's ring on the ground, 5 m across (WARD_R in enemies.js)
      const ward = new THREE.Mesh(wardGeo, wardMat); ward.position.y = 0.06; e.group.add(ward); e.parts.ward = ward;
    },
    animate(e, dt, now) {
      const mv = e.mv || 0, idle = 1 - mv, t = now / 1000 + e.seed;
      e.phase += dt * e.speed * 2.2 * mv;
      const b = e.b, s = Math.sin(e.phase) * mv, c = Math.cos(e.phase);
      // a heavy waddle: the trunk twists and rolls over each root foot. Idle: it creaks slowly from
      // side to side, its branches drooping and swaying.
      nudge(e, 'body', 0, Math.abs(c) * 0.035 * mv, 0, 14, dt);
      pose(b.body, idle * Math.sin(t * 0.8) * 0.03, s * 0.14 + idle * Math.sin(t * 0.5) * 0.18, s * 0.08 + idle * Math.sin(t * 0.7) * 0.04, 6, dt);
      pose(b.legL, s * 0.6, 0, 0, 14, dt); pose(b.legR, -s * 0.6, 0, 0, 14, dt);
      // branch arms swing, the twig hands drag behind; both lash forward on an attack
      pose(b.armL, -s * 0.35 - e.lunge * 1.2 + idle * Math.sin(t * 0.9) * 0.12, 0, Math.sin(e.phase * 0.5) * 0.06 * mv - idle * 0.08, 8, dt);
      pose(b.armR, s * 0.35 - e.lunge * 1.2 + idle * Math.sin(t * 0.9 + 2) * 0.12, 0, -Math.sin(e.phase * 0.5) * 0.06 * mv + idle * 0.08, 8, dt);
      pose(b.handL, -0.2 - e.lunge * 0.6 + Math.sin(e.phase - 1) * 0.2 * mv + idle * Math.sin(t * 1.3 - 1) * 0.2, 0, 0, 5, dt);
      pose(b.handR, -0.2 - e.lunge * 0.6 - Math.sin(e.phase - 1) * 0.2 * mv + idle * Math.sin(t * 1.3 + 1) * 0.2, 0, 0, 5, dt);
      // the maw's lower jaw gnashes, and drops wide to bite
      pose(b.jaw, 0.08 + e.lunge * 0.7 + Math.max(0, Math.sin(now / 170 + e.seed)) * 0.12, 0, 0, 18, dt);
      // five eyes, each on its own bone with its own timer: they blink one at a time, out of step,
      // and flicker like embers
      if (!e.blT) e.blT = [0, 1, 2, 3, 4].map(() => 0.5 + Math.random() * 4);
      for (let i = 0; i < 5; i++) {
        const eye = b['eye' + i];
        if ((e.blT[i] -= dt) <= 0) e.blT[i] = 1.2 + Math.random() * 4;
        const shut = e.blT[i] < 0.13;
        eye.scale.setScalar(damp(eye.scale.x, shut ? 0.15 : 0.92 + Math.sin(now / 40 + e.seed + i * 1.7) * 0.08, 30, dt));
      }
      e.parts.ward.rotation.y += dt * 0.4; // the ward ring slowly turns
    },
  },

  // Rare and huge: a boulder beast the cult chained and branded. Lava glows through its cracks,
  // rusted chains wrap its body, broken shackles hang from its wrists, and the Hollow King's
  // sigil is burned glowing into its brow above a tusked maw.
  mossback: {
    label: 'Mossback', hp: 32, dmg: 22, speed: 1.6, xp: 10, coin: 12, r: 1.05, lo: 0.7, hi: 1.4, mass: 8, unlock: 300, weight: 1, chip: 0x5f6157,
    ability: 'Charge: rears up and pounds the ground for a second, then charges in a straight line for heavy damage. Sidestep it.',
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
    build(e) { useModel(e, 'mossback'); },
    animate(e, dt, now) {
      const mv = e.mv || 0, t = now / 1000 + e.seed;
      e.phase += dt * e.speed * 1.6 * mv;
      const b = e.b, s = Math.sin(e.phase), c = Math.cos(e.phase);
      const wk = ease(e, 'wk', e.act === 'windup', 7, dt), ck = ease(e, 'chk', e.act === 'charge', 6, dt), dz = ease(e, 'dz', e.act === 'daze', 5, dt);
      const walk = mv * (1 - Math.max(wk, ck)), idle = (1 - mv) * (1 - Math.max(wk, ck, dz));
      // knuckle-walk: the body rocks over each arm; winding up it rears back, charging it drops its
      // head. Idle: slow heavy breaths that lift its back, and a look around.
      const breath = Math.sin(t * 1.2);
      nudge(e, 'body', 0, Math.abs(s) * 0.08 * walk + wk * 0.25 + idle * breath * 0.04, 0, 10, dt);
      pose(b.body, -wk * 0.35 + ck * 0.22 - idle * breath * 0.03, s * 0.08 * walk + idle * Math.sin(t * 0.35) * 0.15, c * 0.06 * walk, 7, dt);
      const pound = wk * Math.sin(now / 90);   // pounding the ground in turn while it winds up
      pose(b.armL, s * 0.55 * walk - e.lunge - wk * (0.9 + pound * 0.7) + ck * 0.5, 0, 0.1 * wk, 8, dt);
      pose(b.armR, -s * 0.55 * walk - e.lunge - wk * (0.9 - pound * 0.7) + ck * 0.5, 0, -0.1 * wk, 8, dt);
      pose(b.foreL, -0.15 - wk * 0.5 + Math.max(0, s) * 0.3 * walk, 0, 0, 6, dt);
      pose(b.foreR, -0.15 - wk * 0.5 + Math.max(0, -s) * 0.3 * walk, 0, 0, 6, dt);
      pose(b.legL, -s * 0.3 * walk, 0, 0, 10, dt); pose(b.legR, s * 0.3 * walk, 0, 0, 10, dt);
      // the head bobs, roars (jaw wide) while winding up, ducks to charge, wobbles when dazed;
      // idle it swings slowly to look about and huffs (the jaw drops on each out-breath)
      pose(b.head, ck * 0.35 - wk * 0.25 + Math.sin(e.phase * 2) * 0.04 * walk + idle * breath * 0.04,
        dz * Math.sin(now / 160) * 0.25 + idle * Math.sin(t * 0.45) * 0.4, dz * Math.sin(now / 120) * 0.2, 6, dt);
      pose(b.jaw, wk * 0.55 + ck * 0.3 + e.lunge * 0.4 + idle * Math.max(0, -breath) * 0.18, 0, 0, 12, dt);
    },
  },

  // Bloated and slow: a sickly walking mushroom: a lumpy stem split by a round lamprey mouth of
  // teeth, mismatched glowing eyes, a drooping veined cap with glowing spore sacs and dangling
  // tendrils, spindly grasping arms. Pops into a poison cloud.
  puffer: {
    label: 'Spore puffer', hp: 6, dmg: 4, speed: 2.2, xp: 3, coin: 3, r: 0.55, lo: 0.3, hi: 1.45, mass: 1.5, unlock: 120, weight: 2, chip: 0x8a4ab0,
    ability: 'Toxic burst: swells up and pops when it reaches you, and when it dies, leaving a poison cloud. Kill it from range.',
    build(e) {
      useModel(e, 'puffer');
      const spores = new THREE.Group(); spores.position.y = 0.85; e.b.cap.add(spores); e.parts.spores = spores; // glowing spores above the cap
      for (let k = 0; k < 3; k++) { const sp = new THREE.Sprite(glow(0xb8ff5a)); sp.scale.setScalar(0.22); sp.position.set(Math.cos(k * 2.1) * 0.35, k * 0.1, Math.sin(k * 2.1) * 0.35); spores.add(sp); }
    },
    ai(e, dt, want, dist) {
      if (e.act === 'swell') {            // 1 s swelling (and glowing): run!
        want.set(0, 0, 0); e.snap = true; e.warn = 1;
        if ((e.actT -= dt) <= 0) { e.hp = 0; killFoe(e, centerOf(e, new V3())); } // pops itself (onDeath makes the cloud)
      } else if (dist < 2.6) { e.act = 'swell'; e.actT = 1.0; sfx.swell(); }
    },
    onDeath(e, at) { poisonCloud(e.group.position, 3.2, 5, e.dmg * 1.5); splash(0.25); },
    animate(e, dt, now) {
      const mv = e.mv || 0, t = now / 1000 + e.seed;
      e.phase += dt * e.speed * 3 * mv;
      const sw = ease(e, 'sw', e.act === 'swell', 6, dt), idle = (1 - mv) * (1 - sw);
      const b = e.b, s = Math.sin(e.phase) * mv + idle * Math.sin(t * 1.6) * 0.35;   // idle: a gentle sway from foot to foot
      nudge(e, 'body', 0, Math.abs(Math.cos(e.phase)) * 0.05 * (1 - sw) * mv + idle * Math.abs(Math.sin(t * 1.6)) * 0.02, 0, 14, dt);
      pose(b.body, 0, 0, s * 0.12 * (1 - sw) + sw * Math.sin(now / 35) * 0.06, 10, dt);   // waddle; shivers while swelling
      // the heavy cap lags behind the body's rolling (a jiggle), and balloons before it pops
      pose(b.cap, 0, 0, -s * 0.1 * (1 - sw), 4, dt);
      const swell = e.act === 'swell' ? 1 + (1 - e.actT) * 0.6 : 1 + Math.sin(e.phase * 0.5) * 0.04;
      b.cap.scale.setScalar(swell);
      pose(b.legL, s * 0.6 * (1 - sw) * mv, 0, 0, 14, dt); pose(b.legR, -s * 0.6 * (1 - sw) * mv, 0, 0, 14, dt);
      // arms swing as it walks, flail in a panic as it swells; idle, one gives a little wave now and then
      const wave = idle * Math.max(0, Math.sin(t * 0.7)) * (0.9 + Math.sin(t * 7) * 0.3);
      pose(b.armL, -s * 0.4 - sw * (1.2 + Math.sin(now / 60) * 0.4) - wave, 0, sw * 0.5 + wave * 0.6, 9, dt);
      pose(b.armR, s * 0.4 - sw * (1.2 + Math.cos(now / 60) * 0.4), 0, -sw * 0.5, 9, dt);
      // the lamprey mouth on its stem pulses open, and gapes as it swells
      b.mouth.scale.setScalar(damp(b.mouth.scale.x, 1 + Math.max(0, Math.sin(t * 2.5)) * 0.18 + sw * 0.6, 12, dt));
      e.parts.spores.rotation.y += dt * 0.8;
      e.parts.spores.position.y = 0.85 + Math.sin(now / 400 + e.seed) * 0.08;
    },
  },

  // A starved shadow wolf: spine and ribs showing, six eyes, a long jaw of teeth, ragged ears
  // and a tail that frays into smoke. Nearly invisible until it's close; circles to strike from behind.
  stalker: {
    label: 'Shade stalker', hp: 7, dmg: 10, speed: 4.4, xp: 4, coin: 4, r: 0.45, lo: 0.3, hi: 0.95, mass: 1.2, unlock: 240, weight: 2, chip: 0x1c2430,
    ability: 'Ambush: almost invisible from afar, it circles around and attacks from behind. Watch your back.',
    build(e) {
      useModel(e, 'stalker');
      for (const m of e.mats) { m.transparent = true; m.opacity = 0.15; } // it fades in as it gets close (ai)
    },
    ai(e, dt, want, dist) {
      e.near = dist < 4.5;
      if (!e.near) {
        // head for a point 3 m behind the deer (behind = the way the camera looks from)
        const tx = player.pos.x + Math.sin(yaw) * 3, tz = player.pos.z + Math.cos(yaw) * 3;
        const d = new V3(tx - e.group.position.x, 0, tz - e.group.position.z).normalize().multiplyScalar(e.speed);
        want.set(d.x, 0, d.z);
      }
      // fade in from a faint shimmer (far) to solid (close); its eyes always show a little
      const k = 1 - smooth(4, 10, dist);
      for (const m of e.mats) m.opacity = (m === e.matByName.eyeCyan ? 0.35 + 0.65 * k : 0.12 + 0.88 * k);
    },
    animate(e, dt, now) {
      const mv = e.mv || 0, idle = 1 - mv, t = now / 1000 + e.seed;
      e.phase += dt * e.speed * 2.4 * mv;
      const b = e.b, ph = e.phase;
      const prowl = ease(e, 'pk', !e.near, 4, dt);   // slinks low while circling
      // a galloping gait: each leg a quarter step behind the next; the spine flexes with the stride.
      // Idle: a low crouch, its sides heaving with each breath.
      nudge(e, 'body', 0, Math.abs(Math.cos(ph)) * 0.05 * mv - prowl * 0.08 + idle * Math.sin(t * 2.6) * 0.012, 0, 14, dt);
      pose(b.body, Math.sin(ph * 2) * 0.07 * mv, 0, 0, 12, dt);
      [['FL', 0, 1], ['FR', 0.5, 1], ['BL', 1.6, -1], ['BR', 2.1, -1]].forEach(([k, off, front]) => {
        const ls = Math.sin(ph + off) * mv, lc = Math.cos(ph + off);
        pose(b['leg' + k], -ls * 0.7, 0, 0, 16, dt);
        pose(b['knee' + k], front * Math.max(0, lc) * 0.9 * mv + (front < 0 ? -0.2 : 0), 0, 0, 16, dt);   // front knees fold back, hind hocks forward
      });
      // the neck keeps the head steady against the body's pitch; the jaw snarls when close.
      // Idle: it sniffs the air in short bursts and turns its head to watch.
      const sniff = idle * Math.max(0, Math.sin(t * 0.9)) * Math.sin(t * 14) * 0.05;
      pose(b.neck, -Math.sin(ph * 2) * 0.07 * mv + prowl * 0.15 - idle * 0.1, idle * Math.sin(t * 0.5) * 0.4, 0, 8, dt);
      pose(b.head, -prowl * 0.1 + sniff, idle * Math.sin(t * 0.5 + 0.6) * 0.25, idle * Math.sin(t * 0.3) * 0.1, 8, dt);
      pose(b.jaw, e.near ? 0.45 + e.lunge * 0.3 : 0.05 + idle * Math.max(0, Math.sin(t * 0.6 + 1)) * 0.25, 0, 0, 14, dt);
      pose(b.tail1, -0.3 + Math.sin(ph) * 0.12 * mv - idle * 0.2, Math.sin(ph * 0.5) * 0.2 * mv + idle * Math.sin(t * 1.4) * 0.35, 0, 10, dt);   // the tail streams out behind, or swishes
      pose(b.tail2, -0.1 + Math.sin(ph - 0.8) * 0.2 * mv, Math.sin(ph * 0.5 - 0.8) * 0.3 * mv + idle * Math.sin(t * 1.4 - 0.8) * 0.45, 0, 7, dt);
    },
  },

  // A cultist priest of the Hollow King: a crimson robe stitched with gold sigils, an antlered
  // deer-skull mask with ember eyes, bone charms, and a staff crowned with an antlered skull that
  // holds the glowing sap crystal in its jaws. Stays back and hardens its allies in sap.
  shaman: {
    label: 'Sap shaman', hp: 10, dmg: 6, speed: 2.6, xp: 6, coin: 6, r: 0.45, lo: 0.3, hi: 1.5, mass: 1.5, unlock: 360, weight: 1, chip: 0x3d4a22,
    ability: 'Sap shields: hangs back and coats nearby creatures in hardened sap that soaks up damage (half their health) until it breaks. Hunt it down first.',
    build(e) {
      useModel(e, 'shaman');
      const orb = new THREE.Sprite(glow(0xffb43a)); orb.position.set(0, 0.64, 0.16); orb.scale.setScalar(0.4); e.b.staff.add(orb); e.parts.orb = orb;   // on the crystal in the skull's jaws
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
      const b = e.b, t = now / 1000 + e.seed;
      const cast = ease(e, 'cast', e.cd !== undefined && e.cd < 0.6, 6, dt);
      // a shuffling hover; the ragged hem swings a beat behind; the body hunches and sways
      nudge(e, 'body', 0, Math.sin(t * 2.4) * 0.03, 0, 8, dt);
      pose(b.body, 0, 0, Math.sin(t * 2) * 0.05, 6, dt);
      pose(b.hem, 0, Math.sin(t * 2 - 0.8) * 0.12, Math.sin(t * 2 - 0.8) * 0.06, 4, dt);
      pose(b.torso, 0.15 - cast * 0.3, 0, Math.sin(t * 1.3) * 0.06, 6, dt);
      pose(b.head, Math.sin(t * 0.9) * 0.08 - cast * 0.2, Math.sin(t * 0.7) * 0.25, 0, 5, dt);
      // casting: the staff lifts high and the free hand draws a circle
      pose(b.armR, -0.1 - cast * 1.3 + Math.sin(t * 1.6) * 0.06, 0, -cast * 0.3, 7, dt);
      pose(b.staff, cast * 0.4 + Math.sin(t * 1.6) * 0.05, 0, Math.sin(t * 1.1) * 0.08, 6, dt);
      pose(b.armL, -0.3 - cast * (0.8 + Math.sin(t * 9) * 0.3), 0, cast * Math.cos(t * 9) * 0.4, 8, dt);
      e.parts.orb.scale.setScalar(0.4 + cast * 0.6 + Math.sin(now / 150) * 0.06); // flares before shielding
    },
  },
};

// [id, definition] pairs, handy for weighted random picks.
const FOE_LIST = Object.entries(FOES);

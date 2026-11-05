/* =========================================================================
   bosses.js — the two boss fights, their health bar, the arrival banner,
   and the endless "score" phase that begins once both are beaten.

   BOSS_SCHEDULE says when each boss climbs out of the ground:
     5:00  The Thorn Queen — a towering queen woven from brambles in a gown of
           thorns and roses. Thorn rings and aimed volleys, thorn lashes that race
           along the ground, bramble cages, broods of imps, slams where you stand,
           and she blinks to your side if you run.
     10:00 The Hollow King — a king made of bones: ribs, long bones and the skulls
           of lesser beasts fused around a beating core, with a stag's skull for a face
           under a gold crown and great antlers, gold chains and a royal cape.
           Much tougher. Roots under you and roots that chase you, stomps you must
           jump, ember barrages, stalker packs, and a crushing leap onto your spot.

   WHAT MAKES THEM DANGEROUS (more threat, not more health)
     - Aimed attacks LEAD you: they fire where you're heading, not where you are.
     - They don't let you kite forever: they chase harder when you're far, and close
       the gap (the Queen blinks, the King leaps) if you run too far.
     - Short gaps between attacks; enraged (below half health) they also chain a
       second attack straight after the first (a combo).
     - Every attack is telegraphed (a glow, red circles, a wind-up), so it's fair:
       you dodge by reading it, not by luck.
   The first time a boss drops below half health it ROARS (immune for ROAR_T).
   Each one drops a free legendary chest, a heart and a magnet when defeated.

   ENDLESS: when the Hollow King falls, the forest rages. From then on you
   score points for every kill and every second survived (both worth more the
   longer you last), and creatures pour in faster and faster until you die.
   The best-times board (besttimes.js) records time and score.

   Bosses are ordinary creatures (enemies.js runs them) with `boss: true`,
   so they're added to FOES here but never picked by the random spawner.
   Their models are made in Blender (blender/build_creatures.py); their
   attacks use the hazards in hazards.js.
   ========================================================================= */

const BOSS_SCHEDULE = [{ at: 300, id: 'thornqueen' }, { at: 600, id: 'hollowking' }];
let boss = null;     // the boss currently alive, if any
let bossNext = 0;    // index into BOSS_SCHEDULE of the next boss to appear

/** Pick a boss's next attack: cycle through `moves` in a shuffled order, never the same twice running. */
function nextMove(e, moves) {
  if (!e.queue || !e.queue.length) e.queue = shuffle(moves.slice());
  if (e.queue[0] === e.lastMove && e.queue.length > 1) e.queue.push(e.queue.shift());
  return (e.lastMove = e.queue.shift());
}

/** Where the deer will be in `t` seconds if it keeps moving the same way (flat). */
const lead = t => new V3(player.pos.x + player.vel.x * t, 0, player.pos.z + player.vel.z * t);

/**
 * Shared boss brain: walk toward the deer (faster when it's far: no endless kiting), and every
 * few seconds stop to wind up (glowing) and then perform the next move. If the deer gets more
 * than `far` meters away, the next move is the boss's gap closer instead. Enraged (below half
 * health) it attacks 35% sooner and may chain a second move right after the first.
 */
function bossAI(e, dt, want, moves, every, closer, far) {
  const rage = e.hp < e.maxHp * 0.5, dist = Math.hypot(player.pos.x - e.group.position.x, player.pos.z - e.group.position.z);
  // The first time it drops below half health it ROARS: it stops, rears up and bellows for
  // ROAR_T seconds, immune to all damage (so the roar isn't free hits), then fights enraged.
  if (rage && !e.enraged) { e.enraged = true; e.act = 'roar'; e.actT = ROAR_T; e.immune = true; bossRoar(e); }
  if (e.act === 'roar') {
    want.set(0, 0, 0); e.snap = true; e.warn = 1;
    if ((e.actT -= dt) <= 0) { e.act = null; e.immune = false; e.cd = 0.8; }
    return;
  }
  if (e.act === 'cast') {
    want.multiplyScalar(0.15); e.warn = 0.9;
    if ((e.actT -= dt) <= 0) {
      e.act = null; e.def.moves[e.move](e, rage);
      if (rage && e.move !== closer && !e.comboed && Math.random() < 0.45) {  // a combo: straight into another move
        e.comboed = true; e.move = nextMove(e, moves); e.act = 'cast'; e.actT = 0.45;
      } else e.comboed = false;
    }
    return;
  }
  if (dist > 10) want.multiplyScalar(1.6);   // closing in
  if (ready(e, dt, 2.0)) {
    e.cd = every * (rage ? 0.65 : 1);
    e.move = dist > far ? closer : nextMove(e, moves);
    e.act = 'cast'; e.actT = 0.7;
  }
}

const ROAR_T = 2.2; // seconds a boss roars (and is immune) when it becomes enraged

/** The enrage roar: a bellow, a shaking camera, shock rings rolling out, and the banner. */
function bossRoar(e) {
  sfx.bossRoar();
  shake = 0.9;
  banner('Enraged', e.def.label + ' roars', 'boss');
  const at = e.group.position.clone().add(P.set(0, 0.2, 0));
  for (let k = 0; k < 4; k++) later.push({ t: k * 0.35, fn: () => { ring(at, 6 + k * 4, 0xff5a3a); burst(at.clone().add(P.set(0, 2, 0)), e.def.chip, 10); } });
}

/** A ring of `n` bolts flying outward from the boss, rotated by `turn` (radians). */
function boltRing(e, n, speed, dmg, color, turn = 0) {
  const c = e.group.position.clone().add(P.set(0, e.def.hi * 0.55, 0));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + turn;
    fireBolt(c, c.clone().add(P.set(Math.cos(a), -0.08, Math.sin(a))), speed, dmg, color);
  }
  sfx.bolt();
}

/** A fan of `n` bolts from `from` aimed where the deer is heading (spread in radians between bolts). */
function aimedFan(from, n, spread, speed, dmg, color) {
  const tgt = lead(from.distanceTo(player.pos) / speed); tgt.y = player.pos.y + 1.1;
  const dir = tgt.sub(from);
  for (let i = 0; i < n; i++) fireBolt(from, dir.clone().applyAxisAngle(UP, (i - (n - 1) / 2) * spread).add(from), speed, dmg, color);
  sfx.bolt();
}

/** Spawn `n` creatures of type `id` in a circle of radius r around the boss. */
function summon(e, id, n, r) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random();
    spawnFoe(id, e.group.position.x + Math.cos(a) * r, e.group.position.z + Math.sin(a) * r);
  }
}

/** The deer's position, `jitter` m off in a random direction. */
const nearDeer = jitter => { const a = Math.random() * 6.28, d = Math.random() * jitter; return new V3(player.pos.x + Math.cos(a) * d, 0, player.pos.z + Math.sin(a) * d); };

/** A boss is defeated: celebration and rewards. The last one starts the endless phase. */
function bossDefeated(e, at) {
  for (let k = 0; k < 3; k++) later.push({ t: k * 0.15, fn: () => { burst(at, e.def.chip, 20); ring(at, 3 + k * 3, 0xffcf5a); } });
  sfx.bossDown();
  dropItem('heart', at.clone().add(P.set(1.2, 0, 0)));
  dropItem('magnet', at.clone().add(P.set(-1.2, 0, 0)));
  spawnChest({ x: e.group.position.x, z: e.group.position.z, rarity: 'legendary', free: true });
  boss = null;
  $('bossbar').hidden = true;
  if (bossNext >= BOSS_SCHEDULE.length) startEndless();
  else banner('Boss defeated', e.def.label + ' has fallen', 'win');
}

/** Ease e.roarK toward 1 while the boss roars and back to 0 after: drives the roar pose. */
const roarWeight = (e, dt) => ease(e, 'roarK', e.act === 'roar', 6, dt);

/** Add a glowing sprite to a bone. */
const glowOn = (bone, color, size, x = 0, y = 0, z = 0) => { const s = new THREE.Sprite(glow(color)); s.scale.setScalar(size); s.position.set(x, y, z); bone.add(s); return s; };

// ---------- The Thorn Queen ----------

FOES.thornqueen = {
  label: 'The Thorn Queen', boss: true, hp: 450, dmg: 12, speed: 2.6, xp: 120, coin: 120, r: 1.8, lo: 0.8, hi: 5.4, mass: 40, chip: 0x3b2436,
  ability: 'Thorn rings and aimed volleys, racing thorn lashes, bramble cages, broods of imps, slams where you stand, and she blinks to you if you run.',
  build(e) {
    useModel(e, 'thornqueen');
    const b = e.b;
    e.parts.gem = glowOn(b.head, 0xff4a8a, 0.9, 0, 0.68, 0.28);                       // the rose in her crown
    e.parts.eyeGlow = [-0.12, 0.12].map(x => glowOn(b.head, 0xffb43a, 0.3, x, 0.26, 0.31));
    glowOn(b.chest, 0xff4a8a, 0.6, 0, 0.82, 0.72);                                     // the rose brooch
    e.parts.halo = glowOn(b.body, 0xb04aff, 7, 0, 4, 0); e.parts.halo.material.opacity = 0.3;
  },
  moves: {
    // rings of thorn bolts (each turned to cover the last ring's gaps), plus a fan aimed where you're going
    volley(e, rage) {
      for (let k = 0; k < (rage ? 3 : 2); k++) later.push({ t: k * 0.5, fn: () => { if (e.state === 'alive') boltRing(e, 18, 9, e.dmg * 0.6, 0xb06a3a, k * Math.PI / 18); } });
      later.push({ t: 0.25, fn: () => { if (e.state === 'alive') aimedFan(e.group.position.clone().add(P.set(0, 4.4, 0)), rage ? 7 : 5, 0.09, 14, e.dmg * 0.6, 0xff4a8a); } });
    },
    // a brood of imps
    brood(e, rage) { summon(e, 'imp', rage ? 6 : 4, 3.5); sfx.roar(); },
    // slams: a circle where you're standing (and where you're heading) plus a few nearby
    slam(e, rage) {
      markGround(player.pos, 3.2, 1.1, e.dmg);
      markGround(lead(1.1), 2.6, 1.25, e.dmg);
      for (let k = 0; k < (rage ? 5 : 3); k++) markGround(nearDeer(7), 2.6, 1.2 + Math.random() * 0.4, e.dmg);
    },
    // a thorn lash: eruptions race along the ground from her toward where you're heading. Sidestep!
    lash(e, rage) {
      e.lunge = 1;
      const from = e.group.position, to = lead(0.9), dir = new V3(to.x - from.x, 0, to.z - from.z).normalize();
      const lines = rage ? [-0.35, 0, 0.35] : [0];
      for (const a of lines) {
        const d = dir.clone().applyAxisAngle(UP, a);
        for (let i = 1; i <= 11; i++) markGround(new V3(from.x + d.x * i * 1.5, 0, from.z + d.z * i * 1.5), 1.25, 0.45 + i * 0.07, e.dmg);
      }
    },
    // a bramble cage: thorns ring you with a single gap (the side away from her), then the middle erupts
    cage(e, rage) {
      const c = player.pos.clone(), away = Math.atan2(c.z - e.group.position.z, c.x - e.group.position.x), n = 12;
      for (let i = 0; i < n; i++) {
        const a = away + (i / n) * Math.PI * 2;
        if (i === 0 || (!rage && i === 1)) continue;   // the way out (narrower when she's enraged)
        markGround(new V3(c.x + Math.cos(a) * 4.6, 0, c.z + Math.sin(a) * 4.6), 1.35, 1.0, e.dmg);
      }
      markGround(c, 3.4, 1.9, e.dmg * 1.3);
    },
    // gap closer: she bursts into petals and reappears beside you, slamming the ground as she lands
    blink(e) {
      const at = e.group.position.clone();
      burst(at.clone().add(P.set(0, 3, 0)), 0xc0283c, 24); ring(at, 4, 0xff4a8a);
      const a = Math.random() * 6.28, x = player.pos.x + Math.cos(a) * 6, z = player.pos.z + Math.sin(a) * 6;
      if (Math.hypot(x, z) < ARENA_R - 4) { e.group.position.set(x, h(x, z), z); e.vel.set(0, 0, 0); }
      burst(e.group.position.clone().add(P.set(0, 3, 0)), 0xc0283c, 24); ring(e.group.position, 4, 0xff4a8a);
      markGround(player.pos, 2.8, 0.9, e.dmg);
      sfx.bolt();
    },
  },
  ai(e, dt, want) { bossAI(e, dt, want, ['volley', 'brood', 'slam', 'lash', 'cage'], 3.4, 'blink', 16); },
  onDeath: bossDefeated,
  animate(e, dt, now) {
    e.phase += dt * 1.6;
    const b = e.b, t = now / 1000, k = roarWeight(e, dt), cast = ease(e, 'castK', e.act === 'cast', 7, dt), tremble = Math.sin(now / 28) * 0.03 * k;
    // a gliding float; she rises while roaring. Her gown and the petals around her slowly turn.
    nudge(e, 'body', 0, Math.sin(e.phase) * 0.12 + k * 0.35, 0, 6, dt);
    pose(b.body, Math.sin(e.phase * 0.6) * 0.025, 0, Math.sin(e.phase * 0.7) * 0.035 + tremble, 5, dt);
    b.gown.rotation.y += dt * (0.3 + k * 2.5);
    b.petals.rotation.y += dt * (0.25 + k * 3);
    nudge(e, 'petals', 0, Math.sin(e.phase * 0.6) * 0.2, 0, 4, dt);
    // the upper body breathes and sways; the head looks about, tilts down to cast, back to roar
    pose(b.chest, Math.sin(t * 1.1) * 0.035 - k * 0.12 + cast * 0.05, Math.sin(t * 0.6) * 0.12 * (1 - k), Math.sin(t * 0.8) * 0.03, 4, dt);
    pose(b.head, -0.55 * k + cast * 0.12 + Math.sin(t * 0.8) * 0.05 + tremble, Math.sin(e.phase * 0.5) * 0.22 * (1 - k), Math.sin(t * 0.5) * 0.05, 5, dt);
    b.mouth.scale.set(1, 1 + 4 * k, 1);
    e.parts.eyeGlow.forEach(g => g.scale.setScalar(0.3 + k * 0.5 + cast * 0.15));
    e.parts.gem.scale.setScalar(0.8 + Math.sin(now / 200) * 0.15 + cast * 0.6 + k * 1.2);
    b.collar.scale.setScalar(damp(b.collar.scale.x, 1 + 0.3 * k + cast * 0.08, 6, dt)); // the thorn fan flares
    pose(b.collar, -0.25 * k + Math.sin(t * 1.3) * 0.04, 0, 0, 5, dt);
    e.parts.halo.material.opacity = 0.3 + k * 0.35 + cast * 0.1;
    // arms: slow, flowing idle (the forearms trail the upper arms), lifted to cast, lashing on
    // attack, flung up and out while she roars
    ['L', 'R'].forEach((side, i) => {
      const s = i ? -1 : 1;
      pose(b['arm' + side], (-cast * 1.3 - e.lunge * 1.2 + Math.sin(t * 1.2 + i) * 0.12) * (1 - k) - 2.3 * k, Math.sin(t * 0.9 + i * 2) * 0.12, s * 0.4 * k, 4, dt);
      pose(b['fore' + side], -0.25 - cast * 0.5 + k * 0.35 + Math.sin(t * 1.5 + i) * 0.18, 0, s * Math.sin(t + i) * 0.1, 3, dt);
    });
  },
};

// ---------- The Hollow King ----------

FOES.hollowking = {
  label: 'The Hollow King', boss: true, hp: 1100, dmg: 16, speed: 2.2, xp: 300, coin: 300, r: 2.2, lo: 0.8, hi: 6.2, mass: 80, chip: 0x6a5a48,
  ability: 'Roots under you and roots that chase you, shockwaves to jump, ember barrages, stalker packs, and a crushing leap onto your spot.',
  build(e) {
    useModel(e, 'hollowking');
    const b = e.b;
    e.parts.flame = glowOn(b.heart, 0xff6a2a, 3.2);
    glowOn(b.heart, 0xffd080, 1.2);
    e.parts.eyes = [-0.27, 0.27].map(x => glowOn(b.head, 0xff5a2a, 0.3, x, 0.3, 0.75));   // embers deep in the eye sockets
    const emberMat = glow(0xff8a3a);
    e.parts.embers = [];
    for (let i = 0; i < 12; i++) {   // embers rising through the rib cage
      const sp = new THREE.Sprite(emberMat); sp.scale.setScalar(0.16);
      sp.userData = { a: i * 2.4, r: 0.25 + (i % 4) * 0.15, sp: 0.6 + (i % 3) * 0.3 };
      sp.position.y = 1.4 + (i / 12) * 2.6; b.body.add(sp); e.parts.embers.push(sp);
    }
  },
  moves: {
    // roots erupt under you and in a ring around you
    roots(e, rage) {
      markGround(player.pos, 3, 1.2, e.dmg);
      const n = rage ? 8 : 6;
      for (let k = 0; k < n; k++) { const a = (k / n) * 6.28; markGround(new V3(player.pos.x + Math.cos(a) * 4.5, 0, player.pos.z + Math.sin(a) * 4.5), 2.4, 1.2 + k * 0.06, e.dmg); }
    },
    // grasping roots: eruptions that keep landing where you're heading, one after another. Keep moving!
    grasp(e, rage) {
      for (let k = 0; k < (rage ? 8 : 6); k++) later.push({ t: k * 0.32, fn: () => { if (e.state === 'alive') markGround(lead(0.6), 2.0, 0.65, e.dmg); } });
    },
    // a stomp sends a shockwave across the ground: jump it (two when enraged)
    stomp(e, rage) {
      e.lunge = 1;
      shockwave(e.group.position, 11, 30, e.dmg * 0.8);
      if (rage) later.push({ t: 0.8, fn: () => { if (e.state === 'alive') shockwave(e.group.position, 13, 30, e.dmg * 0.8); } });
    },
    // fans of ember bolts from its heart, aimed where you're heading
    barrage(e, rage) {
      for (let k = 0; k < (rage ? 4 : 3); k++) later.push({ t: k * 0.35, fn: () => {
        if (e.state !== 'alive') return;
        aimedFan(e.group.position.clone().add(P.set(0, 3.8, 0)), 5, 0.12, 13, e.dmg * 0.5, 0xff7a3a);
      } });
    },
    // a pack of shade stalkers and a stump to shield them
    call(e, rage) { summon(e, 'stalker', rage ? 4 : 3, 4); summon(e, 'stump', 1, 3); sfx.roar(); },
    // gap closer: he marks your spot, rises, and crashes down on it with a shockwave
    leap(e, rage) {
      const spot = lead(0.5);
      markGround(spot, 3.6, 1.15, e.dmg * 1.4);
      e.leaping = 1.1;
      later.push({ t: 1.05, fn: () => {
        if (e.state !== 'alive') return;
        if (Math.hypot(spot.x, spot.z) < ARENA_R - 4) { e.group.position.set(spot.x, h(spot.x, spot.z), spot.z); e.vel.set(0, 0, 0); }
        shake = Math.max(shake, 0.6);
        shockwave(e.group.position, 12, rage ? 26 : 18, e.dmg * 0.7);
        burst(e.group.position.clone().add(P.set(0, 0.5, 0)), 0x6a5a48, 24);
      } });
    },
  },
  ai(e, dt, want) {
    if (e.leaping > 0) { e.leaping -= dt; want.set(0, 0, 0); e.snap = true; e.warn = 1; return; }   // airborne: rising for the crash
    bossAI(e, dt, want, ['roots', 'grasp', 'stomp', 'barrage', 'call'], 3.0, 'leap', 15);
  },
  onDeath: bossDefeated,
  animate(e, dt, now) {
    e.phase += dt * 1.2;
    const b = e.b, t = now / 1000, k = roarWeight(e, dt), cast = ease(e, 'castK', e.act === 'cast', 7, dt), tremble = Math.sin(now / 26) * 0.03 * k;
    const lp = ease(e, 'lpK', e.leaping > 0, 5, dt);
    // hovers, bobbing; rises while roaring, and high into the air before a leap
    nudge(e, 'body', 0, Math.sin(e.phase) * 0.15 + k * 0.4 + lp * 2.2, 0, 5, dt);
    pose(b.body, Math.sin(e.phase * 0.5) * 0.03 - lp * 0.2, 0, Math.sin(e.phase * 0.6) * 0.035 + tremble, 4, dt);
    pose(b.chest, Math.sin(t * 0.9) * 0.04 - k * 0.2 + cast * 0.08, Math.sin(t * 0.5) * 0.1 * (1 - k), 0, 4, dt);
    // the cape trails a beat behind and billows out while he roars
    pose(b.cape, -k * 0.35 - lp * 0.3 + Math.sin(t * 1.1 - 0.6) * 0.06, Math.sin(t * 0.8 - 0.6) * 0.08, 0, 3, dt);
    b.cape.scale.set(1 + k * 0.15, 1, 1 + k * 0.15);
    // the heart beats (flaring before an attack, blazing while roaring); its bone hoops spin
    const beat = 1 + Math.max(0, Math.sin(now / 160)) * 0.22 + cast * 0.4 + k * (0.6 + Math.sin(now / 60) * 0.15);
    b.heart.scale.setScalar(beat);
    b.heart.rotation.y += dt * (1.5 + k * 6);
    e.parts.flame.scale.setScalar(3.2 + k * 2.5 + cast);
    const spin = 1 + k * 4 + cast * 2;
    b.gyro0.rotation.x += dt * 0.7 * spin; b.gyro1.rotation.y += dt * 0.9 * spin; b.gyro2.rotation.z += dt * 1.1 * spin;
    // embers rise through the rib cage and start again at the bottom
    for (const sp of e.parts.embers) {
      const u = sp.userData;
      sp.position.y += dt * u.sp * (1 + k * 3);
      if (sp.position.y > 4.0) sp.position.y = 1.4;
      u.a += dt * 0.8;
      sp.position.x = Math.cos(u.a) * u.r; sp.position.z = Math.sin(u.a) * u.r - 0.1;
    }
    // the skull: a slow, menacing tilt; it lowers to cast, throws back to roar; the jaw gapes
    pose(b.head, (Math.sin(t * 0.5) * 0.08 + cast * 0.15 - e.lunge * 0.3) * (1 - k) - 0.6 * k + tremble, Math.sin(t * 0.4) * 0.15 * (1 - k), Math.sin(t * 0.6) * 0.06, 4, dt);
    pose(b.jaw, 0.06 + cast * 0.35 + k * (0.85 + Math.sin(now / 45) * 0.05) + Math.max(0, Math.sin(t * 3)) * 0.04, 0, 0, 10, dt);
    e.parts.eyes.forEach(s => s.scale.setScalar(0.25 + k * 0.6 + cast * 0.2));
    // arms hang and drift; they rise to cast, slam on a stomp, fling out to roar; claws curl when casting
    ['L', 'R'].forEach((side, i) => {
      const s = i ? -1 : 1;
      pose(b['arm' + side], (-cast * 1.1 - e.lunge * 0.9 + Math.sin(t * 0.9 + i * 2) * 0.12) * (1 - k) - 2.2 * k - lp * 0.8, 0, s * (0.5 * k + lp * 0.3), 4, dt);
      pose(b['fore' + side], -0.1 - cast * 0.3 + k * 0.3 + Math.sin(t * 1.1 + i) * 0.1, 0, 0, 3, dt);
      pose(b['hand' + side], -cast * 0.6 - k * 0.3 + Math.sin(t * 2 + i) * 0.08, 0, 0, 6, dt);
    });
    pose(b.roots, Math.sin(t * 1.3) * 0.1, 0, Math.cos(t * 1.1) * 0.1, 3, dt);   // trailing roots sway
  },
};

// ---------- Endless phase ----------

/** The Hollow King has fallen: start scoring, and let the forest rage. */
function startEndless() {
  endless = true; endlessAt = runTime; score = 0;
  banner('The Hollow King has fallen', 'The forest rages', 'win');
  $('score-row').hidden = false;
  hud();
}

/** Seconds since the endless phase began (0 before it). */
const endlessT = () => (endless ? runTime - endlessAt : 0);

/** How much each point is worth right now: grows steadily the longer you last after the King. */
const scoreMult = () => 1 + endlessT() / 60;

/** Points for killing creature e (bigger creatures are worth more). Called from killFoe. */
function scoreKill(e) {
  if (!endless) return;
  const pts = Math.round(e.def.xp * 10 * scoreMult());
  score += pts;
  pop(centerOf(e, new V3()).add(P.set(0, 1.4 + e.def.r, 0)), '+' + pts, '', 'score');
}

// ---------- Schedule, health bar, banner ----------

/** Show the big centered announcement: a small label line and a title. kind 'boss' or 'win' picks the color. */
function banner(label, title, kind) {
  const b = $('banner');
  b.className = kind;
  b.innerHTML = '<div class="lbl">' + label + '</div><div class="title">' + title + '</div>';
  b.hidden = false;
  flash('banner', 'show');
  clearTimeout(banner.timer);
  banner.timer = setTimeout(() => { b.hidden = true; }, 4200);
}

let scoreTick = 0; // fractional survival points waiting to be added

/** Spawn bosses on schedule, keep the health bar current, and add survival score. Called every frame while playing. */
function stepBoss(dt) {
  const next = BOSS_SCHEDULE[bossNext];
  if (next && runTime >= next.at && !boss) {
    bossNext++;
    const at = spawnPoint();
    boss = spawnFoe(next.id, at.x, at.z);
    banner('A boss approaches', boss.def.label, 'boss');
    sfx.bossIntro();
    shake = 0.5;
    $('bossname').textContent = boss.def.label;
    $('bossbar').hidden = false;
  }
  if (boss) {
    const k = Math.max(0, boss.hp / boss.maxHp);
    $('bossfill').style.width = k * 100 + '%';
    $('bosshp').textContent = Math.ceil(Math.max(0, boss.hp)) + ' / ' + Math.ceil(boss.maxHp);
    $('bossbar').classList.toggle('rage', k < 0.5 && !boss.immune);
    $('bossbar').classList.toggle('immune', !!boss.immune);
  }
  // endless: 5 points a second, growing with time
  if (endless) {
    scoreTick += 5 * scoreMult() * dt;
    if (scoreTick >= 1) { score += Math.floor(scoreTick); scoreTick %= 1; $('score').textContent = score.toLocaleString(); }
  }
}

/** Forget any boss and the endless phase, and start the schedule over (when a run resets). */
function resetBosses() {
  boss = null; bossNext = 0;
  endless = false; endlessAt = 0; score = 0; scoreTick = 0;
  $('bossbar').hidden = true; $('banner').hidden = true; $('score-row').hidden = true;
}

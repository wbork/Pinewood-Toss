/* =========================================================================
   bosses.js — the two boss fights, their health bar, the arrival banner,
   and the endless "score" phase that begins once both are beaten.

   BOSS_SCHEDULE says when each boss climbs out of the ground:
     5:00  The Thorn Queen — a towering queen woven from brambles, in a gown of
           thorns. Fires rings of thorns, calls broods of imps, and slams the
           ground where you stand.
     10:00 The Hollow King — an empty husk of a king: a cage of bark ribs around
           a burning heart, a hollow mask, a crown and a tattered cloak. Much
           tougher. Raises roots under you, stomps out shockwaves you must jump,
           fires thorn barrages and summons stalkers.
   Both hit harder and attack faster below half health ("rage"). Each one
   drops a free legendary chest, a heart and a magnet when defeated.

   ENDLESS: when the Hollow King falls, the forest rages. From then on you
   score points for every kill and every second survived (both worth more the
   longer you last), and creatures pour in faster and faster until you die.
   The best-times board (besttimes.js) records time and score.

   Bosses are ordinary creatures (enemies.js runs them) with `boss: true`,
   so they're added to FOES here but never picked by the random spawner.
   Their attacks use the hazards in hazards.js.
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

/**
 * Shared boss brain: walk toward the deer, and every few seconds stop to wind up
 * (glowing) and then perform the next move. Below half health it attacks 35% sooner.
 */
function bossAI(e, dt, want, moves, every) {
  const rage = e.hp < e.maxHp * 0.5;
  if (e.act === 'cast') {
    want.multiplyScalar(0.15); e.warn = 0.9;
    if ((e.actT -= dt) <= 0) { e.act = null; e.def.moves[e.move](e, rage); }
    return;
  }
  if (ready(e, dt, 2.5)) { e.cd = every * (rage ? 0.65 : 1); e.move = nextMove(e, moves); e.act = 'cast'; e.actT = 0.7; }
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

// Shared boss looks.
const BOSS_MAT = {
  bramble: std({ color: 0x2a1726 }),                                 // Thorn Queen's vines
  rose: std({ color: 0xc0283c, roughness: 0.6 }),                     // her roses
  void: new THREE.MeshBasicMaterial({ color: 0x050306 }),             // empty eye sockets
  cloak: std({ color: 0x2a2228, side: THREE.DoubleSide }),            // his tattered cloak
  gold: std({ color: 0xb8913a, roughness: 0.4, metalness: 0.6 }),     // his tarnished crown
  ember: new THREE.MeshBasicMaterial({ color: 0xff6a2a }),            // his burning heart
};

// ---------- The Thorn Queen ----------

FOES.thornqueen = {
  label: 'The Thorn Queen', boss: true, hp: 450, dmg: 12, speed: 2.4, xp: 120, coin: 120, r: 1.8, lo: 0.8, hi: 5.4, mass: 40, chip: 0x3b2436,
  ability: 'Thorn rings, broods of imps, and ground slams where you stand.',
  build(e) {
    const vine = std({ color: 0x3b2436 }); e.flashMats.push(vine);
    const body = new THREE.Group(); e.group.add(body); e.parts.body = body;
    // a wide gown of thorns that sweeps the ground (she glides; no legs show)
    const gown = mesh(new THREE.ConeGeometry(2.0, 3.4, 12, 1, true), vine, 0, 1.7, 0); gown.material.side = THREE.DoubleSide; body.add(gown); e.parts.gown = gown;
    const rnd = mulberry(31);
    for (let i = 0; i < 30; i++) { // thorns and roses scattered over the gown
      const a = rnd() * Math.PI * 2, y = rnd() * 3.0, rr = 2.0 * (1 - y / 3.4) + 0.02;
      const out = new V3(Math.cos(a), 0.35, Math.sin(a)).normalize();
      if (i % 3) { const t = mesh(new THREE.ConeGeometry(0.07, 0.45, 4), BOSS_MAT.bramble, Math.cos(a) * rr, y + 0.1, Math.sin(a) * rr); t.quaternion.setFromUnitVectors(UP, out); body.add(t); }
      else body.add(mesh(new THREE.DodecahedronGeometry(0.14, 0), BOSS_MAT.rose, Math.cos(a) * rr, y + 0.1, Math.sin(a) * rr));
    }
    // a slender bodice of twisted vines, and spiked shoulders
    body.add(mesh(new THREE.CylinderGeometry(0.7, 0.5, 1.3, 8), vine, 0, 4.0, 0));
    for (let k = 0; k < 3; k++) { const v = mesh(new THREE.TorusGeometry(0.62 - k * 0.04, 0.05, 4, 12), BOSS_MAT.bramble, 0, 3.6 + k * 0.35, 0); v.rotation.x = Math.PI / 2 + (k - 1) * 0.25; body.add(v); }
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const c = mesh(new THREE.ConeGeometry(0.1, 0.6, 4), BOSS_MAT.bramble, s * (0.65 + k * 0.12), 4.65 + k * 0.08, -0.1); c.rotation.z = -s * (1.0 + k * 0.25); body.add(c); }
    // a tall fan collar of thorns behind the head
    for (let k = 0; k < 9; k++) { const a = -1.1 + k * 0.275; const c = mesh(new THREE.ConeGeometry(0.06, 1.1, 4), BOSS_MAT.bramble, Math.sin(a) * 0.55, 5.1 + Math.cos(a) * 0.3, -0.35); c.rotation.z = -a * 0.8; c.rotation.x = -0.3; body.add(c); }
    // the head: a long, dark face with amber eyes
    const head = new THREE.Group(); head.position.set(0, 5.0, 0.05); body.add(head); e.parts.head = head;
    const face = mesh(new THREE.SphereGeometry(0.34, 10, 8), vine); face.scale.set(0.85, 1.25, 0.9); head.add(face);
    for (const x of [-0.12, 0.12]) { const eye = mesh(new THREE.SphereGeometry(0.06, 6, 4), EYE.amber, x, 0.06, 0.28); eye.scale.x = 1.6; head.add(eye); }
    // the crown: a ring of tall thorns, and a glowing rose at the front
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; head.add(mesh(new THREE.ConeGeometry(0.05, 0.6 + (k % 2) * 0.3, 4), BOSS_MAT.bramble, Math.cos(a) * 0.26, 0.6, Math.sin(a) * 0.26)); }
    head.add(mesh(new THREE.DodecahedronGeometry(0.12, 0), BOSS_MAT.rose, 0, 0.5, 0.3));
    const gem = new THREE.Sprite(glow(0xff4a8a)); gem.position.set(0, 0.5, 0.32); gem.scale.setScalar(0.9); head.add(gem); e.parts.gem = gem;
    // long bramble arms ending in thorn whips
    e.parts.arms = [-1, 1].map(s => {
      const arm = new THREE.Group(); arm.position.set(s * 0.7, 4.5, 0.05); body.add(arm);
      arm.add(mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.6, 5), vine, 0, -0.8, 0));
      const fore = new THREE.Group(); fore.position.y = -1.6; arm.add(fore);
      fore.add(mesh(new THREE.CylinderGeometry(0.04, 0.07, 1.6, 5), vine, 0, -0.8, 0));
      for (let k = 0; k < 4; k++) { const c = mesh(new THREE.ConeGeometry(0.05, 0.3, 4), BOSS_MAT.bramble, s * 0.06, -0.3 - k * 0.35, 0); c.rotation.z = -s * 0.9; fore.add(c); }
      arm.rotation.z = s * 0.35;
      return arm;
    });
    const halo = new THREE.Sprite(glow(0xb04aff)); halo.position.y = 4; halo.scale.setScalar(7); halo.material.opacity = 0.3; body.add(halo);
  },
  moves: {
    // two rings of thorn bolts (three when enraged), each turned to cover the last ring's gaps
    volley(e, rage) {
      for (let k = 0; k < (rage ? 3 : 2); k++) later.push({ t: k * 0.55, fn: () => boltRing(e, 18, 9, e.dmg * 0.6, 0xb06a3a, k * Math.PI / 18) });
    },
    // a brood of imps
    brood(e, rage) { summon(e, 'imp', rage ? 6 : 4, 3.5); sfx.roar(); },
    // slams: a circle where you're standing plus a few nearby; get out before they fill
    slam(e, rage) {
      markGround(player.pos, 3.2, 1.2, e.dmg);
      for (let k = 0; k < (rage ? 5 : 3); k++) markGround(nearDeer(7), 2.6, 1.2 + Math.random() * 0.4, e.dmg);
    },
  },
  ai(e, dt, want) { bossAI(e, dt, want, ['volley', 'brood', 'slam'], 4.2); },
  onDeath: bossDefeated,
  animate(e, dt, now) {
    e.phase += dt * 1.6;
    e.parts.body.position.y = Math.sin(e.phase) * 0.08;                  // a gliding float
    e.parts.gown.rotation.y += dt * 0.3;                                  // the gown's thorns slowly turn
    e.parts.body.rotation.z = Math.sin(e.phase * 0.7) * 0.03;
    e.parts.head.rotation.y = Math.sin(e.phase * 0.5) * 0.15;
    e.parts.gem.scale.setScalar(0.8 + Math.sin(now / 200) * 0.15 + (e.act === 'cast' ? 0.6 : 0));
    const raise = e.act === 'cast' ? 1.3 : 0;                            // arms lift to cast, lash on attack
    e.parts.arms.forEach((a, i) => { a.rotation.x = -raise - e.lunge * 1.2 + Math.sin(e.phase + i) * 0.15; });
  },
};

// ---------- The Hollow King ----------

FOES.hollowking = {
  label: 'The Hollow King', boss: true, hp: 1100, dmg: 16, speed: 2.0, xp: 300, coin: 300, r: 2.2, lo: 0.8, hi: 6.2, mass: 80, chip: 0x6a5a48,
  ability: 'Roots under your feet, shockwaves to jump, thorn barrages, and stalker packs.',
  build(e) {
    const rib = std({ color: 0x5a4636 }); e.flashMats.push(rib);
    const mask = std({ color: 0xd8cbb0, roughness: 0.7 }); e.flashMats.push(mask);
    const body = new THREE.Group(); body.position.y = 0.6; e.group.add(body); e.parts.body = body; // floats above the ground
    // the hollow chest: a cage of curved ribs with a spine at the back, open at the front, nothing inside...
    body.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.4, 6), rib, 0, 3.2, -0.85));               // spine
    for (let k = 0; k < 6; k++) {
      const y = 1.9 + k * 0.48, w = 1.0 + Math.sin((k + 1) / 7 * Math.PI) * 0.35;                       // ribs widest mid-chest
      for (const s of [-1, 1]) {
        // each rib is a 148° arc laid flat, centered on its side: gaps are left at the front and at the spine
        const r = mesh(new THREE.TorusGeometry(w, 0.09, 5, 12, Math.PI * 0.82), rib, 0, y, -0.1);
        r.rotation.set(Math.PI / 2, 0, s > 0 ? -Math.PI * 0.41 : Math.PI * 0.59);
        body.add(r);
      }
    }
    for (const [rad, y, tube] of [[0.95, 1.6, 0.14], [1.25, 4.7, 0.16]]) { // pelvis ring and collar bone
      const ringMesh = mesh(new THREE.TorusGeometry(rad, tube, 5, 14), rib, 0, y, -0.1); ringMesh.rotation.x = Math.PI / 2; body.add(ringMesh);
    }
    // ...except its burning heart, floating in the empty cage
    const heart = new THREE.Group(); heart.position.set(0, 3.2, -0.1); body.add(heart); e.parts.heart = heart;
    heart.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), BOSS_MAT.ember));
    const flame = new THREE.Sprite(glow(0xff6a2a)); flame.scale.setScalar(3.2); heart.add(flame); e.parts.flame = flame;
    // a hollow mask: pale bone with empty black eye sockets and a hollow mouth, tiny embers deep inside
    const head = new THREE.Group(); head.position.set(0, 5.6, 0); body.add(head); e.parts.head = head;
    const face = mesh(new THREE.SphereGeometry(0.62, 12, 10), mask); face.scale.set(0.85, 1.15, 0.7); head.add(face);
    for (const x of [-0.22, 0.22]) {
      const socket = mesh(new THREE.SphereGeometry(0.15, 8, 6), BOSS_MAT.void, x, 0.12, 0.36); socket.scale.set(1, 1.5, 0.6); head.add(socket);
      const spark = new THREE.Sprite(glow(0xff5a2a)); spark.position.set(x, 0.1, 0.42); spark.scale.setScalar(0.22); head.add(spark);
    }
    const mouth = mesh(new THREE.BoxGeometry(0.34, 0.1, 0.12), BOSS_MAT.void, 0, -0.32, 0.38); head.add(mouth);
    // a tarnished crown
    head.add(mesh(new THREE.CylinderGeometry(0.5, 0.48, 0.18, 10, 1, true), BOSS_MAT.gold, 0, 0.62, 0));
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; head.add(mesh(new THREE.ConeGeometry(0.07, 0.42 + (k % 2) * 0.2, 4), BOSS_MAT.gold, Math.cos(a) * 0.48, 0.92, Math.sin(a) * 0.48)); }
    // a tattered cape hanging behind (only the back half), so the hollow shows from the front and sides
    const cloak = mesh(new THREE.CylinderGeometry(1.4, 2.2, 4.4, 14, 1, true, Math.PI * 0.6, Math.PI * 0.8), BOSS_MAT.cloak, 0, 2.6, -0.3);
    body.add(cloak); e.parts.cloak = cloak;
    for (let k = 0; k < 6; k++) { const a = Math.PI * 0.6 + (k + 0.5) / 6 * Math.PI * 0.8; const tat = mesh(new THREE.ConeGeometry(0.24, 0.8, 3), BOSS_MAT.cloak, Math.sin(a) * 2.15, 0.1, Math.cos(a) * 2.15 - 0.3); tat.rotation.x = Math.PI; body.add(tat); }
    // long, thin arms of dead wood, ending in claws
    e.parts.arms = [-1, 1].map(s => {
      const arm = new THREE.Group(); arm.position.set(s * 1.25, 4.6, -0.1); body.add(arm);
      arm.add(mesh(new THREE.CylinderGeometry(0.09, 0.13, 2.0, 5), rib, 0, -1.0, 0));
      const fore = new THREE.Group(); fore.position.y = -2.0; fore.rotation.x = -0.5; arm.add(fore);
      fore.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.9, 5), rib, 0, -0.95, 0));
      for (let k = -1; k <= 1; k++) { const c = mesh(new THREE.ConeGeometry(0.05, 0.5, 4), mask, k * 0.09, -2.1, 0.05); c.rotation.x = Math.PI + 0.3; fore.add(c); }
      arm.rotation.z = s * 0.25;
      return arm;
    });
  },
  moves: {
    // roots erupt under you and in a ring around you
    roots(e, rage) {
      markGround(player.pos, 3, 1.3, e.dmg);
      const n = rage ? 8 : 5;
      for (let k = 0; k < n; k++) { const a = (k / n) * 6.28; markGround(new V3(player.pos.x + Math.cos(a) * 4.5, 0, player.pos.z + Math.sin(a) * 4.5), 2.4, 1.3 + k * 0.08, e.dmg); }
    },
    // a stomp sends a shockwave across the ground: jump it (two when enraged)
    stomp(e, rage) {
      e.lunge = 1;
      shockwave(e.group.position, 11, 30, e.dmg * 0.8);
      if (rage) later.push({ t: 0.8, fn: () => { if (e.state === 'alive') shockwave(e.group.position, 13, 30, e.dmg * 0.8); } });
    },
    // three quick fans of ember bolts from its heart, aimed at you
    barrage(e, rage) {
      for (let k = 0; k < (rage ? 4 : 3); k++) later.push({ t: k * 0.35, fn: () => {
        if (e.state !== 'alive') return;
        const c = e.group.position.clone().add(P.set(0, 3.8, 0)), aim = deerChest().clone();
        for (let i = -2; i <= 2; i++) fireBolt(c, aim.clone().sub(c).applyAxisAngle(UP, i * 0.12).add(c), 13, e.dmg * 0.5, 0xff7a3a);
        sfx.bolt();
      } });
    },
    // a pack of shade stalkers and a stump to shield them
    call(e, rage) { summon(e, 'stalker', rage ? 4 : 3, 4); summon(e, 'stump', 1, 3); sfx.roar(); },
  },
  ai(e, dt, want) { bossAI(e, dt, want, ['roots', 'stomp', 'barrage', 'call'], 3.6); },
  onDeath: bossDefeated,
  animate(e, dt, now) {
    e.phase += dt * 1.2;
    e.parts.body.position.y = 0.6 + Math.sin(e.phase) * 0.15;           // hovers, bobbing
    e.parts.body.rotation.z = Math.sin(e.phase * 0.6) * 0.03;
    e.parts.cloak.rotation.y = Math.sin(e.phase * 0.8) * 0.06;          // the cloak sways
    e.parts.heart.rotation.y += dt * 1.5;
    const beat = 1 + Math.max(0, Math.sin(now / 160)) * 0.25 + (e.act === 'cast' ? 0.5 : 0); // the heart beats, flaring before an attack
    e.parts.heart.scale.setScalar(beat);
    e.parts.head.rotation.x = Math.sin(e.phase * 0.5) * 0.08 - e.lunge * 0.3;
    const raise = e.act === 'cast' ? 1.1 : 0;
    e.parts.arms.forEach((a, i) => { a.rotation.x = -raise - e.lunge * 0.9 + Math.sin(e.phase + i * 2) * 0.12; });
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
    $('bossbar').classList.toggle('rage', k < 0.5);
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

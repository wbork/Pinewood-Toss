/* =========================================================================
   weapons.js — the eight weapons, their upgrades, and the synergies between
   them.

   You start with the weapon picked on the title screen (`startWeapon`, see
   the picker at the bottom of this file) and can carry up to MAX_WEAPONS. Each level-up
   (levelup.js) offers new weapons while a slot is free, plus upgrades for the
   ones you have, up to MAX_LEVEL each.

   Two kinds of weapon:
   - aimed: fires at the crosshair when you click (or hold) the mouse.
     Every aimed weapon you own fires together, each on its own cooldown.
   - auto:  works on its own while you move.

   Each weapon's `stats(L)` turns its level L into numbers, with items
   (mod, in items.js) folded in, so to rebalance a weapon edit its stats.
   ========================================================================= */

const MAX_WEAPONS = 4;
const MAX_LEVEL = 8;

// Upgrade helper: 1 if level L has reached n, else 0. e.g. 1 + lvl(L,2) adds one at level 2.
const lvl = (L, n) => (L >= n ? 1 : 0);

// ---------- Synergies and fusions ----------
// Owning both weapons of a pair switches on a bonus. Weapon code checks syn('id').
// When both reach MAX_LEVEL they FUSE into one weapon called `fusion`: it takes a single
// slot (freeing the other for a new weapon) and keeps both weapons working. Fused weapons
// are much stronger than the two apart: FUSE_DMG× damage, FUSE_CD× cooldowns, FUSE_AREA×
// reach, plus the fusion's own `power` (weapon code checks fz('id')). A weapon can only
// be in one fusion.
const SYNERGIES = [
  { id: 'avalanche', name: 'Avalanche',     fusion: 'Snowball Mortar',  a: 'pine',    b: 'frost',   text: 'Pine Balls burst into frost when they hit a chilled creature.',
    power: 'Every Pine Ball hit bursts into frost, and the balls are 50% bigger.' },
  { id: 'mark',      name: "Hunter's Mark", fusion: "Hunter's Lantern", a: 'pine',    b: 'firefly', text: 'Every Pine Ball hit sends out a firefly.',
    power: 'Every Pine Ball hit sends out two fireflies, and fireflies burn twice as hot.' },
  { id: 'coldsnap',  name: 'Cold Snap',     fusion: 'Hailstorm Sling',  a: 'acorn',   b: 'frost',   text: 'Acorns chill what they hit.',
    power: 'Acorns freeze what they hit for half a second and pierce 2 more creatures.' },
  { id: 'honey',     name: 'Honey Glaze',   fusion: 'Honeyshot',        a: 'acorn',   b: 'hive',    text: 'Acorns pierce one more creature and deal double damage to poisoned ones.',
    power: 'Acorns poison what they hit, and deal triple damage to poisoned creatures.' },
  { id: 'smoked',    name: 'Smoked Hive',   fusion: "Smoker's Hive",    a: 'hive',    b: 'firefly', text: 'Bee swarms also set creatures burning.',
    power: 'Swarms are 50% wider and burn twice as hot.' },
  { id: 'shatter',   name: 'Shatter',       fusion: 'Glacier Antlers',  a: 'frost',   b: 'antler',  text: 'Antler Sweep deals triple damage to chilled creatures.',
    power: 'Every sweep chills what it hits, and chilled creatures take quadruple damage.' },
  { id: 'bramble',   name: 'Bramble Crown', fusion: 'Crown of Thorns',  a: 'thorn',   b: 'antler',  text: 'Thorns deal double damage and circle 30% wider.',
    power: '+3 thorns, and thorns deal triple damage.' },
  { id: 'toxic',     name: 'Toxic Thorns',  fusion: 'Blight Ring',      a: 'thorn',   b: 'mush',    text: 'Thorns poison what they cut.',
    power: 'Thorn poison is three times as strong, and every cut leaves a small poison cloud.' },
  { id: 'wildfire',  name: 'Wildfire',      fusion: 'Ember Caps',       a: 'firefly', b: 'mush',    text: 'Mushroom blasts are 50% bigger and set creatures burning.',
    power: 'Every mushroom blast goes off a second time, and burns twice as hot.' },
  { id: 'hivemind',  name: 'Hive Mind',     fusion: 'Swarm Garden',     a: 'hive',    b: 'mush',    text: 'Mushroom blasts release a bee swarm.',
    power: 'Plants mushrooms twice as fast and holds twice as many; their swarms are full size.' },
];
const SYN = Object.fromEntries(SYNERGIES.map(s => [s.id, s])); // look up by id
const FUSE_DMG = 1.6, FUSE_CD = 0.7, FUSE_AREA = 1.25;

// ---------- What the player has ----------
// `owned` is the weapon slots, in the order they were filled. A slot holds a weapon id,
// or a synergy id once that pair has fused (e.g. 'shatter' = Frost Cone + Antler Sweep).
const owned = [];
const wlv = {};   // level of each weapon you have, fused or not, e.g. wlv.frost = 3
const wcd = {};   // seconds until each weapon can fire again
const has = id => !!wlv[id];
const syn = id => has(SYN[id].a) && has(SYN[id].b);
/** Has synergy `id` fused (its fusion `power` is on)? */
const fz = id => owned.includes(id);
/** The synergies a weapon is part of. */
const synergiesOf = id => SYNERGIES.filter(s => s.a === id || s.b === id);
/** The fusion a weapon is part of, or undefined. */
const fusedIn = id => SYNERGIES.find(s => owned.includes(s.id) && (s.a === id || s.b === id));
/** Every weapon that's working: the ones in slots, plus both halves of each fusion. */
const armed = () => owned.flatMap(id => (SYN[id] ? [SYN[id].a, SYN[id].b] : [id]));
/** The other weapon in synergy s. */
const partner = (s, id) => (s.a === id ? s.b : s.a);

/**
 * Fuse every synergy pair whose two weapons both sit in slots at MAX_LEVEL: the pair
 * becomes one slot. Returns the synergies that just fused (for announcing).
 */
function checkFusions() {
  const made = [];
  for (const s of SYNERGIES) {
    const ia = owned.indexOf(s.a), ib = owned.indexOf(s.b);
    if (ia < 0 || ib < 0 || wlv[s.a] < MAX_LEVEL || wlv[s.b] < MAX_LEVEL) continue;
    owned[Math.min(ia, ib)] = s.id;  // the fusion takes the earlier slot...
    owned.splice(Math.max(ia, ib), 1); // ...and the later one frees up
    made.push(s);
  }
  return made;
}

// ---------- Looks shared by several weapons ----------
const hiveTex = tex(32, 32, (g, w, hgt) => { // golden with brown bands
  g.fillStyle = '#e8b030'; g.fillRect(0, 0, w, hgt);
  g.fillStyle = '#6b4220'; for (let y = 4; y < hgt; y += 8) g.fillRect(0, y, w, 3);
});
const LOOK = {
  acorn: std({ color: 0x8a5a2b }), acornCap: std({ color: 0x4a3018 }),
  hive: new THREE.MeshStandardMaterial({ map: hiveTex, roughness: 0.8 }),
  frost: std({ color: 0xcfeeff, emissive: 0x2a6a9a, roughness: 0.3 }),
  thorn: std({ color: 0x3f5a22 }),
  mushCap: std({ color: 0xc9302c }), mushStem: std({ color: 0xf1e6cf }), mushDot: std({ color: 0xfff6e8 }),
  bee: new THREE.MeshBasicMaterial({ color: 0xffc83a }),
};
const acornGeo = new THREE.SphereGeometry(1, 8, 6), capGeo = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
const hiveGeo = new THREE.SphereGeometry(1, 10, 8), frostGeo = new THREE.OctahedronGeometry(1, 0);
const thornGeo = new THREE.ConeGeometry(0.09, 0.42, 5).rotateZ(-Math.PI / 2); // points along +x (outward)
const beeGeo = new THREE.SphereGeometry(0.05, 5, 4);

// ---------- The eight weapons ----------
// name, kind (aimed/auto), style (one line on the card), text (what it does),
// ups (what levels 2–8 add), stats(L), and fire() for aimed or step(dt) for auto weapons.
const WEAPONS = {
  pine: {
    name: 'Pine Ball', kind: 'aimed', style: 'Aimed · bouncing balls',
    text: 'Balls that fly where you aim, then bounce, roll and keep hitting.',
    ups: ['+1 ball', '+40% damage', 'Bounces on to 1 more creature', '+1 ball and +40% damage',
      '+1 ball', '+50% damage', 'Bounces on to 2 more creatures'],
    stats: L => ({
      n: 1 + lvl(L,2) + lvl(L,5) + lvl(L,6) + mod.extra, dmg: 2 * (1 + 0.4 * lvl(L,3) + 0.4 * lvl(L,5) + 0.5 * lvl(L,7)) * mod.dmg,
      rico: lvl(L,4) + 2 * lvl(L,8) + mod.rico, cd: 0.3 / mod.haste, speed: 28 * mod.speed, r: BALL_R * mod.area * (fz('avalanche') ? 1.5 : 1),
    }),
    fire(s, target) {
      const from = handPos(), shot = aimShot(from, target, s.speed);
      for (let i = 0; i < s.n; i++) {
        const m = new THREE.Mesh(ballGeo, ballMat); m.scale.setScalar(s.r / BALL_R); m.position.copy(from);
        launch({ mesh: m, r: s.r, vel: shot.vel.clone().applyAxisAngle(UP, (i - (s.n - 1) / 2) * 0.1), glide: shot.glide, roll: true, rico: s.rico, dmg: s.dmg, w: 'pine', onHit: pineHit });
      }
      sfx.throw();
    },
  },

  acorn: {
    name: 'Acorn Sling', kind: 'aimed', style: 'Aimed · rapid fire',
    text: 'Hold to fire a stream of fast, flat acorns. Small hits, lots of them.',
    ups: ['Pierces 1 more creature', 'Fires 25% faster', '+50% damage', 'Fires two acorns side by side',
      'Fires 25% faster', '+50% damage and pierces 1 more', 'Fires three acorns in a fan'],
    stats: L => ({
      n: 1 + lvl(L,5) + lvl(L,8) + mod.extra, dmg: 0.8 * (1 + 0.5 * lvl(L,4) + 0.5 * lvl(L,7)) * mod.dmg,
      pierce: lvl(L,2) + lvl(L,7) + (syn('honey') ? 1 : 0) + (fz('coldsnap') ? 2 : 0),
      rico: mod.rico, cd: 0.13 * (lvl(L,3) ? 0.75 : 1) * (lvl(L,6) ? 0.75 : 1) / mod.haste, speed: 50 * mod.speed, r: 0.07 * mod.area,
    }),
    fire(s, target) {
      const from = handPos(), shot = aimShot(from, target, s.speed);
      for (let i = 0; i < s.n; i++) {
        const g = new THREE.Group();
        const nut = new THREE.Mesh(acornGeo, LOOK.acorn); nut.scale.set(s.r, s.r * 1.25, s.r);
        const cap = new THREE.Mesh(capGeo, LOOK.acornCap); cap.scale.set(s.r * 1.1, s.r * 0.8, s.r * 1.1); cap.position.y = s.r * 0.4;
        g.add(nut, cap); g.position.copy(from);
        launch({ mesh: g, r: s.r, vel: shot.vel.clone().applyAxisAngle(UP, (i - (s.n - 1) / 2) * 0.035), glide: shot.glide, grav: 0.25, pierce: s.pierce, rico: s.rico, dmg: s.dmg, w: 'acorn', spin: 20,
          dmgVs: e => (syn('honey') && e.poison ? (fz('honey') ? 3 : 2) : 1), onHit: acornHit });
      }
      sfx.sling();
    },
  },

  hive: {
    name: 'Beehive', kind: 'aimed', style: 'Aimed · area over time',
    text: 'Throw a hive. It breaks into a bee swarm that poisons everything inside it.',
    ups: ['Swarm 30% wider', 'Swarm lasts 2 s longer', 'Bees sting 60% harder', 'Throws 2 hives',
      'Bees sting 60% harder', 'Swarm 30% wider', 'Throws 3 hives'],
    stats: L => ({
      n: 1 + lvl(L,5) + lvl(L,8) + mod.extra, r: 2.8 * (1 + 0.3 * lvl(L,2) + 0.3 * lvl(L,7)) * mod.area * (fz('smoked') ? 1.5 : 1), t: 4 + 2 * lvl(L,3),
      dps: 1.6 * (1 + 0.6 * lvl(L,4) + 0.6 * lvl(L,6)) * mod.dmg, cd: 2.4 / mod.haste, speed: 20 * mod.speed,
    }),
    fire(s, target) {
      const from = handPos();
      for (let i = 0; i < s.n; i++) {
        const to = target.clone().add(P.set(i ? (Math.random() - 0.5) * 5 : 0, 0, i ? (Math.random() - 0.5) * 5 : 0));
        const m = new THREE.Mesh(hiveGeo, LOOK.hive); m.scale.set(0.2, 0.26, 0.2); m.position.copy(from);
        launch({ mesh: m, r: 0.22, ...aimShot(from, to, s.speed), dmg: 0, w: 'hive', spin: 6, burst: p => swarm(p, s.r, s.t, s.dps) });
      }
      sfx.throw();
    },
  },

  frost: {
    name: 'Frost Cone', kind: 'aimed', style: 'Aimed · crowd control',
    text: 'Throw a frozen pinecone that bursts on impact, chilling creatures to half speed.',
    ups: ['Burst 30% wider', '+60% damage', 'Chill lasts 2 s longer', 'Freezes creatures solid for 1 s',
      'Burst 30% wider', '+60% damage', 'Throws 3 frost cones'],
    stats: L => ({
      n: 1 + 2 * lvl(L,8) + mod.extra, r: 2.8 * (1 + 0.3 * lvl(L,2) + 0.3 * lvl(L,6)) * mod.area, dmg: 2.5 * (1 + 0.6 * lvl(L,3) + 0.6 * lvl(L,7)) * mod.dmg,
      chill: 3 + 2 * lvl(L,4), freeze: lvl(L,5), cd: 1.8 / mod.haste, speed: 24 * mod.speed,
    }),
    fire(s, target) {
      const from = handPos();
      for (let i = 0; i < s.n; i++) {
        const to = target.clone().add(P.set(i ? (Math.random() - 0.5) * 5 : 0, 0, i ? (Math.random() - 0.5) * 5 : 0));
        const m = new THREE.Mesh(frostGeo, LOOK.frost); m.scale.set(0.14, 0.22, 0.14); m.position.copy(from);
        launch({ mesh: m, r: 0.18, ...aimShot(from, to, s.speed), dmg: 0, w: 'frost', spin: 9, burst: p => frostBurst(p, s.r, s.dmg, s.chill, s.freeze) });
      }
      sfx.throw();
    },
  },

  antler: {
    name: 'Antler Sweep', kind: 'auto', style: 'Automatic · close range',
    text: 'Spin and sweep your antlers through everything nearby, knocking it back.',
    ups: ['+50% damage', 'Reaches 25% farther', 'Sweeps 25% more often', 'A second sweep follows right after',
      '+50% damage', 'Sweeps 25% more often', 'Reaches 25% farther, and a third sweep follows'],
    stats: L => ({
      r: 3.2 * (1 + 0.25 * lvl(L,3) + 0.25 * lvl(L,8)) * mod.area, dmg: 5 * (1 + 0.5 * lvl(L,2) + 0.5 * lvl(L,6)) * mod.dmg,
      cd: 2.4 * (lvl(L,4) ? 0.75 : 1) * (lvl(L,7) ? 0.75 : 1) / mod.haste, sweeps: 1 + lvl(L,5) + lvl(L,8),
    }),
    step(s, dt) {
      if (wcd.antler > 0) return;
      // only sweep when something is in reach
      if (!foes.some(e => e.state === 'alive' && Math.hypot(e.group.position.x - player.pos.x, e.group.position.z - player.pos.z) < s.r + e.def.r)) return;
      wcd.antler = s.cd;
      sweep(s);
      for (let k = 1; k < s.sweeps; k++) later.push({ t: 0.35 * k, fn: () => sweep(s) }); // follow-up sweeps
    },
  },

  thorn: {
    name: 'Thorn Ring', kind: 'auto', style: 'Automatic · orbiting',
    text: 'Thorns circle around you and cut whatever they pass through.',
    ups: ['+1 thorn', '+50% damage', 'Ring 30% wider and faster', '+2 thorns',
      '+1 thorn and +50% damage', 'Ring spins 30% faster', '+2 thorns'],
    stats: L => {
      const b = syn('bramble');
      return {
        n: 2 + lvl(L,2) + 2 * lvl(L,5) + lvl(L,6) + 2 * lvl(L,8) + mod.extra + (fz('bramble') ? 3 : 0),
        dmg: 1.5 * (1 + 0.5 * lvl(L,3) + 0.5 * lvl(L,6)) * (b ? (fz('bramble') ? 3 : 2) : 1) * mod.dmg,
        r: 2.4 * (1 + 0.3 * lvl(L,4)) * (b ? 1.3 : 1) * mod.area, spin: 2.6 * (1 + 0.3 * lvl(L,4) + 0.3 * lvl(L,7)),
      };
    },
    step(s, dt) { stepThorns(s, dt); },
  },

  firefly: {
    name: 'Firefly Lantern', kind: 'auto', style: 'Automatic · homing',
    text: 'Fireflies fly out and seek the nearest creatures, setting them burning.',
    ups: ['+1 firefly', 'Hits and burns 50% harder', 'Launches 30% more often', '+2 fireflies',
      'Launches 30% more often', 'Hits and burns 50% harder', '+2 fireflies'],
    stats: L => ({
      n: 2 + lvl(L,2) + 2 * lvl(L,5) + 2 * lvl(L,8) + mod.extra, dmg: 2 * (1 + 0.5 * lvl(L,3) + 0.5 * lvl(L,7)) * mod.dmg,
      burn: 1 * (1 + 0.5 * lvl(L,3) + 0.5 * lvl(L,7)) * (fz('mark') ? 2 : 1) * mod.dmg, cd: 1.6 * (lvl(L,4) ? 0.7 : 1) * (lvl(L,6) ? 0.7 : 1) / mod.haste,
    }),
    step(s, dt) {
      if (wcd.firefly > 0) return;
      const from = player.pos.clone().add(P.set(0, 2.2, 0));
      const targets = foes.filter(e => e.state === 'alive' && e.group.position.distanceTo(player.pos) < 25)
        .sort((a, b) => a.group.position.distanceTo(player.pos) - b.group.position.distanceTo(player.pos));
      if (!targets.length) return;
      wcd.firefly = s.cd;
      for (let i = 0; i < s.n; i++) launchFirefly(from, targets[i % targets.length], s);
      sfx.firefly();
    },
  },

  mush: {
    name: 'Mushroom Mines', kind: 'auto', style: 'Automatic · traps',
    text: 'Plant a mushroom wherever you walk. It bursts in a poison blast when a creature steps close.',
    ups: ['Blasts 30% wider', '+60% damage', 'Plants 30% more often and holds 3 more', 'Each blast leaves a poison cloud',
      '+60% damage', 'Blasts 30% wider', 'Plants 30% more often and holds 4 more'],
    stats: L => ({
      r: 3 * (1 + 0.3 * lvl(L,2) + 0.3 * lvl(L,7)) * (syn('wildfire') ? 1.5 : 1) * mod.area, dmg: 7 * (1 + 0.6 * lvl(L,3) + 0.6 * lvl(L,6)) * mod.dmg,
      cd: 3 * (lvl(L,4) ? 0.7 : 1) * (lvl(L,8) ? 0.7 : 1) * (fz('hivemind') ? 0.5 : 1) / mod.haste,
      max: (5 + 3 * lvl(L,4) + 4 * lvl(L,8)) * (fz('hivemind') ? 2 : 1), cloud: lvl(L,5),
    }),
    step(s, dt) {
      if (wcd.mush > 0 || mines.length >= s.max || waterDepth(player.pos.x, player.pos.z) > 0 || !player.onGround) return;
      if (mines.some(m => m.g.position.distanceTo(player.pos) < 2)) return; // spread them out
      wcd.mush = s.cd;
      plantMine(player.pos.x, player.pos.z);
    },
  },
};
const WEAPON_IDS = Object.keys(WEAPONS);

/** A weapon's current numbers (level, items, and the fusion bonus applied). */
function wstat(id) {
  const s = WEAPONS[id].stats(wlv[id]);
  if (fusedIn(id)) {
    for (const k of ['dmg', 'dps', 'burn']) if (s[k]) s[k] *= FUSE_DMG;
    if (s.cd) s.cd *= FUSE_CD;
    if (s.r && id !== 'pine' && id !== 'acorn') s.r *= FUSE_AREA; // blast, swarm, sweep and ring radius (not projectile size)
  }
  return s;
}

/** Give the player a weapon (level 1), or raise one they own by a level. */
function addWeapon(id) {
  if (has(id)) wlv[id] = Math.min(MAX_LEVEL, wlv[id] + 1);
  else if (owned.length < MAX_WEAPONS) { owned.push(id); wlv[id] = 1; wcd[id] = 0; }
  if (id === 'thorn') thornCount = -1; // rebuild the ring
}

// ---------- Firing and per-frame updates ----------
const later = []; // delayed effects: { t: seconds to wait, fn }

/** Fire every aimed weapon that's ready, at whatever is under the crosshair. */
function fireAimed() {
  let fired = false, target = null;
  for (const id of armed()) {
    const w = WEAPONS[id];
    if (w.kind !== 'aimed' || wcd[id] > 0) continue;
    target = target || aimPoint(new V3());
    const s = wstat(id);
    wcd[id] = s.cd;
    w.fire(s, target);
    fired = true;
  }
  if (fired) { deer.throwT = 1; stats.throws++; }
}

/** Count down cooldowns, run the automatic weapons, and update everything weapons left in the world. */
function stepWeapons(dt) {
  for (const id of armed()) {
    wcd[id] -= dt;
    if (WEAPONS[id].kind === 'auto') WEAPONS[id].step(wstat(id), dt);
  }
  if (!has('thorn') && thornCount) clearThorns();
  for (let i = later.length - 1; i >= 0; i--) if ((later[i].t -= dt) <= 0) { later[i].fn(); later.splice(i, 1); }
  stepZones(dt);
  stepFireflies(dt);
  stepMines(dt);
}

/** Put the arsenal back to just the chosen starting weapon at level 1, and clear everything weapons left in the world. */
function resetWeapons() {
  owned.length = 0;
  for (const k in wlv) delete wlv[k];
  addWeapon(startWeapon);
  clearThorns();
  for (const z of zones) scene.remove(z.g);
  for (const f of flies) scene.remove(f.g);
  for (const m of mines) scene.remove(m.g);
  zones.length = flies.length = mines.length = later.length = 0;
}

// ---------- Hit helpers ----------

/** Everything alive whose body is within `r` of point `p` (flat distance). */
const foesNear = (p, r) => foes.filter(e => e.state === 'alive' && Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z) < r + e.def.r);

/** Shove direction from point p toward creature e, `force` m/s. */
const awayFrom = (p, e, force) => new V3(e.group.position.x - p.x, 0, e.group.position.z - p.z).normalize().multiplyScalar(force);

/** Pine Ball hit: the Avalanche and Hunter's Mark synergies (stronger once fused). */
function pineHit(e, p) {
  if (fz('avalanche')) frostBurst(p, 2.8, wstat('pine').dmg * 0.7, 3, 0);              // Snowball Mortar: every hit
  else if (syn('avalanche') && e.chill > 0) frostBurst(p, 2.2, wstat('pine').dmg * 0.5, 2, 0);
  if (syn('mark')) {
    const near = foes.filter(q => q !== e && q.state === 'alive' && q.group.position.distanceTo(p) < 20);
    for (let k = 0; k < (fz('mark') ? 2 : 1) && near.length; k++) launchFirefly(p.clone(), near[k % near.length], wstat('firefly'));
  }
}

/** Acorn hit: the Cold Snap and Honey Glaze synergies (stronger once fused). */
function acornHit(e) {
  if (fz('coldsnap')) freezeFoe(e, 0.5); else if (syn('coldsnap')) chillFoe(e, 1.5);
  if (fz('honey')) poisonFoe(e, 1.5 * mod.dmg, 2);
}

/** Frost Cone burst: damage and chill (or freeze) everything in radius r. */
function frostBurst(p, r, dmg, chill, freeze) {
  ring(p, r, 0xcfeeff);
  burst(p.clone().add(P.set(0, 0.3, 0)), 0xe8f6ff, 10);
  for (const e of foesNear(p, r)) {
    chillFoe(e, chill);
    if (freeze) freezeFoe(e, 1);
    hitFoe(e, dmg, awayFrom(p, e, 2));
  }
  sfx.frost();
}

/** One Antler Sweep: hit everything in reach and knock it back. */
function sweep(s) {
  deer.sweepT = 1;
  ring(player.pos, s.r, 0xf1e2bb);
  for (const e of foesNear(player.pos, s.r)) {
    hitFoe(e, s.dmg * (syn('shatter') && e.chill > 0 ? (fz('shatter') ? 4 : 3) : 1), awayFrom(player.pos, e, 10));
    if (fz('shatter')) chillFoe(e, 3); // Glacier Antlers: the next sweep shatters it
  }
  sfx.sweep();
}

// ---------- Bee swarms and poison clouds ("zones") ----------
// A circle on the ground that poisons (and with Smoked Hive, burns) every creature inside.
const zones = [];
const zoneGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);

/** Make a zone at p: radius r, lasting t seconds, dps poison. kind: 'bees' or 'cloud'. */
function makeZone(p, r, t, dps, kind) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(zoneGeo, new THREE.MeshBasicMaterial({ color: kind === 'bees' ? 0xffc83a : 0x7fcf4a, transparent: true, opacity: 0.18, depthWrite: false }));
  disc.scale.setScalar(r); g.add(disc);
  const bits = [];
  if (kind === 'bees') for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(beeGeo, LOOK.bee); g.add(b); bits.push({ m: b, a: Math.random() * 6.28, d: Math.random() * r, y: 0.3 + Math.random() * 1.2, s: 2 + Math.random() * 3 }); }
  else { const puff = new THREE.Sprite(glow(0x7fcf4a)); puff.scale.setScalar(r * 2.4); puff.position.y = 0.6; g.add(puff); }
  g.position.set(p.x, surfH(p.x, p.z) + 0.05, p.z);
  scene.add(g);
  zones.push({ g, disc, bits, r, t, life: t, dps, kind });
}
const swarm = (p, r, t, dps) => { makeZone(p, r, t, dps, 'bees'); sfx.bees(); };

function stepZones(dt) {
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.t -= dt;
    for (const e of foesNear(z.g.position, z.r)) {
      poisonFoe(e, z.dps, 1.5);
      if (z.kind === 'bees' && syn('smoked')) burnFoe(e, z.dps * (fz('smoked') ? 1.2 : 0.6), 1.5);
    }
    // bees buzz around in circles; everything fades out in the last second
    for (const b of z.bits) { b.a += dt * b.s; b.m.position.set(Math.cos(b.a) * b.d, b.y + Math.sin(b.a * 3) * 0.15, Math.sin(b.a) * b.d); }
    z.disc.material.opacity = 0.18 * Math.min(1, z.t);
    if (z.t <= 0) { scene.remove(z.g); z.disc.material.dispose(); zones.splice(i, 1); }
  }
}

// ---------- Thorn Ring ----------
const thorns = new THREE.Group(); scene.add(thorns);
let thornCount = 0, thornAngle = 0;

function clearThorns() { thorns.clear(); thornCount = 0; }

function stepThorns(s, dt) {
  if (thornCount !== s.n) { // rebuild when the number of thorns changes
    thorns.clear();
    for (let i = 0; i < s.n; i++) { const m = mesh(thornGeo, LOOK.thorn); thorns.add(m); }
    thornCount = s.n;
  }
  thornAngle += dt * s.spin;
  thorns.position.set(player.pos.x, player.pos.y + 1.0, player.pos.z);
  thorns.children.forEach((m, i) => {
    const a = thornAngle + (i / s.n) * Math.PI * 2;
    m.position.set(Math.cos(a) * s.r, Math.sin(thornAngle * 2 + i) * 0.15, Math.sin(a) * s.r);
    m.rotation.y = -a; // point outward
    // cut any creature this thorn passes through (each creature at most every 0.45 s)
    const wx = thorns.position.x + m.position.x, wz = thorns.position.z + m.position.z;
    for (const e of foes) {
      if (e.state !== 'alive' || e.thornT > runTime) continue;
      if (Math.hypot(e.group.position.x - wx, e.group.position.z - wz) < e.def.r + 0.3) {
        e.thornT = runTime + 0.45;
        hitFoe(e, s.dmg, awayFrom(player.pos, e, 3));
        if (fz('toxic')) { poisonFoe(e, 3.6 * mod.dmg, 3); if (Math.random() < 0.25) makeZone(e.group.position, 1.6, 2.5, 1.5 * mod.dmg, 'cloud'); } // Blight Ring
        else if (syn('toxic')) poisonFoe(e, 1.2 * mod.dmg, 3);
      }
    }
  });
}

// ---------- Fireflies ----------
const flies = [];
const flyGlow = glow(0xffd36a), flyCore = new THREE.MeshBasicMaterial({ color: 0xfff2b0 }), flyGeo = new THREE.SphereGeometry(0.07, 6, 4);

/** Send a firefly from `from` after creature `e`. `s` is the Firefly Lantern's stats (for damage). */
function launchFirefly(from, e, s) {
  const g = new THREE.Group();
  const halo = new THREE.Sprite(flyGlow); halo.scale.setScalar(0.7);
  g.add(halo, new THREE.Mesh(flyGeo, flyCore));
  g.position.copy(from);
  scene.add(g);
  // starts drifting in a random direction, then curves toward its target
  flies.push({ g, e, vel: new V3(Math.random() - 0.5, 1 + Math.random(), Math.random() - 0.5).multiplyScalar(5), age: 0, dmg: s.dmg, burn: s.burn });
}

function stepFireflies(dt) {
  for (let i = flies.length - 1; i >= 0; i--) {
    const f = flies[i], p = f.g.position;
    f.age += dt;
    if (f.e.state !== 'alive') { // target gone: pick the nearest other creature
      f.e = foes.filter(e => e.state === 'alive').sort((a, b) => a.group.position.distanceTo(p) - b.group.position.distanceTo(p))[0];
      if (!f.e) { scene.remove(f.g); flies.splice(i, 1); continue; }
    }
    const to = centerOf(f.e, new V3());
    const want = to.clone().sub(p).normalize().multiplyScalar(14);
    f.vel.lerp(want, 1 - Math.exp(-4 * dt));
    p.addScaledVector(f.vel, dt);
    f.g.children[0].scale.setScalar(0.6 + Math.sin(f.age * 25) * 0.15); // flicker
    if (p.distanceTo(to) < f.e.def.r + 0.35) {
      hitFoe(f.e, f.dmg, f.vel.clone().setY(0).normalize().multiplyScalar(2));
      burnFoe(f.e, f.burn, 3);
      scene.remove(f.g); flies.splice(i, 1);
    } else if (f.age > 4) { scene.remove(f.g); flies.splice(i, 1); }
  }
}

// ---------- Mushroom Mines ----------
const mines = [];
const capMushGeo = new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), stemGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.28, 8), dotGeo = new THREE.SphereGeometry(0.05, 5, 4);

function plantMine(x, z) {
  const g = new THREE.Group();
  g.add(mesh(stemGeo, LOOK.mushStem, 0, 0.14, 0));
  const cap = mesh(capMushGeo, LOOK.mushCap, 0, 0.24, 0); cap.scale.y = 0.7; g.add(cap);
  for (let i = 0; i < 5; i++) { const a = i * 1.26; g.add(mesh(dotGeo, LOOK.mushDot, Math.cos(a) * 0.18, 0.36, Math.sin(a) * 0.18)); }
  g.position.set(x, h(x, z), z);
  g.scale.setScalar(0.01);
  scene.add(g);
  mines.push({ g, age: 0 });
}

function stepMines(dt) {
  const s = has('mush') ? wstat('mush') : null;
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    m.age += dt;
    m.g.scale.setScalar(Math.min(1, m.age / 0.4) * (m.age > 0.6 ? 1 + Math.sin(m.age * 6) * 0.05 : 1)); // pops up, then pulses once armed
    if (!s || m.age > 45) { scene.remove(m.g); mines.splice(i, 1); continue; }
    if (m.age < 0.6) continue; // arming
    if (!foes.some(e => e.state === 'alive' && e.group.position.distanceTo(m.g.position) < e.def.r + 1.3)) continue;
    const p = m.g.position.clone().add(P.set(0, 0.3, 0));
    mineBlast(p, s);
    if (fz('wildfire')) later.push({ t: 0.45, fn: () => mineBlast(p, s) }); // Ember Caps: it goes off again
    if (s.cloud) makeZone(p, s.r * 0.8, 4, 1.5 * mod.dmg, 'cloud');
    if (syn('hivemind') && has('hive')) { const hs = wstat('hive'); swarm(p, hs.r, hs.t * (fz('hivemind') ? 1 : 0.75), hs.dps); }
    scene.remove(m.g); mines.splice(i, 1);
  }
}

/** One mushroom blast at p, with Mushroom Mines stats s. */
function mineBlast(p, s) {
  ring(p, s.r, syn('wildfire') ? 0xffa040 : 0x9fe060);
  burst(p, 0xc9302c, 10);
  for (const e of foesNear(p, s.r)) {
    hitFoe(e, s.dmg, awayFrom(p, e, 6));
    poisonFoe(e, 1.5 * mod.dmg, 3);
    if (syn('wildfire')) burnFoe(e, (fz('wildfire') ? 4 : 2) * mod.dmg, 3);
  }
  sfx.boom();
}

// ---------- Starting weapon picker ----------
// The title and game-over screens each have a row of eight buttons (class "start-pick")
// for choosing the weapon each run begins with. The choice is remembered in this browser.
let startWeapon = 'pine';
try { const s = localStorage.getItem('pinewood-start'); if (WEAPONS[s]) startWeapon = s; } catch (e) { /* no storage: Pine Ball */ }

/** Draw every picker, with the chosen weapon highlighted and described underneath. */
function renderStartPick() {
  const w = WEAPONS[startWeapon];
  const html = '<div class="lbl">Starting weapon</div><div class="pick-grid">' +
    WEAPON_IDS.map(id => '<button type="button" class="pick' + (id === startWeapon ? ' on' : '') + '" data-id="' + id + '" aria-pressed="' + (id === startWeapon) + '">' +
      WEAPONS[id].name + '<small>' + (WEAPONS[id].kind === 'aimed' ? 'Aimed' : 'Auto') + '</small></button>').join('') +
    '</div><div class="pick-about"><b>' + w.name + '</b> · ' + w.style.split(' · ')[1] + '. ' + w.text + '</div>';
  for (const box of document.querySelectorAll('.start-pick')) box.innerHTML = html;
}

for (const box of document.querySelectorAll('.start-pick')) {
  box.addEventListener('click', e => {
    e.stopPropagation(); // clicks here choose a weapon; they don't start the game
    const b = e.target.closest('.pick');
    if (!b) return;
    startWeapon = b.dataset.id;
    try { localStorage.setItem('pinewood-start', startWeapon); } catch (err) { /* not remembered */ }
    renderStartPick();
    if (!started) { resetWeapons(); refreshGear(); } // the title-screen ranger shows the new pick
    initAudio(); sfx.pick();
  });
}
renderStartPick();
resetWeapons(); // start with the chosen weapon


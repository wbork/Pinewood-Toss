/* =========================================================================
   chests.js — treasure chests scattered around the forest. Each holds one
   stat item (items.js) and costs coins to open: walk up and press E.

   A chest's rarity is rolled when it appears, and it shows: the chest's
   wood, metal and size change with rarity, and the beam of light above it
   (visible through the trees) glows in the rarity's color. A label floating
   over each chest gives its rarity and price.

   A few chests are out at once. When one is opened, a new one appears
   somewhere else after CHEST_RESPAWN seconds. Prices go up a little with
   every chest bought, while coin drops grow with difficulty (enemies.js →
   power), so chests stay within reach but never become free.
   ========================================================================= */

const CHESTS_AT_ONCE = 5;  // chests on the map at the same time
const CHEST_RESPAWN = 40;  // seconds after opening one until its replacement appears
const PRICE_STEP = 0.2;    // each chest bought raises every price by this share of its base
const chests = [];         // each: group, lid, beam, label, rarity, x, z, open (seconds since opened, or -1)
let chestQueue = [];       // countdowns (seconds) for chests waiting to respawn

// How each rarity looks: wood color, metal color, size, beam opacity, and base price in coins.
const CHEST_LOOK = {
  common:    { wood: 0x6b4426, metal: 0x77716a, size: 1.0,  beam: 0.14, price: 15 },  // plain wood, iron bands
  uncommon:  { wood: 0x3f6a2e, metal: 0xb08a3a, size: 1.05, beam: 0.18, price: 30 },  // moss-stained, bronze bands
  rare:      { wood: 0x24477a, metal: 0xd8dde0, size: 1.12, beam: 0.22, price: 60 },  // blue lacquer, silver bands
  legendary: { wood: 0xc9962c, metal: 0xfff0b0, size: 1.25, beam: 0.3,  price: 120 }, // gold, pale gold trim and a glow
};
// One set of materials per rarity, made once.
for (const L of Object.values(CHEST_LOOK)) {
  L.woodMat = std({ color: L.wood, roughness: 0.8 });
  L.metalMat = std({ color: L.metal, roughness: 0.35, metalness: 0.6 });
}
for (const [k, L] of Object.entries(CHEST_LOOK)) {
  L.beamMat = new THREE.MeshBasicMaterial({ color: RARITY[k].color, transparent: true, opacity: L.beam, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  L.glow = glow(RARITY[k].color);
}
const beamGeo = new THREE.CylinderGeometry(0.35, 0.6, 14, 10, 1, true).translate(0, 7, 0); // open tube, 14 m tall

/** What chest c costs right now (a boss's reward chest is free). */
const chestPrice = c => (c.free ? 0 : Math.round(CHEST_LOOK[c.rarity].price * (1 + PRICE_STEP * chestsOpened)));

/** A random spot for a chest: on dry, open ground in the arena, at least 25 m from the deer and other chests. */
function chestSpot() {
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * 6.28, d = 10 + Math.sqrt(Math.random()) * (RIDGE_R - 18);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (lakeAt(x, z)) continue;
    if (Math.hypot(x - player.pos.x, z - player.pos.z) < 25) continue;
    if (chests.some(c => Math.hypot(c.x - x, c.z - z) < 25)) continue;
    if (trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < 4) || rocks.some(k => (k.x - x) ** 2 + (k.z - z) ** 2 < (k.hr + 1) ** 2)) continue;
    return { x, z };
  }
  return null; // nowhere suitable this time; the respawn timer will try again
}

/**
 * Build a chest and add it to the world: by default a random rarity at a free spot.
 * `o` can fix the spot (x, z), the rarity, and make it free (boss rewards, bosses.js).
 */
function spawnChest(o = {}) {
  const at = o.x !== undefined ? o : chestSpot();
  if (!at) return false;
  const rarity = o.rarity || rollRarity(), L = CHEST_LOOK[rarity];
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.45, 0.6), L.woodMat, 0, 0.225, 0));                                  // box
  for (const x of [-0.3, 0.3]) g.add(mesh(new THREE.BoxGeometry(0.08, 0.47, 0.62), L.metalMat, x, 0.225, 0));   // bands
  if (rarity === 'rare' || rarity === 'legendary') // corner caps on the finer chests
    for (const x of [-0.44, 0.44]) for (const z of [-0.29, 0.29]) g.add(mesh(new THREE.BoxGeometry(0.06, 0.47, 0.06), L.metalMat, x, 0.225, z));
  // The lid hinges along the back edge, so it sits in a group pivoting there.
  const lid = new THREE.Group(); lid.position.set(0, 0.45, -0.3); g.add(lid);
  lid.add(mesh(new THREE.BoxGeometry(0.92, 0.2, 0.62), L.woodMat, 0, 0.1, 0.3));
  for (const x of [-0.3, 0.3]) lid.add(mesh(new THREE.BoxGeometry(0.08, 0.22, 0.64), L.metalMat, x, 0.1, 0.3));
  lid.add(mesh(new THREE.BoxGeometry(0.14, 0.14, 0.04), L.metalMat, 0, 0.02, 0.62)); // latch
  if (rarity === 'legendary') { const gem = mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshBasicMaterial({ color: 0xff5a6e }), 0, 0.22, 0.32); lid.add(gem); }
  const beam = new THREE.Mesh(beamGeo, L.beamMat); g.add(beam);
  if (rarity !== 'common') { const halo = new THREE.Sprite(L.glow); halo.scale.setScalar(rarity === 'legendary' ? 3 : 2); halo.position.y = 0.5; g.add(halo); }
  g.scale.setScalar(L.size);
  g.position.set(at.x, h(at.x, at.z), at.z);
  g.rotation.y = Math.random() * 6.28;
  scene.add(g);
  // floating label with rarity and price
  const label = document.createElement('div');
  label.className = 'chest-tag ' + rarity;
  document.body.appendChild(label);
  chests.push({ group: g, lid, beam, label, rarity, x: at.x, z: at.z, open: -1, free: !!o.free });
  return true;
}

/** The closed chest the deer is standing at, if any. */
function chestHere() {
  return chests.find(c => c.open < 0 && Math.hypot(player.pos.x - c.x, player.pos.z - c.z) < 1.8 && Math.abs(player.pos.y - c.group.position.y) < 2);
}

/** Try to buy and open the chest the deer is standing at (the E key, game.js). */
function openChest() {
  const c = chestHere();
  if (!c) return;
  const price = chestPrice(c);
  if (money < price) { sfx.nope(); flash('prompt', 'shake'); return; }
  money -= price;
  if (!c.free) { chestsOpened++; chestQueue.push(CHEST_RESPAWN); } // reward chests don't raise prices or take a map slot
  c.open = 0;
  c.beam.visible = false;
  c.label.remove();
  giveItem(rollItem(c.rarity), c.group.position.clone().add(P.set(0, 1.6, 0)));
  burst(c.group.position.clone().add(P.set(0, 0.6, 0)), CHEST_LOOK[c.rarity].metal, 12);
  sfx.chest();
  hud();
}

/** Animate chests, keep their labels and the E prompt up to date, and spawn replacements. Called every frame while playing. */
function stepChests(dt) {
  for (let i = chests.length - 1; i >= 0; i--) {
    const c = chests[i];
    if (c.open < 0) {
      // label: pinned above the chest, fading with distance, red price if you can't afford it
      const sp = tmp.copy(c.group.position); sp.y += 1.5; sp.project(camera);
      const d = Math.hypot(player.pos.x - c.x, player.pos.z - c.z);
      const show = sp.z < 1 && d < 45;
      c.label.style.display = show ? '' : 'none';
      if (show) {
        c.label.style.left = (sp.x * 0.5 + 0.5) * innerWidth + 'px';
        c.label.style.top = (-sp.y * 0.5 + 0.5) * innerHeight + 'px';
        c.label.style.opacity = Math.min(1, (45 - d) / 15);
        const price = chestPrice(c);
        c.label.innerHTML = RARITY[c.rarity].name + (c.free ? ' <b class="free">Free</b>' : ' <b class="' + (money >= price ? '' : 'short') + '">' + price + '</b>');
      }
    } else {
      // opened: the lid swings back, then the chest sinks away after 3 s
      c.open += dt;
      c.lid.rotation.x = -Math.min(1, c.open / 0.35) * 1.9;
      if (c.open > 3) c.group.position.y -= dt * 0.8;
      if (c.open > 4) { scene.remove(c.group); chests.splice(i, 1); }
    }
  }
  // the "press E" prompt
  const c = chestHere(), pr = $('prompt');
  pr.hidden = !c;
  if (c) {
    const price = chestPrice(c), can = money >= price;
    pr.className = can ? '' : 'short';
    pr.innerHTML = can ? '<kbd>E</kbd> Open ' + RARITY[c.rarity].name.toLowerCase() + ' chest · ' + (c.free ? 'free' : price + ' coins')
      : 'Need ' + price + ' coins for this ' + RARITY[c.rarity].name.toLowerCase() + ' chest (you have ' + Math.floor(money) + ')';
  }
  // replacements
  for (let i = chestQueue.length - 1; i >= 0; i--) {
    chestQueue[i] -= dt;
    if (chestQueue[i] <= 0) { if (spawnChest()) chestQueue.splice(i, 1); else chestQueue[i] = 2; }
  }
}

/** Hide chest labels and the prompt (while paused, in menus, or after death). */
function hideChestLabels() {
  for (const c of chests) if (c.label) c.label.style.display = 'none';
  $('prompt').hidden = true;
}

/** Clear every chest and lay out a fresh set. Called when a run starts. */
function resetChests() {
  for (const c of chests) { scene.remove(c.group); c.label.remove(); }
  chests.length = 0; chestQueue = [];
  for (let i = 0; i < CHESTS_AT_ONCE; i++) if (!spawnChest()) chestQueue.push(2);
}

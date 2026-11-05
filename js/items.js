/* =========================================================================
   items.js — stat items found in chests (chests.js), and `mod`, the
   player's stats with every item applied.

   Items are plain, stackable stat boosts: each copy adds the same flat
   amount again (two Heavy Stones = +30% damage). Rarer items are stronger.
   Weapons (weapons.js) read their numbers through `mod`, so an item like
   Heavy Stone boosts every weapon at once.
   ========================================================================= */

// How often each rarity comes out of a chest (weights out of 100), and its label color.
// Legendary chests are kept rare (bosses also drop a free one), with more rare and
// uncommon chests in between.
const RARITY = {
  common:    { name: 'Common',    weight: 52, color: '#f1e2bb' },
  uncommon:  { name: 'Uncommon',  weight: 30, color: '#a9d97a' },
  rare:      { name: 'Rare',      weight: 16, color: '#8fc8ff' },
  legendary: { name: 'Legendary', weight: 2,  color: '#ffcf5a' },
};

// Every item: id (used in code), name and text (shown when found), rarity, and `per`: what
// ONE copy adds, as [amount, wording] pairs where # stands for the amount (the pause screen
// multiplies it by how many you hold). What each one actually does is its line in `mod` below,
// so keep `per` in step with `mod`.
const ITEMS = [
  { id: 'vest',    name: 'Bark Vest',      rarity: 'common',    text: '+20 max HP, and heals 20', per: [[20, '+# max HP']] },
  { id: 'boots',   name: 'Trail Boots',    rarity: 'common',    text: '+0.5 m/s move speed', per: [[0.5, '+# m/s move speed']] },
  { id: 'pockets', name: 'Magnet Pockets', rarity: 'common',    text: '+1.5 m XP pickup range', per: [[1.5, '+# m XP pickup range']] },
  { id: 'notes',   name: 'Field Notes',    rarity: 'common',    text: '+12% XP from every orb', per: [[12, '+#% XP from every orb']] },
  { id: 'sap',     name: 'Sap Flask',      rarity: 'uncommon',  text: '+0.5 HP healed every second', per: [[0.5, '+# HP healed every second']] },
  { id: 'gloves',  name: 'Quick Gloves',   rarity: 'uncommon',  text: '+10% attack speed for every weapon', per: [[10, '+#% attack speed']] },
  { id: 'arm',     name: 'Strong Arm',     rarity: 'uncommon',  text: '+12% throw speed and range', per: [[12, '+#% throw speed and range']] },
  { id: 'wide',    name: 'Wide Pockets',   rarity: 'uncommon',  text: '+12% size and area for every weapon', per: [[12, '+#% size and area']] },
  { id: 'stone',   name: 'Heavy Stone',    rarity: 'rare',      text: '+15% damage for every weapon', per: [[15, '+#% damage']] },
  { id: 'clover',  name: 'Lucky Clover',   rarity: 'rare',      text: '+7% chance for a hit to deal triple damage', per: [[7, '#% chance of triple damage', 100]] },
  { id: 'bouncy',  name: 'Bouncy Sap',     rarity: 'rare',      text: 'Pine Balls and acorns bounce on to 1 more creature', per: [[1, '+# bounces for Pine Balls and acorns']] },
  { id: 'charm',   name: 'Pinecone Charm', rarity: 'rare',      text: 'Thrown hits splash 25% of their damage within 2.5 m', per: [[25, '#% of thrown damage splashed within 2.5 m']] },
  { id: 'quiver',  name: 'Extra Quiver',   rarity: 'legendary', text: '+1 ball, acorn, hive, frost cone, firefly and thorn', per: [[1, '+# ball, acorn, hive, frost cone, firefly and thorn']] },
  { id: 'heartwood', name: 'Heartwood Charm', rarity: 'legendary', text: '+40 max HP and +1 HP healed every second (heals 40)', per: [[40, '+# max HP'], [1, '+# HP healed every second']] },
  { id: 'golden',  name: 'Golden Antler',  rarity: 'legendary', text: '+25% damage and +20% attack speed for every weapon', per: [[25, '+#% damage'], [20, '+#% attack speed']] },
];

/** What n copies of an item add up to, in words: "+40 max HP · +2 HP healed every second". */
function itemBonus(it, n) {
  return it.per.map(([v, words, cap]) => words.replace('#', String(Math.round(Math.min(cap || Infinity, v * n) * 100) / 100))).join(' · ');
}
const ITEM = Object.fromEntries(ITEMS.map(it => [it.id, it])); // look up by id

// How many of each item the player holds, e.g. bag.stone = 2. All start at 0.
const bag = Object.fromEntries(ITEMS.map(it => [it.id, 0]));

// The player's stats with items applied. These are getters, so they always reflect the
// current bag. Multipliers start at 1; each item copy adds its flat amount.
const mod = {
  get maxHp() { return 100 + 20 * bag.vest + 40 * bag.heartwood; },
  get walk() { return 5.5 + 0.5 * bag.boots; },          // m/s; running is 1.8× this
  get pickupR() { return 2.6 + 1.5 * bag.pockets; },     // how close XP orbs start flying to you
  get xpMult() { return 1 + 0.12 * bag.notes; },
  get regen() { return 0.5 * bag.sap + 1 * bag.heartwood; }, // HP per second
  get haste() { return 1 + 0.1 * bag.gloves + 0.2 * bag.golden; }, // weapon cooldowns are divided by this
  get speed() { return 1 + 0.12 * bag.arm; },            // thrown speed (aimed throws reach the crosshair sooner)
  get area() { return 1 + 0.12 * bag.wide; },            // projectile size, blast and swarm radius
  get dmg() { return 1 + 0.15 * bag.stone + 0.25 * bag.golden; }, // damage multiplier for every weapon
  get crit() { return Math.min(1, 0.07 * bag.clover); }, // chance for triple damage
  get rico() { return bag.bouncy; },                     // extra ricochets for balls and acorns
  get splash() { return 0.25 * bag.charm; },             // share of a thrown hit's damage splashed nearby
  get extra() { return bag.quiver; },                    // extra projectiles per weapon
};

/** Pick a rarity at random, by weight. Each chest rolls this when it appears (chests.js). */
function rollRarity() {
  let r = Math.random() * 100;
  for (const [k, v] of Object.entries(RARITY)) if ((r -= v.weight) < 0) return k;
  return 'common';
}

/** Pick a random item of the given rarity. */
function rollItem(rarity) {
  const pool = ITEMS.filter(it => it.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Add one copy of an item to the bag and apply anything immediate. `at` is where to show its name. */
function giveItem(it, at) {
  bag[it.id]++;
  if (it.id === 'vest') hp = Math.min(mod.maxHp, hp + 20);      // Bark Vest heals right away
  if (it.id === 'heartwood') hp = Math.min(mod.maxHp, hp + 40); // and so does Heartwood Charm
  pop(at, it.name, it.text, 'item ' + it.rarity);
  renderOwned(); hud();
}

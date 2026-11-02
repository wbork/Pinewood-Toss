/* =========================================================================
   items.js — stat items found in chests (chests.js), and `mod`, the
   player's stats with every item applied.

   Items are plain, stackable stat boosts: each copy adds the same flat
   amount again (two Heavy Stones = +30% damage). Rarer items are stronger.
   Weapons (weapons.js) read their numbers through `mod`, so an item like
   Heavy Stone boosts every weapon at once.
   ========================================================================= */

// How often each rarity comes out of a chest (weights out of 100), and its label color.
const RARITY = {
  common:    { name: 'Common',    weight: 55, color: '#f1e2bb' },
  uncommon:  { name: 'Uncommon',  weight: 28, color: '#a9d97a' },
  rare:      { name: 'Rare',      weight: 13, color: '#8fc8ff' },
  legendary: { name: 'Legendary', weight: 4,  color: '#ffcf5a' },
};

// Every item: id (used in code), name and text (shown when found), rarity.
// What each one actually does is its line in `mod` below.
const ITEMS = [
  { id: 'vest',    name: 'Bark Vest',      rarity: 'common',    text: '+20 max HP, and heals 20' },
  { id: 'boots',   name: 'Trail Boots',    rarity: 'common',    text: '+0.5 m/s move speed' },
  { id: 'pockets', name: 'Magnet Pockets', rarity: 'common',    text: '+1.5 m XP pickup range' },
  { id: 'notes',   name: 'Field Notes',    rarity: 'common',    text: '+12% XP from every orb' },
  { id: 'sap',     name: 'Sap Flask',      rarity: 'uncommon',  text: '+0.5 HP healed every second' },
  { id: 'gloves',  name: 'Quick Gloves',   rarity: 'uncommon',  text: '+10% attack speed for every weapon' },
  { id: 'arm',     name: 'Strong Arm',     rarity: 'uncommon',  text: '+12% throw speed and range' },
  { id: 'wide',    name: 'Wide Pockets',   rarity: 'uncommon',  text: '+12% size and area for every weapon' },
  { id: 'stone',   name: 'Heavy Stone',    rarity: 'rare',      text: '+15% damage for every weapon' },
  { id: 'clover',  name: 'Lucky Clover',   rarity: 'rare',      text: '+7% chance for a hit to deal triple damage' },
  { id: 'bouncy',  name: 'Bouncy Sap',     rarity: 'rare',      text: 'Pine Balls and acorns bounce on to 1 more creature' },
  { id: 'charm',   name: 'Pinecone Charm', rarity: 'rare',      text: 'Thrown hits splash 25% of their damage within 2.5 m' },
  { id: 'quiver',  name: 'Extra Quiver',   rarity: 'legendary', text: '+1 ball, acorn, hive, frost cone, firefly and thorn' },
];
const ITEM = Object.fromEntries(ITEMS.map(it => [it.id, it])); // look up by id

// How many of each item the player holds, e.g. bag.stone = 2. All start at 0.
const bag = Object.fromEntries(ITEMS.map(it => [it.id, 0]));

// The player's stats with items applied. These are getters, so they always reflect the
// current bag. Multipliers start at 1; each item copy adds its flat amount.
const mod = {
  get maxHp() { return 100 + 20 * bag.vest; },
  get walk() { return 5.5 + 0.5 * bag.boots; },          // m/s; running is 1.8× this
  get pickupR() { return 2.6 + 1.5 * bag.pockets; },     // how close XP orbs start flying to you
  get xpMult() { return 1 + 0.12 * bag.notes; },
  get regen() { return 0.5 * bag.sap; },                 // HP per second
  get haste() { return 1 + 0.1 * bag.gloves; },          // weapon cooldowns are divided by this
  get speed() { return 1 + 0.12 * bag.arm; },            // thrown speed (so also range on flat arcs)
  get area() { return 1 + 0.12 * bag.wide; },            // projectile size, blast and swarm radius
  get dmg() { return 1 + 0.15 * bag.stone; },            // damage multiplier for every weapon
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
  if (it.id === 'vest') hp = Math.min(mod.maxHp, hp + 20); // Bark Vest heals right away
  pop(at, it.name, it.text, 'item ' + it.rarity);
  renderOwned(); hud();
}

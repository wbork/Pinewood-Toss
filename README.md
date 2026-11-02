# Pinewood Toss

A third-person survival game. You play a deer ranger in a hilly forest with three lakes, ringed by mountains. Creatures climb out of the ground and hunt you, and you fight back with up to four weapons. Defeated creatures drop blue XP orbs, and every level you pick a new weapon or an upgrade. Chests around the map hold stat items. The creatures get stronger and more numerous the longer you last, Bosses arrive at 5:00 and 10:00. Once the second one falls, the forest rages and you score points until you die.

## Playing

Open `index.html` in a browser (Edge or Chrome), or use the **Pinewood Toss** shortcut on the Desktop, which opens it in its own window. The **title screen** has the starting-weapon picker, your best runs, and a How to play guide. From the pause screen (Esc) you can resume or quit to the title.

| Control | Action |
|---|---|
| W A S D / arrow keys | Walk |
| Mouse | Look around |
| Click or hold (or F) | Fire your aimed weapons at the crosshair |
| Shift | Run |
| Space | Jump |
| Esc / P | Pause |
| E | Open the chest you're standing at (costs coins) |
| 1 / 2 / 3 | Pick a card on the level-up screen |

## Creatures and bosses

Every creature has a special ability that changes how you fight it:

| Creature | Appears | Ability |
|---|---|---|
| Bramble imp | from the start | **Pounce:** crouches (glowing), then leaps the last few meters. Keep moving. |
| Gloom wisp | 1:30 | **Shadow bolts:** hovers 8–12 m away and shoots slow bolts. Dodge or close in. |
| Spore puffer | 2:00 | **Toxic burst:** swells and pops into a poison cloud when it reaches you, and when it dies. Kill it from range. |
| Hollow stump | 3:00 | **Bark ward:** every creature inside its green ring takes half damage. Kill stumps first. |
| Shade stalker | 4:00 | **Ambush:** nearly invisible from afar; circles around to strike from behind. |
| Mossback | 5:00 | **Charge:** glows for a second, then charges in a straight line for heavy damage. Sidestep, then punish it while it's dazed. |
| Sap shaman | 6:00 | **Sap shields:** hangs back and coats up to 5 nearby creatures in an amber shield that soaks damage (half their health) until it breaks. Hunt it down. |

**Bosses** climb out of the ground with a health bar at the top of the screen:

- **5:00, The Thorn Queen:** a towering queen woven from brambles in a gown of thorns and roses. Rings of thorn bolts, broods of imps, and red slam circles under your feet.
- **10:00, The Hollow King** (much tougher): an empty husk, with a cage of bark ribs around a burning heart, a hollow mask and a crown. Roots erupting under you and around you, stomps that send a shockwave you must **jump**, ember barrages, and packs of stalkers.

Glowing means an attack is coming. Below half health a boss is enraged and attacks faster. Each boss drops a **free legendary chest**, a heart and a magnet. Regular spawns slow down by half during a boss fight.

**Endless phase and score:** when the Hollow King falls, the forest rages. From then on every kill scores points (10 per imp, more for bigger creatures), and you earn 5 points per second survived. Both are multiplied by how long you've lasted since the King: ×2 after a minute, ×3 after two, and so on. Spawns ramp up too, from a creature every 0.35 s and 90 alive up to one every 0.1 s and 150 alive. The **Best runs** board records each run's time and score, ranked by score and then by time.

## Weapons, synergies and items

You pick your **starting weapon** on the title screen (or on the game-over screen before trying again). The choice is remembered. You can carry **4 weapons**, each upgradable to **level 8**. Each level-up deals three cards: new weapons (only while a slot is free) and upgrades for weapons you own. Once all four slots are full, only upgrades are offered. When everything is maxed, a level-up heals you instead.

**Fusions:** when both weapons of a synergy pair reach level 8, they fuse into one named weapon (for example Frost Cone + Antler Sweep = Glacier Antlers). It takes a single slot, so the other slot frees up and new weapons are offered again. Both halves keep working, and they get much stronger: 60% more damage, 30% shorter cooldowns, 25% more reach, plus a power unique to that fusion (Glacier Antlers' sweeps chill everything and do quadruple damage to chilled creatures, for example). In testing, a fused pair did about 2.4× the damage of the same two weapons at level 8 apart. Each weapon can be in only one fusion, so a full late-game loadout can hold up to 8 weapons as 4 fusions.

| Weapon | Kind | Playstyle |
|---|---|---|
| Pine Ball | Aimed | Arcing balls that bounce and roll |
| Acorn Sling | Aimed | Hold to fire a fast stream of piercing acorns |
| Beehive | Aimed | Lobbed hive that leaves a poisoning bee swarm |
| Frost Cone | Aimed | Lobbed burst that chills creatures to half speed |
| Antler Sweep | Automatic | Spin attack that hits and knocks back everything close |
| Thorn Ring | Automatic | Thorns orbit you and cut what they touch |
| Firefly Lantern | Automatic | Homing fireflies that set creatures burning |
| Mushroom Mines | Automatic | Traps planted as you walk; they blast when creatures step close |

Aimed weapons all fire together when you click, each on its own cooldown. Automatic weapons work by themselves.

**Synergies** switch on when you own both weapons of a pair: Avalanche (Pine Ball + Frost Cone), Hunter's Mark (Pine Ball + Firefly), Cold Snap (Acorn + Frost), Honey Glaze (Acorn + Beehive), Smoked Hive (Beehive + Firefly), Shatter (Frost + Antler), Bramble Crown (Thorn + Antler), Toxic Thorns (Thorn + Mushroom), Wildfire (Firefly + Mushroom) and Hive Mind (Beehive + Mushroom). The level-up cards say which synergy a new weapon would switch on, and active ones show under the scoreboard.

**Coins** drop from every creature. They're worth more as the run gets harder, on a smooth curve: 1 per imp at the start, about 3.4 at 5 minutes and 6.7 at 15 minutes.

**Chests** cost coins: walk up and press **E**. There are 5 on the map at once, and an opened one is replaced 40 s later. Each chest's rarity is decided when it appears. It shows in the chest itself (plain wood, mossy green, blue with silver, or gold) and in the color of its light beam. A label above each chest gives its rarity and price. Base prices are 15 / 30 / 60 / 120 coins, and every chest you buy raises them by 20% of base.

**Items** come from chests. Each item is a flat stat boost that stacks with every copy you find. Rarer items are stronger: common (Bark Vest, Trail Boots, Magnet Pockets, Field Notes), uncommon (Sap Flask, Quick Gloves, Strong Arm, Wide Pockets), rare (Heavy Stone, Lucky Clover, Bouncy Sap, Pinecone Charm) and legendary (Extra Quiver).

## Project layout

```
index.html        page structure: HUD, menus, and the list of scripts to load
css/style.css     every style for the HUD and menus
lib/three.min.js  the three.js 3D engine (r128), stored locally so the game works offline
js/               the game code, one file per area (below)
icon.ico/png      app icon used by the Desktop shortcut
```

### The `js/` files, in load order

| File | What it does |
|---|---|
| `core.js` | Shared helpers: seeded random numbers, smoothstep, `$()`, scratch vectors |
| `terrain.js` | Ground height function `h(x, z)`, the arena's size, hills, and lakes (`surfH`, `waterDepth`) |
| `state.js` | Every value that changes during a run (HP, timers, screen flags, input) |
| `scene.js` | Renderer, camera, sky, sun, and the shift to dusk over time |
| `dither.js` | The see-through effect for trees and rocks that hide the deer |
| `world.js` | Builds the ground, mountains, trees, rocks, bushes and lake water, plus collision helpers (`rockTop` for standing on rocks) |
| `materials.js` | Textures drawn in code, shared materials, and the `mesh()` helper |
| `audio.js` | All sound effects, made with the Web Audio API (no sound files) |
| `hud.js` | Scoreboard, HP/XP bars, your weapons/synergies/items, floating damage text |
| `besttimes.js` | The "Best runs" board: your 10 best runs by score and time, saved in this browser |
| `effects.js` | Flying chips and splash rings |
| `items.js` | Chest items and their rarities, and `mod`: the player's stats with items applied |
| `pickups.js` | XP orbs, hearts and magnets |
| `hazards.js` | Creature attacks that hurt the deer: bolts, poison clouds, telegraphed ground eruptions, shockwaves |
| `creatures.js` | Each creature's stats, model, animation and special ability (`ai`) |
| `enemies.js` | Spawning, difficulty scaling, chasing, attacking, status effects, the stump ward, taking damage |
| `deer.js` | The deer ranger model and its animations |
| `camera.js` | Over-the-shoulder camera and crosshair aiming |
| `combat.js` | Launching projectiles and their physics (bounce, pierce, ricochet, burst) |
| `weapons.js` | The eight weapons, their upgrades, synergies, and what they leave in the world (swarms, thorns, fireflies, mines) |
| `levelup.js` | XP, leveling, and the level-up menu (enforces the 4-weapon limit) |
| `chests.js` | Chests: rarity looks, prices, labels, buying with E, replacing them |
| `bosses.js` | The two bosses (models, attacks, schedule), the boss health bar and banner, and the endless score phase |
| `player.js` | Player movement and taking damage |
| `game.js` | Input, the title / how-to-play / pause / game-over screens, starting and resetting runs, and the main loop |

The scripts are plain `<script>` files rather than modules, so the game runs straight from disk without a web server. Anything one file declares at the top level is available to the files loaded after it, so **the order in `index.html` matters**. A file can only use things from files above it while it's loading. Inside functions that run later, during the game, it can use anything.

## Best runs

The title and game-over screens show a **Best runs** board with your 10 best runs: the date, level, kills, time survived and score. They're ranked by score, then time; score only counts after the Hollow King. The run that just ended is highlighted. Runs are saved in the browser's storage, so each browser (and each computer) keeps its own list. Clearing the browser's site data wipes it.

## Common tweaks

- **Arena size, hills, lakes and the mountains around them:** `ARENA_R`, `HILLS`, `LAKES` and `PEAKS` at the top of `js/terrain.js`. Keep hills and lakes apart, since a lake flattens the ground out to 1.6× its radius.
- **How many trees, rocks and bushes:** the counts in `js/world.js`
- **Creature stats, abilities and new creature types:** `FOES` in `js/creatures.js`
- **Boss timing, health, damage and attacks:** `BOSS_SCHEDULE` and the two `FOES` entries in `js/bosses.js`
- **How fast difficulty ramps up:** `power()` and `director()` in `js/enemies.js`
- **Weapon numbers and upgrades:** each weapon's `stats(L)` and `ups` in `js/weapons.js`; the slot and level limits are `MAX_WEAPONS` and `MAX_LEVEL`
- **Synergies:** `SYNERGIES` in `js/weapons.js` (the effect itself lives in the weapon code that checks `syn('id')`)
- **Items and rarity odds:** `ITEMS`, `RARITY` and `mod` in `js/items.js`
- **How many chests and how fast they come back:** `CHESTS_AT_ONCE` and `CHEST_RESPAWN` in `js/chests.js`
- **Chest looks and prices:** `CHEST_LOOK` and `PRICE_STEP` in `js/chests.js`
- **Coins per creature:** `coin` in each `FOES` entry (`js/creatures.js`), and the difficulty curve `power().coin` in `js/enemies.js`
- **Fusion names, powers and bonus:** `fusion` and `power` in `SYNERGIES`, and `FUSE_DMG` / `FUSE_CD` / `FUSE_AREA` in `js/weapons.js` (each power's effect is in the weapon code that checks `fz('id')`)
- **Drop chances for hearts and magnets:** `killFoe()` in `js/enemies.js`
- **Camera distance and offset:** `CAM` in `js/camera.js`
- **Colors and fonts of the menus:** the variables at the top of `css/style.css`

# Pinewood

A third-person survival game. You play a deer ranger in a hilly forest with lakes (a new, randomly generated map every run), ringed by mountains. Creatures climb out of the ground and hunt you, and you fight back with up to four weapons. Defeated creatures drop blue XP orbs, and every level you pick a new weapon or an upgrade. Chests around the map hold stat items. The creatures get stronger and more numerous the longer you last. Bosses arrive at 5:00 and 10:00. Once the second one falls, the forest rages and you score points until you die.

**Why here:** a cult that worships the Hollow King has been holding its rites in these woods. It's always dusk (a low orange sun, a bruised purple sky, mauve fog creeping in close, deepening toward night as a run goes on), and every map is scattered with what the cult left behind: ritual sites with the King's sigil burned glowing into the ground, an altar with a deer skull and candles, a ring of carved standing stones, antlered totems and a wicker effigy of the King, plus lone totems, stones and effigies among the trees. The King's sigil (a ring, antlers, a crown and a skull) is carved into the stones, stitched onto the shaman's robe and branded into Mossback's brow.

## Playing

Open `index.html` in a browser (Edge or Chrome), or use the **Pinewood** shortcut on the Desktop, which opens it in its own window. The **title screen** is a fixed forest scene: the ranger front and center (the menus sit to either side) with every monster in the game spread out behind him in their idle animations, each in clear view: the Hollow King on his glowing sigil before his altar right behind the ranger, his cult priest beside the altar, the Thorn Queen at the back (`TITLE_CAST` in `js/game.js`, `TITLE_SITE` in `js/world.js`). It has the starting-weapon picker, your best runs, and a How to play guide. From the pause screen (Esc) you can resume or quit to the title; it also lists your items, and hovering one shows what your copies add now, what another copy would add, and the new total. **Every run is on a new, randomly generated map**: new hills, lakes (2 to 4), forest, rocks, ridge line and mountains. (The title screen always uses its own map, `TITLE_SEED` in `js/terrain.js`, with a clear stage for the monsters.)

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

What they look like:
- **Bramble imp:** a gaunt, hunched ghoul with its ribs showing, a long skull with four sunken amber eyes and a grin of needle teeth, swept-back horns, long clawed arms and a thorny whip of a tail.
- **Gloom wisp:** a wraith: a pale skull deep in a tattered hood (its jaw drops as it charges a bolt), bony clawed arms that reach for you, a shroud that frays into strips and wisps of shadow, and violet soul crystals circling it.
- **Spore puffer:** a sickly walking mushroom with a round lamprey mouth of teeth in its stem, mismatched glowing eyes and a drooping cap of glowing spore sacs.
- **Hollow stump:** a rotting trunk split by a maw of splinter teeth, five mismatched ember eyes set into the bark that blink one at a time, dead moss and shelf fungus, and long root arms.
- **Shade stalker:** a starved shadow wolf, spine and ribs showing, six cyan eyes, a long jaw of teeth, ragged ears and a tail that frays into smoke.
- **Mossback:** a boulder beast the cult chained and branded: lava glowing through its cracks, rusted chains round its body, broken shackles on its wrists, and the King's sigil burned into its brow above a tusked maw.
- **Sap shaman:** a cultist priest of the Hollow King in a crimson robe stitched with gold sigils, an antlered deer-skull mask with ember eyes, bone charms, and a staff crowned with an antlered skull holding the glowing sap crystal in its jaws.

**Bosses** climb out of the ground with a health bar at the top of the screen:

- **5:00, The Thorn Queen:** a towering queen woven from brambles: a bell gown layered with rose petals and wrapped in thorny vines, a great fan of thorn branches behind her head, and a crown of thorns with a glowing rose. Rings of thorn bolts plus fans aimed where you're heading, **thorn lashes** (eruptions racing along the ground toward you: sidestep), **bramble cages** (thorns ring you with one gap; get out before the middle erupts), broods of imps, slam circles under your feet, and if you run too far she **blinks** to your side.
- **10:00, The Hollow King** (much tougher): a king made of bones, hunched forward: ribs from many rib cages, crossed long bones and the skulls of lesser beasts (embers in their eyes) fused around a beating core, with shards of bone orbiting it; a stag's skull for a face (a jaw that gapes, embers in the sockets, fire glowing through its cracks) under a gold crown and great dead-wood antlers; great skulls as gold-rimmed pauldrons, gold chains, a fur mantle, a ragged red-lined cape, arms of bundled bones with bone claws, and vertebrae dangling beneath him. Roots under and around you, **grasping roots** that keep landing where you're heading, stomps that send a shockwave you must **jump**, aimed ember barrages, packs of stalkers, and if you run too far a **crushing leap** onto your spot.

Bosses are a threat rather than just tough: their aimed attacks lead you (they fire where you're heading), they chase harder when you're far and close the gap if you run, attacks come quickly, and once enraged they chain a second attack straight after the first. Everything is telegraphed (glows, red circles, wind-ups), so you survive by reading them.

Glowing means an attack is coming. The first time a boss drops below half health it **roars**: it rears up, flings its arms out and bellows for 2.2 s while shock rings roll out, and it's **immune to damage** the whole time (hits show "Immune" and the health bar turns amber), so the roar isn't free damage. After that it's enraged and attacks faster. Each boss drops a **free legendary chest**, a heart and a magnet. Regular spawns slow down by half during a boss fight.

**Endless phase and score:** when the Hollow King falls, the forest rages. From then on every kill scores points (10 per imp, more for bigger creatures), and you earn 5 points per second survived. Both are multiplied by how long you've lasted since the King: ×2 after a minute, ×3 after two, and so on. Spawns ramp up too, from a creature every 0.35 s and 90 alive up to one every 0.1 s and 150 alive. The **Best runs** board records each run's time and score, ranked by score and then by time.

## Weapons, synergies and items

You pick your **starting weapon** on the title screen (or on the game-over screen before trying again). The choice is remembered. You can carry **4 weapons**, each upgradable to **level 8**. Each level-up deals three cards: new weapons (only while a slot is free) and upgrades for weapons you own. Once all four slots are full, only upgrades are offered. When everything is maxed, a level-up heals you instead.

**Fusions:** when both weapons of a synergy pair reach level 8, they fuse into one named weapon (for example Frost Cone + Antler Sweep = Glacier Antlers). It takes a single slot, so the other slot frees up and new weapons are offered again. Both halves keep working, and they get much stronger: 60% more damage, 30% shorter cooldowns, 25% more reach, plus a power unique to that fusion (Glacier Antlers' sweeps chill everything and do quadruple damage to chilled creatures, for example). In testing, a fused pair did about 2.4× the damage of the same two weapons at level 8 apart. Each weapon can be in only one fusion, so a full late-game loadout can hold up to 8 weapons as 4 fusions.

| Weapon | Kind | Playstyle |
|---|---|---|
| Pine Ball | Aimed | Balls that bounce and roll |
| Acorn Sling | Aimed | Hold to fire a fast stream of piercing acorns |
| Beehive | Aimed | A thrown hive that leaves a poisoning bee swarm |
| Frost Cone | Aimed | A thrown burst that chills creatures to half speed |
| Antler Sweep | Automatic | Spin attack that hits and knocks back everything close |
| Thorn Ring | Automatic | Thorns orbit you and cut what they touch |
| Firefly Lantern | Automatic | Homing fireflies that set creatures burning |
| Mushroom Mines | Automatic | Traps planted as you walk; they blast when creatures step close |

Aimed weapons all fire together when you click, each on its own cooldown. Every aimed weapon flies dead straight to the crosshair, then falls, bounces or bursts there. Automatic weapons work by themselves.

**Gear on the ranger:** every weapon you carry shows on the model (`js/gear.js`): a ball satchel on the right hip (Pine Ball), a slingshot in the left hand (Acorn Sling), a beehive hanging off the pack (Beehive), an icy canister on the pack (Frost Cone), brass bands on the antlers (Antler Sweep), a bramble bracer on the right forearm (Thorn Ring), a glowing lantern under the pack (Firefly Lantern) and a basket of mushrooms on the left hip (Mushroom Mines). When two weapons fuse, their two pieces are replaced by one fused piece, such as an icy satchel for Avalanche, an ice slingshot for Cold Snap, ice crystals on the antlers for Shatter, a crown of thorns for Bramble Crown, or a hive sprouting mushrooms for Hive Mind.

**Synergies** switch on when you own both weapons of a pair: Avalanche (Pine Ball + Frost Cone), Hunter's Mark (Pine Ball + Firefly), Cold Snap (Acorn + Frost), Honey Glaze (Acorn + Beehive), Smoked Hive (Beehive + Firefly), Shatter (Frost + Antler), Bramble Crown (Thorn + Antler), Toxic Thorns (Thorn + Mushroom), Wildfire (Firefly + Mushroom) and Hive Mind (Beehive + Mushroom). The level-up cards say which synergy a new weapon would switch on, and active ones show under the scoreboard.

**Coins** drop from every creature. They're worth more as the run gets harder, on a smooth curve: 1 per imp at the start, about 3.4 at 5 minutes and 6.7 at 15 minutes.

**Chests** cost coins: walk up and press **E**. There are 5 on the map at once, and an opened one is replaced 40 s later. Each chest's rarity is decided when it appears. It shows in the chest itself (plain wood, mossy green, blue with silver, or gold) and in the color of its light beam. A label above each chest gives its rarity and price. The odds are 52% common, 30% uncommon, 16% rare and 2% legendary (boss chests are always legendary). Base prices are 15 / 30 / 60 / 120 coins, and every chest you buy raises them by 20% of base.

**Items** come from chests. Each item is a flat stat boost that stacks with every copy you find. Rarer items are stronger: common (Bark Vest, Trail Boots, Magnet Pockets, Field Notes), uncommon (Sap Flask, Quick Gloves, Strong Arm, Wide Pockets), rare (Heavy Stone, Lucky Clover, Bouncy Sap, Pinecone Charm) and legendary, one picked at random so you don't know what you'll get: Extra Quiver (+1 ball, acorn, hive, frost cone, firefly and thorn), Heartwood Charm (+40 max HP and 1 HP healed per second) or Golden Antler (+25% damage and +20% attack speed for every weapon).

## Project layout

```
index.html        page structure: HUD, menus, and the list of scripts to load
css/style.css     every style for the HUD and menus
lib/three.min.js  the three.js 3D engine (r128), stored locally so the game works offline
js/               the game code, one file per area (below)
icon.ico/png      app icon used by the Desktop shortcut
```

### Models made in Blender (`blender/`)

Every model (the ranger, all creatures and both bosses, and the dropped items) is modeled in Blender (5.2, the Microsoft Store version, whose command is `blender-launcher`) by scripts, and exported to JavaScript files the game loads straight from disk (no glTF loader, so it also works opened from the folder):

| File | What it does |
|---|---|
| `blender/pwkit.py` | The shared modeling toolkit: game-space coordinates, materials, low-poly shapes (loft, sweep, prism, skin-modifier branches), ray casts to sit details on a surface, and rigging. Its style rules: flat-shaded, deliberate facets, mirrored sides, no metaballs or Decimate. |
| `blender/build_ranger.py` | The ranger: lofted body and deer head (painted faces for the muzzle, eye rings, nose), leaf ears, skin-modifier antlers, the uniform and gear, and an armature with the game's bones plus ear, eye and tail bones. |
| `blender/build_creatures.py` | Every creature and both bosses, each with its own skeleton (jaws, knees, elbows, tail segments...). Run one with `-- build_creatures imp`. |
| `blender/build_props.py` | The dropped items (the heart, the XP magnet, the XP gem and the coin) and the cult's fixtures (altar, carved standing stone, totem, wicker effigy, ground sigil, candles), all in `props.blend`. |
| `blender/*.blend` | The models. Open them in Blender to look, pose or edit. Each material's viewport color is the color the game uses (custom property `emit` makes it glow). |
| `blender/pinewood_export.py` | Exports a .blend to `js/models/<name>.js`: a rigged file as bones plus one skinned mesh grouped by material; a file without an armature as a set of props (one per Empty). |
| `blender/export_model.cmd` | Re-export after editing by hand: `blender\export_model.cmd imp`. Check `blender/export_log.txt` for DONE. |
| `blender/run.py` | Runs a build script in the background and logs to `<script>_log.txt` (the Store Blender shows no console). |
| `js/models/*.js` | The exported models. `deer.js`, `creatures.js` (`useModel`), `bosses.js` and `pickups.js` (`propMesh`) build from them. |

To rebuild from a script: `blender-launcher --background --factory-startup --python blender\run.py -- build_creatures` (or `build_ranger`, `build_props`). **The build scripts overwrite their .blend files**, so once you edit a model by hand, only re-export it.

### The `js/` files, in load order

| File | What it does |
|---|---|
| `core.js` | Shared helpers: seeded random numbers, smoothstep, `$()`, scratch vectors |
| `terrain.js` | Ground height function `h(x, z)`, the arena's size, and `generateTerrain(seed)`: each map's hills, lakes, ripples, ridge and mountains (`surfH`, `waterDepth`) |
| `state.js` | Every value that changes during a run (HP, timers, screen flags, input) |
| `scene.js` | Renderer, camera, the dusk sky (orange at the sun, violet to indigo overhead) and low sun, fog, and `dusk()`: the slow slide toward night over a run |
| `dither.js` | The see-through effect for trees and rocks that hide the deer |
| `world.js` | `newMap()` / `buildWorld()`: builds (and rebuilds, every run) the ground, trees, rocks, bushes and lake water, lays out the cult's ritual sites and fixtures (`layCult`; the solid ones collide like trunks), plus collision helpers (`rockTop` for standing on rocks) |
| `materials.js` | Textures drawn in code, shared materials, the `mesh()` helper, and the loaders for Blender models (`modelGeometry`, `modelMaterial`, `propMesh`) |
| `audio.js` | All sound effects, made with the Web Audio API (no sound files) |
| `hud.js` | Scoreboard, HP/XP bars, your weapons/synergies/items, floating damage text |
| `besttimes.js` | The "Best runs" board: your 10 best runs by score and time, saved in this browser |
| `effects.js` | Flying chips and splash rings |
| `items.js` | Chest items and their rarities, and `mod`: the player's stats with items applied |
| `pickups.js` | XP orbs, hearts and magnets |
| `hazards.js` | Creature attacks that hurt the deer: bolts, poison clouds, telegraphed ground eruptions, shockwaves |
| `creatures.js` | Each creature's stats, special ability (`ai`) and animation; `useModel` gives a creature its Blender model and skeleton, and the animations ease each bone (follow-through, anticipation, eased states) |
| `enemies.js` | Spawning, difficulty scaling, chasing, attacking, status effects, the stump ward, taking damage |
| `models/*.js` | The Blender models (see above) |
| `cult.js` | Draws the cult's fixtures from `props.js` (one instanced mesh per kind; each ground sigil bent to follow the ground) with flickering candle and sigil glows (`stepCult`) |
| `deer.js` | The deer ranger model and its animations |
| `camera.js` | Over-the-shoulder camera and crosshair aiming |
| `combat.js` | Launching projectiles and their physics (bounce, pierce, ricochet, burst) |
| `weapons.js` | The eight weapons, their upgrades, synergies, and what they leave in the world (swarms, thorns, fireflies, mines) |
| `gear.js` | The model of each weapon and fusion, worn on the ranger (rebuilt whenever your weapons change) |
| `levelup.js` | XP, leveling, and the level-up menu (enforces the 4-weapon limit) |
| `chests.js` | Chests: rarity looks, prices, labels, buying with E, replacing them |
| `bosses.js` | The two bosses (models, attacks, the enrage roar, schedule), the boss health bar and banner, and the endless score phase |
| `player.js` | Player movement and taking damage |
| `game.js` | Input, the title / how-to-play / pause / game-over screens, starting and resetting runs, and the main loop |

The scripts are plain `<script>` files rather than modules, so the game runs straight from disk without a web server. Anything one file declares at the top level is available to the files loaded after it, so **the order in `index.html` matters**. A file can only use things from files above it while it's loading. Inside functions that run later, during the game, it can use anything.

## Best runs

The title and game-over screens show a **Best runs** board with your 10 best runs: the date, level, kills, time survived and score. They're ranked by score, then time; score only counts after the Hollow King. The run that just ended is highlighted. Runs are saved in the browser's storage, so each browser (and each computer) keeps its own list. Clearing the browser's site data wipes it.

## Common tweaks

- **Arena size, hills, lakes and the mountains around them:** `ARENA_R`, `HILLS`, `LAKES` and `PEAKS` at the top of `js/terrain.js`. Keep hills and lakes apart, since a lake flattens the ground out to 1.6× its radius.
- **How many trees, rocks and bushes:** the counts in `js/world.js`
- **Creature stats, abilities and new creature types:** `FOES` in `js/creatures.js`
- **What each weapon looks like on the ranger:** `GEAR` in `js/gear.js` (one builder per weapon or fusion, attached to a bone)
- **How long a boss roars (and is immune):** `ROAR_T` in `js/bosses.js`
- **How hard the bosses press:** in each boss's `ai` line in `js/bosses.js`: the seconds between attacks, the gap-closer move, and how far you can get before they use it; the combo chance is in `bossAI`
- **What a map can contain:** `generateTerrain` in `js/terrain.js` (how many lakes and hills, their sizes)
- **What each item adds per copy (pause-screen hover):** `per` on each item in `js/items.js` (keep it in step with `mod`)
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

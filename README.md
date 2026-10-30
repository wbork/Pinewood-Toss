# Pinewood Toss

A third-person survival game. You play a deer ranger in a forest ringed by mountains. Creatures climb out of the ground and hunt you, and you fight back by throwing balls. Defeated creatures drop blue XP orbs, and every level you pick one of three perks. The creatures get stronger and more numerous the longer you last, so the goal is to survive as long as you can.

## Playing

Open `index.html` in a browser (Edge or Chrome), or use the **Pinewood Toss** shortcut on the Desktop, which opens it in its own window.

| Control | Action |
|---|---|
| W A S D / arrow keys | Walk |
| Mouse | Look around |
| Click (or F) | Throw a ball at the crosshair |
| Shift | Run |
| Space | Jump |
| Esc / P | Pause |
| 1 / 2 / 3 | Pick a perk on the level-up screen |

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
| `terrain.js` | Ground height function `h(x, z)` and the arena's size |
| `state.js` | Every value that changes during a run (HP, timers, screen flags, input) |
| `scene.js` | Renderer, camera, sky, sun, and the shift to dusk over time |
| `dither.js` | The see-through effect for trees and rocks that hide the deer |
| `world.js` | Builds the ground, mountains, trees, rocks and bushes, plus collision helpers |
| `materials.js` | Textures drawn in code, shared materials, and the `mesh()` helper |
| `audio.js` | All sound effects, made with the Web Audio API (no sound files) |
| `hud.js` | Scoreboard, HP/XP bars, owned-perk list, floating damage text |
| `effects.js` | Flying chips and splash rings |
| `perks.js` | Perk list, how ranks change your stats (`mod`), XP and leveling, the perk menu |
| `pickups.js` | XP orbs, hearts and magnets |
| `creatures.js` | Each creature's stats, model and animation |
| `enemies.js` | Spawning, difficulty scaling, chasing, attacking, taking damage |
| `deer.js` | The deer ranger model and its animations |
| `camera.js` | Over-the-shoulder camera and crosshair aiming |
| `combat.js` | Throwing balls and ball physics |
| `player.js` | Player movement and taking damage |
| `game.js` | Input, menus, start/pause/game over, and the main loop |

The scripts are plain `<script>` files rather than modules, so the game runs straight from disk without a web server. Anything one file declares at the top level is available to the files loaded after it, so **the order in `index.html` matters**. A file can only use things from files above it while it's loading. Inside functions that run later, during the game, it can use anything.

## Common tweaks

- **Creature stats and new creature types:** `FOES` in `js/creatures.js`
- **How fast difficulty ramps up:** `power()` and `director()` in `js/enemies.js`
- **Perks:** add an entry to `PERKS` and a line to `mod` in `js/perks.js`
- **Drop chances for hearts and magnets:** `killFoe()` in `js/enemies.js`
- **Camera distance and offset:** `CAM` in `js/camera.js`
- **Colors and fonts of the menus:** the variables at the top of `css/style.css`

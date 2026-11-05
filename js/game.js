/* =========================================================================
   game.js — ties everything together: mouse and keyboard input, the
   title / pause / game-over screens, starting and resetting a run, and the
   main loop that updates and draws every frame. Loaded last.
   ========================================================================= */

// ---------- Mouse capture ----------

/** Capture the mouse so moving it turns the camera. Some browsers or embeds refuse; then drag-to-look takes over. */
function lockPointer() {
  try {
    const p = canvas.requestPointerLock && canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* drag-to-look still works */ }
}

/** Forget held keys and any drag, so nothing stays "pressed" while a menu is open. */
function releaseInput() { drag = null; firing = false; for (const k in keys) keys[k] = false; }

// ---------- Screens ----------

/** Show or hide the title screen. The HUD is hidden while it's up (the "on-title" class, style.css). */
function showTitle(on) {
  $('title').hidden = !on;
  document.body.classList.toggle('on-title', on);
}

/** Pause and show the pause screen with a short progress summary. */
function showPause() {
  playing = false;
  $('pause').hidden = false;
  $('blurb').textContent = 'Paused at ' + clockText(runTime) + ', level ' + prog.level + '. ' + stats.kills + (stats.kills === 1 ? ' creature' : ' creatures') + ' down so far' +
    (endless ? ', ' + score.toLocaleString() + ' points.' : '.');
  renderPauseItems(); // hud.js: your items, with hover details
  releaseInput();
}

/** Start the game, or resume from pause. Runs on a click, which browsers require for audio and mouse capture. */
function start() {
  initAudio();
  if (ac && ac.state === 'suspended') ac.resume();
  if (!started) { newMap(); resetRun(); } // a fresh random map for the run (the title has its own); the run starts empty
  started = playing = true;
  showTitle(false); $('pause').hidden = true;
  lockPointer();
  canvas.focus();
}

/** Leave the run and go back to the title screen. */
function quitToTitle() {
  $('pause').hidden = true; $('over').hidden = true;
  dead = false; playing = false;
  if (locked) document.exitPointerLock();
  newMap(TITLE_SEED, true); // back to the title screen's own forest
  resetRun();
  started = false;
  titleShowcase();
  showTitle(true);
}

$('go').addEventListener('click', start);
$('resume').addEventListener('click', start);
$('quit').addEventListener('click', quitToTitle);
$('to-title').addEventListener('click', quitToTitle);
$('howto-open').addEventListener('click', () => { $('howto').hidden = false; showTitle(false); document.body.classList.add('on-title'); });
$('howto-close').addEventListener('click', () => { $('howto').hidden = true; showTitle(true); });

/** The deer's HP reached 0: stop, add the run to the best times, and show the game-over screen. */
function gameOver() {
  dead = true; playing = false;
  releaseInput();
  if (locked) document.exitPointerLock();
  const record = runTime > best;
  if (record) { best = runTime; try { localStorage.setItem('pinewood-best', String(best)); } catch (e) { /* not saved */ } }
  recordRun({ t: Math.round(runTime * 10) / 10, score, kills: stats.kills, level: prog.level, at: Date.now() }); // besttimes.js
  $('over-time').textContent = clockText(runTime);
  $('over-facts').innerHTML = (score ? '<span>Score <b class="gold">' + score.toLocaleString() + '</b></span>' : '') +
    '<span>Level <b>' + prog.level + '</b></span><span>Creatures <b>' + stats.kills + '</b></span>' +
    '<span>' + (record ? '<b>New best time</b>' : 'Best <b>' + clockText(best) + '</b>') + '</span>';
  $('over').hidden = false;
  sfx.death();
  hud();
}

/**
 * Clear the world and put every run value back to its starting point. (The map itself is
 * changed by newMap: every run gets a fresh random one, and the title screen has its own.)
 */
function resetRun() {
  // remove everything the last run left in the world
  for (const e of foes) scene.remove(e.group);
  for (const b of balls) scene.remove(b.mesh);
  for (const o of orbs) scene.remove(o.g);
  for (const it of drops) scene.remove(it.g);
  for (const c of chips) scene.remove(c.m);
  for (const q of rings) scene.remove(q.m);
  for (const q of pops) q.el.remove();
  for (const list of [foes, balls, orbs, drops, chips, rings, pops]) list.length = 0;
  // progress, weapons (back to one Pine Ball), items, and a fresh set of chests
  stats.kills = 0; stats.throws = 0;
  Object.assign(prog, { level: 1, xp: 0, pending: 0 });
  money = 0; chestsOpened = 0;
  for (const k in bag) bag[k] = 0;
  resetWeapons();
  resetChests();
  clearHazards();
  resetBosses();
  renderOwned();
  // the deer and camera
  player.pos.set(0, h(0, 0), 0); player.vel.set(0, 0, 0); player.vy = 0; player.standOn = null; player.wet = false;
  yaw = 0; pitch = 0; camLen = CAM.back;
  deer.facing = 0; deer.fall = 0; deer.flash = 0; deer.throwT = 0;
  for (const m of deer.mats) m.emissive.setRGB(0, 0, 0);
  // timers
  hp = mod.maxHp; iframes = 0; hurtFlash = 0; shake = 0; runTime = 0; spawnT = 2.5; lastThreat = 1;
  $('clock').textContent = '0:00'; $('threat').textContent = '1';
  dusk();
  hud();
}

$('again').addEventListener('click', () => {
  $('over').hidden = true;
  dead = false;
  newMap();             // a fresh random map for the new run
  resetRun();
  start();
});

// Losing mouse capture (e.g. pressing Esc) while playing pauses the game.
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) wasLocked = true;
  else if (wasLocked && playing) showPause();
});

// ---------- Keyboard ----------
addEventListener('keydown', e => {
  if (choosing) { // level-up menu: 1, 2, 3 pick a card
    const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (i >= 0) pickCard(i);
    return;
  }
  if (!playing) return;
  keys[e.code] = true;                        // (holding F fires too: see the main loop)
  if (e.code === 'Space') e.preventDefault(); // don't scroll the page
  if (e.code === 'KeyE') openChest();         // buy the chest you're standing at (chests.js)
  if ((e.code === 'Escape' || e.code === 'KeyP') && !locked) showPause(); // Esc already pauses via pointerlockchange when captured
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; }); // window lost focus: release everything

// ---------- Mouse ----------
// With the mouse captured, holding the button keeps the aimed weapons firing. Without
// capture, a quick click fires once and click-and-drag turns the camera instead.
canvas.addEventListener('mousedown', e => {
  if (!playing || e.button !== 0) return;
  if (locked) { firing = true; fireAimed(); }
  else drag = { x: e.clientX, y: e.clientY, moved: 0 };
});
addEventListener('mouseup', () => {
  if (drag && drag.moved < 6 && playing) fireAimed(); // barely moved: it was a click
  drag = null; firing = false;
});
addEventListener('mousemove', e => {
  if (!playing) return;
  if (locked) look(e.movementX * 0.0022, e.movementY * 0.0022);
  else if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
    look(dx * 0.005, dy * 0.005);
  }
});

/** Turn the camera. Pitch is limited so you can't flip over or stare straight down. */
function look(dx, dy) {
  yaw -= dx;
  pitch = Math.max(-1.0, Math.min(0.8, pitch - dy));
}

// ---------- Title screen ----------
/**
 * The title screen: a fixed scene on the title map's stage (terrain.js → STAGE). The ranger
 * stands in the middle facing the camera, and EVERY monster stands behind him idling, so you
 * can see them all: the smaller creatures in a loose arc, the two bosses towering at the back.
 * Each entry: creature id, x, z (behind the deer is +z), and which way it looks (radians;
 * 0 = at the camera). The camera looks back across the stage, so on screen +x is LEFT. They're
 * placed in the open parts of the screen: the middle column between the menus, and the lower
 * right under the best-runs card (only short creatures fit there: the stump). The Mossback
 * stands in the clear middle ground in front of the Thorn Queen. They're removed when a run
 * starts.
 */
// [id, x, z, turn, lift]: where each stands (screen-right is world −x), how far it turns from facing
// the camera, and (fliers) how high it hovers above its usual height. Laid out so every one is clear
// of the menus and the others at 1280×800: the Hollow King on his sigil before his altar (world.js
// TITLE_SITE) right behind the ranger, his cult priest (the shaman) beside the altar, the Thorn Queen
// back right; the wisp hovering in the open sky on the left, the puffer and imp on the left, Mossback
// right of center, and the stalker and stump creeping up close on the right.
const TITLE_CAST = [
  ['hollowking', -1.0, 21, 0.0], ['thornqueen', -9, 25, -0.3], ['shaman', 2.1, 14.5, 0.25],
  ['wisp', 2.9, 9.5, 0.3, 1.7], ['puffer', 2.9, 6.6, 0.35], ['imp', 1.8, 2.2, 0.3],
  ['mossback', -4.4, 8.0, -0.3], ['stalker', -1.5, -0.4, 0.3], ['stump', -3.4, -0.9, -0.5],
];
function titleShowcase() {
  for (const [id, x, z, look, lift] of TITLE_CAST) {
    const e = spawnFoe(id, x, z, true);
    e.yaw = Math.PI + look; e.group.rotation.y = e.yaw;   // facing back toward the camera
    if (lift) e.group.position.y += lift;
    e.mv = 0;                                                // standing still: idle animations
    if (id === 'stalker') for (const m of e.mats) m.opacity = 1; // (it only fades in when close, in a run)
  }
  deer.facing = 0; yaw = 0; pitch = 0.05;
}

/**
 * The title screen's camera: fixed, in front of the deer and a little above it, framing it in the
 * middle of the screen (between the menu columns) with the monsters spread out behind. Looking
 * slightly down puts the horizon higher, so the monsters at different depths stack up the screen
 * instead of hiding behind each other.
 */
function titleCamera() {
  const p = player.pos;
  camera.position.set(p.x + 0.6, p.y + 3.1, p.z - 5.6);
  camera.lookAt(p.x - 0.6, p.y + 1.4, p.z + 6);
}
titleShowcase();
refreshGear(); // the ranger wears the starting weapon on the title screen too
showTitle(true);

// ---------- Main loop ----------
const clock = new THREE.Clock();
let shownSec = -1; // the clock text only changes once a second

/** Runs every frame: update the world (while playing), then draw it. */
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), now = performance.now(); // cap dt so a hiccup can't teleport things

  if (playing) {
    runTime += dt;
    director(dt);       // maybe spawn creatures
    stepBoss(dt);       // bosses at 5:00 and 10:00, and their health bar
    stepPlayer(dt);     // move the deer and the camera
    if (firing || keys.KeyF) fireAimed(); // held mouse button or F: keep firing
    stepWeapons(dt);    // cooldowns, automatic weapons, swarms, fireflies, mines
    iframes -= dt;
    shake = Math.max(0, shake - dt * 1.5);
    if (mod.regen && hp < mod.maxHp) { hp = Math.min(mod.maxHp, hp + mod.regen * dt); vitals(); } // Sap Flask item

    stepBalls(dt);
    stepFoes(dt, now);
    stepHazards(dt);    // creature bolts, poison clouds, eruptions, shockwaves
    stepOrbs(dt);
    stepDrops(dt);
    stepChests(dt);
    stepEffects(dt);

    // once a second: update the clock, threat level and lighting
    const sec = Math.floor(runTime);
    if (sec !== shownSec) {
      shownSec = sec;
      $('clock').textContent = clockText(runTime);
      const threat = 1 + Math.floor(runTime / 60);
      if (threat !== lastThreat) { lastThreat = threat; $('threat').textContent = threat; flash('threat', 'up'); }
      dusk();
    }
  } else {
    hideChestLabels();     // no floating chest labels over menus
    updateDeer(dt, false); // keep the deer posed (and let it fall over after death)
    if (!started) {
      // title screen: a fixed shot of the deer with every monster behind it, idling
      titleCamera();
      for (const e of foes) e.def.animate(e, dt, now);
    }
  }

  // red screen edges: a flash when hit, and a slow pulse below 30% HP
  hurtFlash = Math.max(0, hurtFlash - dt * 2.2);
  const low = playing && hp / mod.maxHp < 0.3 ? 0.3 + 0.15 * Math.sin(now / 180) : 0;
  $('hurt').style.opacity = Math.max(hurtFlash, low);

  stepPops(dt);
  stepGear(dt); // flickering lanterns, buzzing bees on the ranger's gear
  stepCult(now); // flickering candles and sigils at the cult's sites

  // keep the sun's shadow area centered on the deer
  sun.position.copy(player.pos).add(SUN_OFF);
  sun.target.position.copy(player.pos);

  updateDither();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- Go ----------
hud();
frame();

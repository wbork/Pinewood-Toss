/* =========================================================================
   game.js — ties everything together: mouse and keyboard input, the
   title / pause / game-over screens, starting and resetting a run, and the
   main loop that updates and draws every frame. Loaded last.
   ========================================================================= */

const overlay = $('overlay'); // the title screen, reused as the pause screen

// ---------- Mouse capture ----------

/** Capture the mouse so moving it turns the camera. Some browsers or embeds refuse; then drag-to-look takes over. */
function lockPointer() {
  try {
    const p = canvas.requestPointerLock && canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* drag-to-look still works */ }
}

/** Forget held keys and any drag, so nothing stays "pressed" while a menu is open. */
function releaseInput() { drag = null; for (const k in keys) keys[k] = false; }

// ---------- Screens ----------

/** Pause and show the overlay with a short progress summary. */
function showPause() {
  playing = false;
  overlay.hidden = false;
  $('go').textContent = 'Back to the woods';
  $('blurb').textContent = 'Paused at ' + clockText(runTime) + ', level ' + prog.level + '. ' + stats.kills + (stats.kills === 1 ? ' creature' : ' creatures') + ' down so far.';
  releaseInput();
}

/** Start the game, or resume from pause. Runs on a click, which browsers require for audio and mouse capture. */
function start() {
  initAudio();
  if (ac && ac.state === 'suspended') ac.resume();
  if (!started) resetRun(); // the title-screen creatures are just for show; the run starts empty
  started = playing = true;
  overlay.hidden = true;
  lockPointer();
  canvas.focus();
}
overlay.addEventListener('click', start);

/** The deer's HP reached 0: stop, record a best time, and show the game-over screen. */
function gameOver() {
  dead = true; playing = false;
  releaseInput();
  if (locked) document.exitPointerLock();
  const record = runTime > best;
  if (record) { best = runTime; try { localStorage.setItem('pinewood-best', String(best)); } catch (e) { /* not saved */ } }
  $('over-time').textContent = clockText(runTime);
  $('over-facts').innerHTML = '<span>Level <b>' + prog.level + '</b></span><span>Creatures <b>' + stats.kills + '</b></span>' +
    '<span>' + (record ? '<b>New best time</b>' : 'Best <b>' + clockText(best) + '</b>') + '</span>';
  $('over').hidden = false;
  sfx.death();
  hud();
}

/** Clear the world and put every run value back to its starting point. */
function resetRun() {
  // remove everything the last run left in the world
  for (const e of foes) scene.remove(e.group);
  for (const b of balls) scene.remove(b.mesh);
  for (const o of orbs) scene.remove(o.g);
  for (const it of items) scene.remove(it.g);
  for (const c of chips) scene.remove(c.m);
  for (const q of rings) scene.remove(q.m);
  for (const q of pops) q.el.remove();
  for (const list of [foes, balls, orbs, items, chips, rings, pops]) list.length = 0;
  // progress and perks
  stats.kills = 0; stats.throws = 0;
  Object.assign(prog, { level: 1, xp: 0, pending: 0 });
  for (const k in rank) rank[k] = 0;
  renderOwned();
  // the deer and camera
  player.pos.set(0, h(0, 0), 0); player.vel.set(0, 0, 0); player.vy = 0;
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
  if (choosing) { // perk menu: 1, 2, 3 pick a card
    const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (i >= 0) pickPerk(i);
    return;
  }
  if (!playing) return;
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault(); // don't scroll the page
  if (e.code === 'KeyF') throwBall();         // keyboard throw
  if ((e.code === 'Escape' || e.code === 'KeyP') && !locked) showPause(); // Esc already pauses via pointerlockchange when captured
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; }); // window lost focus: release everything

// ---------- Mouse ----------
// With the mouse captured, clicking throws. Without capture, a quick click throws
// and click-and-drag turns the camera instead.
canvas.addEventListener('mousedown', e => {
  if (!playing || e.button !== 0) return;
  if (locked) throwBall();
  else drag = { x: e.clientX, y: e.clientY, moved: 0 };
});
addEventListener('mouseup', () => {
  if (drag && drag.moved < 6 && playing) throwBall(); // barely moved: it was a click
  drag = null;
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
// Three creatures stand in the clearing for the opening shot. They're removed when the run starts.
[['imp', -2.5, -9], ['stump', 1.5, -11], ['wisp', 4.5, -8.5]].forEach(([id, x, z]) => {
  const e = spawnFoe(id, x, z, true);
  e.yaw = Math.atan2(-x, -z); e.group.rotation.y = e.yaw;
});
yaw = 0.35; pitch = -0.12;

// ---------- Main loop ----------
const clock = new THREE.Clock();
let shownSec = -1; // the clock text only changes once a second

/** Runs every frame: update the world (while playing), then draw it. */
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), now = performance.now(); // cap dt so a hiccup can't teleport things

  if (playing) {
    runTime += dt;
    director(dt);       // maybe spawn creatures
    stepPlayer(dt);     // move the deer and the camera
    throwCooldown -= dt;
    iframes -= dt;
    shake = Math.max(0, shake - dt * 1.5);
    if (mod.regen && hp < mod.maxHp) { hp = Math.min(mod.maxHp, hp + mod.regen * dt); vitals(); } // Regrowth perk

    stepBalls(dt);
    stepFoes(dt, now);
    stepOrbs(dt);
    stepItems(dt);
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
    updateDeer(dt, false); // keep the deer posed (and let it fall over after death)
    if (!started) {
      // title screen: the camera slowly circles the deer while the creatures fidget
      yaw += dt * 0.03;
      placeCamera(dt);
      for (const e of foes) e.def.animate(e, dt * 0.4, now);
    }
  }

  // red screen edges: a flash when hit, and a slow pulse below 30% HP
  hurtFlash = Math.max(0, hurtFlash - dt * 2.2);
  const low = playing && hp / mod.maxHp < 0.3 ? 0.3 + 0.15 * Math.sin(now / 180) : 0;
  $('hurt').style.opacity = Math.max(hurtFlash, low);

  stepPops(dt);

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

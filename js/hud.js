/* =========================================================================
   hud.js — the on-screen readouts: scoreboard, HP and XP bars, the list of
   owned perks, and floating text (damage numbers etc.) that hovers over
   points in the 3D world.
   ========================================================================= */

/** 125 seconds → "2:05" */
const clockText = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

/** Round to one decimal for damage numbers: 2.8, 4, 11.2 */
const fmt = v => String(Math.round(v * 10) / 10);

/** Refresh kills, best time, level, XP bar and HP bar. Call after anything they show changes. */
function hud() {
  $('kills').textContent = stats.kills;
  $('coins').textContent = Math.floor(money);
  $('score').textContent = score.toLocaleString();
  $('best').textContent = best ? clockText(best) : '–';
  $('lvl').textContent = prog.level;
  $('xptext').textContent = Math.floor(prog.xp) + ' / ' + need(prog.level) + ' XP';
  $('xpfill').style.width = Math.min(100, prog.xp / need(prog.level) * 100) + '%';
  vitals();
}

/** Refresh just the HP bar (cheap enough to call every frame while regenerating). */
function vitals() {
  const max = mod.maxHp;
  $('hptext').textContent = Math.ceil(Math.max(0, hp)) + ' / ' + max;
  $('hpfill').style.width = Math.max(0, hp / max * 100) + '%';
  $('vitals').classList.toggle('low', hp / max < 0.3);
}

/**
 * Under the scoreboard: your weapon slots (weapons with their levels, fusions in gold,
 * empty slots), any active synergies, and the items you've found with how many of each.
 */
function renderOwned() {
  let html = '<div class="own-row">';
  for (let i = 0; i < MAX_WEAPONS; i++) {
    const id = owned[i];
    html += !id ? '<span class="slot empty">empty slot</span>'
      : SYN[id] ? '<span class="slot fused" title="' + WEAPONS[SYN[id].a].name + ' + ' + WEAPONS[SYN[id].b].name + '. ' + SYN[id].power + '">' + SYN[id].fusion + '</span>'
      : '<span class="slot">' + WEAPONS[id].name + '<b>' + wlv[id] + '</b></span>';
  }
  html += '</div>';
  const syns = SYNERGIES.filter(s => syn(s.id) && !owned.includes(s.id)); // fused ones already show as a slot
  if (syns.length) html += '<div class="own-row syns">' + syns.map(s => '<span>' + s.name + '</span>').join('') + '</div>';
  const got = ITEMS.filter(it => bag[it.id]);
  if (got.length) html += '<div class="own-row">' + got.map(it => '<span class="item ' + it.rarity + '">' + it.name + (bag[it.id] > 1 ? '<b>×' + bag[it.id] + '</b>' : '') + '</span>').join('') + '</div>';
  $('owned').hidden = false;
  $('owned').innerHTML = html;
  refreshGear(); // and show them on the ranger (gear.js)
}

/**
 * The pause screen's item list: every item you hold, colored by rarity. Hovering (or
 * tabbing to) one shows a card with what your copies add up to now, and what one more
 * copy would add (and the new total).
 */
function renderPauseItems() {
  const got = ITEMS.filter(it => bag[it.id]);
  $('pause-items').innerHTML = !got.length ? '<div class="none">No items yet. Open chests (E) to find some.</div>'
    : got.map(it => {
      const n = bag[it.id];
      return '<button type="button" class="item-chip ' + it.rarity + '">' + it.name + (n > 1 ? ' <b>×' + n + '</b>' : '') +
        '<span class="tip" role="tooltip">' +
          '<span class="tip-name ' + it.rarity + '">' + it.name + '</span><span class="tip-rarity">' + RARITY[it.rarity].name + ' · you have ' + n + '</span>' +
          '<span class="tip-row"><i>Now</i>' + itemBonus(it, n) + '</span>' +
          '<span class="tip-row"><i>Another copy</i>' + itemBonus(it, 1) + '</span>' +
          '<span class="tip-row"><i>Then</i>' + itemBonus(it, n + 1) + '</span>' +
        '</span></button>';
    }).join('');
}

/** Restart a CSS animation class on an element (used for the level-up glow and threat flash). */
function flash(id, cls) { const el = $(id); el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// ---------- Floating text ----------
// Each pop is a DOM element pinned to a 3D point. It drifts upward and fades over 1.1 s.
const pops = [];

/** Show `text` (and optional smaller `sub` text) at 3D point `at`. cls: 'small', 'crit', 'heal' or 'magnet'. */
function pop(at, text, sub, cls) {
  const el = document.createElement('div');
  el.className = 'pop' + (cls ? ' ' + cls : ''); el.innerHTML = text + (sub ? '<span>' + sub + '</span>' : '');
  document.body.appendChild(el);
  pops.push({ el, pos: at.clone(), t: 0 });
  while (pops.length > 40) pops.shift().el.remove(); // cap them so big fights don't flood the page
}

/** Move every pop to its 3D point's current screen position, fading it out. Called every frame. */
function stepPops(dt) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const q = pops[i];
    q.t += dt;
    const sp = tmp.copy(q.pos); sp.y += q.t * 0.9; sp.project(camera); // world → -1..1 screen coordinates
    q.el.style.left = (sp.x * 0.5 + 0.5) * innerWidth + 'px';
    q.el.style.top = (-sp.y * 0.5 + 0.5) * innerHeight + 'px';
    q.el.style.opacity = sp.z > 1 ? 0 : Math.max(0, 1 - q.t / 1.1); // hidden if behind the camera
    if (q.t > 1.1) { q.el.remove(); pops.splice(i, 1); }
  }
}

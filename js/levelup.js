/* =========================================================================
   levelup.js — XP, leveling, and the level-up menu.

   XP fills the bar; each full bar is a level, and each level pauses the game
   to offer three cards. Cards are either a NEW WEAPON (only while you have
   fewer than MAX_WEAPONS) or an UPGRADE for a weapon you already own (until
   it reaches MAX_LEVEL). Once all weapon slots are full, only upgrades are
   offered, until two maxed weapons of a synergy pair fuse into one and free
   up a slot again. Weapons themselves live in weapons.js.
   ========================================================================= */

/** XP needed to go from level L to L+1: 8, 17, 28, 42, ... */
const need = L => Math.round(8 + (L - 1) * 7 + Math.pow(L - 1, 1.6) * 2);

/** Add XP (Field Notes can multiply it). Opens the level-up menu if that completes a level. */
function gainXP(v) {
  prog.xp += v * mod.xpMult;
  while (prog.xp >= need(prog.level)) { // one big pickup can be worth several levels
    prog.xp -= need(prog.level);
    prog.level++; prog.pending++;
    flash('vitals', 'glow');
  }
  hud();
  if (prog.pending > 0 && !choosing && !dead) openLevelUp();
}

// ---------- The level-up menu ----------
let offer = [];   // the cards on screen: { type: 'new' | 'up', id }
let offerAt = 0;  // when the menu opened, so stray clicks right after can be ignored

/** Shuffle an array in place (Fisher–Yates) and return it. */
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Deal up to three cards. New weapons are only in the pool while a slot is free.
 * When both kinds are possible, at least one of each is dealt.
 */
function dealCards() {
  const ups = shuffle(owned.filter(id => WEAPONS[id] && wlv[id] < MAX_LEVEL).map(id => ({ type: 'up', id }))); // fusions are maxed
  const news = owned.length < MAX_WEAPONS ? shuffle(WEAPON_IDS.filter(id => !has(id)).map(id => ({ type: 'new', id }))) : [];
  const hand = [];
  if (ups.length && news.length) hand.push(ups.shift(), news.shift());
  return hand.concat(shuffle(ups.concat(news))).slice(0, 3);
}

/** Card markup for one offer. */
function cardHTML(c, i) {
  const w = WEAPONS[c.id];
  let tag, pips = '', body;
  if (c.type === 'new') {
    tag = '<span class="tag new">New weapon</span>';
    // synergies this weapon would switch on with what you already carry (if that one isn't fused yet)
    const lines = synergiesOf(c.id).filter(s => has(partner(s, c.id)) && !fusedIn(partner(s, c.id)))
      .map(s => '<span class="syn">Synergy with ' + WEAPONS[partner(s, c.id)].name + ': <b>' + s.name + '</b>. ' + s.text +
        ' Max both to fuse them into <b>' + s.fusion + '</b>.</span>');
    body = '<span class="pstyle">' + w.style + '</span><span class="pdesc">' + w.text + '</span>' + lines.join('');
  } else {
    const L = wlv[c.id];
    tag = '<span class="tag up">Upgrade · Lv ' + (L + 1) + '</span>';
    for (let r = 0; r < MAX_LEVEL; r++) pips += '<i class="' + (r < L ? 'on' : r === L ? 'next' : '') + '"></i>';
    body = '<span class="pstyle">' + w.style + '</span><span class="pdesc">' + w.ups[L - 1] + '</span>';
    // this upgrade completes a fusion if its partner is already maxed in a slot
    const fuse = L + 1 === MAX_LEVEL && synergiesOf(c.id).find(s => owned.includes(partner(s, c.id)) && wlv[partner(s, c.id)] === MAX_LEVEL);
    if (fuse) body += '<span class="syn fuse">Fuses with ' + WEAPONS[partner(fuse, c.id)].name + ' into <b>' + fuse.fusion + '</b>, freeing a weapon slot. ' +
      'Both hit 60% harder and 30% more often, with 25% more reach. ' + fuse.power + '</span>';
  }
  return '<button type="button" class="card sign ' + c.type + '" id="card-' + c.id + '" data-i="' + i + '">' +
    '<span class="row"><kbd>' + (i + 1) + '</kbd>' + tag + (pips ? '<span class="pips">' + pips + '</span>' : '') + '</span>' +
    '<span class="pname">' + w.name + '</span>' + body + '</button>';
}

/** Pause the game and show the level-up cards. */
function openLevelUp() {
  offer = dealCards();
  if (!offer.length) { // every weapon slot full and fully upgraded: a small heal instead
    prog.pending = 0;
    hp = Math.min(mod.maxHp, hp + 25);
    pop(player.pos.clone().add(P.set(0, 2.4, 0)), '+25 HP', 'all weapons maxed', 'heal');
    vitals();
    return;
  }
  choosing = true; playing = false;
  releaseInput();
  if (locked) document.exitPointerLock(); // free the mouse so the cards can be clicked
  offerAt = performance.now();
  const full = owned.length >= MAX_WEAPONS;
  $('perk-lvl').textContent = prog.level - prog.pending + 1; // which level this pick is for
  $('perk-title').textContent = full ? 'Upgrade a weapon' : 'Pick a weapon or upgrade';
  $('perk-slots').textContent = 'Weapons ' + owned.length + ' / ' + MAX_WEAPONS + (full ? ' · all slots full' : '');
  $('cards').innerHTML = offer.map(cardHTML).join('');
  $('perks').hidden = false;
  sfx.level();
}

/** Take card number i (0–2), then show the next menu or resume play. */
function pickCard(i) {
  const c = offer[i];
  if (!c || performance.now() - offerAt < 450) return; // ignore clicks still coming from rapid throwing
  addWeapon(c.id);
  // a new weapon may switch on synergies with ones you carry: announce them
  if (c.type === 'new') synergiesOf(c.id).filter(s => syn(s.id) && !fusedIn(c.id)).forEach((s, k) =>
    pop(player.pos.clone().add(P.set(0, 2.6 + k * 0.5, 0)), 'Synergy: ' + s.name, '', 'synergy'));
  // an upgrade to level 5 may complete a pair: fuse it into one weapon, freeing a slot
  for (const s of checkFusions()) {
    pop(player.pos.clone().add(P.set(0, 2.8, 0)), 'Fusion: ' + s.fusion, WEAPONS[s.a].name + ' + ' + WEAPONS[s.b].name, 'item legendary');
    sfx.fusion();
  }
  prog.pending--;
  $('perks').hidden = true;
  choosing = false;
  renderOwned(); hud();
  if (prog.pending > 0) return openLevelUp(); // several level-ups at once: keep picking
  playing = true;
  lockPointer();
  canvas.focus();
}

// Clicking a card picks it (keys 1/2/3 are handled in game.js).
$('cards').addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card) pickCard(+card.dataset.i);
});

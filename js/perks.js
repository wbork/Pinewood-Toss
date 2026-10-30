/* =========================================================================
   perks.js — leveling up and perks.

   XP fills the bar; each full bar is a level, and each level pauses the game
   to offer three random perks. Perks have ranks (pick the same one again to
   rank it up). `mod` turns the ranks into the actual numbers the rest of the
   game uses, so to change what a perk does, edit its line in `mod`.
   ========================================================================= */

// Every perk: id (used in code), name and description (shown on the card), max rank.
const PERKS = [
  { id: 'arm', name: 'Strong Arm', max: 5, text: 'Throws fly 15% faster and farther.' },
  { id: 'heavy', name: 'Heavy Ball', max: 5, text: 'Every hit deals 40% more damage.' },
  { id: 'quick', name: 'Quick Hands', max: 4, text: 'Throw 20% more often.' },
  { id: 'split', name: 'Split Shot', max: 3, text: 'Throw one more ball in a fan.' },
  { id: 'big', name: 'Big Ball', max: 3, text: 'Balls are 30% bigger and easier to land.' },
  { id: 'rico', name: 'Ricochet', max: 3, text: 'After a hit, the ball bounces on to the nearest creature. Each rank adds a bounce.' },
  { id: 'blast', name: 'Pinecone Burst', max: 3, text: 'Hits splash half damage onto everything within a few meters.' },
  { id: 'crit', name: 'Hard Knock', max: 3, text: '15% chance per rank for a hit to deal triple damage.' },
  { id: 'skin', name: 'Thick Skin', max: 5, text: '25 more max HP, and heal 25 right now.' },
  { id: 'regen', name: 'Regrowth', max: 3, text: 'Slowly heal 0.6 HP every second.' },
  { id: 'magnet', name: 'Magnet Pockets', max: 3, text: 'Pull in XP from 70% farther away.' },
  { id: 'scholar', name: 'Field Notes', max: 3, text: 'Earn 20% more XP from every orb.' },
  { id: 'fleet', name: 'Trail Legs', max: 3, text: 'Walk and run 12% faster.' },
];

// Current rank of each perk, e.g. rank.split = 2. All start at 0.
const rank = Object.fromEntries(PERKS.map(p => [p.id, 0]));

// The player's stats with perks applied. These are getters, so they always
// reflect the current ranks (e.g. mod.damage is recalculated every time it's read).
const mod = {
  get throwSpeed() { return 28 * (1 + 0.15 * rank.arm); },          // m/s
  get damage() { return 2 * (1 + 0.4 * rank.heavy); },              // per ball hit
  get cooldown() { return 0.3 * Math.pow(0.8, rank.quick); },       // seconds between throws
  get ballR() { return BALL_R * (1 + 0.3 * rank.big); },            // ball radius (BALL_R is in combat.js)
  get blastR() { return rank.blast ? 1.5 + rank.blast : 0; },       // splash radius, 0 = no splash
  get pickupR() { return 2.6 * (1 + 0.7 * rank.magnet); },          // how close XP orbs start flying to you
  get xpMult() { return 1 + 0.2 * rank.scholar; },
  get walk() { return 5.5 * (1 + 0.12 * rank.fleet); },             // m/s; running is 1.8× this
  get maxHp() { return 100 + 25 * rank.skin; },
  get regen() { return 0.6 * rank.regen; },                         // HP per second
};

/** XP needed to go from level L to L+1: 8, 17, 28, 42, ... */
const need = L => Math.round(8 + (L - 1) * 7 + Math.pow(L - 1, 1.6) * 2);

/** Add XP (perks can multiply it). Opens the perk menu if that completes a level. */
function gainXP(v) {
  prog.xp += v * mod.xpMult;
  while (prog.xp >= need(prog.level)) { // one big pickup can be worth several levels
    prog.xp -= need(prog.level);
    prog.level++; prog.pending++;
    flash('vitals', 'glow');
  }
  hud();
  if (prog.pending > 0 && !choosing && !dead) openPerks();
}

// ---------- The perk menu ----------
let offer = [];   // the three perks currently on screen
let offerAt = 0;  // when the menu opened, so stray clicks right after can be ignored

/** Pause the game and deal three random perks that aren't maxed out yet. */
function openPerks() {
  const pool = PERKS.filter(p => rank[p.id] < p.max);
  if (!pool.length) { prog.pending = 0; return; } // everything maxed: nothing to offer
  choosing = true; playing = false;
  releaseInput();
  if (locked) document.exitPointerLock(); // free the mouse so the cards can be clicked
  // shuffle the pool (Fisher–Yates) and take the first three
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  offer = pool.slice(0, 3);
  offerAt = performance.now();
  $('perk-lvl').textContent = prog.level - prog.pending + 1; // which level this pick is for
  $('cards').innerHTML = offer.map((p, i) => {
    // rank pips: filled for owned ranks, highlighted for the rank this card gives
    let pips = '';
    for (let r = 0; r < p.max; r++) pips += '<i class="' + (r < rank[p.id] ? 'on' : r === rank[p.id] ? 'next' : '') + '"></i>';
    return '<button type="button" class="card sign" id="perk-' + p.id + '" data-i="' + i + '">' +
      '<span class="row"><kbd>' + (i + 1) + '</kbd><span class="pips" title="Rank ' + (rank[p.id] + 1) + ' of ' + p.max + '">' + pips + '</span></span>' +
      '<span class="pname">' + p.name + '</span>' +
      '<span class="pdesc">' + p.text + '</span></button>';
  }).join('');
  $('perks').hidden = false;
  sfx.level();
}

/** Take perk number i (0–2) from the menu, then show the next menu or resume play. */
function pickPerk(i) {
  const p = offer[i];
  if (!p || performance.now() - offerAt < 450) return; // ignore clicks still coming from rapid throwing
  rank[p.id]++;
  if (p.id === 'skin') hp += 25; // Thick Skin heals right away
  prog.pending--;
  $('perks').hidden = true;
  choosing = false;
  renderOwned(); hud();
  if (prog.pending > 0) return openPerks(); // several level-ups at once: keep picking
  playing = true;
  lockPointer();
  canvas.focus();
}

// Clicking a card picks it (keys 1/2/3 are handled in game.js).
$('cards').addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card) pickPerk(+card.dataset.i);
});

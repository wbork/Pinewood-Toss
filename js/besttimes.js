/* =========================================================================
   besttimes.js — the "Best runs" board: your 10 best runs, by score and
   time, saved in this browser so they're still there next time you play.

   Score only starts counting once the Hollow King is beaten (the endless
   phase, bosses.js), so runs are ranked by score first and then by how long
   you survived. A run that never reached the endless phase scores 0 and is
   ranked by its time alone.

   game.js → gameOver() calls recordRun(); the board is drawn into every
   element with class "times" (one on the title screen, one on game over).
   ========================================================================= */

const TIMES_SIZE = 10;               // runs kept and shown
const TIMES_KEY = 'pinewood-scores'; // browser-storage key

// ---------- Saved runs ----------
// Each run is { t: seconds survived, score, kills, level, at: timestamp }, best first.
let bestRuns = [];
try { bestRuns = JSON.parse(localStorage.getItem(TIMES_KEY)) || []; } catch (e) { /* no storage or bad data: start empty */ }
if (!Array.isArray(bestRuns)) bestRuns = [];
// Earlier versions only saved one best time. Carry it over as the first row.
if (!bestRuns.length && best) bestRuns.push({ t: best, kills: null, level: null, at: 0 });

let lastRun = null; // the run that just ended, so its row can be highlighted

/** Rank runs: higher score first, then longer time (runs saved before scores existed count as 0). */
const byScoreThenTime = (a, b) => (b.score || 0) - (a.score || 0) || b.t - a.t;

/** Called once per run from gameOver(): add it to the board, keep the best TIMES_SIZE, save, redraw. */
function recordRun(run) {
  lastRun = run;
  bestRuns.push(run);
  bestRuns.sort(byScoreThenTime);
  bestRuns.length = Math.min(bestRuns.length, TIMES_SIZE);
  try { localStorage.setItem(TIMES_KEY, JSON.stringify(bestRuns)); } catch (e) { /* not saved; still shown this visit */ }
  renderTimes();
}
bestRuns.sort(byScoreThenTime);

// ---------- Drawing the board ----------

/** "Oct 31" for a timestamp; runs carried over from old versions have none. */
const dayText = at => at ? new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Earlier';

/** Redraw every board on the page. Each row: place · date (level and kills under it) · time · score. */
function renderTimes() {
  const rows = bestRuns.map((r, i) => {
    const lv = Number(r.level), k = Number(r.kills), sc = Number(r.score) || 0;
    const sub = lv > 0 ? 'Lvl ' + lv + ' · ' + k + (k === 1 ? ' kill' : ' kills') : '';
    return '<li' + (r === lastRun ? ' class="me"' : '') + '><span class="times-rank">' + (i + 1) + '</span>' +
      '<span class="times-day">' + dayText(r.at) + '<small>' + sub + '</small></span>' +
      '<span class="times-time">' + clockText(r.t) + '</span>' +
      '<span class="times-score' + (sc ? '' : ' none') + '">' + (sc ? sc.toLocaleString() : '–') + '</span></li>';
  }).join('');
  for (const box of document.querySelectorAll('.times')) {
    box.innerHTML = '<div class="times-head"><span class="lbl">Best runs</span><span class="lbl">Time</span><span class="lbl">Score</span></div>' +
      '<ol class="times-list">' + rows + '</ol>' +
      (rows ? '<div class="note">Score counts once the Hollow King falls.</div>' : '<div class="note">No runs yet. Your times and scores will land here.</div>');
  }
}

renderTimes();

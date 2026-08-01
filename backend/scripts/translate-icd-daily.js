// backend/scripts/translate-icd-daily.js
//
// Dedicated entry point for Windows Task Scheduler — no CLI arguments
// needed, safe to run unattended once a day. Shares its engine with
// translate-icd-arabic.js (see lib/icdTranslateShared.js): same state file
// (icd-arabic-daily-state.json), same 20-requests/day free-tier budget,
// same persistent retry queue for anything that fails all its attempts on
// a given day. NOT imported by the live app.
//
// What it does, every time it runs:
//   1. Reads icd-arabic-daily-state.json to see where yesterday left off
//      (cursorId) and which codes failed all retries on a previous day
//      (failedCodes) — those are retried FIRST, before any new territory.
//   2. Translates up to ~20 requests' worth of rows (dry run — reads
//      English text from sihatuna_iraq read-only, translates via Gemini).
//   3. Writes ONLY a dated review file (icd-translation-review-YYYY-MM-DD.md)
//      — never touches sihatuna_iraq_test or production directly. A human
//      reviews these files, then runs commit-icd-week.js manually.
//   4. Updates the state file and appends one line to the running log
//      (icd-translation-daily-log.md) — date, rows translated today,
//      cumulative total, rows remaining, estimated days left.
//
// Task Scheduler action to configure (see the setup steps given alongside
// this file):
//   Program/script:  node
//   Arguments:       scripts/translate-icd-daily.js
//   Start in:        <repo path>\backend
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { runDailyBatch } = require('./lib/icdTranslateShared');

// Always sihatuna_iraq — the ONLY database this script ever reads from,
// and only ever read-only (for the English source text). It never writes
// to any database; that only ever happens via commit-icd-week.js, and only
// ever to sihatuna_iraq_test.
const SOURCE_DB = process.env.PG_DATABASE || 'sihatuna_iraq';

runDailyBatch({ db: SOURCE_DB, dailyRequests: 20, batchSize: 100 })
  .then((summary) => {
    console.log(`\n[translate-icd-daily] Run complete for ${summary.date}.`);
  })
  .catch((err) => {
    console.error('[translate-icd-daily] Run failed:', err.message);
    process.exit(1);
  });

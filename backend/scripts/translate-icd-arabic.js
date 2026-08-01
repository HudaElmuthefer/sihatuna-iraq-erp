// backend/scripts/translate-icd-arabic.js
//
// Standalone, manually-run script. NOT imported or called from anywhere else
// in the app. Translates the 73,620 ICD-10-CM codes imported earlier
// (backend/scripts/import-icd-codes.js) from their English-placeholder
// name_ar (name_ar === name_en, set at import time since the Kaggle source
// had no Arabic) into real Arabic clinical terminology, via the Gemini API.
//
// The actual Gemini-calling/retry/state logic lives in
// backend/scripts/lib/icdTranslateShared.js, shared with the two other
// entry points built for the daily-batching workflow:
//   - translate-icd-daily.js  (Task Scheduler entry point, zero args)
//   - commit-icd-week.js      (weekly manual commit to sihatuna_iraq_test)
// This file is the general-purpose manual/ad-hoc CLI: calibration testing,
// --limit/--offset-rows one-off runs, and --commit-from.
//
// Usage:
//   node backend/scripts/translate-icd-arabic.js --db <database> --daily [--daily-requests 20] [--batch-size 100]
//   node backend/scripts/translate-icd-arabic.js --db <database> [--limit N] [--batch-size N] [--out <path>] [--commit]
//   node backend/scripts/translate-icd-arabic.js --db <database> --commit-from <review.md>
//
// --daily: ad-hoc/manual invocation of the same daily-batch engine
// translate-icd-daily.js runs on a schedule. Useful for testing with a
// reduced --daily-requests budget without touching the real daily state
// from the scheduled task... actually it uses the SAME state file, so this
// and the scheduled script are interchangeable — this one just also
// accepts --out to redirect the review file if needed for a test run.
//
// Default mode (no --daily) is a plain DRY RUN: reads untranslated rows
// (medical_codes where system='icd' AND name_ar = name_en), translates
// them via Gemini, and writes results to a review file — no database
// writes happen. --db is a read-only source for the English text in dry-run
// mode (no default, always explicit, same reasoning as import-icd-codes.js).
//
// --commit-from <path>: writes a PREVIOUSLY generated review file's exact
// translations to medical_codes.name_ar on --db, without calling Gemini
// again. This is the normal path after a human has reviewed a dry-run
// file — re-translating on commit would risk the committed Arabic text
// silently drifting from what was actually reviewed/approved (the model
// isn't perfectly deterministic between calls). Only updates rows still at
// the untranslated placeholder (name_ar = name_en) — never overwrites a
// row that's already been translated by a prior run or edited manually.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const {
  GEMINI_API_KEY,
  TRANSLATE_MODEL,
  MIN_MS_BETWEEN_CALLS,
  sleep,
  callGeminiBatch,
  commitFromFile,
  runDailyBatch,
} = require('./lib/icdTranslateShared');

function parseArgs(argv) {
  const args = { commit: false, batchSize: 100 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--commit') args.commit = true;
    else if (a === '--db') args.db = argv[++i];
    else if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--batch-size') args.batchSize = parseInt(argv[++i], 10);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--commit-from') args.commitFrom = argv[++i];
    else if (a === '--chunk-rows') args.chunkRows = parseInt(argv[++i], 10);
    else if (a === '--progress-every') args.progressEvery = parseInt(argv[++i], 10);
    else if (a === '--offset-rows') args.offsetRows = parseInt(argv[++i], 10);
    else if (a === '--daily') args.daily = true;
    else if (a === '--daily-requests') args.dailyRequests = parseInt(argv[++i], 10);
  }
  if (!args.chunkRows) args.chunkRows = 5000;
  if (!args.progressEvery) args.progressEvery = 50;
  if (!args.dailyRequests) args.dailyRequests = 20;
  return args;
}

async function runCommitFrom(db, filePath) {
  console.log(`Mode: COMMIT-FROM-FILE (writing pre-reviewed translations, no Gemini call)`);
  console.log(`Target database: ${db}`);
  console.log(`Source file: ${filePath}`);
  const { updated, skipped, total } = await commitFromFile(db, filePath);
  console.log(`Rows parsed from file: ${total}`);
  console.log(`\nUpdated: ${updated}`);
  console.log(`Skipped (already translated or code not found): ${skipped}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.db) {
    console.error('Missing required --db <database name> (explicit on purpose)');
    process.exit(1);
  }

  if (args.commitFrom) {
    await runCommitFrom(args.db, args.commitFrom);
    return;
  }

  if (args.daily) {
    await runDailyBatch({
      db: args.db,
      dailyRequests: args.dailyRequests,
      batchSize: args.batchSize,
      reviewPathPrefix: args.out,
    });
    return;
  }

  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in backend/.env');
    process.exit(1);
  }

  console.log(`Mode: ${args.commit ? 'COMMIT (will write to medical_codes.name_ar)' : 'DRY RUN (no database writes)'}`);
  console.log(`Source database (read-only for English text): ${args.db}`);
  console.log(`Model: ${TRANSLATE_MODEL} (thinkingBudget: 0)`);
  console.log(`Batch size: ${args.batchSize}${args.limit ? `, limited to first ${args.limit} rows` : ''}`);

  const client = new Client({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: args.db,
  });
  await client.connect();

  let rows;
  try {
    const limitClause = args.limit ? `LIMIT ${args.limit}` : '';
    const offsetClause = args.offsetRows ? `OFFSET ${args.offsetRows}` : '';
    const res = await client.query(
      `SELECT code, name_en FROM medical_codes WHERE system = 'icd' AND name_ar = name_en ORDER BY id ${limitClause} ${offsetClause}`
    );
    rows = res.rows;
  } finally {
    await client.end();
  }

  console.log(`Rows to translate: ${rows.length}`);
  if (rows.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const batches = [];
  for (let i = 0; i < rows.length; i += args.batchSize) {
    batches.push(rows.slice(i, i + args.batchSize));
  }
  console.log(`Batches: ${batches.length}`);
  console.log(`Chunk files every ${args.chunkRows} rows | progress checkpoint every ${args.progressEvery} batches`);

  const outBase = args.out || path.join(__dirname, '..', '..', 'icd-arabic-review');
  const chunkHeader = () => [
    '# ICD-10-CM Arabic Translation — Full Run Review',
    '',
    '| Code | English | Proposed Arabic |',
    '|---|---|---|',
  ];

  let chunkIndex = 1;
  let chunkLines = chunkHeader();
  let chunkRowCount = 0;
  const allResultsForSpotCheck = []; // { code, name_en, ar } — kept for the final random spot-check sample

  function flushChunk(isFinal) {
    if (chunkRowCount === 0) return;
    const chunkPath = `${outBase}-part${String(chunkIndex).padStart(2, '0')}.md`;
    fs.writeFileSync(chunkPath, chunkLines.join('\n'), 'utf8');
    console.log(`  [chunk written] ${chunkPath} (${chunkRowCount} rows)`);
    chunkIndex++;
    chunkLines = chunkHeader();
    chunkRowCount = 0;
  }

  let totalPromptTokens = 0;
  let totalOutputTokens = 0;
  let totalThoughtsTokens = 0;
  let failedBatches = 0;
  let rowsDone = 0;
  const startTime = Date.now();
  let lastCallTime = 0;
  const MAX_RETRIES_PER_BATCH = 3;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const elapsedSinceLastCall = Date.now() - lastCallTime;
    if (lastCallTime > 0 && elapsedSinceLastCall < MIN_MS_BETWEEN_CALLS) {
      await sleep(MIN_MS_BETWEEN_CALLS - elapsedSinceLastCall);
    }

    lastCallTime = Date.now();
    let result = null;
    let lastErr = null;
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_BATCH; attempt++) {
      try {
        result = await callGeminiBatch(batch);
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_RETRIES_PER_BATCH) {
          const waitMs = err.retryAfterMs || MIN_MS_BETWEEN_CALLS;
          console.log(`[Batch ${i + 1}/${batches.length}] attempt ${attempt} failed, waiting ${(waitMs / 1000).toFixed(1)}s then retrying: ${err.message.slice(0, 150)}`);
          await sleep(waitMs);
          lastCallTime = Date.now();
        }
      }
    }
    if (!result) {
      failedBatches++;
      console.log(`[Batch ${i + 1}/${batches.length}] FAILED after ${MAX_RETRIES_PER_BATCH} attempts (skipped, will remain untranslated for a future run): ${lastErr.message}`);
      continue;
    }

    const byCode = new Map(result.translations.map((t) => [t.code, t.ar]));
    for (const row of batch) {
      const ar = byCode.get(row.code) || '(missing in response)';
      chunkLines.push(`| ${row.code} | ${row.name_en.replace(/\|/g, '/')} | ${ar.replace(/\|/g, '/')} |`);
      chunkRowCount++;
      allResultsForSpotCheck.push({ code: row.code, name_en: row.name_en, ar });
    }
    rowsDone += batch.length;
    totalPromptTokens += result.promptTokens;
    totalOutputTokens += result.outputTokens;
    totalThoughtsTokens += result.thoughtsTokens;

    if (chunkRowCount >= args.chunkRows) flushChunk(false);

    const batchNum = i + 1;
    if (batchNum % args.progressEvery === 0 || batchNum === batches.length) {
      const elapsedMin = (Date.now() - startTime) / 60000;
      const pct = ((batchNum / batches.length) * 100).toFixed(1);
      const avgMinPerBatch = elapsedMin / batchNum;
      const remainingMin = avgMinPerBatch * (batches.length - batchNum);
      console.log(
        `[Progress] Batch ${batchNum}/${batches.length} (${pct}%) | rows: ${rowsDone.toLocaleString('en-US')}/${rows.length.toLocaleString('en-US')} | ` +
        `elapsed: ${elapsedMin.toFixed(1)} min | est. remaining: ~${remainingMin.toFixed(1)} min | failed batches so far: ${failedBatches}`
      );
    }
  }

  flushChunk(true);

  const elapsedMs = Date.now() - startTime;
  const totalTokens = totalPromptTokens + totalOutputTokens + totalThoughtsTokens;

  console.log('\n--- Full run summary ---');
  console.log(`Rows translated: ${rowsDone} / ${rows.length} requested`);
  console.log(`Failed batches (skipped, still untranslated): ${failedBatches} / ${batches.length}`);
  console.log(`Elapsed time: ${(elapsedMs / 60000).toFixed(1)} min`);
  console.log(`Real token usage — prompt: ${totalPromptTokens}, output: ${totalOutputTokens}, thoughts: ${totalThoughtsTokens}, total: ${totalTokens}`);
  console.log(`Chunk files written: ${chunkIndex - 1} (base path: ${outBase}-partNN.md)`);

  const SAMPLE_SIZE = 25;
  if (allResultsForSpotCheck.length > 0) {
    const sampleIndices = new Set();
    while (sampleIndices.size < Math.min(SAMPLE_SIZE, allResultsForSpotCheck.length)) {
      sampleIndices.add(Math.floor(Math.random() * allResultsForSpotCheck.length));
    }
    const sample = [...sampleIndices].sort((a, b) => a - b).map((idx) => allResultsForSpotCheck[idx]);
    const samplePath = `${outBase}-random-spotcheck-sample.md`;
    const sampleLines = [
      '# Random spot-check sample across the full run',
      '',
      '| Code | English | Proposed Arabic |',
      '|---|---|---|',
      ...sample.map((r) => `| ${r.code} | ${r.name_en.replace(/\|/g, '/')} | ${r.ar.replace(/\|/g, '/')} |`),
    ];
    fs.writeFileSync(samplePath, sampleLines.join('\n'), 'utf8');
    console.log(`Random spot-check sample written: ${samplePath}`);
  }

  if (!args.commit) {
    console.log('\nDry run complete. No database writes were made.');
    return;
  }

  console.log('\n--commit is not implemented for the full multi-chunk run — use --commit-from per chunk file after review.');
}

main().catch((err) => {
  console.error('Translation run failed:', err.message);
  process.exit(1);
});

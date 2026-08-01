// backend/scripts/import-icd-codes.js
//
// Standalone, manually-run script. NOT imported or called from anywhere else
// in the app. Imports full ICD-10-CM codes from a Kaggle CSV
// (mrhell/icd10cm-codeset-2023) into the existing `medical_codes` table.
//
// Usage:
//   node backend/scripts/import-icd-codes.js --csv <path> --db <database> [--commit]
//   node backend/scripts/import-icd-codes.js --csv <path> --db <database> --code-col "CODE" --desc-col "LONG DESCRIPTION"
//
// Connection host/port/user/password come from backend/.env (PG_HOST, PG_PORT,
// PG_USER, PG_PASSWORD) via dotenv, same as the rest of the app. The target
// --db is REQUIRED and always explicit on the command line (PG_DATABASE from
// .env is intentionally ignored here) so this script can never silently run
// against the wrong database.
//
// Default mode is DRY RUN: it reads the CSV, reports how many rows would be
// read / skipped as duplicates / inserted, and does NOT touch the database
// contents. Pass --commit to actually insert.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const { Client } = require('pg');

function parseArgs(argv) {
  const args = { commit: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--commit') args.commit = true;
    else if (a === '--csv') args.csv = argv[++i];
    else if (a === '--db') args.db = argv[++i];
    else if (a === '--code-col') args.codeCol = argv[++i];
    else if (a === '--desc-col') args.descCol = argv[++i];
    else if (a === '--system') args.system = argv[++i];
  }
  return args;
}

// Minimal RFC4180-ish CSV parser: handles quoted fields, commas/newlines
// inside quotes, and "" as an escaped quote. Good enough for a one-off
// import script without pulling in a new npm dependency.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  // Normalize line endings up front, but keep newlines-inside-quotes intact
  // since we scan character by character rather than splitting on \n first.
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // skip, \n handles the row break
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

const CODE_COL_CANDIDATES = ['code', 'icd_code', 'icd10_code', 'icd10cm code', 'icd-10-cm code', 'cm_code', 'diagnosis code'];
const DESC_COL_CANDIDATES = ['long description', 'long_description', 'description', 'short description', 'short_description', 'name', 'diagnosis'];

function findColumn(headers, explicit, candidates, label) {
  if (explicit) {
    const idx = headers.findIndex((h) => h.trim().toLowerCase() === explicit.trim().toLowerCase());
    if (idx === -1) {
      throw new Error(`--${label}-col "${explicit}" not found in CSV headers: [${headers.join(', ')}]`);
    }
    return idx;
  }
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  throw new Error(
    `Could not auto-detect the ${label} column. CSV headers found: [${headers.join(', ')}]. ` +
    `Pass --${label}-col "<exact header name>" to specify it explicitly.`
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.csv) {
    console.error('Missing required --csv <path>');
    process.exit(1);
  }
  if (!args.db) {
    console.error('Missing required --db <database name> (explicit on purpose — no default database is used)');
    process.exit(1);
  }
  if (!fs.existsSync(args.csv)) {
    console.error(`CSV file not found: ${args.csv}`);
    process.exit(1);
  }

  const system = args.system || 'icd';

  const raw = fs.readFileSync(args.csv, 'utf8').replace(/^﻿/, '');
  const table = parseCsv(raw);
  if (table.length < 2) {
    console.error('CSV appears to have no data rows.');
    process.exit(1);
  }
  const headers = table[0];
  const dataRows = table.slice(1);

  const codeIdx = findColumn(headers, args.codeCol, CODE_COL_CANDIDATES, 'code');
  const descIdx = findColumn(headers, args.descCol, DESC_COL_CANDIDATES, 'desc');

  console.log(`Mode: ${args.commit ? 'COMMIT (will insert)' : 'DRY RUN (no changes will be made)'}`);
  console.log(`Target database: ${args.db}`);
  console.log(`CSV file: ${args.csv}`);
  console.log(`Detected code column: "${headers[codeIdx]}" (index ${codeIdx})`);
  console.log(`Detected description column: "${headers[descIdx]}" (index ${descIdx})`);
  console.log(`Rows read from CSV (excluding header): ${dataRows.length}`);

  const client = new Client({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: args.db,
  });
  await client.connect();

  try {
    const existingRes = await client.query('SELECT code FROM medical_codes WHERE system = $1', [system]);
    const existingCodes = new Set(existingRes.rows.map((r) => r.code));
    console.log(`Existing "${system}" codes already in medical_codes: ${existingCodes.size}`);

    // The Kaggle source has no decimal point (e.g. "A0100"), while the
    // existing rows use standard ICD-10-CM formatting with a "." after the
    // 3rd character (e.g. "A01.00"). 3-character codes (category level, e.g.
    // "A00") are left as-is — there's nothing to insert a dot after.
    function reformatCode(rawCode) {
      if (rawCode.length > 3) {
        return `${rawCode.slice(0, 3)}.${rawCode.slice(3)}`;
      }
      return rawCode;
    }

    const toInsert = [];
    let skippedDuplicates = 0;
    let skippedBlank = 0;
    const reformatExamples = [];

    for (const row of dataRows) {
      const rawCode = (row[codeIdx] || '').trim();
      const desc = (row[descIdx] || '').trim();
      if (!rawCode || !desc) {
        skippedBlank++;
        continue;
      }
      const code = reformatCode(rawCode);
      if (reformatExamples.length < 5 && code !== rawCode) {
        reformatExamples.push({ rawCode, code });
      }
      if (existingCodes.has(code)) {
        skippedDuplicates++;
        continue;
      }
      // Also guard against duplicate codes within the CSV itself.
      existingCodes.add(code);
      toInsert.push({ code, name_en: desc, name_ar: desc });
    }

    console.log('\nCode reformatting examples (raw CSV code -> stored code):');
    for (const ex of reformatExamples) {
      console.log(`  "${ex.rawCode}" -> "${ex.code}"`);
    }

    console.log(`\nSkipped (already exist in DB, or duplicate within CSV): ${skippedDuplicates}`);
    console.log(`Skipped (blank code or description): ${skippedBlank}`);
    console.log(`Rows that would be inserted: ${toInsert.length}`);
    console.log('Note: name_ar is being set equal to name_en as a placeholder (Kaggle source has no Arabic text) — pending translation later.');

    console.log('\nSample rows that would be inserted:');
    for (const sample of toInsert.slice(0, 5)) {
      console.log(`  code="${sample.code}"  name_en="${sample.name_en}"  name_ar="${sample.name_ar}"`);
    }

    if (!args.commit) {
      console.log('\nDry run complete. No rows were inserted. Re-run with --commit to insert.');
      return;
    }

    if (toInsert.length === 0) {
      console.log('\nNothing to insert.');
      return;
    }

    await client.query('BEGIN');
    try {
      const BATCH_SIZE = 500;
      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const values = [];
        const placeholders = batch.map((row, j) => {
          const base = j * 4;
          values.push(system, row.code, row.name_ar, row.name_en);
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
        }).join(', ');
        const res = await client.query(
          `INSERT INTO medical_codes (system, code, name_ar, name_en)
           VALUES ${placeholders}
           ON CONFLICT (system, code) DO NOTHING`,
          values
        );
        inserted += res.rowCount;
      }
      await client.query('COMMIT');
      console.log(`\nCommit complete. Inserted ${inserted} new rows into medical_codes.`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});

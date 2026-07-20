// backend/run-migrations.js
//
// Applies any pending SQL file in migrations-sql/ automatically, in order,
// and skips files already applied. Solves a recurring problem from today's
// session: forgetting to run a SQL file before deploying the matching code
// change, causing "column does not exist" errors.
//
// Run manually:
//   node run-migrations.js
//
// Runs automatically every time start.bat is used (see ecosystem.config.js
// / start.bat), so this step never needs to be remembered by hand again.
//
// How to add a new migration in the future: drop a new .sql file into
// migrations-sql/, named with the next number in sequence (e.g.
// 007_something.sql). It will be picked up and applied automatically next
// time start.bat runs — no manual step needed.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./config/database');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations-sql');

async function ensureTrackingTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ DEFAULT now()
    )
  `);
}

async function getAppliedMigrations() {
  const result = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((r) => r.filename));
}

async function run() {
  console.log('🔧 Checking for pending database migrations...');

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('   No migrations-sql/ folder found — nothing to do.');
    return;
  }

  await ensureTrackingTable();
  const applied = await getAppliedMigrations();

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // alphabetical = numeric order (001_, 002_, ...)

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      skippedCount++;
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`   Applying ${file} ...`);
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      console.log(`   ✅ ${file} applied successfully.`);
      appliedCount++;
    } catch (err) {
      console.error(`   ❌ ${file} FAILED: ${err.message}`);
      console.error('   Stopping here — fix this migration before continuing (later files may depend on it).');
      process.exit(1);
    }
  }

  if (appliedCount === 0 && skippedCount > 0) {
    console.log(`✅ Database already up to date (${skippedCount} migration(s) previously applied).`);
  } else if (appliedCount > 0) {
    console.log(`✅ Applied ${appliedCount} new migration(s), ${skippedCount} already up to date.`);
  } else {
    console.log('✅ No migration files found.');
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Migration runner failed:', err.message);
    process.exit(1);
  });

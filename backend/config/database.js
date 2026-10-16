// server/config/database.js
// PostgreSQL connection via the pg library (lightweight, no heavy ORM, consistent with this project's current style)
// Install the library first: npm install pg

// .env must be loaded directly here (not relying on server.js having already
// loaded it) -- in the test files (tests/testUtils.js), this file is
// imported before require('../server'), so if we waited for dotenv.config()
// from server.js, the Pool underneath it would actually be built with an
// empty password (the default value) instead of the real value from .env --
// because pg.Pool's settings are captured at construction time, not lazily
// later.
require('dotenv').config();
const { Pool, types } = require('pg');

// Fix DATE column timezone shift at the source: by default, node-postgres
// parses SQL DATE columns (OID 1082) into a JS Date object at local
// midnight. When that Date object is later serialized via JSON.stringify
// (res.json), it converts to UTC via toISOString(), which shifts the
// calendar date backward by a day for any timezone ahead of UTC (Iraq is
// UTC+3) — e.g. a stored "2026-07-15" would round-trip through the API as
// "2026-07-14T21:00:00.000Z". Registering this parser makes DATE columns
// come back as the raw "YYYY-MM-DD" string instead, skipping the Date/
// timezone conversion entirely. This only affects how values are READ back
// from a query result — it has no effect on INSERT/UPDATE, which already
// send plain date strings as query parameters.
types.setTypeParser(types.builtins.DATE, (value) => value);

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  database: process.env.PG_DATABASE || 'sihatuna_iraq',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected connection error:', err);
});

// ── Startup improvement: early, explicit connection check ───────────────────
// Before this, if PostgreSQL wasn't running or the .env connection details
// were wrong, the server would start up silently as if everything were
// fine -- and the problem would only surface later as a confusing 503 error
// on the first real user request (exactly the confusion we actually ran
// into while diagnosing earlier issues). This function tests the connection
// immediately at startup and prints a clear message describing the problem
// and the fix, instead of letting the user stumble onto it midway through
// using the system.
async function testConnection() {
  try {
    await pool.query('SELECT 1');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// Shared helper for queries (can be used across files instead of repeating pool.query)
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log('[PG QUERY]', { text, duration, rows: res.rowCount });
  }
  return res;
}

module.exports = { pool, query, testConnection };

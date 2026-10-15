// backend/utils/auditLog.js
//
// Automatically records every add/edit/delete operation on any sensitive
// module: who did it, what changed, and when. Extracted from server.js to
// keep it smaller and make it easy to use from any route file (routes/*)
// without duplicating it.
//
// ── Fix: a customizable path (the same pattern as DB_PATH and REVOKED_TOKENS_PATH) ──────────
// Before this, the path was always fixed (backend/data/audit-log.json),
// unlike DB_PATH and REVOKED_TOKENS_PATH which became customizable via an
// environment variable to isolate automated test data from real data. The
// result: any trial run of the server (even a simple manual curl test)
// was writing directly over the project's *real* audit log without
// meaning to.
const fs = require('fs');
const path = require('path');

const AUDIT_LOG_PATH = process.env.AUDIT_LOG_PATH || path.join(__dirname, '..', 'data', 'audit-log.json');
const MAX_AUDIT_ENTRIES = 5000; // keeps the file size reasonable

const logAudit = (entry) => {
  try {
    let log = [];
    if (fs.existsSync(AUDIT_LOG_PATH)) {
      log = JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, 'utf8'));
    }
    log.push({
      id: log.length > 0 ? log[log.length - 1].id + 1 : 1,
      timestamp: new Date().toISOString(),
      ...entry,
    });
    if (log.length > MAX_AUDIT_ENTRIES) log = log.slice(log.length - MAX_AUDIT_ENTRIES);
    fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(log, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️  Failed to write audit log:', err.message);
  }
};

module.exports = { logAudit, AUDIT_LOG_PATH };

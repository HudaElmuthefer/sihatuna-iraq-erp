// backend/routes/backupsRoutes.js
//
// Backup and audit log routes.
//
// ── Security fix ────────────────────────────────────────────────────────────
// All of these routes require a **global admin (ministry level)**
// exclusively, not just any admin -- a single backup file contains the
// data of *every* facility together (a full PostgreSQL dump via pg_dump),
// so it makes no sense to delegate access to it, or to restoring it, to a
// local admin tied to a single facility (who could theoretically restore
// an old backup, wiping out other facilities' recent changes entirely).
// The same logic applies to the global audit log -- see
// middleware/requireGlobalAdmin.js.
//
// ── Addition: POST /backups/run now accepts an optional destination in the request body ──────
// { destination: 'pgadmin' | 'computer' | 'cloud', cloudUrl?: string }
// Without a destination (or the old call with no body), it works exactly
// as before -- a normal local backup, with no change to existing behavior.
const express = require('express');
const fs = require('fs');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const requireGlobalAdmin = require('../middleware/requireGlobalAdmin');
const { listBackups, restoreFromBackup, runBackup, runBackupWithDestination } = require('../utils/backup');
const { logAudit, AUDIT_LOG_PATH } = require('../utils/auditLog');

const router = express.Router();

// ── BACKUPS ──────────────────────────────────────────────────────────────────
router.get('/backups', auth, requireGlobalAdmin, (req, res) => {
  res.json(listBackups());
});

router.post('/backups/run', auth, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const { destination, cloudUrl } = req.body || {};

  // No destination specified: the exact same old behavior (a normal local backup)
  if (!destination) {
    await runBackup();
    logAudit({ module: 'system', action: 'manual_backup', userId: req.user.id, userRole: req.user.role });
    return res.json({ success: true, backups: listBackups() });
  }

  const result = await runBackupWithDestination(destination, cloudUrl);
  logAudit({
    module: 'system',
    action: 'manual_backup',
    userId: req.user.id,
    userRole: req.user.role,
    after: { destination },
  });

  if (result.type === 'computer') {
    return res.download(result.sqlFilePath, 'sihatuna_backup.sql');
  }

  const messages = {
    pgadmin: 'تم إنشاء النسخة الاحتياطية بنجاح، جاهزة للفتح من pgAdmin',
    cloud: 'تم إنشاء النسخة الاحتياطية ورفعها على الكلاود بنجاح',
  };

  res.json({ success: true, message: messages[result.type], backups: listBackups() });
}));

router.post('/backups/:name/restore', auth, requireGlobalAdmin, (req, res) => {
  try {
    restoreFromBackup(req.params.name);
    logAudit({ module: 'system', action: 'restore_backup', userId: req.user.id, userRole: req.user.role, after: { backupName: req.params.name } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── AUDIT LOG ─────────────────────────────────────────────────────────────────
// GET /api/audit-log?module=patients&limit=100  (global admin only)
router.get('/audit-log', auth, requireGlobalAdmin, (req, res) => {
  if (!fs.existsSync(AUDIT_LOG_PATH)) return res.json([]);
  let log = JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, 'utf8'));
  const { module, action, userId, limit } = req.query;
  if (module) log = log.filter(e => e.module === module);
  if (action) log = log.filter(e => e.action === action);
  if (userId) log = log.filter(e => String(e.userId) === String(userId));
  log = log.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(log.slice(0, Number(limit) || 200));
});

module.exports = router;

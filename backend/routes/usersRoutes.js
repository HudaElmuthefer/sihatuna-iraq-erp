// backend/routes/usersRoutes.js
//
// ── Critical security fix (previously saved) ────────────────────────────────
// These routes used to have no role check at all — auth only verified that
// the token was valid, regardless of who it belonged to. That meant any
// regular user (a nurse, an accountant...) could, via a direct API call
// (outside the UI), create a new admin account for themselves, or change
// the role/password of any other account in the system — a complete
// privilege takeover.
// Now: all read and write operations on users are admin-only.
//
// ── Second security fix (historical — now tightened further, see the next paragraph) ─────────
// requireAdmin alone only checks role === 'admin' — with no regard to
// which facility that admin belongs to. A local admin tied to a specific
// hospital (with a specific hospitalId on their account) could view, edit,
// delete, and even **reset the password** of users at completely different
// hospitals. The first fix was: an admin with a hospitalId only sees users
// of their own facility (inScope below, following the same
// belongsToUserHospital pattern used in pgCrud.js for the other modules).
//
// ── Third security fix: user management becomes exclusive to the global admin ─────────────────────
// A "hospital manager" (an admin with a hospitalId) automatically gets full
// permissions over their facility's data via the general
// requirePermission.js bypass for any role==='admin' — this is intentional
// and doesn't need changing. But managing the accounts themselves
// (creating/editing/deleting users, resetting passwords) must stay
// exclusive to the global admin (ministry level) — even a local admin
// doesn't create accounts for their own facility; only the global admin
// does that on their behalf. So every route in this file (other than
// self-service below) now uses requireGlobalAdmin instead of requireAdmin.
// inScope stays here (practically inactive now, since
// actingAdmin.hospitalId is always empty for any requester who passes
// requireGlobalAdmin) as documentation of the logic and for the
// flexibility of any future partial delegation.
//
// ── Migrating db.json → PostgreSQL ───────────────────────────────────────────────
// This file used to read/write system users from a flat file
// (backend/data/db.json via utils/db.js) — with no real constraints beside
// the database (no uniqueness, no foreign keys, vulnerable to file
// corruption and concurrent write conflicts). All the queries below now run
// directly against the real users table in PostgreSQL (see
// database/postgres_schema.sql and
// migrations-sql/016_users_real_columns.sql). The user id is now a UUID
// (instead of a sequential number) — the old protection "user id==1 cannot
// be deleted" was replaced with an is_primary_admin column.
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const requireGlobalAdmin = require('../middleware/requireGlobalAdmin');
const { pool } = require('../config/database');
const { mapUserRow } = require('../utils/userMapper');
const { logAudit } = require('../utils/auditLog');

const router = express.Router();

// Checks whether a target user falls within the current admin's scope —
// a global admin (with no hospitalId) sees everyone; a local admin only
// sees users of their own facility.
// Practically inactive now (actingAdmin.hospitalId is always empty for any
// requester who passes requireGlobalAdmin) — kept as documentation of the
// logic and for the flexibility of any future partial delegation.
const inScope = (actingAdmin, targetUser) => {
  if (!actingAdmin.hospitalId) return true; // a global admin
  return targetUser?.hospital_id === actingAdmin.hospitalId;
};

router.get('/users', auth, requireGlobalAdmin, async (req, res, next) => {
  try {
    const result = req.user.hospitalId
      ? await pool.query('SELECT * FROM users WHERE hospital_id = $1 ORDER BY created_at ASC', [req.user.hospitalId])
      : await pool.query('SELECT * FROM users ORDER BY created_at ASC');
    res.json(result.rows.map(mapUserRow));
  } catch (err) { next(err); }
});

router.post('/users', auth, requireGlobalAdmin, async (req, res, next) => {
  try {
    const { password, name, email, role, jobTitle, avatar, color, permissions } = req.body;
    const hashed = bcrypt.hashSync(password || 'changeme', 10);
    // A local admin automatically forces their own facility onto any
    // account they create, ignoring any other hospitalId sent in the
    // request — prevents creating a user at a different facility by
    // manually tampering with the request. A global admin can specify any
    // facility (or leave it empty for a ministry-level account).
    const hospitalId = req.user.hospitalId ? req.user.hospitalId : (req.body.hospitalId || null);

    let inserted;
    try {
      inserted = await pool.query(
        `INSERT INTO users (hospital_id, full_name, username, password, email, role, job_title, avatar, color, permissions)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [hospitalId, name || req.body.username, req.body.username, hashed, email || null, role || 'staff',
          jobTitle || null, avatar || null, color || null, JSON.stringify(permissions || [])]
      );
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ message: 'اسم المستخدم مستخدَم مسبقاً' });
      throw err;
    }

    const safe = mapUserRow(inserted.rows[0]);
    logAudit({ module: 'users', action: 'create', recordId: safe.id, userId: req.user.id, userRole: req.user.role, after: safe });
    res.status(201).json(safe);
  } catch (err) { next(err); }
});

router.put('/users/:id', auth, requireGlobalAdmin, async (req, res, next) => {
  try {
    const existingRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (existingRes.rows.length === 0 || !inScope(req.user, existingRes.rows[0])) {
      return res.status(404).json({ message: 'غير موجود' });
    }
    const existing = existingRes.rows[0];
    const { password, hospitalId, name, email, role, jobTitle, avatar, color, permissions, isActive } = req.body;

    // A local admin cannot move a user to a different facility (hospitalId
    // stays fixed on their own facility); a global admin can change it freely.
    const nextHospitalId = req.user.hospitalId ? existing.hospital_id : (hospitalId !== undefined ? hospitalId : existing.hospital_id);

    const updated = await pool.query(
      `UPDATE users SET
         full_name = COALESCE($1, full_name),
         email = COALESCE($2, email),
         role = COALESCE($3, role),
         job_title = COALESCE($4, job_title),
         avatar = COALESCE($5, avatar),
         color = COALESCE($6, color),
         permissions = COALESCE($7, permissions),
         is_active = COALESCE($8, is_active),
         password = COALESCE($9, password),
         hospital_id = $10,
         updated_at = now()
       WHERE id = $11 RETURNING *`,
      [
        name || null, email || null, role || null, jobTitle || null, avatar || null, color || null,
        permissions !== undefined ? JSON.stringify(permissions) : null,
        isActive !== undefined ? isActive : null,
        password ? bcrypt.hashSync(password, 10) : null,
        nextHospitalId,
        req.params.id,
      ]
    );
    const safe = mapUserRow(updated.rows[0]);
    logAudit({ module: 'users', action: 'update', recordId: safe.id, userId: req.user.id, userRole: req.user.role, after: safe });
    res.json(safe);
  } catch (err) { next(err); }
});

router.delete('/users/:id', auth, requireGlobalAdmin, async (req, res, next) => {
  try {
    const targetRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    const target = targetRes.rows[0];
    if (!target || !inScope(req.user, target)) return res.status(404).json({ message: 'غير موجود' });
    if (target.is_primary_admin) return res.status(403).json({ message: 'لا يمكن حذف المدير الرئيسي' });

    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    logAudit({ module: 'users', action: 'delete', recordId: req.params.id, userId: req.user.id, userRole: req.user.role });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Bulk deactivate/delete for every user of a single facility at once ───────────────────────
// Used when a hospital's subscription ends: instead of deactivating/deleting
// users one by one (including the hospital manager themselves), the global
// admin presses a single button that applies to everyone at once.
// Exclusive to the global admin (requireGlobalAdmin) — there's no reason to
// delegate this to the hospital manager themselves (they couldn't
// deactivate their own account from inside their own current session anyway).
// The primary admin (is_primary_admin) is always excluded from bulk
// deactivation/deletion.
router.post('/users/bulk-deactivate', auth, requireGlobalAdmin, async (req, res, next) => {
  try {
    const { hospitalId } = req.body;
    if (!hospitalId) return res.status(400).json({ message: 'hospitalId مطلوب' });
    const result = await pool.query(
      'UPDATE users SET is_active = FALSE, updated_at = now() WHERE hospital_id = $1 AND is_primary_admin = FALSE RETURNING id',
      [hospitalId]
    );
    logAudit({ module: 'users', action: 'bulk_deactivate', userId: req.user.id, userRole: req.user.role, after: { hospitalId, count: result.rowCount, userIds: result.rows.map(r => r.id) } });
    res.json({ success: true, count: result.rowCount });
  } catch (err) { next(err); }
});

router.post('/users/bulk-delete', auth, requireGlobalAdmin, async (req, res, next) => {
  try {
    const { hospitalId } = req.body;
    if (!hospitalId) return res.status(400).json({ message: 'hospitalId مطلوب' });
    const result = await pool.query(
      'DELETE FROM users WHERE hospital_id = $1 AND is_primary_admin = FALSE RETURNING id',
      [hospitalId]
    );
    logAudit({ module: 'users', action: 'bulk_delete', userId: req.user.id, userRole: req.user.role, after: { hospitalId, count: result.rowCount, userIds: result.rows.map(r => r.id) } });
    res.json({ success: true, count: result.rowCount });
  } catch (err) { next(err); }
});

// ── Password recovery (without email — the system has no SMTP service) ──────
// The practical solution available: the admin generates a random temporary
// password for the user (shown to them only once in the admin UI, and
// delivered to the user manually by phone or in person), and that user is
// forced to change it on their first login (mustChangePassword).
// The temporary password itself is never stored as plain text — only its
// encrypted (bcrypt) copy — and it's never recorded in the audit log for
// any reason.
router.post('/users/:id/reset-password', auth, requireGlobalAdmin, async (req, res, next) => {
  try {
    const targetRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (targetRes.rows.length === 0 || !inScope(req.user, targetRes.rows[0])) {
      return res.status(404).json({ message: 'غير موجود' });
    }

    // A secure random temporary password (12 hex characters = 6 random
    // bytes, easy to read and speak over the phone compared to base64
    // encoding, for example)
    const tempPassword = crypto.randomBytes(6).toString('hex');
    await pool.query(
      'UPDATE users SET password = $1, must_change_password = TRUE, updated_at = now() WHERE id = $2',
      [bcrypt.hashSync(tempPassword, 10), req.params.id]
    );

    // We record in the audit log that a reset happened — without the password itself at all
    logAudit({ module: 'users', action: 'password_reset', recordId: req.params.id, userId: req.user.id, userRole: req.user.role });

    // The temporary password is returned in the response body exactly once
    // here — it will never appear anywhere else again (not in the audit
    // log, not in any later query). The admin must copy it immediately.
    res.json({ success: true, tempPassword });
  } catch (err) { next(err); }
});

// Self-service password change — any logged-in user can change their own
// password (needs to know the current password first, including a
// temporary password issued by the admin above). (Deliberately no facility
// check here — every user only ever changes their own password, regardless
// of their facility, so there's no possible access across a different
// facility in the first place)
router.put('/users/me/password', auth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'كلمة المرور الحالية والجديدة مطلوبتان' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف' });
    }
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'غير موجود' });

    const valid = bcrypt.compareSync(currentPassword, result.rows[0].password);
    if (!valid) return res.status(401).json({ message: 'كلمة المرور الحالية غير صحيحة' });

    await pool.query(
      'UPDATE users SET password = $1, must_change_password = FALSE, updated_at = now() WHERE id = $2',
      [bcrypt.hashSync(newPassword, 10), req.user.id]
    );
    logAudit({ module: 'users', action: 'password_self_change', recordId: req.user.id, userId: req.user.id, userRole: req.user.role });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── A per-user customizable dashboard (Stage 5) ────────────────────────────
// dashboardLayout = an array of the visible widget keys, in their actual
// display order — removing a key from the array means hiding that widget,
// and the array's order itself is the display order (eliminates the need
// for a separate "order" field). null/missing = the user hasn't
// customized anything yet, so the full default list is used on the frontend.
const VALID_DASHBOARD_WIDGETS = ['erp', 'stats', 'departments', 'appointments', 'doctors'];

router.put('/users/me/dashboard-layout', auth, async (req, res, next) => {
  try {
    const { widgets } = req.body;
    if (!Array.isArray(widgets) || !widgets.every(w => VALID_DASHBOARD_WIDGETS.includes(w))) {
      return res.status(400).json({ message: 'قائمة ودجت غير صالحة' });
    }
    // Prevent duplicates within the same request — a simple safeguard against malformed data from the UI
    const deduped = [...new Set(widgets)];
    const result = await pool.query(
      'UPDATE users SET dashboard_layout = $1, updated_at = now() WHERE id = $2 RETURNING id',
      [JSON.stringify(deduped), req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'غير موجود' });
    res.json({ success: true, dashboardLayout: deduped });
  } catch (err) { next(err); }
});

router.delete('/users/me/dashboard-layout', auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE users SET dashboard_layout = NULL, updated_at = now() WHERE id = $1 RETURNING id',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'غير موجود' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;

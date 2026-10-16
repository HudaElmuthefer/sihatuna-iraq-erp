// backend/routes/hospitalsRoutes.js
//
// Routes for facilities (hospitals) and general system settings
// (system_settings) -- the foundation of multi-facility support. The
// hospitals table has explicit columns (it doesn't use the flexible JSONB
// pattern like the rest of the modules), so it has dedicated routes
// instead of pgCrud. Reading (GET) is available to any logged-in user (every
// user needs it to show the list of facilities when selecting a
// patient/employee, for example).
//
// ── Security fix ────────────────────────────────────────────────────────
// Adding/editing/deleting requires a **global admin (ministry level)**
// exclusively -- deliberately not the regular requireAdmin. Managing the
// facility list itself (adding/deleting a hospital, editing its data) is
// an operation that touches the entire system, so delegating it to a
// local admin tied to one facility makes no sense -- a local admin for a
// given hospital should not be able to edit or delete another hospital's
// data, even if their own role is "admin". See
// middleware/requireGlobalAdmin.js.
const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const requireGlobalAdmin = require('../middleware/requireGlobalAdmin');
const { pool } = require('../config/database');
const { logAudit } = require('../utils/auditLog');

const router = express.Router();

router.get('/hospitals', auth, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM hospitals ORDER BY created_at ASC');
  res.json(result.rows);
}));

router.post('/hospitals', auth, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const { nameAr, nameEn, address, phone, enabledPages } = req.body;
  if (!nameAr || !nameEn) return res.status(400).json({ message: 'الاسم بالعربي والإنكليزي مطلوبان' });
  const result = await pool.query(
    `INSERT INTO hospitals (name_ar, name_en, address, phone, enabled_pages) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [nameAr, nameEn, address || null, phone || null, enabledPages ? JSON.stringify(enabledPages) : null]
  );
  logAudit({ module: 'hospitals', action: 'create', recordId: result.rows[0].id, userId: req.user.id, userRole: req.user.role, after: result.rows[0] });
  res.status(201).json(result.rows[0]);
}));

router.put('/hospitals/:id', auth, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const { nameAr, nameEn, address, phone, isActive, enabledPages } = req.body;
  const result = await pool.query(
    `UPDATE hospitals SET name_ar=$1, name_en=$2, address=$3, phone=$4, is_active=$5, enabled_pages=$6, updated_at=now()
     WHERE id=$7 RETURNING *`,
    [nameAr, nameEn, address || null, phone || null, isActive !== false, enabledPages ? JSON.stringify(enabledPages) : null, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ message: 'غير موجود' });
  logAudit({ module: 'hospitals', action: 'update', recordId: req.params.id, userId: req.user.id, userRole: req.user.role, after: result.rows[0] });
  res.json(result.rows[0]);
}));

router.delete('/hospitals/:id', auth, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const count = await pool.query('SELECT COUNT(*) FROM hospitals');
  if (Number(count.rows[0].count) <= 1) {
    return res.status(400).json({ message: 'لا يمكن حذف آخر منشأة متبقية بالنظام' });
  }
  await pool.query('DELETE FROM hospitals WHERE id=$1', [req.params.id]);
  logAudit({ module: 'hospitals', action: 'delete', recordId: req.params.id, userId: req.user.id, userRole: req.user.role });
  res.json({ success: true });
}));

// General system settings (key/value) — first use: enabling the multi-hospital system
router.get('/system-settings/:key', auth, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT value FROM system_settings WHERE key=$1', [req.params.key]);
  res.json({ key: req.params.key, value: result.rows[0]?.value ?? null });
}));

router.put('/system-settings/:key', auth, requireGlobalAdmin, asyncHandler(async (req, res) => {
  await pool.query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [req.params.key, JSON.stringify(req.body.value)]
  );
  logAudit({ module: 'system_settings', action: 'update', recordId: req.params.key, userId: req.user.id, userRole: req.user.role, after: { value: req.body.value } });
  res.json({ success: true, key: req.params.key, value: req.body.value });
}));

module.exports = router;

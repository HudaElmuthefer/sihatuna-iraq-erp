// backend/routes/recycleBinRoutes.js
//
// Recycle bin: any delete in any module (via pgCrud.js) moves the record
// here instead of deleting it permanently — this file provides exactly
// three operations, all restricted to admin only:
//   GET    /api/recycle-bin           a list of every deleted item (scoped
//                                      to the user's facility if they're tied to one)
//   POST   /api/recycle-bin/:id/restore   returns the item to its original table
//   DELETE /api/recycle-bin/:id            permanent delete from the recycle bin (irreversible)
//
// Relies on the moduleRegistry exported from pgCrud.js to know the actual
// table and the indexed-column structure for each module without
// duplicating those details here.
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const auth = require('../middleware/auth');
const { moduleRegistry } = require('./pgCrud');
const { logAudit } = require('../utils/auditLog');
const { deleteUploadedFile } = require('../config/uploadConfig');

// Every recycle-bin operation requires admin permission only (restore or permanent delete is a sensitive decision)
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'صلاحية إدمن مطلوبة' });
  next();
};

// GET /api/recycle-bin
router.get('/', auth, adminOnly, async (req, res, next) => {
  try {
    const conditions = [];
    const params = [];
    // An admin tied to a specific facility only sees that facility's items; an admin with no facility (ministry-level) sees everything
    if (req.user?.hospitalId) {
      params.push(req.user.hospitalId);
      conditions.push(`hospital_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM recycle_bin ${where} ORDER BY deleted_at DESC LIMIT 500`,
      params
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      moduleKey: r.module_key,
      originalId: r.original_id,
      data: r.data,
      hospitalId: r.hospital_id,
      deletedBy: r.deleted_by,
      deletedByName: r.deleted_by_name,
      deletedAt: r.deleted_at,
    })));
  } catch (err) { next(err); }
});

// POST /api/recycle-bin/:id/restore
router.post('/:id/restore', auth, adminOnly, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const binRes = await client.query('SELECT * FROM recycle_bin WHERE id = $1', [req.params.id]);
    if (binRes.rows.length === 0) return res.status(404).json({ message: 'غير موجود بسلة المحذوفات' });
    const binRow = binRes.rows[0];

    if (req.user?.hospitalId && binRow.hospital_id && binRow.hospital_id !== req.user.hospitalId) {
      return res.status(404).json({ message: 'غير موجود' });
    }

    const moduleInfo = moduleRegistry[binRow.module_key];
    if (!moduleInfo) {
      return res.status(409).json({ message: `تعذّر الاسترجاع: الموديول "${binRow.module_key}" لم يعد مسجَّلاً بالنظام.` });
    }
    const { tableName, indexedColumns } = moduleInfo;

    const rest = { ...binRow.data };
    delete rest.id;
    const indexedValues = indexedColumns.map(({ field }) => rest[field] ?? null);
    indexedColumns.forEach(({ field }) => delete rest[field]);

    // We try to keep the same original id (matters if other records
    // reference it, such as dossiers.retiredId) as long as there's no
    // conflict with a new record that took the same number during the
    // period it was in the recycle bin; if there's a conflict, we restore
    // it with a new id instead of failing.
    const collision = await client.query(`SELECT id FROM ${tableName} WHERE id = $1`, [binRow.original_id]);
    const preserveId = collision.rows.length === 0;

    let sql, values;
    const dataCol = indexedColumns.length === 0 ? 'data' : `${indexedColumns.map(c => c.column).join(', ')}, data`;
    if (preserveId) {
      if (indexedColumns.length === 0) {
        sql = `INSERT INTO ${tableName} (id, data) VALUES ($1, $2) RETURNING *`;
        values = [binRow.original_id, JSON.stringify(rest)];
      } else {
        const placeholders = indexedColumns.map((_, i) => `$${i + 2}`).join(', ');
        sql = `INSERT INTO ${tableName} (id, ${indexedColumns.map(c => c.column).join(', ')}, data) VALUES ($1, ${placeholders}, $${indexedColumns.length + 2}) RETURNING *`;
        values = [binRow.original_id, ...indexedValues, JSON.stringify(rest)];
      }
    } else {
      if (indexedColumns.length === 0) {
        sql = `INSERT INTO ${tableName} (data) VALUES ($1) RETURNING *`;
        values = [JSON.stringify(rest)];
      } else {
        const placeholders = indexedColumns.map((_, i) => `$${i + 1}`).join(', ');
        sql = `INSERT INTO ${tableName} (${indexedColumns.map(c => c.column).join(', ')}, data) VALUES (${placeholders}, $${indexedColumns.length + 1}) RETURNING *`;
        values = [...indexedValues, JSON.stringify(rest)];
      }
    }

    await client.query('BEGIN');
    const inserted = await client.query(sql, values);
    await client.query('DELETE FROM recycle_bin WHERE id = $1', [binRow.id]);
    await client.query('COMMIT');

    const record = { ...inserted.rows[0].data, id: inserted.rows[0].id };
    indexedColumns.forEach(({ field, column }) => { record[field] = inserted.rows[0][column]; });
    logAudit({ action: 'RESTORE', table: tableName, recordId: record.id, note: preserveId ? '' : `معرّف جديد بدل ${binRow.original_id} — تعارض`, userId: req.user?.id, username: req.user?.username });
    res.json({ success: true, record, idChanged: !preserveId });
  } catch (err) {
    // Critical fix: the same issue as the delete route in pgCrud.js — an
    // unprotected ROLLBACK can crash the entire server if it itself fails.
    try { await client.query('ROLLBACK'); } catch (rollbackErr) {
      console.error('ROLLBACK failed after a recycle-bin restore error:', rollbackErr.message);
    }
    next(err);
  } finally {
    client.release();
  }
});

// DELETE /api/recycle-bin/:id — a permanent delete, can never be undone
router.delete('/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const binRes = await pool.query('SELECT * FROM recycle_bin WHERE id = $1', [req.params.id]);
    if (binRes.rows.length === 0) return res.status(404).json({ message: 'غير موجود' });
    if (req.user?.hospitalId && binRes.rows[0].hospital_id && binRes.rows[0].hospital_id !== req.user.hospitalId) {
      return res.status(404).json({ message: 'غير موجود' });
    }
    await pool.query('DELETE FROM recycle_bin WHERE id = $1', [req.params.id]);
    // Fix: permanently deleting a dossier document (employee/retiree) from
    // the recycle bin used to only delete the recycle_bin row, leaving the
    // actual attached file orphaned in the uploads folder forever -- this
    // is the route the UI actually uses (DossiersTab.js calls the general
    // DELETE /api/dossiers/:id, which moves it to the recycle bin first,
    // and the actual delete then happens here later from the settings page).
    if (binRes.rows[0].module_key === 'dossiers') {
      await deleteUploadedFile(binRes.rows[0].data?.filePath);
    }
    logAudit({ action: 'PURGE', table: 'recycle_bin', recordId: req.params.id, note: 'حذف نهائي — لا رجعة', userId: req.user?.id, username: req.user?.username });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;

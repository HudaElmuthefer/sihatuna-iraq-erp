// backend/routes/employeeDossierRoutes.js
//
// Critical fix: the "personal dossiers" tab under active employees had no
// connection to the backend at all -- any document (a certificate, a
// contract) was lost the moment the page refreshed, and even the attached
// file itself was only a local preview (a blob URL) that was never
// actually uploaded anywhere. This file builds the missing real route
// (GET/POST/DELETE /api/employees/:id/dossier) wired to the dossiers table
// that already exists in the database (purely JSONB -- just id/data/
// created_at/updated_at), and uses the same shared multer config
// (config/uploadConfig.js) used by the rest of the upload routes in the
// project, so the allowed file type/size stays consistent across the
// whole system.
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../config/database');
const { upload, deleteUploadedFile } = require('../config/uploadConfig');

router.use(auth);

// ── Fetching all documents of a given employee ──────────────────────────────────────────────────
router.get('/employees/:id/dossier', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, data FROM dossiers WHERE data->>'employeeId' = $1 ORDER BY id DESC`,
      [String(id)]
    );
    res.json(result.rows.map(r => ({ id: r.id, ...r.data })));
  } catch (err) {
    console.error('❌ [GET /api/employees/:id/dossier]', err.message);
    res.status(500).json({ message: 'تعذّر جلب الإضبارة' });
  }
});

// ── Uploading a new document (with a real attached file) ────────────────────────────────────
router.post('/employees/:id/dossier', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { type, title, date, notes } = req.body;
    // Fix: without this check, a request with no attached file used to pass
    // silently and create a record with no filePath -- breaking the
    // /^\/uploads\// test assertion later instead of a clear rejection up front.
    if (!req.file) {
      return res.status(400).json({ message: 'الملف المرفق مطلوب' });
    }
    const data = {
      employeeId: String(id),
      type: type || '',
      title: title || '',
      date: date || '',
      notes: notes || '',
      filePath: `/uploads/${req.file.filename}`,
      fileType: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
    };
    const result = await pool.query(
      `INSERT INTO dossiers (data) VALUES ($1) RETURNING id, data`,
      [JSON.stringify(data)]
    );
    res.status(201).json({ id: result.rows[0].id, ...result.rows[0].data });
  } catch (err) {
    // Fix: a multer error (a file type/size rejected by uploadConfig.js)
    // carries its own statusCode (400) -- we show it as is instead of
    // generalizing it into a confusing 500.
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    console.error('❌ [POST /api/employees/:id/dossier]', err.message);
    res.status(500).json({ message: 'تعذّر رفع الوثيقة' });
  }
});

// ── Deleting a document ────────────────────────────────────────────────────────────────
router.delete('/employees/:id/dossier/:docId', async (req, res) => {
  try {
    const { id, docId } = req.params;
    // Confirm the document actually belongs to this employee before
    // deleting -- prevents deleting another employee's document just by
    // guessing a docId.
    const result = await pool.query(
      `DELETE FROM dossiers WHERE id = $1 AND data->>'employeeId' = $2 RETURNING id, data`,
      [docId, String(id)]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'الوثيقة غير موجودة' });
    }
    // A permanent delete here (no recycle bin, unlike the general DELETE
    // /api/dossiers/:id) -- the attached file must also be deleted from
    // disk, or it stays orphaned forever.
    await deleteUploadedFile(result.rows[0].data?.filePath);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ [DELETE /api/employees/:id/dossier/:docId]', err.message);
    res.status(500).json({ message: 'تعذّر حذف الوثيقة' });
  }
});

module.exports = router;

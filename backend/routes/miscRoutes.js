// backend/routes/miscRoutes.js
//
// Miscellaneous routes: uploading personal dossier documents (active
// employees and retirees together, in one shared PostgreSQL `dossiers`
// table), a general file upload, and dashboard statistics.
const express = require('express');
const auth = require('../middleware/auth');
const { upload } = require('../config/uploadConfig');
const { pool } = require('../config/database');

const router = express.Router();
const PORT = process.env.PORT || 8000;

// ── Dossiers for retirees and active employees (the real dossiers table in PostgreSQL) ──
// Root-cause fix: this route (POST/DELETE) used to write to the temporary
// db.json file, while the retirees page actually read documents from the
// real PostgreSQL table (GET /api/dossiers via pgCrud) -- meaning any
// document actually uploaded was stored in a completely different place
// than where it was displayed from, so it disappeared after the first page
// refresh. And active-employee dossiers used to be entirely in the db.json
// file (both reading and writing), completely separate from the database
// and the recycle bin. Now both are stored in the same real PostgreSQL
// table (`dossiers`, with a retiredId or employeeId field depending on the
// type) -- this resolves the read/write mismatch, and automatically gives
// deletes recycle-bin protection (the delete itself was removed from here
// -- the frontend uses the general DELETE /api/dossiers/:id directly via
// pgCrud, which is already registered with the recycle bin).
router.post('/retired/:id/dossier', auth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.body.title) return res.status(400).json({ message: 'العنوان مطلوب' });
    const data = {
      retiredId: Number(req.params.id),
      type: req.body.type || 'وثيقة',
      title: req.body.title,
      date: req.body.date || '',
      notes: req.body.notes || '',
      fileName: req.file ? req.file.originalname : null,
      filePath: req.file ? `/uploads/${req.file.filename}` : null,
      fileType: req.file ? req.file.mimetype : null,
      hospitalId: req.user?.hospitalId || null,
    };
    const result = await pool.query('INSERT INTO dossiers (data) VALUES ($1) RETURNING *', [JSON.stringify(data)]);
    res.status(201).json({ ...result.rows[0].data, id: result.rows[0].id });
  } catch (err) { next(err); }
});

router.post('/employees/:id/dossier', auth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.body.title) return res.status(400).json({ message: 'العنوان مطلوب' });
    const data = {
      employeeId: Number(req.params.id),
      type: req.body.type || 'وثيقة',
      title: req.body.title,
      date: req.body.date || '',
      notes: req.body.notes || '',
      fileName: req.file ? req.file.originalname : null,
      filePath: req.file ? `/uploads/${req.file.filename}` : null,
      fileType: req.file ? req.file.mimetype : null,
      hospitalId: req.user?.hospitalId || null,
    };
    const result = await pool.query('INSERT INTO dossiers (data) VALUES ($1) RETURNING *', [JSON.stringify(data)]);
    res.status(201).json({ ...result.rows[0].data, id: result.rows[0].id });
  } catch (err) { next(err); }
});

// ── FILE UPLOAD (general) ─────────────────────────────────────────────────────
router.post('/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'لا يوجد ملف' });
  res.json({
    url: `http://localhost:${PORT}/uploads/${req.file.filename}`,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
});

// ── DASHBOARD STATS ───────────────────────────────────────────────────────────
// ── Fix: this route used to read from db.json (readDB) -- entirely stale data.
// Patients, doctors, appointments, departments, employees, and retirees
// all moved to real PostgreSQL tables a long time ago (via pgCrud), and are
// no longer written to the db.json file at all. That meant the dashboard
// was showing numbers frozen at the moment of the migration, regardless of
// what was actually happening in the system. Now we query the real tables directly.
router.get('/stats', auth, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [patients, doctors, appointments, departments, employees, retired] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM patients'),
      pool.query(`SELECT COUNT(*) FROM doctors WHERE status = 'active'`),
      pool.query('SELECT COUNT(*) FROM appointments WHERE date = $1', [today]),
      pool.query('SELECT COUNT(*) FROM departments'),
      pool.query('SELECT COUNT(*) FROM employees'),
      pool.query('SELECT COUNT(*) FROM retired'),
    ]);
    res.json({
      patients: parseInt(patients.rows[0].count, 10),
      doctors: parseInt(doctors.rows[0].count, 10),
      appointments: parseInt(appointments.rows[0].count, 10),
      departments: parseInt(departments.rows[0].count, 10),
      employees: parseInt(employees.rows[0].count, 10),
      retired: parseInt(retired.rows[0].count, 10),
    });
  } catch (err) { next(err); }
});

module.exports = router;

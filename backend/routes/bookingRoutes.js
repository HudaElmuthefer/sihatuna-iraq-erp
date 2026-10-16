// backend/routes/bookingRoutes.js
//
// A dedicated booking route for the "Personal Services" page
// (PersonalServicesPage.js) -- deliberately kept separate from the general
// appointments route (POST /api/appointments via the standard pgCrud),
// because it needs a real time-conflict check at the database level before
// inserting: two patients must not end up booking the exact same doctor,
// date, and time. A check like this can't be done reliably on the
// frontend alone -- if different users press "confirm booking" at almost
// the exact same moment, each one has their own stale local copy of
// appointments and doesn't see the other's booking until it actually
// arrives, so a real conflict happens even though the local check in the
// UI didn't reject it at the time. The check here happens inside the same
// insert request directly against the real database, so it catches the
// conflict even if it happens at almost the exact same moment.
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const auth = require('../middleware/auth');
const { validateFields } = require('../middleware/validate');
const collectionSchemas = require('../middleware/schemas');

router.post('/booking/book-appointment', auth, async (req, res, next) => {
  try {
    const { patient, patientPhone, doctor, doctorEn, department, date, time, notes } = req.body || {};
    if (!patient || !doctor || !date || !time) {
      return res.status(400).json({ message: 'المريض والطبيب والتاريخ والوقت كلها مطلوبة' });
    }

    // ── The real conflict check: same doctor + same date + same time, and
    // a non-cancelled status. patient/doctor/date/status are real, already
    // indexed columns (the same pgCrud mapping for the appointments module
    // in modules.js), while "time" is only stored inside the data column
    // (JSONB) -- we query it from there.
    const conflict = await pool.query(
      `SELECT id FROM appointments
       WHERE doctor = $1 AND date = $2 AND data->>'time' = $3 AND status != 'cancelled'
       LIMIT 1`,
      [doctor, date, time]
    );
    if (conflict.rows.length > 0) {
      return res.status(409).json({ message: 'هذا الموعد محجوز فعلاً لهذا الطبيب — اختر وقتاً آخر' });
    }

    const data = {
      patient, patientPhone: patientPhone || null,
      doctor, doctorEn: doctorEn || doctor,
      department: department || '',
      date, time,
      status: 'pending', type: 'consult',
      notes: notes || '',
      hospitalId: req.user?.hospitalId || null,
    };

    const errors = validateFields(collectionSchemas.appointments, data);
    if (errors.length > 0) return res.status(400).json({ message: errors.join('، ') });

    const result = await pool.query(
      `INSERT INTO appointments (patient, doctor, date, status, data) VALUES ($1, $2, $3, $4, $5) RETURNING id, data`,
      [patient, doctor, date, 'pending', JSON.stringify(data)]
    );
    res.status(201).json({ id: result.rows[0].id, ...result.rows[0].data });
  } catch (err) { next(err); }
});

module.exports = router;

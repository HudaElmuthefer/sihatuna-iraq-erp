// backend/routes/dashboardRoutes.js
//
// Additive-only aggregate endpoint for the Dashboard page's 5 KPI numbers.
// Each value used to require fetching a full dataset (patients, doctors,
// appointments, wards, admissions — ~1.1 MiB combined) just to read one
// count or sum off it. This endpoint runs the equivalent COUNT/SUM queries
// directly on the server instead. It does not replace or change any
// existing route — every dataset below remains fully available through its
// own existing endpoint for every other page that still needs the full
// records (e.g. PatientsPage, WardsPage).
const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const { pool } = require('../config/database');

const router = express.Router();
const readPermission = requirePermission('dashboard');

router.get('/dashboard/summary', auth, readPermission, asyncHandler(async (req, res) => {
  // Same hospital-scoping convention as every pgCrud module: filtered to
  // the caller's hospital when they have one, unfiltered (all-hospitals
  // aggregate) for a ministry-level admin with no hospitalId.
  const hospitalId = req.user?.hospitalId || null;
  const hospitalFilter = hospitalId ? `AND data->>'hospitalId' = $1` : '';
  const params = hospitalId ? [hospitalId] : [];

  const [
    patientsResult,
    doctorsResult,
    appointmentsResult,
    labTestsResult,
    wardsResult,
    admissionsResult,
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM patients WHERE true ${hospitalFilter}`, params),
    pool.query(`SELECT COUNT(*) FROM doctors WHERE (status = 'active' OR status IS NULL) ${hospitalFilter}`, params),
    pool.query(`SELECT COUNT(*) FROM appointments WHERE date = CURRENT_DATE ${hospitalFilter}`, params),
    pool.query(`SELECT COUNT(*) FROM lab_tests WHERE true ${hospitalFilter}`, params),
    pool.query(`SELECT COALESCE(SUM((data->>'bedCount')::numeric), 0) AS total FROM wards WHERE true ${hospitalFilter}`, params),
    pool.query(`SELECT COUNT(*) FROM admissions WHERE data->>'status' = 'admitted' ${hospitalFilter}`, params),
  ]);

  const totalBeds = Number(wardsResult.rows[0].total) || 0;
  const occupiedBeds = parseInt(admissionsResult.rows[0].count, 10) || 0;
  const rate = totalBeds > 0 ? Number(((occupiedBeds / totalBeds) * 100).toFixed(1)) : null;

  res.json({
    totalPatients: parseInt(patientsResult.rows[0].count, 10),
    activeDoctors: parseInt(doctorsResult.rows[0].count, 10),
    todayAppointments: parseInt(appointmentsResult.rows[0].count, 10),
    dailyLabTests: parseInt(labTestsResult.rows[0].count, 10),
    bedOccupancy: {
      totalBeds,
      occupiedBeds,
      rate,
    },
  });
}));

module.exports = router;

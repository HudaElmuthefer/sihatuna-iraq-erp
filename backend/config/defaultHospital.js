// backend/config/defaultHospital.js
//
// The original schema (postgres_schema.sql) is designed to support more
// than one hospital (multi-tenant) via the "hospitals" table, which is
// useful if the system is ever sold to multiple organizations. Right now,
// though, there is only one facility, so there's no need to complicate the
// UI by asking the user to pick a hospital every time.
//
// This function ensures a single default hospital record exists in the
// database (creating it only the first time, if it doesn't already exist)
// and returns its id -- used internally across all the payment-gateway and
// CRM routes instead of asking the user to manually select a hospital. The
// result is cached in process memory after the first call, so the database
// isn't read again on every request.
const { pool } = require('./database');

let cachedHospitalId = null;

async function getDefaultHospitalId() {
  if (cachedHospitalId) return cachedHospitalId;

  const existing = await pool.query('SELECT id FROM hospitals ORDER BY created_at ASC LIMIT 1');
  if (existing.rows.length > 0) {
    cachedHospitalId = existing.rows[0].id;
    return cachedHospitalId;
  }

  const inserted = await pool.query(
    `INSERT INTO hospitals (name_ar, name_en) VALUES ($1, $2) RETURNING id`,
    ['المنشأة الرئيسية', 'Main Facility']
  );
  cachedHospitalId = inserted.rows[0].id;
  console.log(`Default facility record created automatically (id=${cachedHospitalId})`);
  return cachedHospitalId;
}

module.exports = { getDefaultHospitalId };

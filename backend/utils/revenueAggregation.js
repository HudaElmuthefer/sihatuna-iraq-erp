// backend/utils/revenueAggregation.js
//
// Aggregates all of a hospital's real revenue from its actual sources
// instead of duplicated manual entry -- used by routes/revenueRoutes.js
// (the "Revenue" tab) and routes/profitSharingRoutes.js (calculating
// beneficiaries' dues). Any change here is automatically reflected in
// both.
//
// ── Why invoices, not payments, for the "patient" source ─────────────────────
// The payments table (electronic payment gateways) is always stored with
// hospital_id equal to getDefaultHospitalId() (see
// config/defaultHospital.js and controllers/paymentController.js) -- the
// first facility ever created in the database, completely regardless of
// the invoice's/patient's actual facility. This is a deliberate shortcut
// from an earlier development stage that assumed only one facility, and
// hasn't been updated yet to support multiple facilities -- relying on it
// here would wrongly attribute every facility's payments to the first
// facility. The invoices table is actually and correctly scoped
// (hospitalScoped via pgCrud.js), and both the manual and electronic
// payment paths (AppContext.js: payInvoice/processPayment) end by
// updating that same invoice record to status:'paid' -- so it's the
// trustworthy source for both.
const { query } = require('../config/database');

// A unified facility condition: if hospitalId is empty (a global admin
// viewing every facility), no filtering is applied at all; otherwise it
// matches data->>'hospitalId' with the exact same expression literally
// used in pgCrud.js for every other hospitalScoped module, to keep
// isolation consistent.
function buildHospitalCondition(hospitalId, params) {
  if (!hospitalId) return '';
  params.push(hospitalId);
  return ` AND data->>'hospitalId' = $${params.length}`;
}

function buildDateConditions(dateExpr, from, to, params) {
  let sql = '';
  if (from) {
    params.push(from);
    sql += ` AND ${dateExpr} >= $${params.length}::date`;
  }
  if (to) {
    params.push(to);
    sql += ` AND ${dateExpr} <= $${params.length}::date`;
  }
  return sql;
}

async function getPatientRevenueRows({ hospitalId, from, to }) {
  const params = [];
  const hospCond = buildHospitalCondition(hospitalId, params);
  const dateExpr = `COALESCE((data->>'paidAt')::timestamptz, updated_at)::date`;
  const dateCond = buildDateConditions(dateExpr, from, to, params);
  const res = await query(
    `SELECT id, total AS amount, ${dateExpr} AS date, patient_id AS patient_id
     FROM invoices
     WHERE status = 'paid'${hospCond}${dateCond}
     ORDER BY ${dateExpr} DESC`,
    params
  );
  return res.rows.map(r => ({
    id: `INV-${r.id}`,
    source: 'patient',
    amount: Number(r.amount) || 0,
    date: r.date,
    ref: `INV-${r.id}`,
  }));
}

async function getPharmacyRevenueRows({ hospitalId, from, to }) {
  const params = [];
  const hospCond = buildHospitalCondition(hospitalId, params);
  const dateExpr = `COALESCE(NULLIF(data->>'date','')::date, updated_at::date)`;
  const dateCond = buildDateConditions(dateExpr, from, to, params);
  const res = await query(
    `SELECT id, (data->>'totalCost')::numeric AS amount, ${dateExpr} AS date
     FROM pharmacy_orders
     WHERE status = 'dispensed'${hospCond}${dateCond}
     ORDER BY ${dateExpr} DESC`,
    params
  );
  return res.rows.map(r => ({
    id: `RX-${r.id}`,
    source: 'pharmacy',
    amount: Number(r.amount) || 0,
    date: r.date,
    ref: `RX-${r.id}`,
  }));
}

async function getOtherRevenueRows({ hospitalId, from, to }) {
  const params = [];
  const hospCond = buildHospitalCondition(hospitalId, params);
  const dateExpr = `COALESCE(NULLIF(data->>'date','')::date, updated_at::date)`;
  const dateCond = buildDateConditions(dateExpr, from, to, params);
  const res = await query(
    // GeneralTab.js's TX_TYPE_ALIASES: bulk-imported legacy rows use the
    // Arabic literal 'دخل' instead of 'income' for the same meaning.
    `SELECT id, (data->>'amount')::numeric AS amount, ${dateExpr} AS date, data->>'ref' AS ref
     FROM transactions
     WHERE data->>'category' = 'revenue' AND data->>'type' IN ('income','دخل')${hospCond}${dateCond}
     ORDER BY ${dateExpr} DESC`,
    params
  );
  return res.rows.map(r => ({
    id: `TXN-${r.id}`,
    source: 'other',
    amount: Number(r.amount) || 0,
    date: r.date,
    ref: r.ref || `TXN-${r.id}`,
  }));
}

// { hospitalId, from, to } -- an empty hospitalId means no facility
// filtering (a global admin). from/to are in 'YYYY-MM-DD' format and
// optional (neither given = the whole time period).
async function getRevenue({ hospitalId, from, to } = {}) {
  const [patientRows, pharmacyRows, otherRows] = await Promise.all([
    getPatientRevenueRows({ hospitalId, from, to }),
    getPharmacyRevenueRows({ hospitalId, from, to }),
    getOtherRevenueRows({ hospitalId, from, to }),
  ]);
  const rows = [...patientRows, ...pharmacyRows, ...otherRows].sort((a, b) => (a.date < b.date ? 1 : -1));
  const bySource = {
    patient: patientRows.reduce((s, r) => s + r.amount, 0),
    pharmacy: pharmacyRows.reduce((s, r) => s + r.amount, 0),
    other: otherRows.reduce((s, r) => s + r.amount, 0),
  };
  const totalRevenue = bySource.patient + bySource.pharmacy + bySource.other;
  return { rows, totalRevenue, bySource };
}

module.exports = { getRevenue };

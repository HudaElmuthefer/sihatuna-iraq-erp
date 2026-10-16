// backend/routes/revenueRoutes.js
//
// A unified revenue endpoint — feeds the "Revenue" tab on the accounts
// page (frontend/src/pages/accounts/RevenueTab.js) by reading directly
// from the real records (paid invoices, pharmacy dispenses, and manual
// "income" transactions) instead of any duplicated entry — see
// utils/revenueAggregation.js for details on each source and why invoices,
// not payments, is the source of patient revenue.
const express = require('express');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const { getRevenue } = require('../utils/revenueAggregation');

const router = express.Router();

// ?hospitalId= is optional — only used if the requester is a global admin
// (with no hospitalId of their own) and wants to filter their view to one
// specific hospital; an admin/employee tied to a specific hospital is
// always restricted to their hospital regardless of what they send here
// (the same pattern as pgCrud.js).
router.get('/revenue', auth, requirePermission('accounts'), async (req, res, next) => {
  try {
    const hospitalId = req.user.hospitalId || req.query.hospitalId || null;
    const { from, to } = req.query;
    const result = await getRevenue({ hospitalId, from: from || null, to: to || null });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

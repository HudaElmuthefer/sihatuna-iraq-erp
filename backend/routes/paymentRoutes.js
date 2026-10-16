// server/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const paymentSettingsController = require('../controllers/paymentSettingsController');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

// ── Critical security fix ───────────────────────────────────────────────────────
// All of these routes used to have no authentication at all (auth/requireAdmin
// were previously commented out below) -- anyone without being logged in,
// even from outside the local network, could add or delete payment gateway
// credentials (sensitive API keys) or submit fake payments directly via
// /api/payments. Now:
//   - The payment gateway settings routes (admin/*) require login + the
//     "admin" role exclusively
//   - The actual payment routes only require login (any user in the
//     system, such as an accountant from the billing screen), with no admin role requirement

// -- Admin settings --
// Note: no hospital identifier (hospitalId) is needed in the route -- the
// system currently runs as a single facility determined automatically on
// the server (see config/defaultHospital.js). If support for more than one
// facility is needed in the future, this is the first place to add the
// identifier back into the route.
router.get('/admin/payment-providers', auth, requireAdmin, asyncHandler(paymentSettingsController.listAllProviders));
router.get('/admin/payment-gateways', auth, requireAdmin, asyncHandler(paymentSettingsController.listHospitalGateways));
router.post('/admin/payment-gateways', auth, requireAdmin, asyncHandler(paymentSettingsController.upsertHospitalGateway));
router.delete('/admin/payment-gateways/:providerCode', auth, requireAdmin, asyncHandler(paymentSettingsController.deactivateGateway));

// -- Actual payment operations --
router.get('/payment-methods', auth, asyncHandler(paymentController.getAvailableMethods));
router.post('/payments', auth, asyncHandler(paymentController.createPayment));
router.post('/payments/:paymentId/verify', auth, asyncHandler(paymentController.verifyPayment));
router.post('/payments/:paymentId/manual-confirm', auth, asyncHandler(paymentController.manualConfirm));

module.exports = router;

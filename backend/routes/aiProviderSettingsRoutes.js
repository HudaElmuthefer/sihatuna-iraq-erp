// backend/routes/aiProviderSettingsRoutes.js
//
// Managing the AI provider choice for each feature (bot/online/offline) --
// see utils/aiProviderRouter.js for the actual routing logic. GET is
// available to any logged-in user (the invoice reading/drug
// interaction/prescription pages need to know the current choice to show
// an honest label, regardless of the user's role).
//
// ── Security fix ────────────────────────────────────────────────────────
// PUT used to require the general requireAdmin (any admin level, including
// a local admin for a single hospital) -- but this setting is a single
// global row in system_settings with no hospitalId filtering at all (see
// getSettings/setSettings in utils/aiProviderRouter.js). That meant a
// local admin for one hospital could change the AI provider (even disable
// it entirely) for every other hospital in the same system without their
// knowledge or consent. Now it's requireGlobalAdmin (a global, ministry-level
// admin) exclusively -- the same level required for any setting that
// affects every hospital, exactly like PUT /system-settings/:key in
// hospitalsRoutes.js and gitUpdateRoutes.js.
const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const requireGlobalAdmin = require('../middleware/requireGlobalAdmin');
const { getSettings, setSettings } = require('../utils/aiProviderRouter');
const { logAudit } = require('../utils/auditLog');

const router = express.Router();

router.get('/ai-provider-settings', auth, asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json(settings);
}));

router.put('/ai-provider-settings', auth, requireGlobalAdmin, asyncHandler(async (req, res) => {
  const updated = await setSettings(req.body || {});
  logAudit({ module: 'ai-provider-settings', action: 'update', userId: req.user.id, userRole: req.user.role, after: updated });
  res.json(updated);
}));

module.exports = router;

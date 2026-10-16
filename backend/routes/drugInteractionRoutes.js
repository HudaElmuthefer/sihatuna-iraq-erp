// backend/routes/drugInteractionRoutes.js
//
// ── Fix: a real drug-interaction check instead of a fixed table of only 5 interactions ──────────────
// Before this file, the "drug interactions" page matched the selected
// drugs against a fixed array of 5 known interaction pairs hardcoded in
// the code -- any two drugs not literally in this list of five were
// automatically considered "safe", regardless of whether a real
// interaction actually existed between them.
//
// ── Second round of the fix: the database (bot) first, AI as a fallback ───────
// The same five interactions moved to the real drug_interactions table in
// PostgreSQL (see migrations-sql/008_drug_interactions.sql), and the actual
// check now goes through agents/interactionAgent.js: it checks the table
// first for every drug pair (instant, free, works even with no API key at
// all), and only calls AI for pairs not found in the table. See the full
// explanation in that file.
const express = require('express');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('../config/redisRateLimitStore');
const { skipInTest } = require('../config/rateLimiters');
const { logAudit } = require('../utils/auditLog');
const { getFeatureStatus } = require('../utils/aiProviderRouter');
const { checkInteractions } = require('../agents/interactionAgent');

const router = express.Router();

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: skipInTest,
  message: { message: 'عدد كبير جداً من طلبات الفحص، حاول مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('drug-interactions'),
});

// The same pattern as /ai-diagnosis/status -- tells the frontend
// immediately whether real AI is available, to show an honest label in
// the UI from the first moment. Note: the check itself (POST /check below)
// stays partially useful even if available is false here -- the database
// (bot) layer works completely independently of AI availability.
router.get('/drug-interactions/status', auth, requirePermission('drug-interactions'), async (req, res, next) => {
  try {
    res.json(await getFeatureStatus('drugInteractions'));
  } catch (err) { next(err); }
});

router.post('/drug-interactions/check', auth, requirePermission('drug-interactions'), aiLimiter, async (req, res, next) => {
  try {
    const { drugs, lang, mode } = req.body;
    if (!Array.isArray(drugs) || drugs.length < 2) {
      return res.status(400).json({ message: 'يجب اختيار دوائين على الأقل' });
    }

    const result = await checkInteractions(drugs, lang, mode);

    if (!result.available) {
      return res.json({ available: false });
    }

    logAudit({ module: 'drug-interactions', action: 'check', userId: req.user.id, userRole: req.user.role, after: { drugsCount: drugs.length, source: result.source, provider: result.provider } });
    res.json({ available: true, source: result.source, provider: result.provider, incomplete: result.incomplete, interactions: result.interactions });
  } catch (err) { next(err); }
});

module.exports = router;

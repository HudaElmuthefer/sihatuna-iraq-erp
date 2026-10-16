// backend/routes/billingAnomalyRoutes.js
//
// Outlier detection for purchases/billing — a standalone frontend page
// (BillingAnomalyPage.js). The analysis itself (POST
// /billing-anomaly/analyze) is purely deterministic statistics via
// agents/billingAnomalyAgent.js — with no AI call and no mode field at
// all; the optional plain-language explanation for one flagged item (POST
// /billing-anomaly/explain) is entirely separate and respects
// aiProviderRouter.js (bot/online/offline) like the rest of the system's
// AI features.
const express = require('express');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('../config/redisRateLimitStore');
const { skipInTest } = require('../config/rateLimiters');
const { logAudit } = require('../utils/auditLog');
const { getFeatureStatus } = require('../utils/aiProviderRouter');
const { detectAnomalies, explainAnomaly } = require('../agents/billingAnomalyAgent');

const router = express.Router();

// The analysis scans the entire procurement table on every call — a
// reasonable cap that's still enough for actual use (refreshing the page,
// re-analyzing after an Excel import) without opening the door to
// flooding the server with unnecessary repeated queries.
const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: skipInTest,
  message: { message: 'عدد كبير جداً من طلبات تحليل الفوترة، حاول مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('billing-anomaly'),
});
const explainLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: skipInTest,
  message: { message: 'عدد كبير جداً من طلبات الشرح، حاول مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('billing-anomaly-explain'),
});

// The status of only the optional AI explanation feature (bot/online/offline) —
// unrelated to the availability of the statistical analysis itself, which is always available regardless of it.
router.get('/billing-anomaly/status', auth, requirePermission('billing-anomaly'), async (req, res, next) => {
  try {
    res.json(await getFeatureStatus('billingAnomaly'));
  } catch (err) { next(err); }
});

router.post('/billing-anomaly/analyze', auth, requirePermission('billing-anomaly'), analyzeLimiter, async (req, res, next) => {
  try {
    const result = await detectAnomalies(req.user?.hospitalId || null);
    logAudit({
      module: 'billing-anomaly',
      action: 'analyze',
      userId: req.user.id,
      userRole: req.user.role,
      after: { totalRecordsAnalyzed: result.totalRecordsAnalyzed, totalFlagged: result.totalFlagged },
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/billing-anomaly/explain', auth, requirePermission('billing-anomaly'), explainLimiter, async (req, res, next) => {
  try {
    const { item, lang, mode } = req.body;
    if (!item || typeof item !== 'object' || !item.recordId) {
      return res.status(400).json({ message: 'بيانات العنصر المطلوب شرحه مفقودة' });
    }
    const result = await explainAnomaly(item, lang, mode);
    if (!result.available) return res.json({ available: false });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;

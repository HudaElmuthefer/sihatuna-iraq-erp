// backend/routes/dosageRoutes.js
//
// Safe dosage checking — a completely standalone frontend page
// (DosageCheckPage.js, with no relation at all to the pharmacy page or the
// prescription reader — an explicit decision made during planning).
// The exact same pattern as drugInteractionRoutes.js: a local database
// (bot) first via agents/dosageAgent.js, AI only as a fallback if the
// drug/range isn't found in the dosage_limits table — see
// migrations-sql/009_dosage_limits.sql.
const express = require('express');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('../config/redisRateLimitStore');
const { skipInTest } = require('../config/rateLimiters');
const { logAudit } = require('../utils/auditLog');
const { getFeatureStatus } = require('../utils/aiProviderRouter');
const { checkDosage } = require('../agents/dosageAgent');

const router = express.Router();

const dosageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: skipInTest,
  message: { message: 'عدد كبير جداً من طلبات فحص الجرعات، حاول مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('dosage-check'),
});

// The exact same pattern as /drug-interactions/status — tells the frontend
// immediately whether real AI is available, to show an honest label from
// the first moment ('bot' mode always stays "available" — the database
// layer works completely independently of AI availability).
router.get('/dosage-check/status', auth, requirePermission('dosage-check'), async (req, res, next) => {
  try {
    res.json(await getFeatureStatus('dosageValidation'));
  } catch (err) { next(err); }
});

router.post('/dosage-check/check', auth, requirePermission('dosage-check'), dosageLimiter, async (req, res, next) => {
  try {
    const { drugName, dose, unit, ageYears, weightKg, lang, mode } = req.body;

    if (!drugName || typeof drugName !== 'string' || !drugName.trim()) {
      return res.status(400).json({ message: 'اسم الدواء مطلوب' });
    }
    const doseNum = Number(dose);
    if (!Number.isFinite(doseNum) || doseNum <= 0) {
      return res.status(400).json({ message: 'الجرعة مطلوبة ويجب أن تكون رقماً موجباً' });
    }
    const ageNum = ageYears != null && ageYears !== '' ? Number(ageYears) : null;
    const weightNum = weightKg != null && weightKg !== '' ? Number(weightKg) : null;
    if (ageNum != null && !Number.isFinite(ageNum)) {
      return res.status(400).json({ message: 'العمر يجب أن يكون رقماً صالحاً' });
    }
    if (weightNum != null && !Number.isFinite(weightNum)) {
      return res.status(400).json({ message: 'الوزن يجب أن يكون رقماً صالحاً' });
    }
    // ── At least one of age or weight must be provided ────────────────────────────────────
    // Without either one, matching any range in the dosage_limits table is
    // meaningless (every row would incorrectly look like a "match" — see
    // the explanation of findDbMatch in dosageAgent.js), and even the
    // fallback AI check needs basic patient information to give a
    // meaningful opinion.
    if (ageNum == null && weightNum == null) {
      return res.status(400).json({ message: 'العمر أو الوزن مطلوب (واحد منهما على الأقل) لفحص الجرعة' });
    }

    const result = await checkDosage(drugName.trim(), doseNum, unit || 'mg', ageNum, weightNum, lang, mode);

    if (!result.available) {
      return res.json({ available: false });
    }

    logAudit({
      module: 'dosage-check',
      action: 'check',
      userId: req.user.id,
      userRole: req.user.role,
      after: { drugName: drugName.trim(), dose: doseNum, unit: unit || 'mg', source: result.source, status: result.status },
    });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;

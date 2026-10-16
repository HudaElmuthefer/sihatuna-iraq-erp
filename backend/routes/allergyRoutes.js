// backend/routes/allergyRoutes.js
//
// Drug allergy conflict checking — an entirely standalone frontend page
// (AllergyCheckPage.js, the same principle as DosageCheckPage.js: a single
// patient record with no direct connection to the pharmacy or prescription
// reader). The exact same pattern as dosageRoutes.js/
// drugInteractionRoutes.js: a local database (bot) first via
// agents/allergyAgent.js, AI only as a fallback for drugs not covered by
// the drug_allergy_classes table — see
// migrations-sql/011_drug_allergy_classes.sql.
const express = require('express');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('../config/redisRateLimitStore');
const { skipInTest } = require('../config/rateLimiters');
const { logAudit } = require('../utils/auditLog');
const { getFeatureStatus } = require('../utils/aiProviderRouter');
const { checkAllergies } = require('../agents/allergyAgent');

const router = express.Router();

const allergyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: skipInTest,
  message: { message: 'عدد كبير جداً من طلبات فحص الحساسية الدوائية، حاول مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('allergy-check'),
});

router.get('/allergy-check/status', auth, requirePermission('allergy-check'), async (req, res, next) => {
  try {
    res.json(await getFeatureStatus('allergyCheck'));
  } catch (err) { next(err); }
});

router.post('/allergy-check/check', auth, requirePermission('allergy-check'), allergyLimiter, async (req, res, next) => {
  try {
    const { allergies, drugs, lang, mode } = req.body;

    if (!Array.isArray(allergies)) {
      return res.status(400).json({ message: 'قائمة حساسيات المريض مطلوبة (حتى لو فارغة)' });
    }
    const validAllergies = allergies.filter((a) => a && typeof a.name === 'string' && a.name.trim());

    const drugList = Array.isArray(drugs) ? drugs.filter((d) => typeof d === 'string' && d.trim()) : (typeof drugs === 'string' && drugs.trim() ? [drugs.trim()] : []);
    if (drugList.length === 0) {
      return res.status(400).json({ message: 'اسم دواء واحد على الأقل مطلوب' });
    }

    const result = await checkAllergies(validAllergies, drugList, lang, mode);

    if (!result.available) {
      return res.json({ available: false });
    }

    logAudit({
      module: 'allergy-check',
      action: 'check',
      userId: req.user.id,
      userRole: req.user.role,
      after: { drugsCount: drugList.length, allergiesCount: validAllergies.length, source: result.source, conflictsFound: result.conflicts?.length || 0 },
    });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;

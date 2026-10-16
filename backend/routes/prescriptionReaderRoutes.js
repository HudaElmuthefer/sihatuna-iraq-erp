// backend/routes/prescriptionReaderRoutes.js
//
// AI prescription reading — photograph/upload a paper prescription from
// the doctor, and the system extracts the medications automatically
// (instead of typing them manually on the "new prescription" screen in
// PharmacyPage.js) *and checks for drug interactions between them
// immediately* — a full multi-agent workflow (OCR -> AI -> interaction
// check), see the detailed explanation in agents/prescriptionAgent.js.
//
// The exact same pattern as invoiceReaderRoutes.js (a BullMQ background
// job, no direct AI/OCR call inside the HTTP request thread — the full
// work here can take longer than reading a regular invoice: OCR + AI +
// an interaction check for every drug pair).
const express = require('express');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('../config/redisRateLimitStore');
const { skipInTest } = require('../config/rateLimiters');
const { getFeatureStatus } = require('../utils/aiProviderRouter');
const { enqueuePrescriptionReadJob, getJobStatus } = require('../services/queue/ocrQueue');

const router = express.Router();

const prescriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: skipInTest,
  message: { message: 'عدد كبير جداً من طلبات قراءة الوصفات، حاول مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('prescription-reader'),
});

router.get('/prescription-reader/status', auth, requirePermission('pharmacy'), async (req, res, next) => {
  try {
    res.json(await getFeatureStatus('prescriptionReader'));
  } catch (err) { next(err); }
});

router.post('/prescription-reader/read', auth, requirePermission('pharmacy'), prescriptionLimiter, async (req, res, next) => {
  try {
    const { image, mimeType, lang, mode, patientAllergies } = req.body;
    if (!image) return res.status(400).json({ message: 'الصورة مطلوبة' });

    const base64 = image.includes(',') ? image.split(',')[1] : image;
    const detectedMimeType = mimeType || (image.match(/^data:(.+?);base64,/) || [])[1] || 'image/jpeg';

    // patientAllergies: a patient's allergy list explicitly tied to this
    // prescription from the frontend (entirely optional — see the full
    // explanation in agents/prescriptionAgent.js). We only check the
    // general shape here (an array or not present) — any item without a
    // valid name is filtered out later by allergyAgent.js itself, no need
    // to repeat that here.
    const validPatientAllergies = Array.isArray(patientAllergies) ? patientAllergies : undefined;

    let jobId;
    try {
      jobId = await enqueuePrescriptionReadJob({
        imageBase64: base64,
        mimeType: detectedMimeType,
        lang,
        userId: req.user.id,
        userRole: req.user.role,
        mode,
        patientAllergies: validPatientAllergies,
      });
    } catch (err) {
      console.error('[prescription-reader] Could not add a job to the processing queue (Redis):', err.message);
      return res.json({ available: false });
    }

    res.status(202).json({ jobId });
  } catch (err) { next(err); }
});

router.get('/prescription-reader/jobs/:id', auth, requirePermission('pharmacy'), async (req, res, next) => {
  try {
    const status = await getJobStatus(req.params.id);
    if (!status) return res.status(404).json({ message: 'المهمة غير موجودة (ربما انتهت صلاحيتها أو رقمها خاطئ)' });

    if (status.state === 'completed') {
      const result = status.result;
      if (!result?.available) return res.json({ state: 'completed', available: false });
      const { available, ...rest } = result;
      return res.json({ state: 'completed', available: true, ...rest });
    }
    if (status.state === 'failed') {
      return res.json({ state: 'failed', available: false, error: status.error });
    }
    res.json({ state: status.state });
  } catch (err) { next(err); }
});

module.exports = router;

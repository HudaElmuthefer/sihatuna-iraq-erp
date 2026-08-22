// backend/routes/prescriptionReaderRoutes.js
//
// قراءة وصفة طبية بالذكاء الاصطناعي — تصوّري/ارفعي وصفة ورقية من الطبيب،
// والنظام يستخرج الأدوية تلقائياً (بدل كتابتها يدوياً بشاشة "وصفة جديدة"
// بـPharmacyPage.js) *ويفحص التضارب الدوائي بينها فوراً* — سير عمل متعدد
// الوكلاء كامل (OCR → AI → فحص تضارب)، راجعي شرح تفصيلي بـ
// agents/prescriptionAgent.js.
//
// نفس نمط invoiceReaderRoutes.js تماماً (مهمة خلفية BullMQ، لا استدعاء AI/
// OCR مباشر داخل خيط طلب HTTP — قد يأخذ العمل الكامل هنا وقتاً أطول من
// قراءة فاتورة عادية: OCR + AI + فحص تضارب لكل زوج أدوية).
const express = require('express');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('../config/redisRateLimitStore');
const { getFeatureStatus } = require('../utils/aiProviderRouter');
const { enqueuePrescriptionReadJob, getJobStatus } = require('../services/queue/ocrQueue');

const router = express.Router();

const prescriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
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
    const { image, mimeType, lang, mode } = req.body;
    if (!image) return res.status(400).json({ message: 'الصورة مطلوبة' });

    const base64 = image.includes(',') ? image.split(',')[1] : image;
    const detectedMimeType = mimeType || (image.match(/^data:(.+?);base64,/) || [])[1] || 'image/jpeg';

    let jobId;
    try {
      jobId = await enqueuePrescriptionReadJob({
        imageBase64: base64,
        mimeType: detectedMimeType,
        lang,
        userId: req.user.id,
        userRole: req.user.role,
        mode,
      });
    } catch (err) {
      console.error('⚠️  [prescription-reader] تعذّر إضافة مهمة لطابور المعالجة (Redis):', err.message);
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

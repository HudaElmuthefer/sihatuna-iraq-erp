// backend/routes/invoiceReaderRoutes.js
//
// AI Invoice Reader — matches a feature seen in a competing Iraqi hospital
// system (المنصة الطبية العراقية). Lets staff photograph or upload a
// paper invoice (from a supplier, pharmacy delivery, etc.) instead of
// typing every line item manually — the AI reads the image and returns
// structured data (vendor, invoice number, date, line items, total) to
// pre-fill the request form.
//
// Uses the same Gemini-first/Claude-fallback provider already configured
// for AI diagnosis (see utils/aiProvider.js) — no new API key needed if
// GEMINI_API_KEY is already set in .env.
//
// ── Phase two: background processing via BullMQ ─────────────────────────────────
// Actually calling AI (Gemini/Claude) to read an image can take several
// seconds -- POST /invoice-reader/read used to keep the HTTP request
// pending for that whole duration (holding an Express worker for no real
// benefit). Now it adds a job to the services/queue/ocrQueue.js queue and
// returns immediately with a job number (jobId, 202 Accepted); the
// frontend polls its status periodically via GET
// /invoice-reader/jobs/:id (see frontend/src/pages/ProcurementPage.js).
// The actual processing happens in a completely separate worker process --
// see services/queue/ocrWorker.js.
const express = require('express');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('../config/redisRateLimitStore');
const { skipInTest } = require('../config/rateLimiters');
const { getFeatureStatus } = require('../utils/aiProviderRouter');
const { enqueueInvoiceReadJob, getJobStatus } = require('../services/queue/ocrQueue');

const router = express.Router();

const invoiceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: skipInTest,
  message: { message: 'عدد كبير جداً من طلبات قراءة الفواتير، حاول مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('invoice-reader'),
});

// See utils/aiProviderRouter.js — reflects whichever mode is actually
// selected (bot/online/offline) instead of always assuming Gemini/Claude as before.
router.get('/invoice-reader/status', auth, async (req, res, next) => {
  try {
    res.json(await getFeatureStatus('invoiceReader'));
  } catch (err) { next(err); }
});

// Note: the data-extraction structure (system/user prompt, the expected
// JSON schema) moved to services/queue/invoiceReadProcessor.js -- it now
// includes a preliminary OCR (PaddleOCR) step before calling AI, running
// inside the queue job itself (see the full explanation there), so it's no
// longer possible to build the final prompt here at request-receipt time
// (it needs OCR text that's only available after that step runs inside the
// worker).

router.post('/invoice-reader/read', auth, requirePermission('procurement'), invoiceLimiter, async (req, res, next) => {
  try {
    const { image, mimeType, mode } = req.body;
    if (!image) return res.status(400).json({ message: 'الصورة مطلوبة' });

    // The frontend sends a data URL (data:image/jpeg;base64,....) — strip
    // the prefix, since the AI providers only want the raw base64 payload.
    const base64 = image.includes(',') ? image.split(',')[1] : image;
    const detectedMimeType = mimeType || (image.match(/^data:(.+?);base64,/) || [])[1] || 'image/jpeg';

    let jobId;
    try {
      jobId = await enqueueInvoiceReadJob({
        imageBase64: base64,
        mimeType: detectedMimeType,
        userId: req.user.id,
        userRole: req.user.role,
        mode,
      });
    } catch (err) {
      // Could not reach the processing queue (Redis unavailable) -- the same
      // honest "unavailable" label already used if the AI provider itself
      // isn't configured, instead of a confusing 500 error for a staff
      // member trying to read an invoice.
      console.error('[invoice-reader] Could not add a job to the processing queue (Redis):', err.message);
      return res.json({ available: false });
    }

    res.status(202).json({ jobId });
  } catch (err) { next(err); }
});

// GET /api/invoice-reader/jobs/:id — the frontend periodically polls the
// status of an invoice-reading job created by POST /invoice-reader/read
// above, until it completes.
router.get('/invoice-reader/jobs/:id', auth, requirePermission('procurement'), async (req, res, next) => {
  try {
    const status = await getJobStatus(req.params.id);
    if (!status) return res.status(404).json({ message: 'المهمة غير موجودة (ربما انتهت صلاحيتها أو رقمها خاطئ)' });

    if (status.state === 'completed') {
      const result = status.result;
      if (!result?.available) return res.json({ state: 'completed', available: false });
      return res.json({ state: 'completed', available: true, provider: result.provider, ...result.parsed });
    }
    if (status.state === 'failed') {
      return res.json({ state: 'failed', available: false, error: status.error });
    }
    // waiting / active / delayed — the frontend keeps polling
    res.json({ state: status.state });
  } catch (err) { next(err); }
});

module.exports = router;

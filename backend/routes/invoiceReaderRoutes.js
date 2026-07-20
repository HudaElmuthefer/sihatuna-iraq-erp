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
const express = require('express');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const rateLimit = require('express-rate-limit');
const { logAudit } = require('../utils/auditLog');
const { activeProvider, callAIWithImage } = require('../utils/aiProvider');

const router = express.Router();

const invoiceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'عدد كبير جداً من طلبات قراءة الفواتير، حاولي مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/invoice-reader/status', auth, (req, res) => {
  const provider = activeProvider();
  res.json({ available: Boolean(provider), provider });
});

const SYSTEM_PROMPT_AR = 'أنتِ نظام استخراج بيانات فواتير دقيق لنظام مستشفى إلكتروني. اقرئي صورة الفاتورة المرفقة، واستخرجي البيانات بدقة. لو حقل غير واضح أو غير موجود بالصورة، اتركيه فارغاً (null) — لا تخمّني قيمة. أجيبي فقط بصيغة JSON صالحة مطابقة تماماً للمخطط المطلوب، بدون Markdown وبدون أي نص إضافي خارج الـ JSON.';

const USER_PROMPT_AR = `اقرئي صورة الفاتورة المرفقة واستخرجي:
{
  "vendorName": "اسم المورد/الشركة",
  "invoiceNumber": "رقم الفاتورة",
  "invoiceDate": "YYYY-MM-DD",
  "items": [
    { "name": "اسم الصنف", "quantity": 0, "unitPrice": 0, "total": 0 }
  ],
  "subtotal": 0,
  "tax": 0,
  "grandTotal": 0,
  "confidence": "high|medium|low"
}`;

router.post('/invoice-reader/read', auth, requirePermission('procurement'), invoiceLimiter, async (req, res, next) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) return res.status(400).json({ message: 'الصورة مطلوبة' });

    // The frontend sends a data URL (data:image/jpeg;base64,....) — strip
    // the prefix, since the AI providers only want the raw base64 payload.
    const base64 = image.includes(',') ? image.split(',')[1] : image;
    const detectedMimeType = mimeType || (image.match(/^data:(.+?);base64,/) || [])[1] || 'image/jpeg';

    const result = await callAIWithImage(SYSTEM_PROMPT_AR, USER_PROMPT_AR, base64, detectedMimeType);

    if (!result.available) {
      if (result.error) console.error(`⚠️  [invoice-reader] فشل استدعاء ${result.provider}:`, result.error);
      return res.json({ available: false });
    }

    logAudit({ module: 'invoice-reader', action: 'read', userId: req.user.id, userRole: req.user.role, after: { provider: result.provider, itemsCount: result.parsed?.items?.length || 0 } });
    res.json({ available: true, provider: result.provider, ...result.parsed });
  } catch (err) { next(err); }
});

module.exports = router;

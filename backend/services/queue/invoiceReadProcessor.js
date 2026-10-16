// backend/services/queue/invoiceReadProcessor.js
//
// The logic for processing a single "read invoice" job -- extracted from
// ocrWorker.js into a separate file with no dependency on BullMQ itself,
// so that tests/invoiceReadProcessor.test.js can test it directly (calling
// a plain function) instead of having to run a real BullMQ Worker (which
// opens a Redis connection immediately on load -- see ocrWorker.js).
const { routeImageCall } = require('../../utils/aiProviderRouter');
const { extractText } = require('../../agents/ocrAgent');
const { logAudit } = require('../../utils/auditLog');
const { devLog } = require('../../utils/logger');

const SYSTEM_PROMPT_AR = 'أنت نظام استخراج بيانات فواتير دقيق لنظام مستشفى إلكتروني. اقرأ صورة الفاتورة المرفقة (ومعها نص استخراج ضوئي (OCR) أولي كمرجع مساعد فقط — قد يحتوي أخطاء، والصورة نفسها هي المصدر الأدق)، واستخرج البيانات بدقة. لو حقل غير واضح أو غير موجود، اتركه فارغاً (null) — لا تخمّن قيمة. أجب فقط بصيغة JSON صالحة مطابقة تماماً للمخطط المطلوب، بدون Markdown وبدون أي نص إضافي خارج الـ JSON.';

const RESULT_SCHEMA_AR = `{
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

// ── OCR (PaddleOCR) as a preliminary step, not a replacement for the image ───
// The PaddleOCR text is attached only as extra supporting context, while
// the original image is still sent in full to Gemini (vision) as the main,
// accurate source -- a deliberate decision made after explicit discussion,
// because PaddleOCR's Arabic quality is much weaker than Gemini reading
// the image directly (handwriting, blurred invoices, inconsistent photo
// quality...), so relying on the OCR text alone would have weakened
// current accuracy rather than improving it (see agents/ocrAgent.js for
// the full explanation). If PaddleOCR can't run at all, processing
// continues with no OCR text whatsoever (fail-open) -- the image alone is
// entirely sufficient, matching the system's behavior exactly as it was
// before this addition.
function buildUserPrompt(ocrText) {
  const ocrSection = ocrText
    ? `نص استخراج ضوئي (OCR) أولي للفاتورة (مرجع مساعد فقط، قد يحتوي أخطاء — اعتمد على الصورة نفسها للدقة):\n"""\n${ocrText}\n"""\n\n`
    : '';
  return `${ocrSection}اقرأ صورة الفاتورة المرفقة واستخرج:\n${RESULT_SCHEMA_AR}`;
}

async function processInvoiceReadJob(jobData) {
  const { imageBase64, mimeType, userId, userRole, mode } = jobData;

  const ocrResult = await extractText(imageBase64);
  if (!ocrResult.available) {
    devLog(`[ocr-worker] PaddleOCR not available (${ocrResult.error}) -- continuing with the image alone`);
  }

  const userPrompt = buildUserPrompt(ocrResult.available ? ocrResult.text : null);
  // routeImageCall reads the user's saved choice (bot/online/offline) and
  // routes the call accordingly, or uses mode (this specific request's
  // choice from the page UI) if provided -- see utils/aiProviderRouter.js.
  const result = await routeImageCall('invoiceReader', SYSTEM_PROMPT_AR, userPrompt, imageBase64, mimeType, mode);

  if (result.available) {
    logAudit({ module: 'invoice-reader', action: 'read', userId, userRole, after: { provider: result.provider, itemsCount: result.parsed?.items?.length || 0, ocrUsed: ocrResult.available } });
  } else if (result.error) {
    // The AI call itself failed (no provider configured, or a call error)
    // -- an exception that would just trigger a pointless retry is not
    // thrown (it would likely fail again for the same reason); instead the
    // result is returned as-is. The query route (GET
    // /invoice-reader/jobs/:id) handles available:false the same way it
    // already does for every AI feature in this system.
    console.error(`[ocr-worker] Call to ${result.provider} failed:`, result.error);
  }
  return result;
}

module.exports = { processInvoiceReadJob, buildUserPrompt };

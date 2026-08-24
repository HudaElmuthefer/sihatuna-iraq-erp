// backend/tests/invoiceReadProcessor.test.js
//
// اختبارات منطق معالجة مهمة قراءة فاتورة واحدة (services/queue
// /invoiceReadProcessor.js) — بمعزل عن BullMQ (راجع شرح ذاك الملف) وعن
// PaddleOCR/AI الحقيقيين: نُموِّه agents/ocrAgent.js وutils/aiProviderRouter.js
// مباشرة (الأخير يوزّع فعلياً بين bot/online/offline — راجع المرحلة
// الخامسة؛ تمويهه هنا يبقي هذا الملف مركّزاً على منطق دمج OCR بالـprompt
// فقط)، بنفس نمط تموية services/queue/ocrQueue.js بـinvoiceReader.test.js.
jest.mock('../agents/ocrAgent', () => ({ extractText: jest.fn() }));
jest.mock('../utils/aiProviderRouter', () => ({ routeImageCall: jest.fn() }));
jest.mock('../utils/auditLog', () => ({ logAudit: jest.fn() }));

const { extractText } = require('../agents/ocrAgent');
const { routeImageCall } = require('../utils/aiProviderRouter');
const { logAudit } = require('../utils/auditLog');
const { processInvoiceReadJob, buildUserPrompt } = require('../services/queue/invoiceReadProcessor');

afterEach(() => {
  jest.clearAllMocks();
});

const JOB_DATA = { imageBase64: 'AAAA', mimeType: 'image/jpeg', userId: 'u1', userRole: 'accountant' };

describe('buildUserPrompt', () => {
  test('بنص OCR: يُضمَّنه كسياق مساعد قبل طلب الاستخراج', () => {
    const prompt = buildUserPrompt('فاتورة رقم 123');
    expect(prompt).toContain('فاتورة رقم 123');
    expect(prompt).toContain('اقرأ صورة الفاتورة المرفقة');
  });

  test('بلا نص OCR (null): يطلب القراءة من الصورة وحدها بدون قسم OCR', () => {
    const prompt = buildUserPrompt(null);
    expect(prompt).not.toContain('نص استخراج ضوئي');
    expect(prompt).toContain('اقرأ صورة الفاتورة المرفقة');
  });
});

describe('processInvoiceReadJob', () => {
  test('PaddleOCR متاح: نصه يُمرَّر ضمن الـprompt المُرسَل لـrouteImageCall (feature: invoiceReader)، والصورة تبقى مُرسَلة كاملة أيضاً', async () => {
    extractText.mockResolvedValueOnce({ available: true, text: 'نص الفاتورة المُستخرَج', avgConfidence: 0.9, lines: [] });
    routeImageCall.mockResolvedValueOnce({ available: true, provider: 'gemini', parsed: { vendorName: 'شركة الرافدين', items: [{ name: 'باراسيتامول', quantity: 2 }] } });

    const result = await processInvoiceReadJob(JOB_DATA);

    expect(extractText).toHaveBeenCalledWith('AAAA');
    const [feature, systemPrompt, userPrompt, imageBase64, mimeType] = routeImageCall.mock.calls[0];
    expect(feature).toBe('invoiceReader');
    expect(userPrompt).toContain('نص الفاتورة المُستخرَج');
    expect(imageBase64).toBe('AAAA'); // الصورة الأصلية ما زالت تُرسَل كاملة (نهج هجين، لا OCR بدل الصورة)
    expect(mimeType).toBe('image/jpeg');
    expect(systemPrompt).toEqual(expect.any(String));
    expect(result).toEqual({ available: true, provider: 'gemini', parsed: expect.any(Object) });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ module: 'invoice-reader', after: expect.objectContaining({ ocrUsed: true }) }));
  });

  test('PaddleOCR غير متاح (fail-open): يكمل بالصورة وحدها بدون قسم OCR بالـprompt، ولا يفشل', async () => {
    extractText.mockResolvedValueOnce({ available: false, error: 'python غير موجود' });
    routeImageCall.mockResolvedValueOnce({ available: true, provider: 'gemini', parsed: { vendorName: 'مورد' } });

    const result = await processInvoiceReadJob(JOB_DATA);

    const [, , userPrompt] = routeImageCall.mock.calls[0];
    expect(userPrompt).not.toContain('نص استخراج ضوئي');
    expect(result.available).toBe(true);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ after: expect.objectContaining({ ocrUsed: false }) }));
  });

  test('فشل استدعاء AI نفسه: يرجع النتيجة كما هي (available:false) بدون رمي استثناء', async () => {
    extractText.mockResolvedValueOnce({ available: false, error: 'لا يهم هنا' });
    routeImageCall.mockResolvedValueOnce({ available: false, provider: 'gemini', error: 'Gemini 500' });

    const result = await processInvoiceReadJob(JOB_DATA);

    expect(result).toEqual({ available: false, provider: 'gemini', error: 'Gemini 500' });
    expect(logAudit).not.toHaveBeenCalled();
  });
});

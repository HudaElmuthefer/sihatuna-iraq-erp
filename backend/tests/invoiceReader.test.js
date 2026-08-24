// backend/tests/invoiceReader.test.js
//
// اختبارات مسار قارئ الفواتير (routes/invoiceReaderRoutes.js) بعد المرحلة
// الثانية (طابور BullMQ خلفي بدل استدعاء AI مباشرة داخل طلب HTTP). نختبر
// منطق المسار نفسه (تحويل جسم الطلب، إرجاع jobId، تنسيق حالة المهمة)، لا
// BullMQ ذاته (مكتبة مُختبَرة مستقلة) — لذا نُموِّه (mock) الوحدة الوسيطة
// services/queue/ocrQueue.js مباشرة بدل محاولة تشغيل Redis/BullMQ حقيقيين
// (غير متاحين بهذه البيئة، ولا داعي لهما لاختبار منطق المسار).
jest.mock('../services/queue/ocrQueue', () => ({
  enqueueInvoiceReadJob: jest.fn(),
  getJobStatus: jest.fn(),
}));

const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, closeDbPool } = require('./testUtils');
const { enqueueInvoiceReadJob, getJobStatus } = require('../services/queue/ocrQueue');

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('invoice-reader');
  app = require('../server');
  const login = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  token = login.body.token;
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  cleanupTestEnv(dbPath);
  await closeDbPool();
});

describe('POST /api/invoice-reader/read', () => {
  test('صورة صالحة + طابور متاح: يرجع 202 ومعه jobId', async () => {
    enqueueInvoiceReadJob.mockResolvedValueOnce('job-123');

    const res = await request(app)
      .post('/api/invoice-reader/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ image: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg' });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ jobId: 'job-123' });
    expect(enqueueInvoiceReadJob).toHaveBeenCalledTimes(1);
    const jobData = enqueueInvoiceReadJob.mock.calls[0][0];
    expect(jobData.imageBase64).toBe('AAAA'); // بادئة data URL أُزيلت
    expect(jobData.mimeType).toBe('image/jpeg');
  });

  test('بدون صورة: يُرفض بـ400', async () => {
    const res = await request(app)
      .post('/api/invoice-reader/read')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(enqueueInvoiceReadJob).not.toHaveBeenCalled();
  });

  test('تعذّر الوصول للطابور (Redis غير متاح): يرجع available:false بدل خطأ 500', async () => {
    enqueueInvoiceReadJob.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app)
      .post('/api/invoice-reader/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ image: 'data:image/jpeg;base64,AAAA' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false });
  });

  test('بدون توكن دخول: يُرفض بـ401 قبل أي معالجة', async () => {
    const res = await request(app).post('/api/invoice-reader/read').send({ image: 'x' });
    expect(res.status).toBe(401);
    expect(enqueueInvoiceReadJob).not.toHaveBeenCalled();
  });
});

describe('GET /api/invoice-reader/jobs/:id', () => {
  test('مهمة غير موجودة: يرجع 404', async () => {
    getJobStatus.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/invoice-reader/jobs/no-such-job').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('مهمة قيد الانتظار: يرجع state فقط', async () => {
    getJobStatus.mockResolvedValueOnce({ id: 'job-1', state: 'active', result: null, error: null });
    const res = await request(app).get('/api/invoice-reader/jobs/job-1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ state: 'active' });
  });

  test('مهمة مكتملة بنجاح: يرجع نفس شكل الاستجابة القديم (available:true + بيانات الفاتورة)', async () => {
    getJobStatus.mockResolvedValueOnce({
      id: 'job-2',
      state: 'completed',
      result: { available: true, provider: 'gemini', parsed: { vendorName: 'شركة الرافدين', items: [{ name: 'باراسيتامول', quantity: 2 }] } },
      error: null,
    });
    const res = await request(app).get('/api/invoice-reader/jobs/job-2').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ state: 'completed', available: true, provider: 'gemini', vendorName: 'شركة الرافدين', items: [{ name: 'باراسيتامول', quantity: 2 }] });
  });

  test('مهمة مكتملة بدون توفّر AI فعلي: available:false', async () => {
    getJobStatus.mockResolvedValueOnce({ id: 'job-3', state: 'completed', result: { available: false }, error: null });
    const res = await request(app).get('/api/invoice-reader/jobs/job-3').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ state: 'completed', available: false });
  });

  test('مهمة فاشلة: يرجع رسالة الخطأ', async () => {
    getJobStatus.mockResolvedValueOnce({ id: 'job-4', state: 'failed', result: null, error: 'Gemini 500: خطأ خادم' });
    const res = await request(app).get('/api/invoice-reader/jobs/job-4').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ state: 'failed', available: false, error: 'Gemini 500: خطأ خادم' });
  });

  test('بدون توكن دخول: يُرفض بـ401', async () => {
    const res = await request(app).get('/api/invoice-reader/jobs/job-1');
    expect(res.status).toBe(401);
  });
});

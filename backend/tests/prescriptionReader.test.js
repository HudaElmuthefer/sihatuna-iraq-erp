// backend/tests/prescriptionReader.test.js
//
// اختبارات مسار قارئ الوصفات (routes/prescriptionReaderRoutes.js) — نفس نمط
// invoiceReader.test.js تماماً: نُموِّه services/queue/ocrQueue.js مباشرة
// بدل تشغيل BullMQ/Redis حقيقيين، لاختبار منطق المسار نفسه فقط.
jest.mock('../services/queue/ocrQueue', () => ({
  enqueuePrescriptionReadJob: jest.fn(),
  getJobStatus: jest.fn(),
}));

const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, closeDbPool } = require('./testUtils');
const { enqueuePrescriptionReadJob, getJobStatus } = require('../services/queue/ocrQueue');

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('prescription-reader');
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

describe('POST /api/prescription-reader/read', () => {
  test('صورة صالحة + طابور متاح: يرجع 202 ومعه jobId', async () => {
    enqueuePrescriptionReadJob.mockResolvedValueOnce('job-1');

    const res = await request(app)
      .post('/api/prescription-reader/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ image: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg', lang: 'ar' });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ jobId: 'job-1' });
    const jobData = enqueuePrescriptionReadJob.mock.calls[0][0];
    expect(jobData.imageBase64).toBe('AAAA');
    expect(jobData.mimeType).toBe('image/jpeg');
    expect(jobData.lang).toBe('ar');
  });

  test('مع patientAllergies (مريض مربوط بالفرونت إند): تُمرَّر كما هي لمهمة الطابور', async () => {
    enqueuePrescriptionReadJob.mockResolvedValueOnce('job-2');
    const patientAllergies = [{ name: 'Penicillin', severity: 'severe' }];

    await request(app)
      .post('/api/prescription-reader/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ image: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg', lang: 'ar', patientAllergies });

    const jobData = enqueuePrescriptionReadJob.mock.calls[0][0];
    expect(jobData.patientAllergies).toEqual(patientAllergies);
  });

  test('بدون patientAllergies (لا مريض مربوط): تُمرَّر undefined، لا مصفوفة فارغة وهمية', async () => {
    enqueuePrescriptionReadJob.mockResolvedValueOnce('job-3');

    await request(app)
      .post('/api/prescription-reader/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ image: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg', lang: 'ar' });

    const jobData = enqueuePrescriptionReadJob.mock.calls[0][0];
    expect(jobData.patientAllergies).toBeUndefined();
  });

  test('بدون صورة: يُرفض بـ400', async () => {
    const res = await request(app)
      .post('/api/prescription-reader/read')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(enqueuePrescriptionReadJob).not.toHaveBeenCalled();
  });

  test('تعذّر الوصول للطابور (Redis غير متاح): يرجع available:false بدل خطأ 500', async () => {
    enqueuePrescriptionReadJob.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app)
      .post('/api/prescription-reader/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ image: 'data:image/jpeg;base64,AAAA' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false });
  });

  test('بدون توكن دخول: يُرفض بـ401 قبل أي معالجة', async () => {
    const res = await request(app).post('/api/prescription-reader/read').send({ image: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/prescription-reader/jobs/:id', () => {
  test('مهمة غير موجودة: يرجع 404', async () => {
    getJobStatus.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/prescription-reader/jobs/no-such-job').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('مهمة مكتملة بنجاح: يرجع بيانات الوصفة + التضاربات المُكتشَفة', async () => {
    getJobStatus.mockResolvedValueOnce({
      id: 'job-2',
      state: 'completed',
      result: {
        available: true, provider: 'gemini', ocrUsed: true,
        patientName: 'أحمد', doctorName: 'د. علي', date: '2026-08-22', confidence: 'high',
        medicines: [{ name: 'Aspirin' }, { name: 'Warfarin' }],
        interactions: [{ drugs: ['Aspirin', 'Warfarin'], severity: 'high', effect: 'e', recommendation: 'r' }],
        interactionSource: 'db', interactionIncomplete: false, hasInteractions: true, highestSeverity: 'high',
      },
      error: null,
    });
    const res = await request(app).get('/api/prescription-reader/jobs/job-2').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ state: 'completed', available: true, hasInteractions: true, highestSeverity: 'high' });
    expect(res.body.medicines).toHaveLength(2);
    expect(res.body.interactions).toHaveLength(1);
  });

  test('مهمة مكتملة بدون توفّر AI فعلي: available:false', async () => {
    getJobStatus.mockResolvedValueOnce({ id: 'job-3', state: 'completed', result: { available: false }, error: null });
    const res = await request(app).get('/api/prescription-reader/jobs/job-3').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ state: 'completed', available: false });
  });

  test('مهمة فاشلة: يرجع رسالة الخطأ', async () => {
    getJobStatus.mockResolvedValueOnce({ id: 'job-4', state: 'failed', result: null, error: 'Gemini 500: خطأ خادم' });
    const res = await request(app).get('/api/prescription-reader/jobs/job-4').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ state: 'failed', available: false, error: 'Gemini 500: خطأ خادم' });
  });

  test('بدون توكن دخول: يُرفض بـ401', async () => {
    const res = await request(app).get('/api/prescription-reader/jobs/job-1');
    expect(res.status).toBe(401);
  });
});

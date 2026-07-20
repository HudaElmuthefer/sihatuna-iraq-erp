// backend/tests/drugInteractions.test.js
//
// اختبارات لمسار فحص التضارب الدوائي بالذكاء الاصطناعي — يغطي الحالة الأهم
// عملياً (بدون مفاتيح API مُعدَّة): يجب أن يرجع available:false بأمان تام
// بدل أي خطأ، حتى يعرف الفرونت إند يستخدم الجدول المحلي الاحتياطي بثقة.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv } = require('./testUtils');

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('drug-interactions');
  // نفس مبدأ aiDiagnosis.test.js — نضبط لنص فاضٍ (مو نحذف) لمنع dotenv من
  // إعادة تحميل مفتاح Gemini الحقيقي من ملف .env المحلي
  process.env.ANTHROPIC_API_KEY = '';
  process.env.GEMINI_API_KEY = '';
  app = require('../server');
  const login = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  token = login.body.token;
});

afterAll(() => {
  cleanupTestEnv(dbPath);
});

describe('GET /api/drug-interactions/status', () => {
  test('بدون مفاتيح API: يرجع available:false بأمان', async () => {
    const res = await request(app).get('/api/drug-interactions/status').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test('بدون توكن دخول: يُرفض بـ401', async () => {
    const res = await request(app).get('/api/drug-interactions/status');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/drug-interactions/check', () => {
  test('بدواء واحد بس (أقل من اثنين): يُرفض بـ400 برسالة واضحة', async () => {
    const res = await request(app)
      .post('/api/drug-interactions/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugs: ['Aspirin'] });
    expect(res.status).toBe(400);
  });

  test('بدوائين صحيحين وبدون مفاتيح API: يرجع available:false بأمان (بدل خطأ 500)', async () => {
    const res = await request(app)
      .post('/api/drug-interactions/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugs: ['Aspirin', 'Warfarin'], lang: 'ar' });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test('بدون توكن دخول: يُرفض بـ401 قبل أي معالجة', async () => {
    const res = await request(app)
      .post('/api/drug-interactions/check')
      .send({ drugs: ['Aspirin', 'Warfarin'] });
    expect(res.status).toBe(401);
  });
});

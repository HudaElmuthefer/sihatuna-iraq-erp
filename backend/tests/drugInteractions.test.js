// backend/tests/drugInteractions.test.js
//
// اختبارات لمسار فحص التضارب الدوائي — بعد إضافة طبقة قاعدة البيانات (bot)
// راجعي agents/interactionAgent.js: الجدول يُفحَص أولاً (يعمل حتى بدون أي
// مفتاح API)، والذكاء الاصطناعي احتياطي فقط للأزواج غير الموجودة بالجدول.
// أزواج الاختبار هنا: 'Aspirin'+'Warfarin' موجود فعلياً بجدول
// drug_interactions (بُذر بـmigrations-sql/008_drug_interactions.sql) —
// نستخدمه لاختبار مسار قاعدة البيانات. 'FooDrugX'+'BarDrugY' غير موجود
// بأي مكان — نستخدمه لاختبار الحالة الحقيقية "لا معلومة إطلاقاً" (بدون
// مفاتيح API، ولا تطابق بالجدول).
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, closeDbPool } = require('./testUtils');

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

afterAll(async () => {
  cleanupTestEnv(dbPath);

  await closeDbPool();
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

  test('زوج غير معروف إطلاقاً + بدون مفاتيح API: يرجع available:false بأمان (بدل خطأ 500)', async () => {
    const res = await request(app)
      .post('/api/drug-interactions/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugs: ['FooDrugX', 'BarDrugY'], lang: 'ar' });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test('زوج معروف بقاعدة drug_interactions (Aspirin+Warfarin)، حتى بدون أي مفتاح API: يرجع available:true من مصدر db', async () => {
    const res = await request(app)
      .post('/api/drug-interactions/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugs: ['Aspirin', 'Warfarin'], lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, source: 'db' });
    expect(res.body.interactions).toHaveLength(1);
    expect(res.body.interactions[0]).toMatchObject({ severity: 'high' });
  });

  test('نفس الزوج بترتيب معكوس (Warfarin, Aspirin): يُطابَق أيضاً (لا حساسية للاتجاه)', async () => {
    const res = await request(app)
      .post('/api/drug-interactions/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugs: ['Warfarin', 'Aspirin'], lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.source).toBe('db');
  });

  test('مزيج زوج معروف + زوج غير معروف، بدون مفاتيح API: يرجع نتيجة db جزئية (incomplete:true)', async () => {
    const res = await request(app)
      .post('/api/drug-interactions/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugs: ['Aspirin', 'Warfarin', 'FooDrugX'], lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, source: 'db', incomplete: true });
    expect(res.body.interactions).toHaveLength(1); // فقط الزوج المعروف (Aspirin+Warfarin) — الزوجان الآخران يتضمّنان FooDrugX غير المعروف
  });

  test('بدون توكن دخول: يُرفض بـ401 قبل أي معالجة', async () => {
    const res = await request(app)
      .post('/api/drug-interactions/check')
      .send({ drugs: ['Aspirin', 'Warfarin'] });
    expect(res.status).toBe(401);
  });
});

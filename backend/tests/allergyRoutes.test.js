// backend/tests/allergyRoutes.test.js
//
// اختبارات لمسار فحص الحساسية الدوائية — عبر HTTP على قاعدة PostgreSQL
// حقيقية (جدول drug_allergy_classes، بُذر بـmigrations-sql/
// 011_drug_allergy_classes.sql). نفس نمط tests/dosageRoutes.test.js بالضبط.
// راجع أيضاً tests/allergyAgent.test.js لاختبار منطق التوزيع نفسه بمعزل
// عن قاعدة بيانات حقيقية.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, closeDbPool } = require('./testUtils');

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('allergy-check');
  // نفس مبدأ dosageRoutes.test.js — نضبط لنص فارغ (وليس حذف) لمنع dotenv من
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

describe('GET /api/allergy-check/status', () => {
  test("mode='online' افتراضياً وبدون مفاتيح API: يرجع available:false بأمان", async () => {
    const res = await request(app).get('/api/allergy-check/status').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test('بدون توكن دخول: يُرفض بـ401', async () => {
    const res = await request(app).get('/api/allergy-check/status');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/allergy-check/check', () => {
  test('بدون allergies (حتى غير موجودة إطلاقاً): يُرفض بـ400', async () => {
    const res = await request(app)
      .post('/api/allergy-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugs: ['Amoxicillin'] });
    expect(res.status).toBe(400);
  });

  test('بدون أي دواء: يُرفض بـ400', async () => {
    const res = await request(app)
      .post('/api/allergy-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ allergies: [{ name: 'Penicillin', severity: 'severe' }] });
    expect(res.status).toBe(400);
  });

  test('مصفوفة حساسيات فارغة (مريض بلا حساسيات مسجَّلة): available:true, noAllergiesOnFile:true', async () => {
    const res = await request(app)
      .post('/api/allergy-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ allergies: [], drugs: ['Amoxicillin'], lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, noAllergiesOnFile: true, conflicts: [] });
  });

  test('حساسية بنسلين + وصفة أموكسيسيلين (عائلة واحدة): يُكتشَف التضارب فوراً بلا AI', async () => {
    const res = await request(app)
      .post('/api/allergy-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ allergies: [{ name: 'Penicillin', severity: 'severe' }], drugs: ['Amoxicillin'], lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, source: 'db' });
    expect(res.body.conflicts).toHaveLength(1);
    expect(res.body.conflicts[0]).toMatchObject({ drug: 'Amoxicillin', allergyName: 'Penicillin', severity: 'severe' });
  });

  test('حساسية بنسلين بالاسم العربي + دواء بالاسم العربي: نفس النتيجة (لا حساسية للغة)', async () => {
    const res = await request(app)
      .post('/api/allergy-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ allergies: [{ name: 'بنسلين', severity: 'moderate' }], drugs: ['أموكسيسيلين'], lang: 'ar' });
    expect(res.status).toBe(200);
    expect(res.body.conflicts).toHaveLength(1);
  });

  test('حساسية NSAID عامة + إيبوبروفين (عضو بنفس العائلة): يُكتشَف عبر تطابق العائلة', async () => {
    const res = await request(app)
      .post('/api/allergy-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ allergies: [{ name: 'NSAID', severity: 'moderate' }], drugs: ['Ibuprofen'], lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.conflicts).toHaveLength(1);
  });

  test('حساسية أسبرين (NSAID) + دواء من عائلة مختلفة تماماً (Ciprofloxacin) + بدون مفاتيح API: available:false — الجدول لا يغطي هذا التوليف تحديداً فيُطلَب AI، وهو غير متاح، فلا نفترض "لا تضارب" بلا تأكيد فعلي', async () => {
    const res = await request(app)
      .post('/api/allergy-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ allergies: [{ name: 'Aspirin', severity: 'mild' }], drugs: ['Ciprofloxacin'], lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false });
  });

  test('حساسية من دواء غير موجود بالجدول + بدون مفاتيح API: available:false بأمان (بدل خطأ 500)، لا يُفترَض آمن', async () => {
    const res = await request(app)
      .post('/api/allergy-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ allergies: [{ name: 'SomeCompletelyMadeUpAllergyXYZ', severity: 'mild' }], drugs: ['SomeCompletelyMadeUpDrugXYZ'], lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false });
  });

  test('بدون توكن دخول: يُرفض بـ401 قبل أي معالجة', async () => {
    const res = await request(app)
      .post('/api/allergy-check/check')
      .send({ allergies: [], drugs: ['Amoxicillin'] });
    expect(res.status).toBe(401);
  });
});

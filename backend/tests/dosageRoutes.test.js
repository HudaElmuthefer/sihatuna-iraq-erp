// backend/tests/dosageRoutes.test.js
//
// اختبارات لمسار فحص الجرعات — عبر HTTP على قاعدة PostgreSQL حقيقية
// (جدول dosage_limits، بُذر بـmigrations-sql/009_dosage_limits.sql). نفس
// نمط tests/drugInteractions.test.js بالضبط. راجع أيضاً tests/
// dosageAgent.test.js لاختبار منطق التوزيع نفسه بمعزل عن قاعدة بيانات حقيقية.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, closeDbPool } = require('./testUtils');

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('dosage-check');
  // نفس مبدأ drugInteractions.test.js — نضبط لنص فارغ (وليس حذف) لمنع dotenv
  // من إعادة تحميل مفتاح Gemini الحقيقي من ملف .env المحلي
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

describe('GET /api/dosage-check/status', () => {
  test("mode='online' افتراضياً وبدون مفاتيح API: يرجع available:false بأمان", async () => {
    const res = await request(app).get('/api/dosage-check/status').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test('بدون توكن دخول: يُرفض بـ401', async () => {
    const res = await request(app).get('/api/dosage-check/status');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/dosage-check/check', () => {
  test('بدون اسم دواء: يُرفض بـ400', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ dose: 500, ageYears: 30 });
    expect(res.status).toBe(400);
  });

  test('بدون جرعة: يُرفض بـ400', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'Paracetamol', ageYears: 30 });
    expect(res.status).toBe(400);
  });

  test('بجرعة سالبة أو صفر: يُرفض بـ400', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'Paracetamol', dose: 0, ageYears: 30 });
    expect(res.status).toBe(400);
  });

  test('بلا عمر ولا وزن إطلاقاً: يُرفض بـ400 برسالة واضحة', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'Paracetamol', dose: 500 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/عمر|وزن/);
  });

  test('دواء بالغين معروف (Paracetamol) وجرعة ضمن الحد الآمن: available:true, source:db, status:safe', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'Paracetamol', dose: 2000, unit: 'mg', ageYears: 30, lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, source: 'db', status: 'safe' });
    expect(res.body.limit.maxDailyDose).toBe(3000);
  });

  test('نفس الدواء بجرعة تتجاوز الحد: status:exceeds', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'Paracetamol', dose: 5000, unit: 'mg', ageYears: 30, lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, source: 'db', status: 'exceeds' });
  });

  test('أسبرين لطفل عمره 8 سنوات (نطاق ممنوع كلياً — max_daily_dose=0): status:contraindicated حتى بجرعة صغيرة', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'Aspirin', dose: 50, unit: 'mg', ageYears: 8, lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, source: 'db', status: 'contraindicated' });
  });

  test('أسبرين لبالغ عمره 30 سنة، نفس الجرعة الصغيرة: status:safe (نطاق مختلف تماماً عن الطفل)', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'Aspirin', dose: 50, unit: 'mg', ageYears: 30, lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, source: 'db', status: 'safe' });
  });

  test('طفل بالاسم العربي (أسبرين) بعمر 5 سنوات: نفس نتيجة الاسم الإنجليزي (لا حساسية للغة)', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'أسبرين', dose: 50, unit: 'mg', ageYears: 5, lang: 'ar' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, source: 'db', status: 'contraindicated' });
  });

  test('وزن فقط بلا عمر (أوميبرازول 15كغ يقع بنطاق 10-20كغ): يطابق الصف الصحيح حسب الوزن وحده', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'Omeprazole', dose: 10, unit: 'mg', weightKg: 15, lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, source: 'db', status: 'safe' });
    expect(res.body.limit.maxDailyDose).toBe(10);
  });

  test('وزن 25كغ (نطاق 20كغ فأكثر): يطابق صفاً مختلفاً بحد أعلى مختلف (20 مجم لا 10)', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'Omeprazole', dose: 15, unit: 'mg', weightKg: 25, lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.limit.maxDailyDose).toBe(20);
  });

  // ── migrations-sql/010_more_dosage_limits.sql — 6 أدوية إضافية ────────────
  test('سيبروفلوكساسين لطفل عمره 5 سنوات، جرعة ضمن سقف الأطفال (1000 مجم): status:safe', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'Ciprofloxacin', dose: 800, unit: 'mg', ageYears: 5, lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, source: 'db', status: 'safe' });
    expect(res.body.limit.maxDailyDose).toBe(1000);
  });

  test('ليسينوبريل لطفل عمره 4 سنوات (أقل من الحد الأدنى المدروس 6 سنوات): لا تطابق بالجدول لهذا العمر، ينتقل لـAI', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'Lisinopril', dose: 5, unit: 'mg', ageYears: 4, lang: 'en' });
    expect(res.status).toBe(200);
    // بدون مفاتيح API بهذا الاختبار: لا تطابق بالجدول (عمر خارج كل النطاقات المعروفة) + لا AI متاح = available:false، لا 'safe' افتراضياً
    expect(res.body.available).toBe(false);
  });

  test('ميترونيدازول لبالغ بجرعة تتجاوز السقف المرجعي (4 غم/يوم): status:exceeds', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'Metronidazole', dose: 5000, unit: 'mg', ageYears: 40, lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, source: 'db', status: 'exceeds' });
  });

  test('أتورفاستاتين لمراهق عمره 15 سنة، جرعة ضمن سقف المراهقين (20 مجم): status:safe', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'Atorvastatin', dose: 15, unit: 'mg', ageYears: 15, lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, source: 'db', status: 'safe' });
    expect(res.body.limit.maxDailyDose).toBe(20);
  });

  test('وارفارين (مستبعَد عمداً من الجدول — راجع migrations-sql/010): لا تطابق بالجدول بأي عمر، بدون مفاتيح API يرجع available:false', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'Warfarin', dose: 5, unit: 'mg', ageYears: 40, lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test('دواء غير موجود بالجدول إطلاقاً + بدون مفاتيح API: available:false بأمان (بدل خطأ 500)، لا يُفترَض آمن', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ drugName: 'SomeCompletelyMadeUpDrugXYZ', dose: 100, ageYears: 30, lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false });
  });

  test('بدون توكن دخول: يُرفض بـ401 قبل أي معالجة', async () => {
    const res = await request(app)
      .post('/api/dosage-check/check')
      .send({ drugName: 'Paracetamol', dose: 500, ageYears: 30 });
    expect(res.status).toBe(401);
  });
});

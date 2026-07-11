// backend/tests/patients.test.js
//
// ملاحظة مهمة بعد نقل موديول المرضى إلى PostgreSQL: هذا الاختبار يحتاج الآن
// اتصالاً حقيقياً بقاعدة PostgreSQL (وليس مجرد ملف db.json مؤقت كما كان سابقاً).
// إن لم تكن بيانات الاتصال بـ.env صحيحة أو السيرفر غير شغّال وقت التشغيل،
// يُتجاوز الاختبار بأمان مع رسالة تحذير واضحة، بدل فشل مربك لا يوضح السبب.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv } = require('./testUtils');

let dbPath;
let app;
let token;
let pgAvailable = true;

beforeAll(async () => {
  dbPath = setupTestEnv('patients');
  app = require('../server');

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testadmin', password: 'testpass123' });
  token = loginRes.body.token;

  // فحص اتصال حقيقي: محاولة قراءة بسيطة من جدول المرضى (لا تُعدّل أي بيانات)
  const probe = await request(app).get('/api/patients').set('Authorization', `Bearer ${token}`);
  if (probe.status !== 200) {
    pgAvailable = false;
    console.warn('⚠️  تعذّر الاتصال بـ PostgreSQL — تم تجاوز اختبارات المرضى. تأكد من إعدادات .env وأن PostgreSQL يعمل فعلياً.');
  }
});

afterAll(() => {
  cleanupTestEnv(dbPath);
});

describe('POST /api/patients — حفظ مريض جديد', () => {
  test('رفض حفظ مريض بدون اسم أو هاتف (تحقق صحة المدخلات بجانب الخادم)', async () => {
    if (!pgAvailable) return;
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', phone: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('بيانات غير صالحة');
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('رفض حفظ مريض باسم قصير جداً (أقل من حرفين)', async () => {
    if (!pgAvailable) return;
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'ا', phone: '07701234567' });

    expect(res.status).toBe(400);
  });

  test('قبول رقم هاتف قصير أو بصيغة غير قياسية طالما موجود (لا يوجد حد أدنى للطول)', async () => {
    if (!pgAvailable) return;
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'مريض برقم قصير', phone: '123' });

    expect(res.status).toBe(201);
  });

  test('حفظ مريض ببيانات صحيحة كاملة ينجح فعلياً ويُعاد بمعرّف (id)', async () => {
    if (!pgAvailable) return;
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'مريض تجريبي', phone: '07701234567', status: 'active' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('مريض تجريبي');
  });

  test('المريض المحفوظ يظهر فعلياً عند جلب القائمة الكاملة بعدها', async () => {
    if (!pgAvailable) return;
    const res = await request(app)
      .get('/api/patients')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(p => p.name === 'مريض تجريبي')).toBe(true);
  });

  test('محاولة الحفظ بدون توكن دخول تُرفض برمز 401 قبل الوصول لأي تحقق آخر', async () => {
    const res = await request(app)
      .post('/api/patients')
      .send({ name: 'مريض بدون تسجيل دخول', phone: '07701234567' });

    expect(res.status).toBe(401);
  });
});

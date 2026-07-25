// backend/tests/patients.test.js
//
// ملاحظة مهمة بعد نقل موديول المرضى إلى PostgreSQL: هذا الاختبار يحتاج الآن
// اتصالاً حقيقياً بقاعدة PostgreSQL (وليس مجرد ملف db.json مؤقت كما كان سابقاً).
// إن لم تكن بيانات الاتصال بـ.env صحيحة أو السيرفر غير شغّال وقت التشغيل،
// يفشل الملف كاملاً بخطأ واضح يوضح السبب (راجعي assertPgAvailable بـ
// testUtils.js) — لا يُتجاوز بصمت.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, assertPgAvailable, closeDbPool } = require('./testUtils');

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('patients');
  app = require('../server');

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testadmin', password: 'testpass123' });
  token = loginRes.body.token;

  // فحص اتصال حقيقي: محاولة قراءة بسيطة من جدول المرضى (لا تُعدّل أي بيانات)
  const probe = await request(app).get('/api/patients').set('Authorization', `Bearer ${token}`);
  assertPgAvailable(probe, 'المرضى');
});

afterAll(async () => {
  cleanupTestEnv(dbPath);

  await closeDbPool();
});

describe('POST /api/patients — حفظ مريض جديد', () => {
  test('رفض حفظ مريض بدون اسم أو هاتف (تحقق صحة المدخلات بجانب الخادم)', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', phone: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('بيانات غير صالحة');
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('رفض حفظ مريض باسم قصير جداً (أقل من حرفين)', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'ا', phone: '07701234567' });

    expect(res.status).toBe(400);
  });

  test('قبول رقم هاتف قصير أو بصيغة غير قياسية طالما موجود (لا يوجد حد أدنى للطول)', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'مريض برقم قصير', phone: '123' });

    expect(res.status).toBe(201);
  });

  test('حفظ مريض ببيانات صحيحة كاملة ينجح فعلياً ويُعاد بمعرّف (id)', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'مريض تجريبي', phone: '07701234567', status: 'active' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('مريض تجريبي');
  });

  test('المريض المحفوظ يظهر فعلياً عند جلب القائمة الكاملة بعدها', async () => {
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

describe('GET /api/patients — الجلب المُرقَّم من السيرفر (page/limit/search/status)', () => {
  test('بدون معامل page: يرجع مصفوفة خام كاملة كما كان دائماً (توافق كامل مع السلوك السابق)', async () => {
    const res = await request(app).get('/api/patients').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('مع معامل page: يرجع كائن مرقَّم { data, total, page, totalPages } بدل مصفوفة خام', async () => {
    const res = await request(app)
      .get('/api/patients?page=1&limit=5')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.page).toBe(1);
  });

  test('البحث (?search=) يرجّع فقط السجلات المطابقة بالاسم أو الهاتف', async () => {
    // نضيف مريضاً باسم فريد يسهل التحقق منه وسط أي بيانات أخرى موجودة
    await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'ززز_اسم_فريد_للبحث', phone: '07799998888', status: 'active' });

    // إصلاح: نص عربي خام داخل رابط URL مباشرة يسبب
    // "TypeError: Request path contains unescaped characters" — يجب ترميزه
    // بـ encodeURIComponent أولاً، بنفس ما يفعله المتصفح فعلياً عند بناء رابط بحث.
    const res = await request(app)
      .get(`/api/patients?page=1&limit=10&search=${encodeURIComponent('ززز_اسم_فريد_للبحث')}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every(p => p.name.includes('ززز_اسم_فريد_للبحث'))).toBe(true);
  });

  test('فلترة الحالة (?status=) ترجع فقط السجلات المطابقة', async () => {
    const res = await request(app)
      .get('/api/patients?page=1&limit=200&status=inactive')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every(p => p.status === 'inactive')).toBe(true);
  });

  test('limit أعلى من 200 يُقيَّد تلقائياً لحماية الخادم', async () => {
    const res = await request(app)
      .get('/api/patients?page=1&limit=9999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(200);
  });
});

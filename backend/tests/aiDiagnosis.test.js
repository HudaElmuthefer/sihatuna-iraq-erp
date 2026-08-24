// backend/tests/aiDiagnosis.test.js
//
// اختبارات لمسار التشخيص بالذكاء الاصطناعي — يغطي الحالة الأهم عملياً بأغلب
// النشرات (بدون مفتاح ANTHROPIC_API_KEY مُعدّ): يجب أن يرجع النظام
// available:false بأمان تام بدل أي خطأ أو استثناء، حتى يعرف الفرونت إند
// يستخدم النظام المحلي الاحتياطي بثقة.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, closeDbPool } = require('./testUtils');

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('ai-diagnosis');
  // نتأكد إن كلا مفتاحي الذكاء الاصطناعي فاضيين لهذا الاختبار تحديداً (سيناريو
  // النشر الافتراضي لأغلب المستخدمين) بغض النظر عن بيئة التشغيل الحقيقية —
  // خصوصاً إن ملف .env المحلي هنا قد يحتوي مفتاح Gemini حقيقي فعلاً. نضبطهم
  // لنص فارغ (وليس حذفهم بـ delete) لأن dotenv.config() بالأسفل (يُستدعى داخل
  // require('../server')) يتجاهل أي متغيّر موجود أصلاً بـ process.env حتى لو
  // كانت قيمته فاضية، لكنه *يعيد تعيين* أي متغيّر محذوف بالكامل من الملف —
  // فالحذف وحده ما يكفي هنا.
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

describe('GET /api/ai-diagnosis/status', () => {
  test('بدون مفتاح API: يرجع available:false بأمان', async () => {
    const res = await request(app).get('/api/ai-diagnosis/status').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test('بدون توكن دخول: يُرفض بـ401', async () => {
    const res = await request(app).get('/api/ai-diagnosis/status');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/ai-diagnosis/referral-doctors', () => {
  test('يرجع قائمة الأطباء من ملف البيانات بنجاح', async () => {
    const res = await request(app).get('/api/ai-diagnosis/referral-doctors').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('phone');
    expect(res.body[0]).toHaveProperty('keys');
  });

  test('بدون توكن دخول: يُرفض بـ401', async () => {
    const res = await request(app).get('/api/ai-diagnosis/referral-doctors');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/ai-diagnosis/analyze', () => {
  test('بدون أعراض: يُرفض بـ400 برسالة واضحة', async () => {
    const res = await request(app)
      .post('/api/ai-diagnosis/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [] });
    expect(res.status).toBe(400);
  });

  test('بأعراض صحيحة وبدون مفتاح API: يرجع available:false بأمان (بدل خطأ 500)', async () => {
    const res = await request(app)
      .post('/api/ai-diagnosis/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ symptoms: ['صداع', 'حمى'], age: '30', gender: 'ذكر', duration: 'يومين', lang: 'ar' });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test('بدون توكن دخول: يُرفض بـ401 قبل أي معالجة', async () => {
    const res = await request(app)
      .post('/api/ai-diagnosis/analyze')
      .send({ symptoms: ['صداع'] });
    expect(res.status).toBe(401);
  });
});

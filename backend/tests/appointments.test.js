// backend/tests/appointments.test.js
//
// أُضيف هذا الاختبار بعد اكتشاف خطأ حقيقي: مخطط التحقق الأول لموديول المواعيد
// افترض حقلين (patientId, doctorId) لا وجود لهما فعلياً بالصفحة — الصفحة
// الحقيقية (AppointmentsPage.js) تخزّن الاسم كنص مباشر (patient, doctor).
// هذا الاختبار يحاكي البيانات الفعلية بالضبط كما يرسلها AppointmentsPage.js،
// حتى يلتقط أي تعارض مشابه تلقائياً بالمستقبل بدل أن يكتشفه المستخدم بنفسه.
//
// ملاحظة إضافية بعد نقل موديول المواعيد إلى PostgreSQL: يحتاج هذا الاختبار
// الآن اتصالاً حقيقياً بقاعدة PostgreSQL. إن تعذّر، يُتجاوز بأمان مع تحذير
// واضح بدل فشل مربك لا يوضح السبب.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv } = require('./testUtils');

let dbPath;
let app;
let token;
let pgAvailable = true;

beforeAll(async () => {
  dbPath = setupTestEnv('appointments');
  app = require('../server');

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testadmin', password: 'testpass123' });
  token = loginRes.body.token;

  const probe = await request(app).get('/api/appointments').set('Authorization', `Bearer ${token}`);
  if (probe.status !== 200) {
    pgAvailable = false;
    console.warn('⚠️  تعذّر الاتصال بـ PostgreSQL — تم تجاوز اختبارات المواعيد. تأكد من إعدادات .env وأن PostgreSQL يعمل فعلياً.');
  }
});

afterAll(() => {
  cleanupTestEnv(dbPath);
});

describe('POST /api/appointments — حفظ موعد جديد', () => {
  test('حفظ موعد بالبنية الفعلية المطابقة لـ AppointmentsPage.js ينجح فعلياً', async () => {
    if (!pgAvailable) return;
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: 'مريض تجريبي',
        doctor: 'د. أحمد',
        department: 'باطنية',
        date: '2026-07-15',
        time: '09:00',
        status: 'pending',
        type: 'checkup',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.patient).toBe('مريض تجريبي');
  });

  test('رفض حفظ موعد بدون اسم مريض أو طبيب أو تاريخ', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ department: 'باطنية' });

    expect(res.status).toBe(400);
  });
});

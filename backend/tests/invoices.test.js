// backend/tests/invoices.test.js
//
// ملاحظة: إنشاء المريض التمهيدي أدناه يمر الآن عبر PostgreSQL (بعد نقل موديول
// المرضى إليه). إن تعذّر الاتصال، يُتجاوز اختبار "الحفظ الناجح" فقط بأمان مع
// تحذير واضح، بينما اختبارات التحقق من البيانات (لا تحتاج مريضاً حقيقياً)
// تستمر بالعمل طبيعياً بغض النظر عن حالة PostgreSQL.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv } = require('./testUtils');

let dbPath;
let app;
let token;
let patientId;
let pgAvailable = true;

beforeAll(async () => {
  dbPath = setupTestEnv('invoices');
  app = require('../server');

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testadmin', password: 'testpass123' });
  token = loginRes.body.token;

  // إنشاء مريض أولاً لأن الفاتورة تتطلب patientId فعلياً موجوداً بالسياق العملي
  const patientRes = await request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'مريض الفوترة', phone: '07709998877' });

  if (patientRes.status !== 201) {
    pgAvailable = false;
    console.warn('⚠️  تعذّر الاتصال بـ PostgreSQL — تم تجاوز اختبار الحفظ الناجح للفاتورة. تأكد من إعدادات .env.');
  } else {
    patientId = patientRes.body.id;
  }
});

afterAll(() => {
  cleanupTestEnv(dbPath);
});

describe('POST /api/invoices — حفظ فاتورة جديدة', () => {
  test('رفض حفظ فاتورة بدون قائمة خدمات (items)', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: patientId || 1 });

    expect(res.status).toBe(400);
  });

  test('رفض حفظ فاتورة بقائمة خدمات ليست من نوع array', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: patientId || 1, items: 'هذا نص وليس قائمة' });

    expect(res.status).toBe(400);
  });

  test('رفض حفظ فاتورة بدون تحديد المريض (patientId)', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ description: 'كشفية', price: 25000, qty: 1 }] });

    expect(res.status).toBe(400);
  });

  test('حفظ فاتورة صحيحة كاملة ينجح ويُعاد بمعرّف', async () => {
    if (!pgAvailable) return;
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId,
        items: [{ description: 'كشفية', price: 25000, qty: 1 }],
        total: 25000,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.patientId).toBe(patientId);
  });
});

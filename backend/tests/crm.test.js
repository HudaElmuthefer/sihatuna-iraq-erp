// backend/tests/crm.test.js
//
// اختبار لموديول crmInteractions — يمثّل نمط indexedColumns مخصَّص (patientId
// -> patient_id فقط، بدون name/phone/status الافتراضية)، واسم جدول مختلف عن
// اسم المسار (crm_interactions).
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, assertPgAvailable, closeDbPool } = require('./testUtils');

let dbPath;
let app;
let adminToken;

beforeAll(async () => {
  dbPath = setupTestEnv('crm');
  app = require('../server');
  const login = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  adminToken = login.body.token;

  const probe = await request(app).get('/api/crmInteractions').set('Authorization', `Bearer ${adminToken}`);
  assertPgAvailable(probe, 'CRM');
});

afterAll(async () => {
  cleanupTestEnv(dbPath);

  await closeDbPool();
});

describe('POST /api/crmInteractions', () => {
  test('رفض تفاعل بدون معرّف مريض (patientId)', async () => {
    const res = await request(app).post('/api/crmInteractions').set('Authorization', `Bearer ${adminToken}`).send({});
    expect(res.status).toBe(400);
  });

  test('حفظ تفاعل صحيح ينجح ويُخزَّن بجدول crm_interactions', async () => {
    // ── إصلاح: كان يفترض وجود مريض بمعرّف 1 (قيمة ثابتة)، وهو افتراض غير
    // موثوق — crm_interactions.patient_id مرجع فعلي (FOREIGN KEY) لجدول
    // patients، فأي بيئة بدون مريض بهذا المعرّف بالضبط (شائع جداً، مثلاً بعد
    // حذف بيانات تجريبية) يفشل هذا الاختبار بخطأ قيد مرجعي بدل خطأ الاختبار
    // نفسه. الآن ننشئ مريضاً حقيقياً أولاً ونستخدم معرّفه الفعلي، بنفس نمط
    // سلاسل dossiers/admissions بملف moduleSanity.test.js.
    const patientRes = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `مريض اختبار CRM ${Date.now()}`, phone: '07700000000' });
    expect(patientRes.status).toBe(201);

    const res = await request(app)
      .post('/api/crmInteractions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ patientId: patientRes.body.id, type: 'call', notes: 'اتصال متابعة' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });
});

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
const { setupTestEnv, cleanupTestEnv, assertPgAvailable, closeDbPool } = require('./testUtils');

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('appointments');
  app = require('../server');

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testadmin', password: 'testpass123' });
  token = loginRes.body.token;

  const probe = await request(app).get('/api/appointments').set('Authorization', `Bearer ${token}`);
  assertPgAvailable(probe, 'المواعيد');
});

afterAll(async () => {
  cleanupTestEnv(dbPath);

  await closeDbPool();
});

describe('POST /api/appointments — حفظ موعد جديد', () => {
  test('حفظ موعد بالبنية الفعلية المطابقة لـ AppointmentsPage.js ينجح فعلياً', async () => {
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

describe('GET /api/appointments — DATE column returned without timezone shift', () => {
  // Regression test for a real bug: node-postgres's default type parser for
  // SQL DATE columns (OID 1082) builds a JS Date object at local midnight,
  // which JSON.stringify then serializes via toISOString() in UTC — shifting
  // the calendar date back by a day for any timezone ahead of UTC (Iraq is
  // UTC+3). A date column parser is now registered in backend/config/
  // database.js (types.setTypeParser(types.builtins.DATE, ...)) to return
  // the raw "YYYY-MM-DD" string instead, avoiding the Date/timezone
  // round-trip entirely.
  const uniquePatient = `Date shift test patient ${Date.now()}`;

  test('an appointment saved with date "2026-07-15" is returned as exactly "2026-07-15", not shifted to "2026-07-14"', async () => {
    const create = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ patient: uniquePatient, doctor: 'د. اختبار', department: 'باطنية', date: '2026-07-15', time: '09:00', status: 'pending', type: 'checkup' });
    expect(create.status).toBe(201);

    const res = await request(app)
      .get(`/api/appointments/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-07-15');
  });
});

describe('GET /api/appointments — date-range filter (?startDate=&endDate=, field date)', () => {
  // Uses its own uniquely-named appointment (rather than reusing the fixed
  // 'مريض تجريبي'/2026-07-15 fixture from the POST tests above) so this
  // doesn't depend on how many prior test runs have already accumulated
  // appointments under that same shared name/date, and picks a date far
  // outside the bulk-seeded dev data's range to keep result counts small.
  const uniquePatient = `Date range test patient ${Date.now()}`;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ patient: uniquePatient, doctor: 'د. اختبار', department: 'باطنية', date: '2026-03-10', time: '09:00', status: 'pending', type: 'checkup' });
    expect(res.status).toBe(201);
  });

  test('a range matching the exact appointment date includes it in the results', async () => {
    const res = await request(app)
      .get('/api/appointments?page=1&limit=200&startDate=2026-03-10&endDate=2026-03-10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some(a => a.patient === uniquePatient && a.date === '2026-03-10')).toBe(true);
  });

  test('a range that excludes the appointment date omits it from the results', async () => {
    const res = await request(app)
      .get('/api/appointments?page=1&limit=200&startDate=2000-01-01&endDate=2000-01-31')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some(a => a.patient === uniquePatient)).toBe(false);
  });
});

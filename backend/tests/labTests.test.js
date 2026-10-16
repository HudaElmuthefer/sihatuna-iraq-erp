// backend/tests/labTests.test.js
//
// أول اختبار لموديول المختبر — يمثّل نمطاً مختلفاً (indexedColumns فاضية،
// تخزين JSONB بحت بدون أعمدة مفهرسة إطلاقاً، بعكس أغلب الموديولات الأخرى
// المُختبَرة سابقاً) — يستاهل تغطية مستقلة للتأكد إن هذا النمط يشتغل صح.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, assertPgAvailable, closeDbPool } = require('./testUtils');
const { pool } = require('../config/database');

let dbPath;
let app;
let adminToken;

beforeAll(async () => {
  dbPath = await setupTestEnv('labTests');
  app = require('../server');
  const login = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  adminToken = login.body.token;

  const probe = await request(app).get('/api/labTests').set('Authorization', `Bearer ${adminToken}`);
  assertPgAvailable(probe, 'المختبر');
});

afterAll(async () => {
  cleanupTestEnv(dbPath);

  await closeDbPool();
});

describe('POST /api/labTests — موديول بـ indexedColumns فاضية (JSONB بحت)', () => {
  test('رفض فحص بدون اسم مريض أو نوع فحص', async () => {
    const res = await request(app)
      .post('/api/labTests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('حفظ فحص صحيح ينجح ويُخزَّن بجدول lab_tests (اسم جدول مختلف عن اسم المسار)', async () => {
    const res = await request(app)
      .post('/api/labTests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ patientName: 'مريض اختبار', testType: 'CBC', status: 'pending' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.testType).toBe('CBC'); // يؤكد إن الحقل رجع صحيحاً من JSONB رغم عدم وجود عمود مفهرس له

    // This test only verifies creation and JSONB field storage, not
    // delete behavior, so the record is removed directly from the
    // database rather than through the recycle-bin delete route.
    await pool.query('DELETE FROM lab_tests WHERE id = $1', [res.body.id]);
  });

  test('التعديل والحذف يعملان صح رغم عدم وجود أعمدة مفهرسة', async () => {
    const created = await request(app)
      .post('/api/labTests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ patientName: 'مريض للتعديل', testType: 'Blood Sugar' });
    const id = created.body.id;

    const updated = await request(app)
      .put(`/api/labTests/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ patientName: 'مريض للتعديل', testType: 'Blood Sugar', status: 'completed' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('completed');

    const deleted = await request(app)
      .delete(`/api/labTests/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(200);

    // The delete above moves the record into the recycle bin rather than
    // removing it permanently; purge it here so this test does not leave
    // a permanent row behind in the recycle bin table.
    const bin = await request(app).get('/api/recycle-bin').set('Authorization', `Bearer ${adminToken}`);
    const binEntry = bin.body.find(r => r.moduleKey === 'labTests' && r.originalId === id);
    expect(binEntry).toBeDefined();
    await request(app).delete(`/api/recycle-bin/${binEntry.id}`).set('Authorization', `Bearer ${adminToken}`);

    const getAfterDelete = await request(app)
      .get(`/api/labTests/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getAfterDelete.status).toBe(404);
  });
});

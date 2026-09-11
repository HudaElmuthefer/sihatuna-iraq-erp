// backend/tests/hospitalScopedUsers.test.js
//
// اختبار تكامل يتحقق من قاعدة الصلاحيات الحالية لإدارة المستخدمين: إدمن محلي
// (له hospitalId محدَّد — "مسؤول مستشفى") لا يستطيع إطلاقاً إنشاء/تعديل/حذف
// أي مستخدم أو إعادة ضبط كلمة مروره، حتى ضمن منشأته هو — إدارة الحسابات تبقى
// حصراً بيد الإدمن العام (بدون hospitalId — مستوى الوزارة)، الذي يرى ويدير
// الجميع كالمعتاد.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, closeDbPool } = require('./testUtils');

let dbPath;
let app;
let globalAdminToken;
let hospA_AdminToken;
let hospA_UserId;
let hospB_UserId;
let hospBId;

beforeAll(async () => {
  dbPath = await setupTestEnv('hospital-scoped-users');
  app = require('../server');

  const login = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  globalAdminToken = login.body.token;

  // مستشفيان تجريبيان حقيقيان (معرّف UUID فعلي، وليس نصاً حراً) — لاختبار عزل إدمن محلي
  const hospA = await request(app).post('/api/hospitals').set('Authorization', `Bearer ${globalAdminToken}`)
    .send({ nameAr: 'مستشفى أ', nameEn: 'Hospital A' });
  const hospAId = hospA.body.id;
  const hospB = await request(app).post('/api/hospitals').set('Authorization', `Bearer ${globalAdminToken}`)
    .send({ nameAr: 'مستشفى ب', nameEn: 'Hospital B' });
  hospBId = hospB.body.id;

  // ننشئ إدمن محلي لمستشفى A، ومستخدم عادي بكل من مستشفيين مختلفين
  const hospAAdmin = await request(app).post('/api/users').set('Authorization', `Bearer ${globalAdminToken}`)
    .send({ name: 'إدمن منشأة A', username: `hospA_admin_${Date.now()}`, password: 'testpass123', role: 'admin', hospitalId: hospAId });

  const hospAUser = await request(app).post('/api/users').set('Authorization', `Bearer ${globalAdminToken}`)
    .send({ name: 'مستخدم منشأة A', username: `hospA_user_${Date.now()}`, password: 'testpass123', role: 'nurse', hospitalId: hospAId });
  hospA_UserId = hospAUser.body.id;

  const hospBUser = await request(app).post('/api/users').set('Authorization', `Bearer ${globalAdminToken}`)
    .send({ name: 'مستخدم منشأة B', username: `hospB_user_${Date.now()}`, password: 'testpass123', role: 'nurse', hospitalId: hospBId });
  hospB_UserId = hospBUser.body.id;

  // تسجيل دخول كإدمن منشأة A
  const loginHospAAdmin = await request(app).post('/api/auth/login')
    .send({ username: hospAAdmin.body.username, password: 'testpass123' });
  hospA_AdminToken = loginHospAAdmin.body.token;
});

afterAll(async () => {
  cleanupTestEnv(dbPath);

  await closeDbPool();
});

describe('إدمن محلي (مسؤول مستشفى — hospitalId محدَّد) — لا يدير أي مستخدم إطلاقاً', () => {
  test('GET /users يُرفض بـ403، حتى لمستخدمي منشأته هو', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${hospA_AdminToken}`);
    expect(res.status).toBe(403);
  });

  test('POST /users (إنشاء مستخدم جديد) يُرفض بـ403', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${hospA_AdminToken}`)
      .send({ name: 'محاولة إنشاء بواسطة مسؤول مستشفى', username: `sneaky_${Date.now()}`, password: 'testpass123', role: 'nurse', hospitalId: 'hospA' });
    expect(res.status).toBe(403);
  });

  test('PUT على مستخدم بنفس المنشأة يُرفض بـ403', async () => {
    const res = await request(app)
      .put(`/api/users/${hospA_UserId}`)
      .set('Authorization', `Bearer ${hospA_AdminToken}`)
      .send({ name: 'محاولة تعديل بواسطة مسؤول مستشفى' });
    expect(res.status).toBe(403);
  });

  test('DELETE على مستخدم بنفس المنشأة يُرفض بـ403', async () => {
    const res = await request(app)
      .delete(`/api/users/${hospA_UserId}`)
      .set('Authorization', `Bearer ${hospA_AdminToken}`);
    expect(res.status).toBe(403);
  });

  test('إعادة ضبط كلمة مرور مستخدم بنفس المنشأة يُرفض بـ403', async () => {
    const res = await request(app)
      .post(`/api/users/${hospA_UserId}/reset-password`)
      .set('Authorization', `Bearer ${hospA_AdminToken}`);
    expect(res.status).toBe(403);
  });

  test('bulk-deactivate / bulk-delete يُرفضان بـ403', async () => {
    const res1 = await request(app)
      .post('/api/users/bulk-deactivate')
      .set('Authorization', `Bearer ${hospA_AdminToken}`)
      .send({ hospitalId: 'hospA' });
    expect(res1.status).toBe(403);

    const res2 = await request(app)
      .post('/api/users/bulk-delete')
      .set('Authorization', `Bearer ${hospA_AdminToken}`)
      .send({ hospitalId: 'hospA' });
    expect(res2.status).toBe(403);
  });
});

describe('إدمن عام (بدون hospitalId) — يرى ويدير الجميع', () => {
  test('GET /users يرجع مستخدمي كل المنشآت', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${globalAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some(u => u.id === hospA_UserId)).toBe(true);
    expect(res.body.some(u => u.id === hospB_UserId)).toBe(true);
  });

  test('إعادة ضبط كلمة مرور مستخدم بأي منشأة تنجح', async () => {
    const res = await request(app)
      .post(`/api/users/${hospB_UserId}/reset-password`)
      .set('Authorization', `Bearer ${globalAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tempPassword).toBeDefined();
  });

  test('bulk-deactivate يعطّل كل مستخدمي منشأة واحدة دفعة واحدة، دون التأثير على منشأة ثانية', async () => {
    const res = await request(app)
      .post('/api/users/bulk-deactivate')
      .set('Authorization', `Bearer ${globalAdminToken}`)
      .send({ hospitalId: hospBId });
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);

    // المستخدم المعطَّل لم يعد يستطيع تسجيل الدخول
    const disabledLogin = await request(app).post('/api/auth/login')
      .send({ username: 'nonexistent-placeholder-not-used', password: 'x' });
    expect(disabledLogin.status).toBe(401);

    // منشأة A لم تتأثر
    const stillActive = await request(app).get('/api/users').set('Authorization', `Bearer ${globalAdminToken}`);
    const hospAUserRow = stillActive.body.find(u => u.id === hospA_UserId);
    expect(hospAUserRow.isActive).not.toBe(false);
  });

  test('bulk-delete يحذف كل مستخدمي منشأة واحدة دفعة واحدة', async () => {
    const res = await request(app)
      .post('/api/users/bulk-delete')
      .set('Authorization', `Bearer ${globalAdminToken}`)
      .send({ hospitalId: hospBId });
    expect(res.status).toBe(200);

    const after = await request(app).get('/api/users').set('Authorization', `Bearer ${globalAdminToken}`);
    expect(after.body.some(u => u.id === hospB_UserId)).toBe(false);
  });
});

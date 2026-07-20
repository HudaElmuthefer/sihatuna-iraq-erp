// backend/tests/accounts.test.js
//
// أول اختبار لموديول الحسابات (transactions) — موديول مالي حساس كان بدون أي
// تغطية اختبارية. يغطي: الحفظ الأساسي، رفض حقل مطلوب ناقص، وفرض صلاحية
// "accounts" (لا يوصله إلا محاسب أو إدمن).
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, assertPgAvailable } = require('./testUtils');

let dbPath;
let app;
let adminToken;
let nurseToken; // لا تملك صلاحية accounts — تُستخدم للتحقق من الرفض

beforeAll(async () => {
  dbPath = setupTestEnv('accounts');
  app = require('../server');

  const adminLogin = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  adminToken = adminLogin.body.token;
  const nurseLogin = await request(app).post('/api/auth/login').send({ username: 'testnurse', password: 'testpass123' });
  nurseToken = nurseLogin.body.token;

  const probe = await request(app).get('/api/transactions').set('Authorization', `Bearer ${adminToken}`);
  assertPgAvailable(probe, 'الحسابات');
});

afterAll(() => {
  cleanupTestEnv(dbPath);
});

describe('POST /api/transactions', () => {
  test('رفض معاملة بدون وصف (desc) أو مبلغ (amount)', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('حفظ معاملة صحيحة ينجح', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ desc: 'دفعة اختبار', amount: 50000, type: 'income' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  test('ممرضة بدون صلاحية "accounts" تُرفض بـ403 (بيانات مالية حساسة)', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ desc: 'محاولة غير مصرَّحة', amount: 1000 });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/transactions', () => {
  test('ممرضة بدون صلاحية "accounts" تُرفض حتى من مجرّد القراءة (لا openRead لهذا الموديول)', async () => {
    const res = await request(app).get('/api/transactions').set('Authorization', `Bearer ${nurseToken}`);
    expect(res.status).toBe(403);
  });

  test('بدون توكن دخول: يُرفض بـ401', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(401);
  });
});

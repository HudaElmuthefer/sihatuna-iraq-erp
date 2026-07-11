// backend/tests/auth.test.js
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv } = require('./testUtils');

let dbPath;
let app;

beforeAll(() => {
  dbPath = setupTestEnv('auth');
  app = require('../server'); // يُستورد بعد ضبط DB_PATH وJWT_SECRET مباشرة
});

afterAll(() => {
  cleanupTestEnv(dbPath);
});

describe('POST /api/auth/login', () => {
  test('تسجيل دخول ناجح ببيانات صحيحة يُعيد توكن ومعلومات المستخدم', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'testpass123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('testadmin');
    expect(res.body.user.password).toBeUndefined(); // كلمة المرور يجب ألا تُعاد أبداً بالاستجابة
  });

  test('كلمة مرور خاطئة تُرفض برمز 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  test('اسم مستخدم غير موجود يُرفض برمز 401 (وليس 404 أو 500)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'no-such-user', password: 'anything' });

    expect(res.status).toBe(401);
  });

  test('طلب بدون توكن على مسار محمي يُرفض برمز 401', async () => {
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(401);
  });
});

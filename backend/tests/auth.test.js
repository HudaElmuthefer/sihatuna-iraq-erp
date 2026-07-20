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

describe('POST /api/auth/logout — إبطال فعلي للتوكن', () => {
  test('توكن مُستخدَم بعد تسجيل الخروج يُرفض برمز 401، حتى لو كان توقيعه صحيحاً وتاريخه لم ينته', async () => {
    // 1) تسجيل دخول والحصول على توكن صالح
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'testpass123' });
    const token = loginRes.body.token;
    expect(token).toBeDefined();

    // 2) التأكد إن التوكن يعمل فعلاً قبل تسجيل الخروج
    const beforeLogout = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(beforeLogout.status).toBe(200);

    // 3) تسجيل الخروج بنفس التوكن
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logoutRes.status).toBe(200);

    // 4) نفس التوكن (بتوقيع صحيح وتاريخ صلاحية لم ينته) يجب أن يُرفض الآن
    const afterLogout = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(afterLogout.status).toBe(401);
  });

  test('تسجيل الخروج من جلسة لا يبطل جلسات أخرى لنفس المستخدم', async () => {
    const login1 = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
    const login2 = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
    const token1 = login1.body.token;
    const token2 = login2.body.token;

    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token1}`);

    const res1 = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token1}`);
    const res2 = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token2}`);
    expect(res1.status).toBe(401); // الجلسة المسجَّل خروجها مرفوضة
    expect(res2.status).toBe(200); // الجلسة الثانية (توكن مختلف تماماً) لا تزال صالحة
  });
});

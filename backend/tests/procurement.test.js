// backend/tests/procurement.test.js
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, assertPgAvailable } = require('./testUtils');

let dbPath;
let app;
let adminToken;
let nurseToken;

beforeAll(async () => {
  dbPath = setupTestEnv('procurement');
  app = require('../server');
  const adminLogin = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  adminToken = adminLogin.body.token;
  const nurseLogin = await request(app).post('/api/auth/login').send({ username: 'testnurse', password: 'testpass123' });
  nurseToken = nurseLogin.body.token;

  const probe = await request(app).get('/api/procurement').set('Authorization', `Bearer ${adminToken}`);
  assertPgAvailable(probe, 'المشتريات');
});

afterAll(() => {
  cleanupTestEnv(dbPath);
});

describe('POST /api/procurement', () => {
  test('رفض طلب شراء بدون مورّد أو عنوان', async () => {
    const res = await request(app).post('/api/procurement').set('Authorization', `Bearer ${adminToken}`).send({});
    expect(res.status).toBe(400);
  });

  test('حفظ طلب شراء صحيح ينجح', async () => {
    const res = await request(app)
      .post('/api/procurement')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supplier: 'شركة الرافدين', title: 'شراء أجهزة طبية' });
    expect(res.status).toBe(201);
  });

  test('ممرضة بدون صلاحية "procurement" تُرفض بـ403', async () => {
    const res = await request(app)
      .post('/api/procurement')
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ supplier: 'x', title: 'y' });
    expect(res.status).toBe(403);
  });
});

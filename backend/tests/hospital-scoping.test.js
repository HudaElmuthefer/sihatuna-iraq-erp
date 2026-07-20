// backend/tests/hospital-scoping.test.js
//
// اختبار حرج للمرحلة 4 من دعم المنشآت المتعددة: يتأكد فعلياً إن مستخدماً
// مربوطاً بمنشأة معينة لا يقدر يشوف أو يعدّل أو يحذف بيانات منشأة أخرى،
// حتى لو خمّن معرّف السجل مباشرة. يحتاج اتصالاً حقيقياً بـ PostgreSQL —
// يفشل الملف كاملاً بخطأ واضح لو تعذّر (لا يُتجاوز بصمت)، بنفس نمط بقية الاختبارات.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, assertPgAvailable } = require('./testUtils');

let dbPath;
let app;
let adminToken;
let hospitalATokenUser, hospitalBTokenUser;

beforeAll(async () => {
  dbPath = setupTestEnv('hospital-scoping');
  app = require('../server');

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testadmin', password: 'testpass123' });
  adminToken = adminLogin.body.token;

  // إنشاء منشأتين تجريبيتين
  const hospA = await request(app).post('/api/hospitals').set('Authorization', `Bearer ${adminToken}`)
    .send({ nameAr: 'منشأة أ', nameEn: 'Hospital A' });
  const hospB = await request(app).post('/api/hospitals').set('Authorization', `Bearer ${adminToken}`)
    .send({ nameAr: 'منشأة ب', nameEn: 'Hospital B' });

  if (hospA.status !== 201 || hospB.status !== 201) {
    assertPgAvailable(hospA.status !== 201 ? hospA : hospB, 'عزل المنشآت', 201);
  }

  // إنشاء مستخدم مربوط بكل منشأة، وتسجيل دخول كل واحد للحصول على توكن خاص به
  await request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'staffA', password: 'testpass123', name: 'موظف أ', role: 'doctor', hospitalId: hospA.body.id });
  await request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'staffB', password: 'testpass123', name: 'موظف ب', role: 'doctor', hospitalId: hospB.body.id });

  const loginA = await request(app).post('/api/auth/login').send({ username: 'staffA', password: 'testpass123' });
  const loginB = await request(app).post('/api/auth/login').send({ username: 'staffB', password: 'testpass123' });
  hospitalATokenUser = loginA.body.token;
  hospitalBTokenUser = loginB.body.token;
});

afterAll(() => {
  cleanupTestEnv(dbPath);
});

describe('عزل بيانات المرضى بين المنشآت', () => {
  test('موظف منشأة أ يضيف مريضاً، وموظف منشأة ب لا يقدر يشوفه إطلاقاً', async () => {

    const createRes = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${hospitalATokenUser}`)
      .send({ name: 'مريض سرّي بمنشأة أ', phone: '07700000001' });
    expect(createRes.status).toBe(201);
    const patientId = createRes.body.id;

    // موظف منشأة ب يجلب القائمة الكاملة — يجب ألا يظهر مريض منشأة أ إطلاقاً
    const listB = await request(app)
      .get('/api/patients')
      .set('Authorization', `Bearer ${hospitalBTokenUser}`);
    expect(listB.status).toBe(200);
    expect(listB.body.some(p => p.id === patientId)).toBe(false);

    // موظف منشأة ب يحاول الوصول المباشر بتخمين المعرّف — يجب أن يُرفض (404)
    const directAccessB = await request(app)
      .get(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${hospitalBTokenUser}`);
    expect(directAccessB.status).toBe(404);

    // موظف منشأة أ نفسه يقدر يشوف مريضه بدون مشكلة
    const listA = await request(app)
      .get('/api/patients')
      .set('Authorization', `Bearer ${hospitalATokenUser}`);
    expect(listA.body.some(p => p.id === patientId)).toBe(true);
  });

  test('موظف منشأة ب لا يقدر يحذف مريضاً يخص منشأة أ حتى لو عرف المعرّف', async () => {

    const createRes = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${hospitalATokenUser}`)
      .send({ name: 'مريض ثاني بمنشأة أ', phone: '07700000002' });
    const patientId = createRes.body.id;

    const deleteAttempt = await request(app)
      .delete(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${hospitalBTokenUser}`);
    expect(deleteAttempt.status).toBe(404);

    // نتأكد إنه لسا موجود فعلياً (ما انحذف)
    const stillThere = await request(app)
      .get(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${hospitalATokenUser}`);
    expect(stillThere.status).toBe(200);
  });

  test('إدمن بلا منشأة مُعيَّنة (مستوى الوزارة) يشوف مرضى كل المنشآت', async () => {

    const listAsAdmin = await request(app)
      .get('/api/patients')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listAsAdmin.status).toBe(200);
    expect(listAsAdmin.body.some(p => p.name === 'مريض سرّي بمنشأة أ')).toBe(true);
  });
});

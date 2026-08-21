// backend/tests/cache.test.js
//
// اختبار تكاملي (integration) للتخزين المؤقت بـRedis المضاف بالمرحلة الثانية
// (options.cache بـroutes/pgCrud.js) — نستخدم موديول doctors كمثال (أول
// موديول فعّلنا عليه الكاش، راجعي routes/modules.js). ioredis-mock بدل Redis
// حقيقي (لا خادم Redis متاح وقت الاختبار)، بينما PostgreSQL حقيقي فعلاً
// (نفس نمط باقي اختبارات pgCrud — راجعي testUtils.js).
//
// الإثبات الفعلي: نتجسّس (spy) على pool.query لنتأكد إن الاستعلام الثاني
// المطابق تماماً للأول لا يصل فعلياً لقاعدة البيانات (كاش)، وإن أي كتابة
// (POST) تُبطِل الكاش فعلياً (استعلام جديد يصل لقاعدة البيانات بعدها).
jest.mock('ioredis', () => require('ioredis-mock'));

const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, assertPgAvailable, closeDbPool } = require('./testUtils');

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('cache');
  app = require('../server');

  const loginRes = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  token = loginRes.body.token;

  // ملاحظة: الفحص عمداً عبر /api/patients لا /api/doctors — doctors هو
  // الموديول المُختبَر بالكاش هنا، وأي طلب مسبق له كان "يُسخّن" كاشه قبل أول
  // اختبار فعلي (فيكسر افتراض "أول طلب = وصول فعلي لقاعدة البيانات" أدناه).
  const probe = await request(app).get('/api/patients').set('Authorization', `Bearer ${token}`);
  assertPgAvailable(probe, 'المرضى (فحص PostgreSQL قبل اختبارات الكاش)');
});

afterAll(async () => {
  cleanupTestEnv(dbPath);
  await closeDbPool();
});

function countDoctorsQueries(spy) {
  return spy.mock.calls.filter((c) => typeof c[0] === 'string' && c[0].includes('FROM doctors')).length;
}

describe('GET /api/doctors — كاش Redis', () => {
  test('نفس طلب القائمة مرتين متتاليتين: الثانية لا تصل لقاعدة البيانات (cache hit)', async () => {
    const { pool } = require('../config/database');
    const spy = jest.spyOn(pool, 'query');
    spy.mockClear();

    const first = await request(app).get('/api/doctors').set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    const callsAfterFirst = countDoctorsQueries(spy);
    expect(callsAfterFirst).toBeGreaterThan(0);

    const second = await request(app).get('/api/doctors').set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(200);
    const callsAfterSecond = countDoctorsQueries(spy);

    expect(callsAfterSecond).toBe(callsAfterFirst); // ما انزاد أي استعلام جديد — جاء من الكاش
    expect(second.body).toEqual(first.body);

    spy.mockRestore();
  });

  test('إضافة طبيب جديد (POST) تُبطِل الكاش — القائمة التالية تصل فعلياً لقاعدة البيانات وتتضمّن الطبيب الجديد', async () => {
    const { pool } = require('../config/database');

    // نملأ الكاش أولاً
    await request(app).get('/api/doctors').set('Authorization', `Bearer ${token}`);

    const created = await request(app)
      .post('/api/doctors')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'د. اختبار الكاش', phone: '07701112233' });
    expect(created.status).toBe(201);

    const spy = jest.spyOn(pool, 'query');
    spy.mockClear();

    const after = await request(app).get('/api/doctors').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(200);
    expect(countDoctorsQueries(spy)).toBeGreaterThan(0); // وصل فعلياً لقاعدة البيانات — الكاش أُبطِل
    expect(after.body.some((d) => d.name === 'د. اختبار الكاش')).toBe(true);

    spy.mockRestore();
  });

  test('فلاتر مختلفة (?search=) تُخزَّن بمفاتيح كاش منفصلة عن القائمة الكاملة', async () => {
    const { pool } = require('../config/database');
    await request(app).get('/api/doctors').set('Authorization', `Bearer ${token}`); // يملأ كاش "بلا فلتر"

    const spy = jest.spyOn(pool, 'query');
    spy.mockClear();
    const filtered = await request(app).get('/api/doctors').query({ search: 'اختبار' }).set('Authorization', `Bearer ${token}`);
    expect(filtered.status).toBe(200);
    expect(countDoctorsQueries(spy)).toBeGreaterThan(0); // مفتاح مختلف — لم يُخزَّن مسبقاً، وصل لقاعدة البيانات
    spy.mockRestore();
  });
});

// backend/tests/maintenanceLog.test.js
//
// أول اختبار لسجل الصيانة الحقيقي — كان قبل هذا الإصلاح تاريخاً وحيداً
// يُستبدَل بكل صيانة جديدة (تُفقَد كل السجلات السابقة). يتحقق من إن سجلات
// متعددة لنفس المركبة/الأصل تبقى محفوظة كلها، مو بس آخر واحدة.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, assertPgAvailable, closeDbPool } = require('./testUtils');

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('maintenance-log');
  app = require('../server');
  const login = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  token = login.body.token;

  const probe = await request(app).get('/api/assetMaintenanceLog').set('Authorization', `Bearer ${token}`);
  assertPgAvailable(probe, 'سجل الصيانة');
});

afterAll(async () => {
  cleanupTestEnv(dbPath);

  await closeDbPool();
});

describe('POST/GET /api/assetMaintenanceLog — سجلات متعددة تبقى محفوظة كلها', () => {
  test('3 سجلات صيانة متتالية لنفس الأصل تبقى الثلاثة محفوظة (مو آخر وحدة بس)', async () => {
    // ── إصلاح: كان معرّفاً ثابتاً (999) — بما إن اختبارات PostgreSQL هنا تكتب
    // فعلياً على القاعدة الحقيقية (بلا عزل مثل db.json)، أي تشغيل ثانٍ لـ
    // npm test بنفس القاعدة يتراكم فوق سجلات التشغيل السابق بنفس المعرّف،
    // فيفشل الفحص لاحقاً (forThisAsset.length يصير 6 بدل 3 مثلاً) رغم إن
    // الكود المختبَر سليم تماماً. معرّف فريد بكل تشغيل يمنع هذا التراكم.
    // ملاحظة: asset_id عمود INTEGER بقاعدة البيانات (حد أقصى ~2.1 مليار) —
    // Date.now() وحده (13 رقماً) يتجاوزه ويسبب خطأ "value out of range"،
    // فنُبقي الرقم ضمن المجال المسموح بـ %.
    const assetId = Date.now() % 2000000000;

    for (const desc of ['تغيير زيت', 'فحص دوري', 'استبدال قطعة غيار']) {
      const res = await request(app)
        .post('/api/assetMaintenanceLog')
        .set('Authorization', `Bearer ${token}`)
        .send({ assetId, date: '2026-07-01', description: desc, cost: 50000 });
      expect(res.status).toBe(201);
    }

    const list = await request(app).get('/api/assetMaintenanceLog').set('Authorization', `Bearer ${token}`);
    const forThisAsset = list.body.filter(m => m.assetId === assetId);
    expect(forThisAsset.length).toBe(3); // الثلاثة موجودة، ولا وحدة انكتب فوقها
  });

  test('رفض سجل صيانة بدون وصف', async () => {
    const res = await request(app)
      .post('/api/assetMaintenanceLog')
      .set('Authorization', `Bearer ${token}`)
      .send({ assetId: 1, date: '2026-07-01' });
    expect(res.status).toBe(400);
  });
});

describe('POST/GET /api/ambulanceMaintenanceLog — نفس المبدأ للمركبات', () => {
  test('سجلات متعددة لنفس المركبة تبقى محفوظة كلها', async () => {
    // نفس إصلاح assetId أعلاه: معرّف فريد بكل تشغيل بدل ثابت (888) يمنع
    // تراكم سجلات تشغيلات سابقة على نفس القاعدة الحقيقية، وضمن مجال INTEGER.
    const vehicleId = (Date.now() % 2000000000) + 1;

    await request(app).post('/api/ambulanceMaintenanceLog').set('Authorization', `Bearer ${token}`)
      .send({ vehicleId, date: '2026-06-01', description: 'صيانة أولى' });
    await request(app).post('/api/ambulanceMaintenanceLog').set('Authorization', `Bearer ${token}`)
      .send({ vehicleId, date: '2026-07-01', description: 'صيانة ثانية' });

    const list = await request(app).get('/api/ambulanceMaintenanceLog').set('Authorization', `Bearer ${token}`);
    const forThisVeh = list.body.filter(m => m.vehicleId === vehicleId);
    expect(forThisVeh.length).toBe(2);
  });
});

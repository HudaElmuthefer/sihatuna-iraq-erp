// backend/tests/assets.test.js
//
// Regression test for the Assets status/category display-vs-filter mismatch:
// a real DB check found 49 of 109 assets (a bulk-imported batch) have a
// blank status/category. AssetsPage.js used to display these with a
// misleading "Active"/"Other" fallback badge (STATUSES[a.status]||
// STATUSES.active), while the actual server-side filter did an exact SQL
// match (data->>'status' = 'active') that never matched a blank/missing
// value — so a record visibly labeled "Active" would vanish from the
// results the moment a user filtered by "Active". Fixed by adding an
// explicit "unset" display key (normalizeLookupKey pattern) plus a special
// UNSET_FILTER_VALUE ('__unset__') query sentinel (pgCrud.js) that matches
// "field is NULL or empty" instead of a literal value — this test covers
// the backend half of that fix.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, assertPgAvailable, closeDbPool } = require('./testUtils');
// لا نستورد pool بأعلى الملف عمداً — لو استُورد هنا (قبل استدعاء setupTestEnv()
// بـ beforeAll أدناه)، يُبنى الاتصال بقاعدة .env الحقيقية قبل أن تُضبَط قاعدة
// الاختبار المعزولة أصلاً، فيفشل العزل تماماً. راجعي التعليق بأعلى testUtils.js.

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('assets');
  app = require('../server');
  const loginRes = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  token = loginRes.body.token;

  const probe = await request(app).get('/api/assets').set('Authorization', `Bearer ${token}`);
  assertPgAvailable(probe, 'الأصول');
});

afterAll(async () => {
  cleanupTestEnv(dbPath);
  // القاعدة نفسها معزولة تماماً الآن (sihatuna_iraq_test، راجعي testUtils.js)،
  // لكن ننظّف سجلاتنا هنا أيضاً حتى لا تتراكم بلا حدود بقاعدة الاختبار نفسها
  // عبر مئات التشغيلات المستقبلية. نستورد pool هنا (وليس بأعلى الملف) بعد أن
  // تكون setupTestEnv() قد ضبطت PG_DATABASE فعلاً — راجعي التعليق أعلاه.
  const { pool } = require('../config/database');
  await pool.query(`DELETE FROM assets WHERE data->>'assetNo' LIKE 'AST-UNSET-%' OR data->>'assetNo' LIKE 'AST-ACTIVE-%' OR data->>'assetNo' LIKE 'AST-NOCAT-%' OR data->>'assetNo' LIKE 'AST-CAT-%'`);
  await closeDbPool();
});

describe('GET /api/assets — فلترة "__unset__" تطابق الحقل الغائب/الفارغ فقط', () => {
  test('status=__unset__ يرجع فقط الأصل بلا status، وstatus=active يرجع فقط الأصل النشط', async () => {
    const unique = Date.now();
    await request(app).post('/api/assets').set('Authorization', `Bearer ${token}`)
      .send({ assetNo: `AST-UNSET-${unique}`, name: `أصل بلا حالة ${unique}` }); // status omitted entirely
    await request(app).post('/api/assets').set('Authorization', `Bearer ${token}`)
      .send({ assetNo: `AST-ACTIVE-${unique}`, name: `أصل نشط ${unique}`, status: 'active' });

    const unsetRes = await request(app)
      .get(`/api/assets?page=1&limit=200&status=__unset__&search=${unique}`)
      .set('Authorization', `Bearer ${token}`);
    expect(unsetRes.status).toBe(200);
    expect(unsetRes.body.data.length).toBe(1);
    expect(unsetRes.body.data[0].assetNo).toBe(`AST-UNSET-${unique}`);
    expect(unsetRes.body.data[0].status).toBeFalsy();

    const activeRes = await request(app)
      .get(`/api/assets?page=1&limit=200&status=active&search=${unique}`)
      .set('Authorization', `Bearer ${token}`);
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.data.length).toBe(1);
    expect(activeRes.body.data[0].assetNo).toBe(`AST-ACTIVE-${unique}`);
  });

  test('category=__unset__ يرجع فقط الأصل بلا category', async () => {
    const unique = Date.now() + 1;
    await request(app).post('/api/assets').set('Authorization', `Bearer ${token}`)
      .send({ assetNo: `AST-NOCAT-${unique}`, name: `أصل بلا فئة ${unique}` }); // category omitted
    await request(app).post('/api/assets').set('Authorization', `Bearer ${token}`)
      .send({ assetNo: `AST-CAT-${unique}`, name: `أصل بفئة ${unique}`, category: 'it' });

    const res = await request(app)
      .get(`/api/assets?page=1&limit=200&category=__unset__&search=${unique}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].assetNo).toBe(`AST-NOCAT-${unique}`);
  });
});

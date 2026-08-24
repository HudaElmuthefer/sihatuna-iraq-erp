// backend/tests/rbac.test.js
//
// اختبار تكامل حقيقي (Integration Test) للتحقق من أن نظام الصلاحيات
// (requirePermission) فعّال فعلياً على المسارات الحقيقية بـ pgCrud — ليس فقط
// أن الدالة نفسها صحيحة بمعزل (ذلك موجود بـ requirePermission.test.js)، بل
// أن التطبيق الفعلي (تسجيل دخول → طلب حقيقي → قاعدة بيانات) يمنع فعلاً.
//
// السيناريو الأهم الذي هذا الاختبار يحميه من الانكسار مستقبلاً: قبل الإصلاح
// الأمني الأصلي، أي مستخدم مسجّل دخول (بغض النظر عن دوره) كان يستطيع أن يعدّل
// أي موديول. هذا الاختبار يمنع رجوع نفس الثغرة بالخطأ مستقبلاً (مثلاً لو نسي
// أحد أن يمرّر permission عند إضافة موديول جديد لاحقاً بـ routes/modules.js).
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, assertPgAvailable, closeDbPool } = require('./testUtils');

let dbPath;
let app;
let adminToken;
let nurseToken;

beforeAll(async () => {
  dbPath = setupTestEnv('rbac');
  app = require('../server');

  const adminLogin = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  adminToken = adminLogin.body.token;

  const nurseLogin = await request(app).post('/api/auth/login').send({ username: 'testnurse', password: 'testpass123' });
  nurseToken = nurseLogin.body.token;

  const probe = await request(app).get('/api/patients').set('Authorization', `Bearer ${adminToken}`);
  assertPgAvailable(probe, 'RBAC');
});

afterAll(async () => {
  cleanupTestEnv(dbPath);

  await closeDbPool();
});

describe('RBAC — فرض الصلاحيات على موديولات pgCrud الحقيقية', () => {
  test('حساب admin يستطيع أن يضيف سجلاً لموديول ليس له صلاحية "inventory" صراحة (يتجاوز الفحص دائماً)', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `RBAC-TEST-${Date.now()}`, name: 'صنف اختبار RBAC' });
    expect(res.status).toBe(201);
  });

  test('ممرضة بدون صلاحية "inventory" تُرفض بـ403 عند محاولة إضافة صنف مخزون', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ code: `RBAC-NURSE-${Date.now()}`, name: 'محاولة ممرضة' });
    expect(res.status).toBe(403);
  });

  test('نفس الممرضة تستطيع أن تضيف مريضاً بنجاح (تملك صلاحية "patients" صراحة)', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ name: 'مريضة اختبار RBAC', phone: '07709998888' });
    expect(res.status).toBe(201);
  });

  test('ممرضة بدون صلاحية "accounts" تُرفض بـ403 عند محاولة إضافة معاملة حسابية', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ name: 'معاملة اختبار', amount: 1000 });
    expect(res.status).toBe(403);
  });

  test('القراءة (GET) على موديول مرجعي مفتوح (openRead) تنجح للجميع حتى بدون صلاحية "doctors" صراحة', async () => {
    const res = await request(app)
      .get('/api/doctors')
      .set('Authorization', `Bearer ${nurseToken}`);
    expect(res.status).toBe(200); // doctors مضبوط openRead: true
  });

  test('القراءة (GET) على موديول غير مفتوح (مثل inventory) تُرفض أيضاً لمن لا يملك الصلاحية', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${nurseToken}`);
    expect(res.status).toBe(403); // القراءة هنا مقيّدة بنفس صلاحية الكتابة (لا openRead)
  });

  test('طلب بدون أي توكن يُرفض بـ401 قبل الوصول لفحص الصلاحية أصلاً', async () => {
    const res = await request(app).post('/api/inventory').send({ code: 'X', name: 'Y' });
    expect(res.status).toBe(401);
  });
});

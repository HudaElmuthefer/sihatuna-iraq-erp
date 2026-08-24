// backend/tests/moduleSanity.test.js
//
// اختبار حماية من التكرار (Regression Guard) لخطأ حقيقي وقع بـ 15 موديول
// مختلفة: تسجيل pgCrud() بدون تحديد indexedColumns صراحة كان يفترض ضمنياً
// وجود أعمدة name/phone/status حقيقية بالجدول، بينما أغلب الجداول تخزين
// JSONB بحت — فتفشل كل عملية POST بصمت بخطأ SQL غامض ("column X does not
// exist") لا يظهر إلا لحظة أول حفظ فعلي من مستخدم حقيقي. هذه الموديولات
// الـ15 لم يكن لها أي اختبار آلي إطلاقاً وقت اكتشاف الخطأ — هذا الملف يسدّ
// تلك الفجوة: لكل موديول، ننشئ سجلاً حقيقياً بالحد الأدنى من الحقول
// المطلوبة ونتحقق أنه يُحفَظ ويُقرأ صح. لو رجعت نفس مشكلة indexedColumns
// مستقبلاً (موديول جديد نسي تحديدها، أو تعديل خاطئ لموديول موجود)، هذا
// الاختبار يفشل فوراً وواضح بدل ما ينكشف بحساب مستخدم حقيقي.
//
// ── تحديث: تغطية الموديولات الستة المُضافة لاحقاً (الردهات/الأدوية، صالة
// الولادة، العلاج الطبيعي، الطابور، سلة المحذوفات) — كانت بلا أي اختبار
// آلي رغم كونها بنفس فئة الخطر (pgCrud جديد بلا تحقق). ──────────────────────
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, assertPgAvailable, closeDbPool } = require('./testUtils');

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('module-sanity');
  app = require('../server');

  const login = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  token = login.body.token;

  const probe = await request(app).get('/api/departments').set('Authorization', `Bearer ${token}`);
  assertPgAvailable(probe, 'فحص سلامة الموديولات (module sanity)');
});

afterAll(async () => {
  cleanupTestEnv(dbPath);

  await closeDbPool();
});

// كل حالة: [اسم الموديول بالـ API، أدنى جسم صالح للإنشاء (بدون قيم فريدة —
// تُضاف تلقائياً أدناه بلاحقة الوقت لتفادي تعارض duplicateCheck بين التشغيلات)]
const CASES = [
  ['departments', () => ({ name: `قسم اختبار ${Date.now()}` })],
  ['vaccinations', () => ({ patient: 'مريض اختبار', vaccine: 'لقاح اختبار', date: '2026-01-01' })],
  ['medicalLeaves', () => ({ employee: 'موظف اختبار', from: '2026-01-01', to: '2026-01-05' })],
  ['radiology', () => ({ patientName: 'مريض اختبار', modality: 'X-Ray' })],
  ['assets', () => ({ assetNo: `AST-TEST-${Date.now()}`, name: 'جهاز اختبار' })],
  ['documents', () => ({ title: `مستند اختبار ${Date.now()}` })],
  ['promotionsAllowances', () => ({ name: 'موظف اختبار الترفيع والعلاوة' })],
  ['salaries', () => ({ name: 'موظف اختبار الراتب' })],
  ['outgoing', () => ({ title: `كتاب صادر اختبار ${Date.now()}`, to: 'جهة اختبار' })],
  ['incoming', () => ({ title: `كتاب وارد اختبار ${Date.now()}`, from: 'جهة اختبار' })],
  ['wards', () => ({ name: `ردهة اختبار ${Date.now()}` })],
  ['deliveries', () => ({ motherName: 'أم اختبار' })],
  ['ptEquipment', () => ({ name: `جهاز اختبار ${Date.now()}` })],
  ['ptSessions', () => ({ patientName: 'مريض اختبار', date: '2026-01-01' })],
  ['queueTickets', () => ({ patientName: 'مريض اختبار', department: 'قسم اختبار' })],
];

describe('فحص سلامة الموديولات — حماية من تكرار خطأ indexedColumns', () => {
  test.each(CASES)('POST /api/%s — يُنشئ ويُقرأ سجلاً حقيقياً بدون خطأ SQL', async (moduleName, buildBody) => {
    const createRes = await request(app)
      .post(`/api/${moduleName}`)
      .set('Authorization', `Bearer ${token}`)
      .send(buildBody());

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();

    const getRes = await request(app)
      .get(`/api/${moduleName}/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(createRes.body.id);
  });

  // ── حالة dossiers خاصة: تحتاج retiredId فعلياً موجود، فننشئ سجل متقاعد أولاً ──
  test('POST /api/dossiers — يُنشئ ويُقرأ إضبارة مرتبطة بمتقاعد حقيقي', async () => {
    const retiredRes = await request(app)
      .post('/api/retired')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'متقاعد اختبار', jobTitle: 'وظيفة اختبار' });
    expect(retiredRes.status).toBe(201);

    const dossierRes = await request(app)
      .post('/api/dossiers')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'وثيقة اختبار', retiredId: retiredRes.body.id });
    expect(dossierRes.status).toBe(201);
    expect(dossierRes.body.id).toBeDefined();

    const getRes = await request(app)
      .get(`/api/dossiers/${dossierRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.retiredId).toBe(retiredRes.body.id);
  });

  // ── سلسلة الردهات: حالة إدخال ← وصفة دواء ← تسجيل إعطاء جرعة ─────────────
  // كل مستوى يحتاج معرّف حقيقي من المستوى الذي فوقه (نفس مبدأ dossiers أعلاه)
  test('POST /api/admissions ← medicationOrders ← medicationAdministrations — سلسلة كاملة', async () => {
    const wardRes = await request(app)
      .post('/api/wards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `ردهة سلسلة الاختبار ${Date.now()}` });
    expect(wardRes.status).toBe(201);

    const admissionRes = await request(app)
      .post('/api/admissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientName: 'مريض اختبار الردهة', wardId: wardRes.body.id, status: 'admitted' });
    expect(admissionRes.status).toBe(201);

    const orderRes = await request(app)
      .post('/api/medicationOrders')
      .set('Authorization', `Bearer ${token}`)
      .send({ admissionId: admissionRes.body.id, drugName: 'دواء اختبار', timesPerDay: 2 });
    expect(orderRes.status).toBe(201);

    const adminRes = await request(app)
      .post('/api/medicationAdministrations')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: orderRes.body.id, administeredBy: 'ممرض اختبار', administeredAt: new Date().toISOString() });
    expect(adminRes.status).toBe(201);

    const getRes = await request(app)
      .get(`/api/medicationAdministrations/${adminRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.orderId).toBe(orderRes.body.id);
  });

  // ── سلة المحذوفات: دورة كاملة (حذف → ظهور بالسلة → استرجاع) ──────────────
  // هذا يغطي تحديداً خطأ ROLLBACK الحرج الذي أصلحناه سابقاً (كان يستطيع إسقاط
  // السيرفر بالكامل لو فشل بنفسه) — أي رجوع لنفس المشكلة يفشل هذا الاختبار
  // فوراً بدل ما يكتشفه مستخدم حقيقي بانقطاع كامل بالخدمة.
  test('DELETE ثم POST /api/recycle-bin/:id/restore — دورة الحذف والاسترجاع كاملة', async () => {
    const createRes = await request(app)
      .post('/api/wards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `ردهة سلة المحذوفات ${Date.now()}` });
    expect(createRes.status).toBe(201);
    const originalId = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/wards/${originalId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    // أتأكد فعلاً انحذف من الجدول الأصلي (غير موجود بعد الآن)
    const getAfterDelete = await request(app)
      .get(`/api/wards/${originalId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getAfterDelete.status).toBe(404);

    // اتأكد طلع بسلة المحذوفات
    const binRes = await request(app)
      .get('/api/recycle-bin')
      .set('Authorization', `Bearer ${token}`);
    expect(binRes.status).toBe(200);
    const binItem = binRes.body.find(r => r.moduleKey === 'wards' && r.originalId === originalId);
    expect(binItem).toBeDefined();

    // استرجاع
    const restoreRes = await request(app)
      .post(`/api/recycle-bin/${binItem.id}/restore`)
      .set('Authorization', `Bearer ${token}`);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.success).toBe(true);

    // اتأكد رجع فعلياً لجدوله الأصلي
    const getAfterRestore = await request(app)
      .get(`/api/wards/${restoreRes.body.record.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getAfterRestore.status).toBe(200);
  });
});

// backend/tests/aiProviderSettingsRoutes.test.js
//
// اختبار تكاملي لمسار إعدادات مزوّد الذكاء الاصطناعي — عبر HTTP على قاعدة
// PostgreSQL حقيقية (جدول system_settings، الموجود أصلاً منذ postgres_schema
// .sql — لا يحتاج ترحيل جديد). راجع أيضاً tests/aiProviderRouter.test.js
// لاختبار منطق التوزيع نفسه بمعزل عن قاعدة بيانات حقيقية.
//
// ── ملاحظة عزل مهمة: system_settings صف مشترك عالمياً (لا مُعزَّل لكل ملف
// اختبار كباقي الجداول عبر setupTestEnv) — تأكّدنا فعلياً: تشغيل هذا الملف
// مرة واحدة يكتب فعلياً بصف ai_provider_settings الحقيقي بقاعدة الاختبار،
// ولو بقي بلا تنظيف، يُفسد افتراض "الإعداد الافتراضي = online" باختبارات
// لاحقة بهذا الملف نفسه (تشغيل ثانٍ) أو حتى بملفات أخرى تماماً (drugInteractions
// .test.js — يعتمد على available:false بدون مفاتيح API، لكن لو تسرّب هنا
// mode:'bot' فيصير available:true دائماً، فيفشل ذاك الاختبار رغم عدم لمسه
// إطلاقاً). الحل: تنظيف الصف صراحة قبل وبعد كل تشغيل لهذا الملف.
//
// ── إصلاح حرج: لا نستورد pool بأعلى الملف إطلاقاً ────────────────────────────
// كان مستورَداً هنا مباشرة (const { pool } = require('../config/database'))،
// أي قبل استدعاء setupTestEnv() بالأسفل فعلياً — فيُبنى الـ Pool بقيمة
// PG_DATABASE الأصلية بملف .env (قاعدة التطوير الحقيقية!) بدل قاعدة الاختبار
// المعزولة. النتيجة الفعلية المؤكَّدة (في نسخة أخرى من هذا المشروع، ثم
// تأكَّدت هنا بالفحص): كل طلب بهذا الملف (بما فيها تسجيل الدخول عبر app
// نفسه) كان يضرب قاعدة التطوير الحقيقية مباشرة، وcloseDbPool (الذي يُنظّف
// جدول users بعد كل ملف اختبار) كان سيحذف كل مستخدمي قاعدة التطوير الحقيقية
// فعلياً. نفس نمط الحذر المطلوب بكل ملفات الاختبار الأخرى.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, closeDbPool } = require('./testUtils');

const SETTINGS_KEY = 'ai_provider_settings';
let pool;
async function resetSettingsRow() {
  await pool.query('DELETE FROM system_settings WHERE key=$1', [SETTINGS_KEY]);
}

let dbPath;
let app;
let adminToken;
let nurseToken;
let localHospitalAdminToken; // إدمن محلي لمستشفى واحد — يجب أن يُرفض من تغيير إعداد يؤثر على كل المستشفيات

beforeAll(async () => {
  dbPath = await setupTestEnv('ai-provider-settings');
  ({ pool } = require('../config/database')); // بعد ضبط PG_DATABASE مباشرة — راجع الشرح أعلاه
  app = require('../server');
  await resetSettingsRow();
  const adminLogin = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  adminToken = adminLogin.body.token;
  const nurseLogin = await request(app).post('/api/auth/login').send({ username: 'testnurse', password: 'testpass123' });
  nurseToken = nurseLogin.body.token;

  // مستشفى تجريبي واحد، وإدمن محلي مرتبط به تحديداً — لاختبار الإصلاح الأمني
  // أدناه (كان إدمن مستشفى واحد محلي يستطيع تغيير إعداد يؤثر على كل
  // المستشفيات الأخرى بنفس النظام).
  const hospital = await request(app).post('/api/hospitals').set('Authorization', `Bearer ${adminToken}`)
    .send({ nameAr: 'مستشفى اختبار إعدادات الذكاء الاصطناعي', nameEn: 'AI Settings Test Hospital' });
  const hospitalId = hospital.body.id;
  const localAdminUsername = `local_hosp_admin_${Date.now()}`;
  await request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'إدمن مستشفى محلي', username: localAdminUsername, password: 'testpass123', role: 'admin', hospitalId });
  const localAdminLogin = await request(app).post('/api/auth/login').send({ username: localAdminUsername, password: 'testpass123' });
  localHospitalAdminToken = localAdminLogin.body.token;
});

afterAll(async () => {
  await resetSettingsRow();
  cleanupTestEnv(dbPath);
  await closeDbPool();
});

describe('GET /api/ai-provider-settings', () => {
  test('أي مستخدم مسجّل دخول (حتى غير إدمن) يستطيع قراءة الإعداد الحالي', async () => {
    const res = await request(app).get('/api/ai-provider-settings').set('Authorization', `Bearer ${nurseToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ invoiceReader: 'online', drugInteractions: 'online', prescriptionReader: 'online', aiDiagnosis: 'online', dosageValidation: 'online', allergyCheck: 'online', billingAnomaly: 'online', inventoryPrediction: 'online' });
  });

  test('بدون توكن دخول: يُرفض بـ401', async () => {
    const res = await request(app).get('/api/ai-provider-settings');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/ai-provider-settings', () => {
  test('إدمن يستطيع تحديث اختيار ميزة واحدة، والباقي يبقى كما كان', async () => {
    const res = await request(app)
      .put('/api/ai-provider-settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ drugInteractions: 'bot' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ invoiceReader: 'online', drugInteractions: 'bot', prescriptionReader: 'online', aiDiagnosis: 'online', dosageValidation: 'online', allergyCheck: 'online', billingAnomaly: 'online', inventoryPrediction: 'online' });

    // يتأكد إن القراءة اللاحقة (GET) ترجع نفس القيمة المحفوظة فعلياً
    const getRes = await request(app).get('/api/ai-provider-settings').set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.body.drugInteractions).toBe('bot');
  });

  test('مستخدم غير إدمن: يُرفض بـ403', async () => {
    const res = await request(app)
      .put('/api/ai-provider-settings')
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ invoiceReader: 'offline' });
    expect(res.status).toBe(403);
  });

  test('قيمة غير صالحة: تُتجاهَل بأمان بلا خطأ 500، الإعداد يبقى بلا تغيير', async () => {
    const res = await request(app)
      .put('/api/ai-provider-settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ prescriptionReader: 'not-a-real-mode' });
    expect(res.status).toBe(200);
    expect(res.body.prescriptionReader).toBe('online'); // بقي على افتراضيته، لم يتحول لقيمة فاسدة
  });

  test('بدون توكن دخول: يُرفض بـ401', async () => {
    const res = await request(app).put('/api/ai-provider-settings').send({ invoiceReader: 'bot' });
    expect(res.status).toBe(401);
  });

  // ── إصلاح أمني: راجع تعليق requireGlobalAdmin بأعلى الملف والراوت نفسه ──
  test('إدمن مستشفى واحد محلي يُرفض بـ403 (لا يستطيع التأثير على مستشفيات أخرى)', async () => {
    const res = await request(app)
      .put('/api/ai-provider-settings')
      .set('Authorization', `Bearer ${localHospitalAdminToken}`)
      .send({ invoiceReader: 'offline' });
    expect(res.status).toBe(403);
  });
});

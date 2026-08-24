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
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, closeDbPool } = require('./testUtils');
const { pool } = require('../config/database');

const SETTINGS_KEY = 'ai_provider_settings';
async function resetSettingsRow() {
  await pool.query('DELETE FROM system_settings WHERE key=$1', [SETTINGS_KEY]);
}

let dbPath;
let app;
let adminToken;
let nurseToken;

beforeAll(async () => {
  dbPath = setupTestEnv('ai-provider-settings');
  app = require('../server');
  await resetSettingsRow();
  const adminLogin = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  adminToken = adminLogin.body.token;
  const nurseLogin = await request(app).post('/api/auth/login').send({ username: 'testnurse', password: 'testpass123' });
  nurseToken = nurseLogin.body.token;
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
});

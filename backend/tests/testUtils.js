// backend/tests/testUtils.js
//
// أداة مساعدة مشتركة لكل ملفات الاختبار. الهدف الأهم هنا: عزل بيانات الاختبار
// تماماً عن قاعدة البيانات الحقيقية (backend/data/db.json) — كل ملف اختبار
// يحصل على ملف قاعدة بيانات مؤقت خاص به (بمجلد نظام التشغيل المؤقت)، يُنشأ قبل
// الاختبارات ويُحذف بعدها، حتى لا يتأثر أي شيء بجهازك الفعلي أو بياناتك الحقيقية.
//
// ملاحظة مهمة: يجب ضبط متغيرات البيئة (DB_PATH و JWT_SECRET) *قبل* استدعاء
// require('../server') في كل ملف اختبار، لأن server.js يقرأ هذه القيم مرة
// واحدة عند التحميل الأول للملف (كونها ثوابت const بأعلى الملف).
const fs = require('fs');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

function setupTestEnv(testFileName) {
  const dbPath = path.join(os.tmpdir(), `sihatuna-test-db-${testFileName}-${Date.now()}.json`);
  process.env.DB_PATH = dbPath;
  // نفس مبدأ عزل db.json ينطبق على قائمة إبطال التوكنات (tokenRevocation.js) —
  // بدون هذا، اختبارات تسجيل الخروج كانت تكتب على نفس ملف الإبطال الحقيقي
  // بجهاز التطوير (backend/data/revoked-tokens.json).
  process.env.REVOKED_TOKENS_PATH = path.join(os.tmpdir(), `sihatuna-test-revoked-${testFileName}-${Date.now()}.json`);
  // نفس مبدأ العزل ينطبق على سجل التدقيق — بدونه، كل اختبار كان يكتب فعلياً
  // على سجل التدقيق الحقيقي بجهاز التطوير (backend/data/audit-log.json).
  process.env.AUDIT_LOG_PATH = path.join(os.tmpdir(), `sihatuna-test-audit-${testFileName}-${Date.now()}.json`);
  process.env.JWT_SECRET = 'test-secret-not-for-production-use-only-in-jest';
  process.env.NODE_ENV = 'test';

  // مستخدم إدمن جاهز بكلمة مرور مشفّرة، لاستخدامه بتسجيل الدخول ضمن الاختبارات
  // + مستخدم ثانٍ محدود الصلاحيات (دور ممرضة) لاختبار فرض الصلاحيات (RBAC) فعلياً —
  // لا يملك صلاحية "inventory" ولا "accounts"، فقط "patients" و"appointments"
  const seedData = {
    users: [
      { id: 1, username: 'testadmin', email: 'testadmin@sihatuna.iq', password: bcrypt.hashSync('testpass123', 10), role: 'admin', name: 'Test Admin' },
      { id: 2, username: 'testnurse', email: 'testnurse@sihatuna.iq', password: bcrypt.hashSync('testpass123', 10), role: 'nurse', name: 'Test Nurse', permissions: ['dashboard', 'patients', 'appointments'] },
    ],
    patients: [],
    doctors: [],
    invoices: [],
  };
  fs.writeFileSync(dbPath, JSON.stringify(seedData, null, 2), 'utf8');

  return dbPath;
}

function cleanupTestEnv(dbPath) {
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch { /* لا بأس لو فشل الحذف، الملف بمجلد مؤقت أصلاً وسيُنظَّف من النظام لاحقاً */ }
}

// ── إصلاح: كانت 14 من أصل 25 ملف اختبار تتحقق من الاتصال بـ PostgreSQL بطلب
// تجريبي (probe)، ولو فشل — تكتفي بتحذير بالكونسول (console.warn) وتضبط
// pgAvailable=false، وكل اختبار بالملف يفحص هذا العلم ويعمل `return` مبكراً
// بصمت. المشكلة: بالنسبة لـ Jest، دالة اختبار تنتهي بـ return بدون خطأ =
// اختبار ناجح ✅ — تماماً بنفس شكل الاختبار اللي فعلاً تحقق من شي. فتشوفين
// "153 اختبار ناجح" بينما نص الاختبارات فعلياً ما اختبرت شي إطلاقاً لو
// PostgreSQL غير متصل وقت التشغيل. هذا بالضبط سبب عدم اكتشاف خطأ
// "column does not exist" (بـ 15 موديول) رغم وجود اختبار استيراد للمشاريع.
// الآن: عدم توفر PostgreSQL يوقف الملف كامل بخطأ صريح وواضح — يفشل الاختبار
// فشلاً حقيقياً (أحمر) بدل نجاح كاذب (أخضر)، ورسالة الخطأ توضح بالضبط السبب
// والحل.
function assertPgAvailable(probeResponse, label, expectedStatus = 200) {
  if (probeResponse.status !== expectedStatus) {
    throw new Error(
      `❌ تعذّر الاتصال بـ PostgreSQL أثناء اختبار "${label}" (الطلب التجريبي رجع ${probeResponse.status} بدل ${expectedStatus}).\n` +
      `   هذا الملف يحتاج PostgreSQL شغّالاً فعلياً ومهيّأً بشكل صحيح (.env) ليعمل — ما نتجاوزه بصمت.\n` +
      `   تأكدي من: 1) PostgreSQL شغّال، 2) PG_HOST/PG_USER/PG_PASSWORD/PG_DATABASE صحيحة بملف backend/.env، ` +
      `3) شغّلتِ database/postgres_schema.sql على القاعدة.`
    );
  }
}

// إغلاق اتصال PostgreSQL بعد انتهاء اختبارات كل ملف — ضروري فقط لبيئة
// الاختبارات (Jest)، ولا علاقة له بإغلاق أي اتصال بالتطبيق الحقيقي المنشور
// فعلياً. بدون هذا، Jest ينتظر إلى الأبد لأن الاتصال يبقى مفتوحاً بالذاكرة
// (تحذير "Jest did not exit one second after the test run has completed").
async function closeDbPool() {
  await pool.end();
}

module.exports = { setupTestEnv, cleanupTestEnv, assertPgAvailable, closeDbPool };

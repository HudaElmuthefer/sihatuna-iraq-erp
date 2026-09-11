// backend/tests/testUtils.js
//
// أداة مساعدة مشتركة لكل ملفات الاختبار. الهدف الأهم هنا: عزل بيانات الاختبار
// تماماً عن قاعدة البيانات الحقيقية — كل ملف اختبار يعمل على قاعدة PostgreSQL
// معزولة تماماً (PG_DATABASE مختلف)، ومستخدمو الاختبار (testadmin/testnurse)
// يُزرعان بجدول users الحقيقي بتلك القاعدة المعزولة قبل كل ملف، ويُنظَّفان
// بعده (راجع closeDbPool أدناه) — لا علاقة لهذا الملف بأي JSON بعد الآن
// (كان يستخدم db.json سابقاً، قبل ترحيل موديول المستخدمين لـPostgreSQL،
// راجع migrations-sql/016_users_real_columns.sql وscripts/
// migrateUsersFromJson.js لتفاصيل ذلك الترحيل).
//
// ملاحظة مهمة: يجب ضبط متغيرات البيئة (JWT_SECRET وPG_DATABASE) *قبل*
// استدعاء require('../server') في كل ملف اختبار، لأن server.js/config/
// database.js يقرآن هذه القيم مرة واحدة عند التحميل الأول للملف.
const fs = require('fs');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');
// ── إصلاح عزل PostgreSQL (كان أخطر ثغرة عزل بهذا الملف) ──────────────────────
// db.json/JWT/سجل التدقيق كانت الوحيدة المعزولة فعلياً — عمود PostgreSQL نفسه
// (الجداول السريرية/الإدارية/المالية الحقيقية بقاعدة sihatuna_iraq) لم يكن
// معزولاً إطلاقاً، فكل اختبار يكتب فعلياً على قاعدة التطوير الحقيقية بلا أي
// تنظيف بمعظم الملفات — تراكم بيانات وهمية دائم (مؤكَّد: 10+ صف بجدول assets
// وحده، بتواريخ تمتد لأيام، فضلاً عن جداول أخرى كثيرة).
// السبب الجذري: كان هذا الملف نفسه يستورد config/database.js (فيبني Pool)
// بأعلى الملف — أي قبل استدعاء setupTestEnv() بأي ملف اختبار فعلياً، فتضبيط
// PG_DATABASE هنا لن ينفع لأن الـ Pool يكون قد بُني مسبقاً بقاعدة .env
// الحقيقية. الحل: لا نستورد config/database.js هنا نهائياً بأعلى الملف — فقط
// عند الحاجة الفعلية بـ closeDbPool()، بعد أن يكون كل ملف اختبار قد استدعى
// setupTestEnv() (يضبط PG_DATABASE لقاعدة اختبار معزولة) ثم require('../server')
// لاحقاً — عندها فقط يُبنى الـ Pool لأول مرة بهذا السجل (Jest module registry
// الخاص بكل ملف اختبار على حدة)، فيلتقط القيمة الصحيحة المُعاد ضبطها.

async function setupTestEnv(testFileName) {
  // عزل PostgreSQL: قاعدة اختبار منفصلة تماماً (sihatuna_iraq_test)، بنفس
  // مخطط قاعدة التطوير الحقيقية — أي بيانات وهمية تُنشَأ هنا لا تلمس قاعدة
  // التطوير الحقيقية إطلاقاً بعد الآن.
  process.env.PG_DATABASE = process.env.TEST_PG_DATABASE || 'sihatuna_iraq_test';
  // ── عزل Redis (المرحلة الثانية) ──────────────────────────────────────────
  // نفس المشكلة بالضبط التي حلّها PG_DATABASE أعلاه: بدون هذا، كل ملف اختبار
  // لا يُموِّه ioredis صراحة (jest.mock('ioredis', ...) — فقط auth/cache/
  // tokenRevocation/redisRateLimitStore.test.js تفعل هذا) يتصل بنفس Redis
  // الحقيقي المُعدّ بملف .env (قاعدة 0 الافتراضية)، فيكتب مفاتيح تحديد معدل
  // وكاش وإبطال توكنات وهمية فعلياً فوق نفس القاعدة التي يستخدمها الخادم
  // الحقيقي وقت التطوير — مؤكَّد عملياً: تشغيل الاختبارات بينما الخادم
  // الحقيقي يعمل (بعد تنصيب Memurai) شوّش على اختبار يدوي لتحديد المعدل
  // (مفاتيح rl:* حقيقية ظهرت بقاعدة Redis أثناء اختبار سموك يدوي منفصل).
  // الحل الأبسط هنا (بعكس PostgreSQL): Redis يدعم عدة "قواعد منطقية" (logical
  // databases) بنفس الخادم الواحد دون أي تثبيت إضافي — قاعدة رقم 1 (بدل 0
  // الافتراضية) بنفس مثيل Memurai/Redis الحقيقي، معزولة تماماً عن مفاتيح
  // قاعدة 0 (SELECT منفصل تماماً بـRedis، لا تداخل إطلاقاً). لا حاجة لتفريغها
  // يدوياً بين التشغيلات — كل مفتاح فيها له TTL أصلاً (تحديد المعدل، الكاش،
  // إبطال التوكنات)، فتُنظَّف تلقائياً بمرور الوقت مثل بيئة الإنتاج الحقيقية.
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379/1';
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
  // لا يملك صلاحية "inventory" ولا "accounts"، فقط "patients" و"appointments".
  // يُزرعان الآن بجدول users الحقيقي بقاعدة الاختبار المعزولة (لا db.json بعد
  // الآن) — UPSERT (ON CONFLICT) بدل INSERT بسيط، حتى يبقى آمناً للتكرار حتى
  // لو لم تُنظَّف بيانات تشغيل سابق فشل قبل اكتمال afterAll (راجع closeDbPool
  // أدناه، حيث يحصل التنظيف الفعلي).
  // يُستورَد config/database هنا فقط (وليس بأعلى الملف) — لنفس السبب المشروح
  // بالتعليق الكبير أعلى الملف بخصوص PG_DATABASE.
  const { pool } = require('../config/database');
  const hashed = bcrypt.hashSync('testpass123', 10);
  await pool.query(
    `INSERT INTO users (full_name, username, email, password, role, permissions, is_active)
     VALUES ('Test Admin', 'testadmin', 'testadmin@sihatuna.iq', $1, 'admin', '[]'::jsonb, true)
     ON CONFLICT (username) WHERE username IS NOT NULL DO UPDATE
       SET password = EXCLUDED.password, role = EXCLUDED.role, permissions = EXCLUDED.permissions, is_active = true`,
    [hashed]
  );
  await pool.query(
    `INSERT INTO users (full_name, username, email, password, role, permissions, is_active)
     VALUES ('Test Nurse', 'testnurse', 'testnurse@sihatuna.iq', $1, 'nurse', $2::jsonb, true)
     ON CONFLICT (username) WHERE username IS NOT NULL DO UPDATE
       SET password = EXCLUDED.password, role = EXCLUDED.role, permissions = EXCLUDED.permissions, is_active = true`,
    [hashed, JSON.stringify(['dashboard', 'patients', 'appointments'])]
  );

  // القيمة المُعادة لم يعد لها أي معنى فعلي (كانت مسار db.json مؤقتاً) —
  // تبقى فقط توافقاً مع نمط الاستدعاء القديم بكل ملفات الاختبار
  // (dbPath = await setupTestEnv(...); ... cleanupTestEnv(dbPath);).
  return null;
}

function cleanupTestEnv(dbPath) {
  if (!dbPath) return; // لم يعد يُستخدَم db.json بعد الآن — راجع closeDbPool للتنظيف الفعلي بجدول users
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch { /* لا بأس لو فشل الحذف، الملف بمجلد مؤقت أصلاً وسيُنظَّف من النظام لاحقاً */ }
}

// ── إصلاح: كانت 14 من أصل 25 ملف اختبار تتحقق من الاتصال بـ PostgreSQL بطلب
// تجريبي (probe)، ولو فشل — تكتفي بتحذير بالكونسول (console.warn) وتضبط
// pgAvailable=false، وكل اختبار بالملف يفحص هذا العلم ويعمل `return` مبكراً
// بصمت. المشكلة: بالنسبة لـ Jest، دالة اختبار تنتهي بـ return بدون خطأ =
// اختبار ناجح ✅ — تماماً بنفس شكل الاختبار الذي فعلاً تحقق من شيء. فترى
// "153 اختبار ناجح" بينما نصف الاختبارات فعلياً لم تختبر شيئاً إطلاقاً لو
// كان PostgreSQL غير متصل وقت التشغيل. هذا بالضبط سبب عدم اكتشاف خطأ
// "column does not exist" (بـ 15 موديول) رغم وجود اختبار استيراد للمشاريع.
// الآن: عدم توفر PostgreSQL يوقف الملف كامل بخطأ صريح وواضح — يفشل الاختبار
// فشلاً حقيقياً (أحمر) بدل نجاح كاذب (أخضر)، ورسالة الخطأ توضح بالضبط السبب
// والحل.
function assertPgAvailable(probeResponse, label, expectedStatus = 200) {
  if (probeResponse.status !== expectedStatus) {
    throw new Error(
      `❌ تعذّر الاتصال بـ PostgreSQL أثناء اختبار "${label}" (الطلب التجريبي أعاد ${probeResponse.status} بدل ${expectedStatus}).\n` +
      `   هذا الملف يحتاج أن يكون PostgreSQL فعّالاً فعلياً ومهيّأً بشكل صحيح (.env) ليعمل — لا نتجاوزه بصمت.\n` +
      `   تأكد من: 1) أن PostgreSQL يعمل، 2) PG_HOST/PG_USER/PG_PASSWORD/PG_DATABASE صحيحة بملف backend/.env، ` +
      `3) أنك شغّلت database/postgres_schema.sql على القاعدة.`
    );
  }
}

// إغلاق اتصال PostgreSQL (و Redis، منذ المرحلة الثانية) بعد انتهاء اختبارات
// كل ملف — ضروري فقط لبيئة الاختبارات (Jest)، ولا علاقة له بإغلاق أي اتصال
// بالتطبيق الحقيقي المنشور فعلياً. بدون هذا، Jest ينتظر إلى الأبد لأن
// الاتصال يبقى مفتوحاً بالذاكرة (تحذير "Jest did not exit one second after
// the test run has completed") — ومع Redis تحديداً، عميل ioredis غير
// مُغلَق يستمر بمحاولة إعادة الاتصال بالخلفية (retryStrategy) طوال بقية
// تشغيل الاختبارات (كل ملفات هذا المشروع تعمل بعملية Jest واحدة عبر
// --runInBand)، وهذا التراكم عبر عشرات ملفات الاختبار كان السبب الفعلي
// وراء تجاوز مهلة beforeAll (5 ثوانٍ) بملفات تعمل لاحقاً بترتيب التشغيل.
async function closeDbPool() {
  // يُستورَدان هنا فقط (ليس بأعلى الملف) — راجع التعليق الكبير بأعلى الملف
  // لسبب هذا الترتيب المتعمَّد بالتحديد (خاص بـPostgreSQL؛ Redis لا يحتاجه
  // فعلياً لكن نُبقيه هنا لنفس السبب: يُغلَق فقط لو استُخدم أصلاً بالملف).
  const { pool } = require('../config/database');
  const { closeClient } = require('../utils/redisService');
  // تنظيف مستخدمي الاختبار (testadmin/testnurse، وأي مستخدم آخر أُنشئ أثناء
  // هذا الملف عبر POST /users الحقيقي) قبل إغلاق الاتصال — قاعدة الاختبار
  // معزولة تماماً عن قاعدة التطوير الحقيقية (PG_DATABASE مختلف)، فحذف كل
  // صفوف users هنا آمن دائماً، ويمنع تراكمها أو تعارض اسم مستخدم بين
  // تشغيلات ملفات اختبار متتالية. يُلتقَط الخطأ بصمت (بدل رميه) لأن بعض
  // ملفات الاختبار (لا تحتاج PostgreSQL إطلاقاً) تستدعي closeDbPool بعد
  // اتصال لم يُفتَح فعلياً أصلاً.
  try { await pool.query('DELETE FROM users'); } catch { /* لا بأس، راجع الشرح أعلاه */ }
  await Promise.all([pool.end(), closeClient()]);
}

module.exports = { setupTestEnv, cleanupTestEnv, assertPgAvailable, closeDbPool };

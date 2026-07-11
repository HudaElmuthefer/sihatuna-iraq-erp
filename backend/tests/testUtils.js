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

function setupTestEnv(testFileName) {
  const dbPath = path.join(os.tmpdir(), `sihatuna-test-db-${testFileName}-${Date.now()}.json`);
  process.env.DB_PATH = dbPath;
  process.env.JWT_SECRET = 'test-secret-not-for-production-use-only-in-jest';
  process.env.NODE_ENV = 'test';

  // مستخدم إدمن جاهز بكلمة مرور مشفّرة، لاستخدامه بتسجيل الدخول ضمن الاختبارات
  const seedData = {
    users: [
      { id: 1, username: 'testadmin', email: 'testadmin@sihatuna.iq', password: bcrypt.hashSync('testpass123', 10), role: 'admin', name: 'Test Admin' },
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

module.exports = { setupTestEnv, cleanupTestEnv };

// backend/utils/db.js
//
// دوال قراءة/كتابة ملف db.json — لا تزال مستخدَمة لموديولات لم تنتقل بعد
// لـ PostgreSQL بالكامل (تسجيل الدخول، المستخدمين، سجل التدقيق). استُخرجت من
// server.js لتصغيره وتسهيل إعادة استخدامها بملفات مسارات منفصلة (routes/*)
// بدون تكرار نفس الكود بأكثر من مكان.
//
// DB_PATH قابل للتخصيص عبر متغير بيئة (يُستخدم بالاختبارات الآلية لعزل قاعدة
// بيانات الاختبار عن بيانات التطوير الحقيقية — انظر tests/testUtils.js).
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'db.json');

const readDB = () => {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const writeDB = (data) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
};

const nextId = (arr) => arr.length > 0 ? Math.max(...arr.map(i => i.id)) + 1 : 1;

module.exports = { readDB, writeDB, nextId, DB_PATH };

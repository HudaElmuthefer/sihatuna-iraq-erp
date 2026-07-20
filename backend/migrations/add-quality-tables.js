// backend/migrations/add-quality-tables.js
//
// يضيف جداول إدارة الجودة الثلاثة (quality_audits, quality_ncs, quality_kpis)
// لقاعدة بياناتج الحالية — آمن تماماً للتشغيل على قاعدة بيانات فيها بيانات
// حقيقية بالفعل: يستخدم "CREATE TABLE IF NOT EXISTS" فقط، ما يلمس أي جدول
// أو بيانات موجودة مسبقاً إطلاقاً.
//
// التشغيل (مرة واحدة بس):
//   cd backend
//   node migrations/add-quality-tables.js
require('dotenv').config();
const { pool } = require('../config/database');
const { devLog } = require('../utils/logger');

const SQL = `
CREATE TABLE IF NOT EXISTS quality_audits (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quality_ncs (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quality_kpis (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
`;

(async () => {
  try {
    await pool.query(SQL);
    devLog('✅ تم إنشاء جداول إدارة الجودة بنجاح (quality_audits, quality_ncs, quality_kpis).');
    devLog('   لو كانت موجودة مسبقاً، ما صار أي تغيير عليها (CREATE TABLE IF NOT EXISTS).');
  } catch (err) {
    console.error('❌ فشل إنشاء الجداول:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

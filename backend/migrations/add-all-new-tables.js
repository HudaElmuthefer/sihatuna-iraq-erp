// backend/migrations/add-all-new-tables.js
//
// سكربت ترحيل موحّد — يضيف كل الجداول الخمسة الجديدة دفعة وحدة (بدل تشغيل
// add-quality-tables.js وadd-maintenance-log-tables.js كل وحد لحاله).
// آمن تماماً للتشغيل على قاعدة بيانات فيها بيانات حقيقية بالفعل: يستخدم
// "CREATE TABLE IF NOT EXISTS" فقط لكل جدول — ما يلمس أي جدول أو بيانات
// موجودة مسبقاً إطلاقاً، وآمن للتشغيل أكثر من مرة بلا أي ضرر.
//
// الجداول التي يضيفها:
//   1. quality_audits            — مراجعات الجودة (آيزو)
//   2. quality_ncs                — حالات عدم المطابقة
//   3. quality_kpis                — مؤشرات الأداء
//   4. asset_maintenance_log       — سجل صيانة الأصول
//   5. ambulance_maintenance_log   — سجل صيانة مركبات الإسعاف
//
// التشغيل (مرة واحدة بس):
//   cd backend
//   node migrations/add-all-new-tables.js
require('dotenv').config();
const { pool } = require('../config/database');
const { devLog } = require('../utils/logger');

const SQL = `
-- 1) مراجعات الجودة (آيزو)
CREATE TABLE IF NOT EXISTS quality_audits (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2) حالات عدم المطابقة
CREATE TABLE IF NOT EXISTS quality_ncs (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 3) مؤشرات الأداء (KPIs)
CREATE TABLE IF NOT EXISTS quality_kpis (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 4) سجل صيانة الأصول
CREATE TABLE IF NOT EXISTS asset_maintenance_log (
    id              SERIAL PRIMARY KEY,
    asset_id        INTEGER,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_log_asset_id ON asset_maintenance_log(asset_id);

-- 5) سجل صيانة مركبات الإسعاف
CREATE TABLE IF NOT EXISTS ambulance_maintenance_log (
    id              SERIAL PRIMARY KEY,
    vehicle_id      INTEGER,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ambulance_maintenance_log_vehicle_id ON ambulance_maintenance_log(vehicle_id);
`;

const TABLE_NAMES = [
  'quality_audits',
  'quality_ncs',
  'quality_kpis',
  'asset_maintenance_log',
  'ambulance_maintenance_log',
];

(async () => {
  try {
    await pool.query(SQL);
    devLog('✅ تم إنشاء كل الجداول الجديدة بنجاح:');
    TABLE_NAMES.forEach(t => devLog(`   - ${t}`));
    devLog('   لو كانت موجودة مسبقاً، ما صار أي تغيير عليها (CREATE TABLE IF NOT EXISTS).');
  } catch (err) {
    console.error('❌ فشل إنشاء الجداول:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

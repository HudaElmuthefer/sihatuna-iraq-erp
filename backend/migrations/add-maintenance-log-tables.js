// backend/migrations/add-maintenance-log-tables.js
//
// يضيف جداول سجل الصيانة (asset_maintenance_log, ambulance_maintenance_log)
// لقاعدة بياناتج الحالية — آمن تماماً للتشغيل على قاعدة بيانات فيها بيانات
// حقيقية بالفعل: يستخدم "CREATE TABLE IF NOT EXISTS" فقط، ما يلمس أي جدول
// أو بيانات موجودة مسبقاً إطلاقاً.
//
// التشغيل (مرة واحدة بس):
//   cd backend
//   node migrations/add-maintenance-log-tables.js
require('dotenv').config();
const { pool } = require('../config/database');
const { devLog } = require('../utils/logger');

const SQL = `
CREATE TABLE IF NOT EXISTS asset_maintenance_log (
    id              SERIAL PRIMARY KEY,
    asset_id        INTEGER,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_log_asset_id ON asset_maintenance_log(asset_id);

CREATE TABLE IF NOT EXISTS ambulance_maintenance_log (
    id              SERIAL PRIMARY KEY,
    vehicle_id      INTEGER,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ambulance_maintenance_log_vehicle_id ON ambulance_maintenance_log(vehicle_id);
`;

(async () => {
  try {
    await pool.query(SQL);
    devLog('✅ تم إنشاء جداول سجل الصيانة بنجاح (asset_maintenance_log, ambulance_maintenance_log).');
    devLog('   لو كانت موجودة مسبقاً، ما صار أي تغيير عليها (CREATE TABLE IF NOT EXISTS).');
  } catch (err) {
    console.error('❌ فشل إنشاء الجداول:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

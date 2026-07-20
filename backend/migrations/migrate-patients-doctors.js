// backend/migrations/migrate-patients-doctors.js
//
// ينقل بيانات المرضى والأطباء والمواعيد والفواتير والموظفين والمتقاعدين الحالية من backend/data/db.json
// إلى الجداول المقابلة بـ PostgreSQL، مع الحفاظ على نفس المعرّفات (id) الحالية
// تماماً كما هي بالواجهة — حتى لا تنكسر أي إشارة قديمة لها.
//
// طريقة التشغيل (من داخل مجلد backend/):
//   node migrations/migrate-patients-doctors.js
//
// آمن للتشغيل أكثر من مرة: أي سجل موجود مسبقاً بنفس id يُتجاوز (ON CONFLICT
// DO NOTHING) بدل تكراره.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const { devLog } = require('../utils/logger');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'db.json');

// indexedColumns بنفس صيغة pgCrud.js: { field, column } لدعم اختلاف اسم
// الحقل بالواجهة (camelCase) عن اسم العمود بقاعدة البيانات (snake_case).
// مصفوفة فارغة [] تعني جدولاً بدون أي عمود فهرسة إضافي (تخزين JSONB بحت).
// المعامل الأخير (sqlTableName) اختياري: اسم الجدول الفعلي بقاعدة البيانات إذا
// كان مختلفاً عن اسم الموديول (label) — مطلوب فقط للموديولات camelCase مثل
// "medicalLeaves" التي جدولها الفعلي snake_case ("medical_leaves").
async function migrateTable(label, records, indexedColumns = [], sqlTableName = label) {
  const tableName = sqlTableName;
  if (!Array.isArray(records) || records.length === 0) {
    devLog(`ℹ️  لا توجد سجلات "${label}" بملف db.json — تم تجاوز هذا الجدول.`);
    return;
  }

  let migrated = 0;
  for (const record of records) {
    const { id, ...bodyWithoutId } = record;
    if (!id) {
      console.warn(`⚠️  سجل بلا id بموديول "${label}" — تم تجاوزه:`, record);
      continue;
    }
    const indexedValues = indexedColumns.map(({ field }) => bodyWithoutId[field] ?? null);
    const rest = { ...bodyWithoutId };
    indexedColumns.forEach(({ field }) => delete rest[field]);

    let sql, values;
    if (indexedColumns.length === 0) {
      sql = `INSERT INTO ${tableName} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`;
      values = [id, JSON.stringify(rest)];
    } else {
      const columnsSql = indexedColumns.map(c => c.column).join(', ');
      const placeholders = indexedColumns.map((_, i) => `$${i + 2}`).join(', ');
      const dataPlaceholder = `$${indexedColumns.length + 2}`;
      sql = `INSERT INTO ${tableName} (id, ${columnsSql}, data)
             VALUES ($1, ${placeholders}, ${dataPlaceholder})
             ON CONFLICT (id) DO NOTHING`;
      values = [id, ...indexedValues, JSON.stringify(rest)];
    }

    await pool.query(sql, values);
    migrated++;
  }

  // إعادة ضبط تسلسل المعرّفات التلقائي (SERIAL) حتى تبدأ السجلات الجديدة
  // من بعد أعلى id مُرحَّل، بدل أن تتصادم معه
  await pool.query(
    `SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM ${tableName}), 1))`
  );

  devLog(`✅ [${tableName}] تم ترحيل ${migrated} من أصل ${records.length} سجلاً بنجاح.`);
}

const NAME_PHONE_STATUS = [
  { field: 'name', column: 'name' },
  { field: 'phone', column: 'phone' },
  { field: 'status', column: 'status' },
];

async function run() {
  devLog('🔄 بدء ترحيل بيانات المرضى والأطباء والمواعيد والفواتير والموارد البشرية من db.json إلى PostgreSQL...\n');

  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ ملف قاعدة البيانات غير موجود: ${DB_PATH}`);
    process.exit(1);
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

  try {
    await migrateTable('patients', db.patients, NAME_PHONE_STATUS);
    await migrateTable('doctors', db.doctors, NAME_PHONE_STATUS);
    await migrateTable('appointments', db.appointments, [
      { field: 'patient', column: 'patient' },
      { field: 'doctor', column: 'doctor' },
      { field: 'date', column: 'date' },
      { field: 'status', column: 'status' },
    ]);
    await migrateTable('invoices', db.invoices, [
      { field: 'patientId', column: 'patient_id' },
      { field: 'status', column: 'status' },
      { field: 'total', column: 'total' },
    ]);
    await migrateTable('employees', db.employees, [
      { field: 'name', column: 'name' },
      { field: 'jobTitle', column: 'job_title' },
      { field: 'status', column: 'status' },
    ]);
    await migrateTable('retired', db.retired, [
      { field: 'name', column: 'name' },
      { field: 'jobTitle', column: 'job_title' },
    ]);
    await migrateTable('departments', db.departments);
    await migrateTable('outgoing', db.outgoing);
    await migrateTable('incoming', db.incoming);
    await migrateTable('vaccinations', db.vaccinations);
    await migrateTable('medicalLeaves', db.medicalLeaves, [], 'medical_leaves');
    await migrateTable('dossiers', db.dossiers);
    await migrateTable('labTests', db.labTests, [], 'lab_tests');
    await migrateTable('radiology', db.radiology);
    await migrateTable('pharmacyOrders', db.pharmacyOrders, [], 'pharmacy_orders');
    await migrateTable('assets', db.assets);
    await migrateTable('inventory', db.inventory);
    await migrateTable('procurement', db.procurement);
    await migrateTable('projects', db.projects);
    await migrateTable('documents', db.documents);
    await migrateTable('servicePrices', db.servicePrices, [], 'service_prices');
    await migrateTable('transactions', db.transactions);
    await migrateTable('promotions', db.promotions);
    await migrateTable('allowances', db.allowances);
    await migrateTable('salaries', db.salaries);
    await migrateTable('ambulanceVehicles', db.ambulanceVehicles, [], 'ambulance_vehicles');
    await migrateTable('ambulanceMissions', db.ambulanceMissions, [], 'ambulance_missions');
    await migrateTable('crmInteractions', db.crmInteractions, [
      { field: 'patientId', column: 'patient_id' },
    ], 'crm_interactions');
    await migrateTable('crmSegments', db.crmSegments, [
      { field: 'patientId', column: 'patient_id' },
      { field: 'segmentCode', column: 'segment_code' },
    ], 'crm_patient_segments');
    await migrateTable('crmFollowUps', db.crmFollowUps, [
      { field: 'patientId', column: 'patient_id' },
      { field: 'status', column: 'status' },
    ], 'crm_follow_ups');
    await migrateTable('crmCampaigns', db.crmCampaigns, [
      { field: 'status', column: 'status' },
    ], 'crm_campaigns');
    await migrateTable('crmCampaignTargets', db.crmCampaignTargets, [
      { field: 'campaignId', column: 'campaign_id' },
      { field: 'patientId', column: 'patient_id' },
    ], 'crm_campaign_targets');
    devLog('\n🎉 اكتمل الترحيل بنجاح. يمكنك الآن تشغيل الباك إند طبيعياً.');
  } catch (err) {
    console.error('\n❌ فشل الترحيل:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

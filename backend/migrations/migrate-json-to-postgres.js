// backend/migrations/migrate-json-to-postgres.js
//
// سكربت هجرة مطابق لبنية db.json الفعلية (ملف واحد يحوي كل الجداول):
// { users, patients, doctors, departments, appointments, employees, retired,
//   retiredDossiers, outgoing, incoming, vaccinations, medicalLeaves, dossiers }
//
// طريقة التشغيل (من داخل مجلد backend/):
//   npm install pg dotenv --save   (إذا لم تكن مثبتة)
//   node migrations/migrate-json-to-postgres.js
//
// ⚠️ خذ نسخة احتياطية من backend/data/db.json قبل التشغيل.
// ملاحظة: لا توجد حالياً بيانات فواتير (invoices) بالنظام القديم — هذا طبيعي،
// موديول الفوترة والدفع جديد بالكامل وراح يبدأ فاضي بـ PostgreSQL.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const DB_JSON_PATH = path.join(__dirname, '..', 'data', 'db.json');

function loadOldDb() {
  const raw = fs.readFileSync(DB_JSON_PATH, 'utf8');
  return JSON.parse(raw);
}

async function migrateHospital(client) {
  const existing = await client.query('SELECT id FROM hospitals LIMIT 1');
  if (existing.rowCount > 0) return existing.rows[0].id;
  const result = await client.query(
    `INSERT INTO hospitals (name_ar, name_en) VALUES ($1,$2) RETURNING id`,
    ['مستشفى صحتنا العراق', 'Sihatuna Iraq Hospital'] // عدّل الاسم الفعلي إذا يختلف
  );
  console.log('✅ Default hospital record created');
  return result.rows[0].id;
}

async function migrateUsers(client, hospitalId, oldDb) {
  const users = oldDb.users || [];
  const idMap = {};
  for (const u of users) {
    const result = await client.query(
      `INSERT INTO users (hospital_id, full_name, email, role, is_active)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING RETURNING id`,
      [hospitalId, u.name, u.email || `${u.username}@sihatuna.local`, u.role || 'staff', true]
    );
    if (result.rows[0]) idMap[u.id] = result.rows[0].id;
  }
  console.log(`✅ Migrated ${Object.keys(idMap).length} users`);
  return idMap;
}

async function migratePatients(client, hospitalId, oldDb) {
  const patients = oldDb.patients || [];
  const idMap = {};
  for (const p of patients) {
    const result = await client.query(
      `INSERT INTO patients (hospital_id, full_name, phone, gender, status)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [hospitalId, p.name, p.phone, p.gender, p.status || 'active']
    );
    idMap[p.id] = result.rows[0].id;
  }
  console.log(`✅ Migrated ${Object.keys(idMap).length} patients`);
  return idMap;
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting migration from db.json to PostgreSQL...\n');
    const oldDb = loadOldDb();

    await client.query('BEGIN');

    const hospitalId = await migrateHospital(client);
    await migrateUsers(client, hospitalId, oldDb);
    await migratePatients(client, hospitalId, oldDb);

    // TODO: أضِف هجرة doctors, departments, appointments, employees, retired,
    // outgoing, incoming, vaccinations, medicalLeaves, dossiers بنفس النمط أعلاه
    // (كل موديول يحتاج جدول PostgreSQL مطابق أولاً بـ postgres_schema.sql —
    //  الموجود حالياً يغطي فقط: hospitals, users, patients, invoices + الدفع + CRM)

    await client.query('COMMIT');
    console.log('\n✅ Successfully migrated users and patients!');
    console.log('ℹ️  Remaining modules (doctors, appointments...) need additional SQL tables first — let me know if you want them added.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed, all changes rolled back:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

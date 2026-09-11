// backend/scripts/migrateUsersFromJson.js
//
// ترحيل لمرة واحدة: ينقل كل مستخدمي backend/data/db.json الحقيقيين لجدول
// users بـPostgreSQL (بعد إضافة الأعمدة الناقصة — راجع migrations-sql/
// 016_users_real_columns.sql)، محافظاً على تجزئة كلمة المرور (bcrypt) كما
// هي حرفياً — بلا أي إعادة تشفير أو تصفير لكلمات المرور. آمن التشغيل
// المتكرر: يتخطى أي username موجود مسبقاً بجدول users بدل تكراره.
//
// المستخدم الذي كان يحمل id === 1 بملف db.json (الحساب الجذري الذي أُنشئ
// به النظام أول مرة) يُعلَّم is_primary_admin = true — يحل هذا محل الحماية
// القديمة المُثبَّتة بالكود (فحص id == 1 حرفياً)، التي لم تعد ذات معنى بعد
// التحول لمعرّفات UUID.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const DB_JSON_PATH = path.join(__dirname, '..', 'data', 'db.json');

async function run() {
  if (!fs.existsSync(DB_JSON_PATH)) {
    console.log('لا يوجد backend/data/db.json — لا شيء لترحيله (ربما رُحِّل مسبقاً وأُرشِف الملف).');
    return;
  }

  const raw = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf8'));
  const jsonUsers = Array.isArray(raw.users) ? raw.users : [];
  if (jsonUsers.length === 0) {
    console.log('لا يوجد مستخدمون بملف db.json.');
    return;
  }

  console.log(`🔧 يجري ترحيل ${jsonUsers.length} مستخدم(ين) من db.json إلى جدول users بـPostgreSQL...`);
  let migrated = 0;
  let skipped = 0;

  for (const u of jsonUsers) {
    if (!u.username) {
      console.warn(`   ⚠️  تخطي سجل بلا username (id=${u.id}) — لا يمكن تسجيل الدخول به أصلاً.`);
      skipped++;
      continue;
    }
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [u.username]);
    if (existing.rows.length > 0) {
      console.log(`   - تخطي "${u.username}" (موجود مسبقاً بـPostgreSQL).`);
      skipped++;
      continue;
    }

    await pool.query(
      `INSERT INTO users (
         hospital_id, full_name, username, password, email, role,
         job_title, avatar, color, permissions, dashboard_layout,
         must_change_password, is_active, is_primary_admin
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        u.hospitalId || null,
        u.name || u.username,
        u.username,
        u.password, // تجزئة bcrypt كما هي حرفياً — بلا أي تعديل
        u.email || null,
        u.role || 'staff',
        u.jobTitle || null,
        u.avatar || null,
        u.color || null,
        JSON.stringify(u.permissions || []),
        u.dashboardLayout ? JSON.stringify(u.dashboardLayout) : null,
        !!u.mustChangePassword,
        u.isActive !== false,
        u.id === 1, // الحساب الجذري الأصلي فقط
      ]
    );
    console.log(`   ✅ رُحِّل "${u.username}" (${u.role}).`);
    migrated++;
  }

  console.log(`✅ اكتمل الترحيل: ${migrated} مُرحَّل، ${skipped} مُتخطى.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ فشل ترحيل المستخدمين:', err.message);
    process.exit(1);
  });

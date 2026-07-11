/**
 * SIHATUNA IRAQ - Backend Server
 * م. هدى عبد العظيم عبد الكريم
 * halmuthefer@gmail.com
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { startAutoBackup, listBackups, restoreFromBackup, runBackup } = require('./utils/backup');
const validate = require('./middleware/validate');
const asyncHandler = require('./middleware/asyncHandler');
const rateLimit = require('express-rate-limit');
const { pool } = require('./config/database');
const requireAdmin = require('./middleware/requireAdmin');

// ── تقييد محاولات تسجيل الدخول (Rate Limiting) ─────────────────────────────────
// بدون هذا، مسار /auth/login كان مفتوحاً لعدد غير محدود من المحاولات — عرضة
// لهجمات تخمين كلمة المرور (Brute Force)، خصوصاً على حسابات بأسماء متوقّعة
// مثل admin/admin. نسمح بـ10 محاولات كحد أقصى كل 15 دقيقة لكل عنوان IP، ثم
// نرفض أي محاولة إضافية برسالة واضحة بدل السماح بمحاولات غير محدودة.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 10,
  message: { message: 'محاولات دخول كثيرة جداً، حاول مرة أخرى بعد 15 دقيقة' },
  standardHeaders: true,
  legacyHeaders: false,
});
const collectionSchemas = require('./middleware/schemas');

const app = express();
const PORT = process.env.PORT || 8000;
const DEFAULT_JWT_SECRET = 'sihatuna-secret-2026'; // منشور علناً بالمستودع — لا يصلح كمفتاح فعلي أبداً
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
// DB_PATH قابل للتخصيص عبر متغير بيئة (يُستخدم بالاختبارات الآلية لعزل قاعدة
// بيانات مؤقتة عن ملف db.json الحقيقي — بدون هذا، أي اختبار كان سيقرأ ويكتب
// مباشرة فوق بيانات المستخدم الفعلية، وهذا خطر حقيقي لا يجوز السماح به إطلاقاً).
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// ── تحذير أمان عند بدء التشغيل ────────────────────────────────────────────────
// المفتاح الافتراضي أعلاه مكتوب صراحة بالكود (وبالتالي منشور مع أي نسخة من المشروع
// على GitHub)، فأي شخص يعرفه يقدر يُصدر توكن دخول مزوّر بصلاحية إدمن كاملة.
// لو .env الحقيقي ما يحدّد JWT_SECRET مختلفاً، يجب تنبيه المطوّر بوضوح شديد —
// وبمرحلة الإنتاج، نرفض تشغيل الخادم أصلاً بدل تشغيله بثغرة أمنية معروفة.
if (JWT_SECRET === DEFAULT_JWT_SECRET) {
  console.error('\n╔════════════════════════════════════════════════════════════╗');
  console.error('║  ⚠️  تحذير أمان خطير: JWT_SECRET الافتراضي لا يزال مستخدماً!  ║');
  console.error('╚════════════════════════════════════════════════════════════╝');
  console.error('  هذا المفتاح مكتوب بالكود المصدري وغير سرّي إطلاقاً —');
  console.error('  أي شخص يطّلع عليه يقدر يزوّر تسجيل دخول بصلاحية إدمن كاملة.');
  console.error('  أضف JWT_SECRET بملف backend/.env بقيمة عشوائية قوية، ثم أعد التشغيل.');
  console.error('  توليد مفتاح عشوائي: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n');
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ تم إيقاف التشغيل لأن NODE_ENV=production والمفتاح الافتراضي لا يزال مستخدماً.\n');
    process.exit(1);
  }
}

// ── Create uploads dir ─────────────────────────────────────────────────────────
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Middleware ─────────────────────────────────────────────────────────────────
// ── Helmet (رؤوس أمان HTTP قياسية) ──────────────────────────────────────────────
// يضيف رؤوساً وقائية جاهزة يوصي بها OWASP بدون أي إعداد يدوي (يمنع تخمين نوع
// المحتوى بالمتصفح، يمنع تضمين الموقع بإطار iframe خارجي لحماية من Clickjacking،
// يخفي رأس X-Powered-By اللي يكشف إنه Express، وغيرها). نُعطّل تحديداً سياستين
// افتراضيتين قد تكسران عمل النظام الحالي دون أي فائدة أمنية حقيقية بحالتنا:
//   - crossOriginResourcePolicy: الفرونت إند (منفذ 3000) يعرض صوراً مرفوعة من
//     الباك إند (منفذ 8000) عبر <img src>؛ الإعداد الافتراضي same-origin كان
//     سيمنع تحميلها لاختلاف المنفذ. عدّلناه لـ cross-origin بدل تعطيله بالكامل.
//   - contentSecurityPolicy: مصمَّم أساساً لصفحات HTML، ولا فائدة حقيقية منه
//     على خادم API خالص لا يُقدّم صفحات ويب مباشرة؛ تعطيله يتجنّب تعقيداً غير
//     ضروري دون فقدان أي حماية فعلية بحالتنا.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
// ── CORS ───────────────────────────────────────────────────────────────────────
// كان مفتوحاً للجميع (origin: '*') سابقاً — أي موقع بالعالم يقدر يستدعي الـ API
// لو حصل على توكن دخول (مثلاً عبر XSS بموقع آخر). الآن مقيّد بنطاق الفرونت إند
// الفعلي فقط. القيمة الافتراضية تناسب التطوير المحلي (localhost:3000)؛ عند
// النشر على خادم حقيقي، أضف FRONTEND_URL بملف .env بعنوان موقعك الفعلي
// (مثلاً https://sihatuna-iraq.example.com) بدل الاعتماد على القيمة الافتراضية.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// credentials: true مطلوب حتى يقدر المتصفح يرسل ويستقبل httpOnly cookie —
// بدونه، المتصفح يرفض إرفاق الكوكي بطلبات fetch حتى لو الكود يمرر
// credentials:'include' من جهة الفرونت إند. لازم origin يكون عنواناً محدَّداً
// صراحة (مو '*') عشان يسمح المتصفح بهذا أصلاً — وهو مضبوط هيك أصلاً بالأعلى.
app.use(cors({ origin: FRONTEND_URL, credentials: true, methods: ['GET','POST','PUT','DELETE','PATCH'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// ── Auth middleware ────────────────────────────────────────────────────────────
// التعريف الفعلي بملف middleware/auth.js المشترك (يستخدمه أيضاً pgCrud.js).
// استُورد هنا مبكراً (بدل موقعه الأصلي بالأسفل) لأن مسار /uploads يحتاجه أيضاً.
const auth = require('./middleware/auth');

// ── إصلاح أمني ────────────────────────────────────────────────────────────────
// كانت الملفات المرفوعة (وثائق طبية، ملفات موظفين متقاعدين...) تُعرض عبر
// express.static بدون أي تحقق تسجيل دخول — أي رابط ملف (لو انسرب أو انخمّن
// اسمه) كان يفتح مباشرة بالمتصفح من أي شخص، حتى بدون حساب بالنظام. الآن
// يحتاج طلب عرض أي ملف توكن دخول صالح، تماماً متل باقي مسارات الـ API.
app.use('/uploads', auth, express.static(UPLOADS_DIR));

// ── Multer (file uploads) ──────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
// ── إصلاح أمني ────────────────────────────────────────────────────────────────
// ما كان في أي قيد على نوع الملف المرفوع — أي امتداد كان يُقبل (حتى ملفات
// تنفيذية أو HTML/SVG قد تحتوي جافاسكربت). الآن نسمح فقط بأنواع الملفات
// اللي فعلاً يحتاجها النظام (وثائق ومستندات ومرفقات طبية/إدارية عادية)،
// ونتحقق من الامتداد *ونوع المحتوى* معاً حتى ما ينفع تمويه ملف خطير باسم مزيّف.
const ALLOWED_UPLOAD_TYPES = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
};
const uploadFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const expectedMime = ALLOWED_UPLOAD_TYPES[ext];
  if (!expectedMime) {
    const err = new Error('نوع الملف غير مسموح به. الأنواع المسموحة: PDF, JPG, PNG, GIF, WEBP, DOC, DOCX, XLS, XLSX, TXT');
    err.statusCode = 400;
    return cb(err);
  }
  // بعض المتصفحات ترسل mimetype عام (application/octet-stream) لملفات صحيحة —
  // نتساهل بهذي الحالة (الامتداد وحده يكفي)، لكن لو حدّد المتصفح نوعاً صريحاً
  // مختلفاً تماماً عن الممتد (تمويه واضح)، نرفض الملف.
  if (file.mimetype !== expectedMime && file.mimetype !== 'application/octet-stream') {
    const err = new Error('نوع محتوى الملف لا يطابق امتداده — الملف مرفوض');
    err.statusCode = 400;
    return cb(err);
  }
  cb(null, true);
};
const upload = multer({ storage, fileFilter: uploadFileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

// ── DB helpers ─────────────────────────────────────────────────────────────────
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

// ── ترحيل كلمات المرور القديمة غير المشفّرة ────────────────────────────────────
// إصدارات سابقة من النظام كانت تسمح بمقارنة كلمة المرور كنص صريح كحل احتياطي
// (لدعم حسابات تجريبية قديمة أُنشئت يدوياً بملف db.json). هذا ثغرة أمنية حقيقية:
// أي تسريب لملف db.json يكشف كلمات المرور مباشرة بدون أي تشفير.
// هذه الدالة تعمل مرة واحدة تلقائياً عند كل بدء تشغيل: تفحص كل حساب، وأي كلمة
// مرور غير مشفّرة بعد (لا تبدأ بـ "$2" وهو الرمز المميز لتشفير bcrypt) تُشفَّر
// فوراً وتُحفَظ بمكانها — دون تغيير كلمة المرور نفسها التي يستخدمها المستخدم لتسجيل
// الدخول، فقط طريقة تخزينها. بعد هذه الدالة، لا داعي لأي مقارنة نصّية عند الدخول.
const migratePlaintextPasswords = () => {
  const db = readDB();
  if (!Array.isArray(db.users) || db.users.length === 0) return;
  let migratedCount = 0;
  db.users.forEach(u => {
    if (u.password && !u.password.startsWith('$2')) {
      u.password = bcrypt.hashSync(u.password, 10);
      migratedCount++;
    }
  });
  if (migratedCount > 0) {
    writeDB(db);
    console.log(`🔒 تم تشفير ${migratedCount} كلمة مرور كانت مخزّنة كنص صريح.`);
  }
};

// ── Audit Trail ────────────────────────────────────────────────────────────────
// يسجل تلقائياً كل عملية إضافة/تعديل/حذف على أي موديول: مين سواها، شنو تغيّر، ومتى
const AUDIT_LOG_PATH = path.join(__dirname, 'data', 'audit-log.json');
const MAX_AUDIT_ENTRIES = 5000; // نحافظ على حجم الملف معقول

const logAudit = (entry) => {
  try {
    let log = [];
    if (fs.existsSync(AUDIT_LOG_PATH)) {
      log = JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, 'utf8'));
    }
    log.push({
      id: log.length > 0 ? log[log.length - 1].id + 1 : 1,
      timestamp: new Date().toISOString(),
      ...entry,
    });
    if (log.length > MAX_AUDIT_ENTRIES) log = log.slice(log.length - MAX_AUDIT_ENTRIES);
    fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(log, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️  Failed to write audit log:', err.message);
  }
};

// ── Auth middleware ────────────────────────────────────────────────────────────
// (تم استيراده مبكراً بالأعلى قبل مسار /uploads — انظر الملاحظة هناك)

// ملاحظة: دالة crud() القديمة (تعمل على db.json) أُزيلت نهائياً — كل
// الموديولات الآن تُخدَم عبر pgCrud() (PostgreSQL) فقط. دوال readDB/writeDB
// لا تزال مستخدَمة بمسارات أخرى (تسجيل الدخول، المستخدمين، سجل التدقيق).
// ── Routes ─────────────────────────────────────────────────────────────────────
const router = express.Router();

// Health check
router.get('/health', (req, res) => res.json({ status: 'ok', system: 'SIHATUNA IRAQ', time: new Date().toISOString() }));

// ── HOSPITALS + SYSTEM SETTINGS (أساس دعم المنشآت المتعددة — مرحلة تأسيسية) ────
// جدول hospitals له أعمدة صريحة (لا يستخدم نمط JSONB المرن)، فله مسارات
// مخصصة بدل pgCrud. القراءة (GET) متاحة لأي مستخدم مسجّل دخول (يحتاجها كل
// مستخدم لعرض قائمة المنشآت باختيار المريض/الموظف مثلاً)، لكن الإضافة
// والتعديل والحذف للإدمن فقط.
router.get('/hospitals', auth, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM hospitals ORDER BY created_at ASC');
  res.json(result.rows);
}));

router.post('/hospitals', auth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'هذي الصفحة للإدمن فقط' });
  const { nameAr, nameEn, address, phone, enabledPages } = req.body;
  if (!nameAr || !nameEn) return res.status(400).json({ message: 'الاسم بالعربي والإنكليزي مطلوبان' });
  const result = await pool.query(
    `INSERT INTO hospitals (name_ar, name_en, address, phone, enabled_pages) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [nameAr, nameEn, address || null, phone || null, enabledPages ? JSON.stringify(enabledPages) : null]
  );
  logAudit({ module: 'hospitals', action: 'create', recordId: result.rows[0].id, userId: req.user.id, userRole: req.user.role, after: result.rows[0] });
  res.status(201).json(result.rows[0]);
}));

router.put('/hospitals/:id', auth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'هذي الصفحة للإدمن فقط' });
  const { nameAr, nameEn, address, phone, isActive, enabledPages } = req.body;
  const result = await pool.query(
    `UPDATE hospitals SET name_ar=$1, name_en=$2, address=$3, phone=$4, is_active=$5, enabled_pages=$6, updated_at=now()
     WHERE id=$7 RETURNING *`,
    [nameAr, nameEn, address || null, phone || null, isActive !== false, enabledPages ? JSON.stringify(enabledPages) : null, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ message: 'غير موجود' });
  logAudit({ module: 'hospitals', action: 'update', recordId: req.params.id, userId: req.user.id, userRole: req.user.role, after: result.rows[0] });
  res.json(result.rows[0]);
}));

router.delete('/hospitals/:id', auth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'هذي الصفحة للإدمن فقط' });
  const count = await pool.query('SELECT COUNT(*) FROM hospitals');
  if (Number(count.rows[0].count) <= 1) {
    return res.status(400).json({ message: 'لا يمكن حذف آخر منشأة متبقية بالنظام' });
  }
  await pool.query('DELETE FROM hospitals WHERE id=$1', [req.params.id]);
  logAudit({ module: 'hospitals', action: 'delete', recordId: req.params.id, userId: req.user.id, userRole: req.user.role });
  res.json({ success: true });
}));

// إعدادات النظام العامة (مفتاح/قيمة) — أول استخدام: تفعيل نظام المنشآت المتعددة
router.get('/system-settings/:key', auth, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT value FROM system_settings WHERE key=$1', [req.params.key]);
  res.json({ key: req.params.key, value: result.rows[0]?.value ?? null });
}));

router.put('/system-settings/:key', auth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'هذي الصفحة للإدمن فقط' });
  await pool.query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [req.params.key, JSON.stringify(req.body.value)]
  );
  logAudit({ module: 'system_settings', action: 'update', recordId: req.params.key, userId: req.user.id, userRole: req.user.role, after: { value: req.body.value } });
  res.json({ success: true, key: req.params.key, value: req.body.value });
}));

// ── BACKUPS (نسخ احتياطي — للإدمن فقط) ─────────────────────────────────────────
router.get('/backups', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'هذي الصفحة للإدمن فقط' });
  res.json(listBackups());
});

router.post('/backups/run', auth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'هذي الصفحة للإدمن فقط' });
  await runBackup();
  logAudit({ module: 'system', action: 'manual_backup', userId: req.user.id, userRole: req.user.role });
  res.json({ success: true, backups: listBackups() });
}));

router.post('/backups/:name/restore', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'هذي الصفحة للإدمن فقط' });
  try {
    restoreFromBackup(req.params.name);
    logAudit({ module: 'system', action: 'restore_backup', userId: req.user.id, userRole: req.user.role, after: { backupName: req.params.name } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── AUDIT LOG ─────────────────────────────────────────────────────────────────
// GET /api/audit-log?module=patients&limit=100  (للإدمن فقط)
router.get('/audit-log', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'هذي الصفحة للإدمن فقط' });
  if (!fs.existsSync(AUDIT_LOG_PATH)) return res.json([]);
  let log = JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, 'utf8'));
  const { module, action, userId, limit } = req.query;
  if (module) log = log.filter(e => e.module === module);
  if (action) log = log.filter(e => e.action === action);
  if (userId) log = log.filter(e => String(e.userId) === String(userId));
  log = log.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(log.slice(0, Number(limit) || 200));
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
router.post('/auth/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = (db.users || []).find(u =>
    u.username === username || u.email === username
  );
  if (!user) {
    logAudit({ module: 'auth', action: 'login_failed', userId: null, userRole: null, after: { attemptedUsername: username, reason: 'user_not_found' } });
    return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
  }

  // كل كلمات المرور مشفّرة بـ bcrypt الآن (بعد migratePlaintextPasswords عند الإقلاع)،
  // فلا حاجة لأي مسار مقارنة نصّية صريحة بعد اليوم.
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    logAudit({ module: 'auth', action: 'login_failed', userId: user.id, userRole: user.role, after: { attemptedUsername: username, reason: 'wrong_password' } });
    return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
  }

  const { password: _, ...safeUser } = user;
  // permissions تُضمَّن الآن بالتوكن نفسه ليقدر requirePermission (middleware
  // الصلاحيات بموديولات pgCrud) يتحقق منها بدون أي استعلام إضافي لقاعدة
  // البيانات بكل طلب. حساب admin يتجاوز هذا الفحص دائماً بغض النظر عن القيمة هنا.
  const token = jwt.sign({ id: user.id, role: user.role, hospitalId: user.hospitalId || null, permissions: user.permissions || [] }, JWT_SECRET, { expiresIn: '7d' });
  logAudit({ module: 'auth', action: 'login_success', userId: user.id, userRole: user.role });
  // ── إصلاح أمني ────────────────────────────────────────────────────────────
  // التوكن الآن يُرسَل أيضاً بـ httpOnly cookie — هذا ما يعتمد عليه الفرونت
  // إند فعلياً (كود الجافاسكربت ما يقدر يقرأ هذي الكوكي إطلاقاً، حتى لو صار
  // XSS بأي مكان بالتطبيق). يبقى موجوداً بجسم الاستجابة (body) أيضاً فقط من
  // أجل التوافق مع أدوات API مباشرة واختبارات jest الآلية — الفرونت إند لا
  // يخزّنه ولا يقرأه من الجسم بعد اليوم.
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS فقط بالإنتاج؛ يسمح بـ HTTP بالتطوير المحلي
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 أيام، نفس مدة صلاحية التوكن نفسه
    path: '/',
  });
  res.json({ token, user: safeUser });
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('auth_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
  res.json({ success: true });
});

router.get('/auth/me', auth, (req, res) => {
  const db = readDB();
  const user = (db.users || []).find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'غير موجود' });
  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

// ── USERS (settings) ─────────────────────────────────────────────────────────
// ── إصلاح أمني حرج ───────────────────────────────────────────────────────────
// هذي المسارات كانت بلا أي فحص دور إطلاقاً — auth فقط كان يتحقق إن التوكن
// صالح، بغض النظر عن صاحبه. يعني أي مستخدم عادي (ممرضة، محاسب...) كان يقدر
// عبر استدعاء مباشر للـ API (خارج الواجهة) يُنشئ حساب إدمن جديد لنفسه، أو
// يغيّر دور/كلمة مرور أي حساب آخر بالنظام — استيلاء كامل على الصلاحيات.
// الآن: كل عمليات القراءة والتعديل على المستخدمين للإدمن فقط.
router.get('/users', auth, requireAdmin, (req, res) => {
  const db = readDB();
  res.json((db.users || []).map(({ password: _, ...u }) => u));
});

router.post('/users', auth, requireAdmin, (req, res) => {
  const db = readDB();
  if (!db.users) db.users = [];
  const { password, ...rest } = req.body;
  const hashed = password ? bcrypt.hashSync(password, 10) : bcrypt.hashSync('changeme', 10);
  const user = { ...rest, password: hashed, id: nextId(db.users) };
  db.users.push(user);
  writeDB(db);
  const { password: _, ...safe } = user;
  logAudit({ module: 'users', action: 'create', recordId: user.id, userId: req.user.id, userRole: req.user.role, after: safe });
  res.status(201).json(safe);
});

router.put('/users/:id', auth, requireAdmin, (req, res) => {
  const db = readDB();
  const idx = (db.users || []).findIndex(u => u.id == req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'غير موجود' });
  const { password, ...rest } = req.body;
  db.users[idx] = {
    ...db.users[idx], ...rest,
    ...(password ? { password: bcrypt.hashSync(password, 10) } : {}),
    id: db.users[idx].id,
  };
  writeDB(db);
  const { password: _, ...safe } = db.users[idx];
  logAudit({ module: 'users', action: 'update', recordId: safe.id, userId: req.user.id, userRole: req.user.role, after: safe });
  res.json(safe);
});

router.delete('/users/:id', auth, requireAdmin, (req, res) => {
  if (req.params.id == 1) return res.status(403).json({ message: 'لا يمكن حذف المدير الرئيسي' });
  const db = readDB();
  db.users = (db.users || []).filter(u => u.id != req.params.id);
  writeDB(db);
  logAudit({ module: 'users', action: 'delete', recordId: req.params.id, userId: req.user.id, userRole: req.user.role });
  res.json({ success: true });
});

// ── STANDARD CRUD COLLECTIONS (db.json) ───────────────────────────────────────
// لم يبقَ أي موديول قياسي على db.json — كل الموديولات انتقلت إلى PostgreSQL
// (انظر قسم "PostgreSQL-BACKED COLLECTIONS" أسفل الملف). عنوان الـ API نفسه
// بقي كما هو تماماً لكل موديول، فلا يحتاج الفرونت إند أي تعديل.

// ── PostgreSQL-BACKED COLLECTIONS ─────────────────────────────────────────────
// المرضى والأطباء أول موديولين يُنقلان إلى PostgreSQL فعلياً (باقي الموديولات
// أعلاه لا تزال تعمل على db.json). نفس المخططات (schemas) المستخدمة سابقاً
// للتحقق تُعاد استخدامها هنا بدون أي تغيير.
const pgCrud = require('./routes/pgCrud');
// ── خيار permission ────────────────────────────────────────────────────────────
// نفس مفاتيح الصفحات (page keys) المعرَّفة بـ ALL_PAGES بملف
// frontend/src/contexts/AppContext.js — يفرض على مستوى الخادم نفس الصلاحية
// المستخدمة حالياً بالفرونت إند لإخفاء/إظهار عناصر القائمة الجانبية فقط.
// حساب admin يتجاوز هذا الفحص دائماً (انظر requirePermission.js).
// ── استيراد جماعي من Excel ────────────────────────────────────────────────────
// يضيف POST /api/patients/import-excel و POST /api/doctors/import-excel
// (و GET .../import-template لتحميل قالب فارغ). يُسجَّل عمداً *قبل* pgCrud
// لنفس الموديول أدناه — Express يطابق المسارات بترتيب التسجيل، ولو سُجِّل
// بعد pgCrud (اللي يضيف GET /patients/:id)، كان طلب GET /patients/import-template
// يتطابق خطأً مع نمط /:id (ويعامل "import-template" كأنه معرّف سجل رقمي)،
// بدل مساره الصريح الأدق. هذا خطأ حقيقي وقعنا فيه واكتُشف بالاختبار الفعلي.
const registerExcelImport = require('./routes/excelImportRoutes');
registerExcelImport(router, 'patients', collectionSchemas.patients, {
  'الاسم': 'name', 'اسم المريض': 'name', 'Name': 'name',
  'الاسم بالإنجليزي': 'nameEn', 'NameEn': 'nameEn', 'Name (English)': 'nameEn',
  'العمر': 'age', 'Age': 'age',
  'الجنس': 'gender', 'Gender': 'gender',
  'الهاتف': 'phone', 'رقم الهاتف': 'phone', 'Phone': 'phone',
  'فصيلة الدم': 'bloodType', 'Blood Type': 'bloodType',
  'الحالة': 'status', 'Status': 'status',
  'التأمين': 'insurance', 'Insurance': 'insurance',
  'ملاحظات': 'notes', 'Notes': 'notes',
}, {
  hospitalScoped: true, permission: 'patients',
  template: [
    { header: 'الاسم', example: 'أحمد كاظم الجبوري' },
    { header: 'الهاتف', example: '07701234567' },
    { header: 'العمر', example: '45' },
    { header: 'الجنس', example: 'ذكر' },
    { header: 'فصيلة الدم', example: 'A+' },
    { header: 'الحالة', example: 'نشط' },
    { header: 'التأمين', example: '' },
    { header: 'ملاحظات', example: '' },
  ],
});

registerExcelImport(router, 'doctors', collectionSchemas.doctors, {
  'الاسم': 'name', 'اسم الطبيب': 'name', 'اسم الدكتور': 'name', 'Name': 'name', 'Doctor Name': 'name',
  'الاسم بالإنجليزي': 'nameEn', 'NameEn': 'nameEn', 'Name (English)': 'nameEn',
  'التخصص': 'specialization', 'الاختصاص': 'specialization', 'الأختصاص': 'specialization', 'Specialization': 'specialization', 'Specialty': 'specialization',
  'الهاتف': 'phone', 'رقم الهاتف': 'phone', 'رقم الهاتف الأول': 'phone', 'رقم الجوال': 'phone', 'Phone': 'phone',
  'رقم الهاتف الثاني': 'phone2', 'هاتف إضافي': 'phone2', 'Phone 2': 'phone2',
  'العنوان': 'address', 'عنوان العيادة': 'address', 'Address': 'address',
  'سنوات الخبرة': 'experience', 'الخبرة': 'experience', 'Experience': 'experience',
  'الجنس': 'gender', 'Gender': 'gender',
  'الحالة': 'status', 'Status': 'status',
  'الملاحظات': 'notes', 'ملاحظات': 'notes', 'Notes': 'notes',
}, {
  hospitalScoped: true, permission: 'doctors',
  template: [
    { header: 'الاسم', example: 'د. أحمد سالم الراشدي' },
    { header: 'الهاتف', example: '07701234567' },
    { header: 'التخصص', example: 'باطنية وصدرية' },
    { header: 'العنوان', example: 'البصرة - العشار' },
    { header: 'سنوات الخبرة', example: '10' },
    { header: 'الجنس', example: 'ذكر' },
    { header: 'الحالة', example: 'نشط' },
    { header: 'الملاحظات', example: '' },
  ],
});

// ── دفعة استيراد إضافية: الأقسام، الموظفين، المتقاعدين، المخزون، الأصول،
//    المشاريع، مركبات الإسعاف ─────────────────────────────────────────────────
registerExcelImport(router, 'departments', collectionSchemas.departments, {
  'الاسم': 'name', 'اسم القسم': 'name', 'Name': 'name',
  'الوصف': 'description', 'Description': 'description',
  'رئيس القسم': 'head', 'Head': 'head',
  'الحالة': 'status', 'Status': 'status',
}, {
  hospitalScoped: true, permission: 'departments',
  template: [
    { header: 'الاسم', example: 'قسم الباطنية' },
    { header: 'الوصف', example: 'قسم الأمراض الباطنية' },
    { header: 'رئيس القسم', example: 'د. أحمد سالم' },
    { header: 'الحالة', example: 'نشط' },
  ],
});

registerExcelImport(router, 'employees', collectionSchemas.employees, {
  'الاسم': 'name', 'اسم الموظف': 'name', 'Name': 'name',
  'المسمى الوظيفي': 'jobTitle', 'Job Title': 'jobTitle',
  'القسم': 'dept', 'Department': 'dept',
  'الدرجة': 'grade', 'Grade': 'grade',
  'المرحلة': 'step', 'Step': 'step',
  'الراتب': 'salary', 'Salary': 'salary',
  'تاريخ التعيين': 'hireDate', 'Hire Date': 'hireDate',
  'تاريخ الميلاد': 'birthDate', 'Birth Date': 'birthDate',
  'الهاتف': 'phone', 'Phone': 'phone',
  'الحالة': 'status', 'Status': 'status',
}, {
  hospitalScoped: true, permission: 'hr',
  indexedColumns: [
    { field: 'name', column: 'name' },
    { field: 'jobTitle', column: 'job_title' },
    { field: 'status', column: 'status' },
  ],
  template: [
    { header: 'الاسم', example: 'رنا محمد النجار' },
    { header: 'المسمى الوظيفي', example: 'سكرتيرة' },
    { header: 'القسم', example: 'الإدارة' },
    { header: 'الراتب', example: '480000' },
    { header: 'تاريخ التعيين', example: '2024-01-15' },
    { header: 'الهاتف', example: '07701234567' },
    { header: 'الحالة', example: 'نشط' },
  ],
});

registerExcelImport(router, 'retired', collectionSchemas.retired, {
  'الاسم': 'name', 'Name': 'name',
  'المسمى الوظيفي': 'jobTitle', 'Job Title': 'jobTitle',
  'القسم': 'dept', 'Department': 'dept',
  'تاريخ التقاعد': 'retireDate', 'Retire Date': 'retireDate',
  'راتب التقاعد': 'retireSalary', 'Retire Salary': 'retireSalary',
  'رقم التقاعد': 'pensionNo', 'Pension No': 'pensionNo',
  'الهاتف': 'phone', 'Phone': 'phone',
}, {
  hospitalScoped: true, permission: 'hr',
  indexedColumns: [
    { field: 'name', column: 'name' },
    { field: 'jobTitle', column: 'job_title' },
  ],
  template: [
    { header: 'الاسم', example: 'باسم علي الكربلائي' },
    { header: 'المسمى الوظيفي', example: 'فني مختبر' },
    { header: 'القسم', example: 'التحاليل' },
    { header: 'تاريخ التقاعد', example: '2026-01-01' },
    { header: 'راتب التقاعد', example: '500000' },
    { header: 'رقم التقاعد', example: 'P-1234' },
    { header: 'الهاتف', example: '07701234567' },
  ],
});

registerExcelImport(router, 'inventory', collectionSchemas.inventory, {
  'الرمز': 'code', 'Code': 'code',
  'الاسم': 'name', 'Name': 'name',
  'الاسم بالإنجليزي': 'nameEn', 'NameEn': 'nameEn',
  'التصنيف': 'category', 'Category': 'category',
  'الوحدة': 'unit', 'Unit': 'unit',
  'الكمية': 'qty', 'Quantity': 'qty',
  'الحد الأدنى': 'minQty', 'Min Quantity': 'minQty',
  'الحد الأعلى': 'maxQty', 'Max Quantity': 'maxQty',
  'تكلفة الوحدة': 'unitCost', 'Unit Cost': 'unitCost',
  'المورّد': 'supplier', 'Supplier': 'supplier',
  'الموقع': 'location', 'Location': 'location',
  'تاريخ الانتهاء': 'expiry', 'Expiry': 'expiry',
  'الحالة': 'status', 'Status': 'status',
}, {
  hospitalScoped: true, permission: 'inventory',
  template: [
    { header: 'الرمز', example: 'MED-001' },
    { header: 'الاسم', example: 'باراسيتامول 500mg' },
    { header: 'التصنيف', example: 'medicine' },
    { header: 'الوحدة', example: 'Box' },
    { header: 'الكمية', example: '100' },
    { header: 'الحد الأدنى', example: '20' },
    { header: 'تكلفة الوحدة', example: '1500' },
    { header: 'المورّد', example: 'شركة الرافدين للأدوية' },
    { header: 'الحالة', example: 'نشط' },
  ],
});

registerExcelImport(router, 'assets', collectionSchemas.assets, {
  'رقم الأصل': 'assetNo', 'Asset No': 'assetNo',
  'الاسم': 'name', 'Name': 'name',
  'الاسم بالإنجليزي': 'nameEn', 'NameEn': 'nameEn',
  'التصنيف': 'category', 'Category': 'category',
  'الماركة': 'brand', 'Brand': 'brand',
  'الموديل': 'model', 'Model': 'model',
  'الرقم التسلسلي': 'serial', 'Serial': 'serial',
  'تاريخ الشراء': 'purchaseDate', 'Purchase Date': 'purchaseDate',
  'تكلفة الشراء': 'purchaseCost', 'Purchase Cost': 'purchaseCost',
  'الموقع': 'location', 'Location': 'location',
  'الحالة': 'status', 'Status': 'status',
  'المسؤول': 'responsiblePerson', 'Responsible Person': 'responsiblePerson',
  'ملاحظات': 'notes', 'Notes': 'notes',
}, {
  hospitalScoped: true, permission: 'assets',
  template: [
    { header: 'رقم الأصل', example: 'AST-2026-001' },
    { header: 'الاسم', example: 'جهاز أشعة سينية' },
    { header: 'التصنيف', example: 'medical' },
    { header: 'الماركة', example: 'Siemens' },
    { header: 'تاريخ الشراء', example: '2024-05-01' },
    { header: 'تكلفة الشراء', example: '15000000' },
    { header: 'الموقع', example: 'قسم الأشعة' },
    { header: 'الحالة', example: 'نشط' },
  ],
});

registerExcelImport(router, 'projects', collectionSchemas.projects, {
  'الرمز': 'code', 'Code': 'code',
  'الاسم': 'name', 'Name': 'name',
  'الاسم بالإنجليزي': 'nameEn', 'NameEn': 'nameEn',
  'المدير': 'manager', 'Manager': 'manager',
  'الميزانية': 'budget', 'Budget': 'budget',
  'تاريخ البدء': 'startDate', 'Start Date': 'startDate',
  'تاريخ الانتهاء': 'endDate', 'End Date': 'endDate',
  'الحالة': 'status', 'Status': 'status',
  'الأولوية': 'priority', 'Priority': 'priority',
}, {
  hospitalScoped: true, permission: 'projects',
  template: [
    { header: 'الرمز', example: 'PRJ-2026-01' },
    { header: 'الاسم', example: 'تحديث نظام الأشعة' },
    { header: 'المدير', example: 'م. نور المشاريع' },
    { header: 'الميزانية', example: '50000000' },
    { header: 'تاريخ البدء', example: '2026-01-01' },
    { header: 'الحالة', example: 'planning' },
  ],
});

registerExcelImport(router, 'ambulanceVehicles', collectionSchemas.ambulanceVehicles, {
  'الرمز': 'code', 'Code': 'code',
  'رقم اللوحة': 'plate', 'Plate': 'plate',
  'النوع': 'type', 'Type': 'type',
  'الموديل': 'model', 'Model': 'model',
  'الطاقم': 'crew', 'Crew': 'crew',
  'الحالة': 'status', 'Status': 'status',
  'الموقع': 'location', 'Location': 'location',
}, {
  hospitalScoped: true, permission: 'ambulance',
  tableName: 'ambulance_vehicles',
  indexedColumns: [],
  template: [
    { header: 'الرمز', example: 'AMB-01' },
    { header: 'رقم اللوحة', example: '12345 بصرة' },
    { header: 'النوع', example: 'advanced' },
    { header: 'الموديل', example: 'Toyota Hiace 2022' },
    { header: 'الطاقم', example: 'سائق + ممرض' },
    { header: 'الحالة', example: 'available' },
    { header: 'الموقع', example: 'المستشفى' },
  ],
});

pgCrud(router, 'patients', collectionSchemas.patients, undefined, undefined, { hospitalScoped: true, permission: 'patients', openRead: true });
pgCrud(router, 'doctors', collectionSchemas.doctors, undefined, undefined, { hospitalScoped: true, permission: 'doctors', openRead: true });
pgCrud(router, 'appointments', collectionSchemas.appointments, [
  { field: 'patient', column: 'patient' },
  { field: 'doctor', column: 'doctor' },
  { field: 'date', column: 'date' },
  { field: 'status', column: 'status' },
], undefined, { hospitalScoped: true, permission: 'appointments', openRead: true });
pgCrud(router, 'invoices', collectionSchemas.invoices, [
  { field: 'patientId', column: 'patient_id' },
  { field: 'status', column: 'status' },
  { field: 'total', column: 'total' },
], undefined, { hospitalScoped: true, permission: 'billing' });
pgCrud(router, 'employees', collectionSchemas.employees, [
  { field: 'name', column: 'name' },
  { field: 'jobTitle', column: 'job_title' },
  { field: 'status', column: 'status' },
], undefined, { hospitalScoped: true, permission: 'hr' });
pgCrud(router, 'retired', collectionSchemas.retired, [
  { field: 'name', column: 'name' },
  { field: 'jobTitle', column: 'job_title' },
], undefined, { hospitalScoped: true, permission: 'hr' });

// باقي الموديولات: تخزين JSONB بحت بدون أعمدة فهرسة إضافية (انظر تعليق
// المخطط بملف postgres_schema.sql لشرح السبب). اسم الجدول snake_case دائماً
// حتى لو كان اسم الموديول camelCase بالفرونت إند (مثل medicalLeaves -> medical_leaves).
// كلها مفعّل عليها الفلترة حسب المنشأة الآن (المرحلة 4 من دعم المنشآت المتعددة).
pgCrud(router, 'departments', collectionSchemas.departments, undefined, undefined, { hospitalScoped: true, permission: 'departments', openRead: true });
pgCrud(router, 'outgoing', collectionSchemas.outgoing, undefined, undefined, { hospitalScoped: true, permission: 'hr' });
pgCrud(router, 'incoming', collectionSchemas.incoming, undefined, undefined, { hospitalScoped: true, permission: 'hr' });
pgCrud(router, 'vaccinations', collectionSchemas.vaccinations, undefined, undefined, { hospitalScoped: true, permission: 'vaccinations' });
pgCrud(router, 'medicalLeaves', collectionSchemas.medicalLeaves, [], 'medical_leaves', { hospitalScoped: true, permission: 'medical-leave' });
pgCrud(router, 'dossiers', collectionSchemas.dossiers, undefined, undefined, { hospitalScoped: true, permission: 'hr' });
pgCrud(router, 'labTests', collectionSchemas.labTests, [], 'lab_tests', { hospitalScoped: true, permission: 'laboratory' });
pgCrud(router, 'radiology', collectionSchemas.radiology, undefined, undefined, { hospitalScoped: true, permission: 'radiology' });
pgCrud(router, 'pharmacyOrders', collectionSchemas.pharmacyOrders, [], 'pharmacy_orders', { hospitalScoped: true, permission: 'pharmacy' });
pgCrud(router, 'assets', collectionSchemas.assets, undefined, undefined, { hospitalScoped: true, permission: 'assets' });
pgCrud(router, 'inventory', collectionSchemas.inventory, undefined, undefined, { hospitalScoped: true, permission: 'inventory' });
pgCrud(router, 'procurement', collectionSchemas.procurement, undefined, undefined, { hospitalScoped: true, permission: 'procurement' });
pgCrud(router, 'projects', collectionSchemas.projects, undefined, undefined, { hospitalScoped: true, permission: 'projects' });
pgCrud(router, 'documents', collectionSchemas.documents, undefined, undefined, { hospitalScoped: true, permission: 'documents' });
pgCrud(router, 'servicePrices', collectionSchemas.servicePrices, [], 'service_prices', { hospitalScoped: true, permission: 'billing' });
pgCrud(router, 'transactions', collectionSchemas.transactions, undefined, undefined, { hospitalScoped: true, permission: 'accounts' });
pgCrud(router, 'promotions', collectionSchemas.promotions, undefined, undefined, { hospitalScoped: true, permission: 'accounts' });
pgCrud(router, 'allowances', collectionSchemas.allowances, undefined, undefined, { hospitalScoped: true, permission: 'accounts' });
pgCrud(router, 'salaries', collectionSchemas.salaries, undefined, undefined, { hospitalScoped: true, permission: 'accounts' });
pgCrud(router, 'ambulanceVehicles', collectionSchemas.ambulanceVehicles, [], 'ambulance_vehicles', { hospitalScoped: true, permission: 'ambulance' });
pgCrud(router, 'ambulanceMissions', collectionSchemas.ambulanceMissions, [], 'ambulance_missions', { hospitalScoped: true, permission: 'ambulance' });

// CRM المرضى — indexedColumns تختلف عن الاسم الافتراضي (name/phone/status)
pgCrud(router, 'crmInteractions', collectionSchemas.crmInteractions, [
  { field: 'patientId', column: 'patient_id' },
], 'crm_interactions', { hospitalScoped: true, permission: 'crm' });
pgCrud(router, 'crmSegments', collectionSchemas.crmSegments, [
  { field: 'patientId', column: 'patient_id' },
  { field: 'segmentCode', column: 'segment_code' },
], 'crm_patient_segments', { hospitalScoped: true, permission: 'crm' });
pgCrud(router, 'crmFollowUps', collectionSchemas.crmFollowUps, [
  { field: 'patientId', column: 'patient_id' },
  { field: 'status', column: 'status' },
], 'crm_follow_ups', { hospitalScoped: true, permission: 'crm' });
pgCrud(router, 'crmCampaigns', collectionSchemas.crmCampaigns, [
  { field: 'status', column: 'status' },
], 'crm_campaigns', { hospitalScoped: true, permission: 'crm' });
pgCrud(router, 'crmCampaignTargets', collectionSchemas.crmCampaignTargets, [
  { field: 'campaignId', column: 'campaign_id' },
  { field: 'patientId', column: 'patient_id' },
], 'crm_campaign_targets', { hospitalScoped: true, permission: 'crm' });

// ── RETIRED DOSSIERS (nested: retiredDossiers[retiredId] = [docs]) ────────────
router.get('/retired/:id/dossier', auth, (req, res) => {
  const db = readDB();
  res.json((db.retiredDossiers || {})[req.params.id] || []);
});

router.post('/retired/:id/dossier', auth, upload.single('file'), (req, res) => {
  const db = readDB();
  if (!db.retiredDossiers) db.retiredDossiers = {};
  if (!db.retiredDossiers[req.params.id]) db.retiredDossiers[req.params.id] = [];
  const docs = db.retiredDossiers[req.params.id];
  const doc = {
    id: Date.now(),
    type: req.body.type || 'وثيقة',
    title: req.body.title || '',
    date: req.body.date || '',
    notes: req.body.notes || '',
    fileName: req.file ? req.file.originalname : null,
    filePath: req.file ? `/uploads/${req.file.filename}` : null,
    fileType: req.file ? req.file.mimetype : null,
  };
  docs.push(doc);
  writeDB(db);
  res.status(201).json(doc);
});

router.delete('/retired/:id/dossier/:docId', auth, (req, res) => {
  const db = readDB();
  if (!db.retiredDossiers) db.retiredDossiers = {};
  const docs = db.retiredDossiers[req.params.id] || [];
  db.retiredDossiers[req.params.id] = docs.filter(d => d.id != req.params.docId);
  writeDB(db);
  res.json({ success: true });
});

// ── FILE UPLOAD (general) ─────────────────────────────────────────────────────
router.post('/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'لا يوجد ملف' });
  res.json({
    url: `http://localhost:${PORT}/uploads/${req.file.filename}`,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
});

// ── DASHBOARD STATS ───────────────────────────────────────────────────────────
router.get('/stats', auth, (req, res) => {
  const db = readDB();
  const today = new Date().toISOString().split('T')[0];
  res.json({
    patients: (db.patients || []).length,
    doctors: (db.doctors || []).filter(d => d.status === 'active').length,
    appointments: (db.appointments || []).filter(a => a.date === today).length,
    departments: (db.departments || []).length,
    employees: (db.employees || []).length,
    retired: (db.retired || []).length,
  });
});

// ── CRM (انتقل إلى PostgreSQL — انظر قسم "PostgreSQL-BACKED COLLECTIONS") ────
// أُزيلت الموديولات الخمسة من قائمة db.json القياسية بعد ربطها بجداول
// crm_interactions, crm_patient_segments, crm_follow_ups, crm_campaigns,
// crm_campaign_targets الحقيقية بقاعدة PostgreSQL، مباشرة عبر pgCrud —
// بنفس النمط المستخدَم بكل الموديولات الأخرى. لا وجود بعد الآن لأي نسخة
// ثانية أو نظام CRM منفصل (ملفا routes/crmRoutes.js وcontrollers/crmController.js
// القديمان، اللذان كانا يفترضان بنية جداول مختلفة تماماً، حُذفا نهائياً).

// ── Health check (يستخدمه الفرونت إند للتأكد إن السيرفر شغّال) ──────────────
app.get('/', (req, res) => res.json({ status: 'ok', service: 'SIHATUNA IRAQ Backend' }));

// ── Mount router ───────────────────────────────────────────────────────────────
app.use('/api', router);

// ── Payment Gateway (PostgreSQL) — احتياطي متقدم، تعمل فقط بعد إعداد .env ──
// ملاحظة: نظام CRM القديم متعدد المستشفيات (routes/crmRoutes.js) أُزيل نهائياً
// من هنا — كان يستعلم عن أعمدة (channel, follow_up_type, ...) لم تعد موجودة
// بعد إعادة بناء جداول CRM بالنمط الجديد (JSONB مرن، انظر pgCrud أعلاه)، وكان
// سيتسبب بانهيار أي طلب يصل له صدفة. CRM الفعلي يعمل الآن عبر pgCrud مباشرة.
try {
  const paymentRoutes = require('./routes/paymentRoutes');
  app.use('/api', paymentRoutes);
  console.log('✅ Payment module loaded (/api/payments, /api/admin/payment-gateways)');
} catch (err) {
  console.warn('⚠️  Payment module not loaded — check that "pg" is installed and .env is configured:', err.message);
}

// 404
app.use((req, res) => res.status(404).json({ message: 'المسار غير موجود' }));

// ── معالج الأخطاء المركزي ────────────────────────────────────────────────────
// نقطة واحدة لكل أخطاء الخادم (المتزامنة وغير المتزامنة عبر asyncHandler)،
// بدل تكرار try/catch وصياغة الاستجابة في كل controller على حدة.
// يُصنَّف الخطأ حسب نوعه لإعطاء رمز حالة (status code) ورسالة مناسبة،
// ولا تُرسَل تفاصيل الخطأ الداخلية (err.stack) للمستخدم في بيئة الإنتاج.
app.use((err, req, res, next) => {
  console.error(`❌ [${req.method} ${req.originalUrl}]`, err.message);

  // خطأ اتصال بقاعدة PostgreSQL (السيرفر غير متاح أو غير مُعدّ)
  if (err.code === 'ECONNREFUSED' || err.code === '3D000') {
    return res.status(503).json({ message: 'تعذّر الاتصال بقاعدة البيانات، حاول لاحقاً' });
  }
  // خطأ توكن JWT غير صالح أو منتهي (في حال مرّره middleware المصادقة عبر next(err))
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'رمز الدخول غير صالح أو منتهي الصلاحية' });
  }
  // خطأ تحقق من صحة البيانات (يمكن لأي controller رمي Error برمز statusCode = 400)
  if (err.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  res.status(500).json({
    message: 'خطأ في الخادم',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
});

// ── بدء التشغيل الفعلي ────────────────────────────────────────────────────────
// نُشغّل الاستماع الفعلي على المنفذ فقط عند تشغيل هذا الملف مباشرة (node server.js)،
// وليس عند استيراده كموديول (مثلاً بواسطة ملفات الاختبار عبر require('../server')).
// بدون هذا الشرط، أي محاولة اختبار آلي للتطبيق كانت ستُشغّل سيرفراً حقيقياً على
// المنفذ 8000 وتكتب فوق قاعدة البيانات الحقيقية بمجرد استيراد الملف — وهذا بالضبط
// ما يمنع كتابة اختبارات آمنة لهذا المشروع حتى الآن.
if (require.main === module) {
  // تشفير أي كلمة مرور نصّية عالقة قبل قبول أي طلب دخول
  migratePlaintextPasswords();

  const server = app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║     SIHATUNA IRAQ — Backend Server     ║`);
    console.log(`║  Developer: Huda Abduladheem           ║`);
    console.log(`╠════════════════════════════════════════╣`);
    console.log(`║  🟢 Server: http://localhost:${PORT}     ║`);
    console.log(`║  📁 DB:     data/db.json               ║`);
    console.log(`║  📎 Uploads: /uploads                  ║`);
    console.log(`╚════════════════════════════════════════╝\n`);
    console.log('Login credentials:');
    console.log('  admin / admin      -> System Admin (full access)');
    console.log('  doctor / doctor    -> Doctor');
    console.log('  nurse / nurse      -> Nurse');
    console.log('  accountant / account -> Accountant\n');
    startAutoBackup();
  });

  // معالجة صريحة لخطأ انشغال المنفذ (EADDRINUSE): بدون هذا المعالج، محاولة تشغيل
  // نسخة ثانية من السيرفر بينما نسخة سابقة لا تزال عالقة بالخلفية (مثلاً بعد إغلاق
  // نافذة CMD دون إنهاء العملية فعلياً) تنتهي بخطأ غامض يصعب تشخيصه من طرف المستخدم.
  // هنا نطبع رسالة واضحة بالعربية وحل عملي، بدل ترك Node يطبع Stack Trace غير مفهوم.
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ المنفذ ${PORT} مستخدم مسبقاً من عملية أخرى.`);
      console.error('   هذا يعني على الأغلب أن نسخة سابقة من الخادم لا تزال تعمل بالخلفية');
      console.error('   (حتى لو أُغلقت نافذتها) وهي التي ترد فعلياً على localhost:8000 —');
      console.error('   ما يفسّر ظهور استجابات قديمة أو غير متوقعة رغم تشغيل السيرفر من جديد.\n');
      console.error('   الحل: أغلق العملية العالقة أولاً، من داخل PowerShell:');
      console.error(`     netstat -ano | findstr :${PORT}`);
      console.error('     (لاحظ رقم PID بآخر السطر، ثم:)');
      console.error('     taskkill /PID <رقم_العملية> /F\n');
      console.error('   أو ببساطة: افتح "إدارة المهام" (Task Manager) وأنهِ كل عمليات "Node.js" يدوياً،');
      console.error('   ثم أعد تشغيل start-backend.bat من جديد.\n');
      process.exit(1);
    } else {
      console.error('❌ خطأ غير متوقع عند بدء تشغيل الخادم:', err.message);
      process.exit(1);
    }
  });
}

module.exports = app;

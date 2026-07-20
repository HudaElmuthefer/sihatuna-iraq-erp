// backend/routes/usersRoutes.js
//
// ── إصلاح أمني حرج (محفوظ من قبل) ────────────────────────────────────────────
// هذي المسارات كانت بلا أي فحص دور إطلاقاً — auth فقط كان يتحقق إن التوكن
// صالح، بغض النظر عن صاحبه. يعني أي مستخدم عادي (ممرضة، محاسب...) كان يقدر
// عبر استدعاء مباشر للـ API (خارج الواجهة) يُنشئ حساب إدمن جديد لنفسه، أو
// يغيّر دور/كلمة مرور أي حساب آخر بالنظام — استيلاء كامل على الصلاحيات.
// الآن: كل عمليات القراءة والتعديل على المستخدمين للإدمن فقط.
//
// ── إصلاح أمني ثانٍ: فلترة حسب المنشأة ────────────────────────────────────────
// requireAdmin وحدها تتحقق فقط من role === 'admin' — بدون أي اعتبار لأي منشأة
// ينتمي لها هذا الإدمن. يعني إدمن محلي مرتبط بمستشفى معيّن (hospitalId محدَّد
// بحسابه) كان يقدر يشوف ويعدّل ويحذف بل حتى **يعيد ضبط كلمة مرور** مستخدمين
// بمستشفيات ثانية غيره تماماً. الآن: إدمن له hospitalId يشوف بس مستخدمي نفس
// منشأته، وأي عملية على مستخدم بمنشأة ثانية تُرفَض (404، بنفس نمط
// belongsToUserHospital المستخدم بـ pgCrud.js لباقي الموديولات). إدمن عام
// (بدون hospitalId — مستوى الوزارة) يشوف ويدير الجميع كالمعتاد.
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { readDB, writeDB, nextId } = require('../utils/db');
const { logAudit } = require('../utils/auditLog');

const router = express.Router();

// يتحقق هل مستخدم مستهدَف (target) يقع ضمن نطاق صلاحية الإدمن الحالي —
// إدمن عام (بدون hospitalId) يشوف الجميع؛ إدمن محلي يشوف بس نفس منشأته
const inScope = (actingAdmin, targetUser) => {
  if (!actingAdmin.hospitalId) return true; // إدمن عام
  return targetUser?.hospitalId === actingAdmin.hospitalId;
};

router.get('/users', auth, requireAdmin, (req, res) => {
  const db = readDB();
  const users = (db.users || []).filter(u => inScope(req.user, u));
  res.json(users.map(({ password: _, ...u }) => u));
});

router.post('/users', auth, requireAdmin, (req, res) => {
  const db = readDB();
  if (!db.users) db.users = [];
  const { password, ...rest } = req.body;
  const hashed = password ? bcrypt.hashSync(password, 10) : bcrypt.hashSync('changeme', 10);
  // إدمن محلي يفرض منشأته تلقائياً على أي حساب ينشئه، متجاهلاً أي hospitalId
  // ثاني يُرسَل بالطلب — يمنع إنشاء مستخدم بمنشأة ثانية عبر تعديل الطلب يدوياً.
  // إدمن عام يقدر يحدد أي منشأة (أو يتركها فاضية لحساب مستوى وزارة).
  const hospitalId = req.user.hospitalId ? req.user.hospitalId : rest.hospitalId;
  const user = { ...rest, hospitalId, password: hashed, id: nextId(db.users) };
  db.users.push(user);
  writeDB(db);
  const { password: _, ...safe } = user;
  logAudit({ module: 'users', action: 'create', recordId: user.id, userId: req.user.id, userRole: req.user.role, after: safe });
  res.status(201).json(safe);
});

router.put('/users/:id', auth, requireAdmin, (req, res) => {
  const db = readDB();
  const idx = (db.users || []).findIndex(u => u.id == req.params.id);
  if (idx === -1 || !inScope(req.user, db.users[idx])) return res.status(404).json({ message: 'غير موجود' });
  const { password, hospitalId, ...rest } = req.body;
  db.users[idx] = {
    ...db.users[idx], ...rest,
    // إدمن محلي ما يقدر ينقل مستخدم لمنشأة ثانية (يبقى hospitalId ثابتاً على
    // منشأته هو)؛ إدمن عام يقدر يغيّره بحرية
    ...(req.user.hospitalId ? {} : { hospitalId }),
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
  const target = (db.users || []).find(u => u.id == req.params.id);
  if (!target || !inScope(req.user, target)) return res.status(404).json({ message: 'غير موجود' });
  db.users = (db.users || []).filter(u => u.id != req.params.id);
  writeDB(db);
  logAudit({ module: 'users', action: 'delete', recordId: req.params.id, userId: req.user.id, userRole: req.user.role });
  res.json({ success: true });
});

// ── استعادة كلمة المرور (بدون بريد إلكتروني — النظام لا يملك خدمة SMTP) ──────
// الحل العملي المتاح: الإدمن يولّد كلمة مرور مؤقتة عشوائية للمستخدم (تُعرض
// له مرة واحدة فقط بواجهة الإدمن، يوصّلها للمستخدم يدوياً بالهاتف أو حضورياً)،
// ويُجبَر ذاك المستخدم على تغييرها بأول تسجيل دخول له (mustChangePassword).
// الكلمة المؤقتة نفسها لا تُخزَّن أبداً كنص صريح — فقط نسختها المشفّرة (bcrypt)،
// ولا تُسجَّل بسجل التدقيق (audit log) لأي سبب.
router.post('/users/:id/reset-password', auth, requireAdmin, (req, res) => {
  const db = readDB();
  const idx = (db.users || []).findIndex(u => u.id == req.params.id);
  if (idx === -1 || !inScope(req.user, db.users[idx])) return res.status(404).json({ message: 'غير موجود' });

  // كلمة مرور مؤقتة عشوائية آمنة (12 حرف hex = 6 بايت عشوائي، سهلة القراءة
  // والنطق هاتفياً مقارنة بترميز base64 مثلاً)
  const tempPassword = crypto.randomBytes(6).toString('hex');
  db.users[idx].password = bcrypt.hashSync(tempPassword, 10);
  db.users[idx].mustChangePassword = true;
  writeDB(db);

  // نسجّل بسجل التدقيق أن إعادة ضبط صارت — بدون كلمة المرور نفسها إطلاقاً
  logAudit({ module: 'users', action: 'password_reset', recordId: req.params.id, userId: req.user.id, userRole: req.user.role });

  // الكلمة المؤقتة تُعاد بجسم الاستجابة مرة واحدة فقط هنا — لن تظهر ثانية
  // بأي مكان (لا بسجل التدقيق، لا بأي استعلام لاحق). على الإدمن نسخها فوراً.
  res.json({ success: true, tempPassword });
});

// تغيير كلمة المرور الذاتي — أي مستخدم مسجّل دخول يقدر يغيّر كلمة مروره هو
// نفسه (يحتاج معرفة كلمة المرور الحالية أولاً، بما فيها الكلمة المؤقتة
// المُصدَرة من الإدمن أعلاه). قبل هذا المسار، ما كان فيه أي طريقة لمستخدم
// عادي (غير إدمن) يغيّر كلمة مروره بنفسه إطلاقاً — لازم يطلب من الإدمن كل مرة.
// (بدون فحص منشأة هنا عمداً — كل مستخدم يغيّر كلمة مروره هو نفسها بس، بغض
// النظر عن منشأته، فما فيه احتمال وصول عبر منشأة ثانية أصلاً)
router.put('/users/me/password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'كلمة المرور الحالية والجديدة مطلوبتان' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف' });
  }
  const db = readDB();
  const idx = (db.users || []).findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ message: 'غير موجود' });

  const valid = bcrypt.compareSync(currentPassword, db.users[idx].password);
  if (!valid) return res.status(401).json({ message: 'كلمة المرور الحالية غير صحيحة' });

  db.users[idx].password = bcrypt.hashSync(newPassword, 10);
  db.users[idx].mustChangePassword = false;
  writeDB(db);
  logAudit({ module: 'users', action: 'password_self_change', recordId: req.user.id, userId: req.user.id, userRole: req.user.role });
  res.json({ success: true });
});

module.exports = router;

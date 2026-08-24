// backend/routes/authRoutes.js
//
// مسارات تسجيل الدخول/الخروج والتحقق من الجلسة الحالية.
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const { readDB } = require('../utils/db');
const { logAudit } = require('../utils/auditLog');
const { revoke: revokeToken } = require('../utils/tokenRevocation');
const { JWT_SECRET } = require('../config/jwtConfig');
const { loginLimiter } = require('../config/rateLimiters');

const router = express.Router();

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
  // permissions تُضمَّن الآن بالتوكن نفسه ليستطيع requirePermission (middleware
  // الصلاحيات بموديولات pgCrud) يتحقق منها بدون أي استعلام إضافي لقاعدة
  // البيانات بكل طلب. حساب admin يتجاوز هذا الفحص دائماً بغض النظر عن القيمة هنا.
  // jti (JWT ID) معرّف فريد لهذا التوكن تحديداً — يسمح لتسجيل الخروج بإبطاله
  // فعلياً لاحقاً (انظر utils/tokenRevocation.js) بدل انتظار انتهاء صلاحيته الطبيعية.
  const jti = uuidv4();
  const token = jwt.sign({ id: user.id, role: user.role, hospitalId: user.hospitalId || null, permissions: user.permissions || [], jti }, JWT_SECRET, { expiresIn: '1d' });
  logAudit({ module: 'auth', action: 'login_success', userId: user.id, userRole: user.role });
  // ── إصلاح أمني ────────────────────────────────────────────────────────────
  // التوكن الآن يُرسَل أيضاً بـ httpOnly cookie — هذا ما يعتمد عليه الفرونت
  // إند فعلياً (كود الجافاسكربت لا يستطيع قراءة هذه الكوكي إطلاقاً، حتى لو صار
  // XSS بأي مكان بالتطبيق). يبقى موجوداً بجسم الاستجابة (body) أيضاً فقط من
  // أجل التوافق مع أدوات API مباشرة واختبارات jest الآلية — الفرونت إند لا
  // يخزّنه ولا يقرأه من الجسم بعد اليوم.
  // ── إصلاح أمني ────────────────────────────────────────────────────────────
  // sameSite: 'strict' (بدل 'lax' سابقاً) يمنع المتصفح من إرسال الكوكي إطلاقاً
  // مع أي طلب مصدره موقع آخر (حتى طلبات GET من رابط بموقع خارجي) — يقفل ثغرة
  // CSRF بشكل شبه كامل بدون حاجة لآلية توكن CSRF منفصلة. هذا مناسب تماماً
  // لنظام داخلي مثل هذا (لا توجد حالة استخدام مشروعة لفتح رابط من موقع خارجي
  // يدخل جلسة المستخدم). ملاحظة: هذا يفترض إن الفرونت إند والباك إند يعملان
  // على نفس "الموقع" (Same Site) — نفس الدومين الأساسي، حتى لو بمنافذ مختلفة
  // (localhost:3000 و localhost:8000 يُعتبَران نفس الموقع). لو نُشر المشروع
  // مستقبلاً بحيث الفرونت إند والباك إند على نطاقين فرعيين مختلفين تماماً
  // (مثل app.sihatuna.iq و api.sihatuna.iq)، هذا الإعداد يمنع إرسال الكوكي
  // بينهما تماماً ويكسر تسجيل الدخول — يجب إرجاعه لـ'lax' بهذه الحالة تحديداً.
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.USE_HTTPS === 'true', // مرتبط بـ HTTPS الفعلي (متغيّر مستقل)، وليس بوضع production بشكل عام — نظامك يشتغل حالياً عبر HTTP على شبكة محلية، فيبقى false افتراضياً حتى لو NODE_ENV=production. فعّله فقط لو نصّبت شهادة SSL حقيقية.
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // يوم واحد، نفس مدة صلاحية التوكن نفسه
    path: '/',
  });
  res.json({ token, user: safeUser });
});

router.post('/auth/logout', async (req, res) => {
  // ── إصلاح أمني: إبطال فعلي بدل مجرد مسح الكوكي ────────────────────────────
  // نحاول استخراج jti من التوكن الحالي (كوكي أو header) ونضيفه لقائمة
  // الإبطال — بهذا حتى لو احتفظ أحد بنسخة من التوكن الخام قبل تسجيل الخروج
  // (مثلاً بسجلات شبكة قديمة)، يصير مرفوضاً فوراً وليس فقط بعد يوم واحد.
  // ننتظر (await) اكتمال الإبطال بـRedis قبل الرد — جولة واحدة سريعة جداً،
  // تضمن إن "نجح تسجيل الخروج" بالرد يعني فعلاً إن التوكن أُبطِل (راجع
  // utils/tokenRevocation.js — لا ترمي استثناءً أبداً حتى لو Redis غير متاح).
  const cookieToken = req.cookies?.auth_token;
  const header = req.headers.authorization;
  const headerToken = header ? header.split(' ')[1] : null;
  const token = cookieToken || headerToken;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.jti && decoded.exp) await revokeToken(decoded.jti, decoded.exp);
    } catch { /* توكن غير صالح أصلاً — لا داعي لإبطاله، سيُرفَض بأي حال */ }
  }
  res.clearCookie('auth_token', { httpOnly: true, secure: process.env.USE_HTTPS === 'true', sameSite: 'strict', path: '/' });
  res.json({ success: true });
});

router.get('/auth/me', auth, (req, res) => {
  const db = readDB();
  const user = (db.users || []).find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'غير موجود' });
  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

module.exports = router;

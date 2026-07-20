// backend/config/rateLimiters.js
//
// كل محددات المعدل (Rate Limiters) المستخدمة بالنظام، بمكان واحد.
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./jwtConfig');

// ── دالة مشتركة: تستخرج هوية المستخدم من التوكن لو موجود وصالح، وإلا IP ────
// نقرأ التوكن يدويًا هنا (نفس طريقة middleware/auth.js بالضبط: كوكي أولاً ثم
// Authorization header) لأن generalLimiter يشتغل *قبل* middleware auth بترتيب
// server.js الحالي — فـ req.user غير موجود بعد بهذي المرحلة. لو فك تشفير
// التوكن فشل (منتهي، غير صالح، أو غير موجود أصلاً — مثل صفحة تسجيل الدخول
// نفسها)، نرجع لعنوان IP كخط احتياط، بدل ما يفشل الطلب بالكامل بخطأ غير متوقع.
const keyByUserOrIP = (req) => {
  const cookieToken = req.cookies?.auth_token;
  const header = req.headers.authorization;
  const headerToken = header ? header.split(' ')[1] : null;
  const token = cookieToken || headerToken;
  if (!token) return req.ip;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return `user:${decoded.id}`;
  } catch (e) {
    return req.ip; // توكن غير صالح/منتهي — نعامله كزائر مجهول بالـ IP
  }
};

// ── تقييد محاولات تسجيل الدخول ────────────────────────────────────────────
// يبقى بالـ IP دائمًا (بلا تغيير) — هذا مقصود: تسجيل الدخول نفسه لا يوجد له
// مستخدم مصادَق بعد أصلاً، فمفهوم "لكل مستخدم" غير منطقي هنا. هذا هو الخط
// الدفاعي ضد تخمين كلمات المرور (Brute Force)، ويجب أن يبقى صارمًا بالـ IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'محاولات دخول كثيرة جداً، حاول مرة أخرى بعد 15 دقيقة' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── تحديد معدل عام لكل مسارات API ──────────────────────────────────────────
// الآن لكل مستخدم مسجّل دخوله حصته الخاصة 300 طلب/5 دقائق، بغض النظر عن كم
// موظف ثاني يشتغل بنفس الوقت أو بنفس الشبكة (حتى لو خلف NAT مشترك). الزوار
// غير المسجّلين (توكن غير صالح أو معدوم) يبقون محدودين بالـ IP كخط احتياط.
const generalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  keyGenerator: keyByUserOrIP,
  message: { message: 'طلبات كثيرة جداً، حاول مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
});

const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: keyByUserOrIP,
  message: { message: 'عمليات استيراد كثيرة جداً، حاول مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, generalLimiter, importLimiter };

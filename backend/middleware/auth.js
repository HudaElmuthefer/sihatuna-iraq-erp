// backend/middleware/auth.js
//
// middleware مصادقة JWT موحّد. كان معرَّفاً سابقاً داخل server.js فقط، واستُخرج
// إلى هنا حتى تقدر مسارات PostgreSQL الجديدة (pgCrud.js) تستخدمه أيضاً دون
// تكرار نفس الكود بمكانين، مع بقاء سلوكه مطابقاً تماماً للسابق.
//
// يحتاج JWT_SECRET من متغيرات البيئة مباشرة بدل تمريره كوسيط، لتفادي أي حلقة
// استيراد دائرية (circular require) مع server.js.
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sihatuna-secret-2026';

// ── إصلاح أمني ────────────────────────────────────────────────────────────────
// قبل هذا التعديل، كان الفرونت إند يخزّن التوكن بـ localStorage ويرسله بـ
// Authorization header بكل طلب — أي ثغرة XSS بأي مكان بالتطبيق (حتى مستقبلية)
// كانت كافية لسرقة التوكن كاملاً وانتحال هوية المستخدم بالكامل، لأن أي كود
// جافاسكربت يشتغل بالصفحة يقدر يقرأ localStorage بسهولة.
// الآن: الفرونت إند يعتمد على httpOnly cookie (المتصفح يرسلها تلقائياً، وكود
// الجافاسكربت لا يقدر يقرأها إطلاقاً حتى لو صار XSS). نتحقق من الكوكي أولاً،
// ونبقي دعم Authorization header كخيار احتياطي فقط (لأدوات API مباشرة مثل
// Postman، أو ملفات الاختبار الآلي بمجلد tests/) — الفرونت إند نفسه ما عاد
// يستخدم هذا المسار الثاني إطلاقاً.
const auth = (req, res, next) => {
  const cookieToken = req.cookies?.auth_token;
  const header = req.headers.authorization;
  const headerToken = header ? header.split(' ')[1] : null;
  const token = cookieToken || headerToken;

  if (!token) return res.status(401).json({ message: 'غير مصرح' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'رمز منتهي الصلاحية' });
  }
};

module.exports = auth;

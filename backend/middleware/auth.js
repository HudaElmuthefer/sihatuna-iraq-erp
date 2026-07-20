// backend/middleware/auth.js
//
// middleware مصادقة JWT موحّد. كان معرَّفاً سابقاً داخل server.js فقط، واستُخرج
// إلى هنا حتى تقدر مسارات PostgreSQL الجديدة (pgCrud.js) تستخدمه أيضاً دون
// تكرار نفس الكود بمكانين، مع بقاء سلوكه مطابقاً تماماً للسابق.
//
// إصلاح: كان هذا الملف يعرّف JWT_SECRET بنفسه بقيمة افتراضية منفصلة (نص
// حرفي مكرر عن config/jwtConfig.js) — لو تغيّرت قيمة أحدهما يوماً بدون
// الثاني، تصير كل التوكنات الصادرة بمفتاح غير صالحة عند التحقق منها بالمفتاح
// الآخر بصمت تام. الآن مصدر واحد موثوق فقط (jwtConfig.js) — لا حلقة استيراد
// دائرية هنا لأن jwtConfig.js لا يستورد شي إطلاقاً.
const jwt = require('jsonwebtoken');
const { isRevoked } = require('../utils/tokenRevocation');
const { JWT_SECRET } = require('../config/jwtConfig');

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
    const decoded = jwt.verify(token, JWT_SECRET);
    // ── إصلاح أمني: إبطال فعلي عند تسجيل الخروج ──────────────────────────────
    // بدون هذا الفحص، تسجيل الخروج كان يمسح الكوكي بالمتصفح بس — التوكن نفسه
    // يبقى صالحاً بجانب الخادم حتى تنتهي مدته الطبيعية (7 أيام). الآن نتحقق
    // من قائمة الإبطال (انظر utils/tokenRevocation.js) — أي توكن سُجِّل خروج
    // منه صراحة يُرفَض فوراً حتى لو توقيعه صحيحاً وتاريخه لم ينته بعد.
    if (isRevoked(decoded.jti)) {
      return res.status(401).json({ message: 'انتهت الجلسة، الرجاء تسجيل الدخول من جديد' });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'رمز منتهي الصلاحية' });
  }
};

module.exports = auth;

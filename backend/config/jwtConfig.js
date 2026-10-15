// backend/config/jwtConfig.js
//
// مصدر واحد موثوق لمفتاح JWT بكل النظام — استُخرج من server.js حتى تستطيع ملفات
// المسارات المنفصلة (routes/authRoutes.js وغيرها) تستخدم نفس المفتاح بالضبط
// دون تكراره أو خطر عدم تطابقه بمكانين مختلفين (لو صار هذا، كل التوكنات
// الصادرة بمفتاح تصير غير صالحة عند التحقق منها بمفتاح آخر).
const DEFAULT_JWT_SECRET = 'sihatuna-secret-2026'; // منشور علناً بالمستودع — لا يصلح كمفتاح فعلي أبداً
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

// ── تحذير أمان عند بدء التشغيل ────────────────────────────────────────────────
// المفتاح الافتراضي أعلاه مكتوب صراحة بالكود (وبالتالي منشور مع أي نسخة من المشروع
// على GitHub)، فأي شخص يعرفه يستطيع إصدار توكن دخول مزوّر بصلاحية إدمن كاملة.
// لو .env الحقيقي ما يحدّد JWT_SECRET مختلفاً، يجب تنبيه المطوّر بوضوح شديد —
// وبمرحلة الإنتاج، نرفض تشغيل الخادم أصلاً بدل تشغيله بثغرة أمنية معروفة.
if (JWT_SECRET === DEFAULT_JWT_SECRET) {
  console.error('\nSECURITY WARNING: the default JWT_SECRET is still in use!');
  console.error('This key is written directly in the source code and is not secret at all --');
  console.error('anyone who sees it can forge a login token with full admin access.');
  console.error('Set JWT_SECRET in backend/.env to a strong random value, then restart.');
  console.error('Generate a random key: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n');
  if (process.env.NODE_ENV === 'production') {
    console.error('Startup aborted: NODE_ENV=production and the default key is still in use.\n');
    process.exit(1);
  }
}

module.exports = { JWT_SECRET };

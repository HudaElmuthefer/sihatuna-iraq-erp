// backend/utils/tokenRevocation.js
//
// ── إصلاح أمني: إبطال فعلي للجلسة عند تسجيل الخروج ────────────────────────────
// قبل هذا الملف، تسجيل الخروج كان يمسح الكوكي من المتصفح بس — التوكن (JWT)
// نفسه يبقى صالحاً تماماً بجانب الخادم لين تنتهي مدته الطبيعية (7 أيام)، حتى
// لو صار تسجيل الخروج. لو توكن انسرق بأي طريقة (جهاز مشترك، هجوم، إلخ) قبل
// ما يسجّل صاحبه خروج، ما فيه أي وسيلة توقفه فوراً.
//
// الحل: قائمة إبطال (Revocation List) خفيفة بالذاكرة (Set) لسرعة الفحص بكل
// طلب — كل توكن يُعطى معرّف فريد (jti) عند إصداره، وعند تسجيل الخروج يُضاف
// هذا المعرّف للقائمة، فيُرفَض أي طلب لاحق يحمل نفس التوكن حتى لو كان
// توقيعه صحيحاً وتاريخ انتهائه لم يحن بعد. القائمة تُحفَظ أيضاً بملف JSON
// بسيط (نفس نمط db.json) حتى تبقى فعّالة بعد إعادة تشغيل الخادم — بدون هذا
// الحفظ، إعادة تشغيل الخادم كانت تصفّر القائمة وتُعيد صلاحية كل التوكنات
// المبطَلة سابقاً.
const fs = require('fs');
const path = require('path');

const REVOKED_PATH = process.env.REVOKED_TOKENS_PATH || path.join(__dirname, '..', 'data', 'revoked-tokens.json');

// Map<jti, expUnixSeconds> — بالذاكرة لفحص فوري بدون أي قراءة قرص بكل طلب
const revoked = new Map();

function loadFromDisk() {
  try {
    if (!fs.existsSync(REVOKED_PATH)) return;
    const raw = fs.readFileSync(REVOKED_PATH, 'utf8');
    const entries = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);
    Object.entries(entries).forEach(([jti, exp]) => {
      if (exp > now) revoked.set(jti, exp); // نتجاهل عند التحميل أي مدخل منتهي أصلاً
    });
  } catch (err) {
    console.warn('⚠️  فشل تحميل قائمة إبطال التوكنات:', err.message);
  }
}

function saveToDisk() {
  try {
    const obj = Object.fromEntries(revoked);
    fs.writeFileSync(REVOKED_PATH, JSON.stringify(obj), 'utf8');
  } catch (err) {
    console.warn('⚠️  فشل حفظ قائمة إبطال التوكنات:', err.message);
  }
}

// تنظيف دوري: نحذف أي مدخل انتهت صلاحية توكنه الأصلي أصلاً (بعدها التوكن
// مرفوض بسبب انتهاء الصلاحية العادي، فلا داعي للاحتفاظ به بقائمة الإبطال —
// هذا يمنع نمو القائمة بلا حدود بمرور الوقت.
function cleanup() {
  const now = Math.floor(Date.now() / 1000);
  let changed = false;
  for (const [jti, exp] of revoked) {
    if (exp <= now) { revoked.delete(jti); changed = true; }
  }
  if (changed) saveToDisk();
}

function revoke(jti, exp) {
  if (!jti || !exp) return;
  revoked.set(jti, exp);
  saveToDisk();
}

function isRevoked(jti) {
  if (!jti) return false;
  return revoked.has(jti);
}

loadFromDisk();
setInterval(cleanup, 60 * 60 * 1000).unref(); // تنظيف كل ساعة، unref حتى لا يمنع إغلاق العملية

module.exports = { revoke, isRevoked };

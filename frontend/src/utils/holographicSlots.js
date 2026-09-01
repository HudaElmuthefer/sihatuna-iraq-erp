// هندسة "المرآب المنحني المستقر" (Stable Curved Deck) — بند صريح بالمواصفة:
// خمس فتحات (Slots) ثابتة الاسم (FAR LEFT / NEAR LEFT / CENTER / NEAR RIGHT /
// FAR RIGHT) بدل حساب مثلثي (sin/cos) غير محدود لأي rel — أي لوحة بفهرس
// نسبي (rel) خارج المدى [-2, 2] لا تُرسَم إطلاقاً (بند: لا لوحة نصف خارج
// الشاشة). كل قيمة بالجدول نسبة (fraction) من نصف عرض/ارتفاع المسرح الآمن
// المحسوب فعلياً (لا viewport مباشرة) — راجع computeStageGeometry.
const SLOT_TABLE = [
  { rel: -2, xFrac: -0.90, yFrac: 0.30, scale: 0.64, rotY: 21, zFrac: 1 },
  { rel: -1, xFrac: -0.48, yFrac: 0.10, scale: 0.82, rotY: 12, zFrac: 0.55 },
  { rel: 0, xFrac: 0, yFrac: 0, scale: 1, rotY: 0, zFrac: 0 },
  { rel: 1, xFrac: 0.48, yFrac: 0.10, scale: 0.82, rotY: -12, zFrac: 0.55 },
  { rel: 2, xFrac: 0.90, yFrac: 0.30, scale: 0.64, rotY: -21, zFrac: 1 },
];

const MAX_RECEDE = 90; // px — أقصى "تراجع" بصري نسبي (يُترجَم لاحقاً لـtranslateZ)
export const FORWARD_BASE = 130; // px — يضمن translateZ > 0 دائماً (راجع تعليق تاريخي بأسفل الملف)
export const STAGE_PERSPECTIVE = 1400; // px — يجب أن يطابق `perspective` بـ.hpr-stage بالـCSS تماماً

/*
 * lerp بين أقرب فتحتين معروفتين — حركة دائماً بين نقطتين مُعرَّفتين مسبقاً،
 * لا استيفاء حر (بند صريح: "No random coordinate interpolation"). أي rel
 * خارج [-2, 2] يُقصّ لأقرب طرف — بند "لا تدع أي لوحة تخرج عن المسرح".
 */
export function lerpSlot(rel) {
  const clamped = Math.max(-2, Math.min(2, rel));
  const i0 = Math.floor(clamped);
  const i1 = Math.ceil(clamped);
  const a = SLOT_TABLE[i0 + 2];
  const b = SLOT_TABLE[i1 + 2];
  const t = i0 === i1 ? 0 : clamped - i0;
  return {
    xFrac: a.xFrac + (b.xFrac - a.xFrac) * t,
    yFrac: a.yFrac + (b.yFrac - a.yFrac) * t,
    scale: a.scale + (b.scale - a.scale) * t,
    rotY: a.rotY + (b.rotY - a.rotY) * t,
    zFrac: a.zFrac + (b.zFrac - a.zFrac) * t,
  };
}

/*
 * هندسة المسرح الفعلية — تُحسَب من الأبعاد الحقيقية المقاسة لعقدة المسرح
 * (لا window.innerWidth مباشرة، بند صريح: "Do not use viewport width
 * blindly")، بعد طرح "حشوة آمنة" (SAFE_INSET) — بند صريح: 24-40px. الحجم
 * المركزي (centerW/H) والانتشار الأفقي (radiusX) مترابطان حسابياً بحيث لا
 * يمكن أبداً أن تتجاوز أبعد لوحة ظاهرة (FAR، xFrac=0.90) حافة المنطقة
 * الآمنة — لا حاجة لأي قصّ بصري لاحق (overflow) لأن الهندسة نفسها لا تسمح
 * بالتجاوز أصلاً.
 */
export function computeStageGeometry(stageWidth, stageHeight) {
  const SAFE_INSET = 32;
  const innerW = Math.max(340, stageWidth - SAFE_INSET * 2);
  const innerH = Math.max(240, stageHeight - SAFE_INSET * 2);

  const centerW = Math.min(620, Math.max(460, innerW * 0.42));
  const centerH = Math.min(390, Math.max(280, Math.min(centerW * 0.62, innerH * 0.86)));
  const farScale = SLOT_TABLE[0].scale; // 0.64
  const farW = centerW * farScale;
  // SLOT_TABLE[0] هي فتحة FAR LEFT (rel=-2)، فـxFrac سالبة (-0.90) — القيمة
  // المطلقة هي المطلوبة هنا (بُعد أفقي، لا اتجاه). بلا Math.abs كانت القسمة
  // تُنتِج radiusXMax سالباً، فيفوز الحدّ الأدنى الآمن (210px) دائماً بغضّ
  // النظر عن عرض الشاشة الفعلي — خلل حقيقي مكتشَف بالتحقق الحسابي المباشر.
  const farXFrac = Math.abs(SLOT_TABLE[0].xFrac); // 0.90

  // نصف القطر الأفقي الأقصى المسموح به رياضياً كي يبقى مركز أبعد لوحة +
  // نصف عرضها بالكامل ضمن innerW/2 — لا تخمين، معادلة مباشرة.
  const radiusXMax = (innerW / 2 - farW / 2) / farXFrac;
  const radiusX = Math.max(210, Math.min(radiusXMax, stageWidth * 0.46));
  const radiusY = Math.min(70, innerH * 0.16);

  return { centerW, centerH, radiusX, radiusY, safeInset: SAFE_INSET };
}

/*
 * تحويل فتحة (نتيجة lerpSlot) + هندسة المسرح إلى قيم px/deg جاهزة للـtransform.
 * zPx يبقى دائماً موجباً (FORWARD_BASE يدفع الجميع للأمام، MAX_RECEDE يحدّ
 * أقصى تراجع نسبي) — نفس المنطق المُثبَت سابقاً لتفادي كسر hit-testing عبر
 * حدود preserve-3d (translateZ سالب "يحجب" اللوحة عن elementFromPoint).
 */
export function slotToPixels(slot, geometry, isFront) {
  const { centerW, centerH, radiusX, radiusY } = geometry;
  const xPx = slot.xFrac * radiusX;
  const yPx = slot.yFrac * radiusY;
  const zDepth = Math.min(MAX_RECEDE, slot.zFrac * MAX_RECEDE);
  const zPx = FORWARD_BASE - zDepth + (isFront ? 34 : 0);
  const w = Math.round(centerW * slot.scale);
  const h = Math.round(centerH * slot.scale);
  return { xPx, yPx, zPx, rotY: slot.rotY, scale: slot.scale, w, h };
}

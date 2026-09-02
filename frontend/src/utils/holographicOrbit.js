// هندسة "المدار المتعدد الأنصاف" (Multi-Radius Circular Holographic Orbit) —
// بند صريح بالمواصفة: لا Carousel أفقي، لا خمس خانات متساوية. المصغرات
// موزَّعة حول مركز فارغ (المستقبِل) على مدارات دائرية/بيضاوية بأنصاف أقطار
// غير متساوية — ثمانية مواضع ثابتة الشكل (INNER×2 يمين/يسار، MIDDLE×2
// أعلى/أسفل، OUTER×4 أقطار)، والتدوير (عجلة/أسهم) يُحرِّك أي صفحة تشغل أي
// موضع — المواضع نفسها ثابتة الشكل، لا الصفحات (بند صريح: Deterministic لا
// Random، ونفس التكوين يعود بعد أي refresh لأن كل شيء دالة صرفة في
// rotationIndex).
//
// x = centerX + radiusX * cos(angle)
// y = centerY + radiusY * sin(angle)   (angle بمقياس الشاشة: 0°=يمين، 90°=أسفل)

export const ORBIT_SLOT_COUNT = 8;
// يجب أن يطابق `perspective` بـ.hpr-stage (holographic-dark.css) تماماً —
// يُستخدَم لتعويض foreshortening الطفيف أثناء السحب المباشر (بند 17: نقطة
// الإمساك تبقى بالضبط تحت المؤشر رغم عمق Z غير صفري لبعض المدارات).
export const STAGE_PERSPECTIVE = 1400;

// كل فتحة: زاوية ثابتة + أي مدار (نصف قطر/حجم) تنتمي إليه. الترتيب هنا هو
// ترتيب "الأهمية البصرية" للفتحات (بند 37: slot 0 هي الأبرز — تُستخدَم أيضاً
// كوجهة focusAndOpen القادمة من Sidebar/بحث).
const ORBIT_SLOTS = [
  { angle: 0, orbit: 'inner' }, // يمين — الأقرب أفقياً للمركز
  { angle: 270, orbit: 'middle' }, // أعلى
  { angle: 180, orbit: 'inner' }, // يسار
  { angle: 90, orbit: 'middle' }, // أسفل
  { angle: 315, orbit: 'outer' }, // أعلى-يمين
  { angle: 225, orbit: 'outer' }, // أعلى-يسار
  { angle: 45, orbit: 'outer' }, // أسفل-يمين
  { angle: 135, orbit: 'outer' }, // أسفل-يسار
];

const ORBIT_BASE = {
  inner: { radiusX: 310, radiusY: 168, scale: 0.88, zBoost: 40 },
  middle: { radiusX: 415, radiusY: 210, scale: 0.75, zBoost: 20 },
  outer: { radiusX: 515, radiusY: 250, scale: 0.63, zBoost: 0 },
};

const CENTER_IMAGE_WIDTH = 300; // px — عرض مرجعي أساسي عند scale=1 (بند 35: الحجم يعتمد على العمق لا عشوائياً)

/*
 * هندسة المسرح المستجيبة — بند 57/58/59 صراحةً: توسيع الأنصاف على شاشات
 * كبيرة (1920×1080)، وتقليل عدد الفتحات المرئية (لا تصغير الصور) على
 * شاشات ضيّقة بدل تصغيرها لحجم غير مقروء.
 */
export function computeOrbitGeometry(stageWidth, stageHeight) {
  const SAFE_INSET = 40;
  const innerW = Math.max(320, stageWidth - SAFE_INSET * 2);
  const innerH = Math.max(220, stageHeight - SAFE_INSET * 2);

  // معامل توسّع عام حسب عرض المسرح الفعلي — 1366px هو خط الأساس (1.0)، يكبر
  // تدريجياً حتى 1.35 تقريباً على شاشات واسعة جداً (1920+، بند 58).
  const widthFactor = Math.max(0.72, Math.min(1.35, stageWidth / 1366));

  // أقصى نصف قطر أفقي/رأسي مسموح به فعلياً كي يبقى أبعد مدار (outer) بالكامل
  // ضمن المنطقة الآمنة — حساب مباشر لا تخمين.
  const outerImgHalfW = (CENTER_IMAGE_WIDTH * ORBIT_BASE.outer.scale * widthFactor) / 2;
  const outerImgHalfH = (outerImgHalfW * 3) / 4 / 2; // نسبة 4:3 تقريبية لمعظم الصور المعتمَدة
  const maxRadiusX = innerW / 2 - outerImgHalfW;
  const maxRadiusY = innerH / 2 - outerImgHalfH;
  const clampFactorX = maxRadiusX > 0 ? Math.min(1, maxRadiusX / (ORBIT_BASE.outer.radiusX * widthFactor)) : 0.5;
  const clampFactorY = maxRadiusY > 0 ? Math.min(1, maxRadiusY / (ORBIT_BASE.outer.radiusY * widthFactor)) : 0.5;
  const safety = Math.min(clampFactorX, clampFactorY, 1);

  // بند 59/36 صراحةً: إذا أصبحت المساحة ضيّقة جداً (safety منخفض جداً)، قلّل
  // عدد الفتحات المرئية أولاً (استبعد outer diagonals) بدل تصغير الصور
  // لحجم غير مقروء.
  const visibleSlotCount = safety < 0.62 ? 6 : ORBIT_SLOT_COUNT;

  const orbits = {};
  for (const key of Object.keys(ORBIT_BASE)) {
    const base = ORBIT_BASE[key];
    orbits[key] = {
      radiusX: base.radiusX * widthFactor * safety,
      radiusY: base.radiusY * widthFactor * safety,
      scale: base.scale,
      zBoost: base.zBoost,
    };
  }

  return { orbits, widthFactor, safety, visibleSlotCount, centerImageWidth: CENTER_IMAGE_WIDTH * widthFactor };
}

/*
 * موضع فتحة واحدة (slotIndex 0..7) بالبكسل، جاهز لبناء transform — بند 12
 * صراحةً: x/y من الصيغة المثلثية، ثم zDepth/scale/rotateY حسب المدار.
 */
export function slotToOrbitPixels(slotIndex, geometry) {
  const slot = ORBIT_SLOTS[slotIndex % ORBIT_SLOT_COUNT];
  const orbit = geometry.orbits[slot.orbit];
  const rad = (slot.angle * Math.PI) / 180;
  const xPx = orbit.radiusX * Math.cos(rad);
  const yPx = orbit.radiusY * Math.sin(rad);
  // انحدار Z بسيط حسب المدار (الأبعد أكثر تراجعاً بصرياً، بند 12: zDepth حسب radius)
  const zPx = orbit.zBoost;
  // rotateY خفيف يواجه المركز تقريباً — يسار الشاشة يميل يميناً نحو المركز والعكس.
  const rotY = Math.max(-16, Math.min(16, -Math.cos(rad) * 14));
  const w = Math.round(geometry.centerImageWidth * orbit.scale);
  return { xPx, yPx, zPx, rotY, scale: orbit.scale, w, orbitKey: slot.orbit };
}

export { ORBIT_SLOTS };

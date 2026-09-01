import React, { useRef, useState } from 'react';

const CLICK_MOVE_THRESHOLD = 6; // px — أقل من هذا يُحتسب نقراً، أكثر يُحتسب سحباً

// هندسة صريحة (لا تعتمد على rotateY وحدها لدفع الموضع الأفقي، كما كانت
// سابقاً) — بند صريح بالمواصفة: x/zDepth محسوبان من angle بصيغة قطع ناقص
// حقيقية، ودوران وجه اللوحة (rotateY) منفصل عنهما بخطوة أخف بكثير، حتى لا
// تصل اللوحات المرئية إلى زوايا حادة (60-80°) تجعلها تبدو شبه جانبية.
// ANGLE_STEP أكبر بكثير من محاولة أولى (13° ثم 26°) — قياس فعلي عبر
// getBoundingClientRect (لا تخمين) أظهر أن 26° ينتج تراكباً حقيقياً بنسبة
// ~40-65% بين اللوحات المتجاورة على 1366px. 35° مع radiusX أكبر يقارب
// الحد الأقصى المسموح بالمواصفة (5-12% تراكب) عند هذا العرض تحديداً.
const ANGLE_STEP = 35; // درجة — يُستخدم فقط لحساب x/zDepth (الانتشار الأفقي/العمق)
const ROTATION_STEP = 6; // درجة — دوران وجه اللوحة نفسه (قريب = خفيف جداً، بعيد = معتدل)
const MAX_ROTATION = 20;
// بند حرج جداً: أي translateZ سالب (لوحة "متراجعة خلف" مستوى z=0 الضمني
// لأسلاف preserve-3d/perspective غير المُحوَّلين) يكسر اختبار الإصابة
// (hit-testing) الفعلي بالمتصفح لتلك اللوحة تماماً — مؤكَّد فعلياً عبر
// elementFromPoint()، وليس نظرياً: أي سلف غير مُستثنى صراحةً بـ
// pointer-events:none "يفوز" باختبار الإصابة بدل اللوحة، وهذا يتصاعد عبر
// كل سلف تباعاً (استثناء واحد لا يكفي، والاستثناء الشامل لكل الأسلاف حتى
// body غير عملي). الحل الجذري: لا تسمح لأي لوحة بالتراجع خلف z=0 إطلاقاً —
// FORWARD_BASE يدفع الجميع لمقدمة موجبة دائماً، وMAX_RECEDE يحدّ من أقصى
// تراجع نسبي (بدل قيمة radiusY الأصلية غير المحدودة) فيبقى الهامش الآمن
// فوق الصفر مضموناً حتى عند أبعد لوحة مرئية.
const MAX_RECEDE = 90; // px — أقصى "تراجع" نسبي مسموح، بصرف النظر عن radiusY
const FORWARD_BASE = 130; // px — يضمن translateZ > 0 دائماً حتى عند MAX_RECEDE الكامل

// عرض/ارتفاع كل لوحة يُشتقّان صراحةً من بُعدها عن المختارة (t = |rel|/range)
// بدل الاعتماد على transform:scale لتغيير الحجم — عرض صريح لكل مستوى يمنح
// تحكماً مباشراً بالتباعد الفعلي بين اللوحات المتجاورة (تفادي التراكب).
function sizeForTier(absRel) {
  if (absRel <= 0.5) return { w: 'clamp(320px, 28vw, 420px)', h: 'clamp(210px, 18vw, 270px)' };
  if (absRel <= 1.5) return { w: 'clamp(190px, 17vw, 235px)', h: 'clamp(170px, 14vw, 210px)' };
  return { w: 'clamp(150px, 12vw, 185px)', h: 'clamp(140px, 11vw, 170px)' };
}

/*
 * لوحة واحدة على الحلقة — موضعها ثلاثي الأبعاد مُشتقّ بالكامل من `rel`
 * (الفهرس النسبي عن اللوحة المختارة حالياً) ونصفي القطر المُستجيبين
 * (radiusX الانتشار الأفقي، radiusY العمق) المُمرَّرين من الأب. اللوحة
 * الأمامية (isFront) فقط قابلة للسحب نحو منطقة الإفلات المركزية
 * (drag-to-center)؛ أي لوحة أخرى تُحرِّك الحلقة إليها عند النقر (select)
 * بدل فتحها مباشرة.
 */
export default function HolographicPagePanel({
  page, rel, radiusX, radiusY, isFront, isOpening, isDragCandidate,
  onSelect, onOpen, dropZoneRef, lang,
}) {
  const panelRef = useRef(null);
  const pointerStart = useRef(null);
  const [centerDrag, setCenterDrag] = useState(null); // {x,y} أثناء سحب اللوحة الأمامية نحو المركز
  const [magnetActive, setMagnetActive] = useState(false);

  const absRel = Math.abs(rel);
  const angleRad = (rel * ANGLE_STEP) * Math.PI / 180;
  const x = radiusX * Math.sin(angleRad);
  const zDepth = Math.min(MAX_RECEDE, radiusY * (1 - Math.cos(angleRad))); // >=0، محدود بـMAX_RECEDE — يزداد كلما ابتعدنا
  const rotY = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, rel * ROTATION_STEP));

  const { w, h } = sizeForTier(absRel);

  // شفافية مقروءة دائماً (بند صريح: لا opacity منخفضة جداً للّوحات
  // المرئية) — 1 / 0.85-0.95 / 0.6-0.78 حسب البُعد، لا تدرّج نحو الصفر.
  const opacity = absRel < 0.5 ? 1 : Math.max(0.6, 0.95 - absRel * 0.13);
  const zIndex = 1000 - Math.round(absRel * 10);
  const brightness = isFront ? 1.08 : Math.max(0.75, 1 - absRel * 0.1);

  const label = lang === 'ar' ? page.label : (page.labelEn || page.label);
  const PreviewComponent = page.PreviewComponent;

  const translateZ = FORWARD_BASE - zDepth + (isFront ? 34 : 0); // يبقى موجباً دائماً — راجع تعليق MAX_RECEDE/FORWARD_BASE أعلاه
  const baseTransform = `translate(-50%, -50%) translateX(${x}px) translateZ(${translateZ}px) rotateY(${rotY}deg) scale(${isFront ? 1.03 : 1})`;

  const handlePointerDown = (e) => {
    // اللوحة الأمامية فقط توقف انتشار الحدث — سحبها يعني سحبها هي نحو
    // المركز حصراً، لا تدوير الحلقة بالتوازي. أي لوحة أخرى تترك الحدث يصعد
    // لمعالج تدوير الحلقة بالمسرح (بند: يمكن بدء تدوير الحلقة من فوق أي
    // لوحة، لا حافة فارغة فقط).
    if (isFront) e.stopPropagation();
    pointerStart.current = { x: e.clientX, y: e.clientY, moved: false, dragging: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const handlePointerMove = (e) => {
    if (isFront) e.stopPropagation();
    const st = pointerStart.current;
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (!st.moved && Math.hypot(dx, dy) > CLICK_MOVE_THRESHOLD) st.moved = true;
    // فقط اللوحة الأمامية قابلة للسحب الفعلي نحو المركز (بند "المسحوبة
    // فعلياً نحو مساحة العمل" صراحةً بالمواصفة).
    if (isFront && st.moved) {
      st.dragging = true;
      setCenterDrag({ x: dx, y: dy });
      const zoneRect = dropZoneRef.current?.getBoundingClientRect();
      const panelRect = panelRef.current?.getBoundingClientRect();
      if (zoneRect && panelRect) {
        const px = panelRect.left + panelRect.width / 2;
        const py = panelRect.top + panelRect.height / 2;
        const inside = px >= zoneRect.left && px <= zoneRect.right && py >= zoneRect.top && py <= zoneRect.bottom;
        setMagnetActive(inside);
        dropZoneRef.current?.classList.toggle('hcd-armed', inside);
      }
    }
  };

  const handlePointerUp = (e) => {
    if (isFront) e.stopPropagation();
    const st = pointerStart.current;
    pointerStart.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!st) return;
    dropZoneRef.current?.classList.remove('hcd-armed');
    if (st.dragging) {
      const wasMagnet = magnetActive;
      setCenterDrag(null);
      setMagnetActive(false);
      if (wasMagnet) { onOpen(); return; }
      return; // سحب بلا وصول للمنطقة المركزية → يرتد للحلقة (transform الأصلي يعود تلقائياً)
    }
    if (!st.moved) {
      // نقرة عادية (بلا حركة فعلية) — نتولّى فتح/تحريك الحلقة بأنفسنا هنا،
      // ويجب إيقاف انتشار الحدث: بلا هذا، معالج سحب الحلقة بالمسرح (bubbled
      // من نفس حدث pointerup) كان يُنفَّذ بعدنا مباشرة ويُعيد "الالتقاط"
      // (snap) للموضع الحالي القديم — يُلغي فعلياً حركة onSelect/onOpen
      // التي بدأناها للتو بسباق تعارض حقيقي (لوحة غير أمامية تُنقَر فلا
      // يحدث شيء لأن الحلقة "ترتد" لموضعها فوراً).
      e.stopPropagation();
      if (isFront) onOpen(); else onSelect();
    }
    // سحب حقيقي (st.moved) على لوحة غير أمامية: نترك الحدث يصعد عمداً كي
    // يُنجز معالج تدوير الحلقة بالمسرح الالتقاط الطبيعي لأقرب لوحة.
  };

  const dragTransform = centerDrag
    ? `translate(-50%, -50%) translate(${centerDrag.x}px, ${centerDrag.y}px) scale(${magnetActive ? 1.18 : 1.04})`
    : null;

  return (
    <div
      ref={panelRef}
      className={[
        'hpp',
        isFront ? 'hpp-front' : '',
        isOpening ? 'hpp-opening' : '',
        magnetActive ? 'hpp-magnet' : '',
        isDragCandidate ? 'hpp-draggable' : '',
      ].filter(Boolean).join(' ')}
      style={{
        width: w,
        height: h,
        transform: dragTransform || baseTransform,
        opacity: isOpening ? 1 : opacity,
        zIndex: centerDrag ? 2000 : (isFront ? 999 : zIndex),
        filter: `brightness(${brightness})`,
        transition: centerDrag ? 'none' : undefined,
        cursor: isFront ? 'grab' : 'pointer',
      }}
      role="button"
      tabIndex={-1}
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <span className="hpp-edge-top" aria-hidden="true" />
      <span className="hpp-edge-bottom" aria-hidden="true" />
      <span className="hpp-reflection" aria-hidden="true" />
      <PreviewComponent page={page} lang={lang} />
    </div>
  );
}

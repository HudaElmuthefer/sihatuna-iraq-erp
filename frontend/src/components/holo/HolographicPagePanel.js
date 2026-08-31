import React, { useRef, useState } from 'react';
import MiniPagePreview from './MiniPagePreview';
import { VISIBLE_RANGE } from '../../hooks/useHolographicRing';

const CLICK_MOVE_THRESHOLD = 6; // px — أقل من هذا يُحتسب نقراً، أكثر يُحتسب سحباً

/*
 * لوحة واحدة على الحلقة — موضعها ثلاثي الأبعاد (rotateY + translateZ + scale
 * + opacity) مُشتقّ بالكامل من `rel` (الفهرس النسبي عن اللوحة المختارة حالياً)
 * ونصف القطر المُستجيب المُمرَّر من الأب. اللوحة الأمامية (isFront) فقط قابلة
 * للسحب نحو منطقة الإفلات المركزية (drag-to-center)؛ أي لوحة أخرى تُحرِّك
 * الحلقة إليها عند النقر (select) بدل فتحها مباشرة.
 */
export default function HolographicPagePanel({
  page, rel, radius, isFront, isOpening, isDragCandidate,
  onSelect, onOpen, dropZoneRef, lang,
}) {
  const panelRef = useRef(null);
  const pointerStart = useRef(null);
  const [centerDrag, setCenterDrag] = useState(null); // {x,y} أثناء سحب اللوحة الأمامية نحو المركز
  const [magnetActive, setMagnetActive] = useState(false);

  const angleDeg = rel * 13;
  const absRel = Math.abs(rel);
  if (absRel > VISIBLE_RANGE) return null;

  const t = Math.min(1, absRel / VISIBLE_RANGE);
  const opacity = Math.max(0, 1 - t * 1.05);
  const scale = isFront ? 1.16 : Math.max(0.5, 1 - t * 0.55);
  const zIndex = 1000 - Math.round(absRel * 10);
  const brightness = isFront ? 1 : Math.max(0.45, 1 - t * 0.6);

  const label = lang === 'ar' ? page.label : (page.labelEn || page.label);

  const baseTransform = `translate(-50%, -50%) rotateY(${angleDeg}deg) translateZ(${radius}px) scale(${scale})`;

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
    ? `translate(-50%, -50%) translate(${centerDrag.x}px, ${centerDrag.y}px) scale(${magnetActive ? 1.22 : 1.05})`
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
      <div className="hpp-icon">{page.icon}</div>
      <div className="hpp-title">{label}</div>
      <div className="hpp-preview"><MiniPagePreview page={page} lang={lang} /></div>
    </div>
  );
}

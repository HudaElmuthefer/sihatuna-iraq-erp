import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import useHolographicRing, { VISIBLE_RANGE } from '../../hooks/useHolographicRing';
import HolographicPagePanel from './HolographicPagePanel';

function useResponsiveRadius(stageRef) {
  const [radius, setRadius] = useState(340);
  useEffect(() => {
    const compute = () => {
      const w = stageRef.current?.clientWidth || window.innerWidth;
      // نصف قطر مستجيب — أضيق بكثير على 1366×768 (بند صريح بالمواصفة) دون
      // أن يصبح ضيقاً جداً على شاشات كبيرة.
      setRadius(Math.min(420, Math.max(220, w * 0.24)));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [stageRef]);
  return radius;
}

/*
 * حلقة الصفحات الهولوغرافية ثلاثية الأبعاد — قوس C (تقريباً 240°-260° فعلياً
 * عبر VISIBLE_RANGE×ANGLE_STEP) حول مساحة العمل المركزية. تدعم: سحب المؤشر،
 * عجلة الفأرة، لوحة المفاتيح، وزرّي تنقّل صغيرين (بند الوصول: النقر/لوحة
 * المفاتيح/السايدبار تبقى دائماً بدائل عن السحب).
 */
const HolographicPageRing = forwardRef(function HolographicPageRing(
  { pages, lang, dropZoneRef, onOpenPage },
  ref
) {
  const stageRef = useRef(null);
  const radius = useResponsiveRadius(stageRef);

  const handleOpenByIndex = useCallback((index) => {
    onOpenPage(pages[index]);
  }, [onOpenPage, pages]);

  // البدء من منتصف قائمة الصفحات (لا 0) — حتى تظهر الحلقة متناظرة الشكل
  // القوسي حول المركز فور التحميل (لوحات على الجانبين)، بدل تكديس أحادي
  // الجانب لو بدأنا من أول صفحة بالقائمة.
  const initialIndex = Math.floor((pages.length - 1) / 2);
  const ring = useHolographicRing(pages.length, handleOpenByIndex, initialIndex);

  useImperativeHandle(ref, () => ({
    selectAndOpen(pageKey) {
      const idx = pages.findIndex(p => p.key === pageKey);
      if (idx >= 0) ring.selectOrOpen(idx);
    },
    resetOpening: ring.resetOpening,
  }), [pages, ring]);

  // React يُلحِق مستمع onWheel المُفوَّض عبر الجذر بخاصية passive افتراضياً
  // بمتصفحات حديثة — ما يمنع e.preventDefault() من العمل فعلياً بصمت (لا
  // خطأ ظاهر، فقط تمرير الصفحة الطبيعي يستمر بجانب دوران الحلقة). إلحاق
  // مستمع أصلي مباشرة على عقدة المسرح مع passive:false يضمن عمل preventDefault.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    el.addEventListener('wheel', ring.onWheel, { passive: false });
    return () => el.removeEventListener('wheel', ring.onWheel);
  }, [ring.onWheel]);

  const stageDragState = useRef(null);
  const handleStagePointerDown = (e) => {
    stageDragState.current = true;
    ring.dragHandlers.onPointerDown(e);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const handleStagePointerMove = (e) => {
    if (!stageDragState.current) return;
    ring.dragHandlers.onPointerMoveDrag(e, stageRef.current?.clientWidth || 800);
  };
  const handleStagePointerUp = (e) => {
    if (!stageDragState.current) return;
    stageDragState.current = false;
    ring.dragHandlers.onPointerUpDrag();
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const roundedSelected = Math.round(ring.continuousPosition);
  const startIdx = Math.max(0, roundedSelected - VISIBLE_RANGE - 1);
  const endIdx = Math.min(pages.length - 1, roundedSelected + VISIBLE_RANGE + 1);
  const visiblePages = [];
  for (let i = startIdx; i <= endIdx; i++) visiblePages.push(i);

  return (
    <div
      ref={stageRef}
      className={`hpr-stage ${ring.isDragging ? 'hpr-dragging' : ''}`}
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
      onPointerCancel={handleStagePointerUp}
      onKeyDown={ring.onKeyDown}
      tabIndex={0}
      role="listbox"
      aria-label={lang === 'ar' ? 'حلقة تنقّل الصفحات' : 'Page navigation ring'}
    >
      <div className="hpr-scene">
        {visiblePages.map((i) => {
          const page = pages[i];
          const rel = i - ring.continuousPosition;
          const isFront = i === roundedSelected;
          return (
            <HolographicPagePanel
              key={page.key}
              page={page}
              rel={rel}
              radius={radius}
              isFront={isFront}
              isDragCandidate={isFront}
              isOpening={ring.openingIndex === i}
              onSelect={() => ring.goTo(i)}
              onOpen={() => ring.selectOrOpen(i)}
              dropZoneRef={dropZoneRef}
              lang={lang}
            />
          );
        })}
      </div>

      <div className="hpr-controls" aria-hidden="true">
        <button type="button" className="hpr-nav-btn" onClick={() => ring.goTo(roundedSelected - 1)} title={lang === 'ar' ? 'السابق' : 'Previous'}>
          <FaChevronRight />
        </button>
        <button type="button" className="hpr-nav-btn" onClick={() => ring.goTo(roundedSelected + 1)} title={lang === 'ar' ? 'التالي' : 'Next'}>
          <FaChevronLeft />
        </button>
      </div>
    </div>
  );
});

export default HolographicPageRing;

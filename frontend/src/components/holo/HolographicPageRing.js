import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import useHolographicRing from '../../hooks/useHolographicRing';
import HolographicPagePanel from './HolographicPagePanel';
import HolographicInteractionOverlay from './HolographicInteractionOverlay';
import { computeStageGeometry } from '../../utils/holographicSlots';

// عدد الفتحات الظاهرة ثابت دائماً عند 5 (بند صريح بالمواصفة — Part A: "5
// visible page screens... deterministic", لا رقم مستجيب حسب العرض بعد
// الآن — القراءة تُدار الآن عبر حجم الفتحة نفسها (centerW/H) لا عبر عددها).
const VISIBLE_RANGE = 2;

function useResponsiveStageGeometry(stageRef) {
  const [geo, setGeo] = useState(() => computeStageGeometry(1300, 520));
  useEffect(() => {
    const compute = () => {
      const el = stageRef.current;
      const w = el?.clientWidth || window.innerWidth;
      const h = el?.clientHeight || 520;
      setGeo(computeStageGeometry(w, h));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [stageRef]);
  return geo;
}

/*
 * حلقة الصفحات الهولوغرافية — "مرآب منحني مستقر" (Stable Curved Deck): خمس
 * فتحات محسوبة رياضياً بحيث لا تتجاوز أبعدها حدود المسرح الآمنة إطلاقاً
 * (راجع utils/holographicSlots.js). تدعم: سحب المؤشر لتدوير الحلقة، سحب
 * اللوحة الأمامية حصراً نحو مركز الإفلات (حبل طاقة + صوت يتفاعلان مع
 * السرعة معاً)، عجلة الفأرة، لوحة المفاتيح، وزرّي تنقّل صغيرين.
 */
const HolographicPageRing = forwardRef(function HolographicPageRing(
  { pages, lang, dropZoneRef, onOpenPage },
  ref
) {
  const stageRef = useRef(null);
  const tetherApi = useRef(null);
  const stageVelocity = useRef(null);
  const geometry = useResponsiveStageGeometry(stageRef);
  // آلة حالة تفاعل صريحة مشتركة (بند Part 1/4/8 صراحةً) — 'idle' |
  // 'ring-rotate' | 'page-drag'. ref لا state: تُقرأ/تُكتَب من معالجات
  // مؤشر عالية التردد بلا أي إعادة تصيير. الاستبعاد المتبادل بين تدوير
  // الحلقة والسحب المباشر للوحة مضمون أصلاً بنيوياً (stopPropagation
  // بـHolographicPagePanel.js عند isFront)؛ هذا المرجع يضيف تحققاً صريحاً
  // إضافياً + يتيح إلغاء آمن بمفتاح Escape (بند 55) من مستوى المسرح.
  const interactionModeRef = useRef('idle');
  const cancelPageDragRef = useRef(null);

  const handleOpenByIndex = useCallback((index) => {
    onOpenPage(pages[index]);
  }, [onOpenPage, pages]);

  const dashboardIdx = pages.findIndex(p => p.key === 'dashboard');
  const initialIndex = dashboardIdx >= 0 ? dashboardIdx : Math.floor((pages.length - 1) / 2);
  const ring = useHolographicRing(pages.length, handleOpenByIndex, initialIndex);

  useImperativeHandle(ref, () => ({
    selectAndOpen(pageKey) {
      const idx = pages.findIndex(p => p.key === pageKey);
      if (idx >= 0) ring.selectOrOpen(idx);
    },
    resetOpening: ring.resetOpening,
  }), [pages, ring]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    el.addEventListener('wheel', ring.onWheel, { passive: false });
    return () => el.removeEventListener('wheel', ring.onWheel);
  }, [ring.onWheel]);

  // بند 55 صراحةً: Escape يجب أن يُلغي سحب صفحة نشطاً بصرف النظر عن تركيز
  // لوحة المفاتيح — mousedown على لوحة (tabIndex=-1 عمداً) لا يُحرِّك تركيز
  // المستند فعلياً، فمعالج onKeyDown على .hpr-stage وحده (يعتمد على أن
  // العنصر يحمل التركيز) قد لا يستقبل الحدث إطلاقاً أثناء سحب بالماوس فقط.
  // مستمع عالمي على window يضمن عمل Escape بصرف النظر عن التركيز الفعلي.
  useEffect(() => {
    const onWindowKeyDown = (e) => {
      if (e.key === 'Escape' && interactionModeRef.current === 'page-drag' && cancelPageDragRef.current) {
        e.preventDefault();
        cancelPageDragRef.current();
      }
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, []);

  // بند 55/56 صراحةً: أثناء "فتح" لوحة (بعد الالتقاط، قبل التنقّل الفعلي)
  // تُجمَّد كل مدخلات تدوير الحلقة (سحب/عجلة/لوحة مفاتيح) — الفهرس المختار
  // لا يجب أن يتغيّر أثناء حركة الانفصال/التكبير البصرية.
  const isOpeningRef = useRef(false);
  isOpeningRef.current = ring.openingIndex !== null;

  const stageDragState = useRef(null);
  const stageDownPos = useRef(null);
  const stageCaptured = useRef(false);
  const handleStagePointerDown = (e) => {
    if (isOpeningRef.current) return;
    // بند 4 صراحةً: pointerdown الذي يصل هنا لم يُوقَف انتشاره من أي لوحة
    // أمامية (تلك تتولّى نفسها) — إذاً هذا سطح/حلقة فارغة تحديداً، ولا
    // يجوز الدخول إن كان وضع سحب صفحة مباشر نشطاً فعلاً بالفعل (دفاعي).
    if (interactionModeRef.current === 'page-drag') return;
    stageDragState.current = true;
    stageCaptured.current = false;
    stageDownPos.current = { x: e.clientX, y: e.clientY };
    ring.dragHandlers.onPointerDown(e);
  };
  const handleStagePointerMove = (e) => {
    if (!stageDragState.current || isOpeningRef.current) return;
    if (interactionModeRef.current === 'page-drag') return;
    if (!stageCaptured.current) {
      const dx = e.clientX - stageDownPos.current.x;
      const dy = e.clientY - stageDownPos.current.y;
      if (Math.hypot(dx, dy) <= 6) return;
      stageCaptured.current = true;
      interactionModeRef.current = 'ring-rotate';
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      document.documentElement.classList.add('holo-cursor-grab');
      stageVelocity.current = null;
    }
    ring.dragHandlers.onPointerMoveDrag(e, stageRef.current?.clientWidth || 800, VISIBLE_RANGE);
    // حبل طاقة خفيف أثناء تدوير الحلقة أيضاً — من نقطة القبض الأصلية إلى
    // المؤشر الحالي (تجربة موحّدة مع سحب اللوحة الأمامية نحو المركز).
    // إحداثيات نسبية لصندوق المسرح — راجع التعليق المطابق بـHolographicPagePanel.js.
    const stageRect = stageRef.current?.getBoundingClientRect();
    if (tetherApi.current && stageDownPos.current && stageRect) {
      tetherApi.current.showTether(
        stageDownPos.current.x - stageRect.left,
        stageDownPos.current.y - stageRect.top,
        e.clientX - stageRect.left,
        e.clientY - stageRect.top,
        0.4
      );
    }
  };
  const handleStagePointerUp = (e) => {
    if (!stageDragState.current) return;
    stageDragState.current = false;
    document.documentElement.classList.remove('holo-cursor-grab');
    tetherApi.current?.hideTether();
    if (stageCaptured.current) {
      ring.dragHandlers.onPointerUpDrag();
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    // بند 5: يعود الوضع idle فقط عند pointerup/cancel/lostpointercapture —
    // لا مكان آخر يُعيد تعيينه وسط الإيماءة.
    interactionModeRef.current = 'idle';
  };

  const handleKeyDown = (e) => {
    // بند 55 صراحةً: Escape أثناء سحب صفحة مباشر يُلغي السحب بأمان (يعيدها
    // لفتحتها، يوقف الصوت، يخفي الحبل/المستقبِل) — لا فتح، لا بقاء عالق.
    if (e.key === 'Escape' && interactionModeRef.current === 'page-drag' && cancelPageDragRef.current) {
      e.preventDefault();
      cancelPageDragRef.current();
      return;
    }
    if (isOpeningRef.current) return;
    ring.onKeyDown(e);
  };

  const roundedSelected = Math.round(ring.continuousPosition);
  const startIdx = Math.max(0, roundedSelected - VISIBLE_RANGE);
  const endIdx = Math.min(pages.length - 1, roundedSelected + VISIBLE_RANGE);
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
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="listbox"
      aria-label={lang === 'ar' ? 'حلقة تنقّل الصفحات' : 'Page navigation ring'}
    >
      <div className="hpr-track" aria-hidden="true">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="hpr-track-svg">
          <path d="M 2 32 Q 50 2 98 32" />
        </svg>
      </div>

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
              geometry={geometry}
              isFront={isFront}
              isDragCandidate={isFront}
              isOpening={ring.openingIndex === i}
              onSelect={() => ring.goTo(i)}
              onOpen={() => ring.selectOrOpen(i)}
              dropZoneRef={dropZoneRef}
              lang={lang}
              tetherApi={tetherApi}
              stageRef={stageRef}
              interactionModeRef={interactionModeRef}
              cancelPageDragRef={cancelPageDragRef}
            />
          );
        })}
      </div>

      <HolographicInteractionOverlay ref={tetherApi} />

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

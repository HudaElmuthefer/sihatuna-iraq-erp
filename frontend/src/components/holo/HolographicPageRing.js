import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import useHolographicOrbit from '../../hooks/useHolographicOrbit';
import HolographicPagePanel from './HolographicPagePanel';
import HolographicInteractionOverlay from './HolographicInteractionOverlay';
import { computeOrbitGeometry } from '../../utils/holographicOrbit';

function useResponsiveOrbitGeometry(stageRef) {
  const [geo, setGeo] = useState(() => computeOrbitGeometry(1300, 520));
  useEffect(() => {
    const compute = () => {
      const el = stageRef.current;
      const w = el?.clientWidth || window.innerWidth;
      const h = el?.clientHeight || 520;
      setGeo(computeOrbitGeometry(w, h));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [stageRef]);
  return geo;
}

/*
 * "المدار الهولوغرافي المتعدد" — بند صريح بالمواصفة: لا Carousel أفقي بعد
 * الآن. المصغرات (صور مقعّرة ذات قاعدة، أو بديل تطوير/إنتاج للصفحات
 * الناقصة) موزَّعة حول مركز فارغ (المستقبِل، CenterDropZone) على ثمانِ
 * فتحات ثابتة الشكل بأنصاف أقطار مختلفة (راجع utils/holographicOrbit.js).
 * التدوير (Wheel/Arrow) يُحرِّك أي صفحة تشغل أي فتحة خطوة واحدة فقط في كل
 * مرة — لا سحب لكامل المشهد بعد الآن (بند 53/54 صراحةً). سحب لوحة واحدة
 * نحو المركز أصبح خاصية كل لوحة بذاتها (HolographicPagePanel.js) — مستقل
 * تماماً عن التدوير، فلا تعارض وضع تفاعل بينهما.
 */
const HolographicPageRing = forwardRef(function HolographicPageRing(
  { pages, lang, dropZoneRef, onOpenPage },
  ref
) {
  const stageRef = useRef(null);
  const tetherApi = useRef(null);
  const cancelPageDragRef = useRef(null);
  const geometry = useResponsiveOrbitGeometry(stageRef);

  const handleOpenByIndex = useCallback((index) => {
    onOpenPage(pages[index]);
  }, [onOpenPage, pages]);

  const dashboardIdx = pages.findIndex(p => p.key === 'dashboard');
  const initialIndex = dashboardIdx >= 0 ? dashboardIdx : 0;
  const orbit = useHolographicOrbit(pages.length, handleOpenByIndex, initialIndex);

  useImperativeHandle(ref, () => ({
    selectAndOpen(pageKey) {
      const idx = pages.findIndex(p => p.key === pageKey);
      if (idx >= 0) orbit.focusAndOpen(idx);
    },
    resetOpening: orbit.resetOpening,
  }), [pages, orbit]);

  // بند حرج مكتشَف بالتحقق المباشر: .hpr-stage نفسها pointer-events:none
  // (ضرورية لتفادي خلل اختبار إصابة تاريخي عبر preserve-3d، راجع التعليق
  // بالـCSS) — بما أن مركز المدار أصبح فارغاً عمداً الآن (بند 13/45)، عجلة
  // الفأرة فوق تلك النقطة بالضبط لا تجد أي هدف إصابة حقيقي داخل شجرة
  // المسرح إطلاقاً (لا لوحة تشغل تلك النقطة)، فلا تصل مستمعاً مُلحَقاً بالعقدة
  // نفسها أبداً. مستمع عالمي على window مع تحقّق صريح من حدود المسرح يتجاوز
  // هذه المشكلة كلياً — بلا حاجة لإعادة فتح pointer-events على المسرح.
  const { onWheel } = orbit;
  useEffect(() => {
    const onWindowWheel = (e) => {
      const el = stageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      onWheel(e);
    };
    window.addEventListener('wheel', onWindowWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWindowWheel);
  }, [onWheel]);

  // بند 55 صراحةً: Escape يُلغي سحب لوحة نشطاً بصرف النظر عن تركيز لوحة
  // المفاتيح — mousedown على لوحة (tabIndex=-1 عمداً) لا يُحرِّك تركيز
  // المستند فعلياً، فمستمع عالمي على window يضمن عمل Escape دائماً.
  useEffect(() => {
    const onWindowKeyDown = (e) => {
      if (e.key === 'Escape' && cancelPageDragRef.current) {
        e.preventDefault();
        cancelPageDragRef.current();
      }
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, []);

  const wrap = useCallback((v) => ((v % pages.length) + pages.length) % pages.length, [pages.length]);
  const visibleCount = Math.min(geometry.visibleSlotCount, pages.length);
  const slots = [];
  for (let s = 0; s < visibleCount; s++) {
    const pageIndex = wrap(orbit.rotationIndex + s);
    slots.push({ slotIndex: s, pageIndex, page: pages[pageIndex] });
  }

  return (
    <div
      ref={stageRef}
      className="hpr-stage"
      onKeyDown={orbit.onKeyDown}
      tabIndex={0}
      role="listbox"
      aria-label={lang === 'ar' ? 'مدار تنقّل الصفحات الهولوغرافي' : 'Holographic page orbit'}
    >
      {/* بند 46 صراحةً: 2-3 خطوط مدار بيضاوية مكسورة خلف المصغرات، شفافية
          منخفضة جداً، كل مدار نصف قطر مختلف — أبعاد مطابقة تماماً لهندسة
          الفتحات الفعلية (geometry.orbits) لا قيم عشوائية. */}
      <div className="hpr-orbit-lines" aria-hidden="true">
        {['inner', 'middle', 'outer'].map((key) => (
          <span
            key={key}
            className={`hpr-orbit-line hpr-orbit-line-${key}`}
            style={{
              width: geometry.orbits[key].radiusX * 2,
              height: geometry.orbits[key].radiusY * 2,
            }}
          />
        ))}
      </div>

      <div className="hpr-scene">
        {slots.map(({ slotIndex, pageIndex, page }) => (
          <HolographicPagePanel
            key={page.key}
            page={page}
            pageIndex={pageIndex}
            slotIndex={slotIndex}
            orbitGeometry={geometry}
            isOpening={orbit.openingIndex === pageIndex}
            onOpen={(idx) => orbit.triggerOpen(idx)}
            dropZoneRef={dropZoneRef}
            lang={lang}
            tetherApi={tetherApi}
            stageRef={stageRef}
            cancelPageDragRef={cancelPageDragRef}
          />
        ))}
      </div>

      <HolographicInteractionOverlay ref={tetherApi} />

      <div className="hpr-controls" aria-hidden="true">
        <button type="button" className="hpr-nav-btn" onClick={() => orbit.rotateBy(1)} title={lang === 'ar' ? 'السابق' : 'Previous'}>
          <FaChevronRight />
        </button>
        <button type="button" className="hpr-nav-btn" onClick={() => orbit.rotateBy(-1)} title={lang === 'ar' ? 'التالي' : 'Next'}>
          <FaChevronLeft />
        </button>
      </div>
    </div>
  );
});

export default HolographicPageRing;

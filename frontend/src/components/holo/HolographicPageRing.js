import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import useHolographicRing from '../../hooks/useHolographicRing';
import HolographicPagePanel from './HolographicPagePanel';

function useResponsiveGeometry(stageRef) {
  const [geo, setGeo] = useState({ radiusX: 420, radiusY: 160, visibleRange: 2 });
  useEffect(() => {
    const compute = () => {
      const w = stageRef.current?.clientWidth || window.innerWidth;
      // بند صريح بالمواصفة: نطاقات radiusX/radiusY تقريبية، تُضبَط فعلياً
      // حسب المساحة المتاحة — لا أرقام نهائية. عدد اللوحات المرئية أيضاً
      // يزداد مع اتساع الشاشة (5 على شاشات ضيقة، حتى 7 على شاشات كبيرة).
      const radiusX = Math.min(680, Math.max(400, w * 0.46));
      const radiusY = Math.min(210, Math.max(130, w * 0.13));
      const visibleRange = w >= 1600 ? 3 : 2;
      setGeo({ radiusX, radiusY, visibleRange });
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [stageRef]);
  return geo;
}

/*
 * حلقة الصفحات الهولوغرافية ثلاثية الأبعاد — قوس واسع (لا يزيد عادةً عن
 * ±(visibleRange)×ANGLE_STEP، أي نحو ±52°-78° كحد أقصى) حول مساحة العمل
 * المركزية. عدد اللوحات المرئية بآن واحد محدود عمداً (5-7)، لا كل صفحات
 * النظام — راجع HolographicPagePanel.js للهندسة الفعلية (x/zDepth/rotateY).
 * تدعم: سحب المؤشر، عجلة الفأرة، لوحة المفاتيح، وزرّي تنقّل صغيرين (بند
 * الوصول: النقر/لوحة المفاتيح/السايدبار تبقى دائماً بدائل عن السحب).
 */
const HolographicPageRing = forwardRef(function HolographicPageRing(
  { pages, lang, dropZoneRef, onOpenPage },
  ref
) {
  const stageRef = useRef(null);
  const { radiusX, radiusY, visibleRange } = useResponsiveGeometry(stageRef);

  const handleOpenByIndex = useCallback((index) => {
    onOpenPage(pages[index]);
  }, [onOpenPage, pages]);

  // البدء من منتصف قائمة الصفحات (لا 0) — حتى تظهر الحلقة متناظرة الشكل
  // القوسي حول المركز فور التحميل (لوحات على الجانبين)، بدل تكديس أحادي
  // الجانب لو بدأنا من أول صفحة بالقائمة. الاستثناء: 'dashboard' (لوحة
  // التحكم) يجب أن تكون هي المختارة عند الدخول لأول مرة — فهرسها دائماً 0
  // بالسجل (DARK_HOLOGRAPHIC_PAGES).
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
    // React يُلحِق مستمع onWheel المُفوَّض عبر الجذر بخاصية passive افتراضياً
    // بمتصفحات حديثة — ما يمنع e.preventDefault() من العمل فعلياً بصمت. مستمع
    // أصلي مباشرة على عقدة المسرح مع passive:false يضمن عمل preventDefault.
    el.addEventListener('wheel', ring.onWheel, { passive: false });
    return () => el.removeEventListener('wheel', ring.onWheel);
  }, [ring.onWheel]);

  // بند حرج: لا نلتقط المؤشر (setPointerCapture) فور pointerdown — لو
  // فعلنا، وحدث pointerdown كان قد صعد (bubbled) من لوحة غير أمامية (لا
  // توقف انتشارها)، كان الالتقاط يُعاد تعيينه هنا فوراً من اللوحة إلى
  // المسرح، فيُعاد توجيه pointerup بالكامل للمسرح بدل اللوحة — تُفقَد كل
  // نقرة تحديد بسيطة على أي لوحة غير أمامية (كانت تصل المسرح فقط، يلتقط
  // "أقرب موضع" بلا حركة حقيقية، بينما معالج onSelect الخاص باللوحة نفسها
  // لا يُستدعى أبداً). الحل: نؤجّل الالتقاط حتى نتأكد من حركة سحب فعلية
  // تتجاوز عتبة صغيرة — نقرة بسيطة تترك الحدث يصل اللوحة نفسها بشكل طبيعي.
  const stageDragState = useRef(null);
  const stageDownPos = useRef(null);
  const stageCaptured = useRef(false);
  const handleStagePointerDown = (e) => {
    stageDragState.current = true;
    stageCaptured.current = false;
    stageDownPos.current = { x: e.clientX, y: e.clientY };
    ring.dragHandlers.onPointerDown(e);
  };
  const handleStagePointerMove = (e) => {
    if (!stageDragState.current) return;
    if (!stageCaptured.current) {
      const dx = e.clientX - stageDownPos.current.x;
      const dy = e.clientY - stageDownPos.current.y;
      if (Math.hypot(dx, dy) <= 6) return; // لم تتجاوز عتبة السحب بعد
      stageCaptured.current = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    ring.dragHandlers.onPointerMoveDrag(e, stageRef.current?.clientWidth || 800, visibleRange);
  };
  const handleStagePointerUp = (e) => {
    if (!stageDragState.current) return;
    stageDragState.current = false;
    if (stageCaptured.current) {
      ring.dragHandlers.onPointerUpDrag();
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    // لم يُلتقَط المؤشر إطلاقاً (لم تتجاوز الحركة العتبة) → لم تكن سحباً
    // حقيقياً للحلقة أصلاً؛ الحدث وصل اللوحة نفسها بشكل طبيعي (لم نخطفه)
    // وهي تتولّى قرار النقرة (onSelect/onOpen) بمعالجها الخاص.
  };

  const roundedSelected = Math.round(ring.continuousPosition);
  const startIdx = Math.max(0, roundedSelected - visibleRange);
  const endIdx = Math.min(pages.length - 1, roundedSelected + visibleRange);
  const visiblePages = [];
  for (let i = startIdx; i <= endIdx; i++) visiblePages.push(i);

  return (
    <div
      ref={stageRef}
      className={`hpr-stage ${ring.isDragging ? 'hpr-dragging' : ''}`}
      // pointer-events:none بالـCSS (راجع تعليق .hpr-stage بholographic-dark.css)
      // — يستثني المسرح نفسه من أن يكون هدف اختبار إصابة مباشراً (كان
      // يحجب لوحات متراجعة للخلف ثلاثياً)، لكن هذا لا يمنع وصول أحداث
      // pointerdown/move/up الحقيقية الصاعدة (bubbling) من أي لوحة فعلية
      // (هدف حقيقي، auto دائماً) لمعالجاتها هنا — bubbling مستقل تماماً عن
      // pointer-events الخاصة بالسلف. هذا هو أساس "يمكن بدء سحب الحلقة من
      // فوق أي لوحة" (بند صريح بالمواصفة)؛ السحب من خلفية فارغة تماماً غير
      // مدعوم الآن عمداً (محاولة إضافة طبقة خلفية مخصَّصة له اصطدمت بخلل
      // اختبار إصابة حقيقي عبر حدود سياقات preserve-3d، تم توثيقه وتركه).
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
      onPointerCancel={handleStagePointerUp}
      onKeyDown={ring.onKeyDown}
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
              radiusX={radiusX}
              radiusY={radiusY}
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

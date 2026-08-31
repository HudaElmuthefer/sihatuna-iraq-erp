import React, { useEffect, useRef } from 'react';

// Single on/off switch — flip to false to fully disable the custom cursor
// (e.g. if it ever turns out to cost too much on low-end machines) without
// touching anything else. When false the effect below no-ops immediately
// and nothing is rendered, at zero runtime cost.
export const ENABLE_FUTURISTIC_CURSOR = true;

const HOVER_SELECTOR = [
  'a', 'button', 'select', '[role="button"]', '[tabindex]:not([tabindex="-1"])',
  '.btn', '.card', '.sidebar-nav-item', '.page-btn', '.dqt-tile',
  '.health-hero-customize', '.dropdown-item', '.tab',
  '.header-dropdown-option', '[role="option"]',
  '[data-cursor-hover]',
  // .stat-card intentionally excluded — cursor:default in CSS, not
  // clickable, so the scanner ring shouldn't claim it's interactive either.
].join(', ');

// حقول الكتابة تحتفظ بمؤشر النص الطبيعي (I-beam) — الماسح المخصص لا يظهر
// فوقها ولا يخفي المؤشر الأصلي (راجع body.futuristic-cursor-active CSS
// أدناه)، تماماً كما طلب: لا Custom Arrow فوق حقول الكتابة.
const TEXT_INPUT_SELECTOR = [
  'textarea',
  'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="image"])',
].join(', ');

/*
 * Small glowing dot + a slightly-trailing outer ring, colored per-theme via
 * --cursor-core / --cursor-ring-rgb. Mounted once at the app root so it's
 * active everywhere without per-page wiring.
 *
 * Hover state is recomputed every animation frame via elementFromPoint at
 * the cursor's *current* position, rather than mouseover/mouseout — those
 * discrete events can be missed when the pointer crosses several small
 * targets quickly, leaving a stale "hovering" ring stuck on. Polling the
 * real position every frame means the ring can never get out of sync with
 * what's actually under it.
 *
 * Skipped entirely on coarse/touch pointers (see the CSS media query too —
 * duplicated here so the rAF loop and listeners never even start on those
 * devices).
 */
export default function FuturisticCursor() {
  const coreRef = useRef(null);
  const ringRef = useRef(null);
  const pulseRef = useRef(null);

  useEffect(() => {
    if (!ENABLE_FUTURISTIC_CURSOR) return undefined;
    if (!window.matchMedia('(pointer: fine)').matches) return undefined;
    // احترام تفضيل تقليل الحركة — نفس سلوك CSS media query أدناه (تخفي
    // العنصرين وتُرجع المؤشر الأصلي)، هنا أيضاً لا نُشغّل حلقة rAF أصلاً
    // فلا تكلفة أداء إضافية بلا داعٍ.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const core = coreRef.current;
    const ring = ringRef.current;
    const pulse = pulseRef.current;
    let coreX = window.innerWidth / 2;
    let coreY = window.innerHeight / 2;
    let ringX = coreX;
    let ringY = coreY;
    let raf;

    document.body.classList.add('futuristic-cursor-active');

    const handleMove = (e) => { coreX = e.clientX; coreY = e.clientY; };
    const handleDown = () => { ring.classList.add('cursor-ring-active'); };
    const handleUp = () => {
      ring.classList.remove('cursor-ring-active');
      // نبضة الإفراج الهولوغرافية (holographic release pulse) — حلقة رفيعة
      // تتوسع وتتلاشى بسرعة عند مركز المؤشر الحالي بالضبط. إعادة تشغيل
      // الرسوم المتحركة عبر إزالة الصنف ثم فرض reflow (تقييم offsetWidth)
      // قبل إعادته، بدل إنشاء/حذف عنصر DOM جديد بكل نقرة.
      if (pulse) {
        pulse.style.transform = `translate(${coreX}px, ${coreY}px)`;
        pulse.classList.remove('cursor-pulse-firing');
        void pulse.offsetWidth;
        pulse.classList.add('cursor-pulse-firing');
      }
    };

    const tick = () => {
      // Fast catch-up (0.4) — a hint of trailing smoothness without the
      // sluggish, noticeably-lagging feel the slower factor used to have.
      ringX += (coreX - ringX) * 0.4;
      ringY += (coreY - ringY) * 0.4;
      if (core) core.style.transform = `translate(${coreX}px, ${coreY}px)`;
      if (ring) ring.style.transform = `translate(${ringX}px, ${ringY}px)`;

      const el = document.elementFromPoint(coreX, coreY);
      const isTextInput = !!(el && el.closest && el.closest(TEXT_INPUT_SELECTOR));
      const isHovering = !isTextInput && !!(el && el.closest && el.closest(HOVER_SELECTOR));
      if (ring) ring.classList.toggle('cursor-ring-hover', isHovering);
      if (core) core.classList.toggle('cursor-core-hover', isHovering);
      // فوق حقول الكتابة: نخفي الماسح المخصص ونعيد مؤشر النص الأصلي (I-beam)
      // بدل تركه بلا أي مؤشر ظاهر (body.futuristic-cursor-active كانت تخفي
      // الماسح الأصلي في كل مكان بلا استثناء سابقاً).
      document.body.classList.toggle('futuristic-cursor-over-text', isTextInput);

      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('mouseup', handleUp);
    raf = requestAnimationFrame(tick);

    return () => {
      document.body.classList.remove('futuristic-cursor-active', 'futuristic-cursor-over-text');
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mouseup', handleUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!ENABLE_FUTURISTIC_CURSOR) return null;

  return (
    <>
      <div ref={coreRef} className="futuristic-cursor-core" aria-hidden="true" />
      <div ref={ringRef} className="futuristic-cursor-ring" aria-hidden="true" />
      <div ref={pulseRef} className="futuristic-cursor-pulse" aria-hidden="true" />
    </>
  );
}

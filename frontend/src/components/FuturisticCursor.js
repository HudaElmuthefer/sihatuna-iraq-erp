import React, { useEffect, useRef } from 'react';
import { findScrollableAncestor, scrollbarProximity, isScrollableY, isScrollableX } from '../utils/scrollbarDetection';

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

// راجع frontend/src/utils/scrollbarDetection.js — hitZone أكبر قليلاً من
// عرض الشريط الحقيقي (بند 8)، revealZone أوسع قليلاً (يُظهر الشريط قبل أن
// يصل المؤشر إليه فعلياً، بند 14).
const SCROLLBAR_HIT_ZONE = 16;
const SCROLLBAR_REVEAL_ZONE = 24;
// Hysteresis عند الخروج من منطقة الشريط قبل إعادة إظهار المؤشر المخصص (بند
// 28: 50-100ms) — يمنع وميض ON/OFF سريع عند الحافة بالضبط.
const CURSOR_REVEAL_DELAY = 80;
// يبقى الشريط ظاهراً هذه المدة بعد آخر تمرير/اقتراب قبل أن يتلاشى (بند 17: 500-900ms).
const SCROLLBAR_FADE_DELAY = 700;

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

    // ── Scrollbar awareness ────────────────────────────────────────────
    // fadeTimers: عنصر DOM → معرّف setTimeout المُجدوَل لإخفاء توهجه (بند
    // 17). revealTimer: يُلغي/يعيد جدولة الأول عند أي اقتراب/تمرير جديد.
    const fadeTimers = new Map();
    const scheduleReveal = (el) => {
      if (!el) return;
      const pending = fadeTimers.get(el);
      if (pending) { clearTimeout(pending); fadeTimers.delete(el); }
      el.classList.add('scrollbar-near-edge');
    };
    const scheduleHide = (el) => {
      if (!el || fadeTimers.has(el)) return;
      const id = setTimeout(() => {
        el.classList.remove('scrollbar-near-edge');
        fadeTimers.delete(el);
      }, SCROLLBAR_FADE_DELAY);
      fadeTimers.set(el, id);
    };

    let lastRevealEl = null;
    let inScrollZone = false; // isDragging || pointer within SCROLLBAR_HIT_ZONE
    let exitTimer = null;
    const isDraggingRef = { current: false };
    const dragElRef = { current: null };

    const setCursorScrollZone = (on) => {
      if (on) {
        if (exitTimer) { clearTimeout(exitTimer); exitTimer = null; }
        if (!inScrollZone) { inScrollZone = true; document.body.classList.add('futuristic-cursor-scroll-zone'); }
      } else if (inScrollZone && !exitTimer) {
        exitTimer = setTimeout(() => {
          inScrollZone = false;
          exitTimer = null;
          document.body.classList.remove('futuristic-cursor-scroll-zone');
        }, CURSOR_REVEAL_DELAY);
      }
    };

    const handleMove = (e) => { coreX = e.clientX; coreY = e.clientY; };

    const handleDown = (e) => {
      ring.classList.add('cursor-ring-active');
      // إذا بدأ الضغط داخل منطقة شريط تمرير: قفل "وضع Native" حتى pointerup
      // بغضّ النظر عن خروج المؤشر من الحافة قليلاً أثناء السحب (بند 9).
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const scrollEl = findScrollableAncestor(el);
      const prox = scrollbarProximity(scrollEl, e.clientX, e.clientY, SCROLLBAR_HIT_ZONE);
      if (scrollEl && (prox.vertical || prox.horizontal)) {
        isDraggingRef.current = true;
        dragElRef.current = scrollEl;
        setCursorScrollZone(true);
        scheduleReveal(scrollEl);
      }
    };

    const handleUp = () => {
      ring.classList.remove('cursor-ring-active');
      if (isDraggingRef.current && dragElRef.current) {
        scheduleHide(dragElRef.current);
      }
      isDraggingRef.current = false;
      dragElRef.current = null;
      // نبضة الإفراج الهولوغرافية (holographic release pulse) — حلقة رفيعة
      // تتوسع وتتلاشى بسرعة عند مركز المؤشر الحالي بالضبط. إعادة تشغيل
      // الرسوم المتحركة عبر إزالة الصنف ثم فرض reflow (تقييم offsetWidth)
      // قبل إعادته، بدل إنشاء/حذف عنصر DOM جديد بكل نقرة. تُقفَز فقط إذا لم
      // نكن نخرج للتوّ من سحب شريط تمرير (نبضة طاقة فوق thumb لا معنى لها).
      if (pulse && !dragElRef.current) {
        pulse.style.transform = `translate(${coreX}px, ${coreY}px)`;
        pulse.classList.remove('cursor-pulse-firing');
        void pulse.offsetWidth;
        pulse.classList.add('cursor-pulse-firing');
      }
    };

    // يلتقط scroll من أي عنصر ابن (لا يصعد bubbling طبيعياً، لكن مرحلة
    // الالتقاط تعمل معه) — يغطي التمرير بالعجلة/اللمس التاتش-باد وأيضاً
    // PageUp/PageDown دون أي معالجة منفصلة لكل منها (بند 18). يجدول
    // الإخفاء فوراً أيضاً (وليس فقط الإظهار) — إذا استمر التمرير، كل حدث
    // لاحق يُلغي مؤقّت الإخفاء المُجدوَل ويعيد جدولته (راجع scheduleReveal)،
    // فيبقى العدّاد يتجدد طوال مدة التمرير الفعلي بالضبط كما هو مطلوب.
    // بدون هذا: تمرير بلوحة المفاتيح بينما الفأرة في مكان آخر تماماً كان
    // يترك الشريط مضاءً للأبد (لا شيء يزور ذلك العنصر مجدداً في tick()).
    const handleScrollCapture = (e) => {
      const el = e.target === document ? document.documentElement : e.target;
      if (!el || !(isScrollableY(el) || isScrollableX(el))) return;
      scheduleReveal(el);
      scheduleHide(el);
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

      // أقرب سلف قابل للتمرير تحت المؤشر الآن، ومدى قربه من شريطه الفعلي.
      const scrollEl = isDraggingRef.current ? dragElRef.current : findScrollableAncestor(el);
      const proxHit = scrollbarProximity(scrollEl, coreX, coreY, SCROLLBAR_HIT_ZONE);
      const proxReveal = scrollbarProximity(scrollEl, coreX, coreY, SCROLLBAR_REVEAL_ZONE);
      const inHitZone = isDraggingRef.current || proxHit.vertical || proxHit.horizontal;
      const inRevealZone = isDraggingRef.current || proxReveal.vertical || proxReveal.horizontal;

      if (scrollEl && inRevealZone) {
        scheduleReveal(scrollEl);
      } else if (lastRevealEl && lastRevealEl !== scrollEl) {
        scheduleHide(lastRevealEl);
      } else if (scrollEl && !inRevealZone) {
        scheduleHide(scrollEl);
      }
      lastRevealEl = inRevealZone ? scrollEl : null;

      setCursorScrollZone(inHitZone);

      // فوق منطقة شريط تمرير: لا Scan Ring ولا توهج نواة — نفس معاملة حقل
      // الكتابة (بند 30: لا حلقة، لا مؤشر هولوغرافي، فقط Native). isHovering
      // يبقى false هنا عمداً حتى لو كان العنصر تحته زر/رابط تقنياً (نادر عند
      // حافة شريط تمرير فعلي).
      const isHovering = !isTextInput && !inHitZone && !!(el && el.closest && el.closest(HOVER_SELECTOR));
      if (ring) ring.classList.toggle('cursor-ring-hover', isHovering);
      if (core) core.classList.toggle('cursor-core-hover', isHovering);
      // فوق حقول الكتابة أو منطقة شريط تمرير: نخفي الماسح المخصص ونعيد
      // المؤشر الأصلي (I-beam فوق النص، سهم/يد عادية فوق شريط التمرير) بدل
      // تركه بلا أي مؤشر ظاهر.
      document.body.classList.toggle('futuristic-cursor-over-text', isTextInput && !inHitZone);

      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('mouseup', handleUp);
    document.addEventListener('scroll', handleScrollCapture, true);
    raf = requestAnimationFrame(tick);

    return () => {
      document.body.classList.remove('futuristic-cursor-active', 'futuristic-cursor-over-text', 'futuristic-cursor-scroll-zone');
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mouseup', handleUp);
      document.removeEventListener('scroll', handleScrollCapture, true);
      if (exitTimer) clearTimeout(exitTimer);
      fadeTimers.forEach((id, el) => { clearTimeout(id); el.classList.remove('scrollbar-near-edge'); });
      fadeTimers.clear();
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

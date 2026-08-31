import React, { useEffect, useRef } from 'react';
import { findScrollableAncestor, scrollbarZoneState, computeActivationZone, isScrollableY, isScrollableX } from '../utils/scrollbarDetection';

// وحدة تشخيص مؤقتة (بند 30 بالطلب) — مُطفأة افتراضياً وفي أي production
// build. للتفعيل أثناء الاختبار اليدوي: افتح Console واكتب
// `window.__CURSOR_DEBUG__ = true` (بلا الحاجة لإعادة بناء المشروع)، ثم
// `= false` لإيقافه. لا تُترَك مفعّلة بشكل دائم.
function cursorDebug(...args) {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof window !== 'undefined' && window.__CURSOR_DEBUG__) {
    // eslint-disable-next-line no-console
    console.log('[CursorDebug]', ...args);
  }
}

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

// PRE-ARM EDGE DETECTION (إعادة كتابة كاملة لمنطق شريط التمرير — الطلب
// الحالي صراحةً): لا يحاول أي كود هنا اكتشاف الـthumb الحقيقي (ليس عنصر
// DOM موثوق عبر elementFromPoint/closest). بدلاً من ذلك يُقاس بُعد المؤشر
// عن حافة الصندوق المحيط (getBoundingClientRect) لعنصر التمرير نفسه فقط،
// وتُفعَّل "وضعية المؤشر الأصلي" قبل وصول المؤشر فعلياً لأي شريط — راجع
// frontend/src/utils/scrollbarDetection.js (scrollbarZoneState).
// Hysteresis بالمسافة (وليس فقط بالوقت، بند 13): الدخول عند 22px، الخروج
// فقط بعد الابتعاد لأكثر من 34px — يمنع تذبذب native/holographic السريع
// عند حواف المنطقة تماماً.
const SCROLLBAR_ENTER_ZONE = 22;
const SCROLLBAR_EXIT_ZONE = 34;
// يبقى الشريط ظاهراً هذه المدة بعد آخر تمرير/اقتراب قبل أن يتلاشى (بند 17: 500-900ms).
const SCROLLBAR_FADE_DELAY = 700;

// ═══════════════════════════════════════════════════════════════════════
// تغيير استراتيجية كامل (طلب صريح: توقف عن ترقيع اكتشاف الحافة/الـthumb
// للقوائم المنسدلة — لم ينجح عملياً). النظام أعلاه (pre-arm edge detection)
// يبقى فقط لمنطقتي التمرير البنيويتين الدائمتي الحضور: صفحة المحتوى
// (.page-main) وقائمة السايدبار الداخلية — حيث منطقة "ما قبل التفعيل"
// الصغيرة عند الحافة منطقية فعلاً (المستخدم يمرّر مؤشره عبر مساحة واسعة من
// المحتوى أصلاً). أي عنصر آخر قابل للتمرير (قائمة منسدلة، لوحة إشعارات،
// نتائج بحث، أي Popup) يُعامَل بمنطق مختلف كلياً أدناه: مجرد دخول Pointer
// لكامل حدود ذلك العنصر (وليس فقط حافته) يُوقف الـCustom Cursor تماماً
// طوال بقائه بداخله، ويعود المؤشر الأصلي؛ لا محاولة لاكتشاف الـthumb ولا
// حساب مسافة عن حافة الشريط إطلاقاً لهذه الفئة.
function isStructuralScrollRegion(el) {
  if (!el || !el.classList) return false;
  if (el.classList.contains('page-main')) return true;
  return !!(el.closest && el.closest('.desktop-sidebar, .mobile-sidebar'));
}

/* ملاحظة معمارية: القوائم المنسدلة/اللوحات المنبثقة (dropdowns/popups) لا
   تُدار من هذا الملف إطلاقاً بعد الآن — كانت تُدار سابقاً عبر تفويض عالمي
   (document-level pointerenter/pointerleave بمرحلة الالتقاط)، لكن الاختبار
   الفعلي في المتصفح أثبت أن ذلك لم يعمل بشكل موثوق. الاستراتيجية الجديدة:
   كل مكوّن قائمة منسدلة يستخدم Hook مخصصاً مباشرة على عقدة الـDOM الحقيقية
   الخاصة به (بما فيها المُركَّبة عبر Portal) — راجع
   frontend/src/hooks/useScrollableCursorSuspend.js — والذي يُبدِّل صنف
   .custom-cursor-suspended على <html> مباشرة بنفسه دون أي وسيط هنا. هذا
   الملف يبقى مسؤولاً حصراً عن: (1) تتبّع نقطة المؤشر/التوهج/الحوم العادي،
   و(2) نظام pre-arm الخاص بمنطقتي التمرير البنيويتين فقط (.page-main
   والسايدبار) عبر isStructuralScrollRegion أدناه — لا علاقة له بالقوائم. */

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

    // ── Scrollbar awareness — PRE-ARM EDGE DETECTION ────────────────────
    // fadeTimers: عنصر DOM → معرّف setTimeout المُجدوَل لإخفاء توهجه البصري
    // (.scrollbar-near-edge، بند 17: يبقى ظاهراً 500-900ms بعد آخر نشاط).
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

    // العنصر البنيوي القابل للتمرير "النشط" الأخير (.page-main أو سايدبار
    // فقط — راجع isStructuralScrollRegion أعلاه) — يُحتفَظ به حتى بعد
    // ابتعاد المؤشر عن أي عنصر ابن مباشر، ولا يُمسَح إلا عند: (أ) الابتعاد
    // الفعلي عن حدوده بأكثر من SCROLLBAR_EXIT_ZONE، أو (ب) عندما لا يعود
    // متصلاً بالـDOM.
    const activeScrollableRef = { current: null };
    const isScrollbarDraggingRef = { current: false };
    const dragElRef = { current: null };
    let nativeMode = false;

    const setNativeMode = (on) => {
      if (on === nativeMode) return;
      nativeMode = on;
      // html.native-scroll-cursor — وليس body فقط — كي يغطي أيضاً أي عنصر
      // مُركَّب عبر Portal مباشرة إلى document.body (لوحات القوائم المنسدلة
      // العائمة) بلا استثناء (بند 10 بالطلب صراحةً).
      document.documentElement.classList.toggle('native-scroll-cursor', on);
      cursorDebug('Native mode:', on);
    };

    const handleMove = (e) => { coreX = e.clientX; coreY = e.clientY; };

    const releaseDragLock = () => {
      if (!isScrollbarDraggingRef.current) return;
      isScrollbarDraggingRef.current = false;
      cursorDebug('Drag lock:', false);
      if (dragElRef.current) scheduleHide(dragElRef.current);
      dragElRef.current = null;
    };

    // القفل يُفعَّل عند pointerdown داخل منطقة ما-قبل-التفعيل نفسها (وليس
    // فوق الـthumb الحقيقي حصراً — بند 14 بالطلب: القرار يُبنى دائماً على
    // نفس قياس المسافة عن الصندوق المحيط، لا على استهداف عنصر بعينه).
    const handlePointerDown = (e) => {
      if (ring) ring.classList.add('cursor-ring-active');
      const scrollEl = activeScrollableRef.current;
      if (!scrollEl || !scrollEl.isConnected) return;
      const zone = computeActivationZone(scrollEl, SCROLLBAR_ENTER_ZONE);
      const state = scrollbarZoneState(scrollEl, e.clientX, e.clientY, zone);
      if (state.vertical || state.horizontal) {
        isScrollbarDraggingRef.current = true;
        dragElRef.current = scrollEl;
        setNativeMode(true);
        scheduleReveal(scrollEl);
        cursorDebug('Drag lock:', true, '| side:', state.side, '| distance:', Math.round(state.distance));
      }
    };

    // بند 15 بالطلب صراحةً: pointerup/pointercancel عالميان على window (لا
    // على العنصر نفسه) — يفكّان القفل حتى لو انتهى السحب خارج حدود القائمة
    // أو خارج النافذة تماماً. blur إضافية دفاعية (تبديل تبويب أثناء السحب).
    const handlePointerUp = () => {
      if (ring) ring.classList.remove('cursor-ring-active');
      const wasDragging = isScrollbarDraggingRef.current;
      releaseDragLock();
      if (pulse && !wasDragging) {
        pulse.style.transform = `translate(${coreX}px, ${coreY}px)`;
        pulse.classList.remove('cursor-pulse-firing');
        void pulse.offsetWidth;
        pulse.classList.add('cursor-pulse-firing');
      }
    };

    // يلتقط scroll من أي عنصر ابن (لا يصعد bubbling طبيعياً، لكن مرحلة
    // الالتقاط تعمل معه) — يغطي التمرير بالعجلة/اللمس التاتش-باد وأيضاً
    // PageUp/PageDown دون أي معالجة منفصلة لكل منها. يجدول الإخفاء فوراً
    // أيضاً (وليس فقط الإظهار) — إذا استمر التمرير، كل حدث لاحق يُلغي مؤقّت
    // الإخفاء المُجدوَل ويعيد جدولته، فيبقى العدّاد يتجدد طوال مدة التمرير
    // الفعلي. بدون هذا: تمرير بلوحة المفاتيح بينما الفأرة في مكان آخر تماماً
    // كان يترك الشريط مضاءً للأبد (لا شيء يزور ذلك العنصر مجدداً في tick()).
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

      // تحديث activeScrollableRef: منطقة بنيوية فقط (.page-main/سايدبار) —
      // القوائم المنسدلة تُدار حصراً عبر pointerenter/pointerleave أعلاه،
      // لا عبر هذا المسار إطلاقاً (بند C بالطلب صراحةً).
      const found = findScrollableAncestor(el);
      const structuralFound = found && isStructuralScrollRegion(found) ? found : null;
      if (structuralFound) {
        if (activeScrollableRef.current !== structuralFound) {
          cursorDebug('Scrollable found:', structuralFound.className || structuralFound.tagName);
        }
        activeScrollableRef.current = structuralFound;
      }

      const scrollEl = isScrollbarDraggingRef.current ? dragElRef.current : activeScrollableRef.current;
      const stillConnected = !!(scrollEl && scrollEl.isConnected);

      let inZone = false;
      if (isScrollbarDraggingRef.current) {
        // القفل يفوق أي حساب مسافة (بند 16 بالطلب صراحةً) — حتى لو خرج
        // المؤشر تماماً عن حدود العنصر أثناء السحب.
        inZone = true;
        if (dragElRef.current) scheduleReveal(dragElRef.current);
      } else if (stillConnected) {
        // Hysteresis بالمسافة (بند 13): منطقة الدخول (22px) أصغر من منطقة
        // الخروج (34px) — تمنع التذبذب السريع عند حافة المنطقة بالضبط، لا
        // تعتمد فقط على مؤقّت زمني.
        const zonePx = nativeMode ? SCROLLBAR_EXIT_ZONE : SCROLLBAR_ENTER_ZONE;
        const activationWidth = computeActivationZone(scrollEl, zonePx);
        const state = scrollbarZoneState(scrollEl, coreX, coreY, activationWidth);
        inZone = state.vertical || state.horizontal;
        if (inZone) {
          scheduleReveal(scrollEl);
        } else {
          scheduleHide(scrollEl);
        }
      } else {
        // القائمة/اللوحة أُغلقت أو أُزيلت من الـDOM — امسح المرجع وأوقف
        // الوضعية الأصلية فوراً (بند 26 بالطلب صراحةً) بدل تركها عالقة.
        activeScrollableRef.current = null;
      }

      setNativeMode(inZone);

      // فوق منطقة شريط تمرير: لا Scan Ring ولا توهج نواة — نفس معاملة حقل
      // الكتابة. isHovering يبقى false هنا عمداً حتى لو كان العنصر تحته
      // زر/رابط تقنياً (نادر عند حافة شريط تمرير فعلي).
      const isHovering = !isTextInput && !inZone && !!(el && el.closest && el.closest(HOVER_SELECTOR));
      if (ring) ring.classList.toggle('cursor-ring-hover', isHovering);
      if (core) core.classList.toggle('cursor-core-hover', isHovering);
      // فوق حقول الكتابة أو منطقة شريط تمرير: نخفي الماسح المخصص ونعيد
      // المؤشر الأصلي (I-beam فوق النص، سهم/يد عادية فوق شريط التمرير) بدل
      // تركه بلا أي مؤشر ظاهر.
      document.body.classList.toggle('futuristic-cursor-over-text', isTextInput && !inZone);

      raf = requestAnimationFrame(tick);
    };

    // بند 21 بالطلب صراحةً: capture:true على window (لا على عنصر React
    // محدَّد) كي لا يُفوَّت أي حدث بصرف النظر عن أين يبدأ في الشجرة.
    window.addEventListener('pointermove', handleMove, { capture: true, passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true });
    window.addEventListener('pointercancel', handlePointerUp, { capture: true });
    window.addEventListener('blur', releaseDragLock);
    document.addEventListener('scroll', handleScrollCapture, true);
    raf = requestAnimationFrame(tick);

    return () => {
      document.body.classList.remove('futuristic-cursor-active', 'futuristic-cursor-over-text');
      document.documentElement.classList.remove('native-scroll-cursor');
      window.removeEventListener('pointermove', handleMove, { capture: true });
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      window.removeEventListener('pointercancel', handlePointerUp, { capture: true });
      window.removeEventListener('blur', releaseDragLock);
      document.removeEventListener('scroll', handleScrollCapture, true);
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

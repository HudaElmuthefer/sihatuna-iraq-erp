import { useCallback, useEffect, useRef, useState } from 'react';
import { playSnap, playOpen, playTick, startDragSound, updateDragSound, stopDragSound } from '../utils/holographicSound';

// هندسة الحلقة الفعلية (x/zDepth/rotateY لكل لوحة) محسوبة بالكامل بـ
// HolographicPageRing.js/HolographicPagePanel.js من `continuousPosition` هنا
// — هذا الملف مسؤول فقط عن حالة الدوران/السحب/الالتقاط، لا عن الهندسة
// البصرية نفسها.
const SNAP_MS = 260;
const OPEN_MS = 420;

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * @param {number} count عدد الصفحات على الحلقة
 * @param {(index:number)=>void} onOpen يُستدعى بعد اكتمال حركة الفتح (تدوير+انفصال+تكبير)
 */
export default function useHolographicRing(count, onOpen, initialIndex = 0) {
  const [continuousPosition, setContinuousPosition] = useState(initialIndex);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [isDragging, setIsDragging] = useState(false);
  const [openingIndex, setOpeningIndex] = useState(null);

  const posRef = useRef(initialIndex);
  const dragStartRef = useRef({ x: 0, pos: 0 });
  const tweenRef = useRef(null);
  const countRef = useRef(count);
  countRef.current = count;

  const clampIndex = useCallback((v) => Math.min(countRef.current - 1, Math.max(0, v)), []);

  const cancelTween = () => { if (tweenRef.current) { cancelAnimationFrame(tweenRef.current); tweenRef.current = null; } };

  const setPos = useCallback((v) => {
    posRef.current = v;
    setContinuousPosition(v);
  }, []);

  const animateTo = useCallback((target, { onDone, forceSnapSound = false } = {}) => {
    cancelTween();
    const from = posRef.current;
    const clamped = clampIndex(target);
    if (prefersReducedMotion()) {
      setPos(clamped);
      setSelectedIndex(Math.round(clamped));
      if (forceSnapSound || Math.round(clamped) !== Math.round(from)) playSnap();
      onDone?.();
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / SNAP_MS);
      const eased = easeOutCubic(t);
      setPos(from + (clamped - from) * eased);
      if (t < 1) {
        tweenRef.current = requestAnimationFrame(step);
      } else {
        tweenRef.current = null;
        const settled = Math.round(clamped);
        // نغمة نقرة مغناطيسية ناعمة عند الاستقرار. forceSnapSound (سحب
        // الحلقة تحديداً — بند صريح: صوت التقاط واحد دائماً بعد رفع
        // المؤشر، بصرف النظر عمّا إذا كان نفس الفهرس المُعبَر أثناء السحب
        // نفسه عبر نقرات playTick المنفصلة) يتجاوز شرط "فهرس مختلف" العادي
        // المستخدَم لباقي طرق التنقّل (عجلة/لوحة مفاتيح/نقر) كي لا تتكرر
        // النغمة بلا داعٍ لموضع لم يتغيّر فعلياً هناك.
        if (forceSnapSound || settled !== Math.round(from)) playSnap();
        setSelectedIndex(settled);
        onDone?.();
      }
    };
    tweenRef.current = requestAnimationFrame(step);
  }, [clampIndex, setPos]);

  const goTo = useCallback((index) => animateTo(index), [animateTo]);

  const triggerOpen = useCallback((index) => {
    playOpen();
    setOpeningIndex(index);
    const ms = prefersReducedMotion() ? 0 : OPEN_MS;
    window.setTimeout(() => { onOpen?.(index); }, ms);
  }, [onOpen]);

  // انتهاء "opening" state — يُستدعى من الخارج بعد التنقّل الفعلي، حتى لا
  // تبقى لوحة عالقة بحالة "منفصلة/مكبَّرة" لو رجع المستخدم لنفس الصفحة لاحقاً.
  const resetOpening = useCallback(() => setOpeningIndex(null), []);

  const selectOrOpen = useCallback((index) => {
    if (Math.round(posRef.current) === index) {
      triggerOpen(index);
    } else {
      animateTo(index, { onDone: () => triggerOpen(index) });
    }
  }, [animateTo, triggerOpen]);

  // ── سحب الحلقة (Pointer Events) ──────────────────────────────────────────
  // ملاحظة معمارية: setPointerCapture لا يُستدعى هنا إطلاقاً — HolographicPageRing.js
  // هو المسؤول الوحيد عن توقيته (يؤجّله حتى تأكيد حركة سحب فعلية تتجاوز
  // عتبة صغيرة). استدعاؤه هنا فوراً عند pointerdown كان يخطف كل pointerup
  // من أي نقرة بسيطة على لوحة غير أمامية بعيداً عن معالجها الخاص — راجع
  // التعليق المفصَّل بذاك الملف.
  const onPointerDown = useCallback((e) => {
    if (e.button !== undefined && e.button !== 0) return;
    cancelTween();
    dragStartRef.current = { x: e.clientX, pos: posRef.current };
    lastMoveRef.current = null;
    lastCrossedRef.current = Math.round(posRef.current);
  }, []);

  // سرعة لحظية (px/ms) بين آخر إطارين — لا من بداية السحب كاملة (ذاك متوسط،
  // لا سرعة "حالية") — تُغذّي صوت السحب المستمر (بند صريح: السرعة تتحكّم
  // بالحدّة/السطوع، لا الصوت نفسه ثنائي التشغيل).
  const lastMoveRef = useRef(null);
  // آخر فهرس صحيح "عُبِر" أثناء السحب — نقرة واحدة فقط لكل تغيّر (بند صريح).
  const lastCrossedRef = useRef(initialIndex);

  const onPointerMoveDrag = useCallback((e, stageWidth, visibleRange = 3) => {
    setIsDragging(true);
    // startDragSound() مُؤمَّنة داخلياً (لا تُعيد التشغيل لو نشطة أصلاً) —
    // استدعاؤها هنا (لا بـonPointerDown) يضمن بدء الصوت فقط عند حركة سحب
    // حقيقية مؤكَّدة (HolographicPageRing.js لا يستدعي هذه الدالة أصلاً إلا
    // بعد تجاوز عتبة 6px)، لا عند كل نقرة بسيطة.
    startDragSound();
    // px إلى "وحدات فهرس": عرض مرجعي — سحب كامل عرض المسرح يساوي تقريباً
    // نصف عدد اللوحات المرئية (إحساس طبيعي، لا سريع جداً ولا بطيء جداً).
    const pxPerIndex = Math.max(40, stageWidth / (visibleRange * 0.9));
    const deltaPx = e.clientX - dragStartRef.current.x;
    const deltaIndex = -deltaPx / pxPerIndex; // سحب لليسار (deltaPx سالب) يقدّم للفهرس التالي
    const nextPos = clampIndex(dragStartRef.current.pos + deltaIndex);
    setPos(nextPos);
    const roundedNow = Math.round(nextPos);
    if (roundedNow !== lastCrossedRef.current) {
      lastCrossedRef.current = roundedNow;
      playTick();
    }

    const now = performance.now();
    if (lastMoveRef.current) {
      const dt = Math.max(1, now - lastMoveRef.current.t);
      const dx = Math.abs(e.clientX - lastMoveRef.current.x);
      const speed = dx / dt; // px/ms
      updateDragSound(Math.min(1, speed / 2.2), e.clientX, stageWidth); // ~2.2px/ms سريع جداً — تطبيع مقصوص
    }
    lastMoveRef.current = { x: e.clientX, t: now };
  }, [clampIndex, setPos]);

  const onPointerUpDrag = useCallback(() => {
    setIsDragging(false);
    stopDragSound();
    lastMoveRef.current = null;
    animateTo(Math.round(posRef.current), { forceSnapSound: true });
  }, [animateTo]);

  // ── عجلة الفأرة ──────────────────────────────────────────────────────────
  const wheelAccumRef = useRef(0);
  const onWheel = useCallback((e) => {
    e.preventDefault();
    // بند 55/56 صراحةً: تجميد تدوير الحلقة أثناء حركة "فتح" لوحة جارية —
    // الفهرس المختار لا يجب أن يتغيّر قبل اكتمال الانتقال البصري.
    if (openingIndex !== null) return;
    wheelAccumRef.current += e.deltaY;
    const threshold = 40;
    if (Math.abs(wheelAccumRef.current) >= threshold) {
      const dir = wheelAccumRef.current > 0 ? 1 : -1;
      wheelAccumRef.current = 0;
      goTo(clampIndex(Math.round(posRef.current) + dir));
    }
  }, [clampIndex, goTo, openingIndex]);

  // ── لوحة المفاتيح ────────────────────────────────────────────────────────
  const onKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(clampIndex(Math.round(posRef.current) + 1)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(clampIndex(Math.round(posRef.current) - 1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOrOpen(Math.round(posRef.current)); }
  }, [clampIndex, goTo, selectOrOpen]);

  useEffect(() => () => cancelTween(), []);

  return {
    continuousPosition,
    selectedIndex,
    isDragging,
    openingIndex,
    goTo,
    selectOrOpen,
    triggerOpen,
    resetOpening,
    dragHandlers: { onPointerDown, onPointerMoveDrag, onPointerUpDrag },
    onWheel,
    onKeyDown,
  };
}

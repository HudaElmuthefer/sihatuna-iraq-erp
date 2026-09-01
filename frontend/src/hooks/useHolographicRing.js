import { useCallback, useEffect, useRef, useState } from 'react';
import { playSnap, playOpen } from '../utils/holographicSound';

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

  const animateTo = useCallback((target, { onDone } = {}) => {
    cancelTween();
    const from = posRef.current;
    const clamped = clampIndex(target);
    if (prefersReducedMotion()) {
      setPos(clamped);
      setSelectedIndex(Math.round(clamped));
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
        // نغمة نقرة مغناطيسية ناعمة — فقط عند استقرار حقيقي على فهرس مختلف
        // (بند صريح: صوت واحد عند الالتقاط، لا عند كل حركة/إطار). مقارنة مع
        // posRef.current (القيمة قبل هذا التحديث) لا مع selectedIndex نفسه،
        // لأن الأخير قد لا يزال يحمل القيمة القديمة بنفس اللحظة.
        if (settled !== Math.round(from)) playSnap();
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
  }, []);

  const onPointerMoveDrag = useCallback((e, stageWidth, visibleRange = 3) => {
    setIsDragging(true);
    // px إلى "وحدات فهرس": عرض مرجعي — سحب كامل عرض المسرح يساوي تقريباً
    // نصف عدد اللوحات المرئية (إحساس طبيعي، لا سريع جداً ولا بطيء جداً).
    const pxPerIndex = Math.max(40, stageWidth / (visibleRange * 0.9));
    const deltaPx = e.clientX - dragStartRef.current.x;
    const deltaIndex = -deltaPx / pxPerIndex; // سحب لليسار (deltaPx سالب) يقدّم للفهرس التالي
    setPos(clampIndex(dragStartRef.current.pos + deltaIndex));
  }, [clampIndex, setPos]);

  const onPointerUpDrag = useCallback(() => {
    setIsDragging(false);
    animateTo(Math.round(posRef.current));
  }, [animateTo]);

  // ── عجلة الفأرة ──────────────────────────────────────────────────────────
  const wheelAccumRef = useRef(0);
  const onWheel = useCallback((e) => {
    e.preventDefault();
    wheelAccumRef.current += e.deltaY;
    const threshold = 40;
    if (Math.abs(wheelAccumRef.current) >= threshold) {
      const dir = wheelAccumRef.current > 0 ? 1 : -1;
      wheelAccumRef.current = 0;
      goTo(clampIndex(Math.round(posRef.current) + dir));
    }
  }, [clampIndex, goTo]);

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

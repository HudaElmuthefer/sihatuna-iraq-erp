import { useCallback, useEffect, useRef, useState } from 'react';

// هندسة الحلقة: كل صفحة i تقع عند الزاوية (i - continuousPosition) * ANGLE_STEP
// حول محور Y المشترك (rotateY + translateZ من نفس نقطة الأصل) — نفس تقنية
// carousel القياسية ثلاثية الأبعاد: rotateY(angle) تُنشئ ضمنياً كِلا مركّبتي
// الموضع الأفقي والعمق حول نقطة ارتكاز واحدة، فتُنتج قوساً/قطعاً ناقصاً
// حقيقياً في الفضاء ثلاثي الأبعاد بلا حاجة لحساب x=cos/y=sin يدوياً — وهي
// بالضبط ما يُنتج "الميل نحو المركز" التلقائي للوحات اليسار/اليمين المطلوب
// بالمواصفة (كل لوحة تدور حول نفس المحور، فتُواجه المركز بطبيعتها).
export const ANGLE_STEP = 13; // درجة بين كل لوحتين متجاورتين
export const VISIBLE_RANGE = 10; // لا يُصيَّر أي عنصر أبعد من هذا (أداء + يطابق قوس 240-300° تقريباً)
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
export default function useHolographicRing(count, onOpen) {
  const [continuousPosition, setContinuousPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [openingIndex, setOpeningIndex] = useState(null);

  const posRef = useRef(0);
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
        setSelectedIndex(Math.round(clamped));
        onDone?.();
      }
    };
    tweenRef.current = requestAnimationFrame(step);
  }, [clampIndex, setPos]);

  const goTo = useCallback((index) => animateTo(index), [animateTo]);

  const triggerOpen = useCallback((index) => {
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

  // ── سحب الحلقة (Pointer Events + setPointerCapture) ─────────────────────
  const onPointerDown = useCallback((e) => {
    if (e.button !== undefined && e.button !== 0) return;
    cancelTween();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, pos: posRef.current };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }, []);

  const onPointerMoveDrag = useCallback((e, stageWidth) => {
    // px إلى "وحدات فهرس": عرض مرجعي — سحب كامل عرض المسرح يساوي تقريباً
    // نصف عدد اللوحات المرئية (إحساس طبيعي، لا سريع جداً ولا بطيء جداً).
    const pxPerIndex = Math.max(40, stageWidth / (VISIBLE_RANGE * 0.9));
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

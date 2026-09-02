import { useCallback, useRef, useState } from 'react';
import { playSnap, playOpen } from '../utils/holographicSound';

const OPEN_MS = 420;
// برهة قصيرة تسمح برؤية "تركيز" المدار على الصفحة قبل بدء حركة الفتح، عند
// طلب فتح قادم من الـSidebar (بند 56 صراحةً: ليست فتحاً فورياً).
const FOCUS_BEFORE_OPEN_MS = 320;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/*
 * حالة "المدار المتعدد" — لا سحب مستمر لكامل المشهد بعد الآن (بند صريح
 * بالمواصفة: لا drag لتدوير الحلقة؛ فقط Wheel/Arrow خطوة-بخطوة، بند 53/54).
 * السحب الفعلي أصبح خاصية كل مصغرة بذاتها (راجع HolographicOrbitPanel.js)
 * — سحب أي مصغرة نحو المركز مستقل تماماً عن تدوير المدار، فلا تعارض وضع
 * تفاعل يحتاج حله بينهما (بخلاف النظام الخطي السابق).
 */
export default function useHolographicOrbit(count, onOpen, initialIndex = 0) {
  const [rotationIndex, setRotationIndex] = useState(initialIndex);
  const [openingIndex, setOpeningIndex] = useState(null);
  const countRef = useRef(count);
  countRef.current = count;
  const openTimerRef = useRef(null);
  const focusTimerRef = useRef(null);

  const wrap = useCallback((v) => ((v % countRef.current) + countRef.current) % countRef.current, []);

  const rotateBy = useCallback((delta) => {
    setRotationIndex((v) => wrap(v + delta));
    playSnap();
  }, [wrap]);

  const triggerOpen = useCallback((absoluteIndex) => {
    playOpen();
    setOpeningIndex(absoluteIndex);
    if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
    const ms = prefersReducedMotion() ? 0 : OPEN_MS;
    openTimerRef.current = window.setTimeout(() => { onOpen?.(absoluteIndex); }, ms);
  }, [onOpen]);

  // انتهاء "opening" state — يُستدعى من الخارج بعد التنقّل الفعلي.
  const resetOpening = useCallback(() => setOpeningIndex(null), []);

  // بند 56 صراحةً: ضغط صفحة بالـSidebar لا يفتحها فوراً — يُدير المدار حتى
  // تصبح تلك الصفحة بالفتحة الأبرز (slot 0)، ثم يبدأ حركة الفتح المعتادة
  // (نفس مسار triggerOpen المستخدَم بالنقر/السحب المُقفَل).
  const focusAndOpen = useCallback((absoluteIndex) => {
    setRotationIndex(wrap(absoluteIndex));
    if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
    const ms = prefersReducedMotion() ? 0 : FOCUS_BEFORE_OPEN_MS;
    focusTimerRef.current = window.setTimeout(() => { triggerOpen(wrap(absoluteIndex)); }, ms);
  }, [wrap, triggerOpen]);

  // ── عجلة الفأرة — خطوة واحدة منطقية لكل عتبة، لا Spin مستمر (بند 39/54). ──
  const wheelAccumRef = useRef(0);
  const onWheel = useCallback((e) => {
    e.preventDefault();
    if (openingIndex !== null) return;
    wheelAccumRef.current += e.deltaY;
    const threshold = 45;
    if (Math.abs(wheelAccumRef.current) >= threshold) {
      const dir = wheelAccumRef.current > 0 ? 1 : -1;
      wheelAccumRef.current = 0;
      rotateBy(dir);
    }
  }, [rotateBy, openingIndex]);

  // ── لوحة المفاتيح (بند 55) ────────────────────────────────────────────────
  const onKeyDown = useCallback((e) => {
    if (openingIndex !== null) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); rotateBy(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); rotateBy(-1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerOpen(wrap(rotationIndex)); }
  }, [rotateBy, openingIndex, rotationIndex, triggerOpen, wrap]);

  return {
    rotationIndex,
    openingIndex,
    rotateBy,
    triggerOpen,
    resetOpening,
    focusAndOpen,
    onWheel,
    onKeyDown,
  };
}

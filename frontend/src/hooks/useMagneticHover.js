import { useEffect } from 'react';

/*
 * Very small "magnetic" pull toward the cursor — for large decorative icons
 * only (stat tiles, the customize control core), never for text or list
 * rows. Direct style.transform mutation via ref (no setState, no re-render
 * per pixel), capped at maxOffset (2-5px per spec) so it reads as a subtle
 * premium touch, not a toy. Skipped entirely on coarse/touch pointers and
 * when the user prefers reduced motion.
 */
export default function useMagneticHover(ref, maxOffset = 4) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!window.matchMedia('(pointer: fine)').matches) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const handleMove = (e) => {
      // بلا transition أثناء المتابعة الفعلية للمؤشر (تأخير هنا يجعلها
      // تشعر بالتخلّف)، فقط عند الخروج (أدناه) لعودة ناعمة لمكانها الأصلي.
      el.style.transition = 'none';
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = ((e.clientX - cx) / (rect.width / 2)) * maxOffset;
      const dy = ((e.clientY - cy) / (rect.height / 2)) * maxOffset;
      const clamp = (v) => Math.max(-maxOffset, Math.min(maxOffset, v));
      el.style.transform = `translate3d(${clamp(dx).toFixed(1)}px, ${clamp(dy).toFixed(1)}px, 0)`;
    };

    const handleLeave = () => {
      el.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transform = 'translate3d(0, 0, 0)';
    };

    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', handleLeave);
    return () => {
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', handleLeave);
      el.style.transform = '';
    };
  }, [ref, maxOffset]);
}

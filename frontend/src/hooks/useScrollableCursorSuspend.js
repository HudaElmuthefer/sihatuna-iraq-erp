import { useRef, useCallback, useEffect } from 'react';

/*
 * استراتيجية جديدة كلياً لكيرسر القوائم المنسدلة القابلة للتمرير — تستبدل
 * منطق اكتشاف حافة/thumb شريط التمرير بالكامل (لم يعمل عملياً رغم عدة
 * محاولات). القاعدة الآن بسيطة ومباشرة:
 *
 *   POINTER ENTERS scrollable dropdown  → إيقاف الـCustom Cursor بالكامل
 *   POINTER LEAVES  scrollable dropdown → إعادته تلقائياً
 *
 * لا اكتشاف لموضع الـthumb، لا حساب مسافة عن حافة، لا pointermove عالمي —
 * فقط onPointerEnter/onPointerLeave (لا mouseover/mouseout، التي تتكرر
 * عند الانتقال بين العناصر الأبناء) على الـDOM node الحقيقي للقائمة نفسها،
 * أياً كان مكان تركيبه (بما في ذلك عبر Portal مباشرة إلى document.body —
 * الـref هنا يشير للعقدة الفعلية بصرف النظر عن أين رُكِّبت في الشجرة).
 *
 * الاستخدام: ضع `ref` على عنصر القائمة القابل للتمرير الفعلي (ليس الـtrigger
 * ولا أي غلاف موضعة خارجي)، ثم `onPointerEnter`/`onPointerLeave` على نفس
 * العنصر بالضبط:
 *
 *   const { ref, onPointerEnter, onPointerLeave } = useScrollableCursorSuspend();
 *   <div ref={ref} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>...
 *
 * القابلية للتمرير تُفحَص من جديد في كل مرة يدخل فيها المؤشر (وليس مرة واحدة
 * عند التركيب) — قوائم بمحتوى ديناميكي (نتائج بحث/فلاتر) قد تصبح قابلة
 * للتمرير أو تتوقف عن ذلك بين فتحة وأخرى.
 */

function isScrollable(el) {
  if (!el) return false;
  return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
}

function cursorDropdownDebug(...args) {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof window !== 'undefined' && window.__CURSOR_DEBUG__) {
    // eslint-disable-next-line no-console
    console.log('[CursorDropdown]', ...args);
  }
}

// عدّاد مشترك بدل قيمة boolean واحدة — يدعم بأمان حالة نادرة (قائمة داخل
// قائمة، أو انتقال سريع بين لوحتين) بلا أن يُزيل أحدهما الصنف قبل أوانه.
let suspendCount = 0;

function suspendCursor() {
  suspendCount += 1;
  document.documentElement.classList.add('custom-cursor-suspended');
}

function restoreCursor() {
  suspendCount = Math.max(0, suspendCount - 1);
  if (suspendCount === 0) {
    document.documentElement.classList.remove('custom-cursor-suspended');
  }
}

export default function useScrollableCursorSuspend() {
  const ref = useRef(null);
  const suspendedRef = useRef(false);

  const onPointerEnter = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const scrollable = isScrollable(el);
    cursorDropdownDebug('Dropdown entered');
    cursorDropdownDebug('scrollHeight:', el.scrollHeight, '| clientHeight:', el.clientHeight, '| isScrollable:', scrollable);
    el.classList.toggle('scrollable-native-cursor', scrollable);
    if (scrollable && !suspendedRef.current) {
      suspendedRef.current = true;
      suspendCursor();
      cursorDropdownDebug('Custom cursor suspended');
    }
  }, []);

  const onPointerLeave = useCallback(() => {
    if (suspendedRef.current) {
      suspendedRef.current = false;
      restoreCursor();
      cursorDropdownDebug('Custom cursor restored');
    }
    if (ref.current) ref.current.classList.remove('scrollable-native-cursor');
  }, []);

  // شبكة أمان: لو أُزيل العنصر من الـDOM (القائمة أُغلقت) أثناء تعليق
  // المؤشر — بلا أي pointerleave أصلاً — لا يبقى الوضع "معلَّقاً" للأبد.
  useEffect(() => () => {
    if (suspendedRef.current) {
      suspendedRef.current = false;
      restoreCursor();
    }
  }, []);

  return { ref, onPointerEnter, onPointerLeave };
}

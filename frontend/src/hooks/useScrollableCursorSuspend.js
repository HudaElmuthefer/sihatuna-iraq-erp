import { useEffect } from 'react';
import { suspendCursor, restoreCursor } from '../utils/cursorSuspend';

// فرض المؤشر الأصلي طوال بقاء أي قائمة/لوحة قابلة للتمرير مفتوحة (وليس فقط
// عند اقتراب المؤشر من حافة شريط تمرير مصغَّر — تلك المحاولة سابقاً غير
// موثوقة عملياً وتم التخلي عنها صراحةً). بمجرد فتح اللوحة: مؤشر النظام
// الأصلي فوراً على كامل الشاشة. بمجرد إغلاقها: يعود المؤشر المخصَّص.
export default function useScrollableCursorSuspend(active) {
  useEffect(() => {
    if (!active) return undefined;
    suspendCursor();
    return () => restoreCursor();
  }, [active]);
}

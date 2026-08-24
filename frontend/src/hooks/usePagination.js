// frontend/src/hooks/usePagination.js
//
// Hook بسيط قابل لإعادة الاستخدام لتصفح أي قائمة طويلة بالصفحات — يعمل على
// البيانات المحمَّلة فعلياً بذاكرة المتصفح (وليس استدعاء إضافي للخادم)، لأن
// النظام أصلاً يحمّل كل موديول كاملاً عند تسجيل الدخول (نمط راسخ بكل الصفحات).
// الهدف هنا حل مشكلة بطء عرض جداول ضخمة بالمتصفح (مئات/آلاف الصفوف بالـ DOM
// دفعة وحدة)، بعرض شريحة واحدة بكل مرة فقط.
//
// الاستخدام:
//   const { pageItems, currentPage, setCurrentPage, totalPages } = usePagination(filtered, 50);
//   ثم اعرض pageItems بدل القائمة الكاملة، وأضف <Pagination .../> بالأسفل.
//
// ملاحظة: يرجع currentPage تلقائياً للصفحة 1 كلما تغيّر طول القائمة (مثلاً
// بعد بحث أو فلترة جديدة)، لتفادي عرض صفحة فاضية بالخطأ.
import { useState, useEffect, useMemo } from 'react';

export default function usePagination(items, pageSize = 50) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(Math.ceil((items?.length || 0) / pageSize), 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [items?.length, pageSize]);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return (items || []).slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  return { pageItems, currentPage, setCurrentPage, totalPages, totalItems: items?.length || 0 };
}

// frontend/src/hooks/useServerPagination.js
//
// جلب صفحة واحدة من البيانات مباشرة من الخادم (بدل تحميل كل السجلات دفعة
// وحدة وتقطيعها محلياً بـ usePagination) — الفرق المهم: هذا الـ hook يرسل
// page/limit/search/status للخادم، ويستقبل بس السجلات المطلوبة لهذي الصفحة
// تحديداً. هذا يخلي عرض/بحث آلاف السجلات (مرضى، أطباء...) سريع بغض النظر عن
// حجم الجدول الكلي، لأن الخادم هو اللي يفلتر ويرقّم (LIMIT/OFFSET) مباشرة
// بقاعدة البيانات، بدل ما يرسل كل شيء ويترك المتصفح يفلتر.
//
// ملاحظة مهمة: هذا منفصل تماماً عن حالة السياق العام (مثل `patients` بـ
// AppContext) المُستخدَمة بصفحات ثانية (الفوترة، المواعيد...) لعرض قوائم
// منسدلة — تلك تبقى مُحمَّلة كاملة كما هي، وهذا الـ hook يُستخدَم فقط لعرض
// الجدول نفسه بصفحة المرضى/الأطباء الرئيسية.
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

export default function useServerPagination(apiName, { search = '', status = 'all', pageSize = 50, filters = {} } = {}) {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0); // يمنع نتيجة طلب قديم متأخر من الكتابة فوق نتيجة أحدث (سباق طلبات)
  // نحوّل كائن الفلاتر لنص مستقر (JSON) حتى نقدر نستخدمه بمصفوفة اعتماديات
  // useEffect/useCallback مباشرة — كائن جديد بكل رندر كان راح يسبب حلقة جلب
  // لا نهائية لو استخدمناه مباشرة كاعتمادية
  const filtersKey = JSON.stringify(filters);

  const fetchPage = useCallback(async (pageToFetch) => {
    const myId = ++requestId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageToFetch), limit: String(pageSize) });
      if (search) params.set('search', search);
      if (status && status !== 'all') params.set('status', status);
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params.set(key, value);
      });
      const result = await api.get(`/${apiName}?${params.toString()}`);
      if (myId !== requestId.current) return; // نتيجة قديمة — تجاهليها
      if (result && Array.isArray(result.data)) {
        setData(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } else if (Array.isArray(result)) {
        // توافق احتياطي: خادم قديم لا يدعم الترقيم بعد يرجّع مصفوفة خام —
        // نعرضها كصفحة واحدة كاملة بدل كسر الصفحة
        setData(result);
        setTotal(result.length);
        setTotalPages(1);
      }
    } catch (err) {
      console.warn(`⚠️ تعذّر جلب صفحة ${apiName}:`, err.message);
    } finally {
      if (myId === requestId.current) setLoading(false);
    }
  }, [apiName, search, status, pageSize, filtersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // أي تغيّر بالبحث أو الفلتر يرجعنا لصفحة 1 (نتيجة بحث جديدة تماماً)
  useEffect(() => { setPage(1); }, [search, status, filtersKey]);

  useEffect(() => { fetchPage(page); }, [page, fetchPage]);

  return { data, page, setPage, total, totalPages, loading, refetch: () => fetchPage(page) };
}

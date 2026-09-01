import React, { useMemo, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import { DARK_HOLOGRAPHIC_PAGES } from '../../config/darkHolographicPages';
import HolographicPageRing from './HolographicPageRing';
import CenterDropZone from './CenterDropZone';

/*
 * غرفة التحكم الهولوغرافية — الصفحة الرئيسية بالوضع الداكن. حلقة ثلاثية
 * الأبعاد لكل صفحات النظام المسموحة تحيط بمساحة عمل مركزية. 'لوحة التحكم'
 * نفسها هي أول عنصر بالسجل (DARK_HOLOGRAPHIC_PAGES) وتكون اللوحة المختارة
 * افتراضياً — تعرض مؤشرات KPI حقيقية داخل معاينتها (DashboardPreview) بدل
 * أرقام عائمة منفصلة عن الحلقة. واجهتها البرمجية (selectAndOpen) تُسجَّل
 * بمرجع مُمرَّر من Layout.js عبر Outlet context، حتى يستطيع السايدبار
 * تشغيل نفس حركة "تدوير ثم فتح" بدل تنقّل فوري منفصل بصرياً عن الحلقة.
 */
export default function DarkHolographicHome() {
  const { lang, user, hasPermission, hospitals } = useApp();
  const navigate = useNavigate();
  const ringRef = useRef(null);
  const dropZoneRef = useRef(null);
  const ringApiRef = useOutletContext();

  const pages = useMemo(() => {
    const userHospital = hospitals.find(h => h.id === user?.hospitalId);
    const hospitalPages = userHospital?.enabled_pages;
    return DARK_HOLOGRAPHIC_PAGES.filter(p => {
      if (!hasPermission(p.key)) return false;
      if (Array.isArray(hospitalPages) && hospitalPages.length > 0) {
        return hospitalPages.includes(p.key) || p.key === 'dashboard' || p.key === 'settings';
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, hospitals]);

  React.useEffect(() => {
    if (!ringApiRef) return undefined;
    ringApiRef.current = {
      selectAndOpen(pageKey) { ringRef.current?.selectAndOpen(pageKey); },
    };
    return () => { if (ringApiRef) ringApiRef.current = null; };
  }, [ringApiRef]);

  // 'لوحة التحكم' هي '/' نفسها بالفعل — "فتحها" من الحلقة لا يعني تنقّلاً
  // فعلياً (لا مسار منفصل)، فقط يبقيها مركّزة بالمقدمة.
  const handleOpenPage = (page) => {
    if (page.key !== 'dashboard') navigate(page.path);
  };

  return (
    <div className="dhh-shell">
      <CenterDropZone ref={dropZoneRef} lang={lang} />
      <HolographicPageRing
        ref={ringRef}
        pages={pages}
        lang={lang}
        dropZoneRef={dropZoneRef}
        onOpenPage={handleOpenPage}
      />
    </div>
  );
}

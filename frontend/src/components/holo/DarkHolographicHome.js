import React, { useMemo, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useApp, ALL_PAGES } from '../../contexts/AppContext';
import HolographicPageRing from './HolographicPageRing';
import CenterDropZone from './CenterDropZone';

/*
 * غرفة التحكم الهولوغرافية — الصفحة الرئيسية بالوضع الداكن. حلقة ثلاثية
 * الأبعاد لكل صفحات النظام المسموحة تحيط بمساحة عمل مركزية (نظرة عامة حين
 * لا شيء مفتوح). واجهتها البرمجية (selectAndOpen) تُسجَّل بمرجع مُمرَّر من
 * Layout.js عبر Outlet context، حتى يستطيع السايدبار تشغيل نفس حركة
 * "تدوير ثم فتح" بدل تنقّل فوري منفصل بصرياً عن الحلقة.
 */
export default function DarkHolographicHome() {
  const { lang, user, hasPermission, hospitals, patients, doctors, appointments } = useApp();
  const navigate = useNavigate();
  const ringRef = useRef(null);
  const dropZoneRef = useRef(null);
  const ringApiRef = useOutletContext();

  const pages = useMemo(() => {
    const userHospital = hospitals.find(h => h.id === user?.hospitalId);
    const hospitalPages = userHospital?.enabled_pages;
    return ALL_PAGES.filter(p => {
      if (p.key === 'dashboard') return false;
      if (!hasPermission(p.key)) return false;
      if (Array.isArray(hospitalPages) && hospitalPages.length > 0) {
        return hospitalPages.includes(p.key) || p.key === 'settings';
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

  const handleOpenPage = (page) => navigate(page.path);

  const today = new Date().toISOString().split('T')[0];
  const todayApts = appointments.filter(a => a.date === today).length;
  const activeDoctors = doctors.filter(d => d.status === 'active').length;

  return (
    <div className="dhh-shell">
      <div className="dhh-center-layer">
        <CenterDropZone ref={dropZoneRef} lang={lang} />
        <div className="dhh-idle">
          <div className="dhh-idle-title">{lang === 'ar' ? 'حالة النظام' : 'System Status'}</div>
          <div className="dhh-idle-stats">
            <div className="dhh-idle-stat">
              <div className="dhh-idle-value">{patients.length}</div>
              <div className="dhh-idle-label">{lang === 'ar' ? 'المرضى' : 'Patients'}</div>
            </div>
            <div className="dhh-idle-stat">
              <div className="dhh-idle-value">{activeDoctors}</div>
              <div className="dhh-idle-label">{lang === 'ar' ? 'أطباء نشطون' : 'Active Doctors'}</div>
            </div>
            <div className="dhh-idle-stat">
              <div className="dhh-idle-value">{todayApts}</div>
              <div className="dhh-idle-label">{lang === 'ar' ? 'مواعيد اليوم' : "Today's Appointments"}</div>
            </div>
          </div>
        </div>
      </div>

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

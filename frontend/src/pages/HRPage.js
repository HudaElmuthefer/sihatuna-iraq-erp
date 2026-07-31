/* eslint-disable no-unused-vars */
// frontend/src/pages/HRPage.js
//
// ── إصلاح: هذا الملف كان 1261 سطر بملف واحد (كل التبويبات مع بعض) — قُسِّم
// لملفات أصغر بمجلد frontend/src/pages/hr/ (كل تبويب بملفه الخاص + shared.js
// للثوابت المشتركة). التقسيم نسخ حرفي بدون أي تغيير بالمنطق أو السلوك —
// راجعي مجلد hr/ لتفاصيل كل تبويب. هذا الملف الحين مجرد نقطة تجميع تربط
// التبويبات مع بعض.
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { I18N } from './hr/shared';
import EmployeesTab from './hr/EmployeesTab';
import OutgoingTab from './hr/OutgoingTab';
import IncomingTab from './hr/IncomingTab';
import RetiredTab from './hr/RetiredTab';
import DossiersTab from './hr/DossiersTab';
import BarcodeTab from './hr/BarcodeTab';
import PageBanner from '../components/PageBanner';

const BANNER_GRADIENT = 'linear-gradient(135deg,#1c1917,#44403c)';
const HR_TAB_KEYS = ['employees', 'outgoing', 'incoming', 'retired', 'dossiers', 'barcode'];

export default function HRPage() {
  const { lang } = useApp();
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  // القيمة الابتدائية تحترم ?tab= بالرابط (تصل من القائمة الجانبية القابلة
  // للتوسّع — راجعي components/Layout.js وconfig/sidebarSubTabs.js) دون أي
  // تغيير على سلوك التبديل اليدوي بين التبويبات داخل الصفحة نفسها. تُتجاهَل
  // أي قيمة غير معروفة (رابط قديم/مُعدَّل يدوياً) بدل عرض صفحة فارغة بصمت.
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const fromUrl = searchParams.get('tab');
    return HR_TAB_KEYS.includes(fromUrl) ? fromUrl : 'employees';
  });
  // الـuseState أعلاه يُنفَّذ مرة واحدة فقط عند التركيب — لا يكفي وحده حين
  // تُنقَّل من تبويب فرعي بالقائمة الجانبية لآخر بنفس هذه الصفحة (المسار
  // نفسه، ?tab= فقط يتغيّر)، فـHRPage يبقى مُثبَّتاً وrouter لا يُعيد تركيبه.
  // هذا الـeffect يُحدِّث التبويب كلما تغيّر ?tab= فعلياً بالرابط، دون التأثير
  // على التبديل اليدوي (أزرار التبويبات لا تُغيّر الرابط أصلاً).
  React.useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (HR_TAB_KEYS.includes(fromUrl)) setTab(fromUrl);
  }, [searchParams]);

  const HR_TABS = [
    { key:'employees', label: L('tab_employees'), icon:'👥' },
    { key:'outgoing',  label: L('tab_outgoing'),  icon:'📤' },
    { key:'incoming',  label: L('tab_incoming'),  icon:'📥' },
    { key:'retired',   label: L('tab_retired'),   icon:'👴' },
    { key:'dossiers',  label: L('tab_dossiers'),  icon:'📂' },
    { key:'barcode',   label: lang==='ar'?'باركود الكتب':'Letters Barcode', icon:'🏷️' },
  ];

  return (
    <div className="page-content">
      <PageBanner icon="👔" title={L('hr_title')} subtitle={L('hr_subtitle')} gradient={BANNER_GRADIENT} />
      <div style={{ display:'flex', gap:6, marginBottom:24, flexWrap:'wrap' }}>
        {HR_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding:'9px 18px', borderRadius:10, border:`2px solid ${tab===t.key?'#1a6bab':'var(--border)'}`, background:tab===t.key?'#1a6bab':'var(--bg-secondary)', color:tab===t.key?'#fff':'var(--text-primary)', cursor:'pointer', fontSize:13, fontWeight:tab===t.key?700:400, display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'employees' && <EmployeesTab lang={lang} />}
      {tab === 'outgoing'  && <OutgoingTab  lang={lang} />}
      {tab === 'incoming'  && <IncomingTab  lang={lang} />}
      {tab === 'retired'   && <RetiredTab   lang={lang} />}
      {tab === 'dossiers'  && <DossiersTab  lang={lang} />}
      {tab === 'barcode'   && <BarcodeTab   lang={lang} />}
    </div>
  );
}


// frontend/src/pages/AccountsPage.js
//
// ── إصلاح: هذا الملف كان 994 سطر بملف واحد (كل التبويبات مع بعض) — قُسِّم
// لملفات أصغر بمجلد frontend/src/pages/accounts/ (كل تبويب بملفه الخاص +
// shared.js للثوابت المشتركة). التقسيم نسخ حرفي بدون أي تغيير بالمنطق أو
// السلوك — راجع مجلد accounts/ لتفاصيل كل تبويب.
//
// ── إصلاح: تبويبا "الترفيعات" و"العلاوات" كانا منفصلين بجدولين مختلفين رغم
// كثرة الحالات المشتركة (نفس الموظف، نفس السجل الإداري) — دُمِجا بتبويب واحد
// "سجل الترفيعات والعلاوات" (راجع accounts/PromotionsAllowancesTab.js
// وmigrations-sql/014_merge_promotions_allowances.sql).
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import GeneralTab from './accounts/GeneralTab';
import SalariesTab from './accounts/SalariesTab';
import PromotionsAllowancesTab from './accounts/PromotionsAllowancesTab';
import PageBanner from '../components/PageBanner';

const BANNER_GRADIENT = 'linear-gradient(135deg,#064e3b,#059669)';

const ACCT_TABS = [
  { key:'general',    labelKey:'acc_tab_general',   icon:'💰' },
  { key:'salaries',   labelKey:'acc_tab_salaries',  icon:'💵' },
  { key:'promotionsAllowances', labelKey:'acc_promo_allow_title', icon:'⬆️' },
];

export default function AccountsPage() {
  // القيمة الابتدائية تحترم ?tab= بالرابط (تصل من القائمة الجانبية القابلة
  // للتوسّع — راجع components/Layout.js وconfig/sidebarSubTabs.js)، مع
  // تجاهل أي قيمة غير معروفة بدل عرض صفحة فارغة بصمت.
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const fromUrl = searchParams.get('tab');
    return ACCT_TABS.some(t => t.key === fromUrl) ? fromUrl : 'general';
  });
  // الـuseState أعلاه يُنفَّذ مرة واحدة فقط عند التركيب — لا يكفي وحده حين
  // تُنقَّل من تبويب فرعي بالقائمة الجانبية لآخر بنفس هذه الصفحة (المسار
  // نفسه، ?tab= فقط يتغيّر)، فالصفحة تبقى مُثبَّتة وrouter لا يُعيد تركيبها.
  // هذا الـeffect يُحدِّث التبويب كلما تغيّر ?tab= فعلياً بالرابط، دون التأثير
  // على التبديل اليدوي (أزرار التبويبات لا تُغيّر الرابط أصلاً).
  React.useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (ACCT_TABS.some(t => t.key === fromUrl)) setTab(fromUrl);
  }, [searchParams]);
  const { lang, user } = useApp();
  const tr = useT(lang);

  // ── إصلاح: الأرقام الحمراء بجانب "الترفيعات والعلاوات" كانت تُحسَب من
  // بيانات تجريبية ثابتة بالكود سابقاً — رقم مجمَّد لا علاقة له بالبيانات
  // الحقيقية إطلاقاً. الآن يُجلَب مباشرة من قاعدة البيانات الحقيقية، وكلا
  // العدَّادين (ترفيع مستحق/علاوة مستحقة) يُحسَبان من نفس السجل المُوحَّد.
  const [promotionDue, setPromotionDue] = useState(0);
  const [allowanceDue, setAllowanceDue] = useState(0);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.get('/promotionsAllowances').catch(() => [])
      .then((records) => {
        if (cancelled) return;
        if (Array.isArray(records)) {
          setPromotionDue(records.filter(r => r.promotionStatus === 'مستحق').length);
          setAllowanceDue(records.filter(r => r.allowanceStatus === 'مستحقة').length);
        }
      });
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalDue = promotionDue + allowanceDue;

  return (
    <div className="page-content">
      <PageBanner icon="💰" title={tr('acc_title')} subtitle={tr('acc_subtitle')} gradient={BANNER_GRADIENT} />

      <div style={{ display:'flex', gap:6, marginBottom:24, flexWrap:'wrap' }}>
        {ACCT_TABS.map(t => (
          <button key={t.key} onClick={()=>setTab(t.key)} style={{
            padding:'9px 18px', borderRadius:10, border:`2px solid ${tab===t.key?'#1a6bab':'var(--border)'}`,
            background:tab===t.key?'#1a6bab':'var(--bg-secondary)',
            color:tab===t.key?'#fff':'var(--text-primary)',
            cursor:'pointer', fontSize:13, fontWeight:tab===t.key?700:400,
            display:'flex', alignItems:'center', gap:6, fontFamily:'inherit', position:'relative',
          }}>
            {t.icon} {tr(t.labelKey)}
            {t.key==='promotionsAllowances' && totalDue>0 && <span style={{ background:'#ef4444', color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{totalDue}</span>}
          </button>
        ))}
      </div>

      {tab==='general'    && <GeneralTab />}
      {tab==='salaries'   && <SalariesTab />}
      {tab==='promotionsAllowances' && <PromotionsAllowancesTab />}
    </div>
  );
}

// frontend/src/pages/AccountsPage.js
//
// ── إصلاح: هذا الملف كان 994 سطر بملف واحد (كل التبويبات مع بعض) — قُسِّم
// لملفات أصغر بمجلد frontend/src/pages/accounts/ (كل تبويب بملفه الخاص +
// shared.js للثوابت المشتركة). التقسيم نسخ حرفي بدون أي تغيير بالمنطق أو
// السلوك — راجعي مجلد accounts/ لتفاصيل كل تبويب.
import React, { useState, useEffect } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import GeneralTab from './accounts/GeneralTab';
import SalariesTab from './accounts/SalariesTab';
import PromotionsTab from './accounts/PromotionsTab';
import AllowancesTab from './accounts/AllowancesTab';

const ACCT_TABS = [
  { key:'general',    labelKey:'acc_tab_general',   icon:'💰' },
  { key:'salaries',   labelKey:'acc_tab_salaries',  icon:'💵' },
  { key:'promotions', labelKey:'acc_tab_promotions', icon:'⬆️' },
  { key:'allowances', labelKey:'acc_tab_allowances', icon:'🎁' },
];

export default function AccountsPage() {
  const [tab, setTab] = useState('general');
  const { lang, user } = useApp();
  const tr = useT(lang);

  // ── إصلاح: الأرقام الحمراء بجانب "الترفيعات" و"العلاوات" كانت تُحسَب من
  // بيانات تجريبية ثابتة بالكود (initPromotions/initAllowances) — رقم مجمَّد
  // لا علاقة له بالبيانات الحقيقية إطلاقاً، حتى لو كل الترفيعات الحقيقية
  // منجَزة فعلاً كان يضل يعرض تنبيهاً وهمياً (أو العكس). الآن يُجلَب مباشرة
  // من قاعدة البيانات الحقيقية.
  const [promotionDue, setPromotionDue] = useState(0);
  const [allowanceDue, setAllowanceDue] = useState(0);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([api.get('/promotions').catch(() => []), api.get('/allowances').catch(() => [])])
      .then(([promotions, allowances]) => {
        if (cancelled) return;
        if (Array.isArray(promotions)) setPromotionDue(promotions.filter(p => p.status === 'due').length);
        if (Array.isArray(allowances)) setAllowanceDue(allowances.filter(a => a.status === 'due').length);
      });
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page-content">
      <div style={{ background:'linear-gradient(135deg,#064e3b,#059669)', borderRadius:16, padding:'24px 28px', marginBottom:24, color:'#fff', display:'flex', alignItems:'center', gap:16 }}>
        <span style={{ fontSize:36 }}>💰</span>
        <div>
          <h1 style={{ margin:0, fontSize:22 }}>{tr('acc_title')}</h1>
          <p style={{ margin:'4px 0 0', opacity:0.7, fontSize:13 }}>{tr('acc_subtitle')}</p>
        </div>
      </div>

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
            {t.key==='promotions' && promotionDue>0 && <span style={{ background:'#ef4444', color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{promotionDue}</span>}
            {t.key==='allowances' && allowanceDue>0 && <span style={{ background:'#f59e0b', color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{allowanceDue}</span>}
          </button>
        ))}
      </div>

      {tab==='general'    && <GeneralTab />}
      {tab==='salaries'   && <SalariesTab />}
      {tab==='promotions' && <PromotionsTab />}
      {tab==='allowances' && <AllowancesTab />}
    </div>
  );
}

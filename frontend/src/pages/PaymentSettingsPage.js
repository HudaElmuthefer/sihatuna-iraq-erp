/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { useApp, PAYMENT_PROVIDERS } from '../contexts/AppContext';
import PageBanner from '../components/PageBanner';

const BANNER_GRADIENT = 'linear-gradient(135deg, #713f12 0%, #a16207 100%)';

const TYPE_LABELS = {
  cash:          { ar:'نقدي',            en:'Cash' },
  local_card:    { ar:'بطاقات محلية',    en:'Local Cards' },
  international: { ar:'دولي',            en:'International' },
};

export default function PaymentSettingsPage() {
  const { lang, showToast, paymentGateways, togglePaymentGateway, savePaymentCredentials } = useApp();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});

  const S = {
    page:{padding:24,direction:dir},
    section:{marginBottom:28},
    sectionTitle:{fontSize:14,fontWeight:700,borderBottom:'2px solid #d4af37',paddingBottom:8,marginBottom:12,color:'var(--text-primary)'},
    row:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',border:'1px solid var(--border)',borderRadius:10,marginBottom:8,background:'var(--bg-card)'},
    btn:(c='#1a6bab')=>({padding:'7px 14px',background:c,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600}),
    btnGhost:{padding:'7px 14px',background:'transparent',color:'var(--text-primary)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer',fontSize:12},
    modal:{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999},
    mbox:{background:'var(--bg-primary)',borderRadius:16,padding:28,width:'100%',maxWidth:440,direction:dir},
    fi:{width:'100%',padding:'8px 10px',border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box',marginBottom:10},
    warn:{background:'#fef3c7',border:'1px solid #f59e0b',borderRadius:10,padding:'12px 16px',fontSize:12,color:'#92400e',marginBottom:20,lineHeight:1.7},
  };

  const config = (code) => paymentGateways.find(g => g.providerCode === code);
  const isActive = (code) => config(code)?.isActive;

  function openEdit(provider) {
    setEditing(provider);
    // بيانات الاعتماد المشفّرة لا تُعاد من الخادم أبداً لأسباب أمنية — الحقول
    // تبدأ فارغة دائماً، وإدخال قيم جديدة يستبدل القديمة عند الحفظ.
    setDraft({ isSandbox: config(provider.code)?.isSandbox ?? true });
  }

  async function save() {
    const { isSandbox, ...credentials } = draft;
    const ok = await savePaymentCredentials(editing.code, credentials, isSandbox);
    if (!ok) return;
    showToast(L('تم حفظ الإعدادات', 'Settings saved'), 'success');
    setEditing(null);
    setDraft({});
  }

  const grouped = PAYMENT_PROVIDERS.reduce((acc, p) => {
    acc[p.type] = acc[p.type] || [];
    acc[p.type].push(p);
    return acc;
  }, {});

  return (
    <div style={S.page}>
      <PageBanner
        icon="💳"
        title={L('إعدادات بوابات الدفع', 'Payment Gateway Settings')}
        subtitle={L('فعّل أي بوابة دفع تريدها حسب اتفاقيات المستشفى', 'Enable payment gateways per your hospital agreements')}
        gradient={BANNER_GRADIENT}
      />

      <div style={S.warn}>
        {L(
          '🔒 بيانات الاعتماد (مفاتيح API) تُشفَّر (AES-256-GCM) قبل حفظها بقاعدة البيانات، ولا تُعرض مجدداً بعد الحفظ لأسباب أمنية — عند فتح شاشة "بيانات الاعتماد" لبوابة مفعّلة، أدخل القيم من جديد لتحديثها.',
          '🔒 Credentials (API keys) are encrypted (AES-256-GCM) before being stored, and are never displayed again after saving for security reasons — when opening "Credentials" for an already-configured gateway, re-enter the values to update them.'
        )}
      </div>

      {Object.entries(grouped).map(([type, providers]) => (
        <div key={type} style={S.section}>
          <div style={S.sectionTitle}>{L(TYPE_LABELS[type].ar, TYPE_LABELS[type].en)}</div>
          {providers.map(p => {
            const active = isActive(p.code);
            return (
              <div key={p.code} style={S.row}>
                <div>
                  <strong style={{ color:'var(--text-primary)' }}>{L(p.nameAr, p.nameEn)}</strong>
                  {active && <span style={{ marginInlineStart:8, color:'#10b981', fontSize:11 }}>● {L('مفعّلة','Active')}</span>}
                  {config(p.code)?.hasCredentials && <span style={{ marginInlineStart:8, color:'var(--text-secondary)', fontSize:11 }}>🔒 {L('بيانات محفوظة','Credentials saved')}</span>}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {p.requiresCredentials && (
                    <button style={S.btnGhost} onClick={() => openEdit(p)}>{L('بيانات الاعتماد','Credentials')}</button>
                  )}
                  <button style={S.btn(active ? '#ef4444' : '#1a6bab')} onClick={() => togglePaymentGateway(p.code)}>
                    {active ? L('تعطيل','Disable') : L('تفعيل','Enable')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {editing && (
        <div style={S.modal} onClick={() => setEditing(null)}>
          <div style={S.mbox} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop:0 }}>{L(editing.nameAr, editing.nameEn)}</h3>
            {(editing.fields || []).map(field => (
              <input
                key={field}
                style={S.fi}
                placeholder={field}
                type={field.includes('secret') || field.includes('key') ? 'password' : 'text'}
                value={draft[field] || ''}
                onChange={e => setDraft({ ...draft, [field]: e.target.value })}
              />
            ))}
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-primary)', marginBottom:10 }}>
              <input type="checkbox" checked={draft.isSandbox ?? true} onChange={e => setDraft({ ...draft, isSandbox: e.target.checked })} />
              {L('وضع تجريبي (Sandbox)','Sandbox mode')}
            </label>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
              <button style={S.btnGhost} onClick={() => setEditing(null)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn()} onClick={save}>{L('حفظ','Save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

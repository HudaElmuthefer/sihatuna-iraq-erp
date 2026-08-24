/* eslint-disable no-unused-vars */
import React, { useState, useMemo } from 'react';
import { useApp, PAYMENT_PROVIDERS } from '../contexts/AppContext';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import PageBanner from '../components/PageBanner';
import DateRangeFilter from '../components/DateRangeFilter';

const BANNER_GRADIENT = 'linear-gradient(135deg, #475569 0%, #1e293b 100%)';

const CATEGORY_LABELS = {
  consultation: { ar:'كشفية',  en:'Consultation', icon:'🩺' },
  lab:          { ar:'مختبر',  en:'Laboratory',   icon:'🧪' },
  radiology:    { ar:'أشعة',   en:'Radiology',    icon:'📷' },
  pharmacy:     { ar:'صيدلية', en:'Pharmacy',     icon:'💊' },
  other:        { ar:'أخرى',   en:'Other',        icon:'📋' },
};

export default function BillingPage() {
  const {
    lang, showToast, patients,
    servicePrices, updateServicePrice,
    invoices, createInvoice, addInvoiceItem, removeInvoiceItem, payInvoice, processPayment,
    paymentGateways,
  } = useApp();

  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [qty, setQty] = useState(1);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');
  const [manualRef, setManualRef] = useState('');
  const [managePrices, setManagePrices] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showInvoiceImport, setShowInvoiceImport] = useState(false);

  const S = {
    page:{padding:24,direction:dir},
    card:{background:'var(--bg-card)',borderRadius:14,padding:20,marginBottom:20,border:'1px solid var(--border)'},
    label:{fontSize:12,color:'var(--text-secondary)',marginBottom:6,display:'block'},
    fi:{width:'100%',padding:'8px 10px',border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-primary)',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'},
    btn:(c='#1a6bab')=>({padding:'9px 18px',background:c,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}),
    btnGhost:{padding:'9px 18px',background:'transparent',color:'var(--text-primary)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer',fontSize:13},
    row:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--border)'},
    g3:{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10,alignItems:'end'},
    modal:{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999},
    mbox:{background:'var(--bg-primary)',borderRadius:16,padding:28,width:'100%',maxWidth:420,direction:dir},
  };

  const currentInvoice = useMemo(
    () => invoices.find(inv => inv.patientId === Number(selectedPatientId) && inv.status === 'unpaid'),
    [invoices, selectedPatientId]
  );

  // Filters by paidAt (not createdAt): this list is specifically "recent
  // PAID invoices", and an invoice can sit unpaid for a while after
  // creation — paidAt is what "recent" means here. Filtering happens before
  // the slice(0,10) cap, so a date range narrows which invoices are
  // eligible to appear rather than just hiding rows from the fixed last-10.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const paidInvoices = useMemo(
    () => invoices
      .filter(inv => inv.status === 'paid')
      .filter(inv => (!dateFrom || (inv.paidAt || '').slice(0, 10) >= dateFrom) && (!dateTo || (inv.paidAt || '').slice(0, 10) <= dateTo))
      .sort((a,b) => new Date(b.paidAt) - new Date(a.paidAt))
      .slice(0, 10),
    [invoices, dateFrom, dateTo]
  );

  const activeGateways = paymentGateways.filter(g => g.isActive);
  const payOptions = activeGateways.length > 0
    ? activeGateways.map(g => PAYMENT_PROVIDERS.find(p => p.code === g.providerCode)).filter(Boolean)
    : [PAYMENT_PROVIDERS[0]]; // نقدي كخيار افتراضي دائماً حتى لو لا توجد بوابات مفعّلة

  function handleSelectPatient(id) {
    setSelectedPatientId(id);
    if (id) createInvoice(Number(id));
  }

  function handleAddItem() {
    const svc = servicePrices.find(s => s.id === Number(selectedServiceId));
    if (!svc) { showToast(L('اختر خدمة أولاً','Select a service first'), 'error'); return; }
    if (!currentInvoice) { showToast(L('اختر مريضاً أولاً','Select a patient first'), 'error'); return; }
    addInvoiceItem(currentInvoice.id, {
      description: L(svc.nameAr, svc.nameEn),
      category: svc.category,
      price: customPrice !== '' ? Number(customPrice) : svc.price,
      qty: Number(qty) || 1,
    });
    setSelectedServiceId(''); setCustomPrice(''); setQty(1);
  }

  const [processing, setProcessing] = useState(false);

  async function confirmPayment() {
    if (!currentInvoice || currentInvoice.items.length === 0) {
      showToast(L('أضف خدمة واحدة على الأقل قبل الدفع','Add at least one service before paying'), 'error');
      return;
    }
    if (payMethod !== 'cash' && !manualRef.trim()) {
      showToast(L('أدخل الرقم المرجعي من جهاز الـ POS','Enter the POS terminal reference code'), 'error');
      return;
    }
    setProcessing(true);
    const success = await processPayment(
      currentInvoice.id,
      Number(selectedPatientId),
      payMethod,
      currentInvoice.total,
      manualRef.trim() || null
    );
    setProcessing(false);
    if (!success) return; // رسالة الخطأ عُرضت مسبقاً داخل processPayment نفسها
    showToast(L('تم تسجيل الدفع بنجاح ✅','Payment recorded successfully ✅'), 'success');
    setShowPayModal(false);
    setSelectedPatientId('');
    setManualRef('');
  }

  const patientName = (id) => patients.find(p => p.id === Number(id))?.name || '—';

  return (
    <div style={S.page}>
      <PageBanner
        icon="🧾"
        title={L('الفوترة والدفع', 'Billing & Payment')}
        subtitle={L('اختر المريض، اجمع خدماته، واستلم الدفع', "Select patient, add services, and collect payment")}
        gradient={BANNER_GRADIENT}
      >
        <button style={{ ...S.btnGhost, background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.5)' }} onClick={() => setShowInvoiceImport(true)}>
          📊 {L('استيراد فواتير من Excel','Import Invoices from Excel')}
        </button>
        <ExcelExportButton apiName="invoices" lang={lang} onError={(m) => showToast(m, 'error')} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.5)' }} />
        <button style={{ ...S.btnGhost, background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.5)' }} onClick={() => setShowImport(true)}>
          📊 {L('استيراد قائمة الأسعار من Excel','Import Price List from Excel')}
        </button>
        <ExcelExportButton apiName="servicePrices" lang={lang} onError={(m) => showToast(m, 'error')} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.5)' }} />
        <button style={{ ...S.btnGhost, background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.5)' }} onClick={() => setManagePrices(!managePrices)}>
          {managePrices ? L('إخفاء قائمة الأسعار','Hide Price List') : L('⚙️ تعديل الأسعار الافتراضية','⚙️ Edit Default Prices')}
        </button>
      </PageBanner>

      {managePrices && (
        <div style={S.card}>
          <h3 style={{ marginTop:0, fontSize:14 }}>{L('قائمة الأسعار الافتراضية','Default Price List')}</h3>
          {Object.entries(CATEGORY_LABELS).map(([cat, info]) => (
            <div key={cat} style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:6 }}>{info.icon} {L(info.ar, info.en)}</div>
              {servicePrices.filter(s => s.category === cat).map(s => (
                <div key={s.id} style={S.row}>
                  <span style={{ fontSize:13 }}>{L(s.nameAr, s.nameEn)}</span>
                  <input
                    type="number" style={{ ...S.fi, width:120 }}
                    value={s.price}
                    onChange={e => updateServicePrice(s.id, e.target.value)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={S.card}>
        <label style={S.label}>{L('المريض','Patient')}</label>
        <select style={S.fi} value={selectedPatientId} onChange={e => handleSelectPatient(e.target.value)}>
          <option value="">{L('اختر مريضاً','Select a patient')}</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {currentInvoice && (
        <div style={S.card}>
          <h3 style={{ marginTop:0, fontSize:14 }}>{L('إضافة خدمة للفاتورة','Add Service to Invoice')}</h3>
          <div style={S.g3}>
            <div>
              <label style={S.label}>{L('الخدمة','Service')}</label>
              <select style={S.fi} value={selectedServiceId} onChange={e => { setSelectedServiceId(e.target.value); setCustomPrice(''); }}>
                <option value="">{L('اختر خدمة','Select service')}</option>
                {Object.entries(CATEGORY_LABELS).map(([cat, info]) => (
                  <optgroup key={cat} label={`${info.icon} ${L(info.ar, info.en)}`}>
                    {servicePrices.filter(s => s.category === cat).map(s => (
                      <option key={s.id} value={s.id}>{L(s.nameAr, s.nameEn)} — {fmt(s.price)} د.ع</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>{L('السعر (قابل للتعديل)','Price (editable)')}</label>
              <input
                type="number" style={S.fi}
                placeholder={selectedServiceId ? String(servicePrices.find(s=>s.id===Number(selectedServiceId))?.price || 0) : ''}
                value={customPrice}
                onChange={e => setCustomPrice(e.target.value)}
              />
            </div>
            <div>
              <label style={S.label}>{L('الكمية','Qty')}</label>
              <input type="number" min="1" style={S.fi} value={qty} onChange={e => setQty(e.target.value)} />
            </div>
          </div>
          <button style={{ ...S.btn(), marginTop:12 }} onClick={handleAddItem}>{L('+ إضافة للفاتورة','+ Add to Invoice')}</button>

          <div style={{ marginTop:20 }}>
            <h3 style={{ fontSize:14 }}>{L('فاتورة','Invoice')}: {patientName(selectedPatientId)}</h3>
            {currentInvoice.items.length === 0 ? (
              <p style={{ color:'var(--text-secondary)', fontSize:13 }}>{L('لا توجد خدمات مضافة بعد','No services added yet')}</p>
            ) : (
              <>
                {currentInvoice.items.map(it => (
                  <div key={it.id} style={S.row}>
                    <span style={{ fontSize:13 }}>{CATEGORY_LABELS[it.category]?.icon} {it.description} {it.qty > 1 ? `× ${it.qty}` : ''}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <strong>{fmt(it.price * it.qty)} د.ع</strong>
                      <button onClick={() => removeInvoiceItem(currentInvoice.id, it.id)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:16 }}>✕</button>
                    </div>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'14px 0', fontSize:16, fontWeight:700 }}>
                  <span>{L('الإجمالي','Total')}</span>
                  <span>{fmt(currentInvoice.total)} د.ع</span>
                </div>
                <button style={{ ...S.btn('#10b981'), width:'100%', padding:12, fontSize:15 }} onClick={() => setShowPayModal(true)}>
                  {L('💳 الدفع الآن','💳 Pay Now')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div style={S.card}>
        <h3 style={{ marginTop:0, fontSize:14 }}>{L('آخر الفواتير المدفوعة','Recent Paid Invoices')}</h3>
        <div style={{ marginBottom:12 }}>
          <DateRangeFilter lang={lang} from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
            label={L('تاريخ الدفع:', 'Payment date:')} />
        </div>
        {paidInvoices.length === 0 ? (
          <p style={{ color:'var(--text-secondary)', fontSize:13 }}>{L('لا توجد فواتير مدفوعة بعد','No paid invoices yet')}</p>
        ) : paidInvoices.map(inv => {
          const provider = PAYMENT_PROVIDERS.find(p => p.code === inv.paymentMethod);
          return (
            <div key={inv.id} style={S.row}>
              <span style={{ fontSize:13 }}>{patientName(inv.patientId)} — {new Date(inv.paidAt).toLocaleDateString(lang==='ar'?'ar-IQ':'en-US')}</span>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:11, color:'var(--text-secondary)' }}>
                  {provider ? L(provider.nameAr, provider.nameEn) : inv.paymentMethod}
                  {inv.referenceCode && <> — {L('مرجع','ref')}: {inv.referenceCode}</>}
                </span>
                <strong style={{ color:'#10b981' }}>{fmt(inv.total)} د.ع</strong>
              </div>
            </div>
          );
        })}
      </div>

      {showPayModal && currentInvoice && (
        <div style={S.modal} onClick={() => setShowPayModal(false)}>
          <div style={S.mbox} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop:0 }}>{L('تأكيد الدفع','Confirm Payment')}</h3>
            <p style={{ fontSize:14 }}>{L('المبلغ الإجمالي','Total amount')}: <strong>{fmt(currentInvoice.total)} د.ع</strong></p>
            <label style={S.label}>{L('وسيلة الدفع','Payment method')}</label>
            <select style={S.fi} value={payMethod} onChange={e => setPayMethod(e.target.value)}>
              {payOptions.map(p => <option key={p.code} value={p.code}>{L(p.nameAr, p.nameEn)}</option>)}
            </select>
            {payMethod !== 'cash' && (
              <div style={{ marginTop:10 }}>
                <label style={S.label}>
                  {payMethod === 'western_union'
                    ? L('رقم المرجع (MTCN)','Reference number (MTCN)')
                    : L('الرقم المرجعي من جهاز نقاط البيع (POS)','POS terminal approval/reference code')}
                </label>
                <input style={S.fi} value={manualRef} onChange={e => setManualRef(e.target.value)} placeholder={L('مثال: 048291','e.g. 048291')} />
                <p style={{ fontSize:11, color:'var(--text-secondary)', marginTop:4 }}>
                  {L(
                    '💡 اكتب الرقم الذي يطبعه جهاز الـ POS بعد إتمام العملية على الجهاز نفسه',
                    '💡 Enter the code printed by the POS terminal after completing the transaction on the device'
                  )}
                </p>
              </div>
            )}
            <div style={{ display:'flex', gap:8, marginTop:20, justifyContent:'flex-end' }}>
              <button style={S.btnGhost} onClick={() => setShowPayModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn('#10b981')} onClick={confirmPayment} disabled={processing}>
                {processing ? L('جارِ المعالجة...','Processing...') : L('تأكيد الدفع','Confirm Payment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showInvoiceImport && (
        <ExcelImportModal
          apiName="invoices"
          title={L('استيراد فواتير من Excel','Import Invoices from Excel')}
          lang={lang}
          onClose={() => setShowInvoiceImport(false)}
          onImported={() => {
            // invoices تُدار عبر دوال AppContext (createInvoice/processPayment)
            // بدون setter مباشر أو دالة إعادة جلب مكشوفة لهذه الصفحة، فإعادة
            // تحميل الصفحة أسلم طريقة لعرض الفواتير المستورَدة فوراً.
            window.location.reload();
          }}
        />
      )}

      {showImport && (
        <ExcelImportModal
          apiName="servicePrices"
          title={L('استيراد قائمة الأسعار من Excel','Import Price List from Excel')}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={() => {
            // servicePrices is loaded from AppContext with no dedicated bulk
            // refetch/setter exposed to this page (only updateServicePrice
            // for single-row edits exists), so a full reload is the safest
            // way to reflect newly imported rows immediately.
            // Replace this with a proper context refetch call if/when
            // AppContext exposes one for servicePrices.
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

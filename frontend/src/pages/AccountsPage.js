import React, { useState, useEffect } from 'react';
import { useT } from '../translations';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';

// ── MOCK DATA ──────────────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0];

const initTransactions = [
  { id:1, date:'2026-06-15', desc:'رسوم استشارة - أحمد علي', descEn:'Consultation fee - Ahmed Ali', category:'revenue', type:'income', amount:75000, method:'cash', ref:'INV-001' },
  { id:2, date:'2026-06-14', desc:'شراء أدوية ومستلزمات', descEn:'Purchase of medicines and supplies', category:'supplies', type:'expense', amount:250000, method:'تحويل', ref:'EXP-001' },
  { id:3, date:'2026-06-14', desc:'رسوم عملية جراحية - فاطمة حسن', descEn:'Surgical operation fee - Fatima Hassan', category:'revenue', type:'income', amount:1200000, method:'بطاقة', ref:'INV-002' },
  { id:4, date:'2026-06-13', desc:'رواتب الكادر الطبي - يونيو', descEn:'Medical staff salaries - June', category:'salaries', type:'expense', amount:5800000, method:'تحويل', ref:'SAL-006' },
];

const initPromotions = [
  { id:1, employeeId:1, name:'د. أحمد سالم الراشدي', nameEn:'Dr. Ahmed Salem Al-Rashidi', fromGrade:'الرابعة/3', fromGradeEn:'Fourth/3', toGrade:'الرابعة/4', toGradeEn:'Fourth/4', date:'2024-03-15', salaryBefore:820000, salaryAfter:850000, decisionNo:'Q-2024-112', status:'done', notes:'' },
  { id:2, employeeId:2, name:'سارة قاسم الزيدي', nameEn:'Sara Qassim Al-Zaidi', fromGrade:'الثالثة/1', fromGradeEn:'Third/1', toGrade:'الثالثة/2', toGradeEn:'Third/2', date:'2023-07-01', salaryBefore:620000, salaryAfter:650000, decisionNo:'Q-2023-89', status:'done', notes:'' },
  { id:3, employeeId:3, name:'باسم علي الكربلائي', nameEn:'Basim Ali Al-Karbalaei', fromGrade:'الثالثة/1', fromGradeEn:'Third/1', toGrade:'الثالثة/1', toGradeEn:'Third/1', date:null, salaryBefore:500000, salaryAfter:null, decisionNo:'', status:'due', notes:'منذ 36 شهراً' },
];

const initAllowances = [
  { id:1, employeeId:1, name:'د. أحمد سالم الراشدي', nameEn:'Dr. Ahmed Salem Al-Rashidi', type:'annual', amount:50000, date:'2024-01-01', decisionNo:'E-2024-01', status:'paid', notes:'' },
  { id:2, employeeId:2, name:'سارة قاسم الزيدي', nameEn:'Sara Qassim Al-Zaidi', type:'annual', amount:40000, date:'2024-07-01', decisionNo:'E-2024-22', status:'paid', notes:'' },
  { id:3, employeeId:3, name:'باسم علي الكربلائي', nameEn:'Basim Ali Al-Karbalaei', type:'annual', amount:35000, date:null, decisionNo:'', status:'due', notes:'آخر علاوة منذ 30 شهراً' },
  { id:4, employeeId:4, name:'رنا محمد النجار', nameEn:'Rana Mohammed Al-Najjar', type:'annual', amount:30000, date:null, decisionNo:'', status:'due', notes:'آخر علاوة منذ 43 شهراً' },
];

const ACCT_CATS = { income:['revenue','donation','grant'], expense:['salaries','supplies','maintenance','rent','utilities','other'] };
const METHODS_KEYS = ['cash','bank','card','check'];

// Grade translation map for display
const GRADE_EN = {'الأولى':'First','الثانية':'Second','الثالثة':'Third','الرابعة':'Fourth','الخامسة':'Fifth','السادسة':'Sixth','السابعة':'Seventh'};
const gradeEn = (g) => { if (!g) return g; const parts = g.split('/'); const en = GRADE_EN[parts[0]]; return en ? (parts[1]?`${en}/${parts[1]}`:en) : g; };

const TR_LABELS = (tr) => ({
  income:tr('acc_filter_in'), expense:tr('acc_filter_out'),
  revenue:tr('acc_cat_revenue'), donation:tr('acc_cat_donation'), grant:tr('acc_cat_grant'),
  salaries:tr('acc_cat_salaries'), supplies:tr('acc_cat_supplies'), maintenance:tr('acc_cat_maintenance'),
  rent:tr('acc_cat_rent'), utilities:tr('acc_cat_utilities'), other:tr('acc_cat_other'),
  cash:tr('acc_method_cash'), bank:tr('acc_method_bank'), card:tr('acc_method_card'), check:tr('acc_method_check'),
  done:tr('acc_status_done'), due:tr('acc_status_due'), paid:tr('acc_status_paid'),
  pending:tr('acc_status_pending'), process:tr('acc_status_process'), rejected:tr('leave_status_rej2'),
});
const displayValue = (value, tr) => ({
  'دخل': tr('acc_filter_in'),
  'مصروف': tr('acc_filter_out'),
  'إيراد': tr('acc_cat_revenue'),
  'تبرع': tr('acc_cat_donation'),
  'منحة': tr('acc_cat_grant'),
  'رواتب': tr('acc_cat_salaries'),
  'مستلزمات': tr('acc_cat_supplies'),
  'صيانة': tr('acc_cat_maintenance'),
  'إيجار': tr('acc_cat_rent'),
  'كهرباء وماء': tr('acc_cat_utilities'),
  'أخرى': tr('acc_cat_other'),
  'نقداً': tr('acc_method_cash'),
  'تحويل': tr('acc_method_bank'),
  'بطاقة': tr('acc_method_card'),
  'مُنجَز': tr('acc_status_done'),
  'مستحق': tr('acc_status_due'),
  'مستحقة': tr('acc_status_due'),
  'مُصرَف': tr('acc_status_paid'),
  'معلق': tr('acc_status_pending'),
  'قيد المعالجة': tr('acc_status_process'),
  'مرفوض': tr('leave_status_rej2'),
  'علاوة سنوية': tr('acc_allowance_annual'),
  'علاوة خطورة': tr('acc_allowance_risk'),
  'علاوة ميدانية': tr('acc_allowance_field'),
  'علاوة تخصص': tr('acc_allowance_specialty'),
  'علاوة اجتماعية': tr('acc_allowance_social'),
  'بدل مواصلات': tr('acc_transport_allowance'),
  'ضريبة': tr('acc_tax'),
  'سلفة': tr('acc_advance'),
}[value] || value);

const printTable = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  const w = window.open('','_blank');
  w.document.write(`<html dir="rtl"><head><style>body{font-family:Arial;direction:rtl}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:right}th{background:#1a6bab;color:#fff}</style></head><body>${el.outerHTML}</body></html>`);
  w.document.close(); w.print();
};

// دالة موحّدة: تحمّل التبويب من localStorage (يحل مشكلة فقدان البيانات عند التنقل)
// وبعدين تحاول تحمّل نسخة أحدث من الباك إند الحقيقي لو مسجّلة دخول
function usePersistedTab(storageKey, backendKey, initialData) {
  const { user } = useApp();
  const [data, setData] = useState(() => {
    try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : initialData; } catch { return initialData; }
  });
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(data)); }, [data, storageKey]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.get(`/${backendKey}`).then(serverData => {
      if (!cancelled && Array.isArray(serverData) && serverData.length > 0) setData(serverData);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return [data, setData];
}

// ── GENERAL ACCOUNTS ───────────────────────────────────────────────────────────
function GeneralTab() {
  const { showToast, lang, syncToServer, filterByViewingHospital, hospitals, multiHospitalEnabled } = useApp();
  const tr = useT(lang);
  const [txs, setTxs] = usePersistedTab('acc_transactions', 'transactions', initTransactions);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { date:today, desc:'', category:'إيراد', type:'income', amount:'', method:'cash', ref:'' };
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const totalIn = txs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const totalOut = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const balance = totalIn - totalOut;

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = (id) => { setTxs(p=>p.filter(t=>t.id!==id)); syncToServer('transactions','delete',{id}); showToast(tr('msg_deleted'),'success'); };
  const save = async () => {
    if (!form.desc || !form.amount) { showToast(tr('msg_required'),'error'); return; }
    if (editing) {
      const ut = {...form,id:editing.id};
      setTxs(p=>p.map(t=>t.id===editing.id?ut:t));
      await syncToServer('transactions','update',ut);
      showToast(tr('msg_saved'),'success');
    } else {
      const nt = {...form,id:Date.now(),ref:form.ref||`REF-${Date.now().toString().slice(-4)}`};
      setTxs(p=>[nt,...p]);
      const synced = await syncToServer('transactions','create',nt);
      if (synced && typeof synced === 'object' && synced.id !== nt.id) {
        setTxs(p => p.map(t => t.id === nt.id ? synced : t));
      }
      showToast(tr('msg_saved'),'success');
    }
    setShowModal(false);
  };

  const filtered = filterByViewingHospital(txs).filter(t=>(filter==='all'||t.type===filter)&&(t.desc.includes(search)||t.ref.includes(search)));
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filtered, 50);

  return (
    <div>
      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
        {[
          { label:tr('acc_total_revenue'), val:totalIn, color:'#22c55e', icon:'📥' },
          { label:tr('acc_total_expenses'), val:totalOut, color:'#ef4444', icon:'📤' },
          { label:tr('acc_net_balance'), val:balance, color:balance>=0?'#1a6bab':'#ef4444', icon:'💰' },
        ].map(s=>(
          <div key={s.label} className="card" style={{ display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ width:46, height:46, borderRadius:'50%', background:`${s.color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{s.label}</div>
              <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.val.toLocaleString(lang==='ar'?'ar-IQ':'en-US')} {tr('iqd')}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ display:'flex', gap:8 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr('acc_search')} className="form-control" style={{ width:200 }} />
          {[{k:'all',l:tr('acc_filter_all')},{k:'income',l:tr('acc_filter_in')},{k:'expense',l:tr('acc_filter_out')}].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:'7px 14px', borderRadius:20, border:`2px solid ${filter===f.k?'#1a6bab':'var(--border)'}`, background:filter===f.k?'#1a6bab':'transparent', color:filter===f.k?'#fff':'var(--text-primary)', cursor:'pointer', fontSize:12 }}>{f.l}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>printTable('acct-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {tr('acc_print')}</button>
          <button onClick={openAdd} className="btn btn-primary">+ {tr('acc_add_transaction_btn')}</button>
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        <div style={{ overflowX:'auto' }}>
          <table id="acct-table" className="table">
            <thead><tr><th>{tr('acc_date')}</th><th>{tr('acc_ref')}</th><th>{tr('acc_description')}</th><th>{tr('acc_category')}</th><th>{tr('acc_method')}</th><th>{tr('acc_amount')}</th><th>{tr('acc_type')}</th><th>{tr('field_actions')}</th></tr></thead>
            <tbody>
              {pageItems.map(t=>(
                <tr key={t.id}>
                  <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{t.date}</td>
                  <td style={{ fontFamily:'monospace', color:'#1a6bab', fontSize:12 }}>{t.ref}</td>
                  <td style={{ fontWeight:500 }}>{lang==='ar'?t.desc:t.descEn||t.desc}</td>
                  <td><span style={{ background:'var(--bg-primary)', padding:'2px 8px', borderRadius:8, fontSize:12 }}>{TR_LABELS(tr)[t.category]||(lang==='ar'?t.category:t.categoryEn||t.category)}</span></td>
                  <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{displayValue(t.method, tr)}</td>
                  <td style={{ fontWeight:700, color:t.type==='income'?'#22c55e':'#ef4444' }}>{t.type==='income'?'+':'-'}{Number(t.amount).toLocaleString(lang==='ar'?'ar-IQ':'en-US')}</td>
                  <td><span style={{ background:t.type==='income'?'#dcfce7':'#fee2e2', color:t.type==='income'?'#166534':'#991b1b', padding:'2px 8px', borderRadius:10, fontSize:12, fontWeight:600 }}>{displayValue(t.type, tr)}</span></td>
                  <td><div style={{ display:'flex', gap:6 }}><button onClick={()=>openEdit(t)} style={{ background:'none',border:'none',cursor:'pointer',color:'#1a6bab' }}>✏️</button><button onClick={()=>del(t.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444' }}>🗑️</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:480 }}>
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing?tr('btn_edit'):tr('acc_add_transaction')}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div><label className="form-label">{tr('acc_type')}</label><select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value,category:ACCT_CATS[e.target.value]?.[0] || ''}))} className="form-control"><option value="دخل">{tr('acc_income')}</option><option value="مصروف">{tr('acc_expense')}</option></select></div>
        <div><label className="form-label">{tr('acc_category')}</label><select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} className="form-control">{(ACCT_CATS[form.type]||[]).map(c=><option key={c} value={c}>{displayValue(c, tr)}</option>)}</select></div>
                <div style={{ gridColumn:'1/-1' }}><label className="form-label">{tr('acc_description')} *</label><input value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))} className="form-control" /></div>
                {multiHospitalEnabled && (
                  <div><label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                    <select value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))} className="form-control">
                      <option value="">—</option>
                      {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
                <div><label className="form-label">{tr('acc_amount')} (IQD) *</label><input type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} className="form-control" /></div>
        <div><label className="form-label">{tr('acc_method')}</label><select value={form.method} onChange={e=>setForm(p=>({...p,method:e.target.value}))} className="form-control">{METHODS_KEYS.map(m=><option key={m} value={m}>{displayValue(m, tr)}</option>)}</select></div>
                <div><label className="form-label">{tr('acc_date')}</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('acc_ref')}</label><input value={form.ref} onChange={e=>setForm(p=>({...p,ref:e.target.value}))} className="form-control" /></div>
              </div>
            </div>
            <div className="modal-footer"><button onClick={()=>setShowModal(false)} style={{ marginLeft:8,padding:'8px 20px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-primary)',cursor:'pointer' }}>{tr('btn_cancel')}</button><button onClick={save} className="btn btn-primary">{tr('btn_save')}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PROMOTIONS ─────────────────────────────────────────────────────────────────
function PromotionsTab() {
  const { showToast, lang, syncToServer, filterByViewingHospital, hospitals, multiHospitalEnabled } = useApp();
  const tr = useT(lang);
  const [promotionsRaw, setPromotions] = usePersistedTab('acc_promotions', 'promotions', initPromotions);
  const promotions = filterByViewingHospital(promotionsRaw);
  const { pageItems: promoPageItems, currentPage: promoCurrentPage, setCurrentPage: setPromoCurrentPage, totalPages: promoTotalPages, totalItems: promoTotalItems } = usePagination(promotions, 50);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { name:'', fromGrade:'', toGrade:'', date:today, salaryBefore:'', salaryAfter:'', decisionNo:'', status:'done', notes:'' };
  const [form, setForm] = useState(empty);

  const due = promotions.filter(p=>p.status==='due');

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = (id) => { setPromotions(p=>p.filter(r=>r.id!==id)); syncToServer('promotions','delete',{id}); showToast(tr('msg_deleted'),'success'); };
  const save = async () => {
    if (!form.name) { showToast(tr('msg_required'),'error'); return; }
    if (editing) {
      const up = {...form,id:editing.id};
      setPromotions(p=>p.map(r=>r.id===editing.id?up:r));
      await syncToServer('promotions','update',up);
      showToast(tr('msg_saved'),'success');
    } else {
      const np = {...form,id:Date.now()};
      setPromotions(p=>[...p,np]);
      const synced = await syncToServer('promotions','create',np);
      if (synced && typeof synced === 'object' && synced.id !== np.id) {
        setPromotions(p => p.map(r => r.id === np.id ? synced : r));
      }
      showToast(tr('msg_saved'),'success');
    }
    setShowModal(false);
  };

  return (
    <div>
      {/* Due alerts */}
      {due.length > 0 && (
        <div style={{ background:'rgba(26,107,171,0.08)', border:'1px solid rgba(26,107,171,0.3)', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
          <div style={{ fontWeight:700, color:'#1a6bab', marginBottom:6 }}>{tr('acc_due_promotions')} ({due.length})</div>
          {due.map(d=><div key={d.id} style={{ fontSize:13, color:'var(--text-primary)', padding:'3px 0' }}>• {d.name} — {d.notes}</div>)}
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <h3 style={{ margin:0 }}>{tr('auto_pair_4')}</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>printTable('prom-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {tr('acc_print')}</button>
          <button onClick={openAdd} className="btn btn-primary">+ {tr('acc_register_promotion')}</button>
        </div>
      </div>
      <div className="card" style={{ padding:0 }}>
        <table id="prom-table" className="table">
          <thead><tr><th>{tr('hr_emp_name')}</th><th>{tr('auto_pair_5')}</th><th>{tr('auto_pair_6')}</th><th>{tr('auto_pair_7')}</th><th>{tr('auto_pair_8')}</th><th>{tr('auto_pair_9')}</th><th>{tr('auto_pair_10')}</th><th>{tr('field_status')}</th><th>{tr('field_actions')}</th></tr></thead>
          <tbody>
            {promoPageItems.map(p=>(
              <tr key={p.id} style={{ background:p.status==='due'?'rgba(26,107,171,0.04)':undefined }}>
                <td style={{ fontWeight:600 }}>{lang==='ar'?p.name:p.nameEn||p.name}</td>
                <td style={{ fontSize:13 }}>{lang==='ar'?p.fromGrade:p.fromGradeEn||gradeEn(p.fromGrade)||p.fromGrade}</td>
                <td style={{ fontSize:13, color:'#1a6bab', fontWeight:600 }}>{lang==='ar'?p.toGrade:p.toGradeEn||gradeEn(p.toGrade)||p.toGrade||'—'}</td>
                <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{p.date||'—'}</td>
                <td style={{ fontSize:13 }}>{p.salaryBefore?Number(p.salaryBefore).toLocaleString(lang==='ar'?'ar-IQ':'en-US'):'—'}</td>
                <td style={{ fontSize:13, color:'#22c55e', fontWeight:600 }}>{p.salaryAfter?Number(p.salaryAfter).toLocaleString(lang==='ar'?'ar-IQ':'en-US'):'—'}</td>
                <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{p.decisionNo||'—'}</td>
                <td><span style={{ background:p.status==='done'?'#dcfce7':'rgba(26,107,171,0.1)', color:p.status==='done'?'#166534':'#1a6bab', padding:'2px 8px', borderRadius:8, fontSize:12, fontWeight:600 }}>{displayValue(p.status, tr)}</span></td>
                <td><div style={{ display:'flex', gap:6 }}><button onClick={()=>openEdit(p)} style={{ background:'none',border:'none',cursor:'pointer',color:'#1a6bab' }}>✏️</button><button onClick={()=>del(p.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444' }}>🗑️</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination currentPage={promoCurrentPage} totalPages={promoTotalPages} onPageChange={setPromoCurrentPage} totalItems={promoTotalItems} pageSize={50} lang={lang} />
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:520 }}>
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing?(tr('auto_pair_11')):(tr('auto_pair_12'))}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}><label className="form-label">{tr('auto_pair_13')}</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="form-control" /></div>
                {multiHospitalEnabled && (
                  <div><label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                    <select value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))} className="form-control">
                      <option value="">—</option>
                      {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
                <div><label className="form-label">{tr('auto_pair_14')}</label><input value={form.fromGrade} onChange={e=>setForm(p=>({...p,fromGrade:e.target.value}))} placeholder="الرابعة/3" className="form-control" /></div>
                <div><label className="form-label">{tr('auto_pair_15')}</label><input value={form.toGrade} onChange={e=>setForm(p=>({...p,toGrade:e.target.value}))} placeholder="الرابعة/4" className="form-control" /></div>
                <div><label className="form-label">{tr('auto_pair_16')}</label><input type="number" value={form.salaryBefore} onChange={e=>setForm(p=>({...p,salaryBefore:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('auto_pair_17')}</label><input type="number" value={form.salaryAfter} onChange={e=>setForm(p=>({...p,salaryAfter:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('auto_pair_18')}</label><input type="date" value={form.date||''} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('auto_pair_19')}</label><input value={form.decisionNo} onChange={e=>setForm(p=>({...p,decisionNo:e.target.value}))} className="form-control" /></div>
            <div><label className="form-label">{tr('field_status')}</label><select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} className="form-control"><option value="مُنجَز">{tr('acc_status_done')}</option><option value="مستحق">{tr('acc_status_due')}</option><option value="قيد المعالجة">{tr('acc_status_process')}</option></select></div>
                <div style={{ gridColumn:'1/-1' }}><label className="form-label">{tr('field_notes')}</label><textarea rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} className="form-control" /></div>
              </div>
            </div>
            <div className="modal-footer"><button onClick={()=>setShowModal(false)} style={{ marginLeft:8,padding:'8px 20px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-primary)',cursor:'pointer' }}>{tr('btn_cancel')}</button><button onClick={save} className="btn btn-primary">{tr('btn_save')}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ALLOWANCES ─────────────────────────────────────────────────────────────────
function AllowancesTab() {
  const { showToast, lang, syncToServer, filterByViewingHospital, hospitals, multiHospitalEnabled } = useApp();
  const tr = useT(lang);
  const [allowancesRaw, setAllowances] = usePersistedTab('acc_allowances', 'allowances', initAllowances);
  const allowances = filterByViewingHospital(allowancesRaw);
  const { pageItems: allowPageItems, currentPage: allowCurrentPage, setCurrentPage: setAllowCurrentPage, totalPages: allowTotalPages, totalItems: allowTotalItems } = usePagination(allowances, 50);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { name:'', type:'annual', amount:'', date:today, decisionNo:'', status:'paid', notes:'' };
  const [form, setForm] = useState(empty);
  const TYPES = ['annual','risk','field','specialty','social'];

  const due = allowances.filter(a=>a.status==='due');
  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = (id) => { setAllowances(p=>p.filter(a=>a.id!==id)); syncToServer('allowances','delete',{id}); showToast(tr('msg_deleted'),'success'); };
  const save = async () => {
    if (!form.name || !form.amount) { showToast(tr('msg_required'),'error'); return; }
    if (editing) {
      const ua = {...form,id:editing.id};
      setAllowances(p=>p.map(a=>a.id===editing.id?ua:a));
      await syncToServer('allowances','update',ua);
      showToast(tr('msg_saved'),'success');
    } else {
      const na = {...form,id:Date.now()};
      setAllowances(p=>[...p,na]);
      const synced = await syncToServer('allowances','create',na);
      if (synced && typeof synced === 'object' && synced.id !== na.id) {
        setAllowances(p => p.map(a => a.id === na.id ? synced : a));
      }
      showToast(tr('msg_saved'),'success');
    }
    setShowModal(false);
  };

  return (
    <div>
      {due.length > 0 && (
        <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
          <div style={{ fontWeight:700, color:'#f59e0b', marginBottom:6 }}>{tr('acc_due_allowances')} ({due.length})</div>
          {due.map(d=><div key={d.id} style={{ fontSize:13, padding:'3px 0' }}>• {d.name} — {d.notes}</div>)}
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <h3 style={{ margin:0 }}>{tr('auto_pair_23')}</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>printTable('allow-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {tr('acc_print')}</button>
          <button onClick={openAdd} className="btn btn-primary">+ {tr('acc_register_allowance')}</button>
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        <table id="allow-table" className="table">
          <thead><tr><th>{tr('hr_emp_name')}</th><th>{tr('auto_pair_24')}</th><th>{tr('acc_amount')} (IQD)</th><th>{tr('acc_date')}</th><th>{tr('auto_pair_25')}</th><th>{tr('field_status')}</th><th>{tr('field_notes')}</th><th>{tr('field_actions')}</th></tr></thead>
          <tbody>
            {allowPageItems.map(a=>(
              <tr key={a.id} style={{ background:a.status==='due'?'rgba(245,158,11,0.04)':undefined }}>
                <td style={{ fontWeight:600 }}>{lang==='ar'?a.name:a.nameEn||a.name}</td>
                <td><span style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', padding:'2px 8px', borderRadius:8, fontSize:12 }}>{TR_LABELS(tr)[a.type]||a.type}</span></td>
                <td style={{ fontWeight:700, color:'#22c55e' }}>{a.amount?Number(a.amount).toLocaleString(lang==='ar'?'ar-IQ':'en-US'):'—'}</td>
                <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{a.date||'—'}</td>
                <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{a.decisionNo||'—'}</td>
                <td><span style={{ background:a.status==='paid'?'#dcfce7':'rgba(245,158,11,0.1)', color:a.status==='paid'?'#166534':'#f59e0b', padding:'2px 8px', borderRadius:8, fontSize:12, fontWeight:600 }}>{displayValue(a.status, tr)}</span></td>
                <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{a.notes}</td>
                <td><div style={{ display:'flex', gap:6 }}><button onClick={()=>openEdit(a)} style={{ background:'none',border:'none',cursor:'pointer',color:'#1a6bab' }}>✏️</button><button onClick={()=>del(a.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444' }}>🗑️</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination currentPage={allowCurrentPage} totalPages={allowTotalPages} onPageChange={setAllowCurrentPage} totalItems={allowTotalItems} pageSize={50} lang={lang} />
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:480 }}>
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing?(tr('auto_pair_26')):(tr('auto_pair_27'))}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}><label className="form-label">{tr('auto_pair_28')}</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="form-control" /></div>
                {multiHospitalEnabled && (
                  <div><label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                    <select value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))} className="form-control">
                      <option value="">—</option>
                      {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
            <div><label className="form-label">{tr('auto_pair_29')}</label><select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))} className="form-control">{TYPES.map(t=><option key={t} value={t}>{displayValue(t, tr)}</option>)}</select></div>
                <div><label className="form-label">{tr('acc_amount')} (IQD) *</label><input type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('acc_date')}</label><input type="date" value={form.date||''} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('auto_pair_30')}</label><input value={form.decisionNo} onChange={e=>setForm(p=>({...p,decisionNo:e.target.value}))} className="form-control" /></div>
            <div><label className="form-label">{tr('field_status')}</label><select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} className="form-control"><option value="مُصرَف">{tr('acc_status_paid')}</option><option value="مستحقة">{tr('acc_status_due')}</option><option value="قيد المعالجة">{tr('acc_status_process')}</option></select></div>
                <div style={{ gridColumn:'1/-1' }}><label className="form-label">{tr('field_notes')}</label><textarea rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} className="form-control" /></div>
              </div>
            </div>
            <div className="modal-footer"><button onClick={()=>setShowModal(false)} style={{ marginLeft:8,padding:'8px 20px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-primary)',cursor:'pointer' }}>{tr('btn_cancel')}</button><button onClick={save} className="btn btn-primary">{tr('btn_save')}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN ACCOUNTS PAGE ─────────────────────────────────────────────────────────

// ── SALARIES TAB ───────────────────────────────────────────────────────────────
const initSalaries = [
  { id:1, name:'د. أحمد سالم الراشدي', nameEn:'Dr. Ahmed Salem Al-Rashidi', jobTitle:'طبيب اختصاص', jobTitleEn:'Specialist Physician', dept:'الباطنية', deptEn:'Internal Medicine', grade:'الرابعة/3', baseSalary:850000, additions:[{label:'علاوة اجتماعية',amount:75000},{label:'بدل مواصلات',amount:50000}], deductions:[{label:'ضريبة',amount:85000}], month:'2026-06', status:'paid', notes:'' },
  { id:2, name:'سارة قاسم الزيدي', nameEn:'Sara Qassim Al-Zaidi', jobTitle:'ممرضة أولى', jobTitleEn:'Senior Nurse', dept:'الجراحة', deptEn:'Surgery', grade:'الثالثة/2', baseSalary:650000, additions:[{label:'علاوة اجتماعية',amount:60000},{label:'بدل مواصلات',amount:40000}], deductions:[{label:'ضريبة',amount:60000}], month:'2026-06', status:'paid', notes:'' },
  { id:3, name:'باسم علي الكربلائي', nameEn:'Basim Ali Al-Karbalaei', jobTitle:'فني مختبر', jobTitleEn:'Lab Technician', dept:'التحاليل', deptEn:'Laboratory', grade:'الثالثة/1', baseSalary:500000, additions:[{label:'علاوة اجتماعية',amount:50000}], deductions:[{label:'ضريبة',amount:45000}], month:'2026-06', status:'pending', notes:'بانتظار المراجعة' },
  { id:4, name:'رنا محمد النجار', nameEn:'Rana Mohammed Al-Najjar', jobTitle:'سكرتيرة', jobTitleEn:'Secretary', dept:'الإدارة', deptEn:'Administration', grade:'الثانية/4', baseSalary:480000, additions:[{label:'علاوة اجتماعية',amount:45000}], deductions:[{label:'ضريبة',amount:40000},{label:'سلفة',amount:50000}], month:'2026-06', status:'paid', notes:'' },
];

function calcNet(emp) {
  const totalAdd = (emp.additions||[]).reduce((s,a) => s+Number(a.amount), 0);
  const totalDed = (emp.deductions||[]).reduce((s,d) => s+Number(d.amount), 0);
  return Number(emp.baseSalary) + totalAdd - totalDed;
}

function SalariesTab() {
  const { showToast, lang, syncToServer, filterByViewingHospital, hospitals, multiHospitalEnabled } = useApp();
  const tr = useT(lang);
  const JOB_EN = {'طبيب اختصاص':'Specialist Physician','ممرضة أولى':'Senior Nurse','فني مختبر':'Lab Technician','سكرتيرة':'Secretary','محاسب':'Accountant','مدير':'Manager'};
  const DEPT_EN = {'الباطنية':'Internal Medicine','الجراحة':'Surgery','التحاليل':'Laboratory','الإدارة':'Administration','الأشعة':'Radiology','الطوارئ':'Emergency','الأطفال':'Pediatrics'};
  const transformedInit = initSalaries.map(e => ({
    ...e,
    jobTitleEn: e.jobTitleEn || JOB_EN[e.jobTitle] || e.jobTitle,
    deptEn: e.deptEn || DEPT_EN[e.dept] || e.dept,
  }));
  const [salariesRaw, setSalaries] = usePersistedTab('acc_salaries', 'salaries', transformedInit);
  const salaries = filterByViewingHospital(salariesRaw);
  const { pageItems: salPageItems, currentPage: salCurrentPage, setCurrentPage: setSalCurrentPage, totalPages: salTotalPages, totalItems: salTotalItems } = usePagination(salaries, 50);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const empty = { name:'', jobTitle:'', dept:'', grade:'', baseSalary:'', additions:[{label:'علاوة اجتماعية',amount:0}], deductions:[{label:'ضريبة',amount:0}], month:today.slice(0,7), status:'pending', notes:'' };
  const [form, setForm] = useState(empty);

  const totalNet = salaries.reduce((s,e) => s + calcNet(e), 0);
  const paidCount = salaries.filter(e => e.status==='paid').length;

  const openAdd = () => { setEditing(null); setForm(empty); setSelected(null); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setSelected(null); setShowModal(true); };
  const openView = (r) => setSelected(selected?.id===r.id ? null : r);
  const del = (id) => { setSalaries(p=>p.filter(e=>e.id!==id)); syncToServer('salaries','delete',{id}); showToast(tr('msg_deleted'),'success'); };

  const addAddition = () => setForm(p => ({...p, additions:[...p.additions,{label:'',amount:0}]}));
  const addDeduction = () => setForm(p => ({...p, deductions:[...p.deductions,{label:'',amount:0}]}));

  const save = async () => {
    if (!form.name) { showToast(tr('msg_required'),'error'); return; }
    if (editing) {
      const ue = {...form,id:editing.id};
      setSalaries(p=>p.map(e=>e.id===editing.id?ue:e));
      await syncToServer('salaries','update',ue);
      showToast(tr('msg_saved'),'success');
    } else {
      const ne = {...form,id:Date.now()};
      setSalaries(p=>[...p,ne]);
      const synced = await syncToServer('salaries','create',ne);
      if (synced && typeof synced === 'object' && synced.id !== ne.id) {
        setSalaries(p => p.map(e => e.id === ne.id ? synced : e));
      }
      showToast(tr('msg_saved'),'success');
    }
    setShowModal(false);
  };

  const statusColor = (s) => s==='paid'?'#22c55e':s==='pending'?'#f59e0b':'#ef4444';

  return (
    <div>
      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:tr('acc_total_net_salaries'), val:`${totalNet.toLocaleString(lang==='ar'?'ar-IQ':'en-US')} ${tr('iqd')}`, color:'#1a6bab', icon:'💰' },
          { label:tr('acc_paid_employees'), val:`${paidCount} / ${salaries.length}`, color:'#22c55e', icon:'✅' },
          { label:tr('acc_pending_count'), val:salaries.filter(e=>e.status==='pending').length, color:'#f59e0b', icon:'⏳' },
          { label:tr('acc_average_salary'), val:salaries.length?`${Math.round(totalNet/salaries.length).toLocaleString(lang==='ar'?'ar-IQ':'en-US')} ${tr('iqd')}`:'0', color:'#8b5cf6', icon:'📊' },
        ].map((s,i) => (
          <div key={i} className="card" style={{ padding:'14px 16px', borderRight:`4px solid ${s.color}` }}>
            <div style={{ fontSize:22, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontWeight:700, fontSize:15, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <h3 style={{ margin:0 }}>{tr('acc_salary_sheet')} — {today.slice(0,7)}</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => printTable('sal-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {tr('acc_print')}</button>
          <button onClick={openAdd} className="btn btn-primary">+ {tr('acc_add_item')}</button>
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        <table id="sal-table" className="table">
          <thead><tr>
            <th>{tr('hr_emp_name')}</th><th>{tr('auto_pair_34')}</th><th>{tr('hr_emp_dept')}</th><th>{tr('auto_pair_35')}</th>
            <th>{tr('acc_base_salary')}</th><th>{tr('acc_additions')}</th><th>{tr('acc_deductions')}</th>
            <th>{tr('acc_net_salary')}</th><th>{tr('field_month')}</th><th>{tr('field_status')}</th><th>{tr('auto_pair_36')}</th><th>{tr('field_actions')}</th>
          </tr></thead>
          <tbody>
            {salPageItems.map(e => {
              const totalAdd = (e.additions||[]).reduce((s,a)=>s+Number(a.amount),0);
              const totalDed = (e.deductions||[]).reduce((s,a)=>s+Number(a.amount),0);
              const net = Number(e.baseSalary) + totalAdd - totalDed;
              return (
                <React.Fragment key={e.id}>
                  <tr>
                    <td style={{ fontWeight:600 }}>{lang==='ar'?e.name:e.nameEn||e.name}</td>
                    <td style={{ fontSize:12 }}>{lang==='ar'?e.jobTitle:e.jobTitleEn||({'طبيب اختصاص':'Specialist Physician','ممرضة أولى':'Senior Nurse','فني مختبر':'Lab Technician','سكرتيرة':'Secretary','محاسب':'Accountant','مدير':'Manager'})[e.jobTitle]||e.jobTitle}</td>
                    <td><span style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', padding:'2px 8px', borderRadius:8, fontSize:11 }}>{lang==='ar'?e.dept:e.deptEn||({'الباطنية':'Internal Medicine','الجراحة':'Surgery','التحاليل':'Laboratory','الإدارة':'Administration','الأشعة':'Radiology','الطوارئ':'Emergency','الأطفال':'Pediatrics'})[e.dept]||e.dept}</span></td>
                    <td style={{ fontSize:12 }}>{lang==='ar'?e.grade:e.gradeEn||gradeEn(e.grade)||e.grade}</td>
                    <td style={{ fontWeight:600 }}>{Number(e.baseSalary).toLocaleString(lang==='ar'?'ar-IQ':'en-US')} {tr('iqd')}</td>
                    <td style={{ color:'#22c55e', fontWeight:600 }}>+{totalAdd.toLocaleString(lang==='ar'?'ar-IQ':'en-US')}</td>
                    <td style={{ color:'#ef4444', fontWeight:600 }}>-{totalDed.toLocaleString(lang==='ar'?'ar-IQ':'en-US')}</td>
                    <td style={{ fontWeight:700, color:'#1a6bab', fontSize:14 }}>{net.toLocaleString(lang==='ar'?'ar-IQ':'en-US')} {tr('iqd')}</td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{e.month}</td>
                    <td><span style={{ background:`${statusColor(e.status)}15`, color:statusColor(e.status), padding:'3px 10px', borderRadius:8, fontSize:11, fontWeight:700 }}>{displayValue(e.status, tr)}</span></td>
                    <td>
                      <button onClick={()=>openView(e)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:11, color:'var(--text-primary)' }}>
                        {selected?.id===e.id?'▲':'▼'} {tr('acc_details')}
                      </button>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={()=>openEdit(e)} style={{ background:'none',border:'none',cursor:'pointer',color:'#1a6bab' }}>✏️</button>
                        <button onClick={()=>del(e.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                  {selected?.id===e.id && (
                    <tr>
                      <td colSpan={12} style={{ background:'var(--bg-secondary)', padding:0 }}>
                        <div style={{ padding:'16px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                          <div>
                            <h5 style={{ margin:'0 0 10px', color:'#22c55e' }}>➕ {tr('acc_additions')}</h5>
                            {(e.additions||[]).map((a,i) => (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:'rgba(34,197,94,0.08)', borderRadius:8, marginBottom:4 }}>
                                <span style={{ fontSize:13 }}>{displayValue(a.label, tr)}</span>
                                <span style={{ fontWeight:700, color:'#22c55e' }}>+{Number(a.amount).toLocaleString(lang==='ar'?'ar-IQ':'en-US')} {tr('iqd')}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <h5 style={{ margin:'0 0 10px', color:'#ef4444' }}>➖ {tr('acc_deductions')}</h5>
                            {(e.deductions||[]).map((d,i) => (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:'rgba(239,68,68,0.08)', borderRadius:8, marginBottom:4 }}>
                                <span style={{ fontSize:13 }}>{displayValue(d.label, tr)}</span>
                                <span style={{ fontWeight:700, color:'#ef4444' }}>-{Number(d.amount).toLocaleString(lang==='ar'?'ar-IQ':'en-US')} {tr('iqd')}</span>
                              </div>
                            ))}
                          </div>
                          {e.notes && <div style={{ gridColumn:'1/-1', fontSize:13, color:'var(--text-secondary)', padding:'8px 10px', background:'var(--bg-primary)', borderRadius:8 }}>📝 {e.notes}</div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <Pagination currentPage={salCurrentPage} totalPages={salTotalPages} onPageChange={setSalCurrentPage} totalItems={salTotalItems} pageSize={50} lang={lang} />
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:600, maxHeight:'90vh', overflow:'auto' }}>
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing?(tr('auto_pair_37')):(tr('auto_pair_38'))}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}><label className="form-label">{tr('auto_pair_39')}</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="form-control" /></div>
                {multiHospitalEnabled && (
                  <div><label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                    <select value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))} className="form-control">
                      <option value="">—</option>
                      {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
                <div><label className="form-label">{tr('auto_pair_40')}</label><input value={form.jobTitle} onChange={e=>setForm(p=>({...p,jobTitle:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('hr_emp_dept')}</label><input value={form.dept} onChange={e=>setForm(p=>({...p,dept:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('auto_pair_41')}</label><input value={form.grade} onChange={e=>setForm(p=>({...p,grade:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('acc_base_salary')}</label><input type="number" value={form.baseSalary} onChange={e=>setForm(p=>({...p,baseSalary:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('field_month')}</label><input type="month" value={form.month} onChange={e=>setForm(p=>({...p,month:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('field_status')}</label><select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} className="form-control"><option value="مُصرَف">{tr('acc_status_paid')}</option><option value="معلق">{tr('acc_status_pending')}</option><option value="مرفوض">{tr('leave_status_rej2')}</option></select></div>
              </div>
              <div style={{ marginTop:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}><h4 style={{ margin:0, color:'#22c55e' }}>{tr('acc_additions')}</h4><button onClick={addAddition} style={{ background:'none', border:'1px solid #22c55e', color:'#22c55e', borderRadius:6, padding:'2px 10px', cursor:'pointer', fontSize:12 }}>+ {tr('acc_add_item')}</button></div>
                {(form.additions||[]).map((a,i)=>(
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 140px 30px', gap:8, marginBottom:8 }}>
                    <input value={a.label} onChange={e=>{const arr=[...form.additions];arr[i]={...arr[i],label:e.target.value};setForm(p=>({...p,additions:arr}));}} className="form-control" placeholder={tr('acc_search')} />
                    <input type="number" value={a.amount} onChange={e=>{const arr=[...form.additions];arr[i]={...arr[i],amount:e.target.value};setForm(p=>({...p,additions:arr}));}} className="form-control" placeholder={tr('acc_search')} />
                    <button onClick={()=>setForm(p=>({...p,additions:p.additions.filter((_,j)=>j!==i)}))} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:18 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}><h4 style={{ margin:0, color:'#ef4444' }}>{tr('acc_deductions')}</h4><button onClick={addDeduction} style={{ background:'none', border:'1px solid #ef4444', color:'#ef4444', borderRadius:6, padding:'2px 10px', cursor:'pointer', fontSize:12 }}>+ {tr('acc_add_item')}</button></div>
                {(form.deductions||[]).map((d,i)=>(
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 140px 30px', gap:8, marginBottom:8 }}>
                    <input value={d.label} onChange={e=>{const arr=[...form.deductions];arr[i]={...arr[i],label:e.target.value};setForm(p=>({...p,deductions:arr}));}} className="form-control" placeholder={tr('acc_search')} />
                    <input type="number" value={d.amount} onChange={e=>{const arr=[...form.deductions];arr[i]={...arr[i],amount:e.target.value};setForm(p=>({...p,deductions:arr}));}} className="form-control" placeholder={tr('acc_search')} />
                    <button onClick={()=>setForm(p=>({...p,deductions:p.deductions.filter((_,j)=>j!==i)}))} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:18 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:12 }}><label className="form-label">{tr('field_notes')}</label><textarea rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} className="form-control" /></div>
            </div>
            <div className="modal-footer"><button onClick={()=>setShowModal(false)} style={{ marginLeft:8,padding:'8px 20px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-primary)',cursor:'pointer' }}>{tr('btn_cancel')}</button><button onClick={save} className="btn btn-primary">{tr('btn_save')}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

const ACCT_TABS = [
  { key:'general',    labelKey:'acc_tab_general',   icon:'💰' },
  { key:'salaries',   labelKey:'acc_tab_salaries',  icon:'💵' },
  { key:'promotions', labelKey:'acc_tab_promotions', icon:'⬆️' },
  { key:'allowances', labelKey:'acc_tab_allowances', icon:'🎁' },
];

export default function AccountsPage() {
  const [tab, setTab] = useState('general');
  const { lang } = useApp();
  const tr = useT(lang);
  const promotionDue = initPromotions.filter(p=>p.status==='due').length;
  const allowanceDue = initAllowances.filter(a=>a.status==='due').length;

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

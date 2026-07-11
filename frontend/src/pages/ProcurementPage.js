/* eslint-disable no-unused-vars */
import React, { useState, useMemo } from 'react';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { useApp } from '../contexts/AppContext';

const STATUS_CONFIG = {
  pending:   { ar:'بانتظار الموافقة', en:'Pending Approval', color:'#f59e0b', bg:'#fef3c7' },
  approved:  { ar:'مُعتمد',           en:'Approved',         color:'#1a6bab', bg:'#dbeafe' },
  delivered: { ar:'مُسلَّم',          en:'Delivered',        color:'#10b981', bg:'#d1fae5' },
  cancelled: { ar:'ملغي',             en:'Cancelled',        color:'#6b7280', bg:'#f3f4f6' },
};
const PRIORITY_CONFIG = {
  high:   { ar:'عاجل',   en:'Urgent',  color:'#ef4444' },
  normal: { ar:'عادي',   en:'Normal',  color:'#1a6bab' },
  low:    { ar:'منخفض',  en:'Low',     color:'#6b7280' },
};
const EMPTY = { poNo:'', title:'', titleEn:'', supplier:'', supplierEn:'', date:'', deliveryDate:'', totalAmount:0, status:'pending', items:1, priority:'normal', approvedBy:null };

export default function ProcurementPage() {
  const { procurement, setProcurement, user, lang, showToast, syncToServer, hospitals, multiHospitalEnabled } = useApp();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => lang === 'ar' ? ar : en;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const filtered = useMemo(() => procurement.filter(p => {
    const q = search.toLowerCase();
    return (!q || p.title.includes(q) || p.poNo.toLowerCase().includes(q) || p.supplier.includes(q))
      && (statusFilter === 'all' || p.status === statusFilter);
  }), [procurement, search, statusFilter]);
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filtered, 50);

  const stats = useMemo(() => ({
    total: procurement.length,
    pending: procurement.filter(p => p.status === 'pending').length,
    approved: procurement.filter(p => p.status === 'approved').length,
    totalValue: procurement.reduce((s, p) => s + p.totalAmount, 0),
  }), [procurement]);

  const openAdd = () => {
    const nextNo = `PO-${new Date().getFullYear()}-${String(procurement.length+1).padStart(3,'0')}`;
    setForm({ ...EMPTY, poNo: nextNo, date: new Date().toISOString().split('T')[0] });
    setEditId(null); setShowModal(true);
  };
  const openEdit = item => { setForm({ ...item }); setEditId(item.id); setShowModal(true); };
  const savePO = () => {
    if (!form.title || !form.supplier) { showToast(L('يرجى تعبئة العنوان والمورد','Please fill title and supplier'), 'error'); return; }
    const po = { ...form, totalAmount: +form.totalAmount, items: +form.items };
    if (editId) {
      const up = { ...po, id: editId };
      setProcurement(p => p.map(i => i.id === editId ? { ...i, ...up } : i));
      syncToServer('procurement', 'update', up);
      showToast(L('تم التحديث','Updated'), 'success');
    } else {
      const np = { ...po, id: Date.now() };
      setProcurement(p => [...p, np]);
      syncToServer('procurement', 'create', np);
      showToast(L('تمت إضافة أمر الشراء','PO added'), 'success');
    }
    setShowModal(false);
  };
  const updateStatus = (id, status) => {
    setProcurement(p => {
      const updated = p.map(i => i.id === id ? { ...i, status, ...(status==='approved' ? {approvedBy: user?.name} : {}) } : i);
      const changed = updated.find(i => i.id === id);
      if (changed) syncToServer('procurement', 'update', changed);
      return updated;
    });
    const msg = status==='approved' ? L('تمت الموافقة','Approved') : status==='delivered' ? L('تم تسجيل الاستلام','Delivery recorded') : L('تم الإلغاء','Cancelled');
    showToast(msg, 'success');
  };
  const n = v => Number(v).toLocaleString(lang==='ar'?'ar-IQ':'en-US');

  const S = {
    page: { padding:24, direction:dir },
    header: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 },
    stats: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:20 },
    sCard: c => ({ background:'var(--bg-secondary)', borderRadius:12, padding:'16px 20px', borderTop:`3px solid ${c}` }),
    tb: { display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' },
    inp: { padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8, background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:13 },
    btn: (c='#1a6bab') => ({ padding:'8px 16px', background:c, color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }),
    smBtn: (c='#1a6bab') => ({ padding:'5px 12px', background:c, color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }),
    card: { background:'var(--bg-secondary)', borderRadius:12, padding:18, marginBottom:12, border:'1px solid var(--border)' },
    badge: (c,bg) => ({ display:'inline-block', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, color:c, background:bg }),
    modal: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 },
    mbox: { background:'var(--bg-primary)', borderRadius:16, padding:28, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', direction:dir },
    g2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 },
    fl: { display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 },
    fi: { width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8, background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:13, boxSizing:'border-box' },
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', margin:0 }}>🛒 {L('المشتريات','Procurement')}</h1>
          <p style={{ color:'var(--text-secondary)', fontSize:13, margin:'4px 0 0' }}>{L('إدارة أوامر الشراء والموردين','Manage purchase orders and suppliers')}</p>
        </div>
        <button style={S.btn()} onClick={openAdd}>+ {L('أمر شراء جديد','New PO')}</button>
      </div>

      <div style={S.stats}>
        {[[L('إجمالي أوامر الشراء','Total POs'), stats.total, '#1a6bab'],
          [L('بانتظار الموافقة','Pending Approval'), stats.pending, '#f59e0b'],
          [L('مُعتمدة','Approved'), stats.approved, '#10b981']].map(([lbl,val,c],i) => (
          <div key={i} style={S.sCard(c)}>
            <div style={{ fontSize:26, fontWeight:700, color:'var(--text-primary)' }}>{val}</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{lbl}</div>
          </div>
        ))}
        <div style={S.sCard('#8b5cf6')}>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)' }}>{n(stats.totalValue)}</div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{L('إجمالي القيمة (د.ع)','Total Value (IQD)')}</div>
        </div>
      </div>

      <div style={S.tb}>
        <input style={{...S.inp, minWidth:220}} placeholder={L('🔍 بحث...','🔍 Search...')} value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={S.inp} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="all">{L('كل الحالات','All Status')}</option>
          {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{L(v.ar,v.en)}</option>)}
        </select>
      </div>

      {pageItems.map(po => {
        const st = STATUS_CONFIG[po.status] || STATUS_CONFIG.pending;
        const pr = PRIORITY_CONFIG[po.priority] || PRIORITY_CONFIG.normal;
        return (
          <div key={po.id} style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                  <code style={{ fontSize:12, background:'var(--bg-tertiary)', padding:'2px 8px', borderRadius:4, color:'var(--text-secondary)' }}>{po.poNo}</code>
                  <span style={S.badge(st.color,st.bg)}>{L(st.ar,st.en)}</span>
                  <span style={{ fontSize:11, color:pr.color, fontWeight:700 }}>● {L(pr.ar,pr.en)}</span>
                </div>
                <h3 style={{ margin:0, fontSize:15, fontWeight:600, color:'var(--text-primary)' }}>{lang==='ar' ? po.title : (po.titleEn||po.title)}</h3>
                <div style={{ display:'flex', gap:16, marginTop:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:12, color:'var(--text-secondary)' }}>🏢 {lang==='ar' ? po.supplier : (po.supplierEn||po.supplier)}</span>
                  <span style={{ fontSize:12, color:'var(--text-secondary)' }}>📅 {po.date}</span>
                  <span style={{ fontSize:12, color:'var(--text-secondary)' }}>🚚 {po.deliveryDate}</span>
                  <span style={{ fontSize:12, color:'var(--text-secondary)' }}>📦 {po.items} {L('صنف','items')}</span>
                </div>
                {po.approvedBy && <div style={{ fontSize:11, color:'#10b981', marginTop:6 }}>✅ {L('معتمد بواسطة:','Approved by:')} {po.approvedBy}</div>}
              </div>
              <div style={{ textAlign:'center', minWidth:120 }}>
                <div style={{ fontSize:20, fontWeight:700, color:'#1a6bab' }}>{n(po.totalAmount)}</div>
                <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{L('د.ع','IQD')}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:12, borderTop:'1px solid var(--border)', paddingTop:10, flexWrap:'wrap' }}>
              <button onClick={()=>openEdit(po)} style={S.smBtn('#6b7280')}>✏️ {L('تعديل','Edit')}</button>
              {po.status==='pending'   && <button onClick={()=>updateStatus(po.id,'approved')}  style={S.smBtn('#10b981')}>✅ {L('اعتماد','Approve')}</button>}
              {po.status==='approved'  && <button onClick={()=>updateStatus(po.id,'delivered')} style={S.smBtn('#1a6bab')}>📦 {L('تسجيل استلام','Mark Delivered')}</button>}
              {['pending','approved'].includes(po.status) && <button onClick={()=>updateStatus(po.id,'cancelled')} style={S.smBtn('#ef4444')}>❌ {L('إلغاء','Cancel')}</button>}
            </div>
          </div>
        );
      })}

      {filtered.length===0 && (
        <div style={{ textAlign:'center', padding:48, color:'var(--text-secondary)', background:'var(--bg-secondary)', borderRadius:12 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🛒</div>
          <p>{L('لا توجد أوامر شراء','No purchase orders found')}</p>
        </div>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />

      {showModal && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={S.mbox}>
            <h3 style={{ margin:'0 0 20px', color:'var(--text-primary)' }}>{editId ? L('✏️ تعديل أمر الشراء','✏️ Edit PO') : L('🛒 أمر شراء جديد','🛒 New Purchase Order')}</h3>
            <div style={S.g2}>
              {[['poNo',L('رقم أمر الشراء','PO Number'),'text'],
                ['date',L('تاريخ الطلب','Order Date'),'date'],
                ['deliveryDate',L('تاريخ التسليم المتوقع','Expected Delivery'),'date'],
                ['items',L('عدد الأصناف','Items Count'),'number'],
                ['totalAmount',L('المبلغ الإجمالي (د.ع)','Total Amount (IQD)'),'number']
              ].map(([k,lbl,tp]) => (
                <label key={k}>
                  <span style={S.fl}>{lbl}</span>
                  <input type={tp} style={S.fi} value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}/>
                </label>
              ))}
              {[['title',L('عنوان المشتريات','Title (Arabic)')],
                ['titleEn','Title (English)'],
                ['supplier',L('المورد','Supplier (Arabic)')],
                ['supplierEn','Supplier (English)']
              ].map(([k,lbl]) => (
                <label key={k} style={{gridColumn:'span 2'}}>
                  <span style={S.fl}>{lbl}</span>
                  <input style={S.fi} value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}/>
                </label>
              ))}
              {multiHospitalEnabled && (
                <label style={{gridColumn:'span 2'}}>
                  <span style={S.fl}>{L('المنشأة','Facility')}</span>
                  <select style={S.fi} value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))}>
                    <option value="">—</option>
                    {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                  </select>
                </label>
              )}
              <label>
                <span style={S.fl}>{L('الأولوية','Priority')}</span>
                <select style={S.fi} value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))}>
                  {Object.entries(PRIORITY_CONFIG).map(([k,v]) => <option key={k} value={k}>{L(v.ar,v.en)}</option>)}
                </select>
              </label>
              <label>
                <span style={S.fl}>{L('الحالة','Status')}</span>
                <select style={S.fi} value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
                  {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{L(v.ar,v.en)}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowModal(false)}>{L('إلغاء','Cancel')}</button>
              <button style={S.btn()} onClick={savePO}>💾 {L('حفظ','Save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

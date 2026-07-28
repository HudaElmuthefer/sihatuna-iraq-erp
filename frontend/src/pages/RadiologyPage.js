/* eslint-disable no-unused-vars */
import React, { useState, useMemo } from 'react';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { useApp } from '../contexts/AppContext';
import { FaFileExcel, FaTrash } from 'react-icons/fa';
import ExcelImportModal from '../components/ExcelImportModal';
import PageBanner from '../components/PageBanner';
import { api } from '../api';

const BANNER_GRADIENT = 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)';

const MODALITIES = {
  xray:      { ar:'أشعة سينية',         en:'X-Ray',       icon:'📡', color:'#1a6bab' },
  ultrasound:{ ar:'سونار',              en:'Ultrasound',  icon:'〰️', color:'#10b981' },
  ct:        { ar:'مفراس (CT)',          en:'CT Scan',     icon:'🌀', color:'#f59e0b' },
  mri:       { ar:'رنين مغناطيسي (MRI)', en:'MRI',         icon:'🧲', color:'#8b5cf6' },
  mammogram: { ar:'تصوير ثدي',          en:'Mammogram',   icon:'🔬', color:'#ec4899' },
  other:     { ar:'أخرى',              en:'Other',       icon:'📷', color:'#6b7280' },
};
const STATUSES = {
  pending:   { ar:'بانتظار الموعد', en:'Pending', color:'#6b7280', bg:'#f3f4f6' },
  scheduled: { ar:'مجدول',          en:'Scheduled',          color:'#1a6bab', bg:'#dbeafe' },
  examined:  { ar:'تم الفحص',       en:'Examined',       color:'#f59e0b', bg:'#fef3c7' },
  reported:  { ar:'مُبلَّغ عنه',    en:'Reported',    color:'#10b981', bg:'#d1fae5' },
  cancelled: { ar:'ملغي',           en:'Cancelled',           color:'#ef4444', bg:'#fee2e2' },
};
const EMPTY = { reqNo:'', patientName:'', patientId:'', doctorName:'', modality:'xray', bodyPart:'', requestDate:'', examDate:'', reportDate:'', status:'pending', priority:'normal', technician:'', radiologist:'', findings:'', impression:'', images:0 };

export default function RadiologyPage() {
  const { radiology, setRadiology, lang, showToast, syncToServer, confirmDialog, hospitals, multiHospitalEnabled } = useApp();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => lang === 'ar' ? ar : en;
  const ar = lang === 'ar';
  const [search, setSearch] = useState('');
  const [modFilter, setModFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showReport, setShowReport] = useState(null);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');

  // ── استيراد من Excel ──────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);

  // ── تحديد متعدد للحذف الجماعي (بنفس نمط LaboratoryPage) ──────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const filtered = useMemo(() => radiology.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.patientName.includes(q) || r.reqNo.toLowerCase().includes(q))
      && (modFilter === 'all' || r.modality === modFilter)
      && (statusFilter === 'all' || r.status === statusFilter);
  }), [radiology, search, modFilter, statusFilter]);
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filtered, 50);

  const stats = useMemo(() => ({
    total: radiology.length,
    pending: radiology.filter(r=>r.status==='pending'||r.status==='scheduled').length,
    examined: radiology.filter(r=>r.status==='examined').length,
    reported: radiology.filter(r=>r.status==='reported').length,
    byModality: Object.keys(MODALITIES).map(m=>({ m, count: radiology.filter(r=>r.modality===m).length })).filter(x=>x.count>0),
  }), [radiology]);

  const openAdd = () => {
    // إصلاح: radiology.length+1 يكرر رقم طلب موجود فعلاً بعد أي حذف
    const rdYear = new Date().getFullYear();
    const rdPrefix = `RAD-${rdYear}-`;
    const rdMaxSeq = radiology.reduce((max,r)=>{
      if (typeof r.reqNo !== 'string' || !r.reqNo.startsWith(rdPrefix)) return max;
      const v = parseInt(r.reqNo.slice(rdPrefix.length),10);
      return Number.isFinite(v) && v>max ? v : max;
    },0);
    const n = `${rdPrefix}${String(rdMaxSeq+1).padStart(4,'0')}`;
    setForm({...EMPTY, reqNo:n, requestDate:new Date().toISOString().split('T')[0]});
    setEditId(null); setShowModal(true);
  };
  const save = async () => {
    if (!form.patientName || !form.modality) { showToast(L('يرجى تعبئة بيانات المريض','Please fill patient data'),'error'); return; }
    const prev = radiology;
    if (editId) {
      const ur = {...form,id:editId};
      setRadiology(p=>p.map(r=>r.id===editId?{...r,...ur}:r));
      const ok = await syncToServer('radiology','update',ur);
      if (!ok) { setRadiology(prev); return; }
      showToast(L('تم التحديث','Updated'),'success');
    } else {
      const nr = {...form,id:Date.now()};
      setRadiology(p=>[...p,nr]);
      const ok = await syncToServer('radiology','create',nr);
      if (!ok) { setRadiology(prev); return; }
      showToast(L('تمت إضافة الطلب','Request added'),'success');
    }
    setShowModal(false);
  };
  const updateStatus = async (id, status) => {
    const now = new Date().toISOString().split('T')[0];
    const prev = radiology;
    const current = radiology.find(r => r.id === id);
    if (!current) return;
    const changed = {...current,status,...(status==='examined'?{examDate:now}:{})};
    setRadiology(p => p.map(r=>r.id===id?changed:r));
    const ok = await syncToServer('radiology','update',changed);
    if (!ok) { setRadiology(prev); return; }
    showToast(L('تم التحديث','Updated'),'success');
  };
  const saveReport = async () => {
    const prev = radiology;
    const current = radiology.find(r => r.id === showReport.id);
    if (!current) return;
    const changed = {...current,status:'reported',reportDate:new Date().toISOString().split('T')[0],findings,findingsEn:findings,impression,impressionEn:impression};
    setRadiology(p => p.map(r=>r.id===showReport.id?changed:r));
    const ok = await syncToServer('radiology','update',changed);
    if (!ok) { setRadiology(prev); return; }
    showToast(L('تم حفظ التقرير الإشعاعي','Radiology report saved'),'success'); setShowReport(null);
  };

  // ── حذف جماعي (بنفس نمط LaboratoryPage.handleBulkDelete) ─────────────────
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const ok = await syncToServer('radiology', 'delete', { id });
      if (ok) { setRadiology(p => p.filter(r => r.id !== id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    showToast(
      ar ? `تم حذف ${deleted} من ${ids.length} طلب` : `Deleted ${deleted} of ${ids.length} requests`,
      deleted === ids.length ? 'success' : 'warning'
    );
  };

  const S = {
    page:{padding:24,direction:dir},
    stats:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20},
    card:(c)=>({background:'var(--bg-card)',borderRadius:12,padding:'14px 18px',borderTop:`3px solid ${c}`}),
    tb:{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'},
    inp:{padding:'8px 12px',border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:13},
    btn:(c='#1a6bab')=>({padding:'7px 14px',background:c,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}),
    table:{width:'100%',borderCollapse:'collapse',background:'var(--bg-card)',borderRadius:12,overflow:'hidden'},
    th:{padding:'10px 12px',textAlign:dir==='rtl'?'right':'left',background:'var(--bg-tertiary)',fontSize:11,fontWeight:600,color:'var(--text-secondary)',borderBottom:'1px solid var(--border)'},
    td:{padding:'10px 12px',borderBottom:'1px solid var(--border)',fontSize:12,color:'var(--text-primary)'},
    badge:(c,bg)=>({display:'inline-block',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600,color:c,background:bg}),
    modal:{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999},
    mbox:{background:'var(--bg-primary)',borderRadius:16,padding:28,width:'100%',maxWidth:540,maxHeight:'90vh',overflowY:'auto',direction:dir},
    g2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12},
    fl:{display:'block',fontSize:12,color:'var(--text-secondary)',marginBottom:4},
    fi:{width:'100%',padding:'7px 10px',border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'},
  };

  return (
    <div style={S.page}>
      <PageBanner
        icon="📡"
        title={lang==='ar'?'الأشعة والتصوير الطبي':'Radiology & Medical Imaging'}
        subtitle={lang==='ar'?'إدارة الأشعة السينية • السونار • المفراس (CT) • الرنين المغناطيسي (MRI)':'Manage X-Ray • Ultrasound • CT Scan • MRI'}
        gradient={BANNER_GRADIENT}
      >
        <button style={{...S.btn(), background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.5)'}} onClick={() => setShowImport(true)}>
          <FaFileExcel style={{marginInlineEnd:6}} /> {ar ? 'استيراد من Excel' : 'Import from Excel'}
        </button>
        <button style={{...S.btn(), background:'#fff', color:'#1e3a8a'}} onClick={openAdd}>{lang==='ar'?'+ طلب تصوير جديد':'+ New Imaging Request'}</button>
      </PageBanner>

      {showImport && (
        <ExcelImportModal
          apiName="radiology"
          title={ar ? 'استيراد طلبات تصوير من Excel' : 'Import Imaging Requests from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/radiology');
              if (Array.isArray(fresh)) setRadiology(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً وتظهر بأول تحديث لاحق */ }
          }}
        />
      )}

      <div style={S.stats}>
        {[[lang==='ar'?'إجمالي الطلبات':'Total Requests',stats.total,'#1a6bab'],[lang==='ar'?'بانتظار الفحص':'Pending Exam',stats.pending,'#6b7280'],[lang==='ar'?'تم الفحص':'Examined',stats.examined,'#f59e0b'],[lang==='ar'?'مكتمل التقرير':'Report Ready',stats.reported,'#10b981']].map(([l,v,c],i)=>(
          <div key={i} style={S.card(c)}><div style={{fontSize:22,fontWeight:700,color:'var(--text-primary)'}}>{v}</div><div style={{fontSize:11,color:'var(--text-secondary)',marginTop:3}}>{l}</div></div>
        ))}
        {/* Modality breakdown */}
        {stats.byModality.map(({m,count})=>{ const mod=MODALITIES[m]; return (
          <div key={m} style={S.card(mod.color)}>
            <div style={{fontSize:18,marginBottom:2}}>{mod.icon}</div>
            <div style={{fontSize:18,fontWeight:700,color:'var(--text-primary)'}}>{count}</div>
            <div style={{fontSize:10,color:'var(--text-secondary)',marginTop:2}}>{lang==='ar'?mod.ar:mod.en}</div>
          </div>
        );})}
      </div>

      <div style={S.tb}>
        <input style={{...S.inp,minWidth:200}} placeholder={L('🔍 بحث...','🔍 Search...')} value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={S.inp} value={modFilter} onChange={e=>setModFilter(e.target.value)}>
          <option value="all">{L('كل أنواع التصوير','All Modalities')}</option>
          {Object.entries(MODALITIES).map(([k,v])=><option key={k} value={k}>{v.icon} {L(v.ar,v.en)}</option>)}
        </select>
        <select style={S.inp} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="all">{L('كل الحالات','All Status')}</option>
          {Object.entries(STATUSES).map(([k,v])=><option key={k} value={k}>{L(v.ar,v.en)}</option>)}
        </select>
      </div>

      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{ar ? `${selectedIds.size} محدَّد` : `${selectedIds.size} selected`}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelectedIds(new Set())} style={{...S.btn('var(--bg-secondary)'), color:'var(--text-primary)', border:'1.5px solid var(--border-color)', padding:'6px 12px', fontSize:12}}>{ar ? 'إلغاء التحديد' : 'Clear Selection'}</button>
            <button onClick={() => setBulkDeleteConfirm(true)} style={{...S.btn('#ef4444'), padding:'6px 12px', fontSize:12}}><FaTrash /> {ar ? `حذف المحدَّد (${selectedIds.size})` : `Delete Selected (${selectedIds.size})`}</button>
          </div>
        </div>
      )}

      <table style={S.table}>
        <thead>
          <tr>
            <th style={{...S.th, width:36}}>
              <input type="checkbox" checked={pageItems.length > 0 && pageItems.every(r => selectedIds.has(r.id))} onChange={() => {
                setSelectedIds(prev => {
                  const allSelected = pageItems.every(r => prev.has(r.id));
                  const next = new Set(prev);
                  pageItems.forEach(r => allSelected ? next.delete(r.id) : next.add(r.id));
                  return next;
                });
              }} />
            </th>
            {(lang==='ar'?['رقم الطلب','المريض','نوع التصوير','منطقة الجسم','تاريخ الطلب','الحالة','الأولوية','الصور','التقرير','إجراء']:['Req No','Patient','Modality','Body Part','Date','Status','Priority','Images','Report','Action']).map(h=><th key={h} style={S.th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {pageItems.map(r=>{
            const st=STATUSES[r.status]||STATUSES.pending;
            const mod=MODALITIES[r.modality]||MODALITIES.other;
            return (
              <tr key={r.id}>
                <td style={S.td}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                <td style={S.td}><code style={{fontSize:10,background:'var(--bg-tertiary)',padding:'2px 6px',borderRadius:4}}>{r.reqNo}</code></td>
                <td style={S.td}><div style={{fontWeight:600}}>{r.patientName}</div><div style={{fontSize:10,color:'var(--text-secondary)'}}>{r.patientId}</div></td>
                <td style={S.td}><span style={S.badge(mod.color,mod.color+'22')}>{mod.icon} {lang==='ar'?mod.ar:mod.en}</span></td>
                <td style={S.td}>{lang==='ar'?(r.bodyPart||'—'):(r.bodyPartEn||r.bodyPart||'—')}</td>
                <td style={{...S.td,fontSize:11,color:'var(--text-secondary)'}}>{r.requestDate}</td>
                <td style={S.td}><span style={S.badge(st.color,st.bg)}>{lang==='ar'?st.ar:st.en}</span></td>
                <td style={S.td}>{r.priority==='urgent'?<span style={{color:'#ef4444',fontWeight:700,fontSize:11}}>⚡ {L('عاجل','Urgent')}</span>:<span style={{fontSize:11,color:'var(--text-secondary)'}}>{L('عادي','Normal')}</span>}</td>
                <td style={{...S.td,textAlign:'center'}}>{r.images>0?<span style={{background:'#dbeafe',color:'#1a6bab',borderRadius:12,padding:'2px 8px',fontSize:11,fontWeight:600}}>{r.images} {lang==='ar'?'صورة':'images'}</span>:'—'}</td>
                <td style={S.td}>{r.status==='reported'?<div><div style={{fontSize:11,fontWeight:600,color:'#10b981'}}>{lang==='ar'?L('✓ مكتمل','✓ Complete'):'✓ Complete'}</div><div style={{fontSize:10,color:'var(--text-secondary)'}}>{r.reportDate}</div></div>:'—'}</td>
                <td style={S.td}>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {r.status==='scheduled'&&<button onClick={()=>updateStatus(r.id,'examined')} style={{...S.btn('#f59e0b'),padding:'3px 7px',fontSize:10}}>{lang==='ar'?'تم الفحص':'Examined'}</button>}
                    {r.status==='examined'&&<button onClick={()=>{setShowReport(r);setFindings(r.findings||'');setImpression(r.impression||'');}} style={{...S.btn('#10b981'),padding:'3px 7px',fontSize:10}}>{lang==='ar'?'كتابة تقرير':'Write Report'}</button>}
                    {r.status==='pending'&&<button onClick={()=>updateStatus(r.id,'scheduled')} style={{...S.btn('#1a6bab'),padding:'3px 7px',fontSize:10}}>{lang==='ar'?'جدولة':'Schedule'}</button>}
                    <button onClick={()=>{setForm({...r});setEditId(r.id);setShowModal(true);}} style={{...S.btn('#6b7280'),padding:'3px 7px',fontSize:10}}>✏️</button>
                    <button onClick={async ()=>{if(!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.'))))return;const prev=radiology;setRadiology(p=>p.filter(x=>x.id!==r.id));const ok=await syncToServer('radiology','delete',{id:r.id});if(!ok){setRadiology(prev);return;}showToast(L('تم الحذف','Deleted'),'info');}} style={{...S.btn('#ef4444'),padding:'3px 7px',fontSize:10}}>🗑</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {filtered.length===0&&<tr><td colSpan={11} style={{...S.td,textAlign:'center',padding:40,color:'var(--text-secondary)'}}>{L('لا توجد طلبات','No requests found')}</td></tr>}
        </tbody>
      </table>
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />

      {showModal&&(
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={S.mbox}>
            <h3 style={{margin:'0 0 18px',color:'var(--text-primary)'}}>{editId?L('✏️ تعديل','✏️ Edit'):L('📡 طلب تصوير جديد','📡 New Imaging Request')}</h3>
            <div style={S.g2}>
              <label>{L('رقم الطلب','Request No')}<input style={S.fi} value={form.reqNo||''} onChange={e=>setForm(p=>({...p,reqNo:e.target.value}))}/></label>
              <label>{L('تاريخ الطلب','Request Date')}<input type="date" style={S.fi} value={form.requestDate||''} onChange={e=>setForm(p=>({...p,requestDate:e.target.value}))}/></label>
              <label style={{gridColumn:'span 2'}}>{L('اسم المريض','Patient Name')}<input style={S.fi} value={form.patientName||''} onChange={e=>setForm(p=>({...p,patientName:e.target.value}))}/></label>
              <label>{L('رقم المريض','Patient ID')}<input style={S.fi} value={form.patientId||''} onChange={e=>setForm(p=>({...p,patientId:e.target.value}))}/></label>
              <label>{L('الطبيب المحول','Referring Doctor')}<input style={S.fi} value={form.doctorName||''} onChange={e=>setForm(p=>({...p,doctorName:e.target.value}))}/></label>
              <label>{L('نوع التصوير','Modality')}<select style={S.fi} value={form.modality} onChange={e=>setForm(p=>({...p,modality:e.target.value}))}>{Object.entries(MODALITIES).map(([k,v])=><option key={k} value={k}>{v.icon} {L(v.ar,v.en)}</option>)}</select></label>
              {multiHospitalEnabled && (
                <label>{L('المنشأة','Facility')}<select style={S.fi} value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))}>
                  <option value="">—</option>
                  {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                </select></label>
              )}
              <label>{L('منطقة الجسم','Body Part')}<input style={S.fi} value={form.bodyPart||''} onChange={e=>setForm(p=>({...p,bodyPart:e.target.value}))}/></label>
              <label>{L('الأولوية','Priority')}<select style={S.fi} value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))}><option value="normal">{L('عادي','Normal')}</option><option value="urgent">{L('عاجل','Urgent')}</option></select></label>
              <label>{L('عدد الصور','Images Count')}<input type="number" style={S.fi} value={form.images||0} onChange={e=>setForm(p=>({...p,images:+e.target.value}))}/></label>
              <label>{L('الفني','Technician')}<input style={S.fi} value={form.technician||''} onChange={e=>setForm(p=>({...p,technician:e.target.value}))}/></label>
              <label>{L('الطبيب الإشعاعي','Radiologist')}<input style={S.fi} value={form.radiologist||''} onChange={e=>setForm(p=>({...p,radiologist:e.target.value}))}/></label>
            </div>
            <div style={{display:'flex',gap:10,marginTop:18,justifyContent:'flex-end'}}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowModal(false)}>{lang==='ar'?'إلغاء':'Cancel'}</button>
              <button style={S.btn()} onClick={save}>{lang==='ar'?'💾 حفظ':'💾 Save'}</button>
            </div>
          </div>
        </div>
      )}

      {showReport&&(
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowReport(null)}>
          <div style={{...S.mbox,maxWidth:500}}>
            <h3 style={{margin:'0 0 8px',color:'var(--text-primary)'}}>📋 {L('التقرير الإشعاعي','Radiology Report')}</h3>
            <p style={{fontSize:13,color:'var(--text-secondary)',margin:'0 0 16px'}}>{L(MODALITIES[showReport.modality]?.ar, MODALITIES[showReport.modality]?.en)} — {showReport.bodyPart} — {showReport.patientName}</p>
            <label style={{display:'block',marginBottom:12}}><span style={S.fl}>{L('المشاهدات','Findings')}</span><textarea style={{...S.fi,minHeight:90,resize:'vertical'}} value={findings} onChange={e=>setFindings(e.target.value)} placeholder={L('وصف ما يُشاهَد في الصور...','Describe what is observed...')}/></label>
            <label style={{display:'block',marginBottom:16}}><span style={S.fl}>{L('الاستنتاج','Impression')}</span><textarea style={{...S.fi,minHeight:70,resize:'vertical'}} value={impression} onChange={e=>setImpression(e.target.value)} placeholder={L('التشخيص الإشعاعي والتوصيات...','Radiological diagnosis and recommendations...')}/></label>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowReport(null)}>{lang==='ar'?'إلغاء':'Cancel'}</button>
              <button style={S.btn('#10b981')} onClick={saveReport}>{lang==='ar'?'✅ حفظ التقرير':'✅ Save Report'}</button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteConfirm && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && !bulkDeleting && setBulkDeleteConfirm(false)}>
          <div style={{...S.mbox, maxWidth: 420, textAlign:'center', padding: 40}}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
            <h3 style={{ fontSize: 20, marginBottom: 8, color:'var(--text-primary)' }}>{ar ? `حذف ${selectedIds.size} طلب؟` : `Delete ${selectedIds.size} requests?`}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
              {L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button style={S.btn('#6b7280')} onClick={() => setBulkDeleteConfirm(false)} disabled={bulkDeleting}>{lang==='ar'?'إلغاء':'Cancel'}</button>
              <button style={S.btn('#ef4444')} onClick={handleBulkDelete} disabled={bulkDeleting}>{bulkDeleting ? '...' : (lang==='ar'?'حذف':'Delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* eslint-disable no-unused-vars */
import React, { useState, useMemo } from 'react';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { useApp } from '../contexts/AppContext';

const CATEGORIES = {
  hematology:   { ar:'تحاليل الدم',       en:'Hematology',   icon:'🩸', color:'#ef4444' },
  biochemistry: { ar:'كيمياء حيوية',      en:'Biochemistry', icon:'⚗️', color:'#f59e0b' },
  urine:        { ar:'تحليل البول',       en:'Urinalysis',   icon:'🧪', color:'#f97316' },
  microbiology: { ar:'ميكروبيولوجيا',    en:'Microbiology', icon:'🦠', color:'#8b5cf6' },
  serology:     { ar:'سيرولوجيا',         en:'Serology',     icon:'💉', color:'#06b6d4' },
  hormones:     { ar:'هرمونات',           en:'Hormones',     icon:'🔬', color:'#10b981' },
  other:        { ar:'أخرى',             en:'Other',        icon:'🔬', color:'#6b7280' },
};
const STATUSES = {
  pending:    { ar:'بانتظار العينة',  en:'Awaiting Sample',  color:'#6b7280', bg:'#f3f4f6' },
  processing: { ar:'قيد التحليل',     en:'Processing',     color:'#f59e0b', bg:'#fef3c7' },
  completed:  { ar:'مكتمل',           en:'Completed',           color:'#10b981', bg:'#d1fae5' },
  cancelled:  { ar:'ملغي',            en:'Cancelled',            color:'#ef4444', bg:'#fee2e2' },
};
const EMPTY = { reqNo:'', patientName:'', patientId:'', doctorName:'', testType:'', category:'hematology', requestDate:'', sampleDate:'', resultDate:'', status:'pending', priority:'normal', results:null, notes:'' };

export default function LaboratoryPage() {
  const { labTests, setLabTests, lang, showToast, syncToServer, hospitals, multiHospitalEnabled } = useApp();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => lang === 'ar' ? ar : en;
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [resultText, setResultText] = useState('');
  const [resultNote, setResultNote] = useState('');

  const filtered = useMemo(() => labTests.filter(t => {
    const q = search.toLowerCase();
    return (!q || t.patientName.includes(q) || t.reqNo.toLowerCase().includes(q) || t.testType.includes(q))
      && (catFilter === 'all' || t.category === catFilter)
      && (statusFilter === 'all' || t.status === statusFilter);
  }), [labTests, search, catFilter, statusFilter]);
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filtered, 50);

  const stats = useMemo(() => ({
    total: labTests.length,
    pending: labTests.filter(t=>t.status==='pending').length,
    processing: labTests.filter(t=>t.status==='processing').length,
    completed: labTests.filter(t=>t.status==='completed').length,
    urgent: labTests.filter(t=>t.priority==='urgent').length,
  }), [labTests]);

  const openAdd = () => {
    const n = `LAB-${new Date().getFullYear()}-${String(labTests.length+1).padStart(4,'0')}`;
    setForm({ ...EMPTY, reqNo:n, requestDate:new Date().toISOString().split('T')[0] });
    setEditId(null); setShowModal(true);
  };
  const openEdit = (t) => { setForm({...t}); setEditId(t.id); setShowModal(true); };
  const save = () => {
    if (!form.patientName || !form.testType) { showToast(L('يرجى تعبئة المريض ونوع التحليل','Please fill patient and test type'),'error'); return; }
    if (editId) {
      const ut = {...form,id:editId};
      setLabTests(p=>p.map(t=>t.id===editId?{...t,...ut}:t));
      syncToServer('labTests','update',ut);
      showToast(L('تم التحديث','Updated'),'success');
    } else {
      const nt = {...form,id:Date.now()};
      setLabTests(p=>[...p,nt]);
      syncToServer('labTests','create',nt);
      showToast(L('تمت إضافة الطلب','Request added'),'success');
    }
    setShowModal(false);
  };
  const updateStatus = (id, status) => {
    setLabTests(p => {
      const updated = p.map(t=>t.id===id?{...t,status, ...(status==='processing'?{sampleDate:new Date().toISOString().split('T')[0]}:{})}:t);
      const changed = updated.find(t => t.id === id);
      if (changed) syncToServer('labTests','update',changed);
      return updated;
    });
    showToast(L('تم تحديث الحالة','Status updated'),'success');
  };
  const addResult = () => {
    setLabTests(p => {
      const updated = p.map(t=>t.id===showResultModal.id?{...t,status:'completed',resultDate:new Date().toISOString().split('T')[0],results:{value:resultText,notes:resultNote}}:t);
      const changed = updated.find(t => t.id === showResultModal.id);
      if (changed) syncToServer('labTests','update',changed);
      return updated;
    });
    showToast(L('تم إدخال النتيجة','Result entered'),'success'); setShowResultModal(null);
  };

  const S = {
    page:{padding:24,direction:dir},
    stats:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20},
    card:(c)=>({background:'var(--bg-secondary)',borderRadius:12,padding:'14px 18px',borderTop:`3px solid ${c}`}),
    tb:{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'},
    inp:{padding:'8px 12px',border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:13},
    btn:(c='#1a6bab')=>({padding:'8px 16px',background:c,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}),
    table:{width:'100%',borderCollapse:'collapse',background:'var(--bg-secondary)',borderRadius:12,overflow:'hidden'},
    th:{padding:'10px 12px',textAlign:dir==='rtl'?'right':'left',background:'var(--bg-tertiary)',fontSize:11,fontWeight:600,color:'var(--text-secondary)',borderBottom:'1px solid var(--border)'},
    td:{padding:'10px 12px',borderBottom:'1px solid var(--border)',fontSize:12,color:'var(--text-primary)'},
    badge:(c,bg)=>({display:'inline-block',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600,color:c,background:bg}),
    modal:{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999},
    mbox:{background:'var(--bg-primary)',borderRadius:16,padding:28,width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto',direction:dir},
    g2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12},
    fl:{display:'block',fontSize:12,color:'var(--text-secondary)',marginBottom:4},
    fi:{width:'100%',padding:'7px 10px',border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'},
  };

  return (
    <div style={S.page}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:'var(--text-primary)',margin:0}}>{lang==='ar'?'🔬 المختبرات الطبية':'🔬 Medical Laboratory'}</h1>
          <p style={{color:'var(--text-secondary)',fontSize:13,margin:'4px 0 0'}}>{lang==='ar'?'إدارة طلبات التحاليل والنتائج المخبرية':'Manage lab test requests and results'}</p>
        </div>
        <button style={S.btn()} onClick={openAdd}>{lang==='ar'?'+ طلب تحليل جديد':'+ New Test Request'}</button>
      </div>

      <div style={S.stats}>
        {[[lang==='ar'?'إجمالي الطلبات':'Total Requests',stats.total,'#1a6bab'],[lang==='ar'?'بانتظار العينة':'Awaiting Sample',stats.pending,'#6b7280'],[lang==='ar'?'قيد التحليل':'Processing',stats.processing,'#f59e0b'],[lang==='ar'?'مكتملة':'Completed',stats.completed,'#10b981'],[lang==='ar'?'عاجلة':'Urgent',stats.urgent,'#ef4444']].map(([l,v,c],i)=>(
          <div key={i} style={S.card(c)}><div style={{fontSize:22,fontWeight:700,color:'var(--text-primary)'}}>{v}</div><div style={{fontSize:11,color:'var(--text-secondary)',marginTop:3}}>{l}</div></div>
        ))}
      </div>

      <div style={S.tb}>
        <input style={{...S.inp,minWidth:200}} placeholder={L('🔍 بحث بالاسم أو رقم الطلب...','🔍 Search by name or request number...')} value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={S.inp} value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
          <option value="all">{L('كل الفئات','All Categories')}</option>
          {Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.icon} {L(v.ar,v.en)}</option>)}
        </select>
        <select style={S.inp} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="all">{L('كل الحالات','All Status')}</option>
          {Object.entries(STATUSES).map(([k,v])=><option key={k} value={k}>{L(v.ar,v.en)}</option>)}
        </select>
      </div>

      <table style={S.table}>
        <thead>
          <tr>{(lang==='ar'?['رقم الطلب','المريض','الطبيب','نوع التحليل','الفئة','تاريخ الطلب','الحالة','الأولوية','النتيجة','إجراء']:['Req No','Patient','Doctor','Test','Category','Date','Status','Priority','Result','Action']).map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {pageItems.map(t=>{
            const st=STATUSES[t.status]||STATUSES.pending;
            const cat=CATEGORIES[t.category]||CATEGORIES.other;
            return (
              <tr key={t.id}>
                <td style={S.td}><code style={{fontSize:10,background:'var(--bg-tertiary)',padding:'2px 6px',borderRadius:4}}>{t.reqNo}</code></td>
                <td style={S.td}><div style={{fontWeight:600}}>{t.patientName}</div><div style={{fontSize:10,color:'var(--text-secondary)'}}>{t.patientId}</div></td>
                <td style={{...S.td,fontSize:11}}>{t.doctorName}</td>
                <td style={S.td}>{lang==='ar'?t.testType:(t.testTypeEn||t.testType)}</td>
                <td style={S.td}><span style={S.badge(cat.color,cat.color+'22')}>{cat.icon} {lang==='ar'?cat.ar:cat.en}</span></td>
                <td style={{...S.td,fontSize:11,color:'var(--text-secondary)'}}>{t.requestDate}</td>
                <td style={S.td}><span style={S.badge(st.color,st.bg)}>{lang==='ar'?st.ar:st.en}</span></td>
                <td style={S.td}>{t.priority==='urgent'?<span style={{color:'#ef4444',fontWeight:700,fontSize:11}}>⚡ {L('عاجل','Urgent')}</span>:<span style={{color:'var(--text-secondary)',fontSize:11}}>{L('عادي','Normal')}</span>}</td>
                <td style={S.td}>{t.results?<div><div style={{color:'#10b981',fontWeight:600,fontSize:11}}>{lang==='ar'?t.results.value:(t.results.valueEn||t.results.value)}</div>{t.results.notes&&<div style={{fontSize:10,color:'var(--text-secondary)'}}>{lang==='ar'?t.results.notes:(t.results.notesEn||t.results.notes)}</div>}</div>:<span style={{color:'var(--text-secondary)',fontSize:11}}>—</span>}</td>
                <td style={S.td}>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {t.status==='pending'&&<button onClick={()=>updateStatus(t.id,'processing')} style={{...S.btn('#f59e0b'),padding:'3px 8px',fontSize:10}}>{L('أخذ العينة','Take Sample')}</button>}
                    {t.status==='processing'&&<button onClick={()=>{setShowResultModal(t);setResultText('');setResultNote('');}} style={{...S.btn('#10b981'),padding:'3px 8px',fontSize:10}}>{L('إدخال النتيجة','Enter Result')}</button>}
                    <button onClick={()=>openEdit(t)} style={{...S.btn('#6b7280'),padding:'3px 8px',fontSize:10}}>✏️</button>
                    <button onClick={()=>{setLabTests(p=>p.filter(x=>x.id!==t.id));syncToServer('labTests','delete',{id:t.id});showToast('تم الحذف','info');}} style={{...S.btn('#ef4444'),padding:'3px 8px',fontSize:10}}>🗑</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {filtered.length===0&&<tr><td colSpan={10} style={{...S.td,textAlign:'center',padding:40,color:'var(--text-secondary)'}}>{L('لا توجد طلبات','No requests found')}</td></tr>}
        </tbody>
      </table>
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />

      {showModal&&(
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={S.mbox}>
            <h3 style={{margin:'0 0 18px',color:'var(--text-primary)'}}>{editId?lang==='ar'?'✏️ تعديل طلب التحليل':'✏️ Edit Test Request':lang==='ar'?'🔬 طلب تحليل جديد':'🔬 New Test Request'}</h3>
            <div style={S.g2}>
              <label>{L('رقم الطلب','Request No')}<input style={S.fi} value={form.reqNo||''} onChange={e=>setForm(p=>({...p,reqNo:e.target.value}))}/></label>
              <label>{L('تاريخ الطلب','Request Date')}<input type="date" style={S.fi} value={form.requestDate||''} onChange={e=>setForm(p=>({...p,requestDate:e.target.value}))}/></label>
              <label style={{gridColumn:'span 2'}}>{L('اسم المريض','Patient Name')}<input style={S.fi} value={form.patientName||''} onChange={e=>setForm(p=>({...p,patientName:e.target.value}))}/></label>
              <label>{L('رقم المريض','Patient ID')}<input style={S.fi} value={form.patientId||''} onChange={e=>setForm(p=>({...p,patientId:e.target.value}))}/></label>
              <label>{L('الطبيب المحول','Referring Doctor')}<input style={S.fi} value={form.doctorName||''} onChange={e=>setForm(p=>({...p,doctorName:e.target.value}))}/></label>
              <label style={{gridColumn:'span 2'}}>{L('نوع التحليل','Test Type')}<input style={S.fi} value={form.testType||''} onChange={e=>setForm(p=>({...p,testType:e.target.value}))}/></label>
              {multiHospitalEnabled && (
                <label>{L('المنشأة','Facility')}<select style={S.fi} value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))}>
                  <option value="">—</option>
                  {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                </select></label>
              )}
              <label>{L('الفئة','Category')}<select style={S.fi} value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>{Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{L(v.ar,v.en)}</option>)}</select></label>
              <label>{L('الأولوية','Priority')}<select style={S.fi} value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))}><option value="normal">{L('عادي','Normal')}</option><option value="urgent">{L('عاجل','Urgent')}</option></select></label>
              <label>{L('الحالة','Status')}<select style={S.fi} value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>{Object.entries(STATUSES).map(([k,v])=><option key={k} value={k}>{L(v.ar,v.en)}</option>)}</select></label>
              <label>{L('ملاحظات','Notes')}<input style={S.fi} value={form.notes||''} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></label>
            </div>
            <div style={{display:'flex',gap:10,marginTop:18,justifyContent:'flex-end'}}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowModal(false)}>{lang==='ar'?'إلغاء':'Cancel'}</button>
              <button style={S.btn()} onClick={save}>{lang==='ar'?'💾 حفظ':'💾 Save'}</button>
            </div>
          </div>
        </div>
      )}

      {showResultModal&&(
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowResultModal(null)}>
          <div style={{...S.mbox,maxWidth:420}}>
            <h3 style={{margin:'0 0 12px',color:'var(--text-primary)'}}>📋 إدخال نتيجة التحليل</h3>
            <p style={{color:'var(--text-secondary)',fontSize:13,margin:'0 0 16px'}}>{showResultModal.testType} — {showResultModal.patientName}</p>
            <label style={{display:'block',marginBottom:12}}>{L('النتيجة','Result')}<input style={{...S.fi,fontWeight:600}} placeholder={L('مثال: طبيعي / 126 mg/dL','e.g.: Normal / 126 mg/dL')} value={resultText} onChange={e=>setResultText(e.target.value)}/></label>
            <label style={{display:'block',marginBottom:16}}><span style={S.fl}>ملاحظات الطبيب</span><textarea style={{...S.fi,minHeight:80,resize:'vertical'}} value={resultNote} onChange={e=>setResultNote(e.target.value)}/></label>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowResultModal(null)}>{lang==='ar'?'إلغاء':'Cancel'}</button>
              <button style={S.btn('#10b981')} onClick={addResult}>{lang==='ar'?'✅ تأكيد النتيجة':'✅ Confirm Result'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

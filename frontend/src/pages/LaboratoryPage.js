/* eslint-disable no-unused-vars */
import React, { useState, useMemo } from 'react';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { useApp } from '../contexts/AppContext';
import { FaFileExcel, FaTrash } from 'react-icons/fa';
import ExcelImportModal from '../components/ExcelImportModal';
import DateRangeFilter from '../components/DateRangeFilter';
import PageBanner from '../components/PageBanner';
import normalizeLookupKey from '../utils/normalizeLookupKey';
import { api } from '../api';

const BANNER_GRADIENT = 'linear-gradient(135deg, #701a75 0%, #a21caf 100%)';

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

// ── حزم فحوصات جاهزة (Panels) ────────────────────────────────────────────────
// مشكلة حقيقية أثارتها المستخدمة: التحاليل عادة تُطلَب كمجموعة (مثلاً فحص
// روتيني شامل = عدة تحاليل مع بعض بنفس الزيارة)، وإدخال بيانات المريض من
// جديد لكل تحليل منفصل غير عملي. هذي الحزم تسمح بإدخال بيانات المريض مرة
// وحدة بس، واختيار حزمة كاملة، فينشئ النظام طلب منفصل لكل تحليل بالحزمة
// تلقائياً (لأن كل تحليل لسا له نتيجة/حالة/تاريخ عينة مستقلة عن الباقي).
const TEST_PANELS = [
  { key: 'routine', nameAr: 'فحص روتيني شامل', nameEn: 'Routine Full Checkup', tests: [
    { testType: 'CBC', category: 'hematology' },
    { testType: 'FBS (سكر صائم)', category: 'biochemistry' },
    { testType: 'Lipid Profile (دهون الدم)', category: 'biochemistry' },
    { testType: 'Kidney Function (يوريا/كرياتينين)', category: 'biochemistry' },
    { testType: 'Liver Function (SGOT/SGPT)', category: 'biochemistry' },
  ]},
  { key: 'preop', nameAr: 'فحص ما قبل العمليات', nameEn: 'Pre-operative Panel', tests: [
    { testType: 'CBC', category: 'hematology' },
    { testType: 'Coagulation (PT/PTT)', category: 'hematology' },
    { testType: 'Blood Group', category: 'hematology' },
    { testType: 'Kidney Function', category: 'biochemistry' },
    { testType: 'Liver Function', category: 'biochemistry' },
  ]},
  { key: 'pregnancy', nameAr: 'متابعة الحمل الروتينية', nameEn: 'Pregnancy Routine Panel', tests: [
    { testType: 'CBC', category: 'hematology' },
    { testType: 'Blood Group', category: 'hematology' },
    { testType: 'FBS', category: 'biochemistry' },
    { testType: 'Urine Analysis', category: 'urine' },
    { testType: 'HBsAg', category: 'serology' },
  ]},
  { key: 'diabetes', nameAr: 'متابعة السكري', nameEn: 'Diabetes Follow-up Panel', tests: [
    { testType: 'FBS', category: 'biochemistry' },
    { testType: 'HbA1c', category: 'biochemistry' },
    { testType: 'Lipid Profile', category: 'biochemistry' },
    { testType: 'Kidney Function', category: 'biochemistry' },
  ]},
  { key: 'thyroid', nameAr: 'وظائف الغدة الدرقية', nameEn: 'Thyroid Panel', tests: [
    { testType: 'TSH', category: 'hormones' },
    { testType: 'T3', category: 'hormones' },
    { testType: 'T4', category: 'hormones' },
  ]},
];
const EMPTY_PANEL_FORM = { patientName: '', patientId: '', doctorName: '', requestDate: '', priority: 'normal', panelKey: '', selectedTests: [] };

export default function LaboratoryPage() {
  const { labTests, setLabTests, lang, showToast, syncToServer, confirmDialog, hospitals, multiHospitalEnabled } = useApp();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => lang === 'ar' ? ar : en;
  const ar = lang === 'ar';
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  // requestDate is used as the date filter's field: it's always set at
  // creation (openAdd defaults it to today), unlike sampleDate/resultDate
  // which only populate later in the workflow (when a sample is taken /
  // a result is entered) and are absent for pending requests.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [resultText, setResultText] = useState('');
  const [resultNote, setResultNote] = useState('');

  // ── استيراد من Excel ──────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);

  // ── تحديد متعدد للحذف الجماعي (بنفس نمط PatientsPage) ────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const filtered = useMemo(() => labTests.filter(t => {
    const q = search.toLowerCase();
    // Fallback to '' before calling string methods: some records (e.g. bulk-
    // imported/seeded data) can have a missing patientName, reqNo, or
    // testType, which would otherwise throw here and crash the whole page.
    return (!q || (t.patientName || '').includes(q) || (t.reqNo || '').toLowerCase().includes(q) || (t.testType || '').includes(q))
      // Normalized the same way the table row below resolves its displayed
      // category/status, so a record shown as e.g. "Other"/"Awaiting Sample"
      // (its real value doesn't match any known key) also matches when that
      // same category/status is selected as a filter.
      && (catFilter === 'all' || normalizeLookupKey(t.category, CATEGORIES, 'other') === catFilter)
      && (statusFilter === 'all' || normalizeLookupKey(t.status, STATUSES, 'pending') === statusFilter)
      && (!dateFrom || t.requestDate >= dateFrom) && (!dateTo || t.requestDate <= dateTo);
  }), [labTests, search, catFilter, statusFilter, dateFrom, dateTo]);
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filtered, 50);

  const stats = useMemo(() => ({
    total: labTests.length,
    // Normalized the same way the table displays status, so this count stays
    // consistent with what selecting that same status filter shows below.
    pending: labTests.filter(t=>normalizeLookupKey(t.status, STATUSES, 'pending')==='pending').length,
    processing: labTests.filter(t=>normalizeLookupKey(t.status, STATUSES, 'pending')==='processing').length,
    completed: labTests.filter(t=>normalizeLookupKey(t.status, STATUSES, 'pending')==='completed').length,
    urgent: labTests.filter(t=>t.priority==='urgent').length,
  }), [labTests]);

  const openAdd = () => {
    // إصلاح: labTests.length+1 يكرر رقم طلب موجود فعلاً بعد أي حذف
    const lYear = new Date().getFullYear();
    const lPrefix = `LAB-${lYear}-`;
    const lMaxSeq = labTests.reduce((max,t)=>{
      if (typeof t.reqNo !== 'string' || !t.reqNo.startsWith(lPrefix)) return max;
      const v = parseInt(t.reqNo.slice(lPrefix.length),10);
      return Number.isFinite(v) && v>max ? v : max;
    },0);
    const n = `${lPrefix}${String(lMaxSeq+1).padStart(4,'0')}`;
    setForm({ ...EMPTY, reqNo:n, requestDate:new Date().toISOString().split('T')[0] });
    setEditId(null); setShowModal(true);
  };

  // ── حزم الفحوصات ──────────────────────────────────────────────────────────
  const [showPanelModal, setShowPanelModal] = useState(false);
  const [panelForm, setPanelForm] = useState(EMPTY_PANEL_FORM);
  const [savingPanel, setSavingPanel] = useState(false);
  const openPanelAdd = () => {
    setPanelForm({ ...EMPTY_PANEL_FORM, requestDate: new Date().toISOString().split('T')[0] });
    setShowPanelModal(true);
  };
  const nextReqNo = (offset) => {
    const lYear = new Date().getFullYear();
    const lPrefix = `LAB-${lYear}-`;
    const lMaxSeq = labTests.reduce((max,t)=>{
      if (typeof t.reqNo !== 'string' || !t.reqNo.startsWith(lPrefix)) return max;
      const v = parseInt(t.reqNo.slice(lPrefix.length),10);
      return Number.isFinite(v) && v>max ? v : max;
    },0);
    return `${lPrefix}${String(lMaxSeq + offset).padStart(4,'0')}`;
  };
  const savePanel = async () => {
    if (!panelForm.patientName || panelForm.selectedTests.length === 0) {
      showToast(L('يرجى تعبئة اسم المريض واختيار تحليل واحد على الأقل', 'Please fill patient name and select at least one test'), 'error');
      return;
    }
    setSavingPanel(true);
    let createdCount = 0;
    for (let i = 0; i < panelForm.selectedTests.length; i++) {
      const test = panelForm.selectedTests[i];
      const nt = {
        ...EMPTY,
        id: Date.now() + i, // فريد لكل سجل بنفس الدفعة (Date.now() وحدها تتكرر بحلقة سريعة)
        reqNo: nextReqNo(i + 1),
        patientName: panelForm.patientName,
        patientId: panelForm.patientId,
        doctorName: panelForm.doctorName,
        requestDate: panelForm.requestDate,
        priority: panelForm.priority,
        testType: test.testType,
        category: test.category,
      };
      setLabTests(p => [...p, nt]);
      const ok = await syncToServer('labTests', 'create', nt); // نسلسل الإنشاء (await بكل تكرار) بدل الكل دفعة وحدة، لضمان عدم تكرار reqNo عند حساب nextReqNo لعنصر لاحق
      if (ok) createdCount++;
    }
    setSavingPanel(false);
    setShowPanelModal(false);
    showToast(
      createdCount === panelForm.selectedTests.length
        ? L(`تم إنشاء ${createdCount} طلب فحص بنجاح`, `${createdCount} test request(s) created successfully`)
        : L(`تم إنشاء ${createdCount} من ${panelForm.selectedTests.length} طلب — راجعي القائمة`, `${createdCount} of ${panelForm.selectedTests.length} created — please review the list`),
      createdCount === panelForm.selectedTests.length ? 'success' : 'warning'
    );
  };
  const openEdit = (t) => { setForm({...t}); setEditId(t.id); setShowModal(true); };
  const save = async () => {
    if (!form.patientName || !form.testType) { showToast(L('يرجى تعبئة المريض ونوع التحليل','Please fill patient and test type'),'error'); return; }
    const prev = labTests;
    if (editId) {
      const ut = {...form,id:editId};
      setLabTests(p=>p.map(t=>t.id===editId?{...t,...ut}:t));
      const ok = await syncToServer('labTests','update',ut);
      if (!ok) { setLabTests(prev); return; }
      showToast(L('تم التحديث','Updated'),'success');
    } else {
      const nt = {...form,id:Date.now()};
      setLabTests(p=>[...p,nt]);
      const ok = await syncToServer('labTests','create',nt);
      if (!ok) { setLabTests(prev); return; }
      showToast(L('تمت إضافة الطلب','Request added'),'success');
    }
    setShowModal(false);
  };
  const updateStatus = async (id, status) => {
    const prev = labTests;
    const current = labTests.find(t => t.id === id);
    if (!current) return;
    const changed = {...current, status, ...(status==='processing'?{sampleDate:new Date().toISOString().split('T')[0]}:{})};
    setLabTests(p => p.map(t=>t.id===id?changed:t));
    const ok = await syncToServer('labTests','update',changed);
    if (!ok) { setLabTests(prev); return; }
    showToast(L('تم تحديث الحالة','Status updated'),'success');
  };
  const addResult = async () => {
    const prev = labTests;
    const current = labTests.find(t => t.id === showResultModal.id);
    if (!current) return;
    const changed = {...current,status:'completed',resultDate:new Date().toISOString().split('T')[0],results:{value:resultText,notes:resultNote}};
    setLabTests(p => p.map(t=>t.id===showResultModal.id?changed:t));
    const ok = await syncToServer('labTests','update',changed);
    if (!ok) { setLabTests(prev); return; }
    showToast(L('تم إدخال النتيجة','Result entered'),'success'); setShowResultModal(null);
  };

  // ── حذف جماعي (بنفس نمط PatientsPage.handleBulkDelete) ───────────────────
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const ok = await syncToServer('labTests', 'delete', { id });
      if (ok) { setLabTests(p => p.filter(t => t.id !== id)); deleted++; }
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
    btn:(c='#1a6bab')=>({padding:'8px 16px',background:c,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}),
    table:{width:'100%',borderCollapse:'collapse',background:'var(--bg-card)',borderRadius:12,overflow:'hidden'},
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
      <PageBanner
        icon="🔬"
        title={lang==='ar'?'المختبرات الطبية':'Medical Laboratory'}
        subtitle={lang==='ar'?'إدارة طلبات التحاليل والنتائج المخبرية':'Manage lab test requests and results'}
        gradient={BANNER_GRADIENT}
      >
        <button style={{...S.btn(), background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.5)'}} onClick={() => setShowImport(true)}>
          <FaFileExcel style={{marginInlineEnd:6}} /> {ar ? 'استيراد من Excel' : 'Import from Excel'}
        </button>
        <button style={{...S.btn(), background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.5)'}} onClick={openPanelAdd}>{lang==='ar'?'🧬 حزمة فحوصات':'🧬 Test Panel'}</button>
        <button style={{...S.btn(), background:'#fff', color:'#701a75'}} onClick={openAdd}>{lang==='ar'?'+ طلب تحليل جديد':'+ New Test Request'}</button>
      </PageBanner>

      {showImport && (
        <ExcelImportModal
          apiName="labTests"
          title={ar ? 'استيراد طلبات مختبر من Excel' : 'Import Lab Requests from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/labTests');
              if (Array.isArray(fresh)) setLabTests(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً وتظهر بأول تحديث لاحق */ }
          }}
        />
      )}

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
        <DateRangeFilter lang={lang} from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
          label={L('تاريخ الطلب:', 'Request date:')} />
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
              <input type="checkbox" checked={pageItems.length > 0 && pageItems.every(t => selectedIds.has(t.id))} onChange={() => {
                setSelectedIds(prev => {
                  const allSelected = pageItems.every(t => prev.has(t.id));
                  const next = new Set(prev);
                  pageItems.forEach(t => allSelected ? next.delete(t.id) : next.add(t.id));
                  return next;
                });
              }} />
            </th>
            {(lang==='ar'?['رقم الطلب','المريض','الطبيب','نوع التحليل','الفئة','تاريخ الطلب','الحالة','الأولوية','النتيجة','إجراء']:['Req No','Patient','Doctor','Test','Category','Date','Status','Priority','Result','Action']).map(h=><th key={h} style={S.th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {pageItems.map(t=>{
            const st=STATUSES[normalizeLookupKey(t.status, STATUSES, 'pending')];
            const cat=CATEGORIES[normalizeLookupKey(t.category, CATEGORIES, 'other')];
            return (
              <tr key={t.id}>
                <td style={S.td}><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} /></td>
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
                    <button onClick={async ()=>{if(!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.'))))return;const prev=labTests;setLabTests(p=>p.filter(x=>x.id!==t.id));const ok=await syncToServer('labTests','delete',{id:t.id});if(!ok){setLabTests(prev);return;}showToast(L('تم الحذف','Deleted'),'info');}} style={{...S.btn('#ef4444'),padding:'3px 8px',fontSize:10}}>🗑</button>
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

      {showPanelModal&&(
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowPanelModal(false)}>
          <div style={{...S.mbox, maxWidth: 560}}>
            <h3 style={{margin:'0 0 6px',color:'var(--text-primary)'}}>{L('🧬 حزمة فحوصات', '🧬 Test Panel')}</h3>
            <p style={{margin:'0 0 16px',fontSize:12,color:'var(--text-secondary)'}}>{L('عبّي بيانات المريض مرة وحدة، واختاري حزمة — كل تحليل بالحزمة يُنشأ كطلب منفصل تلقائياً.', 'Fill patient info once, pick a panel — each test in it is created as a separate request automatically.')}</p>

            <div style={S.g2}>
              <label style={{gridColumn:'span 2'}}>{L('اسم المريض','Patient Name')}<input style={S.fi} value={panelForm.patientName} onChange={e=>setPanelForm(p=>({...p,patientName:e.target.value}))}/></label>
              <label>{L('رقم المريض','Patient ID')}<input style={S.fi} value={panelForm.patientId} onChange={e=>setPanelForm(p=>({...p,patientId:e.target.value}))}/></label>
              <label>{L('الطبيب المحول','Referring Doctor')}<input style={S.fi} value={panelForm.doctorName} onChange={e=>setPanelForm(p=>({...p,doctorName:e.target.value}))}/></label>
              <label>{L('تاريخ الطلب','Request Date')}<input type="date" style={S.fi} value={panelForm.requestDate} onChange={e=>setPanelForm(p=>({...p,requestDate:e.target.value}))}/></label>
              <label>{L('الأولوية','Priority')}<select style={S.fi} value={panelForm.priority} onChange={e=>setPanelForm(p=>({...p,priority:e.target.value}))}><option value="normal">{L('عادي','Normal')}</option><option value="urgent">{L('عاجل','Urgent')}</option></select></label>
            </div>

            <label style={{display:'block',marginTop:14}}>
              {L('اختاري حزمة جاهزة (اختياري)','Pick a ready panel (optional)')}
              <select
                style={S.fi}
                value={panelForm.panelKey}
                onChange={e=>{
                  const key = e.target.value;
                  const panel = TEST_PANELS.find(p=>p.key===key);
                  setPanelForm(p=>({...p, panelKey:key, selectedTests: panel ? [...panel.tests] : p.selectedTests}));
                }}
              >
                <option value="">{L('— اختاري حزمة أو أضيفي تحاليل منفردة تحت —','— pick a panel, or add individual tests below —')}</option>
                {TEST_PANELS.map(p=><option key={p.key} value={p.key}>{L(p.nameAr,p.nameEn)} ({p.tests.length})</option>)}
              </select>
            </label>

            <div style={{marginTop:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:700}}>{L('التحاليل المختارة','Selected Tests')} ({panelForm.selectedTests.length})</span>
                <button
                  type="button"
                  style={{...S.btn('#6b7280'),padding:'3px 10px',fontSize:11}}
                  onClick={()=>setPanelForm(p=>({...p, selectedTests:[...p.selectedTests, {testType:'', category:'hematology'}]}))}
                >
                  {L('+ تحليل منفرد','+ Individual Test')}
                </button>
              </div>
              {panelForm.selectedTests.length === 0 ? (
                <p style={{fontSize:12,color:'var(--text-secondary)'}}>{L('ما فيه تحاليل مختارة بعد — اختاري حزمة أو أضيفي تحليل منفرد.','No tests selected yet — pick a panel or add an individual test.')}</p>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:220,overflowY:'auto'}}>
                  {panelForm.selectedTests.map((t, idx) => (
                    <div key={idx} style={{display:'flex',gap:6,alignItems:'center'}}>
                      <input
                        style={{...S.fi, flex:2}}
                        placeholder={L('نوع التحليل','Test type')}
                        value={t.testType}
                        onChange={e=>setPanelForm(p=>({...p, selectedTests: p.selectedTests.map((x,i)=>i===idx?{...x,testType:e.target.value}:x)}))}
                      />
                      <select
                        style={{...S.fi, flex:1}}
                        value={t.category}
                        onChange={e=>setPanelForm(p=>({...p, selectedTests: p.selectedTests.map((x,i)=>i===idx?{...x,category:e.target.value}:x)}))}
                      >
                        {Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{L(v.ar,v.en)}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={()=>setPanelForm(p=>({...p, selectedTests: p.selectedTests.filter((_,i)=>i!==idx)}))}
                        style={{...S.btn('#ef4444'),padding:'4px 8px',fontSize:11}}
                      >🗑</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{display:'flex',gap:10,marginTop:18,justifyContent:'flex-end'}}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowPanelModal(false)} disabled={savingPanel}>{lang==='ar'?'إلغاء':'Cancel'}</button>
              <button style={S.btn()} onClick={savePanel} disabled={savingPanel}>
                {savingPanel ? L('جارٍ الإنشاء...','Creating...') : L(`💾 إنشاء ${panelForm.selectedTests.length} طلب`,`💾 Create ${panelForm.selectedTests.length} Request(s)`)}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResultModal&&(
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowResultModal(null)}>
          <div style={{...S.mbox,maxWidth:420}}>
            <h3 style={{margin:'0 0 12px',color:'var(--text-primary)'}}>📋 {L('إدخال نتيجة التحليل','Enter Test Result')}</h3>
            <p style={{color:'var(--text-secondary)',fontSize:13,margin:'0 0 16px'}}>{showResultModal.testType} — {showResultModal.patientName}</p>
            <label style={{display:'block',marginBottom:12}}>{L('النتيجة','Result')}<input style={{...S.fi,fontWeight:600}} placeholder={L('مثال: طبيعي / 126 mg/dL','e.g.: Normal / 126 mg/dL')} value={resultText} onChange={e=>setResultText(e.target.value)}/></label>
            <label style={{display:'block',marginBottom:16}}><span style={S.fl}>{L('ملاحظات الطبيب','Physician Notes')}</span><textarea style={{...S.fi,minHeight:80,resize:'vertical'}} value={resultNote} onChange={e=>setResultNote(e.target.value)}/></label>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowResultModal(null)}>{lang==='ar'?'إلغاء':'Cancel'}</button>
              <button style={S.btn('#10b981')} onClick={addResult}>{lang==='ar'?'✅ تأكيد النتيجة':'✅ Confirm Result'}</button>
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
              {L('هل أنت متأكدة؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')}
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

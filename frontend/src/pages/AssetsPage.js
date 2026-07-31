/* eslint-disable no-unused-vars */
import React, { useState, useMemo, useEffect } from 'react';
import useServerPagination from '../hooks/useServerPagination';
import Pagination from '../components/Pagination';
import { useApp } from '../contexts/AppContext';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelExportButton from '../components/ExcelExportButton';
import PageBanner from '../components/PageBanner';
import { api } from '../api';
import normalizeLookupKey from '../utils/normalizeLookupKey';

const BANNER_GRADIENT = 'linear-gradient(135deg, #334155 0%, #64748b 100%)';

// إصلاح تعارض عرض/فلترة: 49 من 109 أصل حقيقي (فحص مباشر بقاعدة البيانات)
// بحقل status/category فارغ تماماً (دفعة مستوردة). كان `CATEGORIES[a.category]
// || CATEGORIES.other` / `STATUSES[a.status] || STATUSES.active` يعرض هذه
// السجلات بشارة "أخرى"/"نشط" حقيقية — افتراض خاطئ، وليس حالة فعلية — بينما
// الفلتر الفعلي بالخادم يقارن القيمة الخام تطابقاً تاماً (`status = 'active'`)
// فلا يطابق حقلاً فارغاً أبداً. النتيجة: سجل يظهر بشارة "نشط" لكنه يختفي فعلياً
// عند اختيار فلتر "نشط" — نفس نمط التعارض المُصلَح سابقاً بصفحات أخرى.
// الحل: مفتاح "unset" صريح ضمن نفس قاموس LOOKUP (تُستخدَم عبر normalizeLookupKey
// — نفس الدالة لكل من العرض والفلترة، فلا يمكن أن يتعارضا بعد الآن)، مُستبعَد
// عمداً من قوائم نموذج الإضافة/التعديل (ASSIGNABLE_* أدناه) حتى لا يُختار كقيمة
// حقيقية يدوياً أبداً — الطريقة الوحيدة لظهوره هي غياب/فراغ الحقل فعلاً.
const CATEGORIES = {
  radiology:   { ar:'أشعة وتصوير',   en:'Radiology',   icon:'📡', color:'#1a6bab' },
  ct:          { ar:'مفراس CT',       en:'CT Scanner',       icon:'🌀', color:'#f59e0b' },
  mri:         { ar:'رنين MRI',       en:'MRI',       icon:'🧲', color:'#8b5cf6' },
  ultrasound:  { ar:'سونار',          en:'Ultrasound',          icon:'〰️', color:'#10b981' },
  laboratory:  { ar:'مختبر',          en:'Laboratory',          icon:'🔬', color:'#ef4444' },
  icu:         { ar:'عناية مركزة',   en:'ICU',   icon:'💗', color:'#ec4899' },
  surgical:    { ar:'غرفة عمليات',   en:'OR',   icon:'🏥', color:'#06b6d4' },
  vehicle:     { ar:'مركبات',         en:'Vehicles',         icon:'🚑', color:'#f97316' },
  it:          { ar:'أجهزة IT',       en:'IT Equipment',       icon:'💻', color:'#6366f1' },
  other:       { ar:'أخرى',          en:'Other', icon:'🔧', color:'#6b7280' },
  unset:       { ar:'غير محدَّد',    en:'Unset', icon:'❓', color:'#9ca3af' },
};
const STATUSES = {
  active:      { ar:'مشغّل',     en:'Active',     color:'#10b981', bg:'#d1fae5' },
  maintenance: { ar:'صيانة',     en:'Maintenance',     color:'#f59e0b', bg:'#fef3c7' },
  needsMaintenance: { ar:'يحتاج صيانة', en:'Needs Maintenance', color:'#fb923c', bg:'#ffedd5' },
  inactive:    { ar:'معطّل',     en:'Inactive',     color:'#ef4444', bg:'#fee2e2' },
  consumed:    { ar:'مستهلك',    en:'Consumed',    color:'#78350f', bg:'#fde68a' },
  retired:     { ar:'مُهمَل',    en:'Retired',    color:'#6b7280', bg:'#f3f4f6' },
  unset:       { ar:'غير محدَّد', en:'Unset', color:'#6b7280', bg:'#f3f4f6' },
};
const ASSIGNABLE_CATEGORIES = Object.entries(CATEGORIES).filter(([k]) => k !== 'unset');
const ASSIGNABLE_STATUSES = Object.entries(STATUSES).filter(([k]) => k !== 'unset');
// يجب أن تطابق UNSET_FILTER_VALUE بـ backend/routes/pgCrud.js بالضبط — قيمة
// خاصة يفهمها الخادم كـ"الحقل غائب أو فارغ" بدل تطابق تام حرفي بكلمة "unset"
// (التي لا يُخزَّن بها أي سجل حقيقي أصلاً، فتطابقها التام لن يرجع شيئاً).
const UNSET_FILTER_VALUE = '__unset__';
const CONDITIONS = {
  excellent: { ar:'ممتاز', en:'Excellent', color:'#10b981' },
  good:      { ar:'جيد',   en:'Good',   color:'#1a6bab' },
  fair:      { ar:'مقبول',en:'Fair', color:'#f59e0b' },
  poor:      { ar:'رديء',  en:'Poor',  color:'#ef4444' },
};

const EMPTY = { assetNo:'', name:'', nameEn:'', category:'other', brand:'', model:'', serial:'', purchaseDate:'', purchaseCost:0, currentValue:0, location:'', status:'active', condition:'good', warranty:'', lastMaintenance:'', nextMaintenance:'', responsiblePerson:'', notes:'' };

export default function AssetsPage() {
  const { assets, setAssets, lang, showToast, syncToServer, confirmDialog, hospitals, multiHospitalEnabled } = useApp();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => lang === 'ar' ? ar : en;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [showImport, setShowImport] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  // ── إصلاح: سجل صيانة حقيقي بدل الكتابة فوق تاريخ آخر صيانة كل مرة ────────────
  const [maintenanceAsset, setMaintenanceAsset] = useState(null); // الأصل المفتوح سجله حالياً
  const [maintenanceLog, setMaintenanceLog] = useState([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [newMaintenance, setNewMaintenance] = useState({ date: new Date().toISOString().split('T')[0], description: '', cost: '', performedBy: '' });
  const [view, setView] = useState('cards');

  // تأخير البحث 350 مللي ثانية بعد آخر حرف — يمنع إرسال طلب لكل ضغطة زر
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── الجلب المُرقَّم من السيرفر ────────────────────────────────────────────
  // نفس مبدأ صفحتي المرضى والمخزون — الجدول/البطاقات هنا تجيب فقط الصفحة
  // الحالية من الخادم. مصفوفة `assets` بالسياق العام تبقى محمَّلة كاملة
  // (تُستخدم بـ stats أدناه)، بدون علاقة بجدول هذي الصفحة تحديداً.
  const { data: pageItems, page: currentPage, setPage: setCurrentPage, total: totalItems, totalPages, loading, refetch } =
    useServerPagination('assets', { search: debouncedSearch, status: statusFilter, filters: { category: catFilter }, pageSize: 50 });

  const stats = useMemo(() => ({
    total: assets.length,
    active: assets.filter(a=>a.status==='active').length,
    maintenance: assets.filter(a=>a.status==='maintenance').length,
    totalCost: assets.reduce((s,a)=>s+(+a.purchaseCost||0),0),
    currentValue: assets.reduce((s,a)=>s+(+a.currentValue||0),0),
    dueService: assets.filter(a=>a.nextMaintenance&&new Date(a.nextMaintenance)<=new Date(Date.now()+30*24*60*60*1000)).length,
  }), [assets]);

  const openAdd = () => {
    // إصلاح: assets.length+1 يكرر رقم أصل موجود فعلاً بعد أي حذف
    const aYear = new Date().getFullYear();
    const aPrefix = `AST-${aYear}-`;
    const aMaxSeq = assets.reduce((max,a)=>{
      if (typeof a.assetNo !== 'string' || !a.assetNo.startsWith(aPrefix)) return max;
      const v = parseInt(a.assetNo.slice(aPrefix.length),10);
      return Number.isFinite(v) && v>max ? v : max;
    },0);
    const n = `${aPrefix}${String(aMaxSeq+1).padStart(3,'0')}`;
    setForm({...EMPTY, assetNo:n, purchaseDate:new Date().toISOString().split('T')[0]});
    setEditId(null); setShowModal(true);
  };
  const save = async () => {
    if (!form.name||!form.assetNo) { showToast(L('يرجى تعبئة رقم الأصل والاسم','Please fill asset number and name'),'error'); return; }
    const a = {...form, purchaseCost:+form.purchaseCost, currentValue:+form.currentValue};
    if (editId) {
      const ua = {...a,id:editId};
      const prev = assets;
      setAssets(p=>p.map(x=>x.id===editId?{...x,...ua}:x));
      const ok = await syncToServer('assets','update',ua);
      if (!ok) { setAssets(prev); return; }
      showToast(L('تم التحديث','Updated'),'success');
    } else {
      const na = {...a,id:Date.now()};
      setAssets(p=>[...p,na]);
      const ok = await syncToServer('assets','create',na);
      if (!ok) { setAssets(p=>p.filter(x=>x.id!==na.id)); return; }
      showToast(L('تمت الإضافة','Asset added'),'success');
    }
    setShowModal(false);
    refetch();
  };
  const del = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    const prev = assets;
    setAssets(p=>p.filter(a=>a.id!==id));
    const ok = await syncToServer('assets','delete',{id});
    if (!ok) { setAssets(prev); return; }
    showToast(L('تم الحذف','Deleted'),'info');
    refetch();
  };
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const ok = await syncToServer('assets', 'delete', { id });
      if (ok) { setAssets(p => p.filter(a => a.id !== id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    showToast(lang==='ar' ? `تم حذف ${deleted} من ${ids.length} أصل` : `Deleted ${deleted} of ${ids.length} assets`, deleted === ids.length ? 'success' : 'warning');
    refetch();
  };

  // ── إصلاح: سجل صيانة حقيقي بدل الكتابة فوق تاريخ آخر صيانة كل مرة ────────────
  // قبل هذا، ضغطة "انتهت الصيانة" كانت تكتب فوق lastMaintenance بس — لو الأصل
  // انصان 5 مرات، تشوفين آخر مرة بس، والأربعة قبلها تختفي نهائياً. الآن كل
  // حدث صيانة يُسجَّل بشكل مستقل بجدول asset_maintenance_log الدائم.
  const openMaintenanceLog = async (asset) => {
    setMaintenanceAsset(asset);
    setNewMaintenance({ date: new Date().toISOString().split('T')[0], description: '', cost: '', performedBy: '' });
    setMaintenanceLoading(true);
    try {
      const all = await api.get('/assetMaintenanceLog');
      const forThisAsset = (Array.isArray(all) ? all : []).filter(m => m.assetId === asset.id);
      forThisAsset.sort((a, b) => new Date(b.date) - new Date(a.date));
      setMaintenanceLog(forThisAsset);
    } catch {
      setMaintenanceLog([]);
    }
    setMaintenanceLoading(false);
  };

  const addMaintenanceEntry = async () => {
    if (!newMaintenance.description) { showToast(L('يرجى وصف الصيانة المنجَزة','Please describe the maintenance performed'),'error'); return; }
    try {
      const saved = await api.post('/assetMaintenanceLog', { ...newMaintenance, assetId: maintenanceAsset.id, cost: newMaintenance.cost ? Number(newMaintenance.cost) : null });
      setMaintenanceLog(p => [saved, ...p]);
      // نحدّث الأصل نفسه: نرجّعه "مشغّل" ونحدّث تاريخ آخر صيانة (الملخّص السريع
      // اللي يبان بالبطاقة)، مع بقاء التفاصيل الكاملة محفوظة بالسجل الدائم فوق
      const updatedAsset = { ...maintenanceAsset, status: 'active', lastMaintenance: newMaintenance.date };
      const prevAssets = assets;
      setAssets(p => p.map(x => x.id === maintenanceAsset.id ? updatedAsset : x));
      const ok = await syncToServer('assets', 'update', updatedAsset);
      if (!ok) { setAssets(prevAssets); return; }
      setMaintenanceAsset(updatedAsset);
      setNewMaintenance({ date: new Date().toISOString().split('T')[0], description: '', cost: '', performedBy: '' });
      showToast(L('تم تسجيل الصيانة','Maintenance logged'),'success');
      refetch();
    } catch (err) {
      showToast(err.message || L('فشل الحفظ','Save failed'),'error');
    }
  };

  const depr = (a) => a.purchaseCost>0 ? ((1-((Number(a.currentValue)||0)/a.purchaseCost))*100).toFixed(0)+'%' : '—';
  const n = v => (Number(v)||0).toLocaleString('en-US');
  const daysTo = (d) => { if(!d) return null; const diff=Math.ceil((new Date(d)-Date.now())/(1000*60*60*24)); return diff; };

  const S = {
    page:{padding:24,direction:dir},
    stats:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:20},
    card:(c)=>({background:'var(--bg-card)',borderRadius:12,padding:'14px 18px',borderTop:`3px solid ${c}`}),
    tb:{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'},
    inp:{padding:'8px 12px',border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:13},
    btn:(c='#1a6bab')=>({padding:'8px 16px',background:c,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}),
    aCard:{background:'var(--bg-card)',borderRadius:12,padding:18,border:'1px solid var(--border)'},
    badge:(c,bg)=>({display:'inline-block',padding:'2px 9px',borderRadius:20,fontSize:10,fontWeight:600,color:c,background:bg}),
    modal:{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999},
    mbox:{background:'var(--bg-primary)',borderRadius:16,padding:28,width:'100%',maxWidth:580,maxHeight:'90vh',overflowY:'auto',direction:dir},
    g2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12},
    fl:{display:'block',fontSize:12,color:'var(--text-secondary)',marginBottom:4},
    fi:{width:'100%',padding:'7px 10px',border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:13,boxSizing:'border-box'},
    th:{padding:'10px 12px',textAlign:dir==='rtl'?'right':'left',background:'var(--bg-tertiary)',fontSize:11,fontWeight:600,color:'var(--text-secondary)',borderBottom:'1px solid var(--border)'},
    td:{padding:'10px 12px',borderBottom:'1px solid var(--border)',fontSize:12,color:'var(--text-primary)'},
  };

  return (
    <div style={S.page}>
      <PageBanner
        icon="🏗"
        title={lang==='ar'?'الأصول والأجهزة الطبية':'Medical Assets & Equipment'}
        subtitle={lang==='ar'?'إدارة وتتبع الأصول الثابتة والأجهزة الطبية وصيانتها':'Track and manage fixed assets, medical equipment and maintenance'}
        gradient={BANNER_GRADIENT}
      >
        <button style={{ ...S.btn(), background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }} onClick={() => setShowImport(true)}>
          📊 {lang==='ar'?'استيراد من Excel':'Import from Excel'}
        </button>
        <ExcelExportButton apiName="assets" lang={lang} onError={(m) => showToast(m, 'error')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }} />
        <button style={{ ...S.btn(), background: '#fff', color: '#334155' }} onClick={openAdd}>{lang==='ar'?'+ إضافة أصل':'+ Add Asset'}</button>
      </PageBanner>

      {showImport && (
        <ExcelImportModal
          apiName="assets"
          title={lang==='ar'?'استيراد أصول من Excel':'Import Assets from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/assets');
              if (Array.isArray(fresh)) setAssets(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
            refetch();
          }}
        />
      )}

      <div style={S.stats}>
        {[[lang==='ar'?'إجمالي الأصول':'Total Assets',stats.total,'#1a6bab'],[lang==='ar'?'مشغّل':'Active',stats.active,'#10b981'],[lang==='ar'?'صيانة':'Maintenance',stats.maintenance,'#f59e0b'],[lang==='ar'?'استحقاق صيانة':'Service Due',stats.dueService,'#ef4444']].map(([l,v,c],i)=>(
          <div key={i} style={S.card(c)}><div style={{fontSize:22,fontWeight:700,color:'var(--text-primary)'}}>{n(v)}</div><div style={{fontSize:11,color:'var(--text-secondary)',marginTop:3}}>{l}</div></div>
        ))}
        <div style={S.card('#8b5cf6')}>
          <div style={{fontSize:16,fontWeight:700,color:'var(--text-primary)'}}>{n(stats.totalCost)}</div>
          <div style={{fontSize:10,color:'var(--text-secondary)',marginTop:2}}>{lang==='ar'?'التكلفة الإجمالية (د.ع)':'Total Cost (IQD)'}</div>
        </div>
        <div style={S.card('#06b6d4')}>
          <div style={{fontSize:16,fontWeight:700,color:'var(--text-primary)'}}>{n(stats.currentValue)}</div>
          <div style={{fontSize:10,color:'var(--text-secondary)',marginTop:2}}>{lang==='ar'?'القيمة الحالية (د.ع)':'Current Value (IQD)'}</div>
        </div>
      </div>

      <div style={S.tb}>
        <input style={{...S.inp,minWidth:200}} placeholder={L('🔍 بحث...','🔍 Search...')} value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={S.inp} value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
          <option value="all">{L('كل الفئات','All Categories')}</option>
          {ASSIGNABLE_CATEGORIES.map(([k,v])=><option key={k} value={k}>{v.icon} {L(v.ar,v.en)}</option>)}
          <option value={UNSET_FILTER_VALUE}>{CATEGORIES.unset.icon} {L(CATEGORIES.unset.ar,CATEGORIES.unset.en)}</option>
        </select>
        <select style={S.inp} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="all">{L('كل الحالات','All Status')}</option>
          {ASSIGNABLE_STATUSES.map(([k,v])=><option key={k} value={k}>{L(v.ar,v.en)}</option>)}
          <option value={UNSET_FILTER_VALUE}>{L(STATUSES.unset.ar,STATUSES.unset.en)}</option>
        </select>
        <div style={{marginRight:'auto',display:'flex',gap:6, alignItems:'center'}}>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)', cursor:'pointer' }}>
            <input type="checkbox" checked={pageItems.length > 0 && pageItems.every(a => selectedIds.has(a.id))} onChange={() => {
              setSelectedIds(prev => {
                const allSelected = pageItems.every(a => prev.has(a.id));
                const next = new Set(prev);
                pageItems.forEach(a => allSelected ? next.delete(a.id) : next.add(a.id));
                return next;
              });
            }} />
            {L('تحديد الكل','Select all')}
          </label>
          {[['cards',lang==='ar'?'بطاقات':'Cards'],['table',lang==='ar'?'جدول':'Table']].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:'7px 14px',borderRadius:8,border:view===v?'none':'1px solid var(--border)',background:view===v?'#1a6bab':'var(--bg-secondary)',color:view===v?'#fff':'var(--text-secondary)',cursor:'pointer',fontSize:12}}>{l}</button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, padding:'10px 16px', background:'var(--bg-secondary)', borderRadius:10, marginBottom:16 }}>
          <span style={{ fontSize:13, fontWeight:600 }}>{lang==='ar' ? `${selectedIds.size} محدَّد` : `${selectedIds.size} selected`}</span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setSelectedIds(new Set())} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>{L('إلغاء التحديد','Clear Selection')}</button>
            <button onClick={() => setBulkDeleteConfirm(true)} style={{ padding:'6px 14px', borderRadius:8, border:'none', background:'#ef4444', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600 }}>🗑️ {lang==='ar' ? `حذف المحدَّد (${selectedIds.size})` : `Delete Selected (${selectedIds.size})`}</button>
          </div>
        </div>
      )}

      {view==='cards'&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:14}}>
          {pageItems.map(a=>{
            const cat=CATEGORIES[normalizeLookupKey(a.category, CATEGORIES, 'unset')];
            const st=STATUSES[normalizeLookupKey(a.status, STATUSES, 'unset')];
            const con=CONDITIONS[a.condition]||CONDITIONS.good;
            const days=daysTo(a.nextMaintenance);
            return (
              <div key={a.id} style={{...S.aCard,borderTop:`3px solid ${cat.color}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div style={{display:'flex', gap:8}}>
                    <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} style={{ marginTop:4 }} />
                    <div>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,flexWrap:'wrap'}}>
                      <span style={{fontSize:18}}>{cat.icon}</span>
                      <code style={{fontSize:10,background:'var(--bg-tertiary)',padding:'2px 6px',borderRadius:4}}>{a.assetNo}</code>
                      <span style={S.badge(st.color,st.bg)}>{lang==='ar'?st.ar:st.en}</span>
                      <span style={{fontSize:10,fontWeight:600,color:con.color}}>● {lang==='ar'?con.ar:con.en}</span>
                    </div>
                    <h3 style={{margin:0,fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>{lang==='ar'?a.name:(a.nameEn||a.name)}</h3>
                    <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>{a.brand} {a.model}</div>
                    </div>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:11,color:'var(--text-secondary)',marginBottom:10}}>
                  <div>📍 {a.location}</div>
                  <div>👤 {a.responsiblePerson}</div>
                  <div>🔑 {a.serial||'—'}</div>
                  <div>🛡️ {L('ضمان:','Warranty:')} {a.warranty||'—'}</div>
                  <div>💰 {L('التكلفة:','Cost:')} {n(a.purchaseCost)}</div>
                  <div>📉 {L('الاستهلاك:','Depreciation:')} {depr(a)}</div>
                </div>
                {/* Maintenance bar */}
                <div style={{padding:'8px 10px',background:days!==null&&days<=30?'#fee2e2':days!==null&&days<=90?'#fef3c7':'var(--bg-tertiary)',borderRadius:8,marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:600,color:days!==null&&days<=30?'#ef4444':days!==null&&days<=90?'#f59e0b':'var(--text-secondary)'}}>
                    🔧 {L('الصيانة القادمة:','Next Service:')} {a.nextMaintenance||L('غير محدد','Not Set')}
                    {days!==null&&<span> ({days<=0?lang==='ar'?L('متأخرة!','Overdue!'):'Overdue!':days<=30?`خلال ${days} يوم`:`${days} يوم`})</span>}
                  </div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>{setForm({...a});setEditId(a.id);setShowModal(true);}} style={{...S.btn('#6b7280'),padding:'5px 10px',fontSize:11}}>{lang==='ar'?'✏️ تعديل':'✏️ Edit'}</button>
                  {a.status!=='maintenance'&&<button onClick={async ()=>{const u={...a,status:'maintenance'};const prev=assets;setAssets(p=>p.map(x=>x.id===a.id?u:x));const ok=await syncToServer('assets','update',u);if(!ok){setAssets(prev);return;}refetch();}} style={{...S.btn('#f59e0b'),padding:'5px 10px',fontSize:11}}>{lang==='ar'?'🔧 صيانة':'🔧 Maintenance'}</button>}
                  {a.status==='maintenance'&&<button onClick={()=>openMaintenanceLog(a)} style={{...S.btn('#10b981'),padding:'5px 10px',fontSize:11}}>{lang==='ar'?'✅ انتهت الصيانة':'✅ Service Done'}</button>}
                  <button onClick={()=>openMaintenanceLog(a)} style={{...S.btn('#8b5cf6'),padding:'5px 10px',fontSize:11}}>📋 {lang==='ar'?'سجل الصيانة':'History'}</button>
                  <button onClick={()=>del(a.id)} style={{...S.btn('#ef4444'),padding:'5px 10px',fontSize:11}}>{lang==='ar'?'🗑':'🗑'}</button>
                </div>
              </div>
            );
          })}
          {loading&&<div style={{gridColumn:'1/-1',textAlign:'center',padding:48,color:'var(--text-secondary)'}}>{lang==='ar'?'جاري التحميل...':'Loading...'}</div>}
          {!loading&&pageItems.length===0&&<div style={{gridColumn:'1/-1',textAlign:'center',padding:48,color:'var(--text-secondary)',background:'var(--bg-secondary)',borderRadius:12}}><div style={{fontSize:40,marginBottom:8}}>🏗</div><p>{L('لا توجد أصول','No assets found')}</p></div>}
        </div>
      )}

      {view==='table'&&(
        <table style={{width:'100%',borderCollapse:'collapse',background:'var(--bg-secondary)',borderRadius:12,overflow:'hidden'}}>
          <thead>
            <tr>
              <th style={{...S.th, width:32}}>
                <input type="checkbox" checked={pageItems.length > 0 && pageItems.every(a => selectedIds.has(a.id))} onChange={() => {
                  setSelectedIds(prev => {
                    const allSelected = pageItems.every(a => prev.has(a.id));
                    const next = new Set(prev);
                    pageItems.forEach(a => allSelected ? next.delete(a.id) : next.add(a.id));
                    return next;
                  });
                }} />
              </th>
              {(lang==='ar'?['رقم الأصل','الاسم','الفئة','الموقع','التكلفة (د.ع)','القيمة الحالية','الحالة','الصيانة القادمة','']:['Asset No','Name','Category','Location','Cost (IQD)','Current Value','Status','Next Service','']).map(h=><th key={h} style={S.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {pageItems.map(a=>{
              const cat=CATEGORIES[a.category]||CATEGORIES.other;
              const st=STATUSES[a.status]||STATUSES.active;
              const days=daysTo(a.nextMaintenance);
              return (
                <tr key={a.id}>
                  <td style={S.td}><input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} /></td>
                  <td style={S.td}><code style={{fontSize:10,background:'var(--bg-tertiary)',padding:'2px 6px',borderRadius:4}}>{a.assetNo}</code></td>
                  <td style={S.td}><div style={{fontWeight:600,fontSize:12}}>{a.name}</div><div style={{fontSize:10,color:'var(--text-secondary)'}}>{a.brand} {a.model}</div></td>
                  <td style={S.td}><span style={S.badge(cat.color,cat.color+'22')}>{cat.icon} {lang==='ar'?cat.ar:cat.en}</span></td>
                  <td style={{...S.td,fontSize:11}}>{a.location}</td>
                  <td style={{...S.td,fontSize:11}}>{n(a.purchaseCost)}</td>
                  <td style={{...S.td,fontSize:11}}>{n(a.currentValue)}</td>
                  <td style={S.td}><span style={S.badge(st.color,st.bg)}>{lang==='ar'?st.ar:st.en}</span></td>
                  <td style={S.td}><span style={{fontSize:11,color:days!==null&&days<=30?'#ef4444':days!==null&&days<=90?'#f59e0b':'var(--text-secondary)'}}>{a.nextMaintenance||'—'}{days!==null&&days<=30&&' ⚠️'}</span></td>
                  <td style={S.td}>
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>{setForm({...a});setEditId(a.id);setShowModal(true);}} style={{...S.btn('#6b7280'),padding:'3px 8px',fontSize:10}}>✏️</button>
                      <button onClick={()=>del(a.id)} style={{...S.btn('#ef4444'),padding:'3px 8px',fontSize:10}}>{lang==='ar'?'🗑':'🗑'}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />

      {bulkDeleteConfirm && (
        <div style={S.modal} onClick={() => !bulkDeleting && setBulkDeleteConfirm(false)}>
          <div style={{...S.mbox, maxWidth:420, textAlign:'center', padding:40}}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>{lang==='ar' ? `حذف ${selectedIds.size} أصل؟` : `Delete ${selectedIds.size} assets?`}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>{L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setBulkDeleteConfirm(false)} disabled={bulkDeleting} style={S.btn('#6b7280')}>{L('إلغاء','Cancel')}</button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting} style={S.btn('#ef4444')}>{bulkDeleting ? '...' : L('حذف','Delete')}</button>
            </div>
          </div>
        </div>
      )}

      {showModal&&(
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={S.mbox}>
            <h3 style={{margin:'0 0 18px',color:'var(--text-primary)'}}>{editId?L('✏️ تعديل الأصل','✏️ Edit Asset'):L('🏗 إضافة أصل جديد','🏗 Add New Asset')}</h3>
            <div style={S.g2}>
              <label>{L('رقم الأصل','Asset Number')}<input style={S.fi} value={form.assetNo||''} onChange={e=>setForm(p=>({...p,assetNo:e.target.value}))}/></label>
              {multiHospitalEnabled && (
                <label>{L('المنشأة','Facility')}<select style={S.fi} value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))}>
                  <option value="">—</option>
                  {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                </select></label>
              )}
              <label>{L('الفئة','Category')}<select style={S.fi} value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>{ASSIGNABLE_CATEGORIES.map(([k,v])=><option key={k} value={k}>{v.icon} {L(v.ar,v.en)}</option>)}</select></label>
              <label style={{gridColumn:'span 2'}}>{L('الاسم بالعربية','Name (Arabic)')}<input style={S.fi} value={form.name||''} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></label>
              <label style={{gridColumn:'span 2'}}>{L('الاسم بالإنجليزية','Name (English)')}<input style={S.fi} value={form.nameEn||''} onChange={e=>setForm(p=>({...p,nameEn:e.target.value}))}/></label>
              <label>{L('الماركة','Brand')}<input style={S.fi} value={form.brand||''} onChange={e=>setForm(p=>({...p,brand:e.target.value}))}/></label>
              <label>{L('الموديل','Model')}<input style={S.fi} value={form.model||''} onChange={e=>setForm(p=>({...p,model:e.target.value}))}/></label>
              <label>{L('الرقم التسلسلي','Serial Number')}<input style={S.fi} value={form.serial||''} onChange={e=>setForm(p=>({...p,serial:e.target.value}))}/></label>
              <label>{L('تاريخ الشراء','Purchase Date')}<input type="date" style={S.fi} value={form.purchaseDate||''} onChange={e=>setForm(p=>({...p,purchaseDate:e.target.value}))}/></label>
              <label>{L('تكلفة الشراء (د.ع)','Purchase Cost (IQD)')}<input type="number" style={S.fi} value={form.purchaseCost||0} onChange={e=>setForm(p=>({...p,purchaseCost:+e.target.value}))}/></label>
              <label><span style={S.fl}>{lang==='ar'?'القيمة الحالية (د.ع)':'Current Value (IQD)'}</span><input type="number" style={S.fi} value={form.currentValue||0} onChange={e=>setForm(p=>({...p,currentValue:+e.target.value}))}/></label>
              <label style={{gridColumn:'span 2'}}>{L('الموقع','Location')}<input style={S.fi} value={form.location||''} onChange={e=>setForm(p=>({...p,location:e.target.value}))}/></label>
              <label>{L('الحالة','Status')}<select style={S.fi} value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>{ASSIGNABLE_STATUSES.map(([k,v])=><option key={k} value={k}>{L(v.ar,v.en)}</option>)}</select></label>
              <label>{L('الحالة الفنية','Condition')}<select style={S.fi} value={form.condition} onChange={e=>setForm(p=>({...p,condition:e.target.value}))}>{Object.entries(CONDITIONS).map(([k,v])=><option key={k} value={k}>{L(v.ar,v.en)}</option>)}</select></label>
              <label>{L('انتهاء الضمان','Warranty Expiry')}<input type="date" style={S.fi} value={form.warranty||''} onChange={e=>setForm(p=>({...p,warranty:e.target.value}))}/></label>
              <label>{L('آخر صيانة','Last Service')}<input type="date" style={S.fi} value={form.lastMaintenance||''} onChange={e=>setForm(p=>({...p,lastMaintenance:e.target.value}))}/></label>
              <label>{L('الصيانة القادمة','Next Service')}<input type="date" style={S.fi} value={form.nextMaintenance||''} onChange={e=>setForm(p=>({...p,nextMaintenance:e.target.value}))}/></label>
              <label>{L('المسؤول','Responsible')}<input style={S.fi} value={form.responsiblePerson||''} onChange={e=>setForm(p=>({...p,responsiblePerson:e.target.value}))}/></label>
            </div>
            <div style={{display:'flex',gap:10,marginTop:18,justifyContent:'flex-end'}}>
              <button style={S.btn('#6b7280')} onClick={()=>setShowModal(false)}>{lang==='ar'?'إلغاء':'Cancel'}</button>
              <button style={S.btn()} onClick={save}>{lang==='ar'?'💾 حفظ':'💾 Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── نافذة سجل الصيانة (إصلاح: سجل حقيقي دائم بدل تاريخ وحيد يُستبدَل) ── */}
      {maintenanceAsset && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setMaintenanceAsset(null)}>
          <div style={{...S.mbox, maxWidth:560}}>
            <h3 style={{margin:'0 0 4px',color:'var(--text-primary)'}}>📋 {L('سجل صيانة','Maintenance History')}</h3>
            <p style={{margin:'0 0 18px',fontSize:13,color:'var(--text-secondary)'}}>{lang==='ar'?maintenanceAsset.name:(maintenanceAsset.nameEn||maintenanceAsset.name)} — {maintenanceAsset.assetNo}</p>

            {/* نموذج تسجيل صيانة جديدة */}
            <div style={{background:'var(--bg-secondary)',borderRadius:10,padding:14,marginBottom:16}}>
              <h4 style={{margin:'0 0 10px',fontSize:13}}>{L('تسجيل صيانة جديدة','Log New Maintenance')}</h4>
              <div style={S.g2}>
                <label><span style={S.fl}>{L('التاريخ','Date')}</span><input type="date" style={S.fi} value={newMaintenance.date} onChange={e=>setNewMaintenance(p=>({...p,date:e.target.value}))}/></label>
                <label><span style={S.fl}>{L('الكلفة (اختياري)','Cost (optional)')}</span><input type="number" style={S.fi} value={newMaintenance.cost} onChange={e=>setNewMaintenance(p=>({...p,cost:e.target.value}))}/></label>
                <label style={{gridColumn:'span 2'}}><span style={S.fl}>{L('وصف الصيانة المنجَزة','Description of work performed')}</span><textarea style={{...S.fi,minHeight:60,resize:'vertical'}} value={newMaintenance.description} onChange={e=>setNewMaintenance(p=>({...p,description:e.target.value}))}/></label>
                <label style={{gridColumn:'span 2'}}><span style={S.fl}>{L('الفنّي / الورشة المسؤولة','Technician / Workshop')}</span><input style={S.fi} value={newMaintenance.performedBy} onChange={e=>setNewMaintenance(p=>({...p,performedBy:e.target.value}))}/></label>
              </div>
              <button style={{...S.btn('#10b981'),marginTop:10,width:'100%'}} onClick={addMaintenanceEntry}>💾 {L('حفظ سجل الصيانة','Save Maintenance Record')}</button>
            </div>

            {/* السجل التاريخي الكامل */}
            <h4 style={{margin:'0 0 10px',fontSize:13}}>{L('السجل السابق','Previous Records')}</h4>
            {maintenanceLoading ? (
              <p style={{textAlign:'center',color:'var(--text-secondary)',padding:20}}>{L('جاري التحميل...','Loading...')}</p>
            ) : maintenanceLog.length === 0 ? (
              <p style={{textAlign:'center',color:'var(--text-secondary)',padding:20,fontSize:13}}>{L('لا يوجد سجل صيانة سابق لهذا الأصل','No previous maintenance records for this asset')}</p>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:220,overflowY:'auto'}}>
                {maintenanceLog.map(m => (
                  <div key={m.id} style={{border:'1px solid var(--border)',borderRadius:8,padding:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,fontWeight:600,marginBottom:4}}>
                      <span>{m.date}</span>
                      {m.cost && <span style={{color:'#f59e0b'}}>{Number(m.cost).toLocaleString('en-US')} {L('د.ع','IQD')}</span>}
                    </div>
                    <div style={{fontSize:12,color:'var(--text-primary)'}}>{m.description}</div>
                    {m.performedBy && <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>👤 {m.performedBy}</div>}
                  </div>
                ))}
              </div>
            )}

            <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}>
              <button style={S.btn('#6b7280')} onClick={()=>setMaintenanceAsset(null)}>{L('إغلاق','Close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

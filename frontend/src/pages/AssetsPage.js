/* eslint-disable no-unused-vars */
import React, { useState, useMemo } from 'react';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { useApp } from '../contexts/AppContext';
import ExcelImportModal from '../components/ExcelImportModal';
import { api } from '../api';

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
};
const STATUSES = {
  active:      { ar:'مشغّل',     en:'Active',     color:'#10b981', bg:'#d1fae5' },
  maintenance: { ar:'صيانة',     en:'Maintenance',     color:'#f59e0b', bg:'#fef3c7' },
  inactive:    { ar:'معطّل',     en:'Inactive',     color:'#ef4444', bg:'#fee2e2' },
  retired:     { ar:'مُهمَل',    en:'Retired',    color:'#6b7280', bg:'#f3f4f6' },
};
const CONDITIONS = {
  excellent: { ar:'ممتاز', en:'Excellent', color:'#10b981' },
  good:      { ar:'جيد',   en:'Good',   color:'#1a6bab' },
  fair:      { ar:'مقبول',en:'Fair', color:'#f59e0b' },
  poor:      { ar:'رديء',  en:'Poor',  color:'#ef4444' },
};

const EMPTY = { assetNo:'', name:'', nameEn:'', category:'other', brand:'', model:'', serial:'', purchaseDate:'', purchaseCost:0, currentValue:0, location:'', status:'active', condition:'good', warranty:'', lastMaintenance:'', nextMaintenance:'', responsiblePerson:'', notes:'' };

export default function AssetsPage() {
  const { assets, setAssets, lang, showToast, syncToServer, hospitals, multiHospitalEnabled } = useApp();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const L = (ar, en) => lang === 'ar' ? ar : en;
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [view, setView] = useState('cards');

  const filtered = useMemo(() => assets.filter(a => {
    const q = search.toLowerCase();
    return (!q || a.name.includes(q) || a.assetNo.toLowerCase().includes(q) || a.brand.toLowerCase().includes(q))
      && (catFilter === 'all' || a.category === catFilter)
      && (statusFilter === 'all' || a.status === statusFilter);
  }), [assets, search, catFilter, statusFilter]);
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filtered, 50);

  const stats = useMemo(() => ({
    total: assets.length,
    active: assets.filter(a=>a.status==='active').length,
    maintenance: assets.filter(a=>a.status==='maintenance').length,
    totalCost: assets.reduce((s,a)=>s+(+a.purchaseCost||0),0),
    currentValue: assets.reduce((s,a)=>s+(+a.currentValue||0),0),
    dueService: assets.filter(a=>a.nextMaintenance&&new Date(a.nextMaintenance)<=new Date(Date.now()+30*24*60*60*1000)).length,
  }), [assets]);

  const openAdd = () => {
    const n = `AST-${new Date().getFullYear()}-${String(assets.length+1).padStart(3,'0')}`;
    setForm({...EMPTY, assetNo:n, purchaseDate:new Date().toISOString().split('T')[0]});
    setEditId(null); setShowModal(true);
  };
  const save = () => {
    if (!form.name||!form.assetNo) { showToast(L('يرجى تعبئة رقم الأصل والاسم','Please fill asset number and name'),'error'); return; }
    const a = {...form, purchaseCost:+form.purchaseCost, currentValue:+form.currentValue};
    if (editId) {
      const ua = {...a,id:editId};
      setAssets(p=>p.map(x=>x.id===editId?{...x,...ua}:x));
      syncToServer('assets','update',ua);
      showToast(L('تم التحديث','Updated'),'success');
    } else {
      const na = {...a,id:Date.now()};
      setAssets(p=>[...p,na]);
      syncToServer('assets','create',na);
      showToast(L('تمت الإضافة','Asset added'),'success');
    }
    setShowModal(false);
  };
  const del = (id) => { setAssets(p=>p.filter(a=>a.id!==id)); syncToServer('assets','delete',{id}); showToast(L('تم الحذف','Deleted'),'info'); };

  const depr = (a) => a.purchaseCost>0 ? ((1-(a.currentValue/a.purchaseCost))*100).toFixed(0)+'%' : '—';
  const n = v => Number(v).toLocaleString(lang==='ar'?'ar-IQ':'en-US');
  const daysTo = (d) => { if(!d) return null; const diff=Math.ceil((new Date(d)-Date.now())/(1000*60*60*24)); return diff; };

  const S = {
    page:{padding:24,direction:dir},
    stats:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:20},
    card:(c)=>({background:'var(--bg-secondary)',borderRadius:12,padding:'14px 18px',borderTop:`3px solid ${c}`}),
    tb:{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'},
    inp:{padding:'8px 12px',border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:13},
    btn:(c='#1a6bab')=>({padding:'8px 16px',background:c,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}),
    aCard:{background:'var(--bg-secondary)',borderRadius:12,padding:18,border:'1px solid var(--border)'},
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
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:'var(--text-primary)',margin:0}}>{lang==='ar'?'🏗 الأصول والأجهزة الطبية':'🏗 Medical Assets & Equipment'}</h1>
          <p style={{color:'var(--text-secondary)',fontSize:13,margin:'4px 0 0'}}>{lang==='ar'?'إدارة وتتبع الأصول الثابتة والأجهزة الطبية وصيانتها':'Track and manage fixed assets, medical equipment and maintenance'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...S.btn(), background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1.5px solid var(--border)' }} onClick={() => setShowImport(true)}>
            📊 {lang==='ar'?'استيراد من Excel':'Import from Excel'}
          </button>
          <button style={S.btn()} onClick={openAdd}>{lang==='ar'?'+ إضافة أصل':'+ Add Asset'}</button>
        </div>
      </div>

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
          }}
        />
      )}

      <div style={S.stats}>
        {[[lang==='ar'?'إجمالي الأصول':'Total Assets',stats.total,'#1a6bab'],[lang==='ar'?'مشغّل':'Active',stats.active,'#10b981'],[lang==='ar'?'صيانة':'Maintenance',stats.maintenance,'#f59e0b'],[lang==='ar'?'استحقاق صيانة':'Service Due',stats.dueService,'#ef4444']].map(([l,v,c],i)=>(
          <div key={i} style={S.card(c)}><div style={{fontSize:22,fontWeight:700,color:'var(--text-primary)'}}>{v}</div><div style={{fontSize:11,color:'var(--text-secondary)',marginTop:3}}>{l}</div></div>
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
          {Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.icon} {L(v.ar,v.en)}</option>)}
        </select>
        <select style={S.inp} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="all">{L('كل الحالات','All Status')}</option>
          {Object.entries(STATUSES).map(([k,v])=><option key={k} value={k}>{L(v.ar,v.en)}</option>)}
        </select>
        <div style={{marginRight:'auto',display:'flex',gap:6}}>
          {[['cards',lang==='ar'?'بطاقات':'Cards'],['table',lang==='ar'?'جدول':'Table']].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:'7px 14px',borderRadius:8,border:view===v?'none':'1px solid var(--border)',background:view===v?'#1a6bab':'var(--bg-secondary)',color:view===v?'#fff':'var(--text-secondary)',cursor:'pointer',fontSize:12}}>{l}</button>
          ))}
        </div>
      </div>

      {view==='cards'&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:14}}>
          {pageItems.map(a=>{
            const cat=CATEGORIES[a.category]||CATEGORIES.other;
            const st=STATUSES[a.status]||STATUSES.active;
            const con=CONDITIONS[a.condition]||CONDITIONS.good;
            const days=daysTo(a.nextMaintenance);
            return (
              <div key={a.id} style={{...S.aCard,borderTop:`3px solid ${cat.color}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
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
                  {a.status!=='maintenance'&&<button onClick={()=>{const u={...a,status:'maintenance'};setAssets(p=>p.map(x=>x.id===a.id?u:x));syncToServer('assets','update',u);}} style={{...S.btn('#f59e0b'),padding:'5px 10px',fontSize:11}}>{lang==='ar'?'🔧 صيانة':'🔧 Maintenance'}</button>}
                  {a.status==='maintenance'&&<button onClick={()=>{const u={...a,status:'active',lastMaintenance:new Date().toISOString().split('T')[0]};setAssets(p=>p.map(x=>x.id===a.id?u:x));syncToServer('assets','update',u);}} style={{...S.btn('#10b981'),padding:'5px 10px',fontSize:11}}>{lang==='ar'?'✅ انتهت الصيانة':'✅ Service Done'}</button>}
                  <button onClick={()=>del(a.id)} style={{...S.btn('#ef4444'),padding:'5px 10px',fontSize:11}}>{lang==='ar'?'🗑':'🗑'}</button>
                </div>
              </div>
            );
          })}
          {filtered.length===0&&<div style={{gridColumn:'1/-1',textAlign:'center',padding:48,color:'var(--text-secondary)',background:'var(--bg-secondary)',borderRadius:12}}><div style={{fontSize:40,marginBottom:8}}>🏗</div><p>{L('لا توجد أصول','No assets found')}</p></div>}
        </div>
      )}

      {view==='table'&&(
        <table style={{width:'100%',borderCollapse:'collapse',background:'var(--bg-secondary)',borderRadius:12,overflow:'hidden'}}>
          <thead>
            <tr>{lang==='ar'?lang==='ar'?['رقم الأصل','الاسم','الفئة','الموقع','التكلفة (د.ع)','القيمة الحالية','الحالة','الصيانة القادمة','']:['Asset No','Name','Category','Location','Cost (IQD)','Value (IQD)','Status','Next Service','']:['Asset No','Name','Category','Location','Cost (IQD)','Current Value','Status','Next Service',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {pageItems.map(a=>{
              const cat=CATEGORIES[a.category]||CATEGORIES.other;
              const st=STATUSES[a.status]||STATUSES.active;
              const days=daysTo(a.nextMaintenance);
              return (
                <tr key={a.id}>
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
              <label>{L('الفئة','Category')}<select style={S.fi} value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>{Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.icon} {L(v.ar,v.en)}</option>)}</select></label>
              <label style={{gridColumn:'span 2'}}>{L('الاسم بالعربية','Name (Arabic)')}<input style={S.fi} value={form.name||''} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></label>
              <label style={{gridColumn:'span 2'}}>{L('الاسم بالإنجليزية','Name (English)')}<input style={S.fi} value={form.nameEn||''} onChange={e=>setForm(p=>({...p,nameEn:e.target.value}))}/></label>
              <label>{L('الماركة','Brand')}<input style={S.fi} value={form.brand||''} onChange={e=>setForm(p=>({...p,brand:e.target.value}))}/></label>
              <label>{L('الموديل','Model')}<input style={S.fi} value={form.model||''} onChange={e=>setForm(p=>({...p,model:e.target.value}))}/></label>
              <label>{L('الرقم التسلسلي','Serial Number')}<input style={S.fi} value={form.serial||''} onChange={e=>setForm(p=>({...p,serial:e.target.value}))}/></label>
              <label>{L('تاريخ الشراء','Purchase Date')}<input type="date" style={S.fi} value={form.purchaseDate||''} onChange={e=>setForm(p=>({...p,purchaseDate:e.target.value}))}/></label>
              <label>{L('تكلفة الشراء (د.ع)','Purchase Cost (IQD)')}<input type="number" style={S.fi} value={form.purchaseCost||0} onChange={e=>setForm(p=>({...p,purchaseCost:+e.target.value}))}/></label>
              <label><span style={S.fl}>{lang==='ar'?'القيمة الحالية (د.ع)':'Current Value (IQD)'}</span><input type="number" style={S.fi} value={form.currentValue||0} onChange={e=>setForm(p=>({...p,currentValue:+e.target.value}))}/></label>
              <label style={{gridColumn:'span 2'}}>{L('الموقع','Location')}<input style={S.fi} value={form.location||''} onChange={e=>setForm(p=>({...p,location:e.target.value}))}/></label>
              <label>{L('الحالة','Status')}<select style={S.fi} value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>{Object.entries(STATUSES).map(([k,v])=><option key={k} value={k}>{L(v.ar,v.en)}</option>)}</select></label>
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
    </div>
  );
}

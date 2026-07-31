// frontend/src/pages/hr/RetiredTab.js
// استُخرج من HRPage.js — تبويب المتقاعدين.
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { api, apiUploadFile, SERVER_BASE_URL } from '../../api';
import usePagination from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import ExcelImportModal from '../../components/ExcelImportModal';
import ExcelExportButton from '../../components/ExcelExportButton';
import DateRangeFilter from '../../components/DateRangeFilter';
import { initRetired, DOSSIER_TYPES_AR, DOSSIER_TYPES_EN, I18N, printTable, useBackendLoad } from './shared';

export default
function RetiredTab({ lang }) {
  const { showToast, syncToServer, confirmDialog, filterByViewingHospital, hospitals, multiHospitalEnabled, user } = useApp();
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const [retired, setRetired] = useState(initRetired);
  useBackendLoad('retired', setRetired);
  const visibleRetired = filterByViewingHospital(retired);
  // فلترة بتاريخ التقاعد (retireDate) افتراضياً: هو الحقل الزمني الوحيد ذو
  // المعنى الفعلي لسجل "متقاعد" (بعكس تاريخ التعيين مثلاً، الذي لا يظهر
  // أصلاً بهذا الجدول) — (field||'') لأن سجلات مستوردة قد تكون بلا تاريخ.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const filteredRetired = visibleRetired.filter(r =>
    (!dateFrom || (r.retireDate || '') >= dateFrom) && (!dateTo || (r.retireDate || '') <= dateTo)
  );
  const { pageItems: retPageItems, currentPage: retCurrentPage, setCurrentPage: setRetCurrentPage, totalPages: retTotalPages, totalItems: retTotalItems } = usePagination(filteredRetired, 50);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [viewDossier, setViewDossier] = useState(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ type: DOSSIER_TYPES_AR[0], title:'', date:'', notes:'', file:null, fileUrl:null, fileType:'' });
  // ── تحديد متعدد للحذف الجماعي ────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [retiredDossiers, setRetiredDossiers] = useState({});
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // إصلاح: نفس خلل AppContext — كان يتجاهل رد الخادم كلياً لو رجع مصفوفة
    // فاضية، فتبقى الإضابير المجمَّعة من زيارة سابقة معروضة حتى لو انحذفت
    // كلها فعلياً بقاعدة البيانات.
    api.get('/dossiers').then(data => {
      if (cancelled || !Array.isArray(data)) return;
      const grouped = {};
      data.forEach(d => { if (!d.retiredId) return; if (!grouped[d.retiredId]) grouped[d.retiredId] = []; grouped[d.retiredId].push(d); });
      setRetiredDossiers(grouped);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fileDocRef = useRef();
  const DTYPES = lang === 'en' ? DOSSIER_TYPES_EN : DOSSIER_TYPES_AR;
  const empty = { name:'', jobTitle:'', dept:'', retireDate:'', retireSalary:'', pensionNo:'', phone:'', notes:'' };
  const [form, setForm] = useState(empty);
  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    setRetired(p=>p.filter(r=>r.id!==id));
    const synced = await syncToServer('retired','delete',{id});
    showToast(L(synced ? 'deleted' : 'sync_failed'), synced ? 'success' : 'warning');
  };
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const synced = await syncToServer('retired','delete',{id});
      if (synced) { setRetired(p=>p.filter(r=>r.id!==id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    showToast(lang==='ar' ? `تم حذف ${deleted} من ${ids.length} متقاعد` : `Deleted ${deleted} of ${ids.length} retirees`, deleted === ids.length ? 'success' : 'warning');
  };
  const save = async () => {
    if (!form.name) { showToast(L('err_name'),'error'); return; }
    if (editing) {
      const ur = {...form,id:editing.id};
      setRetired(p=>p.map(r=>r.id===editing.id?ur:r));
      const synced = await syncToServer('retired','update',ur);
      showToast(L(synced ? 'saved' : 'sync_failed'), synced ? 'success' : 'warning');
    } else {
      // إصلاح: سنة ثابتة + رقم يعتمد على الطول (يتكرر بعد الحذف)
      const pYear = new Date().getFullYear();
      const pPrefix = `P-${pYear}-`;
      const pMaxSeq = retired.reduce((max,r)=>{
        if (typeof r.pensionNo !== 'string' || !r.pensionNo.startsWith(pPrefix)) return max;
        const v = parseInt(r.pensionNo.slice(pPrefix.length),10);
        return Number.isFinite(v) && v>max ? v : max;
      },0);
      const pen = `${pPrefix}${String(pMaxSeq+1).padStart(3,'0')}`;
      const nr = {...form,id:Date.now(),pensionNo:form.pensionNo||pen};
      setRetired(p=>[...p,nr]);
      const synced = await syncToServer('retired','create',nr);
      if (synced && typeof synced === 'object' && synced.id !== nr.id) {
        setRetired(p => p.map(r => r.id === nr.id ? synced : r));
      }
      showToast(L(synced ? 'added' : 'sync_failed'), synced ? 'success' : 'warning');
    }
    setShowModal(false);
  };
  const getDocs = (id) => retiredDossiers[id] || [];
  // ── إصلاح: كان يستدعي syncToServer('dossiers',...) — مسار JSON عام ما يرفع
  // أي ملف فعلياً (الملف نفسه كان يبقى blob محلي بالمتصفح، يضيع بأول تحديث
  // صفحة). الآن يستخدم /api/retired/:id/dossier (multipart/form-data حقيقي،
  // نفس المسار المُختبَر أعلاه بالباك إند) عبر apiUploadFile.
  const addDoc = async () => {
    if (!docForm.title) { showToast(L('err_doc_title'),'error'); return; }
    const id = viewDossier.id;
    try {
      const formData = { type: docForm.type, title: docForm.title, date: docForm.date, notes: docForm.notes };
      const saved = await apiUploadFile(`/retired/${id}/dossier`, docForm.file, formData);
      setRetiredDossiers(prev => ({ ...prev, [id]: [...(prev[id]||[]), saved] }));
      setDocForm({ type: DTYPES[0], title:'', date:'', notes:'', file:null, fileUrl:null, fileType:'' });
      setShowDocModal(false);
      showToast(L('doc_added'),'success');
    } catch (err) {
      showToast(err.message || L('sync_failed'), 'error');
    }
  };
  const delDoc = async (rId, dId) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    const prev = retiredDossiers;
    setRetiredDossiers(prev2 => ({ ...prev2, [rId]: (prev2[rId]||[]).filter(d=>d.id!==dId) }));
    const ok = await syncToServer('dossiers', 'delete', { id: dId });
    if (!ok) { setRetiredDossiers(prev); return; }
    showToast(L('deleted'),'success');
  };
  // إصلاح: نفس تحسين إضابير الموظفين — العنوان يُعبَّى تلقائياً من اسم الملف.
  const handleFile = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const nameWithoutExt = f.name.replace(/\.[^/.]+$/, '');
    setDocForm(p => ({ ...p, file:f, fileUrl:URL.createObjectURL(f), fileType:f.type, title: p.title || nameWithoutExt }));
  };

  if (viewDossier) {
    const docs = getDocs(viewDossier.id);
    return (
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button onClick={()=>setViewDossier(null)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'6px 14px', cursor:'pointer', color:'var(--text-primary)', fontSize:13 }}>← {L('doss_back')}</button>
          <div>
            <h3 style={{ margin:0 }}>📂 {L('doss_of')}: {viewDossier.name}</h3>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{viewDossier.pensionNo} | {viewDossier.jobTitle} | {viewDossier.dept}</div>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
          <button onClick={() => setShowDocModal(true)} className="btn btn-primary">＋ {L('add_doc')}</button>
        </div>
        {docs.length === 0 ? (
          <div className="card" style={{ textAlign:'center', padding:50, color:'var(--text-secondary)' }}><div style={{ fontSize:40, marginBottom:12 }}>📂</div><p>{L('doss_no_docs')}</p></div>
        ) : (
          <div style={{ display:'grid', gap:12 }}>
            {docs.map(doc => (
              <div key={doc.id} className="card" style={{ padding:14, display:'flex', gap:14, alignItems:'flex-start' }}>
                <div style={{ width:48, height:48, borderRadius:10, background:doc.fileType==='application/pdf'?'#fee2e2':'rgba(26,107,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{doc.filePath?(doc.fileType==='application/pdf'?'📄':'🖼️'):'📋'}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{doc.title}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>
                    <span style={{ background:'rgba(139,92,246,0.1)', color:'#8b5cf6', padding:'1px 7px', borderRadius:6, marginLeft:6 }}>{doc.type}</span>
                    {doc.date && <span>📅 {doc.date}</span>}
                  </div>
                  {doc.notes && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{doc.notes}</div>}
                  {doc.filePath && <a href={`${SERVER_BASE_URL}${doc.filePath}`} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#1a6bab', textDecoration:'none' }}>👁️ {L('doc_view')}</a>}
                </div>
                <button onClick={() => delDoc(viewDossier.id, doc.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:16 }}>🗑️</button>
              </div>
            ))}
          </div>
        )}
        {showDocModal && (
          <div className="modal-overlay" onClick={() => setShowDocModal(false)}>
            <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:460 }}>
              <div className="modal-header"><h3 style={{ margin:0 }}>{L('add_doc_title')}</h3><button onClick={()=>setShowDocModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
              <div className="modal-body"><div style={{ display:'grid', gap:12 }}>
                <div><label className="form-label">{L('doc_type')}</label><select value={docForm.type} onChange={e=>setDocForm(p=>({...p,type:e.target.value}))} className="form-control">{DTYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label className="form-label">{L('doc_title_req')}</label><input value={docForm.title} onChange={e=>setDocForm(p=>({...p,title:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{L('doc_date')}</label><input type="date" value={docForm.date} onChange={e=>setDocForm(p=>({...p,date:e.target.value}))} className="form-control" /></div>
                <div>
                  <label className="form-label">{L('doc_upload')}</label>
                  <input ref={fileDocRef} type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display:'none' }} />
                  <button onClick={() => fileDocRef.current.click()} style={{ width:'100%', padding:'12px', borderRadius:8, border:'2px dashed var(--border)', background:'var(--bg-primary)', cursor:'pointer', color:'var(--text-secondary)', fontSize:13 }}>
                    {docForm.file ? `✅ ${docForm.file.name}` : `📎 ${L('doc_upload_btn')}`}
                  </button>
                </div>
                <div><label className="form-label">{L('lbl_notes')}</label><textarea rows={2} value={docForm.notes} onChange={e=>setDocForm(p=>({...p,notes:e.target.value}))} className="form-control" /></div>
              </div></div>
              <div className="modal-footer"><button onClick={()=>setShowDocModal(false)} style={{ marginLeft:8,padding:'8px 20px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-primary)',cursor:'pointer' }}>{L('btn_cancel')}</button><button onClick={addDoc} className="btn btn-primary">{L('btn_add')}</button></div>
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <h3 style={{ margin:0 }}>{L('ret_list')} ({retTotalItems})</h3>
        <DateRangeFilter lang={lang} from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
          label={lang==='ar' ? 'تاريخ التقاعد:' : 'Retirement date:'} />
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => printTable('ret-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {L('print')}</button>
          <button onClick={() => setShowImport(true)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>📊 {lang==='ar'?'استيراد من Excel':'Import from Excel'}</button>
          <ExcelExportButton apiName="retired" lang={lang} onError={(m) => showToast(m, 'error')} />
          <button onClick={openAdd} className="btn btn-primary">＋ {L('add_ret')}</button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          apiName="retired"
          title={lang==='ar'?'استيراد متقاعدين من Excel':'Import Retired Staff from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/retired');
              if (Array.isArray(fresh)) setRetired(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
          }}
        />
      )}
      <div className="card" style={{ padding:0 }}>
        {selectedIds.size > 0 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, padding:'10px 16px', background:'var(--bg-secondary)' }}>
            <span style={{ fontSize:13, fontWeight:600 }}>{lang==='ar' ? `${selectedIds.size} محدَّد` : `${selectedIds.size} selected`}</span>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setSelectedIds(new Set())} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>{lang==='ar' ? 'إلغاء التحديد' : 'Clear Selection'}</button>
              <button onClick={() => setBulkDeleteConfirm(true)} className="btn btn-danger" style={{ fontSize:12, padding:'6px 14px' }}>🗑️ {lang==='ar' ? `حذف المحدَّد (${selectedIds.size})` : `Delete Selected (${selectedIds.size})`}</button>
            </div>
          </div>
        )}
        <table id="ret-table" className="table">
          <thead><tr>
            <th style={{width:32}}>
              <input type="checkbox" checked={retPageItems.length > 0 && retPageItems.every(r => selectedIds.has(r.id))} onChange={() => {
                setSelectedIds(prev => {
                  const allSelected = retPageItems.every(r => prev.has(r.id));
                  const next = new Set(prev);
                  retPageItems.forEach(r => allSelected ? next.delete(r.id) : next.add(r.id));
                  return next;
                });
              }} />
            </th>
            <th>{L('col_pension_no')}</th><th>{L('col_name')}</th><th>{L('col_last_pos')}</th><th>{L('col_dept')}</th><th>{L('col_retire_dt')}</th><th>{L('col_pension_sal')}</th><th>{L('lbl_phone')}</th><th>{L('col_dossier')}</th><th>{L('col_actions')}</th></tr></thead>
          <tbody>{retPageItems.map(r => (
            <tr key={r.id}>
              <td><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
              <td><span style={{ fontFamily:'monospace', background:'rgba(139,92,246,0.1)', color:'#8b5cf6', padding:'2px 8px', borderRadius:8, fontWeight:700 }}>{r.pensionNo}</span></td>
              <td style={{ fontWeight:600 }}>{lang==='ar'?r.name:r.nameEn||r.name}</td>
              <td style={{ fontSize:13 }}>{lang==='ar'?r.jobTitle:r.jobTitleEn||r.jobTitle}</td>
              <td><span style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', padding:'2px 8px', borderRadius:8, fontSize:12 }}>{lang==='ar'?r.dept:r.deptEn||r.dept}</span></td>
              <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{r.retireDate}</td>
              <td style={{ fontWeight:600, color:'#8b5cf6' }}>{(Number(r.retireSalary)||0).toLocaleString(lang==='ar'?'ar-IQ':'en-US')} {L('iqd')}</td>
              <td style={{ fontSize:12 }}>{r.phone}</td>
              <td><button onClick={() => setViewDossier(r)} style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', border:'1px solid rgba(26,107,171,0.3)', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>
                📂 {getDocs(r.id).length > 0 ? `${getDocs(r.id).length} ${L('docs_count')}` : lang==='ar'?'فتح':'Open'}
              </button></td>
              <td><div style={{ display:'flex', gap:6 }}><button onClick={()=>openEdit(r)} style={{ background:'none',border:'none',cursor:'pointer',color:'#1a6bab' }}>✏️</button><button onClick={()=>del(r.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444' }}>🗑️</button></div></td>
            </tr>
          ))}</tbody>
        </table>
        <Pagination currentPage={retCurrentPage} totalPages={retTotalPages} onPageChange={setRetCurrentPage} totalItems={retTotalItems} pageSize={50} lang={lang} />
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:500 }}>
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing ? L('edit_ret') : L('add_ret')}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
            <div className="modal-body"><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ gridColumn:'1/-1' }}><label className="form-label">{L('lbl_fullname')}</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_last_pos')}</label><input value={form.jobTitle} onChange={e=>setForm(p=>({...p,jobTitle:e.target.value}))} className="form-control" /></div>
              {multiHospitalEnabled && (
                <div><label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                  <select value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))} className="form-control">
                    <option value="">—</option>
                    {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                  </select>
                </div>
              )}
              <div><label className="form-label">{L('lbl_dept_lbl')}</label><input value={form.dept} onChange={e=>setForm(p=>({...p,dept:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_retire_dt')}</label><input type="date" value={form.retireDate} onChange={e=>setForm(p=>({...p,retireDate:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_pension_sal')}</label><input type="number" value={form.retireSalary} onChange={e=>setForm(p=>({...p,retireSalary:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_pension_no')}</label><input value={form.pensionNo} onChange={e=>setForm(p=>({...p,pensionNo:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_phone')}</label><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className="form-control" /></div>
              <div style={{ gridColumn:'1/-1' }}><label className="form-label">{L('lbl_notes')}</label><textarea rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} className="form-control" /></div>
            </div></div>
            <div className="modal-footer"><button onClick={()=>setShowModal(false)} style={{ marginLeft:8,padding:'8px 20px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-primary)',cursor:'pointer' }}>{L('btn_cancel')}</button><button onClick={save} className="btn btn-primary">{L('btn_save')}</button></div>
          </div>
        </div>
      )}

      {bulkDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !bulkDeleting && setBulkDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{lang==='ar' ? `حذف ${selectedIds.size} متقاعد؟` : `Delete ${selectedIds.size} retirees?`}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>{L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')}</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={() => setBulkDeleteConfirm(false)} disabled={bulkDeleting} style={{ padding:'8px 20px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer' }}>{L('btn_cancel')}</button>
                <button onClick={handleBulkDelete} disabled={bulkDeleting} className="btn btn-danger">{bulkDeleting ? '...' : (lang==='ar' ? 'حذف' : 'Delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

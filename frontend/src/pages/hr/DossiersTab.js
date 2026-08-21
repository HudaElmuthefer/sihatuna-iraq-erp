// frontend/src/pages/hr/DossiersTab.js
// استُخرج من HRPage.js — تبويب الإضابير الشخصية للموظفين.
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { api, apiUploadFile, SERVER_BASE_URL } from '../../api';
import { I18N, DOSSIER_TYPES_AR, DOSSIER_TYPES_EN } from './shared';


// ── DOSSIERS TAB ───────────────────────────────────────────────────────────────
// ── إصلاح جذري ────────────────────────────────────────────────────────────────
// قبل هذا: (1) "الموظفون" هنا كانوا قائمة وهمية منفصلة تُنشَأ بكتابة اسم حر
// (window.prompt) — غير مرتبطة بقائمة الموظفين الحقيقية بتبويب "الموظفون"
// إطلاقاً، ممكن تكتبين اسماً مو موجود أصلاً بالنظام. (2) كل الوثائق تُخزَّن
// بذاكرة المتصفح المؤقتة بس (useState محلي) — تُفقَد بمجرد تحديث الصفحة.
// (3) الملف المرفق نفسه كان مجرد معاينة محلية (blob URL) ما يُرفَع لأي مكان.
// الآن: تختارين من قائمة الموظفين الحقيقيين الفعليين، والوثائق تُحفَظ وتُرفَع
// فعلياً عبر /api/employees/:id/dossier (نفس المسار المُختبَر بالباك إند).
export default function DossiersTab({ lang }) {
  const { showToast, confirmDialog, syncToServer, user } = useApp();
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const [employees, setEmployees] = useState([]);
  const [docsByEmployee, setDocsByEmployee] = useState({});
  const [selected, setSelected] = useState(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const DTYPES = lang === 'en' ? DOSSIER_TYPES_EN : DOSSIER_TYPES_AR;
  const [docForm, setDocForm] = useState({ type: DTYPES[0], title:'', date:'', notes:'', file:null, fileUrl:null });
  const fileRef = useRef();

  // جلب قائمة الموظفين الحقيقيين (نفس مصدر بيانات تبويب "الموظفون")
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.get('/employees').then(data => { if (!cancelled && Array.isArray(data)) setEmployees(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDocsFor = async (empId) => {
    setSelected(empId);
    setLoadingDocs(true);
    try {
      const all = await api.get('/dossiers');
      const docs = Array.isArray(all) ? all.filter(d => d.employeeId === empId) : [];
      setDocsByEmployee(p => ({ ...p, [empId]: docs }));
    } catch {
      setDocsByEmployee(p => ({ ...p, [empId]: [] }));
    }
    setLoadingDocs(false);
  };

  const currentDocs = docsByEmployee[selected] || [];
  const currentEmployee = employees.find(e => e.id === selected);

  const addDoc = async () => {
    if (!docForm.title) { showToast(L('err_doc_title'),'error'); return; }
    try {
      const formData = { type: docForm.type, title: docForm.title, date: docForm.date, notes: docForm.notes };
      const saved = await apiUploadFile(`/employees/${selected}/dossier`, docForm.file, formData);
      setDocsByEmployee(p => ({ ...p, [selected]: [...(p[selected]||[]), saved] }));
      setDocForm({ type: DTYPES[0], title:'', date:'', notes:'', file:null, fileUrl:null });
      setShowDocModal(false);
      showToast(L('doc_added'),'success');
    } catch (err) {
      showToast(err.message || L('sync_failed'), 'error');
    }
  };
  const delDoc = async (empId, docId) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    const prev = docsByEmployee;
    setDocsByEmployee(p => ({ ...p, [empId]: (p[empId]||[]).filter(d=>d.id!==docId) }));
    const ok = await syncToServer('dossiers', 'delete', { id: docId });
    if (!ok) { setDocsByEmployee(prev); return; }
    showToast(L('doc_deleted'),'success');
  };
  // إصلاح: كان عنوان المستند يحتاج كتابة يدوية دائماً، حتى لو اسم الملف
  // المرفوع نفسه واضح تماماً. الآن يُعبَّى تلقائياً من اسم الملف (بدون
  // الامتداد) لو ما كتبتِ عنواناً مسبقاً — تقدرين تعدّلينه بعدها عادي.
  const handleFile = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const nameWithoutExt = f.name.replace(/\.[^/.]+$/, '');
    setDocForm(p => ({ ...p, file:f, fileUrl:URL.createObjectURL(f), fileType:f.type, title: p.title || nameWithoutExt }));
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20 }}>
      <div>
        <h4 style={{ margin:'0 0 10px', fontSize:14 }}>{L('dos_employees')}</h4>
        <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:500, overflowY:'auto' }}>
          {employees.map(e => (
            <button key={e.id} onClick={() => loadDocsFor(e.id)} style={{ padding:'10px 12px', borderRadius:9, border:`1px solid ${selected===e.id?'#1a6bab':'var(--border)'}`, background:selected===e.id?'rgba(26,107,171,0.1)':'var(--bg-secondary)', color:selected===e.id?'#1a6bab':'var(--text-primary)', cursor:'pointer', textAlign:lang==='ar'?'right':'left', fontSize:13, fontFamily:'inherit', fontWeight:selected===e.id?700:400 }}>
              👤 {lang==='ar'?e.name:(e.nameEn||e.name)}
              <span style={{ fontSize:11, color:'var(--text-secondary)', display:'block', marginTop:2 }}>{(docsByEmployee[e.id]||[]).length} {L('docs_count')}</span>
            </button>
          ))}
          {employees.length === 0 && <p style={{ fontSize:12, color:'var(--text-secondary)', textAlign:'center', padding:12 }}>{lang==='ar'?'لا يوجد موظفون مسجَّلون بعد — أضفهم من تبويب "الموظفون" أولاً':'No employees registered yet — add them from the "Employees" tab first'}</p>}
        </div>
      </div>
      <div>
        {!selected ? (
          <div className="card" style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-secondary)' }}><div style={{ fontSize:48, marginBottom:12 }}>📂</div><p>{L('dos_select')}</p></div>
        ) : (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ margin:0 }}>{L('dos_dossier_of')} {lang==='ar'?currentEmployee?.name:(currentEmployee?.nameEn||currentEmployee?.name)}</h3>
              <button onClick={() => setShowDocModal(true)} className="btn btn-primary">＋ {L('add_doc')}</button>
            </div>
            {loadingDocs ? (
              <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text-secondary)' }}>{lang==='ar'?'جاري التحميل...':'Loading...'}</div>
            ) : currentDocs.length === 0 ? (
              <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text-secondary)' }}>{L('dos_no_docs')}</div>
            ) : (
              <div style={{ display:'grid', gap:12 }}>
                {currentDocs.map(doc => (
                  <div key={doc.id} className="card" style={{ padding:14, display:'flex', gap:14, alignItems:'flex-start' }}>
                    <div style={{ width:48, height:48, borderRadius:10, background:doc.fileType==='application/pdf'?'#fee2e2':'rgba(26,107,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{doc.filePath?(doc.fileType==='application/pdf'?'📄':'🖼️'):'📋'}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{doc.title}</div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>
                        <span style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', padding:'1px 7px', borderRadius:6, marginLeft:6 }}>{doc.type}</span>
                        {doc.date && <span>📅 {doc.date}</span>}
                      </div>
                      {doc.notes && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{doc.notes}</div>}
                      {doc.filePath && <a href={`${SERVER_BASE_URL}${doc.filePath}`} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#1a6bab', textDecoration:'none' }}>👁️ {L('doc_view')}</a>}
                    </div>
                    <button onClick={() => delDoc(selected, doc.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:16, flexShrink:0 }}>🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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
                <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display:'none' }} />
                <button onClick={() => fileRef.current.click()} style={{ width:'100%', padding:'12px', borderRadius:8, border:'2px dashed var(--border)', background:'var(--bg-primary)', cursor:'pointer', color:'var(--text-secondary)', fontSize:13 }}>
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

// frontend/src/pages/accounts/PromotionsTab.js
// استُخرج من AccountsPage.js — تبويب الترفيعات.
import React, { useState, useEffect } from 'react';
import { useT } from '../../translations';
import { useApp } from '../../contexts/AppContext';
import usePagination from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import { today, initPromotions, gradeEn, displayValue, printTable, usePersistedTab } from './shared';
import ExcelImportModal from '../../components/ExcelImportModal';
import ExcelExportButton from '../../components/ExcelExportButton';
import { api } from '../../api';

export default
function PromotionsTab() {
  const { showToast, lang, syncToServer, confirmDialog, filterByViewingHospital, hospitals, multiHospitalEnabled, refreshNotifSources, user } = useApp();
  const tr = useT(lang);
  const [promotionsRaw, setPromotions] = usePersistedTab('acc_promotions', 'promotions', initPromotions);
  const promotions = filterByViewingHospital(promotionsRaw);
  const { pageItems: promoPageItems, currentPage: promoCurrentPage, setCurrentPage: setPromoCurrentPage, totalPages: promoTotalPages, totalItems: promoTotalItems } = usePagination(promotions, 50);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { employeeId:'', name:'', fromGrade:'', toGrade:'', date:today, salaryBefore:'', salaryAfter:'', decisionNo:'', status:'done', notes:'', pendingAccountsAction:false };
  const [form, setForm] = useState(empty);
  // ── قائمة الموظفين لربط سجل الترفيع بموظف حقيقي (employeeId) بدل الاسم
  // النصي فقط — ضروري لتحديث lastPromotion تلقائياً ولعلامة "بانتظار إجراء
  // الحسابات" (راجع save() أدناه وبند 8 من مواصفة نظام حساب الاستحقاق).
  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.get('/employees').then(data => { if (!cancelled && Array.isArray(data)) setEmployees(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);
  const pendingAction = promotions.filter(p => p.pendingAccountsAction);
  // ── تحديد متعدد للحذف الجماعي ────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const due = promotions.filter(p=>p.status==='مستحق');
  const [showImport, setShowImport] = useState(false);

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = async (id) => {
    if (!(await confirmDialog(tr('x_hlantmtakd_laimknaltraja')))) return;
    const prev = promotions;
    setPromotions(p=>p.filter(r=>r.id!==id));
    const ok = await syncToServer('promotions','delete',{id});
    if (!ok) { setPromotions(prev); return; }
    showToast(tr('msg_deleted'),'success');
  };
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const ok = await syncToServer('promotions','delete',{id});
      if (ok) { setPromotions(p=>p.filter(r=>r.id!==id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    showToast(lang==='ar' ? `تم حذف ${deleted} من ${ids.length} ترفيع` : `Deleted ${deleted} of ${ids.length} promotions`, deleted === ids.length ? 'success' : 'warning');
  };
  const save = async () => {
    if (!form.name) { showToast(tr('msg_required'),'error'); return; }
    const prev = promotions;
    // ── إصلاح ترفيعات مستحقة: إصدار/حفظ أمر ترفيع كـ"مُنجَز" لموظف مربوط
    // (employeeId) هو نقطة التسليم للحسابات — يُعلَّم السجل pendingAccountsAction
    // ليظهر بانتظار إجراء الحسابات، ويُحدَّث lastPromotion بالموظف نفسه
    // لتصفير دورة الاستحقاق (راجع hr/promotionCalc.js). هذا لا يحسب الراتب
    // تلقائياً — فقط إشارة يدوية يوضحها موظف الحسابات لاحقاً.
    const justCompleted = form.status === 'مُنجَز' && form.employeeId && !(editing && editing.status === 'مُنجَز' && editing.employeeId === form.employeeId);
    const payload = { ...form, pendingAccountsAction: justCompleted ? true : !!form.pendingAccountsAction };
    if (editing) {
      const up = {...payload,id:editing.id};
      setPromotions(p=>p.map(r=>r.id===editing.id?up:r));
      const ok = await syncToServer('promotions','update',up);
      if (!ok) { setPromotions(prev); return; }
      showToast(tr('msg_saved'),'success');
    } else {
      const np = {...payload,id:Date.now()};
      setPromotions(p=>[...p,np]);
      const synced = await syncToServer('promotions','create',np);
      if (!synced) { setPromotions(prev); return; }
      if (typeof synced === 'object' && synced.id !== np.id) {
        setPromotions(p => p.map(r => r.id === np.id ? synced : r));
      }
      showToast(tr('msg_saved'),'success');
    }
    if (justCompleted) {
      const emp = employees.find(e => String(e.id) === String(form.employeeId));
      if (emp) await syncToServer('employees','update',{...emp,lastPromotion:form.date||today});
    }
    setShowModal(false);
    refreshNotifSources();
  };
  const clearPendingAction = async (p) => {
    const up = {...p, pendingAccountsAction:false};
    setPromotions(prv=>prv.map(r=>r.id===p.id?up:r));
    await syncToServer('promotions','update',up);
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

      {pendingAction.length > 0 && (
        <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
          <div style={{ fontWeight:700, color:'#f59e0b', marginBottom:6 }}>{tr('acc_pending_salary_banner')} ({pendingAction.length})</div>
          {pendingAction.map(p=>(
            <div key={p.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13, color:'var(--text-primary)', padding:'3px 0' }}>
              <span>• {p.name} — {p.date}</span>
              <button onClick={()=>clearPendingAction(p)} style={{ padding:'3px 10px', borderRadius:6, border:'1px solid rgba(245,158,11,0.4)', background:'transparent', color:'#f59e0b', cursor:'pointer', fontSize:11 }}>{tr('acc_clear_pending_action')}</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <h3 style={{ margin:0 }}>{tr('auto_pair_4')}</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>printTable('prom-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {tr('acc_print')}</button>
          <button onClick={() => setShowImport(true)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>📊 {lang==='ar'?'استيراد من Excel':'Import from Excel'}</button>
          <ExcelExportButton apiName="promotions" lang={lang} onError={(m) => showToast(m, 'error')} />
          <button onClick={openAdd} className="btn btn-primary">+ {tr('acc_register_promotion')}</button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          apiName="promotions"
          title={lang==='ar'?'استيراد ترفيعات من Excel':'Import Promotions from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/promotions');
              if (Array.isArray(fresh)) setPromotions(fresh);
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
        <table id="prom-table" className="table">
          <thead><tr>
            <th style={{width:32}}>
              <input type="checkbox" checked={promoPageItems.length > 0 && promoPageItems.every(p => selectedIds.has(p.id))} onChange={() => {
                setSelectedIds(prev => {
                  const allSelected = promoPageItems.every(p => prev.has(p.id));
                  const next = new Set(prev);
                  promoPageItems.forEach(p => allSelected ? next.delete(p.id) : next.add(p.id));
                  return next;
                });
              }} />
            </th>
            <th>{tr('hr_emp_name')}</th><th>{tr('auto_pair_5')}</th><th>{tr('auto_pair_6')}</th><th>{tr('auto_pair_7')}</th><th>{tr('auto_pair_8')}</th><th>{tr('auto_pair_9')}</th><th>{tr('auto_pair_10')}</th><th>{tr('field_status')}</th><th>{tr('field_actions')}</th></tr></thead>
          <tbody>
            {promoPageItems.map(p=>(
              <tr key={p.id} style={{ background:p.status==='مستحق'?'rgba(26,107,171,0.04)':undefined }}>
                <td><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                <td style={{ fontWeight:600 }}>{lang==='ar'?p.name:p.nameEn||p.name}</td>
                <td style={{ fontSize:13 }}>{lang==='ar'?p.fromGrade:p.fromGradeEn||gradeEn(p.fromGrade)||p.fromGrade}</td>
                <td style={{ fontSize:13, color:'#1a6bab', fontWeight:600 }}>{lang==='ar'?p.toGrade:p.toGradeEn||gradeEn(p.toGrade)||p.toGrade||'—'}</td>
                <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{p.date||'—'}</td>
                <td style={{ fontSize:13 }}>{p.salaryBefore?Number(p.salaryBefore).toLocaleString('en-US'):'—'}</td>
                <td style={{ fontSize:13, color:'#22c55e', fontWeight:600 }}>{p.salaryAfter?Number(p.salaryAfter).toLocaleString('en-US'):'—'}</td>
                <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{p.decisionNo||'—'}</td>
                <td>
                  <span style={{ background:p.status==='done'?'#dcfce7':'rgba(26,107,171,0.1)', color:p.status==='done'?'#166534':'#1a6bab', padding:'2px 8px', borderRadius:8, fontSize:12, fontWeight:600 }}>{displayValue(p.status, tr)}</span>
                  {p.pendingAccountsAction && <span style={{ display:'block', marginTop:4, background:'rgba(245,158,11,0.1)', color:'#f59e0b', padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:600 }}>{tr('acc_pending_salary_action')}</span>}
                </td>
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
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">{tr('acc_select_employee')}</label>
                  <select value={form.employeeId||''} onChange={e=>{ const emp = employees.find(x=>String(x.id)===e.target.value); setForm(p=>({...p, employeeId:e.target.value, name: emp ? emp.name : p.name})); }} className="form-control">
                    <option value="">—</option>
                    {employees.map(emp=><option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                </div>
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

      {bulkDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !bulkDeleting && setBulkDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{lang==='ar' ? `حذف ${selectedIds.size} ترفيع؟` : `Delete ${selectedIds.size} promotions?`}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>{tr('x_hlantmtakd_laimknaltraja')}</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={() => setBulkDeleteConfirm(false)} disabled={bulkDeleting} style={{ padding:'8px 20px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer' }}>{tr('btn_cancel')}</button>
                <button onClick={handleBulkDelete} disabled={bulkDeleting} className="btn btn-danger">{bulkDeleting ? '...' : (lang==='ar' ? 'حذف' : 'Delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

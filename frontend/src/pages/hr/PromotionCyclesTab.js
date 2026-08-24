// frontend/src/pages/hr/PromotionCyclesTab.js
//
// جدول مدة دورة العلاوة/الترفيع حسب الشهادة (واختيارياً الدرجة الوظيفية) —
// راجع migrations-sql/012_promotion_cycle_system.sql وpromotionCalc.js.
// الصفوف المبذورة أولياً (isPlaceholder:true) قيم توضيحية فقط، يجب استبدالها
// بالقيم الرسمية من الموارد البشرية عبر هذه الواجهة.
import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import usePagination from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import { initPromotionCycles, I18N, printTable, useBackendLoad } from './shared';
import ExcelImportModal from '../../components/ExcelImportModal';
import ExcelExportButton from '../../components/ExcelExportButton';
import { api } from '../../api';

export default
function PromotionCyclesTab({ lang }) {
  const { showToast, syncToServer, confirmDialog } = useApp();
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const [cycles, setCycles] = useState(initPromotionCycles);
  useBackendLoad('promotionCycles', setCycles);
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(cycles, 50);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { certificate:'', certificateEn:'', grade:'', cycleYears:'', isPlaceholder:false, notes:'' };
  const [form, setForm] = useState(empty);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    setCycles(p=>p.filter(r=>r.id!==id));
    const synced = await syncToServer('promotionCycles','delete',{id});
    showToast(L(synced ? 'deleted' : 'sync_failed'), synced ? 'success' : 'warning');
  };
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const synced = await syncToServer('promotionCycles','delete',{id});
      if (synced) { setCycles(p=>p.filter(r=>r.id!==id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    showToast(lang==='ar' ? `تم حذف ${deleted} من ${ids.length} دورة` : `Deleted ${deleted} of ${ids.length} cycles`, deleted === ids.length ? 'success' : 'warning');
  };
  const save = async () => {
    if (!form.certificate?.trim() || !form.cycleYears) { showToast(L('err_cert_years'),'error'); return; }
    // أي تعديل يدوي على صف كان مبذوراً كقيمة مبدئية يعني الآن أصبح قيمة حقيقية
    // مؤكدة من المستخدم — لا يبقى معلَّماً isPlaceholder.
    const payload = { ...form, isPlaceholder: false };
    if (editing) {
      const uc = {...payload,id:editing.id};
      setCycles(p=>p.map(r=>r.id===editing.id?uc:r));
      const synced = await syncToServer('promotionCycles','update',uc);
      showToast(L(synced ? 'saved' : 'sync_failed'), synced ? 'success' : 'warning');
    } else {
      const nc = {...payload,id:Date.now()};
      setCycles(p=>[...p,nc]);
      const synced = await syncToServer('promotionCycles','create',nc);
      if (synced && typeof synced === 'object' && synced.id !== nc.id) {
        setCycles(p => p.map(r => r.id === nc.id ? synced : r));
      }
      showToast(L(synced ? 'added' : 'sync_failed'), synced ? 'success' : 'warning');
    }
    setShowModal(false);
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0 }}>{L('cycles_list')} ({totalItems})</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => printTable('cycles-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {L('print')}</button>
          <button onClick={() => setShowImport(true)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>📊 {lang==='ar'?'استيراد من Excel':'Import from Excel'}</button>
          <ExcelExportButton apiName="promotionCycles" lang={lang} onError={(m) => showToast(m, 'error')} />
          <button onClick={openAdd} className="btn btn-primary">＋ {L('add_cycle')}</button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          apiName="promotionCycles"
          title={lang==='ar'?'استيراد دورات ترفيع من Excel':'Import Promotion Cycles from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/promotionCycles');
              if (Array.isArray(fresh)) setCycles(fresh);
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
        <table id="cycles-table" className="table">
          <thead><tr>
            <th style={{width:32}}>
              <input type="checkbox" checked={pageItems.length > 0 && pageItems.every(r => selectedIds.has(r.id))} onChange={() => {
                setSelectedIds(prev => {
                  const allSelected = pageItems.every(r => prev.has(r.id));
                  const next = new Set(prev);
                  pageItems.forEach(r => allSelected ? next.delete(r.id) : next.add(r.id));
                  return next;
                });
              }} />
            </th>
            <th>{L('lbl_certificate')}</th><th>{L('col_grade_optional')}</th><th>{L('col_cycle_years')}</th><th>{L('lbl_notes')}</th><th>{L('col_actions')}</th></tr></thead>
          <tbody>{pageItems.map(r => (
            <tr key={r.id}>
              <td><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
              <td style={{ fontWeight:600 }}>
                {lang==='ar'?r.certificate:r.certificateEn||r.certificate}
                {r.isPlaceholder && <span title={L('placeholder_badge')} style={{ marginRight:6, fontSize:11, color:'#f59e0b' }}>⚠️</span>}
              </td>
              <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{r.grade || (lang==='ar' ? 'كل الدرجات' : 'All grades')}</td>
              <td style={{ fontWeight:600, textAlign:'center' }}>{r.cycleYears}</td>
              <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{r.notes||'—'}</td>
              <td><div style={{ display:'flex', gap:6 }}>
                <button onClick={() => openEdit(r)} style={{ background:'none', border:'none', cursor:'pointer', color:'#1a6bab' }}>✏️</button>
                <button onClick={() => del(r.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444' }}>🗑️</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:520 }}>
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing ? L('edit_cycle') : L('add_cycle')}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
            <div className="modal-body"><div style={{ display:'grid', gap:12 }}>
              {editing?.isPlaceholder && (
                <div style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#f59e0b' }}>{L('placeholder_badge')}</div>
              )}
              <div><label className="form-label">{L('lbl_certificate_req')}</label><input value={form.certificate} onChange={e=>setForm(p=>({...p,certificate:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_name_en')}</label><input value={form.certificateEn} onChange={e=>setForm(p=>({...p,certificateEn:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_grade_optional')}</label><input value={form.grade} onChange={e=>setForm(p=>({...p,grade:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_cycle_years_req')}</label><input type="number" min={1} value={form.cycleYears} onChange={e=>setForm(p=>({...p,cycleYears:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_notes')}</label><textarea rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} className="form-control" /></div>
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
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{lang==='ar' ? `حذف ${selectedIds.size} دورة؟` : `Delete ${selectedIds.size} cycles?`}</h3>
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

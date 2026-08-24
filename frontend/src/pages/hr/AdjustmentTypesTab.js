// frontend/src/pages/hr/AdjustmentTypesTab.js
//
// جدول أنواع التعديلات القابل للتوسيع (كتاب شكر، إجازة، عقوبة... وأي نوع
// جديد تضيفه الموارد البشرية لاحقاً) — راجع migrations-sql/012_promotion_cycle_system.sql
// وpromotionCalc.js. كل نوع يحدد فقط اتجاهه (يقدّم/يؤخّر)؛ المدة الفعلية حقل
// متغيّر بكل سجل تعديل فردي (EmployeeAdjustmentsTab.js)، وليست قيمة ثابتة هنا.
import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import usePagination from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import { initAdjustmentTypes, I18N, printTable, useBackendLoad } from './shared';
import ExcelImportModal from '../../components/ExcelImportModal';
import ExcelExportButton from '../../components/ExcelExportButton';
import { api } from '../../api';

export default
function AdjustmentTypesTab({ lang }) {
  const { showToast, syncToServer, confirmDialog } = useApp();
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const [types, setTypes] = useState(initAdjustmentTypes);
  useBackendLoad('adjustmentTypes', setTypes);
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(types, 50);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { name:'', nameEn:'', direction:'advances', notes:'' };
  const [form, setForm] = useState(empty);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    setTypes(p=>p.filter(r=>r.id!==id));
    const synced = await syncToServer('adjustmentTypes','delete',{id});
    showToast(L(synced ? 'deleted' : 'sync_failed'), synced ? 'success' : 'warning');
  };
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const synced = await syncToServer('adjustmentTypes','delete',{id});
      if (synced) { setTypes(p=>p.filter(r=>r.id!==id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    showToast(lang==='ar' ? `تم حذف ${deleted} من ${ids.length} نوع` : `Deleted ${deleted} of ${ids.length} types`, deleted === ids.length ? 'success' : 'warning');
  };
  const save = async () => {
    if (!form.name?.trim() || !form.direction) { showToast(L('err_name_direction'),'error'); return; }
    if (editing) {
      const ut = {...form,id:editing.id};
      setTypes(p=>p.map(r=>r.id===editing.id?ut:r));
      const synced = await syncToServer('adjustmentTypes','update',ut);
      showToast(L(synced ? 'saved' : 'sync_failed'), synced ? 'success' : 'warning');
    } else {
      const nt = {...form,id:Date.now()};
      setTypes(p=>[...p,nt]);
      const synced = await syncToServer('adjustmentTypes','create',nt);
      if (synced && typeof synced === 'object' && synced.id !== nt.id) {
        setTypes(p => p.map(r => r.id === nt.id ? synced : r));
      }
      showToast(L(synced ? 'added' : 'sync_failed'), synced ? 'success' : 'warning');
    }
    setShowModal(false);
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0 }}>{L('adj_types_list')} ({totalItems})</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => printTable('adj-types-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {L('print')}</button>
          <button onClick={() => setShowImport(true)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>📊 {lang==='ar'?'استيراد من Excel':'Import from Excel'}</button>
          <ExcelExportButton apiName="adjustmentTypes" lang={lang} onError={(m) => showToast(m, 'error')} />
          <button onClick={openAdd} className="btn btn-primary">＋ {L('add_adj_type')}</button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          apiName="adjustmentTypes"
          title={lang==='ar'?'استيراد أنواع تعديلات من Excel':'Import Adjustment Types from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/adjustmentTypes');
              if (Array.isArray(fresh)) setTypes(fresh);
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
        <table id="adj-types-table" className="table">
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
            <th>{L('col_name')}</th><th>{L('col_direction')}</th><th>{L('lbl_notes')}</th><th>{L('col_actions')}</th></tr></thead>
          <tbody>{pageItems.map(r => (
            <tr key={r.id}>
              <td><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
              <td style={{ fontWeight:600 }}>{lang==='ar'?r.name:r.nameEn||r.name}</td>
              <td>
                <span style={{ background: r.direction==='advances' ? '#dcfce7' : 'rgba(239,68,68,0.1)', color: r.direction==='advances' ? '#166534' : '#ef4444', padding:'2px 8px', borderRadius:8, fontSize:12, fontWeight:600 }}>
                  {r.direction==='advances' ? L('direction_advances') : r.direction==='delays' ? L('direction_delays') : r.direction}
                </span>
              </td>
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
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:480 }}>
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing ? L('edit_adj_type') : L('add_adj_type')}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
            <div className="modal-body"><div style={{ display:'grid', gap:12 }}>
              <div><label className="form-label">{L('lbl_name_ar_req')}</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_name_en')}</label><input value={form.nameEn} onChange={e=>setForm(p=>({...p,nameEn:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_direction')}</label>
                <select value={form.direction} onChange={e=>setForm(p=>({...p,direction:e.target.value}))} className="form-control">
                  <option value="advances">{L('direction_advances')}</option>
                  <option value="delays">{L('direction_delays')}</option>
                </select>
              </div>
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
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{lang==='ar' ? `حذف ${selectedIds.size} نوع؟` : `Delete ${selectedIds.size} types?`}</h3>
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

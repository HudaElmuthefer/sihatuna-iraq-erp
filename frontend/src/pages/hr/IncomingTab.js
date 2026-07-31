// frontend/src/pages/hr/IncomingTab.js
// استُخرج من HRPage.js — تبويب الكتب الواردة.
import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import usePagination from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import { initIncoming, I18N, printTable, today, useBackendLoad } from './shared';
import ExcelImportModal from '../../components/ExcelImportModal';
import ExcelExportButton from '../../components/ExcelExportButton';
import DateRangeFilter from '../../components/DateRangeFilter';
import { api } from '../../api';

export default
function IncomingTab({ lang }) {
  const { showToast, syncToServer, confirmDialog, filterByViewingHospital, hospitals, multiHospitalEnabled } = useApp();
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const [letters, setLetters] = useState(initIncoming);
  useBackendLoad('incoming', setLetters);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Fallback to '' before the range comparison: some records (e.g. bulk-
  // imported/seeded data) can have a missing date.
  const visibleIncoming = filterByViewingHospital(letters).filter(l =>
    (!dateFrom || (l.date || '') >= dateFrom) && (!dateTo || (l.date || '') <= dateTo)
  );
  const { pageItems: inPageItems, currentPage: inCurrentPage, setCurrentPage: setInCurrentPage, totalPages: inTotalPages, totalItems: inTotalItems } = usePagination(visibleIncoming, 50);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { ref:'', title:'', from:'', incomingRef:'', date:today.toISOString().split('T')[0], subject:'', status:'مُستلَم', notes:'' };
  const [form, setForm] = useState(empty);
  // ── تحديد متعدد للحذف الجماعي ────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  // إصلاح: نفس مشكلة كتب الصادر (سنة ثابتة + رقم يتكرر بعد الحذف)
  const nextRef = () => {
    const yr = new Date().getFullYear();
    const pfx = `و-${yr}-`;
    const maxSeq = letters.reduce((max,l)=>{
      if (typeof l.ref !== 'string' || !l.ref.startsWith(pfx)) return max;
      const v = parseInt(l.ref.slice(pfx.length),10);
      return Number.isFinite(v) && v>max ? v : max;
    },0);
    return `${pfx}${String(maxSeq+1).padStart(3,'0')}`;
  };
  const openAdd = () => { setEditing(null); setForm({...empty, ref: nextRef()}); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    setLetters(p=>p.filter(r=>r.id!==id));
    const synced = await syncToServer('incoming','delete',{id});
    showToast(L(synced ? 'deleted' : 'sync_failed'), synced ? 'success' : 'warning');
  };
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const synced = await syncToServer('incoming','delete',{id});
      if (synced) { setLetters(p=>p.filter(r=>r.id!==id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    showToast(lang==='ar' ? `تم حذف ${deleted} من ${ids.length} كتاب` : `Deleted ${deleted} of ${ids.length} letters`, deleted === ids.length ? 'success' : 'warning');
  };
  const save = async () => {
    if (!form.title || !form.from) { showToast(L('err_title_from'),'error'); return; }
    if (editing) {
      const ul = {...form,id:editing.id};
      setLetters(p=>p.map(r=>r.id===editing.id?ul:r));
      const synced = await syncToServer('incoming','update',ul);
      showToast(L(synced ? 'saved' : 'sync_failed'), synced ? 'success' : 'warning');
    } else {
      if (!form.ref?.trim()) { showToast(lang==='ar' ? 'رقم الكتاب مطلوب' : 'Reference number is required','error'); return; }
      const nl = {...form,id:Date.now(),ref:form.ref.trim()};
      setLetters(p=>[...p,nl]);
      const synced = await syncToServer('incoming','create',nl);
      if (synced && typeof synced === 'object' && synced.id !== nl.id) {
        setLetters(p => p.map(r => r.id === nl.id ? synced : r));
      }
      showToast(L(synced ? 'added' : 'sync_failed'), synced ? 'success' : 'warning');
    }
    setShowModal(false);
  };
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0 }}>{L('in_list')} ({inTotalItems})</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => printTable('in-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {L('print')}</button>
          <button onClick={() => setShowImport(true)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>📊 {lang==='ar'?'استيراد من Excel':'Import from Excel'}</button>
          <ExcelExportButton apiName="incoming" lang={lang} onError={(m) => showToast(m, 'error')} />
          <button onClick={openAdd} className="btn btn-primary">＋ {L('add_in')}</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '12px 16px' }}>
          <DateRangeFilter lang={lang} from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          apiName="incoming"
          title={lang==='ar'?'استيراد كتب واردة من Excel':'Import Incoming Letters from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/incoming');
              if (Array.isArray(fresh)) setLetters(fresh);
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
        <table id="in-table" className="table">
          <thead><tr>
            <th style={{width:32}}>
              <input type="checkbox" checked={inPageItems.length > 0 && inPageItems.every(l => selectedIds.has(l.id))} onChange={() => {
                setSelectedIds(prev => {
                  const allSelected = inPageItems.every(l => prev.has(l.id));
                  const next = new Set(prev);
                  inPageItems.forEach(l => allSelected ? next.delete(l.id) : next.add(l.id));
                  return next;
                });
              }} />
            </th>
            <th>{L('col_in_ref')}</th><th>{L('col_sender_ref')}</th><th>{L('col_book_title')}</th><th>{L('col_from')}</th><th>{L('col_subject')}</th><th>{L('col_date')}</th><th>{L('col_status')}</th><th>{L('col_actions')}</th></tr></thead>
          <tbody>{inPageItems.map(l => (
            <tr key={l.id}>
              <td><input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} /></td>
              <td><span style={{ fontFamily:'monospace', background:'rgba(16,185,129,0.1)', color:'#10b981', padding:'2px 8px', borderRadius:8, fontWeight:700 }}>{l.ref}</span></td>
              <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{l.incomingRef}</td>
              <td style={{ fontWeight:600 }}>{lang==='ar'?l.title:l.titleEn||l.title}</td><td>{lang==='ar'?l.from:l.fromEn||l.from}</td>
              <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{lang==='ar'?l.subject:l.subjectEn||l.subject}</td>
              <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{l.date}</td>
              <td><span style={{ background:l.status===L('col_in_received')||l.status==='مُستلَم'?'#dcfce7':'#fef9c3', color:l.status===L('col_in_received')||l.status==='مُستلَم'?'#166534':'#854d0e', padding:'2px 8px', borderRadius:8, fontSize:12 }}>{l.status==='received'?(lang==='ar'?'مُستلَم':'Received'):l.status==='review'?(lang==='ar'?'قيد المتابعة':'Under Review'):l.status}</span></td>
              <td><div style={{ display:'flex', gap:6 }}>
                <button onClick={() => openEdit(l)} style={{ background:'none',border:'none',cursor:'pointer',color:'#1a6bab' }}>✏️</button>
                <button onClick={()=>del(l.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444' }}>🗑️</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
        <Pagination currentPage={inCurrentPage} totalPages={inTotalPages} onPageChange={setInCurrentPage} totalItems={inTotalItems} pageSize={50} lang={lang} />
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:500 }}>
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing ? L('edit_in') : L('new_in')}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
            <div className="modal-body"><div style={{ display:'grid', gap:12 }}>
              {!editing && (
                <div><label className="form-label">{lang==='ar' ? 'رقم الكتاب' : 'Reference Number'}</label><input value={form.ref} onChange={e=>setForm(p=>({...p,ref:e.target.value}))} className="form-control" /></div>
              )}
              <div><label className="form-label">{L('lbl_title_req')}</label><input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} className="form-control" /></div>
                {multiHospitalEnabled && (
                  <div><label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                    <select value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))} className="form-control">
                      <option value="">—</option>
                      {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
              <div><label className="form-label">{L('lbl_from_req')}</label><input value={form.from} onChange={e=>setForm(p=>({...p,from:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_sender_ref')}</label><input value={form.incomingRef} onChange={e=>setForm(p=>({...p,incomingRef:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_subject')}</label><input value={form.subject} onChange={e=>setForm(p=>({...p,subject:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_arrive_date')}</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_status')}</label><select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} className="form-control"><option>مُستلَم</option><option>قيد المتابعة</option><option>مُنجَز</option></select></div>
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
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{lang==='ar' ? `حذف ${selectedIds.size} كتاب؟` : `Delete ${selectedIds.size} letters?`}</h3>
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

// frontend/src/pages/accounts/AllowancesTab.js
// استُخرج من AccountsPage.js — تبويب البدلات.
import React, { useState } from 'react';
import { useT } from '../../translations';
import { useApp } from '../../contexts/AppContext';
import usePagination from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import { today, initAllowances, TR_LABELS, displayValue, printTable, usePersistedTab } from './shared';

export default
function AllowancesTab() {
  const { showToast, lang, syncToServer, confirmDialog, filterByViewingHospital, hospitals, multiHospitalEnabled, refreshNotifSources } = useApp();
  const tr = useT(lang);
  const [allowancesRaw, setAllowances] = usePersistedTab('acc_allowances', 'allowances', initAllowances);
  const allowances = filterByViewingHospital(allowancesRaw);
  const { pageItems: allowPageItems, currentPage: allowCurrentPage, setCurrentPage: setAllowCurrentPage, totalPages: allowTotalPages, totalItems: allowTotalItems } = usePagination(allowances, 50);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { name:'', type:'annual', amount:'', date:today, decisionNo:'', status:'paid', notes:'' };
  const [form, setForm] = useState(empty);
  const TYPES = ['annual','risk','field','specialty','social'];
  // ── تحديد متعدد للحذف الجماعي ────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const due = allowances.filter(a=>a.status==='due');
  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = async (id) => {
    if (!(await confirmDialog(tr('x_hlantmtakd_laimknaltraja')))) return;
    const prev = allowances;
    setAllowances(p=>p.filter(a=>a.id!==id));
    const ok = await syncToServer('allowances','delete',{id});
    if (!ok) { setAllowances(prev); return; }
    showToast(tr('msg_deleted'),'success');
  };
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const ok = await syncToServer('allowances','delete',{id});
      if (ok) { setAllowances(p=>p.filter(a=>a.id!==id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    showToast(lang==='ar' ? `تم حذف ${deleted} من ${ids.length} بدل` : `Deleted ${deleted} of ${ids.length} allowances`, deleted === ids.length ? 'success' : 'warning');
  };
  const save = async () => {
    if (!form.name || !form.amount) { showToast(tr('msg_required'),'error'); return; }
    const prev = allowances;
    if (editing) {
      const ua = {...form,id:editing.id};
      setAllowances(p=>p.map(a=>a.id===editing.id?ua:a));
      const ok = await syncToServer('allowances','update',ua);
      if (!ok) { setAllowances(prev); return; }
      showToast(tr('msg_saved'),'success');
    } else {
      const na = {...form,id:Date.now()};
      setAllowances(p=>[...p,na]);
      const synced = await syncToServer('allowances','create',na);
      if (!synced) { setAllowances(prev); return; }
      if (typeof synced === 'object' && synced.id !== na.id) {
        setAllowances(p => p.map(a => a.id === na.id ? synced : a));
      }
      showToast(tr('msg_saved'),'success');
    }
    setShowModal(false);
    refreshNotifSources();
  };

  return (
    <div>
      {due.length > 0 && (
        <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
          <div style={{ fontWeight:700, color:'#f59e0b', marginBottom:6 }}>{tr('acc_due_allowances')} ({due.length})</div>
          {due.map(d=><div key={d.id} style={{ fontSize:13, padding:'3px 0' }}>• {d.name} — {d.notes}</div>)}
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <h3 style={{ margin:0 }}>{tr('auto_pair_23')}</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>printTable('allow-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {tr('acc_print')}</button>
          <button onClick={openAdd} className="btn btn-primary">+ {tr('acc_register_allowance')}</button>
        </div>
      </div>

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
        <table id="allow-table" className="table">
          <thead><tr>
            <th style={{width:32}}>
              <input type="checkbox" checked={allowPageItems.length > 0 && allowPageItems.every(a => selectedIds.has(a.id))} onChange={() => {
                setSelectedIds(prev => {
                  const allSelected = allowPageItems.every(a => prev.has(a.id));
                  const next = new Set(prev);
                  allowPageItems.forEach(a => allSelected ? next.delete(a.id) : next.add(a.id));
                  return next;
                });
              }} />
            </th>
            <th>{tr('hr_emp_name')}</th><th>{tr('auto_pair_24')}</th><th>{tr('acc_amount')} (IQD)</th><th>{tr('acc_date')}</th><th>{tr('auto_pair_25')}</th><th>{tr('field_status')}</th><th>{tr('field_notes')}</th><th>{tr('field_actions')}</th></tr></thead>
          <tbody>
            {allowPageItems.map(a=>(
              <tr key={a.id} style={{ background:a.status==='due'?'rgba(245,158,11,0.04)':undefined }}>
                <td><input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} /></td>
                <td style={{ fontWeight:600 }}>{lang==='ar'?a.name:a.nameEn||a.name}</td>
                <td><span style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', padding:'2px 8px', borderRadius:8, fontSize:12 }}>{TR_LABELS(tr)[a.type]||a.type}</span></td>
                <td style={{ fontWeight:700, color:'#22c55e' }}>{a.amount?Number(a.amount).toLocaleString(lang==='ar'?'ar-IQ':'en-US'):'—'}</td>
                <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{a.date||'—'}</td>
                <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{a.decisionNo||'—'}</td>
                <td><span style={{ background:a.status==='paid'?'#dcfce7':'rgba(245,158,11,0.1)', color:a.status==='paid'?'#166534':'#f59e0b', padding:'2px 8px', borderRadius:8, fontSize:12, fontWeight:600 }}>{displayValue(a.status, tr)}</span></td>
                <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{a.notes}</td>
                <td><div style={{ display:'flex', gap:6 }}><button onClick={()=>openEdit(a)} style={{ background:'none',border:'none',cursor:'pointer',color:'#1a6bab' }}>✏️</button><button onClick={()=>del(a.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444' }}>🗑️</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination currentPage={allowCurrentPage} totalPages={allowTotalPages} onPageChange={setAllowCurrentPage} totalItems={allowTotalItems} pageSize={50} lang={lang} />
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:480 }}>
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing?(tr('auto_pair_26')):(tr('auto_pair_27'))}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}><label className="form-label">{tr('auto_pair_28')}</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="form-control" /></div>
                {multiHospitalEnabled && (
                  <div><label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                    <select value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))} className="form-control">
                      <option value="">—</option>
                      {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
            <div><label className="form-label">{tr('auto_pair_29')}</label><select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))} className="form-control">{TYPES.map(t=><option key={t} value={t}>{displayValue(t, tr)}</option>)}</select></div>
                <div><label className="form-label">{tr('acc_amount')} (IQD) *</label><input type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('acc_date')}</label><input type="date" value={form.date||''} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('auto_pair_30')}</label><input value={form.decisionNo} onChange={e=>setForm(p=>({...p,decisionNo:e.target.value}))} className="form-control" /></div>
            <div><label className="form-label">{tr('field_status')}</label><select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} className="form-control"><option value="مُصرَف">{tr('acc_status_paid')}</option><option value="مستحقة">{tr('acc_status_due')}</option><option value="قيد المعالجة">{tr('acc_status_process')}</option></select></div>
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
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{lang==='ar' ? `حذف ${selectedIds.size} بدل؟` : `Delete ${selectedIds.size} allowances?`}</h3>
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

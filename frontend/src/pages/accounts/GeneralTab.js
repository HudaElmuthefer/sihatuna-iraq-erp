// frontend/src/pages/accounts/GeneralTab.js
// استُخرج من AccountsPage.js — تبويب المعاملات المالية العامة.
import React, { useState } from 'react';
import { useT } from '../../translations';
import { useApp } from '../../contexts/AppContext';
import usePagination from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import { today, initTransactions, ACCT_CATS, METHODS_KEYS, TR_LABELS, displayValue, printTable, usePersistedTab } from './shared';
import ExcelImportModal from '../../components/ExcelImportModal';
import ExcelExportButton from '../../components/ExcelExportButton';
import { api } from '../../api';

// Canonical transaction-type mapping. The Add/Edit form below has always
// saved English values ('income'/'expense'), but a large share of existing
// data (bulk-imported/legacy records — confirmed via a direct DB query: 175
// 'دخل' + 225 'مصروف' vs only 44 'income', and zero 'expense') uses the
// Arabic literals instead. Every place that branches on transaction type
// must recognize both spellings as the same thing, so filtering, the
// income/expense totals, and the amount color/sign all agree with each
// other and with what the row's own label displays.
const TX_TYPE_ALIASES = { income: 'income', 'دخل': 'income', expense: 'expense', 'مصروف': 'expense' };
const txType = (raw) => TX_TYPE_ALIASES[raw] || raw;

export default
function GeneralTab() {
  const { showToast, lang, syncToServer, confirmDialog, filterByViewingHospital, hospitals, multiHospitalEnabled } = useApp();
  const tr = useT(lang);
  const [txs, setTxs] = usePersistedTab('acc_transactions', 'transactions', initTransactions);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);
  // type:'income' matches the Add/Edit <select>'s actual option values below
  // (previously 'دخل', which doesn't match either <option value>  — the
  // dropdown visually showed the first option as selected regardless, but
  // the real form state stayed 'دخل' until the user touched it).
  // status:'active' — transactions has no real status workflow (no badge,
  // no dropdown anywhere in this file); every existing real transaction row
  // has status='active' with no other value ever used. This just stamps
  // the same default new rows so the real DB column (now correctly written
  // via indexedColumns, see backend/routes/modules.js) doesn't end up NULL
  // for transactions created through this form. Editing an existing record
  // already carries its real status forward via openEdit's {...r} spread.
  const empty = { date:today, desc:'', category:'revenue', type:'income', amount:'', method:'cash', ref:'', status:'active' };
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  // ── تحديد متعدد للحذف الجماعي ────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const totalIn = txs.filter(t=>txType(t.type)==='income').reduce((s,t)=>s+(Number(t.amount)||0),0);
  const totalOut = txs.filter(t=>txType(t.type)==='expense').reduce((s,t)=>s+(Number(t.amount)||0),0);
  const balance = totalIn - totalOut;

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = async (id) => {
    if (!(await confirmDialog(tr('x_hlantmtakd_laimknaltraja')))) return;
    const prev = txs;
    setTxs(p=>p.filter(t=>t.id!==id));
    const ok = await syncToServer('transactions','delete',{id});
    if (!ok) { setTxs(prev); return; }
    showToast(tr('msg_deleted'),'success');
  };
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const ok = await syncToServer('transactions','delete',{id});
      if (ok) { setTxs(p=>p.filter(t=>t.id!==id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    showToast(lang==='ar' ? `تم حذف ${deleted} من ${ids.length} معاملة` : `Deleted ${deleted} of ${ids.length} transactions`, deleted === ids.length ? 'success' : 'warning');
  };
  const save = async () => {
    if (!form.desc || !form.amount) { showToast(tr('msg_required'),'error'); return; }
    const prev = txs;
    if (editing) {
      const ut = {...form,id:editing.id};
      setTxs(p=>p.map(t=>t.id===editing.id?ut:t));
      const ok = await syncToServer('transactions','update',ut);
      if (!ok) { setTxs(prev); return; }
      showToast(tr('msg_saved'),'success');
    } else {
      const nt = {...form,id:Date.now(),ref:form.ref||`REF-${Date.now().toString().slice(-4)}`};
      setTxs(p=>[nt,...p]);
      const synced = await syncToServer('transactions','create',nt);
      if (!synced) { setTxs(prev); return; }
      if (typeof synced === 'object' && synced.id !== nt.id) {
        setTxs(p => p.map(t => t.id === nt.id ? synced : t));
      }
      showToast(tr('msg_saved'),'success');
    }
    setShowModal(false);
  };

  // Fallback to '' before calling string methods: some records (e.g. bulk-
  // imported/seeded data) can have a missing desc or ref, which would
  // otherwise throw here and crash the whole page.
  const filtered = filterByViewingHospital(txs).filter(t=>(filter==='all'||txType(t.type)===filter)&&((t.desc||'').includes(search)||(t.ref||'').includes(search)));
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(filtered, 50);

  return (
    <div>
      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
        {[
          { label:tr('acc_total_revenue'), val:totalIn, color:'#22c55e', icon:'📥' },
          { label:tr('acc_total_expenses'), val:totalOut, color:'#ef4444', icon:'📤' },
          { label:tr('acc_net_balance'), val:balance, color:balance>=0?'#1a6bab':'#ef4444', icon:'💰' },
        ].map(s=>(
          <div key={s.label} className="card" style={{ display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ width:46, height:46, borderRadius:'50%', background:`${s.color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{s.label}</div>
              <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.val.toLocaleString('en-US')} {tr('iqd')}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ display:'flex', gap:8 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr('acc_search')} className="form-control" style={{ width:200 }} />
          {/* Bug fix: this used to call setFilter(f) (the whole {k,l} object)
              and key={f} (also the object) instead of f.k — filter state
              became a non-primitive, so `filter===f.k` and `t.type===filter`
              could never match a string again after the first click, and
              clicking either filter silently showed zero results. */}
          {[{k:'all',l:tr('acc_filter_all')},{k:'income',l:tr('acc_filter_in')},{k:'expense',l:tr('acc_filter_out')}].map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)} style={{ padding:'7px 14px', borderRadius:20, border:`2px solid ${filter===f.k?'#1a6bab':'var(--border)'}`, background:filter===f.k?'#1a6bab':'transparent', color:filter===f.k?'#fff':'var(--text-primary)', cursor:'pointer', fontSize:12 }}>{f.l}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>printTable('acct-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {tr('acc_print')}</button>
          <button onClick={() => setShowImport(true)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>📊 {lang==='ar'?'استيراد من Excel':'Import from Excel'}</button>
          <ExcelExportButton apiName="transactions" lang={lang} onError={(m) => showToast(m, 'error')} />
          <button onClick={openAdd} className="btn btn-primary">+ {tr('acc_add_transaction_btn')}</button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          apiName="transactions"
          title={lang==='ar'?'استيراد معاملات مالية من Excel':'Import Transactions from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/transactions');
              if (Array.isArray(fresh)) setTxs(fresh);
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
        <div style={{ overflowX:'auto' }}>
          <table id="acct-table" className="table">
            <thead><tr>
              <th style={{width:32}}>
                <input type="checkbox" checked={pageItems.length > 0 && pageItems.every(t => selectedIds.has(t.id))} onChange={() => {
                  setSelectedIds(prev => {
                    const allSelected = pageItems.every(t => prev.has(t.id));
                    const next = new Set(prev);
                    pageItems.forEach(t => allSelected ? next.delete(t.id) : next.add(t.id));
                    return next;
                  });
                }} />
              </th>
              <th>{tr('acc_date')}</th><th>{tr('acc_ref')}</th><th>{tr('acc_description')}</th><th>{tr('acc_category')}</th><th>{tr('acc_method')}</th><th>{tr('acc_amount')}</th><th>{tr('acc_type')}</th><th>{tr('field_actions')}</th></tr></thead>
            <tbody>
              {pageItems.map(t=>(
                <tr key={t.id}>
                  <td><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} /></td>
                  <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{t.date}</td>
                  <td style={{ fontFamily:'monospace', color:'#1a6bab', fontSize:12 }}>{t.ref}</td>
                  <td style={{ fontWeight:500 }}>{lang==='ar'?t.desc:t.descEn||t.desc}</td>
                  <td><span style={{ background:'var(--bg-primary)', padding:'2px 8px', borderRadius:8, fontSize:12 }}>{TR_LABELS(tr)[t.category]||(lang==='ar'?t.category:t.categoryEn||t.category)}</span></td>
                  <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{TR_LABELS(tr)[t.method]||displayValue(t.method, tr)}</td>
                  <td style={{ fontWeight:700, color:txType(t.type)==='income'?'#22c55e':'#ef4444' }}>{txType(t.type)==='income'?'+':'-'}{(Number(t.amount)||0).toLocaleString('en-US')}</td>
                  <td><span style={{ background:txType(t.type)==='income'?'#dcfce7':'#fee2e2', color:txType(t.type)==='income'?'#166534':'#991b1b', padding:'2px 8px', borderRadius:10, fontSize:12, fontWeight:600 }}>{TR_LABELS(tr)[t.type]||displayValue(t.type, tr)}</span></td>
                  <td><div style={{ display:'flex', gap:6 }}><button onClick={()=>openEdit(t)} style={{ background:'none',border:'none',cursor:'pointer',color:'#1a6bab' }}>✏️</button><button onClick={()=>del(t.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444' }}>🗑️</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:480 }}>
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing?tr('btn_edit'):tr('acc_add_transaction')}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div><label className="form-label">{tr('acc_type')}</label><select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value,category:ACCT_CATS[e.target.value]?.[0] || ''}))} className="form-control"><option value="income">{tr('acc_income')}</option><option value="expense">{tr('acc_expense')}</option></select></div>
        <div><label className="form-label">{tr('acc_category')}</label><select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} className="form-control">{(ACCT_CATS[form.type]||[]).map(c=><option key={c} value={c}>{displayValue(c, tr)}</option>)}</select></div>
                <div style={{ gridColumn:'1/-1' }}><label className="form-label">{tr('acc_description')} *</label><input value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))} className="form-control" /></div>
                {multiHospitalEnabled && (
                  <div><label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                    <select value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))} className="form-control">
                      <option value="">—</option>
                      {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
                <div><label className="form-label">{tr('acc_amount')} (IQD) *</label><input type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} className="form-control" /></div>
        <div><label className="form-label">{tr('acc_method')}</label><select value={form.method} onChange={e=>setForm(p=>({...p,method:e.target.value}))} className="form-control">{METHODS_KEYS.map(m=><option key={m} value={m}>{displayValue(m, tr)}</option>)}</select></div>
                <div><label className="form-label">{tr('acc_date')}</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('acc_ref')}</label><input value={form.ref} onChange={e=>setForm(p=>({...p,ref:e.target.value}))} className="form-control" /></div>
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
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{lang==='ar' ? `حذف ${selectedIds.size} معاملة؟` : `Delete ${selectedIds.size} transactions?`}</h3>
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

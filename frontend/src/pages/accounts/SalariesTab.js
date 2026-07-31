// frontend/src/pages/accounts/SalariesTab.js
// استُخرج من AccountsPage.js — تبويب الرواتب.
import React, { useState } from 'react';
import { useT } from '../../translations';
import { useApp } from '../../contexts/AppContext';
import usePagination from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import { today, initSalaries, calcNet, hasBaseSalary, displayValue, gradeEn, printTable, usePersistedTab } from './shared';
import ExcelImportModal from '../../components/ExcelImportModal';
import ExcelExportButton from '../../components/ExcelExportButton';
import { api } from '../../api';

export default
function SalariesTab() {
  const { showToast, lang, syncToServer, confirmDialog, filterByViewingHospital, hospitals, multiHospitalEnabled } = useApp();
  const tr = useT(lang);
  const JOB_EN = {'طبيب اختصاص':'Specialist Physician','ممرضة أولى':'Senior Nurse','فني مختبر':'Lab Technician','سكرتيرة':'Secretary','محاسب':'Accountant','مدير':'Manager'};
  const DEPT_EN = {'الباطنية':'Internal Medicine','الجراحة':'Surgery','التحاليل':'Laboratory','الإدارة':'Administration','الأشعة':'Radiology','الطوارئ':'Emergency','الأطفال':'Pediatrics'};
  const transformedInit = initSalaries.map(e => ({
    ...e,
    jobTitleEn: e.jobTitleEn || JOB_EN[e.jobTitle] || e.jobTitle,
    deptEn: e.deptEn || DEPT_EN[e.dept] || e.dept,
  }));
  const [salariesRaw, setSalaries] = usePersistedTab('acc_salaries', 'salaries', transformedInit);
  const salaries = filterByViewingHospital(salariesRaw);
  const { pageItems: salPageItems, currentPage: salCurrentPage, setCurrentPage: setSalCurrentPage, totalPages: salTotalPages, totalItems: salTotalItems } = usePagination(salaries, 50);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const empty = { name:'', jobTitle:'', dept:'', grade:'', baseSalary:'', additions:[{label:'علاوة اجتماعية',amount:0}], deductions:[{label:'ضريبة',amount:0}], month:today.slice(0,7), status:'معلق', notes:'' };
  const [form, setForm] = useState(empty);
  // ── تحديد متعدد للحذف الجماعي ────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const totalNet = salaries.reduce((s,e) => s + calcNet(e), 0);
  const paidCount = salaries.filter(e => e.status==='مدفوع').length;

  const openAdd = () => { setEditing(null); setForm(empty); setSelected(null); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setSelected(null); setShowModal(true); };
  const openView = (r) => setSelected(selected?.id===r.id ? null : r);
  const del = async (id) => {
    if (!(await confirmDialog(tr('x_hlantmtakd_laimknaltraja')))) return;
    const prev = salaries;
    setSalaries(p=>p.filter(e=>e.id!==id));
    const ok = await syncToServer('salaries','delete',{id});
    if (!ok) { setSalaries(prev); return; }
    showToast(tr('msg_deleted'),'success');
  };
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const ok = await syncToServer('salaries','delete',{id});
      if (ok) { setSalaries(p=>p.filter(e=>e.id!==id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    showToast(lang==='ar' ? `تم حذف ${deleted} من ${ids.length} راتب` : `Deleted ${deleted} of ${ids.length} salaries`, deleted === ids.length ? 'success' : 'warning');
  };

  const addAddition = () => setForm(p => ({...p, additions:[...p.additions,{label:'',amount:0}]}));
  const addDeduction = () => setForm(p => ({...p, deductions:[...p.deductions,{label:'',amount:0}]}));

  const save = async () => {
    if (!form.name) { showToast(tr('msg_required'),'error'); return; }
    const prev = salaries;
    if (editing) {
      const ue = {...form,id:editing.id};
      setSalaries(p=>p.map(e=>e.id===editing.id?ue:e));
      const ok = await syncToServer('salaries','update',ue);
      if (!ok) { setSalaries(prev); return; }
      showToast(tr('msg_saved'),'success');
    } else {
      const ne = {...form,id:Date.now()};
      setSalaries(p=>[...p,ne]);
      const synced = await syncToServer('salaries','create',ne);
      if (!synced) { setSalaries(prev); return; }
      if (typeof synced === 'object' && synced.id !== ne.id) {
        setSalaries(p => p.map(e => e.id === ne.id ? synced : e));
      }
      showToast(tr('msg_saved'),'success');
    }
    setShowModal(false);
  };

  const statusColor = (s) => s==='مدفوع'?'#22c55e':s==='معلق'?'#f59e0b':'#ef4444';

  return (
    <div>
      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:tr('acc_total_net_salaries'), val:`${totalNet.toLocaleString('en-US')} ${tr('iqd')}`, color:'#1a6bab', icon:'💰' },
          { label:tr('acc_paid_employees'), val:`${paidCount} / ${salaries.length}`, color:'#22c55e', icon:'✅' },
          { label:tr('acc_pending_count'), val:salaries.filter(e=>e.status==='معلق').length, color:'#f59e0b', icon:'⏳' },
          { label:tr('acc_average_salary'), val:salaries.length?`${Math.round(totalNet/salaries.length).toLocaleString('en-US')} ${tr('iqd')}`:'0', color:'#8b5cf6', icon:'📊' },
        ].map((s,i) => (
          <div key={i} className="card" style={{ padding:'14px 16px', borderRight:`4px solid ${s.color}` }}>
            <div style={{ fontSize:22, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontWeight:700, fontSize:15, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <h3 style={{ margin:0 }}>{tr('acc_salary_sheet')} — {today.slice(0,7)}</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => printTable('sal-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {tr('acc_print')}</button>
          <button onClick={() => setShowImport(true)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>📊 {lang==='ar'?'استيراد من Excel':'Import from Excel'}</button>
          <ExcelExportButton apiName="salaries" lang={lang} onError={(m) => showToast(m, 'error')} />
          <button onClick={openAdd} className="btn btn-primary">+ {tr('acc_add_item')}</button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          apiName="salaries"
          title={lang==='ar'?'استيراد رواتب من Excel':'Import Salaries from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/salaries');
              if (Array.isArray(fresh)) setSalaries(fresh);
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
        <table id="sal-table" className="table">
          <thead><tr>
            <th style={{width:32}}>
              <input type="checkbox" checked={salPageItems.length > 0 && salPageItems.every(e => selectedIds.has(e.id))} onChange={() => {
                setSelectedIds(prev => {
                  const allSelected = salPageItems.every(e => prev.has(e.id));
                  const next = new Set(prev);
                  salPageItems.forEach(e => allSelected ? next.delete(e.id) : next.add(e.id));
                  return next;
                });
              }} />
            </th>
            <th>{tr('hr_emp_name')}</th><th>{tr('auto_pair_34')}</th><th>{tr('hr_emp_dept')}</th><th>{tr('auto_pair_35')}</th>
            <th>{tr('acc_base_salary')}</th><th>{tr('acc_additions')}</th><th>{tr('acc_deductions')}</th>
            <th>{tr('acc_net_salary')}</th><th>{tr('field_month')}</th><th>{tr('field_status')}</th><th>{tr('auto_pair_36')}</th><th>{tr('field_actions')}</th>
          </tr></thead>
          <tbody>
            {salPageItems.map(e => {
              const totalAdd = (e.additions||[]).reduce((s,a)=>s+(Number(a.amount)||0),0);
              const totalDed = (e.deductions||[]).reduce((s,a)=>s+(Number(a.amount)||0),0);
              const net = calcNet(e);
              return (
                <React.Fragment key={e.id}>
                  <tr>
                    <td><input type="checkbox" checked={selectedIds.has(e.id)} onChange={() => toggleSelect(e.id)} /></td>
                    <td style={{ fontWeight:600 }}>{lang==='ar'?e.name:e.nameEn||e.name}</td>
                    <td style={{ fontSize:12 }}>{lang==='ar'?e.jobTitle:e.jobTitleEn||({'طبيب اختصاص':'Specialist Physician','ممرضة أولى':'Senior Nurse','فني مختبر':'Lab Technician','سكرتيرة':'Secretary','محاسب':'Accountant','مدير':'Manager'})[e.jobTitle]||e.jobTitle}</td>
                    <td><span style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', padding:'2px 8px', borderRadius:8, fontSize:11 }}>{lang==='ar'?e.dept:e.deptEn||({'الباطنية':'Internal Medicine','الجراحة':'Surgery','التحاليل':'Laboratory','الإدارة':'Administration','الأشعة':'Radiology','الطوارئ':'Emergency','الأطفال':'Pediatrics'})[e.dept]||e.dept}</span></td>
                    <td style={{ fontSize:12 }}>{lang==='ar'?e.grade:e.gradeEn||gradeEn(e.grade)||e.grade}</td>
                    <td style={{ fontWeight:600 }}>
                      {hasBaseSalary(e) ? `${Number(e.baseSalary).toLocaleString('en-US')} ${tr('iqd')}` : (
                        <span title={lang==='ar' ? 'الراتب الأساسي غير مُدخَل لهذا السجل — يُحتسَب كصفر بالإجمالي والمتوسط أعلاه' : 'Base salary not entered for this record — counted as zero in the total/average above'} style={{ color:'#f59e0b', cursor:'help', display:'inline-flex', alignItems:'center', gap:4 }}>
                          ⚠️ {lang==='ar' ? 'غير مُدخَل' : 'Missing'}
                        </span>
                      )}
                    </td>
                    <td style={{ color:'#22c55e', fontWeight:600 }}>+{totalAdd.toLocaleString('en-US')}</td>
                    <td style={{ color:'#ef4444', fontWeight:600 }}>-{totalDed.toLocaleString('en-US')}</td>
                    <td style={{ fontWeight:700, color:'#1a6bab', fontSize:14 }}>{net.toLocaleString('en-US')} {tr('iqd')}</td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{e.month}</td>
                    <td><span style={{ background:`${statusColor(e.status)}15`, color:statusColor(e.status), padding:'3px 10px', borderRadius:8, fontSize:11, fontWeight:700 }}>{displayValue(e.status, tr)}</span></td>
                    <td>
                      <button onClick={()=>openView(e)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:11, color:'var(--text-primary)' }}>
                        {selected?.id===e.id?'▲':'▼'} {tr('acc_details')}
                      </button>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={()=>openEdit(e)} style={{ background:'none',border:'none',cursor:'pointer',color:'#1a6bab' }}>✏️</button>
                        <button onClick={()=>del(e.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                  {selected?.id===e.id && (
                    <tr>
                      <td colSpan={13} style={{ background:'var(--bg-secondary)', padding:0 }}>
                        <div style={{ padding:'16px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                          <div>
                            <h5 style={{ margin:'0 0 10px', color:'#22c55e' }}>➕ {tr('acc_additions')}</h5>
                            {(e.additions||[]).map((a,i) => (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:'rgba(34,197,94,0.08)', borderRadius:8, marginBottom:4 }}>
                                <span style={{ fontSize:13 }}>{displayValue(a.label, tr)}</span>
                                <span style={{ fontWeight:700, color:'#22c55e' }}>+{(Number(a.amount)||0).toLocaleString('en-US')} {tr('iqd')}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <h5 style={{ margin:'0 0 10px', color:'#ef4444' }}>➖ {tr('acc_deductions')}</h5>
                            {(e.deductions||[]).map((d,i) => (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:'rgba(239,68,68,0.08)', borderRadius:8, marginBottom:4 }}>
                                <span style={{ fontSize:13 }}>{displayValue(d.label, tr)}</span>
                                <span style={{ fontWeight:700, color:'#ef4444' }}>-{(Number(d.amount)||0).toLocaleString('en-US')} {tr('iqd')}</span>
                              </div>
                            ))}
                          </div>
                          {e.notes && <div style={{ gridColumn:'1/-1', fontSize:13, color:'var(--text-secondary)', padding:'8px 10px', background:'var(--bg-primary)', borderRadius:8 }}>📝 {e.notes}</div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <Pagination currentPage={salCurrentPage} totalPages={salTotalPages} onPageChange={setSalCurrentPage} totalItems={salTotalItems} pageSize={50} lang={lang} />
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:600, maxHeight:'90vh', overflow:'auto' }}>
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing?(tr('auto_pair_37')):(tr('auto_pair_38'))}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}><label className="form-label">{tr('auto_pair_39')}</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="form-control" /></div>
                {multiHospitalEnabled && (
                  <div><label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                    <select value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))} className="form-control">
                      <option value="">—</option>
                      {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
                <div><label className="form-label">{tr('auto_pair_40')}</label><input value={form.jobTitle} onChange={e=>setForm(p=>({...p,jobTitle:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('hr_emp_dept')}</label><input value={form.dept} onChange={e=>setForm(p=>({...p,dept:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('auto_pair_41')}</label><input value={form.grade} onChange={e=>setForm(p=>({...p,grade:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('acc_base_salary')}</label><input type="number" value={form.baseSalary} onChange={e=>setForm(p=>({...p,baseSalary:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('field_month')}</label><input type="month" value={form.month} onChange={e=>setForm(p=>({...p,month:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('field_status')}</label><select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} className="form-control"><option value="مدفوع">{tr('acc_status_paid')}</option><option value="معلق">{tr('acc_status_pending')}</option><option value="مرفوض">{tr('leave_status_rej2')}</option></select></div>
              </div>
              <div style={{ marginTop:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}><h4 style={{ margin:0, color:'#22c55e' }}>{tr('acc_additions')}</h4><button onClick={addAddition} style={{ background:'none', border:'1px solid #22c55e', color:'#22c55e', borderRadius:6, padding:'2px 10px', cursor:'pointer', fontSize:12 }}>+ {tr('acc_add_item')}</button></div>
                {(form.additions||[]).map((a,i)=>(
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 140px 30px', gap:8, marginBottom:8 }}>
                    <input value={a.label} onChange={e=>{const arr=[...form.additions];arr[i]={...arr[i],label:e.target.value};setForm(p=>({...p,additions:arr}));}} className="form-control" placeholder={tr('acc_search')} />
                    <input type="number" value={a.amount} onChange={e=>{const arr=[...form.additions];arr[i]={...arr[i],amount:e.target.value};setForm(p=>({...p,additions:arr}));}} className="form-control" placeholder={tr('acc_search')} />
                    <button onClick={()=>setForm(p=>({...p,additions:p.additions.filter((_,j)=>j!==i)}))} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:18 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}><h4 style={{ margin:0, color:'#ef4444' }}>{tr('acc_deductions')}</h4><button onClick={addDeduction} style={{ background:'none', border:'1px solid #ef4444', color:'#ef4444', borderRadius:6, padding:'2px 10px', cursor:'pointer', fontSize:12 }}>+ {tr('acc_add_item')}</button></div>
                {(form.deductions||[]).map((d,i)=>(
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 140px 30px', gap:8, marginBottom:8 }}>
                    <input value={d.label} onChange={e=>{const arr=[...form.deductions];arr[i]={...arr[i],label:e.target.value};setForm(p=>({...p,deductions:arr}));}} className="form-control" placeholder={tr('acc_search')} />
                    <input type="number" value={d.amount} onChange={e=>{const arr=[...form.deductions];arr[i]={...arr[i],amount:e.target.value};setForm(p=>({...p,deductions:arr}));}} className="form-control" placeholder={tr('acc_search')} />
                    <button onClick={()=>setForm(p=>({...p,deductions:p.deductions.filter((_,j)=>j!==i)}))} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:18 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:12 }}><label className="form-label">{tr('field_notes')}</label><textarea rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} className="form-control" /></div>
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
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{lang==='ar' ? `حذف ${selectedIds.size} راتب؟` : `Delete ${selectedIds.size} salaries?`}</h3>
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

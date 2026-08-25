// frontend/src/pages/hr/EmployeesTab.js
// استُخرج من HRPage.js — تبويب الموظفين.
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../api';
import useServerPagination from '../../hooks/useServerPagination';
import Pagination from '../../components/Pagination';
import ExcelImportModal from '../../components/ExcelImportModal';
import ExcelExportButton from '../../components/ExcelExportButton';
import { useBackendLoad, initEmployees, I18N, monthsAgo, monthsUntil, printTable } from './shared';
import { calcPromotionDue, calcAllowanceDue } from './promotionCalc';
import AlertBanner from './AlertBanner';
import DateRangeFilter from '../../components/DateRangeFilter';

export default
function EmployeesTab({ lang }) {
  const { showToast, syncToServer, confirmDialog, hospitals, multiHospitalEnabled } = useApp();
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const [employees, setEmployees] = useState(initEmployees);
  useBackendLoad('employees', setEmployees);

  const [empSearch, setEmpSearch] = useState('');
  const [empDebouncedSearch, setEmpDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setEmpDebouncedSearch(empSearch), 350);
    return () => clearTimeout(t);
  }, [empSearch]);
  // Date filter defaults to hireDate: it's always set for every employee,
  // unlike retirementDate (only meaningful once retirement is near/set) or
  // birthDate (not really an operational filter people search by).
  const [empDateFrom, setEmpDateFrom] = useState('');
  const [empDateTo, setEmpDateTo] = useState('');
  // ── الجلب المُرقَّم من السيرفر ────────────────────────────────────────────
  // الجدول المعروض يجيب فقط الصفحة الحالية من الخادم (بحث بالاسم يصير
  // بقاعدة البيانات). القائمة الكاملة (employees أعلاه) تبقى محمَّلة كما هي —
  // تحتاجها AlertBanner (تنبيهات العلاوة/الترفيع/التقاعد) لكل الموظفين دفعة
  // وحدة، بغض النظر عن الصفحة المعروضة حالياً بالجدول.
  const { data: empPageItems, page: empCurrentPage, setPage: setEmpCurrentPage, total: empTotalItems, totalPages: empTotalPages, refetch: refetchEmployees } =
    useServerPagination('employees', { search: empDebouncedSearch, pageSize: 50, filters: { startDate: empDateFrom, endDate: empDateTo } });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const empty = { name:'', jobTitle:'', dept:'', grade: lang==='ar'?'الأولى':'First', certificate:'', step:1, salary:'', hireDate:'', birthDate:'', phone:'', status: 'active', lastPromotion:'', lastAllowance:'', nextGrade:'', retirementDate:'', notes:'' };
  const [form, setForm] = useState(empty);
  // ── تحديد متعدد للحذف الجماعي ────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const GRADES_AR = ['الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة'];
  const GRADES_EN = ['First','Second','Third','Fourth','Fifth','Sixth','Seventh'];
  const GRADES = lang === 'en' ? GRADES_EN : GRADES_AR;
  const DEPTS_AR = ['الباطنية','الجراحة','الأطفال','التحاليل','الأشعة','النسائية','الطوارئ','الإدارة'];
  const DEPTS_EN = ['Internal','Surgery','Pediatrics','Lab','Radiology','Gynecology','Emergency','Admin'];
  const DEPTS = lang === 'en' ? DEPTS_EN : DEPTS_AR;

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = async (id) => {
    if (!(await confirmDialog(L('هل أنت متأكد؟ لا يمكن التراجع.','Are you sure? This cannot be undone.')))) return;
    setEmployees(p=>p.filter(e=>e.id!==id));
    const synced = await syncToServer('employees','delete',{id});
    showToast(L(synced ? 'deleted' : 'sync_failed'), synced ? 'success' : 'warning');
    refetchEmployees();
  };
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const synced = await syncToServer('employees','delete',{id});
      if (synced) { setEmployees(p=>p.filter(e=>e.id!==id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    showToast(lang==='ar' ? `تم حذف ${deleted} من ${ids.length} موظف` : `Deleted ${deleted} of ${ids.length} employees`, deleted === ids.length ? 'success' : 'warning');
    refetchEmployees();
  };
  const save = async () => {
    if (!form.name || !form.jobTitle) { showToast(L('err_name_job'),'error'); return; }
    if (editing) {
      const ue = {...form,id:editing.id};
      setEmployees(p=>p.map(e=>e.id===editing.id?ue:e));
      const synced = await syncToServer('employees','update',ue);
      showToast(L(synced ? 'saved' : 'sync_failed'), synced ? 'success' : 'warning');
    } else {
      const ne = {...form,id:Date.now()};
      setEmployees(p=>[...p,ne]);
      const synced = await syncToServer('employees','create',ne);
      // تصحيح المعرّف المحلي المؤقت بالمعرّف الحقيقي الصادر من PostgreSQL —
      // ضروري لأن هذا الموديول لا يمر عبر SYNCED_MODULES (حالته محلية بالكامل)
      if (synced && typeof synced === 'object' && synced.id !== ne.id) {
        setEmployees(p => p.map(e => e.id === ne.id ? synced : e));
      }
      showToast(L(synced ? 'added' : 'sync_failed'), synced ? 'success' : 'warning');
    }
    setShowModal(false);
    refetchEmployees();
  };
  const statusColor = (s) => ({ 'active':'#22c55e', 'leave':'#f59e0b', 'inactive':'#ef4444', 'نشط':'#22c55e', 'إجازة':'#f59e0b', 'متوقف':'#ef4444' }[s]||'#6b7280');

  // ── سحب-للتمرير الأفقي — نفس الحل المُطبَّق بـ accounts/PromotionsAllowancesTab.js
  // (راجعه لتفاصيل السبب): .table-wrapper وحده لا يكفي لجدول بهذا العرض (16
  // عموداً) — يحتاج min-width صريح على <table> ليكتشف المتصفح التجاوز الأفقي
  // أصلاً، وبما أن banner التنبيهات (AlertBanner) يدفع الجدول بعيداً للأسفل،
  // شريط التمرير الأفقي الفعلي (أسفل صندوق .table-wrapper) يبقى بعيد المنال
  // بلا تمرير الصفحة كاملة. السحب بالفأرة من أي نقطة بالجدول (عدا العناصر
  // التفاعلية) يحل هذا دون الحاجة لبلوغ الشريط نفسه إطلاقاً. preventDefault +
  // userSelect:none متزامنَين بـ mousedown يمنعان تحديد النص الافتراضي من
  // المتصفح، وعكس إشارة dx بحالة RTL ضروري لأن مدى scrollLeft الصالح بكروم
  // بـ RTL سالب (0 إلى -(scrollWidth-clientWidth))، عكس LTR تماماً.
  const wrapperRef = useRef(null);
  const dragRef = useRef({ dragging:false, startX:0, startScrollLeft:0, moved:false });
  const [isDragging, setIsDragging] = useState(false);
  const onWrapperMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, a, input, select, textarea')) return;
    e.preventDefault();
    wrapperRef.current.style.userSelect = 'none';
    const isRTL = getComputedStyle(wrapperRef.current).direction === 'rtl';
    const maxScroll = wrapperRef.current.scrollWidth - wrapperRef.current.clientWidth;
    const min = isRTL ? -maxScroll : 0;
    const max = isRTL ? 0 : maxScroll;
    dragRef.current = { dragging:true, startX:e.clientX, startScrollLeft:wrapperRef.current.scrollLeft, moved:false };
    const onMove = (ev) => {
      if (!dragRef.current.dragging) return;
      const dx = ev.clientX - dragRef.current.startX;
      if (Math.abs(dx) > 4) { dragRef.current.moved = true; setIsDragging(true); }
      const next = dragRef.current.startScrollLeft + (isRTL ? dx : -dx);
      wrapperRef.current.scrollLeft = Math.max(min, Math.min(max, next));
      ev.preventDefault();
    };
    const onUp = () => {
      dragRef.current.dragging = false;
      setIsDragging(false);
      if (wrapperRef.current) wrapperRef.current.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div>
      <AlertBanner employees={employees} lang={lang} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <h3 style={{ margin:0 }}>{L('emp_list')} ({empTotalItems})</h3>
        <input
          type="text"
          placeholder={lang==='ar' ? '🔍 بحث بالاسم...' : '🔍 Search by name...'}
          value={empSearch}
          onChange={e => setEmpSearch(e.target.value)}
          style={{ padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-primary)', color:'var(--text-primary)', minWidth:200 }}
        />
        <DateRangeFilter lang={lang} from={empDateFrom} to={empDateTo} onChange={(f, t) => { setEmpDateFrom(f); setEmpDateTo(t); }}
          label={lang==='ar' ? 'تاريخ التعيين:' : 'Hire date:'} />
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => printTable('emp-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {L('print')}</button>
          <button onClick={() => setShowImport(true)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>📊 {lang==='ar'?'استيراد من Excel':'Import from Excel'}</button>
          <ExcelExportButton apiName="employees" lang={lang} onError={(m) => showToast(m, 'error')} />
          <button onClick={openAdd} className="btn btn-primary">＋ {L('add_emp')}</button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          apiName="employees"
          title={lang==='ar'?'استيراد موظفين من Excel':'Import Employees from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/employees');
              if (Array.isArray(fresh)) setEmployees(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
            refetchEmployees();
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
        <div
          ref={wrapperRef}
          className="table-wrapper"
          onMouseDown={onWrapperMouseDown}
          style={{ cursor: isDragging ? 'grabbing' : 'grab', userSelect: isDragging ? 'none' : 'auto' }}
        >
          {/* min-width: 16 عموداً (خانة تحديد + اسم/وظيفة/قسم/درجة/شهادة/راتب/
              تعيين/آخر ترفيع/آخر علاوة/استحقاق ترفيع/استحقاق علاوة/الدرجة
              القادمة/تقاعد/حالة/إجراءات) — نفس حساب PromotionsAllowancesTab.js
              (~105px متوسط لكل عمود) مُقاساً بعدد أعمدة أقل هنا (16 مقابل 18). */}
          <table id="emp-table" className="table" style={{ minWidth: 1700 }}>
            <thead><tr>
              <th style={{width:32}}>
                <input type="checkbox" checked={empPageItems.length > 0 && empPageItems.every(e => selectedIds.has(e.id))} onChange={() => {
                  setSelectedIds(prev => {
                    const allSelected = empPageItems.every(e => prev.has(e.id));
                    const next = new Set(prev);
                    empPageItems.forEach(e => allSelected ? next.delete(e.id) : next.add(e.id));
                    return next;
                  });
                }} />
              </th>
              <th>{L('col_name')}</th><th>{L('col_title')}</th><th>{L('col_dept')}</th><th>{L('col_grade')}</th><th>{L('lbl_certificate')}</th>
              <th>{L('col_salary')}</th><th>{L('col_hire')}</th><th>{L('col_last_promo')}</th><th>{L('col_last_allow')}</th>
              <th>{L('col_due_promo')}</th><th>{L('col_due_allow')}</th><th>{L('col_next_grade')}</th>
              <th>{L('col_retire_date')}</th><th>{L('col_status')}</th><th>{L('col_actions')}</th>
            </tr></thead>
            <tbody>
              {empPageItems.map(e => {
                const retireAlert = monthsUntil(e.retirementDate) <= 12 && monthsUntil(e.retirementDate) >= 0;
                const allowAlert = monthsAgo(e.lastAllowance) >= 12;
                const promAlert  = monthsAgo(e.lastPromotion) >= 24;
                const promoDue = calcPromotionDue(e);
                const allowDue = calcAllowanceDue(e);
                return (
                  <tr key={e.id} style={{ background: retireAlert ? 'rgba(239,68,68,0.05)' : undefined }}>
                    <td><input type="checkbox" checked={selectedIds.has(e.id)} onChange={() => toggleSelect(e.id)} /></td>
                    <td style={{ fontWeight:600 }}>{lang==='ar'?e.name:e.nameEn||e.name}{retireAlert && <span title={L('alert_retire')} style={{ marginRight:4 }}>🔴</span>}</td>
                    <td style={{ fontSize:13 }}>{lang==='ar'?e.jobTitle:e.jobTitleEn||e.jobTitle}</td>
                    <td><span style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', padding:'2px 8px', borderRadius:8, fontSize:12 }}>{lang==='ar'?e.dept:e.deptEn||e.dept}</span></td>
                    <td style={{ fontSize:13, direction:'ltr', textAlign:'center' }}>{lang==='ar'?e.grade:e.gradeEn||e.grade} / {e.step}</td>
                    <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{e.certificate||'—'}</td>
                    <td style={{ fontWeight:600, color:'#22c55e' }}>{Number(e.salary).toLocaleString('en-US')} {L('iqd')}</td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{e.hireDate}</td>
                    <td style={{ fontSize:12, color: promAlert ? '#1a6bab' : 'var(--text-secondary)' }}>{e.lastPromotion}{promAlert && <span> ⬆️</span>}</td>
                    <td style={{ fontSize:12, color: allowAlert ? '#f59e0b' : 'var(--text-secondary)' }}>{e.lastAllowance}{allowAlert && <span> 💰</span>}</td>
                    <td style={{ fontSize:12, color: promoDue.available && promoDue.overdue ? '#ef4444' : promoDue.available && promoDue.daysUntil <= 30 ? '#1a6bab' : 'var(--text-secondary)', fontWeight: promoDue.available && promoDue.overdue ? 700 : 400 }}>
                      {promoDue.available ? promoDue.dueDate : '—'}
                    </td>
                    <td style={{ fontSize:12, color: allowDue.available && allowDue.overdue ? '#ef4444' : allowDue.available && allowDue.daysUntil <= 30 ? '#f59e0b' : 'var(--text-secondary)', fontWeight: allowDue.available && allowDue.overdue ? 700 : 400 }}>
                      {allowDue.available ? allowDue.dueDate : '—'}
                    </td>
                    <td style={{ fontSize:13, color:'#1a6bab', fontWeight:600 }}>{e.nextGrade || '—'}</td>
                    <td style={{ fontSize:12, color: retireAlert ? '#ef4444' : 'var(--text-secondary)', fontWeight: retireAlert ? 700 : 400 }}>{e.retirementDate}</td>
                    <td><span style={{ background:`${statusColor(e.status)}15`, color:statusColor(e.status), padding:'2px 8px', borderRadius:8, fontSize:12, fontWeight:600 }}>{e.status==='active'?L('status_active'):e.status==='leave'?L('status_leave'):e.status==='inactive'?L('status_inactive'):e.status}</span></td>
                    <td><div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => openEdit(e)} style={{ background:'none', border:'none', cursor:'pointer', color:'#1a6bab' }}>✏️</button>
                      <button onClick={() => del(e.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444' }}>🗑️</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={empCurrentPage} totalPages={empTotalPages} onPageChange={setEmpCurrentPage} totalItems={empTotalItems} pageSize={50} lang={lang} />
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:600 }}>
            <div className="modal-header">
              <h3 style={{ margin:0 }}>{editing ? L('edit_emp') : L('add_emp')}</h3>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}><label className="form-label">{L('lbl_fullname')}</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{L('lbl_job')}</label><input value={form.jobTitle} onChange={e=>setForm(p=>({...p,jobTitle:e.target.value}))} className="form-control" /></div>
                {multiHospitalEnabled && (
                  <div><label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                    <select value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))} className="form-control">
                      <option value="">—</option>
                      {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
                <div><label className="form-label">{L('lbl_dept_lbl')}</label><select value={form.dept} onChange={e=>setForm(p=>({...p,dept:e.target.value}))} className="form-control"><option value="">{L('choose')}</option>{DEPTS.map(d=><option key={d}>{d}</option>)}</select></div>
                <div><label className="form-label">{L('lbl_grade')}</label><select value={form.grade} onChange={e=>setForm(p=>({...p,grade:e.target.value}))} className="form-control">{GRADES.map(g=><option key={g}>{g}</option>)}</select></div>
                <div><label className="form-label">{L('lbl_step')}</label><input type="number" min={1} max={12} value={form.step} onChange={e=>setForm(p=>({...p,step:e.target.value}))} className="form-control" /></div>
                <div>
                  <label className="form-label">{L('lbl_certificate')}</label>
                  <input value={form.certificate} onChange={e=>setForm(p=>({...p,certificate:e.target.value}))} className="form-control" />
                </div>
                <div><label className="form-label">{L('lbl_salary_iq')}</label><input type="number" value={form.salary} onChange={e=>setForm(p=>({...p,salary:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{L('lbl_phone')}</label><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{L('lbl_birth')}</label><input type="date" value={form.birthDate} onChange={e=>setForm(p=>({...p,birthDate:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{L('lbl_hire_date')}</label><input type="date" value={form.hireDate} onChange={e=>setForm(p=>({...p,hireDate:e.target.value}))} className="form-control" /></div>
                <div>
                  <label className="form-label">{L('lbl_last_promo')}</label>
                  <input type="date" value={form.lastPromotion} onChange={e=>setForm(p=>({...p,lastPromotion:e.target.value}))} className="form-control" />
                  {(() => { const d = calcPromotionDue(form); return d.available ? <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>{L('col_due_promo')}: {d.dueDate}</div> : null; })()}
                </div>
                <div>
                  <label className="form-label">{L('lbl_last_allow')}</label>
                  <input type="date" value={form.lastAllowance} onChange={e=>setForm(p=>({...p,lastAllowance:e.target.value}))} className="form-control" />
                  {(() => { const d = calcAllowanceDue(form); return d.available ? <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>{L('col_due_allow')}: {d.dueDate}</div> : null; })()}
                </div>
                <div><label className="form-label">{L('lbl_next_grade')}</label><input value={form.nextGrade} onChange={e=>setForm(p=>({...p,nextGrade:e.target.value}))} placeholder="الرابعة/4" className="form-control" /></div>
                <div><label className="form-label">{L('lbl_est_retire')}</label><input type="date" value={form.retirementDate} onChange={e=>setForm(p=>({...p,retirementDate:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{L('lbl_status')}</label>
                  <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} className="form-control">
                    <option value="active">{L('status_active')}</option><option value="leave">{L('status_leave')}</option><option value="inactive">{L('status_inactive')}</option>
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}><label className="form-label">{L('lbl_notes')}</label><textarea rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} className="form-control" /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} style={{ marginLeft:8, padding:'8px 20px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer' }}>{L('btn_cancel')}</button>
              <button onClick={save} className="btn btn-primary">{L('btn_save')}</button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !bulkDeleting && setBulkDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{lang==='ar' ? `حذف ${selectedIds.size} موظف؟` : `Delete ${selectedIds.size} employees?`}</h3>
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

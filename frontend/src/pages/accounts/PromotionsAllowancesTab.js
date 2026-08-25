// frontend/src/pages/accounts/PromotionsAllowancesTab.js
//
// سجل الترفيعات والعلاوات المُوحَّد — يدمج تبويبي "الترفيعات" و"العلاوات"
// السابقين (كل واحد بجدول/تبويب منفصل) بجدول واحد: كل سجل قد يمثّل حدث
// ترفيع و/أو حدث علاوة لموظف واحد معاً، بجانبين مستقلّين تماماً (كل جانب
// برقم/تاريخ قرار وحالة خاصة به)، بدل حقل "رقم القرار" الواحد المشترك
// سابقاً. راجع migrations-sql/014_merge_promotions_allowances.sql لتفاصيل
// الترحيل من الجدولين القديمين.
import React, { useState, useEffect, useRef } from 'react';
import { useT } from '../../translations';
import { useApp } from '../../contexts/AppContext';
import usePagination from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import { today, initPromotionsAllowances, gradeEn, TR_LABELS, displayValue, printTable, usePersistedTab } from './shared';
import ExcelImportModal from '../../components/ExcelImportModal';
import ExcelExportButton from '../../components/ExcelExportButton';
import { api } from '../../api';

const ALLOWANCE_TYPES = ['annual','risk','field','specialty','social'];

export default
function PromotionsAllowancesTab() {
  const { showToast, lang, syncToServer, confirmDialog, filterByViewingHospital, hospitals, multiHospitalEnabled, refreshNotifSources, user } = useApp();
  const tr = useT(lang);
  const [recordsRaw, setRecords] = usePersistedTab('acc_promotions_allowances', 'promotionsAllowances', initPromotionsAllowances);
  const records = filterByViewingHospital(recordsRaw);
  const { pageItems, currentPage, setCurrentPage, totalPages, totalItems } = usePagination(records, 50);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = {
    employeeId:'', name:'',
    fromGrade:'', toGrade:'', promotionDate:today, salaryBefore:'', salaryAfter:'',
    promotionDecisionNo:'', promotionDecisionDate:'', promotionStatus:'',
    promotionPendingAccountsAction:false,
    allowanceType:'annual', amount:'', allowanceDate:today,
    allowanceDecisionNo:'', allowanceDecisionDate:'', allowanceStatus:'',
    allowancePendingAccountsAction:false,
    notes:'',
  };
  const [form, setForm] = useState(empty);
  // ── قائمة الموظفين لربط السجل بموظف حقيقي (employeeId) — تحدّث
  // lastPromotion/lastAllowance تلقائياً عند إنجاز كل جانب (راجع save() أدناه).
  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.get('/employees').then(data => { if (!cancelled && Array.isArray(data)) setEmployees(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const promoDue = records.filter(r => r.promotionStatus === 'مستحق');
  const allowDue = records.filter(r => r.allowanceStatus === 'مستحقة');
  const promoPending = records.filter(r => r.promotionPendingAccountsAction);
  const allowPending = records.filter(r => r.allowancePendingAccountsAction);

  // ── تحديد متعدد للحذف الجماعي ────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [showImport, setShowImport] = useState(false);

  // ── سحب-للتمرير الأفقي — الجدول واسع جداً (18 عموداً) وbanner التنبيهات
  // أعلى الصفحة يدفع .table-wrapper بعيداً للأسفل، فشريط التمرير الأفقي
  // الفعلي (أسفل صندوق .table-wrapper الطويل خاصته max-height:65vh) يبقى
  // بعيد المنال بلا تمرير الصفحة كاملة للوصول له. الحل: تمكين السحب بالفأرة
  // (Drag-to-Pan) في أي مكان بمنطقة الجدول (عدا العناصر التفاعلية كالأزرار
  // وصناديق التحديد) لتمرير الأعمدة أفقياً دون الحاجة لبلوغ الشريط نفسه إطلاقاً
  // — بالإضافة لدعم المتصفح الأصلي لـ Shift+عجلة الفأرة على أي صندوق overflow-x.
  const wrapperRef = useRef(null);
  const dragRef = useRef({ dragging:false, startX:0, startScrollLeft:0, moved:false });
  const [isDragging, setIsDragging] = useState(false);
  const onWrapperMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, a, input, select, textarea')) return;
    // preventDefault هنا (لا فقط بـ onMove) ضروري — بدونه يبدأ المتصفح تحديد
    // النص أصلاً من لحظة الضغط، وبما أن React state (isDragging) لا يُحدِّث
    // الـ DOM إلا بعد إعادة رسم لاحقة، يفوت التحديد الأصلي فرصة الإيقاف قبل
    // أن userSelect:none يصل فعلياً — فيُلغى هذا كلياً هنا بشكل متزامن بدل الاعتماد
    // على إعادة الرسم.
    e.preventDefault();
    wrapperRef.current.style.userSelect = 'none';
    // اتجاه الصفحة RTL — في كروم يكون المدى الصالح لـ scrollLeft هنا بين 0
    // (أقصى اليمين) و -(scrollWidth-clientWidth) (أقصى اليسار)، عكس LTR
    // تماماً. أي قيمة موجبة تُرفَض/تُقصّ صامتة (scrollLeft يبقى 0 بلا أي أثر
    // ظاهر) — هذا بالضبط سبب عدم تحرّك الجدول رغم عمل المعالج نفسه بشكل
    // صحيح. نعكس إشارة dx حسب الاتجاه الفعلي بدل افتراض LTR دائماً.
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

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...empty, ...r}); setShowModal(true); };
  const del = async (id) => {
    if (!(await confirmDialog(tr('x_hlantmtakd_laimknaltraja')))) return;
    const prev = recordsRaw;
    setRecords(p=>p.filter(r=>r.id!==id));
    const ok = await syncToServer('promotionsAllowances','delete',{id});
    if (!ok) { setRecords(prev); return; }
    showToast(tr('msg_deleted'),'success');
  };
  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of ids) {
      const ok = await syncToServer('promotionsAllowances','delete',{id});
      if (ok) { setRecords(p=>p.filter(r=>r.id!==id)); deleted++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    showToast(lang==='ar' ? `تم حذف ${deleted} من ${ids.length} سجل` : `Deleted ${deleted} of ${ids.length} records`, deleted === ids.length ? 'success' : 'warning');
  };
  const save = async () => {
    if (!form.name) { showToast(tr('msg_required'),'error'); return; }
    const prev = recordsRaw;
    // ── إصدار/إنجاز أي من الجانبين (ترفيع أو علاوة) لموظف مربوط هو نقطة
    // التسليم للحسابات لذلك الجانب تحديداً — كل جانب يُعلَّم ويُحدَّث بشكل
    // مستقل تماماً عن الآخر (سجل واحد قد يكون فيه ترفيع مُنجَز وعلاوة لم
        // تُصرَف بعد، أو العكس).
    const justCompletedPromotion = form.promotionStatus === 'مُنجَز' && form.employeeId && !(editing && editing.promotionStatus === 'مُنجَز' && editing.employeeId === form.employeeId);
    const justPaidAllowance = form.allowanceStatus === 'مدفوع' && form.employeeId && !(editing && editing.allowanceStatus === 'مدفوع' && editing.employeeId === form.employeeId);
    const payload = {
      ...form,
      promotionPendingAccountsAction: justCompletedPromotion ? true : !!form.promotionPendingAccountsAction,
      allowancePendingAccountsAction: justPaidAllowance ? true : !!form.allowancePendingAccountsAction,
    };
    if (editing) {
      const up = {...payload,id:editing.id};
      setRecords(p=>p.map(r=>r.id===editing.id?up:r));
      const ok = await syncToServer('promotionsAllowances','update',up);
      if (!ok) { setRecords(prev); return; }
      showToast(tr('msg_saved'),'success');
    } else {
      const np = {...payload,id:Date.now()};
      setRecords(p=>[...p,np]);
      const synced = await syncToServer('promotionsAllowances','create',np);
      if (!synced) { setRecords(prev); return; }
      if (typeof synced === 'object' && synced.id !== np.id) {
        setRecords(p => p.map(r => r.id === np.id ? synced : r));
      }
      showToast(tr('msg_saved'),'success');
    }
    const emp = form.employeeId ? employees.find(e => String(e.id) === String(form.employeeId)) : null;
    if (justCompletedPromotion && emp) await syncToServer('employees','update',{...emp,lastPromotion:form.promotionDate||today});
    if (justPaidAllowance && emp) await syncToServer('employees','update',{...emp,lastAllowance:form.allowanceDate||today});
    setShowModal(false);
    refreshNotifSources();
  };
  const clearPromoPending = async (r) => {
    const up = {...r, promotionPendingAccountsAction:false};
    setRecords(prv=>prv.map(x=>x.id===r.id?up:x));
    await syncToServer('promotionsAllowances','update',up);
  };
  const clearAllowPending = async (r) => {
    const up = {...r, allowancePendingAccountsAction:false};
    setRecords(prv=>prv.map(x=>x.id===r.id?up:x));
    await syncToServer('promotionsAllowances','update',up);
  };

  return (
    <div>
      {promoDue.length > 0 && (
        <div style={{ background:'rgba(26,107,171,0.08)', border:'1px solid rgba(26,107,171,0.3)', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
          <div style={{ fontWeight:700, color:'#1a6bab', marginBottom:6 }}>{tr('acc_due_promotions')} ({promoDue.length})</div>
          {promoDue.map(d=><div key={d.id} style={{ fontSize:13, color:'var(--text-primary)', padding:'3px 0' }}>• {d.name} — {d.notes}</div>)}
        </div>
      )}
      {allowDue.length > 0 && (
        <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
          <div style={{ fontWeight:700, color:'#f59e0b', marginBottom:6 }}>{tr('acc_due_allowances')} ({allowDue.length})</div>
          {allowDue.map(d=><div key={d.id} style={{ fontSize:13, padding:'3px 0' }}>• {d.name} — {d.notes}</div>)}
        </div>
      )}
      {promoPending.length > 0 && (
        <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
          <div style={{ fontWeight:700, color:'#f59e0b', marginBottom:6 }}>{tr('acc_pending_salary_banner')} ({promoPending.length})</div>
          {promoPending.map(r=>(
            <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13, color:'var(--text-primary)', padding:'3px 0' }}>
              <span>• {r.name} — {r.promotionDate}</span>
              <button onClick={()=>clearPromoPending(r)} style={{ padding:'3px 10px', borderRadius:6, border:'1px solid rgba(245,158,11,0.4)', background:'transparent', color:'#f59e0b', cursor:'pointer', fontSize:11 }}>{tr('acc_clear_pending_action')}</button>
            </div>
          ))}
        </div>
      )}
      {allowPending.length > 0 && (
        <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
          <div style={{ fontWeight:700, color:'#f59e0b', marginBottom:6 }}>{tr('acc_pending_allow_banner')} ({allowPending.length})</div>
          {allowPending.map(r=>(
            <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13, color:'var(--text-primary)', padding:'3px 0' }}>
              <span>• {r.name} — {r.allowanceDate}</span>
              <button onClick={()=>clearAllowPending(r)} style={{ padding:'3px 10px', borderRadius:6, border:'1px solid rgba(245,158,11,0.4)', background:'transparent', color:'#f59e0b', cursor:'pointer', fontSize:11 }}>{tr('acc_clear_pending_action')}</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <h3 style={{ margin:0 }}>{tr('acc_promo_allow_title')} ({totalItems})</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>printTable('promo-allow-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {tr('acc_print')}</button>
          <button onClick={() => setShowImport(true)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>📊 {lang==='ar'?'استيراد من Excel':'Import from Excel'}</button>
          <ExcelExportButton apiName="promotionsAllowances" lang={lang} onError={(m) => showToast(m, 'error')} />
          <button onClick={openAdd} className="btn btn-primary">+ {tr('acc_add_promo_allow')}</button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          apiName="promotionsAllowances"
          title={lang==='ar'?'استيراد سجلات ترفيع/علاوة من Excel':'Import Promotion/Allowance Records from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/promotionsAllowances');
              if (Array.isArray(fresh)) setRecords(fresh);
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
        {/* .table-wrapper (overflow:auto) وحده لا يكفي هنا: الجدول width:100%
            بتخطيط table-layout الافتراضي (auto) يستطيع "ضغط" أعمدة nowrap
            أضيق من محتواها الفعلي بدل أن يتجاوز عرض الحاوية — فلا يكتشف
            المتصفح أصلاً أن هناك تجاوزاً أفقياً يستدعي شريط تمرير (لا يظهر
            سوى التمرير العمودي من max-height بالنمط). صفحات أخرى تستخدم نفس
            .table-wrapper (المرضى 11 عموداً، الرموز الطبية 4 أعمدة) لا تُثبت
            هذا فعلياً لأن أعمدتها أصلاً تتّسع بلا مشكلة — لا يوجد بهذا التطبيق
            حتى الآن جدول واسع فعلاً كهذا (18 عموداً) يعتمد على .table-wrapper
            وحده. الحل: min-width صريح على الجدول نفسه يفرض عرضاً أكبر من
            الحاوية بوضوح، فيضطر المتصفح لإظهار شريط التمرير الأفقي فعلياً.

            شريط التمرير الأفقي نفسه (أسفل صندوق .table-wrapper) يبقى بعيد
            المنال بدون تمرير الصفحة كاملة تقريباً، بسبب طول banners التنبيهات
            أعلى الصفحة التي تدفع الجدول للأسفل. لذا نضيف أيضاً سحباً بالفأرة
            (drag-to-pan) يعمل من أي نقطة ظاهرة بالجدول — حتى أول صف مرئي فقط —
            دون الحاجة للوصول لشريط التمرير نفسه إطلاقاً. */}
        <div
          ref={wrapperRef}
          className="table-wrapper"
          onMouseDown={onWrapperMouseDown}
          style={{ cursor: isDragging ? 'grabbing' : 'grab', userSelect: isDragging ? 'none' : 'auto' }}
        >
          <table id="promo-allow-table" className="table" style={{ minWidth: 1900 }}>
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
              <th>{tr('hr_emp_name')}</th>
              <th>{tr('auto_pair_5')}</th><th>{tr('auto_pair_6')}</th><th>{tr('auto_pair_7')}</th>
              <th>{tr('auto_pair_8')}</th><th>{tr('auto_pair_9')}</th>
              <th>{tr('acc_promo_decision_no')}</th><th>{tr('acc_promo_decision_date')}</th>
              <th>{tr('acc_promotion_section')} — {tr('field_status')}</th>
              <th>{tr('auto_pair_24')}</th><th>{tr('acc_amount')} (IQD)</th><th>{tr('acc_date')}</th>
              <th>{tr('acc_allow_decision_no')}</th><th>{tr('acc_allow_decision_date')}</th>
              <th>{tr('acc_allowance_section')} — {tr('field_status')}</th>
              <th>{tr('field_notes')}</th><th>{tr('field_actions')}</th>
            </tr></thead>
            <tbody>
              {pageItems.map(r=>(
                <tr key={r.id}>
                  <td><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                  <td style={{ fontWeight:600 }}>{lang==='ar'?r.name:r.nameEn||r.name}</td>
                  <td style={{ fontSize:13 }}>{lang==='ar'?r.fromGrade:r.fromGradeEn||gradeEn(r.fromGrade)||r.fromGrade}</td>
                  <td style={{ fontSize:13, color:'#1a6bab', fontWeight:600 }}>{lang==='ar'?r.toGrade:r.toGradeEn||gradeEn(r.toGrade)||r.toGrade||'—'}</td>
                  <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{r.promotionDate||'—'}</td>
                  <td style={{ fontSize:13 }}>{r.salaryBefore?Number(r.salaryBefore).toLocaleString('en-US'):'—'}</td>
                  <td style={{ fontSize:13, color:'#22c55e', fontWeight:600 }}>{r.salaryAfter?Number(r.salaryAfter).toLocaleString('en-US'):'—'}</td>
                  <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{r.promotionDecisionNo||'—'}</td>
                  <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{r.promotionDecisionDate||'—'}</td>
                  <td>
                    {r.promotionStatus ? <span style={{ background:r.promotionStatus==='مُنجَز'?'#dcfce7':'rgba(26,107,171,0.1)', color:r.promotionStatus==='مُنجَز'?'#166534':'#1a6bab', padding:'2px 8px', borderRadius:8, fontSize:12, fontWeight:600 }}>{displayValue(r.promotionStatus, tr)}</span> : '—'}
                    {r.promotionPendingAccountsAction && <span style={{ display:'block', marginTop:4, background:'rgba(245,158,11,0.1)', color:'#f59e0b', padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:600 }}>{tr('acc_pending_salary_action')}</span>}
                  </td>
                  <td style={{ fontSize:13 }}>{r.allowanceType ? (TR_LABELS(tr)[r.allowanceType]||r.allowanceType) : '—'}</td>
                  <td style={{ fontWeight:700, color:'#22c55e' }}>{r.amount?Number(r.amount).toLocaleString('en-US'):'—'}</td>
                  <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{r.allowanceDate||'—'}</td>
                  <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{r.allowanceDecisionNo||'—'}</td>
                  <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{r.allowanceDecisionDate||'—'}</td>
                  <td>
                    {r.allowanceStatus ? <span style={{ background:r.allowanceStatus==='مدفوع'?'#dcfce7':'rgba(245,158,11,0.1)', color:r.allowanceStatus==='مدفوع'?'#166534':'#f59e0b', padding:'2px 8px', borderRadius:8, fontSize:12, fontWeight:600 }}>{displayValue(r.allowanceStatus, tr)}</span> : '—'}
                    {r.allowancePendingAccountsAction && <span style={{ display:'block', marginTop:4, background:'rgba(245,158,11,0.1)', color:'#f59e0b', padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:600 }}>{tr('acc_pending_salary_action')}</span>}
                  </td>
                  <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{r.notes}</td>
                  <td><div style={{ display:'flex', gap:6 }}><button onClick={()=>openEdit(r)} style={{ background:'none',border:'none',cursor:'pointer',color:'#1a6bab' }}>✏️</button><button onClick={()=>del(r.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444' }}>🗑️</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} pageSize={50} lang={lang} />
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:640 }}>
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing?tr('acc_edit_promo_allow'):tr('acc_add_promo_allow')}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
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
                  <div style={{ gridColumn:'1/-1' }}><label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                    <select value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))} className="form-control">
                      <option value="">—</option>
                      {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}

                <div style={{ gridColumn:'1/-1', fontWeight:700, color:'#1a6bab', borderTop:'1px solid var(--border)', paddingTop:10, marginTop:4 }}>⬆️ {tr('acc_promotion_section')}</div>
                <div><label className="form-label">{tr('auto_pair_14')}</label><input value={form.fromGrade} onChange={e=>setForm(p=>({...p,fromGrade:e.target.value}))} placeholder="الرابعة/3" className="form-control" /></div>
                <div><label className="form-label">{tr('auto_pair_15')}</label><input value={form.toGrade} onChange={e=>setForm(p=>({...p,toGrade:e.target.value}))} placeholder="الرابعة/4" className="form-control" /></div>
                <div><label className="form-label">{tr('auto_pair_16')}</label><input type="number" value={form.salaryBefore} onChange={e=>setForm(p=>({...p,salaryBefore:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('auto_pair_17')}</label><input type="number" value={form.salaryAfter} onChange={e=>setForm(p=>({...p,salaryAfter:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('auto_pair_18')}</label><input type="date" value={form.promotionDate||''} onChange={e=>setForm(p=>({...p,promotionDate:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('field_status')}</label><select value={form.promotionStatus} onChange={e=>setForm(p=>({...p,promotionStatus:e.target.value}))} className="form-control">
                  <option value="">—</option>
                  <option value="مُنجَز">{tr('acc_status_done')}</option>
                  <option value="مستحق">{tr('acc_status_due')}</option>
                  <option value="قيد المعالجة">{tr('acc_status_process')}</option>
                </select></div>
                <div><label className="form-label">{tr('acc_promo_decision_no')}</label><input value={form.promotionDecisionNo} onChange={e=>setForm(p=>({...p,promotionDecisionNo:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('acc_promo_decision_date')}</label><input type="date" value={form.promotionDecisionDate||''} onChange={e=>setForm(p=>({...p,promotionDecisionDate:e.target.value}))} className="form-control" /></div>

                <div style={{ gridColumn:'1/-1', fontWeight:700, color:'#f59e0b', borderTop:'1px solid var(--border)', paddingTop:10, marginTop:4 }}>💰 {tr('acc_allowance_section')}</div>
                <div><label className="form-label">{tr('auto_pair_29')}</label><select value={form.allowanceType} onChange={e=>setForm(p=>({...p,allowanceType:e.target.value}))} className="form-control">{ALLOWANCE_TYPES.map(t=><option key={t} value={t}>{displayValue(t, tr)}</option>)}</select></div>
                <div><label className="form-label">{tr('acc_amount')} (IQD)</label><input type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('acc_date')}</label><input type="date" value={form.allowanceDate||''} onChange={e=>setForm(p=>({...p,allowanceDate:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('field_status')}</label><select value={form.allowanceStatus} onChange={e=>setForm(p=>({...p,allowanceStatus:e.target.value}))} className="form-control">
                  <option value="">—</option>
                  <option value="مدفوع">{tr('acc_status_paid')}</option>
                  <option value="مستحقة">{tr('acc_status_due')}</option>
                  <option value="قيد المعالجة">{tr('acc_status_process')}</option>
                </select></div>
                <div><label className="form-label">{tr('acc_allow_decision_no')}</label><input value={form.allowanceDecisionNo} onChange={e=>setForm(p=>({...p,allowanceDecisionNo:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{tr('acc_allow_decision_date')}</label><input type="date" value={form.allowanceDecisionDate||''} onChange={e=>setForm(p=>({...p,allowanceDecisionDate:e.target.value}))} className="form-control" /></div>

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
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>{lang==='ar' ? `حذف ${selectedIds.size} سجل؟` : `Delete ${selectedIds.size} records?`}</h3>
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

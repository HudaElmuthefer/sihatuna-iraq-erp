/* eslint-disable no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import ExcelImportModal from '../components/ExcelImportModal';

// دالة مساعدة موحّدة: تحمّل بيانات أي تبويب من الباك إند الحقيقي عند توفر تسجيل دخول
// (تستبدل البيانات المحلية فقط لو رجّع الباك إند بيانات فعلية غير فاضية)
// ملاحظة: ما عاد نقرأ توكن من localStorage (انتقل لـ httpOnly cookie) — حالة
// user بالسياق العام هي المؤشر الوحيد المتاح للفرونت إند لمعرفة تسجيل الدخول.
function useBackendLoad(backendKey, setState) {
  const { user } = useApp();
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.get(`/${backendKey}`)
      .then(data => {
        if (!cancelled && Array.isArray(data) && data.length > 0) setState(data);
      })
      .catch(() => {}); // الباك إند غير شغّال — نكمل بالبيانات المحلية بدون كسر
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ── MOCK DATA ──────────────────────────────────────────────────────────────────
const today = new Date();
const addMonths = (d, m) => { const r = new Date(d); r.setMonth(r.getMonth()+m); return r.toISOString().split('T')[0]; };

const initEmployees = [
  { id:1, name:'د. أحمد سالم الراشدي', nameEn:'Dr. Ahmed Salem Al-Rashidi', jobTitle:'طبيب اختصاص', jobTitleEn:'Specialist Physician', dept:'الباطنية', deptEn:'Internal Medicine', grade:'الرابعة', gradeEn:'Fourth', step:3, salary:850000, hireDate:'2018-03-15', birthDate:'1982-05-14', phone:'07701234567', status:'active', lastPromotion:'2022-03-15', lastAllowance:'2024-01-01', retirementDate:'2042-05-14', notes:'' },
  { id:2, name:'سارة قاسم الزيدي', nameEn:'Sara Qassim Al-Zaidi', jobTitle:'ممرضة أولى', jobTitleEn:'Senior Nurse', dept:'الجراحة', deptEn:'Surgery', grade:'الثالثة', gradeEn:'Third', step:2, salary:650000, hireDate:'2020-07-01', birthDate:'1990-07-01', phone:'07711111111', status:'active', lastPromotion:'2023-07-01', lastAllowance:'2024-07-01', retirementDate:'2050-07-01', notes:'' },
  { id:3, name:'باسم علي الكربلائي', nameEn:'Basim Ali Al-Karbalaei', jobTitle:'فني مختبر', jobTitleEn:'Lab Technician', dept:'التحاليل', deptEn:'Laboratory', grade:'الثالثة', gradeEn:'Third', step:1, salary:500000, hireDate:'2015-01-10', birthDate:'1968-09-20', phone:'07744444444', status:'active', lastPromotion:'2021-01-10', lastAllowance:'2023-01-10', retirementDate:'2028-09-20', notes:'يقترب من التقاعد' },
  { id:4, name:'رنا محمد النجار', nameEn:'Rana Mohammed Al-Najjar', jobTitle:'سكرتيرة', jobTitleEn:'Secretary', dept:'الإدارة', deptEn:'Administration', grade:'الثانية', gradeEn:'Second', step:4, salary:480000, hireDate:'2019-11-20', birthDate:'1995-03-08', phone:'07733333333', status:'leave', lastPromotion:'2022-11-20', lastAllowance:'2022-11-20', retirementDate:'2055-03-08', notes:'' },
];
const initOutgoing = [
  { id:1, ref:'ص-2026-001', title:'طلب توفير مستلزمات طبية', titleEn:'Request for Medical Supplies', to:'مديرية الصحة', toEn:'Health Directorate', date:'2026-06-01', subject:'توفير مستلزمات طوارئ', subjectEn:'Emergency supplies provision', status:'sent', notes:'' },
  { id:2, ref:'ص-2026-002', title:'تقرير الحضور والغياب', titleEn:'Attendance Report', to:'قسم الموارد البشرية', toEn:'HR Department', date:'2026-06-10', subject:'إحصائية شهرية', subjectEn:'Monthly statistics', status:'sent', notes:'' },
];
const initIncoming = [
  { id:1, ref:'و-2026-001', incomingRef:'م.ص/2026/441', title:'قرار ترفيع طاقم التمريض', titleEn:'Nursing Staff Promotion Decree', from:'وزارة الصحة', fromEn:'Ministry of Health', date:'2026-05-28', subject:'ترفيع درجة وظيفية', subjectEn:'Job grade promotion', status:'received', notes:'' },
  { id:2, ref:'و-2026-002', incomingRef:'م.ص/2026/512', title:'دورة تدريبية في الإسعافات الأولية', titleEn:'First Aid Training Course', from:'منظمة الصحة العالمية', fromEn:'World Health Organization', date:'2026-06-05', subject:'تدريب الكوادر', subjectEn:'Staff training', status:'review', notes:'' },
];
const initRetired = [
  { id:1, name:'كاظم محمد العبادي', nameEn:'Kadhim Mohammed Al-Abadi', jobTitle:'رئيس قسم', jobTitleEn:'Department Head', dept:'الباطنية', deptEn:'Internal Medicine', retireDate:'2024-01-01', retireSalary:1200000, pensionNo:'P-2024-001', phone:'07799999999', notes:'تمت إجراءات التسوية بالكامل', notesEn:'Settlement procedures completed' },
];
const initDossiers = [
  { id:1, employeeId:1, employeeName:'د. أحمد سالم الراشدي', docs:[
    { id:101, type:'شهادة', title:'شهادة التخرج من كلية الطب', date:'2006-06-01', file:null, notes:'' },
    { id:102, type:'قرار', title:'قرار التعيين الأولي', date:'2018-03-15', file:null, notes:'' },
  ]},
];
const DOSSIER_TYPES_AR = ['شهادة','قرار','عقد','تقرير','هوية','وثيقة','أخرى'];
const DOSSIER_TYPES_EN = ['Certificate','Decree','Contract','Report','ID','Document','Other'];

// ── TRANSLATIONS ───────────────────────────────────────────────────────────────
const I18N = {
  hr_title:           { ar:'الموارد البشرية',          en:'Human Resources' },
  hr_subtitle:        { ar:'إدارة شاملة للكوادر والكتب الرسمية والإضابير', en:'Comprehensive staff, letters & dossiers management' },
  tab_employees:      { ar:'الموظفون',                  en:'Employees' },
  tab_outgoing:       { ar:'الكتب الصادرة',             en:'Outgoing Letters' },
  tab_incoming:       { ar:'الكتب الواردة',             en:'Incoming Letters' },
  tab_retired:        { ar:'المتقاعدون',                en:'Retired Staff' },
  tab_dossiers:       { ar:'الإضابير الشخصية',          en:'Personal Dossiers' },
  emp_list:           { ar:'قائمة الموظفين',            en:'Employee List' },
  add_emp:            { ar:'إضافة موظف',                en:'Add Employee' },
  edit_emp:           { ar:'تعديل موظف',                en:'Edit Employee' },
  print:              { ar:'طباعة',                     en:'Print' },
  col_name:           { ar:'الاسم',                     en:'Name' },
  col_title:          { ar:'الوظيفة',                   en:'Job Title' },
  col_dept:           { ar:'القسم',                     en:'Department' },
  col_grade:          { ar:'الدرجة/المرحلة',            en:'Grade/Step' },
  col_salary:         { ar:'الراتب',                    en:'Salary' },
  col_hire:           { ar:'تاريخ التعيين',             en:'Hire Date' },
  col_last_promo:     { ar:'آخر ترفيع',                 en:'Last Promotion' },
  col_last_allow:     { ar:'آخر علاوة',                 en:'Last Allowance' },
  col_retire_date:    { ar:'تاريخ التقاعد',             en:'Retirement Date' },
  col_status:         { ar:'الحالة',                    en:'Status' },
  col_actions:        { ar:'إجراءات',                   en:'Actions' },
  lbl_fullname:       { ar:'الاسم الكامل *',             en:'Full Name *' },
  lbl_job:            { ar:'الوظيفة *',                  en:'Job Title *' },
  lbl_dept_lbl:       { ar:'القسم',                     en:'Department' },
  lbl_grade:          { ar:'الدرجة الوظيفية',           en:'Grade' },
  lbl_step:           { ar:'المرحلة',                   en:'Step' },
  lbl_salary_iq:      { ar:'الراتب (د.ع)',               en:'Salary (IQD)' },
  lbl_phone:          { ar:'الهاتف',                    en:'Phone' },
  lbl_birth:          { ar:'تاريخ الميلاد',             en:'Birth Date' },
  lbl_hire_date:      { ar:'تاريخ التعيين',             en:'Hire Date' },
  lbl_last_promo:     { ar:'آخر ترفيع',                 en:'Last Promotion' },
  lbl_last_allow:     { ar:'آخر علاوة',                 en:'Last Allowance' },
  lbl_est_retire:     { ar:'تاريخ التقاعد المقدر',      en:'Estimated Retirement' },
  lbl_status:         { ar:'الحالة',                    en:'Status' },
  lbl_notes:          { ar:'ملاحظات',                   en:'Notes' },
  status_active:      { ar:'نشط',                       en:'Active' },
  status_leave:       { ar:'إجازة',                     en:'On Leave' },
  status_inactive:    { ar:'متوقف',                     en:'Inactive' },
  btn_cancel:         { ar:'إلغاء',                     en:'Cancel' },
  btn_save:           { ar:'حفظ',                       en:'Save' },
  btn_add:            { ar:'إضافة',                     en:'Add' },
  saved:              { ar:'تم التعديل',                en:'Updated' },
  added:              { ar:'تمت الإضافة',               en:'Added' },
  deleted:            { ar:'تم الحذف',                  en:'Deleted' },
  sync_failed:        { ar:'تم الحفظ محلياً فقط، تعذّر الاتصال بالخادم', en:'Saved locally only — server sync failed' },
  err_name_job:       { ar:'أدخل الاسم والوظيفة',        en:'Enter name and job title' },
  out_list:           { ar:'الكتب الصادرة',             en:'Outgoing Letters' },
  add_out:            { ar:'إضافة كتاب صادر',           en:'Add Outgoing Letter' },
  edit_out:           { ar:'تعديل كتاب صادر',           en:'Edit Outgoing Letter' },
  new_out:            { ar:'كتاب صادر جديد',            en:'New Outgoing Letter' },
  col_ref:            { ar:'رقم الصادر',                en:'Ref No.' },
  col_book_title:     { ar:'عنوان الكتاب',              en:'Letter Title' },
  col_to:             { ar:'الجهة المُرسَلة إليها',      en:'Sent To' },
  col_subject:        { ar:'الموضوع',                   en:'Subject' },
  col_date:           { ar:'التاريخ',                   en:'Date' },
  lbl_title_req:      { ar:'عنوان الكتاب *',             en:'Letter Title *' },
  lbl_to_req:         { ar:'الجهة المُرسَلة إليها *',    en:'Sent To *' },
  lbl_subject:        { ar:'الموضوع',                   en:'Subject' },
  lbl_date:           { ar:'التاريخ',                   en:'Date' },
  err_title_to:       { ar:'أدخل العنوان والجهة',        en:'Enter title and recipient' },
  in_list:            { ar:'الكتب الواردة',             en:'Incoming Letters' },
  add_in:             { ar:'تسجيل كتاب وارد',           en:'Register Incoming Letter' },
  edit_in:            { ar:'تعديل كتاب وارد',           en:'Edit Incoming Letter' },
  new_in:             { ar:'تسجيل كتاب وارد',           en:'New Incoming Letter' },
  col_in_ref:         { ar:'رقم الوارد',                en:'Incoming Ref' },
  col_sender_ref:     { ar:'رقم صادر الجهة',            en:'Sender Ref' },
  col_from:           { ar:'الجهة المُرسِلة',           en:'From' },
  lbl_from_req:       { ar:'الجهة المُرسِلة *',          en:'From *' },
  lbl_sender_ref:     { ar:'رقم صادر الجهة المُرسِلة',  en:'Sender Reference No.' },
  lbl_arrive_date:    { ar:'تاريخ الورود',               en:'Arrival Date' },
  err_title_from:     { ar:'أدخل العنوان والجهة المرسِلة', en:'Enter title and sender' },
  ret_list:           { ar:'المتقاعدون',                en:'Retired Staff' },
  add_ret:            { ar:'إضافة متقاعد',              en:'Add Retiree' },
  edit_ret:           { ar:'تعديل بيانات متقاعد',       en:'Edit Retiree' },
  col_pension_no:     { ar:'رقم التقاعد',               en:'Pension No.' },
  col_last_pos:       { ar:'المنصب الأخير',             en:'Last Position' },
  col_retire_dt:      { ar:'تاريخ الإحالة',             en:'Retirement Date' },
  col_pension_sal:    { ar:'راتب التقاعد',              en:'Pension Salary' },
  col_dossier:        { ar:'الاضبارة',                  en:'Dossier' },
  lbl_last_pos:       { ar:'المنصب الأخير',             en:'Last Position' },
  lbl_retire_dt:      { ar:'تاريخ الإحالة',             en:'Retirement Date' },
  lbl_pension_sal:    { ar:'راتب التقاعد',              en:'Pension Salary' },
  lbl_pension_no:     { ar:'رقم قرار التقاعد',          en:'Pension Decree No.' },
  err_name:           { ar:'أدخل الاسم',                en:'Enter name' },
  doss_back:          { ar:'رجوع',                      en:'Back' },
  doss_of:            { ar:'اضبارة المتقاعد',           en:'Dossier for' },
  doss_no_docs:       { ar:'لا توجد وثائق بعد — اضغط "إضافة وثيقة" لإرفاق ملفات', en:'No documents yet — click "Add Document" to attach files' },
  add_doc:            { ar:'إضافة وثيقة',               en:'Add Document' },
  add_doc_title:      { ar:'إضافة وثيقة للاضبارة',      en:'Add Document to Dossier' },
  doc_type:           { ar:'نوع الوثيقة',               en:'Document Type' },
  doc_title_req:      { ar:'عنوان الوثيقة *',            en:'Document Title *' },
  doc_date:           { ar:'التاريخ',                   en:'Date' },
  doc_upload:         { ar:'رفع الملف (صورة أو PDF)',    en:'Upload File (image or PDF)' },
  doc_upload_btn:     { ar:'اضغط لرفع ملف',             en:'Click to upload file' },
  doc_view:           { ar:'عرض الملف',                 en:'View File' },
  doc_added:          { ar:'تمت إضافة الوثيقة',         en:'Document added' },
  err_doc_title:      { ar:'أدخل عنوان الوثيقة',        en:'Enter document title' },
  dos_employees:      { ar:'الموظفون',                  en:'Employees' },
  dos_select:         { ar:'اختر موظفاً لعرض إضبارته الشخصية', en:'Select an employee to view their dossier' },
  dos_dossier_of:     { ar:'إضبارة',                    en:'Dossier:' },
  dos_no_docs:        { ar:'لا توجد وثائق بعد — اضغط "إضافة وثيقة"', en:'No documents yet — click "Add Document"' },
  doc_created:        { ar:'تم إنشاء الإضبارة',         en:'Dossier created' },
  doc_deleted:        { ar:'تم حذف الوثيقة',            en:'Document deleted' },
  emp_name_prompt:    { ar:'اسم الموظف:',               en:'Employee name:' },
  docs_count:         { ar:'وثيقة',                     en:'doc(s)' },
  alert_allowance:    { ar:'علاوة مستحقة — آخر علاوة منذ', en:'Allowance due — last allowance' },
  alert_months:       { ar:'شهراً',                     en:'months ago' },
  alert_promotion:    { ar:'ترفيع مستحق — آخر ترفيع منذ', en:'Promotion due — last promotion' },
  alert_retire:       { ar:'اقتراب إحالة للتقاعد — متبقي', en:'Approaching retirement —' },
  alert_retire_left:  { ar:'شهر',                       en:'months left' },
  iqd:                { ar:'د.ع',                       en:'IQD' },
  choose:             { ar:'اختر...',                   en:'Choose...' },
};

// ── HELPERS ────────────────────────────────────────────────────────────────────
const monthsAgo = (dateStr) => { if (!dateStr) return 999; const d = new Date(dateStr); return Math.floor((today - d) / (1000*60*60*24*30)); };
const monthsUntil = (dateStr) => { if (!dateStr) return 999; const d = new Date(dateStr); return Math.floor((d - today) / (1000*60*60*24*30)); };
const printTable = (id) => {
  const el = document.getElementById(id); if (!el) return;
  const w = window.open('','_blank');
  w.document.write(`<html dir="rtl"><head><style>body{font-family:Arial;direction:rtl}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:right}th{background:#1a6bab;color:#fff}</style></head><body>${el.outerHTML}</body></html>`);
  w.document.close(); w.print();
};

// ── ALERT BANNER ───────────────────────────────────────────────────────────────
function AlertBanner({ employees, lang }) {
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const alerts = [];
  employees.forEach(e => {
    if (monthsAgo(e.lastAllowance) >= 12)
      alerts.push({ type:'allowance', name:e.name, msg:`${L('alert_allowance')} ${monthsAgo(e.lastAllowance)} ${L('alert_months')}` });
    if (monthsAgo(e.lastPromotion) >= 24)
      alerts.push({ type:'promotion', name:e.name, msg:`${L('alert_promotion')} ${monthsAgo(e.lastPromotion)} ${L('alert_months')}` });
    const u = monthsUntil(e.retirementDate);
    if (u >= 0 && u <= 12)
      alerts.push({ type:'retire', name:e.name, msg:`${L('alert_retire')} ${u} ${L('alert_retire_left')}` });
  });
  if (!alerts.length) return null;
  const colors = { allowance:'#f59e0b', promotion:'#1a6bab', retire:'#ef4444' };
  const icons  = { allowance:'💰', promotion:'⬆️', retire:'👴' };
  return (
    <div style={{ marginBottom:20 }}>
      {alerts.map((a,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10, background:`${colors[a.type]}15`, border:`1px solid ${colors[a.type]}40`, borderRadius:10, padding:'10px 16px', marginBottom:6 }}>
          <span style={{ fontSize:20 }}>{icons[a.type]}</span>
          <div><span style={{ fontWeight:700, color:colors[a.type] }}>{a.name}</span><span style={{ color:'var(--text-primary)', fontSize:13, marginRight:8 }}>{a.msg}</span></div>
        </div>
      ))}
    </div>
  );
}

// ── EMPLOYEES TAB ──────────────────────────────────────────────────────────────
function EmployeesTab({ lang }) {
  const { showToast, syncToServer, filterByViewingHospital, hospitals, multiHospitalEnabled } = useApp();
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const [employees, setEmployees] = useState(initEmployees);
  useBackendLoad('employees', setEmployees);
  const visibleEmployees = filterByViewingHospital(employees);
  const { pageItems: empPageItems, currentPage: empCurrentPage, setCurrentPage: setEmpCurrentPage, totalPages: empTotalPages, totalItems: empTotalItems } = usePagination(visibleEmployees, 50);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const empty = { name:'', jobTitle:'', dept:'', grade: lang==='ar'?'الأولى':'First', step:1, salary:'', hireDate:'', birthDate:'', phone:'', status: 'active', lastPromotion:'', lastAllowance:'', retirementDate:'', notes:'' };
  const [form, setForm] = useState(empty);
  const GRADES_AR = ['الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة'];
  const GRADES_EN = ['First','Second','Third','Fourth','Fifth','Sixth','Seventh'];
  const GRADES = lang === 'en' ? GRADES_EN : GRADES_AR;
  const DEPTS_AR = ['الباطنية','الجراحة','الأطفال','التحاليل','الأشعة','النسائية','الطوارئ','الإدارة'];
  const DEPTS_EN = ['Internal','Surgery','Pediatrics','Lab','Radiology','Gynecology','Emergency','Admin'];
  const DEPTS = lang === 'en' ? DEPTS_EN : DEPTS_AR;

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = async (id) => {
    setEmployees(p=>p.filter(e=>e.id!==id));
    const synced = await syncToServer('employees','delete',{id});
    showToast(L(synced ? 'deleted' : 'sync_failed'), synced ? 'success' : 'warning');
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
  };
  const statusColor = (s) => ({ 'active':'#22c55e', 'leave':'#f59e0b', 'inactive':'#ef4444', 'نشط':'#22c55e', 'إجازة':'#f59e0b', 'متوقف':'#ef4444' }[s]||'#6b7280');

  return (
    <div>
      <AlertBanner employees={employees} lang={lang} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0 }}>{L('emp_list')} ({employees.length})</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => printTable('emp-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {L('print')}</button>
          <button onClick={() => setShowImport(true)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>📊 {lang==='ar'?'استيراد من Excel':'Import from Excel'}</button>
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
          }}
        />
      )}
      <div className="card" style={{ padding:0 }}>
        <div style={{ overflowX:'auto' }}>
          <table id="emp-table" className="table">
            <thead><tr>
              <th>{L('col_name')}</th><th>{L('col_title')}</th><th>{L('col_dept')}</th><th>{L('col_grade')}</th>
              <th>{L('col_salary')}</th><th>{L('col_hire')}</th><th>{L('col_last_promo')}</th><th>{L('col_last_allow')}</th>
              <th>{L('col_retire_date')}</th><th>{L('col_status')}</th><th>{L('col_actions')}</th>
            </tr></thead>
            <tbody>
              {empPageItems.map(e => {
                const retireAlert = monthsUntil(e.retirementDate) <= 12 && monthsUntil(e.retirementDate) >= 0;
                const allowAlert = monthsAgo(e.lastAllowance) >= 12;
                const promAlert  = monthsAgo(e.lastPromotion) >= 24;
                return (
                  <tr key={e.id} style={{ background: retireAlert ? 'rgba(239,68,68,0.05)' : undefined }}>
                    <td style={{ fontWeight:600 }}>{lang==='ar'?e.name:e.nameEn||e.name}{retireAlert && <span title={L('alert_retire')} style={{ marginRight:4 }}>🔴</span>}</td>
                    <td style={{ fontSize:13 }}>{lang==='ar'?e.jobTitle:e.jobTitleEn||e.jobTitle}</td>
                    <td><span style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', padding:'2px 8px', borderRadius:8, fontSize:12 }}>{lang==='ar'?e.dept:e.deptEn||e.dept}</span></td>
                    <td style={{ fontSize:13, direction:'ltr', textAlign:'center' }}>{lang==='ar'?e.grade:e.gradeEn||e.grade} / {e.step}</td>
                    <td style={{ fontWeight:600, color:'#22c55e' }}>{Number(e.salary).toLocaleString(lang==='ar'?'ar-IQ':'en-US')} {L('iqd')}</td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{e.hireDate}</td>
                    <td style={{ fontSize:12, color: promAlert ? '#1a6bab' : 'var(--text-secondary)' }}>{e.lastPromotion}{promAlert && <span> ⬆️</span>}</td>
                    <td style={{ fontSize:12, color: allowAlert ? '#f59e0b' : 'var(--text-secondary)' }}>{e.lastAllowance}{allowAlert && <span> 💰</span>}</td>
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
                <div><label className="form-label">{L('lbl_salary_iq')}</label><input type="number" value={form.salary} onChange={e=>setForm(p=>({...p,salary:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{L('lbl_phone')}</label><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{L('lbl_birth')}</label><input type="date" value={form.birthDate} onChange={e=>setForm(p=>({...p,birthDate:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{L('lbl_hire_date')}</label><input type="date" value={form.hireDate} onChange={e=>setForm(p=>({...p,hireDate:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{L('lbl_last_promo')}</label><input type="date" value={form.lastPromotion} onChange={e=>setForm(p=>({...p,lastPromotion:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{L('lbl_last_allow')}</label><input type="date" value={form.lastAllowance} onChange={e=>setForm(p=>({...p,lastAllowance:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{L('lbl_est_retire')}</label><input type="date" value={form.retirementDate} onChange={e=>setForm(p=>({...p,retirementDate:e.target.value}))} className="form-control" /></div>
                <div><label className="form-label">{L('lbl_status')}</label>
                  <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} className="form-control">
                    <option>{L('status_active')}</option><option>{L('status_leave')}</option><option>{L('status_inactive')}</option>
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
    </div>
  );
}

// ── OUTGOING LETTERS ───────────────────────────────────────────────────────────
function OutgoingTab({ lang }) {
  const { showToast, syncToServer, filterByViewingHospital, hospitals, multiHospitalEnabled } = useApp();
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const [letters, setLetters] = useState(initOutgoing);
  useBackendLoad('outgoing', setLetters);
  const visibleOutgoing = filterByViewingHospital(letters);
  const { pageItems: outPageItems, currentPage: outCurrentPage, setCurrentPage: setOutCurrentPage, totalPages: outTotalPages, totalItems: outTotalItems } = usePagination(visibleOutgoing, 50);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { title:'', to:'', date:today.toISOString().split('T')[0], subject:'', status:'مُرسَل', notes:'' };
  const [form, setForm] = useState(empty);
  const nextRef = () => `ص-2026-${String(letters.length+1).padStart(3,'0')}`;
  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = async (id) => {
    setLetters(p=>p.filter(r=>r.id!==id));
    const synced = await syncToServer('outgoing','delete',{id});
    showToast(L(synced ? 'deleted' : 'sync_failed'), synced ? 'success' : 'warning');
  };
  const save = async () => {
    if (!form.title || !form.to) { showToast(L('err_title_to'),'error'); return; }
    if (editing) {
      const ul = {...form,id:editing.id};
      setLetters(p=>p.map(r=>r.id===editing.id?ul:r));
      const synced = await syncToServer('outgoing','update',ul);
      showToast(L(synced ? 'saved' : 'sync_failed'), synced ? 'success' : 'warning');
    } else {
      const nl = {...form,id:Date.now(),ref:nextRef()};
      setLetters(p=>[...p,nl]);
      const synced = await syncToServer('outgoing','create',nl);
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
        <h3 style={{ margin:0 }}>{L('out_list')} ({letters.length})</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => printTable('out-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {L('print')}</button>
          <button onClick={openAdd} className="btn btn-primary">＋ {L('add_out')}</button>
        </div>
      </div>
      <div className="card" style={{ padding:0 }}>
        <table id="out-table" className="table">
          <thead><tr><th>{L('col_ref')}</th><th>{L('col_book_title')}</th><th>{L('col_to')}</th><th>{L('col_subject')}</th><th>{L('col_date')}</th><th>{L('col_status')}</th><th>{L('col_actions')}</th></tr></thead>
          <tbody>{outPageItems.map(l => (
            <tr key={l.id}>
              <td><span style={{ fontFamily:'monospace', background:'rgba(26,107,171,0.1)', color:'#1a6bab', padding:'2px 8px', borderRadius:8, fontWeight:700 }}>{l.ref}</span></td>
              <td style={{ fontWeight:600 }}>{lang==='ar'?l.title:l.titleEn||l.title}</td><td>{lang==='ar'?l.to:l.toEn||l.to}</td>
              <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{lang==='ar'?l.subject:l.subjectEn||l.subject}</td>
              <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{l.date}</td>
              <td><span style={{ background:'#dcfce7', color:'#166534', padding:'2px 8px', borderRadius:8, fontSize:12 }}>{l.status==='sent'?(lang==='ar'?'مُرسَل':'Sent'):l.status}</span></td>
              <td><div style={{ display:'flex', gap:6 }}>
                <button onClick={() => openEdit(l)} style={{ background:'none', border:'none', cursor:'pointer', color:'#1a6bab' }}>✏️</button>
                <button onClick={() => del(l.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444' }}>🗑️</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
        <Pagination currentPage={outCurrentPage} totalPages={outTotalPages} onPageChange={setOutCurrentPage} totalItems={outTotalItems} pageSize={50} lang={lang} />
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:500 }}>
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing ? L('edit_out') : `${L('new_out')} — ${nextRef()}`}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
            <div className="modal-body"><div style={{ display:'grid', gap:12 }}>
              <div><label className="form-label">{L('lbl_title_req')}</label><input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} className="form-control" /></div>
                {multiHospitalEnabled && (
                  <div><label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                    <select value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))} className="form-control">
                      <option value="">—</option>
                      {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                    </select>
                  </div>
                )}
              <div><label className="form-label">{L('lbl_to_req')}</label><input value={form.to} onChange={e=>setForm(p=>({...p,to:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_subject')}</label><input value={form.subject} onChange={e=>setForm(p=>({...p,subject:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_date')}</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_notes')}</label><textarea rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} className="form-control" /></div>
            </div></div>
            <div className="modal-footer"><button onClick={()=>setShowModal(false)} style={{ marginLeft:8,padding:'8px 20px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-primary)',cursor:'pointer' }}>{L('btn_cancel')}</button><button onClick={save} className="btn btn-primary">{L('btn_save')}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── INCOMING LETTERS ───────────────────────────────────────────────────────────
function IncomingTab({ lang }) {
  const { showToast, syncToServer, filterByViewingHospital, hospitals, multiHospitalEnabled } = useApp();
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const [letters, setLetters] = useState(initIncoming);
  useBackendLoad('incoming', setLetters);
  const visibleIncoming = filterByViewingHospital(letters);
  const { pageItems: inPageItems, currentPage: inCurrentPage, setCurrentPage: setInCurrentPage, totalPages: inTotalPages, totalItems: inTotalItems } = usePagination(visibleIncoming, 50);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { title:'', from:'', incomingRef:'', date:today.toISOString().split('T')[0], subject:'', status:'مُستلَم', notes:'' };
  const [form, setForm] = useState(empty);
  const nextRef = () => `و-2026-${String(letters.length+1).padStart(3,'0')}`;
  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = async (id) => {
    setLetters(p=>p.filter(r=>r.id!==id));
    const synced = await syncToServer('incoming','delete',{id});
    showToast(L(synced ? 'deleted' : 'sync_failed'), synced ? 'success' : 'warning');
  };
  const save = async () => {
    if (!form.title || !form.from) { showToast(L('err_title_from'),'error'); return; }
    if (editing) {
      const ul = {...form,id:editing.id};
      setLetters(p=>p.map(r=>r.id===editing.id?ul:r));
      const synced = await syncToServer('incoming','update',ul);
      showToast(L(synced ? 'saved' : 'sync_failed'), synced ? 'success' : 'warning');
    } else {
      const nl = {...form,id:Date.now(),ref:nextRef()};
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
        <h3 style={{ margin:0 }}>{L('in_list')} ({letters.length})</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => printTable('in-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {L('print')}</button>
          <button onClick={openAdd} className="btn btn-primary">＋ {L('add_in')}</button>
        </div>
      </div>
      <div className="card" style={{ padding:0 }}>
        <table id="in-table" className="table">
          <thead><tr><th>{L('col_in_ref')}</th><th>{L('col_sender_ref')}</th><th>{L('col_book_title')}</th><th>{L('col_from')}</th><th>{L('col_subject')}</th><th>{L('col_date')}</th><th>{L('col_status')}</th><th>{L('col_actions')}</th></tr></thead>
          <tbody>{inPageItems.map(l => (
            <tr key={l.id}>
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
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing ? L('edit_in') : `${L('new_in')} — ${nextRef()}`}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
            <div className="modal-body"><div style={{ display:'grid', gap:12 }}>
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
    </div>
  );
}

// ── RETIRED TAB ────────────────────────────────────────────────────────────────
function RetiredTab({ lang }) {
  const { showToast, syncToServer, filterByViewingHospital, hospitals, multiHospitalEnabled, user } = useApp();
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const [retired, setRetired] = useState(initRetired);
  useBackendLoad('retired', setRetired);
  const visibleRetired = filterByViewingHospital(retired);
  const { pageItems: retPageItems, currentPage: retCurrentPage, setCurrentPage: setRetCurrentPage, totalPages: retTotalPages, totalItems: retTotalItems } = usePagination(visibleRetired, 50);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [viewDossier, setViewDossier] = useState(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ type: DOSSIER_TYPES_AR[0], title:'', date:'', notes:'', file:null, fileUrl:null, fileType:'' });
  const [retiredDossiers, setRetiredDossiers] = useState({});
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.get('/dossiers').then(data => {
      if (cancelled || !Array.isArray(data) || data.length === 0) return;
      const grouped = {};
      data.forEach(d => { if (!grouped[d.retiredId]) grouped[d.retiredId] = []; grouped[d.retiredId].push(d); });
      setRetiredDossiers(grouped);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fileDocRef = useRef();
  const DTYPES = lang === 'en' ? DOSSIER_TYPES_EN : DOSSIER_TYPES_AR;
  const empty = { name:'', jobTitle:'', dept:'', retireDate:'', retireSalary:'', pensionNo:'', phone:'', notes:'' };
  const [form, setForm] = useState(empty);
  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({...r}); setShowModal(true); };
  const del = async (id) => {
    setRetired(p=>p.filter(r=>r.id!==id));
    const synced = await syncToServer('retired','delete',{id});
    showToast(L(synced ? 'deleted' : 'sync_failed'), synced ? 'success' : 'warning');
  };
  const save = async () => {
    if (!form.name) { showToast(L('err_name'),'error'); return; }
    if (editing) {
      const ur = {...form,id:editing.id};
      setRetired(p=>p.map(r=>r.id===editing.id?ur:r));
      const synced = await syncToServer('retired','update',ur);
      showToast(L(synced ? 'saved' : 'sync_failed'), synced ? 'success' : 'warning');
    } else {
      const pen = `P-2026-${String(retired.length+1).padStart(3,'0')}`;
      const nr = {...form,id:Date.now(),pensionNo:form.pensionNo||pen};
      setRetired(p=>[...p,nr]);
      const synced = await syncToServer('retired','create',nr);
      if (synced && typeof synced === 'object' && synced.id !== nr.id) {
        setRetired(p => p.map(r => r.id === nr.id ? synced : r));
      }
      showToast(L(synced ? 'added' : 'sync_failed'), synced ? 'success' : 'warning');
    }
    setShowModal(false);
  };
  const getDocs = (id) => retiredDossiers[id] || [];
  const addDoc = async () => {
    if (!docForm.title) { showToast(L('err_doc_title'),'error'); return; }
    const id = viewDossier.id;
    const nd = { ...docForm, id: Date.now() };
    setRetiredDossiers(prev => ({ ...prev, [id]: [...(prev[id]||[]), nd] }));
    // نضيف retiredId لربط الوثيقة بالمتقاعد الصحيح في الخادم
    const synced = await syncToServer('dossiers', 'create', { ...nd, retiredId: id });
    if (synced && typeof synced === 'object' && synced.id !== nd.id) {
      setRetiredDossiers(prev => ({
        ...prev,
        [id]: (prev[id]||[]).map(d => d.id === nd.id ? synced : d),
      }));
    }
    setDocForm({ type: DTYPES[0], title:'', date:'', notes:'', file:null, fileUrl:null, fileType:'' });
    setShowDocModal(false);
    showToast(L(synced ? 'doc_added' : 'sync_failed'), synced ? 'success' : 'warning');
  };
  const delDoc = async (rId, dId) => {
    setRetiredDossiers(prev => ({ ...prev, [rId]: (prev[rId]||[]).filter(d=>d.id!==dId) }));
    const synced = await syncToServer('dossiers', 'delete', { id: dId });
    showToast(L(synced ? 'deleted' : 'sync_failed'), synced ? 'success' : 'warning');
  };
  const handleFile = (e) => { const f = e.target.files[0]; if (!f) return; setDocForm(p=>({...p,file:f,fileUrl:URL.createObjectURL(f),fileType:f.type})); };

  if (viewDossier) {
    const docs = getDocs(viewDossier.id);
    return (
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button onClick={()=>setViewDossier(null)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'6px 14px', cursor:'pointer', color:'var(--text-primary)', fontSize:13 }}>← {L('doss_back')}</button>
          <div>
            <h3 style={{ margin:0 }}>📂 {L('doss_of')}: {viewDossier.name}</h3>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{viewDossier.pensionNo} | {viewDossier.jobTitle} | {viewDossier.dept}</div>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
          <button onClick={() => setShowDocModal(true)} className="btn btn-primary">＋ {L('add_doc')}</button>
        </div>
        {docs.length === 0 ? (
          <div className="card" style={{ textAlign:'center', padding:50, color:'var(--text-secondary)' }}><div style={{ fontSize:40, marginBottom:12 }}>📂</div><p>{L('doss_no_docs')}</p></div>
        ) : (
          <div style={{ display:'grid', gap:12 }}>
            {docs.map(doc => (
              <div key={doc.id} className="card" style={{ padding:14, display:'flex', gap:14, alignItems:'flex-start' }}>
                <div style={{ width:48, height:48, borderRadius:10, background:doc.fileType==='application/pdf'?'#fee2e2':'rgba(26,107,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{doc.fileUrl?(doc.fileType==='application/pdf'?'📄':'🖼️'):'📋'}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{doc.title}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>
                    <span style={{ background:'rgba(139,92,246,0.1)', color:'#8b5cf6', padding:'1px 7px', borderRadius:6, marginLeft:6 }}>{doc.type}</span>
                    {doc.date && <span>📅 {doc.date}</span>}
                  </div>
                  {doc.notes && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{doc.notes}</div>}
                  {doc.fileUrl && <a href={doc.fileUrl} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#1a6bab', textDecoration:'none' }}>👁️ {L('doc_view')}</a>}
                </div>
                <button onClick={() => delDoc(viewDossier.id, doc.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:16 }}>🗑️</button>
              </div>
            ))}
          </div>
        )}
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
                  <input ref={fileDocRef} type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display:'none' }} />
                  <button onClick={() => fileDocRef.current.click()} style={{ width:'100%', padding:'12px', borderRadius:8, border:'2px dashed var(--border)', background:'var(--bg-primary)', cursor:'pointer', color:'var(--text-secondary)', fontSize:13 }}>
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
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0 }}>{L('ret_list')} ({retired.length})</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => printTable('ret-table')} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>🖨️ {L('print')}</button>
          <button onClick={() => setShowImport(true)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>📊 {lang==='ar'?'استيراد من Excel':'Import from Excel'}</button>
          <button onClick={openAdd} className="btn btn-primary">＋ {L('add_ret')}</button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          apiName="retired"
          title={lang==='ar'?'استيراد متقاعدين من Excel':'Import Retired Staff from Excel'}
          lang={lang}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            try {
              const fresh = await api.get('/retired');
              if (Array.isArray(fresh)) setRetired(fresh);
            } catch { /* لو فشل التحديث التلقائي، البيانات محفوظة بالخادم فعلياً */ }
          }}
        />
      )}
      <div className="card" style={{ padding:0 }}>
        <table id="ret-table" className="table">
          <thead><tr><th>{L('col_pension_no')}</th><th>{L('col_name')}</th><th>{L('col_last_pos')}</th><th>{L('col_dept')}</th><th>{L('col_retire_dt')}</th><th>{L('col_pension_sal')}</th><th>{L('lbl_phone')}</th><th>{L('col_dossier')}</th><th>{L('col_actions')}</th></tr></thead>
          <tbody>{retPageItems.map(r => (
            <tr key={r.id}>
              <td><span style={{ fontFamily:'monospace', background:'rgba(139,92,246,0.1)', color:'#8b5cf6', padding:'2px 8px', borderRadius:8, fontWeight:700 }}>{r.pensionNo}</span></td>
              <td style={{ fontWeight:600 }}>{lang==='ar'?r.name:r.nameEn||r.name}</td>
              <td style={{ fontSize:13 }}>{lang==='ar'?r.jobTitle:r.jobTitleEn||r.jobTitle}</td>
              <td><span style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', padding:'2px 8px', borderRadius:8, fontSize:12 }}>{lang==='ar'?r.dept:r.deptEn||r.dept}</span></td>
              <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{r.retireDate}</td>
              <td style={{ fontWeight:600, color:'#8b5cf6' }}>{Number(r.retireSalary).toLocaleString(lang==='ar'?'ar-IQ':'en-US')} {L('iqd')}</td>
              <td style={{ fontSize:12 }}>{r.phone}</td>
              <td><button onClick={() => setViewDossier(r)} style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', border:'1px solid rgba(26,107,171,0.3)', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>
                📂 {getDocs(r.id).length > 0 ? `${getDocs(r.id).length} ${L('docs_count')}` : lang==='ar'?'فتح':'Open'}
              </button></td>
              <td><div style={{ display:'flex', gap:6 }}><button onClick={()=>openEdit(r)} style={{ background:'none',border:'none',cursor:'pointer',color:'#1a6bab' }}>✏️</button><button onClick={()=>del(r.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444' }}>🗑️</button></div></td>
            </tr>
          ))}</tbody>
        </table>
        <Pagination currentPage={retCurrentPage} totalPages={retTotalPages} onPageChange={setRetCurrentPage} totalItems={retTotalItems} pageSize={50} lang={lang} />
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:500 }}>
            <div className="modal-header"><h3 style={{ margin:0 }}>{editing ? L('edit_ret') : L('add_ret')}</h3><button onClick={()=>setShowModal(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22 }}>×</button></div>
            <div className="modal-body"><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ gridColumn:'1/-1' }}><label className="form-label">{L('lbl_fullname')}</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_last_pos')}</label><input value={form.jobTitle} onChange={e=>setForm(p=>({...p,jobTitle:e.target.value}))} className="form-control" /></div>
              {multiHospitalEnabled && (
                <div><label className="form-label">{lang==='ar'?'المنشأة':'Facility'}</label>
                  <select value={form.hospitalId||''} onChange={e=>setForm(p=>({...p,hospitalId:e.target.value}))} className="form-control">
                    <option value="">—</option>
                    {hospitals.map(h=><option key={h.id} value={h.id}>{h.name_ar}</option>)}
                  </select>
                </div>
              )}
              <div><label className="form-label">{L('lbl_dept_lbl')}</label><input value={form.dept} onChange={e=>setForm(p=>({...p,dept:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_retire_dt')}</label><input type="date" value={form.retireDate} onChange={e=>setForm(p=>({...p,retireDate:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_pension_sal')}</label><input type="number" value={form.retireSalary} onChange={e=>setForm(p=>({...p,retireSalary:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_pension_no')}</label><input value={form.pensionNo} onChange={e=>setForm(p=>({...p,pensionNo:e.target.value}))} className="form-control" /></div>
              <div><label className="form-label">{L('lbl_phone')}</label><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className="form-control" /></div>
              <div style={{ gridColumn:'1/-1' }}><label className="form-label">{L('lbl_notes')}</label><textarea rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} className="form-control" /></div>
            </div></div>
            <div className="modal-footer"><button onClick={()=>setShowModal(false)} style={{ marginLeft:8,padding:'8px 20px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-primary)',cursor:'pointer' }}>{L('btn_cancel')}</button><button onClick={save} className="btn btn-primary">{L('btn_save')}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DOSSIERS TAB ───────────────────────────────────────────────────────────────
function DossiersTab({ lang }) {
  const { showToast } = useApp();
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const [dossiers, setDossiers] = useState(initDossiers);
  const [selected, setSelected] = useState(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const DTYPES = lang === 'en' ? DOSSIER_TYPES_EN : DOSSIER_TYPES_AR;
  const [docForm, setDocForm] = useState({ type: DTYPES[0], title:'', date:'', notes:'', file:null, fileUrl:null });
  const fileRef = useRef();
  const currentDossier = dossiers.find(d => d.id === selected);

  const addEmployee = () => {
    const name = window.prompt(L('emp_name_prompt'));
    if (!name) return;
    const nd = { id:Date.now(), employeeId:Date.now(), employeeName:name, docs:[] };
    setDossiers(p=>[...p,nd]); setSelected(nd.id); showToast(L('doc_created'),'success');
  };
  const addDoc = () => {
    if (!docForm.title) { showToast(L('err_doc_title'),'error'); return; }
    setDossiers(p => p.map(d => d.id === selected ? { ...d, docs: [...d.docs, { ...docForm, id:Date.now() }] } : d));
    setDocForm({ type: DTYPES[0], title:'', date:'', notes:'', file:null, fileUrl:null });
    setShowDocModal(false); showToast(L('doc_added'),'success');
  };
  const delDoc = (dossierId, docId) => { setDossiers(p=>p.map(d=>d.id===dossierId?{...d,docs:d.docs.filter(doc=>doc.id!==docId)}:d)); showToast(L('doc_deleted'),'success'); };
  const handleFile = (e) => { const f = e.target.files[0]; if (!f) return; setDocForm(p=>({...p,file:f,fileUrl:URL.createObjectURL(f),fileType:f.type})); };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20 }}>
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <h4 style={{ margin:0, fontSize:14 }}>{L('dos_employees')}</h4>
          <button onClick={addEmployee} style={{ background:'#1a6bab', color:'#fff', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 }}>＋</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {dossiers.map(d => (
            <button key={d.id} onClick={() => setSelected(d.id)} style={{ padding:'10px 12px', borderRadius:9, border:`1px solid ${selected===d.id?'#1a6bab':'var(--border)'}`, background:selected===d.id?'rgba(26,107,171,0.1)':'var(--bg-secondary)', color:selected===d.id?'#1a6bab':'var(--text-primary)', cursor:'pointer', textAlign:'right', fontSize:13, fontFamily:'inherit', fontWeight:selected===d.id?700:400 }}>
              👤 {d.employeeName}
              <span style={{ fontSize:11, color:'var(--text-secondary)', display:'block', marginTop:2 }}>{d.docs.length} {L('docs_count')}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        {!selected ? (
          <div className="card" style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-secondary)' }}><div style={{ fontSize:48, marginBottom:12 }}>📂</div><p>{L('dos_select')}</p></div>
        ) : (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ margin:0 }}>{L('dos_dossier_of')} {currentDossier?.employeeName}</h3>
              <button onClick={() => setShowDocModal(true)} className="btn btn-primary">＋ {L('add_doc')}</button>
            </div>
            {currentDossier?.docs.length === 0 ? (
              <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text-secondary)' }}>{L('dos_no_docs')}</div>
            ) : (
              <div style={{ display:'grid', gap:12 }}>
                {currentDossier.docs.map(doc => (
                  <div key={doc.id} className="card" style={{ padding:14, display:'flex', gap:14, alignItems:'flex-start' }}>
                    <div style={{ width:48, height:48, borderRadius:10, background:doc.fileType==='application/pdf'?'#fee2e2':'rgba(26,107,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{doc.fileUrl?(doc.fileType==='application/pdf'?'📄':'🖼️'):'📋'}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{doc.title}</div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>
                        <span style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', padding:'1px 7px', borderRadius:6, marginLeft:6 }}>{doc.type}</span>
                        {doc.date && <span>📅 {doc.date}</span>}
                      </div>
                      {doc.notes && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{doc.notes}</div>}
                      {doc.fileUrl && <a href={doc.fileUrl} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#1a6bab', textDecoration:'none' }}>👁️ {L('doc_view')}</a>}
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

// ── MAIN HR PAGE ───────────────────────────────────────────────────────────────
export default function HRPage() {
  const { lang } = useApp();
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const [tab, setTab] = useState('employees');

  const HR_TABS = [
    { key:'employees', label: L('tab_employees'), icon:'👥' },
    { key:'outgoing',  label: L('tab_outgoing'),  icon:'📤' },
    { key:'incoming',  label: L('tab_incoming'),  icon:'📥' },
    { key:'retired',   label: L('tab_retired'),   icon:'👴' },
    { key:'dossiers',  label: L('tab_dossiers'),  icon:'📂' },
  ];

  return (
    <div className="page-content">
      <div style={{ background:'linear-gradient(135deg,#1c1917,#44403c)', borderRadius:16, padding:'24px 28px', marginBottom:24, color:'#fff', display:'flex', alignItems:'center', gap:16 }}>
        <span style={{ fontSize:36 }}>👔</span>
        <div>
          <h1 style={{ margin:0, fontSize:22 }}>{L('hr_title')}</h1>
          <p style={{ margin:'4px 0 0', opacity:0.7, fontSize:13 }}>{L('hr_subtitle')}</p>
        </div>
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:24, flexWrap:'wrap' }}>
        {HR_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding:'9px 18px', borderRadius:10, border:`2px solid ${tab===t.key?'#1a6bab':'var(--border)'}`, background:tab===t.key?'#1a6bab':'var(--bg-secondary)', color:tab===t.key?'#fff':'var(--text-primary)', cursor:'pointer', fontSize:13, fontWeight:tab===t.key?700:400, display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'employees' && <EmployeesTab lang={lang} />}
      {tab === 'outgoing'  && <OutgoingTab  lang={lang} />}
      {tab === 'incoming'  && <IncomingTab  lang={lang} />}
      {tab === 'retired'   && <RetiredTab   lang={lang} />}
      {tab === 'dossiers'  && <DossiersTab  lang={lang} />}
    </div>
  );
}

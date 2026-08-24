// frontend/src/pages/hr/shared.js
//
// ثوابت ودوال مساعدة مشتركة بين كل تبويبات صفحة الموارد البشرية — استُخرجت
// من HRPage.js الأصلي (كان 1261 سطر بملف واحد) كجزء من تقسيمه لملفات أصغر.
// نُقلت هذه المحتويات بالضبط (نسخ حرفي، بدون أي تعديل منطقي) لتقليل خطر
// الأخطاء أثناء التقسيم.
import { useApp } from '../../contexts/AppContext';
import { api } from '../../api';
import { useEffect } from 'react';

function useBackendLoad(backendKey, setState) {
  const { user } = useApp();
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.get(`/${backendKey}`)
      .then(data => {
        if (!cancelled && Array.isArray(data)) setState(data);
      })
      .catch(() => {}); // الباك إند لا يعمل — نكمل بالبيانات المحلية بدون كسر
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ── MOCK DATA ──────────────────────────────────────────────────────────────────
const today = new Date();
const addMonths = (d, m) => { const r = new Date(d); r.setMonth(r.getMonth()+m); return r.toISOString().split('T')[0]; };

// ── إصلاح: كانت هذه بيانات تجريبية وهمية (4 موظفين برواتب حقيقية، كتب صادرة
// وواردة، متقاعد) تظهر تلقائياً كـ"احتياط" لأول مستخدم جديد قبل أن يضيف أي
// سجل حقيقي — بدون أي تمييز إنها وهمية. تبدأ فاضية بصراحة الآن.
const initEmployees = [];
const initOutgoing = [];
const initIncoming = [];
const initRetired = [];
const initAdjustmentTypes = [];
const initPromotionCycles = [];
const initPromotionAdjustments = [];
// ── إصلاح: initDossiers ما عادت مستخدَمة — DossiersTab صار يجيب البيانات
// الحقيقية من الباك إند مباشرة (راجع التعليق أعلى تعريف DossiersTab).
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

  // ── نظام حساب استحقاق العلاوة/الترفيع ──────────────────────────────────────
  lbl_certificate:    { ar:'الشهادة',                    en:'Certificate' },
  tab_adjustment_types:{ ar:'أنواع التعديلات',           en:'Adjustment Types' },
  tab_promotion_cycles:{ ar:'دورات الترفيع',             en:'Promotion Cycles' },
  tab_promotion_adjustments:{ ar:'تعديلات الموظفين',     en:'Employee Adjustments' },
  adj_types_list:     { ar:'أنواع التعديلات',             en:'Adjustment Types' },
  add_adj_type:       { ar:'إضافة نوع تعديل',             en:'Add Adjustment Type' },
  edit_adj_type:      { ar:'تعديل نوع تعديل',             en:'Edit Adjustment Type' },
  col_direction:      { ar:'الاتجاه',                     en:'Direction' },
  lbl_name_ar_req:    { ar:'الاسم بالعربية *',             en:'Name (Arabic) *' },
  lbl_name_en:        { ar:'الاسم بالإنجليزية',            en:'Name (English)' },
  lbl_direction:      { ar:'الاتجاه *',                    en:'Direction *' },
  direction_advances: { ar:'يقدّم تاريخ الاستحقاق',         en:'Advances due date' },
  direction_delays:   { ar:'يؤخّر تاريخ الاستحقاق',         en:'Delays due date' },
  err_name_direction: { ar:'أدخل الاسم والاتجاه',           en:'Enter name and direction' },
  cycles_list:        { ar:'دورات الترفيع حسب الشهادة',    en:'Promotion Cycles by Certificate' },
  add_cycle:          { ar:'إضافة دورة',                   en:'Add Cycle' },
  edit_cycle:         { ar:'تعديل دورة',                   en:'Edit Cycle' },
  col_grade_optional: { ar:'الدرجة (اختياري)',             en:'Grade (optional)' },
  col_cycle_years:    { ar:'عدد سنوات الدورة',             en:'Cycle Years' },
  lbl_certificate_req:{ ar:'الشهادة *',                    en:'Certificate *' },
  lbl_grade_optional: { ar:'الدرجة الوظيفية (اتركها فارغة لتنطبق على كل الدرجات)', en:'Grade (leave blank to apply to all grades)' },
  lbl_cycle_years_req:{ ar:'عدد سنوات الدورة *',            en:'Cycle Years *' },
  err_cert_years:     { ar:'أدخل الشهادة وعدد سنوات الدورة', en:'Enter certificate and cycle years' },
  placeholder_badge:  { ar:'⚠️ قيمة مبدئية — تحتاج تأكيد',   en:'⚠️ Placeholder — needs confirmation' },
  adjustments_list:   { ar:'سجلات تعديل مواعيد الموظفين',   en:'Employee Due-Date Adjustments' },
  add_adjustment:     { ar:'إضافة تعديل',                  en:'Add Adjustment' },
  edit_adjustment:    { ar:'تعديل سجل',                    en:'Edit Adjustment' },
  col_employee:       { ar:'الموظف',                       en:'Employee' },
  col_adj_type:       { ar:'نوع التعديل',                  en:'Adjustment Type' },
  col_duration:       { ar:'المدة (أشهر)',                 en:'Duration (months)' },
  col_decision_no:    { ar:'رقم القرار',                   en:'Decision No.' },
  lbl_employee_req:   { ar:'الموظف *',                     en:'Employee *' },
  lbl_adj_type_req:   { ar:'نوع التعديل *',                 en:'Adjustment Type *' },
  lbl_duration_req:   { ar:'المدة بالأشهر *',               en:'Duration (months) *' },
  lbl_decision_no:    { ar:'رقم القرار',                   en:'Decision No.' },
  err_emp_type_duration:{ ar:'اختر الموظف ونوع التعديل وأدخل المدة', en:'Select employee, adjustment type and enter duration' },
  due_soon_title:     { ar:'مواعيد استحقاق قريبة',          en:'Upcoming Due Dates' },
  due_type_allowance: { ar:'علاوة',                         en:'Allowance' },
  due_type_promotion: { ar:'ترفيع',                         en:'Promotion' },
  due_overdue:        { ar:'متأخر',                         en:'Overdue' },
  due_in_days:        { ar:'خلال',                          en:'in' },
  due_days_unit:      { ar:'يوماً',                         en:'days' },
};

// ── HELPERS ────────────────────────────────────────────────────────────────────
const monthsAgo = (dateStr) => { if (!dateStr) return 999; const d = new Date(dateStr); return Math.floor((today - d) / (1000*60*60*24*30)); };
const monthsUntil = (dateStr) => { if (!dateStr) return 999; const d = new Date(dateStr); return Math.floor((d - today) / (1000*60*60*24*30)); };
// اتجاه نافذة الطباعة يتبع لغة الواجهة الحالية وقت الطباعة (نفس المصدر
// المُعتمَد أصلاً لإصلاح محاذاة الجداول/الرسوم — document.documentElement.dir،
// الذي يُحدَّثه AppContext عند كل تبديل لغة) بدل rtl الثابتة سابقاً.
const printTable = (id) => {
  const el = document.getElementById(id); if (!el) return;
  const dir = document.documentElement.dir === 'ltr' ? 'ltr' : 'rtl';
  const align = dir === 'rtl' ? 'right' : 'left';
  const w = window.open('','_blank');
  w.document.write(`<html dir="${dir}"><head><style>body{font-family:Arial;direction:${dir}}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:${align}}th{background:#1a6bab;color:#fff}</style></head><body>${el.outerHTML}</body></html>`);
  w.document.close(); w.print();
};

export {
  useBackendLoad, today, addMonths,
  initEmployees, initOutgoing, initIncoming, initRetired,
  initAdjustmentTypes, initPromotionCycles, initPromotionAdjustments,
  DOSSIER_TYPES_AR, DOSSIER_TYPES_EN, I18N,
  monthsAgo, monthsUntil, printTable,
};

// frontend/src/pages/accounts/shared.js
//
// ثوابت ودوال مساعدة مشتركة بين كل تبويبات صفحة الحسابات — استُخرجت من
// AccountsPage.js الأصلي (كان 994 سطر بملف واحد) كجزء من تقسيمه لملفات
// أصغر. نُقلت هذه المحتويات بالضبط (نسخ حرفي، بدون أي تعديل منطقي).
import { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../api';

// ── MOCK DATA ──────────────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0];

// ── إصلاح: كانت هذه بيانات تجريبية وهمية (معاملات مالية، ترفيعات، علاوات
// برواتب وأرقام قرارات حقيقية الشكل) تظهر تلقائياً كـ"احتياط" لأول مستخدم
// جديد. تبدأ فاضية بصراحة الآن.
const initTransactions = [];
const initPromotions = [];
const initAllowances = [];

const ACCT_CATS = { 'دخل':['revenue','donation','grant'], 'مصروف':['salaries','supplies','maintenance','rent','utilities','other'] };
const METHODS_KEYS = ['cash','bank','card','check'];

// Grade translation map for display
const GRADE_EN = {'الأولى':'First','الثانية':'Second','الثالثة':'Third','الرابعة':'Fourth','الخامسة':'Fifth','السادسة':'Sixth','السابعة':'Seventh'};
const gradeEn = (g) => { if (!g) return g; const parts = g.split('/'); const en = GRADE_EN[parts[0]]; return en ? (parts[1]?`${en}/${parts[1]}`:en) : g; };

const TR_LABELS = (tr) => ({
  income:tr('acc_filter_in'), expense:tr('acc_filter_out'),
  revenue:tr('acc_cat_revenue'), donation:tr('acc_cat_donation'), grant:tr('acc_cat_grant'),
  salaries:tr('acc_cat_salaries'), supplies:tr('acc_cat_supplies'), maintenance:tr('acc_cat_maintenance'),
  rent:tr('acc_cat_rent'), utilities:tr('acc_cat_utilities'), other:tr('acc_cat_other'),
  cash:tr('acc_method_cash'), bank:tr('acc_method_bank'), card:tr('acc_method_card'), check:tr('acc_method_check'),
  done:tr('acc_status_done'), due:tr('acc_status_due'), paid:tr('acc_status_paid'),
  pending:tr('acc_status_pending'), process:tr('acc_status_process'), rejected:tr('leave_status_rej2'),
});
const displayValue = (value, tr) => ({
  'دخل': tr('acc_filter_in'),
  'مصروف': tr('acc_filter_out'),
  'إيراد': tr('acc_cat_revenue'),
  'تبرع': tr('acc_cat_donation'),
  'منحة': tr('acc_cat_grant'),
  'رواتب': tr('acc_cat_salaries'),
  'مستلزمات': tr('acc_cat_supplies'),
  'صيانة': tr('acc_cat_maintenance'),
  'إيجار': tr('acc_cat_rent'),
  'كهرباء وماء': tr('acc_cat_utilities'),
  'أخرى': tr('acc_cat_other'),
  'نقداً': tr('acc_method_cash'),
  'تحويل': tr('acc_method_bank'),
  'بطاقة': tr('acc_method_card'),
  'مُنجَز': tr('acc_status_done'),
  'مستحق': tr('acc_status_due'),
  'مستحقة': tr('acc_status_due'),
  'مدفوع': tr('acc_status_paid'),
  // ── ملاحظة: "مصروف" أصلاً موجودة أعلاه كترجمة لنوع الحركة المالية (Expense
  // بالمعاملات العامة). حالة "مدفوع" (البدلات/الرواتب) صارت كلمة منفصلة
  // بالكامل الآن، فلا يوجد تعارض إطلاقاً — ترجمتها تعمل بشكل صحيح بكل الواجهتين.
  'معلق': tr('acc_status_pending'),
  'قيد المعالجة': tr('acc_status_process'),
  'مرفوض': tr('leave_status_rej2'),
  'علاوة سنوية': tr('acc_allowance_annual'),
  'علاوة خطورة': tr('acc_allowance_risk'),
  'علاوة ميدانية': tr('acc_allowance_field'),
  'علاوة تخصص': tr('acc_allowance_specialty'),
  'علاوة اجتماعية': tr('acc_allowance_social'),
  'بدل مواصلات': tr('acc_transport_allowance'),
  'ضريبة': tr('acc_tax'),
  'سلفة': tr('acc_advance'),
}[value] || value);

// اتجاه نافذة الطباعة يتبع لغة الواجهة الحالية وقت الطباعة (نفس المصدر
// المُعتمَد أصلاً لإصلاح محاذاة الجداول/الرسوم — document.documentElement.dir،
// الذي يُحدَّثه AppContext عند كل تبديل لغة) بدل rtl الثابتة سابقاً.
const printTable = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  const dir = document.documentElement.dir === 'ltr' ? 'ltr' : 'rtl';
  const align = dir === 'rtl' ? 'right' : 'left';
  const w = window.open('','_blank');
  w.document.write(`<html dir="${dir}"><head><style>body{font-family:Arial;direction:${dir}}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:${align}}th{background:#1a6bab;color:#fff}</style></head><body>${el.outerHTML}</body></html>`);
  w.document.close(); w.print();
};

// دالة موحّدة: تحمّل التبويب من localStorage (يحل مشكلة فقدان البيانات عند التنقل)
// ثم تحاول تحمّل نسخة أحدث من الباك إند الحقيقي لو مسجّلة دخول
// إصلاح: كانت تتجاهل رد الخادم كلياً لو رجع مصفوفة فاضية — نفس خلل
// AppContext بالضبط. لو التبويب فعلاً فاضي بقاعدة البيانات (صفر معاملات/
// علاوات/رواتب)، تبقى الصفحة تعرض بيانات localStorage قديمة للأبد بدل
// الصفر الصحيح. الآن نثق بأي رد صالح (مصفوفة) من الخادم.
function usePersistedTab(storageKey, backendKey, initialData) {
  const { user } = useApp();
  const [data, setData] = useState(() => {
    try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : initialData; } catch { return initialData; }
  });
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(data)); }, [data, storageKey]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.get(`/${backendKey}`).then(serverData => {
      if (!cancelled && Array.isArray(serverData)) setData(serverData);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return [data, setData];
}

// ── إصلاح: كانت هذه بيانات رواتب وهمية (4 موظفين برواتب وعلاوات وخصومات
// حقيقية الشكل) تظهر تلقائياً كـ"احتياط". تبدأ فاضية بصراحة الآن.
const initSalaries = [];

// إصلاح: 47 من 83 سجل راتب حقيقي بلا baseSalary (Number(undefined) = NaN)،
// وكان NaN سطر واحد يُفسد كامل مجموع totalNet بصفحة الرواتب (يظهر "NaN د.ع"
// بدل رقم حقيقي). كل حقل رقمي هنا يسقط لـ0 لو مفقود/غير رقمي بدل إفساد
// المجموع — السجل نفسه يبقى ظاهراً بالجدول كما هو (لا نُخفيه)، فقط لا
// يُحتسَب فيه راتب أساسي وهمي. hasBaseSalary تُصدَّر ليستخدمها العرض
// لوضع شارة تنبيه بدل إخفاء المشكلة صامتاً.
function hasBaseSalary(emp) {
  return emp.baseSalary !== undefined && emp.baseSalary !== null && emp.baseSalary !== '' && !isNaN(Number(emp.baseSalary));
}

function calcNet(emp) {
  const totalAdd = (emp.additions||[]).reduce((s,a) => s+(Number(a.amount)||0), 0);
  const totalDed = (emp.deductions||[]).reduce((s,d) => s+(Number(d.amount)||0), 0);
  return (Number(emp.baseSalary)||0) + totalAdd - totalDed;
}

export {
  today, initTransactions, initPromotions, initAllowances, initSalaries,
  ACCT_CATS, METHODS_KEYS, GRADE_EN, gradeEn,
  TR_LABELS, displayValue, printTable, usePersistedTab, calcNet, hasBaseSalary,
};

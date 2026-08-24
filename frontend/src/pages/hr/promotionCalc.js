// frontend/src/pages/hr/promotionCalc.js
//
// محرّك حساب استحقاق العلاوة/الترفيع — منطق أعمال حتمي بحت (بدون أي ذكاء
// اصطناعي)، يعمل مباشرة على سجل الموظف نفسه (lastPromotion/lastAllowance/
// certificate بصفحة الموظفين) بلا أي جدول منفصل — يُستدعى من AlertBanner.js
// وAppContext.js (إشعارات لوحة التحكم) وEmployeesTab.js (عمودا تاريخ
// الاستحقاق القادم).
//
// ── القاعدة: تاريخ آخر ترفيع/علاوة (أو تاريخ التعيين لموظف لم يُرفَّع/تُصرَف
// له علاوة بعد) + مدة الدورة بالسنوات = تاريخ الاستحقاق القادم. مدة دورة
// الترفيع تعتمد على الشهادة (قيم مبدئية أدناه، راجع التعليق)، ومدة دورة
// العلاوة سنة واحدة ثابتة (علاوة سنوية).
import { addMonths } from './shared';

// ⚠️ قيم مبدئية توضيحية فقط لعدد سنوات دورة الترفيع حسب الشهادة — ليست أرقاماً
// رسمية. عدِّلها هنا مباشرة عند توفر القيم الفعلية من الموارد البشرية.
const PROMOTION_CYCLE_YEARS_BY_CERTIFICATE = {
  'دبلوم': 5,
  'بكالوريوس': 4,
  'ماجستير': 3,
  'دكتوراه': 3,
};
const DEFAULT_PROMOTION_CYCLE_YEARS = 4;
const ALLOWANCE_CYCLE_YEARS = 1; // علاوة سنوية ثابتة

function calcDueFromBase(baseDateStr, cycleYears, todayStr) {
  if (!baseDateStr) return { available: false, reason: 'no-base-date' };
  const dueDate = addMonths(baseDateStr, cycleYears * 12);
  const daysUntil = Math.floor((new Date(dueDate) - new Date(todayStr)) / (1000 * 60 * 60 * 24));
  return { available: true, dueDate, daysUntil, overdue: daysUntil < 0 };
}

// تاريخ استحقاق الترفيع القادم لموظف واحد.
export function calcPromotionDue(employee, todayStr = new Date().toISOString().split('T')[0]) {
  const baseDate = employee.lastPromotion || employee.hireDate;
  const cycleYears = PROMOTION_CYCLE_YEARS_BY_CERTIFICATE[(employee.certificate || '').trim()] || DEFAULT_PROMOTION_CYCLE_YEARS;
  return calcDueFromBase(baseDate, cycleYears, todayStr);
}

// تاريخ استحقاق العلاوة القادمة لموظف واحد.
export function calcAllowanceDue(employee, todayStr = new Date().toISOString().split('T')[0]) {
  const baseDate = employee.lastAllowance || employee.hireDate;
  return calcDueFromBase(baseDate, ALLOWANCE_CYCLE_YEARS, todayStr);
}

// frontend/src/pages/hr/promotionCalc.js
//
// محرّك حساب استحقاق العلاوة/الترفيع — منطق أعمال حتمي بحت (بدون أي ذكاء
// اصطناعي)، يُستدعى من AlertBanner.js وAppContext.js (إشعارات لوحة التحكم)
// وأي مكان آخر يحتاج معرفة الموعد القادم لموظف معيّن.
//
// ── القاعدة: تاريخ الترفيع الأساسي (lastPromotion، أو hireDate لموظف لم
// يُرفَّع بعد) + دورة سنوات (من جدول الشهادة/الدرجة) = تسلسل مواعيد سنوية:
// السنوات 1..cycleYears-1 كل واحدة "علاوة"، والسنة cycleYears نفسها "ترفيع".
// كل سجل تعديل (كتاب شكر، إجازة، عقوبة...) يزيح كل هذا التسلسل بالكامل
// مبكراً (advances) أو مؤخراً (delays) بمقدار مدته بالأشهر — إزاحة واحدة
// موحَّدة تُطبَّق على كل مواعيد الدورة، لا إزاحة متفاوتة لكل موعد على حدة.
import { addMonths } from './shared';

// يبحث عن أدق تطابق بجدول الدورات: شهادة+درجة معاً أولاً، ثم شهادة وحدها
// (grade فارغ = ينطبق على كل الدرجات لتلك الشهادة). null لو ما فيه أي تطابق
// إطلاقاً — يعني الموظف يحتاج تسجيل شهادته و/أو إضافة صف بالجدول له.
function findCycle(employee, cycles) {
  const cert = (employee.certificate || '').trim();
  const grade = (employee.grade || '').trim();
  if (!cert) return null;
  const exact = cycles.find(c => (c.certificate || '').trim() === cert && (c.grade || '').trim() && (c.grade || '').trim() === grade);
  if (exact) return exact;
  const generic = cycles.find(c => (c.certificate || '').trim() === cert && !(c.grade || '').trim());
  return generic || null;
}

// مجموع أشهر التقديم (advances) والتأخير (delays) لموظف معيّن من كل سجلات
// التعديل الخاصة فيه — direction مأخوذ من السجل نفسه (منسوخ وقت الإدخال من
// نوع التعديل، راجع migrations-sql/012_promotion_cycle_system.sql).
function sumAdjustmentMonths(employeeId, adjustments) {
  let advanceMonths = 0;
  let delayMonths = 0;
  adjustments
    .filter(a => String(a.employeeId) === String(employeeId))
    .forEach(a => {
      const months = Number(a.durationMonths) || 0;
      if (a.direction === 'advances') advanceMonths += months;
      else if (a.direction === 'delays') delayMonths += months;
    });
  return { advanceMonths, delayMonths, netMonths: delayMonths - advanceMonths };
}

// يحسب الموعد القادم (علاوة أو ترفيع) لموظف واحد. لا يفترض أي بيانات ناقصة —
// يرجع available:false مع سبب واضح لو الموظف بلا شهادة مسجَّلة، أو بلا صف
// دورة مطابق بالجدول، أو بلا تاريخ أساس إطلاقاً (لا lastPromotion ولا hireDate).
export function calcNextDue(employee, cycles, adjustments, todayStr = new Date().toISOString().split('T')[0]) {
  const baseDateStr = employee.lastPromotion || employee.hireDate;
  if (!baseDateStr) return { available: false, reason: 'no-base-date' };

  const cycle = findCycle(employee, cycles);
  if (!cycle) return { available: false, reason: employee.certificate ? 'no-cycle-mapping' : 'no-certificate' };
  const cycleYears = Number(cycle.cycleYears) || 0;
  if (cycleYears <= 0) return { available: false, reason: 'no-cycle-mapping' };

  const { advanceMonths, delayMonths, netMonths } = sumAdjustmentMonths(employee.id, adjustments);

  let dueN = null;
  let dueDateStr = null;
  for (let n = 1; n <= cycleYears; n++) {
    const d = addMonths(baseDateStr, n * 12 + netMonths);
    if (d >= todayStr) { dueN = n; dueDateStr = d; break; }
  }
  if (dueN === null) {
    // كل مواعيد الدورة مضت — الترفيع (آخر موعد بالدورة) متأخر ولم يُصرَف بعد
    dueN = cycleYears;
    dueDateStr = addMonths(baseDateStr, cycleYears * 12 + netMonths);
  }

  const daysUntil = Math.floor((new Date(dueDateStr) - new Date(todayStr)) / (1000 * 60 * 60 * 24));

  return {
    available: true,
    type: dueN === cycleYears ? 'promotion' : 'allowance',
    dueDate: dueDateStr,
    daysUntil,
    overdue: daysUntil < 0,
    cycleYears,
    cycleNumber: dueN,
    isPlaceholder: !!cycle.isPlaceholder,
    advanceMonths,
    delayMonths,
  };
}

// يحسب الموعد القادم لكل موظفي القائمة دفعة واحدة — يُستخدم من AlertBanner.js
// وAppContext.js. dueWithinDays: عتبة "قريب الاستحقاق" (افتراضياً 30 يوماً،
// راجع طلب الميزة الأصلي).
export function calcAllDue(employees, cycles, adjustments, { dueWithinDays = 30, todayStr } = {}) {
  return employees
    .map(e => ({ employee: e, due: calcNextDue(e, cycles, adjustments, todayStr) }))
    .filter(r => r.due.available && r.due.daysUntil <= dueWithinDays);
}

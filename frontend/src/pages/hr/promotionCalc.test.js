// frontend/src/pages/hr/promotionCalc.test.js
//
// اختبارات محرّك حساب استحقاق العلاوة/الترفيع. القاعدة: تاريخ ترفيع أساسي +
// دورة سنوات (من جدول الشهادة/الدرجة) = تسلسل مواعيد سنوية (علاوة لكل سنة
// قبل الأخيرة، ترفيع بالسنة الأخيرة)، مُزاح بمجموع صافي أشهر التعديلات
// (تأخير - تقديم).
import { calcNextDue, calcAllDue } from './promotionCalc';

const daysBetween = (fromStr, toStr) => Math.floor((new Date(toStr) - new Date(fromStr)) / (1000 * 60 * 60 * 24));

const cycles = [
  { certificate: 'بكالوريوس', grade: '', cycleYears: 4, isPlaceholder: true },
  { certificate: 'دبلوم', grade: '', cycleYears: 5, isPlaceholder: true },
  // صف أدق (شهادة+درجة معاً) يجب أن يفوز على الصف العام لنفس الشهادة
  { certificate: 'بكالوريوس', grade: 'الرابعة', cycleYears: 6, isPlaceholder: false },
];

describe('calcNextDue', () => {
  test('يرجع available:false مع سبب واضح لو الموظف بلا شهادة مسجَّلة', () => {
    const emp = { id: 1, lastPromotion: '2020-01-15', grade: 'الأولى' };
    expect(calcNextDue(emp, cycles, [], '2022-01-01')).toEqual({ available: false, reason: 'no-certificate' });
  });

  test('يرجع available:false لو الشهادة مسجَّلة لكن لا يوجد صف دورة مطابق بالجدول', () => {
    const emp = { id: 1, certificate: 'إعدادية', lastPromotion: '2020-01-15' };
    expect(calcNextDue(emp, cycles, [], '2022-01-01')).toEqual({ available: false, reason: 'no-cycle-mapping' });
  });

  test('يرجع available:false لو لا يوجد تاريخ أساس إطلاقاً (لا lastPromotion ولا hireDate)', () => {
    const emp = { id: 1, certificate: 'بكالوريوس', grade: 'الأولى' };
    expect(calcNextDue(emp, cycles, [], '2022-01-01')).toEqual({ available: false, reason: 'no-base-date' });
  });

  test('يستخدم hireDate كتاريخ أساس لموظف لم يُرفَّع بعد (lastPromotion فارغ)', () => {
    const emp = { id: 1, certificate: 'بكالوريوس', grade: 'الأولى', hireDate: '2021-01-15' };
    const result = calcNextDue(emp, cycles, [], '2021-06-01');
    expect(result.available).toBe(true);
    expect(result.dueDate).toBe('2022-01-15'); // سنة 1 من hireDate
    expect(result.type).toBe('allowance');
  });

  test('يختار الصف الأدق (شهادة+درجة معاً) بدل الصف العام لنفس الشهادة', () => {
    const emp = { id: 1, certificate: 'بكالوريوس', grade: 'الرابعة', lastPromotion: '2020-01-15' };
    const result = calcNextDue(emp, cycles, [], '2020-06-01');
    expect(result.cycleYears).toBe(6); // الصف الأدق، وليس 4 من الصف العام
  });

  test('السنوات قبل الأخيرة "علاوة"، والسنة الأخيرة من الدورة "ترفيع"', () => {
    const emp = { id: 1, certificate: 'بكالوريوس', grade: 'الأولى', lastPromotion: '2020-01-15' };
    // بين موعد السنة 2 (2022-01-15) والسنة 3 (2023-01-15) — القادم "علاوة" سنة 3
    const allowanceDue = calcNextDue(emp, cycles, [], '2022-06-01');
    expect(allowanceDue.type).toBe('allowance');
    expect(allowanceDue.cycleNumber).toBe(3);
    expect(allowanceDue.dueDate).toBe('2023-01-15');

    // بين موعد السنة 3 والسنة 4 (الأخيرة، cycleYears=4) — القادم "ترفيع"
    const promotionDue = calcNextDue(emp, cycles, [], '2023-06-01');
    expect(promotionDue.type).toBe('promotion');
    expect(promotionDue.cycleNumber).toBe(4);
    expect(promotionDue.dueDate).toBe('2024-01-15');
  });

  test('ترفيع متأخر (كل مواعيد الدورة مضت ولم يُصرَف الترفيع بعد) يُعلَّم overdue:true', () => {
    const emp = { id: 1, certificate: 'بكالوريوس', grade: 'الأولى', lastPromotion: '2015-01-15' };
    const result = calcNextDue(emp, cycles, [], '2025-01-01'); // بعد 2019-01-15 (موعد السنة 4) بكثير
    expect(result.type).toBe('promotion');
    expect(result.overdue).toBe(true);
    expect(result.dueDate).toBe('2019-01-15');
    expect(result.daysUntil).toBeLessThan(0);
  });

  test('كتاب شكر وتقدير واحد (advances) يقدّم الموعد القادم بمقدار مدته بالضبط', () => {
    const emp = { id: 1, certificate: 'بكالوريوس', grade: 'الأولى', lastPromotion: '2020-01-15' };
    const withoutAdjustment = calcNextDue(emp, cycles, [], '2020-06-01');
    const withAdvance = calcNextDue(emp, cycles, [
      { employeeId: 1, direction: 'advances', durationMonths: 2 },
    ], '2020-06-01');
    expect(withoutAdjustment.dueDate).toBe('2021-01-15');
    expect(withAdvance.dueDate).toBe('2020-11-15'); // شهرين أبكر بالضبط
  });

  test('عدة كتب شكر تتراكم (كل واحد يطرح مدته الخاصة)', () => {
    const emp = { id: 1, certificate: 'بكالوريوس', grade: 'الأولى', lastPromotion: '2020-01-15' };
    const result = calcNextDue(emp, cycles, [
      { employeeId: 1, direction: 'advances', durationMonths: 1 },
      { employeeId: 1, direction: 'advances', durationMonths: 6 },
    ], '2020-06-01');
    expect(result.advanceMonths).toBe(7);
    expect(result.dueDate).toBe('2020-06-15'); // 2021-01-15 ناقص 7 أشهر
  });

  test('إجازة/عقوبة (delays) تؤخّر الموعد القادم بمقدار مدتها', () => {
    const emp = { id: 1, certificate: 'بكالوريوس', grade: 'الأولى', lastPromotion: '2020-01-15' };
    const result = calcNextDue(emp, cycles, [
      { employeeId: 1, direction: 'delays', durationMonths: 3 },
    ], '2020-06-01');
    expect(result.delayMonths).toBe(3);
    expect(result.dueDate).toBe('2021-04-15'); // 2021-01-15 زائد 3 أشهر
  });

  test('التقديم والتأخير يتصافيان (صافي الأشهر = تأخير - تقديم)', () => {
    const emp = { id: 1, certificate: 'بكالوريوس', grade: 'الأولى', lastPromotion: '2020-01-15' };
    const result = calcNextDue(emp, cycles, [
      { employeeId: 1, direction: 'advances', durationMonths: 4 },
      { employeeId: 1, direction: 'delays', durationMonths: 6 },
    ], '2020-06-01');
    expect(result.dueDate).toBe('2021-03-15'); // صافي +2 أشهر (6-4)
  });

  test('سجلات تعديل موظف آخر لا تؤثر إطلاقاً على حساب هذا الموظف', () => {
    const emp = { id: 1, certificate: 'بكالوريوس', grade: 'الأولى', lastPromotion: '2020-01-15' };
    const result = calcNextDue(emp, cycles, [
      { employeeId: 999, direction: 'advances', durationMonths: 12 },
    ], '2020-06-01');
    expect(result.dueDate).toBe('2021-01-15'); // بلا أي تغيير
    expect(result.advanceMonths).toBe(0);
  });

  test('isPlaceholder ينتقل من صف الدورة المطابق حرفياً', () => {
    const placeholderEmp = { id: 1, certificate: 'بكالوريوس', grade: 'الأولى', lastPromotion: '2020-01-15' };
    const realEmp = { id: 2, certificate: 'بكالوريوس', grade: 'الرابعة', lastPromotion: '2020-01-15' };
    expect(calcNextDue(placeholderEmp, cycles, [], '2020-06-01').isPlaceholder).toBe(true);
    expect(calcNextDue(realEmp, cycles, [], '2020-06-01').isPlaceholder).toBe(false);
  });

  test('daysUntil يطابق فرق التاريخين الفعلي', () => {
    const emp = { id: 1, certificate: 'بكالوريوس', grade: 'الأولى', lastPromotion: '2020-01-15' };
    const result = calcNextDue(emp, cycles, [], '2020-06-01');
    expect(result.daysUntil).toBe(daysBetween('2020-06-01', result.dueDate));
  });
});

describe('calcAllDue', () => {
  const employees = [
    { id: 1, name: 'قريب الاستحقاق', certificate: 'بكالوريوس', grade: 'الأولى', lastPromotion: '2019-01-15' }, // موعد السنة 1: 2020-01-15
    { id: 2, name: 'بعيد الاستحقاق', certificate: 'بكالوريوس', grade: 'الأولى', lastPromotion: '2019-08-01' }, // موعد السنة 1: 2020-08-01
    { id: 3, name: 'بلا شهادة', lastPromotion: '2020-01-15' }, // غير متاح الحساب أصلاً — يُستبعَد بصمت
  ];

  test('يُرجع فقط الموظفين المستحقين خلال العتبة المحدَّدة (افتراضياً 30 يوماً)، ويستبعد من لا يمكن حسابهم', () => {
    // من 2019-12-25: الموظف 1 مستحق خلال 21 يوماً (2020-01-15)، الموظف 2 بعيد جداً (2020-08-01)
    const due = calcAllDue(employees, cycles, [], { todayStr: '2019-12-25' });
    expect(due.map(r => r.employee.id)).toEqual([1]);
  });

  test('عتبة dueWithinDays قابلة للتخصيص', () => {
    // من 2020-01-01: كلاهما خلال 400 يوماً (14 يوماً و213 يوماً على التوالي)
    const due = calcAllDue(employees, cycles, [], { todayStr: '2020-01-01', dueWithinDays: 400 });
    expect(due.map(r => r.employee.id).sort()).toEqual([1, 2]);
  });
});

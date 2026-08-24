// frontend/src/pages/hr/promotionCalc.test.js
//
// اختبارات محرّك حساب استحقاق العلاوة/الترفيع — يعمل مباشرة على سجل الموظف
// (lastPromotion/lastAllowance/certificate) بلا أي جدول منفصل.
import { calcPromotionDue, calcAllowanceDue } from './promotionCalc';

const daysBetween = (fromStr, toStr) => Math.floor((new Date(toStr) - new Date(fromStr)) / (1000 * 60 * 60 * 24));

describe('calcPromotionDue', () => {
  test('يرجع available:false مع سبب واضح لو لا يوجد تاريخ ترفيع سابق ولا تاريخ تعيين', () => {
    const emp = { id: 1, certificate: 'بكالوريوس' };
    expect(calcPromotionDue(emp, '2022-01-01')).toEqual({ available: false, reason: 'no-base-date' });
  });

  test('يستخدم hireDate كتاريخ أساس لموظف لم يُرفَّع بعد (lastPromotion فارغ)', () => {
    const emp = { id: 1, certificate: 'بكالوريوس', hireDate: '2021-01-15' };
    const result = calcPromotionDue(emp, '2021-06-01');
    expect(result.available).toBe(true);
    expect(result.dueDate).toBe('2025-01-15'); // hireDate + 4 سنوات (بكالوريوس)
  });

  test('مدة الدورة تعتمد على الشهادة (قيم مبدئية)', () => {
    expect(calcPromotionDue({ certificate: 'دبلوم', lastPromotion: '2020-01-15' }, '2020-06-01').dueDate).toBe('2025-01-15'); // 5 سنوات
    expect(calcPromotionDue({ certificate: 'بكالوريوس', lastPromotion: '2020-01-15' }, '2020-06-01').dueDate).toBe('2024-01-15'); // 4 سنوات
    expect(calcPromotionDue({ certificate: 'ماجستير', lastPromotion: '2020-01-15' }, '2020-06-01').dueDate).toBe('2023-01-15'); // 3 سنوات
    expect(calcPromotionDue({ certificate: 'دكتوراه', lastPromotion: '2020-01-15' }, '2020-06-01').dueDate).toBe('2023-01-15'); // 3 سنوات
  });

  test('شهادة غير معروفة أو غير مسجَّلة تستخدم القيمة الافتراضية (4 سنوات)', () => {
    expect(calcPromotionDue({ lastPromotion: '2020-01-15' }, '2020-06-01').dueDate).toBe('2024-01-15');
    expect(calcPromotionDue({ certificate: 'إعدادية', lastPromotion: '2020-01-15' }, '2020-06-01').dueDate).toBe('2024-01-15');
  });

  test('ترفيع متأخر (تاريخ الاستحقاق مضى) يُعلَّم overdue:true', () => {
    const result = calcPromotionDue({ certificate: 'بكالوريوس', lastPromotion: '2015-01-15' }, '2025-01-01');
    expect(result.overdue).toBe(true);
    expect(result.dueDate).toBe('2019-01-15');
    expect(result.daysUntil).toBeLessThan(0);
  });

  test('daysUntil يطابق فرق التاريخين الفعلي', () => {
    const emp = { certificate: 'بكالوريوس', lastPromotion: '2020-01-15' };
    const result = calcPromotionDue(emp, '2020-06-01');
    expect(result.daysUntil).toBe(daysBetween('2020-06-01', result.dueDate));
  });
});

describe('calcAllowanceDue', () => {
  test('يرجع available:false مع سبب واضح لو لا يوجد تاريخ علاوة سابقة ولا تاريخ تعيين', () => {
    expect(calcAllowanceDue({ id: 1 }, '2022-01-01')).toEqual({ available: false, reason: 'no-base-date' });
  });

  test('يستخدم hireDate كتاريخ أساس لموظف لم تُصرَف له علاوة بعد', () => {
    const result = calcAllowanceDue({ hireDate: '2023-01-15' }, '2023-06-01');
    expect(result.dueDate).toBe('2024-01-15'); // hireDate + سنة واحدة (علاوة سنوية ثابتة)
  });

  test('مدة الدورة سنة واحدة ثابتة بغض النظر عن الشهادة', () => {
    const result = calcAllowanceDue({ certificate: 'دكتوراه', lastAllowance: '2024-03-01' }, '2024-06-01');
    expect(result.dueDate).toBe('2025-03-01');
  });

  test('علاوة متأخرة (تاريخ الاستحقاق مضى) تُعلَّم overdue:true', () => {
    const result = calcAllowanceDue({ lastAllowance: '2023-01-01' }, '2025-01-01');
    expect(result.overdue).toBe(true);
    expect(result.dueDate).toBe('2024-01-01');
  });
});

// frontend/src/utils/fallbackDiagnosis.test.js
//
// أول اختبار آلي لنظام التشخيص المحلي (buildFallback) — كان بلا أي تغطية
// اختبارية رغم كونه (قبل تفعيل الذكاء الاصطناعي الحقيقي) المصدر الوحيد
// لكل تشخيص يشوفه المستخدم فعلياً. يتحقق من: كل نمط يرجّع بيانات صحيحة
// الشكل، اللغة تنعكس صح بكل الحقول، والنمط الافتراضي يشتغل لأعراض غير معروفة.
import { buildFallback } from './fallbackDiagnosis';

describe('buildFallback — نظام التشخيص المحلي بالقواعد الثابتة', () => {
  test('يرجع بنية بيانات صحيحة الشكل لأي مجموعة أعراض', () => {
    const result = buildFallback(['صداع'], 'ar');
    expect(result).toHaveProperty('diagnoses');
    expect(result).toHaveProperty('severity');
    expect(result).toHaveProperty('urgent');
    expect(result).toHaveProperty('tests');
    expect(result).toHaveProperty('recommendations');
    expect(Array.isArray(result.diagnoses)).toBe(true);
    expect(result.diagnoses.length).toBeGreaterThan(0);
  });

  test('عرض "ارتفاع ضغط دم" يرجّع تشخيص ارتفاع ضغط الدم كأول احتمال', () => {
    const result = buildFallback(['ارتفاع ضغط دم'], 'ar');
    expect(result.diagnoses[0].name).toContain('ضغط الدم');
    expect(result.severity).toBe('متوسط');
  });

  test('أعراض القلب الطارئة (آلام صدر + ضيق تنفس) تُصنَّف عاجلة (urgent)', () => {
    const result = buildFallback(['آلام صدر', 'ضيق تنفس'], 'ar');
    expect(result.urgent).toBe(true);
    expect(result.severity).toBe('مرتفع');
    expect(result.urgentReason).toBeTruthy();
  });

  test('أعراض غير معروفة/عامة ترجع التشخيص الافتراضي (تقييم طبي شامل) بدل رمي استثناء', () => {
    const result = buildFallback(['عرض غريب غير موجود بأي قاعدة'], 'ar');
    expect(result.diagnoses.length).toBe(1);
    expect(result.diagnoses[0].probability).toBe('—');
  });

  test('مصفوفة أعراض فاضية لا ترمي استثناء — ترجع النمط الافتراضي', () => {
    expect(() => buildFallback([], 'ar')).not.toThrow();
  });

  describe('دعم اللغتين — كل النصوص تنعكس صح', () => {
    test('lang="ar": كل النصوص عربي', () => {
      const result = buildFallback(['ارتفاع ضغط دم'], 'ar');
      expect(result.diagnoses[0].name).toMatch(/[\u0600-\u06FF]/); // يحتوي حرفاً عربياً
      expect(result.tests[0]).toMatch(/[\u0600-\u06FF]/);
      expect(result.recommendations[0]).toMatch(/[\u0600-\u06FF]/);
    });

    test('lang="en": كل النصوص إنكليزي (لا حروف عربية إطلاقاً بأي حقل نصي رئيسي)', () => {
      const result = buildFallback(['ارتفاع ضغط دم'], 'en');
      const arabicPattern = /[\u0600-\u06FF]/;
      expect(arabicPattern.test(result.diagnoses[0].name)).toBe(false);
      expect(arabicPattern.test(result.diagnoses[0].description)).toBe(false);
      result.tests.forEach(t => expect(arabicPattern.test(t)).toBe(false));
      result.recommendations.forEach(r => expect(arabicPattern.test(r)).toBe(false));
    });

    test('نفس الأعراض بلغتين مختلفتين ترجع نفس البنية المنطقية (نفس درجة الخطورة ونفس عدد التشخيصات)', () => {
      const arResult = buildFallback(['سكري'], 'ar');
      const enResult = buildFallback(['سكري'], 'en');
      expect(arResult.severity).toBe(enResult.severity); // القيمة الداخلية (مفتاح) تبقى نفسها بغض النظر عن اللغة
      expect(arResult.diagnoses.length).toBe(enResult.diagnoses.length);
      expect(arResult.urgent).toBe(enResult.urgent);
    });
  });

  describe('تغطية شاملة لكل الأنماط المعرَّفة — كل نمط يرجّع نتيجة صالحة', () => {
    const patterns = [
      ['ارتفاع ضغط دم'], ['احتقان أنف'], ['سكري'], ['آلام مفاصل'],
      ['ارتفاع ضغط دم', 'صداع', 'دوار'], ['احتقان أنف', 'صداع', 'حمى'],
      ['إرهاق', 'فقدان شهية', 'عطش شديد'], ['آلام مفاصل', 'تورم', 'حمى'],
      ['آلام صدر', 'ضيق تنفس'], ['آلام بطن', 'غثيان', 'قيء', 'إسهال'],
      ['حمى', 'إرهاق'], ['طفح جلدي', 'حكة'], ['صداع', 'دوار'],
    ];
    test.each(patterns)('النمط %j يرجّع نتيجة صالحة بلا استثناء', (symptoms) => {
      const result = buildFallback(symptoms, 'ar');
      expect(result.diagnoses.length).toBeGreaterThan(0);
      expect(['خفيف', 'متوسط', 'مرتفع', 'طارئ']).toContain(result.severity);
    });
  });
});

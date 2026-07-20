// backend/tests/validate.test.js
//
// اختبارات وحدة خالصة (Unit Tests) لدالة validateFields — لا تحتاج أي اتصال
// بقاعدة بيانات أو خادم فعلي إطلاقاً، فتشتغل دائماً 100% بأي بيئة (بعكس أغلب
// اختبارات هذا المشروع المرتبطة بـ PostgreSQL وتُتجاوَز لو السيرفر غير متاح).
// هذا يجعلها خط الدفاع الأول والأكثر موثوقية ضد أي كسر بمنطق التحقق نفسه.
const { validateFields } = require('../middleware/validate');

describe('validateFields — التحقق الأساسي (required/type/minLength)', () => {
  const schema = {
    name: { required: true, type: 'string', minLength: 2 },
    phone: { required: true, type: 'string' },
    age: { type: 'number' },
    tags: { type: 'array' },
  };

  test('كائن فاضٍ يرجع أخطاء لكل حقل مطلوب', () => {
    const errors = validateFields(schema, {});
    expect(errors.length).toBe(2); // name و phone مطلوبان
    expect(errors.some(e => e.includes('name'))).toBe(true);
    expect(errors.some(e => e.includes('phone'))).toBe(true);
  });

  test('بيانات صحيحة كاملة لا تُرجع أي خطأ', () => {
    const errors = validateFields(schema, { name: 'أحمد', phone: '07701234567' });
    expect(errors).toEqual([]);
  });

  test('اسم أقصر من الحد الأدنى (minLength) يُرفض', () => {
    const errors = validateFields(schema, { name: 'ا', phone: '123' });
    expect(errors.length).toBeGreaterThan(0);
  });

  test('حقل رقمي (type: number) بقيمة نصية يُرفض', () => {
    const errors = validateFields(schema, { name: 'أحمد', phone: '123', age: 'ليس رقماً' });
    expect(errors.some(e => e.includes('age'))).toBe(true);
  });

  test('حقل مصفوفة (type: array) بقيمة غير مصفوفة يُرفض', () => {
    const errors = validateFields(schema, { name: 'أحمد', phone: '123', tags: 'ليست مصفوفة' });
    expect(errors.some(e => e.includes('tags'))).toBe(true);
  });

  test('حقل اختياري غير مُرسَل لا يُسبب أي خطأ', () => {
    const errors = validateFields(schema, { name: 'أحمد', phone: '123' });
    expect(errors).toEqual([]);
  });

  test('مخطط فاضٍ (undefined) لا يرفض أي شيء — موديول لم يُغطَّ بعد', () => {
    expect(validateFields(undefined, { anything: 'goes' })).toEqual([]);
  });

  test('نص أطول من الحد الأقصى الافتراضي (5000 حرف) يُرفض', () => {
    const errors = validateFields(schema, { name: 'أ'.repeat(5001), phone: '123' });
    expect(errors.some(e => e.includes('5000'))).toBe(true);
  });

  test('حد أقصى مخصَّص (maxLength) بالمخطط يُطبَّق بدل الافتراضي', () => {
    const customSchema = { code: { type: 'string', maxLength: 10 } };
    const errors = validateFields(customSchema, { code: 'a'.repeat(11) });
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('10');
  });

  test('نمط (pattern) مخصَّص يُطبَّق فعلياً — إيميل غير صالح يُرفض', () => {
    const emailSchema = { email: { type: 'string', pattern: /^\S+@\S+\.\S+$/ } };
    const badEmail = validateFields(emailSchema, { email: 'ليس-إيميل' });
    const goodEmail = validateFields(emailSchema, { email: 'test@example.com' });
    expect(badEmail.length).toBe(1);
    expect(goodEmail).toEqual([]);
  });
});

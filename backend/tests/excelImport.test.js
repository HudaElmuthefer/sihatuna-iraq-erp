// backend/tests/excelImport.test.js
//
// اختبارات وحدة خالصة لـ parseExcelBuffer — تبني ملف Excel حقيقي بالذاكرة
// (بدون أي ملف على القرص) وتتحقق من صحة التحليل. لا تحتاج قاعدة بيانات ولا
// خادم، فتشتغل دائماً 100%.
const XLSX = require('xlsx');
const { parseExcelBuffer } = require('../utils/excelImport');

// دالة مساعدة: تبني buffer ملف Excel من مصفوفة صفوف (aoa = array of arrays)
function buildExcelBuffer(rows, sheetName = 'ورقة1') {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('parseExcelBuffer — تحليل ملفات الاستيراد', () => {
  const columnMap = {
    'الاسم': 'name', 'الهاتف': 'phone', 'العمر': 'age',
    'الجنس': 'gender', 'الحالة': 'status',
  };

  test('يحلّل صفوف صحيحة ويطابق عناوين الأعمدة العربية بأسماء الحقول الداخلية', () => {
    const buffer = buildExcelBuffer([
      ['الاسم', 'الهاتف', 'العمر'],
      ['أحمد كاظم', '07701234567', 45],
    ]);
    const { rows, error } = parseExcelBuffer(buffer, columnMap);
    expect(error).toBeNull();
    expect(rows.length).toBe(1);
    expect(rows[0].data.name).toBe('أحمد كاظم');
    expect(rows[0].data.phone).toBe('07701234567');
    expect(rows[0].data.age).toBe('45');
  });

  test('رقم الصف (rowNumber) يطابق رقم الصف الفعلي بملف Excel (بعد صف العناوين)', () => {
    const buffer = buildExcelBuffer([
      ['الاسم', 'الهاتف'],
      ['الأول', '111'],
      ['الثاني', '222'],
      ['الثالث', '333'],
    ]);
    const { rows } = parseExcelBuffer(buffer, columnMap);
    expect(rows[0].rowNumber).toBe(2); // أول صف بيانات = الصف رقم 2 (بعد صف العناوين رقم 1)
    expect(rows[1].rowNumber).toBe(3);
    expect(rows[2].rowNumber).toBe(4);
  });

  test('القيم العربية الشائعة (ذكر/أنثى، نشط/غير نشط) تُحوَّل تلقائياً للقيم الإنجليزية المخزَّنة', () => {
    const buffer = buildExcelBuffer([
      ['الاسم', 'الهاتف', 'الجنس', 'الحالة'],
      ['مريضة', '123', 'أنثى', 'نشط'],
    ]);
    const { rows } = parseExcelBuffer(buffer, columnMap);
    expect(rows[0].data.gender).toBe('female');
    expect(rows[0].data.status).toBe('active');
  });

  test('عمود غير موجود بالخريطة (columnMap) يُتجاهَل بصمت بدل رفض الملف', () => {
    const buffer = buildExcelBuffer([
      ['الاسم', 'عمود غريب غير معروف'],
      ['أحمد', 'قيمة عشوائية'],
    ]);
    const { rows, error } = parseExcelBuffer(buffer, columnMap);
    expect(error).toBeNull();
    expect(rows[0].data.name).toBe('أحمد');
    expect(rows[0].data['عمود غريب غير معروف']).toBeUndefined();
  });

  test('مطابقة عناوين الأعمدة غير حساسة لحالة الأحرف أو المسافات الزائدة', () => {
    const buffer = buildExcelBuffer([
      ['  الاسم  ', 'الهاتف'], // مسافات زائدة حول العنوان
      ['أحمد', '123'],
    ]);
    const { rows } = parseExcelBuffer(buffer, columnMap);
    expect(rows[0].data.name).toBe('أحمد');
  });

  test('ملف بدون أي صفوف بيانات (صف عناوين فقط) يُرجع خطأ واضح', () => {
    const buffer = buildExcelBuffer([['الاسم', 'الهاتف']]);
    const { error } = parseExcelBuffer(buffer, columnMap);
    expect(error).not.toBeNull();
    expect(error).toContain('فارغ');
  });

  test('ملف تالف (buffer غير صالح كملف Excel) يُرجع خطأ واضح بدل رمي استثناء', () => {
    const badBuffer = Buffer.from('هذا نص عادي وليس ملف Excel إطلاقاً');
    const { error } = parseExcelBuffer(badBuffer, columnMap);
    expect(error).not.toBeNull();
  });

  test('أكثر من 5000 صف يُرفض بحد أقصى واضح (حماية من ملف ضخم)', () => {
    const rows = [['الاسم', 'الهاتف']];
    for (let i = 0; i < 5001; i++) rows.push([`مريض ${i}`, '123']);
    const buffer = buildExcelBuffer(rows);
    const { error } = parseExcelBuffer(buffer, columnMap);
    expect(error).not.toBeNull();
    expect(error).toContain('5000');
  });
});

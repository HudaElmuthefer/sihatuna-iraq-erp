// backend/tests/excelImportRoute.test.js
//
// اختبار تكامل حقيقي لمسار POST /api/patients/import-excel — يبني ملف Excel
// فعلي بالذاكرة ويرفعه عبر HTTP حقيقي (multipart/form-data)، ويتحقق من
// النتيجة الكاملة (استيراد ناجح + خطأ تحقق + تكرار)، بدل الاكتفاء باختبار
// دالة التحليل بمعزل (ذاك موجود بـ excelImport.test.js).
const request = require('supertest');
const XLSX = require('xlsx');
const { setupTestEnv, cleanupTestEnv, assertPgAvailable } = require('./testUtils');

function buildExcelBuffer(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'المرضى');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('excel-import-route');
  app = require('../server');

  const loginRes = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  token = loginRes.body.token;

  const probe = await request(app).get('/api/patients').set('Authorization', `Bearer ${token}`);
  assertPgAvailable(probe, 'مسار استيراد Excel');
});

afterAll(() => {
  cleanupTestEnv(dbPath);
});

describe('GET /api/patients/import-template', () => {
  test('يرجع ملف Excel فعلي (نوع محتوى صحيح) لا يحتاج قاعدة بيانات', async () => {
    const res = await request(app)
      .get('/api/patients/import-template')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheet');
  });

  test('بدون توكن دخول: يُرفض بـ401', async () => {
    const res = await request(app).get('/api/patients/import-template');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/patients/import-excel', () => {
  test('ملف بصفوف صحيحة بالكامل: كلها تُستورَد بنجاح', async () => {
    const unique = Date.now();
    const buffer = buildExcelBuffer([
      ['الاسم', 'الهاتف'],
      [`مستورد أول ${unique}`, '07701111111'],
      [`مستورد ثاني ${unique}`, '07702222222'],
    ]);
    const res = await request(app)
      .post('/api/patients/import-excel')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'test.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(2);
    expect(res.body.failed).toBe(0);
  });

  test('ملف فيه صف ناقص بيانات مطلوبة (بدون هاتف): يُحتسَب "فشل" مع رسالة واضحة، والباقي ينجح', async () => {
    const unique = Date.now();
    const buffer = buildExcelBuffer([
      ['الاسم', 'الهاتف'],
      [`صحيح ${unique}`, '07703333333'],
      [`بدون هاتف ${unique}`, ''], // هاتف مطلوب بمخطط المرضى
    ]);
    const res = await request(app)
      .post('/api/patients/import-excel')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'test.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);
    expect(res.body.failed).toBe(1);
    expect(res.body.errors[0].messages.length).toBeGreaterThan(0);
  });

  test('رفع نفس الملف مرتين: المرة الثانية تُكتشَف كتكرار كامل (duplicates)، بدون نسخ مكررة', async () => {
    const unique = Date.now();
    const buffer = buildExcelBuffer([
      ['الاسم', 'الهاتف'],
      [`مريض تكرار ${unique}`, '07704444444'],
    ]);

    const first = await request(app)
      .post('/api/patients/import-excel')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'test.xlsx');
    expect(first.body.imported).toBe(1);

    const second = await request(app)
      .post('/api/patients/import-excel')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'test.xlsx');
    expect(second.body.imported).toBe(0);
    expect(second.body.duplicates).toBe(1);
  });

  test('ملف بصيغة غير مسموحة (txt) يُرفض قبل أي محاولة معالجة', async () => {
    const res = await request(app)
      .post('/api/patients/import-excel')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('ليس ملف اكسل'), 'test.txt');
    expect(res.status).toBe(400);
  });

  test('بدون رفع أي ملف إطلاقاً: يُرفض برسالة واضحة', async () => {
    const res = await request(app)
      .post('/api/patients/import-excel')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('لم يُرفَع');
  });

  test('بدون توكن دخول: يُرفض بـ401 قبل أي معالجة للملف', async () => {
    const buffer = buildExcelBuffer([['الاسم', 'الهاتف'], ['أحمد', '123']]);
    const res = await request(app)
      .post('/api/patients/import-excel')
      .attach('file', buffer, 'test.xlsx');
    expect(res.status).toBe(401);
  });
});

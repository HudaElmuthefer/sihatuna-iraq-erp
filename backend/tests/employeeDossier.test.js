// backend/tests/employeeDossier.test.js
//
// اختبارات لإصلاح حرج: تبويب "الإضابير الشخصية" بالموظفين النشطين كان بدون
// أي اتصال بالباك إند إطلاقاً — أي وثيقة (شهادة، عقد) تُفقَد بمجرد تحديث
// الصفحة، وحتى الملف المرفق نفسه كان معاينة محلية بس (blob URL) ما يُرفَع
// لأي مكان. يتحقق من إن الوثيقة (بملف مرفق حقيقي) تُحفَظ وتبقى بعد إعادة الجلب.
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv } = require('./testUtils');

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('employee-dossier');
  app = require('../server');
  const login = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  token = login.body.token;
});

afterAll(() => {
  cleanupTestEnv(dbPath);
});

describe('GET/POST/DELETE /api/employees/:id/dossier', () => {
  test('قائمة فاضية لموظف بدون أي وثيقة بعد', async () => {
    const res = await request(app).get('/api/employees/1/dossier').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('رفع وثيقة (بملف مرفق حقيقي) تُحفَظ فعلياً وتبقى بعد إعادة الجلب', async () => {
    const res = await request(app)
      .post('/api/employees/1/dossier')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'شهادة')
      .field('title', 'شهادة التخرج')
      .field('date', '2026-07-12')
      .attach('file', Buffer.from('محتوى تجريبي'), 'certificate.pdf');

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('شهادة التخرج');
    expect(res.body.filePath).toMatch(/^\/uploads\//); // يؤكد إن الملف فعلاً انرفع وله مسار حقيقي على الخادم

    // نحاكي "تحديث الصفحة" — نجيب القائمة من جديد ونتأكد الوثيقة لسا موجودة
    const refetch = await request(app).get('/api/employees/1/dossier').set('Authorization', `Bearer ${token}`);
    expect(refetch.body.length).toBe(1);
    expect(refetch.body[0].filePath).toBe(res.body.filePath);
  });

  test('حذف وثيقة يشتغل صح', async () => {
    const created = await request(app)
      .post('/api/employees/2/dossier')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'عقد')
      .field('title', 'عقد توظيف')
      .field('date', '2026-07-12');
    const docId = created.body.id;

    const del = await request(app).delete(`/api/employees/2/dossier/${docId}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const after = await request(app).get('/api/employees/2/dossier').set('Authorization', `Bearer ${token}`);
    expect(after.body.length).toBe(0);
  });

  test('بدون توكن دخول: يُرفض بـ401', async () => {
    const res = await request(app).get('/api/employees/1/dossier');
    expect(res.status).toBe(401);
  });
});

// backend/tests/dossierFileCleanup.test.js
//
// إصلاح: حذف سجل إضبارة (شهادة/عقد موظف) كان يحذف السطر من قاعدة البيانات
// فقط، ويترك الملف المرفق الفعلي بمجلد backend/uploads/ يتيماً للأبد — راجع
// deleteUploadedFile بـconfig/uploadConfig.js. هذا الملف يتحقق من مسارين
// منفصلين تماماً يستدعيانها فعلياً:
//   1) الحذف النهائي المباشر (DELETE /api/employees/:id/dossier/:docId،
//      employeeDossierRoutes.js) — لا سلة محذوفات هنا إطلاقاً.
//   2) الحذف العام (DELETE /api/dossiers/:id عبر pgCrud) الذي تستخدمه الواجهة
//      فعلياً (DossiersTab.js) — ينقل فقط لسلة المحذوفات أولاً (يجب أن يبقى
//      الملف موجوداً هنا، السجل لا يزال قابلاً للاسترجاع)، والحذف الفعلي من
//      القرص لا يصير إلا لاحقاً عند الحذف النهائي من سلة المحذوفات
//      (DELETE /api/recycle-bin/:id، recycleBinRoutes.js).
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { setupTestEnv, cleanupTestEnv, closeDbPool } = require('./testUtils');
const { UPLOADS_DIR } = require('../config/uploadConfig');

let dbPath;
let app;
let token;

beforeAll(async () => {
  dbPath = setupTestEnv('dossier-file-cleanup');
  app = require('../server');
  const login = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'testpass123' });
  token = login.body.token; // testadmin دوره admin — يتجاوز adminOnly بسلة المحذوفات وrequirePermission('hr')
});

afterAll(async () => {
  cleanupTestEnv(dbPath);
  await closeDbPool();
});

describe('تنظيف الملف المرفق فعلياً من القرص عند حذف إضبارة', () => {
  test('الحذف النهائي المباشر (بلا سلة محذوفات) يحذف الملف من القرص أيضاً', async () => {
    const created = await request(app)
      .post('/api/employees/1/dossier')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'شهادة')
      .field('title', 'شهادة اختبار التنظيف')
      .field('date', '2026-07-12')
      .attach('file', Buffer.from('محتوى تجريبي'), 'certificate.pdf');
    expect(created.status).toBe(201);

    const filename = path.basename(created.body.filePath);
    const fullPath = path.join(UPLOADS_DIR, filename);
    expect(fs.existsSync(fullPath)).toBe(true); // الملف فعلاً انرفع على القرص

    const del = await request(app)
      .delete(`/api/employees/1/dossier/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    expect(fs.existsSync(fullPath)).toBe(false); // ما عاد يتيماً على القرص
  });

  test('نقل لسلة المحذوفات يُبقي الملف (قابل للاسترجاع)، والحذف النهائي منها يحذفه فعلياً', async () => {
    const created = await request(app)
      .post('/api/employees/1/dossier')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'عقد')
      .field('title', 'عقد اختبار سلة المحذوفات')
      .field('date', '2026-07-12')
      .attach('file', Buffer.from('محتوى تجريبي'), 'contract.pdf');
    expect(created.status).toBe(201);

    const filename = path.basename(created.body.filePath);
    const fullPath = path.join(UPLOADS_DIR, filename);
    expect(fs.existsSync(fullPath)).toBe(true);

    // الحذف العام (نفس ما تستدعيه DossiersTab.js فعلياً) — ينقل لسلة المحذوفات فقط
    const softDelete = await request(app)
      .delete(`/api/dossiers/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(softDelete.status).toBe(200);
    expect(fs.existsSync(fullPath)).toBe(true); // لا يزال موجوداً — السجل قابل للاسترجاع بعد

    const bin = await request(app).get('/api/recycle-bin').set('Authorization', `Bearer ${token}`);
    const binEntry = bin.body.find(r => r.moduleKey === 'dossiers' && r.originalId === created.body.id);
    expect(binEntry).toBeTruthy();

    const purge = await request(app)
      .delete(`/api/recycle-bin/${binEntry.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(purge.status).toBe(200);
    expect(fs.existsSync(fullPath)).toBe(false); // الآن حُذف فعلياً — لا رجعة
  });
});

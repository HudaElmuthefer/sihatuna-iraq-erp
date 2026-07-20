// backend/tests/requirePermission.test.js
//
// اختبارات وحدة خالصة لـ middleware requirePermission — بدون أي خادم أو
// قاعدة بيانات، فقط استدعاء الدالة مباشرة مع كائنات req/res وهمية (mock).
// هذا هو منطق الصلاحيات الأساسي (RBAC) لكل موديولات النظام تقريباً، فيستاهل
// تغطية مباشرة ومضمونة 100% بغض النظر عن توفر PostgreSQL.
const requirePermission = require('../middleware/requirePermission');

// كائن استجابة (res) وهمي يسجّل ما استُدعي عليه، لفحصه لاحقاً بالاختبار
function mockRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

describe('requirePermission — فحص صلاحيات الوحدة', () => {
  test('بدون pageKey محدَّد: يمر دائماً بغض النظر عن المستخدم (موديول غير مصنَّف بعد)', () => {
    const req = { user: { role: 'nurse', permissions: [] } };
    const res = mockRes();
    let nextCalled = false;
    requirePermission(null)(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  test('حساب admin يتجاوز الفحص دائماً، حتى بدون أي صلاحية بمصفوفة permissions', () => {
    const req = { user: { role: 'admin', permissions: [] } };
    const res = mockRes();
    let nextCalled = false;
    requirePermission('inventory')(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  test('مستخدم عادي يملك الصلاحية المطلوبة ضمن permissions: يمر بنجاح', () => {
    const req = { user: { role: 'nurse', permissions: ['patients', 'appointments'] } };
    const res = mockRes();
    let nextCalled = false;
    requirePermission('patients')(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  test('مستخدم عادي بدون الصلاحية المطلوبة: يُرفض برمز 403', () => {
    const req = { user: { role: 'nurse', permissions: ['patients'] } };
    const res = mockRes();
    let nextCalled = false;
    requirePermission('accounts')(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBeDefined();
  });

  test('مستخدم بدون مصفوفة permissions إطلاقاً (undefined): يُرفض بأمان، لا يرمي استثناء', () => {
    const req = { user: { role: 'nurse' } }; // لا يوجد حقل permissions إطلاقاً
    const res = mockRes();
    expect(() => {
      requirePermission('patients')(req, res, () => {});
    }).not.toThrow();
    expect(res.statusCode).toBe(403);
  });

  test('req.user فاضٍ تماماً (undefined): يُرفض بأمان بدل رمي استثناء (لن يحصل عملياً بعد auth، لكن دفاع إضافي)', () => {
    const req = {};
    const res = mockRes();
    expect(() => {
      requirePermission('patients')(req, res, () => {});
    }).not.toThrow();
    expect(res.statusCode).toBe(403);
  });
});

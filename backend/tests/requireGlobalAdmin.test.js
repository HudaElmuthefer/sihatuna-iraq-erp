// backend/tests/requireGlobalAdmin.test.js
//
// اختبارات وحدة خالصة لـ middleware requireGlobalAdmin — يميّز بين إدمن عام
// (مستوى الوزارة) وإدمن محلي مرتبط بمنشأة، ويُستخدم للعمليات التي يجب أن
// تبقى حصراً للإدمن العام (إدارة المنشآت، النسخ الاحتياطي، سجل التدقيق).
const requireGlobalAdmin = require('../middleware/requireGlobalAdmin');

function mockRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

describe('requireGlobalAdmin', () => {
  test('إدمن بدون hospitalId (عام): يمر بنجاح', () => {
    const req = { user: { role: 'admin', hospitalId: null } };
    const res = mockRes();
    let nextCalled = false;
    requireGlobalAdmin(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  test('إدمن له hospitalId محدَّد (محلي): يُرفض بـ403', () => {
    const req = { user: { role: 'admin', hospitalId: 'hospA' } };
    const res = mockRes();
    let nextCalled = false;
    requireGlobalAdmin(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  test('مستخدم غير إدمن أصلاً: يُرفض بـ403 حتى لو بدون hospitalId', () => {
    const req = { user: { role: 'nurse', hospitalId: null } };
    const res = mockRes();
    requireGlobalAdmin(req, res, () => {});
    expect(res.statusCode).toBe(403);
  });
});

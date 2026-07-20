// backend/tests/tokenRevocation.test.js
//
// اختبارات وحدة مباشرة لـ utils/tokenRevocation.js — بمعزل عن مسارات auth
// الكاملة (تلك مغطّاة بالفعل بـ auth.test.js عبر HTTP). هنا نختبر الوحدة
// نفسها: هل تُبطِل، هل تتجاهل توكن منتهي أصلاً، هل تنجو من إعادة التشغيل.
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('tokenRevocation — قائمة إبطال التوكنات', () => {
  let tmpPath;

  beforeEach(() => {
    // ملف مؤقت منفصل لكل اختبار + تفريغ الوحدة (module cache) حتى تُعاد قراءة
    // الملف من الصفر بكل مرة، بدل استخدام نسخة محمَّلة مسبقاً بالذاكرة من اختبار سابق
    tmpPath = path.join(os.tmpdir(), `test-revoked-${Date.now()}-${Math.random()}.json`);
    process.env.REVOKED_TOKENS_PATH = tmpPath;
    jest.resetModules();
  });

  afterEach(() => {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch { /* لا بأس */ }
  });

  test('توكن غير مُبطَل أصلاً: isRevoked ترجع false', () => {
    const { isRevoked } = require('../utils/tokenRevocation');
    expect(isRevoked('some-jti-never-revoked')).toBe(false);
  });

  test('توكن بعد استدعاء revoke عليه: isRevoked ترجع true', () => {
    const { revoke, isRevoked } = require('../utils/tokenRevocation');
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // صالح لساعة قادمة
    revoke('jti-123', futureExp);
    expect(isRevoked('jti-123')).toBe(true);
  });

  test('jti فاضٍ أو exp فاضٍ: revoke لا تفعل شيء، لا ترمي استثناء', () => {
    const { revoke, isRevoked } = require('../utils/tokenRevocation');
    expect(() => revoke(null, null)).not.toThrow();
    expect(() => revoke('jti-x', null)).not.toThrow();
    expect(isRevoked('jti-x')).toBe(false);
  });

  test('الإبطال يبقى فعّالاً بعد "إعادة تشغيل" المحاكاة (تحميل الوحدة من جديد يقرأ من الملف المحفوظ)', () => {
    const first = require('../utils/tokenRevocation');
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    first.revoke('jti-persist', futureExp);

    // محاكاة إعادة تشغيل الخادم: نفرّغ ذاكرة الوحدات ونعيد تحميلها من الصفر
    jest.resetModules();
    const second = require('../utils/tokenRevocation');
    expect(second.isRevoked('jti-persist')).toBe(true);
  });

  test('مدخل منتهي الصلاحية أصلاً لا يُحمَّل عند إعادة التشغيل (تنظيف تلقائي)', () => {
    const first = require('../utils/tokenRevocation');
    const pastExp = Math.floor(Date.now() / 1000) - 3600; // انتهت قبل ساعة
    first.revoke('jti-expired', pastExp);

    jest.resetModules();
    const second = require('../utils/tokenRevocation');
    // التوكن أصلاً منتهي الصلاحية الطبيعية، فلا داعي أصلاً لبقائه بقائمة الإبطال
    expect(second.isRevoked('jti-expired')).toBe(false);
  });
});

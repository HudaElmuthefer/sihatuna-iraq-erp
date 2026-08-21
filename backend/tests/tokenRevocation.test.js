// backend/tests/tokenRevocation.test.js
//
// اختبارات وحدة مباشرة لـ utils/tokenRevocation.js — بمعزل عن مسارات auth
// الكاملة (تلك مغطّاة أصلاً بـauth.test.js عبر HTTP). هنا نختبر الوحدة نفسها.
//
// ── بعد المرحلة الثانية (الانتقال لـRedis) ────────────────────────────────
// نستخدم ioredis-mock بدل Redis حقيقي — لا حاجة لخادم Redis فعلي وقت تشغيل
// الاختبارات (راجعي devDependencies بـpackage.json). "الاستمرارية بعد إعادة
// التشغيل" لم تعد مفهوماً يحتاج اختباراً هنا كما كانت بالنسخة السابقة
// (ملف على القرص) — Redis نفسه مصدر بيانات خارجي مستقل عن عملية Node.js،
// هذا ضمان توفّره المكتبة نفسها، لا شيء يخصّ هذا الملف الرقيق بالتحديد.
jest.mock('ioredis', () => require('ioredis-mock'));

const { revoke, isRevoked } = require('../utils/tokenRevocation');
const { getClient, closeClient } = require('../utils/redisService');

afterAll(async () => {
  await closeClient(); // يمنع تحذير "Cannot log after tests are done" (حدث connect غير متزامن من ioredis-mock)
});

describe('tokenRevocation — قائمة إبطال التوكنات (Redis)', () => {
  test('توكن غير مُبطَل أصلاً: isRevoked ترجع false', async () => {
    expect(await isRevoked(`never-revoked-${Date.now()}`)).toBe(false);
  });

  test('توكن بعد استدعاء revoke عليه: isRevoked ترجع true', async () => {
    const jti = `jti-123-${Date.now()}`;
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // صالح لساعة قادمة
    await revoke(jti, futureExp);
    expect(await isRevoked(jti)).toBe(true);
  });

  test('jti فاضٍ أو exp فاضٍ: revoke لا تفعل شيء، لا ترمي استثناء', async () => {
    expect(() => revoke(null, null)).not.toThrow();
    expect(() => revoke('jti-x', null)).not.toThrow();
    expect(await isRevoked('jti-x')).toBe(false);
  });

  test('توكن منتهي الصلاحية أصلاً: revoke لا تخزّنه (لا داعي)', async () => {
    const jti = `jti-expired-${Date.now()}`;
    const pastExp = Math.floor(Date.now() / 1000) - 3600; // انتهت قبل ساعة
    await revoke(jti, pastExp);
    expect(await isRevoked(jti)).toBe(false);
  });

  test('fail-open: خطأ Redis أثناء isRevoked لا يرفض الطلب — يرجع false', async () => {
    const spy = jest.spyOn(getClient(), 'exists').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await isRevoked('any-jti')).toBe(false);
    spy.mockRestore();
  });

  test('fail-open: خطأ Redis أثناء revoke لا يرمي استثناء (حتى لو انتُظرت)', async () => {
    const client = getClient();
    const spy = jest.spyOn(client, 'set').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    await expect(revoke('jti-during-outage', futureExp)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

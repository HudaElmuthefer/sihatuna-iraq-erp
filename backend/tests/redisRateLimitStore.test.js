// backend/tests/redisRateLimitStore.test.js
//
// اختبار وحدة مباشر لـconfig/redisRateLimitStore.js — بمعزل عن express-rate-
// limit وHTTP الكاملين. الهدف: إثبات أن الحد يُطبَّق فعلياً بشكل صحيح (عدّاد
// متزايد، صلاحية تنتهي بعد windowMs) لو Redis متاح — invoiceReader.test.js
// وباقي اختبارات HTTP أثبتت أصلاً سلوك fail-open لو Redis غير متاح (بيئة
// التطوير الحالية بلا Redis حقيقي)، فهنا نحتاج ioredis-mock لإثبات الحالة
// المعاكسة (الإنفاذ الفعلي الصحيح) أيضاً.
jest.mock('ioredis', () => require('ioredis-mock'));

const RedisRateLimitStore = require('../config/redisRateLimitStore');
const { getClient, closeClient } = require('../utils/redisService');

afterAll(async () => {
  await closeClient(); // يمنع تحذير "Cannot log after tests are done" (حدث connect غير متزامن من ioredis-mock)
});

describe('RedisRateLimitStore', () => {
  test('increment: يزيد العدّاد بكل استدعاء، ويحدّد resetTime بمدة windowMs من أول طلب', async () => {
    const store = new RedisRateLimitStore(`test-${Date.now()}`);
    store.init({ windowMs: 60_000 });

    const key = 'user:1';
    const first = await store.increment(key);
    expect(first.totalHits).toBe(1);

    const second = await store.increment(key);
    expect(second.totalHits).toBe(2);

    const third = await store.increment(key);
    expect(third.totalHits).toBe(3);

    // resetTime لا يتغيّر (يبقى محسوباً من أول طلب، لا يتجدّد بكل زيادة)
    expect(second.resetTime.getTime()).toBeCloseTo(first.resetTime.getTime(), -2);
  });

  test('مفاتيح مختلفة (مستخدمون مختلفون) لهما عدّادان منفصلان تماماً', async () => {
    const store = new RedisRateLimitStore(`test-${Date.now()}`);
    store.init({ windowMs: 60_000 });

    await store.increment('user:a');
    await store.increment('user:a');
    const b = await store.increment('user:b');

    expect(b.totalHits).toBe(1); // ما تأثر بعدّاد user:a إطلاقاً
  });

  test('resetKey: يصفّر العدّاد لمفتاح محدَّد', async () => {
    const store = new RedisRateLimitStore(`test-${Date.now()}`);
    store.init({ windowMs: 60_000 });

    await store.increment('user:c');
    await store.increment('user:c');
    await store.resetKey('user:c');

    const after = await store.increment('user:c');
    expect(after.totalHits).toBe(1);
  });

  test('fail-open: خطأ Redis أثناء increment لا يرفض الطلب — يرجع كأول طلب دائماً', async () => {
    const store = new RedisRateLimitStore('test-fail-open');
    store.init({ windowMs: 60_000 });

    const spy = jest.spyOn(getClient(), 'incr').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const result = await store.increment('user:d');
    expect(result.totalHits).toBe(1);
    spy.mockRestore();
  });

  test('prefix مختلف يعني مساحة مفاتيح منفصلة حتى لو تطابق مفتاح المستخدم', async () => {
    const suffix = Date.now();
    const storeA = new RedisRateLimitStore(`limiter-a-${suffix}`);
    const storeB = new RedisRateLimitStore(`limiter-b-${suffix}`);
    storeA.init({ windowMs: 60_000 });
    storeB.init({ windowMs: 60_000 });

    await storeA.increment('same-key');
    await storeA.increment('same-key');
    const bResult = await storeB.increment('same-key');

    expect(bResult.totalHits).toBe(1); // limiter مختلف = عدّاد مستقل تماماً
  });
});

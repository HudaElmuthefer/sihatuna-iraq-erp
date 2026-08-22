// backend/tests/ocrAgent.test.js
//
// اختبارات agents/ocrAgent.js — نُموِّه child_process.spawn بدل تشغيل Python/
// PaddleOCR حقيقيين (غير مضمون توفرهما وقت الاختبار الآلي، وأثقل بكثير مما
// يحتاجه اختبار منطق التعامل مع نتيجة العملية الفرعية نفسه: تحليل JSON،
// رمز خروج غير صفري، فشل تشغيل العملية أصلاً، انتهاء المهلة).
const { EventEmitter } = require('events');

jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');
const { extractText } = require('../agents/ocrAgent');

function makeFakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { write: jest.fn(), end: jest.fn() };
  child.kill = jest.fn();
  return child;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('خروج ناجح (رمز 0) بـJSON صالح: يرجع available:true مع النص المُستخرَج', async () => {
  const child = makeFakeChild();
  spawn.mockReturnValueOnce(child);

  const promise = extractText('AAAA');
  child.stdout.emit('data', Buffer.from(JSON.stringify({ text: 'فاتورة رقم 1', avgConfidence: 0.87, lines: [{ text: 'فاتورة رقم 1', confidence: 0.87 }] })));
  child.emit('close', 0);

  await expect(promise).resolves.toEqual({ available: true, text: 'فاتورة رقم 1', avgConfidence: 0.87, lines: [{ text: 'فاتورة رقم 1', confidence: 0.87 }] });
  expect(child.stdin.write).toHaveBeenCalledWith('AAAA');
  expect(child.stdin.end).toHaveBeenCalled();
});

test('رمز خروج غير صفري: يرجع available:false مع رسالة stderr', async () => {
  const child = makeFakeChild();
  spawn.mockReturnValueOnce(child);

  const promise = extractText('AAAA');
  child.stderr.emit('data', Buffer.from('حزم PaddleOCR غير مثبَّتة'));
  child.emit('close', 1);

  const result = await promise;
  expect(result.available).toBe(false);
  expect(result.error).toContain('غير مثبَّتة');
});

test('JSON غير صالح بمخرجات stdout رغم رمز خروج 0: يرجع available:false', async () => {
  const child = makeFakeChild();
  spawn.mockReturnValueOnce(child);

  const promise = extractText('AAAA');
  child.stdout.emit('data', Buffer.from('ناتج ليس JSON'));
  child.emit('close', 0);

  const result = await promise;
  expect(result.available).toBe(false);
  expect(result.error).toEqual(expect.any(String));
});

test('فشل تشغيل العملية أصلاً (python غير موجود): يرجع available:false', async () => {
  const child = makeFakeChild();
  spawn.mockReturnValueOnce(child);

  const promise = extractText('AAAA');
  child.emit('error', new Error('ENOENT'));

  const result = await promise;
  expect(result.available).toBe(false);
  expect(result.error).toContain('تعذّر تشغيل عملية Python');
});

// backend/tests/ollamaService.test.js
//
// اختبارات utils/ollamaService.js — نُموِّه global.fetch مباشرة (لا خادم
// Ollama حقيقي وقت الاختبار الآلي، بنفس فلسفة عدم الاعتماد على خدمات
// خارجية حقيقية وقت CI). راجعي أيضاً اختبار سموك يدوي حقيقي أُجري يدوياً
// ضد خادم Ollama فعلي محلي (مذكور بملخص المرحلة الرابعة) — هذا الملف يغطي
// فقط منطق التعامل مع الاستجابة (نجاح/فشل/JSON غير صالح)، لا جودة النموذج نفسه.
const originalFetch = global.fetch;

beforeEach(() => {
  jest.resetModules();
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

describe('ollamaAvailable', () => {
  test('الخادم يستجيب بنجاح: true', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true });
    const { ollamaAvailable } = require('../utils/ollamaService');
    await expect(ollamaAvailable()).resolves.toBe(true);
  });

  test('الخادم غير قابل للوصول (اتصال مرفوض): false بدل رمي استثناء', async () => {
    global.fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const { ollamaAvailable } = require('../utils/ollamaService');
    await expect(ollamaAvailable()).resolves.toBe(false);
  });
});

describe('callOllama (نصي)', () => {
  test('رد ناجح بـJSON صالح: available:true مع parsed', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ message: { content: '{"interactions":[]}' } }));
    const { callOllama } = require('../utils/ollamaService');
    const result = await callOllama('sys', 'user');
    expect(result).toEqual({ available: true, provider: 'ollama', parsed: { interactions: [] } });
    // format:'json' وmessages بالترتيب الصحيح (نظام ثم مستخدم)
    const [, options] = global.fetch.mock.calls[0];
    const sentBody = JSON.parse(options.body);
    expect(sentBody.format).toBe('json');
    expect(sentBody.messages).toEqual([{ role: 'system', content: 'sys' }, { role: 'user', content: 'user' }]);
    expect(sentBody.model).toBe('qwen2.5:0.5b'); // النموذج النصي الافتراضي
  });

  test('خطأ HTTP من الخادم (مثلاً النموذج غير مُنزَّل): available:false بدل رمي استثناء', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ error: 'model not found' }, false, 404));
    const { callOllama } = require('../utils/ollamaService');
    const result = await callOllama('sys', 'user');
    expect(result.available).toBe(false);
    expect(result.provider).toBe('ollama');
    expect(result.error).toContain('404');
  });

  test('رد بمحتوى ليس JSON صالحاً: available:false برسالة واضحة', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ message: { content: 'ناتج نصي عادي، ليس JSON' } }));
    const { callOllama } = require('../utils/ollamaService');
    const result = await callOllama('sys', 'user');
    expect(result.available).toBe(false);
    expect(result.error).toContain('غير صالح');
  });

  test('انتهاء المهلة (خادم عالق): available:false', async () => {
    global.fetch.mockRejectedValueOnce(new Error('The operation was aborted'));
    const { callOllama } = require('../utils/ollamaService');
    const result = await callOllama('sys', 'user');
    expect(result.available).toBe(false);
  });
});

describe('callOllamaWithImage (رؤية)', () => {
  test('يستخدم نموذج الرؤية الافتراضي (لا النصي) ويرفق الصورة بمصفوفة images', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ message: { content: '{"medicines":[]}' } }));
    const { callOllamaWithImage } = require('../utils/ollamaService');
    const result = await callOllamaWithImage('sys', 'user', 'AAAA', 'image/jpeg');
    expect(result).toEqual({ available: true, provider: 'ollama', parsed: { medicines: [] } });
    const [, options] = global.fetch.mock.calls[0];
    const sentBody = JSON.parse(options.body);
    expect(sentBody.model).toBe('gemma3:4b'); // النموذج الافتراضي لدعم الرؤية
    expect(sentBody.messages[1]).toEqual({ role: 'user', content: 'user', images: ['AAAA'] });
  });
});

describe('إعدادات قابلة للتخصيص عبر متغيرات البيئة', () => {
  test('OLLAMA_TEXT_MODEL/OLLAMA_VISION_MODEL يغيّران النموذج الفعلي المُرسَل', async () => {
    process.env.OLLAMA_TEXT_MODEL = 'custom-text-model';
    process.env.OLLAMA_VISION_MODEL = 'custom-vision-model';
    global.fetch.mockResolvedValue(jsonResponse({ message: { content: '{}' } }));
    const { callOllama, callOllamaWithImage } = require('../utils/ollamaService');

    await callOllama('sys', 'user');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).model).toBe('custom-text-model');

    await callOllamaWithImage('sys', 'user', 'AAAA', 'image/jpeg');
    expect(JSON.parse(global.fetch.mock.calls[1][1].body).model).toBe('custom-vision-model');

    delete process.env.OLLAMA_TEXT_MODEL;
    delete process.env.OLLAMA_VISION_MODEL;
  });
});

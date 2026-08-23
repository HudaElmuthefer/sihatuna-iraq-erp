// backend/tests/aiProviderRouter.test.js
//
// اختبارات utils/aiProviderRouter.js — منطق التوزيع نفسه (bot/online/
// offline) بمعزل عن PostgreSQL/AI/Ollama الحقيقيين: نُموِّه config/database
// .js وutils/aiProvider.js وutils/ollamaService.js مباشرة.
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/aiProvider', () => ({ activeProvider: jest.fn(), callAI: jest.fn(), callAIWithImage: jest.fn() }));
jest.mock('../utils/ollamaService', () => ({ ollamaAvailable: jest.fn(), callOllama: jest.fn(), callOllamaWithImage: jest.fn() }));

const { query } = require('../config/database');
const { activeProvider, callAI, callAIWithImage } = require('../utils/aiProvider');
const { ollamaAvailable, callOllama, callOllamaWithImage } = require('../utils/ollamaService');
const {
  getSettings, setSettings, getMode, getFeatureStatus, routeTextCall, routeImageCall, sanitizeProvider, DEFAULT_MODE,
} = require('../utils/aiProviderRouter');

afterEach(() => {
  jest.clearAllMocks();
});

describe('sanitizeProvider', () => {
  test("'bot' و'ollama' يبقيان كما هما — مذكوران صراحة بواجهة الاختيار نفسها", () => {
    expect(sanitizeProvider('bot')).toBe('bot');
    expect(sanitizeProvider('ollama')).toBe('ollama');
  });

  test("أي مزوّد إنترنت فعلي (gemini/anthropic/أي إضافة مستقبلية) يُستبدَل بـ'online' العام", () => {
    expect(sanitizeProvider('gemini')).toBe('online');
    expect(sanitizeProvider('anthropic')).toBe('online');
    expect(sanitizeProvider('claude')).toBe('online');
  });

  test('null/undefined تبقى كما هي — لا شيء يُعقَّم لأن لا شيء موجود أصلاً', () => {
    expect(sanitizeProvider(null)).toBeNull();
    expect(sanitizeProvider(undefined)).toBeUndefined();
  });
});

describe('getSettings / getMode', () => {
  test('لا صف محفوظ إطلاقاً: كل الميزات تعود للافتراضي (online) — يطابق السلوك القديم قبل هذي الميزة', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const settings = await getSettings();
    expect(settings).toEqual({ invoiceReader: DEFAULT_MODE, drugInteractions: DEFAULT_MODE, prescriptionReader: DEFAULT_MODE, aiDiagnosis: DEFAULT_MODE, dosageValidation: DEFAULT_MODE, allergyCheck: DEFAULT_MODE });
  });

  test('قيمة محفوظة غير صالحة (تلف بيانات مثلاً): تُستبدَل بالافتراضي بصمت، لا رمي استثناء', async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { drugInteractions: 'not-a-real-mode' } }] });
    const mode = await getMode('drugInteractions');
    expect(mode).toBe(DEFAULT_MODE);
  });

  test('قيمة محفوظة صالحة: تُرجَع كما هي', async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { invoiceReader: 'offline' } }] });
    expect(await getMode('invoiceReader')).toBe('offline');
  });
});

describe('setSettings', () => {
  test('تحديث جزئي: يدمج مع القيم الحالية، لا يمحوها', async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { invoiceReader: 'offline', drugInteractions: 'bot' } }] }); // getSettings الداخلي
    query.mockResolvedValueOnce({ rows: [] }); // INSERT/UPSERT

    const result = await setSettings({ prescriptionReader: 'bot' });

    expect(result).toEqual({ invoiceReader: 'offline', drugInteractions: 'bot', prescriptionReader: 'bot', aiDiagnosis: 'online', dosageValidation: 'online', allergyCheck: 'online' });
    const upsertCall = query.mock.calls[1];
    expect(upsertCall[0]).toContain('ON CONFLICT');
    expect(JSON.parse(upsertCall[1][1])).toEqual(result);
  });

  test('قيمة غير صالحة بالتحديث: تُتجاهَل، بقية الحقول الصحيحة بنفس الطلب تُطبَّق', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [] });

    const result = await setSettings({ invoiceReader: 'bogus', drugInteractions: 'bot' });

    expect(result.invoiceReader).toBe(DEFAULT_MODE); // تجاهُل القيمة الفاسدة
    expect(result.drugInteractions).toBe('bot');
  });
});

describe('routeTextCall', () => {
  test("mode='bot': يرجع available:false فوراً بلا أي استدعاء شبكة", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { drugInteractions: 'bot' } }] });
    const result = await routeTextCall('drugInteractions', 'sys', 'user');
    expect(result).toEqual({ available: false, provider: 'bot' });
    expect(callAI).not.toHaveBeenCalled();
    expect(callOllama).not.toHaveBeenCalled();
  });

  test("mode='online': يستدعي callAI (aiProvider.js)، وحقل provider يُعقَّم لـ'online' العام (لا 'gemini' الخام)", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { drugInteractions: 'online' } }] });
    callAI.mockResolvedValueOnce({ available: true, provider: 'gemini', parsed: {} });
    const result = await routeTextCall('drugInteractions', 'sys', 'user');
    expect(callAI).toHaveBeenCalledWith('sys', 'user');
    expect(callOllama).not.toHaveBeenCalled();
    expect(result.provider).toBe('online');
  });

  test("mode='online' وclaude/anthropic فعلياً: نفس التعقيم — 'online' فقط، مو 'anthropic'", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { drugInteractions: 'online' } }] });
    callAI.mockResolvedValueOnce({ available: true, provider: 'anthropic', parsed: {} });
    const result = await routeTextCall('drugInteractions', 'sys', 'user');
    expect(result.provider).toBe('online');
  });

  test("mode='online' واستدعاء AI فشل: provider يُعقَّم حتى برد الفشل (available:false)", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { drugInteractions: 'online' } }] });
    callAI.mockResolvedValueOnce({ available: false, provider: 'gemini', error: 'Gemini 500: ...' });
    const result = await routeTextCall('drugInteractions', 'sys', 'user');
    expect(result.provider).toBe('online');
    expect(result.available).toBe(false);
  });

  test("mode='online' وبلا أي مزوّد مُعدّ إطلاقاً: {available:false} بلا حقل provider — لا شيء يُعقَّم لأن لا شيء موجود أصلاً", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { drugInteractions: 'online' } }] });
    callAI.mockResolvedValueOnce({ available: false });
    const result = await routeTextCall('drugInteractions', 'sys', 'user');
    expect(result).toEqual({ available: false });
  });

  test("mode='offline': يستدعي callOllama (ollamaService.js)، لا callAI", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { drugInteractions: 'offline' } }] });
    callOllama.mockResolvedValueOnce({ available: true, provider: 'ollama', parsed: {} });
    const result = await routeTextCall('drugInteractions', 'sys', 'user');
    expect(callOllama).toHaveBeenCalledWith('sys', 'user');
    expect(callAI).not.toHaveBeenCalled();
    expect(result.provider).toBe('ollama');
  });

  test('requestedMode صالح: يتفوّق على الإعداد المحفوظ بلا أي قراءة قاعدة بيانات', async () => {
    const result = await routeTextCall('drugInteractions', 'sys', 'user', 'bot');
    expect(result).toEqual({ available: false, provider: 'bot' });
    expect(query).not.toHaveBeenCalled();
  });

  test('requestedMode غير صالح (نص عشوائي): يُتجاهَل، يرجع للإعداد المحفوظ', async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { drugInteractions: 'bot' } }] });
    const result = await routeTextCall('drugInteractions', 'sys', 'user', 'not-a-real-mode');
    expect(result).toEqual({ available: false, provider: 'bot' });
    expect(query).toHaveBeenCalled();
  });
});

describe('routeImageCall', () => {
  test("mode='bot': يرجع available:false فوراً بلا OCR/AI (OCR نفسه يبقى يعمل بمكان آخر — راجعي prescriptionAgent.js)", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { invoiceReader: 'bot' } }] });
    const result = await routeImageCall('invoiceReader', 'sys', 'user', 'AAAA', 'image/jpeg');
    expect(result).toEqual({ available: false, provider: 'bot' });
    expect(callAIWithImage).not.toHaveBeenCalled();
    expect(callOllamaWithImage).not.toHaveBeenCalled();
  });

  test("mode='offline': يستدعي callOllamaWithImage بنفس الوسائط", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { prescriptionReader: 'offline' } }] });
    callOllamaWithImage.mockResolvedValueOnce({ available: true, provider: 'ollama', parsed: {} });
    await routeImageCall('prescriptionReader', 'sys', 'user', 'AAAA', 'image/png');
    expect(callOllamaWithImage).toHaveBeenCalledWith('sys', 'user', 'AAAA', 'image/png');
  });

  test('requestedMode صالح (offline) يتفوّق على الإعداد المحفوظ (online)', async () => {
    callOllamaWithImage.mockResolvedValueOnce({ available: true, provider: 'ollama', parsed: {} });
    const result = await routeImageCall('invoiceReader', 'sys', 'user', 'AAAA', 'image/jpeg', 'offline');
    expect(callOllamaWithImage).toHaveBeenCalledWith('sys', 'user', 'AAAA', 'image/jpeg');
    expect(callAIWithImage).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(result.provider).toBe('ollama');
  });
});

describe('getFeatureStatus', () => {
  test("mode='bot': متاح دائماً (لا يعتمد على خدمة خارجية)", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { drugInteractions: 'bot' } }] });
    expect(await getFeatureStatus('drugInteractions')).toEqual({ mode: 'bot', available: true, provider: 'bot' });
  });

  test("mode='online': available يعكس activeProvider() الحقيقي، لكن provider المُرجَع 'online' عام دائماً — لا 'gemini' الخام حتى بهذا الرد", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { invoiceReader: 'online' } }] });
    activeProvider.mockReturnValueOnce('gemini');
    expect(await getFeatureStatus('invoiceReader')).toEqual({ mode: 'online', available: true, provider: 'online' });
  });

  test("mode='online' وclaude/anthropic فعلياً: نفس التعقيم بـgetFeatureStatus أيضاً", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { invoiceReader: 'online' } }] });
    activeProvider.mockReturnValueOnce('anthropic');
    expect(await getFeatureStatus('invoiceReader')).toEqual({ mode: 'online', available: true, provider: 'online' });
  });

  test("mode='online' وبلا أي مزوّد مُعدّ: available:false، provider:null (لا شيء يُعقَّم لأن لا شيء موجود)", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { invoiceReader: 'online' } }] });
    activeProvider.mockReturnValueOnce(null);
    expect(await getFeatureStatus('invoiceReader')).toEqual({ mode: 'online', available: false, provider: null });
  });

  test("ميزة 'aiDiagnosis' مسجَّلة بنفس منطق باقي الميزات الثلاث (لا فحص Gemini/Claude مباشر منفصل)، ونفس التعقيم", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    activeProvider.mockReturnValueOnce('gemini');
    expect(await getFeatureStatus('aiDiagnosis')).toEqual({ mode: DEFAULT_MODE, available: true, provider: 'online' });
  });

  test("mode='offline': يفحص خادم Ollama حياً (لا افتراض)", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { prescriptionReader: 'offline' } }] });
    ollamaAvailable.mockResolvedValueOnce(false);
    expect(await getFeatureStatus('prescriptionReader')).toEqual({ mode: 'offline', available: false, provider: 'ollama' });
  });
});

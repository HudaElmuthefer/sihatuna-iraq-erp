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
  getSettings, setSettings, getMode, getFeatureStatus, routeTextCall, routeImageCall, DEFAULT_MODE,
} = require('../utils/aiProviderRouter');

afterEach(() => {
  jest.clearAllMocks();
});

describe('getSettings / getMode', () => {
  test('لا صف محفوظ إطلاقاً: كل الميزات تعود للافتراضي (online) — يطابق السلوك القديم قبل هذي الميزة', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const settings = await getSettings();
    expect(settings).toEqual({ invoiceReader: DEFAULT_MODE, drugInteractions: DEFAULT_MODE, prescriptionReader: DEFAULT_MODE });
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

    expect(result).toEqual({ invoiceReader: 'offline', drugInteractions: 'bot', prescriptionReader: 'bot' });
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

  test("mode='online': يستدعي callAI (aiProvider.js)", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { drugInteractions: 'online' } }] });
    callAI.mockResolvedValueOnce({ available: true, provider: 'gemini', parsed: {} });
    const result = await routeTextCall('drugInteractions', 'sys', 'user');
    expect(callAI).toHaveBeenCalledWith('sys', 'user');
    expect(callOllama).not.toHaveBeenCalled();
    expect(result.provider).toBe('gemini');
  });

  test("mode='offline': يستدعي callOllama (ollamaService.js)، لا callAI", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { drugInteractions: 'offline' } }] });
    callOllama.mockResolvedValueOnce({ available: true, provider: 'ollama', parsed: {} });
    const result = await routeTextCall('drugInteractions', 'sys', 'user');
    expect(callOllama).toHaveBeenCalledWith('sys', 'user');
    expect(callAI).not.toHaveBeenCalled();
    expect(result.provider).toBe('ollama');
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
});

describe('getFeatureStatus', () => {
  test("mode='bot': متاح دائماً (لا يعتمد على خدمة خارجية)", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { drugInteractions: 'bot' } }] });
    expect(await getFeatureStatus('drugInteractions')).toEqual({ mode: 'bot', available: true, provider: 'bot' });
  });

  test("mode='online': يعكس activeProvider() الحقيقي", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { invoiceReader: 'online' } }] });
    activeProvider.mockReturnValueOnce('gemini');
    expect(await getFeatureStatus('invoiceReader')).toEqual({ mode: 'online', available: true, provider: 'gemini' });
  });

  test("mode='offline': يفحص خادم Ollama حياً (لا افتراض)", async () => {
    query.mockResolvedValueOnce({ rows: [{ value: { prescriptionReader: 'offline' } }] });
    ollamaAvailable.mockResolvedValueOnce(false);
    expect(await getFeatureStatus('prescriptionReader')).toEqual({ mode: 'offline', available: false, provider: 'ollama' });
  });
});

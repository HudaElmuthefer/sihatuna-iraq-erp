// backend/tests/interactionAgent.test.js
//
// اختبارات منطق agents/interactionAgent.js بمعزل عن PostgreSQL/AI الحقيقيين
// (نُموِّه config/database.js وutils/aiProviderRouter.js مباشرة — الأخير
// يوزّع فعلياً بين bot/online/offline حسب إعداد المستخدم المحفوظ، راجع
// المرحلة الخامسة؛ تمويهه هنا يبقي هذا الملف مركّزاً على منطق الأزواج
// (pairing) وfallback فقط، لا منطق التوزيع نفسه) — سريعة، لا تحتاج قاعدة
// بيانات فعلية. راجع أيضاً tests/drugInteractions.test.js لاختبار تكاملي
// عبر HTTP على قاعدة PostgreSQL حقيقية (drug_interactions، بُذرت
// بـmigrations-sql/008).
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/aiProviderRouter', () => ({ routeTextCall: jest.fn() }));

const { query } = require('../config/database');
const { routeTextCall } = require('../utils/aiProviderRouter');
const { checkInteractions } = require('../agents/interactionAgent');

afterEach(() => {
  jest.clearAllMocks();
});

function dbRow(a, b, severity = 'high') {
  return { drug_a: a, drug_b: b, severity, notes: `${a}+${b} effect`, recommendation: `${a}+${b} rec` };
}

test('زوج واحد موجود بالجدول: available:true, source:db، بدون أي استدعاء AI', async () => {
  query.mockResolvedValueOnce({ rows: [dbRow('Aspirin', 'Warfarin')] });

  const result = await checkInteractions(['Aspirin', 'Warfarin'], 'en');

  expect(result).toEqual({ available: true, source: 'db', interactions: [{ drugs: ['Aspirin', 'Warfarin'], severity: 'high', effect: 'Aspirin+Warfarin effect', recommendation: 'Aspirin+Warfarin rec' }] });
  expect(routeTextCall).not.toHaveBeenCalled();
});

test('زوج غير موجود بالجدول + AI متاح: يستدعي AI فقط للأزواج غير المغطاة، source:ai', async () => {
  query.mockResolvedValueOnce({ rows: [] }); // لا تطابق بالجدول
  routeTextCall.mockResolvedValueOnce({ available: true, provider: 'gemini', parsed: { interactions: [{ drugs: ['DrugX', 'DrugY'], severity: 'medium', effect: 'e', recommendation: 'r' }] } });

  const result = await checkInteractions(['DrugX', 'DrugY'], 'en');

  expect(result.available).toBe(true);
  expect(result.source).toBe('ai');
  expect(result.provider).toBe('gemini');
  expect(result.interactions).toHaveLength(1);
  expect(routeTextCall).toHaveBeenCalledTimes(1);
});

test('مزيج: زوج معروف بالجدول + زوج غير معروف، AI متاح: source:mixed يجمع نتائج المصدرين', async () => {
  // 3 أدوية => 3 أزواج: (A,B) معروف، (A,C) و(B,C) غير معروفين
  query
    .mockResolvedValueOnce({ rows: [dbRow('A', 'B', 'high')] }) // (A,B)
    .mockResolvedValueOnce({ rows: [] }) // (A,C)
    .mockResolvedValueOnce({ rows: [] }); // (B,C)
  routeTextCall.mockResolvedValueOnce({ available: true, provider: 'anthropic', parsed: { interactions: [{ drugs: ['A', 'C'], severity: 'low', effect: 'e2', recommendation: 'r2' }] } });

  const result = await checkInteractions(['A', 'B', 'C'], 'en');

  expect(result.source).toBe('mixed');
  expect(result.interactions).toEqual([
    { drugs: ['A', 'B'], severity: 'high', effect: 'A+B effect', recommendation: 'A+B rec' },
    { drugs: ['A', 'C'], severity: 'low', effect: 'e2', recommendation: 'r2' },
  ]);
  // AI يُسأل فقط عن الأدوية بالأزواج غير المغطاة (A وC — لا B لأن زوجها الوحيد (A,B) مغطى بالجدول)
  const [featureArg, , userPromptArg] = routeTextCall.mock.calls[0];
  expect(featureArg).toBe('drugInteractions');
  expect(userPromptArg).toContain('A');
  expect(userPromptArg).toContain('C');
});

test('لا تطابق بالجدول وAI غير متاح: available:false', async () => {
  query.mockResolvedValueOnce({ rows: [] });
  routeTextCall.mockResolvedValueOnce({ available: false });

  const result = await checkInteractions(['Unknown1', 'Unknown2'], 'en');

  expect(result).toEqual({ available: false });
});

test('زوج معروف + زوج غير معروف، AI غير متاح: يرجع نتيجة db جزئية مع incomplete:true', async () => {
  // 3 أدوية => 3 أزواج: (A,B) معروف، (A,C) و(B,C) غير معروفين
  query
    .mockResolvedValueOnce({ rows: [dbRow('A', 'B')] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] });
  routeTextCall.mockResolvedValueOnce({ available: false });

  const result = await checkInteractions(['A', 'B', 'C'], 'en');

  expect(result.available).toBe(true);
  expect(result.source).toBe('db');
  expect(result.incomplete).toBe(true);
  expect(result.interactions).toHaveLength(1);
});

// backend/tests/allergyAgent.test.js
//
// اختبارات منطق agents/allergyAgent.js بمعزل عن PostgreSQL/AI الحقيقيين —
// نفس نمط tests/interactionAgent.test.js وtests/dosageAgent.test.js بالضبط.
// راجع أيضاً tests/allergyRoutes.test.js لاختبار تكاملي عبر HTTP على
// قاعدة PostgreSQL حقيقية (drug_allergy_classes، بُذرت بـmigrations-sql/011).
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/aiProviderRouter', () => ({ routeTextCall: jest.fn() }));

const { query } = require('../config/database');
const { routeTextCall } = require('../utils/aiProviderRouter');
const { checkAllergies } = require('../agents/allergyAgent');

afterEach(() => {
  jest.clearAllMocks();
});

test('مريض بلا حساسيات مسجَّلة إطلاقاً: available:true, conflicts:[], noAllergiesOnFile:true — بدون أي استعلام قاعدة بيانات أو AI', async () => {
  const result = await checkAllergies([], ['Amoxicillin'], 'en');

  expect(result).toEqual({ available: true, source: 'db', conflicts: [], noAllergiesOnFile: true });
  expect(query).not.toHaveBeenCalled();
  expect(routeTextCall).not.toHaveBeenCalled();
});

test('تطابق مباشر (نفس اسم الدواء بالضبط كحساسية مسجَّلة): يُكتشَف بلا أي استعلام قاعدة بيانات', async () => {
  const result = await checkAllergies([{ name: 'Amoxicillin', severity: 'severe' }], ['Amoxicillin'], 'en');

  expect(result.available).toBe(true);
  expect(result.source).toBe('db');
  expect(result.conflicts).toHaveLength(1);
  expect(result.conflicts[0]).toMatchObject({ drug: 'Amoxicillin', allergyName: 'Amoxicillin', severity: 'severe' });
  expect(query).not.toHaveBeenCalled(); // تطابق مباشر لا يحتاج استعلام الجدول إطلاقاً
});

test('تطابق عائلة دوائية (حساسية "Penicillin" + دواء موصوف "Amoxicillin"): يُكتشَف عبر جدول drug_allergy_classes', async () => {
  query.mockResolvedValueOnce({ rows: [{ allergy_class: 'Penicillin' }] });

  const result = await checkAllergies([{ name: 'Penicillin', severity: 'moderate' }], ['Amoxicillin'], 'ar');

  expect(result.available).toBe(true);
  expect(result.source).toBe('db');
  expect(result.conflicts).toHaveLength(1);
  expect(result.conflicts[0]).toMatchObject({ drug: 'Amoxicillin', allergyName: 'Penicillin', severity: 'moderate' });
  expect(result.conflicts[0].explanation).toContain('البنسلين');
  expect(routeTextCall).not.toHaveBeenCalled();
});

test('لا تطابق بالجدول إطلاقاً + AI متاح بلا تضارب: available:true, conflicts:[], source:ai', async () => {
  query.mockResolvedValueOnce({ rows: [] });
  routeTextCall.mockResolvedValueOnce({ available: true, provider: 'gemini', parsed: { conflicts: [] } });

  const result = await checkAllergies([{ name: 'Latex', severity: 'mild' }], ['Paracetamol'], 'en');

  expect(result).toEqual({ available: true, source: 'ai', provider: 'gemini', conflicts: [] });
});

test('لا تطابق بالجدول + AI متاح ويكتشف تضارباً: source:ai مع التضارب المُكتشَف', async () => {
  query.mockResolvedValueOnce({ rows: [] });
  routeTextCall.mockResolvedValueOnce({
    available: true, provider: 'anthropic',
    parsed: { conflicts: [{ drug: 'Codeine', allergyName: 'Morphine', severity: 'severe', explanation: 'e', recommendation: 'r' }] },
  });

  const result = await checkAllergies([{ name: 'Morphine', severity: 'severe' }], ['Codeine'], 'en');

  expect(result.source).toBe('ai');
  expect(result.conflicts).toHaveLength(1);
  expect(result.conflicts[0].source).toBe('ai');
});

test('دواءان: واحد يتطابق بالجدول والآخر لا، AI متاح ويجد تضارباً للثاني: source:mixed', async () => {
  query
    .mockResolvedValueOnce({ rows: [{ allergy_class: 'Penicillin' }] }) // Amoxicillin vs Penicillin
    .mockResolvedValueOnce({ rows: [] }); // Codeine vs Penicillin — لا تطابق
  routeTextCall.mockResolvedValueOnce({
    available: true, provider: 'gemini',
    parsed: { conflicts: [{ drug: 'Codeine', allergyName: 'Penicillin', severity: 'unknown', explanation: 'e', recommendation: 'r' }] },
  });

  const result = await checkAllergies([{ name: 'Penicillin', severity: 'moderate' }], ['Amoxicillin', 'Codeine'], 'en');

  expect(result.source).toBe('mixed');
  expect(result.conflicts).toHaveLength(2);
  const [featureArg] = routeTextCall.mock.calls[0];
  expect(featureArg).toBe('allergyCheck');
});

test('لا تطابق بالجدول وAI غير متاح: available:false — لا يُفترَض "لا تضارب" أبداً', async () => {
  query.mockResolvedValueOnce({ rows: [] });
  routeTextCall.mockResolvedValueOnce({ available: false });

  const result = await checkAllergies([{ name: 'Sulfa', severity: 'mild' }], ['UnknownDrugXYZ'], 'en');

  expect(result).toEqual({ available: false });
});

test('دواء يتطابق بالجدول + دواء آخر بلا تطابق وAI غير متاح: يرجع نتيجة db جزئية مع incomplete:true (أفضل من لا شيء)', async () => {
  query
    .mockResolvedValueOnce({ rows: [{ allergy_class: 'Penicillin' }] }) // Amoxicillin — تطابق
    .mockResolvedValueOnce({ rows: [] }); // UnknownDrug — لا تطابق
  routeTextCall.mockResolvedValueOnce({ available: false });

  const result = await checkAllergies([{ name: 'Penicillin', severity: 'severe' }], ['Amoxicillin', 'UnknownDrug'], 'en');

  expect(result.available).toBe(true);
  expect(result.source).toBe('db');
  expect(result.incomplete).toBe(true);
  expect(result.conflicts).toHaveLength(1);
});

test('حساسيتان مختلفتان + دواء واحد يتطابق مع الثانية فقط: يُكتشَف تحديداً لا كلاهما', async () => {
  query
    .mockResolvedValueOnce({ rows: [] }) // مقابل "Sulfa" — لا تطابق
    .mockResolvedValueOnce({ rows: [{ allergy_class: 'Penicillin' }] }); // مقابل "Penicillin" — تطابق

  const result = await checkAllergies(
    [{ name: 'Sulfa', severity: 'mild' }, { name: 'Penicillin', severity: 'severe' }],
    ['Amoxicillin'],
    'en'
  );

  expect(result.available).toBe(true);
  expect(result.conflicts).toHaveLength(1);
  expect(result.conflicts[0].allergyName).toBe('Penicillin');
});

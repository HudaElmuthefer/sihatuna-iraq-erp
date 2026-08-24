// backend/tests/dosageAgent.test.js
//
// اختبارات منطق agents/dosageAgent.js بمعزل عن PostgreSQL/AI الحقيقيين
// (نُموِّه config/database.js وutils/aiProviderRouter.js مباشرة) — سريعة،
// لا تحتاج قاعدة بيانات فعلية. راجع أيضاً tests/dosageRoutes.test.js
// لاختبار تكاملي عبر HTTP على قاعدة PostgreSQL حقيقية (dosage_limits،
// بُذرت بـmigrations-sql/009).
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/aiProviderRouter', () => ({ routeTextCall: jest.fn() }));

const { query } = require('../config/database');
const { routeTextCall } = require('../utils/aiProviderRouter');
const { checkDosage } = require('../agents/dosageAgent');

afterEach(() => {
  jest.clearAllMocks();
});

function dbRow(overrides = {}) {
  return {
    drug_name: 'Paracetamol', min_age: 12, max_age: null, min_weight_kg: 40, max_weight_kg: null,
    max_daily_dose: 3000, unit: 'mg', notes: 'adult ceiling', recommendation: 'do not exceed',
    ...overrides,
  };
}

test('تطابق بالجدول وجرعة ضمن الحد: status:safe، بدون أي استدعاء AI', async () => {
  query.mockResolvedValueOnce({ rows: [dbRow()] });
  const result = await checkDosage('Paracetamol', 2000, 'mg', 30, null, 'en');
  expect(result).toMatchObject({ available: true, source: 'db', status: 'safe' });
  expect(result.limit).toMatchObject({ maxDailyDose: 3000, unit: 'mg' });
  expect(routeTextCall).not.toHaveBeenCalled();
});

test('تطابق بالجدول وجرعة تتجاوز الحد: status:exceeds', async () => {
  query.mockResolvedValueOnce({ rows: [dbRow({ max_daily_dose: 3000 })] });
  const result = await checkDosage('Paracetamol', 4000, 'mg', 30, null, 'en');
  expect(result).toMatchObject({ available: true, source: 'db', status: 'exceeds' });
});

test('صف بـmax_daily_dose=0 (ممنوع كلياً — مثل أسبرين للأطفال): status:contraindicated حتى بجرعة صغيرة جداً', async () => {
  query.mockResolvedValueOnce({ rows: [dbRow({ drug_name: 'Aspirin', max_daily_dose: 0, min_age: 0, max_age: 15 })] });
  const result = await checkDosage('Aspirin', 50, 'mg', 8, null, 'en');
  expect(result).toMatchObject({ available: true, source: 'db', status: 'contraindicated' });
});

test('لا تطابق بالجدول لكن معلومات مريض متوفرة: يستدعي AI، ويرجع status منه', async () => {
  query.mockResolvedValueOnce({ rows: [] });
  routeTextCall.mockResolvedValueOnce({ available: true, provider: 'online', parsed: { status: 'safe', reasoning: 'within known ranges', recommendation: 'monitor' } });
  const result = await checkDosage('SomeObscureDrug', 100, 'mg', 25, null, 'en');
  expect(result).toMatchObject({ available: true, source: 'ai', status: 'safe', reasoning: 'within known ranges' });
  expect(routeTextCall).toHaveBeenCalledTimes(1);
  const [feature] = routeTextCall.mock.calls[0];
  expect(feature).toBe('dosageValidation');
});

test('بلا عمر ولا وزن إطلاقاً: لا يحاول تطابقاً بالجدول (كل الصفوف كانت ستُعتبَر متطابقة خطأً)، ينتقل مباشرة لـAI', async () => {
  routeTextCall.mockResolvedValueOnce({ available: true, provider: 'online', parsed: { status: 'unknown', reasoning: 'insufficient patient info' } });
  const result = await checkDosage('Paracetamol', 500, 'mg', null, null, 'en');
  expect(query).not.toHaveBeenCalled();
  expect(routeTextCall).toHaveBeenCalledTimes(1);
  expect(result.status).toBe('unknown');
});

test('لا تطابق بالجدول وAI غير متاح: available:false — أبداً لا يُفترَض "آمن" بغياب المعلومة', async () => {
  query.mockResolvedValueOnce({ rows: [] });
  routeTextCall.mockResolvedValueOnce({ available: false });
  const result = await checkDosage('SomeObscureDrug', 100, 'mg', 25, null, 'en');
  expect(result).toEqual({ available: false });
});

test("رد AI بقيمة status غير معروفة (مش من الأربعة المتوقَّعة): تُستبدَل بـ'unknown' بأمان، لا تُمرَّر كما هي بصمت", async () => {
  query.mockResolvedValueOnce({ rows: [] });
  routeTextCall.mockResolvedValueOnce({ available: true, provider: 'online', parsed: { status: 'probably-fine-ish' } });
  const result = await checkDosage('SomeObscureDrug', 100, 'mg', 25, null, 'en');
  expect(result.status).toBe('unknown');
});

test('وضع bot (routeTextCall يرجع available:false فوراً بلا AI حقيقي) ولا تطابق بالجدول: available:false بأمان', async () => {
  query.mockResolvedValueOnce({ rows: [] });
  routeTextCall.mockResolvedValueOnce({ available: false, provider: 'bot' });
  const result = await checkDosage('SomeObscureDrug', 100, 'mg', 25, null, 'en', 'bot');
  expect(result).toEqual({ available: false });
});

test('mode يُمرَّر إلى routeTextCall كوسيط رابع (اختيار المستخدم لهذا الطلب تحديداً)', async () => {
  query.mockResolvedValueOnce({ rows: [] });
  routeTextCall.mockResolvedValueOnce({ available: false });
  await checkDosage('SomeObscureDrug', 100, 'mg', 25, null, 'en', 'offline');
  expect(routeTextCall).toHaveBeenCalledWith('dosageValidation', expect.any(String), expect.any(String), 'offline');
});

test('عدّة صفوف مطابقة (عمر ووزن معاً موجودان): يفضّل الصف الأكثر تخصيصاً (عمر+وزن معاً) حسب ORDER BY بالاستعلام نفسه', async () => {
  // نتحقق فقط إن findDbMatch يمرّر كلا القيمتين للاستعلام — ترتيب التفضيل
  // الفعلي (ORDER BY) يُختبَر تكاملياً بـdosageRoutes.test.js على بيانات حقيقية.
  query.mockResolvedValueOnce({ rows: [dbRow()] });
  await checkDosage('Paracetamol', 1000, 'mg', 30, 60, 'en');
  const [, params] = query.mock.calls[0];
  expect(params).toEqual(['Paracetamol', 30, 60]);
});

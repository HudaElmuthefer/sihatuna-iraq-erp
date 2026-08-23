// backend/tests/prescriptionAgent.test.js
//
// اختبارات agents/prescriptionAgent.js — السير الكامل (OCR → AI → فحص
// تضارب) بمعزل تام عن PaddleOCR/AI/PostgreSQL الحقيقيين: نُموِّه الوكلاء
// الثلاثة الأخرى (ocrAgent، aiProviderRouter، interactionAgent) مباشرة.
// يغطي هذا الملف منطق التنسيق (orchestration) نفسه فقط — كل وكيل له
// اختباراته الخاصة (ocrAgent.test.js، interactionAgent.test.js).
jest.mock('../agents/ocrAgent', () => ({ extractText: jest.fn() }));
jest.mock('../utils/aiProviderRouter', () => ({ routeImageCall: jest.fn() }));
jest.mock('../agents/interactionAgent', () => ({ checkInteractions: jest.fn() }));
jest.mock('../agents/allergyAgent', () => ({ checkAllergies: jest.fn() }));

const { extractText } = require('../agents/ocrAgent');
const { routeImageCall } = require('../utils/aiProviderRouter');
const { checkInteractions } = require('../agents/interactionAgent');
const { checkAllergies } = require('../agents/allergyAgent');
const { readPrescription } = require('../agents/prescriptionAgent');

afterEach(() => {
  jest.clearAllMocks();
});

test('وصفة بدواءين متضاربين: تستدعي فحص التضارب وترجع hasInteractions:true + أعلى شدة', async () => {
  extractText.mockResolvedValueOnce({ available: true, text: 'وصفة نصية', avgConfidence: 0.8, lines: [] });
  routeImageCall.mockResolvedValueOnce({
    available: true,
    provider: 'gemini',
    parsed: {
      patientName: 'أحمد', doctorName: 'د. علي', date: '2026-08-22', confidence: 'high',
      medicines: [{ name: 'Aspirin', dosage: '1x daily', quantity: 30, unit: 'tablet' }, { name: 'Warfarin', dosage: '1x daily', quantity: 30, unit: 'tablet' }],
    },
  });
  checkInteractions.mockResolvedValueOnce({ available: true, source: 'db', interactions: [{ drugs: ['Aspirin', 'Warfarin'], severity: 'high', effect: 'e', recommendation: 'r' }] });

  const result = await readPrescription('AAAA', 'image/jpeg', 'en');

  expect(routeImageCall.mock.calls[0][0]).toBe('prescriptionReader');
  expect(checkInteractions).toHaveBeenCalledWith(['Aspirin', 'Warfarin'], 'en');
  expect(result.available).toBe(true);
  expect(result.medicines).toHaveLength(2);
  expect(result.hasInteractions).toBe(true);
  expect(result.highestSeverity).toBe('high');
  expect(result.interactionSource).toBe('db');
});

test('وصفة بدواء واحد فقط: لا يستدعي فحص التضارب إطلاقاً (يحتاج دواءين على الأقل)', async () => {
  extractText.mockResolvedValueOnce({ available: false, error: 'لا يهم هنا' });
  routeImageCall.mockResolvedValueOnce({ available: true, provider: 'gemini', parsed: { medicines: [{ name: 'Paracetamol', dosage: '', quantity: 20, unit: 'tablet' }] } });

  const result = await readPrescription('AAAA', 'image/jpeg', 'ar');

  expect(checkInteractions).not.toHaveBeenCalled();
  expect(result.hasInteractions).toBe(false);
  expect(result.interactions).toEqual([]);
  expect(result.highestSeverity).toBeNull();
});

test('وصفة بلا تضارب فعلي (فحص تم لكن بلا نتائج): hasInteractions:false', async () => {
  extractText.mockResolvedValueOnce({ available: true, text: 'نص', avgConfidence: 0.9, lines: [] });
  routeImageCall.mockResolvedValueOnce({ available: true, provider: 'gemini', parsed: { medicines: [{ name: 'A' }, { name: 'B' }] } });
  checkInteractions.mockResolvedValueOnce({ available: true, source: 'ai', interactions: [] });

  const result = await readPrescription('AAAA', 'image/jpeg', 'en');

  expect(result.hasInteractions).toBe(false);
  expect(result.interactions).toEqual([]);
});

test('فشل استدعاء AI نفسه: available:false بدون رمي استثناء، ولا يستدعي فحص التضارب', async () => {
  extractText.mockResolvedValueOnce({ available: true, text: 'نص', avgConfidence: 0.9, lines: [] });
  routeImageCall.mockResolvedValueOnce({ available: false, provider: 'gemini', error: 'Gemini 500' });

  const result = await readPrescription('AAAA', 'image/jpeg', 'en');

  expect(result).toEqual({ available: false, error: 'Gemini 500', provider: 'gemini' });
  expect(checkInteractions).not.toHaveBeenCalled();
});

test('لا patientAllergies مُمرَّرة إطلاقاً (لا مريض مربوط): لا يستدعي فحص الحساسية، allergyChecked:false', async () => {
  extractText.mockResolvedValueOnce({ available: true, text: 'نص', avgConfidence: 0.9, lines: [] });
  routeImageCall.mockResolvedValueOnce({ available: true, provider: 'gemini', parsed: { medicines: [{ name: 'Amoxicillin' }] } });

  const result = await readPrescription('AAAA', 'image/jpeg', 'en', 'online');

  expect(checkAllergies).not.toHaveBeenCalled();
  expect(result.allergyChecked).toBe(false);
  expect(result.allergyAvailable).toBeNull();
  expect(result.allergyConflicts).toEqual([]);
  expect(result.hasAllergyConflicts).toBe(false);
});

test('مريض مربوط بحساسية بنسلين + وصفة أموكسيسيلين: يستدعي فحص الحساسية ويرجع التضارب', async () => {
  extractText.mockResolvedValueOnce({ available: true, text: 'نص', avgConfidence: 0.9, lines: [] });
  routeImageCall.mockResolvedValueOnce({ available: true, provider: 'gemini', parsed: { medicines: [{ name: 'Amoxicillin' }] } });
  checkAllergies.mockResolvedValueOnce({
    available: true, source: 'db',
    conflicts: [{ drug: 'Amoxicillin', allergyName: 'Penicillin', severity: 'severe', explanation: 'e', recommendation: 'r', source: 'db' }],
  });

  const patientAllergies = [{ name: 'Penicillin', severity: 'severe' }];
  const result = await readPrescription('AAAA', 'image/jpeg', 'en', 'online', patientAllergies);

  expect(checkAllergies).toHaveBeenCalledWith(patientAllergies, ['Amoxicillin'], 'en', 'online');
  expect(result.allergyChecked).toBe(true);
  expect(result.allergyAvailable).toBe(true);
  expect(result.hasAllergyConflicts).toBe(true);
  expect(result.allergyConflicts).toHaveLength(1);
  expect(result.allergySource).toBe('db');
});

test('مريض مربوط لكن فشل فحص الحساسية (لا تطابق بالجدول + AI غير متاح): allergyChecked:true لكن allergyAvailable:false، لا تضارب وهمي', async () => {
  extractText.mockResolvedValueOnce({ available: true, text: 'نص', avgConfidence: 0.9, lines: [] });
  routeImageCall.mockResolvedValueOnce({ available: true, provider: 'gemini', parsed: { medicines: [{ name: 'SomeDrug' }] } });
  checkAllergies.mockResolvedValueOnce({ available: false });

  const result = await readPrescription('AAAA', 'image/jpeg', 'en', 'online', [{ name: 'Sulfa', severity: 'mild' }]);

  expect(result.allergyChecked).toBe(true);
  expect(result.allergyAvailable).toBe(false);
  expect(result.hasAllergyConflicts).toBe(false);
  expect(result.allergyConflicts).toEqual([]);
});

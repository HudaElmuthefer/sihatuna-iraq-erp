// frontend/src/pages/AIDiagnosisPage.test.js
//
// Regression test (Part 2 static audit): getRecommendedDoctors() called
// doc.keys.includes(s) with no guard. The referral-doctors list is served
// from a plain JSON data file (backend/data/basra-referral-doctors.json)
// that's hand-edited without a build step — a doctor entry missing its
// `keys` array (currently 0 of 30 real entries, but nothing enforces this)
// would throw and break symptom matching for every doctor, not just the
// incomplete one. Guarded with the same `(field||[])` pattern used
// elsewhere in this codebase.
import { getRecommendedDoctors } from './AIDiagnosisPage';

describe('getRecommendedDoctors — a doctor entry missing `keys` does not crash matching', () => {
  test('skips the entry without keys and still matches the rest', () => {
    const doctors = [
      { id: 1, name: 'د. مع كلمات مفتاحية', keys: ['صداع', 'حمى'] },
      { id: 2, name: 'د. بلا كلمات مفتاحية' }, // missing `keys` entirely
    ];
    expect(() => getRecommendedDoctors(['صداع'], doctors)).not.toThrow();
    const result = getRecommendedDoctors(['صداع'], doctors);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});

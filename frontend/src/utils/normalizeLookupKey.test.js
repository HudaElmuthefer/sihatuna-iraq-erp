// frontend/src/utils/normalizeLookupKey.test.js
import normalizeLookupKey from './normalizeLookupKey';

const STATUSES = {
  pending: { ar: 'بانتظار العينة', en: 'Awaiting Sample' },
  processing: { ar: 'قيد التحليل', en: 'Processing' },
  completed: { ar: 'مكتمل', en: 'Completed' },
};

describe('normalizeLookupKey', () => {
  test('a known key is returned unchanged', () => {
    expect(normalizeLookupKey('processing', STATUSES, 'pending')).toBe('processing');
  });

  test('an unrecognized value falls back to the default key', () => {
    expect(normalizeLookupKey('some-legacy-value', STATUSES, 'pending')).toBe('pending');
  });

  test('undefined/null/empty-string values fall back to the default key', () => {
    expect(normalizeLookupKey(undefined, STATUSES, 'pending')).toBe('pending');
    expect(normalizeLookupKey(null, STATUSES, 'pending')).toBe('pending');
    expect(normalizeLookupKey('', STATUSES, 'pending')).toBe('pending');
  });

  // Regression test for the actual bug this function fixes: display code
  // used `STATUSES[value] || STATUSES.pending` (a fake default for *display*
  // only) while filtering compared the raw, un-defaulted value — so a record
  // with an unrecognized status displayed as "Awaiting Sample" but never
  // matched a "pending" filter. Using this same function for both sides
  // keeps them in agreement.
  test('the same unrecognized value normalizes identically for display and filtering', () => {
    const record = { status: 'some-legacy-value' };
    const displayKey = normalizeLookupKey(record.status, STATUSES, 'pending');
    const filterValue = 'pending';
    expect(STATUSES[displayKey]).toBeDefined();
    expect(displayKey === filterValue).toBe(true);
  });
});

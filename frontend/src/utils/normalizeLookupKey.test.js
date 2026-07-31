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

  // Edge case: uses Object.prototype.hasOwnProperty.call rather than `in` or
  // `lookup.hasOwnProperty(...)` specifically so inherited properties every
  // plain object has (toString, constructor, hasOwnProperty itself...) are
  // never mistaken for a real lookup key — `'toString' in STATUSES` is true
  // even though STATUSES never defines it.
  test('inherited Object.prototype properties are not mistaken for real keys', () => {
    expect(normalizeLookupKey('toString', STATUSES, 'pending')).toBe('pending');
    expect(normalizeLookupKey('constructor', STATUSES, 'pending')).toBe('pending');
    expect(normalizeLookupKey('hasOwnProperty', STATUSES, 'pending')).toBe('pending');
  });

  test('an empty lookup table always falls back to the default key', () => {
    expect(normalizeLookupKey('pending', {}, 'fallback')).toBe('fallback');
    expect(normalizeLookupKey(undefined, {}, 'fallback')).toBe('fallback');
  });
});

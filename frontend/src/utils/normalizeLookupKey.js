// frontend/src/utils/normalizeLookupKey.js
//
// Resolves a raw stored value against a known-keys lookup object, falling
// back to a designated default key when the raw value isn't a known key.
// Use this SAME function for both display and filtering against a lookup
// table (e.g. STATUSES, CATEGORIES, MODALITIES) — using two different
// fallback mechanisms (an unguarded "||" default for display, a raw "==="
// comparison for filtering) is what let a record display as e.g. "Pending"
// while never actually matching a "Pending" filter, since its real stored
// value didn't match any known key.
export default function normalizeLookupKey(rawValue, lookup, defaultKey) {
  return Object.prototype.hasOwnProperty.call(lookup, rawValue) ? rawValue : defaultKey;
}

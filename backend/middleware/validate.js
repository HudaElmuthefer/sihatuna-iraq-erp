// backend/middleware/validate.js
//
// Lightweight server-side input validation, with no extra external
// library. Before this file, data validation (like "name is required")
// only existed inside the frontend UI -- any direct call to the API
// (through Postman, for example, or malicious code) could send empty or
// wrongly-typed data, which would then be accepted directly and written to
// the database.
//
// Simple schema format:
//   { fieldName: { required: true, type: 'string', minLength: 2, maxLength: 200, pattern: /^\S+@\S+\.\S+$/ } }
//
// Supported type values: 'string' | 'number' | 'array'
//
// Usage:
//   router.post('/patients', auth, validate(schemas.patients), (req, res) => {...})
//
// Passing schema as undefined (any module with no schema defined yet)
// makes the function skip validation entirely and call next() directly --
// this lets schemas be added gradually to the most important modules
// without breaking other modules that aren't covered yet.
//
// ── Fix: a default maximum length for any text field ─────────────────────────
// Before this change there was no maximum length at all for text -- a
// field like "name" could theoretically accept millions of characters in
// one request (up to the overall 50MB request limit set by express.json).
// This opens the door to abuse (storing unreasonably huge data in a small
// field, or trying to slow down the database). The default limit here is
// 5000 characters for any text field with no custom maxLength in its
// schema -- more than enough for the longest reasonable text field in the
// system (notes, addresses...), and any field can explicitly set a smaller
// or larger number in its own schema if it needs to.
const DEFAULT_MAX_LENGTH = 5000;

// ── A reusable, raw validation function ──────────────────────────────────────
// The exact same validation logic as above, but as a standalone function
// that works directly on any object instead of relying on req/res -- this
// lets the same validation rules be used in non-HTTP contexts too, such as
// validating each row when importing data from an Excel file (see
// routes/excelImport.js), instead of duplicating the same logic in two
// different places.
const validateFields = (schema, obj) => {
  if (!schema) return [];
  const errors = [];
  for (const [field, rules] of Object.entries(schema)) {
    const value = obj ? obj[field] : undefined;
    const isEmpty = value === undefined || value === null || value === '';

    if (rules.required && isEmpty) {
      errors.push(`الحقل "${field}" مطلوب`);
      continue;
    }
    if (isEmpty) continue;

    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push(`الحقل "${field}" يجب أن يكون نصاً`);
    } else if (rules.type === 'number' && typeof value !== 'number') {
      errors.push(`الحقل "${field}" يجب أن يكون رقماً`);
    } else if (rules.type === 'array' && !Array.isArray(value)) {
      errors.push(`الحقل "${field}" يجب أن يكون قائمة`);
    } else if (rules.minLength && typeof value === 'string' && value.trim().length < rules.minLength) {
      errors.push(`الحقل "${field}" يجب ألا يقل عن ${rules.minLength} حرفاً`);
    } else if (typeof value === 'string') {
      const maxLen = rules.maxLength || DEFAULT_MAX_LENGTH;
      if (value.length > maxLen) {
        errors.push(`الحقل "${field}" يجب ألا يزيد عن ${maxLen} حرفاً`);
      } else if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`الحقل "${field}" بصيغة غير صحيحة`);
      }
    }
  }
  return errors;
};

const validate = (schema) => (req, res, next) => {
  const errors = validateFields(schema, req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'بيانات غير صالحة', errors });
  }
  next();
};

module.exports = validate;
module.exports.validateFields = validateFields;

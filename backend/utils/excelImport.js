// backend/utils/excelImport.js
//
// A tool for parsing uploaded Excel files (.xlsx/.xls) to bulk-import data
// (patients, doctors...) -- converts the file into data rows mapped onto
// the system's internal field names, regardless of the language or letter
// case of the column headers.
const XLSX = require('xlsx');

// Converts common Arabic values (gender, status) to the English form
// actually stored in the database -- also accepts English values directly
// for anyone who prefers them.
const GENDER_MAP = { 'ذكر': 'male', 'أنثى': 'female', 'انثى': 'female', 'male': 'male', 'female': 'female' };
const STATUS_MAP = { 'نشط': 'active', 'غير نشط': 'inactive', 'active': 'active', 'inactive': 'inactive' };

function normalizeValue(field, rawValue) {
  if (rawValue === undefined || rawValue === null) return '';
  const value = String(rawValue).trim();
  if (field === 'gender') return GENDER_MAP[value.toLowerCase()] || value;
  if (field === 'status') return STATUS_MAP[value.toLowerCase()] || value;
  return value;
}

// columnMap: { 'column header in the file': 'internal_field_name', ... } --
// the same internal field can be repeated under several possible headers
// (Arabic/English) in the same dictionary.
// Returns: { rows: [{ rowNumber, data }], error } -- rowNumber matches the
// actual row number in the Excel file (accounting for the header row) to
// make precise error reporting easier.
function parseExcelBuffer(buffer, columnMap) {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    return { rows: [], error: 'تعذّر قراءة الملف — تأكد أنه ملف Excel صالح (.xlsx أو .xls)' };
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { rows: [], error: 'الملف لا يحتوي أي ورقة عمل (sheet)' };

  const sheet = workbook.Sheets[firstSheetName];
  // defval: '' guarantees an empty cell comes back as an empty string instead of the field being omitted from the object entirely
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (rawRows.length === 0) return { rows: [], error: 'الملف فارغ — لا توجد أي صفوف بيانات تحت صف العناوين' };

  // A reasonable cap on the number of rows per import -- protects against
  // an accidentally (or deliberately) huge file freezing the server during processing
  if (rawRows.length > 5000) {
    return { rows: [], error: `الملف يحتوي ${rawRows.length} صف — الحد الأقصى المسموح 5000 صف بالمرة الواحدة` };
  }

  // Matching the actual column headers (regardless of letter case and extra whitespace)
  const normalizedColumnMap = {};
  Object.entries(columnMap).forEach(([header, field]) => {
    normalizedColumnMap[header.trim().toLowerCase()] = field;
  });

  const rows = rawRows.map((rawRow, index) => {
    const mapped = {};
    Object.entries(rawRow).forEach(([header, value]) => {
      const field = normalizedColumnMap[String(header).trim().toLowerCase()];
      if (field) mapped[field] = normalizeValue(field, value);
    });
    return { rowNumber: index + 2, data: mapped }; // +2: the header row is row 1, and data actually starts at row 2
  });

  return { rows, error: null };
}

module.exports = { parseExcelBuffer };

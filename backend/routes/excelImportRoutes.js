// backend/routes/excelImportRoutes.js
//
// A factory for a bulk Excel-file import route, on the same idea as
// pgCrud.js (a reusable factory for more than one module) — adds a
// POST /api/<apiName>/import-excel route.
//
// The import result is not "all or nothing": every row is processed and
// saved independently of the other rows on purpose (no single
// transaction wrapping all of them) — because the goal is "import every
// valid row, and tell me exactly which rows are wrong and why", not
// rejecting the whole file because of one bad row among hundreds of good ones.
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const { pool } = require('../config/database');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const { validateFields } = require('../middleware/validate');
const { parseExcelBuffer } = require('../utils/excelImport');
const { moduleRegistry } = require('./pgCrud');

// Memory storage only (memoryStorage) — the file is read and parsed
// directly and never written to disk at all, so there's no later cleanup
// needed and no risk of temporary files piling up.
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB is plenty even for thousands of rows as raw text
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      const err = new Error('الملف يجب أن يكون بصيغة Excel (.xlsx أو .xls)');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

// apiName: the route name (appears in the URL: /api/<apiName>/import-excel)
// tableName: the actual database table name if it differs from apiName
//            (e.g. ambulanceVehicles -> ambulance_vehicles), on the same
//            idea as sqlTableName in pgCrud.js — must exactly match the
//            name used there for the same module, otherwise the insert
//            fails with a "table does not exist" error
// schema: the same validation schema used in middleware/schemas.js for this module
// columnMap: a dictionary of "Excel file column header" -> "internal field name"
// options.indexedColumns: now explicitly required (no default value) — must
//            exactly match the same array passed to pgCrud() for the same
//            module in modules.js (even if it's an empty []), otherwise the
//            insert fails.
//            ── fail-fast fix: the implicit default used to be
//            name/phone/status, which is wrong for most tables (pure JSONB
//            storage) — exactly the same bug as in pgCrud.js that actually
//            broke 4 modules during import (projects, departments,
//            inventory, assets) before this fix. Forgetting to pass it now
//            stops the route from registering immediately with a clear
//            message instead of a vague import failure later.
const registerExcelImport = (router, apiName, schema, columnMap, options = {}) => {
  if (options.indexedColumns === undefined) {
    throw new Error(
      `registerExcelImport('${apiName}'): options.indexedColumns is explicitly required and has no default value.\n` +
      `   Pass the exact same array used when registering pgCrud() for the same module (even if []).`
    );
  }
  const {
    indexedColumns,
    hospitalScoped = false,
    permission = null,
    tableName = apiName,
    limiter = (req, res, next) => next(), // no extra rate limit if none is passed
    duplicateCheck = null, // example: ['name', 'phone'] — see isDuplicate below
    // ── Fix: an optional default fill-in after parsing each row ────────────────────────
    // Some numeric fields (like spent/progress/milestones in the projects
    // module) aren't columns in the Excel file at all, so they stay
    // undefined and break the frontend's calculations (showing "NaN%" or
    // "undefined/undefined"). afterParse(data) is an optional function
    // called on every row after it's parsed and before it's validated — it
    // can return a modified copy with reasonable default values for the
    // missing fields.
    afterParse = null,
  } = options;

  // ── Excel export feature: nice column headers ─────────────────────────────
  // columnMap maps several possible headers to the same field (e.g. 'الاسم'
  // and 'اسم المريض' and 'Name' all -> 'name', for import flexibility). For
  // export we want one nice header per field — we take the first header we
  // encounter in key order (usually the main Arabic label in every current
  // module definition). It's stored in moduleRegistry (the same shared
  // registry used for the recycle bin) for export-excel in pgCrud.js to
  // read — this works even if registerExcelImport is called before
  // pgCrud() for the same module (the actual call order in modules.js),
  // because pgCrud.js merges instead of replacing when it registers later.
  const exportHeaders = {};
  Object.entries(columnMap).forEach(([header, field]) => {
    if (!(field in exportHeaders)) exportHeaders[field] = header;
  });
  moduleRegistry[apiName] = { ...moduleRegistry[apiName], exportHeaders };

  // ── Fix: duplicate detection before insert ────────────────────────────────
  // Before this, uploading the same file twice (by mistake, or after adding
  // new rows to an old file) used to create full duplicate copies of every
  // record, with no warning at all. Now we check before every insert: if a
  // record already exists that exactly matches every duplicateCheck field
  // (e.g. the same name and the same phone for a patient), we skip it and
  // report it as a "duplicate" instead of inserting it a second time. An
  // indexed field (indexedColumns) is queried directly (faster), and any
  // non-indexed field is queried from the JSONB column (data->>'field') —
  // a bit slower but accurate.
  const isDuplicate = async (data, userHospitalId) => {
    if (!duplicateCheck || duplicateCheck.length === 0) return false;
    const conditions = [];
    const values = [];
    duplicateCheck.forEach((field) => {
      const indexed = indexedColumns.find(c => c.field === field);
      const expr = indexed ? indexed.column : `data->>'${field}'`;
      values.push(data[field] ?? '');
      conditions.push(`${expr} = $${values.length}`);
    });
    // The check stays scoped to the same facility only in multi-facility
    // systems — the same name and phone at two different hospitals is a
    // legitimate case (different patients), not a duplicate
    if (hospitalScoped && userHospitalId) {
      values.push(userHospitalId);
      conditions.push(`data->>'hospitalId' = $${values.length}`);
    }
    const sql = `SELECT id FROM ${tableName} WHERE ${conditions.join(' AND ')} LIMIT 1`;
    const result = await pool.query(sql, values);
    return result.rows.length > 0;
  };

  // ── Downloading a blank template ──────────────────────────────────────────
  // Builds an Excel file with a header row + one example row, with exactly
  // the expected columns — saves the user from guessing the correct column
  // names or their order.
  if (options.template) {
    router.get(`/${apiName}/import-template`, auth, requirePermission(permission), (req, res, next) => {
      try {
        const headers = options.template.map(t => t.header);
        const example = options.template.map(t => t.example || '');
        const ws = XLSX.utils.aoa_to_sheet([headers, example]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, apiName);
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${apiName}-template.xlsx"`);
        res.send(buffer);
      } catch (err) { next(err); }
    });
  }

  router.post(`/${apiName}/import-excel`, auth, requirePermission(permission), limiter, importUpload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'لم يُرفَع أي ملف' });

      const { rows, error } = parseExcelBuffer(req.file.buffer, columnMap);
      if (error) return res.status(400).json({ message: error });

      const results = { imported: 0, failed: 0, duplicates: 0, errors: [], duplicateRows: [] };

      for (const { rowNumber, data: rawData } of rows) {
        // A completely empty row (e.g. an extra trailing row in the file by mistake) — silently skip it
        if (Object.values(rawData).every(v => v === '' || v === undefined)) continue;

        // ── Fix: afterParse is now awaited and receives hospitalId as a
        // second argument — allows afterParse functions to make an actual
        // database query while processing the row (e.g. converting a ward's
        // text name in the Excel file into an actual numeric wardId by
        // looking it up in the wards table), not just local transformations
        // on the same row as before. Synchronous (non-async) functions keep
        // working with no change at all — awaiting a plain value that isn't
        // a Promise returns it immediately as is.
        const data = afterParse ? await afterParse(rawData, hospitalScoped ? req.user?.hospitalId : null) : rawData;

        const rowErrors = validateFields(schema, data);
        if (rowErrors.length > 0) {
          results.failed++;
          results.errors.push({ row: rowNumber, messages: rowErrors });
          continue;
        }

        // Automatically enforce the user's facility — exactly the same logic as pgCrud.js
        if (hospitalScoped && req.user?.hospitalId) {
          data.hospitalId = req.user.hospitalId;
        }
        if (!data.status) data.status = 'active'; // a reasonable default if the column isn't in the file

        try {
          if (await isDuplicate(data, req.user?.hospitalId)) {
            results.duplicates++;
            results.duplicateRows.push({ row: rowNumber, name: data.name || data.title || '' });
            continue;
          }
        } catch (dupErr) {
          // The duplicate check itself failed (e.g. a JSONB column needing
          // different syntax) — we don't stop the whole import because of
          // it, we proceed to insert directly as if there's no duplicate
          console.warn(`[${apiName}] Duplicate check failed for row ${rowNumber}:`, dupErr.message);
        }

        const indexedValues = indexedColumns.map(({ field }) => data[field] ?? null);
        const rest = { ...data };
        indexedColumns.forEach(({ field }) => delete rest[field]);

        // The same two-branch pattern used in pgCrud.js exactly: pure JSONB
        // storage if there are no extra indexed columns (like
        // ambulanceVehicles), or columns + JSONB
        let insertSql, insertValues;
        if (indexedColumns.length === 0) {
          insertSql = `INSERT INTO ${tableName} (data) VALUES ($1)`;
          insertValues = [JSON.stringify(rest)];
        } else {
          const columnsSql = indexedColumns.map(c => c.column).join(', ');
          const placeholders = indexedColumns.map((_, i) => `$${i + 1}`).join(', ');
          const dataPlaceholder = `$${indexedColumns.length + 1}`;
          insertSql = `INSERT INTO ${tableName} (${columnsSql}, data) VALUES (${placeholders}, ${dataPlaceholder})`;
          insertValues = [...indexedValues, JSON.stringify(rest)];
        }

        try {
          await pool.query(insertSql, insertValues);
          results.imported++;
        } catch (dbErr) {
          results.failed++;
          results.errors.push({ row: rowNumber, messages: ['خطأ حفظ بقاعدة البيانات: ' + dbErr.message] });
        }
      }

      console.log(`[${apiName}] Excel import: ${results.imported} succeeded, ${results.duplicates} duplicate, ${results.failed} failed -- by user #${req.user?.id}`);
      res.json(results);
    } catch (err) { next(err); }
  });
};

module.exports = registerExcelImport;

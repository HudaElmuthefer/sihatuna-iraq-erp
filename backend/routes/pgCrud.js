// backend/routes/pgCrud.js
//
// A unified CRUD route factory that runs on PostgreSQL, built on the same
// idea as the original crud() (used for db.json) but with actual storage
// in a relational database.
//
// Storage strategy: a "data" column of type JSONB holds the record's full
// data exactly as the frontend sends it, while specific explicit columns
// (indexedColumns) exist only for indexing and fast search. This avoids a
// problem we ran into before: any wrong assumption about column names
// (like what happened with the appointment validation schema) silently
// rejects save operations. With this pattern, any new field the frontend
// adds in the future is automatically stored and retrieved with no need to
// change the table structure at all.
//
// The fourth parameter (indexedColumns) is an array of items shaped like
// { field, column }:
//   field  = the field name exactly as the frontend sends it (e.g. "patientId")
//   column = the actual database column name (e.g. "patient_id")
// This allows the naming to differ between the frontend (usually
// camelCase) and the database (snake_case, following the convention used
// across the rest of the tables), instead of assuming the two names match.
//
// The sixth parameter (options.hospitalScoped) — multi-facility support (phase 4):
// If true, the user's facility is automatically enforced on every operation:
//   - GET all: results are filtered to the user's facility only (data->>'hospitalId')
//   - GET one / PUT / DELETE: access is denied (404) for a record belonging to another facility
//   - POST: the user's hospitalId is forced onto the new record, ignoring
//     any value sent by the client (protection against impersonating
//     another facility by manually tampering with the request)
// Filtering is only applied if the user themselves has a hospitalId set
// (on their account — see the hospitalId column in db.json for the users
// table). A user with no hospitalId (such as a ministry-level admin
// account) sees everything with no filtering — this is intentional behavior.
//
// Always check the actual fields on the frontend page before deciding —
// this is exactly the lesson learned from the earlier bug with the
// appointment validation schema.
//
// The external contract matches the original db.json routes exactly:
//   GET    /api/<table>        -> the full list (or filtered by facility)
//   GET    /api/<table>/:id    -> a single record
//   POST   /api/<table>        -> create (returns the full record with an id)
//   PUT    /api/<table>/:id    -> edit
//   DELETE /api/<table>/:id    -> delete
// This way the frontend needs no changes at all when moving from db.json to PostgreSQL.
const { pool } = require('../config/database');
const auth = require('../middleware/auth');
const { logAudit } = require('../utils/auditLog');
const validate = require('../middleware/validate');
const requirePermission = require('../middleware/requirePermission');
const XLSX = require('xlsx');
// ── Phase two: optional caching (Redis) ─────────────────────────────
// See the explanation of the "generations" (versioned cache) pattern at
// the top of utils/redisService.js. Only enabled for modules that
// explicitly pass options.cache (currently: doctors, inventory, employees
// — see routes/modules.js) — data read often across several pages
// (dropdown lists...) that changes relatively rarely. Zero effect on any
// other module that hasn't enabled it (just one `if (cache)` check, with
// no Redis call at all).
const { getCacheVersion, bumpCacheVersion, cacheGet, cacheSet } = require('../utils/redisService');

const DEFAULT_COLUMNS = [
  { field: 'name', column: 'name' },
  { field: 'phone', column: 'phone' },
  { field: 'status', column: 'status' },
];

// A special value understood by the extraFilterFields handling below as
// "the field is missing or empty", instead of a literal exact match —
// see the comment where it's used further down.
const UNSET_FILTER_VALUE = '__unset__';

// ── Module Registry ────────────────────────────────────────────────────
// Every call to pgCrud() registers itself here (apiName -> { tableName,
// indexedColumns, hospitalScoped }). The recycle bin (recycleBinRoutes.js)
// uses this registry to know how to reinsert a restored record into its
// correct original table, with no prior knowledge of each module's
// details individually — avoiding duplicating the same details in two places.
const moduleRegistry = {};

// The fifth parameter (sqlTableName) is optional: it sets the actual table
// name in the database if it differs from the API route name (apiName).
// Only needed for modules whose frontend name is camelCase (like
// "medicalLeaves") while the table name is snake_case per the standard
// PostgreSQL convention (medical_leaves) — the API route always stays
// what the frontend expects, while the internal queries use the correct
// table name.
//
// ── Fail-fast safety fix ──────────────────────────────────────────────────
// The fourth parameter (indexedColumns) no longer has any default value at
// all. It used to default to DEFAULT_COLUMNS (the name/phone/status
// columns) — so any new module registration that forgot to pass it
// explicitly implicitly assumed the table had these columns, and if it
// actually didn't (the vast majority of tables, built with pure JSONB
// storage), every POST/PUT operation would silently fail with a vague SQL
// message ("column X does not exist") that only showed up the moment a
// real user made their first actual save attempt — exactly what happened
// in 15 different modules before this fix. Now: forgetting to pass it
// stops the server from starting immediately with a clear message,
// instead of a vague SQL error later. Modules that actually have real
// name/phone/status columns (such as patients and doctors) pass
// DEFAULT_COLUMNS explicitly.
const pgCrud = (router, apiName, schema, indexedColumns, sqlTableName = apiName, options = {}) => {
  if (indexedColumns === undefined) {
    throw new Error(
      `❌ pgCrud('${apiName}'): the fourth parameter (indexedColumns) is explicitly required and has no default value.\n` +
      `   Pass [] if the table is pure JSONB storage (the most common case — see postgres_schema.sql), ` +
      `or an array of { field, column } if it has real indexed columns, ` +
      `or the DEFAULT_COLUMNS exported from this file if the table matches the standard name/phone/status columns.`
    );
  }
  const tableName = sqlTableName; // the actual table name used in every SQL query below
  const { hospitalScoped = false, permission = null, openRead = false, searchFields = [], extraFilterFields = [], dateRangeField = null, dateRangeColumn = null, cache = null } = options;
  moduleRegistry[apiName] = { ...moduleRegistry[apiName], tableName, indexedColumns, hospitalScoped, permission };
  // ── Permission checks (RBAC) on read and write ──────────────────────────────────
  // Writes (POST/PUT/DELETE): always restricted by the module's permission, if one is set.
  // Reads (GET): restricted by the same permission too, unless openRead=true
  // — an exception intentionally reserved only for reference data
  // (patients/doctors/departments/appointments) needed by many other pages
  // to display names in dropdown lists or alongside other records (for
  // example, the billing page shows the patient's name from the patients
  // module even though the accountant doesn't have the "patients"
  // permission itself). This was confirmed by actually reviewing every
  // frontend page before applying it — see the "why open read" note in the
  // conversation if you need to narrow this down later.
  const writePermission = requirePermission(permission);
  const readPermission = openRead ? (req, res, next) => next() : requirePermission(permission);

  // Converts a database row into the shape the frontend expects: one flat
  // object that merges the explicit columns (under the frontend's field
  // names) with the JSONB content.
  const rowToRecord = (row) => {
    const record = { ...row.data, id: row.id };
    indexedColumns.forEach(({ field, column }) => { record[field] = row[column]; });
    return record;
  };

  // Separates the indexed fields from the rest of the record's data (which is stored in the data column)
  const splitBody = (body) => {
    const indexedValues = indexedColumns.map(({ field }) => body[field] ?? null);
    const rest = { ...body };
    indexedColumns.forEach(({ field }) => delete rest[field]);
    return { indexedValues, rest };
  };

  // Checks whether a record (once read) belongs to the current user's
  // facility — used by the GET one / PUT / DELETE routes to prevent access
  // to another facility's records by guessing the id
  const belongsToUserHospital = (row, req) => {
    if (!hospitalScoped || !req.user?.hospitalId) return true; // no filtering
    return row.data?.hospitalId === req.user.hospitalId;
  };

  // ── Cache scope ──────────────────────────────────────────────────────
  // For a module distributed across facilities (hospitalScoped), the full
  // list actually differs depending on who's reading it: an employee at a
  // specific facility only sees their facility's records, while an admin
  // (with no hospitalId) sees every record with no filtering — each case
  // needs a separate cache key, or else a facility's employee would
  // mistakenly see the admin's cache (every facility) or the reverse.
  const cacheScopeFor = (hospitalId) => hospitalId || 'ALL';
  const cacheScopeForReq = (req) => cacheScopeFor(hospitalScoped ? req.user?.hospitalId : null);

  // Called after any successful write (POST/PUT/DELETE) — increases the
  // "generation number" for the affected record's scope (specifically its
  // facility) *and* the 'ALL' scope always (because the admin's
  // unfiltered cache includes records from every facility, so any edit at
  // any facility invalidates it too).
  // Fire-and-forget (no await from the caller) — must not slow down the
  // write response waiting on Redis, exactly like the existing
  // sendAlert/logAudit patterns in this project.
  const invalidateCache = async (recordHospitalId) => {
    if (!cache) return;
    const scopes = new Set([cacheScopeFor(hospitalScoped ? recordHospitalId : null), 'ALL']);
    await Promise.all([...scopes].map((s) => bumpCacheVersion(apiName, s)));
  };

  // GET all
  // Optional pagination support (page/limit) + search/filtering, to avoid
  // slowness on large tables in the future (especially patients and
  // doctors, the two modules most likely to grow to thousands of records).
  // Search and filtering work directly on the indexed columns
  // (indexedColumns) — much faster than scanning the full JSONB column,
  // but it means search only works if the requested field is actually
  // part of this specific module's indexedColumns.
  // Important security note: if the "page" request can't be read as a
  // valid integer, we ignore it and fall back to returning all records
  // instead of passing an untrusted value directly into the SQL statement
  // (LIMIT/OFFSET).
  // The default (with no page parameter): returns the full array as
  // always — zero risk to any existing page that doesn't send these parameters.
  router.get(`/${apiName}`, auth, readPermission, async (req, res, next) => {
    try {
      // ── Reading the cache (if enabled for this module) ──────────────────────────────
      // The cache key includes every query parameter (search/filter/page...)
      // — every different filter combination is stored under a separate
      // key. If Redis is unreachable, getCacheVersion returns null and we
      // skip the cache entirely for this request (fail-open).
      let cacheKey = null;
      if (cache) {
        const scope = cacheScopeForReq(req);
        const version = await getCacheVersion(apiName, scope);
        if (version !== null) {
          cacheKey = `c:${apiName}:${scope}:${version}:${JSON.stringify(req.query)}`;
          const cached = await cacheGet(cacheKey);
          if (cached) return res.json(cached);
        }
      }

      const conditions = [];
      const params = [];

      if (hospitalScoped && req.user?.hospitalId) {
        params.push(req.user.hospitalId);
        conditions.push(`data->>'hospitalId' = $${params.length}`);
      }

      // Optional text search (?search=) — matches the "name" and "phone"
      // columns if they're indexed in this module, plus any additional
      // JSONB fields explicitly listed in options.searchFields (such as
      // "specialization" for doctors — a non-indexed field, so searching
      // it is a bit slower than an indexed column, but it keeps the same
      // search experience that already existed on the frontend before the
      // move to server-side pagination).
      const nameCol = indexedColumns.find(c => c.field === 'name')?.column;
      const phoneCol = indexedColumns.find(c => c.field === 'phone')?.column;
      if (req.query.search && (nameCol || phoneCol || searchFields.length > 0)) {
        params.push(`%${req.query.search}%`);
        const idx = params.length;
        const parts = [nameCol, phoneCol].filter(Boolean).map(c => `${c} ILIKE $${idx}`);
        // ── Performance improvement ──────────────────────────────────────────────────
        // If a field has become a real indexed column (indexedColumns)
        // after being promoted from JSONB, we use the column directly
        // (fast, indexed) instead of data->>'field' (slow, a full table
        // scan). Fields that are still JSONB-only keep working the same
        // old way — zero breakage for any module not yet promoted.
        searchFields.forEach(f => {
          const promotedCol = indexedColumns.find(c => c.field === f)?.column;
          parts.push(promotedCol ? `${promotedCol} ILIKE $${idx}` : `data->>'${f}' ILIKE $${idx}`);
        });
        conditions.push(`(${parts.join(' OR ')})`);
      }

      // Optional status filter (?status=) — only if "status" is indexed in this module
      const statusCol = indexedColumns.find(c => c.field === 'status')?.column;
      if (req.query.status && req.query.status !== 'all' && statusCol) {
        params.push(req.query.status);
        conditions.push(`${statusCol} = $${params.length}`);
      }

      // Optional exact-match filtering on additional JSONB fields (such as
      // ?category=medicine for inventory) — only works for fields
      // explicitly declared in options.extraFilterFields (a whitelist,
      // protecting against arbitrary filtering on any field name sent in
      // the request). Same performance improvement as above: we use the
      // real column if the field has been promoted.
      //
      // The special value UNSET_FILTER_VALUE ('__unset__'): matches
      // incomplete records (the field is missing or empty) instead of a
      // literal exact match — used, for example, on the Assets page
      // (AssetsPage.js) to find imported records with an empty
      // status/category field, instead of them staying silently hidden
      // (they used to be shown with a default "active" badge even though
      // they didn't actually match the real "active" filter — a
      // display/filter mismatch). This value itself is never shown or
      // stored as a real field on any record — see
      // frontend/src/pages/AssetsPage.js.
      extraFilterFields.forEach((field) => {
        const value = req.query[field];
        if (value === UNSET_FILTER_VALUE) {
          const promotedCol = indexedColumns.find(c => c.field === field)?.column;
          const colExpr = promotedCol || `data->>'${field}'`;
          conditions.push(`(${colExpr} IS NULL OR ${colExpr} = '')`);
        } else if (value && value !== 'all') {
          params.push(value);
          const promotedCol = indexedColumns.find(c => c.field === field)?.column;
          conditions.push(promotedCol ? `${promotedCol} = $${params.length}` : `data->>'${field}' = $${params.length}`);
        }
      });

      // Optional date-range filter (?startDate=&endDate=, format YYYY-MM-DD) —
      // powers the shared DateRangeFilter UI component. Two alternative
      // options, only one used per module depending on the field's nature:
      //   - dateRangeField: a normal field (indexed column or JSONB) already
      //     part of the record's editable data (e.g. "date" on appointments).
      //   - dateRangeColumn: a raw SQL column name, for a column the database
      //     manages automatically and that is NOT part of the editable fields
      //     (e.g. created_at on patients). Deliberately kept separate from
      //     indexedColumns: adding created_at there would make every POST/PUT
      //     explicitly insert NULL instead of relying on DEFAULT now(), since
      //     the frontend never sends this field — silently wiping out the
      //     real registration date on every new patient and every edit.
      // Validating the date format (YYYY-MM-DD) before using it in the query
      // avoids an opaque SQL error (500) on a malformed value.
      const isValidDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
      if (dateRangeField || dateRangeColumn) {
        let dateExpr = null;
        if (dateRangeColumn) {
          dateExpr = `${dateRangeColumn}::date`;
        } else {
          const promotedCol = indexedColumns.find(c => c.field === dateRangeField)?.column;
          dateExpr = promotedCol ? `${promotedCol}::date` : `(data->>'${dateRangeField}')::date`;
        }
        if (isValidDateStr(req.query.startDate)) {
          params.push(req.query.startDate);
          conditions.push(`${dateExpr} >= $${params.length}::date`);
        }
        if (isValidDateStr(req.query.endDate)) {
          params.push(req.query.endDate);
          conditions.push(`${dateExpr} <= $${params.length}::date`);
        }
      }

      let sql = `SELECT * FROM ${tableName}`;
      if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
      sql += ' ORDER BY id ASC';

      const page = parseInt(req.query.page, 10);
      if (Number.isInteger(page) && page > 0) {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200); // a maximum of 200 per page
        const offset = (page - 1) * limit;

        const countSql = `SELECT COUNT(*) FROM ${tableName}` + (conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '');
        const countResult = await pool.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);

        params.push(limit, offset);
        sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
        const result = await pool.query(sql, params);
        const payload = {
          data: result.rows.map(rowToRecord),
          total,
          page,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        };
        if (cacheKey) cacheSet(cacheKey, payload, cache.ttlSeconds || 300).catch(() => {});
        return res.json(payload);
      }

      const result = await pool.query(sql, params);
      const payload = result.rows.map(rowToRecord);
      if (cacheKey) cacheSet(cacheKey, payload, cache.ttlSeconds || 300).catch(() => {});
      res.json(payload);
    } catch (err) { next(err); }
  });

  // ── Export to Excel ──────────────────────────────────────────────────────
  // Fix/new feature: the system used to only support importing from Excel
  // (uploading data into the system) with no way at all to export the
  // current data to an Excel file. This route is generic and works
  // automatically for every module registered through pgCrud (not only
  // modules with registerExcelImport enabled) — it fetches every record
  // (within the user's facility boundaries if the system is
  // multi-facility) and converts them into an .xlsx file for direct
  // download.
  // Headers: nice Arabic headers are used if this module also has
  // registerExcelImport registered (it automatically fills
  // moduleRegistry[apiName].exportHeaders from its own columnMap) —
  // otherwise the raw field names are used as headers.
  // Registered before GET /:id on purpose, otherwise Express would match
  // "export-excel" as the :id value.
  router.get(`/${apiName}/export-excel`, auth, readPermission, async (req, res, next) => {
    try {
      const conditions = [];
      const params = [];
      if (hospitalScoped && req.user?.hospitalId) {
        params.push(req.user.hospitalId);
        conditions.push(`data->>'hospitalId' = $${params.length}`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(`SELECT * FROM ${tableName} ${where} ORDER BY id`, params);
      const records = result.rows.map(rowToRecord);

      const exportHeaders = moduleRegistry[apiName]?.exportHeaders || {};
      // We collect every key that actually exists in any record (not just
      // the first record) — to avoid losing rare columns that only exist
      // on some records
      const allFields = new Set();
      records.forEach(r => Object.keys(r).forEach(k => allFields.add(k)));
      allFields.delete('id');
      const fields = ['id', ...[...allFields].sort()];
      const headerLabels = fields.map(f => f === 'id' ? 'ID' : (exportHeaders[f] || f));

      const rows = records.map(r => fields.map(f => {
        const v = r[f];
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return JSON.stringify(v); // an array/nested object — a JSON string instead of [object Object]
        return v;
      }));

      const ws = XLSX.utils.aoa_to_sheet([headerLabels, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, apiName.slice(0, 31)); // the sheet name is limited to 31 characters per the Excel spec
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      logAudit({ action: 'EXPORT', table: tableName, count: records.length, userId: req.user?.id, username: req.user?.username });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${apiName}-${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(buffer);
    } catch (err) { next(err); }
  });

  // GET one
  router.get(`/${apiName}/:id`, auth, readPermission, async (req, res, next) => {
    try {
      const result = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ message: 'غير موجود' });
      if (!belongsToUserHospital(result.rows[0], req)) return res.status(404).json({ message: 'غير موجود' });
      res.json(rowToRecord(result.rows[0]));
    } catch (err) { next(err); }
  });

  // POST
  router.post(`/${apiName}`, auth, writePermission, validate(schema), async (req, res, next) => {
    try {
      const { indexedValues, rest } = splitBody(req.body);
      // Automatically force the user's facility (ignoring any hospitalId
      // sent by the client) — protection against impersonating another
      // facility by manually tampering with the request
      if (hospitalScoped && req.user?.hospitalId) {
        rest.hospitalId = req.user.hospitalId;
      }
      let sql, values;
      if (indexedColumns.length === 0) {
        // No extra indexed columns — pure JSONB storage (just id + data)
        sql = `INSERT INTO ${tableName} (data) VALUES ($1) RETURNING *`;
        values = [JSON.stringify(rest)];
      } else {
        const columnsSql = indexedColumns.map(c => c.column).join(', ');
        const placeholders = indexedColumns.map((_, i) => `$${i + 1}`).join(', ');
        const dataPlaceholder = `$${indexedColumns.length + 1}`;
        sql = `INSERT INTO ${tableName} (${columnsSql}, data) VALUES (${placeholders}, ${dataPlaceholder}) RETURNING *`;
        values = [...indexedValues, JSON.stringify(rest)];
      }
      const result = await pool.query(sql, values);
      const record = rowToRecord(result.rows[0]);
      if (cache) invalidateCache(record.hospitalId).catch(() => {});
      logAudit({ action: 'CREATE', table: tableName, recordId: record.id, userId: req.user?.id, username: req.user?.username });
      res.status(201).json(record);
    } catch (err) { next(err); }
  });

  // PUT
  router.put(`/${apiName}/:id`, auth, writePermission, validate(schema), async (req, res, next) => {
    try {
      const existing = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ message: 'غير موجود' });
      if (!belongsToUserHospital(existing.rows[0], req)) return res.status(404).json({ message: 'غير موجود' });

      const { indexedValues, rest } = splitBody(req.body);
      if (hospitalScoped && req.user?.hospitalId) {
        rest.hospitalId = req.user.hospitalId; // prevents moving a record to another facility via an edit
      }
      const setSql = indexedColumns.map((c, i) => `${c.column} = $${i + 1}`).join(', ');
      const dataPlaceholder = `$${indexedColumns.length + 1}`;
      const idPlaceholder = `$${indexedColumns.length + 2}`;
      const setClause = setSql ? `${setSql}, data = ${dataPlaceholder}` : `data = ${dataPlaceholder}`;
      const result = await pool.query(
        `UPDATE ${tableName} SET ${setClause}, updated_at = now() WHERE id = ${idPlaceholder} RETURNING *`,
        [...indexedValues, JSON.stringify(rest), req.params.id]
      );
      const record = rowToRecord(result.rows[0]);
      if (cache) {
        // Invalidate the cache for both the old *and* the new facility —
        // usually the same thing, but at negligible cost it protects
        // against the rare case (an admin edit changes the record's hospitalId)
        invalidateCache(existing.rows[0].data?.hospitalId).catch(() => {});
        invalidateCache(record.hospitalId).catch(() => {});
      }
      logAudit({ action: 'UPDATE', table: tableName, recordId: record.id, userId: req.user?.id, username: req.user?.username });
      res.json(record);
    } catch (err) { next(err); }
  });

  // DELETE — fix: this used to delete permanently and immediately with no
  // way to undo. Now "deleting" moves the full record to the recycle bin
  // (recycle_bin) before removing it from its original table — it
  // disappears from lists immediately (the exact same visible behavior
  // from the user's point of view), but it stays recoverable or
  // permanently deletable from the settings page (admin only).
  router.delete(`/${apiName}/:id`, auth, writePermission, async (req, res, next) => {
    const client = await pool.connect();
    try {
      const existing = await client.query(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ message: 'غير موجود' });
      const row = existing.rows[0];
      if (!belongsToUserHospital(row, req)) return res.status(404).json({ message: 'غير موجود' });

      const fullRecord = rowToRecord(row);
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO recycle_bin (module_key, original_id, data, hospital_id, deleted_by, deleted_by_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [apiName, row.id, JSON.stringify(fullRecord), row.data?.hospitalId || null, req.user?.id || null, req.user?.name || null]
      );
      await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [req.params.id]);
      await client.query('COMMIT');

      if (cache) invalidateCache(row.data?.hospitalId).catch(() => {});
      logAudit({ action: 'DELETE', table: tableName, recordId: req.params.id, note: 'نُقل لسلة المحذوفات', userId: req.user?.id, username: req.user?.username });
      res.json({ success: true });
    } catch (err) {
      // Critical fix: ROLLBACK used to have no protection — if it itself
      // failed (for example because the connection was already broken by
      // the first error), it became an unhandled exception inside an async
      // route handler that Express doesn't catch, and on modern Node.js
      // this **crashes the entire process** (takes down the whole server!)
      // — a direct explanation for why "could not connect to the server"
      // used to appear even on unrelated subsequent requests, and stayed
      // that way until a manual restart. Now any failure in ROLLBACK is
      // only logged and never crashes the server.
      try { await client.query('ROLLBACK'); } catch (rollbackErr) {
        console.error(`ROLLBACK failed after a delete error [${tableName}]:`, rollbackErr.message);
      }
      next(err);
    } finally {
      client.release();
    }
  });
};

module.exports = pgCrud;
module.exports.DEFAULT_COLUMNS = DEFAULT_COLUMNS;
module.exports.moduleRegistry = moduleRegistry;

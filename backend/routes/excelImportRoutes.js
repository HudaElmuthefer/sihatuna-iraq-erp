// backend/routes/excelImportRoutes.js
//
// مصنع مسار استيراد جماعي من ملف Excel، بنفس فكرة pgCrud.js (مصنع قابل لإعادة
// الاستخدام لأكثر من موديول) — يضيف مسار POST /api/<apiName>/import-excel.
//
// نتيجة الاستيراد ليست "الكل أو لا شيء": كل صف يُعالَج ويُحفَظ بشكل مستقل عن
// باقي الصفوف عمداً (بدون معاملة/transaction واحدة تلف الجميع) — لأن الهدف
// هو "استوردي كل الصفوف الصحيحة، وأخبريني بالضبط عن الصفوف الخاطئة وسببها"،
// مو رفض الملف كاملاً بسبب خطأ بصف واحد وسط مئات الصفوف السليمة.
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const { pool } = require('../config/database');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const { validateFields } = require('../middleware/validate');
const { parseExcelBuffer } = require('../utils/excelImport');

// تخزين بالذاكرة فقط (memoryStorage) — الملف يُقرأ ويُحلَّل مباشرة ولا يُكتب
// على القرص إطلاقاً، فلا حاجة لأي تنظيف لاحق ولا خطر تراكم ملفات مؤقتة.
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 ميجا كافية جداً حتى لآلاف الصفوف كنص خام
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

// apiName: اسم المسار (يظهر بالرابط: /api/<apiName>/import-excel)
// tableName: اسم الجدول الفعلي بقاعدة البيانات إن اختلف عن apiName (مثل
//            ambulanceVehicles -> ambulance_vehicles)، بنفس فكرة sqlTableName
//            بملف pgCrud.js — لازم يطابق تماماً الاسم المستخدم هناك لنفس
//            الموديول، وإلا يفشل الإدراج بخطأ "الجدول غير موجود"
// schema: نفس مخطط التحقق المستخدم بـ middleware/schemas.js لهذا الموديول
// columnMap: قاموس "عنوان العمود بملف Excel" -> "اسم الحقل الداخلي"
// options.indexedColumns: لازم يطابق تماماً نفس المصفوفة المُمرَّرة لـ pgCrud()
//            لنفس الموديول بـ server.js (حتى لو فاضية []) — وإلا يفشل الإدراج
const registerExcelImport = (router, apiName, schema, columnMap, options = {}) => {
  const {
    indexedColumns = [
      { field: 'name', column: 'name' },
      { field: 'phone', column: 'phone' },
      { field: 'status', column: 'status' },
    ],
    hospitalScoped = false,
    permission = null,
    tableName = apiName,
  } = options;

  // ── تحميل قالب فارغ ──────────────────────────────────────────────────────
  // يبني ملف Excel بصف عناوين + صف مثال واحد، بنفس الأعمدة المتوقعة بالضبط —
  // يريح المستخدم من تخمين أسماء الأعمدة الصحيحة أو ترتيبها.
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

  router.post(`/${apiName}/import-excel`, auth, requirePermission(permission), importUpload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'لم يُرفَع أي ملف' });

      const { rows, error } = parseExcelBuffer(req.file.buffer, columnMap);
      if (error) return res.status(400).json({ message: error });

      const results = { imported: 0, failed: 0, errors: [] };

      for (const { rowNumber, data } of rows) {
        // صف فاضي بالكامل (مثلاً صف أخير زايد بالملف بالخطأ) — تجاهله بصمت
        if (Object.values(data).every(v => v === '' || v === undefined)) continue;

        const rowErrors = validateFields(schema, data);
        if (rowErrors.length > 0) {
          results.failed++;
          results.errors.push({ row: rowNumber, messages: rowErrors });
          continue;
        }

        // فرض منشأة المستخدم تلقائياً — نفس منطق pgCrud.js بالضبط
        if (hospitalScoped && req.user?.hospitalId) {
          data.hospitalId = req.user.hospitalId;
        }
        if (!data.status) data.status = 'active'; // قيمة افتراضية معقولة لو العمود غير موجود بالملف

        const indexedValues = indexedColumns.map(({ field }) => data[field] ?? null);
        const rest = { ...data };
        indexedColumns.forEach(({ field }) => delete rest[field]);

        // نفس فرع الحالتين المستخدم بـ pgCrud.js بالضبط: تخزين JSONB بحت لو
        // ما فيه أعمدة فهرسة إضافية (مثل ambulanceVehicles)، أو أعمدة + JSONB
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

      console.log(`📥 [${apiName}] استيراد Excel: ${results.imported} نجح، ${results.failed} فشل — بواسطة user #${req.user?.id}`);
      res.json(results);
    } catch (err) { next(err); }
  });
};

module.exports = registerExcelImport;

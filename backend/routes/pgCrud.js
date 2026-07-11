// backend/routes/pgCrud.js
//
// مصنع مسارات CRUD موحّد يعمل على PostgreSQL، بنفس فكرة crud() الأصلية
// (المستخدمة لملف db.json) لكن بتخزين فعلي بقاعدة بيانات علائقية.
//
// استراتيجية التخزين: عمود "data" من نوع JSONB يحمل كامل بيانات السجل كما
// ترسلها الواجهة تماماً، بينما أعمدة صريحة محدَّدة (indexedColumns) للفهرسة
// والبحث السريع فقط. هذا يتجنّب مشكلة واجهناها سابقاً: أي افتراض خاطئ بأسماء
// الأعمدة (مثل ما حصل مع مخطط تحقق المواعيد) يرفض عمليات الحفظ بصمت. بهذا
// النمط، أي حقل جديد تضيفه الواجهة مستقبلاً يُخزَّن ويُسترجَع تلقائياً دون أي
// حاجة لتعديل بنية الجدول.
//
// المعامل الرابع (indexedColumns) مصفوفة عناصر بالشكل { field, column }:
//   field  = اسم الحقل كما ترسله الواجهة بالضبط (مثل "patientId")
//   column = اسم العمود الفعلي بقاعدة البيانات (مثل "patient_id")
// هذا يسمح باختلاف التسمية بين الواجهة (camelCase عادة) وقاعدة البيانات
// (snake_case حسب الاتفاقية المتّبعة ببقية الجداول)، بدل افتراض تطابق الاسمين.
//
// المعامل السادس (options.hospitalScoped) — دعم المنشآت المتعددة (مرحلة 4):
// لو true، يُطبَّق فرض تلقائي لمنشأة المستخدم على كل عملية:
//   - GET all: يُفلتر النتائج لمنشأة المستخدم فقط (data->>'hospitalId')
//   - GET one / PUT / DELETE: يرفض الوصول (404) لسجل يخص منشأة أخرى
//   - POST: يفرض hospitalId المستخدم على السجل الجديد، متجاهلاً أي قيمة
//     أرسلها العميل (حماية من انتحال منشأة أخرى عبر تعديل الطلب يدوياً)
// الفلترة تُطبَّق فقط لو المستخدم نفسه له hospitalId مُعيَّن (بحساباته —
// انظر عمود hospitalId بملف db.json لجدول users). المستخدم بلا hospitalId
// (مثل حساب إدمن على مستوى الوزارة) يشوف كل شيء بلا فلترة — هذا سلوك مقصود.
//
// تحقق دائماً من الحقول الفعلية بصفحة الفرونت إند قبل التحديد — هذا بالضبط
// الدرس المستفاد من خطأ سابق بمخطط تحقق المواعيد.
//
// العقد (Contract) الخارجي مطابق تماماً لمسارات db.json الأصلية:
//   GET    /api/<table>        -> قائمة كاملة (أو مفلترة حسب المنشأة)
//   GET    /api/<table>/:id    -> سجل واحد
//   POST   /api/<table>        -> إنشاء (يُعيد السجل الكامل مع id)
//   PUT    /api/<table>/:id    -> تعديل
//   DELETE /api/<table>/:id    -> حذف
// بهذا لا يحتاج الفرونت إند أي تعديل عند التحويل من db.json إلى PostgreSQL.
const { pool } = require('../config/database');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const requirePermission = require('../middleware/requirePermission');

const DEFAULT_COLUMNS = [
  { field: 'name', column: 'name' },
  { field: 'phone', column: 'phone' },
  { field: 'status', column: 'status' },
];

// المعامل الخامس (sqlTableName) اختياري: يحدد اسم الجدول الفعلي بقاعدة البيانات
// إذا كان مختلفاً عن اسم المسار بالـ API (apiName). مطلوب فقط للموديولات التي
// اسمها camelCase بالواجهة (مثل "medicalLeaves") بينما اسم الجدول snake_case
// حسب اتفاقية PostgreSQL القياسية (medical_leaves) — مسار الـ API يبقى دائماً
// كما يتوقعه الفرونت إند، بينما الاستعلامات الداخلية تستخدم اسم الجدول الصحيح.
const pgCrud = (router, apiName, schema, indexedColumns = DEFAULT_COLUMNS, sqlTableName = apiName, options = {}) => {
  const tableName = sqlTableName; // اسم الجدول الفعلي بكل استعلامات SQL أدناه
  const { hospitalScoped = false, permission = null, openRead = false } = options;
  // ── فحص صلاحيات (RBAC) على القراءة والكتابة ──────────────────────────────────
  // الكتابة (POST/PUT/DELETE): مقيّدة دائماً بصلاحية الموديول لو كانت محدَّدة.
  // القراءة (GET): مقيّدة بنفس الصلاحية أيضاً، إلا لو openRead=true — استثناء
  // مقصود فقط لبيانات مرجعية (مرضى/أطباء/أقسام/مواعيد) تحتاجها صفحات أخرى
  // كثيرة لعرض أسماء بقوائم منسدلة أو بجانب سجلات ثانية (مثلاً صفحة الفوترة
  // تعرض اسم المريض من موديول patients رغم إن المحاسب ما عنده صلاحية "patients"
  // نفسها). تأكدت من هذا بمراجعة كل صفحات الفرونت إند فعلياً قبل التطبيق —
  // راجعي ملاحظة "لماذا القراءة المفتوحة" بالمحادثة لو احتجتِ تضيّقين هذا لاحقاً.
  const writePermission = requirePermission(permission);
  const readPermission = openRead ? (req, res, next) => next() : requirePermission(permission);

  // يحوّل صف قاعدة البيانات (row) إلى الشكل الذي تتوقعه الواجهة: كائن واحد
  // مسطّح يدمج الأعمدة الصريحة (بأسماء حقول الواجهة) مع محتوى JSONB.
  const rowToRecord = (row) => {
    const record = { ...row.data, id: row.id };
    indexedColumns.forEach(({ field, column }) => { record[field] = row[column]; });
    return record;
  };

  // يفصل الحقول المفهرسة عن بقية بيانات السجل (اللي تُخزَّن بعمود data)
  const splitBody = (body) => {
    const indexedValues = indexedColumns.map(({ field }) => body[field] ?? null);
    const rest = { ...body };
    indexedColumns.forEach(({ field }) => delete rest[field]);
    return { indexedValues, rest };
  };

  // يتحقق هل السجل (بعد قراءته) يخص منشأة المستخدم الحالي — يُستخدم بمسارات
  // GET one / PUT / DELETE لمنع الوصول لسجلات منشأة أخرى عبر تخمين المعرّف
  const belongsToUserHospital = (row, req) => {
    if (!hospitalScoped || !req.user?.hospitalId) return true; // بلا فلترة
    return row.data?.hospitalId === req.user.hospitalId;
  };

  // GET all
  // دعم تصفح اختياري بالصفحات (page/limit)، لتفادي بطء الجداول الكبيرة مستقبلاً.
  // ملاحظة أمان مهمة: لو طلب "page" غير مقروء كرقم صحيح، نتجاهله ونرجع لكل
  // السجلات بدل تمرير قيمة غير موثوقة مباشرة لجملة SQL (LIMIT/OFFSET).
  // الافتراضي (بدون معامل page): يرجع مصفوفة كاملة كما كان دائماً — صفر خطر
  // على أي صفحة موجودة حالياً لا ترسل هذي المعاملات.
  router.get(`/${apiName}`, auth, readPermission, async (req, res, next) => {
    try {
      let sql = `SELECT * FROM ${tableName}`;
      const params = [];
      if (hospitalScoped && req.user?.hospitalId) {
        params.push(req.user.hospitalId);
        sql += ` WHERE data->>'hospitalId' = $${params.length}`;
      }
      sql += ' ORDER BY id ASC';

      const page = parseInt(req.query.page, 10);
      if (Number.isInteger(page) && page > 0) {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200); // حد أقصى 200 بالصفحة الواحدة
        const offset = (page - 1) * limit;

        const countSql = `SELECT COUNT(*) FROM ${tableName}` + (hospitalScoped && req.user?.hospitalId ? ` WHERE data->>'hospitalId' = $1` : '');
        const countResult = await pool.query(countSql, params);
        const total = parseInt(countResult.rows[0].count, 10);

        params.push(limit, offset);
        sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
        const result = await pool.query(sql, params);
        return res.json({
          data: result.rows.map(rowToRecord),
          total,
          page,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        });
      }

      const result = await pool.query(sql, params);
      res.json(result.rows.map(rowToRecord));
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
      // فرض منشأة المستخدم تلقائياً (يتجاهل أي hospitalId أرسله العميل) —
      // حماية من انتحال منشأة أخرى عبر تعديل الطلب يدوياً
      if (hospitalScoped && req.user?.hospitalId) {
        rest.hospitalId = req.user.hospitalId;
      }
      let sql, values;
      if (indexedColumns.length === 0) {
        // لا توجد أعمدة فهرسة إضافية — تخزين JSONB بحت (id + data فقط)
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
      console.log(`✅ [${tableName}] CREATE  id=${record.id}  by user #${req.user?.id}`);
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
        rest.hospitalId = req.user.hospitalId; // يمنع تغيير منشأة السجل لمنشأة أخرى بالتعديل
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
      console.log(`✏️  [${tableName}] UPDATE  id=${record.id}  by user #${req.user?.id}`);
      res.json(record);
    } catch (err) { next(err); }
  });

  // DELETE
  router.delete(`/${apiName}/:id`, auth, writePermission, async (req, res, next) => {
    try {
      const existing = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ message: 'غير موجود' });
      if (!belongsToUserHospital(existing.rows[0], req)) return res.status(404).json({ message: 'غير موجود' });

      await pool.query(`DELETE FROM ${tableName} WHERE id = $1`, [req.params.id]);
      console.log(`🗑️  [${tableName}] DELETE  id=${req.params.id}  by user #${req.user?.id}`);
      res.json({ success: true });
    } catch (err) { next(err); }
  });
};

module.exports = pgCrud;

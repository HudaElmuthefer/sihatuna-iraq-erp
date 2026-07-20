// backend/routes/modules.js
//
// تسجيل كل موديولات pgCrud (CRUD قياسي مبني على PostgreSQL) واستيراد Excel
// الجماعي لكل موديول يدعمه — 41 موديول بمكان واحد. استُخرج هذا القسم من
// server.js (كان أكبر قسم فيه بمفرده، ~330 سطر) لتصغير الملف الرئيسي وتسهيل
// إيجاد/تعديل تسجيل أي موديول محدد دون التمرير بملف ضخم يخلط كل شيء مع بعض.
//
// دالة واحدة registerAllModules(router) تستقبل الروتر الرئيسي من server.js
// وتسجّل عليه كل المسارات — بنفس ترتيب التسجيل الأصلي بالضبط (مهم جداً: كل
// استيراد Excel مسجَّل *قبل* pgCrud لنفس الموديول، لتفادي تعارض مسار GET
// /module/:id مع GET /module/import-template — انظر شرح المشكلة والحل
// بملف routes/excelImportRoutes.js لو احتجتِ التفاصيل الكاملة).
const collectionSchemas = require('../middleware/schemas');
const pgCrud = require('./pgCrud');
const { DEFAULT_COLUMNS } = pgCrud;
// ── أعمدة مُرقّاة من JSONB لأعمدة حقيقية (دفعة أولى) ─────────────────────────
// راجعي migration_promote_columns.sql — لازم يُطبَّق على قاعدة البيانات أولاً
// قبل ما يشتغل هذا الكود صح (وإلا الأعمدة الجديدة غير موجودة أصلاً بالجدول).
const PATIENT_COLUMNS = [...DEFAULT_COLUMNS, { field: 'patientId', column: 'patient_code' }, { field: 'bloodType', column: 'blood_type' }, { field: 'nationalId', column: 'national_id' }];
const DOCTOR_COLUMNS = [...DEFAULT_COLUMNS, { field: 'specialization', column: 'specialization' }];
const registerExcelImport = require('./excelImportRoutes');
const { importLimiter } = require('../config/rateLimiters');

const registerAllModules = (router) => {
  // ── STANDARD CRUD COLLECTIONS (db.json) ───────────────────────────────────────
  // لم يبقَ أي موديول قياسي على db.json — كل الموديولات انتقلت إلى PostgreSQL
  // (انظر قسم "PostgreSQL-BACKED COLLECTIONS" أسفل الملف). عنوان الـ API نفسه
  // بقي كما هو تماماً لكل موديول، فلا يحتاج الفرونت إند أي تعديل.

  // ── PostgreSQL-BACKED COLLECTIONS ─────────────────────────────────────────────
  // المرضى والأطباء أول موديولين يُنقلان إلى PostgreSQL فعلياً (باقي الموديولات
  // أعلاه لا تزال تعمل على db.json). نفس المخططات (schemas) المستخدمة سابقاً
  // للتحقق تُعاد استخدامها هنا بدون أي تغيير.
  // ── خيار permission ────────────────────────────────────────────────────────────
  // نفس مفاتيح الصفحات (page keys) المعرَّفة بـ ALL_PAGES بملف
  // frontend/src/contexts/AppContext.js — يفرض على مستوى الخادم نفس الصلاحية
  // المستخدمة حالياً بالفرونت إند لإخفاء/إظهار عناصر القائمة الجانبية فقط.
  // حساب admin يتجاوز هذا الفحص دائماً (انظر requirePermission.js).
  // ── استيراد جماعي من Excel ────────────────────────────────────────────────────
  // يضيف POST /api/patients/import-excel و POST /api/doctors/import-excel
  // (و GET .../import-template لتحميل قالب فارغ). يُسجَّل عمداً *قبل* pgCrud
  // لنفس الموديول أدناه — Express يطابق المسارات بترتيب التسجيل، ولو سُجِّل
  // بعد pgCrud (اللي يضيف GET /patients/:id)، كان طلب GET /patients/import-template
  // يتطابق خطأً مع نمط /:id (ويعامل "import-template" كأنه معرّف سجل رقمي)،
  // بدل مساره الصريح الأدق. هذا خطأ حقيقي وقعنا فيه واكتُشف بالاختبار الفعلي.
  registerExcelImport(router, 'patients', collectionSchemas.patients, {
    'الاسم': 'name', 'اسم المريض': 'name', 'Name': 'name',
    'الاسم بالإنجليزي': 'nameEn', 'NameEn': 'nameEn', 'Name (English)': 'nameEn',
    'العمر': 'age', 'Age': 'age',
    'الجنس': 'gender', 'Gender': 'gender',
    'الهاتف': 'phone', 'رقم الهاتف': 'phone', 'Phone': 'phone',
    'فصيلة الدم': 'bloodType', 'Blood Type': 'bloodType',
    'الحالة': 'status', 'Status': 'status',
    'التأمين': 'insurance', 'Insurance': 'insurance',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'patients',
    indexedColumns: PATIENT_COLUMNS,
    limiter: importLimiter,
    duplicateCheck: ['name', 'phone'],
    template: [
      { header: 'الاسم', example: 'أحمد كاظم الجبوري' },
      { header: 'الهاتف', example: '07701234567' },
      { header: 'العمر', example: '45' },
      { header: 'الجنس', example: 'ذكر' },
      { header: 'فصيلة الدم', example: 'A+' },
      { header: 'الحالة', example: 'نشط' },
      { header: 'التأمين', example: '' },
      { header: 'ملاحظات', example: '' },
    ],
  });

  registerExcelImport(router, 'doctors', collectionSchemas.doctors, {
    'الاسم': 'name', 'اسم الطبيب': 'name', 'اسم الدكتور': 'name', 'Name': 'name', 'Doctor Name': 'name',
    'الاسم بالإنجليزي': 'nameEn', 'NameEn': 'nameEn', 'Name (English)': 'nameEn',
    'التخصص': 'specialization', 'الاختصاص': 'specialization', 'الأختصاص': 'specialization', 'Specialization': 'specialization', 'Specialty': 'specialization',
    'الهاتف': 'phone', 'رقم الهاتف': 'phone', 'رقم الهاتف الأول': 'phone', 'رقم الجوال': 'phone', 'Phone': 'phone',
    'رقم الهاتف الثاني': 'phone2', 'هاتف إضافي': 'phone2', 'Phone 2': 'phone2',
    'العنوان': 'address', 'عنوان العيادة': 'address', 'Address': 'address',
    'سنوات الخبرة': 'experience', 'الخبرة': 'experience', 'Experience': 'experience',
    'الجنس': 'gender', 'Gender': 'gender',
    'الحالة': 'status', 'Status': 'status',
    'الملاحظات': 'notes', 'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'doctors',
    indexedColumns: DEFAULT_COLUMNS,
    limiter: importLimiter,
    duplicateCheck: ['name', 'phone'],
    template: [
      { header: 'الاسم', example: 'د. أحمد سالم الراشدي' },
      { header: 'الهاتف', example: '07701234567' },
      { header: 'التخصص', example: 'باطنية وصدرية' },
      { header: 'العنوان', example: 'البصرة - العشار' },
      { header: 'سنوات الخبرة', example: '10' },
      { header: 'الجنس', example: 'ذكر' },
      { header: 'الحالة', example: 'نشط' },
      { header: 'الملاحظات', example: '' },
    ],
  });

  // ── دفعة استيراد إضافية: الأقسام، الموظفين، المتقاعدين، المخزون، الأصول،
  //    المشاريع، مركبات الإسعاف ─────────────────────────────────────────────────
  registerExcelImport(router, 'departments', collectionSchemas.departments, {
    'الاسم': 'name', 'اسم القسم': 'name', 'Name': 'name',
    'الوصف': 'description', 'Description': 'description',
    'رئيس القسم': 'head', 'Head': 'head',
    'الحالة': 'status', 'Status': 'status',
  }, {
    hospitalScoped: true, permission: 'departments',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['name'],
    template: [
      { header: 'الاسم', example: 'قسم الباطنية' },
      { header: 'الوصف', example: 'قسم الأمراض الباطنية' },
      { header: 'رئيس القسم', example: 'د. أحمد سالم' },
      { header: 'الحالة', example: 'نشط' },
    ],
  });

  registerExcelImport(router, 'employees', collectionSchemas.employees, {
    'الاسم': 'name', 'اسم الموظف': 'name', 'Name': 'name',
    'المسمى الوظيفي': 'jobTitle', 'Job Title': 'jobTitle',
    'القسم': 'dept', 'Department': 'dept',
    'الدرجة': 'grade', 'Grade': 'grade',
    'المرحلة': 'step', 'Step': 'step',
    'الراتب': 'salary', 'Salary': 'salary',
    'تاريخ التعيين': 'hireDate', 'Hire Date': 'hireDate',
    'تاريخ الميلاد': 'birthDate', 'Birth Date': 'birthDate',
    'الهاتف': 'phone', 'Phone': 'phone',
    'الحالة': 'status', 'Status': 'status',
  }, {
    hospitalScoped: true, permission: 'hr',
    limiter: importLimiter,
    duplicateCheck: ['name', 'jobTitle'],
    indexedColumns: [
      { field: 'name', column: 'name' },
      { field: 'jobTitle', column: 'job_title' },
      { field: 'status', column: 'status' },
    ],
    template: [
      { header: 'الاسم', example: 'رنا محمد النجار' },
      { header: 'المسمى الوظيفي', example: 'سكرتيرة' },
      { header: 'القسم', example: 'الإدارة' },
      { header: 'الراتب', example: '480000' },
      { header: 'تاريخ التعيين', example: '2024-01-15' },
      { header: 'الهاتف', example: '07701234567' },
      { header: 'الحالة', example: 'نشط' },
    ],
  });

  registerExcelImport(router, 'retired', collectionSchemas.retired, {
    'الاسم': 'name', 'Name': 'name',
    'المسمى الوظيفي': 'jobTitle', 'Job Title': 'jobTitle',
    'القسم': 'dept', 'Department': 'dept',
    'تاريخ التقاعد': 'retireDate', 'Retire Date': 'retireDate',
    'راتب التقاعد': 'retireSalary', 'Retire Salary': 'retireSalary',
    'رقم التقاعد': 'pensionNo', 'Pension No': 'pensionNo',
    'الهاتف': 'phone', 'Phone': 'phone',
  }, {
    hospitalScoped: true, permission: 'hr',
    limiter: importLimiter,
    duplicateCheck: ['name', 'jobTitle'],
    indexedColumns: [
      { field: 'name', column: 'name' },
      { field: 'jobTitle', column: 'job_title' },
    ],
    template: [
      { header: 'الاسم', example: 'باسم علي الكربلائي' },
      { header: 'المسمى الوظيفي', example: 'فني مختبر' },
      { header: 'القسم', example: 'التحاليل' },
      { header: 'تاريخ التقاعد', example: '2026-01-01' },
      { header: 'راتب التقاعد', example: '500000' },
      { header: 'رقم التقاعد', example: 'P-1234' },
      { header: 'الهاتف', example: '07701234567' },
    ],
  });

  registerExcelImport(router, 'inventory', collectionSchemas.inventory, {
    'الرمز': 'code', 'Code': 'code',
    'الاسم': 'name', 'Name': 'name',
    'الاسم بالإنجليزي': 'nameEn', 'NameEn': 'nameEn',
    'التصنيف': 'category', 'Category': 'category',
    'الوحدة': 'unit', 'Unit': 'unit',
    'الكمية': 'qty', 'Quantity': 'qty',
    'الحد الأدنى': 'minQty', 'Min Quantity': 'minQty',
    'الحد الأعلى': 'maxQty', 'Max Quantity': 'maxQty',
    'تكلفة الوحدة': 'unitCost', 'Unit Cost': 'unitCost',
    'المورّد': 'supplier', 'Supplier': 'supplier',
    'الموقع': 'location', 'Location': 'location',
    'تاريخ الانتهاء': 'expiry', 'Expiry': 'expiry',
    'الحالة': 'status', 'Status': 'status',
  }, {
    hospitalScoped: true, permission: 'inventory',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['code'],
    template: [
      { header: 'الرمز', example: 'MED-001' },
      { header: 'الاسم', example: 'باراسيتامول 500mg' },
      { header: 'التصنيف', example: 'medicine' },
      { header: 'الوحدة', example: 'Box' },
      { header: 'الكمية', example: '100' },
      { header: 'الحد الأدنى', example: '20' },
      { header: 'تكلفة الوحدة', example: '1500' },
      { header: 'المورّد', example: 'شركة الرافدين للأدوية' },
      { header: 'الحالة', example: 'نشط' },
    ],
  });

  registerExcelImport(router, 'assets', collectionSchemas.assets, {
    'رقم الأصل': 'assetNo', 'Asset No': 'assetNo',
    'الاسم': 'name', 'Name': 'name',
    'الاسم بالإنجليزي': 'nameEn', 'NameEn': 'nameEn',
    'التصنيف': 'category', 'Category': 'category',
    'الماركة': 'brand', 'Brand': 'brand',
    'الموديل': 'model', 'Model': 'model',
    'الرقم التسلسلي': 'serial', 'Serial': 'serial',
    'تاريخ الشراء': 'purchaseDate', 'Purchase Date': 'purchaseDate',
    'تكلفة الشراء': 'purchaseCost', 'Purchase Cost': 'purchaseCost',
    'الموقع': 'location', 'Location': 'location',
    'الحالة': 'status', 'Status': 'status',
    'المسؤول': 'responsiblePerson', 'Responsible Person': 'responsiblePerson',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'assets',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['assetNo'],
    template: [
      { header: 'رقم الأصل', example: 'AST-2026-001' },
      { header: 'الاسم', example: 'جهاز أشعة سينية' },
      { header: 'التصنيف', example: 'medical' },
      { header: 'الماركة', example: 'Siemens' },
      { header: 'تاريخ الشراء', example: '2024-05-01' },
      { header: 'تكلفة الشراء', example: '15000000' },
      { header: 'الموقع', example: 'قسم الأشعة' },
      { header: 'الحالة', example: 'نشط' },
    ],
  });

  registerExcelImport(router, 'projects', collectionSchemas.projects, {
    'الرمز': 'code', 'Code': 'code',
    'الاسم': 'name', 'Name': 'name',
    'الاسم بالإنجليزي': 'nameEn', 'NameEn': 'nameEn',
    'المدير': 'manager', 'Manager': 'manager',
    'الميزانية': 'budget', 'Budget': 'budget',
    'تاريخ البدء': 'startDate', 'Start Date': 'startDate',
    'تاريخ الانتهاء': 'endDate', 'End Date': 'endDate',
    'الحالة': 'status', 'Status': 'status',
    'الأولوية': 'priority', 'Priority': 'priority',
    // ── إصلاح: هذي الأعمدة كانت ناقصة تماماً — أي مشروع مستورَد كانت هذي
    // الحقول تطلع له undefined بالواجهة (يظهر "NaN%" بشريط التقدم، و
    // "undefined/undefined" بعدد المراحل). الآن اختيارية بالاستيراد، وتُملأ
    // بصفر تلقائياً لو تُركت فاضية (راجعي afterParse بالأسفل).
    'المصروف': 'spent', 'Spent': 'spent',
    'نسبة الإنجاز': 'progress', 'Progress': 'progress',
    'عدد المراحل': 'milestones', 'Milestones': 'milestones',
    'المراحل المنجزة': 'completedMilestones', 'Completed Milestones': 'completedMilestones',
  }, {
    hospitalScoped: true, permission: 'projects',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['code'],
    // ── إصلاح: تعبئة افتراضية للحقول الرقمية غير المتوفرة بملف Excel —
    // بدل ما تبقى undefined وتكسر عرض شريط التقدم ودوائر المراحل بالواجهة
    afterParse: (row) => ({
      ...row,
      spent: row.spent || 0,
      progress: row.progress || 0,
      milestones: row.milestones || 0,
      completedMilestones: row.completedMilestones || 0,
    }),
    template: [
      { header: 'الرمز', example: 'PRJ-2026-01' },
      { header: 'الاسم', example: 'تحديث نظام الأشعة' },
      { header: 'المدير', example: 'م. نور المشاريع' },
      { header: 'الميزانية', example: '50000000' },
      { header: 'تاريخ البدء', example: '2026-01-01' },
      { header: 'الحالة', example: 'planning' },
    ],
  });

  registerExcelImport(router, 'ambulanceVehicles', collectionSchemas.ambulanceVehicles, {
    'الرمز': 'code', 'Code': 'code',
    'رقم اللوحة': 'plate', 'Plate': 'plate',
    'النوع': 'type', 'Type': 'type',
    'الموديل': 'model', 'Model': 'model',
    'الطاقم': 'crew', 'Crew': 'crew',
    'الحالة': 'status', 'Status': 'status',
    'الموقع': 'location', 'Location': 'location',
  }, {
    hospitalScoped: true, permission: 'ambulance',
    limiter: importLimiter,
    duplicateCheck: ['plate'],
    tableName: 'ambulance_vehicles',
    indexedColumns: [],
    template: [
      { header: 'الرمز', example: 'AMB-01' },
      { header: 'رقم اللوحة', example: '12345 بصرة' },
      { header: 'النوع', example: 'advanced' },
      { header: 'الموديل', example: 'Toyota Hiace 2022' },
      { header: 'الطاقم', example: 'سائق + ممرض' },
      { header: 'الحالة', example: 'available' },
      { header: 'الموقع', example: 'المستشفى' },
    ],
  });

  pgCrud(router, 'patients', collectionSchemas.patients, PATIENT_COLUMNS, undefined, { hospitalScoped: true, permission: 'patients', openRead: true, searchFields: ['patientId', 'bloodType', 'nationalId'] });
  pgCrud(router, 'doctors', collectionSchemas.doctors, DOCTOR_COLUMNS, undefined, { hospitalScoped: true, permission: 'doctors', openRead: true, searchFields: ['specialization'] });
  pgCrud(router, 'appointments', collectionSchemas.appointments, [
    { field: 'patient', column: 'patient' },
    { field: 'doctor', column: 'doctor' },
    { field: 'date', column: 'date' },
    { field: 'status', column: 'status' },
  ], undefined, { hospitalScoped: true, permission: 'appointments', openRead: true });
  pgCrud(router, 'invoices', collectionSchemas.invoices, [
    { field: 'patientId', column: 'patient_id' },
    { field: 'status', column: 'status' },
    { field: 'total', column: 'total' },
  ], undefined, { hospitalScoped: true, permission: 'billing' });
  pgCrud(router, 'employees', collectionSchemas.employees, [
    { field: 'name', column: 'name' },
    { field: 'jobTitle', column: 'job_title' },
    { field: 'status', column: 'status' },
  ], undefined, { hospitalScoped: true, permission: 'hr' });
  pgCrud(router, 'retired', collectionSchemas.retired, [
    { field: 'name', column: 'name' },
    { field: 'jobTitle', column: 'job_title' },
  ], undefined, { hospitalScoped: true, permission: 'hr' });

  // باقي الموديولات: تخزين JSONB بحت بدون أعمدة فهرسة إضافية (انظر تعليق
  // المخطط بملف postgres_schema.sql لشرح السبب). اسم الجدول snake_case دائماً
  // حتى لو كان اسم الموديول camelCase بالفرونت إند (مثل medicalLeaves -> medical_leaves).
  // كلها مفعّل عليها الفلترة حسب المنشأة الآن (المرحلة 4 من دعم المنشآت المتعددة).
  pgCrud(router, 'departments', collectionSchemas.departments, [], undefined, { hospitalScoped: true, permission: 'departments', openRead: true });
  pgCrud(router, 'outgoing', collectionSchemas.outgoing, [], undefined, { hospitalScoped: true, permission: 'hr' });
  pgCrud(router, 'incoming', collectionSchemas.incoming, [], undefined, { hospitalScoped: true, permission: 'hr' });
  pgCrud(router, 'vaccinations', collectionSchemas.vaccinations, [{ field: 'status', column: 'status' }], undefined, { hospitalScoped: true, permission: 'vaccinations' });
  pgCrud(router, 'medicalLeaves', collectionSchemas.medicalLeaves, [{ field: 'status', column: 'status' }], 'medical_leaves', { hospitalScoped: true, permission: 'medical-leave' });
  pgCrud(router, 'dossiers', collectionSchemas.dossiers, [], undefined, { hospitalScoped: true, permission: 'hr' });
  pgCrud(router, 'labTests', collectionSchemas.labTests, [{ field: 'status', column: 'status' }, { field: 'priority', column: 'priority' }], 'lab_tests', { hospitalScoped: true, permission: 'laboratory' });
  pgCrud(router, 'radiology', collectionSchemas.radiology, [{ field: 'status', column: 'status' }, { field: 'modality', column: 'modality' }], undefined, { hospitalScoped: true, permission: 'radiology' });
  pgCrud(router, 'pharmacyOrders', collectionSchemas.pharmacyOrders, [{ field: 'status', column: 'status' }], 'pharmacy_orders', { hospitalScoped: true, permission: 'pharmacy' });
  pgCrud(router, 'assets', collectionSchemas.assets, [], undefined, { hospitalScoped: true, permission: 'assets', searchFields: ['assetNo'], extraFilterFields: ['category'] });
  // ── إصلاح: سجل صيانة حقيقي بدل الكتابة فوق تاريخ آخر صيانة كل مرة ──────────
  pgCrud(router, 'assetMaintenanceLog', collectionSchemas.assetMaintenanceLog, [
    { field: 'assetId', column: 'asset_id' },
  ], 'asset_maintenance_log', { hospitalScoped: true, permission: 'assets' });
  pgCrud(router, 'inventory', collectionSchemas.inventory, [], undefined, { hospitalScoped: true, permission: 'inventory', searchFields: ['code'], extraFilterFields: ['category'] });
  pgCrud(router, 'procurement', collectionSchemas.procurement, [{ field: 'status', column: 'status' }], undefined, { hospitalScoped: true, permission: 'procurement' });
  pgCrud(router, 'projects', collectionSchemas.projects, [], undefined, { hospitalScoped: true, permission: 'projects', searchFields: ['code', 'manager', 'name'] });
  pgCrud(router, 'documents', collectionSchemas.documents, [{ field: 'type', column: 'type' }, { field: 'status', column: 'status' }, { field: 'priority', column: 'priority' }], undefined, { hospitalScoped: true, permission: 'documents' });
  pgCrud(router, 'servicePrices', collectionSchemas.servicePrices, [{ field: 'category', column: 'category' }], 'service_prices', { hospitalScoped: true, permission: 'billing', extraFilterFields: ['category'] });
  pgCrud(router, 'transactions', collectionSchemas.transactions, [{ field: 'status', column: 'status' }], undefined, { hospitalScoped: true, permission: 'accounts' });
  pgCrud(router, 'promotions', collectionSchemas.promotions, [{ field: 'status', column: 'status' }], undefined, { hospitalScoped: true, permission: 'accounts' });
  pgCrud(router, 'allowances', collectionSchemas.allowances, [{ field: 'status', column: 'status' }], undefined, { hospitalScoped: true, permission: 'accounts' });
  pgCrud(router, 'salaries', collectionSchemas.salaries, [], undefined, { hospitalScoped: true, permission: 'accounts' });
  pgCrud(router, 'ambulanceVehicles', collectionSchemas.ambulanceVehicles, [{ field: 'status', column: 'status' }], 'ambulance_vehicles', { hospitalScoped: true, permission: 'ambulance' });
  // ── إصلاح: سجل صيانة حقيقي بدل الكتابة فوق تاريخ آخر صيانة كل مرة ──────────
  pgCrud(router, 'ambulanceMaintenanceLog', collectionSchemas.ambulanceMaintenanceLog, [
    { field: 'vehicleId', column: 'vehicle_id' },
  ], 'ambulance_maintenance_log', { hospitalScoped: true, permission: 'ambulance' });
  pgCrud(router, 'ambulanceMissions', collectionSchemas.ambulanceMissions, [{ field: 'status', column: 'status' }], 'ambulance_missions', { hospitalScoped: true, permission: 'ambulance' });

  // CRM المرضى — indexedColumns تختلف عن الاسم الافتراضي (name/phone/status)
  pgCrud(router, 'crmInteractions', collectionSchemas.crmInteractions, [
    { field: 'patientId', column: 'patient_id' },
  ], 'crm_interactions', { hospitalScoped: true, permission: 'crm' });
  pgCrud(router, 'crmSegments', collectionSchemas.crmSegments, [
    { field: 'patientId', column: 'patient_id' },
    { field: 'segmentCode', column: 'segment_code' },
  ], 'crm_patient_segments', { hospitalScoped: true, permission: 'crm' });
  pgCrud(router, 'crmFollowUps', collectionSchemas.crmFollowUps, [
    { field: 'patientId', column: 'patient_id' },
    { field: 'status', column: 'status' },
  ], 'crm_follow_ups', { hospitalScoped: true, permission: 'crm' });
  pgCrud(router, 'crmCampaigns', collectionSchemas.crmCampaigns, [
    { field: 'status', column: 'status' },
  ], 'crm_campaigns', { hospitalScoped: true, permission: 'crm' });
  pgCrud(router, 'crmCampaignTargets', collectionSchemas.crmCampaignTargets, [
    { field: 'campaignId', column: 'campaign_id' },
    { field: 'patientId', column: 'patient_id' },
  ], 'crm_campaign_targets', { hospitalScoped: true, permission: 'crm' });

  // ── إصلاح: إدارة الجودة (ISO) — كانت بدون أي اتصال بقاعدة بيانات ────────────
  // راجعي middleware/schemas.js وmigrations/add-quality-tables.js لتفاصيل
  // الإصلاح الكامل. indexedColumns فاضية عمداً (JSONB بحت) — الحقول
  // (auditNo, ncNo, status...) لا تحتاج بحثاً سريعاً بحجم بيانات هذا الموديول
  // الطبيعي (عشرات-مئات السجلات كحد أقصى واقعي بمستشفى واحد).
  pgCrud(router, 'qualityAudits', collectionSchemas.qualityAudits, [], 'quality_audits', { hospitalScoped: true, permission: 'quality' });
  pgCrud(router, 'qualityNCs', collectionSchemas.qualityNCs, [], 'quality_ncs', { hospitalScoped: true, permission: 'quality' });
  pgCrud(router, 'qualityKPIs', collectionSchemas.qualityKPIs, [], 'quality_kpis', { hospitalScoped: true, permission: 'quality' });

  // ── الردهات (إدارة المرضى الداخليين) ──────────────────────────────────────
  pgCrud(router, 'wards', collectionSchemas.wards, [], undefined, { hospitalScoped: true, permission: 'wards' });
  pgCrud(router, 'admissions', collectionSchemas.admissions, [], undefined, { hospitalScoped: true, permission: 'wards' });
  pgCrud(router, 'medicationOrders', collectionSchemas.medicationOrders, [{ field: 'admissionId', column: 'admission_id' }], 'medication_orders', { hospitalScoped: true, permission: 'wards' });
  pgCrud(router, 'medicationAdministrations', collectionSchemas.medicationAdministrations, [{ field: 'orderId', column: 'order_id' }], 'medication_administrations', { hospitalScoped: true, permission: 'wards' });

  // ── صالة الولادة ──────────────────────────────────────────────────────────
  pgCrud(router, 'deliveries', collectionSchemas.deliveries, [{ field: 'stage', column: 'stage' }, { field: 'babyStatus', column: 'baby_status' }], undefined, { hospitalScoped: true, permission: 'delivery' });

  // ── العلاج الطبيعي ────────────────────────────────────────────────────────
  pgCrud(router, 'ptEquipment', collectionSchemas.ptEquipment, [{ field: 'status', column: 'status' }], 'pt_equipment', { hospitalScoped: true, permission: 'physiotherapy' });
  pgCrud(router, 'ptSessions', collectionSchemas.ptSessions, [{ field: 'status', column: 'status' }, { field: 'date', column: 'date' }], 'pt_sessions', { hospitalScoped: true, permission: 'physiotherapy' });

  // ── إدارة الطابور ─────────────────────────────────────────────────────────
  pgCrud(router, 'queueTickets', collectionSchemas.queueTickets, [{ field: 'department', column: 'department' }, { field: 'status', column: 'status' }], 'queue_tickets', { hospitalScoped: true, permission: 'queue', extraFilterFields: ['department'] });

};

module.exports = registerAllModules;

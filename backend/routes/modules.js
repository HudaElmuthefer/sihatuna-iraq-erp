// backend/routes/modules.js
//
// Registers every pgCrud module (standard CRUD built on PostgreSQL) and the
// bulk Excel import for every module that supports it — 41 modules in one
// place. This section was extracted from server.js (it used to be the
// biggest single section there, ~330 lines) to shrink the main file and
// make it easier to find/edit the registration of any specific module
// without wading through a huge file that mixes everything together.
//
// A single function registerAllModules(router) receives the main router
// from server.js and registers every route on it — in the exact same order
// as the original registration (very important: every Excel import is
// registered *before* pgCrud for the same module, to avoid a conflict
// between the GET /module/:id route and GET /module/import-template — see
// the explanation of the problem and the fix in
// routes/excelImportRoutes.js if you need the full details).
const collectionSchemas = require('../middleware/schemas');
const pgCrud = require('./pgCrud');
const { DEFAULT_COLUMNS } = pgCrud;
// ── Columns promoted from JSONB to real columns (first batch) ─────────────────
// See migration_promote_columns.sql — it must be applied to the database
// first before this code works correctly (otherwise the new columns don't
// exist in the table at all yet).
const PATIENT_COLUMNS = DEFAULT_COLUMNS; // Fix: patient_code/blood_type/national_id are not real columns in the patients table (purely JSONB for these fields) — removed from here and added instead as extraFilterFields in the pgCrud('patients', ...) registration
// Fix: specialization is actually a real column in the doctors table
// (promoted by 002_promote_columns.sql, and fully populated: 152/152
// doctors) — the previous comment here was wrong (it claimed it was purely
// JSONB), so rowToRecord was silently dropping it from every API response
// even though the real column was fully populated, and the
// searchFields:['specialization'] search was actually searching the
// always-empty data->>'specialization' path instead of the real column —
// now it's read/written/searched directly from the real column.
const DOCTOR_COLUMNS = [...DEFAULT_COLUMNS, { field: 'specialization', column: 'specialization' }];
const registerExcelImport = require('./excelImportRoutes');
const { importLimiter } = require('../config/rateLimiters');
const { pool } = require('../config/database');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');

const registerAllModules = (router) => {
  // ── STANDARD CRUD COLLECTIONS (db.json) ───────────────────────────────────────
  // No standard module is left on db.json — every module has moved to
  // PostgreSQL (see the "PostgreSQL-BACKED COLLECTIONS" section further
  // down this file). The API address itself stayed exactly the same for
  // every module, so the frontend needs no changes at all.

  // ── PostgreSQL-BACKED COLLECTIONS ─────────────────────────────────────────────
  // Patients and doctors are the first two modules actually moved to
  // PostgreSQL (the other modules above still run on db.json). The same
  // validation schemas used before are reused here with no change.
  // ── The permission option ────────────────────────────────────────────────────────────
  // The same page keys defined in ALL_PAGES in
  // frontend/src/contexts/AppContext.js — enforces, at the server level,
  // the same permission currently used by the frontend only to show/hide
  // sidebar menu items. An admin account always bypasses this check (see
  // requirePermission.js).
  // ── Bulk import from Excel ────────────────────────────────────────────────────────────
  // Adds POST /api/patients/import-excel and POST /api/doctors/import-excel
  // (and GET .../import-template to download a blank template). Registered
  // deliberately *before* pgCrud for the same module below — Express
  // matches routes in registration order, and if it were registered after
  // pgCrud (which adds GET /patients/:id), a request for GET
  // /patients/import-template would wrongly match the /:id pattern
  // (treating "import-template" as if it were a numeric record id) instead
  // of its more specific explicit route. This is a real bug we ran into
  // and discovered through actual testing.
  registerExcelImport(router, 'patients', collectionSchemas.patients, {
    'الاسم': 'name', 'اسم المريض': 'name', 'Name': 'name',
    'رقم المريض': 'patientId', 'Patient ID': 'patientId',
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
      { header: 'رقم المريض', example: 'PT-0001' },
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
    // Must exactly match the DOCTOR_COLUMNS used in the pgCrud('doctors', ...)
    // registration below — otherwise an Excel import would only write
    // specialization to the JSONB column, and rowToRecord (which now reads
    // the real column) would later empty it back out.
    indexedColumns: DOCTOR_COLUMNS,
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

  // ── Additional import batch: departments, employees, retirees, inventory,
  //    assets, projects, ambulance vehicles ─────────────────────────────────────────────────
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

  // ── Note: the "next promotion/allowance due date" columns on the
  // employees page (hr/EmployeesTab.js) are computed live
  // (calcPromotionDue/calcAllowanceDue from hr/promotionCalc.js, based on
  // lastPromotion/lastAllowance/certificate) and are not fields actually
  // stored on the employee record — so they don't appear here (there's no
  // point importing a computed value), and they don't appear in the export
  // either (the export only reflects stored fields, see GET
  // /:apiName/export-excel in pgCrud.js). The certificate field and the
  // last-promotion/last-allowance dates (lastPromotion/lastAllowance) are
  // the actual inputs those two dates are computed from, and they are real
  // stored fields — added here along with the grade/step after adjustment
  // (nextGrade).
  registerExcelImport(router, 'employees', collectionSchemas.employees, {
    'الاسم': 'name', 'اسم الموظف': 'name', 'Name': 'name',
    'المسمى الوظيفي': 'jobTitle', 'Job Title': 'jobTitle',
    'القسم': 'dept', 'Department': 'dept',
    'الدرجة': 'grade', 'Grade': 'grade',
    'المرحلة': 'step', 'Step': 'step',
    'الشهادة': 'certificate', 'Certificate': 'certificate',
    'الراتب': 'salary', 'Salary': 'salary',
    'تاريخ التعيين': 'hireDate', 'Hire Date': 'hireDate',
    'تاريخ الميلاد': 'birthDate', 'Birth Date': 'birthDate',
    'الهاتف': 'phone', 'Phone': 'phone',
    'آخر ترفيع': 'lastPromotion', 'Last Promotion': 'lastPromotion',
    'آخر علاوة': 'lastAllowance', 'Last Allowance': 'lastAllowance',
    'الدرجة/المرحلة بعد التعديل': 'nextGrade', 'Grade/Step After Adjustment': 'nextGrade',
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
      { header: 'الدرجة', example: 'الرابعة' },
      { header: 'المرحلة', example: '3' },
      { header: 'الشهادة', example: 'بكالوريوس' },
      { header: 'الراتب', example: '480000' },
      { header: 'تاريخ التعيين', example: '2024-01-15' },
      { header: 'الهاتف', example: '07701234567' },
      { header: 'آخر ترفيع', example: '2023-01-15' },
      { header: 'آخر علاوة', example: '2025-06-01' },
      { header: 'الدرجة/المرحلة بعد التعديل', example: 'الرابعة/4' },
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
    'القيمة الحالية': 'currentValue', 'Current Value': 'currentValue',
    'الحالة الفنية': 'condition', 'Condition': 'condition',
    'الموقع': 'location', 'Location': 'location',
    'الحالة': 'status', 'Status': 'status',
    'المسؤول': 'responsiblePerson', 'Responsible Person': 'responsiblePerson',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'assets',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['assetNo'],
    // ── Fix: "current value" (currentValue) used to be completely missing
    // from this import — AssetsPage.js computes the displayed depreciation
    // percentage as `(1 - currentValue/purchaseCost) * 100`, so any asset
    // imported without currentValue silently showed "NaN%". It's now
    // computed here automatically (straight-line depreciation over a
    // 10-year default useful life, with a 10% minimum of cost as salvage
    // value) if not explicitly provided in the file.
    afterParse: (row) => {
      const rest = { ...row };
      const cost = Number(rest.purchaseCost) || 0;
      if (rest.currentValue === undefined || rest.currentValue === '' || rest.currentValue === null) {
        if (cost > 0 && rest.purchaseDate) {
          const ageYears = (Date.now() - new Date(rest.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
          const usefulLife = 10;
          const salvageFraction = 0.10;
          const fractionLeft = Math.max(salvageFraction, 1 - (Math.min(ageYears, usefulLife) / usefulLife) * (1 - salvageFraction));
          rest.currentValue = Math.round(cost * fractionLeft);
        } else {
          rest.currentValue = cost;
        }
      } else {
        rest.currentValue = Number(rest.currentValue) || 0;
      }
      return rest;
    },
    template: [
      { header: 'رقم الأصل', example: 'AST-2026-001' },
      { header: 'الاسم', example: 'جهاز أشعة سينية' },
      { header: 'التصنيف', example: 'radiology' },
      { header: 'الماركة', example: 'Siemens' },
      { header: 'تاريخ الشراء', example: '2024-05-01' },
      { header: 'تكلفة الشراء', example: '15000000' },
      { header: 'القيمة الحالية', example: '' },
      { header: 'الحالة الفنية', example: 'good' },
      { header: 'الموقع', example: 'قسم الأشعة' },
      { header: 'الحالة', example: 'active' },
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
    // ── Fix: these columns used to be completely missing — any imported
    // project would show these fields as undefined in the UI ("NaN%" in
    // the progress bar, and "undefined/undefined" in the milestone count).
    // Now optional in the import, and automatically filled with zero if
    // left blank (see afterParse below).
    'المصروف': 'spent', 'Spent': 'spent',
    'نسبة الإنجاز': 'progress', 'Progress': 'progress',
    'عدد المراحل': 'milestones', 'Milestones': 'milestones',
    'المراحل المنجزة': 'completedMilestones', 'Completed Milestones': 'completedMilestones',
  }, {
    hospitalScoped: true, permission: 'projects',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['code'],
    // ── Fix: default fill for numeric fields not present in the Excel file —
    // instead of staying undefined and breaking the progress bar and milestone circles in the UI
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
    // status is actually a real column in this table (promoted by
    // 004_promote_batch2.sql and registered in the pgCrud registration
    // below). It used to be empty (NULL) for every row despite the correct
    // value being in JSONB -- it was filled in manually once before this
    // fix (UPDATE ... SET status = data->>'status') to match the actual
    // values, and is now stored directly in the real column.
    indexedColumns: [{ field: 'status', column: 'status' }],
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

  // ── Added: Excel import for lab requests (lab_tests) ───────────────────────
  // This used to not be registered at all (only pgCrud, with no
  // registerExcelImport), so the import button never appeared on the lab
  // page at all. Registered here deliberately *before* the
  // pgCrud(router, 'labTests', ...) call below — the same rule followed for
  // every other module in this file, to avoid a conflict between GET
  // /labTests/:id and GET /labTests/import-template. indexedColumns exactly
  // matches the array in pgCrud(router, 'labTests', ...) below. The
  // accepted values for the category/status/priority fields are the raw
  // English values actually used in the CATEGORIES/STATUSES objects in
  // LaboratoryPage.js (such as hematology, pending, urgent), not the Arabic
  // text shown in the UI.
  registerExcelImport(router, 'labTests', collectionSchemas.labTests, {
    'رقم الطلب': 'reqNo', 'Request No': 'reqNo',
    'اسم المريض': 'patientName', 'Patient Name': 'patientName',
    'رقم المريض': 'patientId', 'Patient ID': 'patientId',
    'الطبيب المحول': 'doctorName', 'Referring Doctor': 'doctorName',
    'نوع التحليل': 'testType', 'Test Type': 'testType',
    'الفئة': 'category', 'Category': 'category',
    'تاريخ الطلب': 'requestDate', 'Request Date': 'requestDate',
    'الأولوية': 'priority', 'Priority': 'priority',
    'الحالة': 'status', 'Status': 'status',
    'النتيجة': 'resultRaw', 'Result': 'resultRaw',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'laboratory',
    tableName: 'lab_tests',
    // status/priority are actually real columns in this table (promoted by
    // 004_promote_batch2.sql and registered in the pgCrud registration
    // below) -- now stored directly in the real columns. Note:
    // services/hl7/hl7Listener.js already writes status directly to the
    // real column (independently of this route), so it's automatically
    // compatible with this fix with no further changes needed there.
    indexedColumns: [
      { field: 'status', column: 'status' },
      { field: 'priority', column: 'priority' },
    ],
    limiter: importLimiter,
    duplicateCheck: ['reqNo'],
    // ── Fix: the result is actually stored as a nested results:{value,
    // notes} object in the UI (see LaboratoryPage.js) -- columnMap can't
    // assign a nested field directly, so we temporarily accept the
    // "Result" column into a flat resultRaw field, then convert it here
    // into the correct results structure before saving. Without this fix,
    // the result value used to be lost or wrongly merged into the regular
    // "notes" field.
    afterParse: (row) => {
      const { resultRaw, ...rest } = row;
      if (resultRaw) {
        rest.results = { value: resultRaw, notes: rest.notes || '' };
      }
      return rest;
    },
    template: [
      { header: 'رقم الطلب', example: 'LAB-2026-0100' },
      { header: 'اسم المريض', example: 'محمد عبدالله' },
      { header: 'رقم المريض', example: 'PT-0001' },
      { header: 'الطبيب المحول', example: 'د. أحمد سالم' },
      { header: 'نوع التحليل', example: 'CBC' },
      { header: 'الفئة', example: 'hematology' },
      { header: 'تاريخ الطلب', example: '2026-07-22' },
      { header: 'الأولوية', example: 'normal' },
      { header: 'الحالة', example: 'completed' },
      { header: 'النتيجة', example: '10 10^9/L (طبيعي: 4.0–10.0)' },
      { header: 'ملاحظات', example: '' },
    ],
  });

  // ── Added: the next request number for lab requests (reqNo) ────────────────────────
  // LaboratoryPage.js needs the highest reqNo sequence used this year
  // (pattern LAB-{year}-{seq}) to generate a new, non-duplicate request
  // number, whether adding a single request or creating a batch from a
  // test panel (TEST_PANELS). This used to require fetching every labTests
  // record (20,000+ records, ~5.76 MB) just to compute one number. This
  // route computes it on the server and returns only the number —
  // deliberately registered *before* the pgCrud(router, 'labTests', ...)
  // call below, to avoid a conflict between GET /labTests/:id and GET
  // /labTests/next-req-no (the same rule followed for every module in this
  // file). The same hospitalScoped filtering used in the pgCrud
  // registration for this module below -- an admin with no hospitalId
  // (ministry level) sees the combined sequence across every facility,
  // exactly as the old frontend calculation did (it also used to scan
  // every record with no filtering for this calculation).
  router.get('/labTests/next-req-no', auth, requirePermission('laboratory'), async (req, res, next) => {
    try {
      const year = parseInt(req.query.year, 10) || new Date().getFullYear();
      const prefix = `LAB-${year}-`;
      const conditions = [`data->>'reqNo' LIKE $1`];
      const params = [`${prefix}%`];
      if (req.user?.hospitalId) {
        params.push(req.user.hospitalId);
        conditions.push(`data->>'hospitalId' = $${params.length}`);
      }
      const result = await pool.query(
        `SELECT data->>'reqNo' AS req_no FROM lab_tests WHERE ${conditions.join(' AND ')}`,
        params
      );
      let maxSeq = 0;
      for (const row of result.rows) {
        const v = parseInt(row.req_no.slice(prefix.length), 10);
        if (Number.isFinite(v) && v > maxSeq) maxSeq = v;
      }
      res.json({ maxSeq });
    } catch (err) { next(err); }
  });

  // ── Added: Excel import for radiology and medical imaging requests (radiology) ─────────
  // This used to not be registered at all (only pgCrud, with no
  // registerExcelImport), so the import button never appeared on the
  // radiology page at all. Registered here deliberately *before* the
  // pgCrud(router, 'radiology', ...) call — the same rule followed for
  // every other module in this file, to avoid a conflict between GET
  // /radiology/:id and GET /radiology/import-template. The accepted values
  // for the "Modality" field are the raw keys actually used in the
  // MODALITIES object in RadiologyPage.js (xray, ultrasound, ct, mri,
  // mammogram, other), not the Arabic text shown in the UI. Same for the
  // "Status" field (pending, scheduled, examined, reported, cancelled).
  registerExcelImport(router, 'radiology', collectionSchemas.radiology, {
    'رقم الطلب': 'reqNo', 'Request No': 'reqNo',
    'اسم المريض': 'patientName', 'Patient Name': 'patientName',
    'رقم المريض': 'patientId', 'Patient ID': 'patientId',
    'الطبيب المحول': 'doctorName', 'Referring Doctor': 'doctorName',
    'نوع التصوير': 'modality', 'Modality': 'modality',
    'منطقة الجسم': 'bodyPart', 'Body Part': 'bodyPart',
    'تاريخ الطلب': 'requestDate', 'Request Date': 'requestDate',
    'الأولوية': 'priority', 'Priority': 'priority',
    'الحالة': 'status', 'Status': 'status',
    'المشاهدات': 'findings', 'Findings': 'findings',
    'الاستنتاج': 'impression', 'Impression': 'impression',
    'عدد الصور': 'images', 'Images': 'images',
  }, {
    hospitalScoped: true, permission: 'radiology',
    tableName: 'radiology',
    // status/modality are actually real columns in this table (promoted by
    // 004_promote_batch2.sql and registered in the pgCrud registration
    // below) -- now stored directly in the real columns. Note:
    // services/dicom/orthancIntegration.js already writes status/modality
    // directly to the real columns (independently of this route), so it's
    // automatically compatible with this fix with no further changes
    // needed there.
    indexedColumns: [
      { field: 'status', column: 'status' },
      { field: 'modality', column: 'modality' },
    ],
    limiter: importLimiter,
    duplicateCheck: ['reqNo'],
    template: [
      { header: 'رقم الطلب', example: 'RAD-2026-0100' },
      { header: 'اسم المريض', example: 'محمد عبدالله' },
      { header: 'رقم المريض', example: 'PT-0001' },
      { header: 'الطبيب المحول', example: 'د. أحمد سالم' },
      { header: 'نوع التصوير', example: 'xray' },
      { header: 'منطقة الجسم', example: 'الصدر' },
      { header: 'تاريخ الطلب', example: '2026-07-22' },
      { header: 'الأولوية', example: 'normal' },
      { header: 'الحالة', example: 'reported' },
      { header: 'المشاهدات', example: 'رئتان طبيعيتان' },
      { header: 'الاستنتاج', example: 'لا توجد نتائج مرضية' },
      { header: 'عدد الصور', example: '1' },
    ],
  });

  // ── Added: Excel import for pharmacy prescriptions (pharmacyOrders) ─────────────────
  // This used to not be registered at all. Registered here deliberately
  // *before* pgCrud(router, 'pharmacyOrders', ...) — the same rule
  // followed for every other module in this file, to avoid a conflict
  // between GET /pharmacyOrders/:id and GET /pharmacyOrders/import-template.
  // ── Important structural note: every prescription (rxForm) carries
  // items[] (an array of drugs) in the UI, not a flat field -- columnMap
  // can't assign an array directly. We accept a single drug column per
  // Excel row (drugName/qty/unit/dosage) via temporary flat fields, then
  // build it here as a single element inside items[] before saving --
  // meaning every row in the Excel file creates a separate prescription
  // with a single drug (the same logic actually used by the data source:
  // every single insurance claim/dispensing is for one drug on one
  // occasion).
  registerExcelImport(router, 'pharmacyOrders', collectionSchemas.pharmacyOrders, {
    'رقم الوصفة': 'prescNo', 'Rx Number': 'prescNo',
    'اسم المريض': 'patientName', 'Patient Name': 'patientName',
    'رقم المريض': 'patientId', 'Patient ID': 'patientId',
    'الطبيب': 'doctorName', 'Doctor': 'doctorName',
    'التاريخ': 'date', 'Date': 'date',
    'اسم الدواء': 'drugNameRaw', 'Drug Name': 'drugNameRaw',
    'الكمية': 'qtyRaw', 'Qty': 'qtyRaw',
    'الوحدة': 'unitRaw', 'Unit': 'unitRaw',
    'الجرعة': 'dosageRaw', 'Dosage': 'dosageRaw',
    'التكلفة الإجمالية': 'totalCost', 'Total Cost': 'totalCost',
    'الحالة': 'status', 'Status': 'status',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'pharmacy',
    tableName: 'pharmacy_orders',
    // status is actually a real column in this table (promoted by
    // 004_promote_batch2.sql and registered in the pgCrud registration
    // below) -- now stored directly in the real column.
    indexedColumns: [{ field: 'status', column: 'status' }],
    limiter: importLimiter,
    duplicateCheck: ['prescNo'],
    afterParse: (row) => {
      const { drugNameRaw, qtyRaw, unitRaw, dosageRaw, ...rest } = row;
      if (drugNameRaw) {
        rest.items = [{
          id: Date.now() + Math.floor(Math.random() * 100000),
          name: drugNameRaw,
          qty: Number(qtyRaw) || 1,
          unit: unitRaw || 'حبة',
          dosage: dosageRaw || '',
        }];
      } else {
        rest.items = [];
      }
      if (!rest.status) rest.status = 'dispensed';
      return rest;
    },
    template: [
      { header: 'رقم الوصفة', example: 'RX-2026-0100' },
      { header: 'اسم المريض', example: 'محمد عبدالله' },
      { header: 'رقم المريض', example: 'PT-0001' },
      { header: 'الطبيب', example: 'د. أحمد سالم' },
      { header: 'التاريخ', example: '2026-07-22' },
      { header: 'اسم الدواء', example: 'ميتفورمين 500 ملغ' },
      { header: 'الكمية', example: '30' },
      { header: 'الوحدة', example: 'حبة' },
      { header: 'الجرعة', example: 'حبة صباحاً ومساءً' },
      { header: 'التكلفة الإجمالية', example: '5000' },
      { header: 'الحالة', example: 'dispensed' },
      { header: 'ملاحظات', example: '' },
    ],
  });

  // ── Added: Excel import for appointments (appointments) ──────────────────────────
  // Registered here deliberately *before* pgCrud(router, 'appointments', ...)
  // — the same rule followed for every other module in this file, to
  // avoid a conflict between GET /appointments/:id and GET
  // /appointments/import-template. indexedColumns exactly matches the
  // array in pgCrud(router, 'appointments', ...) below (patient, doctor,
  // date, status). The accepted values for the "Status" field are the raw
  // English keys (confirmed, pending, completed, cancelled), and likewise
  // for "Visit Type" (checkup, followup, consult, emergency) — the same
  // actual internal values used in AppointmentsPage.js, not the Arabic
  // text shown in the UI.
  registerExcelImport(router, 'appointments', collectionSchemas.appointments, {
    'المريض': 'patient', 'اسم المريض': 'patient', 'Patient': 'patient',
    'الطبيب': 'doctor', 'Doctor': 'doctor',
    'القسم': 'department', 'Department': 'department',
    'التاريخ': 'date', 'Date': 'date',
    'الوقت': 'time', 'Time': 'time',
    'نوع الزيارة': 'type', 'Visit Type': 'type',
    'الحالة': 'status', 'Status': 'status',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'appointments',
    indexedColumns: [
      { field: 'patient', column: 'patient' },
      { field: 'doctor', column: 'doctor' },
      { field: 'date', column: 'date' },
      { field: 'status', column: 'status' },
    ],
    limiter: importLimiter,
    duplicateCheck: ['patient', 'date', 'time'],
    template: [
      { header: 'المريض', example: 'Test Patient CBC 1' },
      { header: 'الطبيب', example: 'د. أحمد سالم الراشدي' },
      { header: 'القسم', example: 'الفحوصات الطبية' },
      { header: 'التاريخ', example: '2026-07-22' },
      { header: 'الوقت', example: '09:00' },
      { header: 'نوع الزيارة', example: 'checkup' },
      { header: 'الحالة', example: 'confirmed' },
      { header: 'ملاحظات', example: '' },
    ],
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── Additional import batch: service prices, accounts, quality, wards,
  //    the delivery room, physiotherapy, procurement, documents, CRM
  //    follow-ups, outgoing/incoming letters, medical leaves, and ambulance
  //    missions — all registered here deliberately *before* their
  //    corresponding pgCrud calls further down, for the same reason stated
  //    at the top of the file (a conflict between GET /module/:id and GET
  //    /module/import-template).
  // ══════════════════════════════════════════════════════════════════════════

  // ── Billing: the default price list (servicePrices) ──────────────────────
  registerExcelImport(router, 'servicePrices', collectionSchemas.servicePrices, {
    'الفئة': 'category', 'Category': 'category',
    'الاسم بالعربي': 'nameAr', 'Name (Arabic)': 'nameAr',
    'الاسم بالإنجليزي': 'nameEn', 'Name (English)': 'nameEn',
    'السعر': 'price', 'Price': 'price',
  }, {
    hospitalScoped: true, permission: 'billing',
    tableName: 'service_prices',
    indexedColumns: [{ field: 'category', column: 'category' }],
    limiter: importLimiter,
    duplicateCheck: ['nameAr', 'category'],
    template: [
      { header: 'الفئة', example: 'consultation' },
      { header: 'الاسم بالعربي', example: 'كشفية طبيب اختصاص' },
      { header: 'الاسم بالإنجليزي', example: 'Specialist Consultation' },
      { header: 'السعر', example: '25000' },
    ],
  });

  // ── Accounts: general financial transactions (transactions) ──────────────────────
  registerExcelImport(router, 'transactions', collectionSchemas.transactions, {
    'التاريخ': 'date', 'Date': 'date',
    'الوصف': 'desc', 'Description': 'desc',
    'الوصف بالإنجليزي': 'descEn', 'Description (English)': 'descEn',
    'الفئة': 'category', 'Category': 'category',
    'النوع': 'type', 'Type': 'type',
    'المبلغ': 'amount', 'Amount': 'amount',
    'طريقة الدفع': 'method', 'Method': 'method',
    'المرجع': 'ref', 'Reference': 'ref',
  }, {
    hospitalScoped: true, permission: 'accounts',
    // status actually became a real column in this table (promoted by
    // 004_promote_batch2.sql and registered in the pgCrud registration
    // below), but this Excel import doesn't accept a status field in the
    // columnMap above at all -- so [] here is genuinely correct (there's
    // nothing to route to the real column through this specific route).
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['ref'],
    // ── Fix: in the UI, type's actual value is Arabic (دخل/مصروف --
    // income/expense), while category's and method's actual values are
    // English keys (revenue/donation/... and cash/bank/card/check) -- the
    // opposite of my first assumption. We normalize any common Arabic or
    // English text to the correct value so the income/expense statistics
    // don't silently break.
    afterParse: (row) => {
      const typeMap = { 'دخل': 'دخل', income: 'دخل', 'مصروف': 'مصروف', expense: 'مصروف' };
      const catMap = {
        'إيراد': 'revenue', revenue: 'revenue', 'تبرع': 'donation', donation: 'donation', 'منحة': 'grant', grant: 'grant',
        'رواتب': 'salaries', salaries: 'salaries', 'مستلزمات': 'supplies', supplies: 'supplies',
        'صيانة': 'maintenance', maintenance: 'maintenance', 'إيجار': 'rent', rent: 'rent',
        'كهرباء وماء': 'utilities', utilities: 'utilities', 'أخرى': 'other', other: 'other',
      };
      const methodMap = { 'نقداً': 'cash', cash: 'cash', 'تحويل': 'bank', bank: 'bank', 'بطاقة': 'card', card: 'card', check: 'check' };
      const t = (row.type || '').toString().trim();
      const c = (row.category || '').toString().trim();
      const m = (row.method || '').toString().trim();
      return {
        ...row,
        type: typeMap[t] || typeMap[t.toLowerCase()] || 'دخل',
        category: catMap[c] || catMap[c.toLowerCase()] || 'other',
        method: methodMap[m] || methodMap[m.toLowerCase()] || 'cash',
      };
    },
    template: [
      { header: 'التاريخ', example: '2026-07-01' },
      { header: 'الوصف', example: 'إيراد كشفيات شهر تموز' },
      { header: 'الفئة', example: 'revenue' },
      { header: 'النوع', example: 'دخل' },
      { header: 'المبلغ', example: '1500000' },
      { header: 'طريقة الدفع', example: 'cash' },
      { header: 'المرجع', example: 'REF-0001' },
    ],
  });

  // ── Accounts: the unified promotions and allowances log (promotionsAllowances) ──────────
  // Merges the previous separate promotions and allowances tables into one
  // table — every Excel row may carry the promotion side and/or the
  // allowance side together, and each side has an entirely independent
  // decision number/date (instead of the shared "decision number" field
  // used before). See migrations-sql/014_merge_promotions_allowances.sql.
  // Note: tableName is explicit here because the actual table is
  // promotions_allowances (with an underscore) while the apiName is in
  // camelCase — without it, the import would try to write to the
  // nonexistent "promotionsallowances" table (Postgres automatically
  // lowercases any unquoted identifier).
  registerExcelImport(router, 'promotionsAllowances', collectionSchemas.promotionsAllowances, {
    'الاسم': 'name', 'Name': 'name',
    'من درجة': 'fromGrade', 'From Grade': 'fromGrade',
    'إلى درجة': 'toGrade', 'To Grade': 'toGrade',
    'تاريخ الترفيع': 'promotionDate', 'Promotion Date': 'promotionDate',
    'الراتب قبل': 'salaryBefore', 'Salary Before': 'salaryBefore',
    'الراتب بعد': 'salaryAfter', 'Salary After': 'salaryAfter',
    'رقم قرار الترفيع': 'promotionDecisionNo', 'Promotion Decision No': 'promotionDecisionNo',
    'تاريخ قرار الترفيع': 'promotionDecisionDate', 'Promotion Decision Date': 'promotionDecisionDate',
    'حالة الترفيع': 'promotionStatus', 'Promotion Status': 'promotionStatus',
    'نوع العلاوة': 'allowanceType', 'Allowance Type': 'allowanceType',
    'مبلغ العلاوة': 'amount', 'Allowance Amount': 'amount',
    'تاريخ العلاوة': 'allowanceDate', 'Allowance Date': 'allowanceDate',
    'رقم قرار العلاوة': 'allowanceDecisionNo', 'Allowance Decision No': 'allowanceDecisionNo',
    'تاريخ قرار العلاوة': 'allowanceDecisionDate', 'Allowance Decision Date': 'allowanceDecisionDate',
    'حالة العلاوة': 'allowanceStatus', 'Allowance Status': 'allowanceStatus',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'accounts',
    tableName: 'promotions_allowances',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['name', 'promotionDecisionNo', 'allowanceDecisionNo'],
    // ── The status is only filled in if it was actually entered (we don't
    // force a default value on a side that was never used at all in this
    // row -- a row could be a promotion only, an allowance only, or both).
    afterParse: (row) => {
      const promoMap = { 'منجز': 'مُنجَز', 'مُنجَز': 'مُنجَز', done: 'مُنجَز', 'مستحق': 'مستحق', due: 'مستحق', 'قيد المعالجة': 'قيد المعالجة', process: 'قيد المعالجة' };
      const allowMap = { 'مصرف': 'مدفوع', 'مُصرَف': 'مدفوع', 'مصروف': 'مدفوع', 'مدفوع': 'مدفوع', paid: 'مدفوع', 'مستحقة': 'مستحقة', due: 'مستحقة', 'قيد المعالجة': 'قيد المعالجة', process: 'قيد المعالجة' };
      if (row.promotionStatus) {
        const ps = row.promotionStatus.toString().trim();
        row.promotionStatus = promoMap[ps] || promoMap[ps.toLowerCase()] || ps;
      }
      if (row.allowanceStatus) {
        const as = row.allowanceStatus.toString().trim();
        row.allowanceStatus = allowMap[as] || allowMap[as.toLowerCase()] || as;
      }
      return row;
    },
    template: [
      { header: 'الاسم', example: 'محمد علي حسن' },
      { header: 'من درجة', example: 'الرابعة/3' },
      { header: 'إلى درجة', example: 'الرابعة/4' },
      { header: 'تاريخ الترفيع', example: '2026-07-01' },
      { header: 'الراتب قبل', example: '450000' },
      { header: 'الراتب بعد', example: '480000' },
      { header: 'رقم قرار الترفيع', example: 'DEC-2026-01' },
      { header: 'تاريخ قرار الترفيع', example: '2026-07-05' },
      { header: 'حالة الترفيع', example: 'مُنجَز' },
      { header: 'نوع العلاوة', example: '' },
      { header: 'مبلغ العلاوة', example: '' },
      { header: 'تاريخ العلاوة', example: '' },
      { header: 'رقم قرار العلاوة', example: '' },
      { header: 'تاريخ قرار العلاوة', example: '' },
      { header: 'حالة العلاوة', example: '' },
      { header: 'ملاحظات', example: '' },
    ],
  });

  // ── Accounts: salaries (salaries) ────────────────────────────────────────────
  // ── Structural note: additions[]/deductions[] are arrays in the UI, not
  // flat fields -- the same pattern as pharmacyOrders.items[] above. We
  // accept one optional addition line and one optional deduction line per
  // Excel row via temporary flat fields, then build them here as a single
  // element inside each array before saving.
  registerExcelImport(router, 'salaries', collectionSchemas.salaries, {
    'الاسم': 'name', 'Name': 'name',
    'المسمى الوظيفي': 'jobTitle', 'Job Title': 'jobTitle',
    'القسم': 'dept', 'Department': 'dept',
    'الدرجة': 'grade', 'Grade': 'grade',
    'الراتب الاسمي': 'baseSalary', 'Nominal Salary': 'baseSalary',
    // ── Fix: "Base Salary" was renamed to "Nominal Salary" throughout the
    // UI -- still accepted here as an old synonym so importing any
    // previously-saved Excel file with the old naming doesn't break.
    'الراتب الأساسي': 'baseSalary', 'Base Salary': 'baseSalary',
    'الشهر': 'month', 'Month': 'month',
    'اسم بند الإضافة': 'additionLabelRaw', 'Addition Label': 'additionLabelRaw',
    'مبلغ الإضافة': 'additionAmountRaw', 'Addition Amount': 'additionAmountRaw',
    'اسم بند الخصم': 'deductionLabelRaw', 'Deduction Label': 'deductionLabelRaw',
    'مبلغ الخصم': 'deductionAmountRaw', 'Deduction Amount': 'deductionAmountRaw',
    'الحالة': 'status', 'Status': 'status',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'accounts',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['name', 'month'],
    afterParse: (row) => {
      const { additionLabelRaw, additionAmountRaw, deductionLabelRaw, deductionAmountRaw, ...rest } = row;
      rest.additions = additionLabelRaw ? [{ label: additionLabelRaw, amount: Number(additionAmountRaw) || 0 }] : [];
      rest.deductions = deductionLabelRaw ? [{ label: deductionLabelRaw, amount: Number(deductionAmountRaw) || 0 }] : [];
      // ── Fix: "amount" represents the net salary (the same meaning it has
      // in transactions/allowances -- the record's final total monetary
      // value), i.e. baseSalary + sum of additions - sum of deductions,
      // exactly matching the calcNet() function in the frontend
      // (frontend/src/pages/accounts/shared.js). It used to be filled in
      // with the baseSalary value alone, just to avoid failing an old
      // validation in the import schema -- the field is no longer actually
      // required in collectionSchemas.salaries, but we still calculate it
      // correctly here anyway so it stays a genuinely net value for
      // anything that reads it later (a report, an export...) instead of
      // relying on it always being recalculated in the frontend alone.
      const totalAdd = rest.additions.reduce((s, a) => s + (Number(a.amount) || 0), 0);
      const totalDed = rest.deductions.reduce((s, d) => s + (Number(d.amount) || 0), 0);
      rest.amount = (Number(rest.baseSalary) || 0) + totalAdd - totalDed;
      const map = { 'مصرف': 'مدفوع', 'مُصرَف': 'مدفوع', 'مصروف': 'مدفوع', 'مدفوع': 'مدفوع', paid: 'مدفوع', 'معلق': 'معلق', pending: 'معلق', 'مرفوض': 'مرفوض', rejected: 'مرفوض' };
      const s = (rest.status || '').toString().trim();
      rest.status = map[s] || map[s.toLowerCase()] || 'معلق';
      return rest;
    },
    template: [
      { header: 'الاسم', example: 'رنا محمد النجار' },
      { header: 'المسمى الوظيفي', example: 'سكرتيرة' },
      { header: 'القسم', example: 'الإدارة' },
      { header: 'الراتب الاسمي', example: '450000' },
      { header: 'الشهر', example: '2026-07' },
      { header: 'اسم بند الإضافة', example: 'علاوة اجتماعية' },
      { header: 'مبلغ الإضافة', example: '30000' },
      { header: 'اسم بند الخصم', example: 'ضريبة' },
      { header: 'مبلغ الخصم', example: '10000' },
      { header: 'الحالة', example: 'معلق' },
    ],
  });

  // ── Human Resources: outgoing letters (outgoing) ───────────────────────────────
  registerExcelImport(router, 'outgoing', collectionSchemas.outgoing, {
    'رقم الصادر': 'ref', 'Ref No': 'ref',
    'عنوان الكتاب': 'title', 'Letter Title': 'title',
    'الجهة المُرسَلة إليها': 'to', 'Sent To': 'to',
    'التاريخ': 'date', 'Date': 'date',
    'الموضوع': 'subject', 'Subject': 'subject',
    'الحالة': 'status', 'Status': 'status',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'hr',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['ref'],
    template: [
      { header: 'رقم الصادر', example: 'ص-2026-001' },
      { header: 'عنوان الكتاب', example: 'طلب تجهيز مستلزمات طبية' },
      { header: 'الجهة المُرسَلة إليها', example: 'دائرة صحة البصرة' },
      { header: 'التاريخ', example: '2026-07-01' },
      { header: 'الموضوع', example: 'تجهيز مستلزمات' },
      { header: 'الحالة', example: 'مُرسَل' },
    ],
  });

  // ── Human Resources: incoming letters (incoming) ───────────────────────────────
  registerExcelImport(router, 'incoming', collectionSchemas.incoming, {
    'رقم الوارد': 'ref', 'Ref No': 'ref',
    'عنوان الكتاب': 'title', 'Letter Title': 'title',
    'الجهة المُرسِلة': 'from', 'From': 'from',
    'رقم صادر الجهة': 'incomingRef', 'Sender Ref': 'incomingRef',
    'التاريخ': 'date', 'Date': 'date',
    'الموضوع': 'subject', 'Subject': 'subject',
    'الحالة': 'status', 'Status': 'status',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'hr',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['ref'],
    template: [
      { header: 'رقم الوارد', example: 'و-2026-001' },
      { header: 'عنوان الكتاب', example: 'إشعار زيارة تفتيشية' },
      { header: 'الجهة المُرسِلة', example: 'دائرة صحة البصرة' },
      { header: 'رقم صادر الجهة', example: '4521' },
      { header: 'التاريخ', example: '2026-07-01' },
      { header: 'الموضوع', example: 'زيارة تفتيشية' },
      { header: 'الحالة', example: 'مُستلَم' },
    ],
  });

  // ── Human Resources: medical leaves (medicalLeaves) ───────────────────────
  registerExcelImport(router, 'medicalLeaves', collectionSchemas.medicalLeaves, {
    'الموظف': 'employee', 'Employee': 'employee',
    'القسم': 'dept', 'Department': 'dept',
    'النوع': 'type', 'Type': 'type',
    'من تاريخ': 'from', 'From': 'from',
    'إلى تاريخ': 'to', 'To': 'to',
    'عدد الأيام': 'days', 'Days': 'days',
    'التشخيص': 'diagnosis', 'Diagnosis': 'diagnosis',
    'الطبيب': 'doctor', 'Doctor': 'doctor',
    'الحالة': 'status', 'Status': 'status',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'medical-leave',
    tableName: 'medical_leaves',
    // status is now an actual real column in this table (promoted in
    // 004_promote_batch2.sql and registered in the pgCrud registration
    // below) — it's stored directly in the real column now.
    indexedColumns: [{ field: 'status', column: 'status' }],
    limiter: importLimiter,
    duplicateCheck: ['employee', 'from', 'to'],
    // ── Fix: the frontend filters statistics by a strict comparison
    // against actual English keys (approved/review/rejected) -- any raw
    // Arabic text in the "status" column (even if it exactly matches the
    // badge text shown in the table) doesn't match any condition, so every
    // card shows zero even though real data exists in every status. We
    // normalize the value here for any common Arabic or English text, and
    // any unrecognized value is treated as "under review" (the same
    // default used by the manual add form itself).
    afterParse: (row) => {
      const raw = (row.status || '').toString().trim();
      const map = {
        'موافق عليه': 'approved', 'موافق عليها': 'approved', 'مقبولة': 'approved', 'approved': 'approved',
        'مرفوضة': 'rejected', 'مرفوض': 'rejected', 'rejected': 'rejected',
        'قيد المراجعة': 'review', 'قيد المعالجة': 'review', 'review': 'review', 'pending': 'review',
      };
      return { ...row, status: map[raw] || map[raw.toLowerCase()] || 'review' };
    },
    template: [
      { header: 'الموظف', example: 'محمد علي حسن' },
      { header: 'القسم', example: 'قسم الطوارئ' },
      { header: 'النوع', example: 'مرضية' },
      { header: 'من تاريخ', example: '2026-07-01' },
      { header: 'إلى تاريخ', example: '2026-07-05' },
      { header: 'عدد الأيام', example: '5' },
      { header: 'التشخيص', example: 'التهاب حاد' },
      { header: 'الطبيب', example: 'د. أحمد الكريم' },
      { header: 'الحالة', example: 'موافق عليه' },
    ],
  });

  // ── Document control (documents) ──────────────────────────────────────────────────
  // ── Note: the tags[] field is an array in the frontend -- it isn't
  // imported from Excel, it always starts empty via afterParse and can be
  // added later from the frontend.
  registerExcelImport(router, 'documents', collectionSchemas.documents, {
    'رقم الوثيقة': 'docNo', 'Doc No': 'docNo',
    'النوع': 'type', 'Type': 'type',
    'العنوان': 'title', 'Title': 'title',
    'المصدر / الجهة': 'from', 'From': 'from',
    'التاريخ': 'date', 'Date': 'date',
    'تاريخ الاستلام': 'receivedDate', 'Received Date': 'receivedDate',
    'الأولوية': 'priority', 'Priority': 'priority',
    'الحالة': 'status', 'Status': 'status',
    'الموضوع': 'subject', 'Subject': 'subject',
    'مسؤول المعالجة': 'assignedTo', 'Assigned To': 'assignedTo',
  }, {
    hospitalScoped: true, permission: 'documents',
    // type/status/priority are now actual real columns in this table
    // (promoted in 004_promote_batch2.sql and registered in the pgCrud
    // registration below) — stored directly in the real columns now.
    indexedColumns: [
      { field: 'type', column: 'type' },
      { field: 'status', column: 'status' },
      { field: 'priority', column: 'priority' },
    ],
    limiter: importLimiter,
    duplicateCheck: ['docNo'],
    afterParse: (row) => ({ ...row, tags: row.tags || [] }),
    template: [
      { header: 'رقم الوثيقة', example: 'IN-2026-0001' },
      { header: 'النوع', example: 'incoming' },
      { header: 'العنوان', example: 'كتاب تعميم إداري' },
      { header: 'المصدر / الجهة', example: 'دائرة صحة البصرة' },
      { header: 'التاريخ', example: '2026-07-01' },
      { header: 'الأولوية', example: 'normal' },
      { header: 'الحالة', example: 'pending' },
      { header: 'الموضوع', example: 'تعميم' },
    ],
  });

  // ── Procurement (procurement) ──────────────────────────────────────────────────
  registerExcelImport(router, 'procurement', collectionSchemas.procurement, {
    'رقم أمر الشراء': 'poNo', 'PO Number': 'poNo',
    'عنوان المشتريات': 'title', 'Title': 'title',
    'العنوان بالإنجليزي': 'titleEn', 'Title (English)': 'titleEn',
    'المورد': 'supplier', 'Supplier': 'supplier',
    'المورد بالإنجليزي': 'supplierEn', 'Supplier (English)': 'supplierEn',
    'تاريخ الطلب': 'date', 'Order Date': 'date',
    'تاريخ التسليم المتوقع': 'deliveryDate', 'Expected Delivery': 'deliveryDate',
    'المبلغ الإجمالي': 'totalAmount', 'Total Amount': 'totalAmount',
    'عدد الأصناف': 'items', 'Items Count': 'items',
    'الأولوية': 'priority', 'Priority': 'priority',
    'الحالة': 'status', 'Status': 'status',
  }, {
    hospitalScoped: true, permission: 'procurement',
    // status is now an actual real column in this table (promoted in
    // 004_promote_batch2.sql and registered in the pgCrud registration
    // below) — it's stored directly in the real column now.
    indexedColumns: [{ field: 'status', column: 'status' }],
    limiter: importLimiter,
    duplicateCheck: ['poNo'],
    template: [
      { header: 'رقم أمر الشراء', example: 'PO-2026-001' },
      { header: 'عنوان المشتريات', example: 'تجهيز مستلزمات مختبر' },
      { header: 'المورد', example: 'شركة الرافدين للأدوية' },
      { header: 'تاريخ الطلب', example: '2026-07-01' },
      { header: 'المبلغ الإجمالي', example: '3500000' },
      { header: 'الأولوية', example: 'normal' },
      { header: 'الحالة', example: 'pending' },
    ],
  });

  // ── Patient CRM: follow-ups and reminders (crmFollowUps) ─────────────────────────
  // ── Important note: "patient id" here is the patient record's internal
  // numeric id in the database (the id column in the patients table), not
  // the textual patient code (patientId code like PT-0001) used by other
  // modules such as the lab and radiology. It can be obtained from the
  // Excel export of the patients page.
  // ── Updated note: it now accepts "patient name" directly and resolves it
  // to the real numeric patientId by looking it up directly in the
  // patients table (the same approach as wardId/admissionId) -- instead of
  // relying on manually knowing an internal number, which is hard to
  // actually provide in a plain Excel file. If the name doesn't exactly
  // match a real patient, the row is rejected with a clear error
  // (patientId required) instead of being saved with a silently wrong link.
  registerExcelImport(router, 'crmFollowUps', collectionSchemas.crmFollowUps, {
    'اسم المريض': 'patientName', 'Patient Name': 'patientName',
    'معرّف المريض': 'patientId', 'Patient Numeric ID': 'patientId',
    'نوع المتابعة': 'followUpType', 'Follow-up Type': 'followUpType',
    'العنوان': 'title', 'Title': 'title',
    'تاريخ الاستحقاق': 'dueDate', 'Due Date': 'dueDate',
    'قناة التذكير': 'reminderChannel', 'Reminder Channel': 'reminderChannel',
    'الحالة': 'status', 'Status': 'status',
  }, {
    hospitalScoped: true, permission: 'crm',
    tableName: 'crm_follow_ups',
    indexedColumns: [{ field: 'patientId', column: 'patient_id' }, { field: 'status', column: 'status' }],
    limiter: importLimiter,
    duplicateCheck: ['patientId', 'title', 'dueDate'],
    // ── A preemptive fix (the same issue as medicalLeaves): the frontend
    // compares status/followUpType/reminderChannel against strict English
    // keys only. We normalize any common Arabic text (or English in any
    // letter case) to the correct key before saving.
    afterParse: async (row, hospitalId) => {
      const statusMap = {
        'قيد الانتظار': 'pending', 'مكتملة': 'completed', 'فائتة': 'missed', 'ملغاة': 'cancelled',
        pending: 'pending', completed: 'completed', missed: 'missed', cancelled: 'cancelled',
      };
      const typeMap = {
        'موعد': 'appointment', 'فحص دوري': 'checkup', 'لقاح': 'vaccination',
        'نتيجة مختبر': 'lab_result', 'دواء': 'medication', 'أخرى': 'other',
        appointment: 'appointment', checkup: 'checkup', vaccination: 'vaccination',
        lab_result: 'lab_result', medication: 'medication', other: 'other',
      };
      const channelMap = { 'اتصال': 'call', sms: 'sms', whatsapp: 'whatsapp', call: 'call' };
      const s = (row.status || '').toString().trim();
      const t = (row.followUpType || '').toString().trim();
      const c = (row.reminderChannel || '').toString().trim();
      const { patientName, ...rest } = row;
      if (patientName && !rest.patientId) {
        try {
          const conditions = ['name = $1'];
          const values = [patientName];
          if (hospitalId) { values.push(hospitalId); conditions.push(`data->>'hospitalId' = $${values.length}`); }
          const result = await pool.query(`SELECT id FROM patients WHERE ${conditions.join(' AND ')} LIMIT 1`, values);
          if (result.rows.length > 0) rest.patientId = result.rows[0].id;
        } catch { /* the lookup failed -- patientId stays empty, the row is rejected later with a clear error instead of a wrong link */ }
      }
      return {
        ...rest,
        status: statusMap[s] || statusMap[s.toLowerCase()] || 'pending',
        followUpType: typeMap[t] || typeMap[t.toLowerCase()] || 'other',
        reminderChannel: channelMap[c] || channelMap[c.toLowerCase()] || 'sms',
      };
    },
    template: [
      { header: 'اسم المريض', example: 'Test Patient CBC 1' },
      { header: 'نوع المتابعة', example: 'checkup' },
      { header: 'العنوان', example: 'فحص دوري للضغط' },
      { header: 'تاريخ الاستحقاق', example: '2026-08-01' },
      { header: 'قناة التذكير', example: 'sms' },
    ],
  });

  // ── Quality management (quality) ────────────────────────────────────────────────────
  registerExcelImport(router, 'qualityAudits', collectionSchemas.qualityAudits, {
    'العنوان': 'title', 'Title': 'title',
    'العنوان بالإنجليزي': 'titleEn', 'Title (English)': 'titleEn',
    'النطاق': 'scope', 'Scope': 'scope',
    'المدقق': 'auditor', 'Auditor': 'auditor',
    'التاريخ': 'date', 'Date': 'date',
    'النوع': 'type', 'Type': 'type',
    'الحالة': 'status', 'Status': 'status',
  }, {
    hospitalScoped: true, permission: 'quality',
    tableName: 'quality_audits',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['title', 'date'],
    template: [
      { header: 'العنوان', example: 'مراجعة قسم المختبر' },
      { header: 'النطاق', example: 'إجراءات السلامة' },
      { header: 'المدقق', example: 'م. هدى عبد العظيم' },
      { header: 'التاريخ', example: '2026-07-01' },
      { header: 'النوع', example: 'internal' },
      { header: 'الحالة', example: 'planned' },
    ],
  });

  registerExcelImport(router, 'qualityNCs', collectionSchemas.qualityNCs, {
    'العنوان': 'title', 'Title': 'title',
    'العنوان بالإنجليزي': 'titleEn', 'Title (English)': 'titleEn',
    'التصنيف': 'classification', 'Classification': 'classification',
    'القسم': 'department', 'Department': 'department',
    'المسؤول عن التصحيح': 'owner', 'Owner': 'owner',
    'تاريخ الفتح': 'openDate', 'Open Date': 'openDate',
    'تاريخ الإغلاق المتوقع': 'dueDate', 'Due Date': 'dueDate',
    'السبب الجذري': 'rootCause', 'Root Cause': 'rootCause',
    'الإجراء التصحيحي': 'corrective', 'Corrective Action': 'corrective',
    'الحالة': 'status', 'Status': 'status',
  }, {
    hospitalScoped: true, permission: 'quality',
    tableName: 'quality_ncs',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['title', 'openDate'],
    afterParse: (row) => ({ ...row, status: row.status || 'open' }),
    template: [
      { header: 'العنوان', example: 'نقص بمخزون قفازات معقمة' },
      { header: 'التصنيف', example: 'minor' },
      { header: 'القسم', example: 'المخزون' },
      { header: 'المسؤول عن التصحيح', example: 'أمين المخزن' },
      { header: 'تاريخ الفتح', example: '2026-07-01' },
      { header: 'الحالة', example: 'open' },
    ],
  });

  registerExcelImport(router, 'qualityKPIs', collectionSchemas.qualityKPIs, {
    'اسم المؤشر': 'name', 'KPI Name': 'name',
    'الهدف': 'target', 'Target': 'target',
    'القيمة الحالية': 'actual', 'Current Value': 'actual',
    'الوحدة': 'unit', 'Unit': 'unit',
    'الفترة': 'period', 'Period': 'period',
  }, {
    hospitalScoped: true, permission: 'quality',
    tableName: 'quality_kpis',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['name', 'period'],
    template: [
      { header: 'اسم المؤشر', example: 'نسبة رضا المرضى' },
      { header: 'الهدف', example: '90' },
      { header: 'القيمة الحالية', example: '85' },
      { header: 'الوحدة', example: '%' },
      { header: 'الفترة', example: '2026-Q3' },
    ],
  });

  // ── Wards (wards / admissions) ────────────────────────────────────────────
  registerExcelImport(router, 'wards', collectionSchemas.wards, {
    'اسم الردهة': 'name', 'Ward Name': 'name',
    'الاسم بالإنجليزي': 'nameEn', 'Name (English)': 'nameEn',
    'عدد الأسرّة': 'bedCount', 'Bed Count': 'bedCount',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'wards',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['name'],
    template: [
      { header: 'اسم الردهة', example: 'ردهة الباطنية' },
      { header: 'عدد الأسرّة', example: '20' },
    ],
  });

  // ── Note: "ward" (wardId) is an internal numeric reference (foreign
  // key) to the wards table -- it can't be automatically assigned from a
  // text name via bulk import, so it stays empty in imported records and
  // is set later manually from the frontend (an edit button).
  // ── Updated note: after fixing excelImportRoutes.js to support an async
  // afterParse, it became possible to convert the textual ward name in the
  // Excel file into a real numeric wardId by looking it up directly in the
  // wards table during processing -- instead of staying empty as in the
  // previous version. The only condition: the ward name in the column
  // *exactly* matches a ward name that actually exists in the wards table
  // (the same text imported in the wards_import.xlsx file) -- if there's
  // no match, wardId stays empty and needs to be linked manually as
  // before, instead of failing the whole row.
  registerExcelImport(router, 'admissions', collectionSchemas.admissions, {
    'اسم المريض': 'patientName', 'Patient Name': 'patientName',
    'الردهة': 'wardName', 'Ward': 'wardName',
    'رقم السرير': 'bedNo', 'Bed No': 'bedNo',
    'تاريخ الإدخال': 'admissionDate', 'Admission Date': 'admissionDate',
    'التشخيص': 'diagnosis', 'Diagnosis': 'diagnosis',
    'الطبيب المعالج': 'treatingDoctor', 'Treating Doctor': 'treatingDoctor',
    'الحالة': 'status', 'Status': 'status',
    'تاريخ الخروج': 'dischargeDate', 'Discharge Date': 'dischargeDate',
    'ملاحظات الخروج': 'dischargeNotes', 'Discharge Notes': 'dischargeNotes',
  }, {
    hospitalScoped: true, permission: 'wards',
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['patientName', 'admissionDate'],
    afterParse: async (row, hospitalId) => {
      const { wardName, ...rest } = row;
      rest.status = rest.status || 'admitted';
      if (wardName) {
        try {
          const conditions = [`data->>'name' = $1`];
          const values = [wardName];
          if (hospitalId) { values.push(hospitalId); conditions.push(`data->>'hospitalId' = $${values.length}`); }
          const result = await pool.query(`SELECT id FROM wards WHERE ${conditions.join(' AND ')} LIMIT 1`, values);
          if (result.rows.length > 0) rest.wardId = result.rows[0].id;
        } catch { /* فشل البحث — يبقى wardId فارغاً، الصف يُستورَد بدون ربط ردهة بدل الفشل كاملاً */ }
      }
      return rest;
    },
    template: [
      { header: 'اسم المريض', example: 'Test Patient CBC 1' },
      { header: 'الردهة', example: 'الباطنية العامة' },
      { header: 'رقم السرير', example: '3' },
      { header: 'تاريخ الإدخال', example: '2026-07-01' },
      { header: 'التشخيص', example: 'التهاب رئوي' },
      { header: 'الطبيب المعالج', example: 'د. أحمد سالم' },
      { header: 'الحالة', example: 'admitted' },
    ],
  });

  // ── Delivery ward (deliveries) ────────────────────────────────────────────────
  registerExcelImport(router, 'deliveries', collectionSchemas.deliveries, {
    'اسم الأم': 'motherName', 'Mother Name': 'motherName',
    'عمر الأم': 'motherAge', 'Mother Age': 'motherAge',
    'تاريخ الدخول': 'admissionDate', 'Admission Date': 'admissionDate',
    'الموعد المتوقع': 'expectedDate', 'Expected Date': 'expectedDate',
    'تاريخ الولادة': 'deliveryDate', 'Delivery Date': 'deliveryDate',
    'وقت الولادة': 'deliveryTime', 'Delivery Time': 'deliveryTime',
    'نوع الولادة': 'deliveryType', 'Delivery Type': 'deliveryType',
    'الطبيب المشرف': 'attendingDoctor', 'Attending Doctor': 'attendingDoctor',
    'القابلة': 'midwife', 'Midwife': 'midwife',
    'اسم الطفل': 'babyName', 'Baby Name': 'babyName',
    'جنس المولود': 'babyGender', 'Baby Gender': 'babyGender',
    'وزن المولود': 'babyWeight', 'Baby Weight': 'babyWeight',
    'درجة أبغار': 'apgarScore', 'Apgar Score': 'apgarScore',
    'المضاعفات': 'complications', 'Complications': 'complications',
    'حالة الأم': 'motherStatus', "Mother's Status": 'motherStatus',
    'حالة المولود': 'babyStatus', "Baby's Status": 'babyStatus',
    'المرحلة': 'stage', 'Stage': 'stage',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'delivery',
    // stage/baby_status are now actual real columns in this table
    // (promoted in 004_promote_batch2.sql and registered in the pgCrud
    // registration below). The field name in the frontend is babyStatus
    // (camelCase) while the actual column name is baby_status -- stored
    // directly in the real columns now.
    indexedColumns: [
      { field: 'stage', column: 'stage' },
      { field: 'babyStatus', column: 'baby_status' },
    ],
    limiter: importLimiter,
    duplicateCheck: ['motherName', 'admissionDate'],
    afterParse: (row) => ({ ...row, stage: row.stage || (row.deliveryDate ? 'delivered' : 'admitted') }),
    template: [
      { header: 'اسم الأم', example: 'زينب علي حسين' },
      { header: 'تاريخ الدخول', example: '2026-07-01' },
      { header: 'تاريخ الولادة', example: '2026-07-02' },
      { header: 'نوع الولادة', example: 'normal' },
      { header: 'الطبيب المشرف', example: 'د. فاطمة الموسوي' },
      { header: 'حالة الأم', example: 'stable' },
      { header: 'حالة المولود', example: 'healthy' },
      { header: 'المرحلة', example: 'delivered' },
    ],
  });

  // ── Physical therapy (ptEquipment / ptSessions) ────────────────────────────────
  registerExcelImport(router, 'ptEquipment', collectionSchemas.ptEquipment, {
    'اسم الجهاز': 'name', 'Equipment Name': 'name',
    'الاسم بالإنجليزي': 'nameEn', 'Name (English)': 'nameEn',
    'النوع': 'type', 'Type': 'type',
    'الحالة': 'status', 'Status': 'status',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'physiotherapy',
    tableName: 'pt_equipment',
    // status is now an actual real column in this table (promoted in
    // 004_promote_batch2.sql and registered in the pgCrud registration
    // below) — it's stored directly in the real column now.
    indexedColumns: [{ field: 'status', column: 'status' }],
    limiter: importLimiter,
    duplicateCheck: ['name'],
    template: [
      { header: 'اسم الجهاز', example: 'جهاز مقاومة كهربائي' },
      { header: 'النوع', example: 'كهربائي' },
      { header: 'الحالة', example: 'available' },
    ],
  });

  registerExcelImport(router, 'ptSessions', collectionSchemas.ptSessions, {
    'اسم المريض': 'patientName', 'Patient Name': 'patientName',
    'المعالج': 'therapist', 'Therapist': 'therapist',
    'التاريخ': 'date', 'Date': 'date',
    'الجهاز المستخدم': 'equipmentUsed', 'Equipment Used': 'equipmentUsed',
    'نوع العلاج': 'treatmentType', 'Treatment Type': 'treatmentType',
    'المدة': 'duration', 'Duration': 'duration',
    'التقدّم الملاحَظ': 'progress', 'Observed Progress': 'progress',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'physiotherapy',
    tableName: 'pt_sessions',
    // status/date are now actual real columns in this table (promoted in
    // 004_promote_batch2.sql and registered in the pgCrud registration
    // below) — stored directly in the real columns now. The date column
    // is an actual DATE type (not text), it directly accepts a
    // 'YYYY-MM-DD' string coming from the frontend with no extra conversion.
    indexedColumns: [
      { field: 'status', column: 'status' },
      { field: 'date', column: 'date' },
    ],
    limiter: importLimiter,
    duplicateCheck: ['patientName', 'date'],
    template: [
      { header: 'اسم المريض', example: 'Test Patient CBC 1' },
      { header: 'المعالج', example: 'أ. سلام كاظم' },
      { header: 'التاريخ', example: '2026-07-01' },
      { header: 'نوع العلاج', example: 'تمارين إطالة' },
      { header: 'المدة', example: '30' },
    ],
  });

  // ── Ambulance: missions (ambulanceMissions) ─────────────────────────────────
  // ── Note: "vehicle" (vehicleId) is an internal numeric reference
  // (foreign key) to the ambulanceVehicles table -- it stays empty in
  // imported records and is set later manually from the frontend, for the
  // same reason as wardId above. Check the field names here against the
  // actual EMPTY_MISS in AmbulancePage.js before the first real use -- this
  // was built with the best knowledge available about the mission form
  // without seeing the form's full code.
  registerExcelImport(router, 'ambulanceMissions', collectionSchemas.ambulanceMissions, {
    'اسم المريض': 'patientName', 'Patient Name': 'patientName',
    'هاتف المتصل': 'callerPhone', 'Caller Phone': 'callerPhone',
    'العنوان': 'address', 'Address': 'address',
    'وقت الاتصال': 'callTime', 'Call Time': 'callTime',
    'الأولوية': 'priority', 'Priority': 'priority',
    'الحالة': 'status', 'Status': 'status',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'ambulance',
    tableName: 'ambulance_missions',
    // status is now an actual real column in this table (promoted in
    // 004_promote_batch2.sql and registered in the pgCrud registration
    // below) — it's stored directly in the real column now.
    indexedColumns: [{ field: 'status', column: 'status' }],
    limiter: importLimiter,
    duplicateCheck: ['address', 'callTime'],
    template: [
      { header: 'اسم المريض', example: 'مواطن' },
      { header: 'العنوان', example: 'حي الجزائر - البصرة' },
      { header: 'وقت الاتصال', example: '2026-07-01T14:30' },
      { header: 'الأولوية', example: 'normal' },
      { header: 'الحالة', example: 'completed' },
    ],
  });

  // 'hospitalId' here lets a global admin (no hospitalId of their own) opt
  // into viewing one facility's records at a time from the header's
  // "Currently viewing" dropdown (frontend/src/pages/PatientsPage.js) -- it
  // is a plain whitelisted equality filter, same mechanism as patientId/
  // bloodType/nationalId above, and has no effect on the hospitalScoped
  // enforcement itself: a hospital-scoped user's own hospitalId is still
  // forced unconditionally regardless of this or any other query param.
  pgCrud(router, 'patients', collectionSchemas.patients, PATIENT_COLUMNS, undefined, { hospitalScoped: true, permission: 'patients', openRead: true, searchFields: ['patientId', 'bloodType', 'nationalId'], extraFilterFields: ['patientId', 'bloodType', 'nationalId', 'hospitalId'], dateRangeColumn: 'created_at' });
  // ── Phase two: Redis caching ─────────────────────────────────────────────
  // The doctors list is read from very many pages (dropdown lists in
  // appointments, prescriptions, referrals...) and changes rarely (adding
  // or editing a doctor is a relatively rare event) -- an ideal candidate
  // for caching. 5 minutes (300 seconds) balances reducing database
  // pressure against the data staying fresh enough, with no extra manual
  // invalidation needed (and any actual write to the module invalidates
  // the cache immediately anyway — see routes/pgCrud.js).
  pgCrud(router, 'doctors', collectionSchemas.doctors, DOCTOR_COLUMNS, undefined, { hospitalScoped: true, permission: 'doctors', openRead: true, searchFields: ['specialization'], extraFilterFields: ['specialization'], cache: { ttlSeconds: 300 } });
  pgCrud(router, 'appointments', collectionSchemas.appointments, [
    { field: 'patient', column: 'patient' },
    { field: 'doctor', column: 'doctor' },
    { field: 'date', column: 'date' },
    { field: 'status', column: 'status' },
  ], undefined, { hospitalScoped: true, permission: 'appointments', openRead: true, dateRangeField: 'date' });
  // ── Billing: invoices (invoices) — historically paid invoice records ──────────────
  // ── The same patientId resolution approach used in crmFollowUps: accepts
  // "patient name" directly and resolves it to a real numeric id by
  // looking it up in the patients table. Each Excel row represents one
  // invoice with a single service (the most common case for simple
  // historical invoices) -- for invoices with several services on the same
  // visit, they're added as separate rows with the same patient name and
  // the same reference (referenceCode), and they stay separate invoices in
  // the database (the current import doesn't automatically merge them into
  // one invoice).
  registerExcelImport(router, 'invoices', collectionSchemas.invoices, {
    'اسم المريض': 'patientName', 'Patient Name': 'patientName',
    'الخدمة': 'description', 'Service': 'description',
    'الفئة': 'category', 'Category': 'category',
    'السعر': 'price', 'Price': 'price',
    'الكمية': 'qty', 'Qty': 'qty',
    'طريقة الدفع': 'paymentMethod', 'Payment Method': 'paymentMethod',
    'المرجع': 'referenceCode', 'Reference': 'referenceCode',
    'تاريخ الدفع': 'paidAt', 'Paid At': 'paidAt',
  }, {
    hospitalScoped: true, permission: 'billing',
    indexedColumns: [
      { field: 'patientId', column: 'patient_id' },
      { field: 'status', column: 'status' },
      { field: 'total', column: 'total' },
    ],
    limiter: importLimiter,
    duplicateCheck: ['patientId', 'referenceCode', 'description'],
    afterParse: async (row, hospitalId) => {
      const { patientName, category, price, qty, ...rest } = row;
      const description = rest.description;
      if (patientName) {
        try {
          const conditions = ['name = $1'];
          const values = [patientName];
          if (hospitalId) { values.push(hospitalId); conditions.push(`data->>'hospitalId' = $${values.length}`); }
          const result = await pool.query(`SELECT id FROM patients WHERE ${conditions.join(' AND ')} LIMIT 1`, values);
          if (result.rows.length > 0) rest.patientId = result.rows[0].id;
        } catch { /* the lookup failed -- patientId stays empty, the row is rejected later with a clear error instead of a wrong link */ }
      }
      const p = Number(price) || 0;
      const q = Number(qty) || 1;
      rest.items = [{ id: Date.now() + Math.floor(Math.random() * 1000), description: description || '', category: category || 'other', price: p, qty: q }];
      rest.total = p * q;
      rest.status = 'paid';
      rest.paidAt = rest.paidAt || new Date().toISOString();
      return rest;
    },
    template: [
      { header: 'اسم المريض', example: 'Test Patient CBC 1' },
      { header: 'الخدمة', example: 'كشفية طبيب اختصاص' },
      { header: 'الفئة', example: 'consultation' },
      { header: 'السعر', example: '25000' },
      { header: 'الكمية', example: '1' },
      { header: 'طريقة الدفع', example: 'cash' },
      { header: 'المرجع', example: 'INV-2026-0001' },
      { header: 'تاريخ الدفع', example: '2026-07-01' },
    ],
  });

  pgCrud(router, 'invoices', collectionSchemas.invoices, [
    { field: 'patientId', column: 'patient_id' },
    { field: 'status', column: 'status' },
    { field: 'total', column: 'total' },
  ], undefined, { hospitalScoped: true, permission: 'billing' });
  // Redis caching: employee (staff) data is read on many pages (salaries,
  // promotions, personal dossiers...) and changes rarely — the same logic as doctors above.
  // extraFilterFields: ['hospitalId'] -- same opt-in single-facility view for
  // a global admin as the patients registration above; the cache key below
  // already includes the full query string, so this doesn't need any cache
  // changes either.
  pgCrud(router, 'employees', collectionSchemas.employees, [
    { field: 'name', column: 'name' },
    { field: 'jobTitle', column: 'job_title' },
    { field: 'status', column: 'status' },
  ], undefined, { hospitalScoped: true, permission: 'hr', dateRangeField: 'hireDate', cache: { ttlSeconds: 300 }, extraFilterFields: ['hospitalId'] });
  pgCrud(router, 'retired', collectionSchemas.retired, [
    { field: 'name', column: 'name' },
    { field: 'jobTitle', column: 'job_title' },
  ], undefined, { hospitalScoped: true, permission: 'hr' });

  // The remaining modules: pure JSONB storage with no extra indexed
  // columns (see the schema comment in postgres_schema.sql for the
  // reason). The table name is always snake_case even if the module name
  // is camelCase in the frontend (e.g. medicalLeaves -> medical_leaves).
  // Facility-based filtering is now enabled on all of them (phase 4 of
  // multi-hospital support).
  pgCrud(router, 'departments', collectionSchemas.departments, [], undefined, { hospitalScoped: true, permission: 'departments', openRead: true });
  pgCrud(router, 'outgoing', collectionSchemas.outgoing, [], undefined, { hospitalScoped: true, permission: 'hr' });
  pgCrud(router, 'incoming', collectionSchemas.incoming, [], undefined, { hospitalScoped: true, permission: 'hr' });
  // ── Vaccinations (vaccinations) ─────────────────────────────────────────────────
  registerExcelImport(router, 'vaccinations', collectionSchemas.vaccinations, {
    'المريض': 'patient', 'اسم المريض': 'patient', 'Patient': 'patient',
    'اللقاح': 'vaccine', 'Vaccine': 'vaccine',
    'الجرعة': 'dose', 'Dose': 'dose',
    'تاريخ التطعيم': 'date', 'Date': 'date',
    'الموعد القادم': 'nextDate', 'Next Date': 'nextDate',
    'الحالة': 'status', 'Status': 'status',
    'المقدم': 'provider', 'Provider': 'provider',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'vaccinations',
    // status is now an actual real column in this table (promoted in
    // 004_promote_batch2.sql and registered in the pgCrud registration
    // below), but this Excel import route deliberately still stores it in
    // JSONB only here (not changed as part of this fix) — meaning records
    // imported from Excel keep the real status column empty even after
    // this later fix.
    indexedColumns: [],
    limiter: importLimiter,
    duplicateCheck: ['patient', 'vaccine', 'date'],
    afterParse: (row) => ({ ...row, status: row.status || 'completed' }),
    template: [
      { header: 'المريض', example: 'Test Patient CBC 1' },
      { header: 'اللقاح', example: 'MMR' },
      { header: 'الجرعة', example: 'الجرعة الأولى' },
      { header: 'تاريخ التطعيم', example: '2026-07-01' },
      { header: 'الحالة', example: 'completed' },
    ],
  });

  pgCrud(router, 'vaccinations', collectionSchemas.vaccinations, [{ field: 'status', column: 'status' }], undefined, { hospitalScoped: true, permission: 'vaccinations', extraFilterFields: ['status'] });
  pgCrud(router, 'medicalLeaves', collectionSchemas.medicalLeaves, [{ field: 'status', column: 'status' }], 'medical_leaves', { hospitalScoped: true, permission: 'medical-leave', extraFilterFields: ['status'] });
  pgCrud(router, 'dossiers', collectionSchemas.dossiers, [], undefined, { hospitalScoped: true, permission: 'hr' });
  pgCrud(router, 'labTests', collectionSchemas.labTests, [
    { field: 'status', column: 'status' },
    { field: 'priority', column: 'priority' },
  ], 'lab_tests', {
    hospitalScoped: true, permission: 'laboratory', extraFilterFields: ['status', 'priority', 'category'],
    // Added so LaboratoryPage.js can page through this table server-side
    // (20,000+ rows) instead of fetching everything — these match exactly
    // the fields its own search box and date-range filter already used
    // client-side, just evaluated on the server now.
    searchFields: ['patientName', 'reqNo', 'testType'],
    dateRangeField: 'requestDate',
  });
  pgCrud(router, 'radiology', collectionSchemas.radiology, [
    { field: 'status', column: 'status' },
    { field: 'modality', column: 'modality' },
  ], undefined, { hospitalScoped: true, permission: 'radiology', extraFilterFields: ['status', 'modality'] });
  pgCrud(router, 'pharmacyOrders', collectionSchemas.pharmacyOrders, [{ field: 'status', column: 'status' }], 'pharmacy_orders', { hospitalScoped: true, permission: 'pharmacy', extraFilterFields: ['status'] });
  pgCrud(router, 'assets', collectionSchemas.assets, [], undefined, { hospitalScoped: true, permission: 'assets', searchFields: ['assetNo'], extraFilterFields: ['category', 'status'] });
  // ── Fix: an actual maintenance log instead of overwriting the last maintenance date every time ──────────
  pgCrud(router, 'assetMaintenanceLog', collectionSchemas.assetMaintenanceLog, [
    { field: 'assetId', column: 'asset_id' },
  ], 'asset_maintenance_log', { hospitalScoped: true, permission: 'assets' });
  // Redis caching: the inventory list (includes medicines -- there's no
  // separate "medicines" module, medicines are inventory records with
  // category='medicine') is read constantly (pharmacy, prescriptions,
  // stock-out reports...). A shorter duration (3 minutes) than doctors/
  // employees because quantities (qty) may change at a higher frequency
  // (daily dispensing/receiving).
  pgCrud(router, 'inventory', collectionSchemas.inventory, [], undefined, { hospitalScoped: true, permission: 'inventory', searchFields: ['code'], extraFilterFields: ['category', 'status'], dateRangeField: 'expiry', cache: { ttlSeconds: 180 } });
  pgCrud(router, 'procurement', collectionSchemas.procurement, [{ field: 'status', column: 'status' }], undefined, { hospitalScoped: true, permission: 'procurement', extraFilterFields: ['status'] });
  pgCrud(router, 'projects', collectionSchemas.projects, [], undefined, { hospitalScoped: true, permission: 'projects', searchFields: ['code', 'manager', 'name'], extraFilterFields: ['status'] });
  pgCrud(router, 'documents', collectionSchemas.documents, [
    { field: 'type', column: 'type' },
    { field: 'status', column: 'status' },
    { field: 'priority', column: 'priority' },
  ], undefined, { hospitalScoped: true, permission: 'documents', extraFilterFields: ['type', 'status', 'priority'] });
  pgCrud(router, 'servicePrices', collectionSchemas.servicePrices, [{ field: 'category', column: 'category' }], 'service_prices', { hospitalScoped: true, permission: 'billing', extraFilterFields: ['category'] });
  pgCrud(router, 'transactions', collectionSchemas.transactions, [{ field: 'status', column: 'status' }], undefined, { hospitalScoped: true, permission: 'accounts' });
  // ── The unified promotions and allowances log (merging the former
  // promotions/allowances, see migrations-sql/014_merge_promotions_allowances.sql) ─────────────────
  pgCrud(router, 'promotionsAllowances', collectionSchemas.promotionsAllowances, [], 'promotions_allowances', { hospitalScoped: true, permission: 'accounts' });
  pgCrud(router, 'salaries', collectionSchemas.salaries, [], undefined, { hospitalScoped: true, permission: 'accounts' });
  pgCrud(router, 'ambulanceVehicles', collectionSchemas.ambulanceVehicles, [{ field: 'status', column: 'status' }], 'ambulance_vehicles', { hospitalScoped: true, permission: 'ambulance', extraFilterFields: ['status'] });
  // ── Fix: an actual maintenance log instead of overwriting the last maintenance date every time ──────────
  pgCrud(router, 'ambulanceMaintenanceLog', collectionSchemas.ambulanceMaintenanceLog, [
    { field: 'vehicleId', column: 'vehicle_id' },
  ], 'ambulance_maintenance_log', { hospitalScoped: true, permission: 'ambulance' });
  pgCrud(router, 'ambulanceMissions', collectionSchemas.ambulanceMissions, [{ field: 'status', column: 'status' }], 'ambulance_missions', { hospitalScoped: true, permission: 'ambulance', extraFilterFields: ['status'] });

  // Patient CRM — indexedColumns differ from the default name (name/phone/status)
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

  // ── Fix: quality management (ISO) — used to have no database connection at all ────────────
  // See middleware/schemas.js and database/postgres_schema.sql for the
  // full details of the fix. indexedColumns is deliberately empty (pure
  // JSONB) — the fields (auditNo, ncNo, status...) don't need fast search
  // at this module's natural data size (tens to hundreds of records as a
  // realistic maximum for a single hospital).
  pgCrud(router, 'qualityAudits', collectionSchemas.qualityAudits, [], 'quality_audits', { hospitalScoped: true, permission: 'quality' });
  pgCrud(router, 'qualityNCs', collectionSchemas.qualityNCs, [], 'quality_ncs', { hospitalScoped: true, permission: 'quality' });
  pgCrud(router, 'qualityKPIs', collectionSchemas.qualityKPIs, [], 'quality_kpis', { hospitalScoped: true, permission: 'quality' });

  // ── Wards (inpatient management) ──────────────────────────────────────
  pgCrud(router, 'wards', collectionSchemas.wards, [], undefined, { hospitalScoped: true, permission: 'wards' });
  pgCrud(router, 'admissions', collectionSchemas.admissions, [], undefined, { hospitalScoped: true, permission: 'wards' });
  // ── Wards: the daily medication log (medicationOrders) ─────────────────────────
  // ── Note: "admission id" (admissionId) is an internal numeric reference
  // (foreign key) to the admissions table -- the same constraint as
  // wardId/vehicleId above, it can't be resolved from a text patient name
  // via bulk import. It stays empty if the import column is left empty,
  // and the prescription must be linked to the admission manually from
  // the frontend (the 💊 button next to the patient) for the medication to
  // show up in the daily medication log and have its dose times
  // calculated. Dose times (scheduledTimes) are calculated here
  // automatically from "times per day" using the same computeScheduleTimes
  // algorithm used in the frontend (WardsPage.js) — an equal distribution
  // over 24 hours, first dose at 08:00.
  // ── The same wardId resolution approach as above: admissionId (a
  // numeric reference to an admission) is now actually resolved from
  // "patient name" + "admission date" by looking it up directly in the
  // admissions table — instead of staying empty and needing a manual link
  // for every record. The condition: the patient name and admission date
  // *exactly* match a real existing admission record (the same values
  // imported in the admissions_import.xlsx file).
  registerExcelImport(router, 'medicationOrders', collectionSchemas.medicationOrders, {
    'اسم المريض': 'patientName', 'Patient Name': 'patientName',
    'تاريخ الإدخال': 'admissionDate', 'Admission Date': 'admissionDate',
    'اسم الدواء': 'drugName', 'Drug Name': 'drugName',
    'الجرعة': 'dose', 'Dose': 'dose',
    'طريقة الإعطاء': 'route', 'Route': 'route',
    'عدد المرات باليوم': 'timesPerDay', 'Times Per Day': 'timesPerDay',
    'الطبيب الكاتب': 'prescribedBy', 'Prescribed By': 'prescribedBy',
    'تاريخ البدء': 'startDate', 'Start Date': 'startDate',
    'تاريخ الانتهاء': 'endDate', 'End Date': 'endDate',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'wards',
    tableName: 'medication_orders',
    // admission_id is now an actual real column in this table (promoted in
    // 004_promote_batch2.sql and registered in the pgCrud registration
    // below). The field name in the frontend/afterParse is admissionId
    // (camelCase, actually resolved above by looking it up in the
    // admissions table) while the actual column name is snake_case —
    // stored directly in the real column now.
    indexedColumns: [{ field: 'admissionId', column: 'admission_id' }],
    limiter: importLimiter,
    duplicateCheck: ['admissionId', 'drugName', 'startDate'],
    afterParse: async (row, hospitalId) => {
      const { patientName, admissionDate, ...rest } = row;
      if (patientName && admissionDate) {
        try {
          const conditions = [`data->>'patientName' = $1`, `data->>'admissionDate' = $2`];
          const values = [patientName, admissionDate];
          if (hospitalId) { values.push(hospitalId); conditions.push(`data->>'hospitalId' = $${values.length}`); }
          const result = await pool.query(`SELECT id FROM admissions WHERE ${conditions.join(' AND ')} LIMIT 1`, values);
          if (result.rows.length > 0) rest.admissionId = result.rows[0].id;
        } catch { /* فشل البحث — يبقى admissionId فارغاً بدل فشل الصف كاملاً */ }
      }
      const n = Math.max(1, Math.min(12, Number(rest.timesPerDay) || 1));
      const intervalMin = Math.floor((24 * 60) / n);
      const times = [];
      let mins = 8 * 60;
      for (let i = 0; i < n; i++) {
        const h = Math.floor((mins % (24 * 60)) / 60);
        const m = (mins % (24 * 60)) % 60;
        times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        mins += intervalMin;
      }
      const hours = Math.round((24 / n) * 10) / 10;
      return {
        ...rest,
        timesPerDay: n,
        scheduledTimes: times,
        frequency: `كل ${hours} ساعة`,
        route: rest.route || 'فموي',
      };
    },
    template: [
      { header: 'اسم المريض', example: 'Test Patient CBC 1' },
      { header: 'تاريخ الإدخال', example: '2026-07-01' },
      { header: 'اسم الدواء', example: 'أوغمنتين 1 غم' },
      { header: 'الجرعة', example: 'حبة واحدة' },
      { header: 'طريقة الإعطاء', example: 'فموي' },
      { header: 'عدد المرات باليوم', example: '2' },
      { header: 'الطبيب الكاتب', example: 'د. أحمد سالم' },
      { header: 'تاريخ البدء', example: '2026-07-01' },
    ],
  });

  pgCrud(router, 'medicationOrders', collectionSchemas.medicationOrders, [{ field: 'admissionId', column: 'admission_id' }], 'medication_orders', { hospitalScoped: true, permission: 'wards', extraFilterFields: ['admissionId'] });
  pgCrud(router, 'medicationAdministrations', collectionSchemas.medicationAdministrations, [], 'medication_administrations', { hospitalScoped: true, permission: 'wards', extraFilterFields: ['orderId'] });

  // ── Delivery ward ──────────────────────────────────────────────────────────
  pgCrud(router, 'deliveries', collectionSchemas.deliveries, [
    { field: 'stage', column: 'stage' },
    { field: 'babyStatus', column: 'baby_status' },
  ], undefined, { hospitalScoped: true, permission: 'delivery', extraFilterFields: ['stage', 'babyStatus'] });

  // ── Physical therapy ────────────────────────────────────────────────────────
  pgCrud(router, 'ptEquipment', collectionSchemas.ptEquipment, [{ field: 'status', column: 'status' }], 'pt_equipment', { hospitalScoped: true, permission: 'physiotherapy', extraFilterFields: ['status'] });
  pgCrud(router, 'ptSessions', collectionSchemas.ptSessions, [
    { field: 'status', column: 'status' },
    { field: 'date', column: 'date' },
  ], 'pt_sessions', { hospitalScoped: true, permission: 'physiotherapy', extraFilterFields: ['status', 'date'] });

  // ── Queue management ─────────────────────────────────────────────────────────
  // ── Queue management (queueTickets) ─────────────────────────────────────────────
  // ── Note: in normal use, the ticket number (ticketNo) is a daily
  // sequence per department (calculated in the frontend when a new ticket
  // is issued). We don't have the same context here (how many tickets
  // have actually been issued today for this department), so we accept it
  // optionally from an Excel column, and if left empty we generate an
  // approximate number with no guaranteed sequence — this module is
  // inherently daily/temporary by nature, so bulk import is suited to
  // test data or historical tickets, not the usual daily operational use.
  registerExcelImport(router, 'queueTickets', collectionSchemas.queueTickets, {
    'اسم المريض': 'patientName', 'Patient Name': 'patientName',
    'القسم': 'department', 'Department': 'department',
    'الأولوية': 'priority', 'Priority': 'priority',
    'رقم التذكرة': 'ticketNo', 'Ticket No': 'ticketNo',
    'الحالة': 'status', 'Status': 'status',
    'وقت الإصدار': 'createdAt', 'Created At': 'createdAt',
    'من نادى': 'calledBy', 'Called By': 'calledBy',
    'ملاحظات': 'notes', 'Notes': 'notes',
  }, {
    hospitalScoped: true, permission: 'queue',
    tableName: 'queue_tickets',
    // department/status are now actual real columns in this table
    // (promoted in 004_promote_batch2.sql and registered in the pgCrud
    // registration below) — stored directly in the real columns now.
    // Note: the public /queue-display route in server.js already reads
    // these two real columns directly (not JSONB), so it used to show
    // stale values for any ticket updated (called/served) after it was
    // created — this fix makes status updates actually reach that column
    // from now on.
    indexedColumns: [
      { field: 'department', column: 'department' },
      { field: 'status', column: 'status' },
    ],
    limiter: importLimiter,
    duplicateCheck: ['patientName', 'department', 'createdAt'],
    // ── Fix: calledAt/servedAt used to always be zeroed out regardless of
    // status -- an imported ticket with "served" status used to be saved
    // with no actual receipt time, which is a logical contradiction (a
    // "completed" service with no completion time). Now they're
    // calculated chronologically after the issue time, with a reasonable
    // offset depending on the status.
    afterParse: (row) => {
      const created = row.createdAt ? new Date(row.createdAt) : new Date();
      const status = row.status || 'waiting';
      let calledAt = null, servedAt = null;
      if (status === 'called' || status === 'served' || status === 'noshow') {
        calledAt = new Date(created.getTime() + 5 * 60000).toISOString();
      }
      if (status === 'served') {
        servedAt = new Date(created.getTime() + 15 * 60000).toISOString();
      }
      return {
        ...row,
        priority: row.priority || 'normal',
        status,
        ticketNo: row.ticketNo ? Number(row.ticketNo) : Math.floor(Math.random() * 9000) + 1000,
        createdAt: created.toISOString(),
        calledAt, servedAt,
        calledBy: row.calledBy || null,
      };
    },
    template: [
      { header: 'اسم المريض', example: 'Test Patient CBC 1' },
      { header: 'القسم', example: 'المختبر' },
      { header: 'الأولوية', example: 'normal' },
    ],
  });

  pgCrud(router, 'queueTickets', collectionSchemas.queueTickets, [
    { field: 'department', column: 'department' },
    { field: 'status', column: 'status' },
  ], 'queue_tickets', { hospitalScoped: true, permission: 'queue', extraFilterFields: ['department', 'status'] });

};

module.exports = registerAllModules;

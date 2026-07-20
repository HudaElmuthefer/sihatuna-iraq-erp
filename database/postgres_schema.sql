-- ============================================================================
-- SIHATUNA IRAQ ERP — PostgreSQL Schema
-- يغطي: الهيكل الأساسي (مختصر) + نظام الدفع القابل للتهيئة + CRM المرضى الشامل
-- ملاحظة: هذا Schema إضافي/ترقية. الجداول الأساسية (patients, users, ...) موجودة
-- بشكل مختصر هنا لضمان الترابط (Foreign Keys) — عدّل الأعمدة لتطابق حقولك الفعلية
-- بعد قراءة ملفات JSON الحالية.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1) المستشفيات / المنشآت (Multi-tenant — كل نسخة منصبة على مستشفى معين)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospitals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_ar         VARCHAR(200) NOT NULL,
    name_en         VARCHAR(200) NOT NULL,
    address         TEXT,
    phone           VARCHAR(50),
    is_active       BOOLEAN DEFAULT TRUE,
    -- قائمة مفاتيح الصفحات المفعّلة لهذه المنشأة تحديداً (مثل ['patients',
    -- 'doctors','appointments']). NULL أو مصفوفة فارغة = كل الصفحات مفعّلة
    -- (سلوك افتراضي متوافق تماماً مع أي منشأة موجودة مسبقاً، ولا يكسر شيء).
    enabled_pages   JSONB,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 1ب) إعدادات النظام العامة (مفتاح/قيمة) — أول استخدام: تفعيل نظام المنشآت
-- المتعددة. تصميم مستقبلي: نشر مركزي واحد (مثلاً بسيرفر مديرية صحة) يخدم
-- عدة مستشفيات تابعة، كل واحدة تشوف بياناتها الخاصة بمعزل عن الباقي.
-- المرحلة الحالية أساس بسيط فقط (مفتاح تشغيل + جدول مستشفيات + ربط المرضى
-- بمستشفى)، بدون فلترة فعلية شاملة لكل الموديولات بعد — هذا يأتي بمرحلة لاحقة
-- منفصلة بعد وضوح المتطلبات الفعلية من الجهة المستفيدة.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           JSONB NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT now()
);
INSERT INTO system_settings (key, value) VALUES ('multi_hospital_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2) المستخدمين (مختصر — طابقه مع نظامك الحالي لو عندك جدول users فعلي)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id     UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    full_name       VARCHAR(200) NOT NULL,
    email           VARCHAR(200) UNIQUE,
    role            VARCHAR(50) NOT NULL DEFAULT 'staff', -- admin | staff | doctor | accountant
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3) المرضى
-- ----------------------------------------------------------------------------
-- ملاحظة تصميم مهمة: نستخدم هنا معرّفاً رقمياً بسيطاً (SERIAL) بدل UUID،
-- ليطابق النمط الحالي المستخدم بباقي النظام (db.json) ويسهّل ترحيل البيانات
-- الحالية دون تغيير أي معرّف موجود مسبقاً بالواجهة.
-- عمود "data" (JSONB) يخزّن كامل بيانات المريض كما ترسلها الواجهة تماماً —
-- هذا يتجنّب مشكلة حقيقية واجهناها سابقاً: أي افتراض خاطئ بأسماء الأعمدة
-- (كما حصل بمخطط تحقق المواعيد) يرفض عمليات الحفظ بصمت. بتخزين البيانات
-- كاملة كـJSONB، أي حقل تضيفه الواجهة مستقبلاً (حتى لو لم نعرف باسمه بعد)
-- يُخزَّن ويُسترجَع بشكل صحيح دون أي حاجة لتعديل بنية الجدول لاحقاً.
-- الأعمدة الصريحة (name, phone, status) موجودة فقط للفهرسة والبحث السريع.
CREATE TABLE IF NOT EXISTS patients (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    phone           VARCHAR(50) NOT NULL,
    status          VARCHAR(30) DEFAULT 'active',
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);

-- ----------------------------------------------------------------------------
-- 3ب) الأطباء (بنفس نمط جدول المرضى تماماً: معرّف رقمي بسيط + تخزين مرن)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctors (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    phone           VARCHAR(50) NOT NULL,
    status          VARCHAR(30) DEFAULT 'active',
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doctors_phone ON doctors(phone);
CREATE INDEX IF NOT EXISTS idx_doctors_status ON doctors(status);

-- ----------------------------------------------------------------------------
-- 3ج) المواعيد
-- ----------------------------------------------------------------------------
-- ملاحظة مهمة: الصفحة الفعلية (AppointmentsPage.js) تخزّن اسم المريض والطبيب
-- كنص مباشر بالحقلين "patient" و"doctor" (وليس معرّفاً رقمياً)، وهذا بالضبط
-- ما اعتمدناه هنا كأعمدة صريحة لتفادي تكرار خطأ سابق واجهناه (افتراض خاطئ
-- بأسماء الأعمدة رفض كل عمليات الحفظ بصمت).
CREATE TABLE IF NOT EXISTS appointments (
    id              SERIAL PRIMARY KEY,
    patient         VARCHAR(200) NOT NULL,
    doctor          VARCHAR(200) NOT NULL,
    date            DATE NOT NULL,
    status          VARCHAR(30) DEFAULT 'pending',
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- ----------------------------------------------------------------------------
-- 3د) الموظفين
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    job_title       VARCHAR(200),
    status          VARCHAR(30) DEFAULT 'active',
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- ----------------------------------------------------------------------------
-- 3هـ) المتقاعدين
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retired (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    job_title       VARCHAR(200),
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);


-- ----------------------------------------------------------------------------
-- 3و) باقي الموديولات (تخزين JSONB بحت — بدون أعمدة فهرسة إضافية)
-- ----------------------------------------------------------------------------
-- هذي الموديولات لا تحتاج فلترة أو بحث بجانب الخادم حالياً (الفرونت إند يجلب
-- القائمة كاملة ويُفلتر بجافاسكربت محلياً)، فاكتفينا بتخزين كامل السجل داخل
-- عمود data مباشرة. هذا يجنّبنا خطر تكرار خطأ افتراض أسماء أعمدة غير مطابقة
-- (كما حصل سابقاً بمخطط تحقق المواعيد) عبر 21 صفحة مختلفة دفعة واحدة.

CREATE TABLE IF NOT EXISTS departments (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outgoing (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incoming (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vaccinations (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medical_leaves (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dossiers (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lab_tests (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS radiology (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pharmacy_orders (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procurement (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_prices (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promotions (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS allowances (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salaries (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ambulance_vehicles (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── إصلاح: صفحة إدارة الجودة (ISO) كانت بدون أي جدول حقيقي إطلاقاً ──────────
-- كانت البيانات (مراجعات، حالات عدم مطابقة، مؤشرات أداء) تُخزَّن بذاكرة
-- المتصفح المؤقتة بس (React state محلي) — تُفقَد بمجرد تحديث الصفحة، وترجع
-- لنفس البيانات التجريبية الثابتة بالكود كل مرة. الجداول الثلاثة تحت تحل هذا.
CREATE TABLE IF NOT EXISTS quality_audits (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quality_ncs (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quality_kpis (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── إصلاح: سجل صيانة حقيقي للمركبات والأصول (بدل الكتابة فوق تاريخ آخر صيانة) ──
CREATE TABLE IF NOT EXISTS asset_maintenance_log (
    id              SERIAL PRIMARY KEY,
    asset_id        INTEGER,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_log_asset_id ON asset_maintenance_log(asset_id);

CREATE TABLE IF NOT EXISTS ambulance_maintenance_log (
    id              SERIAL PRIMARY KEY,
    vehicle_id      INTEGER,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ambulance_maintenance_log_vehicle_id ON ambulance_maintenance_log(vehicle_id);

CREATE TABLE IF NOT EXISTS ambulance_missions (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4) الفواتير
-- ----------------------------------------------------------------------------
-- بنفس نمط المرضى والأطباء والمواعيد: معرّف رقمي بسيط + تخزين مرن (JSONB).
-- الصفحة الفعلية (BillingPage.js / AppContext.js) ترسل: patientId, items
-- (قائمة كاملة مضمَّنة بالفاتورة نفسها، وليست بجدول منفصل)، status، total،
-- paymentMethod، createdAt، paidAt، referenceCode.
CREATE TABLE IF NOT EXISTS invoices (
    id              SERIAL PRIMARY KEY,
    patient_id      INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    status          VARCHAR(30) DEFAULT 'unpaid',
    total           NUMERIC(14,2) DEFAULT 0,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- جدول تفصيلي اختياري لبنود الفاتورة (غير مستخدَم حالياً من الواجهة —
-- البنود مضمَّنة داخل عمود "data" بجدول invoices مباشرة، وهذا الجدول محفوظ
-- لتقارير مالية تفصيلية مستقبلية إن احتجناها)
CREATE TABLE IF NOT EXISTS invoice_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id      INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    description_ar  VARCHAR(300),
    description_en  VARCHAR(300),
    quantity        NUMERIC(10,2) DEFAULT 1,
    unit_price      NUMERIC(14,2) NOT NULL,
    line_total      NUMERIC(14,2) NOT NULL
);

-- ============================================================================
-- 5) نظام الدفع القابل للتهيئة من الإدمن (Payment Gateway Configuration)
-- ============================================================================

-- الأنواع المدعومة كمرجع (يمكن توسيعها بإضافة صف جديد فقط، بدون تعديل كود)
CREATE TABLE IF NOT EXISTS payment_providers (
    code            VARCHAR(50) PRIMARY KEY,   -- 'cash','zaincash','fastpay','qicard','bank_card','paypal','western_union'
    name_ar         VARCHAR(100) NOT NULL,
    name_en         VARCHAR(100) NOT NULL,
    provider_type   VARCHAR(20) NOT NULL,      -- 'cash' | 'local_card' | 'international'
    requires_credentials BOOLEAN DEFAULT TRUE
);

INSERT INTO payment_providers (code, name_ar, name_en, provider_type, requires_credentials) VALUES
('cash',           'دفع نقدي',              'Cash',             'cash',          FALSE),
('zaincash',       'زين كاش',               'ZainCash',         'local_card',    TRUE),
('fastpay',        'فاست باي',              'FastPay',          'local_card',    TRUE),
('qicard',         'كي كارد',               'Qi Card',          'local_card',    TRUE),
('bank_card',      'بطاقة مصرفية محلية',    'Local Bank Card',  'local_card',    TRUE),
('paypal',         'باي بال',               'PayPal',           'international', TRUE),
('western_union',  'ويسترن يونيون',         'Western Union',    'international', TRUE)
ON CONFLICT (code) DO NOTHING;

-- إعدادات كل مستشفى: الإدمن يفعّل بوابة أو أكثر ويدخل بياناتها
-- الحقول الحساسة (مفاتيح API) تُخزّن مشفّرة (pgcrypto) وليست نص صريح
CREATE TABLE IF NOT EXISTS hospital_payment_gateways (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id         UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    provider_code       VARCHAR(50) NOT NULL REFERENCES payment_providers(code),
    is_active           BOOLEAN DEFAULT TRUE,
    is_sandbox           BOOLEAN DEFAULT TRUE,     -- وضع تجريبي أو حقيقي
    display_order       INT DEFAULT 0,
    credentials_encrypted BYTEA,                    -- JSON مشفر: {api_key, api_secret, merchant_id, ...}
    extra_config         JSONB DEFAULT '{}'::jsonb,  -- إعدادات غير حساسة (رابط webhook، عملة افتراضية...)
    created_by           UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now(),
    UNIQUE (hospital_id, provider_code)
);

-- سجل عمليات الدفع الفعلية
CREATE TABLE IF NOT EXISTS payments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id         UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    invoice_id          INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    patient_id          INTEGER REFERENCES patients(id) ON DELETE SET NULL,
    provider_code       VARCHAR(50) REFERENCES payment_providers(code),
    amount               NUMERIC(14,2) NOT NULL,
    currency             VARCHAR(10) NOT NULL DEFAULT 'IQD',
    status                VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending|completed|failed|refunded
    gateway_transaction_id VARCHAR(150),   -- الرقم المرجعي من البوابة (أو يدوي لـ WU/Cash)
    reference_note        TEXT,             -- لملاحظات الدفع اليدوي (مثلاً رقم تحويل Western Union)
    processed_by           UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ============================================================================
-- 6) CRM المرضى — شامل (تواصل + متابعات + حملات توعية)
-- ============================================================================
-- بنفس نمط JSONB المرن المعتمد بكل الموديولات الأخرى (انظر تعليق جدول
-- patients أعلاه للشرح الكامل). معرّف المريض (patient_id) و معرّف الحملة
-- (campaign_id) أعمدة صريحة لأنها روابط فعلية (Foreign Keys) بجداول أخرى،
-- بينما باقي الحقول (نوع المتابعة، القناة، نص الرسالة، إلخ) تُخزَّن كاملة
-- بعمود data مباشرة لتفادي أي تعارض بأسماء أعمدة غير مطابقة للواجهة الفعلية.

CREATE TABLE IF NOT EXISTS crm_interactions (
    id              SERIAL PRIMARY KEY,
    patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_patient ON crm_interactions(patient_id);

CREATE TABLE IF NOT EXISTS crm_patient_segments (
    id              SERIAL PRIMARY KEY,
    patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    segment_code    VARCHAR(50) NOT NULL,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (patient_id, segment_code)
);

CREATE TABLE IF NOT EXISTS crm_follow_ups (
    id              SERIAL PRIMARY KEY,
    patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_followups_status ON crm_follow_ups(status);

CREATE TABLE IF NOT EXISTS crm_campaigns (
    id              SERIAL PRIMARY KEY,
    status          VARCHAR(20) DEFAULT 'draft',
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_campaign_targets (
    id              SERIAL PRIMARY KEY,
    campaign_id     INTEGER NOT NULL REFERENCES crm_campaigns(id) ON DELETE CASCADE,
    patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (campaign_id, patient_id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign ON crm_campaign_targets(campaign_id);

-- ── سلة المحذوفات (Recycle Bin) ─────────────────────────────────────────────
-- جدول واحد مشترك لكل الموديولات: بدل حذف السجل نهائياً من جدوله الأصلي،
-- pgCrud.js ينقله هنا كاملاً (module_key يحدد أي موديول، original_id رقمه
-- الأصلي، data نسخة كاملة مطابقة تماماً لما كانت تعرضه الواجهة). لا يظهر
-- بقوائم الموديول الأصلي بعد الآن (فعلياً محذوف من جدوله)، لكن يبقى قابلاً
-- للاسترجاع أو الحذف النهائي من صفحة الإعدادات (صلاحية إدمن فقط).
CREATE TABLE IF NOT EXISTS recycle_bin (
    id              SERIAL PRIMARY KEY,
    module_key      VARCHAR(100) NOT NULL,
    original_id     INTEGER NOT NULL,
    data            JSONB NOT NULL,
    hospital_id     TEXT,
    deleted_by      INTEGER,
    deleted_by_name VARCHAR(200),
    deleted_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recycle_bin_module ON recycle_bin(module_key);
CREATE INDEX IF NOT EXISTS idx_recycle_bin_hospital ON recycle_bin(hospital_id);

-- ── الردهات (إدارة المرضى الداخليين) ────────────────────────────────────────
-- wards: الردهات نفسها (اسم، سعة أسرّة)
CREATE TABLE IF NOT EXISTS wards (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- admissions: كل عملية إدخال مريض لردهة (سرير، تشخيص، الطبيب المعالج، الحالة، الخروج)
CREATE TABLE IF NOT EXISTS admissions (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- medication_orders: الأدوية اللي يكتبها الطبيب لكل حالة إدخال (اسم الدواء،
-- الجرعة، التكرار، الطبيب الكاتب، تاريخ البدء/الانتهاء)
CREATE TABLE IF NOT EXISTS medication_orders (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- medication_administrations: سجل كل مرة أُعطي فيها الدواء فعلياً (الممرض،
-- الوقت، تأكيد الإعطاء) — سجل منفصل عن الوصفة نفسها لأن دواء واحد يُعطى
-- عدة مرات (مثلاً 3 مرات باليوم لمدة أسبوع = عدة سجلات إعطاء لنفس الوصفة)
CREATE TABLE IF NOT EXISTS medication_administrations (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── صالة الولادة ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliveries (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── العلاج الطبيعي ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pt_equipment (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pt_sessions (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── إدارة الطابور ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queue_tickets (
    id              SERIAL PRIMARY KEY,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);


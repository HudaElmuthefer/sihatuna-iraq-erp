-- إصلاح ناتج مباشرة عن ترحيل المستخدمين لـPostgreSQL (راجع
-- migrations-sql/016_users_real_columns.sql): معرّف المستخدم صار UUID (بدل
-- رقم تسلسلي)، لكن recycle_bin.deleted_by بقي INTEGER — أي عملية حذف (تنقل
-- السجل لسلة المحذوفات أولاً، راجع routes/pgCrud.js) كانت ستفشل بخطأ
-- "invalid input syntax for type integer" لأنها تحاول إدخال UUID بعمود
-- INTEGER. عمودا hospital_payment_gateways.created_by وpayments.processed_by
-- كانا مصمَّمين UUID REFERENCES users(id) من البداية (توقّعاً لهذا الترحيل)؛
-- هذا العمود الوحيد المتبقي بالنوع القديم.
-- إصلاح: هذا الترحيل لم يكن متوافقاً مع التشغيل على قاعدة بيانات جديدة بالكامل —
-- postgres_schema.sql يُعرِّف عمود recycle_bin.deleted_by بنوع UUID مع المفتاح
-- الخارجي نفسه مباشرة منذ الإنشاء، فمحاولة هذا الترحيل إضافة المفتاح الخارجي
-- ذاته مجدداً كانت تفشل بخطأ "القيد موجود مسبقاً". الإصلاح أدناه يتحقق أولاً:
-- يُطبَّق تغيير نوع العمود فقط إذا كان لا يزال INTEGER (القواعد القديمة التي
-- أُنشئت قبل هذا الترحيل)، ويُضاف المفتاح الخارجي فقط إذا لم يكن موجوداً أصلاً —
-- فيعمل هذا الملف بأمان سواء على قاعدة قديمة تحتاج الترحيل فعلياً، أو على قاعدة
-- جديدة ورثت الشكل الصحيح مباشرة من postgres_schema.sql.
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'recycle_bin' AND column_name = 'deleted_by') = 'integer' THEN
        ALTER TABLE recycle_bin
            ALTER COLUMN deleted_by TYPE UUID USING NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'recycle_bin_deleted_by_fkey'
    ) THEN
        ALTER TABLE recycle_bin
            ADD CONSTRAINT recycle_bin_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

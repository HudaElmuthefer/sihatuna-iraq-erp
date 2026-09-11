-- إصلاح ناتج مباشرة عن ترحيل المستخدمين لـPostgreSQL (راجع
-- migrations-sql/016_users_real_columns.sql): معرّف المستخدم صار UUID (بدل
-- رقم تسلسلي)، لكن recycle_bin.deleted_by بقي INTEGER — أي عملية حذف (تنقل
-- السجل لسلة المحذوفات أولاً، راجع routes/pgCrud.js) كانت ستفشل بخطأ
-- "invalid input syntax for type integer" لأنها تحاول إدخال UUID بعمود
-- INTEGER. عمودا hospital_payment_gateways.created_by وpayments.processed_by
-- كانا مصمَّمين UUID REFERENCES users(id) من البداية (توقّعاً لهذا الترحيل)؛
-- هذا العمود الوحيد المتبقي بالنوع القديم.
ALTER TABLE recycle_bin
    ALTER COLUMN deleted_by TYPE UUID USING NULL;

ALTER TABLE recycle_bin
    ADD CONSTRAINT recycle_bin_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;

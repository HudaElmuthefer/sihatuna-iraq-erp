# db.json — مؤرشف بعد ترحيل المستخدمين إلى PostgreSQL

كان هذا الملف مصدر الحقيقة الوحيد لحسابات المستخدمين (تسجيل الدخول،
الصلاحيات، الأدوار، ربط المستشفى) عبر `backend/utils/db.js`
(`readDB`/`writeDB`) — بلا أي قيود فعلية بجانب قاعدة البيانات (لا تفرّد
اسم المستخدم، لا مفاتيح خارجية، عرضة لتلف الملف أو تضارب الكتابة المتزامنة
بين عمليات worker متعددة بـPM2 cluster mode).

رُحِّلت كل بياناته (5 حسابات حقيقية: admin، doctor، nurse، accountant،
adminhosp) إلى جدول `users` الحقيقي بـPostgreSQL عبر
`backend/scripts/migrateUsersFromJson.js` (تجزئة كلمة المرور bcrypt محفوظة
حرفياً، بلا أي إعادة تشفير أو تصفير). راجع
`backend/migrations-sql/016_users_real_columns.sql` للأعمدة المُضافة،
و`backend/routes/authRoutes.js`/`backend/routes/usersRoutes.js` للمسارات
المُعاد كتابتها بالكامل لتستعلم من PostgreSQL مباشرة بدل هذا الملف.

`backend/utils/db.js` نفسه حُذف — لا شيء يستورده بعد الآن. هذا الملف
محفوظ هنا فقط للتاريخ/الرجوع، وليس جزءاً من مسار عمل التطبيق الفعلي.

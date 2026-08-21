# تشغيل SIHATUNA IRAQ ERP عبر Docker

هذا الدليل يخص **المرحلة الثالثة** (containerization) — تشغيل النظام كاملاً
(الباك إند + عامل قراءة الفواتير بالذكاء الاصطناعي + نسخة إنتاج من
الفرونت إند + PostgreSQL + Redis) عبر Docker Compose، بدل التثبيت المباشر
على الجهاز (`start.bat`).

## البنية

ثلاث خدمات بالضبط (`docker-compose.yml`):

| الخدمة | الوصف | المنافذ |
|---|---|---|
| `app` | حاوية واحدة تشغّل PM2 داخلياً — الباك إند بـcluster mode، عامل BullMQ (`sihatuna-worker`)، وخادم ملفات ثابتة للفرونت إند المبني | 8000 (API)، 3000 (الواجهة)، 2575 (HL7) |
| `postgres` | الصورة الرسمية `postgres:18` | 5432 |
| `redis` | الصورة الرسمية `redis:7-alpine` (AOF مفعَّل) | 6379 |

**حاوية تطبيق واحدة، لا نسخ متعددة (replicas)** — قرار مقصود، مطابق تماماً
لبنية PM2 cluster mode المستخدَمة أصلاً بالنشر المحلي، معبّأة بحاوية واحدة
بدل التثبيت المباشر.

## المتطلبات

- Docker + Docker Compose (Docker Desktop على ويندوز/ماك، أو `docker` +
  `docker compose` plugin على لينكس)

## الإعداد (مرة واحدة)

```bash
cp .env.docker.example .env
```

عبّي القيم الحقيقية بملف `.env` الجديد (بجذر المشروع، بجانب
`docker-compose.yml`) — التفاصيل الكاملة لكل متغيّر موجودة كتعليقات داخل
`.env.docker.example` نفسه. المطلوبان فعلياً (الخادم يرفض التشغيل بدونهما):
`PG_PASSWORD`، `JWT_SECRET`، `CREDENTIALS_ENCRYPTION_KEY`.

> **ملاحظة مهمة**: هذا الملف (`.env` بجذر المشروع) منفصل تماماً عن
> `backend/.env` (المستخدَم بالنشر المحلي عبر `start.bat`) — لا يتشاركان
> أي قيمة تلقائياً. لا تلتزمي (commit) بملف `.env` الحقيقي لـ git أبداً —
> فقط القالب `.env.docker.example` مُتتبَّع.

## التشغيل

```bash
docker compose up -d
```

أول تشغيل يبني صورة `app` (يشمل بناء الفرونت إند كاملاً بمرحلة منفصلة —
قد يأخذ بضع دقائق)، وينشئ قاعدة بيانات PostgreSQL فارغة ويطبّق عليها
`database/postgres_schema.sql` تلقائياً، ثم يطبّق أي ترحيل SQL إضافي
(`backend/migrations-sql/*.sql`) لم يكن مشمولاً بذاك الملف — كل هذا يحصل
تلقائياً، لا خطوة يدوية.

بعد اكتمال الإقلاع (`docker compose ps` يُظهر `app` بحالة `healthy`):
- الواجهة: http://localhost:3000
- الـ API مباشرة: http://localhost:8000/api/health

## عرض السجلات (logs)

```bash
docker compose logs -f app          # كل عمليات PM2 الثلاث داخل حاوية app معاً
docker compose logs -f postgres
docker compose logs -f redis
```

لعرض سجل عملية PM2 محدَّدة *داخل* حاوية app وحدها (الباك إند فقط، أو
العامل فقط، بدل الاثنين مدموجين):

```bash
docker compose exec app pm2 logs sihatuna-backend --lines 50
docker compose exec app pm2 logs sihatuna-worker --lines 50
docker compose exec app pm2 logs sihatuna-frontend --lines 50
```

## تشغيل أوامر لمرة واحدة داخل حاوية app

```bash
# إعادة تشغيل الترحيلات يدوياً (تحصل تلقائياً بكل إقلاع أصلاً، لكن مفيدة
# للتشخيص أو للتأكد الفوري بدون إعادة تشغيل الحاوية كاملة)
docker compose exec app sh -c "cd backend && node run-migrations.js"

# فتح shell تفاعلي داخل الحاوية
docker compose exec app sh

# حالة عمليات PM2 الثلاث
docker compose exec app pm2 status

# إعادة تشغيل عملية واحدة فقط بدون إعادة تشغيل الحاوية كاملة
docker compose exec app pm2 restart sihatuna-backend
```

## الإيقاف

```bash
docker compose stop        # يوقف الحاويات، يبقي البيانات (volumes) كما هي
docker compose down        # يحذف الحاويات أيضاً، البيانات تبقى (volumes منفصلة)
docker compose down -v     # ⚠️ يحذف كل شيء بما فيها البيانات الدائمة — لا تستخدميه إلا لو تريدين البدء من الصفر فعلاً
```

## البيانات الدائمة (volumes)

| الحجم | المحتوى |
|---|---|
| `postgres_data` | قاعدة بيانات PostgreSQL كاملة |
| `redis_data` | كاش + طابور BullMQ (AOF) |
| `backend_data` | `db.json` (حسابات المستخدمين — لم تنتقل بعد بالكامل لـPostgreSQL)، سجل التدقيق، وملفات تشغيلية أخرى |
| `backend_uploads` | مستندات مرفوعة (وثائق موظفين، مرفقات طبية...) |
| `backend_backups` | نسخ النظام الاحتياطية التلقائية |
| `backend_logs` | سجلات PM2 |

بدون `backend_data` تحديداً، أي إعادة تشغيل للحاوية كانت سترجع `db.json`
لحالته الافتراضية بصورة البناء (تمسح أي مستخدم أو تعديل حقيقي أُضيف
لاحقاً) — هذا اكتُشف صراحة أثناء إعداد هذا الملف، وليس افتراضاً.

## هل تشغّل الاختبارات داخل الحاوية؟ (لا، وهذا مقصود)

صورة الإنتاج تُبنى بـ`npm ci --omit=dev` — يعني `jest`/`nodemon`/`supertest`/
`ioredis-mock` (كل تبعيات الاختبار) **غير مثبَّتة إطلاقاً** بالصورة النهائية.
حتى لو حاول أحد تشغيل `npm test` داخل حاوية app، الأمر يفشل فوراً (الحزمة
غير موجودة). هذا يعني عزل `TEST_REDIS_URL`/`PG_DATABASE` بملف
`backend/tests/testUtils.js` (المرحلة الثانية) يبقى منطقياً تماماً بدون أي
تعديل: تلك الآلية تخدم فقط تشغيل الاختبارات محلياً (`npm test` على جهاز
المطوّرة) أو بـCI (`.github/workflows/test.yml`، بيئة منفصلة كاملة بحزمها
الخاصة) — لا علاقة لها بصورة الإنتاج المبنية هنا إطلاقاً، ولا حاجة لأي
تغيير عليها بسبب Docker.

## هل `start.bat`/`stop.bat` أصبحا قديمين (obsolete)؟

**لا — يبقيان طريقة تشغيل صالحة ومستقلة، ولم يُعدَّلا بهذي المرحلة.**

التوصية: اعتبري Docker (`docker compose up -d`) الطريقة **الموصى بها** لأي
نشر جديد أو نشر على سيرفر حقيقي (نتائج متطابقة بأي جهاز، عزل كامل عن
تعارضات البرامج المثبَّتة محلياً، سهولة نسخ نفس الإعداد لسيرفر آخر). أما
`start.bat`/`stop.bat` فتبقيان **البديل الاحتياطي المحلي** — مفيدتان
تحديداً لو:
- الجهاز لا يدعم Docker (موارد ضعيفة، أو قيود شبكة/صلاحيات مؤسسية تمنع
  تثبيته)
- تريدين تجربة/تطوير سريعاً بدون بناء صورة Docker كاملة بكل تعديل بسيط
  (خادم React التطويري بـ`start.bat` يعيد التحميل حياً فوراً — تجربة تطوير
  أسرع بكثير من إعادة بناء صورة Docker في كل مرة)

الاثنان يستخدمان `ecosystem.config.js` نفسه للباك إند/العامل (لم يُعدَّل
إطلاقاً بهذي المرحلة) — الفرق الوحيد هو طريقة خدمة الفرونت إند (خادم
React التطويري محلياً مقابل نسخة إنتاج ثابتة بـDocker، راجعي
`ecosystem.docker.config.js`) وموقع PostgreSQL/Redis (مثبَّتان مباشرة على
الجهاز محلياً، مقابل حاويتين منفصلتين بـDocker).

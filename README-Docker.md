# تشغيل SIHATUNA IRAQ ERP عبر Docker

هذا الدليل يخص **المرحلة الثالثة** (containerization) **+ المرحلة الرابعة**
(Nginx كـreverse proxy) — تشغيل النظام كاملاً (الباك إند + عامل قراءة
الفواتير بالذكاء الاصطناعي + نسخة إنتاج من الفرونت إند + PostgreSQL +
Redis + Nginx) عبر Docker Compose، بدل التثبيت المباشر على الجهاز
(`start.bat`).

## البنية

أربع خدمات بالضبط (`docker-compose.yml`):

| الخدمة | الوصف | المنافذ المكشوفة على الجهاز المضيف |
|---|---|---|
| `nginx` | نقطة الدخول الوحيدة — يقدّم الفرونت إند مباشرة، يوجّه `/api` و`/uploads` لـ`app` داخلياً (راجعي `nginx/nginx.conf`) | **80** |
| `app` | حاوية واحدة تشغّل PM2 داخلياً — الباك إند بـcluster mode، عامل BullMQ (`sihatuna-worker`) | 2575 (HL7 فقط — بروتوكول TCP خام لأجهزة مختبر فعلية، لا يمرّ عبر Nginx) |
| `postgres` | الصورة الرسمية `postgres:18` | لا شيء — داخلي فقط |
| `redis` | الصورة الرسمية `redis:7-alpine` (AOF مفعَّل) | لا شيء — داخلي فقط |

**حاوية تطبيق واحدة، لا نسخ متعددة (replicas)** — قرار مقصود، مطابق تماماً
لبنية PM2 cluster mode المستخدَمة أصلاً بالنشر المحلي، معبّأة بحاوية واحدة
بدل التثبيت المباشر. Nginx هنا ليس لموازنة حمل بين نسخ متعددة (ما فيه
أصلاً) — فقط يقدّم الفرونت إند بكفاءة (أسرع من خادم Express لملفات ثابتة)،
ويعزل `app`/`postgres`/`redis` تماماً عن الجهاز المضيف (تحسين أمني حقيقي —
لا "ports:" عليهم بعد الآن). HTTP فقط حالياً (الوصول عن بُعد مخطَّط له عبر
VPN/WireGuard لا HTTPS عام) — راجعي التعليق أسفل `nginx/nginx.conf` لخطوات
إضافة SSL لاحقاً.

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

بعد اكتمال الإقلاع (`docker compose ps` يُظهر `app` و`nginx` بحالة `healthy`/`Up`):
- الواجهة: http://localhost
- الـ API: http://localhost/api/health (عبر Nginx — `app` نفسها لم تعد مكشوفة مباشرة على الجهاز المضيف)

## عرض السجلات (logs)

```bash
docker compose logs -f app          # عمليتا PM2 (الباك إند + العامل) داخل حاوية app معاً
docker compose logs -f nginx
docker compose logs -f postgres
docker compose logs -f redis
```

لعرض سجل عملية PM2 محدَّدة *داخل* حاوية app وحدها (الباك إند فقط، أو
العامل فقط، بدل الاثنين مدموجين):

```bash
docker compose exec app pm2 logs sihatuna-backend --lines 50
docker compose exec app pm2 logs sihatuna-worker --lines 50
```

## تشغيل أوامر لمرة واحدة داخل حاوية app

```bash
# إعادة تشغيل الترحيلات يدوياً (تحصل تلقائياً بكل إقلاع أصلاً، لكن مفيدة
# للتشخيص أو للتأكد الفوري بدون إعادة تشغيل الحاوية كاملة)
docker compose exec app sh -c "cd backend && node run-migrations.js"

# فتح shell تفاعلي داخل الحاوية
docker compose exec app sh

# حالة عمليتَي PM2 (الباك إند بـcluster mode + العامل)
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
| `frontend_static` | نسخة الفرونت إند الثابتة المبنية — تُنسخ إليها من حاوية app بكل إقلاع (تعكس دائماً آخر صورة مبنية)، تقدّمها حاوية nginx للقراءة فقط |

بدون `backend_data` تحديداً، أي إعادة تشغيل للحاوية كانت سترجع `db.json`
لحالته الافتراضية بصورة البناء (تمسح أي مستخدم أو تعديل حقيقي أُضيف
لاحقاً) — هذا اكتُشف صراحة أثناء إعداد هذا الملف، وليس افتراضاً.

## إضافة SSL/TLS لاحقاً

النظام يعمل حالياً عبر HTTP فقط بقرار مقصود — الوصول عن بُعد مخطَّط له عبر
VPN/WireGuard لا HTTPS عام، فما فيه شهادة SSL بعد. لكن `nginx/nginx.conf`
مبني من البداية بحيث إضافة SSL لاحقاً **تغيير صغير إضافي، لا إعادة كتابة**
— هذي الخطوات الكاملة وقتها.

### 1. احصلي على شهادة

اختاري حسب سيناريو النشر الفعلي وقتها:

- **دومين حقيقي، وصول عام** (Let's Encrypt، مجاني): استخدمي `certbot`
  (بحاوية Docker منفصلة مؤقتة، أو مثبَّت مباشرة على السيرفر) لإصدار شهادة
  حقيقية لدومينك. مثال بسيط عبر وضع standalone (يحتاج المنفذ 80 فاضياً
  مؤقتاً وقت الإصدار فقط):
  ```bash
  docker run --rm -p 80:80 -v "$(pwd)/ssl:/etc/letsencrypt" certbot/certbot \
    certonly --standalone -d sihatuna-iraq.example.com
  ```
  الشهادة الناتجة تكون بـ
  `ssl/live/sihatuna-iraq.example.com/{fullchain.pem,privkey.pem}`.
  Let's Encrypt تنتهي صلاحيتها كل 90 يوم — تحتاجين تجديداً دورياً
  (`certbot renew`، يمكن جدولته بمهمة cron/Task Scheduler).

- **شبكة داخلية/VPN فقط** (لا وصول عام، تشفير بالنقل فقط لا ثقة متصفح
  كاملة): شهادة موقَّعة ذاتياً (self-signed) كافية تماماً — المتصفح يحذّر
  مرة واحدة ("غير آمن")، يقبلها المستخدم يدوياً، وبعدها تعمل بشكل طبيعي:
  ```bash
  mkdir -p ssl
  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout ssl/privkey.pem -out ssl/fullchain.pem \
    -subj "/CN=sihatuna-iraq.local"
  ```

### 2. اربطي مجلد الشهادات بخدمة nginx (`docker-compose.yml`)

أضيفي المنفذ 443 وvolume الشهادات لخدمة `nginx`:

```yaml
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    depends_on:
      app:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"          # ← جديد
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro          # ← جديد (يطابق مسار الشهادة بالخطوة 1)
      - frontend_static:/usr/share/nginx/html:ro
```

### 3. عدّلي `nginx/nginx.conf`

استبدلي `server { listen 80; ... }` الحالي بسيرفرين: واحد يحوّل كل حركة
HTTP لـHTTPS تلقائياً، وثانٍ يخدم HTTPS فعلياً بنفس `location{}` الموجودة
حالياً حرفياً (انسخيها كما هي، فقط أضيفي `server{}` جديد):

```nginx
  server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl;
    server_name _;
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # نفس root/index/location الموجودة بـserver{ listen 80; } الحالي —
    # انسخيها حرفياً هنا (root، index، location /api/، location /uploads/،
    # location ~* \.(js|css|...)، location /).
  }
```

### 4. فعّلي كوكي `secure` (`.env`)

```
USE_HTTPS=true
```

(`backend/routes/authRoutes.js` يقرأ هذا المتغيّر تحديداً — الكوكي
`auth_token` يصير `secure:true`، يعني المتصفح يرفض إرسالها إلا عبر HTTPS
فعلياً. لا تفعّليه قبل التأكد إن HTTPS شغّال فعلاً، وإلا تسجيل الدخول يفشل
بصمت.)

### 5. أعيدي التشغيل وتأكدي

```bash
docker compose up -d      # يعيد إنشاء nginx (وapp لقراءة USE_HTTPS الجديد)
curl -k https://localhost/api/health   # -k لأن شهادة self-signed غير موثوقة من curl افتراضياً
```

افتحي `https://<عنوان السيرفر>` بالمتصفح — يجب أن يعمل تسجيل الدخول
بشكل طبيعي (مع تحذير شهادة غير موثوقة أول مرة لو self-signed).

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

# Dockerfile — SIHATUNA IRAQ ERP (المرحلة الثالثة: containerization)
#
# صورة واحدة تحتوي: الباك إند (Express)، عامل طابور BullMQ (قراءة الفواتير
# بالذكاء الاصطناعي)، ونسخة إنتاج ثابتة من الفرونت إند (React). الثلاثة
# يشتغلون معاً داخل نفس الحاوية عبر PM2 (راجعي ecosystem.docker.config.js) —
# قرار مقصود بالمرحلة الثالثة: حاوية تطبيق واحدة، لا نسخ متعددة (replicas)،
# مطابقة تماماً لبنية PM2 cluster mode المستخدمة أصلاً بالنشر المحلي
# (start.bat)، فقط معبّأة بحاوية بدل التثبيت المباشر على الجهاز.
#
# إصدار Node.js: 24 — مطابق تماماً لما هو مثبَّت محلياً وما يستخدمه
# .github/workflows/test.yml (node-version: '24')، لا تخمين.

# ══════════════════════════════════════════════════════════════════════════
# مرحلة 1: بناء نسخة إنتاج ثابتة من الفرونت إند (React)
# ══════════════════════════════════════════════════════════════════════════
FROM node:24-slim AS frontend-builder
WORKDIR /app/frontend

# نسخ ملفات القفل أولاً فقط (قبل بقية الكود) — يستفيد من طبقات Docker
# المخبَّأة (cache): لو تغيّر كود الفرونت إند فقط بدون تغيير التبعيات،
# npm ci لا يُعاد تنفيذه من الصفر بكل بناء.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

# REACT_APP_API_URL تُقرأ وقت البناء فقط (Create React App تُضمّنها مباشرة
# داخل ملفات JS النهائية، لا يمكن تغييرها بعد البناء إلا بإعادة بناء كاملة) —
# القيمة الافتراضية هنا (localhost:8000) تعمل فقط لو المتصفح نفسه على نفس
# جهاز/سيرفر Docker. لو النشر يخدم أجهزة أخرى بالشبكة (عنوان IP أو دومين
# حقيقي)، مرّري القيمة الصحيحة وقت البناء:
#   docker compose build --build-arg REACT_APP_API_URL=http://192.168.1.10:8000/api
ARG REACT_APP_API_URL=http://localhost:8000/api
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
RUN npm run build

# ══════════════════════════════════════════════════════════════════════════
# مرحلة 2: الصورة النهائية — الباك إند + عامل BullMQ + الفرونت إند المبني
# ══════════════════════════════════════════════════════════════════════════
FROM node:24-slim AS final

# PM2 يدير كل العمليات الثلاث داخل الحاوية (راجعي ecosystem.docker.config.js
# وCMD بالأسفل) — نفس أداة إدارة العمليات المستخدمة أصلاً بالنشر المحلي.
RUN npm install -g pm2

# pg_dump — يحتاجه backend/utils/backup.js للنسخ الاحتياطي التلقائي الكامل
# لقاعدة PostgreSQL (راجعي شرح كامل هناك). مستودعات Debian bookworm
# الافتراضية (قاعدة node:24-slim) توفّر فقط postgresql-client الإصدار 15،
# بينما خدمة postgres بـdocker-compose.yml هي الإصدار 18 — pg_dump من إصدار
# أقدم من السيرفر غير مدعوم رسمياً (قد يفشل أو يعطي نسخة ناقصة). لهذا نضيف
# مستودع PostgreSQL الرسمي (PGDG) لتثبيت postgresql-client-18 المطابق
# تماماً لإصدار السيرفر، بدل الاعتماد على مستودع Debian الافتراضي.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates wget gnupg \
    && wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-18 \
    && apt-get purge -y --auto-remove wget gnupg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── تثبيت تبعيات الباك إند أولاً (طبقة مخبَّأة منفصلة عن كود المصدر) ─────────
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

# كود الباك إند الكامل
COPY backend/ ./backend/

# نسخة الفرونت إند المبنية فقط (ملفات ثابتة جاهزة) — لا كود React مصدري ولا
# أي devDependencies خاصة به بالصورة النهائية إطلاقاً.
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# قائمة عمليات PM2 الخاصة بـDocker (راجعي شرح كامل بالملف نفسه) — تحتاج أيضاً
# ecosystem.config.js نفسه لأنها تعمل require() عليه مباشرة (تعيد استخدام
# تعريفي sihatuna-backend/sihatuna-worker منه بلا تكرار).
COPY ecosystem.docker.config.js ecosystem.config.js ./

# مجلدات تُستبدَل عملياً بالحجوم (volumes) بـdocker-compose.yml وقت التشغيل
# الفعلي (persistent) — نُنشئها هنا فقط لضمان وجودها حتى قبل أول mount،
# ولمنع PM2 من الفشل لو حاول كتابة سجل قبل أي دورة تشغيل كاملة.
RUN mkdir -p backend/logs backend/uploads backend/backups backend/data

ENV NODE_ENV=production
# 8000: الـ API. 3000: الفرونت إند (الملفات الثابتة). 2575: خادم HL7
# (نتائج المختبر) — يحتاج الوصول له من أجهزة المختبر الفعلية بالشبكة لو
# استُخدمت هذي الميزة.
EXPOSE 8000 3000 2575

# ── نقطة البدء الفعلية ──────────────────────────────────────────────────────
# 1) node run-migrations.js: نفس الخطوة اللي يسويها start.bat تلقائياً بكل
#    نشر محلي — يطبّق أي ترحيل SQL لم يُطبَّق بعد بجدول schema_migrations
#    (كل ملفات migrations-sql/*.sql idempotent فعلياً — IF NOT EXISTS/ON
#    CONFLICT DO NOTHING بكل واحد منها، تأكدنا من هذا صراحة)، فتشغيلها هنا
#    بأمان حتى لو postgres_schema.sql (يُطبَّق تلقائياً أول مرة فقط عبر
#    docker-entrypoint-initdb.d بخدمة postgres — راجعي docker-compose.yml)
#    يطبّق بعضها مسبقاً. ضروري تحديداً لأن postgres_schema.sql غير متزامن
#    بالكامل فعلياً مع migrations-sql (تحقّقنا: جدول medical_codes مثلاً
#    غائب منه تماماً) — بدون هذي الخطوة، قاعدة بيانات جديدة بالكامل (أول
#    تشغيل Docker) تفتقد جداول حقيقية يعتمد عليها التطبيق.
# 2) pm2-runtime (لا pm2 العادي): مصمَّم خصيصاً للعمل كعملية PID 1 بالمقدّمة
#    داخل حاويات Docker (يبقى بالمقدّمة ويمرّر إشارات النظام SIGTERM/SIGINT
#    بشكل صحيح لكل العمليات الفرعية) — pm2 العادي يعمل كـdaemon بالخلفية
#    ويخرج فوراً، فتظن Docker إن الحاوية انتهت وتُغلقها مباشرة.
CMD ["sh", "-c", "cd backend && node run-migrations.js && cd .. && pm2-runtime start ecosystem.docker.config.js"]

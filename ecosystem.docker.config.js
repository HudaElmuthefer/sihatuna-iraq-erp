// ecosystem.docker.config.js — قائمة عمليات PM2 المستخدَمة داخل حاوية
// Docker (راجعي Dockerfile وdocker-compose.yml بنفس المجلد) فقط. النشر
// المحلي العادي (start.bat) يستمر باستخدام ecosystem.config.js كما هو
// تماماً، بلا أي تغيير عليه.
//
// ── لماذا ملف منفصل بدل تعديل ecosystem.config.js مباشرة؟ ───────────────────
// عمليتا الباك إند (sihatuna-backend) والعامل (sihatuna-worker) مطابقتان
// حرفياً هناك — نفس cluster mode، نفس حارس NODE_APP_INSTANCE (خادم HL7
// والنسخ الاحتياطي التلقائي بعملية '0' فقط)، نفس طابور BullMQ — فنعيد
// استخدامهما هنا بلا أي تعديل (require أدناه، لا تكرار). الاختلاف الوحيد:
// عملية الفرونت إند الثالثة بـecosystem.config.js تشغّل خادم React
// التطويري الحي (react-scripts start) — وهذا غير متوافق إطلاقاً مع حاوية
// إنتاج: يحتاج تثبيت كل devDependencies الفرونت إند (يُضخّم الصورة النهائية
// بلا داعٍ)، وهو مصمَّم أصلاً لإعادة التحميل الحي وخرائط مصدر غير مضغوطة
// أثناء التطوير، لا لخدمة مستخدمين حقيقيين بأداء جيد. بدلاً عنه هنا: خادم
// ملفات ثابتة بسيط لنسخة الإنتاج المبنية مسبقاً بمرحلة البناء متعددة
// المراحل بـDockerfile — راجعي backend/serveFrontend.js.
const { apps } = require('./ecosystem.config.js');
const [backendApp, workerApp] = apps; // sihatuna-backend وsihatuna-worker حرفياً بلا أي تعديل (نتجاهل apps[2]، عملية react-scripts start التطويرية)

module.exports = {
  apps: [
    backendApp,
    workerApp,
    {
      name: 'sihatuna-frontend',
      cwd: './backend',
      script: 'serveFrontend.js',
      exec_mode: 'fork',
      instances: 1,
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      time: true,
    },
  ],
};

// ecosystem.docker.config.js — قائمة عمليات PM2 المستخدَمة داخل حاوية
// Docker (راجعي Dockerfile وdocker-compose.yml بنفس المجلد) فقط. النشر
// المحلي العادي (start.bat) يستمر باستخدام ecosystem.config.js كما هو
// تماماً، بلا أي تغيير عليه.
//
// ── لماذا ملف منفصل بدل تعديل ecosystem.config.js مباشرة؟ ───────────────────
// عمليتا الباك إند (sihatuna-backend) والعامل (sihatuna-worker) مطابقتان
// حرفياً هناك — نفس cluster mode، نفس حارس NODE_APP_INSTANCE (خادم HL7
// والنسخ الاحتياطي التلقائي بعملية '0' فقط)، نفس طابور BullMQ — فنعيد
// استخدامهما هنا بلا أي تعديل (require أدناه، لا تكرار). عملية الفرونت
// إند الثالثة بـecosystem.config.js تشغّل خادم React التطويري الحي
// (react-scripts start) — غير مناسبة لحاوية إنتاج أصلاً، فنتجاهلها هنا
// (apps[2]) بلا أي بديل بهذا الملف أيضاً.
//
// ── إصلاح: لا عملية "sihatuna-frontend" منفصلة بعد الآن ─────────────────────
// كانت هذي القائمة تشغّل عملية Node.js ثالثة (backend/serveFrontend.js)
// فقط لخدمة ملفات الفرونت إند الثابتة المبنية مسبقاً. الآن Nginx (خدمة
// جديدة بـdocker-compose.yml، راجعي nginx/nginx.conf) يقدّمها مباشرة من
// volume مشترك — أسرع وأخف بكثير من خادم Express لملفات ثابتة بحتة، وأزال
// حاجة عملية PM2/منفذ داخلي كامل لهذا الغرض وحده.
const { apps } = require('./ecosystem.config.js');
const [backendApp, workerApp] = apps;

module.exports = { apps: [backendApp, workerApp] };

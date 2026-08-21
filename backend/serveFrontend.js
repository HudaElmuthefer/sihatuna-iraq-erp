// backend/serveFrontend.js
//
// خادم ملفات ثابتة بسيط لنسخة الفرونت إند المبنية للإنتاج (npm run build) —
// يُستخدم فقط داخل حاوية Docker (راجعي ecosystem.docker.config.js وDockerfile
// بجذر المشروع). النشر المحلي العادي (start.bat) يبقى يشغّل خادم React
// التطويري المباشر (react-scripts start عبر ecosystem.config.js) كما هو —
// هذا الملف لا يُستخدم إطلاقاً هناك، فقط بصورة Docker حيث تُبنى نسخة
// الإنتاج مرة واحدة أثناء بناء الصورة (multi-stage build) بدل تشغيل خادم
// تطوير حي بكل مرة (يحتاج devDependencies الفرونت إند كاملة، ومخصَّص أصلاً
// لإعادة التحميل الحي أثناء التطوير، لا لخدمة مستخدمين حقيقيين).
//
// نستخدم express مباشرة (تبعية موجودة أصلاً بـbackend/node_modules، لا
// حاجة لأي حزمة إضافية مثل serve) — خادم ملفات ثابتة + SPA fallback (كل
// مسار غير موجود كملف يرجع index.html، ليتولى React Router التوجيه بجانب
// المتصفح) هو كل ما يحتاجه تطبيق React مبني للإنتاج.
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.FRONTEND_PORT || 3000;
const BUILD_DIR = path.join(__dirname, '..', 'frontend', 'build');

app.use(express.static(BUILD_DIR));
// أي مسار ثاني (مثل /patients أو /procurement) لا يطابق ملفاً فعلياً بمجلد
// build — يرجع index.html نفسه، وReact Router (بجانب المتصفح) يتولى عرض
// الصفحة الصحيحة. بدون هذا، تحديث الصفحة (F5) بأي مسار غير الرئيسي يرجع 404.
app.get('*', (req, res) => res.sendFile(path.join(BUILD_DIR, 'index.html')));

app.listen(PORT, () => console.log(`🟢 [frontend] يقدّم نسخة الإنتاج المبنية على المنفذ ${PORT}`));

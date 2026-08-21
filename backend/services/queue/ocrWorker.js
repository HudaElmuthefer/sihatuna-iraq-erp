// backend/services/queue/ocrWorker.js
//
// عملية استهلاك طابور قراءة الفواتير (OCR/AI) — تُشغَّل كعملية PM2 منفصلة
// تماماً عن الخادم الرئيسي (sihatuna-backend)، راجعي ecosystem.config.js
// ("sihatuna-worker"). تُشغَّل مباشرة بـnode services/queue/ocrWorker.js.
//
// ── لماذا عملية منفصلة، لا داخل نفس عمليات Express (cluster mode)؟ ──────────
// 1) sihatuna-backend يعمل بـinstances:'max' (عملية واحدة لكل نواة معالج) —
//    لو شغّلنا Worker داخل كل عملية منها، صار عدد معالجات الطابور المتزامنة
//    يساوي عدد الأنوية تلقائياً بلا أي ضبط مقصود، ويتغيّر مع كل تغيير بعدد
//    الأنوية أو خطة الاستضافة — سلوك غير متوقَّع وصعب ضبطه أو تتبّعه.
// 2) عزل الأعطال: تعليق أو انهيار معالجة مهمة واحدة (مثلاً استجابة AI غريبة
//    الشكل، أو استدعاء شبكة عالق) لا يجب أن يؤثر على استقرار خادم HTTP
//    الرئيسي — وعكسه أيضاً: إعادة تشغيل الخادم الرئيسي بعد نشر تحديث لا يجب
//    أن يقطع مهمة معالجة جارية بمنتصفها.
// 3) دورة حياة/سياسة إعادة تشغيل مختلفة منطقياً: خادم HTTP يجب أن يبقى شغّالاً
//    دائماً بأقصى استقرار ممكن، بينما عملية Worker يمكن تحمّل توقف قصير أو
//    إعادة تشغيل أكثر تكراراً دون أثر ملموس على المستخدمين (المهام تبقى
//    بالطابور وتُعالَج فور عودته، بفضل ثبات BullMQ بـRedis).
// نفس فلسفة "عملية واحدة مخصَّصة لمهمة خلفية" المطبَّقة فعلياً بحارس
// NODE_APP_INSTANCE=='0' لخادم HL7 والنسخ الاحتياطي بserver.js — هنا بمستوى
// أوضح (عملية PM2 كاملة منفصلة بدل شرط داخل نفس العملية)، لأن BullMQ أصلاً
// مصمَّم ليعمل كعملية Worker مستقلة.
require('dotenv').config();
const { Worker } = require('bullmq');
const { createQueueConnection } = require('./queueConnection');
const { QUEUE_NAME } = require('./ocrQueue');
const { callAIWithImage } = require('../../utils/aiProvider');
const { logAudit } = require('../../utils/auditLog');
const { devLog } = require('../../utils/logger');

// عدد المهام المتزامنة داخل عملية Worker الوحيدة هذه: استدعاء AI عملية
// I/O-bound أساساً (تنتظر رد شبكة من Gemini/Anthropic)، مو عملية تستهلك
// معالج (CPU-bound) — فمعالجة عدة مهام متزامنة بنفس العملية آمنة وفعّالة هنا
// (Node.js تدير انتظار عدة طلبات شبكة غير متزامنة بكفاءة بنفس الوقت)، بعكس
// لو كانت المهمة تفريغ صور كبيرة أو ضغط ملفات (CPU-bound فعلياً، تحتاج
// عمليات منفصلة حقيقية بدل تزامن داخل نفس العملية).
const CONCURRENCY = parseInt(process.env.OCR_WORKER_CONCURRENCY, 10) || 3;

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { systemPrompt, userPrompt, imageBase64, mimeType, userId, userRole } = job.data;
    const result = await callAIWithImage(systemPrompt, userPrompt, imageBase64, mimeType);
    if (result.available) {
      logAudit({ module: 'invoice-reader', action: 'read', userId, userRole, after: { provider: result.provider, itemsCount: result.parsed?.items?.length || 0 } });
    } else if (result.error) {
      // فشل استدعاء AI نفسه (لا مزوّد مُعدّ، أو خطأ بالاستدعاء) — لا نرمي
      // استثناء يُعيد المحاولة عبثاً (سيفشل بنفس السبب مرة أخرى غالباً)، بل
      // نرجع النتيجة كما هي؛ مسار الاستعلام (GET /invoice-reader/jobs/:id)
      // يتعامل مع available:false بنفس الطريقة المعتادة أصلاً بكل ميزات
      // الذكاء الاصطناعي بهذا النظام.
      console.error(`⚠️  [ocr-worker] فشل استدعاء ${result.provider}:`, result.error);
    }
    return result;
  },
  { connection: createQueueConnection(), concurrency: CONCURRENCY }
);

worker.on('completed', (job) => devLog(`✅ [ocr-worker] مهمة ${job.id} اكتملت`));
worker.on('failed', (job, err) => console.error(`⚠️  [ocr-worker] مهمة ${job?.id} فشلت:`, err.message));
worker.on('error', (err) => console.error('⚠️  [ocr-worker] خطأ اتصال Redis:', err.message));

devLog(`🟢 [ocr-worker] جاهز، يستهلك طابور "${QUEUE_NAME}" (تزامن: ${CONCURRENCY})`);

// إغلاق نظيف عند إيقاف PM2 للعملية (إعادة نشر، إعادة تشغيل...) — يترك
// BullMQ ينهي أي مهمة جارية بأمان بدل قطعها بمنتصفها فجأة.
process.on('SIGTERM', async () => { await worker.close(); process.exit(0); });
process.on('SIGINT', async () => { await worker.close(); process.exit(0); });

module.exports = worker;

// backend/routes/aiDiagnosisRoutes.js
//
// ── إصلاح جذري: تشخيص بذكاء اصطناعي حقيقي بدل نظام قواعد وهمي ──────────────────
// قبل هذا الملف، صفحة "التشخيص بالذكاء الاصطناعي" بالفرونت إند كانت تبني
// "prompt" فعلي للذكاء الاصطناعي... لكن أبداً ما ترسله لأي مكان! التعليق
// بالكود القديم كان يقول صراحة: "الـ API محظور بـCORS بالمتصفح" — وهذا صحيح
// تقنياً: متصفحات الويب تمنع صفحة على localhost:3000 من مناداة API خارجي
// (مثل Anthropic أو Google) مباشرة لأسباب أمنية (CORS)، إلا لو ذاك الـ API
// يسمح صراحة بهذا الأصل (origin) — أغلب مزوّدي الذكاء الاصطناعي لا يسمحون.
//
// الحل الصحيح (المطبَّق هنا): الفرونت إند لا يناديه أبداً — بدل هذا يناديه
// **الباك إند** (خادم لخادم، بلا أي قيد CORS إطلاقاً)، ويمرر النتيجة
// للفرونت إند كأي مسار API عادي بالنظام. هذا هو النمط الصحيح والوحيد الآمن
// لاستخدام أي API خارجي من تطبيق ويب بأي حال.
//
// ── مزوّدان مدعومان — Gemini (مجاني) أولوية، Claude (مدفوع) بديل ──────────────
// Google Gemini عنده طبقة مجانية دائمة (بدون بطاقة ائتمان، بلا حد زمني)
// لنماذج Flash — مناسبة تماماً لحجم استخدام مستشفى واحد. لو GEMINI_API_KEY
// مُعدّ، يُستخدم أولاً (مجاني بالكامل). لو ما مُعدّ لكن ANTHROPIC_API_KEY
// موجود، يُستخدم Claude بدلاً عنه (مدفوع، جودة أعلى غالباً). لو ولا وحد منهم
// مُعدّ، يرجع available:false والفرونت إند يستخدم النظام المحلي الاحتياطي
// (buildFallback) **مع تسمية صادقة توضح إنه نظام مساعدة أولية مو ذكاء
// اصطناعي حقيقي**. ما فيه أي كسر أو خطأ بأي حالة من الثلاث.
const express = require('express');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('../config/redisRateLimitStore');
const { logAudit } = require('../utils/auditLog');
const { activeProvider, callAI } = require('../utils/aiProvider');

const router = express.Router();

// ── إصلاح: قائمة الأطباء المُقترَحين صارت ملف بيانات، مو كود ثابت ──────────────
// قبل هذا، قائمة الأطباء (الاسم، التخصص، الهاتف، العنوان) كانت مكتوبة يدوياً
// داخل كود React نفسه — أي تعديل بسيط (رقم هاتف تغيّر، طبيب جديد، عيادة
// انتقلت) كان يحتاج تعديل كود وبناء (build) ونشر نسخة جديدة كاملة من الفرونت
// إند. الآن هي ملف JSON بسيط بجانب الخادم — يُعدَّل مباشرة بأي محرر نصوص
// (حتى بدون معرفة برمجة)، ويظهر التغيير فوراً لكل المستخدمين بمجرد تحديث
// الصفحة، بدون أي بناء أو نشر.
const REFERRAL_DOCTORS_PATH = path.join(__dirname, '..', 'data', 'basra-referral-doctors.json');

router.get('/ai-diagnosis/referral-doctors', auth, requirePermission('ai-diagnosis'), (req, res) => {
  try {
    const doctors = JSON.parse(fs.readFileSync(REFERRAL_DOCTORS_PATH, 'utf8'));
    res.json(doctors);
  } catch (err) {
    console.error('⚠️  [ai-diagnosis] تعذّر قراءة ملف الأطباء المُقترَحين:', err.message);
    res.json([]); // لا نكسر تجربة المستخدم لو الملف تالف — قائمة فاضية بدل خطأ
  }
});

// حد معدل مخصّص: حتى Gemini المجاني له حد أقصى يومي/دقيقي من مزوّد الخدمة
// نفسه، وClaude له كلفة فعلية لو استُخدم — فحدنا الداخلي أقل بكثير من الحد
// العام بأي الحالتين.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'عدد كبير جداً من طلبات التشخيص، حاول مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('ai-diagnosis'),
});

// يبني نص الطلب (prompt) بصيغة موحّدة تُستخدم مع أي المزوّدين
function buildPrompts(lang, symptoms, age, gender, duration, filesDescription) {
  const isEn = lang === 'en';
  const systemPrompt = isEn
    ? 'You are a specialist consultant physician assisting with a preliminary, non-definitive symptom assessment for a hospital ERP system. Always include a clear disclaimer that this is not a substitute for professional medical evaluation. Respond ONLY with valid JSON matching the exact schema requested — no markdown, no extra text.'
    : 'أنتِ طبيب استشاري متخصص تساعدين بتقييم أولي غير قطعي للأعراض ضمن نظام مستشفى إلكتروني. اذكري دائماً إن هذا لا يغني عن الفحص الطبي المتخصص. أجيبي فقط بصيغة JSON صالحة مطابقة تماماً للمخطط المطلوب — بدون Markdown وبدون أي نص إضافي خارج الـ JSON.';

  const userPrompt = isEn
    ? `Patient symptoms: ${symptoms.join(', ')}\nDuration: ${duration || 'unspecified'}\nAge: ${age || 'unspecified'}\nGender: ${gender || 'unspecified'}\n${filesDescription ? `Attached files: ${filesDescription}` : ''}\n\nRespond with JSON only: {"diagnoses":[{"name":"...","probability":"...","description":"..."}],"severity":"mild|moderate|high|urgent","tests":["..."],"recommendations":["..."],"urgent":false,"urgentReason":""}`
    : `أعراض المريض: ${symptoms.join('، ')}\nمدة الأعراض: ${duration || 'غير محددة'}\nالعمر: ${age || 'غير محدد'}\nالجنس: ${gender || 'غير محدد'}\n${filesDescription ? `الملفات المرفقة: ${filesDescription}` : ''}\n\nأجيبي بصيغة JSON فقط: {"diagnoses":[{"name":"...","probability":"...","description":"..."}],"severity":"خفيف|متوسط|مرتفع|طارئ","tests":["..."],"recommendations":["..."],"urgent":false,"urgentReason":""}`;

  return { systemPrompt, userPrompt };
}

// يخبر الفرونت إند فوراً هل الذكاء الاصطناعي الحقيقي متاح أصلاً (وأي مزوّد) —
// يُستخدم لعرض تسمية صادقة بالواجهة دون الحاجة لمحاولة طلب فعلي أولاً.
router.get('/ai-diagnosis/status', auth, requirePermission('ai-diagnosis'), (req, res) => {
  const provider = activeProvider();
  res.json({ available: Boolean(provider), provider });
});

router.post('/ai-diagnosis/analyze', auth, requirePermission('ai-diagnosis'), aiLimiter, async (req, res, next) => {
  try {
    const { symptoms, age, gender, duration, filesDescription, lang } = req.body;
    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ message: 'يجب اختيار عرض واحد على الأقل' });
    }

    const { systemPrompt, userPrompt } = buildPrompts(lang, symptoms, age, gender, duration, filesDescription);
    const result = await callAI(systemPrompt, userPrompt);

    if (!result.available) {
      if (result.error) console.error(`⚠️  [ai-diagnosis] فشل استدعاء ${result.provider}:`, result.error);
      return res.json({ available: false });
    }

    logAudit({ module: 'ai-diagnosis', action: 'analyze', userId: req.user.id, userRole: req.user.role, after: { symptomsCount: symptoms.length, provider: result.provider } });
    res.json({ available: true, source: 'ai', provider: result.provider, ...result.parsed });
  } catch (err) { next(err); }
});

module.exports = router;

// backend/routes/drugInteractionRoutes.js
//
// ── إصلاح: فحص تضارب دوائي حقيقي بدل جدول ثابت لـ5 تضاربات بس ──────────────
// قبل هذا الملف، صفحة "التضارب الدوائي" كانت تطابق الأدوية المختارة مقابل
// مصفوفة ثابتة بـ5 أزواج تضارب معروفة مسبقاً بالكود — أي دواءين غير موجودين
// حرفياً بهذي القائمة الخمسة كانا يُعتبَران "آمنين" تلقائياً، بغض النظر عن
// وجود تضارب حقيقي بينهم أو لا. الآن يستخدم نفس بنية الذكاء الاصطناعي
// الحقيقي المستخدمة بصفحة التشخيص (راجعي utils/aiProvider.js) — يفحص أي
// تركيبة أدوية، مو بس الخمسة المحفوظة يدوياً.
//
// نفس مبدأ التشغيل الاختياري: بدون GEMINI_API_KEY أو ANTHROPIC_API_KEY
// بملف .env، يرجع available:false والفرونت إند يستخدم الجدول المحلي
// الاحتياطي (الخمسة تضاربات المعروفة) **مع تسمية صادقة** توضح إنه فحص محدود
// مبني على قائمة صغيرة ثابتة، مو فحصاً شاملاً حقيقياً.
const express = require('express');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('../config/redisRateLimitStore');
const { logAudit } = require('../utils/auditLog');
const { activeProvider, callAI } = require('../utils/aiProvider');

const router = express.Router();

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'عدد كبير جداً من طلبات الفحص، حاول مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('drug-interactions'),
});

function buildPrompts(lang, drugs) {
  const isEn = lang === 'en';
  const systemPrompt = isEn
    ? 'You are a clinical pharmacist assisting with a preliminary drug interaction check for a hospital ERP system. Only report interactions you are reasonably confident about — do not invent interactions. Always include a disclaimer that this does not replace a pharmacist or physician review. Respond ONLY with valid JSON matching the exact schema requested — no markdown, no extra text.'
    : 'أنتِ صيدلانية سريرية تساعدين بفحص أولي للتضارب الدوائي ضمن نظام مستشفى إلكتروني. اذكري فقط التضاربات اللي متأكدة منها بشكل معقول — لا تختلقي تضاربات غير موثوقة. اذكري دائماً إن هذا لا يغني عن مراجعة صيدلاني أو طبيب. أجيبي فقط بصيغة JSON صالحة مطابقة تماماً للمخطط المطلوب — بدون Markdown وبدون أي نص إضافي خارج الـ JSON.';

  const userPrompt = isEn
    ? `Check for drug interactions between these medications: ${drugs.join(', ')}\n\nRespond with JSON only: {"interactions":[{"drugs":["drug1","drug2"],"severity":"low|medium|high","effect":"...","recommendation":"..."}]}. If no known interactions exist between any of these drugs, respond with {"interactions":[]}.`
    : `افحصي التضارب الدوائي بين هذي الأدوية: ${drugs.join('، ')}\n\nأجيبي بصيغة JSON فقط: {"interactions":[{"drugs":["دواء1","دواء2"],"severity":"low|medium|high","effect":"...","recommendation":"..."}]}. لو ما فيه تضارب معروف بين أي منهم، أجيبي بـ{"interactions":[]}.`;

  return { systemPrompt, userPrompt };
}

// نفس نمط /ai-diagnosis/status — يخبر الفرونت إند فوراً هل الذكاء الاصطناعي
// الحقيقي متاح، لعرض تسمية صادقة بالواجهة من أول لحظة
router.get('/drug-interactions/status', auth, requirePermission('drug-interactions'), (req, res) => {
  const provider = activeProvider();
  res.json({ available: Boolean(provider), provider });
});

router.post('/drug-interactions/check', auth, requirePermission('drug-interactions'), aiLimiter, async (req, res, next) => {
  try {
    const { drugs, lang } = req.body;
    if (!Array.isArray(drugs) || drugs.length < 2) {
      return res.status(400).json({ message: 'يجب اختيار دوائين على الأقل' });
    }

    const { systemPrompt, userPrompt } = buildPrompts(lang, drugs);
    const result = await callAI(systemPrompt, userPrompt);

    if (!result.available) {
      if (result.error) console.error(`⚠️  [drug-interactions] فشل استدعاء ${result.provider}:`, result.error);
      return res.json({ available: false });
    }

    logAudit({ module: 'drug-interactions', action: 'check', userId: req.user.id, userRole: req.user.role, after: { drugsCount: drugs.length, provider: result.provider } });
    res.json({ available: true, source: 'ai', provider: result.provider, ...result.parsed });
  } catch (err) { next(err); }
});

module.exports = router;

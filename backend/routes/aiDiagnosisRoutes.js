// backend/routes/aiDiagnosisRoutes.js
//
// ── A fundamental fix: real AI diagnosis instead of a fake rules system ──────────────────
// Before this file, the frontend's "AI diagnosis" page used to build an
// actual AI "prompt"... but never sent it anywhere! The old code's comment
// explicitly said: "the API is blocked by CORS in the browser" — which is
// technically true: web browsers block a page on localhost:3000 from
// calling an external API (like Anthropic or Google) directly for security
// reasons (CORS), unless that API explicitly allows this origin — most AI
// providers don't.
//
// The correct solution (implemented here): the frontend never calls it at
// all — instead, **the backend** calls it (server-to-server, with no CORS
// restriction at all), and passes the result to the frontend like any
// other normal API route in the system. This is the correct and only safe
// pattern for using any external API from a web app, period.
//
// ── Now goes through aiProviderRouter.js like the other three AI features ────
// This file used to call utils/aiProvider.js (Gemini/Claude) directly with
// no bot/offline choice at all. Now 'aiDiagnosis' is a fourth feature
// registered in aiProviderRouter.js: 'online' (whichever provider is
// actually configured in .env, its name is never mentioned in the UI),
// 'offline' (local Ollama), or 'bot' (returns available:false immediately
// — the frontend uses the local backup system buildFallback **with an
// honest label making clear it's a preliminary assistance system and not
// real AI**, exactly the same old behavior as if no API key were
// configured). There's no breakage or error in any of the three cases.
const express = require('express');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const rateLimit = require('express-rate-limit');
const RedisRateLimitStore = require('../config/redisRateLimitStore');
const { skipInTest } = require('../config/rateLimiters');
const { logAudit } = require('../utils/auditLog');
const { getFeatureStatus, routeTextCall } = require('../utils/aiProviderRouter');

const router = express.Router();

// ── Fix: the suggested-doctors list is now a data file, not hardcoded code ──────────────
// Before this, the doctors list (name, specialization, phone, address) used
// to be written by hand directly inside the React code — any small edit (a
// phone number changing, a new doctor, a clinic that moved) needed a code
// change, a build, and deploying a whole new frontend version. Now it's a
// simple JSON file next to the server — editable directly with any text
// editor (even with no programming knowledge), and the change shows up
// immediately for every user just by refreshing the page, with no build or
// deploy at all.
const REFERRAL_DOCTORS_PATH = path.join(__dirname, '..', 'data', 'basra-referral-doctors.json');

router.get('/ai-diagnosis/referral-doctors', auth, requirePermission('ai-diagnosis'), (req, res) => {
  try {
    const doctors = JSON.parse(fs.readFileSync(REFERRAL_DOCTORS_PATH, 'utf8'));
    res.json(doctors);
  } catch (err) {
    console.error('[ai-diagnosis] Could not read the suggested-doctors file:', err.message);
    res.json([]); // don't break the user's experience if the file is corrupted — an empty list instead of an error
  }
});

// A custom rate limit: even free Gemini has a daily/per-minute cap from
// the provider itself, and Claude has an actual cost if used — so our
// internal limit is much lower than the general limit in either case.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: skipInTest,
  message: { message: 'عدد كبير جداً من طلبات التشخيص، حاول مرة أخرى بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('ai-diagnosis'),
});

// Builds the prompt text in a unified format used with whichever provider is active
function buildPrompts(lang, symptoms, age, gender, duration, filesDescription) {
  const isEn = lang === 'en';
  const systemPrompt = isEn
    ? 'You are a specialist consultant physician assisting with a preliminary, non-definitive symptom assessment for a hospital ERP system. Always include a clear disclaimer that this is not a substitute for professional medical evaluation. Respond ONLY with valid JSON matching the exact schema requested — no markdown, no extra text.'
    : 'أنت طبيب استشاري متخصص تساعد بتقييم أولي غير قطعي للأعراض ضمن نظام مستشفى إلكتروني. اذكر دائماً إن هذا لا يغني عن الفحص الطبي المتخصص. أجب فقط بصيغة JSON صالحة مطابقة تماماً للمخطط المطلوب — بدون Markdown وبدون أي نص إضافي خارج الـ JSON.';

  const userPrompt = isEn
    ? `Patient symptoms: ${symptoms.join(', ')}\nDuration: ${duration || 'unspecified'}\nAge: ${age || 'unspecified'}\nGender: ${gender || 'unspecified'}\n${filesDescription ? `Attached files: ${filesDescription}` : ''}\n\nRespond with JSON only: {"diagnoses":[{"name":"...","probability":"...","description":"..."}],"severity":"mild|moderate|high|urgent","tests":["..."],"recommendations":["..."],"urgent":false,"urgentReason":""}`
    : `أعراض المريض: ${symptoms.join('، ')}\nمدة الأعراض: ${duration || 'غير محددة'}\nالعمر: ${age || 'غير محدد'}\nالجنس: ${gender || 'غير محدد'}\n${filesDescription ? `الملفات المرفقة: ${filesDescription}` : ''}\n\nأجب بصيغة JSON فقط: {"diagnoses":[{"name":"...","probability":"...","description":"..."}],"severity":"خفيف|متوسط|مرتفع|طارئ","tests":["..."],"recommendations":["..."],"urgent":false,"urgentReason":""}`;

  return { systemPrompt, userPrompt };
}

// Immediately tells the frontend whether real AI is available at all (and
// in which mode: bot/online/offline) — used to show an honest label in the
// UI, and to pre-fill the user's default choice in the AiModeSelect.js list
// before the first analysis. See utils/aiProviderRouter.js — the exact same
// pattern as the other three AI features (not a direct Gemini/Claude check
// like before).
router.get('/ai-diagnosis/status', auth, requirePermission('ai-diagnosis'), async (req, res, next) => {
  try {
    res.json(await getFeatureStatus('aiDiagnosis'));
  } catch (err) { next(err); }
});

router.post('/ai-diagnosis/analyze', auth, requirePermission('ai-diagnosis'), aiLimiter, async (req, res, next) => {
  try {
    const { symptoms, age, gender, duration, filesDescription, lang, mode } = req.body;
    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ message: 'يجب اختيار عرض واحد على الأقل' });
    }

    const { systemPrompt, userPrompt } = buildPrompts(lang, symptoms, age, gender, duration, filesDescription);
    // routeTextCall reads the user's saved choice (bot/online/offline) and
    // routes the call accordingly, or uses mode (this specific request's
    // choice) if sent. 'bot' mode returns {available:false} immediately —
    // the frontend handles it exactly as it handles "no API key is
    // configured at all": it uses the local buildFallback.
    const result = await routeTextCall('aiDiagnosis', systemPrompt, userPrompt, mode);

    if (!result.available) {
      if (result.error) console.error(`[ai-diagnosis] Call to ${result.provider} failed:`, result.error);
      return res.json({ available: false });
    }

    logAudit({ module: 'ai-diagnosis', action: 'analyze', userId: req.user.id, userRole: req.user.role, after: { symptomsCount: symptoms.length, provider: result.provider } });
    res.json({ available: true, source: 'ai', provider: result.provider, ...result.parsed });
  } catch (err) { next(err); }
});

module.exports = router;

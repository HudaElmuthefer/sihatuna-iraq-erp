// backend/routes/aiProviderSettingsRoutes.js
//
// إدارة اختيار مزوّد الذكاء الاصطناعي لكل ميزة (بوت/إنترنت/محلي) — راجعي
// utils/aiProviderRouter.js لمنطق التوزيع الفعلي. GET متاح لأي مستخدم
// مسجّل دخول (صفحات قراءة الفواتير/التضارب الدوائي/الوصفات تحتاج معرفة
// الاختيار الحالي لعرض تسمية صادقة، بغض النظر عن دور المستخدم)؛ PUT للإدمن
// فقط (نفس نمط branding: القراءة أوسع من التعديل).
const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { getSettings, setSettings } = require('../utils/aiProviderRouter');
const { logAudit } = require('../utils/auditLog');

const router = express.Router();

router.get('/ai-provider-settings', auth, asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json(settings);
}));

router.put('/ai-provider-settings', auth, requireAdmin, asyncHandler(async (req, res) => {
  const updated = await setSettings(req.body || {});
  logAudit({ module: 'ai-provider-settings', action: 'update', userId: req.user.id, userRole: req.user.role, after: updated });
  res.json(updated);
}));

module.exports = router;

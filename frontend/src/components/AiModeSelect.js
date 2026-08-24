// frontend/src/components/AiModeSelect.js
//
// اختيار مزوّد الذكاء الاصطناعي لطلب واحد تحديداً (بوت/إنترنت/محلي) — قابل
// لإعادة الاستخدام بكل صفحة تستدعي ذكاءً اصطناعياً (التشخيص، قراءة الفواتير/
// الوصفات، التضارب الدوائي). الإعداد الافتراضي بجدول system_settings (يديره
// الإدمن بـSettingsPage.js) يبقى نقطة البداية لكل مستخدم، لكن أي مستخدم —
// بلا حاجة لصلاحية إدمن — يستطيع تغييره هنا لطلبه الحالي فقط؛ التغيير هنا لا
// يُحفَظ بأي مكان، فقط يُرسَل مع الطلب التالي كحقل mode، والباك إند
// (utils/aiProviderRouter.js) يعطيه الأولوية على الإعداد المحفوظ لو وصل.
//
// لا يذكر أبداً اسم مزوّد "الإنترنت" الفعلي (Gemini/Claude/...) — دائماً
// "Online AI" العام، لأن المزوّد الحقيقي يُضبَط بـ.env وقد يتغيّر.
import React from 'react';
import { useT } from '../translations';

export default function AiModeSelect({ value, onChange, lang, disabled, style }) {
  const tr = useT(lang);
  return (
    <select
      className="form-control"
      value={value || 'online'}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      style={{ maxWidth: 260, ...style }}
    >
      <option value="bot">{tr('ai_mode_bot')}</option>
      <option value="online">{tr('ai_mode_online')}</option>
      <option value="offline">{tr('ai_mode_offline')}</option>
    </select>
  );
}

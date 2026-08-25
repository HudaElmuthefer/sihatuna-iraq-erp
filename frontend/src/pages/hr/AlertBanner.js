// frontend/src/pages/hr/AlertBanner.js
// استُخرج من HRPage.js — تنبيه العلاوات/الترفيعات/التقاعد المستحقة أعلى صفحة
// الموارد البشرية.
//
// ── إصلاح: منطق العلاوة/الترفيع كان يفترض 12/24 شهراً ثابتة بلا أي علاقة
// بدورة الشهادة الفعلية للموظف — استُبدل بمحرك الحساب الحقيقي
// (promotionCalc.js: calcPromotionDue/calcAllowanceDue)، يعمل مباشرة على
// سجل الموظف (lastPromotion/lastAllowance/certificate) بلا أي جدول منفصل.
// منطق التقاعد لم يتغيّر.
import { useState } from 'react';
import { I18N, monthsUntil } from './shared';
import { calcPromotionDue, calcAllowanceDue } from './promotionCalc';

// ── إصلاح خلل: كانت هذه القائمة تعرض تنبيهاً واحداً لكل موظف مستحق (ترفيع
// و/أو علاوة) بلا أي حد أقصى — بما أن كل الموظفين الحقيقيين حالياً بلا
// lastPromotion/lastAllowance مسجَّل، تُحسب المستحقات اعتماداً على تاريخ
// التعيين فقط، فيظهر شبه كل موظف "مستحق" معاً. النتيجة: عشرات صفوف التنبيه
// تُغطّي الشاشة كاملة وتدفع جدول الموظفين الفعلي بعيداً للأسفل، فيبدو للمستخدم
// وكأن الجدول "استُبدل" بقائمة تنبيهات بدل أن يظهر فوقها فقط. الآن تُعرض
// أهم MAX_VISIBLE تنبيهاً فقط (الأكثر تأخراً أولاً) مع زر لعرض الباقي عند الحاجة.
const MAX_VISIBLE = 8;

export default
function AlertBanner({ employees, lang }) {
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const [expanded, setExpanded] = useState(false);
  const alerts = [];
  const DUE_WITHIN_DAYS = 30;

  (employees || []).forEach(e => {
    const promoDue = calcPromotionDue(e);
    if (promoDue.available && promoDue.daysUntil <= DUE_WITHIN_DAYS) {
      const daysMsg = promoDue.overdue ? L('due_overdue') : `${L('due_in_days')} ${promoDue.daysUntil} ${L('due_days_unit')}`;
      alerts.push({ type:'promotion', name:e.name, daysUntil:promoDue.daysUntil, msg:`${L('due_type_promotion')} — ${promoDue.dueDate} (${daysMsg})` });
    }
    const allowDue = calcAllowanceDue(e);
    if (allowDue.available && allowDue.daysUntil <= DUE_WITHIN_DAYS) {
      const daysMsg = allowDue.overdue ? L('due_overdue') : `${L('due_in_days')} ${allowDue.daysUntil} ${L('due_days_unit')}`;
      alerts.push({ type:'allowance', name:e.name, daysUntil:allowDue.daysUntil, msg:`${L('due_type_allowance')} — ${allowDue.dueDate} (${daysMsg})` });
    }
    const u = monthsUntil(e.retirementDate);
    if (u >= 0 && u <= 12)
      alerts.push({ type:'retire', name:e.name, daysUntil:u*30, msg:`${L('alert_retire')} ${u} ${L('alert_retire_left')}` });
  });

  if (!alerts.length) return null;
  alerts.sort((a,b) => a.daysUntil - b.daysUntil);
  const hiddenCount = alerts.length - MAX_VISIBLE;
  const visible = expanded ? alerts : alerts.slice(0, MAX_VISIBLE);
  const colors = { allowance:'#f59e0b', promotion:'#1a6bab', retire:'#ef4444' };
  const icons  = { allowance:'💰', promotion:'⬆️', retire:'👴' };
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontWeight:700, fontSize:13, color:'var(--text-secondary)', marginBottom:8 }}>{L('due_soon_title')} ({alerts.length})</div>
      {visible.map((a,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10, background:`${colors[a.type]}15`, border:`1px solid ${colors[a.type]}40`, borderRadius:10, padding:'10px 16px', marginBottom:6 }}>
          <span style={{ fontSize:20 }}>{icons[a.type]}</span>
          <div><span style={{ fontWeight:700, color:colors[a.type] }}>{a.name}</span><span style={{ color:'var(--text-primary)', fontSize:13, marginRight:8 }}>{a.msg}</span></div>
        </div>
      ))}
      {hiddenCount > 0 && (
        <button onClick={() => setExpanded(p => !p)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'6px 14px', fontSize:12, color:'var(--text-primary)', cursor:'pointer' }}>
          {expanded
            ? (lang==='ar' ? 'عرض أقل' : 'Show less')
            : (lang==='ar' ? `عرض ${hiddenCount} إضافية` : `Show ${hiddenCount} more`)}
        </button>
      )}
    </div>
  );
}

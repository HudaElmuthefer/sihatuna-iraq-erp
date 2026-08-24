// frontend/src/pages/hr/AlertBanner.js
// استُخرج من HRPage.js — تنبيه العلاوات/الترفيعات/التقاعد المستحقة أعلى صفحة
// الموارد البشرية.
//
// ── إصلاح: منطق العلاوة/الترفيع كان يفترض 12/24 شهراً ثابتة بلا أي علاقة
// بدورة الشهادة/الدرجة الفعلية للموظف — استُبدل بالكامل بمحرك الحساب الحقيقي
// (promotionCalc.js)، الذي يأخذ بعين الاعتبار جدول دورة الشهادة وكل سجلات
// التعديل (كتب شكر/إجازات/عقوبات) لكل موظف. منطق التقاعد لم يتغيّر.
import { I18N, monthsUntil } from './shared';
import { calcAllDue } from './promotionCalc';

export default
function AlertBanner({ employees, cycles, adjustments, lang }) {
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const alerts = [];

  calcAllDue(employees, cycles || [], adjustments || []).forEach(({ employee: e, due }) => {
    const daysMsg = due.overdue
      ? L('due_overdue')
      : `${L('due_in_days')} ${due.daysUntil} ${L('due_days_unit')}`;
    alerts.push({
      type: due.type,
      name: e.name,
      msg: `${due.type === 'promotion' ? L('due_type_promotion') : L('due_type_allowance')} — ${due.dueDate} (${daysMsg})`,
    });
  });

  employees.forEach(e => {
    const u = monthsUntil(e.retirementDate);
    if (u >= 0 && u <= 12)
      alerts.push({ type:'retire', name:e.name, msg:`${L('alert_retire')} ${u} ${L('alert_retire_left')}` });
  });

  if (!alerts.length) return null;
  const colors = { allowance:'#f59e0b', promotion:'#1a6bab', retire:'#ef4444' };
  const icons  = { allowance:'💰', promotion:'⬆️', retire:'👴' };
  return (
    <div style={{ marginBottom:20 }}>
      {alerts.map((a,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10, background:`${colors[a.type]}15`, border:`1px solid ${colors[a.type]}40`, borderRadius:10, padding:'10px 16px', marginBottom:6 }}>
          <span style={{ fontSize:20 }}>{icons[a.type]}</span>
          <div><span style={{ fontWeight:700, color:colors[a.type] }}>{a.name}</span><span style={{ color:'var(--text-primary)', fontSize:13, marginRight:8 }}>{a.msg}</span></div>
        </div>
      ))}
    </div>
  );
}

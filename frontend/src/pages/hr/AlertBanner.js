// frontend/src/pages/hr/AlertBanner.js
// استُخرج من HRPage.js — تنبيه العلاوات/التقاعد المستحقة أعلى صفحة الموارد البشرية.
import { I18N, monthsAgo, monthsUntil } from './shared';

export default
function AlertBanner({ employees, lang }) {
  const L = (k) => I18N[k]?.[lang] || I18N[k]?.ar || k;
  const alerts = [];
  employees.forEach(e => {
    if (monthsAgo(e.lastAllowance) >= 12)
      alerts.push({ type:'allowance', name:e.name, msg:`${L('alert_allowance')} ${monthsAgo(e.lastAllowance)} ${L('alert_months')}` });
    if (monthsAgo(e.lastPromotion) >= 24)
      alerts.push({ type:'promotion', name:e.name, msg:`${L('alert_promotion')} ${monthsAgo(e.lastPromotion)} ${L('alert_months')}` });
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


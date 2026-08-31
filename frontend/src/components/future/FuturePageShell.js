import React from 'react';

/*
 * CENTRAL GLASS WORKSPACE — يلفّ محتوى أي صفحة عادية (Outlet) عند تفعيل
 * Future Mode (باستثناء / نفسها، التي تعرض FutureHub بدل هذا الإطار —
 * راجع Layout.js). الهدف: حتى الصفحات التي لم تُعَد تصميمها بالكامل بعد
 * (جداول/فورمات 36 صفحة) لا تظهر "عارية" بلا أي هوية Future — تحصل على
 * إطار زجاجي موحّد يضعها داخل نفس لغة "غرفة التحكم" البصرية (بند 13
 * صراحةً)، بصرف النظر عن تصميمها الداخلي الفعلي.
 *
 * زخرفي بحت (توهجان + إطار) — pointer-events:none على كل الطبقات الزخرفية
 * كي لا تتداخل مع أي تفاعل حقيقي داخل الصفحة نفسها.
 */
export default function FuturePageShell({ children }) {
  return (
    <div className="fps-shell">
      <span className="fps-glow fps-glow-a" aria-hidden="true" />
      <span className="fps-glow fps-glow-b" aria-hidden="true" />
      <div className="fps-workspace">
        {children}
      </div>
    </div>
  );
}

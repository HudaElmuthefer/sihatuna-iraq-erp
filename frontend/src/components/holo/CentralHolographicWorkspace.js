import React from 'react';

/*
 * الشاشة الزجاجية المنحنية الكبيرة — تلفّ محتوى أي صفحة موجّهة (Outlet) عند
 * تفعيل الوضع الداكن (باستثناء '/' نفسها، التي تعرض DarkHolographicHome
 * بدل هذا الإطار — راجع Layout.js). الهدف: حتى الصفحات التي لم تُعَد
 * تصميمها بصرياً بالكامل لا تظهر "عارية" بلا أي هوية هولوغرافية. زخرفي بحت
 * (توهجات + إطار + حركة دخول توحي بالوصول من الحلقة) — المحتوى الفعلي
 * (نصوص/جداول/فورمات) يبقى مسطّحاً وواضحاً بلا أي تحريف (بند صريح
 * بالمواصفة: الانحناء إيحاء بصري بالإطار فقط، لا تشويه فعلي للمحتوى).
 */
export default function CentralHolographicWorkspace({ children }) {
  return (
    <div className="chw-shell">
      <span className="chw-glow chw-glow-a" aria-hidden="true" />
      <span className="chw-glow chw-glow-b" aria-hidden="true" />
      <span className="chw-edge-top" aria-hidden="true" />
      <span className="chw-edge-bottom" aria-hidden="true" />
      <div className="chw-workspace">
        {children}
      </div>
    </div>
  );
}

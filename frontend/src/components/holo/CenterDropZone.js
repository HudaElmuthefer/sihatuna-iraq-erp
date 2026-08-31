import React, { forwardRef } from 'react';

/*
 * الهدف الهولوغرافي المغناطيسي بمركز المشهد — يزداد سطوعه أثناء اقتراب
 * اللوحة الأمامية المسحوبة منه (صنف hcd-armed يُضاف/يُزال من HolographicPagePanel
 * مباشرة عبر classList، لا حاجة لإعادة تصيير React على كل حركة مؤشر).
 */
const CenterDropZone = forwardRef(function CenterDropZone({ lang }, ref) {
  return (
    <div ref={ref} className="hcd-zone" aria-hidden="true">
      <span className="hcd-ring hcd-ring-1" />
      <span className="hcd-ring hcd-ring-2" />
      <span className="hcd-label">{lang === 'ar' ? 'اسحب هنا للفتح' : 'Drop here to open'}</span>
    </div>
  );
});

export default CenterDropZone;

// frontend/src/components/PageBanner.js
//
// Shared page-header banner, used by all 36 module pages. Previously each
// page passed its own raw CSS `gradient` (some navy/blue, several orange,
// red or other saturated colors — e.g. PatientsPage.js used
// 'linear-gradient(135deg, #9a3412 0%, #ea580c 100%)'), so the banner had no
// consistent identity of its own and clashed with the glass/glow look
// established elsewhere (sidebar, header, dashboard). Fixed centrally here
// instead of editing 36 files: the banner now renders one of two fixed
// identities based on the current theme (dark futuristic glass/cyan, or
// light pearl/rose-pink/icy-cyan glass — see PageBanner.css), and the
// legacy `gradient` prop (kept for backward compatibility, no caller needs
// to change) is only used to derive a faint per-page accent hue so pages
// don't all look 100% identical, without ever reintroducing a jarring color.
//
// No logo here — the uploaded org logo only ever appears in the sidebar,
// the login page, next to HealthBanner's thin info bar, and the print
// header (see AppLogo.js usages). It does not render inside this banner.
import React, { useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import './PageBanner.css';

// يستخرج أول لون Hex من الـ gradient القديم (إن وُجد) ويمزجه بقوة نحو هوية
// كل ثيم (سماوي للداكن، وردي-سماوي للفاتح) — يمنع أي إمكانية لعودة لون
// برتقالي/أحمر صارخ، مع الإبقاء على لمسة شخصية خفيفة جداً لكل صفحة (بند 28
// من طلب الوضع الداكن، وبند 32 من طلب الوضع الفاتح). لا حاجة لتعديل أي من
// الصفحات الـ36 — القيمة القديمة تُقرأ وتُلطَّف هنا فقط.
function deriveAccentRgb(gradient, accent, isDark) {
  const hex = accent || (typeof gradient === 'string' ? gradient.match(/#([0-9a-fA-F]{6})/)?.[1] : null);
  const fallback = isDark ? '92, 210, 255' : '210, 110, 170';
  if (!hex) return fallback;
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return fallback;
  // مزج 30% من اللون الأصلي مع 70% هوية الثيم — كافٍ لإحساس مختلف طفيف بلا
  // خروج عن العائلة اللونية.
  const blend = (c, target) => Math.round(c * 0.3 + target * 0.7);
  return isDark
    ? `${blend(r, 90)}, ${blend(g, 205)}, ${blend(b, 255)}`
    : `${blend(r, 210)}, ${blend(g, 110)}, ${blend(b, 170)}`;
}

export default function PageBanner({ icon, title, subtitle, gradient, count, children, accent }) {
  const { theme } = useApp();
  const isDark = theme === 'dark';
  const accentRgb = useMemo(() => deriveAccentRgb(gradient, accent, isDark), [gradient, accent, isDark]);
  const suffix = isDark ? 'dark' : 'light';

  return (
    <div className={`page-banner-${suffix}`} style={{ '--pb-accent': accentRgb }}>
      <div className={`page-banner-${suffix}-haze`} aria-hidden="true" />
      <div className={`page-banner-${suffix}-main`}>
        {icon && <span className={`page-banner-${suffix}-icon`}>{icon}</span>}
        <div className={`page-banner-${suffix}-text`}>
          <h1 className={`page-banner-${suffix}-title`}>
            {title}
            {count !== undefined && count !== null && (
              <span className={`page-banner-${suffix}-count`}>{count}</span>
            )}
          </h1>
          {subtitle && <p className={`page-banner-${suffix}-subtitle`}>{subtitle}</p>}
        </div>
      </div>
      {children && (
        <div className={`page-banner-${suffix}-actions`}>
          {children}
        </div>
      )}
    </div>
  );
}

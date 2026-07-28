// frontend/src/components/PageBanner.js
//
// Shared colored page-header banner — replaces three inconsistent patterns
// that existed across pages (inline gradient banners on some pages, a plain
// transparent ".page-header" CSS class on others, and fully custom local
// styles with no color at all on the rest). Every page now gets the same
// layout (icon, title, optional count badge, subtitle, action slot) with a
// per-page gradient identity passed in by the caller.
//
// No logo here — the uploaded org logo only ever appears in the sidebar,
// the login page, next to HealthBanner's thin info bar, and the print
// header (see AppLogo.js usages). It does not render inside this banner.
//
// Text is always white/near-white here deliberately: every gradient passed
// to this component is a dark/saturated color pair (see each page's usage),
// so white text reliably has enough contrast — this isn't computed from the
// gradient because inline CSS gradients aren't introspectable at runtime.
import React from 'react';

export default function PageBanner({ icon, title, subtitle, gradient, count, children }) {
  return (
    <div style={{
      background: gradient,
      borderRadius: 16,
      padding: '24px 28px',
      marginBottom: 24,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {icon && <span style={{ fontSize: 36, flexShrink: 0 }}>{icon}</span>}
        <div>
          {/* color must be set explicitly here (not just on the outer div) —
              index.css has a global `h1{color:var(--text-primary)}` rule that
              otherwise wins over inherited color, since a direct rule always
              beats inheritance regardless of specificity. Same for the <p>
              below (no global rule targets it today, but explicit is safer
              than relying on inheritance holding forever). */}
          <h1 style={{ margin: 0, fontSize: 22, display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
            {title}
            {count !== undefined && count !== null && (
              <span style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', padding: '2px 11px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                {count}
              </span>
            )}
          </h1>
          {subtitle && <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: 13, color: '#fff' }}>{subtitle}</p>}
        </div>
      </div>
      {children && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {children}
        </div>
      )}
    </div>
  );
}

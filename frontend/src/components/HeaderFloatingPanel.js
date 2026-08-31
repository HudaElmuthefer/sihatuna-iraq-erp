import React, { useLayoutEffect, useState } from 'react';
import ReactDOM from 'react-dom';

/*
 * Renders `children` into a React Portal at document.body, positioned to
 * hang below `anchorRef`'s current on-screen rect.
 *
 * Why: .glass-header (Layout.js's top toolbar) has overflow:hidden — needed
 * for its own rounded corners + glowing top edge — which silently clips any
 * dropdown/panel rendered as a normal child of it once the panel extends
 * past the 64px header height (which every one of them does). A portal
 * escapes that clipped box entirely instead of touching the header's own
 * overflow (which would break its corners/edge-glow for everything else).
 *
 * The header itself doesn't scroll with page content (it's a fixed-height
 * flex item; only .page-main below it scrolls), so the anchor rect only
 * needs to be read when the panel opens/the window resizes — not on every
 * scroll tick.
 */
export default function HeaderFloatingPanel({ anchorRef, open, align = 'end', children, className = '', style = {} }) {
  const [rect, setRect] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return undefined;
    const measure = () => setRect(anchorRef.current.getBoundingClientRect());
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, anchorRef]);

  if (!open || !rect) return null;

  // align="end": الحافة اليمنى للوحة تُثبَّت على الحافة اليمنى للـtrigger
  // (تمتد نحو اليسار) — الافتراضي الأنسب لعناصر هذا الشريط (تظهر بصرياً على
  // يسار الشاشة تحت RTL، فتمديد اللوحة يساراً يمنع خروجها من حافة الشاشة).
  // align="start": العكس، الحافة اليسرى تُثبَّت على يسار الـtrigger.
  const horizontal = align === 'end'
    ? { right: Math.max(8, window.innerWidth - rect.right) }
    : { left: Math.max(8, rect.left) };

  return ReactDOM.createPortal(
    <div
      className={className}
      // البوابة (Portal) تُركَّب مباشرة تحت document.body، خارج شجرة
      // .app-shell التي تحمل الاتجاه (direction) الصحيح الفعلي كـinline
      // style — فبلا هذا السطر يعتمد اتجاه اللوحة على وراثة <html>/<body>
      // فقط، وهو ما كان يُجمَّد خطأً على rtl دائماً (راجع الشرح بجانب قاعدة
      // html بـindex.css). قراءة صريحة هنا تضمن الاتجاه الصحيح دائماً بصرف
      // النظر عن أي وراثة CSS خارجية — تشمل كل لوحة تستخدم هذا المكوّن
      // (القوائم المنسدلة، الإشعارات، نتائج البحث) لا رقعة خاصة بواحدة منها.
      dir={document.documentElement.dir === 'ltr' ? 'ltr' : 'rtl'}
      style={{
        position: 'fixed',
        top: rect.bottom + 8,
        ...horizontal,
        zIndex: 2000,
        ...style,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

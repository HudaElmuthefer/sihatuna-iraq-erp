import { useEffect } from 'react';

// .stat-card انتُزع من هذه القائمة عمداً — CSS يضع cursor:default عليها
// (معلوماتية غير قابلة للنقر)، فلا تُطبَّق أي استجابة نقر لا هنا ولا بحلقة
// الفحص بـFuturisticCursor.js، تماشياً مع "لا تطبّق التأثير على عنصر غير
// تفاعلي". .dqt-tile (المستندات/المشاريع/المواعيد/المخزون) و
// .health-hero-customize كانا المرجع الأساسي لهذا التأثير لكن لم يكونا
// مضمَّنين به فعلياً — أُضيفا هنا. button/a/[role="button"] تغطي العناصر
// الطبيعية القابلة للتفاعل بالكامل بلا حاجة لتوصيل كل صفحة يدوياً.
const RIPPLE_SELECTOR = '.btn, .card, .sidebar-nav-item, .page-btn, .dqt-tile, .health-hero-customize, .header-dropdown-option, button, a, [role="button"], [data-ripple]';

/*
 * One document-level pointerdown listener injects a .ripple-effect span
 * into whichever ripple-eligible element was pressed, sized to cover it and
 * positioned at the exact click point. Call once at the app root (see
 * App.js) — every button/card/sidebar-item on every page gets the effect
 * for free, no per-page wiring needed.
 *
 * Relies on the target having `position: relative; overflow: hidden`,
 * already set on all RIPPLE_SELECTOR classes in index.css.
 */
export default function useRippleEffect() {
  useEffect(() => {
    const handlePointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const target = e.target.closest ? e.target.closest(RIPPLE_SELECTOR) : null;
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.8;
      const span = document.createElement('span');
      span.className = 'ripple-effect';
      span.style.width = `${size}px`;
      span.style.height = `${size}px`;
      span.style.left = `${e.clientX - rect.left - size / 2}px`;
      span.style.top = `${e.clientY - rect.top - size / 2}px`;
      target.appendChild(span);
      span.addEventListener('animationend', () => span.remove(), { once: true });
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);
}

/*
 * Generic, structural scrollbar detection — works on ANY scrollable element
 * in the app (dropdowns, tables, modals, the sidebar nav, the page's own
 * .page-main) without needing a dedicated class or per-component wiring.
 * "Scrollable" is derived purely from scrollHeight/scrollWidth vs the
 * client box + the element's own computed overflow — not a hardcoded list.
 *
 * RTL-aware: a vertical scrollbar sits on the LEFT of its element when that
 * element's own computed `direction` is rtl (this app toggles direction at
 * runtime via the language switch), on the RIGHT otherwise. Never assumed.
 */

const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll']);

export function isScrollableY(el) {
  if (!el || !(el instanceof Element)) return false;
  return el.scrollHeight > el.clientHeight + 1 && SCROLLABLE_OVERFLOW.has(getComputedStyle(el).overflowY);
}

export function isScrollableX(el) {
  if (!el || !(el instanceof Element)) return false;
  return el.scrollWidth > el.clientWidth + 1 && SCROLLABLE_OVERFLOW.has(getComputedStyle(el).overflowX);
}

/* أقرب سلف (أو العنصر نفسه) قابل فعلياً للتمرير — يتوقف عند documentElement،
   ثم يتحقق من الصفحة نفسها (.page-main يقع ضمنها فيُكتشَف أثناء الصعود
   غالباً قبل الوصول لهذه النقطة أصلاً). */
export function findScrollableAncestor(el) {
  let node = el;
  while (node && node !== document.documentElement) {
    if (isScrollableY(node) || isScrollableX(node)) return node;
    node = node.parentElement;
  }
  if (isScrollableY(document.documentElement) || isScrollableX(document.documentElement)) {
    return document.documentElement;
  }
  return null;
}

/*
 * هل (x, y) داخل منطقة اكتشاف شريط تمرير `el` (رأسي و/أو أفقي)؟ hitZone
 * أكبر قليلاً من عرض الشريط الحقيقي عمداً (بند 8) — سهولة استخدام، وليس
 * دقة بكسل مطلقة.
 */
export function scrollbarProximity(el, x, y, hitZone) {
  if (!el) return { vertical: false, horizontal: false };
  const rect = el.getBoundingClientRect();
  const rtl = getComputedStyle(el).direction === 'rtl';

  let vertical = false;
  if (isScrollableY(el)) {
    const edgeX = rtl ? rect.left : rect.right;
    vertical = Math.abs(x - edgeX) <= hitZone && y >= rect.top - hitZone && y <= rect.bottom + hitZone;
  }

  let horizontal = false;
  if (isScrollableX(el)) {
    horizontal = Math.abs(y - rect.bottom) <= hitZone && x >= rect.left - hitZone && x <= rect.right + hitZone;
  }

  return { vertical, horizontal };
}

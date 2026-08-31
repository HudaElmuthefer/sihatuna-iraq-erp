/*
 * Generic, structural scrollbar detection — works on ANY scrollable element
 * in the app (dropdowns, tables, modals, the sidebar nav, the page's own
 * .page-main) without needing a dedicated class or per-component wiring.
 * "Scrollable" is derived purely from scrollHeight/scrollWidth vs the
 * client box + the element's own computed overflow — not a hardcoded list.
 *
 * PRE-ARM MODEL (rewritten — the previous "detect the thumb" approach was
 * unreliable in practice, per live testing): a native scrollbar thumb is
 * NOT a real DOM node — event.target/elementFromPoint over it can behave
 * inconsistently across engines/OS scrollbar styles. So this module never
 * tries to detect the thumb itself. Instead it only ever measures the
 * pointer's distance to the SCROLLABLE ELEMENT'S OWN bounding-box edge
 * (the edge the scrollbar visually sits against) and lets the caller
 * (FuturisticCursor.js) arm "native cursor mode" *before* the pointer ever
 * reaches the real scrollbar — see scrollbarZoneState()'s `zone` param.
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
   ثم يتحقق من الصفحة نفسها. */
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
 * أي جانب يقع عليه الشريط العمودي فعلياً — لا تُفترض من direction وحدها
 * (بند 5 صراحةً بالطلب): clientLeft يشمل عرض الشريط نفسه (وليس فقط الحد)
 * عندما يقع على اليسار (سلوك موثَّق بـChromium/Firefox لعنصر RTL بشريط
 * أيسر) — فإذا كان clientLeft أكبر بوضوح من عرض الحد الأيسر المُصرَّح به،
 * فهذا دليل فعلي (وليس افتراضاً) على أن الشريط يستهلك تلك المساحة يساراً.
 * direction تبقى fallback فقط عند غياب أي دليل حاسم.
 */
export function getVerticalScrollbarSide(el) {
  if (!el) return 'right';
  const style = getComputedStyle(el);
  const borderLeft = parseFloat(style.borderLeftWidth) || 0;
  if (el.clientLeft > borderLeft + 1) return 'left';
  const borderRight = parseFloat(style.borderRightWidth) || 0;
  // بعض المتصفحات تُبلغ عبر الحد الأيمن بدل الأيسر لعناصر معيّنة — تحقّق
  // مقابل لتفادي false negative فقط لأننا فحصنا جهة واحدة.
  const clientRightGap = el.offsetWidth - el.clientWidth - el.clientLeft;
  if (clientRightGap > borderRight + 1 && style.direction !== 'rtl') return 'right';
  return style.direction === 'rtl' ? 'left' : 'right';
}

export function getScrollbarWidth(el) {
  if (!el) return 0;
  return Math.max(0, el.offsetWidth - el.clientWidth);
}

/*
 * حالة "منطقة شريط التمرير" عند نقطة (x, y) بالنسبة لعنصر `el` — تُقاس
 * دائماً مقابل الصندوق المحيط (getBoundingClientRect) الخاص بالعنصر
 * القابل للتمرير نفسه، لا مقابل أي محاولة لتحديد الـthumb. `zone` يحدّد
 * مدى الحساسية (مساحة "ما قبل التفعيل" قبل الوصول الفعلي للشريط — بند 4).
 */
export function scrollbarZoneState(el, x, y, zone) {
  if (!el) return { vertical: false, horizontal: false, side: null, distance: Infinity };
  const rect = el.getBoundingClientRect();

  let vertical = false;
  let side = null;
  let distance = Infinity;
  if (isScrollableY(el)) {
    side = getVerticalScrollbarSide(el);
    distance = side === 'left' ? (x - rect.left) : (rect.right - x);
    vertical = distance <= zone && y >= rect.top - zone && y <= rect.bottom + zone;
  }

  let horizontal = false;
  let hDistance = Infinity;
  if (isScrollableX(el)) {
    hDistance = rect.bottom - y;
    horizontal = hDistance <= zone && x >= rect.left - zone && x <= rect.right + zone;
    if (hDistance < distance) distance = hDistance;
  }

  return { vertical, horizontal, side, distance };
}

// يُبقي القياس بعيداً عن الصندوق الحقيقي (لا يفترض عرض شريط ثابت 5px/10px،
// بند 7 صراحةً) — يُستخدَم لضبط منطقة "ما قبل التفعيل" الفعلية بإضافة عرض
// الشريط الحقيقي المقاس فوق مساحة إضافية ثابتة.
export function computeActivationZone(el, extraPx) {
  const scrollbarWidth = getScrollbarWidth(el);
  return Math.max(scrollbarWidth, 8) + extraPx;
}

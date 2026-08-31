import React, { useEffect, useRef, useState, useCallback, useId } from 'react';

/*
 * استراتيجية جديدة كلياً لسحب القوائم المنسدلة الطويلة — تستبدل كل محاولات
 * اكتشاف/تلوين مؤشر الـnative scrollbar (لم تنجح عملياً رغم عدة محاولات).
 * بدلاً من ذلك: عنصر UI حقيقي مملوك بالكامل (rail + tab)، يعكس scrollTop
 * الفعلي ويكتبه مباشرة عند السحب، بينما يبقى native scroll الحقيقي
 * (wheel/touchpad/keyboard/PageUp/Home...) يعمل في الخلفية بلا أي تدخّل —
 * لا preventDefault على wheel، لا محاكاة تمرير عبر JS.
 *
 * الاستخدام: يُركَّب كابن مباشر لعنصر بـposition:relative يحيط بالحاوية
 * القابلة للتمرير (أو داخل الحاوية نفسها إن كانت هي المُموضِعة)، مع تمرير
 * ref يشير إلى عقدة الـDOM الفعلية القابلة للتمرير:
 *
 *   <div ref={panelRef} className="header-dropdown-panel hsh-hide-native-scrollbar">
 *     ...options...
 *   </div>
 *   <HolographicScrollHandle targetRef={panelRef} side="left" />
 *
 * `side`: 'left' | 'right' — الحافة الفعلية التي يظهر عليها الـrail (مرّرها
 * صراحةً من المستدعي بحسب RTL/LTR الفعلي لديه، بدل تخمينها هنا).
 *
 * لا يُصيَّر شيء إطلاقاً إذا لم يكن هناك overflow فعلي (بند 18/39 بالطلب).
 */

const MIN_THUMB_PX = 30; // ضمن مدى 28-36px المطلوب — سهل الإمساك دائماً

export default function HolographicScrollHandle({ targetRef, side = 'left' }) {
  // role="scrollbar" يتطلّب aria-controls بمعرّف العنصر المُتحكَّم بتمريره —
  // يُولَّد ويُضبَط على العنصر الهدف نفسه إن لم يحمل id أصلاً (أدناه)، بدل
  // مطالبة كل مستدعٍ بإضافة id يدوياً.
  const reactId = useId();
  const generatedIdRef = useRef(`hsh-scroll-${reactId.replace(/:/g, '')}`);
  const trackRef = useRef(null);
  const thumbRef = useRef(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ y: 0, scrollTop: 0 });
  const suspendedRef = useRef(false);

  const [visible, setVisible] = useState(false);
  const [metrics, setMetrics] = useState({ height: MIN_THUMB_PX, top: 0, max: 0, now: 0 });

  const recompute = useCallback(() => {
    const el = targetRef.current;
    const track = trackRef.current;
    if (!el) return;
    const { scrollHeight, clientHeight, scrollTop } = el;
    const overflow = scrollHeight > clientHeight + 1;
    setVisible(overflow);
    if (!overflow || !track) return;
    const trackHeight = track.clientHeight;
    const ratio = clientHeight / scrollHeight;
    const thumbHeight = Math.max(MIN_THUMB_PX, Math.round(trackHeight * ratio));
    const maxScroll = scrollHeight - clientHeight;
    const scrollRatio = maxScroll > 0 ? scrollTop / maxScroll : 0;
    const availableTrack = Math.max(0, trackHeight - thumbHeight);
    const thumbTop = Math.round(scrollRatio * availableTrack);
    setMetrics({ height: thumbHeight, top: thumbTop, max: maxScroll, now: scrollTop });
  }, [targetRef]);

  // يتزامن Tab مع أي سبب للتمرير — سحب، عجلة، لوحة مفاتيح، touchpad، أو
  // تمرير برمجي (scrollTop مباشرة) — بند 43 صراحةً: مستمع scroll واحد يغطي
  // الجميع، بلا تمييز بين المصدر.
  useEffect(() => {
    const el = targetRef.current;
    if (!el) return undefined;
    if (!el.id) el.id = generatedIdRef.current;
    recompute();
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = null; recompute(); });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => recompute()) : null;
    ro?.observe(el);
    // محتوى ديناميكي (نتائج بحث/فلاتر) قد يغيّر scrollHeight بلا تغيّر
    // بأبعاد العنصر نفسه، فلا يكفي ResizeObserver وحده.
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => recompute()) : null;
    mo?.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [targetRef, recompute]);

  const suspendCursor = () => {
    if (suspendedRef.current) return;
    suspendedRef.current = true;
    document.documentElement.classList.add('custom-cursor-suspended');
  };
  const restoreCursor = () => {
    if (!suspendedRef.current) return;
    suspendedRef.current = false;
    document.documentElement.classList.remove('custom-cursor-suspended');
  };
  useEffect(() => () => restoreCursor(), []);

  const onTabPointerDown = (e) => {
    const el = targetRef.current;
    if (!el || !trackRef.current) return;
    e.preventDefault();
    draggingRef.current = true;
    dragStartRef.current = { y: e.clientY, scrollTop: el.scrollTop };
    suspendCursor();
    thumbRef.current?.classList.add('hsh-tab-dragging');
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  // 1:1، مباشر، بلا أي تنعيم/تأخير (بند 16 صراحةً) — كتابة scrollTop مباشرة
  // على العنصر الحقيقي؛ إعادة حساب الـthumb تتم عبر مستمع الـscroll أعلاه
  // (المُجدوَل بـrAF بالفعل)، لا تكرار للمنطق هنا.
  const onTabPointerMove = (e) => {
    if (!draggingRef.current) return;
    const el = targetRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const trackHeight = track.clientHeight;
    const availableTrack = Math.max(1, trackHeight - metrics.height);
    const maxScroll = el.scrollHeight - el.clientHeight;
    const deltaY = e.clientY - dragStartRef.current.y;
    const deltaScroll = (deltaY / availableTrack) * maxScroll;
    el.scrollTop = dragStartRef.current.scrollTop + deltaScroll;
  };

  const endDrag = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    thumbRef.current?.classList.remove('hsh-tab-dragging');
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    // بعد الإفلات: يبقى Native فقط إذا كان المؤشر لا يزال هندسياً فوق الـtab
    // (بند 17 بالطلب) — وإلا يعود الهولوغرافي فوراً دون انتظار مغادرة كامل
    // القائمة.
    const rect = thumbRef.current?.getBoundingClientRect();
    const stillOver = rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!stillOver) restoreCursor();
  };

  const onTabPointerEnter = () => suspendCursor();
  const onTabPointerLeave = () => { if (!draggingRef.current) restoreCursor(); };

  if (!visible) return null;

  return (
    <div ref={trackRef} className={`hsh-rail ${side === 'right' ? 'hsh-rail-right' : 'hsh-rail-left'}`}>
      <div
        ref={thumbRef}
        className="hsh-tab"
        style={{ height: metrics.height, transform: `translateY(${metrics.top}px)` }}
        role="scrollbar"
        aria-orientation="vertical"
        aria-controls={targetRef.current?.id || generatedIdRef.current}
        aria-valuemin={0}
        aria-valuemax={metrics.max}
        aria-valuenow={metrics.now}
        onPointerDown={onTabPointerDown}
        onPointerMove={onTabPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerEnter={onTabPointerEnter}
        onPointerLeave={onTabPointerLeave}
      >
        <span className="hsh-tab-core" />
      </div>
    </div>
  );
}

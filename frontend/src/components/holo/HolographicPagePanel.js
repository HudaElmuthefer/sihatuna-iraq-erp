import React, { useRef, useState, useEffect } from 'react';
import { lerpSlot, slotToPixels, STAGE_PERSPECTIVE, FORWARD_BASE } from '../../utils/holographicSlots';
import { createVelocityTracker } from '../../utils/interactionVelocity';
import { startDragSound, updateDragSound, stopDragSound, playSnap } from '../../utils/holographicSound';

const CLICK_MOVE_THRESHOLD = 6; // px — أقل من هذا يُحتسب نقراً، أكثر يُحتسب سحباً
const FRONT_SCALE = 1.03;

/*
 * معمارية ثلاثية الطبقات المتداخلة (بند صريح بالمواصفة — Part B/7: "Use
 * nested wrappers"، لا transform واحد يخدم غرضين متعارضين):
 *
 *   .hpp            (OUTER)  — هندسة الفتحة على الحلقة فقط (slotToPixels:
 *                               translateX/Y/Z + rotateY + scale). تبقى
 *                               ثابتة تماماً أثناء سحب اللوحة نحو المركز —
 *                               لا تُعاد حسابها من selectedIndex أثناء ذلك
 *                               (بند 9/10 صراحةً).
 *   .hpp-drag-layer  (MIDDLE) — إزاحة السحب المؤقتة فقط (identity حين لا
 *                               يوجد سحب). transition:none أثناء السحب
 *                               المباشر (بند 11)، تعود cinematic عند الإفلات.
 *   .hpp-surface     (INNER)  — الزجاج المنحني/الإضاءة/الحوم — لا صلة لها
 *                               بالموضع أو السحب إطلاقاً.
 *
 * لماذا كانت اللوحة "تهرب من المؤشر" سابقاً: طبقة السحب القديمة كانت تستبدل
 * transform الفتحة بالكامل (تُسقِط translateZ/rotateY فجأة) بينما OUTER
 * متداخلة داخل .hpr-stage ذات perspective — إزاحة px خام محلياً عند عمق Z
 * غير صفري تحت perspective تتضخّم بصرياً (foreshortening) بمعامل ثابت
 * (perspective/(perspective-z))، فتتحرك اللوحة أسرع من المؤشر الفعلي تراكمياً.
 * الحل: عمق Z الأمامية ثابت معروف مسبقاً (FORWARD_BASE+34)، فنُعوِّض عنه
 * حسابياً مرة واحدة (perspFactor أدناه) بدل تفكيك/فقدان عمق الفتحة أصلاً.
 */
const FRONT_Z_PX = FORWARD_BASE + 34; // isFront bump — راجع holographicSlots.js/slotToPixels
const PERSP_FACTOR = (STAGE_PERSPECTIVE - FRONT_Z_PX) / STAGE_PERSPECTIVE;

export default function HolographicPagePanel({
  page, rel, geometry, isFront, isOpening, isDragCandidate,
  onSelect, onOpen, dropZoneRef, lang, tetherApi, stageRef,
}) {
  const panelRef = useRef(null);
  const surfaceRef = useRef(null);
  const pointerStart = useRef(null);
  const velocityTracker = useRef(null);
  const [centerDrag, setCenterDrag] = useState(null); // {x,y} إزاحة خام (شاشة px) أثناء سحب اللوحة الأمامية نحو المركز
  const [magnetActive, setMagnetActive] = useState(false);
  const [snapFlash, setSnapFlash] = useState(false);
  const rafPending = useRef(false);
  const wasFrontRef = useRef(isFront);

  const handleMouseMove = (e) => {
    if (rafPending.current || !surfaceRef.current) return;
    rafPending.current = true;
    const clientX = e.clientX, clientY = e.clientY;
    requestAnimationFrame(() => {
      rafPending.current = false;
      const el = surfaceRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * 100;
      const py = ((clientY - r.top) / r.height) * 100;
      el.style.setProperty('--pointer-x', `${px}%`);
      el.style.setProperty('--pointer-y', `${py}%`);
    });
  };

  useEffect(() => {
    if (isFront && !wasFrontRef.current) {
      setSnapFlash(true);
      const t = window.setTimeout(() => setSnapFlash(false), 340);
      wasFrontRef.current = true;
      return () => window.clearTimeout(t);
    }
    wasFrontRef.current = isFront;
    return undefined;
  }, [isFront]);

  const slot = lerpSlot(rel);
  const px = slotToPixels(slot, geometry, isFront);
  const absRel = Math.abs(rel);

  const opacity = absRel < 0.5 ? 1 : Math.max(0.6, 0.95 - absRel * 0.13);
  const zIndex = 1000 - Math.round(absRel * 10);
  const brightness = isFront ? 1.08 : Math.max(0.75, 1 - absRel * 0.1);

  const label = lang === 'ar' ? page.label : (page.labelEn || page.label);
  const PreviewComponent = page.PreviewComponent;

  const outerScale = px.scale * (isFront ? FRONT_SCALE : 1);
  const outerTransform = `translate(-50%, -50%) translateX(${px.xPx}px) translateY(${px.yPx}px) translateZ(${px.zPx}px) rotateY(${px.rotY}deg) scale(${outerScale})`;

  // نقطة إمساك الحبل — أقرب لأيقونة/عقدة الطاقة أعلى-يسار اللوحة (بند 27:
  // "Prefer the page icon / energy node"؛ استعلام DOM دقيق عن الأيقونة غير
  // ضروري — موضعها ثابت هيكلياً داخل PreviewHeader).
  const iconAnchorRef = useRef({ x: 34, y: 30 });

  const clearTether = () => tetherApi?.current?.hideTether();

  const handlePointerDown = (e) => {
    if (isFront) e.stopPropagation();
    pointerStart.current = { x: e.clientX, y: e.clientY, moved: false, dragging: false };
    velocityTracker.current = createVelocityTracker();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const handlePointerMove = (e) => {
    if (isFront) e.stopPropagation();
    const st = pointerStart.current;
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (!st.moved && Math.hypot(dx, dy) > CLICK_MOVE_THRESHOLD) st.moved = true;
    if (isFront && st.moved) {
      if (!st.dragging) {
        st.dragging = true;
        startDragSound();
        document.documentElement.classList.add('holo-cursor-grab');
        dropZoneRef.current?.classList.add('hcd-visible');
      }
      setCenterDrag({ x: dx, y: dy });
      const zoneRect = dropZoneRef.current?.getBoundingClientRect();
      const panelRect = panelRef.current?.getBoundingClientRect();
      if (zoneRect && panelRect) {
        const cx = panelRect.left + panelRect.width / 2;
        const cy = panelRect.top + panelRect.height / 2;
        const inside = cx >= zoneRect.left && cx <= zoneRect.right && cy >= zoneRect.top && cy <= zoneRect.bottom;
        setMagnetActive(inside);
        dropZoneRef.current?.classList.toggle('hcd-armed', inside);
      }
      // سرعة مُطبَّعة واحدة تُغذّي الصوت والحبل معاً (بند 52 صراحةً).
      const v = velocityTracker.current.update(e.clientX, e.clientY);
      updateDragSound(v, e.clientX, stageRef.current?.clientWidth || window.innerWidth);
      const anchorRect = panelRef.current?.getBoundingClientRect();
      const stageRect = stageRef?.current?.getBoundingClientRect();
      if (anchorRect && stageRect && tetherApi?.current) {
        // إحداثيات نسبية لصندوق المسرح نفسه (لا viewport مباشرة) — الوشاح
        // SVG مموضَع position:absolute داخل .hpr-stage بلا viewBox، فوحدة
        // المستخدم = px نسبية لصندوقه هو، لا لكامل الصفحة.
        const ax = anchorRect.left + iconAnchorRef.current.x - stageRect.left;
        const ay = anchorRect.top + iconAnchorRef.current.y - stageRect.top;
        const px2 = e.clientX - stageRect.left;
        const py2 = e.clientY - stageRect.top;
        tetherApi.current.showTether(ax, ay, px2, py2, v);
      }
    }
  };

  const handlePointerUp = (e) => {
    if (isFront) e.stopPropagation();
    const st = pointerStart.current;
    pointerStart.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!st) return;
    dropZoneRef.current?.classList.remove('hcd-armed', 'hcd-visible');
    if (st.dragging) {
      document.documentElement.classList.remove('holo-cursor-grab');
      stopDragSound();
      clearTether();
      const wasMagnet = magnetActive;
      setCenterDrag(null);
      setMagnetActive(false);
      if (wasMagnet) { playSnap(); onOpen(); return; }
      return; // سحب بلا وصول للمنطقة المركزية → يرتد للحلقة (transform الأصلي يعود تلقائياً)
    }
    if (!st.moved) {
      e.stopPropagation();
      if (isFront) onOpen(); else onSelect();
    }
  };

  const handlePointerCancel = (e) => {
    if (pointerStart.current?.dragging) {
      document.documentElement.classList.remove('holo-cursor-grab');
      stopDragSound();
      clearTether();
    }
    handlePointerUp(e);
  };

  // MIDDLE — إزاحة السحب المُعوَّضة (بند 9 صراحةً: dragX/dragY خام من
  // الفرق بالمؤشر)، مُصحَّحة بمعامل perspective ثابت (PERSP_FACTOR) حتى
  // تبقى اللوحة تحت المؤشر تماماً رغم عمقها Z غير الصفري ضمن سلسلة
  // preserve-3d — راجع الشرح أعلى الملف.
  const dragLayerTransform = centerDrag
    ? `translate(${centerDrag.x * PERSP_FACTOR / FRONT_SCALE}px, ${centerDrag.y * PERSP_FACTOR / FRONT_SCALE}px) scale(${magnetActive ? 1.16 : 1.05})`
    : undefined;

  return (
    <div
      ref={panelRef}
      className={[
        'hpp',
        isFront ? 'hpp-front' : '',
        isOpening ? 'hpp-opening' : '',
        isDragCandidate ? 'hpp-draggable' : '',
        snapFlash ? 'hpp-snap-flash' : '',
      ].filter(Boolean).join(' ')}
      style={{
        width: px.w,
        height: px.h,
        transform: outerTransform,
        opacity: isOpening ? 1 : opacity,
        zIndex: centerDrag ? 2000 : (isFront ? 999 : zIndex),
        filter: `brightness(${brightness})`,
        cursor: isFront ? 'grab' : 'pointer',
      }}
      role="button"
      tabIndex={-1}
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div
        className={`hpp-drag-layer ${centerDrag ? 'hpp-drag-active' : ''} ${magnetActive ? 'hpp-drag-magnet' : ''}`}
        style={{ transform: dragLayerTransform }}
      >
        <div ref={surfaceRef} className="hpp-surface" onMouseMove={handleMouseMove}>
          <span className="hpp-wing hpp-wing-left" aria-hidden="true" />
          <span className="hpp-wing hpp-wing-right" aria-hidden="true" />
          <span className="hpp-edge-top" aria-hidden="true" />
          <span className="hpp-edge-bottom" aria-hidden="true" />
          <span className="hpp-reflection" aria-hidden="true" />
          <span className="hpp-pointer-glow" aria-hidden="true" />
          <span className="hpp-icon-node" aria-hidden="true" />
          <PreviewComponent page={page} lang={lang} />
        </div>
      </div>
    </div>
  );
}

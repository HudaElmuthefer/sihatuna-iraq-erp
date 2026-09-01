import React, { useRef, useState, useEffect } from 'react';
import { lerpSlot, slotToPixels, STAGE_PERSPECTIVE, FORWARD_BASE } from '../../utils/holographicSlots';
import { createVelocityTracker } from '../../utils/interactionVelocity';
import { startDragSound, updateDragSound, stopDragSound, setDragProximity, playSnap, playReturn } from '../../utils/holographicSound';

const CLICK_MOVE_THRESHOLD = 6; // px — أقل من هذا يُحتسب نقراً، أكثر يُحتسب سحباً
const FRONT_SCALE = 1.03;
// عتبات القرب من المستقبِل — بند صريح (Part 3/14): FAR / NEAR / LOCKED، لا
// حالة ثنائية (inside/outside) بعد الآن. المسافة تُقاس بين مركز اللوحة
// المسحوبة ومركز منطقة الإفلات.
const NEAR_DISTANCE = 180;
const LOCKED_DISTANCE = 90;

/*
 * معمارية ثلاثية الطبقات المتداخلة (بند صريح — Part 8: "Use nested
 * wrappers"، لا transform واحد يخدم غرضين متعارضين):
 *
 *   .hpp            (OUTER)  — هندسة الفتحة على الحلقة فقط. ثابتة تماماً
 *                               أثناء سحب اللوحة نحو المركز.
 *   .hpp-drag-layer  (MIDDLE) — إزاحة السحب المؤقتة فقط (ترجمة صرفة بمقدار
 *                               فرق المؤشر منذ pointerdown — بند 6/7: نقطة
 *                               الإمساك تبقى بالضبط تحت المؤشر، لا "تصحيح"
 *                               نحو المركز؛ ولا scale أثناء السحب الحر بعد
 *                               الآن — bند 2 صراحةً: أي scale مركزي كان
 *                               يُزيح أي نقطة إمساك غير مركزية بمقدار نسبة
 *                               التكبير). transition:none أثناء السحب.
 *   .hpp-surface     (INNER)  — الزجاج المنحني/الإضاءة/الحوم فقط.
 */
const FRONT_Z_PX = FORWARD_BASE + 34;
const PERSP_FACTOR = (STAGE_PERSPECTIVE - FRONT_Z_PX) / STAGE_PERSPECTIVE;

export default function HolographicPagePanel({
  page, rel, geometry, isFront, isOpening, isDragCandidate,
  onSelect, onOpen, dropZoneRef, lang, tetherApi, stageRef, interactionModeRef, cancelPageDragRef,
}) {
  const panelRef = useRef(null);
  const surfaceRef = useRef(null);
  const pointerStart = useRef(null);
  const velocityTracker = useRef(null);
  const [centerDrag, setCenterDrag] = useState(null); // {x,y} إزاحة خام (شاشة px) أثناء سحب اللوحة الأمامية نحو المركز
  const [proximity, setProximity] = useState('far'); // 'far' | 'near' | 'locked'
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

  // نقطة إمساك الحبل — أقرب لأيقونة/عقدة الطاقة أعلى-يسار اللوحة (بند 22:
  // "if pointerdown happened on panel: laser starts from the exact visual
  // grab point"؛ نستخدم نقطة الإمساك الفعلية إن كانت داخل حدود اللوحة، وإلا
  // (نادراً) نرجع لعقدة الأيقونة الثابتة كحل احتياطي).
  const iconAnchorRef = useRef({ x: 34, y: 30 });
  const grabPointRef = useRef(null); // {x,y} نسبةً لأعلى-يسار اللوحة، عند pointerdown

  const clearTether = () => tetherApi?.current?.hideTether();

  const finishDrag = ({ dock }) => {
    document.documentElement.classList.remove('holo-cursor-grab');
    stopDragSound();
    clearTether();
    setDragProximity('far');
    dropZoneRef.current?.classList.remove('hcd-near', 'hcd-locked', 'hcd-visible');
    if (interactionModeRef) interactionModeRef.current = 'idle';
    cancelPageDragRef && (cancelPageDragRef.current = null);
    setCenterDrag(null);
    setProximity('far');
    if (dock) { playSnap(); onOpen(); } else { playReturn(); }
  };

  const handlePointerDown = (e) => {
    if (isFront) e.stopPropagation();
    if (interactionModeRef && interactionModeRef.current !== 'idle') return; // بند 4/5: قفل الوضع حتى pointerup
    const rect = panelRef.current?.getBoundingClientRect();
    grabPointRef.current = rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : { x: 0, y: 0 };
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
        if (interactionModeRef) interactionModeRef.current = 'page-drag';
        if (cancelPageDragRef) cancelPageDragRef.current = () => finishDrag({ dock: false });
        startDragSound('page');
        document.documentElement.classList.add('holo-cursor-grab');
        dropZoneRef.current?.classList.add('hcd-visible');
      }
      setCenterDrag({ x: dx, y: dy });
      // بند حرج: panelRef يشير للطبقة OUTER (هندسة الفتحة الثابتة — لا
      // تتحرك أثناء السحب بتصميم العمارة نفسها، بند 9/10). قياس القرب من
      // المستقبِل يجب أن يُبنى على الموضع البصري الفعلي المتحرّك فعلاً —
      // surfaceRef (INNER)، الذي يتضمّن كل تحويلات الأسلاف بما فيها إزاحة
      // .hpp-drag-layer. استخدام panelRef هنا كان يُنتِج LOCKED زائفاً دائماً
      // (يقيس مسافة الفتحة الساكنة القريبة أصلاً من المركز، لا اللوحة
      // المسحوبة فعلياً) — خلل حقيقي مكتشَف بالتحقق المباشر.
      const zoneRect = dropZoneRef.current?.getBoundingClientRect();
      const surfaceRect = surfaceRef.current?.getBoundingClientRect();
      let tier = 'far';
      if (zoneRect && surfaceRect) {
        const cx = surfaceRect.left + surfaceRect.width / 2;
        const cy = surfaceRect.top + surfaceRect.height / 2;
        const zx = zoneRect.left + zoneRect.width / 2;
        const zy = zoneRect.top + zoneRect.height / 2;
        const dist = Math.hypot(cx - zx, cy - zy);
        tier = dist <= LOCKED_DISTANCE ? 'locked' : dist <= NEAR_DISTANCE ? 'near' : 'far';
        setProximity(tier);
        setDragProximity(tier);
        dropZoneRef.current?.classList.toggle('hcd-near', tier === 'near');
        dropZoneRef.current?.classList.toggle('hcd-locked', tier === 'locked');
      }
      // سرعة مُطبَّعة واحدة تُغذّي الصوت والحبل معاً (بند 41 صراحةً).
      const v = velocityTracker.current.update(e.clientX, e.clientY);
      updateDragSound(v, e.clientX, stageRef.current?.clientWidth || window.innerWidth);
      const anchorRect = surfaceRect;
      const stageRect = stageRef?.current?.getBoundingClientRect();
      if (anchorRect && stageRect && tetherApi?.current) {
        // إحداثيات نسبية لصندوق المسرح نفسه — الوشاح SVG مموضَع
        // position:absolute داخل .hpr-stage بلا viewBox.
        const grab = grabPointRef.current || iconAnchorRef.current;
        const ax = anchorRect.left + grab.x - stageRect.left;
        const ay = anchorRect.top + grab.y - stageRect.top;
        const px2 = e.clientX - stageRect.left;
        const py2 = e.clientY - stageRect.top;
        const tierBoost = tier === 'locked' ? 1 : tier === 'near' ? 0.5 : 0;
        tetherApi.current.showTether(ax, ay, px2, py2, Math.max(v, tierBoost));
      }
    }
  };

  const handlePointerUp = (e) => {
    if (isFront) e.stopPropagation();
    const st = pointerStart.current;
    pointerStart.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!st) return;
    if (st.dragging) {
      // بند 18/21 صراحةً: الفتح مشروط فقط بـ"مُقفَل فعلياً عند الإفلات" —
      // لا فتح لمجرد وقوع pointerup بعد سحب، ولا فتح مبكر عن بُعد.
      finishDrag({ dock: proximity === 'locked' });
      return;
    }
    if (!st.moved) {
      e.stopPropagation();
      if (isFront) onOpen(); else onSelect();
    }
  };

  const handlePointerCancel = (e) => {
    if (pointerStart.current?.dragging) finishDrag({ dock: false });
    pointerStart.current = null;
    try { e.currentTarget?.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
  };

  // MIDDLE — إزاحة السحب الخام (بند 6/7 صراحةً: ترجمة صرفة بمقدار فرق
  // المؤشر منذ pointerdown، بلا أي scale أثناء السحب الحر — نقطة الإمساك
  // تبقى بالضبط تحت المؤشر). مُصحَّحة بمعامل perspective ثابت (PERSP_FACTOR)
  // حتى تبقى اللوحة تحت المؤشر تماماً رغم عمقها Z غير الصفري ضمن سلسلة
  // preserve-3d — راجع الشرح أعلى الملف.
  const dragLayerTransform = centerDrag
    ? `translate(${centerDrag.x * PERSP_FACTOR / FRONT_SCALE}px, ${centerDrag.y * PERSP_FACTOR / FRONT_SCALE}px)`
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
      onLostPointerCapture={handlePointerCancel}
    >
      <div
        className={[
          'hpp-drag-layer',
          centerDrag ? 'hpp-drag-active' : '',
          centerDrag && proximity === 'near' ? 'hpp-drag-near' : '',
          centerDrag && proximity === 'locked' ? 'hpp-drag-locked' : '',
        ].filter(Boolean).join(' ')}
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

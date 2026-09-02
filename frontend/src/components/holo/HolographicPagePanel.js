import React, { useRef, useState } from 'react';
import { slotToOrbitPixels, STAGE_PERSPECTIVE } from '../../utils/holographicOrbit';
import { createVelocityTracker } from '../../utils/interactionVelocity';
import { startDragSound, updateDragSound, stopDragSound, setDragProximity, playSnap, playReturn } from '../../utils/holographicSound';

const CLICK_MOVE_THRESHOLD = 6; // px — أقل من هذا يُحتسب نقراً، أكثر يُحتسب سحباً
// عتبات القرب من المستقبِل — FAR / NEAR / LOCKED (بند 25-28).
const NEAR_DISTANCE = 180;
const LOCKED_DISTANCE = 90;

/*
 * لوحة صفحة واحدة على المدار الهولوغرافي — كل لوحة قابلة للسحب المباشر نحو
 * المركز بذاتها (بند صريح — Part 15/16: لا حاجة لـ"تحديد" لوحة أمامية أولاً
 * كما بالنظام الخطي القديم؛ كل مصغرة مُمسَكة تصبح فوراً هي المسحوبة). لا
 * تعارض بين تدوير المدار (Wheel/Arrow فقط الآن، بند 53/54) وسحب لوحة — كل
 * منهما مسار مستقل تماماً، فلا حاجة لآلة حالة استبعاد متبادل كالنظام السابق.
 *
 * معمارية ثلاث طبقات متداخلة (بند 18 صراحةً):
 *   .hpp            (OUTER)  — موضع الفتحة على المدار فقط (slotToOrbitPixels).
 *   .hpp-drag-layer  (MIDDLE) — إزاحة السحب الخام فقط (ترجمة صرفة بمقدار فرق
 *                               المؤشر منذ pointerdown — بند 17: تبقى نقطة
 *                               الإمساك بالضبط تحت المؤشر).
 *   .hpp-surface     (INNER)  — الصورة المقعّرة/الحوم/التوهّج فقط.
 */
export default function HolographicPagePanel({
  page, pageIndex, slotIndex, orbitGeometry, isOpening,
  onOpen, dropZoneRef, lang, tetherApi, stageRef, cancelPageDragRef,
}) {
  const panelRef = useRef(null);
  const surfaceRef = useRef(null);
  const pointerStart = useRef(null);
  const velocityTracker = useRef(null);
  const [centerDrag, setCenterDrag] = useState(null); // {x,y} إزاحة خام (شاشة px) أثناء السحب
  const [proximity, setProximity] = useState('far'); // 'far' | 'near' | 'locked'

  const px = slotToOrbitPixels(slotIndex, orbitGeometry);
  const outerTransform = `translate(-50%, -50%) translateX(${px.xPx}px) translateY(${px.yPx}px) translateZ(${px.zPx}px) rotateY(${px.rotY}deg)`;

  const label = lang === 'ar' ? page.label : (page.labelEn || page.label);
  const PreviewComponent = page.PreviewComponent;
  const usingImage = !!page.curvedImage;

  // بند 12: شفافية/سطوع حسب المدار (البُعد عن المركز) — عمق بصري بلا تدرّج
  // نحو الصفر (يبقى كل شيء مقروءاً، بند صريح سابق محفوظ هنا أيضاً).
  const OPACITY_BY_ORBIT = { inner: 1, middle: 0.93, outer: 0.84 };
  const BRIGHTNESS_BY_ORBIT = { inner: 1.05, middle: 1, outer: 0.92 };
  const opacity = OPACITY_BY_ORBIT[px.orbitKey];
  const brightness = BRIGHTNESS_BY_ORBIT[px.orbitKey];
  const zIndex = px.orbitKey === 'inner' ? 300 : px.orbitKey === 'middle' ? 200 : 100;

  const iconAnchorRef = useRef({ x: 34, y: 30 });
  const grabPointRef = useRef(null); // {x,y} نسبةً لأعلى-يسار اللوحة، عند pointerdown

  const clearTether = () => tetherApi?.current?.hideTether();

  const finishDrag = ({ dock }) => {
    document.documentElement.classList.remove('holo-cursor-grab');
    stopDragSound();
    clearTether();
    setDragProximity('far');
    dropZoneRef.current?.classList.remove('hcd-near', 'hcd-locked', 'hcd-visible');
    cancelPageDragRef && (cancelPageDragRef.current = null);
    setCenterDrag(null);
    setProximity('far');
    if (dock) { playSnap(); onOpen(pageIndex); } else { playReturn(); }
  };

  const handlePointerDown = (e) => {
    if (isOpening) return;
    const rect = panelRef.current?.getBoundingClientRect();
    grabPointRef.current = rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : { x: 0, y: 0 };
    pointerStart.current = { x: e.clientX, y: e.clientY, moved: false, dragging: false };
    velocityTracker.current = createVelocityTracker();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const handlePointerMove = (e) => {
    const st = pointerStart.current;
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (!st.moved && Math.hypot(dx, dy) > CLICK_MOVE_THRESHOLD) st.moved = true;
    if (!st.moved) return;
    if (!st.dragging) {
      st.dragging = true;
      if (cancelPageDragRef) cancelPageDragRef.current = () => finishDrag({ dock: false });
      startDragSound('page');
      document.documentElement.classList.add('holo-cursor-grab');
      dropZoneRef.current?.classList.add('hcd-visible');
    }
    setCenterDrag({ x: dx, y: dy });
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
    const v = velocityTracker.current.update(e.clientX, e.clientY);
    updateDragSound(v, e.clientX, stageRef.current?.clientWidth || window.innerWidth);
    const stageRect = stageRef?.current?.getBoundingClientRect();
    if (surfaceRect && stageRect && tetherApi?.current) {
      const grab = grabPointRef.current || iconAnchorRef.current;
      const ax = surfaceRect.left + grab.x - stageRect.left;
      const ay = surfaceRect.top + grab.y - stageRect.top;
      const px2 = e.clientX - stageRect.left;
      const py2 = e.clientY - stageRect.top;
      const tierBoost = tier === 'locked' ? 1 : tier === 'near' ? 0.5 : 0;
      tetherApi.current.showTether(ax, ay, px2, py2, Math.max(v, tierBoost));
    }
  };

  const handlePointerUp = (e) => {
    const st = pointerStart.current;
    pointerStart.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!st) return;
    if (st.dragging) {
      // بند 29/30 صراحةً: الفتح مشروط فقط بـ"مُقفَل فعلياً عند الإفلات".
      finishDrag({ dock: proximity === 'locked' });
      return;
    }
    if (!st.moved) {
      onOpen(pageIndex);
    }
  };

  const handlePointerCancel = (e) => {
    if (pointerStart.current?.dragging) finishDrag({ dock: false });
    pointerStart.current = null;
    try { e.currentTarget?.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
  };

  // تعويض perspective ثابت لهذه اللوحة تحديداً (بند 17) — zBoost معروف من
  // slotToOrbitPixels عند بدء الرندر نفسه (px.zPx)، فالمعامل دقيق حتى لو
  // كان التأثير صغيراً بالمدارات الحالية (0-40px عمق فقط).
  const perspFactor = (STAGE_PERSPECTIVE - px.zPx) / STAGE_PERSPECTIVE;
  const dragLayerTransform = centerDrag
    ? `translate(${centerDrag.x * perspFactor}px, ${centerDrag.y * perspFactor}px)`
    : undefined;

  return (
    <div
      ref={panelRef}
      className={[
        'hpp',
        usingImage ? 'hpp-image-mode' : '',
        `hpp-orbit-${px.orbitKey}`,
        isOpening ? 'hpp-opening' : '',
      ].filter(Boolean).join(' ')}
      style={{
        width: px.w,
        height: 'auto',
        transform: outerTransform,
        opacity: isOpening ? 1 : opacity,
        zIndex: centerDrag ? 2000 : zIndex,
        filter: `brightness(${brightness})`,
        cursor: 'grab',
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
          usingImage ? 'hpp-drag-layer-image' : '',
          centerDrag ? 'hpp-drag-active' : '',
          centerDrag && proximity === 'near' ? 'hpp-drag-near' : '',
          centerDrag && proximity === 'locked' ? 'hpp-drag-locked' : '',
        ].filter(Boolean).join(' ')}
        style={{ transform: dragLayerTransform }}
      >
        {usingImage ? (
          // بند 42/43 صراحةً: الصورة نفسها (بقاعدتها الأصلية) هي التصميم
          // الكامل — لا بطاقة خلفها، لا حد، لا ظل صندوق.
          <img
            ref={surfaceRef}
            src={page.curvedImage}
            alt={label}
            className="hpp-curved-img"
            draggable={false}
          />
        ) : process.env.NODE_ENV !== 'production' ? (
          // بديل تطوير بسيط جداً فقط (بند سابق محفوظ — Part 22): لا التصميم
          // القديم. غائب تماماً بأي production build.
          <div ref={surfaceRef} className="hpp-dev-missing-surface">
            <span className="hpp-dev-missing-icon">{page.icon}</span>
            <span className="hpp-dev-missing-label">{label}</span>
            <span className="hpp-dev-missing-tag">CURVED ASSET NEEDED</span>
          </div>
        ) : (
          <div ref={surfaceRef} className="hpp-surface hpp-surface-compact">
            <PreviewComponent page={page} lang={lang} />
          </div>
        )}
      </div>
    </div>
  );
}

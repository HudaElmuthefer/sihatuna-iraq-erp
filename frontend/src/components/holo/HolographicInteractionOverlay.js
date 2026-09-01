import React, { forwardRef, useImperativeHandle, useRef } from 'react';

/*
 * وشاح تفاعل واحد يغطي المسرح بالكامل (SVG، pointer-events:none — بند
 * صريح: "must never interfere with input") — مسؤول فقط عن رسم "حبل
 * الطاقة" (Energy Tether) بين نقطة إمساك اللوحة المسحوبة والمؤشر الحالي.
 * واجهة برمجية إلزامية (useImperativeHandle) بدل React state — بند صريح
 * بالمواصفة: "Do not trigger a large React rerender for every pointer
 * pixel"؛ كل تحديث أثناء السحب يكتب مباشرة على سمات SVG DOM عبر refs.
 */
const HolographicInteractionOverlay = forwardRef(function HolographicInteractionOverlay(_, ref) {
  const glowRef = useRef(null);
  const coreRef = useRef(null);
  const iceRef = useRef(null);
  const startNodeRef = useRef(null);
  const reticleRef = useRef(null);
  const groupRef = useRef(null);

  function buildPath(x1, y1, x2, y2) {
    // انحناء طفيف محكوم — لا خط مستقيم مُملّ (بند صريح)، ولا انحناء كرتوني
    // كبير: إزاحة عمودية على المنتصف تتناسب مع طول الحبل نفسه، مقصوصة عند
    // حد أقصى صغير (18px) حتى تبقى دائماً "طفيفة".
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(18, len * 0.12);
    // عمودي على اتجاه الخط (nx,ny) = (-dy,dx) مُطبَّع
    const nx = -dy / len;
    const ny = dx / len;
    const cx = mx + nx * bend;
    const cy = my + ny * bend;
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  }

  useImperativeHandle(ref, () => ({
    // intensity01: سرعة السحب مُطبَّعة 0..1 — تتحكم بسطوع اللب الأبيض
    // وعرض الخط الطفيف (بند صريح: "speed affects intensity"، مقصوصة دائماً).
    showTether(x1, y1, x2, y2, intensity01 = 0) {
      const v = Math.max(0, Math.min(1, intensity01));
      const d = buildPath(x1, y1, x2, y2);
      if (glowRef.current) glowRef.current.setAttribute('d', d);
      if (coreRef.current) coreRef.current.setAttribute('d', d);
      if (iceRef.current) iceRef.current.setAttribute('d', d);
      if (groupRef.current) groupRef.current.style.opacity = '1';
      if (iceRef.current) iceRef.current.style.opacity = String(0.35 + v * 0.5);
      if (coreRef.current) coreRef.current.style.strokeWidth = String(1.1 + v * 0.6);
      if (startNodeRef.current) startNodeRef.current.setAttribute('transform', `translate(${x1},${y1})`);
      if (reticleRef.current) reticleRef.current.setAttribute('transform', `translate(${x2},${y2})`);
    },
    // fade سريع (60-100ms ظهور تم عبر CSS transition على المجموعة، 100-180ms
    // اختفاء عند الإفلات — بند صريح، لا حبل متبقٍّ "لينغ").
    hideTether() {
      if (groupRef.current) groupRef.current.style.opacity = '0';
    },
  }), []);

  return (
    <svg className="hio-overlay" aria-hidden="true">
      <defs>
        <filter id="hio-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
      </defs>
      <g ref={groupRef} className="hio-tether-group">
        {/* الطبقة 1: توهّج سماوي عريض ناعم جداً */}
        <path ref={glowRef} className="hio-tether-glow" filter="url(#hio-blur)" />
        {/* الطبقة 2: خط كهربائي سماوي رفيع */}
        <path ref={coreRef} className="hio-tether-core" />
        {/* الطبقة 3: لبّ أبيض-جليدي رفيع جداً */}
        <path ref={iceRef} className="hio-tether-ice" />
        <g ref={startNodeRef} className="hio-start-node">
          <circle r="5.5" className="hio-start-node-ring" />
          <circle r="2" className="hio-start-node-core" />
        </g>
        <g ref={reticleRef} className="hio-reticle">
          <circle r="9" className="hio-reticle-ring" />
          <line x1="-13" y1="0" x2="-7" y2="0" className="hio-reticle-tick" />
          <line x1="13" y1="0" x2="7" y2="0" className="hio-reticle-tick" />
          <line x1="0" y1="-13" x2="0" y2="-7" className="hio-reticle-tick" />
          <line x1="0" y1="13" x2="0" y2="7" className="hio-reticle-tick" />
        </g>
      </g>
    </svg>
  );
});

export default HolographicInteractionOverlay;

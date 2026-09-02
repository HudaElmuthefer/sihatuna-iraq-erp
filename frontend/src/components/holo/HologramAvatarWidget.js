/* eslint-disable no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import holoAvatarPng from '../../assets/holoAvatar.png';

export default function HologramAvatarWidget({
  onSelectOrgan,
  selectedOrgan,
  isDraggingOverCenter,
  dropZoneRef,
  lang = 'ar'
}) {
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState('normal');
  const [chamberGlow, setChamberGlow] = useState('cyan');
  
  const stageRef = useRef(null);
  const rotationAngleRef = useRef(0);
  const isMouseDownRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let animId;
    const speedVal = rotationSpeed === 'fast' ? 1.2 : rotationSpeed === 'slow' ? 0.35 : 0.65;

    const loop = () => {
      if (isAutoRotating && !isMouseDownRef.current && stageRef.current) {
        rotationAngleRef.current = (rotationAngleRef.current + speedVal) % 360;
        stageRef.current.style.transform = `rotateY(${rotationAngleRef.current}deg)`;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isAutoRotating, rotationSpeed]);

  const handlePointerDown = (e) => {
    isMouseDownRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e) => {
    if (!isMouseDownRef.current || !stageRef.current) return;
    const deltaX = e.clientX - lastMousePosRef.current.x;
    rotationAngleRef.current = (rotationAngleRef.current + deltaX * 0.7) % 360;
    stageRef.current.style.transform = `rotateY(${rotationAngleRef.current}deg)`;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    isMouseDownRef.current = false;
  };

  return (
    <div
      ref={dropZoneRef}
      className={`scifi-stasis-pod-wrapper glow-${chamberGlow}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      title={lang === 'ar' ? 'منطقة المعاينة المركزية • اسحب المصغرات هنا للتكبير' : 'Central HUD Drop Zone • Drag thumbnails here to enlarge'}
    >
      
      {/* ── 1. Stasis Containment Cylinder ── */}
      <div className="scifi-stasis-cylinder" />
      <div className="scifi-laser-beam-left" />
      <div className="scifi-laser-beam-right" />

      {/* ── 2. Glowing Pedestal ── */}
      <div className="scifi-pedestal-platform">
        <div className="scifi-pedestal-disc-outer" />
        <div className="scifi-pedestal-disc-inner" />
        <div className="scifi-pedestal-core-glow" />
      </div>

      {/* ── 3. Optimized Orbit Rings ── */}
      <div className="scifi-orbit-system">
        <div className="scifi-orbit-ring scifi-orbit-ring-1">
          <div className="scifi-photon-bead scifi-photon-1" />
        </div>
        <div className="scifi-orbit-ring scifi-orbit-ring-2">
          <div className="scifi-photon-bead scifi-photon-2" />
        </div>
      </div>

      {/* ── 4. Central Drop Target Indicator (ONLY VISIBLE WHEN DRAGGING) ── */}
      {isDraggingOverCenter && (
        <div className="cockpit-center-dropzone-indicator armed">
          <div className="cockpit-dropzone-pulse-ring" />
          <span className="text-[12px] font-mono text-cyan-300 font-bold tracking-wider bg-slate-950/80 px-3 py-1 rounded-full border border-cyan-400/50 shadow-lg">
            {lang === 'ar' ? '✨ افلت المصغر هنا للتكبير' : '✨ RELEASE TO ENLARGE'}
          </span>
        </div>
      )}

      {/* ── 5. ULTRA-FAST 3D VOLUMETRIC HOLOGRAM AVATAR ── */}
      <div className="scifi-holo-rotator" ref={stageRef} style={{ willChange: 'transform', transform: 'translateZ(0)' }}>
        
        {/* Layer 1: Front Primary Plane */}
        <div className="scifi-holo-plane scifi-plane-front">
          <img src={holoAvatarPng} alt="Hologram Front" className="scifi-holo-img" draggable={false} decoding="async" />
        </div>

        {/* Layer 2: Back Reverse Plane */}
        <div className="scifi-holo-plane scifi-plane-back">
          <img src={holoAvatarPng} alt="Hologram Back" className="scifi-holo-img" draggable={false} decoding="async" />
        </div>

        {/* Layer 3: Cross Diagonal Angle 45° Core */}
        <div className="scifi-holo-plane scifi-plane-diag1">
          <img src={holoAvatarPng} alt="Hologram 45deg" className="scifi-holo-img scifi-holo-img-translucent" draggable={false} decoding="async" />
        </div>

        {/* Hotspots */}
        <div
          className={`cockpit-hotspot ${selectedOrgan === 'brain' ? 'active-organ' : ''}`}
          style={{ top: '16%', left: '50%', transform: 'translate3d(-50%, -50%, 12px)' }}
          onClick={(e) => { e.stopPropagation(); onSelectOrgan && onSelectOrgan('brain'); }}
          title={lang === 'ar' ? 'عقدة الدماغ والجهاز العصبي' : 'Neurological Core'}
        >
          <div className="cockpit-hotspot-circle" style={{ '--node-color': '#a855f7' }}>
            <div className="cockpit-hotspot-dot" />
          </div>
        </div>

        <div
          className={`cockpit-hotspot ${selectedOrgan === 'heart' ? 'active-organ' : ''}`}
          style={{ top: '34%', left: '46%', transform: 'translate3d(-50%, -50%, 12px)' }}
          onClick={(e) => { e.stopPropagation(); onSelectOrgan && onSelectOrgan('heart'); }}
          title={lang === 'ar' ? 'عقدة القلب والدورة الدموية' : 'Cardiovascular Core'}
        >
          <div className="cockpit-hotspot-circle" style={{ '--node-color': '#f43f5e' }}>
            <div className="cockpit-hotspot-dot" />
          </div>
        </div>

        <div
          className={`cockpit-hotspot ${selectedOrgan === 'lungs' ? 'active-organ' : ''}`}
          style={{ top: '38%', left: '55%', transform: 'translate3d(-50%, -50%, 12px)' }}
          onClick={(e) => { e.stopPropagation(); onSelectOrgan && onSelectOrgan('lungs'); }}
          title={lang === 'ar' ? 'عقدة الجهاز التنفسي والرئتين' : 'Respiratory Core'}
        >
          <div className="cockpit-hotspot-circle" style={{ '--node-color': '#00f0ff' }}>
            <div className="cockpit-hotspot-dot" />
          </div>
        </div>

      </div>

      {/* ── 6. Compact Sci-Fi Quick Control Pill ── */}
      <div className="scifi-compact-control-pill">
        <button
          className={`scifi-speed-pill-btn ${rotationSpeed === 'slow' ? 'active' : ''}`}
          onClick={() => setRotationSpeed('slow')}
        >
          {lang === 'ar' ? 'بطيء' : 'Slow'}
        </button>
        <button
          className={`scifi-speed-pill-btn ${rotationSpeed === 'normal' ? 'active' : ''}`}
          onClick={() => setRotationSpeed('normal')}
        >
          {lang === 'ar' ? 'طبيعي' : 'Norm'}
        </button>
        <button
          className={`scifi-speed-pill-btn ${rotationSpeed === 'fast' ? 'active' : ''}`}
          onClick={() => setRotationSpeed('fast')}
        >
          {lang === 'ar' ? 'سريع' : 'Fast'}
        </button>
        <button
          className={`scifi-speed-pill-btn auto-toggle ${isAutoRotating ? 'active' : ''}`}
          onClick={() => setIsAutoRotating(!isAutoRotating)}
        >
          <span className="scifi-pill-dot" />
          <span>{lang === 'ar' ? 'دوران 360°' : '360°'}</span>
        </button>
      </div>

    </div>
  );
}

import React, { useRef, useEffect } from 'react';

/**
 * High-Performance LiveECGStream (60 FPS Turbo Optimized)
 * Pure batch canvas rendering with GPU-accelerated glow - 0% CPU shadowBlur bottleneck
 */
export default function LiveECGStream({ height = 55, paused = false }) {
  const canvasRef = useRef(null);
  // مرجع (لا state) لتفادي إعادة تشغيل الـ effect (وبالتالي فقدان currentX/
  // points وقفزة بصرية بالخط) عند كل تبديل paused — راجع سبب التوقف بالتعليق
  // أسفل render().
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    let animationFrameId;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 1100);
    let h = (canvas.height = height);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth || 1100;
      h = canvas.height = height;
    };

    window.addEventListener('resize', handleResize);

    let currentX = width;
    const speed = 4.2;
    const centerY = h / 2;

    const points = [];
    const maxPoints = Math.ceil(width / speed) + 20;

    let cycleTime = 0;
    const cycleLength = 80;

    const getECGDeflection = (t) => {
      const p = t / cycleLength;
      if (p > 0.15 && p < 0.22) return -Math.sin(((p - 0.15) / 0.07) * Math.PI) * 5;
      if (p >= 0.27 && p < 0.30) return Math.sin(((p - 0.27) / 0.03) * Math.PI) * 6;
      if (p >= 0.30 && p < 0.36) return -Math.sin(((p - 0.30) / 0.06) * Math.PI) * 22;
      if (p >= 0.36 && p < 0.41) return Math.sin(((p - 0.36) / 0.05) * Math.PI) * 9;
      if (p >= 0.50 && p < 0.62) return -Math.sin(((p - 0.50) / 0.12) * Math.PI) * 6.5;
      return 0;
    };

    const render = () => {
      // إصلاح أداء: نافذة المعاينة المكبّرة (DashboardPage.js) تفرض
      // backdrop-filter: blur() على كامل الشاشة + filter: blur() إضافي على
      // .cockpit-dimmed فوق نفس هذا الرسم بالضبط — رسم Canvas مستمر بمعدل
      // 60fps تحته يتنافس على نفس ميزانية الإطار مع تركيب الـblur المكلف
      // أصلاً، بينما الرسم أصلاً غير مرئي عملياً خلف الطبقتين. إيقاف عمل
      // الرسم فقط (canvas يبقى بآخر حالة له، بلا مسح/إعادة توليد) أثناء
      // فتح النافذة يزيل هذا التنافس بلا أي فرق بصري ملحوظ، ويستأنف Instantly
      // من نفس النقطة (currentX/points لم يُصفَّرا) عند الإغلاق.
      if (!pausedRef.current) {
      ctx.clearRect(0, 0, width, h);

      currentX -= speed;
      if (currentX < 0) {
        currentX = width;
      }

      cycleTime = (cycleTime + 1) % cycleLength;
      const deflection = getECGDeflection(cycleTime);
      const currentY = centerY + deflection;

      points.unshift({ x: currentX, y: currentY });
      if (points.length > maxPoints) {
        points.pop();
      }

      // Fast single-pass batch stroke for head and trail
      const len = points.length;
      if (len > 1) {
        // Draw head segment (brightest)
        ctx.beginPath();
        const headEnd = Math.min(18, len - 1);
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i <= headEnd; i++) {
          if (Math.abs(points[i - 1].x - points[i].x) > 30) continue;
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2.4;
        ctx.stroke();

        // Draw middle trail segment
        if (len > 18) {
          ctx.beginPath();
          const midEnd = Math.min(60, len - 1);
          ctx.moveTo(points[18].x, points[18].y);
          for (let i = 19; i <= midEnd; i++) {
            if (Math.abs(points[i - 1].x - points[i].x) > 30) continue;
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }

        // Draw tail fading segment
        if (len > 60) {
          ctx.beginPath();
          ctx.moveTo(points[60].x, points[60].y);
          for (let i = 61; i < len; i++) {
            if (Math.abs(points[i - 1].x - points[i].x) > 30) continue;
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      // Leading Laser Point
      ctx.beginPath();
      ctx.arc(currentX, currentY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      } // !pausedRef.current

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [height]);

  return (
    <div className="cockpit-living-ecg-container">
      <div className="cockpit-ecg-grid-backdrop" />
      <canvas ref={canvasRef} className="cockpit-ecg-canvas" />
    </div>
  );
}

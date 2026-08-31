import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ALL_PAGES, useApp } from '../../contexts/AppContext';
import FutureGlassCard from './FutureGlassCard';

// الوحدات الست الموزَّعة حول المركز (بند 6/20 بالطلب صراحةً: وسط + أعلى-يمين
// + أعلى-يسار + يمين + يسار + أسفل-يمين + أسفل-يسار). الترتيب هنا محايد
// الاتجاه عمداً — بلا أي كلمة "يمين/يسار" بالكود — لأن CSS Grid (fh-grid
// بـindex.css) يعكس ترتيب الأعمدة تلقائياً تحت direction:rtl (العمود الأول
// = بداية المحور المنطقي = يمين فعلياً تحت RTL)، فأي ترتيب ثابت هنا يُصحَّح
// بصرياً تلقائياً لكلا الاتجاهين دون أي فرع RTL/LTR يدوي مطلوب هنا.
const HUB_KEYS = ['appointments', 'patients', 'results', 'hr', 'smart-reports', 'laboratory'];

const CENTER_PAGE = { key: 'dashboard-center', icon: '🏥', label: 'مركز التحكم', labelEn: 'Command Center', path: '/' };

/*
 * FUTURE HUB — "خريطة بصرية قابلة للتنقّل" (بند 18 صراحةً)، وليست مجرد
 * روابط. تدير حالة العنصر المختار وحركة "السحب نحو المركز" عبر تقنية FLIP
 * قياسية: يُقاس الموضع الأصلي (from) والموضع المستهدف (to) مرة واحدة عند
 * النقر، ثم عنصر "مستنسخ" ثابت (position:fixed) يُعرَض في الموضع المستهدف
 * فعلياً منذ البداية، لكن بـtransform معكوس يجعله يبدو مكانه الأصلي بدون أي
 * transition (لحظي)، ثم بعد فريم واحد يُزال الـtransform (بـtransition
 * فعلية) — فيتحرك العنصر بصرياً transform فقط (GPU، بلا إعادة رسم/Layout)
 * من نقطته الأصلية إلى المركز تماماً كأنه انزلق فعلياً، تماماً كما طُلب
 * ("أهم جزء" بالطلب).
 */
export default function FutureHub() {
  const { patients, appointments, doctors } = useApp();
  const navigate = useNavigate();
  const stageRef = useRef(null);
  const panelRefs = useRef({});
  const [centering, setCentering] = useState(null); // { page, fromRect, toRect, phase }

  const satellites = HUB_KEYS
    .map((key) => ALL_PAGES.find((p) => p.key === key))
    .filter(Boolean);

  // معاينات بسيطة جداً (بند 19 صراحةً: 2-3 عناصر كحد أقصى، لا محتوى ثقيل) —
  // من بيانات مُحمَّلة أصلاً بالسياق، لا استعلام إضافي.
  const counts = {
    patients: patients?.length,
    appointments: appointments?.length,
    doctors: doctors?.length,
  };

  const handleSelect = useCallback((page) => {
    if (centering) return; // يمنع نقرات متزامنة أثناء حركة جارية
    const el = panelRefs.current[page.key];
    const stage = stageRef.current;
    if (!el || !stage) { navigate(page.path); return; }
    const fromRect = el.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const toWidth = Math.min(stageRect.width * 0.46, 560);
    const toHeight = Math.min(stageRect.height * 0.56, 380);
    const toRect = {
      left: stageRect.left + stageRect.width / 2 - toWidth / 2,
      top: stageRect.top + stageRect.height / 2 - toHeight / 2,
      width: toWidth,
      height: toHeight,
    };
    setCentering({ page, fromRect, toRect, phase: 'invert' });
  }, [centering, navigate]);

  useEffect(() => {
    if (!centering) return undefined;
    if (centering.phase === 'invert') {
      // فريم واحد قبل إزالة الانعكاس — يمنح المتصفح فرصة لرسم الحالة
      // المعكوسة (اللحظية، بلا transition) قبل تفعيل الحركة الفعلية.
      const raf = requestAnimationFrame(() => {
        setCentering((c) => (c ? { ...c, phase: 'play' } : c));
      });
      return () => cancelAnimationFrame(raf);
    }
    // مدة الحركة (بند 21 صراحةً: 250-500ms) — تطابق CSS transition أدناه.
    const timer = setTimeout(() => navigate(centering.page.path), 420);
    return () => clearTimeout(timer);
  }, [centering, navigate]);

  return (
    <div className={`fh-stage ${centering ? 'fh-stage-focusing' : ''}`} ref={stageRef}>
      <div className="fh-atmosphere" aria-hidden="true">
        <span className="fh-atmosphere-grid" />
        <span className="fh-atmosphere-arc fh-atmosphere-arc-1" />
        <span className="fh-atmosphere-arc fh-atmosphere-arc-2" />
      </div>

      <div className="fh-grid">
        <div className="fh-slot fh-slot-center">
          <FutureGlassCard page={CENTER_PAGE} variant="center" isStatic />
        </div>
        {satellites.map((page, i) => (
          <div className={`fh-slot fh-slot-s${i + 1}`} key={page.key}>
            <FutureGlassCard
              page={page}
              count={counts[page.key]}
              panelRef={(node) => { panelRefs.current[page.key] = node; }}
              onClick={() => handleSelect(page)}
              dimmed={!!centering && centering.page.key !== page.key}
              hidden={!!centering && centering.page.key === page.key}
            />
          </div>
        ))}
      </div>

      {centering && (() => {
        const { fromRect, toRect, phase } = centering;
        const dx = (fromRect.left + fromRect.width / 2) - (toRect.left + toRect.width / 2);
        const dy = (fromRect.top + fromRect.height / 2) - (toRect.top + toRect.height / 2);
        const sx = fromRect.width / toRect.width;
        const sy = fromRect.height / toRect.height;
        const inverted = phase === 'invert';
        return (
          <div
            className="fh-clone"
            style={{
              top: toRect.top,
              left: toRect.left,
              width: toRect.width,
              height: toRect.height,
              transform: inverted ? `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` : 'translate(0px, 0px) scale(1, 1)',
              transition: inverted ? 'none' : 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <FutureGlassCard page={centering.page} count={counts[centering.page.key]} variant="focus" isStatic />
          </div>
        );
      })()}
    </div>
  );
}

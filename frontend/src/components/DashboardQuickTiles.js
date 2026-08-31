import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import useMagneticHover from '../hooks/useMagneticHover';
// نسخ الأيقونات "-transparent" (خلفيتها الداكنة الصلبة أُزيلت فعلياً عبر
// frontend/scripts/make-icons-transparent.ps1 — قناة ألفا حقيقية بالملف
// الناتج، وليست الأصلية ذات الخلفية الصلبة المحفوظة كما هي في نفس المجلد).
import iconDocuments from '../assets/dark/icon-documents-transparent.png';
import iconProjects from '../assets/dark/icon-projects-transparent.png';
import iconCalendar from '../assets/dark/icon-calendar-transparent.png';
import iconWarehouse from '../assets/dark/icon-warehouse-transparent.png';

/*
 * Dark-mode-only "quick access" tiles matching the 4 stat tiles from
 * components/dark/Gemini_Generated_Image_v4irlnv4irlnv4ir.png (Documents /
 * Projects / Calendar / Warehouse), using the real cropped icon assets.
 *
 * The reference image's numbers were demo placeholders baked into the AI
 * render — here they're real counts already loaded by DashboardPage
 * (documents/projects/today's appointments/inventory), and each tile links
 * to the corresponding real module instead of being purely decorative.
 *
 * Render this only when theme === 'dark' — it has no light-mode styling.
 */
export default function DashboardQuickTiles({ documentsCount, projectsCount, todayApptsCount, inventoryCount, lang }) {
  const L = (ar, en) => (lang === 'ar' ? ar : en);

  const tiles = [
    { icon: iconDocuments, value: documentsCount, label: L('المستندات', 'Documents'), path: '/documents' },
    { icon: iconProjects, value: projectsCount, label: L('المشاريع', 'Projects'), path: '/projects' },
    { icon: iconCalendar, value: todayApptsCount, label: L('المواعيد اليوم', 'Calendar'), path: '/appointments' },
    { icon: iconWarehouse, value: inventoryCount, label: L('المخزون', 'Warehouse'), path: '/inventory' },
  ];

  // Magnetic hover (2-5px max) على جسم الأيقونة فقط — المنصة والصف نفسه لا
  // يتحركان إطلاقاً. 4 عناصر ثابتة العدد، فاستدعاء الـ hook 4 مرات صريحاً
  // (لا داخل map) يبقى متوافقاً مع قواعد الـ Hooks.
  const iconRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  useMagneticHover(iconRefs[0], 4);
  useMagneticHover(iconRefs[1], 4);
  useMagneticHover(iconRefs[2], 4);
  useMagneticHover(iconRefs[3], 4);

  return (
    <div className="dqt-row">
      {tiles.map((t, i) => (
        <Link key={t.path} to={t.path} className="dqt-tile ui-interactive-icon">
          {/* الرقم متراكب فعلياً مع الحافة العلوية للوح الزجاجي (موضع مطلق
             بإزاحة سالبة) — وليس نصاً عادياً فوقه بمسافة، كما بالمرجع
             بالضبط. */}
          <div className="dqt-icon-wrap" ref={iconRefs[i]}>
            <div className="dqt-num">{t.value}</div>
            <img src={t.icon} alt={t.label} />
          </div>
          <div className="dqt-label">{t.label}</div>
        </Link>
      ))}
    </div>
  );
}

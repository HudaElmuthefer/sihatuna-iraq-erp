import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import useMagneticHover from '../hooks/useMagneticHover';
// نسخ الأيقونات "-transparent" (خلفيتها الداكنة الصلبة أُزيلت فعلياً عبر
// frontend/scripts/make-icons-transparent.ps1 — قناة ألفا حقيقية بالملف
// الناتج، وليست الأصلية ذات الخلفية الصلبة المحفوظة كما هي في نفس المجلد).
import iconDocumentsDark from '../assets/dark/icon-documents-transparent.png';
import iconProjectsDark from '../assets/dark/icon-projects-transparent.png';
import iconCalendarDark from '../assets/dark/icon-calendar-transparent.png';
import iconWarehouseDark from '../assets/dark/icon-warehouse-transparent.png';
// نسخ الوضع الفاتح — من components/light، شفافية حقيقية عبر
// frontend/scripts/remove_light_stat_icon_bg.py (نفس أسلوب flood-fill
// المستخدم للوضع الداكن).
import iconDocumentsLight from '../assets/light/icon-documents-transparent.png';
import iconProjectsLight from '../assets/light/icon-projects-transparent.png';
import iconCalendarLight from '../assets/light/icon-calendar-transparent.png';
import iconWarehouseLight from '../assets/light/icon-warehouse-transparent.png';

/*
 * "Quick access" tiles matching the 4 stat tiles from the reference
 * mockups (Documents / Projects / Calendar / Warehouse), using the real
 * cropped icon assets per theme (components/dark vs components/light).
 *
 * The reference images' numbers were demo placeholders baked into the AI
 * render — here they're real counts already loaded by DashboardPage
 * (documents/projects/today's appointments/inventory), and each tile links
 * to the corresponding real module instead of being purely decorative.
 */
export default function DashboardQuickTiles({ theme, documentsCount, projectsCount, todayApptsCount, inventoryCount, lang }) {
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const isDark = theme === 'dark';

  const tiles = [
    { icon: isDark ? iconDocumentsDark : iconDocumentsLight, value: documentsCount, label: L('المستندات', 'Documents'), path: '/documents' },
    { icon: isDark ? iconProjectsDark : iconProjectsLight, value: projectsCount, label: L('المشاريع', 'Projects'), path: '/projects' },
    { icon: isDark ? iconCalendarDark : iconCalendarLight, value: todayApptsCount, label: L('المواعيد اليوم', 'Calendar'), path: '/appointments' },
    { icon: isDark ? iconWarehouseDark : iconWarehouseLight, value: inventoryCount, label: L('المخزون', 'Warehouse'), path: '/inventory' },
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
    <div className={`dqt-row ${isDark ? '' : 'dqt-row-light'}`}>
      {tiles.map((t, i) => (
        <Link key={t.path} to={t.path} className={`dqt-tile ui-interactive-icon ${isDark ? '' : 'dqt-tile-light'}`}>
          {/* الرقم متراكب فعلياً مع الحافة العلوية للوح الزجاجي (موضع مطلق
             بإزاحة سالبة) — وليس نصاً عادياً فوقه بمسافة، كما بالمرجع
             بالضبط. */}
          <div className={`dqt-icon-wrap ${isDark ? '' : 'dqt-icon-wrap-light'}`} ref={iconRefs[i]}>
            <div className={`dqt-num ${isDark ? '' : 'dqt-num-light'}`}>{t.value}</div>
            <img src={t.icon} alt={t.label} />
          </div>
          <div className={`dqt-label ${isDark ? '' : 'dqt-label-light'}`}>{t.label}</div>
        </Link>
      ))}
    </div>
  );
}

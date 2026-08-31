/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import HealthBanner from './HealthBanner';
import PrintButton from './PrintButton';
import AppLogo from './AppLogo';
import { useApp, ALL_PAGES } from '../contexts/AppContext';
import { useT } from '../translations';
import NotificationPanel from './NotificationPanel';
import HeaderSelectDropdown from './HeaderSelectDropdown';
import HeaderFloatingPanel from './HeaderFloatingPanel';
import useScrollableCursorSuspend from '../hooks/useScrollableCursorSuspend';
import { isPrintButtonHidden } from '../config/printConfig';
import './Layout.dark.css';
// ملاحظة: صورة القائمة الجانبية المرجعية (كانت مستوردة هنا سابقاً باسم
// sidebarDarkV3، من components/dark/ChatGPT Image Aug 30, 2026, 05_36_27 PM
// (3).png) أُزيلت من الرندر نهائياً. السبب: الصورة بأكملها عبارة عن عناصر
// واجهة مرسومة (باج الشعار، 9 شارات أيقونات ثابتة، مربع الحساب بالأسفل) لا
// يمكن فصل "الإضاءة/الجو البصري" عنها دون معالجة صور شبه مستحيلة (inpainting
// يدوي لكل شارة على حدة) — وأي عتامة مرئية لها، مهما انخفضت، كانت تُقرأ
// بصرياً كـ"سايدبار شبح" خلف القائمة الحقيقية (شارات بمواضع لا تطابق مواضع
// العناصر الفعلية). الإضاءة الفعلية (توهج سماوي أعلى-يسار متلاشٍ نحو الأسفل)
// لم تكن أصلاً جزءاً من هذه الصورة — هي CSS خالص مبني في .desktop-sidebar/
// .mobile-sidebar (index.css)، فبقيت كما هي تماماً بعد حذف الصورة. الملف
// نفسه لم يُحذف من القرص (frontend/src/assets/sidebar/) تحسباً لحاجة لاحقة.
import { SIDEBAR_SUB_TABS } from '../config/sidebarSubTabs';
import { FaHome, FaArrowLeft, FaSun, FaMoon, FaBell } from 'react-icons/fa';
import {
  FaUsers, FaTags, FaUserMd, FaCalendarAlt, FaBuilding, FaSyringe, FaBed, FaBaby,
  FaRunning, FaTicketAlt, FaPills, FaBalanceScale, FaBan, FaHospital, FaBrain,
  FaAddressBook, FaMoneyBillWave, FaShoppingCart, FaSearchDollar, FaBoxes,
  FaChartLine, FaFileInvoiceDollar, FaCreditCard, FaUserTie, FaBullseye,
  FaProjectDiagram, FaFileAlt, FaAward, FaFlask, FaXRay, FaFileMedicalAlt,
  FaPrescriptionBottleAlt, FaAmbulance, FaTools, FaChartBar, FaCog,
} from 'react-icons/fa';

// أيقونات SVG احترافية (react-icons) بدل الإيموجي — تغطي كل مفاتيح ALL_PAGES
// (AppContext.js). لا تغيّر أي منطق/صلاحيات/توجيه، مجرد استبدال بصري لما
// كان يُعرَض سابقاً كإيموجي (🏠 👥 ...). راجع renderNavIcon() أدناه.
const NAV_ICON_COMPONENTS = {
  dashboard: FaHome, patients: FaUsers, 'medical-codes': FaTags, doctors: FaUserMd,
  appointments: FaCalendarAlt, departments: FaBuilding, vaccinations: FaSyringe,
  wards: FaBed, delivery: FaBaby, physiotherapy: FaRunning, queue: FaTicketAlt,
  'drug-interactions': FaPills, 'dosage-check': FaBalanceScale, 'allergy-check': FaBan,
  'medical-leave': FaHospital, 'ai-diagnosis': FaBrain, crm: FaAddressBook,
  accounts: FaMoneyBillWave, procurement: FaShoppingCart, 'billing-anomaly': FaSearchDollar,
  inventory: FaBoxes, 'inventory-prediction': FaChartLine, billing: FaFileInvoiceDollar,
  'payment-settings': FaCreditCard, hr: FaUserTie, services: FaBullseye,
  projects: FaProjectDiagram, documents: FaFileAlt, quality: FaAward, laboratory: FaFlask,
  radiology: FaXRay, results: FaFileMedicalAlt, pharmacy: FaPrescriptionBottleAlt,
  ambulance: FaAmbulance, assets: FaTools, 'smart-reports': FaChartBar, settings: FaCog,
};

function renderNavIcon(pageKey, style) {
  const IconComp = NAV_ICON_COMPONENTS[pageKey] || FaFileAlt;
  return <IconComp style={style} />;
}

// شدّة توهج الأيقونة حسب موضعها بالقائمة — مصدر الضوء بأعلى السايدبار
// (راجع .desktop-sidebar بـindex.css)، فالعناصر الأعلى يجب أن تبدو أكثر
// إضاءة قليلاً وتتلاشى تدريجياً كلما نزلنا، بفارق بسيط غير مبالغ فيه (حدّ
// أدنى 0.55 من الشدّة الأصلية، لا صفر).
function navGlowFilter(index) {
  const factor = Math.max(0.55, 1 - index * 0.045);
  return `drop-shadow(0 0 ${(3 * factor).toFixed(1)}px rgba(79, 195, 247, ${(0.45 * factor).toFixed(2)}))`;
}


const GROUP_LABELS = {
  core:      { ar: '', en: '' },
  clinical:  { ar: 'الرعاية السريرية', en: 'Clinical Care' },
  finance:   { ar: 'المالية والمشتريات', en: 'Finance & Procurement' },
  hr:        { ar: 'الموارد البشرية', en: 'Human Resources' },
  projects:  { ar: 'المشاريع', en: 'Projects' },
  documents: { ar: 'الوثائق', en: 'Documents' },
  medtech:   { ar: 'الخدمات الطبية المساندة', en: 'Medical Support Services' },
  ops:       { ar: 'العمليات', en: 'Operations' },
  assets:    { ar: 'الأصول', en: 'Assets' },
  reports:   { ar: 'التقارير', en: 'Reports' },
  // بلا عنوان مجموعة (زي 'core') — عنصر واحد فقط ("الإعدادات")، لا يحتاج ترويسة
  settingsFooter: { ar: '', en: '' },
};

export default function Layout() {
  const { user, logout, theme, toggleTheme, lang, toggleLang, sidebarCollapsed, toggleSidebar, notifications, hasPermission, multiHospitalEnabled, hospitals, viewingHospitalId, setViewingHospitalId, printSettings, appName, appNameEn, printOverlay, setPrintOverlay } = useApp();
  const tr = useT(lang);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = React.useRef(null);
  const searchWrapRef = React.useRef(null);
  const searchResultsCursorSuspend = useScrollableCursorSuspend();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [globalSearch, setGlobalSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // ── القوائم الفرعية القابلة للتوسّع (للصفحات ذات التبويبات الداخلية،
  // مثل HR/الحسابات/الجودة) — مجموعة مفاتيح الصفحات المفتوحة حالياً. أكثر
  // من عنصر يستطيع البقاء مفتوحاً بالتوازي عمداً (بدل إغلاق تلقائي للباقي)، ولا
  // نُزيل أي مفتاح تلقائياً — فقط نُضيف مفتاح الصفحة النشطة حالياً (لو كانت
  // من ذوات التبويبات) عند كل تغيّر بمسار التنقّل، حتى يرى المستخدم مكانه
  // بوضوح دون طيّ أي قائمة فتحها هو بنفسه سابقاً.
  const [expandedNavKeys, setExpandedNavKeys] = useState(() => new Set());
  React.useEffect(() => {
    const activePage = ALL_PAGES.find(p => p.path === location.pathname);
    if (activePage && SIDEBAR_SUB_TABS[activePage.key]) {
      setExpandedNavKeys(prev => (prev.has(activePage.key) ? prev : new Set(prev).add(activePage.key)));
    }
  }, [location.pathname]);
  const toggleNavExpanded = (key) => setExpandedNavKeys(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  // ── Universal print-to-PDF ──────────────────────────────────────────────
  // printOverlay (from AppContext) holds the per-print header/footer/logo
  // overrides collected by PrintButton's options panel — or, on pages with
  // their own custom PDF export button (e.g. Smart Reports), collected by
  // that page reusing the same PrintOptionsModal component. It stays null
  // until confirmed, which mounts the print-only header/footer blocks below
  // and fires window.print() on the next frame (so the browser captures them
  // already rendered), then resets on 'afterprint' so they don't linger in the DOM.
  const printButtonHidden = isPrintButtonHidden(location.pathname);

  const handlePrint = (options) => setPrintOverlay(options);

  React.useEffect(() => {
    if (!printOverlay) return;
    // setTimeout (not requestAnimationFrame) — rAF only fires on an actual
    // paint tick and gets fully paused in backgrounded/non-rendering tabs,
    // which would silently swallow the print call in that edge case.
    const timer = setTimeout(() => window.print(), 0);
    return () => clearTimeout(timer);
  }, [printOverlay]);

  React.useEffect(() => {
    const resetOverlay = () => setPrintOverlay(null);
    window.addEventListener('afterprint', resetOverlay);
    return () => window.removeEventListener('afterprint', resetOverlay);
  }, [setPrintOverlay]);

  // إصلاح خلل: قائمة الإشعارات المنسدلة (🔔) كانت بلا أي طريقة لإغلاقها سوى
  // الضغط على إشعار بعينه أو زر الجرس نفسه مجدداً — لا الضغط خارجها، ولا
  // التنقّل لصفحة أخرى. بما أن Layout (وبالتالي هذه القائمة) يبقى مثبَّتاً
  // عبر كل الصفحات (فقط <Outlet/> يتغيّر)، فتحها مرة ثم التنقّل لأي صفحة
  // أخرى (مثل الموظفين بالموارد البشرية أو سجل الترفيعات والعلاوات بالحسابات)
  // كان يبقيها ظاهرة فوق محتوى تلك الصفحة — وهذا بالضبط ما بدا وكأنه "الجدول
  // استُبدل بقائمة تنبيهات" على أكثر من صفحة مختلفة بلا أي علاقة فعلية بينها.
  React.useEffect(() => {
    if (!showNotif) return;
    const handleClickOutside = (e) => {
      // النقر داخل اللوحة نفسها لم يعد يُحتسب "داخل notifRef" — اللوحة تُعرَض
      // الآن عبر Portal إلى document.body (خارج .glass-header المقصوصة
      // overflow:hidden، راجع NotificationPanel.js/HeaderFloatingPanel.js)،
      // فلم تعد ابناً فعلياً لِـnotifRef في شجرة الـDOM. .closest بصنف
      // اللوحة المميّز يغطي هذه الحالة دون كسر إغلاقها عند الضغط خارجها فعلاً.
      if (e.target.closest && e.target.closest('.notification-panel-portal')) return;
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotif]);
  React.useEffect(() => { setShowNotif(false); }, [location.pathname]);

  const unread = notifications.filter(n => !n.read).length;
  // الصفحات الظاهرة = صلاحيات الدور (كما كان) + صفحات منشأة المستخدم المفعّلة
  // (لو له منشأة مُعيَّنة ولها قائمة صفحات محدَّدة). حساب مستوى الوزارة (بلا
  // منشأة) أو منشأة بلا قيود مُعرَّفة (enabled_pages فارغ) = يرى كل الصفحات
  // المسموحة بدوره، بدون أي تغيير بالسلوك الحالي.
  const userHospital = hospitals.find(h => h.id === user?.hospitalId);
  const hospitalPages = userHospital?.enabled_pages;
  const visiblePages = ALL_PAGES.filter(p => {
    if (!hasPermission(p.key)) return false;
    if (Array.isArray(hospitalPages) && hospitalPages.length > 0) {
      return hospitalPages.includes(p.key) || p.key === 'dashboard' || p.key === 'settings';
    }
    return true;
  });

  const handleLogout = () => { logout(); navigate('/login'); };

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: sidebarCollapsed ? '20px 10px' : '20px 20px', borderBottom: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(150,130,170,0.14)', flexShrink: 0 }}>
        {/* اتجاه صريح بدل الاعتماد على انعكاس flex التلقائي مع direction:rtl —
           بقية هذا الملف يعتمد نفس الأسلوب (موضع زر الطيّ، textAlign عناصر
           القائمة...) بدل ترك أي تموضع RTL ضمنياً. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }}>
          <div className={theme === 'dark' ? 'sidebar-logo-frame' : 'sidebar-logo-frame-light'} style={{ borderRadius: 10, flexShrink: 0 }}>
            <AppLogo size={38} radius={10} fontSize={20} />
          </div>
          {!sidebarCollapsed && (
            <div style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>
              <div style={{ color: theme === 'dark' ? 'rgba(235, 248, 255, 0.95)' : '#14283d', fontWeight: 800, fontSize: 18, lineHeight: 1.25 }}>{appName} ERP</div>
              <div style={{ color: theme === 'dark' ? 'rgba(235, 248, 255, 0.6)' : '#4b6478', fontSize: 12 }}>{tr("app_subtitle")}</div>
            </div>
          )}
        </div>
      </div>

      {/* Nav — scrollable */}
      <nav style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '10px 8px',
        /* Custom scrollbar */
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.25) transparent' }}>
        <style>{`
          nav::-webkit-scrollbar { width: 7px; }
          nav::-webkit-scrollbar-track { background: transparent; }
          nav::-webkit-scrollbar-thumb {
            background-color: rgba(255,255,255,0.25);
            background-clip: padding-box;
            border: 1.5px solid transparent;
            border-radius: 10px;
            transition: background-color 0.2s ease, border-width 0.2s ease;
          }
          nav::-webkit-scrollbar-thumb:hover { background-color: rgba(255,255,255,0.45); }
          nav::-webkit-scrollbar-thumb:active { background-color: rgba(255,255,255,0.65); }
          nav.scrollbar-near-edge::-webkit-scrollbar-thumb { border-width: 0; background-color: rgba(255,255,255,0.5); }
        `}</style>

        {(() => {
          const groups = [];
          const seen = new Set();
          visiblePages.forEach(page => {
            const g = page.group || 'core';
            if (!seen.has(g)) { seen.add(g); groups.push(g); }
          });
          let navIndex = 0;
          return groups.map(group => {
            const pages = visiblePages.filter(p => (p.group || 'core') === group);
            const gLabel = GROUP_LABELS[group] || { ar: group, en: group };
            // فاصل بصري رفيع قبل مجموعة "الإعدادات" المثبَّتة بآخر القائمة —
            // توضح أنها عنصر منفصل عن باقي التنقل الرئيسي، لا مجرد آخر عنصر
            // اتفاقاً بسبب الترتيب.
            const isSettingsFooter = group === 'settingsFooter';
            return (
              <div key={group} style={isSettingsFooter ? { marginTop: 8, paddingTop: 8, borderTop: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(150,130,170,0.14)' } : undefined}>
                {!sidebarCollapsed && gLabel.ar && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: theme === 'dark' ? 'rgba(255,255,255,0.3)' : '#1b3245', padding: '10px 14px 4px', letterSpacing: '0.05em' }}>
                    {lang === 'ar' ? gLabel.ar : gLabel.en}
                  </div>
                )}
                {pages.map(page => {
                  // القوائم الفرعية تُخفى بوضع القائمة المطوية (أيقونات فقط) —
                  // لا مساحة كافية لعرضها، ونفس مبدأ أشجار التنقّل المطوية عادةً.
                  const subTabs = sidebarCollapsed ? [] : (SIDEBAR_SUB_TABS[page.key] || []).filter(t => !t.adminOnly || user?.role === 'admin');
                  const hasSubTabs = subTabs.length > 0;
                  const isExpanded = expandedNavKeys.has(page.key);
                  const isOnThisPage = location.pathname === page.path;
                  const activeSubTabKey = isOnThisPage ? (searchParams.get('tab') || subTabs[0]?.key) : null;
                  const commonLabel = lang === 'ar' ? page.label : (page.labelEn || tr(page.navKey));
                  const arrow = (
                    <span style={{ display: 'inline-block', flexShrink: 0, transform: `rotate(${isExpanded ? 90 : 0}deg) scaleX(${lang === 'ar' ? -1 : 1})`, transition: 'transform 0.2s', fontSize: 10, color: theme === 'dark'
                      ? (isOnThisPage ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)')
                      : (isOnThisPage ? '#14283d' : '#5a7185') }}>▶</span>
                  );
                  const iconGlow = navGlowFilter(navIndex++);
                  return (
                    <div key={page.key}>
                      {hasSubTabs ? (
                        <button
                          type="button"
                          className={`sidebar-nav-item ${isOnThisPage ? 'sidebar-nav-item-active' : ''}`}
                          onClick={() => {
                            setMobileOpen(false);
                            toggleNavExpanded(page.key);
                            if (!isOnThisPage) navigate(page.path);
                          }}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? (lang === 'ar' ? `طيّ القائمة الفرعية: ${commonLabel}` : `Collapse submenu: ${commonLabel}`) : (lang === 'ar' ? `توسيع القائمة الفرعية: ${commonLabel}` : `Expand submenu: ${commonLabel}`)}
                          title={sidebarCollapsed ? page.label : ''}
                          style={{
                            width: '100%',
                            padding: sidebarCollapsed ? '11px 0' : '9px 14px',
                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                            border: 'none', cursor: 'pointer',
                            color: isOnThisPage ? 'var(--text-active)' : (theme === 'dark' ? 'rgba(255,255,255,0.7)' : '#20384b'),
                            fontFamily: 'inherit',
                            textAlign: lang === 'ar' ? 'right' : 'left',
                          }}
                        >
                          <span style={{ fontSize: 17, flexShrink: 0 }}>{renderNavIcon(page.key, { filter: iconGlow })}</span>
                          {!sidebarCollapsed && <span style={{ flex: 1, fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{commonLabel}</span>}
                          {!sidebarCollapsed && arrow}
                        </button>
                      ) : (
                        <NavLink
                          to={page.path}
                          end={page.path === '/'}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'sidebar-nav-item-active' : ''}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: sidebarCollapsed ? '11px 0' : '9px 14px',
                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 500,
                          }}
                          title={sidebarCollapsed ? page.label : ''}
                        >
                          <span style={{ fontSize: 17, flexShrink: 0 }}>{renderNavIcon(page.key, { filter: iconGlow })}</span>
                          {!sidebarCollapsed && <span style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{commonLabel}</span>}
                        </NavLink>
                      )}
                      {hasSubTabs && isExpanded && (
                        // تمييز بصري متعمَّد عن القائمة الرئيسية (وليس مجرد نسخة أصغر):
                        // تظليل خفيف بنفس عائلة الأزرق الأساسي للنظام (#1a6bab) بدرجة
                        // شفافية منخفضة (0.07) بدل الخلفية الداكنة الصرفة للقائمة
                        // الرئيسية، مع شريط تمييز جانبي (يعتمد على اتجاه اللغة تلقائياً
                        // عبر borderInlineStart المنطقي) — يوحي بصرياً بأن هذه كتلة
                        // فرعية تابعة، لا عناصر مستقلة بنفس المستوى.
                        <div className="sidebar-subtab-group" style={{ background: 'rgba(26,107,171,0.07)', borderInlineStart: '2px solid rgba(26,107,171,0.35)', borderRadius: 8, marginBottom: 4, paddingTop: 2, paddingBottom: 2 }}>
                          {subTabs.map(sub => {
                            const label = sub.labelKey ? tr(sub.labelKey) : (lang === 'ar' ? sub.ar : sub.en);
                            const active = isOnThisPage && activeSubTabKey === sub.key;
                            return (
                              <Link
                                key={sub.key}
                                className="sidebar-subtab-link"
                                to={`${page.path}?tab=${sub.key}`}
                                onClick={() => setMobileOpen(false)}
                                style={{
                                  display: 'block',
                                  paddingInlineStart: 40, paddingInlineEnd: 14,
                                  paddingTop: 7, paddingBottom: 7,
                                  fontSize: 11.5, fontWeight: active ? 500 : 400,
                                  textDecoration: 'none',
                                  // لون فرعي من نفس عائلة أزرق #1a6bab، لكن مُقسَّم بالثيم
                                  // صراحةً الآن (كان أبيض/أزرق فاتح ثابتاً بصرف النظر عن
                                  // السمة، فيظهر باهتاً جداً فوق سايدبار لؤلؤي فاتح — بند
                                  // 7-10 من طلب توحيد ألوان السايدبار).
                                  color: theme === 'dark'
                                    ? (active ? '#ffffff' : 'rgba(159,199,232,0.8)')
                                    : (active ? '#0f2133' : '#3d5a75'),
                                  background: active ? (theme === 'dark' ? 'rgba(26,107,171,0.4)' : 'rgba(80,180,220,0.28)') : 'transparent',
                                  borderRadius: 8,
                                  marginBottom: 1,
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}
                              >
                                {label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          });
        })()}
      </nav>

      {/* User info at bottom */}
      <div style={{ padding: sidebarCollapsed ? '12px 8px' : '12px 16px', borderTop: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(150,130,170,0.14)', flexShrink: 0 }}>
        {!sidebarCollapsed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: user?.color || '#1a6bab', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
              {user?.avatar || 'م'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: theme === 'dark' ? 'rgba(235, 248, 255, 0.95)' : '#14283d', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ color: theme === 'dark' ? 'rgba(235, 248, 255, 0.55)' : '#4b6478', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.jobTitle || user?.role}</div>
            </div>
            <button onClick={handleLogout} title={tr('btn_logout')} className="sidebar-control-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : '#5a7185', fontSize: 16, padding: 4 }}>🚪</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: user?.color || '#1a6bab', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>{user?.avatar || 'م'}</div>
            <button onClick={handleLogout} title={tr('btn_logout')} className="sidebar-control-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : '#5a7185', fontSize: 14 }}>🚪</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="app-bg-blur" />
      {/* زخارف Sci-Fi HUD خفيفة الحضور (خطوط/أقواس CSS متجاوبة، لا صور ثابتة)
          خلف كل المحتوى — الوضع الداكن فقط، راجع .sci-fi-arc بـindex.css */}
      {theme === 'dark' && (
        <>
          <div className="sci-fi-arc sci-fi-arc-1" aria-hidden="true" />
          <div className="sci-fi-arc sci-fi-arc-2" aria-hidden="true" />
        </>
      )}
      <div className="app-shell" style={{ display: 'flex', height: '100vh', background: 'transparent', direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
        {/* Desktop Sidebar — position:fixed مثبَّت على حافة الشاشة (يمين
           بالعربية/يسار بالإنجليزية)، بعرض من متغيّر CSS موحّد (--sidebar-width/
           --sidebar-collapsed بـindex.css) — لا أرقام مكررة هنا وبالنسخة
           المتنقلة أدناه ولا بـ.main-column (margin يطابق نفس القيمة). */}
        <aside style={{
          position: 'fixed', top: 0, bottom: 0,
          [lang === 'ar' ? 'right' : 'left']: 0,
          width: sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
          boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column',
          transition: 'width 0.3s ease',
          overflow: 'hidden',
          zIndex: 100 }} className={`desktop-sidebar no-print ${theme === 'dark' ? 'sidebar-glow-frame' : 'sidebar-glow-frame-light'}`}>
          {/* Collapse toggle */}
          <button onClick={toggleSidebar} className="sidebar-control-btn" style={{
            position: 'absolute', [lang === 'ar' ? 'left' : 'right']: -14, top: 72, width: 28, height: 28,
            borderRadius: '50%', background: 'var(--primary)', border: '2px solid var(--border-glass)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 12, zIndex: 10 }}>
            {sidebarCollapsed ? (lang === 'ar' ? '▷' : '◁') : (lang === 'ar' ? '◁' : '▷')}
          </button>
          <div style={{ position: 'relative', zIndex: 2, height: '100%' }}>
            {SidebarContent()}
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div onClick={() => setMobileOpen(false)} className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199 }} />
        )}
        {/* Mobile sidebar */}
        <aside style={{
          position: 'fixed', [lang === 'ar' ? 'right' : 'left']: mobileOpen ? 0 : -280, top: 0, bottom: 0,
          width: 'var(--sidebar-width)', boxSizing: 'border-box',
          zIndex: 200, transition: 'all 0.3s ease', overflow: 'hidden' }} className={`mobile-sidebar no-print ${theme === 'dark' ? 'sidebar-glow-frame' : 'sidebar-glow-frame-light'}`}>
          <div style={{ position: 'relative', zIndex: 2, height: '100%' }}>
            {SidebarContent()}
          </div>
        </aside>

        {/* Main — الآن أن السايدبار position:fixed (خارج تدفق الفليكس)،
           يحتاج المحتوى الرئيسي هامشاً صريحاً بنفس عرض السايدبار الفعلي
           (نفس حالة sidebarCollapsed بالضبط، لا رقم منفصل) كي لا يدخل خلفه. */}
        <div className="main-column" style={{
          flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden',
          [lang === 'ar' ? 'marginRight' : 'marginLeft']: sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
          transition: 'margin 0.3s ease',
        }}>
          {/* Top header */}
          <header className="no-print glass-header" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 20px', flexShrink: 0, zIndex: 50 }}>
          {/* Left: back button + hamburger + search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 auto', minWidth: 0 }}>
            <button onClick={() => setMobileOpen(true)} className="mobile-menu-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-primary)', display: 'none' }}>☰</button>
            {/* Back button */}
            <button onClick={() => navigate(-1)} title={tr('btn_back')} className={theme === 'dark' ? 'header-icon-btn-dark' : 'header-icon-btn-light'} style={{ width:36, height:36, borderRadius:'50%', border:'1px solid var(--border)', background:'var(--bg-primary)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-primary)', flexShrink:0 }}>
              {/* أيقونة بدل الرمز النصي "←" الأصلي — نفس الاتجاه بالضبط بغض
                 النظر عن اللغة، لا تغيير سلوكي، فقط استبدال بصري. */}
              <FaArrowLeft />
            </button>
            {/* Home button */}
            <button onClick={() => navigate('/')} title={lang === 'ar' ? 'الرئيسية' : 'Home'} className={theme === 'dark' ? 'header-icon-btn-dark' : 'header-icon-btn-light'} style={{ width:36, height:36, borderRadius:'50%', border:'1px solid var(--border)', background:'var(--bg-primary)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-primary)', flexShrink:0 }}>
              <FaHome />
            </button>
            <div ref={searchWrapRef} style={{ position:'relative', flex: '1 1 auto', minWidth: 0, maxWidth: 420 }} className="header-search-wrap">
              <div className={`header-search-inner ${theme === 'dark' ? 'header-search-dark' : 'header-search-light'}`}>
                <span className="header-search-icon">🔍</span>
                <input
                  value={globalSearch}
                  onChange={e => { setGlobalSearch(e.target.value); setShowSearchResults(e.target.value.length > 0); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && globalSearch.trim()) {
                      const q = globalSearch.toLowerCase();
                      if (['طبيب','دكتور','doctor'].some(k=>q.includes(k))) navigate('/doctors');
                      else if (['مريض','patient'].some(k=>q.includes(k))) navigate('/patients');
                      else if (['موعد','appointment'].some(k=>q.includes(k))) navigate('/appointments');
                      else if (['قسم','dept'].some(k=>q.includes(k))) navigate('/departments');
                      else if (['تشخيص','ذكاء','diagnosis'].some(k=>q.includes(k))) navigate('/ai-diagnosis');
                      else if (['حساب','راتب','account'].some(k=>q.includes(k))) navigate('/accounts');
                      else if (['hr','موارد','موظف'].some(k=>q.includes(k))) navigate('/hr');
                      setGlobalSearch(''); setShowSearchResults(false);
                    }
                    if (e.key === 'Escape') { setGlobalSearch(''); setShowSearchResults(false); }
                  }}
                  onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                  placeholder={tr('auto_pair_1')}
                  className="header-search-input"
                />
                {globalSearch && <span onClick={() => { setGlobalSearch(''); setShowSearchResults(false); }} style={{ cursor:'pointer', color:'var(--text-secondary)', fontSize:20, flexShrink:0 }}>×</span>}
              </div>
              {showSearchResults && globalSearch.trim() && (
                // Portal — نفس سبب لوحة الإشعارات بالضبط: .glass-header
                // overflow:hidden كانت تقصّ هذه القائمة (ابن عادي داخلها سابقاً).
                <HeaderFloatingPanel anchorRef={searchWrapRef} open align="end" style={{ minWidth: 240, background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:10, padding:8, boxShadow:'0 8px 24px rgba(0,0,0,0.15)' }}>
                <div
                  ref={searchResultsCursorSuspend.ref}
                  onPointerEnter={searchResultsCursorSuspend.onPointerEnter}
                  onPointerLeave={searchResultsCursorSuspend.onPointerLeave}
                >
                  {[
                    {label:tr('nav_doctors'), path:'/doctors', icon:'👨‍⚕️'},
                    {label:tr('nav_patients'), path:'/patients', icon:'👥'},
                    {label:tr('nav_appointments'), path:'/appointments', icon:'📅'},
                    {label:tr('nav_ai_diagnosis'), path:'/ai-diagnosis', icon:'🧠'},
                    {label:tr('nav_departments'), path:'/departments', icon:'🏢'},
                    {label:tr('nav_hr'), path:'/hr', icon:'👔'},
                    {label:tr('nav_accounts'), path:'/accounts', icon:'💰'},
                  ].filter(item => item.label.includes(globalSearch) || item.path.includes(globalSearch.toLowerCase()))
                   .slice(0, 5)
                   .map(item => (
                    <div key={item.path} onMouseDown={() => { navigate(item.path); setGlobalSearch(''); setShowSearchResults(false); }}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, cursor:'pointer', fontSize:13 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span>{item.icon}</span><span>{item.label}</span>
                    </div>
                  ))}
                  {[
                    {label:tr('nav_doctors'), path:'/doctors', icon:'👨‍⚕️'},
                    {label:tr('nav_patients'), path:'/patients', icon:'👥'},
                    {label:tr('nav_appointments'), path:'/appointments', icon:'📅'},
                    {label:tr('nav_ai_diagnosis'), path:'/ai-diagnosis', icon:'🧠'},
                    {label:tr('nav_departments'), path:'/departments', icon:'🏢'},
                    {label:tr('nav_hr'), path:'/hr', icon:'👔'},
                    {label:tr('nav_accounts'), path:'/accounts', icon:'💰'},
                  ].filter(item => !item.label.includes(globalSearch) && !item.path.includes(globalSearch.toLowerCase())).length === 7 && (
                    <div style={{ padding:'8px 12px', fontSize:12, color:'var(--text-secondary)', textAlign:'center' }}>
                      {tr('layout_press_enter_search')}
                    </div>
                  )}
                </div>
                </HeaderFloatingPanel>
              )}
            </div>
          </div>

          {/* Right: controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* مؤشر/قائمة المنشأة — يظهر فقط عند تفعيل نظام المنشآت المتعددة */}
            {multiHospitalEnabled && (
              user?.hospitalId ? (
                // حساب مربوط بمنشأة واحدة: شارة معلوماتية ثابتة (غير قابلة للتغيير)
                <div title={lang === 'ar' ? 'منشأتك الحالية' : 'Your current facility'} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                  background: 'var(--bg-primary)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-primary)',
                }}>
                  🏥 {hospitals.find(h => h.id === user.hospitalId)?.name_ar || '—'}
                </div>
              ) : (
                // بديل مُصمَّم بالكامل بدل <select> الأصلي (لكلا الثيمين الآن) —
                // قائمة <select> المفتوحة يرسمها المتصفح/نظام التشغيل نفسه ولا
                // يمكن تنسيقها بـCSS إطلاقاً، وهذا سبب "عدم الوضوح" الأصلي في
                // كلا الوضعين، وليس مجرد تباين ألوان. راجع HeaderSelectDropdown.js.
                <HeaderSelectDropdown
                  value={viewingHospitalId}
                  onChange={setViewingHospitalId}
                  title={lang === 'ar' ? 'أشوف الآن بيانات:' : 'Currently viewing:'}
                  dark={theme === 'dark'}
                  options={[
                    { value: 'all', label: lang === 'ar' ? 'كل المنشآت' : 'All facilities', icon: '🏥' },
                    ...hospitals.map(h => ({ value: h.id, label: h.name_ar, icon: '🏥' })),
                  ]}
                />
              )
            )}
            {/* Theme */}
            <button onClick={toggleTheme} className={theme === 'dark' ? 'header-icon-btn-dark' : 'header-icon-btn-light'} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
              {theme === 'dark' ? <FaSun /> : <FaMoon />}
            </button>
            {/* Lang */}
            <button onClick={toggleLang} className={theme === 'dark' ? 'header-pill-btn-dark' : 'header-pill-btn-light'} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
              {lang === 'ar' ? 'EN' : 'AR'}
            </button>
            {/* Universal print-to-PDF (hidden on pages with their own custom print/export flow — see printConfig.js) */}
            <PrintButton hidden={printButtonHidden} onPrint={handlePrint} />
            {/* Notifications — الشارة الآن ابن مباشر لهذا الـwrapper، وليست
               ابناً للزر نفسه: .header-icon-btn-dark يحمل clip-path (شكل
               مثمن الأضلاع، راجع Layout.dark.css) يقصّ كل أبناء الزر بما
               فيها أي عنصر مطلق التموضع في زاويته — وهذا كان السبب الحقيقي
               لقصّ الشارة، وليس أي overflow أو z-index. الـwrapper نفسه بلا
               clip-path فتظهر الشارة كاملة فوق حافة الزر تماماً كالتصميم. */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowNotif(p => !p)} className={theme === 'dark' ? 'header-icon-btn-dark' : 'header-icon-btn-light'} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
                <FaBell />
              </button>
              {unread > 0 && (
                <span className="header-notification-badge">{unread > 99 ? '99+' : unread}</span>
              )}
              {showNotif && <NotificationPanel onClose={() => setShowNotif(false)} anchorRef={notifRef} />}
            </div>
            {/* User */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: user?.color || '#1a6bab', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>
                {user?.avatar || 'م'}
              </div>
              <div style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{user?.jobTitle || user?.role}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="page-main" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {location.pathname !== '/' && <div className="no-print"><HealthBanner /></div>}
          {/* printable-content is the only thing left visible when printing —
              see the .no-print / @media print rules below */}
          <div id="printable-content" className="printable-content">
            {printOverlay && (printOverlay.includeHeader || printOverlay.includeLogo) && (
              <div className="print-only-block" style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid #1a6bab', paddingBottom: 10, marginBottom: 16 }}>
                {printOverlay.includeLogo && (
                  // Uses the uploaded organization logo if one exists,
                  // falling back to the built-in icon otherwise — see AppLogo.js.
                  <AppLogo size={44} radius={8} fontSize={22} />
                )}
                {printOverlay.includeHeader && (
                  // printOverlay.headerText already carries the resolved
                  // per-print > global-default > hardcoded-default text — see
                  // PrintButton.js's confirmPrint().
                  <div style={{ flex: 1, fontWeight: 700, fontSize: 16, color: '#000' }}>{printOverlay.headerText}</div>
                )}
              </div>
            )}

            <Outlet />

            {printOverlay?.includeFooter && (
              // printOverlay.footerText already carries the resolved
              // per-print > global-default > hardcoded-default text (the
              // hardcoded default being the print date/time) — see
              // PrintButton.js's confirmPrint(). Note: native browser print
              // doesn't support reliable per-page page-number counters from
              // page HTML/CSS (that needs a PDF generation library) — the
              // browser's own print dialog "headers and footers" option can
              // add those independently if enabled.
              <div className="print-only-block" style={{ marginTop: 20, paddingTop: 10, borderTop: '1px solid #999', fontSize: 10, color: '#555', textAlign: 'center' }}>
                {printOverlay.footerText}
              </div>
            )}
          </div>
        </main>

        {/* Copyright footer */}
        <footer className="no-print" style={{ padding: '8px 20px', textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', background: 'var(--bg-primary)', flexShrink: 0 }}>
          All rights reserved © Eng. Huda Elmuthefer — {appNameEn.toUpperCase()}
        </footer>

        {/* Mobile bottom nav */}
        <nav className="bottom-nav no-print" style={{ display: 'none', background: '#1565c0', padding: '8px 0', flexShrink: 0 }}>
          {visiblePages.slice(0, 4).map(p => (
            <NavLink key={p.key} to={p.path} end={p.path === '/'} style={({ isActive }) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textDecoration: 'none', color: isActive ? '#fff' : 'rgba(255,255,255,0.6)', padding: '4px 0' })}>
              <span style={{ fontSize: 20 }}>{renderNavIcon(p.key)}</span>
              <span style={{ fontSize: 9 }}>{tr(p.navKey).split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <style>{`
        .page-content { max-width: 1400px; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          /* السايدبار المكتبي بات position:fixed خارج تدفّق الفليكس، والهامش
             المقابل بـ.main-column قيمة JS ثابتة (marginRight/marginLeft) —
             على الجوال حيث يختفي السايدبار المكتبي بالكامل، يجب إلغاء ذلك
             الهامش صراحةً وإلا بقي فراغ فارغ بحجمه رغم اختفاء العنصر نفسه. */
          .main-column { margin-right: 0 !important; margin-left: 0 !important; }
          .mobile-menu-btn { display: flex !important; }
          .bottom-nav { display: flex !important; }
        }

        /* Universal print-to-PDF (PrintButton) — paper size/orientation come
           from the global Print Settings (SettingsPage); only .printable-content
           (the current page's Outlet, i.e. everything except sidebar/nav/header/
           footer/buttons) stays visible when printing. */
        @page { size: ${printSettings.paperSize === 'Letter' ? 'letter' : 'A4'} ${printSettings.orientation}; margin: 12mm; }
        .print-only-block { display: none; }
        @media print {
          .no-print { display: none !important; }
          html, body { height: auto !important; overflow: visible !important; }
          .app-shell, .main-column { display: block !important; height: auto !important; overflow: visible !important; }
          .page-main { overflow: visible !important; height: auto !important; padding: 0 !important; }
          .print-only-block { display: block !important; }
        }
      `}</style>
      </div>
    </>
  );
}

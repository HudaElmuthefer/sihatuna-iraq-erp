/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import HealthBanner from './HealthBanner';
import PrintButton from './PrintButton';
import AppLogo from './AppLogo';
import { useApp, ALL_PAGES } from '../contexts/AppContext';
import { useT } from '../translations';
import NotificationPanel from './NotificationPanel';
import { isPrintButtonHidden } from '../config/printConfig';
import { SIDEBAR_SUB_TABS } from '../config/sidebarSubTabs';

const NAV_ICONS = {
  'dashboard': '🏠', 'services': '🎯', 'patients': '👥', 'doctors': '🩺',
  'appointments': '📅', 'departments': '🏢', 'ai-diagnosis': '🧠',
  'vaccinations': '💉', 'drug-interactions': '💊', 'dosage-check': '⚖️', 'allergy-check': '🚫', 'medical-leave': '🏥',
  'smart-reports': '📊', 'hr': '👔', 'accounts': '💰', 'settings': '⚙️',
  'inventory': '📦', 'procurement': '🛒', 'projects': '📐', 'documents': '📁', 'crm': '📇', 'payment-settings': '💳', 'billing': '🧾', 'results': '📄', 'barcode': '🏷️' };

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
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [globalSearch, setGlobalSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // ── القوائم الفرعية القابلة للتوسّع (للصفحات ذات التبويبات الداخلية،
  // مثل HR/الحسابات/الجودة) — مجموعة مفاتيح الصفحات المفتوحة حالياً. أكثر
  // من عنصر يقدر يبقى مفتوحاً بالتوازي عمداً (بدل إغلاق تلقائي للباقي)، ولا
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

  const unread = notifications.filter(n => !n.read).length;
  // الصفحات الظاهرة = صلاحيات الدور (كما كان) + صفحات منشأة المستخدم المفعّلة
  // (لو له منشأة مُعيَّنة ولها قائمة صفحات محدَّدة). حساب مستوى الوزارة (بلا
  // منشأة) أو منشأة بلا قيود مُعرَّفة (enabled_pages فاضي) = يشوف كل الصفحات
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
      <div style={{ padding: sidebarCollapsed ? '20px 10px' : '20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AppLogo size={38} radius={10} fontSize={20} />
          {!sidebarCollapsed && (
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{appName} ERP</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{tr("app_subtitle")}</div>
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
          nav::-webkit-scrollbar { width: 5px; }
          nav::-webkit-scrollbar-track { background: transparent; }
          nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 10px; }
          nav::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.45); }
        `}</style>

        {(() => {
          const groups = [];
          const seen = new Set();
          visiblePages.forEach(page => {
            const g = page.group || 'core';
            if (!seen.has(g)) { seen.add(g); groups.push(g); }
          });
          return groups.map(group => {
            const pages = visiblePages.filter(p => (p.group || 'core') === group);
            const gLabel = GROUP_LABELS[group] || { ar: group, en: group };
            // فاصل بصري رفيع قبل مجموعة "الإعدادات" المثبَّتة بآخر القائمة —
            // توضح أنها عنصر منفصل عن باقي التنقل الرئيسي، لا مجرد آخر عنصر
            // اتفاقاً بسبب الترتيب.
            const isSettingsFooter = group === 'settingsFooter';
            return (
              <div key={group} style={isSettingsFooter ? { marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' } : undefined}>
                {!sidebarCollapsed && gLabel.ar && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', padding: '10px 14px 4px', letterSpacing: '0.05em' }}>
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
                  // إصلاح: العنصر الرئيسي لصفحة بها تبويبات فرعية ليس له فعلياً أي
                  // محتوى "مستقل" خاص به — زيارة المسار وحده (بلا ?tab=) تعرض بالضبط
                  // نفس محتوى أول تبويب فرعي (كل من HRPage/AccountsPage/... يبدأ
                  // بنفس القيمة الافتراضية). فبدل NavLink ينقّل فوراً، الصف كاملاً
                  // (أيقونة+نص+سهم) صار زر توسيع/طيّ واحد موحَّد بلا أي تنقّل — التنقّل
                  // الفعلي يحدث فقط عند اختيار تبويب فرعي محدَّد بالقائمة الممتدة.
                  const commonLabel = lang === 'ar' ? page.label : (page.labelEn || tr(page.navKey));
                  const arrow = (
                    <span style={{ display: 'inline-block', flexShrink: 0, transform: `rotate(${isExpanded ? 90 : 0}deg) scaleX(${lang === 'ar' ? -1 : 1})`, transition: 'transform 0.2s', fontSize: 10, color: isOnThisPage ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)' }}>▶</span>
                  );
                  return (
                    <div key={page.key}>
                      {hasSubTabs ? (
                        <button
                          type="button"
                          onClick={() => {
                            setMobileOpen(false);
                            toggleNavExpanded(page.key);
                            // النقر على العنصر الرئيسي ينتقل أيضاً لصفحته
                            // بتبويبها الافتراضي (بلا ?tab=) — لكن فقط لو لم
                            // تكن الصفحة النشطة أصلاً، وإلا فالنقر المتكرر
                            // وأنت بالفعل داخل أحد تبويباتها كان سيُعيدك
                            // للتبويب الافتراضي بدل الإبقاء على تبويبك
                            // الحالي، وهذا تنقّل غير مرغوب (فقط تبديل
                            // الفتح/الإغلاق مطلوب بهذه الحالة).
                            if (!isOnThisPage) navigate(page.path);
                          }}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? (lang === 'ar' ? `طيّ القائمة الفرعية: ${commonLabel}` : `Collapse submenu: ${commonLabel}`) : (lang === 'ar' ? `توسيع القائمة الفرعية: ${commonLabel}` : `Expand submenu: ${commonLabel}`)}
                          title={sidebarCollapsed ? page.label : ''}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: sidebarCollapsed ? '11px 0' : '9px 14px',
                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                            borderRadius: 8, marginBottom: 2, border: 'none', cursor: 'pointer',
                            background: isOnThisPage ? 'linear-gradient(90deg,#1a6bab,#1557a0)' : 'transparent',
                            color: isOnThisPage ? '#fff' : 'rgba(255,255,255,0.65)',
                            transition: 'all 0.2s', fontSize: 13, fontFamily: 'inherit',
                            textAlign: lang === 'ar' ? 'right' : 'left',
                          }}
                        >
                          <span style={{ fontSize: 16, flexShrink: 0 }}>{NAV_ICONS[page.key] || page.icon}</span>
                          {!sidebarCollapsed && <span style={{ flex: 1, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{commonLabel}</span>}
                          {!sidebarCollapsed && arrow}
                        </button>
                      ) : (
                        <NavLink
                          to={page.path}
                          end={page.path === '/'}
                          onClick={() => setMobileOpen(false)}
                          style={({ isActive }) => ({
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: sidebarCollapsed ? '11px 0' : '9px 14px',
                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                            borderRadius: 8, marginBottom: 2, textDecoration: 'none',
                            background: isActive ? 'linear-gradient(90deg,#1a6bab,#1557a0)' : 'transparent',
                            color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                            transition: 'all 0.2s',
                            fontSize: 13 })}
                          title={sidebarCollapsed ? page.label : ''}
                        >
                          <span style={{ fontSize: 16, flexShrink: 0 }}>{NAV_ICONS[page.key] || page.icon}</span>
                          {!sidebarCollapsed && <span style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{commonLabel}</span>}
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
                                  // لون مختلف عن نص القائمة الرئيسية (rgba(255,255,255,...)
                                  // محايد أبيض/رمادي) — أزرق فاتح من نفس عائلة #1a6bab،
                                  // يبقى مقروءاً بوضوح فوق خلفية الشريط الجانبي الداكنة
                                  // الثابتة (لا تتغيّر مع تبديل سمة فاتح/داكن — راجعي
                                  // ملاحظة التقرير: الشريط الجانبي بالكامل غير متأثر
                                  // بمتغيّر السمة أصلاً).
                                  color: active ? '#ffffff' : 'rgba(159,199,232,0.8)',
                                  background: active ? 'rgba(26,107,171,0.4)' : 'transparent',
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
      <div style={{ padding: sidebarCollapsed ? '12px 8px' : '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        {!sidebarCollapsed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: user?.color || '#1a6bab', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
              {user?.avatar || 'م'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.jobTitle || user?.role}</div>
            </div>
            <button onClick={handleLogout} title={tr('btn_logout')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 16, padding: 4 }}>🚪</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: user?.color || '#1a6bab', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>{user?.avatar || 'م'}</div>
            <button onClick={handleLogout} title={tr('btn_logout')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>🚪</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="app-shell" style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)', direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
      {/* Desktop Sidebar */}
      <aside style={{
        width: sidebarCollapsed ? 70 : 260,
        background: 'linear-gradient(180deg,#0f1923 0%,#0d1e2e 100%)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.3s ease',
        position: 'relative', flexShrink: 0,
        zIndex: 100 }} className="desktop-sidebar no-print">
        {/* Collapse toggle */}
        <button onClick={toggleSidebar} style={{
          position: 'absolute', left: -14, top: 72, width: 28, height: 28,
          borderRadius: '50%', background: '#1a6bab', border: '2px solid var(--bg-primary)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 12, zIndex: 10, transition: 'all 0.3s' }}>
          {sidebarCollapsed ? '◁' : '▷'}
        </button>
        {SidebarContent()}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199 }} />
      )}
      {/* Mobile sidebar */}
      <aside style={{
        position: 'fixed', right: mobileOpen ? 0 : -280, top: 0, bottom: 0, width: 260,
        background: 'linear-gradient(180deg,#0f1923 0%,#0d1e2e 100%)',
        zIndex: 200, transition: 'right 0.3s ease' }} className="mobile-sidebar no-print">
        {SidebarContent()}
      </aside>

      {/* Main */}
      <div className="main-column" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Top header */}
        <header className="no-print" style={{
          height: 60, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', flexShrink: 0, zIndex: 50 }}>
          {/* Left: back button + hamburger + search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setMobileOpen(true)} className="mobile-menu-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-primary)', display: 'none' }}>☰</button>
            {/* Back button */}
            <button onClick={() => navigate(-1)} title={tr('btn_back')} style={{ width:36, height:36, borderRadius:'50%', border:'1px solid var(--border)', background:'var(--bg-primary)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-primary)', flexShrink:0 }}>
              ←
            </button>
            {/* Home button */}
            <button onClick={() => navigate('/')} title={lang === 'ar' ? 'الرئيسية' : 'Home'} style={{ width:36, height:36, borderRadius:'50%', border:'1px solid var(--border)', background:'var(--bg-primary)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-primary)', flexShrink:0 }}>
              🏠
            </button>
            <div style={{ position:'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', borderRadius: 10, padding: '7px 14px', border: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>🔍</span>
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
                  style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: 180 }}
                />
                {globalSearch && <span onClick={() => { setGlobalSearch(''); setShowSearchResults(false); }} style={{ cursor:'pointer', color:'var(--text-secondary)', fontSize:16 }}>×</span>}
              </div>
              {showSearchResults && globalSearch.trim() && (
                <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:10, padding:8, minWidth:240, zIndex:1000, boxShadow:'0 8px 24px rgba(0,0,0,0.15)' }}>
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
                // حساب مستوى الوزارة (بلا منشأة مُعيَّنة): قائمة اختيار فعلية للتركيز على منشأة معينة
                <select
                  value={viewingHospitalId}
                  onChange={e => setViewingHospitalId(e.target.value)}
                  title={lang === 'ar' ? 'أشوف الآن بيانات:' : 'Currently viewing:'}
                  style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', maxWidth: 160 }}
                >
                  <option value="all">🏥 {lang === 'ar' ? 'كل المنشآت' : 'All facilities'}</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name_ar}</option>)}
                </select>
              )
            )}
            {/* Theme */}
            <button onClick={toggleTheme} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 16 }}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            {/* Lang */}
            <button onClick={toggleLang} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
              {lang === 'ar' ? 'EN' : 'AR'}
            </button>
            {/* Universal print-to-PDF (hidden on pages with their own custom print/export flow — see printConfig.js) */}
            <PrintButton hidden={printButtonHidden} onPrint={handlePrint} />
            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowNotif(p => !p)} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 16, position: 'relative' }}>
                🔔
                {unread > 0 && (
                  <span style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{unread}</span>
                )}
              </button>
              {showNotif && <NotificationPanel onClose={() => setShowNotif(false)} />}
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
              <span style={{ fontSize: 20 }}>{NAV_ICONS[p.key]}</span>
              <span style={{ fontSize: 9 }}>{tr(p.navKey).split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <style>{`
        .page-content { max-width: 1400px; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
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
  );
}

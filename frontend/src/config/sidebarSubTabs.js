// frontend/src/config/sidebarSubTabs.js
//
// Sidebar sub-navigation for pages whose content is itself split into
// internal tabs (HR, Accounts, Quality, ...). Keyed by the same `key` used
// in ALL_PAGES (contexts/AppContext.js). Each entry's `key` must match the
// tab key the host page's own `useState(...)` uses, since navigating here
// appends `?tab=<key>` to the page's path and the host page reads that
// query param as its initial active tab (see each page's `useState(() =>
// searchParams.get('tab') || '<default>')` change).
//
// Two label shapes are supported:
//   - { key, ar, en }: literal bilingual pair (matches how most page tab
//     bars build their own labels inline).
//   - { key, labelKey }: looked up via tr(labelKey) instead — used only for
//     Settings, whose own tab bar already sources labels from translations.js
//     rather than inline ar/en pairs.
// `adminOnly: true` mirrors a tab that the host page itself only renders for
// user?.role === 'admin' (SettingsPage.js) — the sidebar must hide it under
// the same condition, or a non-admin would see a sub-tab link that renders
// nothing on the page.
export const SIDEBAR_SUB_TABS = {
  hr: [
    { key: 'employees', ar: 'الموظفون', en: 'Employees' },
    { key: 'outgoing', ar: 'الكتب الصادرة', en: 'Outgoing Letters' },
    { key: 'incoming', ar: 'الكتب الواردة', en: 'Incoming Letters' },
    { key: 'retired', ar: 'المتقاعدون', en: 'Retired' },
    { key: 'dossiers', ar: 'الإضابير الشخصية', en: 'Personal Dossiers' },
    { key: 'barcode', ar: 'باركود الكتب', en: 'Letters Barcode' },
  ],
  accounts: [
    { key: 'general', ar: 'الحسابات العامة', en: 'General Accounts' },
    { key: 'salaries', ar: 'كشف الرواتب', en: 'Salaries' },
    { key: 'promotions', ar: 'الترفيعات', en: 'Promotions' },
    { key: 'allowances', ar: 'العلاوات', en: 'Allowances' },
  ],
  quality: [
    { key: 'kpi', ar: 'مؤشرات الأداء', en: 'KPIs' },
    { key: 'audits', ar: 'المراجعات', en: 'Audits' },
    { key: 'ncs', ar: 'عدم المطابقة', en: 'Non-Conformance' },
  ],
  ambulance: [
    { key: 'vehicles', ar: 'المركبات', en: 'Vehicles' },
    { key: 'missions', ar: 'المأموريات', en: 'Missions' },
  ],
  pharmacy: [
    { key: 'prescriptions', ar: 'الوصفات الطبية', en: 'Prescriptions' },
    { key: 'available', ar: 'الأدوية المتوفرة', en: 'Drug Inventory' },
    { key: 'shortage', ar: 'نواقص الأدوية', en: 'Drug Shortage' },
  ],
  physiotherapy: [
    { key: 'sessions', ar: 'الجلسات', en: 'Sessions' },
    { key: 'equipment', ar: 'الأجهزة', en: 'Equipment' },
  ],
  delivery: [
    { key: 'admitted', ar: 'قبل الولادة', en: 'Before Delivery' },
    { key: 'delivered', ar: 'سجلات الولادة', en: 'Delivery Records' },
  ],
  wards: [
    { key: 'admissions', ar: 'حالات الإدخال', en: 'Admissions' },
    { key: 'schedule', ar: 'جدول الأدوية اليومي', en: 'Daily Medication Schedule' },
    { key: 'wards', ar: 'الردهات والأسرّة', en: 'Wards & Beds' },
  ],
  crm: [
    { key: 'followups', ar: 'المتابعات والتذكيرات', en: 'Follow-ups' },
    { key: 'campaigns', ar: 'حملات التوعية', en: 'Campaigns' },
    { key: 'reports', ar: 'التقارير', en: 'Reports' },
  ],
  settings: [
    { key: 'users', labelKey: 'set_tab_users' },
    { key: 'appearance', labelKey: 'set_tab_appearance' },
    { key: 'system', labelKey: 'set_tab_system' },
    { key: 'print', labelKey: 'set_tab_print' },
    { key: 'logo', labelKey: 'set_tab_logo', adminOnly: true },
    { key: 'appname', labelKey: 'set_tab_appname', adminOnly: true },
    { key: 'hospitals', labelKey: 'set_tab_hospitals', adminOnly: true },
    { key: 'ai', labelKey: 'set_tab_ai', adminOnly: true },
    { key: 'backups', labelKey: 'set_tab_backups', adminOnly: true },
    { key: 'updates', labelKey: 'set_tab_updates', adminOnly: true },
    { key: 'recycle', labelKey: 'set_tab_recycle', adminOnly: true },
    { key: 'about', labelKey: 'set_tab_about' },
  ],
};

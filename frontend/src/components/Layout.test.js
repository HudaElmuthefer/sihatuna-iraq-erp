// frontend/src/components/Layout.test.js
//
// Covers the expandable sidebar sub-navigation (accordion-style) for pages
// whose content is split into internal tabs (HR, Accounts, Quality, ...).
// Before this feature, reaching e.g. Salaries meant opening "Accounts"
// first and then hunting for the right tab inside it — the sidebar item
// now expands in place to list every sub-tab directly, and clicking one
// navigates straight to that page with that tab active (?tab=<key>, read
// by each host page's initial useState — see config/sidebarSubTabs.js and
// each page's own small change).
//
// A parent row with sub-tabs has no page content of its own (visiting its
// route directly renders exactly the first sub-tab's content — confirmed
// by reading HRPage.js/AccountsPage.js/etc.), so the whole row (icon+label+
// arrow) is a single button that BOTH toggles open/closed AND navigates to
// the page's default tab (no ?tab=) in the same click — but only when not
// already on that page, so repeat-clicking it while already viewing one of
// its sub-tabs just toggles the submenu without resetting you back to the
// default tab.
//
// Layout renders TWO copies of the nav (desktop aside + mobile aside,
// sharing the same state) — every query below is scoped to the desktop
// one (`.desktop-sidebar`) via `within()`, otherwise every label/button
// would match twice. Since 10 different pages now have their own toggle
// row, row-level queries are further scoped to a single page's row via
// `getRowButtonFor` (there is no other reasonable way to tell "HR's row"
// apart from "Quality's row" by role/name alone).
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import Layout from './Layout';
import { useApp } from '../contexts/AppContext';

jest.mock('../contexts/AppContext', () => {
  const actual = jest.requireActual('../contexts/AppContext');
  return { ...actual, useApp: jest.fn() };
});

// Trivial stubs — none of these are relevant to sidebar navigation itself,
// and several pull in browser APIs (canvas/print) not needed here.
jest.mock('./HealthBanner', () => () => null);
jest.mock('./PrintButton', () => () => null);
jest.mock('./AppLogo', () => () => null);
jest.mock('./NotificationPanel', () => () => null);
jest.mock('../config/printConfig', () => ({ isPrintButtonHidden: () => false }));

const baseAppValue = {
  user: { name: 'Test User', role: 'nurse', hospitalId: null },
  logout: jest.fn(),
  theme: 'light',
  toggleTheme: jest.fn(),
  lang: 'ar',
  toggleLang: jest.fn(),
  sidebarCollapsed: false,
  toggleSidebar: jest.fn(),
  notifications: [],
  hasPermission: () => true,
  multiHospitalEnabled: false,
  hospitals: [],
  viewingHospitalId: 'all',
  setViewingHospitalId: jest.fn(),
  printSettings: { paperSize: 'A4', orientation: 'portrait' },
  appName: 'صحتنا',
  appNameEn: 'Sihatuna',
  printOverlay: null,
  setPrintOverlay: jest.fn(),
};

// A stub page component that renders the current tab query param, so tests
// can verify the sidebar sub-tab link actually lands on the right tab
// without needing the real (much heavier) HRPage/AccountsPage components.
// Reads via useSearchParams() (MemoryRouter's own virtual location) rather
// than window.location, which MemoryRouter never actually updates.
function StubPage({ label }) {
  const [params] = useSearchParams();
  return <div>{label} tab={params.get('tab') || '(none)'}</div>;
}

function renderLayout({ initialPath = '/hr', lang = 'ar', role = 'nurse' } = {}) {
  useApp.mockReturnValue({ ...baseAppValue, lang, user: { ...baseAppValue.user, role } });
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<StubPage label="dashboard" />} />
          <Route path="hr" element={<StubPage label="hr" />} />
          <Route path="accounts" element={<StubPage label="accounts" />} />
          <Route path="quality" element={<StubPage label="quality" />} />
          <Route path="settings" element={<StubPage label="settings" />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  return within(document.querySelector('.desktop-sidebar'));
}

// Finds the single toggle button for one specific nav item's row (icon +
// label + arrow are all one <button> now — see Layout.js), identified by a
// substring of its accessible name (e.g. "الموارد البشرية" for HR). A
// regex (not an exact string) is required since the button's accessible
// name also includes its emoji icon and the arrow glyph.
function getRowButtonFor(sidebar, nameSubstring) {
  return sidebar.getByRole('button', { name: new RegExp(nameSubstring) });
}

describe('Sidebar expandable sub-navigation', () => {
  test('a page with internal tabs (HR) is a single toggle button, collapsed by default when not the active page', () => {
    const sidebar = renderLayout({ initialPath: '/' });
    expect(getRowButtonFor(sidebar, 'الموارد البشرية')).toBeInTheDocument();
    // Sub-tab labels aren't rendered at all while collapsed
    expect(sidebar.queryByText('كشف الرواتب')).not.toBeInTheDocument();
  });

  test('clicking the HR row reveals all of its sub-tabs', () => {
    const sidebar = renderLayout({ initialPath: '/' });
    fireEvent.click(getRowButtonFor(sidebar, 'الموارد البشرية'));

    expect(sidebar.getByText('الموظفون')).toBeInTheDocument();
    expect(sidebar.getByText('الكتب الصادرة')).toBeInTheDocument();
    expect(sidebar.getByText('الكتب الواردة')).toBeInTheDocument();
    expect(sidebar.getByText('المتقاعدون')).toBeInTheDocument();
    expect(sidebar.getByText('الإضابير الشخصية')).toBeInTheDocument();
    expect(sidebar.getByText('باركود الكتب')).toBeInTheDocument();
  });

  test('clicking the HR row again collapses it back (toggle, not one-way)', () => {
    const sidebar = renderLayout({ initialPath: '/' });
    const row = getRowButtonFor(sidebar, 'الموارد البشرية');
    fireEvent.click(row);
    expect(sidebar.getByText('الموظفون')).toBeInTheDocument();
    fireEvent.click(row);
    expect(sidebar.queryByText('الموظفون')).not.toBeInTheDocument();
  });

  // The core behavior requested: clicking the row itself (not a separate
  // arrow-only hit target) both navigates to the page's default tab AND
  // opens the submenu, together, in the same click.
  test('clicking the HR row while elsewhere navigates to HR (default tab) and opens the submenu, together', () => {
    renderLayout({ initialPath: '/' });
    expect(screen.getByText('dashboard tab=(none)')).toBeInTheDocument();

    const sidebar = within(document.querySelector('.desktop-sidebar'));
    fireEvent.click(getRowButtonFor(sidebar, 'الموارد البشرية'));

    // Navigated to HR's own route, with no ?tab= (its default tab)
    expect(screen.getByText('hr tab=(none)')).toBeInTheDocument();
    expect(screen.queryByText('dashboard tab=(none)')).not.toBeInTheDocument();
    // ...and the submenu opened in the very same click
    expect(sidebar.getByText('الموظفون')).toBeInTheDocument();
  });

  // Repeat-click behavior while already on the page: clicking the row again
  // must NOT force-navigate back to the default tab — the user could be on
  // any of its sub-tabs already, and that choice should be preserved. Only
  // the submenu's open/closed state should change.
  test('clicking the HR row again while already on a non-default sub-tab only toggles the submenu, without resetting to the default tab', () => {
    renderLayout({ initialPath: '/hr?tab=outgoing' });
    // Confirm we start on the non-default "outgoing" sub-tab
    expect(screen.getByText('hr tab=outgoing')).toBeInTheDocument();

    const sidebar = within(document.querySelector('.desktop-sidebar'));
    const row = getRowButtonFor(sidebar, 'الموارد البشرية');
    // HR is already auto-expanded (active page) — this click collapses it
    fireEvent.click(row);
    expect(screen.getByText('hr tab=outgoing')).toBeInTheDocument(); // unchanged — no reset navigation
    expect(sidebar.queryByText('الموظفون')).not.toBeInTheDocument(); // submenu collapsed

    // Clicking again re-expands, still without touching the current tab
    fireEvent.click(row);
    expect(screen.getByText('hr tab=outgoing')).toBeInTheDocument();
    expect(sidebar.getByText('الموظفون')).toBeInTheDocument();
  });

  test('the parent of the currently active page auto-expands on load, without needing a click', () => {
    const sidebar = renderLayout({ initialPath: '/hr' });
    // No click at all — HR's sub-tabs should already be visible because /hr is the active route
    expect(sidebar.getByText('الموظفون')).toBeInTheDocument();
    expect(sidebar.getByText('المتقاعدون')).toBeInTheDocument();
  });

  test('clicking a sub-tab link navigates to that exact page and tab (Salaries under Accounts)', () => {
    const sidebar = renderLayout({ initialPath: '/accounts' });
    // Accounts auto-expanded since it's the active page
    fireEvent.click(sidebar.getByText('كشف الرواتب'));
    expect(screen.getByText('accounts tab=salaries')).toBeInTheDocument();
  });

  test('multiple sidebar items can stay expanded in parallel (expanding one does not collapse another)', () => {
    const sidebar = renderLayout({ initialPath: '/hr' }); // HR auto-expanded
    // Explicitly expand Quality too, alongside the already-auto-expanded HR
    fireEvent.click(getRowButtonFor(sidebar, 'إدارة الجودة ISO'));

    // HR's sub-tabs (auto-expanded) are still visible...
    expect(sidebar.getByText('الموظفون')).toBeInTheDocument();
    // ...alongside Quality's, now also expanded
    expect(sidebar.getByText('مؤشرات الأداء')).toBeInTheDocument();
  });

  test('the expand arrow points mirrored (scaleX(-1)) in Arabic (RTL)', () => {
    const sidebar = renderLayout({ initialPath: '/', lang: 'ar' });
    const arrow = getRowButtonFor(sidebar, 'الموارد البشرية').querySelector('span:last-child');
    expect(arrow.style.transform).toContain('scaleX(-1)');
  });

  test('the expand arrow points un-mirrored (scaleX(1)) in English (LTR)', () => {
    const sidebar = renderLayout({ initialPath: '/', lang: 'en' });
    const arrow = getRowButtonFor(sidebar, 'Human Resources').querySelector('span:last-child');
    expect(arrow.style.transform).toContain('scaleX(1)');
  });

  test('Settings sub-tabs hide admin-only entries (e.g. Hospitals) for a non-admin user', () => {
    const sidebar = renderLayout({ initialPath: '/settings', role: 'nurse' });
    expect(sidebar.queryByText('المنشآت')).not.toBeInTheDocument();
  });

  test('Settings sub-tabs show admin-only entries (e.g. Hospitals) for an admin user', () => {
    const sidebar = renderLayout({ initialPath: '/settings', role: 'admin' });
    expect(sidebar.getByText('المنشآت')).toBeInTheDocument();
  });

  // Visual distinction: the sub-tab panel must not just be a smaller copy
  // of the main nav styling — it needs its own shaded background and its
  // links need a distinct text color, per the design requirement.
  describe('visual distinction between main nav items and sub-tabs', () => {
    test('the sub-tab panel has its own shaded background, separate from the sidebar\'s plain dark background', () => {
      renderLayout({ initialPath: '/hr' });
      const group = document.querySelector('.sidebar-subtab-group');
      expect(group).toBeInTheDocument();
      // jsdom re-serializes rgba() with spaces after each comma.
      expect(group.style.background).toBe('rgba(26, 107, 171, 0.07)');
    });

    test('an inactive sub-tab link uses a different text color than the main item labels', () => {
      renderLayout({ initialPath: '/hr' });
      // Index 0 ("Employees") is the active default tab for /hr with no
      // ?tab= — index 1 ("Outgoing Letters") is guaranteed inactive, which
      // is what this assertion needs (the inactive-state color).
      const subLink = document.querySelectorAll('.sidebar-subtab-link')[1];
      expect(subLink).toBeInTheDocument();
      // Inactive sub-tab color (deep steel blue, readable on the light pearl
      // sidebar) must differ from the main item's inactive navy color.
      expect(subLink.style.color).not.toBe('rgb(32, 56, 75)');
      expect(subLink.style.color).toBe('rgb(61, 90, 117)');
    });

    test('a sub-tab link renders with a smaller font size than a main nav item', () => {
      renderLayout({ initialPath: '/hr' });
      const subLink = document.querySelector('.sidebar-subtab-link');
      expect(parseFloat(subLink.style.fontSize)).toBeLessThan(12);
    });
  });
});

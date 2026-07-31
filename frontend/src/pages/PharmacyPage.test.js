// frontend/src/pages/PharmacyPage.test.js
//
// Same class of bug as RadiologyPage.test.js: the prescription search
// predicate calls string methods directly on patientName and prescNo — either
// being undefined (bulk-imported/seeded data) used to throw and crash the
// whole page. Fixed via (field || '').
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PharmacyPage from './PharmacyPage';

// PharmacyPage now reads useSearchParams() (to respect ?tab= from the
// sidebar's expandable sub-navigation — see components/Layout.js), which
// requires a Router ancestor even outside that new behavior's own tests.
const renderPage = () => render(<MemoryRouter><PharmacyPage /></MemoryRouter>);

jest.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    pharmacyOrders: [
      { id: 1, prescNo: 'RX-2026-0001', patientName: 'مريض كامل البيانات', doctorName: 'د. أحمد', date: '2026-07-01', items: [], status: 'dispensed', totalCost: 1000 },
      // Missing prescNo AND status entirely — the real-data shape (all 2305
      // real prescriptions have no status field at all; see the revenue-split
      // describe block below).
      { id: 2, patientName: 'مريض بدون رقم وصفة', doctorName: 'د. سارة', date: '2026-07-02', items: [], totalCost: 2000 },
      // Missing patientName entirely.
      { id: 3, prescNo: 'RX-2026-0003', doctorName: 'د. علي', date: '2026-07-03', items: [], status: 'pending', totalCost: 3000 },
    ],
    setPharmacyOrders: jest.fn(),
    inventory: [],
    setInventory: jest.fn(),
    lang: 'ar',
    showToast: jest.fn(),
    user: { id: 1, name: 'Test User' },
    syncToServer: jest.fn(),
    confirmDialog: jest.fn(),
    hospitals: [],
    multiHospitalEnabled: false,
  }),
}));

describe('PharmacyPage — prescription search crash guard', () => {
  test('typing a search query does not throw when records are missing patientName or prescNo', async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = screen.getByPlaceholderText('🔍 بحث...');
    await user.type(searchInput, 'مريض');

    // If the page had crashed, none of this would be queryable.
    expect(screen.getByText('مريض كامل البيانات')).toBeInTheDocument();
    expect(screen.getByText('مريض بدون رقم وصفة')).toBeInTheDocument();
  });

  test('searching by prescNo still matches records that do have one', async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = screen.getByPlaceholderText('🔍 بحث...');
    await user.type(searchInput, 'rx-2026-0003');

    expect(screen.getByText('RX-2026-0003')).toBeInTheDocument();
    expect(screen.queryByText('مريض كامل البيانات')).not.toBeInTheDocument();
  });
});

// Regression test for a real bug found via live data: all 2305 real
// prescriptions had no `status` field at all (git history shows the "New
// Prescription" form has defaulted status:'pending' since day one, so these
// weren't created through that flow) — folding their cost into "confirmed
// dispensed" revenue would have been a guess. Revenue is now split into a
// confirmed figure (status explicitly 'dispensed', id 1 above = 1000) and a
// separately labeled "potential" figure (no status recorded at all, id 2
// above = 2000), so nothing is silently assumed either way. id 3 (status
// 'pending') is deliberately in neither bucket.
describe('PharmacyPage — confirmed vs potential revenue split', () => {
  test('unstatused prescriptions are excluded from Confirmed Revenue and shown separately as Potential Revenue', () => {
    renderPage();

    // Both figures are labeled and rendered as two distinct cards — the
    // unstatused prescription's cost is never silently folded into
    // "Confirmed" (numeral text isn't asserted directly since it's run
    // through toLocaleString('ar-IQ'), whose digit rendering isn't reliable
    // in the test environment).
    expect(screen.getByText(/إيراد مؤكَّد/)).toBeInTheDocument();
    expect(screen.getByText(/إيراد محتمل \(1 وصفة بلا حالة\)/)).toBeInTheDocument();
    expect(screen.getByTitle(/1 وصفة بلا حالة صرف مسجَّلة إطلاقاً/)).toBeInTheDocument();
  });
});

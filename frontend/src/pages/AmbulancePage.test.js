// frontend/src/pages/AmbulancePage.test.js
//
// Regression test for a real bug found via live data: all 120 real mission
// records had no `status` field at all. Before the fix, the icon
// (`m.status === 'active'`, raw comparison) and the badge
// (`MISS_STATUS[m.status] || MISS_STATUS.active`, silent fallback) disagreed
// for these records — the icon read "not active" while the badge fell back
// to "Active" anyway — and the Complete/Cancel buttons used the same raw
// comparison as the icon, so they never appeared: no mission without a
// recorded status could ever be closed from the UI. A single `missionStatus`
// resolver (same principle as normalizeLookupKey) is now used consistently
// for the stat count, icon, badge, and button visibility, defaulting a
// missing status to 'active' (not yet closed).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AmbulancePage from './AmbulancePage';

// AmbulancePage now reads useSearchParams() (to respect ?tab= from the
// sidebar's expandable sub-navigation — see components/Layout.js), which
// requires a Router ancestor even outside that new behavior's own tests.
const renderPage = () => render(<MemoryRouter><AmbulancePage /></MemoryRouter>);

jest.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    ambulanceData: {
      vehicles: [
        { id: 1, code: 'AMB-01', plate: '12345', type: 'advanced', status: 'available', crew: '', location: '' },
      ],
      missions: [
        // No status recorded at all — the real-data shape.
        { id: 1, missionNo: 'MSN-2026-001', vehicleId: 1, type: 'emergency', address: 'موقع بلا حالة', patient: 'مريض 1', callTime: '2026-07-01T10:00' },
        { id: 2, missionNo: 'MSN-2026-002', vehicleId: 1, type: 'emergency', address: 'موقع منجَز', patient: 'مريض 2', callTime: '2026-07-02T10:00', status: 'completed' },
      ],
    },
    setAmbulanceData: jest.fn(),
    lang: 'ar',
    showToast: jest.fn(),
    syncToServer: jest.fn(),
    confirmDialog: jest.fn(),
    filterByViewingHospital: (records) => records,
    hospitals: [],
    multiHospitalEnabled: false,
    user: null, // keeps the fetch effect from overwriting our seeded ambulanceData
  }),
}));

describe('AmbulancePage — unified mission status resolver', () => {
  test('a mission with no recorded status defaults to Active consistently (counted in the stat, and action buttons appear)', async () => {
    const user = userEvent.setup();
    renderPage();

    // Only the unstatused mission counts as active — the explicitly
    // 'completed' one must not.
    const activeMissionsCard = screen.getByText('مأموريات نشطة').closest('div');
    expect(activeMissionsCard.parentElement.textContent).toContain('1');

    await user.click(screen.getByText('📋 المأموريات'));

    // The unstatused mission's row shows the Active badge and its
    // Complete/Cancel buttons — no visual contradiction, and actionable.
    const row = screen.getByText(/موقع بلا حالة/).parentElement.parentElement.parentElement;
    expect(row.textContent).toContain('نشطة');
    expect(row.textContent).toContain('إنجاز المأمورية');
    expect(row.textContent).toContain('إلغاء');

    // The explicitly-completed mission correctly shows no action buttons.
    const completedRow = screen.getByText(/موقع منجَز/).parentElement.parentElement.parentElement;
    expect(completedRow.textContent).not.toContain('إنجاز المأمورية');
  });
});

// Regression test for a real bug found via live data: vehicles with no `km`
// recorded showed "ليس رقمًا كم" (NaN km) since `n = v => Number(v).toLocaleString(...)`
// had no fallback. The vehicle (AMB-01 in the mock above, which has no `km`
// field) must still show up normally, just with "0" instead of a corrupted value.
describe('AmbulancePage — odometer NaN guard', () => {
  test('a vehicle with no recorded km shows "0 km" instead of "NaN km"', () => {
    renderPage();

    expect(screen.getByText('AMB-01')).toBeInTheDocument();
    expect(screen.getByText(/Odometer:|العداد:/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN|ليس رقم/)).not.toBeInTheDocument();
  });
});

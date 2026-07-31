// frontend/src/pages/hr/RetiredTab.test.js
//
// Covers the date-range filter added on the `retireDate` field (task #11):
// this page previously had no search/date filter at all, so the header
// count `({retired.length})` was accurate — but only by accident, and would
// have silently gone stale the moment any filter was added, exactly like
// the bug already found and fixed on Outgoing/Incoming Letters. Now the
// count is wired to the filtered/paginated total (`retTotalItems`) from the
// start, and retireDate is chosen as the default filter field since it's
// the only date field that's actually meaningful for a "retired" record and
// is displayed in this same table (unlike hireDate, which isn't shown here).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RetiredTab from './RetiredTab';
import { api } from '../../api';

jest.mock('../../api', () => ({ api: { get: jest.fn() } }));

jest.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    showToast: jest.fn(),
    syncToServer: jest.fn(),
    confirmDialog: jest.fn(),
    filterByViewingHospital: (records) => records,
    hospitals: [],
    multiHospitalEnabled: false,
    user: { id: 1, name: 'Test User' }, // truthy — lets useBackendLoad's effect run
  }),
}));

const testRetired = [
  { id: 1, name: 'متقاعد داخل النطاق', jobTitle: 'رئيس قسم', dept: 'الباطنية', retireDate: '2026-07-15', retireSalary: 1200000, pensionNo: 'P-2026-001', phone: '', notes: '' },
  { id: 2, name: 'متقاعد خارج النطاق', jobTitle: 'ممرض', dept: 'الجراحة', retireDate: '2020-01-01', retireSalary: 900000, pensionNo: 'P-2020-001', phone: '', notes: '' },
  // Missing retireDate entirely — bulk-imported/seeded data shape.
  { id: 3, name: 'متقاعد بدون تاريخ', jobTitle: 'محاسب', dept: 'الإدارة', retireDate: undefined, retireSalary: 800000, pensionNo: 'P-0000-001', phone: '', notes: '' },
];

describe('RetiredTab — retireDate range filter with a correctly-wired counter', () => {
  beforeEach(() => {
    api.get.mockResolvedValue(testRetired);
  });

  test('renders all retirees (including one missing a date) without crashing, and the header count matches the visible rows', async () => {
    render(<RetiredTab lang="ar" />);

    await waitFor(() => expect(screen.getByText('متقاعد بدون تاريخ')).toBeInTheDocument());
    expect(screen.getByText('متقاعد داخل النطاق')).toBeInTheDocument();
    expect(screen.getByText('المتقاعدون (3)')).toBeInTheDocument();
  });

  test('a real date range narrows the table and the header count to match, excluding the missing-date record', async () => {
    render(<RetiredTab lang="ar" />);
    await waitFor(() => expect(screen.getByText('متقاعد بدون تاريخ')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-07-31' } });

    expect(screen.getByText('متقاعد داخل النطاق')).toBeInTheDocument();
    expect(screen.queryByText('متقاعد خارج النطاق')).not.toBeInTheDocument();
    expect(screen.queryByText('متقاعد بدون تاريخ')).not.toBeInTheDocument();
    expect(screen.getByText('المتقاعدون (1)')).toBeInTheDocument();
  });

  test('an empty (non-matching) range shows zero rows and a "0" header count', async () => {
    render(<RetiredTab lang="ar" />);
    await waitFor(() => expect(screen.getByText('متقاعد بدون تاريخ')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2030-01-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2030-12-31' } });

    expect(screen.queryByText('متقاعد داخل النطاق')).not.toBeInTheDocument();
    expect(screen.queryByText('متقاعد خارج النطاق')).not.toBeInTheDocument();
    expect(screen.getByText('المتقاعدون (0)')).toBeInTheDocument();
  });

  test('clearing the date range restores the full list and count', async () => {
    render(<RetiredTab lang="ar" />);
    await waitFor(() => expect(screen.getByText('متقاعد بدون تاريخ')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-07-31' } });
    expect(screen.getByText('المتقاعدون (1)')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('مسح فلتر التاريخ'));

    expect(screen.getByText('المتقاعدون (3)')).toBeInTheDocument();
    expect(screen.getByText('متقاعد خارج النطاق')).toBeInTheDocument();
    expect(screen.getByText('متقاعد بدون تاريخ')).toBeInTheDocument();
  });
});

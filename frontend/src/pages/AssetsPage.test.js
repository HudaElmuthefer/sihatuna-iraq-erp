// frontend/src/pages/AssetsPage.test.js
//
// Regression test (Part 2 static audit): a real DB check found 49 of 109
// assets (a bulk-imported batch) have blank purchaseCost/currentValue.
// depr() divided a.currentValue/a.purchaseCost with no `||0` fallback —
// `Number(undefined)` is NaN, so the card literally showed "Depreciation:
// NaN%" and the cost/value cells showed "NaN" for every such record. Fixed
// with the same `Number(x)||0` pattern used elsewhere in this codebase.
//
// Also covers the display-vs-filter mismatch fix: the same 49 records also
// have a blank status/category. `STATUSES[a.status]||STATUSES.active` used
// to display these with a misleading "Active" badge, while the actual
// server-side filter did an exact match on the raw value and never matched
// a blank field — so a record visibly labeled "Active" would vanish from
// the results the moment a user filtered by "Active". Fixed via an explicit
// "unset" lookup key (normalizeLookupKey — same function for both display
// and the filter dropdown) plus a special UNSET_FILTER_VALUE ('__unset__')
// query sentinel that the backend (pgCrud.js) interprets as "field is null
// or empty".
import { render, screen, fireEvent } from '@testing-library/react';
import AssetsPage from './AssetsPage';
import useServerPagination from '../hooks/useServerPagination';

jest.mock('../api', () => ({ api: { get: jest.fn(() => Promise.resolve([])) } }));

jest.mock('../hooks/useServerPagination', () => jest.fn());

jest.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    assets: [],
    setAssets: jest.fn(),
    lang: 'ar',
    showToast: jest.fn(),
    syncToServer: jest.fn(),
    confirmDialog: jest.fn(),
    hospitals: [],
    multiHospitalEnabled: false,
  }),
}));

// Matches the real shape of the affected records: purchaseCost/currentValue
// entirely absent, but the record still has a name/assetNo and must render.
const testAssets = [
  { id: 1, assetNo: 'AST-2026-001', name: 'جهاز بدون تكلفة مسجَّلة', category: 'other', status: 'active', condition: 'good' },
];

describe('AssetsPage — missing purchaseCost/currentValue does not produce NaN', () => {
  beforeEach(() => {
    useServerPagination.mockReturnValue({
      data: testAssets,
      page: 1,
      setPage: jest.fn(),
      total: testAssets.length,
      totalPages: 1,
      loading: false,
      refetch: jest.fn(),
    });
  });

  test('renders the asset card with "0" cost and a safe depreciation fallback, never "NaN"', () => {
    render(<AssetsPage />);

    expect(screen.getByText('جهاز بدون تكلفة مسجَّلة')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});

describe('AssetsPage — status/category display-vs-filter mismatch fix', () => {
  const blankRecord = { id: 1, assetNo: 'AST-2026-001', name: 'أصل بلا حالة أو فئة', condition: 'good' }; // status/category entirely absent

  beforeEach(() => {
    useServerPagination.mockReturnValue({
      data: [blankRecord],
      page: 1,
      setPage: jest.fn(),
      total: 1,
      totalPages: 1,
      loading: false,
      refetch: jest.fn(),
    });
  });

  test('a record with a blank status/category displays "غير محدَّد" (Unset), not "نشط"/"أخرى"', () => {
    render(<AssetsPage />);

    expect(screen.getByText('أصل بلا حالة أو فئة')).toBeInTheDocument();
    expect(screen.getAllByText('غير محدَّد').length).toBeGreaterThan(0);
    expect(screen.queryByText('نشط')).not.toBeInTheDocument();
    expect(screen.queryByText('أخرى')).not.toBeInTheDocument();
  });

  test('selecting the "Unset" status filter forwards the __unset__ sentinel to useServerPagination', () => {
    render(<AssetsPage />);

    const statusSelect = screen.getByText('كل الحالات').closest('select');
    fireEvent.change(statusSelect, { target: { value: '__unset__' } });

    const lastCall = useServerPagination.mock.calls[useServerPagination.mock.calls.length - 1];
    expect(lastCall[1].status).toBe('__unset__');
  });

  test('selecting the "Unset" category filter forwards the __unset__ sentinel to useServerPagination', () => {
    render(<AssetsPage />);

    const categorySelect = screen.getByText('كل الفئات').closest('select');
    fireEvent.change(categorySelect, { target: { value: '__unset__' } });

    const lastCall = useServerPagination.mock.calls[useServerPagination.mock.calls.length - 1];
    expect(lastCall[1].filters.category).toBe('__unset__');
  });

  test('the "Unset" option never appears in the Add/Edit form dropdowns', () => {
    render(<AssetsPage />);
    fireEvent.click(screen.getByText('+ إضافة أصل'));

    // The filter dropdowns legitimately contain "غير محدَّد" (asserted above);
    // scope this check to the modal so we're verifying the form's own
    // category/status <select> elements specifically, not the page filters.
    const modalHeading = screen.getByText('🏗 إضافة أصل جديد');
    const modal = modalHeading.closest('div').parentElement;
    expect(modal.textContent).not.toContain('غير محدَّد');
  });
});

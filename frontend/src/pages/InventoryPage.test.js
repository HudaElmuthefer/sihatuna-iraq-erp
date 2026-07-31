// frontend/src/pages/InventoryPage.test.js
//
// Covers the expiry date-range filter added on top of useServerPagination,
// plus a regression for a real crash found while live-testing it: rows with
// no `supplier` (seen on real leftover test-data records lacking most
// fields) threw "Cannot read properties of undefined (reading 'length')" at
// `item.supplier.length > 16` — fixed via `(item.supplier || '')`.
import { render, screen, fireEvent } from '@testing-library/react';
import InventoryPage from './InventoryPage';
import useServerPagination from '../hooks/useServerPagination';

jest.mock('../api', () => ({ api: { get: jest.fn(() => Promise.resolve([])) } }));

jest.mock('../hooks/useServerPagination', () => jest.fn());

jest.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    inventory: [],
    setInventory: jest.fn(),
    lang: 'ar',
    showToast: jest.fn(),
    syncToServer: jest.fn(),
    confirmDialog: jest.fn(),
    hospitals: [],
    multiHospitalEnabled: false,
  }),
}));

const testItems = [
  { id: 1, code: 'MED-0001', name: 'صنف كامل البيانات', category: 'medicine', qty: 100, minQty: 10, unitCost: 500, supplier: 'شركة الاختبار للأدوية', location: 'مخزن أ', expiry: '2026-10-20', status: 'active' },
  // Missing supplier entirely — the exact shape that crashed the page.
  { id: 2, code: 'MED-0002', name: 'صنف بدون مورد', category: 'medicine', qty: 50, minQty: 10, unitCost: 300, supplier: undefined, location: 'مخزن ب', expiry: '2027-01-01', status: 'active' },
];

describe('InventoryPage — expiry date range filter', () => {
  beforeEach(() => {
    useServerPagination.mockReturnValue({
      data: testItems,
      page: 1,
      setPage: jest.fn(),
      total: testItems.length,
      totalPages: 1,
      loading: false,
      refetch: jest.fn(),
    });
  });

  test('renders the expiry-labeled filter and the item table without crashing on a missing supplier', () => {
    render(<InventoryPage />);

    expect(screen.getByText('تاريخ الانتهاء:')).toBeInTheDocument();
    expect(screen.getByText('صنف كامل البيانات')).toBeInTheDocument();
    expect(screen.getByText('صنف بدون مورد')).toBeInTheDocument();
  });

  test('changing the date range forwards startDate/endDate to useServerPagination alongside the existing category/status filters', () => {
    render(<InventoryPage />);

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-12-31' } });

    const lastCall = useServerPagination.mock.calls[useServerPagination.mock.calls.length - 1];
    expect(lastCall[0]).toBe('inventory');
    expect(lastCall[1].filters).toEqual({ category: 'all', startDate: '2026-01-01', endDate: '2026-12-31' });
  });

  test('the clear button resets the date range while the request still carries the other filters', () => {
    render(<InventoryPage />);

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByTitle('مسح فلتر التاريخ'));

    const lastCall = useServerPagination.mock.calls[useServerPagination.mock.calls.length - 1];
    expect(lastCall[1].filters).toEqual({ category: 'all', startDate: '', endDate: '' });
  });
});

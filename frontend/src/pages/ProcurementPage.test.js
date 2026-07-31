// frontend/src/pages/ProcurementPage.test.js
//
// Same class of bug as RadiologyPage.test.js: the search predicate calls
// string methods directly on title, poNo, and supplier — any being undefined
// (bulk-imported/seeded data) used to throw and crash the whole page. Fixed
// via (field || '').
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProcurementPage from './ProcurementPage';

jest.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    procurement: [
      { id: 1, poNo: 'PO-2026-0001', title: 'أمر شراء كامل البيانات', supplier: 'شركة التوريدات', date: '2026-07-01', status: 'pending', priority: 'normal', totalAmount: 1000, items: 1 },
      // Missing poNo entirely.
      { id: 2, title: 'أمر شراء بدون رقم', supplier: 'مورد آخر', date: '2026-07-02', status: 'pending', priority: 'normal', totalAmount: 2000, items: 1 },
      // Missing title and supplier entirely.
      { id: 3, poNo: 'PO-2026-0003', date: '2026-07-03', status: 'pending', priority: 'normal', totalAmount: 3000, items: 1 },
    ],
    setProcurement: jest.fn(),
    lang: 'ar',
    showToast: jest.fn(),
    user: { id: 1, name: 'Test User' },
    syncToServer: jest.fn(),
    confirmDialog: jest.fn(),
    hospitals: [],
    multiHospitalEnabled: false,
  }),
}));

describe('ProcurementPage — search crash guard', () => {
  test('typing a search query does not throw when records are missing title, poNo, or supplier', async () => {
    const user = userEvent.setup();
    render(<ProcurementPage />);

    const searchInput = screen.getByPlaceholderText('🔍 بحث...');
    await user.type(searchInput, 'أمر شراء');

    // If the page had crashed, none of this would be queryable.
    expect(screen.getByText('أمر شراء كامل البيانات')).toBeInTheDocument();
    expect(screen.getByText('أمر شراء بدون رقم')).toBeInTheDocument();
  });

  test('searching by poNo still matches records that do have one', async () => {
    const user = userEvent.setup();
    render(<ProcurementPage />);

    const searchInput = screen.getByPlaceholderText('🔍 بحث...');
    await user.type(searchInput, 'po-2026-0003');

    expect(screen.getByText('PO-2026-0003')).toBeInTheDocument();
    expect(screen.queryByText('أمر شراء كامل البيانات')).not.toBeInTheDocument();
  });
});

// frontend/src/pages/BillingPage.test.js
//
// Covers the date-range filter added to "Recent Paid Invoices": it filters
// by paidAt (not createdAt) since this list is specifically about when an
// invoice was PAID, and an invoice can sit unpaid for a while after being
// created. Filtering happens before the existing slice(0,10) "recent" cap.
import { render, screen, fireEvent } from '@testing-library/react';
import BillingPage from './BillingPage';

jest.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    lang: 'ar',
    showToast: jest.fn(),
    patients: [
      { id: 1, name: 'مريض داخل النطاق' },
      { id: 2, name: 'مريض خارج النطاق' },
    ],
    servicePrices: [],
    updateServicePrice: jest.fn(),
    invoices: [
      { id: 101, patientId: 1, status: 'paid', total: 10000, paymentMethod: 'cash', paidAt: '2026-07-15T10:00:00.000Z' },
      { id: 102, patientId: 2, status: 'paid', total: 20000, paymentMethod: 'cash', paidAt: '2026-01-01T10:00:00.000Z' },
      // Unpaid — must never appear in the "Recent Paid Invoices" list at all.
      { id: 103, patientId: 1, status: 'unpaid', total: 5000, paymentMethod: null, paidAt: null },
    ],
    createInvoice: jest.fn(),
    addInvoiceItem: jest.fn(),
    removeInvoiceItem: jest.fn(),
    payInvoice: jest.fn(),
    processPayment: jest.fn(),
    paymentGateways: [],
  }),
  PAYMENT_PROVIDERS: [
    { code: 'cash', nameAr: 'دفع نقدي', nameEn: 'Cash', type: 'cash', requiresCredentials: false },
  ],
}));

// Patient names also appear as plain <option> text in the payment-flow's
// patient selector above, so matches are scoped to the "— <date>" pattern
// that only the Recent Paid Invoices rows render, to avoid ambiguous matches.
const inRangeRow = () => screen.getByText(/مريض داخل النطاق —/);
const outOfRangeRow = () => screen.queryByText(/مريض خارج النطاق —/);

describe('BillingPage — Recent Paid Invoices date filter', () => {
  test('renders the paidAt-labeled filter and only paid invoices, without touching the payment flow above', () => {
    render(<BillingPage />);

    expect(screen.getByText('تاريخ الدفع:')).toBeInTheDocument();
    expect(inRangeRow()).toBeInTheDocument();
    expect(outOfRangeRow()).toBeInTheDocument();
    // The patient selector for the payment flow is unaffected by this section.
    expect(screen.getByText('اختر مريضاً')).toBeInTheDocument();
  });

  test('a date range narrows the list to invoices paid within it', () => {
    render(<BillingPage />);

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-07-31' } });

    expect(inRangeRow()).toBeInTheDocument();
    expect(outOfRangeRow()).not.toBeInTheDocument();
  });

  test('an out-of-range window shows the empty state, and clearing restores the full list', () => {
    render(<BillingPage />);

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2020-01-31' } });
    expect(screen.getByText('لا توجد فواتير مدفوعة بعد')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('مسح فلتر التاريخ'));

    expect(inRangeRow()).toBeInTheDocument();
    expect(outOfRangeRow()).toBeInTheDocument();
  });
});

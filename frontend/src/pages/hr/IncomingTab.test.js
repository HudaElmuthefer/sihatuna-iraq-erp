// frontend/src/pages/hr/IncomingTab.test.js
//
// Same coverage as OutgoingTab.test.js: date-range filter on the `date`
// field, plus the header-count fix (now reads `inTotalItems` instead of the
// raw unfiltered `letters.length`).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IncomingTab from './IncomingTab';
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
    user: { id: 1, name: 'Test User' },
  }),
}));

const testLetters = [
  { id: 1, ref: 'و-2026-001', incomingRef: 'IN-1', title: 'كتاب داخل النطاق', from: 'جهة أ', subject: 'موضوع', date: '2026-07-15', status: 'received' },
  { id: 2, ref: 'و-2026-002', incomingRef: 'IN-2', title: 'كتاب خارج النطاق', from: 'جهة ب', subject: 'موضوع', date: '2026-01-01', status: 'received' },
  // Missing date entirely — bulk-imported/seeded data shape.
  { id: 3, ref: 'و-2026-003', incomingRef: 'IN-3', title: 'كتاب بدون تاريخ', from: 'جهة ج', subject: 'موضوع', date: undefined, status: 'received' },
];

describe('IncomingTab — date range filter', () => {
  beforeEach(() => {
    api.get.mockResolvedValue(testLetters);
  });

  test('renders all letters (including one missing a date) without crashing, and the header count matches', async () => {
    render(<IncomingTab lang="ar" />);

    await waitFor(() => expect(screen.getByText('كتاب بدون تاريخ')).toBeInTheDocument());
    expect(screen.getByText('كتاب داخل النطاق')).toBeInTheDocument();
    expect(screen.getByText('الكتب الواردة (3)')).toBeInTheDocument();
  });

  test('a date range narrows the table and the header count to match, excluding the missing-date record', async () => {
    render(<IncomingTab lang="ar" />);
    await waitFor(() => expect(screen.getByText('كتاب بدون تاريخ')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-07-31' } });

    expect(screen.getByText('كتاب داخل النطاق')).toBeInTheDocument();
    expect(screen.queryByText('كتاب خارج النطاق')).not.toBeInTheDocument();
    expect(screen.queryByText('كتاب بدون تاريخ')).not.toBeInTheDocument();
    expect(screen.getByText('الكتب الواردة (1)')).toBeInTheDocument();
  });

  test('clearing the date range restores the full list and count', async () => {
    render(<IncomingTab lang="ar" />);
    await waitFor(() => expect(screen.getByText('كتاب بدون تاريخ')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-07-31' } });
    expect(screen.getByText('الكتب الواردة (1)')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('مسح فلتر التاريخ'));

    expect(screen.getByText('الكتب الواردة (3)')).toBeInTheDocument();
    expect(screen.getByText('كتاب خارج النطاق')).toBeInTheDocument();
    expect(screen.getByText('كتاب بدون تاريخ')).toBeInTheDocument();
  });
});

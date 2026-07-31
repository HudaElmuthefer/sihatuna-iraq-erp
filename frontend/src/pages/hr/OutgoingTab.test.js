// frontend/src/pages/hr/OutgoingTab.test.js
//
// Covers the date-range filter added on the `date` field, including the
// pre-existing header-count bug this task uncovered: the "(N)" count next
// to the list title used to read `letters.length` (the raw unfiltered
// array) instead of the filtered/paginated total, so it never changed when
// a date range narrowed the table — fixed to use `outTotalItems`.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OutgoingTab from './OutgoingTab';
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

const testLetters = [
  { id: 1, ref: 'ص-2026-001', title: 'كتاب داخل النطاق', to: 'جهة أ', subject: 'موضوع', date: '2026-07-15', status: 'sent' },
  { id: 2, ref: 'ص-2026-002', title: 'كتاب خارج النطاق', to: 'جهة ب', subject: 'موضوع', date: '2026-01-01', status: 'sent' },
  // Missing date entirely — bulk-imported/seeded data shape.
  { id: 3, ref: 'ص-2026-003', title: 'كتاب بدون تاريخ', to: 'جهة ج', subject: 'موضوع', date: undefined, status: 'sent' },
];

describe('OutgoingTab — date range filter', () => {
  beforeEach(() => {
    api.get.mockResolvedValue(testLetters);
  });

  test('renders all letters (including one missing a date) without crashing, and the header count matches', async () => {
    render(<OutgoingTab lang="ar" />);

    await waitFor(() => expect(screen.getByText('كتاب بدون تاريخ')).toBeInTheDocument());
    expect(screen.getByText('كتاب داخل النطاق')).toBeInTheDocument();
    expect(screen.getByText('الكتب الصادرة (3)')).toBeInTheDocument();
  });

  test('a date range narrows the table and the header count to match, excluding the missing-date record', async () => {
    render(<OutgoingTab lang="ar" />);
    await waitFor(() => expect(screen.getByText('كتاب بدون تاريخ')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-07-31' } });

    expect(screen.getByText('كتاب داخل النطاق')).toBeInTheDocument();
    expect(screen.queryByText('كتاب خارج النطاق')).not.toBeInTheDocument();
    expect(screen.queryByText('كتاب بدون تاريخ')).not.toBeInTheDocument();
    expect(screen.getByText('الكتب الصادرة (1)')).toBeInTheDocument();
  });

  test('clearing the date range restores the full list and count', async () => {
    render(<OutgoingTab lang="ar" />);
    await waitFor(() => expect(screen.getByText('كتاب بدون تاريخ')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-07-31' } });
    expect(screen.getByText('الكتب الصادرة (1)')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('مسح فلتر التاريخ'));

    expect(screen.getByText('الكتب الصادرة (3)')).toBeInTheDocument();
    expect(screen.getByText('كتاب خارج النطاق')).toBeInTheDocument();
    expect(screen.getByText('كتاب بدون تاريخ')).toBeInTheDocument();
  });
});

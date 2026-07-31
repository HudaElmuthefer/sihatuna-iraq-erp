// frontend/src/pages/MedicalLeavePage.test.js
//
// Covers the interval-overlap date filter: a leave record has its own
// from/to range rather than a single point, so the filter matches whenever
// the leave was active at any point during the selected window (including
// one that started before the window and is still ongoing inside it). Also
// covers the real 45-of-726-records-missing-`status` shape found via a live
// API check — the table must render such a record without crashing.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MedicalLeavePage from './MedicalLeavePage';
import { api } from './../api';

jest.mock('../api', () => ({ api: { get: jest.fn() } }));

jest.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    showToast: jest.fn(),
    lang: 'ar',
    syncToServer: jest.fn(),
    confirmDialog: jest.fn(),
    filterByViewingHospital: (records) => records,
    hospitals: [],
    multiHospitalEnabled: false,
    user: { id: 1, name: 'Test User' },
  }),
}));

const testLeaves = [
  { id: 1, employee: 'موظف ضمن النطاق', dept: 'الباطنية', type: 'sick', from: '2026-07-01', to: '2026-07-05', days: 5, diagnosis: '', status: 'approved' },
  { id: 2, employee: 'موظف متراكب من قبل النطاق', dept: 'الأطفال', type: 'sick', from: '2026-06-25', to: '2026-07-02', days: 8, diagnosis: '', status: 'approved' },
  { id: 3, employee: 'موظف خارج النطاق', dept: 'الجراحة', type: 'sick', from: '2026-08-01', to: '2026-08-05', days: 5, diagnosis: '', status: 'rejected' },
  // Missing status entirely — the shape found in ~45 of 726 real records.
  { id: 4, employee: 'موظف بدون حالة', dept: 'المختبر', type: 'sick', from: '2026-07-03', to: '2026-07-04', days: 2, diagnosis: '', status: undefined },
];

describe('MedicalLeavePage — interval-overlap date filter', () => {
  beforeEach(() => {
    api.get.mockResolvedValue(testLeaves);
  });

  test('renders all leaves without crashing, including one missing a status', async () => {
    render(<MedicalLeavePage />);

    await waitFor(() => expect(screen.getByText('موظف بدون حالة')).toBeInTheDocument());
    expect(screen.getByText('موظف ضمن النطاق')).toBeInTheDocument();
    expect(screen.getByText('موظف متراكب من قبل النطاق')).toBeInTheDocument();
    expect(screen.getByText('موظف خارج النطاق')).toBeInTheDocument();
  });

  test('a date range matches leaves active at any point in the window, including one that started earlier and is still ongoing', async () => {
    render(<MedicalLeavePage />);
    await waitFor(() => expect(screen.getByText('موظف بدون حالة')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-07-15' } });

    expect(screen.getByText('موظف ضمن النطاق')).toBeInTheDocument();
    // Started 06-25, ended 07-02 — overlaps the 07-01..07-15 window even
    // though it began before it.
    expect(screen.getByText('موظف متراكب من قبل النطاق')).toBeInTheDocument();
    expect(screen.getByText('موظف بدون حالة')).toBeInTheDocument();
    expect(screen.queryByText('موظف خارج النطاق')).not.toBeInTheDocument();
  });

  test('an out-of-range window matches nothing, and clearing restores the full list', async () => {
    render(<MedicalLeavePage />);
    await waitFor(() => expect(screen.getByText('موظف بدون حالة')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2020-01-31' } });
    expect(screen.queryByText('موظف ضمن النطاق')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('مسح فلتر التاريخ'));

    expect(screen.getByText('موظف ضمن النطاق')).toBeInTheDocument();
    expect(screen.getByText('موظف خارج النطاق')).toBeInTheDocument();
  });

  test('the date range combines with the status filter tab (AND logic)', async () => {
    render(<MedicalLeavePage />);
    await waitFor(() => expect(screen.getByText('موظف بدون حالة')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-07-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'مرفوض' }));

    // Within the window but rejected-only: none of the approved/undefined
    // records should show, and the out-of-window rejected one stays excluded.
    expect(screen.queryByText('موظف ضمن النطاق')).not.toBeInTheDocument();
    expect(screen.queryByText('موظف متراكب من قبل النطاق')).not.toBeInTheDocument();
    expect(screen.queryByText('موظف بدون حالة')).not.toBeInTheDocument();
    expect(screen.queryByText('موظف خارج النطاق')).not.toBeInTheDocument();
  });
});

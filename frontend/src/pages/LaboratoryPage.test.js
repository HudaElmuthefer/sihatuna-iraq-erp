// frontend/src/pages/LaboratoryPage.test.js
//
// LaboratoryPage now pages through lab tests on the server (via
// useServerPagination) instead of fetching everything and filtering/
// paginating client-side — search/category/status/date-range are all
// evaluated by the backend now, so the original "search predicate crashes
// on a missing field" regression this test guarded against can no longer
// happen here (there is no client-side search predicate left to crash).
// What's still worth covering: the table must render rows safely even when
// a record is missing patientName, reqNo, or testType (bulk-imported/seeded
// data can have any of the three absent).
import { render, screen } from '@testing-library/react';
import LaboratoryPage from './LaboratoryPage';
import useServerPagination from '../hooks/useServerPagination';

const mockRecords = [
  { id: 1, reqNo: 'LAB-2026-0001', patientName: 'مريض كامل البيانات', testType: 'CBC', category: 'hematology', requestDate: '2026-07-01', status: 'pending', priority: 'normal' },
  // Missing reqNo entirely.
  { id: 2, patientName: 'مريض بدون رقم طلب', testType: 'FBS', category: 'biochemistry', requestDate: '2026-07-02', status: 'pending', priority: 'normal' },
  // Missing patientName entirely.
  { id: 3, reqNo: 'LAB-2026-0003', testType: 'TSH', category: 'hormones', requestDate: '2026-07-03', status: 'pending', priority: 'normal' },
  // Missing testType entirely.
  { id: 4, reqNo: 'LAB-2026-0004', patientName: 'مريض بدون نوع تحليل', category: 'other', requestDate: '2026-07-04', status: 'pending', priority: 'normal' },
];

jest.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    lang: 'ar',
    showToast: jest.fn(),
    syncToServer: jest.fn(),
    confirmDialog: jest.fn(),
    hospitals: [],
    multiHospitalEnabled: false,
  }),
}));

jest.mock('../hooks/useServerPagination');

jest.mock('../api', () => ({ api: { get: jest.fn(() => Promise.resolve({ maxSeq: 0, total: 0 })) } }));

describe('LaboratoryPage — renders safely with incomplete records', () => {
  test('renders every record even when patientName, reqNo, or testType is missing', () => {
    useServerPagination.mockReturnValue({
      data: mockRecords,
      page: 1,
      setPage: jest.fn(),
      total: mockRecords.length,
      totalPages: 1,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<LaboratoryPage />);

    expect(screen.getByText('مريض كامل البيانات')).toBeInTheDocument();
    expect(screen.getByText('مريض بدون رقم طلب')).toBeInTheDocument();
    expect(screen.getByText('مريض بدون نوع تحليل')).toBeInTheDocument();
    expect(screen.getByText('LAB-2026-0003')).toBeInTheDocument();
  });
});

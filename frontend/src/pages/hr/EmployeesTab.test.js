// frontend/src/pages/hr/EmployeesTab.test.js
//
// Covers the date-range filter added on top of useServerPagination: the
// DateRangeFilter defaults to hireDate (always set), and retirementDate is
// legitimately optional (still-active employees have none) — the table
// must render such a record without crashing.
import { render, screen, fireEvent } from '@testing-library/react';
import EmployeesTab from './EmployeesTab';
import useServerPagination from '../../hooks/useServerPagination';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../api';

jest.mock('../../api', () => ({ api: { get: jest.fn() } }));

jest.mock('../../hooks/useServerPagination', () => jest.fn());

jest.mock('../../contexts/AppContext', () => ({ useApp: jest.fn() }));

// react-scripts' Jest preset runs with resetMocks:true, which wipes every
// mock's implementation (including ones set inside a jest.mock factory
// above) before each test -- so this has to be re-applied per test, not
// just once at module load.
beforeEach(() => { api.get.mockResolvedValue([]); });

const baseAppContext = {
  showToast: jest.fn(),
  syncToServer: jest.fn(),
  confirmDialog: jest.fn(),
  hospitals: [],
  multiHospitalEnabled: false,
  user: null, // keeps useBackendLoad's own fetch effect from running
  viewingHospitalId: 'all',
};

const testEmployees = [
  { id: 1, name: 'موظف كامل البيانات', jobTitle: 'ممرض', dept: 'الباطنية', grade: 'الأولى', step: 1, salary: 500000, hireDate: '2020-01-15', retirementDate: '2045-01-15', status: 'active' },
  // Still-active employee — retirementDate legitimately unset.
  { id: 2, name: 'موظف بدون تاريخ تقاعد', jobTitle: 'طبيب', dept: 'الأطفال', grade: 'الثانية', step: 2, salary: 700000, hireDate: '2022-03-01', retirementDate: '', status: 'active' },
];

describe('EmployeesTab — hireDate range filter', () => {
  beforeEach(() => {
    useApp.mockReturnValue(baseAppContext);
    useServerPagination.mockReturnValue({
      data: testEmployees,
      page: 1,
      setPage: jest.fn(),
      total: testEmployees.length,
      totalPages: 1,
      refetch: jest.fn(),
    });
  });

  test('renders the hireDate-labeled filter and the employee table without crashing on a missing retirementDate', () => {
    render(<EmployeesTab lang="ar" />);

    expect(screen.getByText('تاريخ التعيين:')).toBeInTheDocument();
    expect(screen.getByText('موظف كامل البيانات')).toBeInTheDocument();
    expect(screen.getByText('موظف بدون تاريخ تقاعد')).toBeInTheDocument();
  });

  test('changing the date range forwards startDate/endDate to useServerPagination as filters', () => {
    render(<EmployeesTab lang="ar" />);

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2022-12-31' } });

    const lastCall = useServerPagination.mock.calls[useServerPagination.mock.calls.length - 1];
    expect(lastCall[0]).toBe('employees');
    expect(lastCall[1].filters).toEqual({ startDate: '2020-01-01', endDate: '2022-12-31', hospitalId: undefined });
  });
});

describe('EmployeesTab — viewing-hospital filter', () => {
  beforeEach(() => {
    useServerPagination.mockReturnValue({
      data: testEmployees,
      page: 1,
      setPage: jest.fn(),
      total: testEmployees.length,
      totalPages: 1,
      refetch: jest.fn(),
    });
  });

  const lastFilters = () => {
    const calls = useServerPagination.mock.calls;
    return calls[calls.length - 1][1].filters;
  };

  test('a global admin with "all facilities" selected sends no hospitalId filter', () => {
    useApp.mockReturnValue({ ...baseAppContext, user: { hospitalId: null }, viewingHospitalId: 'all' });
    render(<EmployeesTab lang="ar" />);
    expect(lastFilters().hospitalId).toBeUndefined();
  });

  test('a global admin viewing one facility sends it as the hospitalId filter', () => {
    useApp.mockReturnValue({ ...baseAppContext, user: { hospitalId: null }, viewingHospitalId: 'hosp-a' });
    render(<EmployeesTab lang="ar" />);
    expect(lastFilters().hospitalId).toBe('hosp-a');
  });

  // The header dropdown this filter comes from never even renders for a
  // hospital-scoped user (see Layout.js) -- this just defends against a
  // stale value (e.g. left over in viewingHospitalId from a previous
  // global-admin session on a shared browser) ever being sent for one.
  // Their own data is isolated unconditionally server-side regardless.
  test('a user restricted to one facility never sends a hospitalId filter, even with a stale viewingHospitalId', () => {
    useApp.mockReturnValue({ ...baseAppContext, user: { hospitalId: 'hosp-a' }, viewingHospitalId: 'hosp-b' });
    render(<EmployeesTab lang="ar" />);
    expect(lastFilters().hospitalId).toBeUndefined();
  });
});

// frontend/src/pages/PatientsPage.test.js
//
// Covers the viewing-hospital filter added on top of useServerPagination:
// a global admin viewing one facility should have it forwarded as a
// hospitalId query filter, "all facilities" (or a hospital-scoped user)
// should not. See hospitalId in routes/modules.js's patients registration
// (middleware/pgCrud.js's existing extraFilterFields whitelist) for the
// server side of this.
import { render } from '@testing-library/react';
import PatientsPage from './PatientsPage';
import useServerPagination from '../hooks/useServerPagination';
import { useApp } from '../contexts/AppContext';
import { api } from '../api';

jest.mock('../api', () => ({ api: { get: jest.fn() } }));

jest.mock('../hooks/useServerPagination', () => jest.fn());

jest.mock('../contexts/AppContext', () => ({ useApp: jest.fn() }));

// react-scripts' Jest preset runs with resetMocks:true, wiping every mock's
// implementation (including ones set in a jest.mock factory) before each
// test -- this has to be re-applied per test.
beforeEach(() => { api.get.mockResolvedValue([]); });

const baseAppContext = {
  lang: 'ar',
  addToast: jest.fn(),
  patients: [],
  setPatients: jest.fn(),
  syncPatientToServer: jest.fn(),
  hospitals: [],
  multiHospitalEnabled: false,
  user: null,
  viewingHospitalId: 'all',
  loadModule: jest.fn(),
};

const paginationResult = {
  data: [],
  page: 1,
  setPage: jest.fn(),
  total: 0,
  totalPages: 1,
  loading: false,
  error: null,
  refetch: jest.fn(),
};

const lastFilters = () => {
  const calls = useServerPagination.mock.calls;
  return calls[calls.length - 1][1].filters;
};

describe('PatientsPage — viewing-hospital filter', () => {
  beforeEach(() => {
    useServerPagination.mockReturnValue(paginationResult);
  });

  test('a global admin with "all facilities" selected sends no hospitalId filter', () => {
    useApp.mockReturnValue({ ...baseAppContext, user: { hospitalId: null }, viewingHospitalId: 'all' });
    render(<PatientsPage />);
    expect(useServerPagination).toHaveBeenCalledWith('patients', expect.anything());
    expect(lastFilters().hospitalId).toBeUndefined();
  });

  test('a global admin viewing one facility sends it as the hospitalId filter', () => {
    useApp.mockReturnValue({ ...baseAppContext, user: { hospitalId: null }, viewingHospitalId: 'hosp-a' });
    render(<PatientsPage />);
    expect(lastFilters().hospitalId).toBe('hosp-a');
  });

  // The header dropdown this filter comes from never even renders for a
  // hospital-scoped user (see Layout.js) -- this just defends against a
  // stale value (e.g. left over in viewingHospitalId from a previous
  // global-admin session on a shared browser) ever being sent for one.
  // Their own data is isolated unconditionally server-side regardless
  // (routes/pgCrud.js's hospitalScoped forces their own hospitalId).
  test('a user restricted to one facility never sends a hospitalId filter, even with a stale viewingHospitalId', () => {
    useApp.mockReturnValue({ ...baseAppContext, user: { hospitalId: 'hosp-a' }, viewingHospitalId: 'hosp-b' });
    render(<PatientsPage />);
    expect(lastFilters().hospitalId).toBeUndefined();
  });
});

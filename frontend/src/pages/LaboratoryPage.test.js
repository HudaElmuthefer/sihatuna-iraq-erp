// frontend/src/pages/LaboratoryPage.test.js
//
// Same class of bug as RadiologyPage.test.js: the search predicate calls
// string methods (.includes/.toLowerCase) directly on patientName, reqNo,
// and testType — any of the three being undefined (bulk-imported/seeded
// data) used to throw and crash the whole page. Fixed via (field || '').
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LaboratoryPage from './LaboratoryPage';

jest.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    labTests: [
      { id: 1, reqNo: 'LAB-2026-0001', patientName: 'مريض كامل البيانات', testType: 'CBC', category: 'hematology', requestDate: '2026-07-01', status: 'pending', priority: 'normal' },
      // Missing reqNo entirely.
      { id: 2, patientName: 'مريض بدون رقم طلب', testType: 'FBS', category: 'biochemistry', requestDate: '2026-07-02', status: 'pending', priority: 'normal' },
      // Missing patientName entirely.
      { id: 3, reqNo: 'LAB-2026-0003', testType: 'TSH', category: 'hormones', requestDate: '2026-07-03', status: 'pending', priority: 'normal' },
      // Missing testType entirely.
      { id: 4, reqNo: 'LAB-2026-0004', patientName: 'مريض بدون نوع تحليل', category: 'other', requestDate: '2026-07-04', status: 'pending', priority: 'normal' },
    ],
    setLabTests: jest.fn(),
    lang: 'ar',
    showToast: jest.fn(),
    syncToServer: jest.fn(),
    confirmDialog: jest.fn(),
    hospitals: [],
    multiHospitalEnabled: false,
  }),
}));

describe('LaboratoryPage — search crash guard', () => {
  test('typing a search query does not throw when records are missing patientName, reqNo, or testType', async () => {
    const user = userEvent.setup();
    render(<LaboratoryPage />);

    const searchInput = screen.getByPlaceholderText('🔍 بحث بالاسم أو رقم الطلب...');
    await user.type(searchInput, 'مريض');

    // If the page had crashed, none of this would be queryable.
    expect(screen.getByText('مريض كامل البيانات')).toBeInTheDocument();
    expect(screen.getByText('مريض بدون رقم طلب')).toBeInTheDocument();
    expect(screen.getByText('مريض بدون نوع تحليل')).toBeInTheDocument();
  });

  test('searching by reqNo still matches records that do have one', async () => {
    const user = userEvent.setup();
    render(<LaboratoryPage />);

    const searchInput = screen.getByPlaceholderText('🔍 بحث بالاسم أو رقم الطلب...');
    await user.type(searchInput, 'lab-2026-0003');

    expect(screen.getByText('LAB-2026-0003')).toBeInTheDocument();
    expect(screen.queryByText('مريض كامل البيانات')).not.toBeInTheDocument();
  });
});

// frontend/src/pages/RadiologyPage.test.js
//
// Regression test for a real crash: searching threw "Cannot read properties
// of undefined (reading 'toLowerCase')" when a record was missing patientName
// or reqNo — Array.filter's callback threw, which unmounted the whole page.
// Fixed via a (field || '') fallback before any string method call.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RadiologyPage from './RadiologyPage';

jest.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    radiology: [
      { id: 1, reqNo: 'RAD-2026-0001', patientName: 'مريض كامل البيانات', modality: 'xray', bodyPart: 'الصدر', requestDate: '2026-07-01', status: 'pending', priority: 'normal', images: 0 },
      // Missing reqNo entirely — the exact shape that crashed the page.
      { id: 2, patientName: 'مريض بدون رقم طلب', modality: 'xray', bodyPart: 'البطن', requestDate: '2026-07-02', status: 'pending', priority: 'normal', images: 0 },
      // Missing patientName entirely.
      { id: 3, reqNo: 'RAD-2026-0003', modality: 'ct', bodyPart: 'الرأس', requestDate: '2026-07-03', status: 'pending', priority: 'normal', images: 0 },
    ],
    setRadiology: jest.fn(),
    lang: 'ar',
    showToast: jest.fn(),
    syncToServer: jest.fn(),
    confirmDialog: jest.fn(),
    hospitals: [],
    multiHospitalEnabled: false,
  }),
}));

describe('RadiologyPage — search crash guard', () => {
  test('typing a search query does not throw when records are missing patientName or reqNo', async () => {
    const user = userEvent.setup();
    render(<RadiologyPage />);

    const searchInput = screen.getByPlaceholderText('🔍 بحث...');
    await user.type(searchInput, 'مريض');

    // If the page had crashed, none of this would be queryable.
    expect(screen.getByText('مريض كامل البيانات')).toBeInTheDocument();
    expect(screen.getByText('مريض بدون رقم طلب')).toBeInTheDocument();
  });

  test('searching by reqNo still matches records that do have one', async () => {
    const user = userEvent.setup();
    render(<RadiologyPage />);

    const searchInput = screen.getByPlaceholderText('🔍 بحث...');
    await user.type(searchInput, 'rad-2026-0003');

    expect(screen.getByText('RAD-2026-0003')).toBeInTheDocument();
    expect(screen.queryByText('مريض كامل البيانات')).not.toBeInTheDocument();
  });

  test('clearing the search after typing restores the full list without throwing', async () => {
    const user = userEvent.setup();
    render(<RadiologyPage />);

    const searchInput = screen.getByPlaceholderText('🔍 بحث...');
    await user.type(searchInput, 'مريض');
    await user.clear(searchInput);

    expect(screen.getByText('مريض كامل البيانات')).toBeInTheDocument();
    expect(screen.getByText('RAD-2026-0003')).toBeInTheDocument();
  });
});

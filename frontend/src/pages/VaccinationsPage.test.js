// frontend/src/pages/VaccinationsPage.test.js
//
// Same class of bug as RadiologyPage.test.js / LaboratoryPage.test.js: the
// search predicate calls string methods directly on patient/vaccine, which
// used to throw when either was undefined. Fixed via (field || '').
//
// Unlike Radiology/Laboratory, VaccinationsPage doesn't take its list from
// context directly — it starts from a small hardcoded fallback array and
// then overwrites it via its own `api.get('/vaccinations')` effect (only
// once `user` is set). So getting our test records in requires mocking both
// useApp() (with a truthy user, so the effect actually runs) and '../api'.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VaccinationsPage from './VaccinationsPage';
import { api } from '../api';

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

const testRecords = [
  { id: 1, patient: 'مريض كامل البيانات', vaccine: 'COVID-19 (Pfizer)', dose: 'الجرعة الأولى', date: '2026-07-01', nextDate: null, status: 'upcoming', provider: '', notes: '' },
  // Missing patient entirely.
  { id: 2, vaccine: 'Seasonal Flu', dose: 'جرعة سنوية', date: '2026-07-02', nextDate: null, status: 'upcoming', provider: '', notes: '' },
  // Missing vaccine entirely.
  { id: 3, patient: 'مريض بدون لقاح', dose: 'الجرعة الأولى', date: '2026-07-03', nextDate: null, status: 'upcoming', provider: '', notes: '' },
];

describe('VaccinationsPage — search crash guard', () => {
  beforeEach(() => {
    api.get.mockResolvedValue(testRecords);
  });

  test('typing a search query does not throw when records are missing patient or vaccine', async () => {
    const user = userEvent.setup();
    render(<VaccinationsPage />);

    // Wait for the api.get('/vaccinations') effect to resolve and replace
    // the initial fallback records with our test records.
    await waitFor(() => expect(screen.getByText('مريض بدون لقاح')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('بحث بالمريض أو التطعيم...');
    await user.type(searchInput, 'مريض');

    // If the page had crashed, none of this would be queryable.
    expect(screen.getByText('مريض كامل البيانات')).toBeInTheDocument();
    expect(screen.getByText('مريض بدون لقاح')).toBeInTheDocument();
  });
});

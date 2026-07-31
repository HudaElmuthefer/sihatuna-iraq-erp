// frontend/src/pages/SmartReportsPage.test.js
//
// Regression test for a real bug found via live testing: the BarChart
// component (department activity) and the "Most Active Doctors" list both
// hardcoded textAlign:'left' regardless of language — BarChart even received
// a `lang` prop already but never used it. Confirmed via computed style that
// Arabic mode still rendered these left-aligned. Both now follow `lang`.
import { render, screen } from '@testing-library/react';
import SmartReportsPage from './SmartReportsPage';

jest.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    showToast: jest.fn(),
    lang: 'ar',
    patients: [],
    appointments: [
      { id: 1, department: 'قسم تجريبي', doctor: 'د. تجريبي', date: new Date().toISOString().split('T')[0] },
    ],
    doctors: [],
    departments: [],
    invoices: [],
    setPrintOverlay: jest.fn(),
  }),
}));

describe('SmartReportsPage — department chart and doctor list alignment', () => {
  test('is right-aligned in Arabic (not the hardcoded left)', () => {
    render(<SmartReportsPage />);

    const deptLabel = screen.getByText('قسم تجريبي');
    expect(deptLabel.style.textAlign).toBe('right');

    const doctorCount = screen.getByText(/1 موعد/);
    expect(doctorCount.parentElement.style.textAlign).toBe('right');
  });
});

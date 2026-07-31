// frontend/src/pages/hr/DossiersTab.test.js
//
// Regression test for a real bug found via live testing: the employee list
// buttons hardcoded textAlign:'right' regardless of language — confirmed via
// computed style that English mode still rendered them right-aligned. The
// alignment now follows the `lang` prop, matching the direction fix already
// applied to the shared .table CSS class elsewhere in the app.
import { render, screen, waitFor } from '@testing-library/react';
import DossiersTab from './DossiersTab';
import { api } from '../../api';

jest.mock('../../api', () => ({ api: { get: jest.fn() } }));

jest.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    showToast: jest.fn(),
    confirmDialog: jest.fn(),
    syncToServer: jest.fn(),
    user: { id: 1, name: 'Test User' },
  }),
}));

const testEmployees = [{ id: 1, name: 'موظف تجريبي', nameEn: 'Test Employee' }];

describe('DossiersTab — employee list alignment follows language', () => {
  beforeEach(() => {
    api.get.mockResolvedValue(testEmployees);
  });

  test('right-aligned in Arabic, left-aligned in English', async () => {
    const { rerender } = render(<DossiersTab lang="ar" />);
    await waitFor(() => expect(screen.getByText(/موظف تجريبي/)).toBeInTheDocument());
    expect(screen.getByText(/موظف تجريبي/).closest('button').style.textAlign).toBe('right');

    rerender(<DossiersTab lang="en" />);
    await waitFor(() => expect(screen.getByText(/Test Employee/)).toBeInTheDocument());
    expect(screen.getByText(/Test Employee/).closest('button').style.textAlign).toBe('left');
  });
});

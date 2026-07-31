// frontend/src/pages/accounts/GeneralTab.test.js
//
// Regression test for a real bug found via live testing + a direct DB query:
// the transaction-type filter buttons compared against Arabic literals
// ('دخل'/'مصروف'), while the actual DB has a mix of Arabic (175 'دخل' + 225
// 'مصروف', legacy/bulk-imported) and English ('income', from the current
// Add/Edit form's <select> values — zero 'expense' exist). On top of that,
// the buttons called setFilter(f) with the whole {k,l} option object instead
// of setFilter(f.k) — so filter state became a non-primitive that could
// never match a string again after the first click, silently showing zero
// results regardless of vocabulary. Both are fixed via a small canonical
// alias map (txType()) used consistently by the filter buttons, the
// totals, and the amount color/sign — see GeneralTab.js.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GeneralTab from './GeneralTab';

const testTransactions = [
  { id: 1, date: '2026-07-01', ref: 'REF-A', desc: 'معاملة دخل عربي', category: 'revenue', type: 'دخل', method: 'cash', amount: 1000 },
  { id: 2, date: '2026-07-02', ref: 'REF-B', desc: 'معاملة دخل انجليزي', category: 'revenue', type: 'income', method: 'cash', amount: 2000 },
  { id: 3, date: '2026-07-03', ref: 'REF-C', desc: 'معاملة مصروف عربي', category: 'other', type: 'مصروف', method: 'cash', amount: 500 },
];

jest.mock('../../api', () => ({ api: { get: jest.fn(() => Promise.resolve([])) } }));

jest.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    showToast: jest.fn(),
    lang: 'ar',
    syncToServer: jest.fn(),
    confirmDialog: jest.fn(),
    filterByViewingHospital: (records) => records,
    hospitals: [],
    multiHospitalEnabled: false,
    user: null, // keeps usePersistedTab's own fetch effect from running, so our seeded localStorage data is what renders (deterministic, no fetch race)
  }),
}));

beforeEach(() => {
  localStorage.setItem('acc_transactions', JSON.stringify(testTransactions));
});

afterEach(() => {
  localStorage.clear();
});

describe('GeneralTab — income/expense filter (Arabic/English vocabulary mismatch)', () => {
  test('the "دخل" filter shows both Arabic- and English-typed income transactions', async () => {
    const user = userEvent.setup();
    render(<GeneralTab />);

    await user.click(screen.getByRole('button', { name: 'دخل' }));

    expect(screen.getByText('معاملة دخل عربي')).toBeInTheDocument();
    expect(screen.getByText('معاملة دخل انجليزي')).toBeInTheDocument();
    expect(screen.queryByText('معاملة مصروف عربي')).not.toBeInTheDocument();
  });

  test('the "مصروف" filter shows only expense transactions, and "الكل" restores the full list', async () => {
    const user = userEvent.setup();
    render(<GeneralTab />);

    await user.click(screen.getByRole('button', { name: 'مصروف' }));
    expect(screen.getByText('معاملة مصروف عربي')).toBeInTheDocument();
    expect(screen.queryByText('معاملة دخل عربي')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'الكل' }));
    expect(screen.getByText('معاملة دخل عربي')).toBeInTheDocument();
    expect(screen.getByText('معاملة دخل انجليزي')).toBeInTheDocument();
    expect(screen.getByText('معاملة مصروف عربي')).toBeInTheDocument();
  });

  // Regression test for the object-instead-of-string setFilter(f) bug:
  // clicking a second filter button used to be exactly what broke
  // filtering permanently (filter state became a {k,l} object after the
  // first click, so no further string comparison could ever match again).
  test('clicking a second filter button still filters correctly', async () => {
    const user = userEvent.setup();
    render(<GeneralTab />);

    await user.click(screen.getByRole('button', { name: 'دخل' }));
    await user.click(screen.getByRole('button', { name: 'مصروف' }));

    expect(screen.getByText('معاملة مصروف عربي')).toBeInTheDocument();
    expect(screen.queryByText('معاملة دخل عربي')).not.toBeInTheDocument();
    expect(screen.queryByText('معاملة دخل انجليزي')).not.toBeInTheDocument();
  });
});

// Preventive regression test (task #12): a real DB check found zero
// transactions currently missing `amount`, but nothing guaranteed that would
// stay true. `Number(undefined)` is NaN, which would previously flow
// straight into totalIn/totalOut/balance and the per-row amount cell,
// printing the literal string "NaN" instead of a number. Guarded with the
// same `Number(x)||0` pattern already used for baseSalary/retireSalary.
describe('GeneralTab — missing amount field does not produce NaN', () => {
  const withMissingAmount = [
    { id: 1, date: '2026-07-01', ref: 'REF-A', desc: 'دخل بلا مبلغ', category: 'revenue', type: 'income', method: 'cash' },
    { id: 2, date: '2026-07-02', ref: 'REF-B', desc: 'مصروف بلا مبلغ', category: 'other', type: 'expense', method: 'cash' },
  ];

  beforeEach(() => {
    localStorage.setItem('acc_transactions', JSON.stringify(withMissingAmount));
  });

  test('totals and the per-row cell show 0, never "NaN"', () => {
    render(<GeneralTab />);

    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    // per-row cells for both records render "+0"/"-0" rather than "+NaN"/"-NaN"
    expect(screen.getByText('+0')).toBeInTheDocument();
    expect(screen.getByText('-0')).toBeInTheDocument();
  });
});

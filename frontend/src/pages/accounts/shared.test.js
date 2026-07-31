// frontend/src/pages/accounts/shared.test.js
//
// Regression test for a real bug found via live data: 47 of 83 real salary
// records had no `baseSalary` at all. calcNet() used to do
// `Number(emp.baseSalary) + totalAdd - totalDed` with no fallback —
// `Number(undefined)` is NaN, and that single NaN poisoned the whole
// `totalNet` sum on the Salaries tab (displayed literally as "NaN IQD").
// Missing numeric fields must count as 0, not corrupt the total — the
// record itself still needs to show up in the table (see SalariesTab.js's
// "Missing" badge, driven by hasBaseSalary()), just without a fabricated
// base salary value.
import { calcNet, hasBaseSalary, printTable } from './shared';

describe('calcNet', () => {
  test('computes the net normally when all fields are present', () => {
    const emp = { baseSalary: 500000, additions: [{ amount: 20000 }], deductions: [{ amount: 5000 }] };
    expect(calcNet(emp)).toBe(515000);
  });

  test('a missing baseSalary counts as 0 instead of producing NaN', () => {
    const emp = { additions: [{ amount: 20000 }], deductions: [{ amount: 5000 }] };
    expect(calcNet(emp)).toBe(15000);
    expect(Number.isNaN(calcNet(emp))).toBe(false);
  });

  test('a missing addition/deduction amount counts as 0 instead of producing NaN', () => {
    const emp = { baseSalary: 500000, additions: [{ amount: undefined }], deductions: [{}] };
    expect(calcNet(emp)).toBe(500000);
  });

  test('missing additions/deductions arrays entirely still compute a valid number', () => {
    const emp = { baseSalary: 400000 };
    expect(calcNet(emp)).toBe(400000);
  });

  // The real-world case: a record missing everything must never poison a
  // reduce() sum across many employees.
  test('a completely empty record contributes exactly 0 to a summed total', () => {
    const employees = [
      { baseSalary: 500000, additions: [], deductions: [] },
      {}, // matches the real shape of the 47 affected records
      { baseSalary: 300000, additions: [], deductions: [] },
    ];
    const totalNet = employees.reduce((s, e) => s + calcNet(e), 0);
    expect(totalNet).toBe(800000);
    expect(Number.isNaN(totalNet)).toBe(false);
  });
});

describe('hasBaseSalary', () => {
  test('true when baseSalary is a valid number (including 0)', () => {
    expect(hasBaseSalary({ baseSalary: 500000 })).toBe(true);
    expect(hasBaseSalary({ baseSalary: 0 })).toBe(true);
  });

  test('false when baseSalary is missing, null, empty, or non-numeric', () => {
    expect(hasBaseSalary({})).toBe(false);
    expect(hasBaseSalary({ baseSalary: null })).toBe(false);
    expect(hasBaseSalary({ baseSalary: '' })).toBe(false);
    expect(hasBaseSalary({ baseSalary: 'not-a-number' })).toBe(false);
  });
});

// Regression test (task #13): printTable() used to hardcode dir="rtl" in the
// print-preview window regardless of the app's actual language at print
// time, so printing an English-language page still produced a
// right-aligned, RTL print preview. It now follows
// document.documentElement.dir — the same source AppContext already keeps
// in sync with the language toggle, and the same source the global .table
// CSS alignment fix relies on.
describe('printTable — print window direction follows current language', () => {
  let writtenHtml;
  const fakeWindow = { document: { write: (html) => { writtenHtml = html; }, close: jest.fn() }, print: jest.fn() };

  beforeEach(() => {
    writtenHtml = '';
    document.body.innerHTML = '<table id="t"><tbody><tr><td>x</td></tr></tbody></table>';
    window.open = jest.fn(() => fakeWindow);
  });

  afterEach(() => {
    document.documentElement.removeAttribute('dir');
  });

  test('writes dir="rtl" and right-aligned cells when the app is in Arabic (dir="rtl")', () => {
    document.documentElement.dir = 'rtl';
    printTable('t');
    expect(writtenHtml).toContain('dir="rtl"');
    expect(writtenHtml).toContain('text-align:right');
  });

  test('writes dir="ltr" and left-aligned cells when the app is in English (dir="ltr")', () => {
    document.documentElement.dir = 'ltr';
    printTable('t');
    expect(writtenHtml).toContain('dir="ltr"');
    expect(writtenHtml).toContain('text-align:left');
  });
});

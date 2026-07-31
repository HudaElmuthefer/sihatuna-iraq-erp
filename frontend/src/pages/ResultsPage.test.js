// frontend/src/pages/ResultsPage.test.js
//
// Regression test (Part 2 static audit): printContent()/printCombined()
// hardcoded dir="rtl" lang="ar" on the print-preview window regardless of
// the app's actual language at print time — the exact same bug pattern
// already fixed in printTable() (accounts/hr shared.js). Now both follow
// document.documentElement.dir, the source AppContext keeps in sync with
// the language toggle.
import { printContent, printCombined } from './ResultsPage';

describe('ResultsPage print functions — direction follows current language', () => {
  let writtenHtml;
  const fakeWindow = { document: { write: (html) => { writtenHtml = html; }, close: jest.fn() }, focus: jest.fn(), print: jest.fn() };

  beforeEach(() => {
    writtenHtml = '';
    window.open = jest.fn(() => fakeWindow);
  });

  afterEach(() => {
    document.documentElement.removeAttribute('dir');
  });

  test('printContent writes dir="rtl" lang="ar" when the app is in Arabic', () => {
    document.documentElement.dir = 'rtl';
    printContent('Title', [['Label', 'Value']], 'SIHATUNA');
    expect(writtenHtml).toContain('dir="rtl"');
    expect(writtenHtml).toContain('lang="ar"');
  });

  test('printContent writes dir="ltr" lang="en" when the app is in English', () => {
    document.documentElement.dir = 'ltr';
    printContent('Title', [['Label', 'Value']], 'SIHATUNA');
    expect(writtenHtml).toContain('dir="ltr"');
    expect(writtenHtml).toContain('lang="en"');
  });

  test('printCombined writes dir="ltr" lang="en" when the app is in English', () => {
    document.documentElement.dir = 'ltr';
    printCombined('Title', [{ heading: 'Lab', lines: [['Label', 'Value']] }], 'SIHATUNA');
    expect(writtenHtml).toContain('dir="ltr"');
    expect(writtenHtml).toContain('lang="en"');
  });
});

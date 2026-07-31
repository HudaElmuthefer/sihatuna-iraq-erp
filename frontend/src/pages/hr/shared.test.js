// frontend/src/pages/hr/shared.test.js
//
// Regression test (task #13): printTable() here (identical duplicate of the
// one in accounts/shared.js) used to hardcode dir="rtl" in the print-preview
// window regardless of the app's actual language at print time. It now
// follows document.documentElement.dir — the same source AppContext already
// keeps in sync with the language toggle, and the same source the global
// .table CSS alignment fix relies on.
import { printTable } from './shared';

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

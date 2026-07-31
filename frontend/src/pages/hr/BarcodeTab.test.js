// frontend/src/pages/hr/BarcodeTab.test.js
//
// Regression test (Part 2 static audit): printLabel() hardcoded
// dir="rtl" lang="ar" on the print-preview window regardless of the app's
// actual language at print time — the exact same bug pattern already fixed
// in printTable() (accounts/hr shared.js) and ResultsPage.js's print
// functions. Now follows document.documentElement.dir.
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import BarcodeTab from './BarcodeTab';
import { api } from '../../api';

jest.mock('../../api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

const testLetter = { type: 'outgoing', id: 1, ref: 'REF-001', title: 'كتاب اختبار', to: 'جهة', subject: 'موضوع', date: '2026-01-01' };

describe('BarcodeTab — print label direction follows current language', () => {
  let writtenHtml;
  const fakeWindow = { document: { write: (html) => { writtenHtml = html; }, close: jest.fn() }, focus: jest.fn(), print: jest.fn() };

  beforeEach(() => {
    writtenHtml = '';
    window.open = jest.fn(() => fakeWindow);
    api.get.mockImplementation((path) => {
      if (path.includes('/document-lookup/search')) return Promise.resolve([testLetter]);
      return Promise.resolve([]);
    });
    api.post.mockResolvedValue({});
  });

  const searchAndSelectLetter = async () => {
    fireEvent.change(screen.getByPlaceholderText('Number, title, or entity'), { target: { value: 'REF-001' } });
    fireEvent.click(screen.getByText('Search'));
    await waitFor(() => expect(screen.getByText('REF-001')).toBeInTheDocument());
    fireEvent.click(screen.getByText('REF-001'));
    await waitFor(() => expect(screen.getByText('Print Label')).toBeInTheDocument());
  };

  test('writes dir="ltr" lang="en" when the app is in English', async () => {
    document.documentElement.dir = 'ltr';
    render(<BarcodeTab lang="en" />);
    await searchAndSelectLetter();

    fireEvent.click(screen.getByText('Print Label'));
    await waitFor(() => expect(writtenHtml).not.toBe(''));
    expect(writtenHtml).toContain('dir="ltr"');
    expect(writtenHtml).toContain('lang="en"');

    document.documentElement.removeAttribute('dir');
  });

  test('writes dir="rtl" lang="ar" when the app is in Arabic', async () => {
    document.documentElement.dir = 'rtl';
    render(<BarcodeTab lang="ar" />);
    fireEvent.change(screen.getByPlaceholderText('رقم الكتاب أو عنوانه أو الجهة'), { target: { value: 'REF-001' } });
    fireEvent.click(screen.getByText('بحث'));
    await waitFor(() => expect(screen.getByText('REF-001')).toBeInTheDocument());
    fireEvent.click(screen.getByText('REF-001'));
    await waitFor(() => expect(screen.getByText('طباعة الملصق')).toBeInTheDocument());

    fireEvent.click(screen.getByText('طباعة الملصق'));
    await waitFor(() => expect(writtenHtml).not.toBe(''));
    expect(writtenHtml).toContain('dir="rtl"');
    expect(writtenHtml).toContain('lang="ar"');

    document.documentElement.removeAttribute('dir');
  });
});

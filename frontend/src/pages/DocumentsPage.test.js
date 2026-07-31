// frontend/src/pages/DocumentsPage.test.js
//
// Same class of bug as RadiologyPage.test.js: the search predicate calls
// string methods directly on title, docNo, from, and subject — any being
// undefined (bulk-imported/seeded data) used to throw and crash the whole
// page. Fixed via (field || '').
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentsPage from './DocumentsPage';

jest.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    documents: [
      { id: 1, docNo: 'IN-2026-0001', title: 'وثيقة كاملة البيانات', from: 'وزارة الصحة', subject: 'تعميم', type: 'incoming', status: 'pending', priority: 'normal', date: '2026-07-01' },
      // Missing title entirely.
      { id: 2, docNo: 'IN-2026-0002', from: 'مديرية الصحة', subject: 'طلب', type: 'incoming', status: 'pending', priority: 'normal', date: '2026-07-02' },
      // Missing docNo, from, and subject entirely.
      { id: 3, title: 'وثيقة ناقصة الحقول', type: 'incoming', status: 'pending', priority: 'normal', date: '2026-07-03' },
    ],
    setDocuments: jest.fn(),
    lang: 'ar',
    showToast: jest.fn(),
    user: { id: 1, name: 'Test User' },
    syncToServer: jest.fn(),
    confirmDialog: jest.fn(),
    hospitals: [],
    multiHospitalEnabled: false,
  }),
}));

describe('DocumentsPage — search crash guard', () => {
  test('typing a search query does not throw when records are missing title, docNo, from, or subject', async () => {
    const user = userEvent.setup();
    render(<DocumentsPage />);

    const searchInput = screen.getByPlaceholderText('🔍 بحث...');
    await user.type(searchInput, 'وثيقة');

    // If the page had crashed, none of this would be queryable.
    expect(screen.getByText('وثيقة كاملة البيانات')).toBeInTheDocument();
    expect(screen.getByText('وثيقة ناقصة الحقول')).toBeInTheDocument();
  });
});

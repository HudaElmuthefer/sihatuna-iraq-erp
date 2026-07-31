// frontend/src/pages/QualityPage.test.js
//
// Regression tests for two real bugs found via live data, both the same
// root cause: an enum key spelled differently in code than in the real
// database value.
//
// AUDIT_STATUS never had an `in_progress` key at all (only planned/active/
// completed/cancelled) — 6 of 64 real audits with status 'in_progress' fell
// through to the `.planned` default and displayed as "Planned".
//
// NC_STATUS defined the key as `inprogress` (no underscore) while every real
// non-conformance with that status stores `in_progress` (with underscore,
// confirmed via a live query: zero records use the no-underscore spelling) —
// so those records displayed as "Open" (the true default fallback), and the
// "Close" button's condition (`nc.status === 'inprogress'`) never matched
// real data either, permanently hiding the only way to close them.
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QualityPage from './QualityPage';
import { api } from '../api';

// QualityPage now reads useSearchParams() (to respect ?tab= from the
// sidebar's expandable sub-navigation — see components/Layout.js), which
// requires a Router ancestor even outside that new behavior's own tests.
const renderPage = () => render(<MemoryRouter><QualityPage /></MemoryRouter>);

jest.mock('../api', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn() } }));

jest.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    lang: 'ar',
    showToast: jest.fn(),
    confirmDialog: jest.fn(),
    user: { id: 1, name: 'Test User' },
  }),
}));

const testAudits = [
  { id: 1, title: 'مراجعة قيد التنفيذ', scope: '', auditor: '', date: '2026-01-01', type: 'internal', status: 'in_progress' },
];
const testNCs = [
  { id: 1, title: 'عدم مطابقة قيد المعالجة', classification: 'minor', department: '', owner: '', openDate: '2026-01-01', status: 'in_progress' },
];

describe('QualityPage — AUDIT_STATUS/NC_STATUS in_progress key fixes', () => {
  beforeEach(() => {
    api.get.mockImplementation((path) => {
      if (path === '/qualityAudits') return Promise.resolve(testAudits);
      if (path === '/qualityNCs') return Promise.resolve(testNCs);
      return Promise.resolve([]);
    });
  });

  test('an audit with status "in_progress" displays "In Progress", not the "Planned" default', async () => {
    renderPage();
    fireEvent.click(screen.getByText('🔍 المراجعات'));

    await waitFor(() => expect(screen.getByText('مراجعة قيد التنفيذ')).toBeInTheDocument());
    expect(screen.getByText('قيد التنفيذ')).toBeInTheDocument();
    expect(screen.queryByText('مجدول')).not.toBeInTheDocument();
  });

  test('a non-conformance with status "in_progress" displays "In Progress" (not "Open"), and its Close button appears and works', async () => {
    renderPage();
    fireEvent.click(screen.getByText('⚠️ عدم المطابقة'));

    await waitFor(() => expect(screen.getByText('عدم مطابقة قيد المعالجة')).toBeInTheDocument());
    // The status badge (not to be confused with the separate "Close Date"
    // column, which legitimately shows the placeholder text "مفتوحة"/"Open"
    // for any NC that has no closeDate yet, regardless of its actual status).
    const statusBadge = screen.getByText('قيد المعالجة');
    expect(statusBadge.tagName).toBe('SPAN');

    const closeBtn = screen.getByText('إغلاق');
    expect(closeBtn).toBeInTheDocument();
    api.put.mockResolvedValue({ ...testNCs[0], status: 'closed' });
    fireEvent.click(closeBtn);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      expect.stringContaining('/qualityNCs/1'),
      expect.objectContaining({ status: 'closed' })
    ));
  });
});

// Regression test (task #14): a real DB check found zero quality_audits
// records currently have any score at all (all NULL), so this is a
// preventive fix — but the bug is real: `audits.filter(a => a.score)` uses
// JS truthiness, which excludes an audit with a genuine score of exactly 0
// exactly as if it had no score, silently skewing avgScore upward and
// hiding a real 0% result behind the '—' placeholder in the table. Fixed to
// check existence explicitly (`a.score !== undefined && a.score !== null`).
describe('QualityPage — a real zero score is not excluded (falsy-check bug)', () => {
  const zeroScoreAudit = { id: 1, title: 'مراجعة بدرجة صفر', scope: '', auditor: '', date: '2026-01-01', type: 'internal', status: 'completed', score: 0 };
  const eightyScoreAudit = { id: 2, title: 'مراجعة بدرجة 80', scope: '', auditor: '', date: '2026-01-02', type: 'internal', status: 'completed', score: 80 };

  beforeEach(() => {
    api.get.mockImplementation((path) => {
      if (path === '/qualityAudits') return Promise.resolve([zeroScoreAudit, eightyScoreAudit]);
      return Promise.resolve([]);
    });
  });

  test('a score of 0 counts toward avgScore instead of being excluded', async () => {
    renderPage();
    fireEvent.click(screen.getByText('🔍 المراجعات'));
    await waitFor(() => expect(screen.getByText('مراجعة بدرجة صفر')).toBeInTheDocument());

    // If the 0-score record were wrongly excluded, the "Avg Quality Score"
    // stat card would show 80% (only the 80-score audit counted); correctly
    // included, it's (0+80)/2 = 40%.
    const avgLabel = screen.getByText('متوسط درجة الجودة');
    expect(avgLabel.previousSibling).toHaveTextContent('40%');
  });

  test('the zero-score row displays "0%", not the "—" missing-score placeholder', async () => {
    renderPage();
    fireEvent.click(screen.getByText('🔍 المراجعات'));
    await waitFor(() => expect(screen.getByText('مراجعة بدرجة صفر')).toBeInTheDocument());

    const row = screen.getByText('مراجعة بدرجة صفر').closest('tr');
    expect(row).toHaveTextContent('0%');
  });
});

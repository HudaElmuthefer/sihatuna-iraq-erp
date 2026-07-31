// frontend/src/pages/HRPage.test.js
//
// Regression test for a real bug: clicking a sub-tab link in the sidebar's
// expandable sub-navigation (e.g. HR → "Outgoing Letters") navigated to the
// right page but always showed the FIRST/default tab ("Employees") instead
// of the one actually clicked.
//
// Root cause (confirmed by reading the code, not guessed): the active-tab
// state was set via `useState(() => { ...read searchParams.get('tab')... })`
// — a lazy initializer that only ever runs once, at mount. React Router does
// NOT remount HRPage when only the query string changes for the same path
// (`/hr` → `/hr?tab=outgoing` is the same route), so once HRPage is already
// mounted, that initializer never re-runs and `tab` stays stuck at whatever
// it was on first mount. The in-page tab buttons only call `setTab(...)`
// directly and never touch the URL, so this was purely a "component already
// mounted, only ?tab= changed" gap.
//
// Fixed by adding a useEffect keyed on `searchParams` that re-syncs `tab`
// whenever the URL's ?tab= changes to a new, valid value — without touching
// the case where ?tab= is absent (manual in-page switching, or a plain /hr
// visit, is left alone).
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import HRPage from './HRPage';

jest.mock('../contexts/AppContext', () => ({ useApp: () => ({ lang: 'ar' }) }));
jest.mock('../components/PageBanner', () => () => null);
// Stub every tab component — this test only cares about WHICH one is
// mounted, not their internal data/behavior (already covered by their own
// dedicated test files under pages/hr/).
jest.mock('./hr/EmployeesTab', () => () => <div>STUB_EMPLOYEES</div>);
jest.mock('./hr/OutgoingTab', () => () => <div>STUB_OUTGOING</div>);
jest.mock('./hr/IncomingTab', () => () => <div>STUB_INCOMING</div>);
jest.mock('./hr/RetiredTab', () => () => <div>STUB_RETIRED</div>);
jest.mock('./hr/DossiersTab', () => () => <div>STUB_DOSSIERS</div>);
jest.mock('./hr/BarcodeTab', () => () => <div>STUB_BARCODE</div>);

// A harness that renders HRPage alongside real react-router navigation
// buttons, so tests can simulate the exact real-world sequence: HRPage is
// already mounted, then the user clicks a different sidebar sub-tab link
// (a client-side navigation to the same /hr path with a different ?tab=).
function Harness() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate('/hr?tab=outgoing')}>go-outgoing</button>
      <button onClick={() => navigate('/hr?tab=retired')}>go-retired</button>
      <HRPage />
    </>
  );
}

function renderAt(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Harness />
    </MemoryRouter>
  );
}

describe('HRPage — ?tab= sidebar sub-navigation', () => {
  test('visiting /hr with no ?tab= shows the default (Employees) tab', () => {
    renderAt('/hr');
    expect(screen.getByText('STUB_EMPLOYEES')).toBeInTheDocument();
    expect(screen.queryByText('STUB_OUTGOING')).not.toBeInTheDocument();
  });

  test('mounting directly at /hr?tab=outgoing shows Outgoing immediately (already worked before the fix)', () => {
    renderAt('/hr?tab=outgoing');
    expect(screen.getByText('STUB_OUTGOING')).toBeInTheDocument();
    expect(screen.queryByText('STUB_EMPLOYEES')).not.toBeInTheDocument();
  });

  // This is the scenario that was actually broken: HRPage is already
  // mounted (on the default Employees tab), and the user clicks a sidebar
  // link to a different sub-tab of the SAME page — only the query string
  // changes, the path stays /hr, so HRPage is never remounted.
  test('navigating from /hr to /hr?tab=outgoing while already mounted switches to Outgoing (was stuck on Employees before the fix)', () => {
    renderAt('/hr');
    expect(screen.getByText('STUB_EMPLOYEES')).toBeInTheDocument();

    fireEvent.click(screen.getByText('go-outgoing'));

    expect(screen.getByText('STUB_OUTGOING')).toBeInTheDocument();
    expect(screen.queryByText('STUB_EMPLOYEES')).not.toBeInTheDocument();
  });

  test('navigating again to a second different tab (?tab=retired) while mounted keeps tracking the URL', () => {
    renderAt('/hr?tab=outgoing');
    expect(screen.getByText('STUB_OUTGOING')).toBeInTheDocument();

    fireEvent.click(screen.getByText('go-retired'));

    expect(screen.getByText('STUB_RETIRED')).toBeInTheDocument();
    expect(screen.queryByText('STUB_OUTGOING')).not.toBeInTheDocument();
  });
});

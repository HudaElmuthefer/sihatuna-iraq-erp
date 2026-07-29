// frontend/src/components/DateRangeFilter.test.js
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DateRangeFilter from './DateRangeFilter';

describe('DateRangeFilter', () => {
  // Smoke test: proves the component-test infrastructure itself works
  // (render + jest-dom matchers) before relying on it for anything else.
  test('renders the from/to inputs and preset buttons without crashing', () => {
    render(<DateRangeFilter lang="ar" from="" to="" onChange={() => {}} />);
    expect(screen.getByLabelText('من تاريخ')).toBeInTheDocument();
    expect(screen.getByLabelText('إلى تاريخ')).toBeInTheDocument();
    expect(screen.getByText('اليوم')).toBeInTheDocument();
    expect(screen.getByText('هذا الأسبوع')).toBeInTheDocument();
    expect(screen.getByText('هذا الشهر')).toBeInTheDocument();
    expect(screen.getByText('آخر 30 يوم')).toBeInTheDocument();
  });

  test('clicking the "Today" preset calls onChange with matching from/to dates in YYYY-MM-DD format', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<DateRangeFilter lang="ar" from="" to="" onChange={handleChange} />);

    await user.click(screen.getByText('اليوم'));

    expect(handleChange).toHaveBeenCalledTimes(1);
    const [from, to] = handleChange.mock.calls[0];
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(from).toBe(to); // "Today" is a single-day range
  });

  test('the "This month" preset starts on the 1st of the current month and ends today', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<DateRangeFilter lang="ar" from="" to="" onChange={handleChange} />);

    await user.click(screen.getByText('هذا الشهر'));

    const [from, to] = handleChange.mock.calls[0];
    const today = new Date();
    const expectedFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    expect(from).toBe(expectedFrom);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // fireEvent (not userEvent.type) is used for the date inputs: userEvent's
  // per-keystroke typing simulation isn't reliable for type="date" inputs,
  // which don't behave like plain text fields — setting the value directly
  // and firing "change" matches how a real date picker commits a value.
  test('manually changing the "from" date calls onChange with the new from and the existing to', () => {
    const handleChange = jest.fn();
    render(<DateRangeFilter lang="ar" from="" to="2026-07-20" onChange={handleChange} />);

    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-07-01' } });

    expect(handleChange).toHaveBeenCalledWith('2026-07-01', '2026-07-20');
  });

  test('manually changing the "to" date calls onChange with the existing from and the new to', () => {
    const handleChange = jest.fn();
    render(<DateRangeFilter lang="ar" from="2026-07-01" to="" onChange={handleChange} />);

    fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-07-20' } });

    expect(handleChange).toHaveBeenCalledWith('2026-07-01', '2026-07-20');
  });

  test('the clear button is hidden when no range is active, and appears once a range is set', () => {
    const { rerender } = render(<DateRangeFilter lang="ar" from="" to="" onChange={() => {}} />);
    expect(screen.queryByTitle('مسح فلتر التاريخ')).not.toBeInTheDocument();

    rerender(<DateRangeFilter lang="ar" from="2026-07-01" to="" onChange={() => {}} />);
    expect(screen.getByTitle('مسح فلتر التاريخ')).toBeInTheDocument();
  });

  test('clicking the clear button calls onChange with two empty strings', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<DateRangeFilter lang="ar" from="2026-07-01" to="2026-07-20" onChange={handleChange} />);

    await user.click(screen.getByTitle('مسح فلتر التاريخ'));

    expect(handleChange).toHaveBeenCalledWith('', '');
  });

  test('English mode renders English labels and presets', () => {
    render(<DateRangeFilter lang="en" from="" to="" onChange={() => {}} />);
    expect(screen.getByLabelText('From date')).toBeInTheDocument();
    expect(screen.getByLabelText('To date')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
  });

  test('an optional label is rendered when provided', () => {
    render(<DateRangeFilter lang="ar" from="" to="" onChange={() => {}} label="تاريخ التسجيل:" />);
    expect(screen.getByText('تاريخ التسجيل:')).toBeInTheDocument();
  });
});

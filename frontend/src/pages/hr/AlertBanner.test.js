// frontend/src/pages/hr/AlertBanner.test.js
//
// يتحقق من إصلاح خلل: كانت القائمة تعرض تنبيهاً لكل موظف مستحق بلا أي حد
// أقصى — ببيانات حقيقية (موظفون بلا lastPromotion/lastAllowance) يظهر شبه
// كل موظف "مستحق" معاً، فتُغطّي عشرات صفوف التنبيه الشاشة وتدفع الجدول
// الفعلي بعيداً للأسفل. هذا الاختبار يتأكد أن عدد الصفوف الظاهرة محدود
// بسقف معقول مهما كان عدد الموظفين المستحقين، وأن زر "عرض المزيد" يُظهر الباقي.
import { render, screen, fireEvent } from '@testing-library/react';
import AlertBanner from './AlertBanner';

// كل هؤلاء الموظفين مُعيَّنون منذ سنوات بلا lastPromotion/lastAllowance —
// يحاكي بيانات الإنتاج الحقيقية التي كشفت الخلل.
function manyOverdueEmployees(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `موظف ${i + 1}`,
    hireDate: '2015-01-01',
    certificate: 'بكالوريوس',
  }));
}

test('caps rendered alert rows even when most employees are overdue', () => {
  render(<AlertBanner employees={manyOverdueEmployees(36)} lang="ar" />);
  // كل موظف يحتمل صفّين (ترفيع + علاوة) = حتى 72 تنبيهاً محتملاً، لكن
  // الظاهر فعلياً بالبداية يجب أن يبقى محدوداً (8 كحد أقصى حسب MAX_VISIBLE).
  const rows = screen.getAllByText(/—/);
  expect(rows.length).toBeLessThanOrEqual(8);
});

test('shows a "show more" control and expands to reveal the rest', () => {
  render(<AlertBanner employees={manyOverdueEmployees(36)} lang="ar" />);
  const moreBtn = screen.getByRole('button');
  expect(moreBtn).toBeInTheDocument();
  fireEvent.click(moreBtn);
  const rowsAfterExpand = screen.getAllByText(/—/);
  expect(rowsAfterExpand.length).toBeGreaterThan(8);
});

test('renders nothing when no employee has a due alert', () => {
  const { container } = render(<AlertBanner employees={[]} lang="ar" />);
  expect(container.firstChild).toBeNull();
});

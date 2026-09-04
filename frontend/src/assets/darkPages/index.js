// سجل الصور المعتمَدة رسمياً كمصغرات صفحات — hard-map يدوي (بند صريح: لا
// اكتشاف تلقائي من مجلد وقت التشغيل، Webpack يستورد كل ملف صراحةً). كل صورة
// هنا فُحصت بصرياً وحقّقت الشرطين الإلزاميين معاً (بند صريح بالمواصفة):
//   1. شاشة مقعّرة/Concave فعلية بمحتوى صفحة حقيقي.
//   2. قاعدة/منصة هولوغرافية واضحة أسفل الشاشة (لا مجرد عنصر زخرفي داخلي).
// WebP بدل PNG الأصلي (نفس المحتوى البصري بالضبط، تحقّقتُ بصرياً) — إصلاح
// أداء نافذة المعاينة المكبّرة بـDashboardPage.js: هذه نفس الملفات المعروضة
// بالمصغّرات المدارية العشر وبالنافذة المكبّرة معاً، وكانت ~470-530 كيلوبايت
// لكل PNG غير مضغوط لمحتوى 640×480 فقط. راجع ملخص المهمة للأرقام الكاملة.
import dashboard from './page-dashboard.webp';
import patients from './page-patients.webp';
import medicalCodes from './page-medical-codes.webp';
import doctors from './page-doctors.webp';
import appointments from './page-appointments.webp';
import departments from './page-departments.webp';
import vaccinations from './page-vaccinations.webp';
import ambulance from './page-ambulance.webp';
import medicalLeave from './page-medical-leave.webp';
import aiDiagnosis from './page-ai-diagnosis.webp';

export const CURVED_PAGE_IMAGES = {
  dashboard,
  patients,
  'medical-codes': medicalCodes,
  doctors,
  appointments,
  departments,
  vaccinations,
  ambulance,
  'medical-leave': medicalLeave,
  'ai-diagnosis': aiDiagnosis,
};
